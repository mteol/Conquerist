import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, WaitingCard } from './answer.js';
import { PROGRESS_NAMES } from './cards.js';
import { answerDeserter, autoAnswerDeserter, canAnswerDeserter } from './deserter.js';
import { answerMasterMerchant, canAnswerMasterMerchant } from './masterMerchant.js';
import type { ProgressPendingPhase } from './pending.js';
import { answerSpy, canAnswerSpy } from './spy.js';
import { answerTradeHarbor, autoAnswerTradeHarbor, canAnswerTradeHarbor } from './tradeHarbor.js';
import { answerWedding, autoAnswerWedding, canAnswerWedding } from './wedding.js';

/**
 * Die Aktion `answerProgress` und ihr Verteiler - das Gegenstueck zu
 * `progressRules.ts`.
 *
 * Hier steht das Gemeinsame: wartet die Phase, steht der Absender in der
 * Warteliste, gehoert die Antwort zur wartenden Karte. Was die Antwort bei
 * ihrer Karte verlangt und bewirkt, steht in der Datei der Karte.
 *
 * Jeder Zweig verengt `phase.payload` selbst auf seine Karte, statt sich auf
 * die Pruefung davor zu verlassen: `tsc` sieht die Verbindung zwischen
 * `answer.card` und `payload.card` nicht, und ein Cast waere eine Behauptung.
 */

function wrongCard(waitingFor: WaitingCard): RuleViolation {
  return violation(
    RuleViolationCode.WRONG_PROGRESS_ANSWER,
    `Gewartet wird auf eine Antwort zu ${PROGRESS_NAMES[waitingFor]}`,
  );
}

export function canAnswerProgress(
  state: GameState,
  player: PlayerId,
  answer: ProgressAnswer,
): RuleViolation | null {
  const phase = state.phase;
  if (phase.kind !== 'progressPending' || !phase.pending.includes(player)) {
    return violation(
      RuleViolationCode.NOT_ANSWERING_PROGRESS,
      `${player} muss gerade auf keine Fortschrittskarte antworten`,
    );
  }

  const payload = phase.payload;
  switch (answer.card) {
    case 'wedding':
      if (payload.card !== 'wedding') return wrongCard(payload.card);
      return canAnswerWedding(state, phase, player, answer);
    case 'tradeHarbor':
      if (payload.card !== 'tradeHarbor') return wrongCard(payload.card);
      return canAnswerTradeHarbor(state, phase, payload, player, answer);
    case 'spy':
      if (payload.card !== 'spy') return wrongCard(payload.card);
      return canAnswerSpy(state, phase, payload, player, answer);
    case 'masterMerchant':
      if (payload.card !== 'masterMerchant') return wrongCard(payload.card);
      return canAnswerMasterMerchant(state, phase, payload, player, answer);
    case 'deserter':
      if (payload.card !== 'deserter') return wrongCard(payload.card);
      return canAnswerDeserter(state, phase, payload, player, answer);
  }
}

export function applyAnswerProgress(
  state: GameState,
  player: PlayerId,
  answer: ProgressAnswer,
): ReduceResult {
  const problem = canAnswerProgress(state, player, answer);
  if (problem !== null) return rejected(problem);

  const phase = state.phase;
  // Nach `canAnswerProgress` unerreichbar - die Zeile verengt nur den Typ, ohne Cast.
  if (phase.kind !== 'progressPending') return rejected(wrongCard(answer.card));

  switch (answer.card) {
    case 'wedding':
      return ok(answerWedding(state, phase, player, answer));
    case 'tradeHarbor': {
      const payload = phase.payload;
      if (payload.card !== 'tradeHarbor') return rejected(wrongCard(payload.card));
      return ok(answerTradeHarbor(state, phase, payload, player, answer));
    }
    case 'spy': {
      const payload = phase.payload;
      if (payload.card !== 'spy') return rejected(wrongCard(payload.card));
      return ok(answerSpy(state, phase, payload, player, answer));
    }
    case 'masterMerchant': {
      const payload = phase.payload;
      if (payload.card !== 'masterMerchant') return rejected(wrongCard(payload.card));
      return ok(answerMasterMerchant(state, phase, payload, player, answer));
    }
    case 'deserter': {
      const payload = phase.payload;
      if (payload.card !== 'deserter') return rejected(wrongCard(payload.card));
      return ok(answerDeserter(state, phase, payload, player, answer));
    }
  }
}

/**
 * Die automatische Antwort fuer eine Person - `null` heisst: das Geschenk
 * verfaellt, die Karte endet ohne Wirkung.
 */
function autoAnswerFor(
  state: GameState,
  phase: ProgressPendingPhase,
  player: PlayerId,
): ProgressAnswer | null {
  const payload = phase.payload;
  switch (payload.card) {
    case 'wedding':
      return autoAnswerWedding(state, player);
    case 'tradeHarbor':
      return autoAnswerTradeHarbor(state, player);
    case 'spy':
    case 'masterMerchant':
      return null;
    case 'deserter':
      return payload.replacement === null ? autoAnswerDeserter(state, player) : null;
  }
}

/**
 * Der Fristablauf einer wartenden Karte.
 *
 * Beantwortet wird fuer **die, die beim Ablauf warteten** - nicht fuer die, die
 * dadurch erst an die Reihe kommen. Beim Deserteur oeffnet die Antwort des
 * Opfers Runde 2 beim Spielenden; der ist anwesend und bekommt seine eigene
 * Frist. Jede Antwort geht durch `applyAnswerProgress`, denselben Weg wie die
 * eines Menschen.
 */
export function autoAnswerProgress(state: GameState): ReduceResult {
  const phase = state.phase;
  if (phase.kind !== 'progressPending') {
    return rejected(
      violation(RuleViolationCode.NOT_ANSWERING_PROGRESS, 'Gerade wartet keine Fortschrittskarte'),
    );
  }

  let current = state;
  for (const player of phase.pending) {
    if (current.phase.kind !== 'progressPending' || !current.phase.pending.includes(player)) break;

    const answer = autoAnswerFor(current, current.phase, player);
    if (answer === null) return ok({ ...current, phase: { kind: 'main' } });

    const result = applyAnswerProgress(current, player, answer);
    if (!result.ok) return result;
    current = result.state;
  }
  return ok(current);
}
