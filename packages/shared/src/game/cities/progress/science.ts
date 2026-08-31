import type { PlayerId } from '../../player.js';
import { ok, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressPlay } from './play.js';

/**
 * Die zehn Wissenschaftskarten - Kran bis Strassenbau.
 *
 * **Stub-Stand (Aufgabe 5).** Jede Funktion hier bekommt vorerst nur den
 * schon abgeworfenen Zustand aus `progressRules.ts` zurueck, ohne eigene
 * Wirkung. Die Karte selbst ist zu diesem Zeitpunkt bereits von der Hand -
 * das erledigt der Verteiler, nicht diese Datei. Die tatsaechliche Wirkung
 * jeder Karte kommt in den Aufgaben 6 bis 12; bis dahin darf hier niemand aus
 * einem leeren Zweig auf einen vergessenen Fall schliessen.
 */

export function applyAlchemist(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'alchemist' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: beide Wuerfel bestimmen.
  return ok(state);
}

export function applyCrane(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'crane' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: ein Ausbau kostet eine Ware weniger.
  return ok(state);
}

export function applyMining(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'mining' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: zwei Erz je Gebirgsfeld.
  return ok(state);
}

export function applyIrrigation(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'irrigation' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: zwei Getreide je Ackerland.
  return ok(state);
}

export function applyPrinter(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'printer' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: ein Siegpunkt, sofort offen.
  return ok(state);
}

export function applyInventor(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'inventor' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: zwei Zahlenchips vertauschen.
  return ok(state);
}

export function applyEngineer(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'engineer' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: eine Stadtmauer gratis.
  return ok(state);
}

export function applyMedicine(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'medicine' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: eine Siedlung wird zur Stadt.
  return ok(state);
}

export function applySmith(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'smith' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: zwei Ritter je eine Stufe gratis.
  return ok(state);
}

export function applyProgressRoadBuilding(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'roadBuilding' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: zwei Strassen gratis.
  return ok(state);
}
