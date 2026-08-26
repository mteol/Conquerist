import type { VertexId } from '../../geometry/index.js';
import { boardOf } from '../board.js';
import { RuleViolationCode, violation, type RuleViolation } from '../errors.js';
import type { PlayerId } from '../player.js';
import {
  ok,
  rejected,
  withPlayer,
  type GameState,
  type Knight,
  type KnightLevel,
  type ReduceResult,
} from '../state.js';
import { robberIsFree } from './barbarians.js';
import { reachableVertices, vertexIsFree } from './knightMoves.js';
import { knightPiece } from './knights.js';

/**
 * Was ein Ritter tut: ziehen, vertreiben, ausweichen, den Raeuber jagen.
 *
 * **`moveKnight` deckt das Vertreiben mit ab.** Ist das Ziel frei, ist es ein
 * Versetzen; steht dort ein schwaecherer fremder Ritter, ist es ein
 * Vertreiben. Zwei Aktionen fuer denselben Zug - ein Ritter zieht auf eine
 * Kreuzung - waeren zwei Regelauslegungen darueber, wohin er ziehen darf, und
 * die erste Abweichung faende niemand.
 *
 * Alle drei Zuege **deaktivieren** den Ritter: je aktivem Ritter eine Handlung
 * je Zug, und die Deaktivierung ist die Buchfuehrung darueber. Der
 * Vertriebene dagegen behaelt seinen Zustand vollstaendig - ihn trifft keine
 * Schuld, er hat nur den Platz verloren.
 *
 * Die Ruhefrist steht in `knightMayAct`: wer eben erst den Helm bekommen hat,
 * handelt ab dem naechsten eigenen Zug.
 */

/** Der eigene Ritter auf dieser Kreuzung, geprueft bis zur Handlungsfaehigkeit. */
function actingKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): Knight | RuleViolation {
  const knight = state.knights[vertex];
  if (knight === undefined || knight.owner !== player) {
    return violation(RuleViolationCode.NO_KNIGHT_HERE, `Auf ${vertex} steht kein eigener Ritter`);
  }
  if (!knight.active || knight.activatedOnTurn === null) {
    return violation(
      RuleViolationCode.KNIGHT_NOT_ACTIVE,
      `Der Ritter auf ${vertex} trägt keinen Helm`,
    );
  }
  if (knight.activatedOnTurn >= state.turn) {
    return violation(
      RuleViolationCode.KNIGHT_JUST_ACTIVATED,
      `Der Ritter auf ${vertex} wurde eben erst aktiviert und handelt ab dem nächsten Zug`,
    );
  }
  return knight;
}

function isViolation(value: Knight | RuleViolation): value is RuleViolation {
  return 'code' in value;
}

/** Ein Ritter, der gehandelt hat: ohne Helm und ohne Aktivierungsrunde. */
function spent(knight: Knight): Knight {
  return { ...knight, active: false, activatedOnTurn: null };
}

/** Nimmt den Ritter von seiner Kreuzung. */
function without(state: GameState, vertex: VertexId): GameState['knights'] {
  const knights = { ...state.knights };
  delete knights[vertex];
  return knights;
}

/**
 * Wohin ein vertriebener Ritter ausweichen koennte.
 *
 * Leer heisst: er kommt vom Brett. Gerechnet wird von der Kreuzung aus, auf
 * der er stand - sein Netz, nicht das des Angreifers.
 */
export function displacementTargets(state: GameState, owner: PlayerId, from: VertexId): VertexId[] {
  return [...reachableVertices(state, owner, from)].filter((vertex) => vertexIsFree(state, vertex));
}

/** Darf dieser Ritter dorthin ziehen - frei oder auf einen schwaecheren Gegner? */
export function canMoveKnight(
  state: GameState,
  player: PlayerId,
  from: VertexId,
  to: VertexId,
): RuleViolation | null {
  const knight = actingKnight(state, player, from);
  if (isViolation(knight)) return knight;

  if (!reachableVertices(state, player, from).has(to)) {
    return violation(
      RuleViolationCode.KNIGHT_UNREACHABLE,
      `Von ${from} führt kein eigener Weg nach ${to}`,
    );
  }

  if (state.buildings[to] !== undefined) {
    return violation(RuleViolationCode.KNIGHT_TARGET_TAKEN, `Auf ${to} steht ein Bauwerk`);
  }

  const occupant = state.knights[to];
  if (occupant === undefined) return null;

  // Den eigenen Ritter vertreibt man nicht - er steht im Weg wie ein Bauwerk.
  if (occupant.owner === player) {
    return violation(RuleViolationCode.KNIGHT_TARGET_TAKEN, `Auf ${to} steht ein eigener Ritter`);
  }

  // Echt staerker: bei Gleichstand haelt der Verteidiger die Stellung.
  if (knight.level <= occupant.level) {
    return violation(
      RuleViolationCode.KNIGHT_TOO_WEAK,
      `Der Ritter auf ${to} ist mindestens ebenso stark`,
    );
  }

  return null;
}

