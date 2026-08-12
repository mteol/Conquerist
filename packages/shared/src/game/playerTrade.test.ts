import { describe, expect, it } from 'vitest';

import { RuleViolationCode } from './errors.js';
import { giving, hand, testGame } from './fixtures.js';
import { applyOfferTrade, canOfferAnything, canOfferTrade } from './playerTrade.js';
import { reduce } from './reducer.js';
import type { GameState } from './state.js';

/** p1 ist am Zug und hat die genannten Karten. */
function offerer(resources: Record<string, number>): GameState {
  return giving(testGame(), 'p1', resources);
}

const TWO_LUMBER = hand({ lumber: 2 });
const ONE_ORE = hand({ ore: 1 });

describe('canOfferTrade', () => {
  it('nimmt ein Angebot an, das der Anbieter decken kann', () => {
    expect(canOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE)).toBeNull();
  });

  it('lehnt eine leere Seite ab', () => {
    const state = offerer({ lumber: 3 });

    expect(canOfferTrade(state, 'p1', TWO_LUMBER, hand())?.code).toBe(
      RuleViolationCode.INVALID_TRADE,
    );
    expect(canOfferTrade(state, 'p1', hand(), ONE_ORE)?.code).toBe(RuleViolationCode.INVALID_TRADE);
  });

  it('lehnt dieselbe Sorte auf beiden Seiten ab', () => {
    const state = offerer({ lumber: 3 });

    expect(canOfferTrade(state, 'p1', TWO_LUMBER, hand({ lumber: 1, ore: 1 }))?.code).toBe(
      RuleViolationCode.INVALID_TRADE,
    );
  });

  it('lehnt ab, was der Anbieter nicht hat', () => {
    expect(canOfferTrade(offerer({ lumber: 1 }), 'p1', TWO_LUMBER, ONE_ORE)?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('lehnt ab, wer nicht am Zug ist', () => {
    expect(canOfferTrade(offerer({ lumber: 3 }), 'p2', TWO_LUMBER, ONE_ORE)?.code).toBe(
      RuleViolationCode.NOT_YOUR_TURN,
    );
  });
});

describe('canOfferAnything', () => {
  it('stimmt zu, solange der Spieler am Zug ueberhaupt eine Karte hat', () => {
    expect(canOfferAnything(offerer({ lumber: 1 }), 'p1')).toBe(true);
  });

  it('verneint bei leerer Hand und bei fremdem Zug', () => {
    expect(canOfferAnything(offerer({}), 'p1')).toBe(false);
    expect(canOfferAnything(offerer({ lumber: 3 }), 'p2')).toBe(false);
  });
});

describe('applyOfferTrade', () => {
  it('oeffnet die Phase mit leeren Antworten und einer Frist aus dem Regelwerk', () => {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({
      kind: 'tradePending',
      offer: { from: 'p1', give: TWO_LUMBER, want: ONE_ORE },
      responses: {},
      expiresAt: 1_000 + result.state.rules.tradeOfferMs,
    });
  });

  it('nimmt dem Anbieter nichts weg - getauscht wird erst beim Zuschlag', () => {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.resources.lumber).toBe(3);
  });
});

describe('das offene Angebot sperrt den Zug', () => {
  function withOffer(): GameState {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 0);
    if (!result.ok) throw new Error('Angebot wurde abgelehnt');
    return result.state;
  }

  it('nimmt keinen Zugwechsel an, solange das Angebot liegt', () => {
    const result = reduce(withOffer(), { type: 'endTurn', player: 'p1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('nimmt kein zweites Angebot an', () => {
    const result = reduce(withOffer(), {
      type: 'offerTrade',
      player: 'p1',
      give: TWO_LUMBER,
      want: ONE_ORE,
      at: 0,
    });

    expect(result.ok).toBe(false);
  });
});
