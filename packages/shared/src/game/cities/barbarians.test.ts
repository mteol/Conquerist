import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../rules/cities.js';
import { CENTER_VERTEX, FAR_VERTEX, gameWithCities, testGame } from '../fixtures.js';
import { advanceShip, barbarianStrength, hasLanded, robberIsFree } from './barbarians.js';

describe('Barbarenschiff', () => {
  it('startet auf dem ersten Feld', () => {
    expect(gameWithCities().barbarians).toEqual({ position: 0, attacks: 0 });
  });

  it('faehrt Feld um Feld', () => {
    let state = gameWithCities();

    state = advanceShip(state);
    expect(state.barbarians?.position).toBe(1);

    state = advanceShip(state);
    expect(state.barbarians?.position).toBe(2);
  });

  /*
   * Etappe 10a: der Kampf braucht Ritter, und die gibt es noch nicht. Ohne
   * diese Grenze verloere alle sieben Schiffswuerfe jeder Staedtebesitzer eine
   * Stadt, weil die Verteidigung immer null waere.
   */
  it('wartet vor der Kueste, solange es keine Ritter gibt', () => {
    let state = gameWithCities();
    for (let i = 0; i < 20; i += 1) state = advanceShip(state);

    expect(state.barbarians?.position).toBe(CITIES_RULES.barbarianTrack - 1);
    expect(state.barbarians?.attacks).toBe(0);
    expect(hasLanded(state)).toBe(false);
  });

  it('faehrt an einem Tisch ohne Erweiterung gar nicht', () => {
    const basis = testGame();

    expect(basis.barbarians).toBeNull();
    expect(advanceShip(basis)).toBe(basis);
  });
});

describe('barbarianStrength', () => {
  it('zaehlt jede Stadt auf dem Brett, egal wem sie gehoert', () => {
    const state = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city' },
        [FAR_VERTEX]: { owner: 'p2', kind: 'city' },
      },
    });

    expect(barbarianStrength(state)).toBe(2);
  });

  it('zaehlt Siedlungen nicht mit - die Barbaren wollen Staedte', () => {
    const state = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city' },
        [FAR_VERTEX]: { owner: 'p2', kind: 'settlement' },
      },
    });

    expect(barbarianStrength(state)).toBe(1);
  });
});

describe('robberIsFree', () => {
  it('haelt den Raeuber fest, bis die Barbaren einmal da waren', () => {
    expect(robberIsFree(gameWithCities())).toBe(false);
  });

  it('gibt ihn nach dem ersten Ueberfall frei', () => {
    const state = gameWithCities({ barbarians: { position: 0, attacks: 1 } });
    expect(robberIsFree(state)).toBe(true);
  });

  /* An einem Basistisch gibt es keine Barbaren, auf die man warten koennte. */
  it('laesst ihn ohne Erweiterung von Anfang an ziehen', () => {
    expect(robberIsFree(testGame())).toBe(true);
  });
});
