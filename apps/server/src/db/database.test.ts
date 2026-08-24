import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { DEFAULT_VICTORY_POINT_GOAL, SEAT_COLORS } from '@conquerist/shared';
import { migrate, openDatabase } from './database.js';
import type { AppDatabase } from './database.js';

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
      .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,0)')
      .run('u1', 'Anna');
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
    // Der Stand vor Etappe 1: nur die users-Tabelle aus stepInitialSchema,
    // user_version noch nie gesetzt (SQLite-Default 0). Anders als bei einer
    // bereits fertig migrierten Datenbank mit zurueckgesetztem user_version
    // ist das ein Zustand, den es wirklich geben kann - stepSessionsAndAccounts
    // ist nicht idempotent und darf auf einer schon fertigen Datenbank nicht
    // ein zweites Mal laufen.
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_guest INTEGER NOT NULL DEFAULT 1,
        secret_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
      );
    `);

    migrate(database);

    const [{ user_version: version }] = database.pragma('user_version') as [
      { user_version: number },
    ];
    expect(version).toBeGreaterThan(0);
  });
});

describe('Migration auf sessions', () => {
  /** Eine Datenbank so, wie sie vor dieser Etappe aussah. */
  function legacyDatabase(): AppDatabase {
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_guest INTEGER NOT NULL DEFAULT 1,
        secret_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
      );
      CREATE TABLE rooms (
        code TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES users(id),
        seat_count INTEGER NOT NULL, seed TEXT NOT NULL, version INTEGER NOT NULL,
        created_at INTEGER NOT NULL, start_state TEXT, finished_at INTEGER
      );
      CREATE TABLE room_seats (
        code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        position INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
        PRIMARY KEY (code, position)
      );
      CREATE TABLE room_actions (
        code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL, action TEXT NOT NULL, PRIMARY KEY (code, ordinal)
      );
    `);
    database.pragma('user_version = 1'); // Schritt 0 gilt als gelaufen
    return database;
  }

  it('rettet das Geheimnis eines Gastes in die neue Tabelle', () => {
    const database = legacyDatabase();
    database
      .prepare('INSERT INTO users (id, name, is_guest, secret_hash, created_at) VALUES (?,?,1,?,?)')
      .run('u1', 'Anna', 'hash-von-anna', 1000);

    migrate(database);

    const row = database
      .prepare('SELECT user_id, created_at FROM sessions WHERE token_hash = ?')
      .get('hash-von-anna') as { user_id: string; created_at: number } | undefined;

    expect(row?.user_id).toBe('u1');
    expect(row?.created_at).toBe(1000);
  });

  it('laesst den Sitz bei derselben Person', () => {
    const database = legacyDatabase();
    database
      .prepare('INSERT INTO users (id, name, is_guest, secret_hash, created_at) VALUES (?,?,1,?,?)')
      .run('u1', 'Anna', 'hash-von-anna', 1000);
    database
      .prepare(
        'INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('AB12', 'u1', 3, 'saat', 1, 1000);
    database
      .prepare('INSERT INTO room_seats (code, position, user_id) VALUES (?,?,?)')
      .run('AB12', 0, 'u1');

    migrate(database);

    const seat = database
      .prepare('SELECT user_id FROM room_seats WHERE code = ? AND position = 0')
      .get('AB12') as { user_id: string };
    expect(seat.user_id).toBe('u1');
  });

  it('nimmt secret_hash aus users heraus und haengt die Kontospalten an', () => {
    const database = legacyDatabase();
    migrate(database);

    const columns = (database.pragma('table_info(users)') as { name: string }[]).map((c) => c.name);

    expect(columns).not.toContain('secret_hash');
    expect(columns).toEqual(expect.arrayContaining(['login', 'password_hash', 'email']));
  });

  it('laesst mehrere Gaeste ohne login nebeneinander bestehen', () => {
    const database = openDatabase(':memory:');
    const insert = database.prepare(
      'INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,?)',
    );

    expect(() => {
      insert.run('u1', 'Anna', 1);
      insert.run('u2', 'Bea', 2);
    }).not.toThrow();
  });

  it('laesst denselben login kein zweites Mal zu', () => {
    const database = openDatabase(':memory:');
    const insert = database.prepare(
      'INSERT INTO users (id, name, is_guest, login, created_at) VALUES (?,?,0,?,?)',
    );
    insert.run('u1', 'Anna', 'anna', 1);

    expect(() => insert.run('u2', 'Andere', 'anna', 2)).toThrow();
  });
});

