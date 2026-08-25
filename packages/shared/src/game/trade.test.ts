import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES } from '../rules/index.js';
import { CARD_IDS } from '../scenario/index.js';
import { RuleViolationCode } from './errors.js';
import {
  CENTER_VERTEX,
  HARBOR2_ORE_VERTEX,
  HARBOR3_VERTEX,
  giving,
  hand,
  testGame,
} from './fixtures.js';
import { applyTradeWithBank, tradeRateFor } from './trade.js';
import type { GameState } from './state.js';

function resourcesOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!.resources;
}

/** p1 siedelt an dem angegebenen Knoten und hat die genannten Karten. */
function trader(vertex: string | null, resources: Record<string, number>): GameState {
  const buildings =
    vertex === null ? {} : { [vertex]: { owner: 'p1' as const, kind: 'settlement' as const } };
  return giving(testGame({ buildings }), 'p1', resources);
}

describe('tradeRateFor', () => {
  it('verlangt ohne Hafen vier Karten', () => {
    expect(tradeRateFor(trader(null, {}), 'p1', 'ore')).toBe(4);
  });

  it('verlangt am 3:1-Hafen drei Karten - fuer jede Ressource', () => {
    const state = trader(HARBOR3_VERTEX, {});

    expect(tradeRateFor(state, 'p1', 'ore')).toBe(3);
    expect(tradeRateFor(state, 'p1', 'wool')).toBe(3);
  });

  it('verlangt am 2:1-Hafen zwei Karten - nur fuer seine Ressource', () => {
    const state = trader(HARBOR2_ORE_VERTEX, {});

    expect(tradeRateFor(state, 'p1', 'ore')).toBe(2);
    expect(tradeRateFor(state, 'p1', 'wool')).toBe(4);
  });

  it('nimmt bei mehreren Haefen den besten Kurs', () => {
    const state = giving(
      testGame({
        buildings: {
          [HARBOR3_VERTEX]: { owner: 'p1', kind: 'settlement' },
          [HARBOR2_ORE_VERTEX]: { owner: 'p1', kind: 'city' },
        },
      }),
      'p1',
      {},
    );

    expect(tradeRateFor(state, 'p1', 'ore')).toBe(2);
    expect(tradeRateFor(state, 'p1', 'wool')).toBe(3);
  });

  it('gilt auch fuer eine Stadt am Hafen', () => {
    const state = giving(
      testGame({ buildings: { [HARBOR3_VERTEX]: { owner: 'p1', kind: 'city' } } }),
      'p1',
      {},
    );

    expect(tradeRateFor(state, 'p1', 'grain')).toBe(3);
  });

  it('nuetzt der fremde Hafen nichts', () => {
    const state = giving(
      testGame({ buildings: { [HARBOR3_VERTEX]: { owner: 'p2', kind: 'settlement' } } }),
      'p1',
      {},
    );

    expect(tradeRateFor(state, 'p1', 'ore')).toBe(4);
  });

  it('nuetzt eine Siedlung im Binnenland nichts', () => {
    expect(tradeRateFor(trader(CENTER_VERTEX, {}), 'p1', 'ore')).toBe(4);
  });
});

