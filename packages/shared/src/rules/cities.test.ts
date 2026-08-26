import { describe, expect, it } from 'vitest';

import { CARD_IDS } from '../scenario/terrain.js';
import { CITIES_DICE, CITIES_RULES, CITIES_RULES_56, citiesRulesFor } from './cities.js';
import { CLASSIC_RULES, RuleSetSchema, cardAmounts } from './ruleset.js';

describe('CITIES_RULES', () => {
  it('besteht das eigene Schema', () => {
    expect(RuleSetSchema.safeParse(CITIES_RULES).success).toBe(true);
  });

  it('spielt auf 13 Siegpunkte', () => {
    expect(CITIES_RULES.victoryPointGoal).toBe(13);
  });

  it('fuehrt alle acht Kartensorten', () => {
    expect(CITIES_RULES.cards).toEqual([...CARD_IDS]);
  });

  /*
   * Beides faellt in dieser Erweiterung weg. Der Preis fehlt, statt null zu
   * sein - "kostenlos" waere die falsche Auskunft ueber etwas, das es nicht
   * gibt -, und der leere Stapel weist den Kauf ein zweites Mal ab.
   */
  it('kennt keine Entwicklungskarten', () => {
    expect(CITIES_RULES.buildCosts.developmentCard).toBeUndefined();
    expect(CITIES_RULES.developmentDeck).toEqual({});
    expect(CITIES_RULES.victoryPoints.developmentCard).toBe(0);
  });

  it('vergibt keine Groesste Rittermacht', () => {
    expect(CITIES_RULES.victoryPoints.largestArmy).toBe(0);
  });

  it('haelt die Handelswaren in der Bank vor', () => {
    expect(CITIES_RULES.resourceBank.paper).toBe(12);
    expect(CITIES_RULES.resourceBank.cloth).toBe(12);
    expect(CITIES_RULES.resourceBank.coin).toBe(12);
  });

  it('faehrt ueber sieben Felder', () => {
    expect(CITIES_RULES.barbarianTrack).toBe(7);
  });

  it('preist Mauer, Ritter, Aufwertung und Helm', () => {
    expect(CITIES_RULES.buildCosts.wall).toEqual(cardAmounts({ brick: 2 }));
    expect(CITIES_RULES.buildCosts.knight).toEqual(cardAmounts({ wool: 1, ore: 1 }));
    expect(CITIES_RULES.buildCosts.knightUpgrade).toEqual(cardAmounts({ wool: 1, ore: 1 }));
    expect(CITIES_RULES.buildCosts.knightActivation).toEqual(cardAmounts({ grain: 1 }));
  });

  /*
   * Zwei je Stufe und nicht sechs insgesamt: genau deshalb hat jede Stufe
   * einen eigenen Vorrat. Wer zwei Starke Ritter stehen hat, kann keinen
   * dritten aufwerten - ein einziger Zaehler koennte das nicht sagen.
   */
  it('gibt jeder Person sechs Ritter, zwei je Stufe, und drei Mauern', () => {
    expect(CITIES_RULES.pieceStock.knight1).toBe(2);
    expect(CITIES_RULES.pieceStock.knight2).toBe(2);
    expect(CITIES_RULES.pieceStock.knight3).toBe(2);
    expect(CITIES_RULES.pieceStock.wall).toBe(3);
  });

  it('hebt das Handkartenlimit je Mauer um zwei und zahlt den Retter-Chip', () => {
    expect(CITIES_RULES.handLimitBeforeDiscard).toBe(7);
    expect(CITIES_RULES.handLimitPerWall).toBe(2);
    expect(CITIES_RULES.victoryPoints.defender).toBe(1);
  });
});

describe('CITIES_DICE', () => {
  it('wuerfelt mit dreien, von denen einer nicht mitzaehlt', () => {
    expect(CITIES_DICE).toHaveLength(3);
    expect(CITIES_DICE.filter((die) => die.countsTowardYield)).toHaveLength(2);
  });

  it('laesst den Ereigniswuerfel Symbole zeigen statt Augen', () => {
    expect(CITIES_DICE[2]).toMatchObject({ id: 'event', render: 'event' });
    expect(CITIES_DICE[0]?.render).toBe('pips');
  });

  /*
   * Der rote Wuerfel heisst weiter `second`. Eine dritte Id machte jeden
   * gespeicherten Wurf unlesbar - rot ist eine Farbe auf dem Tisch, keine
   * Eigenschaft der Ziehung.
   */
  it('behaelt die Ids der beiden Augenwuerfel', () => {
    expect(CITIES_DICE.map((die) => die.id)).toEqual(['first', 'second', 'event']);
  });
});

describe('CITIES_RULES_56', () => {
  /*
   * Die 5-6-Ergaenzung bringt 12 Ritter, 12 Helme und 6 Mauern - fuer ZWEI
   * zusaetzliche Personen. Je Person bleibt es bei sechs Rittern und drei
   * Mauern, und `pieceStock` ist je Person gezaehlt. Zusaetzliche
   * Fortschrittskarten bringt sie ausdruecklich keine. Es weichen genau zwei
   * Dinge ab, und dieser Test bewacht das - dieselbe Bauform, die
   * `CLASSIC_RULES_56` schon hat.
   */
  it('weicht nur im Kartenvorrat und in der Zugweitergabe ab', () => {
    const { resourceBank: bankGross, castleTurns: burgenGross, ...restGross } = CITIES_RULES_56;
    const { resourceBank: bankKlein, castleTurns: burgenKlein, ...restKlein } = CITIES_RULES;

    expect(restGross).toEqual(restKlein);
    expect(burgenGross).toBe(true);
    expect(burgenKlein).toBe(false);
    expect(bankGross.paper).toBe(18);
    expect(bankKlein.paper).toBe(12);
    expect(bankGross.brick).toBe(24);
  });

  it('gilt ab fuenf Personen', () => {
    expect(citiesRulesFor(3)).toBe(CITIES_RULES);
    expect(citiesRulesFor(4)).toBe(CITIES_RULES);
    expect(citiesRulesFor(5)).toBe(CITIES_RULES_56);
    expect(citiesRulesFor(6)).toBe(CITIES_RULES_56);
  });
});

it('zaehlt eine Metropole mit zwei Punkten ueber der Stadt', () => {
  expect(CITIES_RULES.victoryPoints.metropolis).toBe(2);
});

it('kennt an einem Basistisch keine Metropolen', () => {
  expect(CLASSIC_RULES.victoryPoints.metropolis).toBe(0);
});
