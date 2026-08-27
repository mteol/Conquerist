import { describe, expect, it } from 'vitest';

import { RuleViolationCode } from '../errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_VERTEX,
  gameWithCities,
  giving,
  hand,
  testGame,
} from '../fixtures.js';
import type { GameState } from '../state.js';
import {
  applyImproveCity,
  canImproveCity,
  claimsMetropolis,
  findMetropolisVertex,
  metropolisHolder,
} from './improvements.js';

function playerOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!;
}

/** Setzt die Ausbaustufen eines Spielers - ueberschreibt, ergaenzt nicht. */
function withLevels(
  state: GameState,
  id: string,
  levels: Partial<Record<'trade' | 'politics' | 'science', number>>,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, improvements: levels } : player,
    ),
  };
}

describe('canImproveCity / applyImproveCity - bauen', () => {
  it('baut Stufe 1 im Handel und zieht ein Tuch ab', () => {
    const before = giving(gameWithCities(), 'p1', { cloth: 1 });
    const result = applyImproveCity(before, 'p1', 'trade');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(playerOf(result.state, 'p1').improvements.trade).toBe(1);
    expect(playerOf(result.state, 'p1').resources).toEqual(hand());
  });

  it('baut Stufe 2 und zieht zwei Tuch ab - der Preis folgt der Stufe', () => {
    const before = giving(withLevels(gameWithCities(), 'p1', { trade: 1 }), 'p1', { cloth: 2 });
    const result = applyImproveCity(before, 'p1', 'trade');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(playerOf(result.state, 'p1').improvements.trade).toBe(2);
    expect(playerOf(result.state, 'p1').resources).toEqual(hand());
  });

  it('weist ab, wenn die Handelsware fehlt', () => {
    expect(canImproveCity(gameWithCities(), 'p1', 'trade')?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('weist ab, wer keine Stadt hat - die Stufen bleiben ihm trotzdem', () => {
    const state = giving(withLevels(gameWithCities({ buildings: {} }), 'p1', { trade: 2 }), 'p1', {
      cloth: 3,
    });
    expect(canImproveCity(state, 'p1', 'trade')?.code).toBe(RuleViolationCode.NEEDS_CITY);
    expect(playerOf(state, 'p1').improvements.trade).toBe(2);
  });

  it('weist Stufe 6 ab', () => {
    const state = giving(withLevels(gameWithCities(), 'p1', { trade: 5 }), 'p1', { cloth: 6 });
    expect(canImproveCity(state, 'p1', 'trade')?.code).toBe(RuleViolationCode.TRACK_MAX_LEVEL);
  });

  it('weist an einem Basistisch ab - das Regelwerk kennt den Ausbau nicht', () => {
    const basis = giving(
      testGame({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        },
      }),
      'p1',
      { cloth: 1 },
    );
    expect(canImproveCity(basis, 'p1', 'trade')?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('gibt die bezahlten Handelswaren an die Bank zurueck', () => {
    const before = giving(gameWithCities(), 'p1', { cloth: 1 });
    const result = applyImproveCity(before, 'p1', 'trade');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.bank.cloth).toBe(before.bank.cloth + 1);
  });
});

describe('canImproveCity / applyImproveCity - die Metropole', () => {
  it('verlangt bei Stufe 4 und unvergebenem Aufsatz eine Stadt', () => {
    const state = giving(withLevels(gameWithCities(), 'p1', { trade: 3 }), 'p1', { cloth: 4 });
    expect(canImproveCity(state, 'p1', 'trade')?.code).toBe(RuleViolationCode.METROPOLIS_REQUIRED);
  });

  it('setzt den Aufsatz auf die genannte eigene Stadt bei Stufe 4', () => {
    const before = giving(withLevels(gameWithCities(), 'p1', { trade: 3 }), 'p1', { cloth: 4 });
    const result = applyImproveCity(before, 'p1', 'trade', CENTER_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.buildings[CENTER_VERTEX]?.metropolis).toBe('trade');
    expect(playerOf(result.state, 'p1').improvements.trade).toBe(4);
  });

  it('weist Stufe 3 mit genannter Stadt ab', () => {
    const state = giving(withLevels(gameWithCities(), 'p1', { trade: 2 }), 'p1', { cloth: 3 });
    expect(canImproveCity(state, 'p1', 'trade', CENTER_VERTEX)?.code).toBe(
      RuleViolationCode.METROPOLIS_NOT_WANTED,
    );
  });

  it('weist eine fremde Stadt als Metropole ab', () => {
    const state = giving(
      withLevels(
        gameWithCities({
          buildings: {
            [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
            [ADJACENT_VERTEX]: { owner: 'p2', kind: 'city', wall: false, metropolis: null },
          },
        }),
        'p1',
        { trade: 3 },
      ),
      'p1',
      { cloth: 4 },
    );
    expect(canImproveCity(state, 'p1', 'trade', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.INVALID_METROPOLIS,
    );
  });

  it('weist eine eigene Siedlung als Metropole ab', () => {
    const state = giving(
      withLevels(
        gameWithCities({
          buildings: {
            [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
            [ADJACENT_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
          },
        }),
        'p1',
        { trade: 3 },
      ),
      'p1',
      { cloth: 4 },
    );
    expect(canImproveCity(state, 'p1', 'trade', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.INVALID_METROPOLIS,
    );
  });

  it('weist eine eigene Stadt ab, die schon einen Aufsatz traegt', () => {
    const state = giving(
      withLevels(
        gameWithCities({
          buildings: {
            [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
            [ADJACENT_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: 'science' },
          },
        }),
        'p1',
        { trade: 3 },
      ),
      'p1',
      { cloth: 4 },
    );
    expect(canImproveCity(state, 'p1', 'trade', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.INVALID_METROPOLIS,
    );
  });

  it('nimmt bei Stufe 5 den Aufsatz vom Vorbesitzer, der selbst nicht auf 5 steht, und setzt ihn um', () => {
    const withHolder = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        [ADJACENT_VERTEX]: { owner: 'p2', kind: 'city', wall: false, metropolis: 'trade' },
      },
    });
    const state = giving(
      withLevels(withLevels(withHolder, 'p2', { trade: 4 }), 'p1', { trade: 4 }),
      'p1',
      { cloth: 5 },
    );

    expect(canImproveCity(state, 'p1', 'trade')?.code).toBe(RuleViolationCode.METROPOLIS_REQUIRED);

    const result = applyImproveCity(state, 'p1', 'trade', CENTER_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.buildings[ADJACENT_VERTEX]?.metropolis).toBeNull();
    expect(result.state.buildings[CENTER_VERTEX]?.metropolis).toBe('trade');
  });

  it('wechselt den Aufsatz nicht bei Stufe 5, wenn der Vorbesitzer selbst auf 5 steht', () => {
    const withHolder = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        [ADJACENT_VERTEX]: { owner: 'p2', kind: 'city', wall: false, metropolis: 'trade' },
      },
    });
    const state = giving(
      withLevels(withLevels(withHolder, 'p2', { trade: 5 }), 'p1', { trade: 4 }),
      'p1',
      { cloth: 5 },
    );

    expect(canImproveCity(state, 'p1', 'trade')).toBeNull();
    expect(canImproveCity(state, 'p1', 'trade', CENTER_VERTEX)?.code).toBe(
      RuleViolationCode.METROPOLIS_NOT_WANTED,
    );

    const result = applyImproveCity(state, 'p1', 'trade');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.buildings[ADJACENT_VERTEX]?.metropolis).toBe('trade');
  });

  it('wechselt den Aufsatz nicht bei Stufe 5, wenn man ihn selbst haelt - keine Stadt noetig', () => {
    const state = giving(
      withLevels(
        gameWithCities({
          buildings: {
            [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: 'trade' },
          },
        }),
        'p1',
        { trade: 4 },
      ),
      'p1',
      { cloth: 5 },
    );

    expect(canImproveCity(state, 'p1', 'trade')).toBeNull();

    const result = applyImproveCity(state, 'p1', 'trade');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.buildings[CENTER_VERTEX]?.metropolis).toBe('trade');
  });

  it('Abweichung 1: bringt bei Stufe 4 nichts ein, wenn der Aufsatz einem anderen gehoert', () => {
    const withHolder = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        [ADJACENT_VERTEX]: { owner: 'p2', kind: 'city', wall: false, metropolis: 'trade' },
      },
    });
    const state = giving(withLevels(withHolder, 'p1', { trade: 3 }), 'p1', { cloth: 4 });

    expect(canImproveCity(state, 'p1', 'trade')).toBeNull();
    expect(canImproveCity(state, 'p1', 'trade', CENTER_VERTEX)?.code).toBe(
      RuleViolationCode.METROPOLIS_NOT_WANTED,
    );
  });
});