/**
 * Zieht den Ritter - und vertreibt, wenn dort einer stand.
 *
 * Der Vertriebene sucht seinen Platz selbst, in einer eigenen Phase. Findet er
 * keinen, geht seine Figur in den Vorrat des Besitzers zurueck und der Tisch
 * bleibt in der Hauptphase: eine Phase, die auf eine Wahl ohne Moeglichkeiten
 * wartet, haelt den Tisch fuer nichts an.
 */
export function applyMoveKnight(
  state: GameState,
  player: PlayerId,
  from: VertexId,
  to: VertexId,
): ReduceResult {
  const problem = canMoveKnight(state, player, from, to);
  if (problem !== null) return rejected(problem);

  const knight = state.knights[from]!;
  const displaced = state.knights[to];

  const moved: GameState = {
    ...state,
    knights: { ...without(state, from), [to]: spent(knight) },
  };

  if (displaced === undefined) return ok(moved);

  /*
   * Die Ausweichwege werden **nach** dem Zug gerechnet: der Angreifer steht
   * jetzt auf der Kreuzung, und sie ist damit kein Ziel mehr. Vor dem Zug
   * gerechnet stuende sie noch frei da.
   */
  const targets = displacementTargets(moved, displaced.owner, to);

  if (targets.length === 0) {
    const piece = knightPiece(displaced.level);
    return ok({
      ...moved,
      players: withPlayer(moved, displaced.owner, (owner) => ({
        ...owner,
        piecesLeft: { ...owner.piecesLeft, [piece]: owner.piecesLeft[piece] + 1 },
      })),
    });
  }

  return ok({
    ...moved,
    phase: {
      kind: 'displacePending',
      owner: displaced.owner,
      level: displaced.level,
      active: displaced.active,
      activatedOnTurn: displaced.activatedOnTurn,
      from: to,
    },
  });
}

/** Darf dieser Spieler den Vertriebenen dorthin setzen? */
export function canPlaceDisplacedKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  if (state.phase.kind !== 'displacePending') {
    return violation(RuleViolationCode.NOT_DISPLACING, 'Gerade wurde niemand vertrieben');
  }
  if (state.phase.owner !== player) {
    return violation(
      RuleViolationCode.NOT_DISPLACING,
      `Der vertriebene Ritter gehört ${state.phase.owner}`,
    );
  }

  if (!reachableVertices(state, player, state.phase.from).has(vertex)) {
    return violation(
      RuleViolationCode.KNIGHT_UNREACHABLE,
      `${vertex} liegt nicht am eigenen Straßennetz`,
    );
  }
  if (!vertexIsFree(state, vertex)) {
    return violation(RuleViolationCode.KNIGHT_TARGET_TAKEN, `Auf ${vertex} steht schon etwas`);
  }

  return null;
}

/**
 * Setzt den Vertriebenen auf seinen neuen Platz.
 *
 * **Unveraendert**: Stufe, Helm und Aktivierungsrunde reisen mit. Er hat nicht
 * gehandelt, er ist geschoben worden - ihm den Helm abzunehmen waere eine
 * zweite Strafe fuer denselben Angriff.
 */
export function applyPlaceDisplacedKnight(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): ReduceResult {
  const problem = canPlaceDisplacedKnight(state, player, vertex);
  if (problem !== null) return rejected(problem);

  const phase = state.phase as Extract<GameState['phase'], { kind: 'displacePending' }>;

  return ok({
    ...state,
    knights: {
      ...state.knights,
      [vertex]: {
        owner: phase.owner,
        level: phase.level as KnightLevel,
        active: phase.active,
        activatedOnTurn: phase.activatedOnTurn,
        upgradedThisTurn: false,
      },
    },
    phase: { kind: 'main' },
  });
}

/** Darf dieser Ritter den Raeuber verjagen? */
export function canChaseRobber(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  const knight = actingKnight(state, player, vertex);
  if (isViolation(knight)) return knight;

  if (!robberIsFree(state)) {
    return violation(
      RuleViolationCode.ROBBER_LOCKED,
      'Der Räuber bleibt stehen, bis die Barbaren zum ersten Mal gelandet sind',
    );
  }

  const board = boardOf(state.scenario);
  const hexes = board.topology.vertexHexes.get(vertex) ?? [];
  if (!hexes.includes(state.robber)) {
    return violation(
      RuleViolationCode.ROBBER_NOT_ADJACENT,
      `Der Räuber steht an keinem der Felder um ${vertex}`,
    );
  }

  return null;
}

/**
 * Verjagt den Raeuber vom Nachbarfeld.
 *
 * **Das Stehlen kommt als eigener `moveRobber`**: die bestehende
 * `robberPending`-Phase kann genau das, samt Opferwahl und Zufallsziehung, und
 * ein zweiter Weg dorthin waere eine zweite Auslegung derselben Regel. Der
 * Rueckweg ist `main` - gewuerfelt ist laengst.
 */
export function applyChaseRobber(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): ReduceResult {
  const problem = canChaseRobber(state, player, vertex);
  if (problem !== null) return rejected(problem);

  const knight = state.knights[vertex]!;

  return ok({
    ...state,
    knights: { ...state.knights, [vertex]: spent(knight) },
    phase: { kind: 'robberPending', resume: 'main' },
  });
}
