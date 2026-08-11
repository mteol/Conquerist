import { describe, expect, it } from 'vitest';
import { AUTH_LOGIN } from '@conquerist/shared';
import { openDatabase } from '../../db/database.js';
import { Accounts } from '../../identity/accounts.js';
import { Sessions } from '../../identity/sessions.js';
import { Users } from '../../identity/users.js';
import { RoomRegistry } from '../../rooms/registry.js';
import { MessageRouter } from '../router.js';
import type { RequestContext } from '../router.js';
import { SinkHub } from '../sinks.js';
import { registerAuthHandlers } from './auth.js';

function fixture() {
  const database = openDatabase(':memory:');
  const sessions = new Sessions(database);
  const users = new Users(database, sessions);
  const accounts = new Accounts(users, sessions);
  const registry = new RoomRegistry();
  const sinks = new SinkHub();
  const router = new MessageRouter();
  registerAuthHandlers(router, { accounts, users, registry, sinks });
  return { users, accounts, sinks, router };
}

function envelope(id: string, type: string, payload: unknown): string {
  return JSON.stringify({ id, type, payload });
}

describe('Auth-Handler - Senken beim Identitaetswechsel', () => {
  it('entfernt die alte Senke, wenn login die Verbindung auf eine andere userId umstellt', async () => {
    const { users, accounts, sinks, router } = fixture();
    await accounts.register({ login: 'bob', password: 'langgenug1' }, null, null);

    // So, wie es der HELLO-Handler fuer diese Verbindung getan haette: der
    // Gast ist angemeldet und traegt seine eigene Senke im Hub ein.
    const guest = users.hello(undefined, 'Gast');
    const sink = { send: (): void => undefined };
    const context: RequestContext = {
      connectionId: 'conn-1',
      receivedAt: 0,
      session: { userId: guest.user.id, roomCode: null, tokenHash: guest.tokenHash },
      events: sink,
    };
    sinks.add(guest.user.id, sink);

    const response = await router.dispatch(
      envelope('r1', AUTH_LOGIN, { login: 'bob', password: 'langgenug1' }),
      context,
    );

    expect(response.ok).toBe(true);
    // Die neue Identitaet ist da...
    expect(context.session.userId).not.toBe(guest.user.id);
    expect(sinks.has(context.session.userId ?? '')).toBe(true);
    // ...aber die alte darf fuer diese Verbindung nicht mehr eingetragen
    // sein - sonst bekaeme sie weiterhin Broadcasts fuer Raeume des Gasts.
    expect(sinks.has(guest.user.id)).toBe(false);
  });

  it('laesst die Senke unberuehrt, wenn register denselben Gast beansprucht - keine Identitaet wechselt', async () => {
    const { users, sinks, router } = fixture();
    const guest = users.hello(undefined, 'Gast');
    const sink = { send: (): void => undefined };
    const context: RequestContext = {
      connectionId: 'conn-1',
      receivedAt: 0,
      session: { userId: guest.user.id, roomCode: null, tokenHash: guest.tokenHash },
      events: sink,
    };
    sinks.add(guest.user.id, sink);

    await router.dispatch(
      envelope('r1', 'auth.register', { login: 'anna', password: 'langgenug1' }),
      context,
    );

    // Dieselbe Zeile, dieselbe Id - die Senke bleibt einfach stehen.
    expect(context.session.userId).toBe(guest.user.id);
    expect(sinks.has(guest.user.id)).toBe(true);
  });
});
