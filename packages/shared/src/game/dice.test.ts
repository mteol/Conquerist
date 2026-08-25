import { describe, expect, it } from 'vitest';

import { createRng } from '../random/index.js';
import { CLASSIC_DICE, type DiceSpec } from '../rules/index.js';
import { rollAll, yieldTotal } from './dice.js';

/**
 * Die Wuerfelschale.
 *
 * Zwei Zusagen werden hier festgehalten, und beide sind der Grund, warum der
 * Wurf ueberhaupt eine eigene Datei bekommen hat: er folgt der Schale des
 * Regelwerks statt einer Zahl im Code, und ein Wuerfel, der nur mitfaellt, geht
 * nicht in die Ertragszahl ein.
 */

/** Eine Schale mit einem dritten, nicht mitzaehlenden Wuerfel - die Erweiterungsprobe. */
const WITH_EVENT_DIE: DiceSpec = [
  ...CLASSIC_DICE,
  { id: 'event', faces: 6, countsTowardYield: false, render: 'pips' },
];

describe('rollAll', () => {
  it('wirft je Wuerfel der Schale ein Ergebnis, in ihrer Reihenfolge', () => {
    const [roll] = rollAll(WITH_EVENT_DIE, createRng('schale'));

    expect(roll.map((result) => result.die)).toEqual(['first', 'second', 'event']);
  });

  it('bleibt in den Augen des jeweiligen Wuerfels', () => {
    const spec: DiceSpec = [
      { id: 'klein', faces: 2, countsTowardYield: true, render: 'pips' },
      { id: 'gross', faces: 12, countsTowardYield: true, render: 'pips' },
    ];

    // Genug Wuerfe, dass eine Grenzverletzung nicht vom Seed abhaengt.
    let rng = createRng('grenzen');
    for (let i = 0; i < 200; i += 1) {
      const [roll, next] = rollAll(spec, rng);
      rng = next;

      expect(roll[0]!.value).toBeGreaterThanOrEqual(1);
      expect(roll[0]!.value).toBeLessThanOrEqual(2);
      expect(roll[1]!.value).toBeGreaterThanOrEqual(1);
      expect(roll[1]!.value).toBeLessThanOrEqual(12);
    }
  });

  it('wuerfelt aus demselben Zustand denselben Wurf', () => {
    const rng = createRng('gleich');

    expect(rollAll(CLASSIC_DICE, rng)[0]).toEqual(rollAll(CLASSIC_DICE, rng)[0]);
  });

  it('fuehrt den Zufallszustand weiter', () => {
    const rng = createRng('weiter');
    const [, next] = rollAll(CLASSIC_DICE, rng);

    expect(next).not.toEqual(rng);
  });
});

describe('yieldTotal', () => {
  it('summiert die mitzaehlenden Wuerfel', () => {
    const roll = [
      { die: 'first', value: 3 },
      { die: 'second', value: 4 },
    ];

    expect(yieldTotal(CLASSIC_DICE, roll)).toBe(7);
  });

  it('laesst einen Wuerfel aussen vor, der nicht mitzaehlt', () => {
    const roll = [
      { die: 'first', value: 3 },
      { die: 'second', value: 4 },
      { die: 'event', value: 6 },
    ];

    // Genau das ist der Punkt: ein Ereigniswuerfel faellt mit und darf die
    // Ertragszahl trotzdem nicht verschieben.
    expect(yieldTotal(WITH_EVENT_DIE, roll)).toBe(7);
  });

  it('zaehlt einen Wuerfel nicht mit, den die Schale nicht kennt', () => {
    expect(yieldTotal(CLASSIC_DICE, [{ die: 'fremd', value: 5 }])).toBe(0);
  });
});
