import { describe, expect, it } from 'vitest';
import {
  ABANDON_ROOM,
  ACT,
  CHOOSE_COLOR,
  DELETE_ROOM,
  GAME_EVENT,
  HELLO,
  JOIN_ROOM,
  LEAVE_ROOM,
  MY_ROOMS,
  OVER_EVENT,
  RENAME,
  ROOM_EVENT,
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
import { MemoryRoomStore } from '../../rooms/store.js';
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

/**
 * Aufstehen waehrend eines offenen Angebots.
 *
 * Erst seit es die Tuer im Spielbildschirm gibt, ist dieser Fall ueberhaupt
 * erreichbar: bis dahin fuehrte aus einer laufenden Partie kein Weg heraus, und
 * `room.leave` traf sie nie. Ohne die Ablehnung wartete der Tisch danach auf
 * jemanden, der auf dem Startbildschirm sitzt.
 */
describe('Verlassen waehrend eines Angebots', () => {
  it('traegt dieselbe vorlaeufige Ablehnung ein wie ein Verbindungsverlust', async () => {
    const { registry, router, ben } = fixture();
    const context = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(message(LEAVE_ROOM, {}), context);

    expect(response.ok).toBe(true);
    expect(responsesOf(registry)[ben.user.id]).toEqual({ kind: 'declined', automatic: true });
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

/**
 * Ein Tisch mit laufender Partie und einer Platte darunter.
 *
 * Die Platte ist der Punkt: der Abbruch soll nachlesbar bleiben, und ob das
 * passiert, sieht man nur an einem Store. Die Vorrichtungen oben kommen ohne
 * aus, weil es dort um den Spielzustand geht und nicht um sein Ende.
 */
function runningTable() {
  const database = openDatabase(':memory:');
  const users = new Users(database, new Sessions(database));
  const store = new MemoryRoomStore();
  const registry = new RoomRegistry({ randomCode: () => 'K7X2', store });
  const sinks = new SinkHub();
  const router = new MessageRouter();
  registerRoomHandlers(router, { registry, users, sinks });

  const anna = users.hello(undefined, 'Anna');
  const ben = users.hello(undefined, 'Ben');
  const cem = users.hello(undefined, 'Cem');

  const created = registry.create(anna.user.id, 'Anna', 3, 'abbruch-probe', 10);
  if (!created.ok) throw new Error(created.error);

  let current = created.room;
  for (const guest of [ben, cem]) {
    const joined = joinRoom(current, guest.user.id, guest.user.name);
    if (!joined.ok) throw new Error(joined.error);
    current = joined.room;
  }

  const started = startGame(current, anna.user.id);
  if (!started.ok) throw new Error(started.error);
  registry.update('K7X2', started.room);

  return { registry, store, sinks, router, users, anna, ben, cem };
}

/** Sammelt, was an einen Empfaenger hinausgeht. */
function listener(sinks: SinkHub, userId: string): { type: string; payload: unknown }[] {
  const seen: { type: string; payload: unknown }[] = [];
  sinks.add(userId, {
    send: (type, payload): void => {
      seen.push({ type, payload });
    },
  });
  return seen;
}

describe('Aussteigen ueber das Protokoll', () => {
  it('bricht die laufende Partie ab und sagt es allen am Tisch', async () => {
    const { registry, store, sinks, router, anna, ben } = runningTable();
    const bensPost = listener(sinks, ben.user.id);
    const context = contextFor(anna.user.id, anna.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(message(ABANDON_ROOM, { code: 'K7X2' }), context);

    expect(response.ok).toBe(true);
    expect(response.payload).toEqual({ ended: true });

    // Weg aus dem Betrieb - und der Sitzung gehoert der Tisch nicht mehr.
    expect(registry.get('K7X2')).toBeUndefined();
    expect(context.session.roomCode).toBeNull();

    // Aber nachlesbar geblieben.
    expect(store.abandonedAt('K7X2')).toBeGreaterThan(0);

    // Ben sitzt vielleicht gerade davor: er erfaehrt es, und zwar mit Grund.
    expect(bensPost.map((entry) => entry.type)).toContain(OVER_EVENT);
    expect(bensPost.find((entry) => entry.type === OVER_EVENT)?.payload).toEqual({
      code: 'K7X2',
      reason: 'Anna hat die Partie abgebrochen',
    });
  });

  it('nimmt die abgebrochene Partie aus „Deine Partien‘', async () => {
    const { router, ben } = runningTable();
    const context = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });

    await router.dispatch(message(ABANDON_ROOM, { code: 'K7X2' }), context);
    const mine = await router.dispatch(message(MY_ROOMS, {}), context);

    expect(mine.payload).toEqual({ rooms: [] });
  });

  it('laesst einen Fremden den Tisch nicht abraeumen', async () => {
    const { registry, router, users } = runningTable();
    const fremd = users.hello(undefined, 'Dana');
    const context = contextFor(fremd.user.id, fremd.tokenHash, { send: (): void => undefined });
    context.session.roomCode = null;

    const response = await router.dispatch(message(ABANDON_ROOM, { code: 'K7X2' }), context);

    // Angenommen, aber wirkungslos - und ohne zu verraten, ob es den Raum gibt.
    expect(response.ok).toBe(true);
    expect(response.payload).toEqual({ ended: false });
    expect(registry.get('K7X2')?.game).not.toBeNull();
  });

  it('gibt im Wartebereich nur den Platz frei', async () => {
    const { registry, router, anna, ben } = lobby();
    const context = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(message(ABANDON_ROOM, { code: 'K7X2' }), context);

    expect(response.payload).toEqual({ ended: false });
    // Der Tisch gehoert den anderen weiter - abgebrochen wird hier nichts.
    expect(registry.get('K7X2')?.seats.map((seat) => seat.userId)).toEqual([anna.user.id]);
  });
});

/** Eine frische Verbindung derselben Person - genau das ist ein Neuladen. */
function reload(events: { type: string; payload: unknown }[] = []): {
  context: RequestContext;
  seen: { type: string; payload: unknown }[];
} {
  return {
    context: {
      connectionId: 'conn-neu',
      receivedAt: 0,
      session: { userId: null, roomCode: null, tokenHash: null },
      events: {
        send: (type, payload): void => {
          events.push({ type, payload });
        },
      },
    },
    seen: events,
  };
}

/**
 * Was ein Neuladen wieder aufmacht - und was nicht.
 *
 * Der Server oeffnet beim `hello` den einzigen Raum, an dem jemand sitzt. Genau
 * das war die zweite Haelfte der Sackgasse: wer die Partie verliess und dann
 * F5 drueckte, stand wieder darin.
 */
describe('Neuladen', () => {
  it('setzt niemanden an einen Tisch zurueck, den er verlassen hat', async () => {
    const { registry, router, ben } = runningTable();
    const leaving = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });

    await router.dispatch(message(LEAVE_ROOM, {}), leaving);

    const { context, seen } = reload();
    await router.dispatch(message(HELLO, { secret: ben.secret }), context);

    expect(context.session.roomCode).toBeNull();
    // Kein Stand hinaus: der Client bleibt auf dem Startbildschirm und sieht
    // die Partie dort als Karte.
    expect(seen.map((entry) => entry.type)).not.toContain(ROOM_EVENT);
    expect(seen.map((entry) => entry.type)).not.toContain(GAME_EVENT);
    // Der Platz steht weiter - verlassen ist nicht abgebrochen.
    expect(registry.get('K7X2')?.seats).toHaveLength(3);
  });

  it('oeffnet ihn wieder, sobald er ueber die Karte zurueckgekommen ist', async () => {
    const { router, ben } = runningTable();
    const leaving = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });
    await router.dispatch(message(LEAVE_ROOM, {}), leaving);

    // „Zurueck in die Partie" auf der Karte - das ist `room.join`.
    const back = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });
    back.session.roomCode = null;
    await router.dispatch(message(JOIN_ROOM, { code: 'K7X2' }), back);

    const { context, seen } = reload();
    await router.dispatch(message(HELLO, { secret: ben.secret }), context);

    expect(context.session.roomCode).toBe('K7X2');
    expect(seen.map((entry) => entry.type)).toContain(ROOM_EVENT);
  });

  it('holt einen zurueck, dem nur die Verbindung abgerissen ist', async () => {
    const { registry, router, sinks, users, ben } = runningTable();
    const sink = { send: (): void => undefined };
    sinks.add(ben.user.id, sink);

    handleDisconnect(
      { registry, users, sinks },
      { userId: ben.user.id, roomCode: 'K7X2', tokenHash: ben.tokenHash },
      sink,
    );

    const { context, seen } = reload();
    await router.dispatch(message(HELLO, { secret: ben.secret }), context);

    // Ein Abriss ist keine Entscheidung - dorthin gehoert man zurueck.
    expect(context.session.roomCode).toBe('K7X2');
    expect(seen.map((entry) => entry.type)).toContain(ROOM_EVENT);
  });
});

