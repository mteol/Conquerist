import type { VertexId } from '../../geometry/index.js';
import type { CardAmounts, PieceId } from '../../rules/index.js';
import { boardOf } from '../board.js';
import { canPayFor, payFor } from '../build.js';
import { canAfford } from '../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../errors.js';
import type { PlayerId } from '../player.js';
import {
  findPlayer,
  ok,
  rejected,
  type GameState,
  type Knight,
  type KnightLevel,
  type ReduceResult,
} from '../state.js';
// `hasFortress` wohnt in `tracks.ts`: sie gehoert zu den Ausbaustufen, und seit
// die Stufenliste dort steht, hat sie dort einen Ort. Re-exportiert, damit
// `knights.test.ts` sie weiterhin von hier beziehen kann.
import { hasFortress } from './tracks.js';

export { hasFortress };

/**
 * Ritter: wie sie entstehen und wie sie wachsen.
 *
 * Ein Ritter ist eine Figur auf einer **Kreuzung**, seine Stufe ist zugleich
 * seine Staerke (Einfach 1, Stark 2, Maechtig 3), und sein Helm sagt, ob er
 * aktiviert ist. Nur ein aktivierter Ritter kaempft gegen die Barbaren und
 * handelt.
 *
 * Hier steht **bauen, aktivieren, aufwerten** - also alles, was einen Ritter
 * hervorbringt oder groesser macht. Was ein Ritter *tut* (versetzen,
 * vertreiben, den Raeuber jagen), steht in `knightActions.ts`; die Wegsuche
 * dazu in `knightMoves.ts`. Die Trennung ist die zwischen Bestand und Zug: das
 * eine fragt nach Preis und Vorrat, das andere nach dem Brett.
 *
 * Drei Regeln, die hier bewusst **nicht** gelten:
 *
 *  - **Keine Abstandsregel.** Ein Ritter darf direkt neben einer Siedlung
 *    stehen, auch neben der eigenen. Deshalb ruft `canBuildKnight` nicht
 *    `canPlaceSettlementAt` - die traegt die Abstandsregel mit sich.
 *  - **Kein Anschluss ueber Gebaeude.** Gefordert ist eine angrenzende eigene
 *    **Strasse**; ein eigenes Dorf allein genuegt nicht.
 *  - **Keine Ruhefrist beim Aktivieren.** Ein eben gebauter Ritter darf im
 *    selben Zug den Helm bekommen. Die Frist gilt erst fuers Handeln, und die
 *    steht in `knightMayAct`.
 */

/**
 * Was `catanStrength` und `knightStrengthOf` wirklich brauchen: die Ritter auf
 * dem Brett.
 *
 * Ein eigener Typ statt `GameState`, damit auch eine `PlayerView` die Staerke
 * ausrechnen kann - dieselbe Bauform und derselbe Grund wie `BuildingSource`
 * in `barbarians.ts`. Es ist keine Regel, die damit zweimal ausgelegt wird; es
 * ist dieselbe Funktion.
 */
export interface KnightSource {
  readonly knights: GameState['knights'];
}

/** Der Ritter auf dieser Kreuzung - oder keiner. */
export function knightAt(state: KnightSource, vertex: VertexId): Knight | undefined {
  return state.knights[vertex];
}

/**
 * Der Bauteil-Bezeichner zu einer Ritterstufe.
 *
 * Eine Funktion und keine Tabelle: die drei Namen folgen der Stufe, und eine
 * Tabelle waere eine zweite Stelle, an der dieselbe Zahl steht.
 */
export function knightPiece(level: KnightLevel): PieceId {
  return `knight${level}` as PieceId;
}

/** Die Staerke aller **aktivierten** Ritter eines Spielers. */
export function knightStrengthOf(source: KnightSource, player: PlayerId): number {
  let strength = 0;
  for (const knight of Object.values(source.knights)) {
    if (knight.owner === player && knight.active) strength += knight.level;
  }
  return strength;
}

/**
 * Die Staerke der Ritter Catans - ueber alle Spieler.
 *
 * Gegen sie tritt das Barbarenheer an, und deshalb wird hier nicht nach
 * Besitzern getrennt: gegen die Barbaren steht die Insel zusammen.
 */
