import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import { Users } from './users.js';
import { Sessions } from './sessions.js';

function users(): Users {
  const database = openDatabase(':memory:');
  return new Users(database, new Sessions(database));
}

describe('Identitaet', () => {
  it('legt beim ersten Besuch einen Gast an und gibt ein Geheimnis heraus', () => {
    const store = users();
    const first = store.hello(undefined, 'Anna');

    expect(first.user.isGuest).toBe(true);
    expect(first.user.name).toBe('Anna');
    expect(first.secret).toBeTruthy();
  });

  it('erkennt dieselbe Person am Geheimnis wieder - ohne neue Zeile', () => {
    const store = users();
    const first = store.hello(undefined, 'Anna');
    const again = store.hello(first.secret, undefined);

    expect(again.user.id).toBe(first.user.id);
    // Kein zweites Geheimnis: der Browser hat seins schon.
    expect(again.secret).toBeUndefined();
    expect(store.count()).toBe(1);
  });

  it('legt bei einem falschen Geheimnis keine Zeile an, sondern lehnt ab', () => {
    const store = users();
    store.hello(undefined, 'Anna');

    expect(() => store.hello('voellig-erfunden', 'Boeser')).toThrow();
    expect(store.count()).toBe(1);
  });

  it('speichert das Geheimnis niemals im Klartext', () => {
    const database = openDatabase(':memory:');
    const store = new Users(database, new Sessions(database));
    const created = store.hello(undefined, 'Anna');

    const row = database.prepare('SELECT token_hash FROM sessions').get() as {
      token_hash: string;
    };

    expect(row.token_hash).not.toBe(created.secret);
    expect(row.token_hash).toHaveLength(64); // SHA-256 in hex
  });

  it('uebernimmt einen neuen Namen bei der Rueckkehr', () => {
    const store = users();
    const first = store.hello(undefined, 'Anna');
    const renamed = store.hello(first.secret, 'Anna B.');

    expect(renamed.user.name).toBe('Anna B.');
  });

  it('gibt den Hash der Sitzung mit heraus, damit die Verbindung ihn merkt', () => {
    const store = users();
    const created = store.hello(undefined, 'Anna');

    expect(created.tokenHash).toHaveLength(64);
  });

  it('findet ein Konto an seinem Login, aber nicht an fremder Schreibweise', () => {
    const database = openDatabase(':memory:');
    const store = new Users(database, new Sessions(database));
    database
      .prepare(
        'INSERT INTO users (id, name, is_guest, login, password_hash, created_at) VALUES (?,?,0,?,?,?)',
      )
      .run('u1', 'Anna', 'anna', 'scrypt$1$1$1$a$b', 1);

    expect(store.byLogin('anna')?.id).toBe('u1');
    expect(store.byLogin('gibtsnicht')).toBeUndefined();
  });
});
