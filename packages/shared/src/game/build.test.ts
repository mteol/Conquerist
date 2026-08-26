import { describe, expect, it } from 'vitest';

import { edgeVertices, isEdgeId, isVertexId, vertexNeighbors } from '../geometry/index.js';
import { CLASSIC_RULES } from '../rules/index.js';
import {
  applyBuildCity,
  applyBuildRoad,
  applyBuildSettlement,
  canPlaceRoadAt,
  canPlaceSettlementAt,
} from './build.js';
import { RuleViolationCode } from './errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  HARBOR2_ORE_VERTEX,
  HARBOR3_VERTEX,
  NEXT_EDGE,
  TEST_SCENARIO,
  giving,
  hand,
  testGame,
} from './fixtures.js';
import type { GameState, Knight } from './state.js';

const ROAD_COST = CLASSIC_RULES.buildCosts.road!;
const SETTLEMENT_COST = CLASSIC_RULES.buildCosts.settlement;
const CITY_COST = CLASSIC_RULES.buildCosts.city;

function playerOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!;
}

/** Ein passiver Ritter der untersten Stufe. */
function knightOf(owner: string): Knight {
  return { owner, level: 1, active: false, activatedOnTurn: null, upgradedThisTurn: false };
}

/** Der Zustand, in dem p1 an `CENTER_VERTEX` siedelt und genug Karten hat. */
function withSettlement(resources = hand()): GameState {
  return giving(
    testGame({ buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false } } }),
    'p1',
    resources,
  );
}

describe('Die Fixture-Ids sind geometrisch stimmig', () => {
  it('nennt lauter kanonische Ids', () => {
    // Eine falsch sortierte Id ist keine gueltige Id - sie faellt aber nicht
    // auf, weil eine Nachschlagetabelle sie schlicht nicht findet und der Test
    // dann das Falsche misst. Deshalb hier die Gegenprobe.
    for (const vertex of [
      CENTER_VERTEX,
      ADJACENT_VERTEX,
      FAR_VERTEX,
      HARBOR3_VERTEX,
      HARBOR2_ORE_VERTEX,
    ]) {
      expect(isVertexId(vertex)).toBe(true);
    }
    for (const edge of [CENTER_EDGE, NEXT_EDGE]) {
      expect(isEdgeId(edge)).toBe(true);
    }
    for (const harbor of TEST_SCENARIO.harbors) {
      expect(isEdgeId(harbor.edge)).toBe(true);
    }
  });

  it('legt die Hafenknoten auf die Kanten der Haefen', () => {
    const harborEdges = TEST_SCENARIO.harbors.map((harbor) => harbor.edge);

    for (const vertex of [HARBOR3_VERTEX, HARBOR2_ORE_VERTEX]) {
      const touching = harborEdges.filter((edge) =>
        (edgeVertices(edge) as readonly string[]).includes(vertex),
      );
      expect(touching).toHaveLength(1);
    }
  });

  it('macht ADJACENT_VERTEX zum Nachbarn und FAR_VERTEX nicht', () => {
    expect(vertexNeighbors(CENTER_VERTEX)).toContain(ADJACENT_VERTEX);
    expect(vertexNeighbors(CENTER_VERTEX)).not.toContain(FAR_VERTEX);
  });

  it('spannt CENTER_EDGE zwischen den beiden Nachbarknoten', () => {
    expect([...edgeVertices(CENTER_EDGE)].sort()).toEqual([CENTER_VERTEX, ADJACENT_VERTEX].sort());
    expect([...edgeVertices(NEXT_EDGE)].sort()).toEqual([ADJACENT_VERTEX, FAR_VERTEX].sort());
  });
});

