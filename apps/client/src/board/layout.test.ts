import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_56,
  boardOf,
  edgeHexes,
  generateScenario,
  hexFromId,
  hexToId,
  hexVertices,
  vertexId,
} from '@conquerist/shared';
import {
  HARBOR_OFFSET,
  edgeMidpoint,
  edgeSegment,
  harborAnchor,
  hexCenter,
  hexCorners,
  vertexPoint,
  viewBoxOf,
} from './layout';

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

/**
 * Die Hafenmarke gehoert ins Wasser, nicht auf die Kante.
 *
 * Bis hierher lag sie auf `edgeMidpoint` - derselben Stelle, ueber die eine
 * Strasse laeuft. Wer auf einer Hafenkante baute, legte seine Strasse mitten
 * durch die Marke, und weil die Strassen nach den Haefen gezeichnet werden,
 * gewann die Strasse. Der Hafen war weg.
 */
describe('Hafenmarken', () => {
  const scenario = generateScenario(CLASSIC_34, 'hafen-probe');
  const board = boardOf(scenario);
  const onBoard = new Set(board.topology.hexes);

  /** Der Mittelpunkt des Feldes, an dem eine Kuestenkante liegt. */
  const landCenterOf = (edge: string) => {
    const land = edgeHexes(edge).find((hex) => onBoard.has(hexToId(hex)));
    if (land === undefined) throw new Error(`${edge} liegt an keinem Feld des Bretts`);
    return hexCenter(land);
  };

  it('tritt im rechten Winkel von der Kante weg - und genau so weit', () => {
    expect(scenario.harbors.length).toBeGreaterThan(0);

    for (const harbor of scenario.harbors) {
      const mark = harborAnchor(harbor.edge, onBoard);
      const middle = edgeMidpoint(harbor.edge);
      const [from, to] = edgeSegment(harbor.edge);

      const step = { x: mark.x - middle.x, y: mark.y - middle.y };
      const along = { x: to.x - from.x, y: to.y - from.y };

      expect(round(Math.hypot(step.x, step.y))).toBe(round(HARBOR_OFFSET));
      // Senkrecht: der Fusspunkt bleibt die Kantenmitte, der Abstand zur
      // Strasse ist damit ueberall HARBOR_OFFSET und nirgends weniger.
      expect(step.x * along.x + step.y * along.y).toBeCloseTo(0, 9);
    }
  });

  it('haelt genug Abstand, dass keine Strasse die Marke beruehrt', () => {
    // Strasse 0.16 breit, Kontur 0.24, Marke 0.23 im Radius - Halbbreiten
    // addiert bleibt Luft, sonst waere der Fehler nur kleiner geworden.
    expect(HARBOR_OFFSET).toBeGreaterThan(0.24 / 2 + 0.23);
  });

  it('setzt die Marke auf die See und nicht auf das Land', () => {
    for (const harbor of scenario.harbors) {
      const mark = harborAnchor(harbor.edge, onBoard);
      const land = landCenterOf(harbor.edge);

      // Weiter weg als der Umkreisradius heisst: ausserhalb des Feldes.
      expect(Math.hypot(mark.x - land.x, mark.y - land.y)).toBeGreaterThan(1);
    }
  });

  it('weist eine Kante zurueck, die gar nicht an der Kueste liegt', () => {
    const inner = board.topology.edges.find((edge) =>
      edgeHexes(edge).every((hex) => onBoard.has(hexToId(hex))),
    );

    expect(inner).toBeDefined();
    expect(() => harborAnchor(inner!, onBoard)).toThrow(RangeError);
  });
});