describe('canImproveCity / applyImproveCity - die freie Stadt', () => {
  it('laesst einen Spieler mit nur einer schon vergebenen Metropolenstadt in einem anderen Bereich bis Stufe 3 bauen, weist Stufe 4 aber ab', () => {
    let state = giving(
      gameWithCities({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: 'trade' },
        },
      }),
      'p1',
      { paper: 6 },
    );

    for (let target = 1; target <= 3; target += 1) {
      const result = applyImproveCity(state, 'p1', 'science');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }

    expect(playerOf(state, 'p1').improvements.science).toBe(3);
    expect(canImproveCity(state, 'p1', 'science')?.code).toBe(
      RuleViolationCode.METROPOLIS_REQUIRED,
    );
  });
});

describe('metropolisHolder / findMetropolisVertex', () => {
  it('nennt niemanden, wenn kein Aufsatz vergeben ist', () => {
    const state = gameWithCities();
    expect(metropolisHolder(state, 'trade')).toBeNull();
    expect(findMetropolisVertex(state, 'trade')).toBeNull();
  });

  it('nennt Besitzer und Ort des Aufsatzes', () => {
    const state = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: 'trade' },
      },
    });
    expect(metropolisHolder(state, 'trade')).toBe('p1');
    expect(findMetropolisVertex(state, 'trade')).toBe(CENTER_VERTEX);
  });
});

describe('claimsMetropolis', () => {
  it('bejaht Stufe 4, wenn der Aufsatz frei ist', () => {
    const state = withLevels(gameWithCities(), 'p1', { trade: 3 });
    expect(claimsMetropolis(state, 'p1', 'trade')).toBe(true);
  });

  it('verneint Stufe 4, wenn der Aufsatz schon vergeben ist', () => {
    const state = withLevels(
      gameWithCities({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
          [ADJACENT_VERTEX]: { owner: 'p2', kind: 'city', wall: false, metropolis: 'trade' },
        },
      }),
      'p1',
      { trade: 3 },
    );
    expect(claimsMetropolis(state, 'p1', 'trade')).toBe(false);
  });
});
