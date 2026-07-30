import { describe, expect, it } from 'vitest';

import { HEX_DIRECTION_COUNT } from './directions.js';
import { edgeHexes } from './edge.js';
import { hexDistance, hexSpiral, hexToId, type Hex } from './hex.js';
import {
  hexVertices,
  vertexEdges,
  vertexFromHexes,
  vertexHexes,
  vertexId,
  vertexNeighbors,
} from './vertex.js';

const ORIGIN: Hex = { q: 0, r: 0 };

/** Alle Felder eines Sechsecks mit Radius 2 - reicht fuer alle Randfaelle. */
const SAMPLE_HEXES = hexSpiral(ORIGIN, 2);

describe('vertexId', () => {
  it('setzt sich aus den drei angrenzenden Feldern zusammen', () => {
    // Ecke 0 von (0,0) liegt zwischen den Nachbarn in Richtung 0 und 1.
    expect(vertexId(ORIGIN, 0)).toBe('v:0,0|1,-1|1,0');
  });

  it('sortiert die Felder numerisch, nicht als Text', () => {
    // Bei zweistelligen Koordinaten laufen die beiden Sortierungen
    // auseinander: als Text kaeme "10,-1" vor "9,0". Sortiert wird nach q,
    // dann nach r - sonst haengt die Id davon ab, wo das Brett gerade liegt.
    expect(vertexId({ q: 9, r: 0 }, 0)).toBe('v:9,0|10,-1|10,0');
  });

  it('rechnet Ecken zyklisch', () => {
    expect(vertexId(ORIGIN, 6)).toBe(vertexId(ORIGIN, 0));
    expect(vertexId(ORIGIN, -1)).toBe(vertexId(ORIGIN, 5));
  });

  it('liefert je Feld sechs verschiedene Ecken', () => {
    for (const hex of SAMPLE_HEXES) {
      const ids = new Set<string>();
      for (let corner = 0; corner < HEX_DIRECTION_COUNT; corner += 1) {
        ids.add(vertexId(hex, corner));
      }
      expect(ids.size).toBe(6);
    }
  });

  /**
   * Die Kernaussage von Entscheidung A. Ein Siedlungsplatz ist von drei Feldern
   * aus erreichbar; wenn auch nur einer der drei Wege eine andere Id ergaebe,
   * koennte ein Spieler zwei Siedlungen auf denselben Punkt bauen.
   */
  it('ist von allen drei angrenzenden Feldern aus identisch', () => {
    for (const hex of SAMPLE_HEXES) {
      for (let corner = 0; corner < HEX_DIRECTION_COUNT; corner += 1) {
        const id = vertexId(hex, corner);

        for (const neighbour of vertexHexes(id)) {
          const cornersOfNeighbour = hexVertices(neighbour);
          expect(cornersOfNeighbour).toContain(id);
        }
      }
    }
  });

  it('haengt nicht davon ab, welche Felder zum Brett gehoeren', () => {
    // Gegen die unendliche Ebene gerechnet, nicht gegen das Brett: ein
    // Randknoten grenzt auf dem Brett nur an ein oder zwei Felder, geometrisch
    // aber immer an drei. Rechnete man gegen das Brett, aenderte sich die Id
    // eines Randknotens, sobald ein Szenario groesser wird.
    const cornerOfSmallBoard = vertexId({ q: 2, r: 0 }, 0);
    expect(vertexHexes(cornerOfSmallBoard)).toHaveLength(3);
    expect(cornerOfSmallBoard).toBe(vertexId({ q: 3, r: 0 }, 2));
  });
});

