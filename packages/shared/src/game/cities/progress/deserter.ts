import type { VertexId } from '../../../geometry/index.js';
import { boardOf } from '../../board.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import {
  findPlayer,
  ok,
  rejected,
  withPlayer,
  type GameState,
  type KnightLevel,
  type ReduceResult,
} from '../../state.js';
import { canPlaceKnightAt, knightPiece } from '../knights.js';
import type { ProgressAnswer, ProgressPendingPayload } from './answer.js';
import { openProgressPending, type ProgressPendingPhase } from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Deserteur: eine Person gibt einen Ritter ihrer Wahl auf, der Spielende stellt
 * einen gleichwertigen auf. Die einzige wartende Karte mit **zwei Runden**.
 *
 * Runde 1 wartet auf das Opfer (`replacement === null`), Runde 2 auf den
 * Spielenden. Was zwischen den Runden feststeht - die Ersatzstufe und der Helm
 * -, traegt `payload.replacement`.
 *
 * **Die Ersatzstufe ist keine Wahl.** Dieselbe wie die gefallene, falls der
 * eigene Vorrat sie hergibt, sonst die hoechste freie darunter; "ersatzweise"
 * ist im Wortlaut keine Wahl. Gewaehlt wird nur die Kreuzung.
 */

type DeserterPlay = Extract<ProgressPlay, { card: 'deserter' }>;
type DeserterAnswer = Extract<ProgressAnswer, { card: 'deserter' }>;
type DeserterPayload = Extract<ProgressPendingPayload, { card: 'deserter' }>;

export function canDeserter(
  state: GameState,
  player: PlayerId,
  play: DeserterPlay,
): RuleViolation | null {
  if (play.victim === player) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      'Die eigenen Ritter wirbt man nicht ab',
    );
  }
  if (findPlayer(state, play.victim) === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${play.victim} sitzt nicht an diesem Tisch`);
  }
  if (!Object.values(state.knights).some((knight) => knight.owner === play.victim)) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      `${play.victim} hat keinen Ritter auf dem Brett`,
    );
  }
  return null;
}

export function applyDeserter(state: GameState, player: PlayerId, play: DeserterPlay): ReduceResult {
  const problem = canDeserter(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(
    openProgressPending(state, player, [play.victim], {
      card: 'deserter',
      victim: play.victim,
      replacement: null,
    }),
  );
}

/** Die erzwungene Ersatzstufe - `null`, wenn der Vorrat keine hergibt. */
export function replacementLevel(
  state: GameState,
  player: PlayerId,
  fallen: KnightLevel,
): KnightLevel | null {
  const stock = findPlayer(state, player)!.piecesLeft;
  for (let level: number = fallen; level >= 1; level -= 1) {
    const candidate = level as KnightLevel;
    if ((stock[knightPiece(candidate)] ?? 0) > 0) return candidate;
  }
  return null;
}

/** Wohin der Spielende den Ueberlaeufer stellen darf. */
export function deserterPlacements(state: GameState, player: PlayerId): VertexId[] {
  return boardOf(state.scenario).topology.vertices.filter(
    (vertex) => canPlaceKnightAt(state, player, vertex) === null,
  );
}

export function canAnswerDeserter(
  state: GameState,
  _phase: ProgressPendingPhase,
  payload: DeserterPayload,
  player: PlayerId,
  answer: DeserterAnswer,
): RuleViolation | null {
  if (payload.replacement === null) {
    const knight = state.knights[answer.vertex];
    if (knight === undefined || knight.owner !== player) {
      return violation(
        RuleViolationCode.NO_KNIGHT_HERE,
        `Auf ${answer.vertex} steht kein eigener Ritter`,
      );
    }
    return null;
  }

  const place = canPlaceKnightAt(state, player, answer.vertex);
  if (place !== null) return place;

  const piece = knightPiece(payload.replacement.level);
  if ((findPlayer(state, player)!.piecesLeft[piece] ?? 0) <= 0) {
    return violation(RuleViolationCode.NO_PIECES_LEFT, 'Im Vorrat liegt kein Ritter dieser Stufe mehr');
  }
  return null;
}

/**
 * Runde 1: der Ritter geht in den Vorrat seines Besitzers, und Runde 2 oeffnet
 * nur, wenn es eine Ersatzstufe **und** eine legale Kreuzung gibt - eine
 * Phase, die auf eine Wahl ohne Moeglichkeiten wartet, haelt den Tisch fuer
 * nichts an.
 *
 * Runde 2: der Ueberlaeufer steht mit der Ersatzstufe und dem Helm des
 * Gefallenen. `activatedOnTurn` ist die laufende Runde: uebernommen heisst
 * angekommen, nicht sofort handlungsfaehig.
 */
export function answerDeserter(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: DeserterPayload,
  player: PlayerId,
  answer: DeserterAnswer,
): GameState {
  if (payload.replacement === null) {
    const fallen = state.knights[answer.vertex]!;
    const knights = { ...state.knights };
    delete knights[answer.vertex];

    const piece = knightPiece(fallen.level);
    const removed: GameState = {
      ...state,
      knights,
      players: withPlayer(state, player, (owner) => ({
        ...owner,
        piecesLeft: { ...owner.piecesLeft, [piece]: owner.piecesLeft[piece] + 1 },
      })),
    };

    const level = replacementLevel(removed, phase.by, fallen.level);
    if (level === null || deserterPlacements(removed, phase.by).length === 0) {
      return { ...removed, phase: { kind: 'main' } };
    }

    return {
      ...removed,
      phase: {
        ...phase,
        pending: [phase.by],
        payload: { ...payload, replacement: { level, active: fallen.active } },
      },
    };
  }

  const { level, active } = payload.replacement;
  const piece = knightPiece(level);

  return {
    ...state,
    knights: {
      ...state.knights,
      [answer.vertex]: {
        owner: player,
        level,
        active,
        activatedOnTurn: active ? state.turn : null,
        upgradedThisTurn: false,
      },
    },
    players: withPlayer(state, player, (owner) => ({
      ...owner,
      piecesLeft: { ...owner.piecesLeft, [piece]: owner.piecesLeft[piece] - 1 },
    })),
    phase: { kind: 'main' },
  };
}
