import type { GameState } from '../state.js';

/**
 * Burg 1 / Burg 2 - die Zugweitergabe am Tisch zu fuenft und sechst (Regel 13, Spec 7).
 *
 * Die beiden Marken liegen immer drei Plaetze auseinander. Wer Burg 1 hat,
 * spielt den vollen Zug; danach spielt, wer Burg 2 hat, den angepassten Zug:
 * kein Wurf, Handel nur mit der Bank, keine Alchemie. Dann wandern beide Marken
 * einen Platz weiter.
 *
 * **Keine eigene Phase.** Der angepasste Zug beginnt direkt in `main`: der Wurf
 * und die Alchemie gehoeren zu `rollPending` und fallen damit von selbst weg.
 * Uebrig bleibt genau eine Sperre - das Angebot an Mitspieler -, und die steht
 * in `playerTrade.ts` an derselben Stelle, die `legalActions` und die
 * Oberflaeche fragen.
 */

/** Wie weit Burg 2 hinter Burg 1 liegt. */
export const CASTLE_GAP = 3;

/** Wo die Marken am Anfang des Spiels liegen - oder `null`, wenn ohne sie gespielt wird. */
export function initialCastles(state: GameState): GameState['castles'] {
  if (!state.rules.castleTurns) return null;
  return { first: 0, second: CASTLE_GAP % state.players.length };
}

/** Ob der Spieler am Zug gerade den angepassten Zug mit Burg 2 spielt. */
export function isAdaptedTurn(state: GameState): boolean {
  const castles = state.castles;
  if (castles === null) return false;
  return state.currentPlayerIndex === castles.second && castles.first !== castles.second;
}

/**
 * Wer nach `endTurn` am Zug ist, wo die Marken dann liegen, und ob gewuerfelt wird.
 *
 * Nach Burg 1 kommt Burg 2 desselben Spielzugs, ohne Wurf. Nach Burg 2 wandern
 * beide Marken eins weiter, und der neue Burg-1-Spieler wuerfelt.
 */
export function nextCastleTurn(
  state: GameState,
  castles: NonNullable<GameState['castles']>,
): { castles: NonNullable<GameState['castles']>; current: number; roll: boolean } {
  if (!isAdaptedTurn(state)) {
    return { castles, current: castles.second, roll: false };
  }
  const count = state.players.length;
  const moved = { first: (castles.first + 1) % count, second: (castles.second + 1) % count };
  return { castles: moved, current: moved.first, roll: true };
}