describe('Loeschen ueber das Protokoll', () => {
  /** Alle ausser dem Gastgeber verlassen die laufende Partie. */
  async function deserted(): Promise<ReturnType<typeof runningTable>> {
    const table = runningTable();
    for (const guest of [table.ben, table.cem]) {
      await table.router.dispatch(
        message(LEAVE_ROOM, {}),
        contextFor(guest.user.id, guest.tokenHash, { send: (): void => undefined }),
      );
    }
    return table;
  }

  it('nimmt den Raum samt Log aus der Datenbank', async () => {
    const { registry, store, router, anna } = await deserted();
    const context = contextFor(anna.user.id, anna.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(message(DELETE_ROOM, { code: 'K7X2' }), context);

    expect(response.ok).toBe(true);
    expect(registry.get('K7X2')).toBeUndefined();
    expect(context.session.roomCode).toBeNull();

    // Der Unterschied zum Abbruch: hier bleibt nichts stehen.
    expect(store.loadAll()).toEqual([]);
    expect(store.abandonedAt('K7X2')).toBeUndefined();
  });

  it('sagt dem Gastgeber, dass noch jemand am Tisch sitzt', async () => {
    const { registry, router, anna } = runningTable();
    const context = contextFor(anna.user.id, anna.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(message(DELETE_ROOM, { code: 'K7X2' }), context);

    expect(response.ok).toBe(false);
    expect(response.error?.message).toMatch(/Mitspieler/);
    expect(registry.get('K7X2')).toBeDefined();
  });

  it('laesst einen Mitspieler den Tisch nicht wegraeumen', async () => {
    const { registry, router, ben } = await deserted();
    const context = contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined });

    const response = await router.dispatch(message(DELETE_ROOM, { code: 'K7X2' }), context);

    expect(response.ok).toBe(false);
    expect(registry.get('K7X2')).toBeDefined();
  });
});

