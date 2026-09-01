import type { PlayerId } from '../../player.js';
import { addCards, EMPTY_CARDS, subtractCards } from '../../cards.js';
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
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'resourceMonopoly' }>,
): ReduceResult {
  const resource = play.resource;
  let newState = state;

  // Jeder andere Spieler gibt 2 Karten dieser Sorte ab (oder was er hat)
  for (const other of state.players) {
    if (other.id === player) continue;

    const hasCount = other.resources[resource] ?? 0;
    const takeCount = Math.min(hasCount, 2);

    if (takeCount > 0) {
      const taken: typeof EMPTY_CARDS = { ...EMPTY_CARDS, [resource]: takeCount };
      newState = {
        ...newState,
        players: newState.players.map((p) =>
          p.id === other.id ? { ...p, resources: subtractCards(p.resources, taken) } : p,
        ),
      };
      const giver: typeof EMPTY_CARDS = { ...EMPTY_CARDS, [resource]: takeCount };
      newState = {
        ...newState,
        players: newState.players.map((p) =>
          p.id === player ? { ...p, resources: addCards(p.resources, giver) } : p,
        ),
      };
    }
  }

  return ok(newState);
}

export function applyCommodityMonopoly(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'commodityMonopoly' }>,
): ReduceResult {
  const commodity = play.commodity;
  let newState = state;

  // Jeder andere Spieler gibt 1 Karte dieser Ware ab (oder was er hat)
  for (const other of state.players) {
    if (other.id === player) continue;

    const hasCount = other.resources[commodity] ?? 0;
    const takeCount = Math.min(hasCount, 1);

    if (takeCount > 0) {
      const taken: typeof EMPTY_CARDS = { ...EMPTY_CARDS, [commodity]: takeCount };
      newState = {
        ...newState,
        players: newState.players.map((p) =>
          p.id === other.id ? { ...p, resources: subtractCards(p.resources, taken) } : p,
        ),
      };
      const giver: typeof EMPTY_CARDS = { ...EMPTY_CARDS, [commodity]: takeCount };
      newState = {
        ...newState,
        players: newState.players.map((p) =>
          p.id === player ? { ...p, resources: addCards(p.resources, giver) } : p,
        ),
      };
    }
  }

  return ok(newState);
}

export function applyMerchantFleet(
  state: GameState,
  _player: PlayerId,
  play: Extract<ProgressPlay, { card: 'merchantFleet' }>,
): ReduceResult {
  return ok({
    ...state,
    fleetSort: play.sort,
  });
}
