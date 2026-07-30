import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES } from '../rules/index.js';
import { CENTER_VERTEX, FAR_VERTEX, testGame } from './fixtures.js';
import { hasWon, victoryPointsOf } from './scoring.js';

describe('victoryPointsOf', () => {
  it('zaehlt ohne Bauwerke null', () => {
    expect(victoryPointsOf(testGame(), 'p1')).toBe(0);
  });

  it('zaehlt eine Siedlung als einen Punkt', () => {
    const state = testGame({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
    });

    expect(victoryPointsOf(state, 'p1')).toBe(1);
  });

  it('zaehlt eine Stadt als zwei Punkte', () => {
    const state = testGame({ buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city' } } });

    expect(victoryPointsOf(state, 'p1')).toBe(2);
  });

  it('zaehlt fremde Bauwerke nicht mit', () => {
    const state = testGame({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' },
        [FAR_VERTEX]: { owner: 'p2', kind: 'city' },
      },
    });

    expect(victoryPointsOf(state, 'p1')).toBe(1);
    expect(victoryPointsOf(state, 'p2')).toBe(2);
  });

  it('gibt dem Inhaber der Laengsten Handelsstrasse zwei Punkte dazu', () => {
    const state = testGame({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
      longestRoad: { holder: 'p1', length: 5 },
    });

    expect(victoryPointsOf(state, 'p1')).toBe(3);
  });

  it('gibt sie niemandem, solange sie niemand haelt', () => {
    const state = testGame({ longestRoad: { holder: null, length: 4 } });

    for (const player of state.players) expect(victoryPointsOf(state, player.id)).toBe(0);
  });

  it('nimmt die Werte aus dem RuleSet, nicht aus dem Code', () => {
    const state = testGame({
      rules: {
        ...CLASSIC_RULES,
        victoryPoints: { settlement: 3, city: 7, longestRoad: 5 },
      },
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city' } },
      longestRoad: { holder: 'p1', length: 5 },
    });

    expect(victoryPointsOf(state, 'p1')).toBe(12);
  });
});

describe('hasWon', () => {
  it('ist falsch unterhalb des Ziels', () => {
    const state = testGame({
      rules: { ...CLASSIC_RULES, victoryPointGoal: 3 },
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city' } },
    });

    expect(hasWon(state, 'p1')).toBe(false);
  });

  it('ist wahr ab dem Ziel', () => {
    const state = testGame({
      rules: { ...CLASSIC_RULES, victoryPointGoal: 2 },
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city' } },
    });

    expect(hasWon(state, 'p1')).toBe(true);
  });

  it('ist auch bei Uebererfuellung wahr', () => {
    const state = testGame({
      rules: { ...CLASSIC_RULES, victoryPointGoal: 2 },
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city' },
        [FAR_VERTEX]: { owner: 'p1', kind: 'city' },
      },
    });

    expect(hasWon(state, 'p1')).toBe(true);
  });
});
