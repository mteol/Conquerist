import { reduce, type GameState } from '@conquerist/shared';

/**
 * Wuerfelt den Auftakt zu Ende.
 *
 * Seit dem Auftakt beginnt jede Partie mit `phase.kind === 'opening'`, und
 * praktisch jeder Test hier prueft etwas, das danach kommt: die Gruendung, das
 * Bauen, den Handel, die Klickkarten. Sie wuerfeln ihn deshalb ueber diese
 * Zeile durch, statt ihn nachzubauen.
 *
 * Warum das nicht der Helfer aus `shared/game/fixtures.ts` ist: der steht
 * bewusst **nicht** im Barrel - Testmaterial gehoert nicht zur oeffentlichen
 * Oberflaeche des Pakets. Also dieselbe kleine Schleife noch einmal, statt die
 * Grenze aufzuweichen.
 */
export function afterOpening(state: GameState): GameState {
  let current = state;

  // Ein Stechen endet mit Wahrscheinlichkeit eins, aber nicht nach einer festen
  // Zahl von Runden. Der Riegel faengt eine kaputte Auswertung ab, statt den
  // Testlauf haengen zu lassen.
  for (let guard = 0; guard < 200 && current.phase.kind === 'opening'; guard += 1) {
    const roller = current.phase.pending[0];
    if (roller === undefined) throw new Error('afterOpening: Warteschlange leer im Auftakt');

    const result = reduce(current, { type: 'rollDice', player: roller });
    if (!result.ok) throw new Error(`afterOpening: ${result.error.message}`);
    current = result.state;
  }

  if (current.phase.kind === 'opening') throw new Error('afterOpening: Der Auftakt endet nicht');

  return current;
}
