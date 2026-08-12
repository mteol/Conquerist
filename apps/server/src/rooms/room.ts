import {
  CLASSIC_34,
  CLASSIC_56,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  reduce,
  seatColorAt,
  type GameAction,
  type GameState,
  type ScenarioBlueprint,
} from '@conquerist/shared';

/**
 * Ein Raum als Wert.
 *
 * Jede Funktion gibt einen neuen Raum zurueck und veraendert keinen - dieselbe
 * Denkweise wie beim `GameState` aus Etappe 2, und aus demselben Grund: so ist
 * jeder Uebergang ohne Netzwerk, ohne Socket und ohne Datenbank pruefbar. Ab
 * Etappe 6 ist ein Wert ausserdem das, was sich ablegen laesst.
 *
 * Was hier NICHT passiert: Codes erfinden (das braucht Zufall und gehoert in
 * die Registry) und Nachrichten verschicken (das gehoert in die Handler).
 */
export interface RoomSeat {
  readonly userId: string;
  readonly name: string;
  readonly color: string;
  readonly connected: boolean;
}

export interface Room {
  readonly code: string;
  readonly hostId: string;
  readonly seatCount: number;
  readonly seed: string;
  readonly seats: readonly RoomSeat[];
  /** `null`, solange der Wartebereich laeuft. */
  readonly game: GameState | null;
  /** Zaehlt bei jeder Aenderung hoch; der Client verwirft aeltere Staende. */
  readonly version: number;
  readonly createdAt: number;
}

export type RoomResult =
  { readonly ok: true; readonly room: Room } | { readonly ok: false; readonly error: string };

const ok = (room: Room): RoomResult => ({ ok: true, room });
const fail = (error: string): RoomResult => ({ ok: false, error });

/** Welches Brett eine Tischgroesse traegt. Dieselbe Ableitung wie im Client. */
export function blueprintFor(seatCount: number): ScenarioBlueprint | undefined {
  return [CLASSIC_34, CLASSIC_56].find(
    (blueprint) => seatCount >= blueprint.minPlayers && seatCount <= blueprint.maxPlayers,
  );
}

export function createRoom(
  code: string,
  hostId: string,
  hostName: string,
  seatCount: number,
  seed: string,
  now = 0,
): RoomResult {
  if (blueprintFor(seatCount) === undefined) {
    return fail(`Fuer ${seatCount} Spieler gibt es kein passendes Brett`);
  }

  return ok({
    code,
    hostId,
    seatCount,
    seed,
    seats: [{ userId: hostId, name: hostName, color: seatColorAt(0), connected: true }],
    game: null,
    version: 1,
    createdAt: now,
  });
}

export function joinRoom(room: Room, userId: string, name: string): RoomResult {
  const known = room.seats.findIndex((seat) => seat.userId === userId);
  if (known >= 0) {
    // Wiedererkannt statt doppelt gesetzt: das ist der Reconnect-Fall.
    return ok(withSeats(room, replaceAt(room.seats, known, { connected: true, name })));
  }

  if (room.game !== null) {
    return fail('Die Partie laeuft bereits');
  }
  if (room.seats.length >= room.seatCount) {
    return fail('Der Tisch ist voll');
  }

  return ok(
    withSeats(room, [
      ...room.seats,
      { userId, name, color: seatColorAt(room.seats.length), connected: true },
    ]),
  );
}

/**
 * Verlassen.
 *
 * Im Wartebereich gibt es den Platz frei. In einer laufenden Partie nicht: der
 * Spielzustand kennt diesen Spieler, und ihn herauszunehmen hiesse, die Partie
 * zu zerstoeren. Er gilt dann nur als getrennt.
 */
export function leaveRoom(room: Room, userId: string): Room {
  if (room.game !== null) return setConnected(room, userId, false);

  const remaining = room.seats.filter((seat) => seat.userId !== userId);
  if (remaining.length === room.seats.length) return room;

  return {
    ...room,
    seats: remaining.map((seat, index) => ({ ...seat, color: seatColorAt(index) })),
    hostId: remaining[0]?.userId ?? room.hostId,
    version: room.version + 1,
  };
}

export function setConnected(room: Room, userId: string, connected: boolean): Room {
  const index = room.seats.findIndex((seat) => seat.userId === userId);
  if (index < 0) return room;
  return withSeats(room, replaceAt(room.seats, index, { connected }));
}

