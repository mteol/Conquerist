import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import { Accounts, AccountError } from './accounts.js';
import { LOGIN_MAX_FAILURES, LoginThrottle } from './loginThrottle.js';
import { Sessions } from './sessions.js';
import { Users } from './users.js';

function fixture() {
  const database = openDatabase(':memory:');
  const sessions = new Sessions(database);
  const users = new Users(database, sessions);
  const throttle = new LoginThrottle();
  return { database, sessions, users, throttle, accounts: new Accounts(users, sessions, throttle) };
}

describe('Konten', () => {
  it('macht aus dem Gast ein Konto - dieselbe Zeile, dieselbe Id', async () => {
    const { users, accounts } = fixture();
    const guest = users.hello(undefined, 'Anna');

    const claimed = await accounts.register(
      { login: 'anna', password: 'langgenug1' },
      guest.user.id,
      guest.tokenHash,
    );

    expect(claimed.user.id).toBe(guest.user.id);
    expect(claimed.user.isGuest).toBe(false);
    expect(claimed.user.login).toBe('anna');
    // Kein neues Geheimnis: das Geraet war schon angemeldet.
    expect(claimed.secret).toBeUndefined();
  });

  it('laesst die Sitze beim Beanspruchen unberuehrt', async () => {
    const { database, users, accounts } = fixture();
    const guest = users.hello(undefined, 'Anna');
    database
      .prepare(
        'INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('AB12', guest.user.id, 3, 'saat', 1, 1);
    database
      .prepare('INSERT INTO room_seats (code, position, user_id) VALUES (?,?,?)')
      .run('AB12', 0, guest.user.id);

    await accounts.register(
      { login: 'anna', password: 'langgenug1' },
      guest.user.id,
      guest.tokenHash,
    );

    const seat = database.prepare('SELECT user_id FROM room_seats WHERE code = ?').get('AB12') as {
      user_id: string;
    };
    expect(seat.user_id).toBe(guest.user.id);
  });

  it('legt ohne Sitzung ein frisches Konto samt Geheimnis an', async () => {
    const { accounts } = fixture();

    const created = await accounts.register(
      { login: 'anna', password: 'langgenug1', name: 'Anna' },
      null,
      null,
    );

    expect(created.user.isGuest).toBe(false);
    expect(created.secret).toBeTruthy();
  });

  it('vergibt denselben Login kein zweites Mal', async () => {
    const { accounts } = fixture();
    await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);

    await expect(
      accounts.register({ login: 'anna', password: 'anderes123' }, null, null),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it('meldet an zwei Geraeten gleichzeitig an', async () => {
    const { sessions, accounts, users } = fixture();
    const account = await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);

    const laptop = await accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0);
    const handy = await accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0);

    expect(sessions.userIdOf(laptop.secret ?? '')).toBe(account.user.id);
    expect(sessions.userIdOf(handy.secret ?? '')).toBe(account.user.id);
    expect(users.byId(account.user.id)?.isGuest).toBe(false);
  });

  it('weist falsches Passwort und unbekannten Login mit derselben Meldung ab', async () => {
    const { accounts } = fixture();
    await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);

    const falsch = await accounts
      .login({ login: 'anna', password: 'ganzfalsch1' }, null, null, 0)
      .catch((error: AccountError) => error.message);
    const unbekannt = await accounts
      .login({ login: 'niemand', password: 'ganzfalsch1' }, null, null, 0)
      .catch((error: AccountError) => error.message);

    expect(falsch).toBe(unbekannt);
  });

  it('verlangt eine Bestaetigung, solange der Gast noch an Tischen sitzt', async () => {
    const { users, accounts } = fixture();
    await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);
    const guest = users.hello(undefined, 'Gast');

    await expect(
      accounts.login({ login: 'anna', password: 'langgenug1' }, guest.user.id, guest.tokenHash, 2),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it('laesst die Gastzeile nach dem Wechsel stehen - dort sitzen noch andere mit', async () => {
    const { users, accounts } = fixture();
    await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);
    const guest = users.hello(undefined, 'Gast');

    await accounts.login(
      { login: 'anna', password: 'langgenug1', confirmAbandonGuest: true },
      guest.user.id,
      guest.tokenHash,
      2,
    );

    expect(users.byId(guest.user.id)).toBeDefined();
  });

  it('beendet beim Abmelden nur dieses Geraet und gibt einen frischen Gast zurueck', async () => {
    const { sessions, accounts } = fixture();
    const laptop = await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);
    const handy = await accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0);

    const after = accounts.logout(laptop.tokenHash);

    expect(after.user.isGuest).toBe(true);
    expect(after.secret).toBeTruthy();
    expect(sessions.userIdOf(handy.secret ?? '')).toBeTruthy();
  });
});

describe('Anmelden mit Drossel', () => {
  async function withAccount() {
    const parts = fixture();
    await parts.accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);
    return parts;
  }

  it('sperrt nach zehn Fehlversuchen und nennt eine Wartezeit', async () => {
    const { accounts } = await withAccount();

    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      await expect(
        accounts.login({ login: 'anna', password: 'falsch' }, null, null, 0),
      ).rejects.toThrow(AccountError);
    }

    await expect(
      accounts.login({ login: 'anna', password: 'falsch' }, null, null, 0),
    ).rejects.toThrow(/Minute/);
  });

  it('sperrt auch das richtige Passwort, solange die Frist laeuft', async () => {
    const { accounts } = await withAccount();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      await accounts
        .login({ login: 'anna', password: 'falsch' }, null, null, 0)
        .catch(() => undefined);
    }

    await expect(
      accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0),
    ).rejects.toThrow(/Fehlversuche/);
  });

  it('raeumt den Zaehler ab, wenn die Anmeldung gelingt', async () => {
    const { accounts, throttle } = await withAccount();
    await accounts
      .login({ login: 'anna', password: 'falsch' }, null, null, 0)
      .catch(() => undefined);

    await accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0);

    expect(throttle.knows('anna')).toBe(false);
  });

  it('zaehlt auch einen Namen, den es gar nicht gibt', async () => {
    const { accounts, throttle } = await withAccount();

    await accounts
      .login({ login: 'gibtesnicht', password: 'falsch' }, null, null, 0)
      .catch(() => undefined);

    expect(throttle.knows('gibtesnicht')).toBe(true);
  });
});