describe('applyTradeWithBank', () => {
  it('tauscht vier gegen eins und verrechnet die Bank', () => {
    const before = trader(null, { ore: 4 });
    const result = applyTradeWithBank(before, 'p1', 'ore', 'brick');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(resourcesOf(result.state, 'p1')).toEqual(hand({ brick: 1 }));
      expect(result.state.bank.ore).toBe(before.bank.ore + 4);
      expect(result.state.bank.brick).toBe(before.bank.brick - 1);
    }
  });

  it('nimmt am Hafen nur zwei Karten', () => {
    const result = applyTradeWithBank(trader(HARBOR2_ORE_VERTEX, { ore: 2 }), 'p1', 'ore', 'wool');

    expect(result.ok).toBe(true);
    if (result.ok) expect(resourcesOf(result.state, 'p1')).toEqual(hand({ wool: 1 }));
  });

  it('lehnt ab, wenn die Karten nicht fuer den Kurs reichen', () => {
    const result = applyTradeWithBank(trader(null, { ore: 3 }), 'p1', 'ore', 'brick');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('lehnt den Tausch einer Ressource gegen sich selbst ab', () => {
    const result = applyTradeWithBank(trader(null, { ore: 8 }), 'p1', 'ore', 'ore');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.INVALID_TRADE);
  });

  it('lehnt ab, wenn die Bank die gewuenschte Ressource nicht mehr hat', () => {
    const state = giving(testGame({ bank: hand({ ore: 19 }) }), 'p1', { ore: 4 });
    const result = applyTradeWithBank(state, 'p1', 'ore', 'brick');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.BANK_EMPTY);
  });

  it('laesst den Kurs nicht vom Client bestimmen', () => {
    // Es gibt keine Moeglichkeit, ein Verhaeltnis mitzuschicken: der Kurs folgt
    // ausschliesslich aus den Haefen, an denen der Spieler tatsaechlich siedelt.
    const cheap = trader(HARBOR2_ORE_VERTEX, { wool: 2 });
    const result = applyTradeWithBank(cheap, 'p1', 'wool', 'ore');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });
});

/**
 * Handelswaren gehen ueber denselben Tisch wie Rohstoffe - mit genau einer
 * Ausnahme, und die ist ein Weglassen: es gibt keinen 2:1-Hafen fuer sie.
 */
describe('Handel mit Handelswaren', () => {
  /** Ein Tisch, an dem alle acht Sorten im Spiel sind. */
  function citiesTable(vertex: string | null, cards: Record<string, number>): GameState {
    const buildings =
      vertex === null ? {} : { [vertex]: { owner: 'p1' as const, kind: 'settlement' as const } };

    return giving(
      testGame({
        buildings,
        rules: { ...CLASSIC_RULES, cards: [...CARD_IDS] },
        bank: hand({ brick: 19, lumber: 19, wool: 19, grain: 19, ore: 19, paper: 12, coin: 12 }),
      }),
      'p1',
      cards,
    );
  }

  it('verlangt ohne Hafen vier gleiche Handelswaren', () => {
    expect(tradeRateFor(citiesTable(null, {}), 'p1', 'paper')).toBe(4);
  });

  it('nimmt den 3:1-Hafen auch fuer Handelswaren', () => {
    expect(tradeRateFor(citiesTable(HARBOR3_VERTEX, {}), 'p1', 'coin')).toBe(3);
  });

  /*
   * Ein 2:1-Hafen gehoert seinem Rohstoff. Es gibt keinen Papierhafen, und ein
   * Erzhafen macht Muenzen nicht billiger - obwohl beide vom Gebirge kommen.
   */
  it('gibt den 2:1-Rohstoffhafen nicht an seine Handelsware weiter', () => {
    const state = citiesTable(HARBOR2_ORE_VERTEX, {});

    expect(tradeRateFor(state, 'p1', 'ore')).toBe(2);
    expect(tradeRateFor(state, 'p1', 'coin')).toBe(4);
  });

  it('tauscht vier Papier gegen einen Lehm', () => {
    const result = applyTradeWithBank(citiesTable(null, { paper: 4 }), 'p1', 'paper', 'brick');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(resourcesOf(result.state, 'p1').paper).toBe(0);
      expect(resourcesOf(result.state, 'p1').brick).toBe(1);
    }
  });

  it('tauscht auch in die andere Richtung - vier Erz gegen ein Papier', () => {
    const result = applyTradeWithBank(citiesTable(null, { ore: 4 }), 'p1', 'ore', 'paper');

    expect(result.ok).toBe(true);
    if (result.ok) expect(resourcesOf(result.state, 'p1').paper).toBe(1);
  });

  /* Beim Tausch mit dem Vorrat muessen die abgegebenen Karten dieselbe Sorte sein. */
  it('laesst zwei Papier und zwei Tuch nicht zu einem Tausch zusammenlegen', () => {
    const result = applyTradeWithBank(
      citiesTable(null, { paper: 2, cloth: 2 }),
      'p1',
      'paper',
      'brick',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });
});