/**
 * Die Partie umstellen, solange der Wartebereich offen ist.
 *
 * Dieselben zwei Werte wie beim Erstellen - eine Partie soll nicht deshalb
 * neu gegruendet werden muessen, weil doch einer mehr mitspielt oder das Brett
 * bloed aussieht. Drei Grenzen, und jede hat einen Grund:
 *
 *   - **Nur der Host.** Sonst zieht einer den anderen den Tisch unter den
 *     Fuessen weg, waehrend sie beitreten.
 *   - **Nicht kleiner als die Zahl derer, die schon sitzen.** Sonst muesste
 *     jemand seinen Platz raeumen, und der Wartebereich ist der falsche Ort,
 *     das zu entscheiden.
 *   - **Nicht mehr, wenn die Partie laeuft.** Der Seed steckt dann bereits im
 *     Brett und im Zufallszustand; ihn zu aendern hiesse, mitten im Spiel ein
 *     anderes zu spielen.
 */
export function configureRoom(
  room: Room,
  byUserId: string,
  seatCount: number,
  seed: string,
): RoomResult {
  if (byUserId !== room.hostId) return fail('Nur wer die Partie erstellt hat, kann sie umstellen');
  if (room.game !== null) return fail('Die Partie laeuft bereits');
  if (blueprintFor(seatCount) === undefined) {
    return fail(`Fuer ${seatCount} Spieler gibt es kein passendes Brett`);
  }
  if (seatCount < room.seats.length) {
    return fail(`Es sitzen schon ${room.seats.length} am Tisch`);
  }

  return ok({ ...room, seatCount, seed, version: room.version + 1 });
}

export function startGame(room: Room, byUserId: string): RoomResult {
  if (byUserId !== room.hostId) return fail('Nur wer die Partie erstellt hat, kann sie starten');
  if (room.game !== null) return fail('Die Partie laeuft bereits');
  if (room.seats.length !== room.seatCount) {
    return fail(`Es fehlen noch ${room.seatCount - room.seats.length} Spieler`);
  }

  const blueprint = blueprintFor(room.seatCount);
  if (blueprint === undefined) return fail('Kein passendes Brett');

  const scenario = generateScenario(blueprint, room.seed);
  const game = createGame(
    scenario,
    CLASSIC_RULES,
    room.seats.map((seat) => seat.userId),
    room.seed,
  );

  return ok({ ...room, game, version: room.version + 1 });
}

/**
 * Einen Zug anwenden.
 *
 * Zwei Pruefungen, in dieser Reihenfolge: **ist der Absender der, fuer den er
 * sich ausgibt** (Regel 3 - der Server glaubt dem `player`-Feld nicht), und
 * dann erst, ob der Zug regelgerecht ist (das weiss `reduce`).
 */
export function applyAction(room: Room, userId: string, action: GameAction): RoomResult {
  if (room.game === null) return fail('Die Partie hat noch nicht begonnen');
  if (action.player !== userId) {
    return fail('Ein Zug fuer einen anderen Spieler wird nicht angenommen');
  }
  if (!room.seats.some((seat) => seat.userId === userId)) {
    return fail('Du sitzt nicht an diesem Tisch');
  }

  const result = reduce(room.game, action);
  if (!result.ok) return fail(result.error.message);

  return ok({ ...room, game: result.state, version: room.version + 1 });
}

/**
 * Einen Zug anwenden, den der Server selbst ausloest.
 *
 * Ohne Absenderpruefung - genau das ist der Unterschied zu `applyAction`:
 * `dropFromTrade` und `rejoinTrade` sprechen ueber einen anderen Spieler, und
 * `timeout` ist niemandes Absicht. Erreichbar ist dieser Eingang nur von innen;
 * der Nachrichten-Handler weist diese Aktionsarten von aussen ab.
 */
export function applySystemAction(room: Room, action: GameAction): RoomResult {
  if (room.game === null) return fail('Die Partie hat noch nicht begonnen');

  const result = reduce(room.game, action);
  if (!result.ok) return fail(result.error.message);

  return ok({ ...room, game: result.state, version: room.version + 1 });
}

function withSeats(room: Room, seats: readonly RoomSeat[]): Room {
  return { ...room, seats, version: room.version + 1 };
}

function replaceAt(
  seats: readonly RoomSeat[],
  index: number,
  patch: Partial<RoomSeat>,
): readonly RoomSeat[] {
  return seats.map((seat, position) => (position === index ? { ...seat, ...patch } : seat));
}
