import { describe, expect, it } from 'vitest';

import { ResourceAmountsSchema, type ResourceAmounts } from '../rules/ruleset.js';
import {
  EMPTY_RESOURCES,
  addResources,
  canAfford,
  countResources,
  resourceAt,
  scaleResources,
  subtractResources,
} from './resources.js';

/**
 * Eine Menge aus dem, was genannt wird - alles andere ist null.
 *
 * Seit die Hand acht Sorten kennt, waere jede Aufzaehlung im Test acht Zeilen
 * lang, von denen sechs nichts aussagen. Der Helfer haelt den Blick auf dem,
 * worum es in der jeweiligen Zeile geht.
 */
function hand(part: Partial<ResourceAmounts>): ResourceAmounts {
  return { ...EMPTY_RESOURCES, ...part };
}

const HAND = hand({ brick: 2, wool: 1, grain: 3 });

describe('EMPTY_RESOURCES', () => {
  it('nennt jede Kartensorte mit null', () => {
    expect(EMPTY_RESOURCES).toEqual({
      brick: 0,
      lumber: 0,
      wool: 0,
      grain: 0,
      ore: 0,
      paper: 0,
      cloth: 0,
      coin: 0,
    });
  });

  it('laesst sich nicht versehentlich veraendern', () => {
    const changed = addResources(EMPTY_RESOURCES, hand({ ore: 1 }));

    expect(changed.ore).toBe(1);
    expect(EMPTY_RESOURCES.ore).toBe(0);
  });
});

describe('countResources', () => {
  it('zaehlt alle Karten der Hand', () => {
    expect(countResources(HAND)).toBe(6);
  });

  it('zaehlt Handelswaren mit - sie liegen auf derselben Hand', () => {
    expect(countResources(hand({ brick: 2, paper: 1, coin: 3 }))).toBe(6);
  });

  it('zaehlt die leere Hand als null', () => {
    expect(countResources(EMPTY_RESOURCES)).toBe(0);
  });
});

describe('addResources', () => {
  it('addiert komponentenweise', () => {
    expect(addResources(HAND, hand({ brick: 1, lumber: 4, ore: 2 }))).toEqual(
      hand({ brick: 3, lumber: 4, wool: 1, grain: 3, ore: 2 }),
    );
  });

  it('laesst beide Eingaben unangetastet', () => {
    const before = { ...HAND };
    addResources(HAND, HAND);

    expect(HAND).toEqual(before);
  });
});

describe('subtractResources', () => {
  it('zieht komponentenweise ab', () => {
    expect(subtractResources(HAND, hand({ brick: 1, wool: 1 }))).toEqual(
      hand({ brick: 1, grain: 3 }),
    );
  });

  it('wirft, statt ins Minus zu laufen', () => {
    // Ein negativer Bestand waere ein stiller Regelfehler, der erst Runden
    // spaeter auffiele. Aufrufer pruefen vorher mit canAfford.
    expect(() => subtractResources(HAND, hand({ ore: 1 }))).toThrow(RangeError);
  });
});

describe('scaleResources', () => {
  it('vervielfacht komponentenweise', () => {
    expect(scaleResources(HAND, 2)).toEqual(hand({ brick: 4, wool: 2, grain: 6 }));
  });
});

describe('canAfford', () => {
  it('erkennt genau ausreichende Mittel', () => {
    expect(canAfford(HAND, hand({ brick: 2, wool: 1, grain: 3 }))).toBe(true);
  });

  it('erkennt fehlende Mittel', () => {
    expect(canAfford(HAND, hand({ ore: 1 }))).toBe(false);
  });

  it('haelt die leere Kosten immer fuer bezahlbar', () => {
    expect(canAfford(EMPTY_RESOURCES, EMPTY_RESOURCES)).toBe(true);
  });
});

describe('resourceAt', () => {
  it('zaehlt die Hand in fester Reihenfolge durch', () => {
    // Ein Griff in eine fremde Hand ist ein Ziehen aus einem Stapel: die
    // Handkarten werden durchnummeriert, der Zufall liefert den Index.
    expect(resourceAt(HAND, 0)).toBe('brick');
    expect(resourceAt(HAND, 1)).toBe('brick');
    expect(resourceAt(HAND, 2)).toBe('wool');
    expect(resourceAt(HAND, 3)).toBe('grain');
    expect(resourceAt(HAND, 5)).toBe('grain');
  });

  /*
   * Die Handelswaren haengen hinten an. Das ist der Grund, warum derselbe Seed
   * in einer Basispartie weiterhin dieselbe Karte zieht wie vor der
   * Erweiterung: an den Nummern der Rohstoffe hat sich nichts verschoben.
   */
  it('zaehlt Handelswaren hinter den Rohstoffen', () => {
    const gemischt = hand({ brick: 1, ore: 1, paper: 1, coin: 1 });

    expect(resourceAt(gemischt, 0)).toBe('brick');
    expect(resourceAt(gemischt, 1)).toBe('ore');
    expect(resourceAt(gemischt, 2)).toBe('paper');
    expect(resourceAt(gemischt, 3)).toBe('coin');
  });

  it('trifft jede vorhandene Karte genau einmal', () => {
    const drawn = [0, 1, 2, 3, 4, 5].map((index) => resourceAt(HAND, index));
    const counted = drawn.reduce<Record<string, number>>((acc, resource) => {
      acc[resource] = (acc[resource] ?? 0) + 1;
      return acc;
    }, {});

    expect(counted).toEqual({ brick: 2, wool: 1, grain: 3 });
  });

  it('lehnt einen Index ausserhalb der Hand ab', () => {
    expect(() => resourceAt(HAND, 6)).toThrow(RangeError);
    expect(() => resourceAt(HAND, -1)).toThrow(RangeError);
    expect(() => resourceAt(EMPTY_RESOURCES, 0)).toThrow(RangeError);
  });
});

/**
 * Der Grund, warum der Mengensatz sich selbst auffuellt.
 *
 * Seit Etappe 6 liegt der Startzustand einer Partie als JSON in der Datenbank,
 * und die dort abgelegten Mengensaetze haben fuenf Schluessel. Ohne Auffuellung
 * rechnete `subtractResources` dort mit `undefined`, und `undefined - 0` ist
 * `NaN` - lautlos, und sichtbar erst Runden spaeter als eine Handkartenzahl,
 * die es nicht geben kann.
 */
describe('eine Menge aus einer gespeicherten Partie', () => {
  const gespeichert = { brick: 3, lumber: 0, wool: 0, grain: 0, ore: 0 };

  it('bekommt die fehlenden Sorten mit null', () => {
    expect(ResourceAmountsSchema.parse(gespeichert)).toEqual(hand({ brick: 3 }));
  });

  it('rechnet danach ohne NaN', () => {
    const alt = ResourceAmountsSchema.parse(gespeichert);
    const summe = addResources(alt, EMPTY_RESOURCES);

    expect(countResources(summe)).toBe(3);
    expect(Number.isNaN(summe.paper)).toBe(false);
  });
});