describe('canPlaceSettlementAt', () => {
  it('erlaubt einen freien Knoten', () => {
    expect(canPlaceSettlementAt(testGame(), CENTER_VERTEX)).toBeNull();
  });

  it('lehnt einen Knoten neben dem Brett ab', () => {
    expect(canPlaceSettlementAt(testGame(), 'v:9,9|10,8|10,9')?.code).toBe(
      RuleViolationCode.NOT_ON_BOARD,
    );
  });

  it('lehnt einen belegten Knoten ab', () => {
    expect(canPlaceSettlementAt(withSettlement(), CENTER_VERTEX)?.code).toBe(
      RuleViolationCode.VERTEX_OCCUPIED,
    );
  });

  it('haelt die Abstandsregel ein - auch gegen eigene Siedlungen', () => {
    expect(canPlaceSettlementAt(withSettlement(), ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.TOO_CLOSE,
    );
  });

  it('erlaubt zwei Schritte Abstand', () => {
    expect(canPlaceSettlementAt(withSettlement(), FAR_VERTEX)).toBeNull();
  });

  it('laesst auf einer Kreuzung mit Ritter nichts bauen - auch nicht dem Besitzer', () => {
    const state = testGame({ knights: { [CENTER_VERTEX]: knightOf('p1') } });
    expect(canPlaceSettlementAt(state, CENTER_VERTEX)?.code).toBe(
      RuleViolationCode.VERTEX_OCCUPIED,
    );
  });

  it('laesst neben einem Ritter bauen - er ist kein Bauwerk', () => {
    const state = testGame({ knights: { [ADJACENT_VERTEX]: knightOf('p2') } });
    expect(canPlaceSettlementAt(state, CENTER_VERTEX)).toBeNull();
  });
});

describe('canPlaceRoadAt', () => {
  it('erlaubt eine freie Kante', () => {
    expect(canPlaceRoadAt(testGame(), CENTER_EDGE)).toBeNull();
  });

  it('lehnt eine Kante neben dem Brett ab', () => {
    expect(canPlaceRoadAt(testGame(), 'e:9,9|10,9')?.code).toBe(RuleViolationCode.NOT_ON_BOARD);
  });

  it('lehnt eine belegte Kante ab', () => {
    const state = testGame({ roads: { [CENTER_EDGE]: 'p2' } });
    expect(canPlaceRoadAt(state, CENTER_EDGE)?.code).toBe(RuleViolationCode.EDGE_OCCUPIED);
  });
});

describe('applyBuildRoad', () => {
  it('baut an die eigene Siedlung an', () => {
    const result = applyBuildRoad(withSettlement(hand(ROAD_COST)), 'p1', CENTER_EDGE);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.roads[CENTER_EDGE]).toBe('p1');
      expect(playerOf(result.state, 'p1').resources).toEqual(hand());
      expect(playerOf(result.state, 'p1').piecesLeft.road).toBe(CLASSIC_RULES.pieceStock.road - 1);
    }
  });

  it('baut an die eigene Strasse an', () => {
    const state = giving(testGame({ roads: { [CENTER_EDGE]: 'p1' } }), 'p1', hand(ROAD_COST));

    expect(applyBuildRoad(state, 'p1', NEXT_EDGE).ok).toBe(true);
  });

  it('lehnt eine Strasse ohne Anschluss ab', () => {
    const state = giving(testGame(), 'p1', hand(ROAD_COST));
    const result = applyBuildRoad(state, 'p1', CENTER_EDGE);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_CONNECTED);
  });

  it('laesst nicht durch eine fremde Siedlung hindurch bauen', () => {
    // p1 hat eine Strasse bis ADJACENT_VERTEX, aber dort steht p2. Die
    // Strasse endet damit - weiterbauen darf p1 an dieser Stelle nicht.
    const state = giving(
      testGame({
        roads: { [CENTER_EDGE]: 'p1' },
        buildings: { [ADJACENT_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false } },
      }),
      'p1',
      hand(ROAD_COST),
    );

    const result = applyBuildRoad(state, 'p1', NEXT_EDGE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_CONNECTED);
  });

  it('lehnt ab, wenn die Karten nicht reichen', () => {
    const result = applyBuildRoad(withSettlement(hand({ brick: 1 })), 'p1', CENTER_EDGE);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('lehnt ab, wenn der Vorrat aufgebraucht ist', () => {
    const base = withSettlement(hand(ROAD_COST));
    const state: GameState = {
      ...base,
      players: base.players.map((player) =>
        player.id === 'p1' ? { ...player, piecesLeft: { ...player.piecesLeft, road: 0 } } : player,
      ),
    };

    const result = applyBuildRoad(state, 'p1', CENTER_EDGE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NO_PIECES_LEFT);
  });

  it('gibt die bezahlten Karten an die Bank zurueck', () => {
    const before = withSettlement(hand(ROAD_COST));
    const result = applyBuildRoad(before, 'p1', CENTER_EDGE);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.bank.brick).toBe(before.bank.brick + ROAD_COST.brick);
      expect(result.state.bank.lumber).toBe(before.bank.lumber + ROAD_COST.lumber);
    }
  });
});

