import { describe, expect, it } from 'vitest';

import { CITIES_RULES, CLASSIC_RULES } from '../../rules/index.js';
import { RuleViolationCode } from '../errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_VERTEX,
  FAR_VERTEX,
  gameWithCities,
  giving,
  hand,
  testGame,
} from '../fixtures.js';
import { discardCountFor } from '../robber.js';
import type { GameState } from '../state.js';
import { applyBuildWall, canBuildWall, handLimitOf, wallsOf } from './walls.js';

const WALL_COST = CITIES_RULES.buildCosts.wall!;

function playerOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!;
}

/** p1 hat die Stadt auf `CENTER_VERTEX` und genug Lehm. */
function withCity(overrides: Partial<GameState> = {}): GameState {
  return giving(gameWithCities(overrides), 'p1', WALL_COST);
}

describe('canBuildWall / applyBuildWall', () => {
  it('baut unter eine eigene Stadt und zieht zwei Lehm ab', () => {
    const result = applyBuildWall(withCity(), 'p1', CENTER_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.buildings[CENTER_VERTEX]?.wall).toBe(true);
    expect(playerOf(result.state, 'p1').resources).toEqual(hand());
    expect(playerOf(result.state, 'p1').piecesLeft.wall).toBe(CITIES_RULES.pieceStock.wall - 1);
  });

  it('weist eine eigene Siedlung ab', () => {
    const state = withCity({
      buildings: { [ADJACENT_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false } },
    });
    expect(canBuildWall(state, 'p1', ADJACENT_VERTEX)?.code).toBe(RuleViolationCode.NOT_OWN_CITY);
  });

  it('weist eine fremde Stadt ab', () => {
    const state = withCity({
      buildings: { [CENTER_VERTEX]: { owner: 'p2', kind: 'city', wall: false } },
    });
    expect(canBuildWall(state, 'p1', CENTER_VERTEX)?.code).toBe(RuleViolationCode.NOT_OWN_CITY);
  });

  it('weist eine leere Kreuzung ab', () => {
    expect(canBuildWall(withCity(), 'p1', FAR_VERTEX)?.code).toBe(RuleViolationCode.NOT_OWN_CITY);
  });

  it('weist eine Stadt mit Mauer ab', () => {
    const state = withCity({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: true } },
    });
    expect(canBuildWall(state, 'p1', CENTER_VERTEX)?.code).toBe(RuleViolationCode.WALL_EXISTS);
  });

  it('weist die vierte Mauer ab - der Vorrat traegt drei', () => {
    const state = withCity();
    const empty: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, piecesLeft: { ...player.piecesLeft, wall: 0 } } : player,
      ),
    };
    expect(canBuildWall(empty, 'p1', CENTER_VERTEX)?.code).toBe(RuleViolationCode.NO_PIECES_LEFT);
  });

  it('weist ab, wenn der Lehm fehlt', () => {
    expect(canBuildWall(gameWithCities(), 'p1', CENTER_VERTEX)?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('weist an einem Basistisch ab - dort gibt es keine Mauern', () => {
    const basis = giving(
      testGame({ buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false } } }),
      'p1',
      WALL_COST,
    );
    expect(canBuildWall(basis, 'p1', CENTER_VERTEX)?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });
});

describe('wallsOf', () => {
  it('zaehlt nur die eigenen Mauern', () => {
    const state = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: true },
        [ADJACENT_VERTEX]: { owner: 'p2', kind: 'city', wall: true },
        [FAR_VERTEX]: { owner: 'p1', kind: 'city', wall: false },
      },
    });

    expect(wallsOf(state, 'p1')).toBe(1);
    expect(wallsOf(state, 'p2')).toBe(1);
  });

  it('zaehlt null ohne Mauern', () => {
    expect(wallsOf(gameWithCities(), 'p1')).toBe(0);
  });
});

describe('handLimitOf', () => {
  function withWalls(count: number): GameState {
    const vertices = [CENTER_VERTEX, ADJACENT_VERTEX, FAR_VERTEX];
    return gameWithCities({
      buildings: Object.fromEntries(
        vertices.map((vertex, index) => [
          vertex,
          { owner: 'p1', kind: 'city' as const, wall: index < count },
        ]),
      ),
    });
  }

  it('bleibt ohne Mauer bei sieben', () => {
    expect(handLimitOf(withWalls(0), 'p1')).toBe(7);
  });

  it('steigt mit einer Mauer auf neun', () => {
    expect(handLimitOf(withWalls(1), 'p1')).toBe(9);
  });

  it('steigt mit dreien auf dreizehn', () => {
    expect(handLimitOf(withWalls(3), 'p1')).toBe(13);
  });

  it('bleibt an einem Basistisch bei sieben - dort hebt keine Mauer', () => {
    const basis = testGame({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: true } },
    });
    expect(CLASSIC_RULES.handLimitPerWall).toBe(0);
    expect(handLimitOf(basis, 'p1')).toBe(7);
  });
});

describe('discardCountFor mit Mauern', () => {
  function withWallsAndCards(walls: number, cards: number): GameState {
    const vertices = [CENTER_VERTEX, ADJACENT_VERTEX, FAR_VERTEX];
    return giving(
      gameWithCities({
        buildings: Object.fromEntries(
          vertices.map((vertex, index) => [
            vertex,
            { owner: 'p1', kind: 'city' as const, wall: index < walls },
          ]),
        ),
      }),
      'p1',
      { brick: cards },
    );
  }

  it('laesst mit zwei Mauern elf Karten liegen', () => {
    // Zwei Mauern heben das Limit auf 11 - abgeworfen wird erst darueber.
    expect(discardCountFor(withWallsAndCards(2, 11), 'p1')).toBe(0);
  });

  it('wirft mit zwei Mauern erst ab zwoelf Karten ab', () => {
    expect(discardCountFor(withWallsAndCards(2, 12), 'p1')).toBe(6);
  });

  it('wirft ohne Mauer schon bei acht ab', () => {
    expect(discardCountFor(withWallsAndCards(0, 8), 'p1')).toBe(4);
  });
});
