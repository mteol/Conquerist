import { describe, expect, it } from 'vitest';
import {
  ACT,
  CHOOSE_COLOR,
  RENAME,
  SEAT_COLORS,
  stampAction,
  type GameAction,
  type GameState,
} from '@conquerist/shared';
import { openDatabase } from '../../db/database.js';
import { Sessions } from '../../identity/sessions.js';
import { Users } from '../../identity/users.js';
import { RoomRegistry } from '../../rooms/registry.js';
import { applyAction, createRoom, joinRoom, startGame } from '../../rooms/room.js';
import { MessageRouter } from '../router.js';
import type { RequestContext } from '../router.js';
import { SinkHub } from '../sinks.js';
import { handleDisconnect, registerRoomHandlers } from './room.js';

/**
 * Der Handler-Rand des Spielerhandels: was passiert, wenn eine Verbindung
 * waehrend eines offenen Angebots wegfaellt - und wenn sie wiederkommt.
 *
 * Die Sitze tragen **echte** Nutzer-Ids aus `users.hello`: der ACT-Handler
 * schlaegt den Absender in der Benutzertabelle nach, und eine erfundene Id
 * faellt dort durch, bevor die Regel ueberhaupt gefragt wird.
 */
function fixture() {
  const database = openDatabase(':memory:');
  const users = new Users(database, new Sessions(database));
  const registry = new RoomRegistry({ randomCode: () => 'K7X2' });
  const sinks = new SinkHub();
  const router = new MessageRouter();
  registerRoomHandlers(router, { registry, users, sinks });

  const guests = ['Anna', 'Ben', 'Cem'].map((name) => users.hello(undefined, name));
  const [anna, ben] = guests;

  const created = createRoom('K7X2', anna!.user.id, 'Anna', 3, 'handler-probe', 10);
  if (!created.ok) throw new Error(created.error);

  let current = created.room;
  for (const guest of guests.slice(1)) {
    const joined = joinRoom(current, guest.user.id, guest.user.name);
    if (!joined.ok) throw new Error(joined.error);
    current = joined.room;
  }

  const started = startGame(current, anna!.user.id);
  if (!started.ok) throw new Error(started.error);
  const game = started.room.game!;

  // Hauptphase, Anna am Zug und mit drei Holz - damit ihr Angebot durchgeht.
  const running: GameState = {
    ...game,
    phase: { kind: 'main' },
    currentPlayerIndex: 0,
    players: game.players.map((player, index) =>
      index === 0 ? { ...player, resources: { ...player.resources, lumber: 3 } } : player,
    ),
  };

  registry.create(anna!.user.id, 'Anna', 3, 'handler-probe', 10);

  const offer: GameAction = {
    type: 'offerTrade',
    player: anna!.user.id,
    give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
    want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
    at: 0,
  };
  const acted = applyAction(
    { ...started.room, game: running },
    anna!.user.id,
    stampAction(offer, 1_000),
  );
  if (!acted.ok) throw new Error(acted.error);
  registry.update('K7X2', acted.room);

  return { registry, sinks, router, users, anna: anna!, ben: ben! };
}

function responsesOf(registry: RoomRegistry): Record<string, unknown> {
  const phase = registry.get('K7X2')?.game?.phase;
  return phase?.kind === 'tradePending' ? phase.responses : {};
}

function contextFor(userId: string, tokenHash: string, sink: { send: () => void }): RequestContext {
  return {
    connectionId: `conn-${userId}`,
    receivedAt: 0,
    session: { userId, roomCode: 'K7X2', tokenHash },
    events: sink,
  };
}

const act = (action: GameAction): string =>
  JSON.stringify({ id: 'r1', type: ACT, payload: { action } });

