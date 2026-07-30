import { describe, expect, it } from 'vitest';

import { isEdgeId } from '../geometry/index.js';
import { testGame } from './fixtures.js';
import { longestRoadLength, recomputeLongestRoad } from './roads.js';
import type { GameState } from './state.js';

/**
 * Die sechs Kanten rund um das mittlere Feld bilden einen geschlossenen Ring
 * durch dessen sechs Ecken - die laengste zusammenhaengende Strecke, die sich
 * auf diesem kleinen Brett ohne Verzweigung legen laesst.
 */
const RING: readonly string[] = [
  'e:0,0|1,-1',
  'e:0,-1|0,0',
  'e:-1,0|0,0',
  'e:-1,1|0,0',
  'e:0,0|0,1',
  'e:0,0|1,0',
];

/** Die Ecken des mittleren Felds, in derselben Reihenfolge wie der Ring. */
const CORNERS: readonly string[] = [
  'v:0,0|1,-1|1,0',
  'v:0,-1|0,0|1,-1',
  'v:-1,0|0,-1|0,0',
  'v:-1,0|-1,1|0,0',
  'v:-1,1|0,0|0,1',
  'v:0,0|0,1|1,0',
];

/** Eine zweite Kette von fuenf Strassen, ohne Beruehrung mit dem Ring. */
const RIVAL_CHAIN: readonly string[] = [
  'e:0,-1|1,-2',
  'e:1,-2|1,-1',
  'e:1,-1|2,-2',
  'e:1,-1|2,-1',
  'e:1,0|2,-1',
];

function roadsFor(player: string, edges: readonly string[]): Record<string, string> {
  return Object.fromEntries(edges.map((edge) => [edge, player]));
}

describe('Der Testring ist wirklich ein Ring', () => {
  it('nennt lauter kanonische Kanten', () => {
    for (const edge of RING) expect(isEdgeId(edge)).toBe(true);
  });

  it('schliesst sich zu sechs Strassen ohne Verzweigung', () => {
    const state = testGame({ roads: roadsFor('p1', RING) });
    expect(longestRoadLength(state, 'p1')).toBe(6);
  });

  it('macht aus RIVAL_CHAIN eine Kette von genau fuenf', () => {
    for (const edge of RIVAL_CHAIN) expect(isEdgeId(edge)).toBe(true);
    const state = testGame({ roads: roadsFor('p2', RIVAL_CHAIN) });
    expect(longestRoadLength(state, 'p2')).toBe(5);
  });
});

