import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import type { AppDatabase } from '../db/database.js';
import { REFRESH_AFTER_MS, SESSION_TTL_MS, Sessions } from './sessions.js';

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

/** Eine Uhr, die stillsteht, bis man sie weiterdreht. */
function clockAt(start: number) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function fixtureWithClock(start: number) {
  const database = openDatabase(':memory:');
  database
    .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,?)')
    .run('u1', 'Anna', start);
  const clock = clockAt(start);
  const sessions = new Sessions(database, { now: clock.now });
  return { database, sessions, clock, userId: 'u1' };
}

function expiryOf(database: AppDatabase, tokenHash: string): number {
  const row = database
    .prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash) as { expires_at: number };
  return row.expires_at;
}

describe('Sitzungen laufen ab', () => {
  it('kennt ein Token nach Ablauf der Frist nicht mehr', () => {
    const { sessions, clock, userId } = fixtureWithClock(1_000_000);
    const { token } = sessions.issue(userId);

    clock.advance(SESSION_TTL_MS + 1);

    expect(sessions.userIdOf(token)).toBeUndefined();
  });

  it('raeumt die abgelaufene Zeile beim Nachsehen gleich weg', () => {
    const { database, sessions, clock, userId } = fixtureWithClock(1_000_000);
    const { token } = sessions.issue(userId);

    clock.advance(SESSION_TTL_MS + 1);
    sessions.userIdOf(token);

    const row = database.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    expect(row.n).toBe(0);
  });

  it('schreibt bei einer frischen Sitzung nicht bei jeder Verwendung', () => {
    const { database, sessions, clock, userId } = fixtureWithClock(1_000_000);
    const { token, tokenHash } = sessions.issue(userId);
    const before = expiryOf(database, tokenHash);

    clock.advance(60_000); // eine Minute spaeter
    sessions.userIdOf(token);

    expect(expiryOf(database, tokenHash)).toBe(before);
  });

  it('verlaengert die Frist, wenn die letzte Verwendung mehr als einen Tag her ist', () => {
    const { database, sessions, clock, userId } = fixtureWithClock(1_000_000);
    const { token, tokenHash } = sessions.issue(userId);

    clock.advance(REFRESH_AFTER_MS + 1);
    sessions.userIdOf(token);

    expect(expiryOf(database, tokenHash)).toBe(1_000_000 + REFRESH_AFTER_MS + 1 + SESSION_TTL_MS);
  });

  it('raeumt beim Aufraeumen nur die abgelaufenen Zeilen weg', () => {
    const { database, sessions, clock, userId } = fixtureWithClock(1_000_000);
    sessions.issue(userId); // laeuft ab
    clock.advance(SESSION_TTL_MS - 1_000);
    sessions.issue(userId); // bleibt
    clock.advance(2_000);

    expect(sessions.purgeExpired()).toBe(1);

    const row = database.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    expect(row.n).toBe(1);
  });
});
