import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import { Sessions } from './sessions.js';

function fixture(): { sessions: Sessions; userId: string } {
  const database = openDatabase(':memory:');
  database
    .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,?)')
    .run('u1', 'Anna', 1000);
  return { sessions: new Sessions(database), userId: 'u1' };
}

describe('Sitzungen', () => {
  it('loest ein ausgegebenes Token zu seinem Nutzer auf', () => {
    const { sessions, userId } = fixture();
    const { token } = sessions.issue(userId);

    expect(sessions.userIdOf(token)).toBe(userId);
  });

  it('kennt ein erfundenes Token nicht', () => {
    const { sessions } = fixture();
    expect(sessions.userIdOf('voellig-erfunden')).toBeUndefined();
  });

  it('legt das Token niemals im Klartext ab', () => {
    const database = openDatabase(':memory:');
    database
      .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,?)')
      .run('u1', 'Anna', 1000);
    const sessions = new Sessions(database);
    const { token } = sessions.issue('u1');

    const rows = database.prepare('SELECT token_hash FROM sessions').all() as {
      token_hash: string;
    }[];

    expect(rows[0]?.token_hash).not.toBe(token);
    expect(rows[0]?.token_hash).toHaveLength(64); // SHA-256 in hex
  });

  it('traegt zwei Geraete nebeneinander', () => {
    const { sessions, userId } = fixture();
    const laptop = sessions.issue(userId);
    const handy = sessions.issue(userId);

    expect(sessions.userIdOf(laptop.token)).toBe(userId);
    expect(sessions.userIdOf(handy.token)).toBe(userId);
    expect(sessions.countFor(userId)).toBe(2);
  });

  it('beendet beim Abmelden nur die eine Sitzung', () => {
    const { sessions, userId } = fixture();
    const laptop = sessions.issue(userId);
    const handy = sessions.issue(userId);

    sessions.revoke(laptop.tokenHash);

    expect(sessions.userIdOf(laptop.token)).toBeUndefined();
    expect(sessions.userIdOf(handy.token)).toBe(userId);
  });
});