/**
 * Das Rubberband.
 *
 * Wer die Partie verliess, sass weiter auf dem Sitz - und bekam deshalb jeden
 * weiteren Raumstand zugestellt. Beim naechsten Ereignis am Tisch setzte sein
 * Client den Raum wieder, und weil der Spielstand beim Verlassen weggeraeumt
 * worden war, stand er im Wartebereich: auf der Seite, auf der der Gastgeber
 * Tischgroesse, Seed und Siegpunktziel einstellt.
 */
describe('Nach dem Verlassen', () => {
  it('zieht kein Ereignis am Tisch den Weggegangenen zurueck', async () => {
    const { sinks, router, ben, cem } = runningTable();
    const bensPost = listener(sinks, ben.user.id);
    const cemsPost = listener(sinks, cem.user.id);

    await router.dispatch(
      message(LEAVE_ROOM, {}),
      contextFor(ben.user.id, ben.tokenHash, { send: (): void => undefined }),
    );
    bensPost.length = 0;
    cemsPost.length = 0;

    // Irgendetwas am Tisch: Cem benennt sich um. Das verteilt Raum und Partie.
    await router.dispatch(
      message(RENAME, { name: 'Cemal' }),
      contextFor(cem.user.id, cem.tokenHash, { send: (): void => undefined }),
    );

    expect(bensPost).toEqual([]);
    // Wer noch am Tisch sitzt, bekommt selbstverstaendlich weiter alles.
    expect(cemsPost.map((entry) => entry.type)).toContain(ROOM_EVENT);
  });
});
