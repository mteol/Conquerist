import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';

/**
 * Gaeste und ihre Sitzungsgeheimnisse (Regel 7: Identitaet ab Tag 1).
 *
 * Das Geheimnis wird **gehasht** abgelegt, obwohl es „nur" ein Gast ist. Zwei
 * Gruende: es ist faktisch ein Passwort - wer es hat, ist diese Person -, und
 * in Etappe 7 wird aus genau dieser Zeile per UPDATE ein richtiges Konto. Wer
 * jetzt Klartext speichert, hat das Datenleck dann schon eingebaut.
 */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly isGuest: boolean;
}

export interface HelloResult {
  readonly user: User;
  /** Nur beim Anlegen gefuellt - danach kennt der Browser es. */
  readonly secret?: string;
}

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly is_guest: number;
}

export class Users {
  constructor(private readonly database: AppDatabase) {}

  /**
   * Anmelden oder anlegen.
   *
   * Ein unbekanntes Geheimnis wirft, statt still einen neuen Gast anzulegen:
   * sonst waere ein Tippfehler im `localStorage` nicht von einem Angriff zu
   * unterscheiden, und der Tisch fuellte sich mit Karteileichen.
   */
  hello(secret: string | undefined, name: string | undefined): HelloResult {
    if (secret === undefined) return this.createGuest(name ?? 'Gast');

    const row = this.database
      .prepare('SELECT id, name, is_guest FROM users WHERE secret_hash = ?')
      .get(hash(secret)) as UserRow | undefined;

    if (row === undefined) {
      throw new Error('Unbekanntes Sitzungsgeheimnis');
    }

    if (name !== undefined && name !== row.name) {
      this.database.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, row.id);
      return { user: { id: row.id, name, isGuest: row.is_guest === 1 } };
    }

    return { user: { id: row.id, name: row.name, isGuest: row.is_guest === 1 } };
  }

  createGuest(name: string): HelloResult {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');

    this.database
      .prepare(
        'INSERT INTO users (id, name, is_guest, secret_hash, created_at) VALUES (?, ?, 1, ?, ?)',
      )
      .run(id, name, hash(secret), Date.now());

    return { user: { id, name, isGuest: true }, secret };
  }

  byId(id: string): User | undefined {
    const row = this.database
      .prepare('SELECT id, name, is_guest FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;

    return row === undefined
      ? undefined
      : { id: row.id, name: row.name, isGuest: row.is_guest === 1 };
  }

  count(): number {
    const row = this.database.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return row.n;
  }
}

function hash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
