import { describe, expect, it } from 'vitest';

import { RuleViolationCode } from './errors.js';
import { giving, hand, testGame } from './fixtures.js';
import {
  applyOfferTrade,
  applyRespondTrade,
  awaitsResponse,
  canOfferAnything,
  canOfferTrade,
  canRespondTrade,
} from './playerTrade.js';
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

/** Ein offenes Angebot: p1 bietet 2 Holz fuer 1 Erz, p2 und p3 koennen zahlen. */
function tableWithOffer(): GameState {
  const rich = giving(giving(offerer({ lumber: 3 }), 'p2', { ore: 2 }), 'p3', { ore: 2 });
  const result = applyOfferTrade(rich, 'p1', TWO_LUMBER, ONE_ORE, 0);
  if (!result.ok) throw new Error('Angebot wurde abgelehnt');
  return result.state;
}

describe('canRespondTrade', () => {
  it('laesst einen Mitspieler zusagen, der zahlen kann', () => {
    expect(canRespondTrade(tableWithOffer(), 'p2', 'accepted')).toBeNull();
  });

  it('laesst jeden ablehnen, auch ohne die verlangten Karten', () => {
    const poor = giving(tableWithOffer(), 'p2', {});

    expect(canRespondTrade(poor, 'p2', 'declined')).toBeNull();
  });

  it('sperrt die Zusage dessen, der nicht zahlen kann', () => {
    const poor = giving(tableWithOffer(), 'p2', {});

    expect(canRespondTrade(poor, 'p2', 'accepted')?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('laesst den Anbieter nicht auf sein eigenes Angebot antworten', () => {
    expect(canRespondTrade(tableWithOffer(), 'p1', 'accepted')?.code).toBe(
      RuleViolationCode.NOT_THE_OFFERER,
    );
  });

  it('nimmt keine zweite Antwort an', () => {
    const once = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!once.ok) throw new Error('erste Antwort wurde abgelehnt');

    expect(canRespondTrade(once.state, 'p2', 'accepted')?.code).toBe(
      RuleViolationCode.ALREADY_RESPONDED,
    );
  });
});

describe('das Angebot verfaellt, wenn alle von Hand ablehnen', () => {
  it('bleibt offen, solange noch jemand ueberlegt', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');

    expect(first.state.phase.kind).toBe('tradePending');
  });

  it('geht zurueck in die Hauptphase, sobald der letzte ablehnt', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');
    const second = applyRespondTrade(first.state, 'p3', 'declined');
    if (!second.ok) throw new Error('Antwort wurde abgelehnt');

    expect(second.state.phase).toEqual({ kind: 'main' });
  });

  it('bleibt offen, wenn jemand zugesagt hat', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');
    const second = applyRespondTrade(first.state, 'p3', 'declined');
    if (!second.ok) throw new Error('Antwort wurde abgelehnt');

    expect(second.state.phase.kind).toBe('tradePending');
  });
});

describe('awaitsResponse', () => {
  it('gilt fuer Mitspieler ohne Antwort und fuer den Anbieter nie', () => {
    const state = tableWithOffer();

    expect(awaitsResponse(state, 'p2')).toBe(true);
    expect(awaitsResponse(state, 'p1')).toBe(false);
  });
});
