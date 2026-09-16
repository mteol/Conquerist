import { CARD_IDS } from '../../../scenario/index.js';
import { canAfford, countCards, takeMostHeld } from '../../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { victoryPointsOf } from '../../scoring.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer } from './answer.js';
import { inTurnOrder } from './draw.js';
import {
  openProgressPending,
  transferCards,
  twoCardsOrAll,
  withPending,
  type ProgressPendingPhase,
} from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Hochzeit: jede Person mit mehr Siegpunkten schenkt zwei Karten ihrer Wahl.
 *
 * **"Mehr Siegpunkte" heisst `victoryPointsOf`.** An einem Staedte-&-Ritter-
 * Tisch gibt es keine Entwicklungskarten, und Buchdruck und Verfassung liegen
 * offen - volle und oeffentliche Punkte sind dort gleich. Ein Test in
 * `wedding.test.ts` haelt das fest.
 *
 * Wer weniger als zwei Karten hat, schenkt, was er hat; wer keine hat, steht
 * gar nicht erst in der Warteliste.
 */

type WeddingPlay = Extract<ProgressPlay, { card: 'wedding' }>;
type WeddingAnswer = Extract<ProgressAnswer, { card: 'wedding' }>;

/** Wer bei dieser Hochzeit schenkt - im Uhrzeigersinn ab dem Spieler am Zug. */
export function weddingGivers(state: GameState, player: PlayerId): PlayerId[] {
  const points = victoryPointsOf(state, player);
  return inTurnOrder(state)
    .filter(
      (other) =>
        other.id !== player &&
        victoryPointsOf(state, other.id) > points &&
        countCards(other.resources) > 0,
    )
    .map((other) => other.id);
}

/** Spielbar nur, wenn ueberhaupt jemand mehr Punkte hat - Karten braucht er dafuer nicht. */
export function canWedding(
  state: GameState,
  player: PlayerId,
  _play: WeddingPlay,
): RuleViolation | null {
  const points = victoryPointsOf(state, player);
  const richer = state.players.some(
    (other) => other.id !== player && victoryPointsOf(state, other.id) > points,
  );
  return richer
    ? null
    : violation(
        RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
        'Niemand hat mehr Siegpunkte – die Hochzeit bringt nichts',
      );
}

export function applyWedding(state: GameState, player: PlayerId, play: WeddingPlay): ReduceResult {
  const problem = canWedding(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(openProgressPending(state, player, weddingGivers(state, player), { card: 'wedding' }));
}

export function canAnswerWedding(
  state: GameState,
  _phase: ProgressPendingPhase,
  giver: PlayerId,
  answer: WeddingAnswer,
): RuleViolation | null {
  const held = findPlayer(state, giver)!.resources;
  const required = twoCardsOrAll(countCards(held));

  if (countCards(answer.gift) !== required) {
    return violation(
      RuleViolationCode.WRONG_PROGRESS_ANSWER,
      `Geschenkt werden genau ${required} Karten`,
    );
  }
  if (!canAfford(held, answer.gift)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Geschenkt werden kann nur, was auf der Hand liegt',
    );
  }
  return null;
}

/** Das Geschenk wandert sofort; der Schenkende faellt aus der Warteliste. */
export function answerWedding(
  state: GameState,
  phase: ProgressPendingPhase,
  giver: PlayerId,
  answer: WeddingAnswer,
): GameState {
  const given = transferCards(state, giver, phase.by, answer.gift);
  return withPending(
    given,
    phase,
    phase.pending.filter((id) => id !== giver),
  );
}

/** Nach Fristablauf: die zwei haeufigsten Karten, bei Gleichstand in `CARD_IDS`-Ordnung. */
export function autoAnswerWedding(state: GameState, giver: PlayerId): WeddingAnswer {
  const held = findPlayer(state, giver)!.resources;
  return { card: 'wedding', gift: takeMostHeld(held, CARD_IDS, twoCardsOrAll(countCards(held))) };
}
