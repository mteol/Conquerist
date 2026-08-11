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

export class Sessions {
  constructor(private readonly database: AppDatabase) {}

  issue(userId: string): IssuedSession {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hash(token);

    this.database
      .prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)')
      .run(tokenHash, userId, Date.now());

    return { token, tokenHash };
  }

  userIdOf(token: string): string | undefined {
    const row = this.database
      .prepare('SELECT user_id FROM sessions WHERE token_hash = ?')
      .get(hash(token)) as { user_id: string } | undefined;

    return row?.user_id;
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
