import type { PlayerId } from './player.js';
import type { GameState } from './state.js';

/**
 * Siegpunkte und Spielende.
 *
 * Die Punkte werden **gerechnet, nicht gespeichert**. Ein Feld `victoryPoints`
 * im Spielerzustand waere eine zweite Wahrheit neben der Belegung des Bretts,
 * und sie liefe auseinander, sobald irgendwo ein Nachziehen vergessen wird -
 * beim Ausbau zur Stadt etwa, oder wenn die Laengste Handelsstrasse den
 * Besitzer wechselt.
 *
 * Was die Bauwerke zaehlen, steht im RuleSet. Hier steht keine Zahl.
 */

/** Die Siegpunkte eines Spielers aus dem aktuellen Brett. */
export function victoryPointsOf(state: GameState, player: PlayerId): number {
  const values = state.rules.victoryPoints;
  let points = 0;

  for (const building of Object.values(state.buildings)) {
    if (building.owner !== player) continue;
    points += building.kind === 'city' ? values.city : values.settlement;
  }

  if (state.longestRoad.holder === player) points += values.longestRoad;

  return points;
}

/** Ob dieser Spieler das Siegpunktziel erreicht hat. */
export function hasWon(state: GameState, player: PlayerId): boolean {
  return victoryPointsOf(state, player) >= state.rules.victoryPointGoal;
}