describe('Verbindungsverlust waehrend eines Angebots', () => {
  it('traegt eine automatische Ablehnung ein', () => {
    const { registry, sinks, users, ben } = fixture();
    const sink = { send: (): void => undefined };
    sinks.add(ben.user.id, sink);

    handleDisconnect(
      { registry, users, sinks },
      { userId: ben.user.id, roomCode: 'K7X2', tokenHash: ben.tokenHash },
      sink,
    );

    expect(responsesOf(registry)[ben.user.id]).toEqual({ kind: 'declined', automatic: true });
  });

  it('laesst eine Antwort von Hand unberuehrt', async () => {
    const { registry, sinks, router, users, ben } = fixture();
    const sink = { send: (): void => undefined };
    sinks.add(ben.user.id, sink);
    const context = contextFor(ben.user.id, ben.tokenHash, sink);

    const answered = await router.dispatch(
      act({ type: 'respondTrade', player: ben.user.id, response: 'declined' }),
      context,
    );
    expect(answered.ok).toBe(true);

    handleDisconnect({ registry, users, sinks }, context.session, sink);

    // Gesprochenes wird nicht ueberschrieben - sonst kaeme es bei der Rueckkehr
    // faelschlich wieder weg.
    expect(responsesOf(registry)[ben.user.id]).toEqual({ kind: 'declined', automatic: false });
  });
});

describe('Systemzuege von aussen', () => {
  it('weist einen Client ab, der selbst timeout schickt', async () => {
    const { registry, router, anna } = fixture();
    const context = contextFor(anna.user.id, anna.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(
      act({ type: 'timeout', player: anna.user.id, at: 9_999_999 }),
      context,
    );

    expect(response.ok).toBe(false);
    // Und das Angebot liegt weiter - der Zug hat nichts bewirkt.
    expect(registry.get('K7X2')?.game?.phase.kind).toBe('tradePending');
  });
});

/**
 * Farbe und Name im Wartebereich.
 *
 * Eigene Vorrichtung: die oben laesst eine Partie laufen, und beides ist genau
 * dann interessant, wenn sie es noch nicht tut.
 */
function lobby() {
  const database = openDatabase(':memory:');
  const users = new Users(database, new Sessions(database));
  const registry = new RoomRegistry({ randomCode: () => 'K7X2' });
  const sinks = new SinkHub();
  const router = new MessageRouter();
  registerRoomHandlers(router, { registry, users, sinks });

  const anna = users.hello(undefined, 'Anna');
  const ben = users.hello(undefined, 'Ben');

  const created = registry.create(anna.user.id, 'Anna', 3, 'lobby-probe', 10);
  if (!created.ok) throw new Error(created.error);
  const joined = joinRoom(created.room, ben.user.id, 'Ben');
  if (!joined.ok) throw new Error(joined.error);
  registry.update('K7X2', joined.room);

  return { registry, router, users, anna, ben };
}

const message = (type: string, payload: unknown): string =>
  JSON.stringify({ id: 'r1', type, payload });

describe('Farbwahl ueber das Protokoll', () => {
  it('faerbt den eigenen Sitz um', async () => {
    const { registry, router, ben } = lobby();
    const context = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(
      message(CHOOSE_COLOR, { color: SEAT_COLORS[4] }),
      context,
    );

    expect(response.ok).toBe(true);
    expect(registry.get('K7X2')?.seats.find((seat) => seat.userId === ben.user.id)?.color).toBe(
      SEAT_COLORS[4],
    );
  });

  it('weist eine belegte Farbe ab, ohne den Tisch anzufassen', async () => {
    const { registry, router, anna, ben } = lobby();
    const context = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });
    const before = registry.get('K7X2')!;
    const annasColor = before.seats.find((seat) => seat.userId === anna.user.id)!.color;

    const response = await router.dispatch(message(CHOOSE_COLOR, { color: annasColor }), context);

    expect(response.ok).toBe(false);
    expect(registry.get('K7X2')?.seats).toEqual(before.seats);
  });
});

describe('Umbenennen ueber das Protokoll', () => {
  it('schreibt den Namen in die Benutzertabelle und an den Sitz', async () => {
    const { registry, router, users, ben } = lobby();
    const context = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(message(RENAME, { name: 'Benedikt' }), context);

    expect(response.ok).toBe(true);
    expect(users.byId(ben.user.id)?.name).toBe('Benedikt');
    expect(registry.get('K7X2')?.seats.find((seat) => seat.userId === ben.user.id)?.name).toBe(
      'Benedikt',
    );
  });

  it('nimmt keinen leeren Namen an', async () => {
    const { router, users, ben } = lobby();
    const context = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(message(RENAME, { name: '   ' }), context);

    expect(response.ok).toBe(false);
    expect(users.byId(ben.user.id)?.name).toBe('Ben');
  });
});
