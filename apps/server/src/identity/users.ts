import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';
import type { Sessions } from './sessions.js';

/**
 * Nutzerzeilen (Regel 7: Identitaet ab Tag 1).
 *
 * Ein Gast ist eine Zeile mit `login IS NULL`, ein Konto eine mit gefuelltem
 * `login` - kein zweiter Datentyp, sondern dieselbe Zeile mit mehr darin.
 * Genau deshalb ueberlebt beim Beanspruchen jeder Sitz: es wird nichts
 * umgehaengt, es wird nur ergaenzt.
 *
 * Das Sitzungsgeheimnis liegt seit Etappe 7 nicht mehr hier, sondern in
 * `sessions` - eine Person kann an mehreren Geraeten angemeldet sein.
 */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly isGuest: boolean;
  /** Fehlt bei Gaesten. */
  readonly login?: string;
}

export interface HelloResult {
  readonly user: User;
  /** Nur beim Anlegen gefuellt - danach kennt der Browser es. */
  readonly secret?: string;
  /** Womit die Verbindung ihre Sitzung wiederfindet (fuers Abmelden). */
  readonly tokenHash: string;
}

/** Was zum Anmelden gebraucht wird - inklusive des Hashes. */
export interface AccountRow {
  readonly id: string;
  readonly name: string;
  readonly login: string;
  readonly passwordHash: string;
}

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly is_guest: number;
  readonly login: string | null;
}

export class Users {
  constructor(
    private readonly database: AppDatabase,
    private readonly sessions: Sessions,
  ) {}

  /**
   * Anmelden oder anlegen.
   *
   * Ein unbekanntes Geheimnis wirft, statt still einen neuen Gast anzulegen:
   * sonst waere ein Tippfehler im `localStorage` nicht von einem Angriff zu
   * unterscheiden, und der Tisch fuellte sich mit Karteileichen.
   */
  hello(secret: string | undefined, name: string | undefined): HelloResult {
    if (secret === undefined) return this.createGuest(name ?? 'Gast');

    const userId = this.sessions.userIdOf(secret);
    if (userId === undefined) throw new Error('Unbekanntes Sitzungsgeheimnis');

    const user = this.byId(userId);
    if (user === undefined) throw new Error('Sitzung ohne Nutzer');

    const tokenHash = this.sessions.hashOf(secret);

    if (name !== undefined && name !== user.name) {
      this.database.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
      return { user: { ...user, name }, tokenHash };
    }

    return { user, tokenHash };
  }

  createGuest(name: string): HelloResult {
    const id = randomUUID();

    // Beide Schreibvorgaenge in EINER Transaktion: sonst bliebe bei einem
    // Fehler in sessions.issue() die users-Zeile stehen - ein Gast, zu dem es
    // nie ein Geheimnis geben wird und der damit fuer immer unerreichbar ist.
    const { token, tokenHash } = this.database.transaction(() => {
      this.database
        .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?, ?, 1, ?)')
        .run(id, name, Date.now());

      return this.sessions.issue(id);
    })();

    return { user: { id, name, isGuest: true }, secret: token, tokenHash };
  }

  byId(id: string): User | undefined {
    const row = this.database
      .prepare('SELECT id, name, is_guest, login FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;

    return row === undefined ? undefined : toUser(row);
  }

  byLogin(login: string): AccountRow | undefined {
    const row = this.database
      .prepare('SELECT id, name, login, password_hash FROM users WHERE login = ?')
      .get(login) as { id: string; name: string; login: string; password_hash: string } | undefined;

    return row === undefined
      ? undefined
      : { id: row.id, name: row.name, login: row.login, passwordHash: row.password_hash };
  }

  count(): number {
    const row = this.database.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return row.n;
  }

  /**
   * Aus dem Gast wird ein Konto - dieselbe Zeile, nur voller.
   *
   * `is_guest` und `login` werden zusammen gesetzt. Sie sagen dasselbe, und
   * getrennt gesetzt liefe genau das auseinander.
   */
  claim(
    id: string,
    fields: {
      readonly login: string;
      readonly passwordHash: string;
      readonly email?: string | undefined;
      readonly name?: string | undefined;
    },
  ): User {
    this.database
      .prepare(
        `UPDATE users
            SET login = ?, password_hash = ?, email = ?, is_guest = 0,
                name = COALESCE(?, name)
          WHERE id = ?`,
      )
      .run(fields.login, fields.passwordHash, fields.email ?? null, fields.name ?? null, id);

    const user = this.byId(id);
    if (user === undefined) throw new Error('Beanspruchte Zeile ist verschwunden');
    return user;
  }

  createAccount(fields: {
    readonly login: string;
    readonly passwordHash: string;
    readonly email?: string | undefined;
    readonly name: string;
  }): User {
    const id = randomUUID();
    this.database
      .prepare(
        `INSERT INTO users (id, name, is_guest, login, password_hash, email, created_at)
         VALUES (?, ?, 0, ?, ?, ?, ?)`,
      )
      .run(id, fields.name, fields.login, fields.passwordHash, fields.email ?? null, Date.now());

    return { id, name: fields.name, isGuest: false, login: fields.login };
  }
}

function toUser(row: UserRow): User {
  return row.login === null
    ? { id: row.id, name: row.name, isGuest: row.is_guest === 1 }
    : { id: row.id, name: row.name, isGuest: row.is_guest === 1, login: row.login };
}
