import { describe, expect, it } from 'vitest';

import { buildBoardTopology, hexFromId } from '../geometry/index.js';
import type { HexPlacement } from './definition.js';
import {
  checkAdjacentEqualChips,
  checkAdjacentHighChips,
  checkFairness,
  checkTerrainClusters,
  checkVertexPips,
  type FairnessRules,
} from './fairness.js';

/** Baut Topologie und Platzierungen aus einer knappen Kurzschreibweise. */
function board(placements: readonly HexPlacement[]) {
  return {
    hexes: placements,
    topology: buildBoardTopology(placements.map((placement) => hexFromId(placement.hex))),
  };
}

/** Drei Felder in einer Reihe - fuer alles, was nur Nachbarschaft braucht. */
function row(...chips: readonly number[]) {
  return board(
    chips.map((chip, index) => ({ hex: `${index},0`, terrain: 'forest' as const, chip })),
  );
}

/** Drei Felder um einen gemeinsamen Knoten - fuer die Pip-Summe. */
function triangle(...chips: readonly number[]) {
  const hexes = ['0,0', '1,0', '0,1'];
  return board(
    hexes.map((hex, index) => ({ hex, terrain: 'forest' as const, chip: chips[index]! })),
  );
}

const LENIENT: FairnessRules = {
  forbidAdjacentHighChips: false,
  forbidAdjacentEqualChips: false,
  maxTerrainClusterSize: 99,
  minVertexPips: 0,
  maxVertexPips: 99,
};

describe('checkAdjacentHighChips', () => {
  it('meldet zwei benachbarte Sechsen', () => {
    const { hexes, topology } = row(6, 6);
    expect(checkAdjacentHighChips(hexes, topology)).toHaveLength(1);
  });

  it('meldet eine Sechs neben einer Acht', () => {
    const { hexes, topology } = row(6, 8);
    expect(checkAdjacentHighChips(hexes, topology)).toHaveLength(1);
  });

  it('schweigt, wenn zwischen den beiden ein schwaecheres Feld liegt', () => {
    const { hexes, topology } = row(6, 4, 8);
    expect(checkAdjacentHighChips(hexes, topology)).toEqual([]);
  });

  it('meldet jedes Paar nur einmal', () => {
    const { hexes, topology } = row(6, 8, 6);
    expect(checkAdjacentHighChips(hexes, topology)).toHaveLength(2);
  });
});

describe('checkAdjacentEqualChips', () => {
  it('meldet zwei benachbarte gleiche Zahlen', () => {
    const { hexes, topology } = row(5, 5);
    expect(checkAdjacentEqualChips(hexes, topology)).toHaveLength(1);
  });

  it('schweigt bei verschiedenen Zahlen', () => {
    const { hexes, topology } = row(5, 9, 5);
    expect(checkAdjacentEqualChips(hexes, topology)).toEqual([]);
  });

  it('zaehlt die Wueste nicht als Gleichstand', () => {
    const { hexes, topology } = board([
      { hex: '0,0', terrain: 'desert' },
      { hex: '1,0', terrain: 'desert' },
    ]);
    expect(checkAdjacentEqualChips(hexes, topology)).toEqual([]);
  });
});

describe('checkTerrainClusters', () => {
  it('meldet drei zusammenhaengende Felder derselben Art, wenn zwei erlaubt sind', () => {
    const { hexes, topology } = row(3, 4, 5);
    expect(checkTerrainClusters(hexes, topology, 2)).toHaveLength(1);
  });

  it('schweigt, wenn der Cluster die Obergrenze einhaelt', () => {
    const { hexes, topology } = row(3, 4, 5);
    expect(checkTerrainClusters(hexes, topology, 3)).toEqual([]);
  });

  it('trennt Cluster verschiedener Gelaendearten', () => {
    const { hexes, topology } = board([
      { hex: '0,0', terrain: 'forest', chip: 3 },
      { hex: '1,0', terrain: 'hills', chip: 4 },
      { hex: '2,0', terrain: 'forest', chip: 5 },
    ]);
    expect(checkTerrainClusters(hexes, topology, 1)).toEqual([]);
  });

  it('erkennt auch einen Cluster, der nicht in einer Reihe liegt', () => {
    const { hexes, topology } = triangle(3, 4, 5);
    expect(checkTerrainClusters(hexes, topology, 2)).toHaveLength(1);
  });
});

describe('checkVertexPips', () => {
  it('meldet einen Knoten mit zu hoher Augensumme', () => {
    // 6 + 8 + 6 = 5 + 5 + 5 = 15 Pips auf einem einzigen Siedlungsplatz.
    const { hexes, topology } = triangle(6, 8, 6);
    expect(checkVertexPips(hexes, topology, 0, 13)).toHaveLength(1);
  });

  it('meldet einen Knoten mit zu niedriger Augensumme', () => {
    // 2 + 12 + 2 = 1 + 1 + 1 = 3 Pips - eine tote Ecke.
    const { hexes, topology } = triangle(2, 12, 2);
    expect(checkVertexPips(hexes, topology, 5, 99)).toHaveLength(1);
  });

  it('schweigt innerhalb des Bandes', () => {
    const { hexes, topology } = triangle(4, 9, 5);
    expect(checkVertexPips(hexes, topology, 5, 13)).toEqual([]);
  });

  it('prueft nur Knoten mit drei Feldern auf dem Brett', () => {
    // Randknoten liegen zwangslaeufig unter jedem sinnvollen Mindestwert;
    // sie mitzupruefen wuerde jedes Brett verwerfen.
    const { hexes, topology } = triangle(6, 8, 6);
    const withThreeHexes = topology.vertices.filter(
      (vertex) => (topology.vertexHexes.get(vertex) ?? []).length === 3,
    );

    expect(withThreeHexes).toHaveLength(1);
    expect(checkVertexPips(hexes, topology, 99, 999)).toHaveLength(1);
  });
});

describe('checkFairness', () => {
  it('schweigt, wenn keine Bedingung greift', () => {
    const { hexes, topology } = triangle(6, 8, 6);
    expect(checkFairness(hexes, topology, LENIENT)).toEqual([]);
  });

  it('sammelt die Verstoesse aller eingeschalteten Bedingungen', () => {
    const { hexes, topology } = triangle(6, 6, 6);
    const strict: FairnessRules = {
      forbidAdjacentHighChips: true,
      forbidAdjacentEqualChips: true,
      maxTerrainClusterSize: 2,
      minVertexPips: 0,
      maxVertexPips: 13,
    };

    const violations = checkFairness(hexes, topology, strict);
    const rules = new Set(violations.map((violation) => violation.rule));

    expect(rules).toEqual(
      new Set(['adjacentHighChips', 'adjacentEqualChips', 'terrainCluster', 'vertexPips']),
    );
  });

  it('laesst sich einzeln abschalten', () => {
    const { hexes, topology } = triangle(6, 6, 6);
    const onlyEqualChips: FairnessRules = { ...LENIENT, forbidAdjacentEqualChips: true };

    const violations = checkFairness(hexes, topology, onlyEqualChips);
    expect(new Set(violations.map((violation) => violation.rule))).toEqual(
      new Set(['adjacentEqualChips']),
    );
  });

  it('begruendet jeden Verstoss lesbar', () => {
    const { hexes, topology } = row(6, 6);
    const violations = checkFairness(hexes, topology, {
      ...LENIENT,
      forbidAdjacentHighChips: true,
    });

    expect(violations[0]?.message).toContain('6');
  });
});
