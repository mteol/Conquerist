import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, ProgressPendingPayload } from './answer.js';
import { PROGRESS_NAMES, PROGRESS_VICTORY_CARDS } from './cards.js';
import { countedHand, receiveProgressCard } from './draw.js';
import { openProgressPending, withPending, type ProgressPendingPhase } from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Spionage: die Fortschrittskarten einer Person ansehen und eine davon nehmen.
 *
 * Jede Person taugt, ohne Vergleich der Punkte. "Keine Siegpunktkarten" faellt
 * aus dem Modell heraus: Buchdruck und Verfassung liegen in
 * `openProgressCards`, gewaehlt wird nur aus `progressCards`.
 *
 * Der Blick in die fremde Hand ist die Phase selbst - `revealsTo` in
 * `playerView.ts` oeffnet sie, solange der Spielende hier wartet.
 */

type SpyPlay = Extract<ProgressPlay, { card: 'spy' }>;
type SpyAnswer = Extract<ProgressAnswer, { card: 'spy' }>;
type SpyPayload = Extract<ProgressPendingPayload, { card: 'spy' }>;

export function canSpy(state: GameState, player: PlayerId, play: SpyPlay): RuleViolation | null {
  if (play.victim === player) {
    return violation(RuleViolationCode.INVALID_PROGRESS_VICTIM, 'Bei sich selbst spioniert man nicht');
  }
  const victim = findPlayer(state, play.victim);
  if (victim === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${play.victim} sitzt nicht an diesem Tisch`);
  }
  if (countedHand(victim) === 0) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      `${play.victim} hat keine Fortschrittskarte, die sich nehmen ließe`,
    );
  }
  return null;
}

export function applySpy(state: GameState, player: PlayerId, play: SpyPlay): ReduceResult {
  const problem = canSpy(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(openProgressPending(state, player, [player], { card: 'spy', victim: play.victim }));
}

export function canAnswerSpy(
  state: GameState,
  _phase: ProgressPendingPhase,
  payload: SpyPayload,
  _player: PlayerId,
  answer: SpyAnswer,
): RuleViolation | null {
  const victim = findPlayer(state, payload.victim)!;
  if (!victim.progressCards.includes(answer.take) || PROGRESS_VICTORY_CARDS.includes(answer.take)) {
    return violation(
      RuleViolationCode.NO_SUCH_PROGRESS_CARD,
      `${payload.victim} hat ${PROGRESS_NAMES[answer.take]} nicht auf der Hand`,
    );
  }
  return null;
}

/**
 * Nimmt **ein** Exemplar und schliesst die Phase.
 *
 * Kein Abgeben, auch ueber vier Karten: der Spielende ist am Zug, und am Zug
 * wird eine fuenfte Karte sofort gespielt (Regel 11) - das kann er in `main`.
 */
export function answerSpy(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: SpyPayload,
  player: PlayerId,
  answer: SpyAnswer,
): GameState {
  const players = state.players.map((entry) => {
    if (entry.id === payload.victim) {
      const cards = [...entry.progressCards];
      cards.splice(cards.indexOf(answer.take), 1);
      return { ...entry, progressCards: cards };
    }
    return entry.id === player ? receiveProgressCard(entry, answer.take) : entry;
  });
  return withPending({ ...state, players }, phase, []);
}
