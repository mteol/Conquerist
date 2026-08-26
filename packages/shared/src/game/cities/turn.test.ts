import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../rules/index.js';
import type { Roll } from '../dice.js';
import { gameWithCities, testGame } from '../fixtures.js';
import { reduce } from '../reducer.js';
import { resolveEvent } from './turn.js';

function wurf(first: number, second: number, event: number): Roll {
  return [
    { die: 'first', value: first },
    { die: 'second', value: second },
    { die: 'event', value: event },
  ];
}

describe('resolveEvent', () => {
  it('rueckt das Schiff vor, wenn der Wuerfel ein Schiff zeigt', () => {
    expect(resolveEvent(gameWithCities(), wurf(3, 4, 1)).barbarians?.position).toBe(1);
    expect(resolveEvent(gameWithCities(), wurf(3, 4, 3)).barbarians?.position).toBe(1);
  });

  it('laesst das Schiff stehen, wenn er ein Stadttor zeigt', () => {
    for (const seite of [4, 5, 6]) {
      expect(resolveEvent(gameWithCities(), wurf(3, 4, seite)).barbarians?.position).toBe(0);
    }
  });

  it('laesst landen und wertet aus, wenn das Schiff vor der Kueste steht', () => {
    const state = gameWithCities({
      barbarians: { position: CITIES_RULES.barbarianTrack - 1, attacks: 0 },
      buildings: {},
      knights: {},
    });

    const after = resolveEvent(state, wurf(3, 4, 1));

    // Der Ueberfall ist abgehandelt: das Schiff steht wieder am Anfang, und
    // der Zaehler ist um eins gestiegen.
    expect(after.barbarians).toEqual({ position: 0, attacks: 1 });
  });

  it('laesst ein Stadttor das Schiff auch vor der Kueste in Ruhe', () => {
    const state = gameWithCities({
      barbarians: { position: CITIES_RULES.barbarianTrack - 1, attacks: 0 },
    });

    const after = resolveEvent(state, wurf(3, 4, 5));
    expect(after.barbarians).toEqual({ position: CITIES_RULES.barbarianTrack - 1, attacks: 0 });
  });

  /* Ohne Ereigniswuerfel im Wurf ist es derselbe Zustand, nicht eine Kopie. */
  it('tut nichts in einer Partie ohne Erweiterung', () => {
    const basis = testGame();
    const ohneEreignis: Roll = [
      { die: 'first', value: 3 },
      { die: 'second', value: 4 },
    ];

    expect(resolveEvent(basis, ohneEreignis)).toBe(basis);
  });
});

/**
 * Die Reihenfolge im Zug: Ereignis vor Ertrag.
 *
 * Der Wurf entsteht aus dem Zufallszustand, also wird hier nicht das Ergebnis
 * vorgegeben, sondern nachgesehen, dass beides zusammenpasst - das Schiff
 * steht genau dann weiter, wenn der gefallene Ereigniswuerfel ein Schiff zeigt.
 */
describe('der Wurf im Reducer', () => {
  it('wertet den Ereigniswuerfel mit aus', () => {
    const state = gameWithCities({ phase: { kind: 'rollPending' } });
    const result = reduce(state, { type: 'rollDice', player: state.players[0]!.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const gefallen = result.state.lastRoll?.find((entry) => entry.die === 'event')?.value;
    expect(gefallen).toBeDefined();

    const schiff = gefallen !== undefined && gefallen <= 3;
    expect(result.state.barbarians?.position).toBe(schiff ? 1 : 0);
  });

  it('laesst den Ereigniswuerfel aus der Ertragszahl heraus', () => {
    const state = gameWithCities({ phase: { kind: 'rollPending' } });
    const result = reduce(state, { type: 'rollDice', player: state.players[0]!.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const roll = result.state.lastRoll!;
    const augen = roll
      .filter((entry) => entry.die !== 'event')
      .reduce((sum, entry) => sum + entry.value, 0);

    expect(Object.keys(result.state.rollTally)).toEqual([String(augen)]);
    expect(augen).toBeGreaterThanOrEqual(2);
    expect(augen).toBeLessThanOrEqual(12);
  });
});
