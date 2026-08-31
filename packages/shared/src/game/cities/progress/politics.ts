import type { PlayerId } from '../../player.js';
import { ok, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressPlay } from './play.js';

/**
 * Fuenf ausspielbare Politikkarten an diesem Tisch - Bischof, Diplomat,
 * Heerfuehrer, Intrige, Sabotage. `spy` (Spionage), `deserter` (Deserteur) und
 * `wedding` (Hochzeit) fehlen: sie warten auf eine fremde Antwort und kommen
 * mit ihrer Phase erst in 10d-2.
 *
 * **Verfassung steht nicht hier.** Sie wird nie ausgespielt: laut Anleitung
 * (Abschnitt 11) liegt sie sofort beim Ziehen offen -
 * `draw.ts#receiveProgressCard` legt sie direkt in `openProgressCards` ab.
 * Dasselbe gilt fuer Buchdruck in `science.ts`. `play.ts` kennt deshalb keine
 * `ProgressPlay`-Variante fuer eine der beiden Karten.
 *
 * **Stub-Stand (Aufgabe 5) fuer die verbleibenden fuenf.** Jede Funktion hier
 * bekommt vorerst nur den schon abgeworfenen Zustand aus `progressRules.ts`
 * zurueck, ohne eigene Wirkung. Die Karte selbst ist zu diesem Zeitpunkt
 * bereits von der Hand - das erledigt der Verteiler, nicht diese Datei. Die
 * tatsaechliche Wirkung jeder Karte kommt in den Aufgaben 6 bis 12; bis dahin
 * darf hier niemand aus einem leeren Zweig auf einen vergessenen Fall
 * schliessen.
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