describe('Migration auf ablaufende Sitzungen', () => {
  /** Eine Datenbank auf dem Stand von Etappe 7: sessions ohne expires_at. */
  function withoutExpiry(): AppDatabase {
    const database = new Database(':memory:');
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_guest INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL, login TEXT, password_hash TEXT, email TEXT
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL
      );
      /*
       * Raum und Sitze gehoerten zu diesem Stand ebenfalls schon - sie standen
       * hier nur nicht, solange kein Schritt sie anfasste. Seit Schritt 4 tut
       * einer das, und eine Nachbildung, in der die Tabelle fehlt, laesst ihn
       * an etwas scheitern, das es in Wirklichkeit gab.
       */
      CREATE TABLE rooms (
        code TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES users(id),
        seat_count INTEGER NOT NULL, seed TEXT NOT NULL, version INTEGER NOT NULL,
        created_at INTEGER NOT NULL, start_state TEXT, finished_at INTEGER
      );
      CREATE TABLE room_seats (
        code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        position INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
        PRIMARY KEY (code, position)
      );
    `);
    database.pragma('user_version = 2'); // Schritte 0 und 1 gelten als gelaufen
    return database;
  }

  it('gibt bestehenden Sitzungen eine Frist aus ihrem created_at', () => {
    const database = withoutExpiry();
    database
      .prepare('INSERT INTO users (id, name, created_at) VALUES (?,?,?)')
      .run('u1', 'Anna', 1000);
    database
      .prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?,?,?)')
      .run('hash-von-anna', 'u1', 1000);

    migrate(database);

    const row = database
      .prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
      .get('hash-von-anna') as { expires_at: number } | undefined;

    // 60 Tage in Millisekunden, aus created_at heraus - nicht aus der Uhr.
    expect(row?.expires_at).toBe(1000 + 5_184_000_000);
  });

  it('laesst die Liste bis zum letzten Schritt durchlaufen', () => {
    const database = withoutExpiry();

    migrate(database);

    const [{ user_version: version }] = database.pragma('user_version') as [
      { user_version: number },
    ];
    // Nicht mehr auf eine feste Zahl geprueft: die waechst mit jedem Schritt,
    // und der Test soll den Durchlauf festhalten und nicht die Laenge der Liste.
    expect(version).toBeGreaterThanOrEqual(4);
  });
});

/**
 * Etappe 10: Farbe am Sitz, Siegpunktziel am Raum.
 *
 * Der Bestand bekommt genau das, was vorher galt - die Farbe der Position und
 * das Ziel aus der Schachtel. Das ist der Punkt, an dem sich ein
 * Migrationsschritt bewaehrt: eine Datenbank, die vorher lief, muss danach
 * dasselbe Spiel zeigen und nicht ein leicht anderes.
 */
describe('Migration auf gewaehlte Farbe und eingestelltes Ziel', () => {
  /** Eine Datenbank auf dem Stand von Etappe 9. */
  function beforeChoice(): AppDatabase {
    const database = new Database(':memory:');
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_guest INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL, login TEXT, password_hash TEXT, email TEXT
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE rooms (
        code TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES users(id),
        seat_count INTEGER NOT NULL, seed TEXT NOT NULL, version INTEGER NOT NULL,
        created_at INTEGER NOT NULL, start_state TEXT, finished_at INTEGER
      );
      CREATE TABLE room_seats (
        code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        position INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
        PRIMARY KEY (code, position)
      );
    `);
    database.pragma('user_version = 3');
    return database;
  }

  it('gibt jedem bestehenden Sitz die Farbe, die seine Position bisher ergab', () => {
    const database = beforeChoice();
    database.prepare('INSERT INTO users (id, name, created_at) VALUES (?,?,?)').run('u1', 'A', 0);
    database.prepare('INSERT INTO users (id, name, created_at) VALUES (?,?,?)').run('u2', 'B', 0);
    database
      .prepare(
        'INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('K7X2', 'u1', 3, 'abc', 1, 0);
    database
      .prepare('INSERT INTO room_seats (code, position, user_id) VALUES (?,?,?)')
      .run('K7X2', 0, 'u1');
    database
      .prepare('INSERT INTO room_seats (code, position, user_id) VALUES (?,?,?)')
      .run('K7X2', 1, 'u2');

    migrate(database);

    const colors = database
      .prepare('SELECT position, color FROM room_seats WHERE code = ? ORDER BY position')
      .all('K7X2') as { position: number; color: string }[];

    expect(colors.map((row) => row.color)).toEqual([SEAT_COLORS[0], SEAT_COLORS[1]]);
  });

  it('gibt bestehenden Raeumen das Ziel, mit dem sie begonnen haben', () => {
    const database = beforeChoice();
    database.prepare('INSERT INTO users (id, name, created_at) VALUES (?,?,?)').run('u1', 'A', 0);
    database
      .prepare(
        'INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('K7X2', 'u1', 3, 'abc', 1, 0);

    migrate(database);

    const row = database
      .prepare('SELECT victory_point_goal FROM rooms WHERE code = ?')
      .get('K7X2') as { victory_point_goal: number };

    expect(row.victory_point_goal).toBe(DEFAULT_VICTORY_POINT_GOAL);
  });
});

