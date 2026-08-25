import {
  CLASSIC_34,
  CLASSIC_56,
  rulesFor,
  MAX_VICTORY_POINT_GOAL,
  MIN_VICTORY_POINT_GOAL,
  SEAT_COLORS,
  createGame,
  generateScenario,
  isSeatColor,
  reduce,
  seatColorAt,
  seatColorName,
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
  /**
   * Weggegangen, aber der Platz steht noch.
   *
   * Der Unterschied zu `connected` ist der zwischen Widerfahrnis und
   * Entscheidung: `connected` faellt weg, wenn das WLAN ausgeht, und kommt von
   * selbst wieder. `away` setzt jemand selbst, indem er die Partie verlaesst -
   * und nur er selbst nimmt es zurueck, indem er zurueckkommt.
   *
   * Woran das haengt: der Server oeffnet beim `hello` den einzigen Raum, an dem
   * jemand sitzt (der Reconnect aus Etappe 5). Ohne dieses Feld kann er dabei
   * nicht unterscheiden, ob jemand aus der Partie gefallen oder aus ihr
   * gegangen ist - und wer gegangen ist, stuende nach einem Neuladen wieder
   * darin. Genau das war der zweite Teil der Sackgasse.
   */
  readonly away: boolean;
}

export interface Room {
  readonly code: string;
  readonly hostId: string;
  readonly seatCount: number;
  readonly seed: string;
  /**
   * Womit die Partie startet, wenn sie startet.
   *
   * Steht am Raum und nicht am Spiel: eingestellt wird es im Wartebereich, und
   * dort gibt es noch kein Spiel. `startGame` schreibt die Zahl dann in das
   * RuleSet der Partie, und ab da ist die dort die verbindliche - eine laufende
   * Partie zieht ihr Ziel nicht mehr aus dem Raum nach.
   */
  readonly victoryPointGoal: number;
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

/**
 * Die erste Farbe, die an diesem Tisch noch niemand hat.
 *
 * Bis Etappe 9 war die Farbe eine Funktion des Platzes (`seatColorAt(index)`) -
 * das ging, solange sie niemand aussuchen konnte. Seit sie waehlbar ist, gibt
 * es keine Reihenfolge mehr, aus der sie folgen koennte: wer als Dritter kommt,
 * bekommt nicht die dritte Farbe, sondern die erste noch freie.
 *
 * Kein `undefined` als Rueckgabe: es gibt genau so viele Farben wie Plaetze
 * (`MAX_SEATS`), und ein voller Tisch wird schon vorher abgewiesen. Faellt das
 * einmal auseinander, ist die Vorgabe die Farbe des Platzes - falsch, aber
 * sichtbar, und kein Sitz ohne Farbe.
 */
function firstFreeColor(seats: readonly RoomSeat[]): string {
  const taken = new Set(seats.map((seat) => seat.color));
  return SEAT_COLORS.find((color) => !taken.has(color)) ?? seatColorAt(seats.length);
}

export function createRoom(
  code: string,
  hostId: string,
  hostName: string,
  seatCount: number,
  seed: string,
  victoryPointGoal: number,
  now = 0,
): RoomResult {
  if (blueprintFor(seatCount) === undefined) {
    return fail(`Für ${seatCount} Spieler gibt es kein passendes Brett`);
  }
  const goal = checkGoal(victoryPointGoal);
  if (goal !== null) return fail(goal);

  return ok({
    code,
    hostId,
    seatCount,
    seed,
    victoryPointGoal,
    seats: [
      { userId: hostId, name: hostName, color: seatColorAt(0), connected: true, away: false },
    ],
    game: null,
    version: 1,
    createdAt: now,
  });
}

export function joinRoom(room: Room, userId: string, name: string): RoomResult {
  const known = room.seats.findIndex((seat) => seat.userId === userId);
  if (known >= 0) {
    /*
     * Wiedererkannt statt doppelt gesetzt: das ist der Reconnect-Fall.
     *
     * `away` faellt hier weg, und nur hier: wer beitritt, ist zurueck am Tisch
     * - egal, ob er ihn vorhin verlassen hat oder ob ihm bloss die Verbindung
     * abgerissen ist. Ein eigener Weg fuer die Rueckkehr waere ein zweiter Weg
     * fuer dieselbe Sache; genau deshalb kennt `room.join` seit Etappe 4 den
     * bekannten Sitz wieder.
     */
    return ok(
      withSeats(room, replaceAt(room.seats, known, { connected: true, name, away: false })),
    );
  }

  if (room.game !== null) {
    return fail('Die Partie läuft bereits');
  }
  if (room.seats.length >= room.seatCount) {
    return fail('Der Tisch ist voll');
  }

  return ok(
    withSeats(room, [
      ...room.seats,
      { userId, name, color: firstFreeColor(room.seats), connected: true, away: false },
    ]),
  );
}

/**
 * Sich eine Farbe aussuchen.
 *
 * Nur im Wartebereich: die Farbe steht in jeder `PlayerView` und auf jedem
 * gebauten Teil. Mitten in der Partie umzufaerben hiesse, dass ein Mitspieler
 * seine eigenen Strassen an anderer Stelle wiederfindet als eben noch.
 *
 * Belegt ist belegt - kein Tausch. Zwei Spieler, die gleichzeitig tauschen
 * wollen, waeren zwei Nachrichten, von denen die zweite eine Zusage der ersten
 * voraussetzt; das ist eine Verhandlung und keine Einstellung. Wer die Farbe
 * eines anderen will, fragt ihn.
 */
export function chooseColor(room: Room, userId: string, color: string): RoomResult {
  if (room.game !== null) return fail('Die Partie läuft bereits');
  if (!isSeatColor(color)) return fail('Diese Farbe gibt es am Tisch nicht');

  const index = room.seats.findIndex((seat) => seat.userId === userId);
  if (index < 0) return fail('Du sitzt nicht an diesem Tisch');
  if (room.seats[index]?.color === color) return ok(room);

  const owner = room.seats.find((seat) => seat.color === color && seat.userId !== userId);
  if (owner !== undefined) return fail(`${seatColorName(color)} hat schon ${owner.name}`);

  return ok(withSeats(room, replaceAt(room.seats, index, { color })));
}

/**
 * Sich umbenennen.
 *
 * Der Name steht in `users` und als Kopie am Sitz - die Kopie ist noetig, weil
 * der Verlaufssatz aus den Sitzen gebaut wird und eine laufende Partie ihre
 * Namen nicht bei jedem Satz nachschlagen soll. Also wird sie mitgezogen, und
 * zwar in **jedem** Raum, an dem diese Person sitzt: sonst hiesse sie am einen
 * Tisch schon anders und am anderen noch wie vorher.
 *
 * Auch waehrend der Partie erlaubt. Ein Name ist keine Spielinformation - er
 * steht ueber einer Zeile, nicht in einer Regel.
 */
export function renameSeat(room: Room, userId: string, name: string): Room {
  const index = room.seats.findIndex((seat) => seat.userId === userId);
  if (index < 0 || room.seats[index]?.name === name) return room;
  return withSeats(room, replaceAt(room.seats, index, { name }));
}

/**
 * Verlassen.
 *
 * Im Wartebereich gibt es den Platz frei. In einer laufenden Partie nicht: der
 * Spielzustand kennt diesen Spieler, und ihn herauszunehmen hiesse, die Partie
 * zu zerstoeren. Er gilt dann nur als getrennt.
 */
export function leaveRoom(room: Room, userId: string): Room {
  /*
   * In der Partie bleibt der Platz stehen - aber er steht ab jetzt sichtbar
   * leer. `away` ist der Unterschied zwischen „ihm ist die Leitung
   * weggebrochen" und „er ist aufgestanden", und nur das zweite darf ihn beim
   * naechsten `hello` nicht wieder an diesen Tisch setzen.
   */
  if (room.game !== null) {
    const index = room.seats.findIndex((seat) => seat.userId === userId);
    if (index < 0) return room;
    return withSeats(room, replaceAt(room.seats, index, { connected: false, away: true }));
  }

  const remaining = room.seats.filter((seat) => seat.userId !== userId);
  if (remaining.length === room.seats.length) return room;

  /*
   * Die Verbliebenen behalten ihre Farbe.
   *
   * Bis Etappe 9 wurden sie hier neu durchgezaehlt - die Farbe folgte dem
   * Platz, und wer aufrueckte, wechselte sie. Seit man sie sich aussucht, waere
   * das ein Eingriff in eine Entscheidung, die jemand anders getroffen hat:
   * geht der Erste, saesse der Zweite ploetzlich in Rot. Die freigewordene
   * Farbe faellt einfach zurueck in den Vorrat, aus dem `firstFreeColor` beim
   * naechsten Beitritt schoepft.
   */
  return {
    ...room,
    seats: remaining,
    hostId: remaining[0]?.userId ?? room.hostId,
    version: room.version + 1,
  };
}

/**
 * Was aus einem Austritt fuer den Raum folgt.
 *
 * Drei Ausgaenge und keine zwei, weil „nichts passiert" hier ein eigener ist:
 * wer gar nicht an diesem Tisch sitzt, soll ihn nicht abraeumen koennen. Der
 * Handler unterscheidet daran, ob er verteilt, abbricht oder still bleibt.
 */
export type AbandonResult =
  | { readonly kind: 'ended'; readonly room: Room }
  | { readonly kind: 'left'; readonly room: Room }
  | { readonly kind: 'none' };

/**
 * Endgueltig aussteigen - der Gegenpart zu `leaveRoom`.
 *
 * `leaveRoom` heisst „ich gehe jetzt woanders hin": in einer laufenden Partie
 * bleibt der Platz stehen, weil man wiederkommen kann und der Spielzustand
 * diesen Spieler kennt. Genau daraus wurde im Playtest die Sackgasse - wer den
 * Tab schloss, sass danach fuer immer an einem Tisch, an dem niemand mehr
 * zieht, und kam bei jedem Verbindungsaufbau dorthin zurueck.
 *
 * Aussteigen ist die Antwort darauf und sagt „ich komme nicht wieder". Was das
 * fuer die anderen bedeutet, haengt daran, ob schon gespielt wird:
 *
 *   - **Im Wartebereich** wird nur ein Platz frei. Der Tisch gehoert den
 *     anderen weiter, und `leaveRoom` weiss bereits, wie das geht.
 *   - **In einer laufenden Partie** ist sie damit vorbei. Einen Spieler aus
 *     dem Zustand zu nehmen ginge nicht, ohne die Partie zu zerstoeren
 *     (dieselbe Ueberlegung wie in `leaveRoom`) - und eine Partie, in der einer
 *     der Sitze nie wieder zieht, ist ohnehin keine mehr. Sie wird abgebrochen,
 *     und zwar fuer alle: ein halber Abbruch, bei dem die anderen weiter auf
 *     einen Zug warten, waere die Sackgasse fuer sie.
 *
 * Der Raum wird hier nicht weggeworfen - er kommt unveraendert zurueck, damit
 * der Handler den Sitzenden noch sagen kann, was passiert ist. Ihn aus dem
 * Betrieb zu nehmen ist Sache der Registry.
 */
export function abandonRoom(room: Room, userId: string): AbandonResult {
  if (!room.seats.some((seat) => seat.userId === userId)) return { kind: 'none' };
  if (room.game !== null) return { kind: 'ended', room };

  return { kind: 'left', room: leaveRoom(room, userId) };
}

/**
 * Ob dieser Spieler den Tisch verlassen hat, ohne seinen Platz aufzugeben.
 *
 * Eine Frage und keine Rechnung: sie wird an genau einer Stelle gestellt (beim
 * `hello`, wenn der Server entscheidet, ob er einen Raum von sich aus oeffnet),
 * und sie soll dort nicht als `seats.find(...)?.away === true` stehen - das
 * liest sich wie ein Detail und ist eine Regel.
 *
 * Wer gar nicht am Tisch sitzt, ist nicht „weggegangen", sondern nicht da.
 * Beides fuehrt an der einen Aufrufstelle zum selben Ergebnis, aber `false` ist
 * die ehrlichere Antwort: gegangen ist nur, wer vorher gesessen hat.
 */
export function isAway(room: Room, userId: string): boolean {
  return room.seats.find((seat) => seat.userId === userId)?.away === true;
}

/**
 * Ob ausser dem Gastgeber niemand mehr an diesem Tisch sitzt.
 *
 * Zwei Faelle, und sie sehen verschieden aus, weil das Verlassen es tut: im
 * Wartebereich raeumt es den Sitz ganz weg, also heisst „alle sind gegangen"
 * dort schlicht, dass nur noch einer dasteht. In einer laufenden Partie bleibt
 * der Sitz stehen und traegt `away` - dort heisst es, dass jeder Platz ausser
 * dem des Gastgebers leer ist.
 *
 * Der Gastgeber selbst zaehlt nicht mit, egal wie er dasitzt: er ist der, der
 * gleich auf „loeschen" drueckt. Ob er dabei gerade selbst weggegangen ist,
 * aendert nichts daran, dass niemand sonst mehr etwas von dieser Partie hat.
 */
export function isDeserted(room: Room): boolean {
  return room.seats.every((seat) => seat.away || seat.userId === room.hostId);
}

/**
 * Loeschen - der Gastgeber raeumt weg, was niemand mehr braucht.
 *
 * Zwei Bedingungen, und beide sind Regeln und keine Vorsichtsmassnahmen:
 *
 *   - **Nur der Gastgeber.** Dieselbe Grenze wie beim Umstellen und beim
 *     Starten (`configureRoom`, `startGame`) - der Tisch ist seiner.
 *   - **Nur, wenn sonst niemand mehr da ist.** Sonst waere es der Abbruch aus
 *     `abandonRoom`, nur ohne Spur und ohne Nachricht an die, denen die Partie
 *     ebenfalls gehoerte. Wer noch am Tisch sitzt, soll nicht erfahren, dass es
 *     seine Partie gab, indem sie verschwindet.
 *
 * Der Raum kommt unveraendert zurueck; wegzuwerfen ist Sache der Registry.
 * Diese Datei entscheidet, **ob** - nicht, wohin damit.
 */
export function deleteRoom(room: Room, byUserId: string): RoomResult {
  if (byUserId !== room.hostId) return fail('Nur wer die Partie erstellt hat, kann sie löschen');
  if (!isDeserted(room)) return fail('Es sitzen noch Mitspieler an diesem Tisch');

  return ok(room);
}

export function setConnected(room: Room, userId: string, connected: boolean): Room {
  const index = room.seats.findIndex((seat) => seat.userId === userId);
  if (index < 0) return room;
  return withSeats(room, replaceAt(room.seats, index, { connected }));
}

/**
 * Die Partie umstellen, solange der Wartebereich offen ist.
 *
 * Dieselben Werte wie beim Erstellen - eine Partie soll nicht deshalb
 * neu gegruendet werden muessen, weil doch einer mehr mitspielt, das Brett
 * bloed aussieht oder zehn Punkte zu lange dauern. Drei Grenzen, und jede hat
 * einen Grund:
 *
 *   - **Nur der Host.** Sonst zieht einer den anderen den Tisch unter den
 *     Fuessen weg, waehrend sie beitreten.
 *   - **Nicht kleiner als die Zahl derer, die schon sitzen.** Sonst muesste
 *     jemand seinen Platz raeumen, und der Wartebereich ist der falsche Ort,
 *     das zu entscheiden.
 *   - **Nicht mehr, wenn die Partie laeuft.** Der Seed steckt dann bereits im
 *     Brett und im Zufallszustand; ihn zu aendern hiesse, mitten im Spiel ein
 *     anderes zu spielen. Fuer das Siegpunktziel gilt dasselbe aus einem
 *     zweiten Grund: es liegt dann im RuleSet der Partie, und das RuleSet steht
 *     im gespeicherten Startzustand - eine Aenderung daran waere im Log nicht
 *     mehr auffindbar.
 */
export function configureRoom(
  room: Room,
  byUserId: string,
  seatCount: number,
  seed: string,
  victoryPointGoal: number,
): RoomResult {
  if (byUserId !== room.hostId) return fail('Nur wer die Partie erstellt hat, kann sie umstellen');
  if (room.game !== null) return fail('Die Partie läuft bereits');
  if (blueprintFor(seatCount) === undefined) {
    return fail(`Für ${seatCount} Spieler gibt es kein passendes Brett`);
  }
  if (seatCount < room.seats.length) {
    return fail(`Es sitzen schon ${room.seats.length} am Tisch`);
  }
  const goal = checkGoal(victoryPointGoal);
  if (goal !== null) return fail(goal);

  return ok({ ...room, seatCount, seed, victoryPointGoal, version: room.version + 1 });
}

/** Ob dieses Siegpunktziel einstellbar ist - der Satz dazu, oder `null`. */
function checkGoal(goal: number): string | null {
  if (!Number.isInteger(goal) || goal < MIN_VICTORY_POINT_GOAL || goal > MAX_VICTORY_POINT_GOAL) {
    return `Das Siegpunktziel liegt zwischen ${MIN_VICTORY_POINT_GOAL} und ${MAX_VICTORY_POINT_GOAL}`;
  }
  return null;
}

export function startGame(room: Room, byUserId: string): RoomResult {
  if (byUserId !== room.hostId) return fail('Nur wer die Partie erstellt hat, kann sie starten');
  if (room.game !== null) return fail('Die Partie läuft bereits');
  if (room.seats.length !== room.seatCount) {
    return fail(`Es fehlen noch ${room.seatCount - room.seats.length} Spieler`);
  }

  const blueprint = blueprintFor(room.seatCount);
  if (blueprint === undefined) return fail('Kein passendes Brett');

  const scenario = generateScenario(blueprint, room.seed);
  const game = createGame(
    /*
     * Das eingestellte Ziel wird hier ins Regelwerk geschrieben - genau
     * einmal, beim Start. Ab dann traegt die Partie ihr eigenes RuleSet in
     * sich (es geht als Teil des Startzustands auf die Platte), und eine
     * spaetere Aenderung am Raum erreicht sie nicht mehr. Das ist derselbe
     * Grund, aus dem eine alte Partie eine Aenderung an `CLASSIC_RULES`
     * ueberlebt: das Regelwerk gehoert zur Partie, nicht zum Programm.
     */
    scenario,
    { ...rulesFor(room.seatCount), victoryPointGoal: room.victoryPointGoal },
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
    return fail('Ein Zug für einen anderen Spieler wird nicht angenommen');
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
