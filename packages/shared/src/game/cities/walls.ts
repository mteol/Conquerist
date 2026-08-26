import type { VertexId } from '../../geometry/index.js';
import type { CardAmounts, RuleSet } from '../../rules/index.js';
import { addCards, canAfford, subtractCards } from '../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../errors.js';
import type { PlayerId } from '../player.js';
import {
  findPlayer,
  ok,
  rejected,
  withPlayer,
  type GameState,
  type ReduceResult,
} from '../state.js';

/**
 * Stadtmauern.
 *
 * Eine Mauer liegt unter einer **bestimmten Stadt** (`Building.wall`) und
 * nicht beim Spieler: nur so faellt sie beim Barbarenueberfall mit der
 * richtigen Stadt, und nur so ist "diese Stadt ist ummauert" eine Frage an das
 * Bauwerk statt eine Rechnung ueber den Besitzer.
 *
 * Sie tut zwei Dinge, und beide stehen hier: sie hebt das Handkartenlimit
 * (`handLimitOf`), und sie schuetzt beim Ueberfall eine Stadt (das wertet
 * `barbarians.ts` aus, denn es ist der Ausgang eines Kampfes und keine
 * Baufrage).
 *
 * **Kein Import aus `robber.ts`.** Umgekehrt zieht `robber.ts` sein Limit von
 * hier - ein Rueckgriff waere ein Ladezirkel. Diese Datei kennt deshalb nur
 * `cards`, `errors` und `state`.
 */

/**
 * Was ein Bauwerk und das Regelwerk brauchen, um das Limit zu nennen.
 *
 * Eine Quelle statt eines `GameState`, damit auch der Browser mit derselben
 * Funktion rechnet - Mauern stehen offen am Brett, und zwei Rechnungen fuer
 * dieselbe Zahl liefen auseinander.
 */
export interface HandLimitSource {
  readonly buildings: GameState['buildings'];
  readonly rules: Pick<RuleSet, 'handLimitBeforeDiscard' | 'handLimitPerWall'>;
}

/** Wie viele Staedte dieses Spielers eine Mauer tragen. */
export function wallsOf(source: Pick<HandLimitSource, 'buildings'>, player: PlayerId): number {
  return Object.values(source.buildings).filter(
    (building) => building.owner === player && building.wall,
  ).length;
}

/**
 * Ab wie vielen Handkarten dieser Spieler abwerfen muss.
 *
 * An einem Basistisch ist `handLimitPerWall` null, und die Rechnung gibt
 * dieselbe Sieben wie zuvor zurueck - ohne einen zweiten Zweig.
 */
export function handLimitOf(source: HandLimitSource, player: PlayerId): number {
  return (
    source.rules.handLimitBeforeDiscard + wallsOf(source, player) * source.rules.handLimitPerWall
  );
}

/** Was eine Mauer an diesem Tisch kostet - `null`, wenn es hier keine gibt. */
function priceOf(state: GameState): CardAmounts | null {
  return state.rules.buildCosts.wall ?? null;
}

/** Darf hier eine Mauer hin? Eigene Stadt, noch ohne Mauer, Preis, Vorrat. */
export function canBuildWall(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  const building = state.buildings[vertex];
  if (building === undefined || building.owner !== player || building.kind !== 'city') {
    return violation(RuleViolationCode.NOT_OWN_CITY, `Auf ${vertex} steht keine eigene Stadt`);
  }
  if (building.wall) {
    return violation(RuleViolationCode.WALL_EXISTS, `Die Stadt auf ${vertex} hat schon eine Mauer`);
  }

  const price = priceOf(state);
  if (price === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'An diesem Tisch gibt es keine Stadtmauern');
  }

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }
  if (owner.piecesLeft.wall <= 0) {
    return violation(RuleViolationCode.NO_PIECES_LEFT, `${player} hat keine Stadtmauern mehr`);
  }
  if (!canAfford(owner.resources, price)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `${player} kann keine Stadtmauer bezahlen`,
    );
  }

  return null;
}

/**
 * Legt die Mauer unter die Stadt.
 *
 * Bezahlt wird hier von Hand und nicht ueber `payFor` aus `build.ts`: eine
 * Mauer aendert kein `buildings`-Feld, sondern ein Merkmal daran, und der Weg
 * ueber `build.ts` zoege diese Datei in dessen Abhaengigkeiten - die
 * `robber.ts` bereits von hier bezieht.
 */
export function applyBuildWall(state: GameState, player: PlayerId, vertex: VertexId): ReduceResult {
  const problem = canBuildWall(state, player, vertex);
  if (problem !== null) return rejected(problem);

  const price = priceOf(state)!;
  const building = state.buildings[vertex]!;

  return ok({
    ...state,
    buildings: { ...state.buildings, [vertex]: { ...building, wall: true } },
    players: withPlayer(state, player, (owner) => ({
      ...owner,
      resources: subtractCards(owner.resources, price),
      piecesLeft: { ...owner.piecesLeft, wall: owner.piecesLeft.wall - 1 },
    })),
    bank: addCards(state.bank, price),
  });
}
