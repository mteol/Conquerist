import { describe, expect, it } from 'vitest';

import { CARD_IDS, RESOURCE_IDS } from '../scenario/terrain.js';
import {
  CLASSIC_RULES,
  CLASSIC_RULES_56,
  PIECE_IDS,
  RuleSetSchema,
  cardAmounts,
  pieceCounts,
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

  it('fuehrt genau die fuenf Rohstoffe als Kartensorten', () => {
    expect(CLASSIC_RULES.cards).toEqual([...RESOURCE_IDS]);
    expect(CLASSIC_RULES_56.cards).toEqual([...RESOURCE_IDS]);
  });

  /*
   * Ueber die genannten Preise und nicht ueber `BUILDABLE_IDS`: die Liste
   * kennt seit Staedte & Ritter acht Eintraege, und was ein Tisch davon
   * kennt, sagt sein eigenes `buildCosts`. Was dort fehlt, gibt es hier nicht -
   * genau das prueft der Test darunter.
   */
  it('nennt zu jedem genannten Bauteil vollstaendige Kosten', () => {
    for (const cost of Object.values(CLASSIC_RULES.buildCosts)) {
      expect(Object.keys(cost).sort()).toEqual([...CARD_IDS].sort());
    }
  });

  it('kostet nichts umsonst', () => {
    for (const cost of Object.values(CLASSIC_RULES.buildCosts)) {
      const total = Object.values(cost).reduce((sum, amount) => sum + amount, 0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it('preist nur, was es im Basisspiel gibt', () => {
    expect(Object.keys(CLASSIC_RULES.buildCosts).sort()).toEqual([
      'city',
      'developmentCard',
      'road',
      'settlement',
    ]);
  });

  it('gibt jedem Spieler einen Vorrat an den drei Bauteilen des Basisspiels', () => {
    for (const piece of ['road', 'settlement', 'city'] as const) {
      expect(CLASSIC_RULES.pieceStock[piece]).toBeGreaterThan(0);
    }
  });

  /*
   * Null und nicht "fehlt": ein fehlender Eintrag saehe aus wie ein Versehen,
   * eine Null sagt, dass jemand hingesehen hat. Dieselbe Haltung wie bei den
   * drei Handelswaren in `resourceBank`.
   */
  it('haelt keine Ritter und keine Mauern vor', () => {
    for (const piece of ['wall', 'knight1', 'knight2', 'knight3'] as const) {
      expect(CLASSIC_RULES.pieceStock[piece]).toBe(0);
    }
    expect(PIECE_IDS).toHaveLength(7);
  });

  it('haelt die bekannten Werte des Basisspiels', () => {
    expect(CLASSIC_RULES.victoryPointGoal).toBe(10);
    expect(CLASSIC_RULES.victoryPoints).toEqual({
      settlement: 1,
      city: 2,
      longestRoad: 2,
      largestArmy: 2,
      developmentCard: 1,
      defender: 0,
    });
    expect(CLASSIC_RULES.longestRoadMinimum).toBe(5);
    expect(CLASSIC_RULES.largestArmyMinimum).toBe(3);

    // 25 Karten wie in der Schachtel.
    const deck = CLASSIC_RULES.developmentDeck;
    expect(Object.values(deck).reduce((sum, count) => sum + count, 0)).toBe(25);
    expect(deck.knight).toBe(14);
    expect(CLASSIC_RULES.handLimitBeforeDiscard).toBe(7);
    expect(CLASSIC_RULES.handLimitPerWall).toBe(0);
    expect(CLASSIC_RULES.pieceStock).toEqual(pieceCounts({ road: 15, settlement: 5, city: 4 }));
    expect(CLASSIC_RULES.buildCosts.settlement).toEqual(
      cardAmounts({ brick: 1, lumber: 1, wool: 1, grain: 1 }),
    );
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

  /*
   * Bis zur Erweiterung wurde eine unvollstaendige Kostenzeile abgewiesen. Das
   * geht nicht mehr, und der Grund ist wichtiger als die Regel: seit Etappe 6
   * liegt der Startzustand jeder Partie als JSON in der Datenbank, und die
   * dort abgelegten Mengensaetze kennen die drei Handelswaren nicht. Ein
   * erschoepfendes Schema wiese sie alle ab - beim naechsten Serverstart waere
   * jede laufende Partie weg.
   *
   * Weggelassen heisst deshalb ab jetzt **null**, und `cardAmounts` schreibt es
   * beim Einlesen aus. Was dabei nicht verlorengeht, ist der Schutz vor dem
   * Tippfehler: ein Schluessel, den es nicht gibt, wird weiterhin abgewiesen -
   * und genau das prueft der Test darunter.
   */
  /*
   * Wie `tradeOfferMs` und `dice`: das RuleSet jeder laufenden Partie liegt als
   * JSON in der Datenbank, und keine dort abgelegte Zeile kennt `cards`.
   */
  it('ergaenzt `cards` in einem gespeicherten Regelwerk ohne dieses Feld', () => {
    const stored = rules();
    delete stored['cards'];

    expect(RuleSetSchema.parse(stored).cards).toEqual([...RESOURCE_IDS]);
  });

  it('liest eine ausgelassene Sorte als null', () => {
    const sparsam = rules();
    delete (sparsam['buildCosts'] as Record<string, Record<string, number>>)['road']!['ore'];

    const parsed = RuleSetSchema.parse(sparsam);
    expect(parsed.buildCosts.road).toEqual(cardAmounts({ brick: 1, lumber: 1 }));
  });

  it('lehnt eine Sorte ab, die es nicht gibt', () => {
    const broken = rules();
    (broken['buildCosts'] as Record<string, Record<string, number>>)['road']!['erz'] = 1;

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

  /*
   * Die untere Grenze ist null und nicht mehr eins. Sie musste fallen, weil
   * ein Basistisch keine Ritter und keine Mauern hat und das als Null dasteht.
   * Was bleibt, ist die Abwehr des Unmoeglichen: ein negativer Vorrat.
   */
  it('lehnt einen negativen Bauteilvorrat ab', () => {
    const broken = rules();
    (broken['pieceStock'] as Record<string, number>)['road'] = -1;

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });

  it('lehnt ein Bauteil ab, das es nicht gibt', () => {
    const broken = rules();
    (broken['pieceStock'] as Record<string, number>)['catapult'] = 1;

    expect(RuleSetSchema.safeParse(broken).success).toBe(false);
  });

  it('fuellt einen gespeicherten Vorrat mit den neuen Bauteilen auf', () => {
    const stored = rules();
    stored['pieceStock'] = { road: 15, settlement: 5, city: 4 };

    const parsed = RuleSetSchema.parse(stored);
    expect(parsed.pieceStock).toEqual(pieceCounts({ road: 15, settlement: 5, city: 4 }));
    expect(parsed.pieceStock.knight1).toBe(0);
  });

  it('ergaenzt die Siegpunktwerte und das Mauerlimit gespeicherter Regelwerke', () => {
    const stored = rules();
    delete (stored['victoryPoints'] as Record<string, number>)['defender'];
    delete stored['handLimitPerWall'];

    const parsed = RuleSetSchema.parse(stored);
    expect(parsed.victoryPoints.defender).toBe(0);
    expect(parsed.handLimitPerWall).toBe(0);
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
