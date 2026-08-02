import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

/**
 * SQLite-Verbindung samt Schema.
 *
 * `WAL` und `foreign_keys` werden beim Oeffnen gesetzt, nicht irgendwo spaeter:
 * eine Verbindung ohne diese Pragmas verhaelt sich anders, und genau solche
 * Unterschiede zwischen Test und Betrieb sind teuer.
 *
 * Das Schema wandert mit dem Code (`migrate`), nicht in eine Datei daneben.
 * Solange es eine Tabelle ist, ist das ehrlicher als ein Migrationswerkzeug.
 */
export type AppDatabase = Database.Database;

/** Der Sonderwert, bei dem nichts auf der Platte landet. */
const IN_MEMORY = ':memory:';

export function openDatabase(file: string): AppDatabase {
  // better-sqlite3 legt den Ordner nicht an und wirft stattdessen „directory
  // does not exist". Der Default liegt unter `data/`, das gitignored ist und
  // auf einem frischen Clone nicht existiert - ohne diese Zeile startet der
  // Server also genau einmal nicht, naemlich beim allerersten Mal.
  if (file !== IN_MEMORY) {
    mkdirSync(dirname(file), { recursive: true });
  }

  const database = new Database(file);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  migrate(database);
  return database;
}

export function migrate(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      is_guest     INTEGER NOT NULL DEFAULT 1,
      secret_hash  TEXT NOT NULL UNIQUE,
      created_at   INTEGER NOT NULL
    );
  `);
}