describe('vertexHexes', () => {
  it('liefert genau drei paarweise benachbarte Felder', () => {
    for (const hex of SAMPLE_HEXES) {
      for (let corner = 0; corner < HEX_DIRECTION_COUNT; corner += 1) {
        const hexes = vertexHexes(vertexId(hex, corner));

        expect(hexes).toHaveLength(3);
        expect(new Set(hexes.map(hexToId)).size).toBe(3);
        expect(hexDistance(hexes[0]!, hexes[1]!)).toBe(1);
        expect(hexDistance(hexes[0]!, hexes[2]!)).toBe(1);
        expect(hexDistance(hexes[1]!, hexes[2]!)).toBe(1);
      }
    }
  });

  it('enthaelt das Bezugsfeld', () => {
    const hex: Hex = { q: -1, r: 2 };
    const hexes = vertexHexes(vertexId(hex, 3));
    expect(hexes.map(hexToId)).toContain(hexToId(hex));
  });

  it('ueberlebt den Roundtrip ueber vertexFromHexes', () => {
    const id = vertexId({ q: 1, r: 1 }, 4);
    expect(vertexFromHexes(vertexHexes(id))).toBe(id);
  });
});

describe('vertexFromHexes', () => {
  it('ist unabhaengig von der Reihenfolge der Felder', () => {
    const hexes = vertexHexes(vertexId(ORIGIN, 2));
    const rotated = [hexes[2]!, hexes[0]!, hexes[1]!];
    expect(vertexFromHexes(rotated)).toBe(vertexFromHexes(hexes));
  });

  it('lehnt Felder ab, die keinen gemeinsamen Punkt haben', () => {
    expect(() => vertexFromHexes([ORIGIN, { q: 5, r: 0 }, { q: 0, r: 5 }])).toThrow(TypeError);
  });

  it('lehnt eine falsche Anzahl von Feldern ab', () => {
    expect(() => vertexFromHexes([ORIGIN, { q: 1, r: 0 }])).toThrow(TypeError);
  });
});

describe('vertexEdges', () => {
  it('liefert genau drei Kanten', () => {
    for (const hex of SAMPLE_HEXES) {
      for (let corner = 0; corner < HEX_DIRECTION_COUNT; corner += 1) {
        const edges = vertexEdges(vertexId(hex, corner));
        expect(edges).toHaveLength(3);
        expect(new Set(edges).size).toBe(3);
      }
    }
  });

  it('spannt jede Kante zwischen zwei der drei Felder des Knotens', () => {
    const id = vertexId({ q: 2, r: -1 }, 1);
    const hexIds = new Set(vertexHexes(id).map(hexToId));

    for (const edge of vertexEdges(id)) {
      for (const hex of edgeHexes(edge)) {
        expect(hexIds).toContain(hexToId(hex));
      }
    }
  });
});

describe('vertexNeighbors', () => {
  it('liefert genau drei verschiedene Knoten, den eigenen nicht', () => {
    for (const hex of SAMPLE_HEXES) {
      for (let corner = 0; corner < HEX_DIRECTION_COUNT; corner += 1) {
        const id = vertexId(hex, corner);
        const neighbours = vertexNeighbors(id);

        expect(neighbours).toHaveLength(3);
        expect(new Set(neighbours).size).toBe(3);
        expect(neighbours).not.toContain(id);
      }
    }
  });

  it('ist symmetrisch', () => {
    const id = vertexId({ q: 0, r: 1 }, 5);
    for (const neighbour of vertexNeighbors(id)) {
      expect(vertexNeighbors(neighbour)).toContain(id);
    }
  });

  it('teilt mit jedem Nachbarn genau zwei Felder', () => {
    const id = vertexId({ q: -2, r: 1 }, 2);
    const own = new Set(vertexHexes(id).map(hexToId));

    for (const neighbour of vertexNeighbors(id)) {
      const shared = vertexHexes(neighbour).filter((hex) => own.has(hexToId(hex)));
      expect(shared).toHaveLength(2);
    }
  });
});

describe('hexVertices', () => {
  it('liefert die sechs Ecken in Eckenreihenfolge', () => {
    const hex: Hex = { q: 1, r: -2 };
    const corners = hexVertices(hex);

    expect(corners).toHaveLength(6);
    expect(new Set(corners).size).toBe(6);
    corners.forEach((corner, index) => {
      expect(corner).toBe(vertexId(hex, index));
    });
  });

  it('macht aus 19 Feldern 54 verschiedene Knoten', () => {
    const all = new Set(SAMPLE_HEXES.flatMap((hex) => [...hexVertices(hex)]));
    expect(all.size).toBe(54);
  });
});