describe('applyBuildSettlement', () => {
  it('baut an die eigene Strasse an', () => {
    const state = giving(testGame({ roads: { [CENTER_EDGE]: 'p1' } }), 'p1', hand(SETTLEMENT_COST));

    const result = applyBuildSettlement(state, 'p1', CENTER_VERTEX);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.buildings[CENTER_VERTEX]).toEqual({
        owner: 'p1',
        kind: 'settlement',
        wall: false,
      });
      expect(playerOf(result.state, 'p1').piecesLeft.settlement).toBe(
        CLASSIC_RULES.pieceStock.settlement - 1,
      );
    }
  });

  it('lehnt eine Siedlung ohne eigene Strasse ab', () => {
    const state = giving(testGame(), 'p1', hand(SETTLEMENT_COST));
    const result = applyBuildSettlement(state, 'p1', CENTER_VERTEX);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_CONNECTED);
  });

  it('laesst eine fremde Strasse nicht als Anschluss gelten', () => {
    const state = giving(testGame({ roads: { [CENTER_EDGE]: 'p2' } }), 'p1', hand(SETTLEMENT_COST));

    const result = applyBuildSettlement(state, 'p1', CENTER_VERTEX);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_CONNECTED);
  });

  it('haelt die Abstandsregel auch beim Bauen ein', () => {
    const state = giving(
      testGame({
        roads: { [CENTER_EDGE]: 'p1' },
        buildings: { [ADJACENT_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false } },
      }),
      'p1',
      hand(SETTLEMENT_COST),
    );

    const result = applyBuildSettlement(state, 'p1', CENTER_VERTEX);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.TOO_CLOSE);
  });
});

describe('applyBuildCity', () => {
  it('ersetzt die eigene Siedlung und gibt sie in den Vorrat zurueck', () => {
    const base = withSettlement(hand(CITY_COST));
    const before = playerOf(base, 'p1').piecesLeft;

    const result = applyBuildCity(base, 'p1', CENTER_VERTEX);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.buildings[CENTER_VERTEX]).toEqual({
        owner: 'p1',
        kind: 'city',
        wall: false,
      });
      expect(playerOf(result.state, 'p1').piecesLeft.city).toBe(before.city - 1);
      // Die Siedlung kommt zurueck in den Vorrat - sie steht ja nicht mehr.
      expect(playerOf(result.state, 'p1').piecesLeft.settlement).toBe(before.settlement + 1);
    }
  });

  it('lehnt einen leeren Knoten ab', () => {
    const state = giving(testGame(), 'p1', hand(CITY_COST));
    const result = applyBuildCity(state, 'p1', CENTER_VERTEX);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_OWN_SETTLEMENT);
  });

  it('lehnt eine fremde Siedlung ab', () => {
    const state = giving(
      testGame({
        buildings: { [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false } },
      }),
      'p1',
      hand(CITY_COST),
    );

    const result = applyBuildCity(state, 'p1', CENTER_VERTEX);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_OWN_SETTLEMENT);
  });

  it('lehnt eine bereits ausgebaute Stadt ab', () => {
    const state = giving(
      testGame({ buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false } } }),
      'p1',
      hand(CITY_COST),
    );

    const result = applyBuildCity(state, 'p1', CENTER_VERTEX);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_OWN_SETTLEMENT);
  });
});
