import { describe, expect, it } from 'vitest';

import { gameWithCities } from '../fixtures.js';
import type { GameState, Knight, KnightLevel } from '../state.js';
import { reachableVertices, vertexIsFree } from './knightMoves.js';

/**
 * Eine Kette aus vier Strassen ueber fuenf Ecken des mittleren Felds -
 * dieselben Ids wie in `roads.test.ts`, damit beide Tests dasselbe Brett im
 * Kopf haben.
 */
const CHAIN: readonly string[] = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0', 'e:-1,1|0,0'];

const CORNERS: readonly string[] = [
  'v:0,0|1,-1|1,0',
  'v:0,-1|0,0|1,-1',
  'v:-1,0|0,-1|0,0',
  'v:-1,0|-1,1|0,0',
  'v:-1,1|0,0|0,1',
];

function knightOf(owner: string, level: KnightLevel = 1): Knight {
  return { owner, level, active: false, activatedOnTurn: null, upgradedThisTurn: false };
}

function withChain(owner: string, overrides: Partial<GameState> = {}): GameState {
  return gameWithCities({
    buildings: {},
    roads: Object.fromEntries(CHAIN.map((edge) => [edge, owner])),
    ...overrides,
  });
}

const START = CORNERS[0]!;

describe('reachableVertices', () => {
  it('erreicht die ganze Kette, den Startknoten ausgenommen', () => {
    const reachable = reachableVertices(withChain('p1'), 'p1', START);

    expect([...reachable].sort()).toEqual(CORNERS.slice(1).sort());
    expect(reachable.has(START)).toBe(false);
  });

  it('traegt nur eigene Strassen', () => {
    const state = gameWithCities({
      buildings: {},
      roads: { [CHAIN[0]!]: 'p1', [CHAIN[1]!]: 'p2', [CHAIN[2]!]: 'p1', [CHAIN[3]!]: 'p1' },
    });

    expect([...reachableVertices(state, 'p1', START)]).toEqual([CORNERS[1]!]);
  });

  it('bleibt leer, wo keine eigene Strasse liegt', () => {
    expect(reachableVertices(withChain('p2'), 'p1', START).size).toBe(0);
  });

  it('schneidet hinter einem fremden Ritter ab, nimmt ihn aber auf', () => {
    // Auf Ecke 2 steht p2: dorthin darf vertrieben werden, aber nicht daran vorbei.
    const state = withChain('p1', { knights: { [CORNERS[2]!]: knightOf('p2') } });
    const reachable = reachableVertices(state, 'p1', START);

    expect(reachable.has(CORNERS[1]!)).toBe(true);
    expect(reachable.has(CORNERS[2]!)).toBe(true);
    expect(reachable.has(CORNERS[3]!)).toBe(false);
    expect(reachable.has(CORNERS[4]!)).toBe(false);
  });

  it('laesst den eigenen Ritter passieren', () => {
    const state = withChain('p1', { knights: { [CORNERS[2]!]: knightOf('p1') } });

    expect(reachableVertices(state, 'p1', START).has(CORNERS[4]!)).toBe(true);
  });

  it('laesst eine fremde Siedlung passieren - die Anleitung nennt nur Ritter', () => {
    const state = withChain('p1', {
      buildings: { [CORNERS[2]!]: { owner: 'p2', kind: 'settlement', wall: false } },
    });

    expect(reachableVertices(state, 'p1', START).has(CORNERS[4]!)).toBe(true);
  });

  it('nimmt belegte Kreuzungen auf - ob dort gelandet wird, entscheidet der Zug', () => {
    const state = withChain('p1', {
      buildings: { [CORNERS[2]!]: { owner: 'p2', kind: 'settlement', wall: false } },
    });

    expect(reachableVertices(state, 'p1', START).has(CORNERS[2]!)).toBe(true);
  });
});

describe('vertexIsFree', () => {
  it('bejaht eine leere Kreuzung', () => {
    expect(vertexIsFree(withChain('p1'), CORNERS[2]!)).toBe(true);
  });

  it('verneint unter einem Bauwerk', () => {
    const state = withChain('p1', {
      buildings: { [CORNERS[2]!]: { owner: 'p2', kind: 'city', wall: false } },
    });

    expect(vertexIsFree(state, CORNERS[2]!)).toBe(false);
  });

  it('verneint unter einem Ritter - auch dem eigenen', () => {
    const state = withChain('p1', { knights: { [CORNERS[2]!]: knightOf('p1') } });

    expect(vertexIsFree(state, CORNERS[2]!)).toBe(false);
  });
});
