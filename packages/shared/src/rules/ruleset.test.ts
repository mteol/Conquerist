import { describe, expect, it } from 'vitest';

import { RESOURCE_IDS } from '../scenario/terrain.js';
import {
  BUILDABLE_IDS,
  CLASSIC_RULES,
  CLASSIC_RULES_56,
  PIECE_IDS,
  RuleSetSchema,
  rulesFor,
} from './ruleset.js';

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
    expect(CLASSIC_RULES.victoryPoints).toEqual({
      settlement: 1,
      city: 2,
      longestRoad: 2,
      largestArmy: 2,
      developmentCard: 1,
    });
    expect(CLASSIC_RULES.longestRoadMinimum).toBe(5);
    expect(CLASSIC_RULES.largestArmyMinimum).toBe(3);

    // 25 Karten wie in der Schachtel.
    const deck = CLASSIC_RULES.developmentDeck;
    expect(Object.values(deck).reduce((sum, count) => sum + count, 0)).toBe(25);
    expect(deck.knight).toBe(14);
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

  it('lehnt eine Laengste Strasse ab null Strassen ab', () => {
    expect(RuleSetSchema.safeParse({ ...rules(), longestRoadMinimum: 0 }).success).toBe(false);
  });

  it('lehnt unvollstaendige Siegpunktwerte ab', () => {
    const broken = rules();
    delete (broken['victoryPoints'] as Record<string, number>)['city'];
    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
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

/**
 * Das Regelwerk der Fuenf- und Sechserpartie.
 *
 * Die Erweiterung aendert am Spiel genau zwei Zahlenreihen: den Bankvorrat und
 * den Entwicklungsstapel. Alles andere gleich zu lassen ist keine Sparsamkeit,
 * sondern die Regel - wer am grossen Tisch billiger baute, spielte ein anderes
 * Spiel. Der letzte Test hier bewacht genau das.
 */
describe('CLASSIC_RULES_56', () => {
  it('besteht das eigene Schema', () => {
    expect(RuleSetSchema.safeParse(CLASSIC_RULES_56).success).toBe(true);
  });

  it('haelt 24 Karten je Rohstoff vor', () => {
    for (const resource of RESOURCE_IDS) {
      expect(CLASSIC_RULES_56.resourceBank[resource]).toBe(24);
    }
  });

  it('traegt 34 Entwicklungskarten', () => {
    const total = Object.values(CLASSIC_RULES_56.developmentDeck).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(total).toBe(34);
    expect(CLASSIC_RULES_56.developmentDeck.knight).toBe(20);
  });

  it('weicht vom Basisregelwerk nur in Vorrat und Stapel ab', () => {
    const base = { ...CLASSIC_RULES, resourceBank: null, developmentDeck: null };
    const large = { ...CLASSIC_RULES_56, resourceBank: null, developmentDeck: null };
    expect(large).toEqual(base);
  });
});

describe('rulesFor', () => {
  it('gibt kleinen Tischen das Basisregelwerk', () => {
    expect(rulesFor(3)).toBe(CLASSIC_RULES);
    expect(rulesFor(4)).toBe(CLASSIC_RULES);
  });

  it('gibt grossen Tischen den groesseren Vorrat', () => {
    expect(rulesFor(5)).toBe(CLASSIC_RULES_56);
    expect(rulesFor(6)).toBe(CLASSIC_RULES_56);
  });
});
