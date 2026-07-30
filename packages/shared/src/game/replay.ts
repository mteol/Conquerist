import type { GameAction } from './actions.js';
import { reduce } from './reducer.js';
import { ok, rejected, type GameState, type ReduceResult } from './state.js';

/**
 * Spielt eine Aktionsfolge auf einen Startzustand.
 *
 * Eine Faltung ueber `reduce` und sonst nichts - klein genug, dass man sie sich
 * sparen koennte. Sie steht trotzdem hier, weil sie der Beleg fuer Regel 2 ist:
 * wenn der Zustand aus Startzustand und Aktionsfolge rekonstruierbar sein soll,
 * dann muss genau diese Funktion existieren und getestet sein. Ab Etappe 6 ist
 * sie der Kern des Action-Logs.
 *
 * Bricht beim ersten abgelehnten Zug ab. Die Begruendung nennt die Position in
 * der Folge - bei zweihundert Aktionen ist "Zug 137 abgelehnt" der Unterschied
 * zwischen einer Minute und einem Abend.
 */
export function replay(initial: GameState, actions: readonly GameAction[]): ReduceResult {
  let state = initial;

  for (const [index, action] of actions.entries()) {
    const result = reduce(state, action);
    if (!result.ok) {
      return rejected({
        code: result.error.code,
        message: `Aktion ${index} (${action.type}, ${action.player}): ${result.error.message}`,
      });
    }
    state = result.state;
  }

  return ok(state);
}
