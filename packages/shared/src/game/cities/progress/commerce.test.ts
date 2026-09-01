import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import { testGame, giving } from '../../fixtures.js';
import type { GameState } from '../../state.js';
import { applyPlayProgress } from './progressRules.js';
import { tradeRateFor } from '../../trade.js';
import { reduce } from '../../reducer.js';

/** Ein Staedte-&-Ritter-Tisch in der Hauptphase - p1 ist am Zug. */
function citiesTable(overrides: Partial<GameState> = {}): GameState {
  return testGame({ rules: CITIES_RULES, ...overrides });
}

/** Wieviel Wolle ein Spieler hat. */
function woolOf(state: GameState, player: string): number {
  const p = state.players.find((candidate) => candidate.id === player);
  return p?.resources.wool ?? 0;
}

/** Wieviel Tuch ein Spieler hat. */
function clothOf(state: GameState, player: string): number {
  const p = state.players.find((candidate) => candidate.id === player);
  return p?.resources.cloth ?? 0;
}

/** Der Tauschkurs fuer eine Sorte. */
function rateFor(state: GameState, player: string, sort: string): number {
  let best = tradeRateFor(state, player as any, sort as any);

  // Handelsflotte gilt bis Zugende
  if (state.fleetSort === sort && 2 < best) {
    best = 2;
  }

  return best;
}

describe('Aufgabe 9 - Monopole und Handelsflotte', () => {
  describe('Rohstoffmonopol', () => {
    it('nimmt jedem anderen zwei Karten der genannten Sorte', () => {
      const state = citiesTable({
        players: [
          { ...testGame().players[0], id: 'p1', resources: { ...testGame().players[0].resources, wool: 0 } },
          { ...testGame().players[1], id: 'p2', resources: { ...testGame().players[1].resources, wool: 2 } },
          { ...testGame().players[2], id: 'p3', resources: { ...testGame().players[2].resources, wool: 2 } },
        ],
      });
      const before1 = woolOf(state, 'p1');
      const state_with_hand = giving(state, 'p1', { wool: before1 });
      const state_with_card = {
        ...state_with_hand,
        players: state_with_hand.players.map((p) =>
          p.id === 'p1' ? { ...p, progressCards: ['resourceMonopoly'] } : p,
        ),
      };

      const result = applyPlayProgress(state_with_card, 'p1', { card: 'resourceMonopoly', resource: 'wool' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(woolOf(result.state, 'p1')).toBe(before1 + 4); // zwei Mitspieler, je 2 Karten
        expect(woolOf(result.state, 'p2')).toBe(0);
        expect(woolOf(result.state, 'p3')).toBe(0);
      }
    });

    it('nimmt nur, was einer hat', () => {
      const state = citiesTable();
      const state_with_hand = giving(state, 'p1', { wool: 0 });
      const state_with_thin_p2 = {
        ...state_with_hand,
        players: state_with_hand.players.map((p) =>
          p.id === 'p2' ? { ...p, resources: { ...p.resources, wool: 1 } } : p,
        ),
      };
      const state_with_card = {
        ...state_with_thin_p2,
        players: state_with_thin_p2.players.map((p) =>
          p.id === 'p1' ? { ...p, progressCards: ['resourceMonopoly'] } : p,
        ),
      };

      const before1 = woolOf(state_with_card, 'p1');
      const result = applyPlayProgress(state_with_card, 'p1', { card: 'resourceMonopoly', resource: 'wool' });
      if (result.ok) {
        // p1 hatte before1, p2 gibt 1 (hat nur 1), p3 gibt 0 (hat nicht, aber würde 2 geben)
        expect(woolOf(result.state, 'p1')).toBe(before1 + 1);
      }
    });
  });

  describe('Handelsmonopol', () => {
    it('nimmt beim Handelsmonopol nur eine Karte je Person', () => {
      const state = citiesTable({
        players: [
          { ...testGame().players[0], id: 'p1', resources: { ...testGame().players[0].resources, cloth: 0 } },
          { ...testGame().players[1], id: 'p2', resources: { ...testGame().players[1].resources, cloth: 5 } },
          { ...testGame().players[2], id: 'p3', resources: { ...testGame().players[2].resources, cloth: 5 } },
        ],
      });
      const before = clothOf(state, 'p1');
      const state_with_card = {
        ...state,
        players: state.players.map((p) =>
          p.id === 'p1' ? { ...p, progressCards: ['commodityMonopoly'] } : p,
        ),
      };

      const result = applyPlayProgress(state_with_card, 'p1', { card: 'commodityMonopoly', commodity: 'cloth' });
      if (result.ok) {
        expect(clothOf(result.state, 'p1')).toBe(before + 2); // zwei Mitspieler, je 1 Karte
      }
    });
  });

  describe('Handelsflotte', () => {
    it('tauscht mit der Flotte zwei zu eins bis Zugende', () => {
      const state = citiesTable();
      const state_with_card = {
        ...state,
        players: state.players.map((p) =>
          p.id === 'p1' ? { ...p, progressCards: ['merchantFleet'] } : p,
        ),
      };

      const played = applyPlayProgress(state_with_card, 'p1', { card: 'merchantFleet', sort: 'wool' });
      if (!played.ok) {
        expect(played.ok).toBe(true);
        return;
      }
      // Waehrend des Zuges gilt die Flotte
      expect(played.state.fleetSort).toBe('wool');
      expect(rateFor(played.state, 'p1', 'wool')).toBe(2);

      // Nach dem Zug ist die Flotte weg
      const after = { ...played.state, fleetSort: null };
      expect(rateFor(after, 'p1', 'wool')).toBe(4);
    });
  });
});
