import { COMMODITY_IDS, type CardId } from '../../../scenario/index.js';
import { EMPTY_CARDS, takeMostHeld } from '../../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import { RESOURCE_LABELS } from '../../labels.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, ProgressPendingPayload } from './answer.js';
import { inTurnOrder } from './draw.js';
import {
  openProgressPending,
  transferCards,
  withPending,
  type ProgressPendingPhase,
} from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Handelshafen: jeder anderen Person einmal einen Rohstoff anbieten, sie gibt
 * dafuer eine Handelsware ihrer Wahl.
 *
 * **Eine Rohstoffsorte fuer alle, gedeckt schon beim Ausspielen.** Wer die Karte
 * spielt, muss so viele davon haben, wie es Tauschpartner gibt. Danach ist jede
 * Antwort gedeckt - kein Teilerfolg, keine Abhaengigkeit von der Reihenfolge der
 * Antworten, und die Antwort braucht kein `null`, weil wer keine Handelsware hat
 * gar nicht erst gefragt wird.
 */

type TradeHarborPlay = Extract<ProgressPlay, { card: 'tradeHarbor' }>;
type TradeHarborAnswer = Extract<ProgressAnswer, { card: 'tradeHarbor' }>;
type TradeHarborPayload = Extract<ProgressPendingPayload, { card: 'tradeHarbor' }>;

function one(card: CardId) {
  return { ...EMPTY_CARDS, [card]: 1 };
}

function holdsCommodity(player: PlayerState): boolean {
  return COMMODITY_IDS.some((commodity) => player.resources[commodity] > 0);
}

/** Wer tauscht - im Uhrzeigersinn ab dem Spieler am Zug. */
export function tradeHarborPartners(state: GameState, player: PlayerId): PlayerId[] {
  return inTurnOrder(state)
    .filter((other) => other.id !== player && holdsCommodity(other))
    .map((other) => other.id);
}

export function canTradeHarbor(
  state: GameState,
  player: PlayerId,
  play: TradeHarborPlay,
): RuleViolation | null {
  const partners = tradeHarborPartners(state, player).length;
  if (partners === 0) {
    return violation(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
      'Niemand sonst hat eine Handelsware',
    );
  }

  const held = findPlayer(state, player)!.resources[play.resource];
  if (held < partners) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `Für ${partners} Tauschpartner braucht es ${partners}-mal ${RESOURCE_LABELS[play.resource]}`,
    );
  }
  return null;
}

export function applyTradeHarbor(
  state: GameState,
  player: PlayerId,
  play: TradeHarborPlay,
): ReduceResult {
  const problem = canTradeHarbor(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(
    openProgressPending(state, player, tradeHarborPartners(state, player), {
      card: 'tradeHarbor',
      resource: play.resource,
    }),
  );
}

/**
 * Die Deckung des Spielenden wird noch einmal geprueft, obwohl sie beim
 * Ausspielen feststand und sich in dieser Phase nichts bewegt: eine Regel, die
 * sich auf eine andere verlaesst, wird beim naechsten Umbau still falsch.
 */
export function canAnswerTradeHarbor(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: TradeHarborPayload,
  partner: PlayerId,
  answer: TradeHarborAnswer,
): RuleViolation | null {
  if (findPlayer(state, partner)!.resources[answer.commodity] < 1) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Hergegeben werden kann nur eine Handelsware, die auf der Hand liegt',
    );
  }
  if (findPlayer(state, phase.by)!.resources[payload.resource] < 1) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Der angebotene Rohstoff ist nicht mehr gedeckt',
    );
  }
  return null;
}

export function answerTradeHarbor(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: TradeHarborPayload,
  partner: PlayerId,
  answer: TradeHarborAnswer,
): GameState {
  const commodityIn = transferCards(state, partner, phase.by, one(answer.commodity));
  const resourceOut = transferCards(commodityIn, phase.by, partner, one(payload.resource));
  return withPending(
    resourceOut,
    phase,
    phase.pending.filter((id) => id !== partner),
  );
}

/** Nach Fristablauf: die haeufigste Handelsware, bei Gleichstand in `COMMODITY_IDS`-Ordnung. */
export function autoAnswerTradeHarbor(state: GameState, partner: PlayerId): TradeHarborAnswer {
  const taken = takeMostHeld(findPlayer(state, partner)!.resources, COMMODITY_IDS, 1);
  const commodity = COMMODITY_IDS.find((id) => taken[id] > 0) ?? COMMODITY_IDS[0];
  return { card: 'tradeHarbor', commodity };
}
