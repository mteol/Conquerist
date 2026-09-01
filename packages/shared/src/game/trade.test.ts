import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES } from '../rules/index.js';
import { CARD_IDS } from '../scenario/index.js';
import { RuleViolationCode } from './errors.js';
import {
  CENTER_VERTEX,
  HARBOR2_ORE_VERTEX,
  HARBOR3_VERTEX,
  gameWithCities,
  giving,
  hand,
  testGame,
} from './fixtures.js';
import { applyTradeWithBank, tradeRateFor } from './trade.js';
import type { GameState } from './state.js';

function resourcesOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!.resources;
}

/** Dieselbe Partie, aber mit der Gilde (Handel Stufe 3) beim genannten Spieler. */
function withGuild(state: GameState, id: string): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, improvements: { ...player.improvements, trade: 3 } } : player,
    ),
  };
}

/** p1 siedelt an dem angegebenen Knoten und hat die genannten Karten. */
function trader(vertex: string | null, resources: Record<string, number>): GameState {
  const buildings =
    vertex === null
      ? {}
      : {
          [vertex]: {
            owner: 'p1' as const,
            kind: 'settlement' as const,
            wall: false,
            metropolis: null,
          },
        };
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
          [HARBOR3_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
          [HARBOR2_ORE_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
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
      testGame({
        buildings: {
          [HARBOR3_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        },
      }),
      'p1',
      {},
    );

    expect(tradeRateFor(state, 'p1', 'grain')).toBe(3);
  });

  it('nuetzt der fremde Hafen nichts', () => {
    const state = giving(
      testGame({
        buildings: {
          [HARBOR3_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
        },
      }),
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
      vertex === null
        ? {}
        : {
            [vertex]: {
              owner: 'p1' as const,
              kind: 'settlement' as const,
              wall: false,
              metropolis: null,
            },
          };

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

describe('Die Gilde', () => {
  it('tauscht Handelswaren 2:1', () => {
    const state = withGuild(gameWithCities(), 'p1');
    expect(tradeRateFor(state, 'p1', 'cloth')).toBe(2);
  });

  it('laesst den Kurs fuer Rohstoffe unberuehrt', () => {
    const state = withGuild(gameWithCities(), 'p1');
    expect(tradeRateFor(state, 'p1', 'brick')).toBe(4);
  });

  it('gilt nur fuer den, der sie gebaut hat', () => {
    const state = withGuild(gameWithCities(), 'p1');
    expect(tradeRateFor(state, 'p2', 'cloth')).toBe(4);
  });

  it('schlaegt einen 3:1-Hafen', () => {
    // p1 baut diesmal am 3:1-Hafen und nicht auf `CENTER_VERTEX` - der liegt
    // an keinem Hafen der Fixture, und ohne Hafen im Spiel wuerde dieser Test
    // nur denselben Messvorgang wie oben unter falschem Namen wiederholen.
    const atHarbor = gameWithCities({
      buildings: {
        [HARBOR3_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });

    // Erst ohne Gilde belegen, dass der Hafen wirklich greift ...
    expect(tradeRateFor(atHarbor, 'p1', 'paper')).toBe(3);

    // ... dann mit Gilde: sie schlaegt den 3:1-Hafen.
    const state = withGuild(atHarbor, 'p1');
    expect(tradeRateFor(state, 'p1', 'paper')).toBe(2);

    // Dass die Gilde einen *besseren* 2:1-Hafen nicht schlagen wuerde, ist in
    // diesem Spiel nicht zu messen: es gibt hier keinen 2:1-Hafen fuer eine
    // Handelsware (nur den Erzhafen bei `HARBOR2_ORE_VERTEX`, und der zaehlt
    // ausschliesslich fuer Erz). Das garantiert stattdessen die `Math.min`-
    // Logik in `tradeRateFor` selbst - dieselbe, die zwischen zwei Haefen
    // entscheidet.
  });
});

/*
 * Die Handelsflotte und der Haendler laufen durch dieselbe Funktion wie
 * Haefen und Gilde - `tradeRateFor` kennt keine zweite Fassung mehr, die nur
 * fuer Tests nachgebaut waere. Jeder Test hier prueft deshalb zusaetzlich zum
 * Kurs auch den echten Tausch ueber `applyTradeWithBank`: ein Kurs, der nie
 * am echten Bankgeschaeft ankommt, sichert nichts zu.
 */
describe('Die Handelsflotte', () => {
  it('senkt den Kurs der genannten Sorte auf zwei, bis Zugende', () => {
    const state = testGame({ fleetSort: 'wool' });

    expect(tradeRateFor(state, 'p1', 'wool')).toBe(2);
    // Jede andere Sorte bleibt beim Standardkurs.
    expect(tradeRateFor(state, 'p1', 'grain')).toBe(4);
  });

  it('gilt zusaetzlich zum besten Hafen, nicht anstelle davon', () => {
    const state = testGame({
      fleetSort: 'ore',
      buildings: {
        [HARBOR3_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });

    // Ohne Flotte gaebe der 3:1-Hafen nur drei - die Flotte schlaegt ihn.
    expect(tradeRateFor(state, 'p1', 'ore')).toBe(2);
    // Eine Sorte, die die Flotte nicht nennt, bleibt beim Hafenkurs.
    expect(tradeRateFor(state, 'p1', 'wool')).toBe(3);
  });

  it('tauscht ueber applyTradeWithBank tatsaechlich zwei zu eins', () => {
    const state = giving(testGame({ fleetSort: 'wool' }), 'p1', { wool: 2 });
    const result = applyTradeWithBank(state, 'p1', 'wool', 'ore');

    expect(result.ok).toBe(true);
    if (result.ok) expect(resourcesOf(result.state, 'p1')).toEqual(hand({ ore: 1 }));
  });

  it('reicht nach Zugende nicht mehr - `endTurn` raeumt `fleetSort` ab', () => {
    // `fleetSort: null` steht hier fuer den Zustand nach `endTurn` (siehe
    // `reducer.ts`) und nicht fuer einen eigenen Aufruf des Reducers - der
    // Abbau selbst ist nicht Gegenstand dieses Tests.
    const state = giving(testGame({ fleetSort: null }), 'p1', { wool: 2 });
    const result = applyTradeWithBank(state, 'p1', 'wool', 'ore');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });
});

describe('Der Haendler', () => {
  /** Der Haendler auf dem Wald `0,1` aus `TEST_SCENARIO` - Rohstoff Holz. */
  function withMerchant(state: GameState, owner: string): GameState {
    return { ...state, merchant: { hex: '0,1', owner } };
  }

  it('gibt seinem Besitzer zwei zu eins auf den Rohstoff seines Feldes', () => {
    const state = withMerchant(testGame(), 'p1');

    expect(tradeRateFor(state, 'p1', 'lumber')).toBe(2);
    // Eine andere Sorte bleibt beim Standardkurs.
    expect(tradeRateFor(state, 'p1', 'ore')).toBe(4);
  });

  it('nuetzt nur seinem aktuellen Besitzer', () => {
    const state = withMerchant(testGame(), 'p2');

    expect(tradeRateFor(state, 'p1', 'lumber')).toBe(4);
  });

  it('tauscht ueber applyTradeWithBank tatsaechlich zwei zu eins', () => {
    const state = giving(withMerchant(testGame(), 'p1'), 'p1', { lumber: 2 });
    const result = applyTradeWithBank(state, 'p1', 'lumber', 'brick');

    expect(result.ok).toBe(true);
    if (result.ok) expect(resourcesOf(result.state, 'p1')).toEqual(hand({ brick: 1 }));
  });
});
