import { describe, expect, it } from 'vitest';

import { createRng } from './prng.js';
import { shuffle } from './shuffle.js';

describe('shuffle', () => {
  it('behaelt genau die Elemente der Eingabe', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const [shuffled] = shuffle(items, createRng('permutation'));

    expect([...shuffled].sort((x, y) => x - y)).toEqual(items);
  });

  it('laesst die Eingabe unangetastet', () => {
    const items = ['a', 'b', 'c', 'd'];
    shuffle(items, createRng('no-mutation'));

    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('liefert bei gleichem Zustand dieselbe Reihenfolge', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const [first] = shuffle(items, createRng('stable'));
    const [second] = shuffle(items, createRng('stable'));

    expect(second).toEqual(first);
  });

  it('liefert bei verschiedenen Zustaenden verschiedene Reihenfolgen', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const [first] = shuffle(items, createRng('seed-a'));
    const [second] = shuffle(items, createRng('seed-b'));

    expect(second).not.toEqual(first);
  });

  it('fuehrt den Zufallszustand weiter', () => {
    const rng = createRng('advance');
    const [, next] = shuffle([1, 2, 3, 4], rng);

    expect(next).not.toEqual(rng);
  });

  it('verbraucht bei leerer und einelementiger Eingabe keinen Zufall', () => {
    const rng = createRng('nothing-to-do');

    const [empty, afterEmpty] = shuffle([], rng);
    const [single, afterSingle] = shuffle(['x'], rng);

    expect(empty).toEqual([]);
    expect(single).toEqual(['x']);
    expect(afterEmpty).toEqual(rng);
    expect(afterSingle).toEqual(rng);
  });

  it('verteilt jedes Element gleichmaessig ueber alle Positionen', () => {
    const items = [0, 1, 2, 3];
    const rounds = 24_000;
    // counts[element][position]
    const counts = items.map(() => new Array<number>(items.length).fill(0));

    let rng = createRng('uniform');
    for (let round = 0; round < rounds; round += 1) {
      const [shuffled, next] = shuffle(items, rng);
      shuffled.forEach((element, position) => {
        const row = counts[element];
        if (row !== undefined) row[position] = (row[position] ?? 0) + 1;
      });
      rng = next;
    }

    const expectedPerCell = rounds / items.length;
    for (const row of counts) {
      for (const count of row) {
        expect(count).toBeGreaterThan(expectedPerCell * 0.92);
        expect(count).toBeLessThan(expectedPerCell * 1.08);
      }
    }
  });
});
