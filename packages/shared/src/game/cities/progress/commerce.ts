import type { PlayerId } from '../../player.js';
import { ok, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressPlay } from './play.js';

/**
 * Die vier Handelskarten, die an diesem Tisch liegen - Haendler bis
 * Handelsflotte. `masterMerchant` (Grosshaendler) und `tradeHarbor`
 * (Handelshafen) fehlen: sie warten auf eine fremde Antwort und kommen mit
 * ihrer Phase erst in 10d-2.
 *
 * **Stub-Stand (Aufgabe 5).** Jede Funktion hier bekommt vorerst nur den
 * schon abgeworfenen Zustand aus `progressRules.ts` zurueck, ohne eigene
 * Wirkung. Die Karte selbst ist zu diesem Zeitpunkt bereits von der Hand -
 * das erledigt der Verteiler, nicht diese Datei. Die tatsaechliche Wirkung
 * jeder Karte kommt in den Aufgaben 6 bis 12; bis dahin darf hier niemand aus
 * einem leeren Zweig auf einen vergessenen Fall schliessen.
 */

export function applyMerchant(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'merchant' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: Haendlerfigur setzen.
  return ok(state);
}

export function applyResourceMonopoly(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'resourceMonopoly' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: alle geben zwei Karten dieser Sorte ab.
  return ok(state);
}

export function applyCommodityMonopoly(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'commodityMonopoly' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: alle geben eine Karte dieser Ware ab.
  return ok(state);
}

export function applyMerchantFleet(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'merchantFleet' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: bis Zugende 2:1 fuer eine Sorte.
  return ok(state);
}
