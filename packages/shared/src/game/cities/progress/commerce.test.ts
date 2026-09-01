import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import { RuleViolationCode } from '../../errors.js';
import { giving, testGame } from '../../fixtures.js';
import type { GameState } from '../../state.js';
import { applyPlayProgress } from './progressRules.js';
import { applyTradeWithBank } from '../../trade.js';
import type { ProgressCardId } from './cards.js';

/** Ein Staedte-&-Ritter-Tisch in der Hauptphase - p1 ist am Zug. */
function citiesTable(overrides: Partial<GameState> = {}): GameState {
  return testGame({ rules: CITIES_RULES, ...overrides });
}

function withProgressCards(state: GameState, id: string, cards: ProgressCardId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, progressCards: cards } : player,
    ),
  };
}

/** Wieviel Wolle ein Spieler hat. */
function woolOf(state: GameState, player: string): number {
  const p = state.players.find((candidate) => candidate.id === player);
  return p?.resources.wool ?? 0;
}

/** Wieviel Erz ein Spieler hat. */
function oreOf(state: GameState, player: string): number {
  const p = state.players.find((candidate) => candidate.id === player);
  return p?.resources.ore ?? 0;
}

/** Wieviel Tuch ein Spieler hat. */
function clothOf(state: GameState, player: string): number {
  const p = state.players.find((candidate) => candidate.id === player);
  return p?.resources.cloth ?? 0;
}

describe('Aufgabe 9 - Monopole und Handelsflotte', () => {
  describe('Rohstoffmonopol', () => {
    it('nimmt jedem anderen zwei Karten der genannten Sorte', () => {
      const state = citiesTable();
      const state_with_resources = {
        ...state,
        players: state.players.map((p) =>
          p.id === 'p1'
            ? { ...p, resources: { ...p.resources, wool: 5 } }
            : p.id === 'p2'
              ? { ...p, resources: { ...p.resources, wool: 2 } }
              : p.id === 'p3'
                ? { ...p, resources: { ...p.resources, wool: 2 } }
                : p,
        ),
      };
      const state_with_card = withProgressCards(state_with_resources, 'p1', ['resourceMonopoly']);

      const before1 = woolOf(state_with_card, 'p1');
      const result = applyPlayProgress(state_with_card, 'p1', {
        card: 'resourceMonopoly',
        resource: 'wool',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(woolOf(result.state, 'p1')).toBe(before1 + 4); // zwei Mitspieler, je 2 Karten
        expect(woolOf(result.state, 'p2')).toBe(0);
        expect(woolOf(result.state, 'p3')).toBe(0);
      }
    });

    it('nimmt nur, was einer hat', () => {
      const state = citiesTable();
      const state_with_resources = {
        ...state,
        players: state.players.map((p) =>
          p.id === 'p2' ? { ...p, resources: { ...p.resources, wool: 1 } } : p,
        ),
      };
      const state_with_card = withProgressCards(state_with_resources, 'p1', ['resourceMonopoly']);

      const before1 = woolOf(state_with_card, 'p1');
      const result = applyPlayProgress(state_with_card, 'p1', {
        card: 'resourceMonopoly',
        resource: 'wool',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // p1 hatte before1, p2 gibt 1 (hat nur 1), p3 gibt 0 (hat nicht, aber wuerde 2 geben)
        expect(woolOf(result.state, 'p1')).toBe(before1 + 1);
      }
    });
  });

  describe('Handelsmonopol', () => {
    it('nimmt beim Handelsmonopol nur eine Karte je Person', () => {
      const state = citiesTable();
      const state_with_resources = {
        ...state,
        players: state.players.map((p) =>
          p.id === 'p1'
            ? { ...p, resources: { ...p.resources, cloth: 0 } }
            : p.id === 'p2'
              ? { ...p, resources: { ...p.resources, cloth: 5 } }
              : p.id === 'p3'
                ? { ...p, resources: { ...p.resources, cloth: 5 } }
                : p,
        ),
      };
      const state_with_card = withProgressCards(state_with_resources, 'p1', ['commodityMonopoly']);

      const before = clothOf(state_with_card, 'p1');
      const result = applyPlayProgress(state_with_card, 'p1', {
        card: 'commodityMonopoly',
        commodity: 'cloth',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(clothOf(result.state, 'p1')).toBe(before + 2); // zwei Mitspieler, je 1 Karte
      }
    });
  });

  describe('Handelsflotte', () => {
    /*
     * Der Kurs wird nicht mehr in einer eigenen Testhilfe nachgebaut - das
     * pruefte nur eine Kopie von `tradeRateFor` und nicht den echten Pfad.
     * Stattdessen laeuft der Tausch ueber `applyTradeWithBank`: dieselbe
     * Funktion, die auch der Reducer fuer die Aktion `tradeWithBank` ruft.
     */
    it('tauscht mit der Flotte zwei zu eins bis Zugende', () => {
      const state = citiesTable();
      const state_with_card = withProgressCards(state, 'p1', ['merchantFleet']);

      const played = applyPlayProgress(state_with_card, 'p1', {
        card: 'merchantFleet',
        sort: 'wool',
      });
      if (!played.ok) {
        expect(played.ok).toBe(true);
        return;
      }
      // Waehrend des Zuges gilt die Flotte
      expect(played.state.fleetSort).toBe('wool');

      const stocked = giving(played.state, 'p1', { wool: 2 });
      const traded = applyTradeWithBank(stocked, 'p1', 'wool', 'ore');
      expect(traded.ok).toBe(true);
      if (traded.ok) {
        expect(woolOf(traded.state, 'p1')).toBe(0);
        expect(oreOf(traded.state, 'p1')).toBe(1);
      }

      // Nach dem Zug ist die Flotte weg - zwei Wolle reichen dann nicht mehr
      const after = giving({ ...played.state, fleetSort: null }, 'p1', { wool: 2 });
      const rejectedTrade = applyTradeWithBank(after, 'p1', 'wool', 'ore');
      expect(rejectedTrade.ok).toBe(false);
      if (!rejectedTrade.ok) {
        expect(rejectedTrade.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
      }
    });
  });
});
