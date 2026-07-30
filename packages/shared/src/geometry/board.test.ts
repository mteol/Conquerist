import { describe, expect, it } from 'vitest';

import { buildBoardTopology, coastalEdgeRing, type BoardTopology } from './board.js';
import { edgeHexes } from './edge.js';
import { hexRowLayout, hexToId, type Hex } from './hex.js';
import { vertexHexes } from './vertex.js';

const CLASSIC_34: readonly Hex[] = hexRowLayout([3, 4, 5, 4, 3]);
const CLASSIC_56: readonly Hex[] = hexRowLayout([3, 4, 5, 6, 5, 4, 3]);

const basic = buildBoardTopology(CLASSIC_34);
const extended = buildBoardTopology(CLASSIC_56);

/**
 * Eulersche Polyederformel fuer einen zusammenhaengenden planaren Graphen:
 * `V - E + F = 2`. Die Flaechen sind die Felder plus die Aussenflaeche, also
 * `V - E + H = 1`.
 *
 * Das ist der haertere Test als eine fest eingetragene Knotenzahl: er faellt
 * bei jedem Adjazenzfehler durch, ohne dass die richtige Zahl vorher bekannt
 * sein muss - und beim Layout 3-4-5-6-5-4-3 ist sie das nicht.
 */
function eulerCharacteristic(topology: BoardTopology): number {
  return topology.vertices.length - topology.edges.length + topology.hexes.length;
}

describe('buildBoardTopology', () => {
  it('lehnt ein leeres Brett ab', () => {
    expect(() => buildBoardTopology([])).toThrow(RangeError);
  });

  it('lehnt doppelte Felder ab', () => {
    expect(() =>
      buildBoardTopology([
        { q: 0, r: 0 },
        { q: 0, r: 0 },
      ]),
    ).toThrow(RangeError);
  });

  it('kommt mit einem einzelnen Feld aus', () => {
    const single = buildBoardTopology([{ q: 0, r: 0 }]);

    expect(single.hexes).toHaveLength(1);
    expect(single.vertices).toHaveLength(6);
    expect(single.edges).toHaveLength(6);
    expect(eulerCharacteristic(single)).toBe(1);
  });
});

describe('Basisspiel (3-4-5-4-3)', () => {
  it('hat 19 Felder, 54 Knoten und 72 Kanten', () => {
    expect(basic.hexes).toHaveLength(19);
    expect(basic.vertices).toHaveLength(54);
    expect(basic.edges).toHaveLength(72);
  });

  it('erfuellt die Eulersche Formel', () => {
    expect(eulerCharacteristic(basic)).toBe(1);
  });
});

describe('Erweiterung (3-4-5-6-5-4-3)', () => {
  it('hat 30 Felder', () => {
    expect(extended.hexes).toHaveLength(30);
  });

  it('erfuellt die Eulersche Formel', () => {
    expect(eulerCharacteristic(extended)).toBe(1);
  });

  it('ist groesser als das Basisspiel', () => {
    expect(extended.vertices.length).toBeGreaterThan(basic.vertices.length);
    expect(extended.edges.length).toBeGreaterThan(basic.edges.length);
  });
});