describe('longestRoadLength', () => {
  it('zaehlt ohne Strassen null', () => {
    expect(longestRoadLength(testGame(), 'p1')).toBe(0);
  });

  it('zaehlt eine einzelne Strasse als eins', () => {
    const state = testGame({ roads: roadsFor('p1', RING.slice(0, 1)) });
    expect(longestRoadLength(state, 'p1')).toBe(1);
  });

  it('zaehlt eine zusammenhaengende Kette', () => {
    for (const length of [2, 3, 4, 5]) {
      const state = testGame({ roads: roadsFor('p1', RING.slice(0, length)) });
      expect(longestRoadLength(state, 'p1')).toBe(length);
    }
  });

  it('zaehlt fremde Strassen nicht mit', () => {
    const state = testGame({
      roads: { ...roadsFor('p1', RING.slice(0, 2)), ...roadsFor('p2', RING.slice(2, 6)) },
    });

    expect(longestRoadLength(state, 'p1')).toBe(2);
    expect(longestRoadLength(state, 'p2')).toBe(4);
  });

  it('zaehlt zwei getrennte Strecken nicht zusammen', () => {
    // Erste und dritte Kante des Rings beruehren sich nicht.
    const state = testGame({ roads: roadsFor('p1', [RING[0]!, RING[2]!]) });
    expect(longestRoadLength(state, 'p1')).toBe(1);
  });

  it('benutzt keine Strasse zweimal', () => {
    // Im geschlossenen Ring waere ein zweiter Umlauf sonst zwoelf lang.
    const state = testGame({ roads: roadsFor('p1', RING) });
    expect(longestRoadLength(state, 'p1')).toBe(6);
  });

  it('nimmt bei einer Verzweigung nur den laengsten Weg hindurch', () => {
    // Drei Strassen sternfoermig an einem gemeinsamen Knoten: ein Weg fuehrt
    // hinein und wieder hinaus, der dritte Arm bleibt liegen. Drei Strassen,
    // aber nur zwei Laenge - genau der Fall, in dem blosses Zaehlen falsch waere.
    const state = testGame({
      roads: roadsFor('p1', ['e:0,0|1,-1', 'e:0,0|1,0', 'e:1,-1|1,0']),
    });

    expect(longestRoadLength(state, 'p1')).toBe(2);
  });

  it('laesst eine fremde Siedlung die Strecke unterbrechen', () => {
    // Kette ueber die Ecken 0-1-2; auf Ecke 1 steht p2 im Weg.
    const state = testGame({
      roads: roadsFor('p1', RING.slice(0, 2)),
      buildings: { [CORNERS[1]!]: { owner: 'p2', kind: 'settlement' } },
    });

    expect(longestRoadLength(state, 'p1')).toBe(1);
  });

  it('laesst die eigene Siedlung die Strecke nicht unterbrechen', () => {
    const state = testGame({
      roads: roadsFor('p1', RING.slice(0, 2)),
      buildings: { [CORNERS[1]!]: { owner: 'p1', kind: 'city' } },
    });

    expect(longestRoadLength(state, 'p1')).toBe(2);
  });

  it('laesst die Strecke an einer fremden Siedlung enden', () => {
    // p2 steht auf Ecke 0, dem Ende der Kette 0-1-2 - dort endet sie ohnehin.
    const state = testGame({
      roads: roadsFor('p1', RING.slice(0, 2)),
      buildings: { [CORNERS[0]!]: { owner: 'p2', kind: 'settlement' } },
    });

    expect(longestRoadLength(state, 'p1')).toBe(2);
  });
});

describe('recomputeLongestRoad', () => {
  function withRoads(assignment: Record<string, string>): GameState {
    return recomputeLongestRoad(testGame({ roads: assignment }));
  }

  it('vergibt nichts unterhalb der Mindestlaenge', () => {
    const state = withRoads(roadsFor('p1', RING.slice(0, 4)));
    expect(state.longestRoad.holder).toBeNull();
  });

  it('vergibt ab der Mindestlaenge', () => {
    const state = withRoads(roadsFor('p1', RING.slice(0, 5)));
    expect(state.longestRoad).toEqual({ holder: 'p1', length: 5 });
  });

  it('laesst den Inhaber bei Gleichstand behalten', () => {
    const held = testGame({
      roads: { ...roadsFor('p1', RING.slice(0, 5)) },
      longestRoad: { holder: 'p1', length: 5 },
    });

    // p2 zieht mit fuenf gleich - das reicht nicht zum Uebernehmen.
    const contested = recomputeLongestRoad({
      ...held,
      roads: {
        ...held.roads,
        ...roadsFor('p2', RIVAL_CHAIN),
      },
    });

    expect(contested.longestRoad.holder).toBe('p1');
  });

  it('wechselt bei echtem Uebertreffen', () => {
    const held = testGame({
      roads: roadsFor('p1', RING.slice(0, 5)),
      longestRoad: { holder: 'p1', length: 5 },
    });

    const overtaken = recomputeLongestRoad({
      ...held,
      roads: { ...roadsFor('p2', RING) },
    });

    expect(overtaken.longestRoad).toEqual({ holder: 'p2', length: 6 });
  });

  it('vergibt bei Gleichstand ohne bisherigen Inhaber an niemanden', () => {
    const state = recomputeLongestRoad(
      testGame({
        roads: {
          ...roadsFor('p1', RING.slice(0, 5)),
          ...roadsFor('p2', RIVAL_CHAIN),
        },
      }),
    );

    expect(state.longestRoad.holder).toBeNull();
  });

  it('nimmt die Karte weg, wenn niemand mehr die Mindestlaenge hat', () => {
    const state = recomputeLongestRoad(
      testGame({
        roads: roadsFor('p1', RING.slice(0, 2)),
        longestRoad: { holder: 'p1', length: 5 },
      }),
    );

    expect(state.longestRoad).toEqual({ holder: null, length: 0 });
  });
});
