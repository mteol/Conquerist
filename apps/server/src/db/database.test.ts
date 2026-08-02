import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from './database.js';

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
});
