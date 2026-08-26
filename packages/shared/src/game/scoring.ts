import { countDevelopmentCards } from './development.js';
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

/**
 * Die Punkte, die alle am Tisch sehen koennen.
 *
 * Alles ausser den Siegpunktkarten: die liegen verdeckt, und wer sie
 * mitzaehlte, verriete sie ueber den Punktestand. Genau diese Zahl steht in
 * einer `PlayerView` bei den Mitspielern - der Empfaenger sieht bei sich selbst
 * die volle.
 */
export function publicVictoryPointsOf(state: GameState, player: PlayerId): number {
  const values = state.rules.victoryPoints;
  let points = 0;

  for (const building of Object.values(state.buildings)) {
    if (building.owner !== player) continue;
    points += building.kind === 'city' ? values.city : values.settlement;
  }

  if (state.longestRoad.holder === player) points += values.longestRoad;
  if (state.largestArmy.holder === player) points += values.largestArmy;

  /*
   * Die Siegpunkt-Chips "Retter Catans" liegen offen vor dem Spieler - deshalb
   * **hier** und nicht erst in `victoryPointsOf`. Wer sie nicht mitzaehlt,
   * kann den Punktestand am Tisch nicht nachrechnen. An einem Basistisch ist
   * `defenderPoints` null und `values.defender` ebenfalls.
   */
  const hand = state.players.find((entry) => entry.id === player);
  points += (hand?.defenderPoints ?? 0) * values.defender;

  return points;
}

/** Die Siegpunkte eines Spielers aus dem aktuellen Brett. */
export function victoryPointsOf(state: GameState, player: PlayerId): number {
  let points = publicVictoryPointsOf(state, player);

  /*
   * Siegpunktkarten zaehlen von dem Moment an, in dem sie gekauft wurden - sie
   * werden nie ausgespielt. Sie sind damit die einzigen Punkte, die die
   * Mitspieler nicht sehen koennen; `PlayerView` haelt sie deshalb aus fremden
   * Punktestaenden heraus, und erst der Sieg deckt sie auf.
   */
  const hand = state.players.find((entry) => entry.id === player);
  if (hand !== undefined) {
    points +=
      countDevelopmentCards(hand.developmentCards, 'victoryPoint') *
      state.rules.victoryPoints.developmentCard;
  }

  return points;
}

/** Ob dieser Spieler das Siegpunktziel erreicht hat. */
export function hasWon(state: GameState, player: PlayerId): boolean {
  return victoryPointsOf(state, player) >= state.rules.victoryPointGoal;
}
