import { describe, expect, it } from 'vitest';

import {
  EMPTY_RESOURCES,
  addResources,
  canAfford,
  countResources,
  resourceAt,
  scaleResources,
  subtractResources,
} from './resources.js';

const HAND = { brick: 2, lumber: 0, wool: 1, grain: 3, ore: 0 };

describe('EMPTY_RESOURCES', () => {
  it('nennt jede Ressource mit null', () => {
    expect(EMPTY_RESOURCES).toEqual({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 });
  });

  it('laesst sich nicht versehentlich veraendern', () => {
    const changed = addResources(EMPTY_RESOURCES, { ...EMPTY_RESOURCES, ore: 1 });

    expect(changed.ore).toBe(1);
    expect(EMPTY_RESOURCES.ore).toBe(0);
  });
});

describe('countResources', () => {
  it('zaehlt alle Karten der Hand', () => {
    expect(countResources(HAND)).toBe(6);
  });

  it('zaehlt die leere Hand als null', () => {
    expect(countResources(EMPTY_RESOURCES)).toBe(0);
  });
});

describe('addResources', () => {
  it('addiert komponentenweise', () => {
    expect(addResources(HAND, { brick: 1, lumber: 4, wool: 0, grain: 0, ore: 2 })).toEqual({
      brick: 3,
      lumber: 4,
      wool: 1,
      grain: 3,
      ore: 2,
    });
  });

  it('laesst beide Eingaben unangetastet', () => {
    const before = { ...HAND };
    addResources(HAND, HAND);

    expect(HAND).toEqual(before);
  });
});

describe('subtractResources', () => {
  it('zieht komponentenweise ab', () => {
    expect(subtractResources(HAND, { brick: 1, lumber: 0, wool: 1, grain: 0, ore: 0 })).toEqual({
      brick: 1,
      lumber: 0,
      wool: 0,
      grain: 3,
      ore: 0,
    });
  });

  it('wirft, statt ins Minus zu laufen', () => {
    // Ein negativer Bestand waere ein stiller Regelfehler, der erst Runden
    // spaeter auffiele. Aufrufer pruefen vorher mit canAfford.
    expect(() => subtractResources(HAND, { ...EMPTY_RESOURCES, ore: 1 })).toThrow(RangeError);
  });
});

describe('scaleResources', () => {
  it('vervielfacht komponentenweise', () => {
    expect(scaleResources(HAND, 2)).toEqual({ brick: 4, lumber: 0, wool: 2, grain: 6, ore: 0 });
  });
});

describe('canAfford', () => {
  it('erkennt genau ausreichende Mittel', () => {
    expect(canAfford(HAND, { brick: 2, lumber: 0, wool: 1, grain: 3, ore: 0 })).toBe(true);
  });

  it('erkennt fehlende Mittel', () => {
    expect(canAfford(HAND, { ...EMPTY_RESOURCES, ore: 1 })).toBe(false);
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
