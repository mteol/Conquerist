import type { PlayerId } from '../../player.js';
import { ok, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressPlay } from './play.js';

/**
 * Die sechs Politikkarten, die an diesem Tisch liegen - Bischof bis
 * Verfassung. `spy` (Spionage), `deserter` (Deserteur) und `wedding`
 * (Hochzeit) fehlen: sie warten auf eine fremde Antwort und kommen mit ihrer
 * Phase erst in 10d-2.
 *
 * **Stub-Stand (Aufgabe 5).** Jede Funktion hier bekommt vorerst nur den
 * schon abgeworfenen Zustand aus `progressRules.ts` zurueck, ohne eigene
 * Wirkung. Die Karte selbst ist zu diesem Zeitpunkt bereits von der Hand -
 * das erledigt der Verteiler, nicht diese Datei. Die tatsaechliche Wirkung
 * jeder Karte kommt in den Aufgaben 6 bis 12; bis dahin darf hier niemand aus
 * einem leeren Zweig auf einen vergessenen Fall schliessen.
 */

export function applyBishop(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'bishop' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: Raeuber versetzen und Karten ziehen.
  return ok(state);
}

export function applyDiplomat(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'diplomat' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: eine offene Strasse entfernen.
  return ok(state);
}

export function applyWarlord(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'warlord' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: alle eigenen Ritter gratis aktivieren.
  return ok(state);
}

export function applyIntrigue(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'intrigue' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: einen fremden Ritter vertreiben.
  return ok(state);
}

export function applySaboteur(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'saboteur' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: die Fuehrenden verlieren die Haelfte der Hand.
  return ok(state);
}

export function applyConstitution(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'constitution' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: ein Siegpunkt, sofort offen.
  return ok(state);
}
