import { describe, expect, it } from 'vitest';

import { HEX_DIRECTION_COUNT } from './directions.js';
import { edgeFromHexes, edgeHexes, edgeId, edgeNeighbors, edgeVertices, hexEdges } from './edge.js';
import { hexDistance, hexNeighbor, hexSpiral, hexToId, type Hex } from './hex.js';
import { vertexHexes } from './vertex.js';

const ORIGIN: Hex = { q: 0, r: 0 };
const SAMPLE_HEXES = hexSpiral(ORIGIN, 2);

describe('edgeId', () => {
  it('setzt sich aus den beiden angrenzenden Feldern zusammen', () => {
    expect(edgeId(ORIGIN, 0)).toBe('e:0,0|1,0');
  });

  it('sortiert die Felder numerisch, nicht als Text', () => {
    expect(edgeId({ q: 9, r: 0 }, 1)).toBe('e:9,0|10,-1');
  });

  /**
   * Dieselbe Aussage wie bei den Knoten, nur eine Ebene tiefer: eine
   * Strassenstelle ist von zwei Feldern aus erreichbar und muss von beiden
   * Seiten dieselbe Id ergeben.
   */
  it('ist von beiden angrenzenden Feldern aus identisch', () => {
    for (const hex of SAMPLE_HEXES) {
      for (let direction = 0; direction < HEX_DIRECTION_COUNT; direction += 1) {
        const fromHere = edgeId(hex, direction);
        const fromThere = edgeId(hexNeighbor(hex, direction), direction + 3);
        expect(fromThere).toBe(fromHere);
      }
    }
  });

  it('rechnet Richtungen zyklisch', () => {
    expect(edgeId(ORIGIN, 6)).toBe(edgeId(ORIGIN, 0));
    expect(edgeId(ORIGIN, -1)).toBe(edgeId(ORIGIN, 5));
  });
});

describe('edgeFromHexes', () => {
  it('ist unabhaengig von der Reihenfolge der Felder', () => {
    const a: Hex = { q: 0, r: 0 };
    const b: Hex = { q: 1, r: 0 };
    expect(edgeFromHexes([b, a])).toBe(edgeFromHexes([a, b]));
  });

  it('lehnt Felder ab, die nicht benachbart sind', () => {
    expect(() => edgeFromHexes([ORIGIN, { q: 2, r: 0 }])).toThrow(TypeError);
    expect(() => edgeFromHexes([ORIGIN, ORIGIN])).toThrow(TypeError);
  });

  it('lehnt eine falsche Anzahl von Feldern ab', () => {
    expect(() => edgeFromHexes([ORIGIN])).toThrow(TypeError);
  });
});

describe('edgeHexes', () => {
  it('liefert genau zwei benachbarte Felder', () => {
    for (const hex of SAMPLE_HEXES) {
      for (let direction = 0; direction < HEX_DIRECTION_COUNT; direction += 1) {
        const hexes = edgeHexes(edgeId(hex, direction));

        expect(hexes).toHaveLength(2);
        expect(hexDistance(hexes[0]!, hexes[1]!)).toBe(1);
      }
    }
  });

  it('ueberlebt den Roundtrip ueber edgeFromHexes', () => {
    const id = edgeId({ q: -1, r: 2 }, 4);
    expect(edgeFromHexes(edgeHexes(id))).toBe(id);
  });
});

describe('edgeVertices', () => {
  it('liefert genau zwei verschiedene Knoten', () => {
    for (const hex of SAMPLE_HEXES) {
      for (let direction = 0; direction < HEX_DIRECTION_COUNT; direction += 1) {
        const ends = edgeVertices(edgeId(hex, direction));

        expect(ends).toHaveLength(2);
        expect(ends[0]).not.toBe(ends[1]);
      }
    }
  });

  it('legt beide Felder der Kante an beide Endknoten', () => {
    const id = edgeId({ q: 1, r: -1 }, 2);
    const hexIds = edgeHexes(id).map(hexToId);

    for (const vertex of edgeVertices(id)) {
      const around = new Set(vertexHexes(vertex).map(hexToId));
      for (const hexOfEdge of hexIds) {
        expect(around).toContain(hexOfEdge);
      }
    }
  });
});

describe('edgeNeighbors', () => {
  it('liefert genau vier verschiedene Kanten, die eigene nicht', () => {
    for (const hex of SAMPLE_HEXES) {
      for (let direction = 0; direction < HEX_DIRECTION_COUNT; direction += 1) {
        const id = edgeId(hex, direction);
        const neighbours = edgeNeighbors(id);

        expect(neighbours).toHaveLength(4);
        expect(new Set(neighbours).size).toBe(4);
        expect(neighbours).not.toContain(id);
      }
    }
  });

  it('ist symmetrisch', () => {
    const id = edgeId({ q: 0, r: 1 }, 3);
    for (const neighbour of edgeNeighbors(id)) {
      expect(edgeNeighbors(neighbour)).toContain(id);
    }
  });

  it('teilt mit jeder Nachbarkante genau einen Knoten', () => {
    const id = edgeId({ q: -1, r: 0 }, 5);
    const own = new Set(edgeVertices(id));

    for (const neighbour of edgeNeighbors(id)) {
      const shared = edgeVertices(neighbour).filter((vertex) => own.has(vertex));
      expect(shared).toHaveLength(1);
    }
  });
});

describe('hexEdges', () => {
  it('liefert die sechs Kanten in Richtungsreihenfolge', () => {
    const hex: Hex = { q: 2, r: -1 };
    const edges = hexEdges(hex);

    expect(edges).toHaveLength(6);
    expect(new Set(edges).size).toBe(6);
    edges.forEach((edge, index) => {
      expect(edge).toBe(edgeId(hex, index));
    });
  });

  it('macht aus 19 Feldern 72 verschiedene Kanten', () => {
    const all = new Set(SAMPLE_HEXES.flatMap((hex) => [...hexEdges(hex)]));
    expect(all.size).toBe(72);
  });
});
