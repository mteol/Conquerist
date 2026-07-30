import { describe, expect, it } from 'vitest';

import { RESOURCE_IDS } from '../scenario/terrain.js';
import { BUILDABLE_IDS, CLASSIC_RULES, PIECE_IDS, RuleSetSchema } from './ruleset.js';

/**
 * Kopiert das Basisregelwerk, damit ein Test es gefahrlos verbiegen kann.
 *
 * Ueber JSON und nicht ueber `structuredClone`: `shared` laeuft ohne DOM- und
 * ohne Node-Typen (`types: []` in der tsconfig), und `structuredClone` ist
 * keine Funktion der ES-Standardbibliothek. Fuer reine Daten reicht JSON.
 */
function rules(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(CLASSIC_RULES)) as Record<string, unknown>;
}

describe('CLASSIC_RULES', () => {
  it('besteht das eigene Schema', () => {
    expect(RuleSetSchema.safeParse(CLASSIC_RULES).success).toBe(true);
  });

  it('nennt zu jedem Bauteil vollstaendige Kosten', () => {
    for (const buildable of BUILDABLE_IDS) {
      const cost = CLASSIC_RULES.buildCosts[buildable];
      expect(Object.keys(cost).sort()).toEqual([...RESOURCE_IDS].sort());
    }
  });

  it('kostet nichts umsonst', () => {
    for (const buildable of BUILDABLE_IDS) {
      const total = Object.values(CLASSIC_RULES.buildCosts[buildable]).reduce(
        (sum, amount) => sum + amount,
        0,
      );
      expect(total).toBeGreaterThan(0);
    }
  });

  it('gibt jedem Spieler einen Vorrat an jedem Bauteil', () => {
    for (const piece of PIECE_IDS) {
      expect(CLASSIC_RULES.pieceStock[piece]).toBeGreaterThan(0);
    }
  });

  it('haelt die bekannten Werte des Basisspiels', () => {
    expect(CLASSIC_RULES.victoryPointGoal).toBe(10);
    expect(CLASSIC_RULES.handLimitBeforeDiscard).toBe(7);
    expect(CLASSIC_RULES.pieceStock).toEqual({ road: 15, settlement: 5, city: 4 });
    expect(CLASSIC_RULES.buildCosts.settlement).toEqual({
      brick: 1,
      lumber: 1,
      wool: 1,
      grain: 1,
      ore: 0,
    });
  });
});

describe('RuleSetSchema', () => {
  it('lehnt negative Kosten ab', () => {
    const broken = rules();
    (broken['buildCosts'] as Record<string, Record<string, number>>)['road']!['brick'] = -1;

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });

  it('lehnt gebrochene Kosten ab', () => {
    const broken = rules();
    (broken['buildCosts'] as Record<string, Record<string, number>>)['road']!['brick'] = 1.5;

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });

  it('lehnt eine unbekannte Ressource ab', () => {
    const broken = rules();
    (broken['buildCosts'] as Record<string, Record<string, number>>)['road']!['gold'] = 1;

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });

  it('lehnt unvollstaendige Kosten ab', () => {
    const broken = rules();
    delete (broken['buildCosts'] as Record<string, Record<string, number>>)['road']!['ore'];

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });

  it('lehnt ein unbekanntes Bauteil ab', () => {
    const broken = rules();
    (broken['buildCosts'] as Record<string, unknown>)['castle'] = {
      brick: 1,
      lumber: 0,
      wool: 0,
      grain: 0,
      ore: 0,
    };

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });

  it('lehnt ein Siegpunktziel ab, das kein Spiel beendet', () => {
    for (const goal of [0, 1, -5, 3.5]) {
      expect(RuleSetSchema.safeParse({ ...rules(), victoryPointGoal: goal }).success).toBe(false);
    }
  });

  it('lehnt ein Handkartenlimit unter eins ab', () => {
    expect(RuleSetSchema.safeParse({ ...rules(), handLimitBeforeDiscard: 0 }).success).toBe(false);
  });

  it('lehnt einen leeren Bauteilvorrat ab', () => {
    const broken = rules();
    (broken['pieceStock'] as Record<string, number>)['road'] = 0;

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });

  it('lehnt eine leere Bank ab', () => {
    const broken = rules();
    (broken['resourceBank'] as Record<string, number>)['ore'] = -1;

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });
});
