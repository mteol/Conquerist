import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate, openDatabase } from './database.js';

const created: string[] = [];

afterEach(() => {
  while (created.length > 0) {
    rmSync(created.pop()!, { recursive: true, force: true });
  }
});

describe('Datenbank oeffnen', () => {
  it('legt den Ordner an, wenn es ihn noch nicht gibt', () => {
    // Genau der Fall des ersten Starts: `data/` ist gitignored und existiert
    // auf einem frischen Clone nicht. better-sqlite3 legt ihn nicht selbst an,
    // sondern wirft - der Server kam damit kein einziges Mal hoch.
    const base = mkdtempSync(join(tmpdir(), 'conquerist-db-'));
    created.push(base);

    const database = openDatabase(join(base, 'noch', 'nicht', 'da', 'conquerist.db'));

    expect(database.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });
    database.close();
  });

  it('braucht fuer :memory: keinen Ordner', () => {
    const database = openDatabase(':memory:');

    expect(database.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });
    database.close();
  });

  it('legt die Tabellen fuer Raeume, Sitze und Log an', () => {
    const database = openDatabase(':memory:');

    const names = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];

    expect(names.map((row) => row.name)).toEqual(
      expect.arrayContaining(['room_actions', 'room_seats', 'rooms', 'users']),
    );
    database.close();
  });

  it('raeumt Sitze und Log mit, wenn ein Raum verschwindet', () => {
    const database = openDatabase(':memory:');
    database
      .prepare('INSERT INTO users (id, name, is_guest, secret_hash, created_at) VALUES (?,?,1,?,0)')
      .run('u1', 'Anna', 'hash-1');
    database
      .prepare(
        'INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('K7X2', 'u1', 3, 'abc', 1, 0);
    database
      .prepare('INSERT INTO room_seats (code, position, user_id) VALUES (?,?,?)')
      .run('K7X2', 0, 'u1');
    database
      .prepare('INSERT INTO room_actions (code, ordinal, action) VALUES (?,?,?)')
      .run('K7X2', 0, '{}');

    database.prepare('DELETE FROM rooms WHERE code = ?').run('K7X2');

    // Ohne ON DELETE CASCADE bliebe Muell liegen, den niemand mehr findet.
    const seats = database.prepare('SELECT COUNT(*) AS n FROM room_seats').get() as { n: number };
    const actions = database.prepare('SELECT COUNT(*) AS n FROM room_actions').get() as {
      n: number;
    };
    expect(seats.n).toBe(0);
    expect(actions.n).toBe(0);
    database.close();
  });
});

describe('Migrationen', () => {
  it('setzt user_version auf die Zahl der angewandten Schritte', () => {
    const database = openDatabase(':memory:');
    const [{ user_version: version }] = database.pragma('user_version') as [
      { user_version: number },
    ];

    expect(version).toBeGreaterThan(0);
  });

  it('laeuft zweimal hintereinander ohne Wirkung und ohne Wurf', () => {
    const database = openDatabase(':memory:');
    const before = database.pragma('user_version');

    expect(() => migrate(database)).not.toThrow();
    expect(database.pragma('user_version')).toEqual(before);
  });

  it('holt eine Datenbank ohne user_version von vorne ab', () => {
    // Der Stand vor dieser Etappe: Tabellen da, user_version noch 0.
    const database = openDatabase(':memory:');
    database.pragma('user_version = 0');

    migrate(database);

    const [{ user_version: version }] = database.pragma('user_version') as [
      { user_version: number },
    ];
    expect(version).toBeGreaterThan(0);
  });
});
