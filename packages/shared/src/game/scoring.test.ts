import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES } from '../rules/index.js';
import { CENTER_VERTEX, FAR_VERTEX, gameWithCities, testGame } from './fixtures.js';
import { hasWon, publicVictoryPointsOf, victoryPointsOf } from './scoring.js';
import type { GameState } from './state.js';

describe('victoryPointsOf', () => {
  it('zaehlt ohne Bauwerke null', () => {
    expect(victoryPointsOf(testGame(), 'p1')).toBe(0);
  });

  it('zaehlt eine Siedlung als einen Punkt', () => {
    const state = testGame({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });

    expect(victoryPointsOf(state, 'p1')).toBe(1);
  });

  it('zaehlt eine Stadt als zwei Punkte', () => {
    const state = testGame({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null } },
    });

    expect(victoryPointsOf(state, 'p1')).toBe(2);
  });

  it('zaehlt fremde Bauwerke nicht mit', () => {
    const state = testGame({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
        [FAR_VERTEX]: { owner: 'p2', kind: 'city', wall: false, metropolis: null },
      },
    });

    expect(victoryPointsOf(state, 'p1')).toBe(1);
    expect(victoryPointsOf(state, 'p2')).toBe(2);
  });

  it('gibt dem Inhaber der Laengsten Handelsstrasse zwei Punkte dazu', () => {
    const state = testGame({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
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
        victoryPoints: {
          ...CLASSIC_RULES.victoryPoints,
          settlement: 3,
          city: 7,
          longestRoad: 5,
        },
      },
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null } },
      longestRoad: { holder: 'p1', length: 5 },
    });

    expect(victoryPointsOf(state, 'p1')).toBe(12);
  });
});

describe('hasWon', () => {
  it('ist falsch unterhalb des Ziels', () => {
    const state = testGame({
      rules: { ...CLASSIC_RULES, victoryPointGoal: 3 },
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null } },
    });

    expect(hasWon(state, 'p1')).toBe(false);
  });

  it('ist wahr ab dem Ziel', () => {
    const state = testGame({
      rules: { ...CLASSIC_RULES, victoryPointGoal: 2 },
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null } },
    });

    expect(hasWon(state, 'p1')).toBe(true);
  });

  it('ist auch bei Uebererfuellung wahr', () => {
    const state = testGame({
      rules: { ...CLASSIC_RULES, victoryPointGoal: 2 },
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        [FAR_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
      },
    });

    expect(hasWon(state, 'p1')).toBe(true);
  });
});

describe('Retter-Chips zaehlen mit', () => {
  function withChips(count: number): GameState {
    const base = gameWithCities();
    return {
      ...base,
      players: base.players.map((player) =>
        player.id === 'p1' ? { ...player, defenderPoints: count } : player,
      ),
    };
  }

  it('zaehlt jeden Chip einen Punkt', () => {
    // Die Stadt aus `gameWithCities` bringt zwei, jeder Chip einen dazu.
    expect(victoryPointsOf(withChips(0), 'p1')).toBe(2);
    expect(victoryPointsOf(withChips(2), 'p1')).toBe(4);
  });

  it('zaehlt sie oeffentlich - sie liegen offen vor dem Spieler', () => {
    expect(publicVictoryPointsOf(withChips(2), 'p1')).toBe(4);
  });

  it('bringt an einem Basistisch nichts, weil es dort keine Chips gibt', () => {
    const basis = testGame({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null } },
    });
    expect(basis.rules.victoryPoints.defender).toBe(0);
    expect(publicVictoryPointsOf(basis, 'p1')).toBe(2);
  });
});