describe.each([
  ['Basisspiel', basic],
  ['Erweiterung', extended],
])('Topologie ist in sich stimmig (%s)', (_name, topology) => {
  const vertexSet = new Set(topology.vertices);
  const edgeSet = new Set(topology.edges);
  const hexSet = new Set(topology.hexes);

  it('fuehrt jedes Feld, jeden Knoten und jede Kante genau einmal', () => {
    expect(vertexSet.size).toBe(topology.vertices.length);
    expect(edgeSet.size).toBe(topology.edges.length);
    expect(hexSet.size).toBe(topology.hexes.length);
  });

  it('gibt jedem Feld sechs Ecken und sechs Kanten, alle auf dem Brett', () => {
    for (const hex of topology.hexes) {
      const corners = topology.hexVertices.get(hex);
      const sides = topology.hexEdges.get(hex);

      expect(corners).toHaveLength(6);
      expect(sides).toHaveLength(6);
      for (const corner of corners ?? []) expect(vertexSet).toContain(corner);
      for (const side of sides ?? []) expect(edgeSet).toContain(side);
    }
  });

  it('gibt jeder Kante genau zwei Endknoten auf dem Brett', () => {
    for (const edge of topology.edges) {
      const ends = topology.edgeVertices.get(edge);

      expect(ends).toHaveLength(2);
      for (const end of ends ?? []) expect(vertexSet).toContain(end);
    }
  });

  it('gibt jedem Knoten zwei oder drei Nachbarn, alle auf dem Brett', () => {
    for (const vertex of topology.vertices) {
      const neighbours = topology.vertexNeighbors.get(vertex) ?? [];

      expect(neighbours.length).toBeGreaterThanOrEqual(2);
      expect(neighbours.length).toBeLessThanOrEqual(3);
      for (const neighbour of neighbours) expect(vertexSet).toContain(neighbour);
    }
  });

  it('haelt die Knotennachbarschaft symmetrisch', () => {
    for (const vertex of topology.vertices) {
      for (const neighbour of topology.vertexNeighbors.get(vertex) ?? []) {
        expect(topology.vertexNeighbors.get(neighbour)).toContain(vertex);
      }
    }
  });

  it('haelt die Kantennachbarschaft symmetrisch', () => {
    for (const edge of topology.edges) {
      for (const neighbour of topology.edgeNeighbors.get(edge) ?? []) {
        expect(topology.edgeNeighbors.get(neighbour)).toContain(edge);
      }
    }
  });

  it('zaehlt zu jedem Knoten ein bis drei Felder des Bretts', () => {
    for (const vertex of topology.vertices) {
      const around = topology.vertexHexes.get(vertex) ?? [];

      expect(around.length).toBeGreaterThanOrEqual(1);
      expect(around.length).toBeLessThanOrEqual(3);
      for (const hex of around) expect(hexSet).toContain(hex);
    }
  });

  it('zaehlt insgesamt sechs Ecken je Feld', () => {
    // Jede Ecke jedes Felds taucht in genau einer Knoten-Feld-Liste auf.
    let total = 0;
    for (const vertex of topology.vertices) {
      total += (topology.vertexHexes.get(vertex) ?? []).length;
    }
    expect(total).toBe(topology.hexes.length * 6);
  });

  it('laesst Knoten und Kanten nur zu, die ein Feld des Bretts beruehren', () => {
    for (const vertex of topology.vertices) {
      const touches = vertexHexes(vertex).some((hex) => hexSet.has(hexToId(hex)));
      expect(touches).toBe(true);
    }
    for (const edge of topology.edges) {
      const touches = edgeHexes(edge).some((hex) => hexSet.has(hexToId(hex)));
      expect(touches).toBe(true);
    }
  });

  it('verbindet jeden Knoten ueber seine Kanten mit genau seinen Nachbarn', () => {
    for (const vertex of topology.vertices) {
      const viaEdges = new Set(
        (topology.vertexEdges.get(vertex) ?? []).flatMap((edge) =>
          (topology.edgeVertices.get(edge) ?? []).filter((end) => end !== vertex),
        ),
      );
      expect([...viaEdges].sort()).toEqual(
        [...(topology.vertexNeighbors.get(vertex) ?? [])].sort(),
      );
    }
  });
});

describe.each([
  ['Basisspiel', basic],
  ['Erweiterung', extended],
])('coastalEdgeRing (%s)', (_name, topology) => {
  const ring = coastalEdgeRing(topology);
  const hexSet = new Set(topology.hexes);

  it('enthaelt genau die Kanten mit einem Feld auf und einem neben dem Brett', () => {
    const expected = topology.edges.filter(
      (edge) => edgeHexes(edge).filter((hex) => hexSet.has(hexToId(hex))).length === 1,
    );
    expect([...ring].sort()).toEqual([...expected].sort());
  });

  it('enthaelt keine Kante doppelt', () => {
    expect(new Set(ring).size).toBe(ring.length);
  });

  it('ist ein geschlossener Rundweg: jede Kante trifft die naechste in einem Knoten', () => {
    for (let i = 0; i < ring.length; i += 1) {
      const current = new Set(topology.edgeVertices.get(ring[i]!) ?? []);
      const next = topology.edgeVertices.get(ring[(i + 1) % ring.length]!) ?? [];

      expect(next.filter((vertex) => current.has(vertex))).toHaveLength(1);
    }
  });

  it('laeuft nicht ueber Kanten im Inneren', () => {
    for (const edge of ring) {
      const onBoard = edgeHexes(edge).filter((hex) => hexSet.has(hexToId(hex)));
      expect(onBoard).toHaveLength(1);
    }
  });
});

describe('coastalEdgeRing (Basisspiel im Detail)', () => {
  it('umlaeuft das Sechseck mit 30 Kuestenkanten', () => {
    // Sechs Randfelder in den Ecken mit je drei Aussenkanten, sechs auf den
    // Seiten mit je zwei: 6 * 3 + 6 * 2 = 30.
    expect(coastalEdgeRing(basic)).toHaveLength(30);
  });

  it('lehnt ein Brett ab, dessen Kueste kein einzelner Rundweg ist', () => {
    // Zwei Felder, die sich nur in einem Punkt beruehren: die Kueste zerfaellt
    // in zwei Ringe. Lieber ein klarer Fehler als eine halbe Hafenreihe.
    const pinched: readonly Hex[] = [
      { q: 0, r: 0 },
      { q: 2, r: -1 },
    ];
    expect(() => coastalEdgeRing(buildBoardTopology(pinched))).toThrow(RangeError);
  });
});
