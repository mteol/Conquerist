import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES, RuleSetSchema } from '../rules/index.js';
import { PhaseSchema } from './phase.js';
import { TradeResponseSchema } from './tradeOffer.js';

const offer = {
  from: 'p1',
  give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
  want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
};

describe('TradeResponseSchema', () => {
  it('nimmt Zusage, Ablehnung und Gegenangebot an', () => {
    expect(TradeResponseSchema.parse({ kind: 'accepted' })).toEqual({ kind: 'accepted' });
    expect(TradeResponseSchema.parse({ kind: 'declined', automatic: true })).toEqual({
      kind: 'declined',
      automatic: true,
    });
    expect(
      TradeResponseSchema.parse({ kind: 'countered', give: offer.want, want: offer.give }),
    ).toMatchObject({ kind: 'countered' });
  });

  it('verlangt bei einer Ablehnung die Herkunft', () => {
    expect(TradeResponseSchema.safeParse({ kind: 'declined' }).success).toBe(false);
  });
});

describe('PhaseSchema', () => {
  it('kennt tradePending mit Angebot, Antworten und Frist', () => {
    const phase = {
      kind: 'tradePending',
      offer,
      responses: { p2: { kind: 'declined', automatic: false } },
      expiresAt: 1_700_000_000_000,
    };

    expect(PhaseSchema.parse(phase)).toEqual(phase);
  });
});

describe('RuleSetSchema', () => {
  /*
   * Seit Etappe 6 liegt das RuleSet jeder laufenden Partie als JSON in der
   * Datenbank. Ohne Vorgabe scheiterte jeder gespeicherte Spielstand am neuen
   * Pflichtfeld - und jede laufende Partie waere beim naechsten Start weg.
   */
  it('ergaenzt tradeOfferMs in einem gespeicherten Regelwerk ohne dieses Feld', () => {
    const stored = { ...CLASSIC_RULES } as Record<string, unknown>;
    delete stored.tradeOfferMs;

    expect(RuleSetSchema.parse(stored).tradeOfferMs).toBe(60_000);
  });
});
