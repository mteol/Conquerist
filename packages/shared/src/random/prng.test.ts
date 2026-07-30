import { describe, expect, it } from 'vitest';

import { createRng, nextFloat, nextInt, nextUint32 } from './prng.js';

/** Zieht `count` Werte und gibt sie zusammen mit dem Endzustand zurueck. */
function take(seed: string, count: number): number[] {
  let rng = createRng(seed);
  const values: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const [value, next] = nextUint32(rng);
    values.push(value);
    rng = next;
  }
  return values;
}

describe('createRng', () => {
  it('leitet aus gleichem Seed den gleichen Zustand ab', () => {
    expect(createRng('conquerist')).toEqual(createRng('conquerist'));
  });

  it('leitet aus verschiedenen Seeds verschiedene Zustaende ab', () => {
    expect(createRng('a')).not.toEqual(createRng('b'));
  });

  it('unterscheidet auch Seeds, die sich nur in der Reihenfolge unterscheiden', () => {
    expect(createRng('ab')).not.toEqual(createRng('ba'));
  });

  it('akzeptiert den leeren Seed', () => {
    expect(() => createRng('')).not.toThrow();
  });
});

describe('nextUint32', () => {
  it('laesst den uebergebenen Zustand unangetastet', () => {
    const rng = createRng('immutability');
    const before = { ...rng };

    const [first] = nextUint32(rng);
    const [second] = nextUint32(rng);

    expect(rng).toEqual(before);
    expect(second).toBe(first);
  });

  it('liefert fuer gleichen Seed die gleiche Folge', () => {
    expect(take('same', 50)).toEqual(take('same', 50));
  });

  it('liefert fuer verschiedene Seeds verschiedene Folgen', () => {
    expect(take('seed-a', 50)).not.toEqual(take('seed-b', 50));
  });

  it('liefert vorzeichenlose 32-Bit-Ganzzahlen', () => {
    for (const value of take('range', 500)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('wiederholt sich innerhalb kurzer Folgen nicht', () => {
    const values = take('distinct', 1000);
    expect(new Set(values).size).toBe(values.length);
  });

  it('verteilt die Werte grob gleichmaessig ueber 16 Faecher', () => {
    const buckets = new Array<number>(16).fill(0);
    const draws = 16_000;
    for (const value of take('distribution', draws)) {
      const bucket = Math.floor((value / 0x100000000) * 16);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }

    const expectedPerBucket = draws / 16;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expectedPerBucket * 0.8);
      expect(count).toBeLessThan(expectedPerBucket * 1.2);
    }
  });
});

describe('nextFloat', () => {
  it('liefert Werte in [0, 1)', () => {
    let rng = createRng('float');
    for (let i = 0; i < 1000; i += 1) {
      const [value, next] = nextFloat(rng);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      rng = next;
    }
  });
});

describe('nextInt', () => {
  it('liefert Werte in [0, bound)', () => {
    let rng = createRng('int');
    for (let i = 0; i < 1000; i += 1) {
      const [value, next] = nextInt(rng, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      rng = next;
    }
  });

  it('trifft bei bound 1 immer die Null und verbraucht keinen Zufall', () => {
    const rng = createRng('bound-one');
    const [value, next] = nextInt(rng, 1);

    expect(value).toBe(0);
    expect(next).toEqual(rng);
  });

  it('deckt alle Werte des Bereichs ab', () => {
    let rng = createRng('coverage');
    const seen = new Set<number>();
    for (let i = 0; i < 600; i += 1) {
      const [value, next] = nextInt(rng, 6);
      seen.add(value);
      rng = next;
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('verteilt einen Wuerfelwurf grob gleichmaessig', () => {
    const counts = new Array<number>(6).fill(0);
    const draws = 60_000;
    let rng = createRng('dice');
    for (let i = 0; i < draws; i += 1) {
      const [value, next] = nextInt(rng, 6);
      counts[value] = (counts[value] ?? 0) + 1;
      rng = next;
    }

    for (const count of counts) {
      expect(count).toBeGreaterThan((draws / 6) * 0.95);
      expect(count).toBeLessThan((draws / 6) * 1.05);
    }
  });

  it('lehnt eine Obergrenze ab, die kein positiver Ganzwert ist', () => {
    const rng = createRng('invalid');
    expect(() => nextInt(rng, 0)).toThrow(RangeError);
    expect(() => nextInt(rng, -3)).toThrow(RangeError);
    expect(() => nextInt(rng, 2.5)).toThrow(RangeError);
  });
});

/**
 * Diese Zahlen beschreiben kein gewuenschtes Verhalten - sie sind aus der
 * fertigen Implementierung abgelesen und danach festgenagelt. Ihr Zweck ist
 * eine Sperre: wer am PRNG, am Seed-Hash oder am Vorlauf schraubt, macht aus
 * jedem bestehenden Seed ein anderes Brett und bricht damit jedes laufende
 * Spiel. Das soll ein roter Test sagen, nicht ein Spieler.
 *
 * Bitgleichheit zwischen Node und Browser garantiert der Algorithmus selbst:
 * `Math.imul`, `|0`, `>>>` und `<<` sind in ECMAScript exakt definiert, es gibt
 * keine Fliesskommaschritte, deren Rundung eine Engine anders ausfuehren
 * duerfte.
 */
describe('Regressionssperre', () => {
  it('haelt den Startzustand zum Seed "conquerist" fest', () => {
    expect(createRng('conquerist')).toEqual({
      a: 2334078965,
      b: 690751286,
      c: 1673710079,
      d: 3870449742,
    });
  });

  it('haelt die ersten acht Werte zum Seed "conquerist" fest', () => {
    expect(take('conquerist', 8)).toEqual([
      2600312697, 2445544315, 445066285, 2251348479, 2552018222, 2139249154, 1296701087, 2295286819,
    ]);
  });

  it('haelt zehn Wuerfelwuerfe zum Seed "classic34" fest', () => {
    let rng = createRng('classic34');
    const rolls: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const [value, next] = nextInt(rng, 6);
      rolls.push(value + 1);
      rng = next;
    }
    expect(rolls).toEqual([6, 5, 2, 4, 5, 3, 4, 1, 6, 1]);
  });
});
