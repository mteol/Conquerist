import type { CardId } from '../../../scenario/index.js';
import type { PlayerId } from '../../player.js';
import { addCards, EMPTY_CARDS, subtractCards } from '../../cards.js';
import { ok, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressPlay } from './play.js';
import { applyMerchant as applyMerchantImpl } from '../merchant.js';

/**
 * Die vier Handelskarten, die an diesem Tisch liegen - Haendler bis
 * Handelsflotte. `masterMerchant` (Grosshaendler) und `tradeHarbor`
 * (Handelshafen) fehlen hier: die fuenf Karten, die auf eine fremde Antwort
 * warten, stehen je in einer eigenen Datei (`wedding.ts`, `tradeHarbor.ts`,
 * `spy.ts`, `masterMerchant.ts`, `deserter.ts`) - ihre Gemeinsamkeit ist die
 * Phase, nicht der Stapel.
 */

export function applyMerchant(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'merchant' }>,
): ReduceResult {
  return applyMerchantImpl(state, player, play);
}

/**
 * Ein Monopol: jeder andere Spieler gibt bis zu `takePerPlayer` Karten der
 * genannten Sorte ab (oder weniger, wenn er nicht so viele hat), der
 * Ausspieler bekommt sie alle.
 *
 * Gemeinsame Grundlage fuer `applyResourceMonopoly` (Rohstoffmonopol, zwei
 * Karten) und `applyCommodityMonopoly` (Handelsmonopol, eine Karte) - beide
 * Karten unterscheiden sich nur in der Sorte und in dieser einen Zahl.
 */
function applyMonopoly(
  state: GameState,
  player: PlayerId,
  card: CardId,
  takePerPlayer: number,
): ReduceResult {
  let newState = state;

  for (const other of state.players) {
    if (other.id === player) continue;

    const hasCount = other.resources[card] ?? 0;
    const takeCount = Math.min(hasCount, takePerPlayer);

    if (takeCount > 0) {
      const moved: typeof EMPTY_CARDS = { ...EMPTY_CARDS, [card]: takeCount };
      newState = {
        ...newState,
        players: newState.players.map((p) => {
          if (p.id === other.id) return { ...p, resources: subtractCards(p.resources, moved) };
          if (p.id === player) return { ...p, resources: addCards(p.resources, moved) };
          return p;
        }),
      };
    }
  }

  return ok(newState);
}

export function applyResourceMonopoly(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'resourceMonopoly' }>,
): ReduceResult {
  return applyMonopoly(state, player, play.resource, 2);
}

export function applyCommodityMonopoly(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'commodityMonopoly' }>,
): ReduceResult {
  return applyMonopoly(state, player, play.commodity, 1);
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
