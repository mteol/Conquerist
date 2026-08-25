import { describe, expect, it } from 'vitest';

import { CITIES_DICE } from '../../rules/cities.js';
import { yieldTotal, type Roll } from '../dice.js';
import { EVENT_FACES, eventFaceOf, progressValueOf } from './event.js';

/** Ein vollstaendiger Wurf mit allen drei Wuerfeln. */
function wurf(first: number, second: number, event: number): Roll {
  return [
    { die: 'first', value: first },
    { die: 'second', value: second },
    { die: 'event', value: event },
  ];
}

describe('Ereigniswuerfel', () => {
  it('zeigt drei Schiffe und drei Stadttore', () => {
    expect(EVENT_FACES).toEqual(['ship', 'ship', 'ship', 'trade', 'politics', 'science']);
  });

  it('liest die Seite aus dem Wurf', () => {
    expect(eventFaceOf(wurf(3, 4, 1))).toBe('ship');
    expect(eventFaceOf(wurf(3, 4, 3))).toBe('ship');
    expect(eventFaceOf(wurf(3, 4, 4))).toBe('trade');
    expect(eventFaceOf(wurf(3, 4, 5))).toBe('politics');
    expect(eventFaceOf(wurf(3, 4, 6))).toBe('science');
  });

  /*
   * Ein Wurf aus einer Basispartie traegt keinen Ereigniswuerfel. Er soll
   * lesbar bleiben und nicht in eine erfundene Seite gedeutet werden.
   */
  it('sagt nichts, wenn gar kein Ereigniswuerfel dabei war', () => {
    expect(
      eventFaceOf([
        { die: 'first', value: 3 },
        { die: 'second', value: 4 },
      ]),
    ).toBeNull();
  });

  it('nennt den roten Wuerfel - das ist der zweite', () => {
    expect(progressValueOf(wurf(3, 4, 1))).toBe(4);
    expect(
      progressValueOf([
        { die: 'first', value: 3 },
        { die: 'event', value: 1 },
      ]),
    ).toBeNull();
  });
});

describe('die Wuerfelschale von Staedte & Ritter', () => {
  it('laesst den Ereigniswuerfel aus der Ertragszahl heraus', () => {
    expect(yieldTotal(CITIES_DICE, wurf(3, 4, 6))).toBe(7);
    expect(yieldTotal(CITIES_DICE, wurf(1, 1, 6))).toBe(2);
  });
});
