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
  return Object.values(publicVictoryPointParts(state, player)).reduce(
    (sum, points) => sum + (points ?? 0),
    0,
  );
}

/** Woher oeffentliche Siegpunkte kommen - je Quelle eine Zeile am Tisch. */
export type PointSource =
  | 'settlement'
  | 'city'
  | 'metropolis'
  | 'longestRoad'
  | 'largestArmy'
  | 'defender'
  | 'progressCard'
  | 'merchant';

/**
 * Dieselben Punkte wie `publicVictoryPointsOf`, nach Quelle aufgeschluesselt.
 *
 * Die Summe ist **die** Rechnung und nicht eine zweite daneben:
 * `publicVictoryPointsOf` addiert genau diese Teile. Quellen mit null Punkten
 * fehlen, damit der Tisch nur zeigt, was zaehlt.
 */
export function publicVictoryPointParts(
  state: GameState,
  player: PlayerId,
): Partial<Record<PointSource, number>> {
  const values = state.rules.victoryPoints;
  const parts: Partial<Record<PointSource, number>> = {};
  const add = (source: PointSource, points: number): void => {
    if (points > 0) parts[source] = (parts[source] ?? 0) + points;
  };

  for (const building of Object.values(state.buildings)) {
    if (building.owner !== player) continue;
    if (building.kind === 'city') add('city', values.city);
    else add('settlement', values.settlement);
    // Oeffentlich, weil der Aufsatz auf dem Brett steht - zusaetzlich zu den
    // zwei Punkten der Stadt, die die Zeile darueber schon zaehlt.
    if (building.metropolis !== null) add('metropolis', values.metropolis);
  }

  if (state.longestRoad.holder === player) add('longestRoad', values.longestRoad);
  if (state.largestArmy.holder === player) add('largestArmy', values.largestArmy);

  /*
   * Die Siegpunkt-Chips "Retter Catans" liegen offen vor dem Spieler - deshalb
   * **hier** und nicht erst in `victoryPointsOf`. An einem Basistisch ist
   * `defenderPoints` null und `values.defender` ebenfalls.
   */
  const hand = state.players.find((entry) => entry.id === player);
  add('defender', (hand?.defenderPoints ?? 0) * values.defender);

  // Buchdruck und Verfassung liegen offen vor dem Spieler, sobald gespielt.
  add('progressCard', (hand?.openProgressCards.length ?? 0) * values.progressCard);

  // Der Haendler sitzt auf dem Brett - sein Punkt gehoert dem aktuellen Besitzer.
  if (state.merchant?.owner === player) add('merchant', values.merchant);

  return parts;
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
