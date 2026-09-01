import { describe, expect, it } from 'vitest';

import { ADJACENT_VERTEX, CENTER_VERTEX, gameWithCities, giving } from '../fixtures.js';
import type { GameState } from '../state.js';
import { applyPlayProgress } from './progress/progressRules.js';
import { applyTradeWithBank } from '../trade.js';
import { publicVictoryPointsOf } from '../scoring.js';
import type { ProgressCardId } from './progress/cards.js';

/** Ein Staedte-&-Ritter-Tisch in der Hauptphase - p1 ist am Zug. */
function citiesTable(overrides: Partial<GameState> = {}): GameState {
  return gameWithCities(overrides);
}

function withProgressCards(state: GameState, id: string, cards: ProgressCardId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, progressCards: cards } : player,
    ),
  };
}

/** Die Handkarten eines Spielers. */
function resourcesOf(state: GameState, player: string) {
  return state.players.find((candidate) => candidate.id === player)!.resources;
}

/** Ein Hex mit einem Rohstoff - Wald (Holz). */
const FOREST_HEX = '0,1';

/**
 * Die Wueste in der Mitte des Testbretts - existiert wirklich (anders als ein
 * Koordinatenpaar ausserhalb des Bretts), damit der Test die Terrain-Pruefung
 * in `canPlaceMerchant` trifft und nicht schon die Existenzpruefung davor.
 * `CENTER_VERTEX` grenzt an dieses Feld, siehe `fixtures.ts`.
 */
const DESERT_HEX = '0,0';

/**
 * Ein Landfeld, das an keinem Knoten von `CENTER_VERTEX` liegt - dort baut
 * `citiesTable()` per Vorgabe ihre Stadt. Fuer die Abstandsregel gesperrt,
 * ohne dass ein Terrain-Grund dazwischenkommt.
 */
const FAR_LAND_HEX = '0,-1';

/** Ein Knoten neben dem Wald mit eigener Siedlung. */
const OWN_FOREST_VERTEX = ADJACENT_VERTEX;

describe('Aufgabe 10 - Haendler', () => {
  it('stellt die Figur nur neben ein eigenes Gebaeude', () => {
    const state = citiesTable({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });
    const state_with_card = withProgressCards(state, 'p1', ['merchant']);

    // Ein Feld ohne eigenes Gebaeude in der Nachbarschaft: Fehler
    const far = applyPlayProgress(state_with_card, 'p1', {
      card: 'merchant',
      hex: FAR_LAND_HEX,
    });
    expect(far.ok).toBe(false);
  });

  it('stellt sie nicht auf die Wueste oder die See', () => {
    const state = citiesTable();
    const state_with_card = withProgressCards(state, 'p1', ['merchant']);

    expect(applyPlayProgress(state_with_card, 'p1', { card: 'merchant', hex: DESERT_HEX }).ok).toBe(
      false,
    );
  });

  /*
   * Der Kurs wird nicht mehr in einer eigenen Testhilfe nachgebaut - das
   * pruefte nur eine Kopie von `tradeRateFor` und nicht den echten Pfad.
   * Stattdessen laeuft der Tausch ueber `applyTradeWithBank`.
   */
  it('gibt ihrem Besitzer zwei zu eins auf dem Rohstoff des Feldes', () => {
    const state = citiesTable({
      buildings: {
        [OWN_FOREST_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });
    const state_with_card = withProgressCards(state, 'p1', ['merchant']);

    const played = applyPlayProgress(state_with_card, 'p1', { card: 'merchant', hex: FOREST_HEX });
    if (!played.ok) {
      expect(played.ok).toBe(true);
      return;
    }

    // Der Haendler steht auf dem Wald - zwei Holz reichen jetzt fuer einen Tausch
    const stocked = giving(played.state, 'p1', { lumber: 2 });
    const traded = applyTradeWithBank(stocked, 'p1', 'lumber', 'brick');
    expect(traded.ok).toBe(true);
    if (traded.ok) {
      expect(resourcesOf(traded.state, 'p1').lumber).toBe(0);
      expect(resourcesOf(traded.state, 'p1').brick).toBe(1);
    }
  });

  it('zaehlt einen Punkt, und nur beim aktuellen Besitzer', () => {
    const state = citiesTable({
      buildings: {
        [OWN_FOREST_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });
    const state_with_card = withProgressCards(state, 'p1', ['merchant']);

    const baseline1 = publicVictoryPointsOf(state_with_card, 'p1');
    const played = applyPlayProgress(state_with_card, 'p1', { card: 'merchant', hex: FOREST_HEX });
    if (!played.ok) {
      expect(played.ok).toBe(true);
      return;
    }
    expect(publicVictoryPointsOf(played.state, 'p1')).toBe(baseline1 + 1);

    // Wenn der Haendler den Besitzer wechselt (manuell simuliert), nimmt p1 den Punkt ab
    const taken = {
      ...played.state,
      merchant: {
        hex: FOREST_HEX,
        owner: 'p2',
      },
    };
    expect(publicVictoryPointsOf(taken, 'p1')).toBe(baseline1);
    expect(publicVictoryPointsOf(taken, 'p2')).toBe(
      publicVictoryPointsOf(state_with_card, 'p2') + 1,
    );
  });
});
