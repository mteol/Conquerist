import { AUTH_LOGIN, AUTH_LOGOUT, AUTH_ME, AUTH_REGISTER } from '@conquerist/shared';
import { AccountError } from '../../identity/accounts.js';
import type { Accounts, AccountResult } from '../../identity/accounts.js';
import type { Users, User } from '../../identity/users.js';
import type { RoomRegistry } from '../../rooms/registry.js';
import { RejectedError } from '../router.js';
import type { MessageRouter, RequestContext } from '../router.js';
import type { SinkHub } from '../sinks.js';

/**
 * Die vier Auth-Handler.
 *
 * Jeder folgt derselben Form: Ablauf in `Accounts` aufrufen, die Sitzung der
 * Verbindung nachziehen, die eine Antwortform zurueckgeben. Eine `AccountError`
 * ist ein normaler Ausgang und wird zur `RejectedError`; alles andere bleibt
 * ein nichtssagendes INTERNAL.
 */
export interface AuthHandlerDeps {
  readonly accounts: Accounts;
  readonly users: Users;
  readonly registry: RoomRegistry;
  readonly sinks: SinkHub;
}

export function registerAuthHandlers(router: MessageRouter, deps: AuthHandlerDeps): void {
  const { accounts, users, registry, sinks } = deps;

  router.register(AUTH_REGISTER, async (payload, context) => {
    const result = await run(() =>
      accounts.register(payload, context.session.userId, context.session.tokenHash),
    );
    return adopt(result, context, sinks);
  });

  router.register(AUTH_LOGIN, async (payload, context) => {
    const open =
      context.session.userId === null ? 0 : registry.roomsOf(context.session.userId).length;

    const result = await run(() =>
      accounts.login(payload, context.session.userId, context.session.tokenHash, open),
    );
    return adopt(result, context, sinks);
  });

  router.register(AUTH_LOGOUT, async (_payload, context) => {
    const result = await run(async () => accounts.logout(context.session.tokenHash));
    return adopt(result, context, sinks);
  });

  router.register(AUTH_ME, (_payload, context) => {
    const user = context.session.userId === null ? undefined : users.byId(context.session.userId);
    if (user === undefined) throw new RejectedError('Erst anmelden - hello fehlt');
    return identityOf(user);
  });
}

async function run<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof AccountError) throw new RejectedError(error.message);
    throw error;
  }
}

/**
 * Die Verbindung uebernimmt die neue Identitaet.
 *
 * Ohne das schriebe die naechste Nachricht noch unter dem alten Nutzer - und
 * genau darin bestand der Wechsel.
 *
 * Keine explizite Rueckgabetypangabe: `AuthResponseSchema` erlaubt `login` und
 * `secret` nur ueber bedingtes Spreading, nie ueber ein Feld mit `undefined`
 * als Wert (Regel „exactOptionalPropertyTypes"). Genau das liefert der
 * Bedingungs-Spread unten - eine Annotation wie `Record<string, unknown>`
 * wuerde diese Form wieder verlieren.
 */
function adopt(result: AccountResult, context: RequestContext, sinks: SinkHub) {
  context.session.userId = result.user.id;
  context.session.tokenHash = result.tokenHash;
  sinks.add(result.user.id, context.events);

  const identity = identityOf(result.user);
  return result.secret === undefined ? identity : { ...identity, secret: result.secret };
}

function identityOf(user: User) {
  return {
    userId: user.id,
    name: user.name,
    isGuest: user.isGuest,
    ...(user.login === undefined ? {} : { login: user.login }),
  };
}
