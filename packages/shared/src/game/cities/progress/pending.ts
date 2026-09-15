import type { CardAmounts } from '../../../rules/index.js';
import { addCards, subtractCards } from '../../cards.js';
import type { Phase } from '../../phase.js';
import type { PlayerId } from '../../player.js';
import type { GameState } from '../../state.js';
import type { ProgressPendingPayload } from './answer.js';

/**
 * Was die fuenf wartenden Karten gemeinsam brauchen - ohne eine davon zu
 * kennen. Die Kartendateien importieren von hier, der Verteiler
 * `answerRules.ts` importiert die Kartendateien; so gibt es keinen Ladezirkel.
 */

export type ProgressPendingPhase = Extract<Phase, { kind: 'progressPending' }>;

/**
 * Oeffnet die Wartephase - oder laesst den Zustand, wie er ist, wenn niemand
 * zu antworten hat. Eine Phase, die auf niemanden wartet, hielte den Tisch fuer
 * nichts an (dieselbe Haltung wie bei `displacePending`).
 */
export function openProgressPending(
  state: GameState,
  by: PlayerId,
  pending: readonly PlayerId[],
  payload: ProgressPendingPayload,
): GameState {
  if (pending.length === 0) return state;
  return { ...state, phase: { kind: 'progressPending', by, pending: [...pending], payload } };
}

/** Setzt die Warteliste neu - leer heisst zurueck in die Hauptphase. */
export function withPending(
  state: GameState,
  phase: ProgressPendingPhase,
  pending: readonly PlayerId[],
): GameState {
  return pending.length === 0
    ? { ...state, phase: { kind: 'main' } }
    : { ...state, phase: { ...phase, pending: [...pending] } };
}

/** Verschiebt Karten von einer Hand in eine andere. Gedeckt sein muss es vorher. */
export function transferCards(
  state: GameState,
  from: PlayerId,
  to: PlayerId,
  amounts: CardAmounts,
): GameState {
  return {
    ...state,
    players: state.players.map((entry) => {
      if (entry.id === from) return { ...entry, resources: subtractCards(entry.resources, amounts) };
      if (entry.id === to) return { ...entry, resources: addCards(entry.resources, amounts) };
      return entry;
    }),
  };
}

/**
 * Wie viele Karten Hochzeit und Grosshaendler bewegen: zwei, oder alle, wenn es
 * weniger sind. Exportiert bis in den Client, damit der Zaehlerdialog dieselbe
 * Zahl verlangt wie die Regel und keine eigene Rechnung dafuer hat.
 */
export function twoCardsOrAll(held: number): number {
  return Math.min(2, held);
}