/**
 * Der Schritt, der den Abbruch moeglich macht.
 *
 * Ein Wert, der frueher keiner war: bis hierher endete eine Partie nur durch
 * Sieg (`finished_at`). Alles, was schon in der Datenbank steht, laeuft noch -
 * und genau das muss der Schritt hinterlassen.
 */
describe('Abgebrochene Partien', () => {
  it('legt die Spalte an und laesst jede bestehende Partie laufen', () => {
    const database = openDatabase(':memory:');
    database.prepare('INSERT INTO users (id, name, created_at) VALUES (?,?,?)').run('u1', 'A', 0);
    database
      .prepare(
        `INSERT INTO rooms (code, host_id, seat_count, seed, victory_point_goal, version, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .run('K7X2', 'u1', 3, 'abc', 10, 1, 0);

    const columns = (database.pragma('table_info(rooms)') as { name: string }[]).map(
      (column) => column.name,
    );
    expect(columns).toContain('abandoned_at');

    const row = database.prepare('SELECT abandoned_at FROM rooms WHERE code = ?').get('K7X2') as {
      abandoned_at: number | null;
    };
    expect(row.abandoned_at).toBeNull();
  });

  it('setzt jeden bestehenden Sitz auf „sitzt noch da‘', () => {
    const database = openDatabase(':memory:');
    database.prepare('INSERT INTO users (id, name, created_at) VALUES (?,?,?)').run('u1', 'A', 0);
    database
      .prepare(
        `INSERT INTO rooms (code, host_id, seat_count, seed, victory_point_goal, version, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .run('K7X2', 'u1', 3, 'abc', 10, 1, 0);
    database
      .prepare('INSERT INTO room_seats (code, position, user_id, color) VALUES (?,?,?,?)')
      .run('K7X2', 0, 'u1', SEAT_COLORS[0]);

    const row = database.prepare('SELECT away FROM room_seats WHERE code = ?').get('K7X2') as {
      away: number;
    };

    // Vor diesem Schritt konnte niemand einen Tisch verlassen, ohne den Platz
    // aufzugeben - es gab die Tuer nicht. 0 ist also kein Vorgabewert, sondern
    // genau das, was fuer jede bestehende Zeile galt.
    expect(row.away).toBe(0);
  });
});
