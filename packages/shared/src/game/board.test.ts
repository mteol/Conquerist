import { describe, expect, it } from 'vitest';

import { buildBoardTopology, edgeVertices, hexFromId } from '../geometry/index.js';
import { CLASSIC_34, generateScenario } from '../scenario/index.js';
import { boardOf } from './board.js';

const scenario = generateScenario(CLASSIC_34, 'board-test');
const board = boardOf(scenario);

describe('boardOf', () => {
  it('leitet dieselbe Topologie ab wie die Geometrie selbst', () => {
    const expected = buildBoardTopology(
      scenario.hexes.map((placement) => hexFromId(placement.hex)),
    );

    expect(board.topology.vertices).toEqual(expected.vertices);
    expect(board.topology.edges).toEqual(expected.edges);
  });

  it('rechnet dasselbe Szenario nur einmal aus', () => {
    // Der Reducer fragt das Brett bei jeder Aktion. Es jedes Mal neu
    // abzuleiten waere Verschwendung; es im Zustand zu halten waere eine
    // zweite Wahrheit. Also: gemerkt, nicht gespeichert.
    expect(boardOf(scenario)).toBe(board);
  });

  it('haelt Bretter verschiedener Szenarien auseinander', () => {
    const other = generateScenario(CLASSIC_34, 'anderes-brett');

    expect(boardOf(other)).not.toBe(board);
    expect(boardOf(other).topology.vertices).toHaveLength(board.topology.vertices.length);
  });

  it('findet jedes Feld ueber seine Id', () => {
    for (const placement of scenario.hexes) {
      expect(board.hexes.get(placement.hex)).toEqual(placement);
    }
    expect(board.hexes.get('9,9')).toBeUndefined();
  });
});

describe('hexesByChip', () => {
  it('gruppiert die Felder nach ihrem Zahlenchip', () => {
    for (const [chip, hexIds] of board.hexesByChip) {
      for (const hexId of hexIds) {
        expect(board.hexes.get(hexId)?.chip).toBe(chip);
      }
    }
  });

  it('erfasst jedes Ertragsfeld genau einmal', () => {
    const grouped = [...board.hexesByChip.values()].flat();
    const yielding = scenario.hexes.filter((placement) => placement.chip !== undefined);

    expect(grouped).toHaveLength(yielding.length);
    expect(new Set(grouped).size).toBe(yielding.length);
  });

  it('fuehrt die Wueste nirgends', () => {
    const desert = scenario.hexes.find((placement) => placement.terrain === 'desert');
    const grouped = new Set([...board.hexesByChip.values()].flat());

    expect(grouped.has(desert!.hex)).toBe(false);
  });

  it('kennt zur Sieben kein Feld', () => {
    expect(board.hexesByChip.get(7)).toBeUndefined();
  });
});

describe('harborsAtVertex', () => {
  it('haengt jeden Hafen an beide Knoten seiner Kante', () => {
    for (const harbor of scenario.harbors) {
      for (const vertex of edgeVertices(harbor.edge)) {
        expect(board.harborsAtVertex.get(vertex)).toContainEqual(harbor);
      }
    }
  });

  it('erreicht doppelt so viele Knoten wie es Haefen gibt', () => {
    // Jeder Hafen liegt an einer Kante mit zwei Endknoten, und die Plaetze
    // liegen weit genug auseinander, dass sich kein Knoten zwei Haefen teilt.
    expect(board.harborsAtVertex.size).toBe(scenario.harbors.length * 2);
  });

  it('kennt zu einem Binnenknoten keinen Hafen', () => {
    const inland = board.topology.vertices.find(
      (vertex) => (board.topology.vertexHexes.get(vertex) ?? []).length === 3,
    );

    expect(board.harborsAtVertex.get(inland!)).toBeUndefined();
  });
});
