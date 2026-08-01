import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_56,
  boardOf,
  generateScenario,
  hexFromId,
  hexVertices,
  vertexId,
} from '@conquerist/shared';
import { edgeSegment, hexCenter, hexCorners, vertexPoint, viewBoxOf } from './layout';

const round = (value: number): number => Math.round(value * 1e6) / 1e6;

describe('Brettgeometrie', () => {
  it('legt das Ursprungsfeld in den Ursprung', () => {
    expect(hexCenter({ q: 0, r: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('stellt die Felder mit der Spitze nach oben', () => {
    const corners = hexCorners({ q: 0, r: 0 });
    const top = corners.reduce((best, point) => (point.y < best.y ? point : best));

    // Spitze oben heisst: die oberste Ecke liegt senkrecht ueber dem Mittelpunkt
    // und im Abstand eines Umkreisradius. Bei Kante oben laegen dort zwei Ecken.
    expect(round(top.x)).toBe(0);
    expect(round(top.y)).toBe(-1);
    expect(corners).toHaveLength(6);
  });

  it('setzt benachbarte Felder im Abstand einer Feldbreite nebeneinander', () => {
    const a = hexCenter({ q: 0, r: 0 });
    const b = hexCenter({ q: 1, r: 0 });

    expect(round(Math.hypot(b.x - a.x, b.y - a.y))).toBe(round(Math.sqrt(3)));
  });

  it('liefert fuer jeden Knoten dieselbe Stelle, egal ueber welches Feld man ihn nennt', () => {
    const scenario = generateScenario(CLASSIC_34, 'layout-probe');
    const board = boardOf(scenario);

    for (const hexId of board.topology.hexes) {
      const hex = hexFromId(hexId);
      const corners = hexCorners(hex);

      hexVertices(hex).forEach((vertex, corner) => {
        const fromId = vertexPoint(vertex);
        const fromCorner = corners[corner]!;

        expect(round(fromId.x)).toBe(round(fromCorner.x));
        expect(round(fromId.y)).toBe(round(fromCorner.y));
        expect(vertex).toBe(vertexId(hex, corner));
      });
    }
  });

  it('zieht jede Kante zwischen zwei benachbarten Ecken', () => {
    const scenario = generateScenario(CLASSIC_34, 'layout-probe');
    const board = boardOf(scenario);

    for (const edge of board.topology.edges) {
      const [from, to] = edgeSegment(edge);
      expect(round(Math.hypot(to.x - from.x, to.y - from.y))).toBe(1);
    }
  });

  it('umschliesst jedes Feld beider Bretter', () => {
    for (const blueprint of [CLASSIC_34, CLASSIC_56]) {
      const scenario = generateScenario(blueprint, 'viewbox-probe');
      const hexes = scenario.hexes.map((placement) => placement.hex);
      const [x, y, width, height] = viewBoxOf(hexes, 0.2).split(' ').map(Number);

      for (const hexId of hexes) {
        for (const corner of hexCorners(hexFromId(hexId))) {
          expect(corner.x).toBeGreaterThanOrEqual(x!);
          expect(corner.x).toBeLessThanOrEqual(x! + width!);
          expect(corner.y).toBeGreaterThanOrEqual(y!);
          expect(corner.y).toBeLessThanOrEqual(y! + height!);
        }
      }
    }
  });
});
