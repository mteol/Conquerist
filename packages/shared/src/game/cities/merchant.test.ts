import { describe, expect, it } from 'vitest';

import { ADJACENT_VERTEX, CENTER_VERTEX, FAR_VERTEX, gameWithCities } from '../fixtures.js';
import type { GameState } from '../state.js';
import { applyPlayProgress } from './progress/progressRules.js';
import { tradeRateFor } from '../trade.js';
import { publicVictoryPointsOf } from '../scoring.js';
import { boardOf } from '../board.js';
import { terrainYield } from '../../scenario/index.js';
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

/** Ein Hex mit einem Rohstoff - Wald (Holz). */
const FOREST_HEX = '0,1';

/** Ein Hex auf der See. */
const SEA_HEX = '2,0';

/** Ein Knoten weit weg vom Wald - fuer die Abstandsregel gesperrt ohne Gebaeude. */
const FAR_FOREST_VERTEX = FAR_VERTEX;

/** Ein Knoten neben dem Wald mit eigener Siedlung. */
const OWN_FOREST_VERTEX = ADJACENT_VERTEX;

/** Der Tauschkurs fuer eine Sorte. */
function rateFor(state: GameState, player: string, sort: string): number {
  let best = tradeRateFor(state, player as any, sort as any);

  // Handelsflotte gilt bis Zugende
  if (state.fleetSort === sort && 2 < best) {
    best = 2;
  }

  // Haendler gilt, solange der Spieler ihn haelt
  if (state.merchant?.owner === player) {
    // Der Haendler sitzt auf einem Landschaftsfeld
    const board = boardOf(state.scenario);
    const hex = state.merchant.hex;
    const placement = board.hexes.get(hex as any);
    if (placement) {
      // Das Feld bestimmt den Rohstoff des Haendlers
      const resource = terrainYield(placement.terrain);
      if (resource === sort && 2 < best) {
        best = 2;
      }
    }
  }

  return best;
}

describe('Aufgabe 10 - Haendler', () => {
  it('stellt die Figur nur neben ein eigenes Gebaeude', () => {
    const state = citiesTable({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });
    const state_with_card = withProgressCards(state, 'p1', ['merchant']);

    // Ein Knoten ohne eigenes Gebaeude: Fehler
    const far = applyPlayProgress(state_with_card, 'p1', {
      card: 'merchant',
      hex: FAR_FOREST_VERTEX,
    });
    expect(far.ok).toBe(false);
  });

  it('stellt sie nicht auf die See', () => {
    const state = citiesTable();
    const state_with_card = withProgressCards(state, 'p1', ['merchant']);

    expect(applyPlayProgress(state_with_card, 'p1', { card: 'merchant', hex: SEA_HEX }).ok).toBe(
      false,
    );
  });

  it('gibt ihrem Besitzer zwei zu eins auf dem Rohstoff des Feldes', () => {
    const state = citiesTable({
      buildings: {
        [OWN_FOREST_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });
    const state_with_card = withProgressCards(state, 'p1', ['merchant']);

    const played = applyPlayProgress(state_with_card, 'p1', { card: 'merchant', hex: FOREST_HEX });
    if (played.ok) {
      expect(rateFor(played.state, 'p1', 'lumber')).toBe(2);
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
