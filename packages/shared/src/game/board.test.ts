import { describe, expect, it } from 'vitest';

import { buildBoardTopology, edgeVertices, hexFromId } from '../geometry/index.js';
import { CLASSIC_34, ScenarioDefinitionSchema, generateScenario } from '../scenario/index.js';
import { FIXED_CHIPS, boardOf, chipAt, chipIsSwappable, swapChips } from './board.js';

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

/**
 * Ein Streifen aus fuenf Feldern mit genau den Zahlen, um die es beim
 * Erfinder geht: zwei freie (3 und 5) und drei feste (2, 6, 12).
 */
const chipStrip = ScenarioDefinitionSchema.parse({
  id: 'chips',
  name: 'Zahlenstreifen',
  minPlayers: 2,
  maxPlayers: 4,
  hexes: [
    { hex: '0,0', terrain: 'forest', chip: 3 },
    { hex: '1,0', terrain: 'hills', chip: 5 },
    { hex: '2,0', terrain: 'fields', chip: 6 },
    { hex: '3,0', terrain: 'pasture', chip: 12 },
    { hex: '4,0', terrain: 'mountains', chip: 2 },
    { hex: '5,0', terrain: 'desert' },
  ],
  harbors: [],
  robberStart: '5,0',
});

describe('Zahlenchips vertauschen', () => {
  it('nennt genau die vier festen Zahlen', () => {
    expect([...FIXED_CHIPS].sort((a, b) => a - b)).toEqual([2, 6, 8, 12]);
  });

  it('haelt 2, 12, 6 und 8 fuer unantastbar', () => {
    expect(chipIsSwappable(chipStrip, '2,0')).toBe(false);
    expect(chipIsSwappable(chipStrip, '3,0')).toBe(false);
    expect(chipIsSwappable(chipStrip, '4,0')).toBe(false);
  });

  it('haelt jede andere Zahl fuer tauschbar', () => {
    expect(chipIsSwappable(chipStrip, '0,0')).toBe(true);
    expect(chipIsSwappable(chipStrip, '1,0')).toBe(true);
  });

  it('haelt ein Feld ohne Zahlenchip nicht fuer tauschbar', () => {
    expect(chipIsSwappable(chipStrip, '5,0')).toBe(false);
  });

  it('vertauscht die Zahlen zweier Felder', () => {
    const swapped = swapChips(chipStrip, '0,0', '1,0');

    expect(chipAt(swapped, '0,0')).toBe(5);
    expect(chipAt(swapped, '1,0')).toBe(3);
  });

  it('laesst das alte Szenario unberuehrt', () => {
    swapChips(chipStrip, '0,0', '1,0');

    expect(chipAt(chipStrip, '0,0')).toBe(3);
    expect(chipAt(chipStrip, '1,0')).toBe(5);
  });

  it('laesst das Brett den neuen Zahlen folgen', () => {
    // Der Grund fuer das neue Szenario-Objekt: `boardOf` merkt sich das
    // abgeleitete Brett an der Identitaet. Ein Tausch an Ort und Stelle
    // behielte `hexesByChip` von vorher - und die Ertraege die alten Zahlen.
    const swapped = swapChips(chipStrip, '0,0', '1,0');

    expect(boardOf(chipStrip).hexesByChip.get(3)).toEqual(['0,0']);
    expect(boardOf(swapped).hexesByChip.get(3)).toEqual(['1,0']);
    expect(boardOf(swapped).hexesByChip.get(5)).toEqual(['0,0']);
  });
});
