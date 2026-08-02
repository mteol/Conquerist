import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import { Users } from './users.js';

function users(): Users {
  return new Users(openDatabase(':memory:'));
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
    const store = new Users(database);
    const created = store.hello(undefined, 'Anna');

    const row = database
      .prepare('SELECT secret_hash FROM users WHERE id = ?')
      .get(created.user.id) as { secret_hash: string };

    expect(row.secret_hash).not.toBe(created.secret);
    expect(row.secret_hash).toHaveLength(64); // SHA-256 in hex
  });

  it('uebernimmt einen neuen Namen bei der Rueckkehr', () => {
    const store = users();
    const first = store.hello(undefined, 'Anna');
    const renamed = store.hello(first.secret, 'Anna B.');

    expect(renamed.user.name).toBe('Anna B.');
  });
});
