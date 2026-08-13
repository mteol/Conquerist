import { createHash, randomBytes } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';

/**
 * Sitzungen: eine Zeile je angemeldetem Geraet.
 *
 * Das Token ist kein getipptes Passwort, sondern 32 Zufallsbytes - deshalb
 * genuegt `sha256` und es braucht keine KDF. Der Klartext verlaesst den Server
 * genau einmal, naemlich in der Antwort, die ihn erzeugt.
 *
 * Getrennt von `Users`, weil es zwei Fragen sind: „wer bin ich" beantwortet
 * `users`, „ist dieser Browser angemeldet" beantwortet `sessions`. Solange
 * beides in einer Spalte stand, konnte es nur eine Antwort gleichzeitig geben.
 */
export interface IssuedSession {
  /** Geht an den Browser und wird dort abgelegt. */
  readonly token: string;
  /** Steht in der Datenbank und in der Verbindungssitzung. */
  readonly tokenHash: string;
}

/**
 * Wie lange eine Sitzung ohne Verwendung gilt: 60 Tage.
 *
 * Die Frist ist gleitend, weil diese Tabelle nicht nur Anmeldungen traegt,
 * sondern auch Gast-Identitaeten (`users.hello`). Eine absolute Frist naehme
 * einem Gast mitten im Betrieb seine Partien; gleitend trifft sie nur den,
 * der zwei Monate nicht da war.
 */
export const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Ab wann eine Verwendung die Frist neu setzt: nach einem Tag.
 *
 * Die Drossel braucht kein `last_used_at` daneben - wie lange die letzte
 * Verwendung her ist, steht bereits in `expires_at`. So wird hoechstens einmal
 * am Tag je Sitzung geschrieben statt einmal je Nachricht.
 */
export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface SessionOptions {
  readonly ttlMs?: number | undefined;
  readonly now?: (() => number) | undefined;
}

export class Sessions {
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(
    private readonly database: AppDatabase,
    options: SessionOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? SESSION_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  issue(userId: string): IssuedSession {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hash(token);
    const now = this.now();

    this.database
      .prepare(
        'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .run(tokenHash, userId, now, now + this.ttlMs);

    return { token, tokenHash };
  }

  /**
   * Wer gehoert zu diesem Token - und lebt es noch?
   *
   * Die abgelaufene Zeile wird beim Nachsehen gleich geloescht: sie ist ab
   * jetzt nur noch Ballast, und der einzige, der sie garantiert anfasst, ist
   * der, der sie gerade vorgelegt hat.
   */
  userIdOf(token: string): string | undefined {
    const tokenHash = hash(token);
    const row = this.database
      .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
      .get(tokenHash) as { user_id: string; expires_at: number } | undefined;

    if (row === undefined) return undefined;

    const now = this.now();
    if (row.expires_at <= now) {
      this.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return undefined;
    }

    if (row.expires_at - now < this.ttlMs - REFRESH_AFTER_MS) {
      this.database
        .prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
        .run(now + this.ttlMs, tokenHash);
    }

    return row.user_id;
  }

  /** Abgelaufene Zeilen wegraeumen; gibt zurueck, wie viele es waren. */
  purgeExpired(): number {
    return this.database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(this.now())
      .changes;
  }

  hashOf(token: string): string {
    return hash(token);
  }

  revoke(tokenHash: string): void {
    this.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  countFor(userId: string): number {
    const row = this.database
      .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?')
      .get(userId) as { n: number };

    return row.n;
  }
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
