import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, WaitingCard } from './answer.js';
import { PROGRESS_NAMES } from './cards.js';
import { answerSpy, canAnswerSpy } from './spy.js';
import { answerTradeHarbor, canAnswerTradeHarbor } from './tradeHarbor.js';
import { answerWedding, canAnswerWedding } from './wedding.js';

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

/** Bis zur Aufgabe der Karte - faellt mit der fuenften Karte (Aufgabe 7) weg. */
function notWiredYet(card: WaitingCard): RuleViolation {
  return violation(
    RuleViolationCode.WRONG_PROGRESS_ANSWER,
    `${PROGRESS_NAMES[card]} ist noch nicht verdrahtet`,
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
      return notWiredYet(answer.card);
    case 'deserter':
      if (payload.card !== 'deserter') return wrongCard(payload.card);
      return notWiredYet(answer.card);
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
    case 'masterMerchant':
    case 'deserter':
      return rejected(notWiredYet(answer.card));
  }
}