export function catanStrength(source: KnightSource): number {
  let strength = 0;
  for (const knight of Object.values(source.knights)) {
    if (knight.active) strength += knight.level;
  }
  return strength;
}

/**
 * Ob dieser Ritter in diesem Zug handeln darf.
 *
 * Gezaehlt wird in `state.turn`, also in vollen Runden. Weil jeder je Runde
 * einmal handelt, heisst `activatedOnTurn < state.turn` genau "ab dem
 * naechsten eigenen Zug" - ohne dass irgendwo ein Zaehler nachgezogen werden
 * muesste.
 */
export function knightMayAct(state: GameState, vertex: VertexId, player: PlayerId): boolean {
  const knight = knightAt(state, vertex);
  if (knight === undefined || knight.owner !== player) return false;
  if (!knight.active || knight.activatedOnTurn === null) return false;
  return knight.activatedOnTurn < state.turn;
}

/**
 * Was ein Rittergeschaeft an diesem Tisch kostet - `null`, wenn es das hier
 * nicht gibt.
 *
 * **Fehlend heisst nicht kostenlos** (dieselbe Lehre wie bei `priceOf` in
 * `developmentRules.ts`): am Basistisch nennt `buildCosts` keine Ritter, und
 * ein `?? EMPTY_CARDS` gaebe sie dort zum Nulltarif her.
 */
function priceOf(
  state: GameState,
  what: 'knight' | 'knightUpgrade' | 'knightActivation',
): CardAmounts | null {
  return state.rules.buildCosts[what] ?? null;
}

/** Die immer gleiche Absage, wenn das Regelwerk das Geschaeft nicht kennt. */
function noSuchTable(what: string): RuleViolation {
  return violation(RuleViolationCode.WRONG_PHASE, `An diesem Tisch gibt es ${what} nicht`);
}

/** Der eigene Ritter auf dieser Kreuzung - oder die Absage dazu. */
function ownKnightAt(state: GameState, player: PlayerId, vertex: VertexId): Knight | RuleViolation {
  const knight = knightAt(state, vertex);
  if (knight === undefined || knight.owner !== player) {
    return violation(RuleViolationCode.NO_KNIGHT_HERE, `Auf ${vertex} steht kein eigener Ritter`);
  }
  return knight;
}

function isViolation(value: Knight | RuleViolation): value is RuleViolation {
  return 'code' in value;
}

/** Setzt einen Ritter auf seine Kreuzung. */
function withKnight(state: GameState, vertex: VertexId, knight: Knight): GameState {
  return { ...state, knights: { ...state.knights, [vertex]: knight } };
}

/**
 * Darf hier ein Ritter hin? Brett, Platz, eigene Strasse, Preis, Vorrat.
 *
 * Bewusst **nicht** ueber `canPlaceSettlementAt`: die traegt die
 * Abstandsregel, und die gilt fuer Ritter ausdruecklich nicht.
 */
export function canBuildKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  const board = boardOf(state.scenario);

  if (!board.topology.vertexNeighbors.has(vertex)) {
    return violation(
      RuleViolationCode.NOT_ON_BOARD,
      `Der Knoten ${vertex} gehört nicht zu diesem Brett`,
    );
  }
  if (state.buildings[vertex] !== undefined) {
    return violation(RuleViolationCode.VERTEX_OCCUPIED, `Auf ${vertex} steht bereits etwas`);
  }
  if (state.knights[vertex] !== undefined) {
    return violation(RuleViolationCode.VERTEX_OCCUPIED, `Auf ${vertex} steht ein Ritter`);
  }

  /*
   * Eine angrenzende eigene **Strasse** - ein eigenes Dorf allein genuegt
   * nicht. Deshalb hier eine eigene Schleife und nicht `connectsAt` aus
   * `build.ts`, das ein eigenes Gebaeude als Anschluss durchgehen laesst.
   */
  const roads = board.topology.vertexEdges.get(vertex) ?? [];
  if (!roads.some((edge) => state.roads[edge] === player)) {
    return violation(RuleViolationCode.NOT_CONNECTED, `An ${vertex} endet keine eigene Straße`);
  }

  const price = priceOf(state, 'knight');
  if (price === null) return noSuchTable('Ritter');

  return canPayFor(state, player, knightPiece(1), price);
}

