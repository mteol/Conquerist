import { canAfford, countCards } from '../../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { victoryPointsOf } from '../../scoring.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, ProgressPendingPayload } from './answer.js';
import {
  openProgressPending,
  transferCards,
  twoCardsOrAll,
  withPending,
  type ProgressPendingPhase,
} from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Grosshaendler: eine Person mit mehr Siegpunkten waehlen, ihre Handkarten
 * ansehen und zwei davon nehmen.
 *
 * "Mehr Siegpunkte" heisst `victoryPointsOf` - dieselbe Auslegung und derselbe
 * Grund wie bei der Hochzeit (`wedding.ts`). Das Ziel braucht dazu mindestens
 * eine Karte; hat es weniger als zwei, nimmt der Spielende, was da ist.
 */

type MasterMerchantPlay = Extract<ProgressPlay, { card: 'masterMerchant' }>;
type MasterMerchantAnswer = Extract<ProgressAnswer, { card: 'masterMerchant' }>;
type MasterMerchantPayload = Extract<ProgressPendingPayload, { card: 'masterMerchant' }>;

export function canMasterMerchant(
  state: GameState,
  player: PlayerId,
  play: MasterMerchantPlay,
): RuleViolation | null {
  if (play.victim === player) {
    return violation(RuleViolationCode.INVALID_PROGRESS_VICTIM, 'Bei sich selbst nimmt man nichts');
  }
  const victim = findPlayer(state, play.victim);
  if (victim === undefined) {
    return violation(
      RuleViolationCode.UNKNOWN_PLAYER,
      `${play.victim} sitzt nicht an diesem Tisch`,
    );
  }
  if (victoryPointsOf(state, play.victim) <= victoryPointsOf(state, player)) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      `${play.victim} hat nicht mehr Siegpunkte`,
    );
  }
  if (countCards(victim.resources) === 0) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      `${play.victim} hat keine Handkarten`,
    );
  }
  return null;
}

export function applyMasterMerchant(
  state: GameState,
  player: PlayerId,
  play: MasterMerchantPlay,
): ReduceResult {
  const problem = canMasterMerchant(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(
    openProgressPending(state, player, [player], { card: 'masterMerchant', victim: play.victim }),
  );
}

export function canAnswerMasterMerchant(
  state: GameState,
  _phase: ProgressPendingPhase,
  payload: MasterMerchantPayload,
  _player: PlayerId,
  answer: MasterMerchantAnswer,
): RuleViolation | null {
  const held = findPlayer(state, payload.victim)!.resources;
  const required = twoCardsOrAll(countCards(held));

  if (countCards(answer.take) !== required) {
    return violation(
      RuleViolationCode.WRONG_PROGRESS_ANSWER,
      `Genommen werden genau ${required} Karten`,
    );
  }
  if (!canAfford(held, answer.take)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Genommen werden kann nur, was auf der Hand liegt',
    );
  }
  return null;
}

export function answerMasterMerchant(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: MasterMerchantPayload,
  _player: PlayerId,
  answer: MasterMerchantAnswer,
): GameState {
  return withPending(transferCards(state, payload.victim, phase.by, answer.take), phase, []);
}
