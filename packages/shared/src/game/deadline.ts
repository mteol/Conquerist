import type { PlayerId } from './player.js';
import type { GameState } from './state.js';

/**
 * Die laufende Frist und wem sie gehoert - oder `null`.
 *
 * Die eine Stelle, an der ausserhalb der Logik nachgesehen wird, ob gerade eine
 * Uhr laeuft. Der Wecker im Server liest nur diese Funktion; ein zweites
 * Zeitlimit (Abwurffrist, Zugzeit) ergaenzt hier einen Zweig und sonst nichts.
 *
 * `owner` ist der, dessen Frist es ist - er steht anschliessend im
 * Verlaufssatz, wenn sie reisst.
 */
export function deadlineOf(state: GameState): { at: number; owner: PlayerId } | null {
  if (state.phase.kind === 'tradePending') {
    return { at: state.phase.expiresAt, owner: state.phase.offer.from };
  }

  return null;
}