/** Stellt einen Einfachen Ritter hin - passiv, ohne Helm. */
export function applyBuildKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): ReduceResult {
  const problem = canBuildKnight(state, player, vertex);
  if (problem !== null) return rejected(problem);

  const paid = payFor(state, player, priceOf(state, 'knight')!, { [knightPiece(1)]: -1 });

  return ok(
    withKnight(paid, vertex, {
      owner: player,
      level: 1,
      active: false,
      activatedOnTurn: null,
      upgradedThisTurn: false,
    }),
  );
}

/** Darf dieser Ritter den Helm bekommen? */
export function canActivateKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  const knight = ownKnightAt(state, player, vertex);
  if (isViolation(knight)) return knight;

  if (knight.active) {
    return violation(
      RuleViolationCode.KNIGHT_ALREADY_ACTIVE,
      `Der Ritter auf ${vertex} trägt schon einen Helm`,
    );
  }

  const price = priceOf(state, 'knightActivation');
  if (price === null) return noSuchTable('Ritter');

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }
  if (!canAfford(owner.resources, price)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `${player} kann die Aktivierung nicht bezahlen`,
    );
  }

  return null;
}

/**
 * Setzt den Helm auf.
 *
 * Kostet kein Bauteil - der Helm gehoert zur Figur, die schon steht. Deshalb
 * `payFor` mit leerer Teileliste und nicht mit einem eigenen Vorrat.
 */
export function applyActivateKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): ReduceResult {
  const problem = canActivateKnight(state, player, vertex);
  if (problem !== null) return rejected(problem);

  const knight = state.knights[vertex]!;
  const paid = payFor(state, player, priceOf(state, 'knightActivation')!, {});

  return ok(withKnight(paid, vertex, { ...knight, active: true, activatedOnTurn: state.turn }));
}

/** Darf dieser Ritter eine Stufe steigen? */
export function canUpgradeKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  const knight = ownKnightAt(state, player, vertex);
  if (isViolation(knight)) return knight;

  if (knight.level >= 3) {
    return violation(
      RuleViolationCode.KNIGHT_MAX_LEVEL,
      `Der Ritter auf ${vertex} ist schon ein Mächtiger Ritter`,
    );
  }
  if (knight.upgradedThisTurn) {
    return violation(
      RuleViolationCode.KNIGHT_ALREADY_UPGRADED,
      `Der Ritter auf ${vertex} ist in diesem Zug schon gestiegen`,
    );
  }

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }
  if (knight.level === 2 && !hasFortress(owner)) {
    return violation(
      RuleViolationCode.KNIGHT_NEEDS_FORTRESS,
      'Ein Mächtiger Ritter verlangt die Festung — Politik auf Stufe 3',
    );
  }

  const price = priceOf(state, 'knightUpgrade');
  if (price === null) return noSuchTable('Ritter');

  // Geprueft wird der Vorrat der **naechsten** Stufe: die kommt aufs Brett,
  // die alte Figur geht zurueck in die Schachtel.
  const next = (knight.level + 1) as KnightLevel;
  return canPayFor(state, player, knightPiece(next), price);
}

/**
 * Tauscht die Figur gegen die naechstgroessere.
 *
 * Helm und Aktivierungsrunde bleiben stehen: es ist derselbe Ritter in
 * besserer Ruestung, und wer aufwertet, soll dafuer nicht seine Handlungsfrist
 * verlieren.
 */
export function applyUpgradeKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): ReduceResult {
  const problem = canUpgradeKnight(state, player, vertex);
  if (problem !== null) return rejected(problem);

  const knight = state.knights[vertex]!;
  const next = (knight.level + 1) as KnightLevel;

  const paid = payFor(state, player, priceOf(state, 'knightUpgrade')!, {
    [knightPiece(knight.level)]: +1,
    [knightPiece(next)]: -1,
  });

  return ok(withKnight(paid, vertex, { ...knight, level: next, upgradedThisTurn: true }));
}
