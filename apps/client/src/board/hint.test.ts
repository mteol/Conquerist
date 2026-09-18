import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  boardOf,
  createGame,
  generateScenario,
  hexFromId,
  terrainYield,
  type GameState,
} from '@conquerist/shared';

import { EMPTY_TARGETS } from '../game/targets';
import { defaultSeats } from '../seats';
import { boardHintAt, chancesOf } from './hint';
import { harborAnchor, hexCenter, vertexPoint } from './layout';

const scenario = generateScenario(CLASSIC_34, 'hint-probe');
const seats = defaultSeats(3);
const state = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'hint-probe',
);
const board = boardOf(scenario);

/** Ein Feld mit Ertrag, auf dem der Raeuber nicht steht. */
const producing = scenario.hexes.find(
  (entry) => entry.chip !== undefined && entry.hex !== state.robber,
)!;

describe('chancesOf', () => {
  it('zaehlt die Wuerfe von 36, in denen eine Zahl faellt', () => {
    expect(chancesOf(2)).toBe(1);
    expect(chancesOf(6)).toBe(5);
    expect(chancesOf(8)).toBe(5);
    expect(chancesOf(12)).toBe(1);
  });
});

describe('boardHintAt', () => {
  it('nennt auf einem Feld Rohstoff, Zahl und Wahrscheinlichkeit', () => {
    const hint = boardHintAt(hexCenter(hexFromId(producing.hex)), state, EMPTY_TARGETS, seats);

    expect(hint?.title).toContain('-');
    expect(hint?.lines[0]).toContain(`${producing.chip}`);
    expect(hint?.lines[0]).toContain(`${chancesOf(producing.chip!)} von 36`);
  });

  it('nennt die Handelsware einer Stadt nur, wenn die Partie sie kennt', () => {
    const forest = scenario.hexes.find((entry) => entry.terrain === 'forest')!;
    const point = hexCenter(hexFromId(forest.hex));

    const base = boardHintAt(point, state, EMPTY_TARGETS, seats);
    const cities = boardHintAt(point, state, EMPTY_TARGETS, seats, { commodities: true });

    expect(base?.lines.join(' ')).not.toContain('Papier');
    expect(cities?.lines.join(' ')).toContain('1 Holz und 1 Papier');
  });

  it('rechnet an einem erlaubten Bauplatz die Nachbarfelder zusammen', () => {
    const vertex = board.topology.vertices.find(
      (candidate) => (board.topology.vertexHexes.get(candidate) ?? []).length === 3,
    )!;
    const hexes = board.topology.vertexHexes.get(vertex)!;
    const expected = hexes.reduce((sum, hex) => {
      const chip = scenario.hexes.find((entry) => entry.hex === hex)?.chip;
      return sum + (chip === undefined ? 0 : chancesOf(chip));
    }, 0);

    const targets = {
      ...EMPTY_TARGETS,
      vertices: new Map([
        [vertex, { type: 'placeSetupSettlement', player: seats[0]!.id, vertex } as never],
      ]),
    };
    const hint = boardHintAt(vertexPoint(vertex), state, targets, seats);

    expect(hint?.title).toBe('Hier bauen');
    expect(hint?.lines).toContain(`Ertrag in ${expected} von 36 Würfen`);
    const resources = hexes.flatMap((hex) => {
      const terrain = scenario.hexes.find((entry) => entry.hex === hex)!.terrain;
      return terrainYield(terrain) === null ? [] : [hex];
    });
    expect(hint!.lines.length).toBeGreaterThanOrEqual(resources.length);
  });

  it('nennt Besitzer und Art eines Bauwerks', () => {
    const vertex = board.topology.vertices[0]!;
    const built: GameState = {
      ...state,
      buildings: {
        [vertex]: { owner: seats[1]!.id, kind: 'city', wall: false, metropolis: null },
      },
    };

    const hint = boardHintAt(vertexPoint(vertex), built, EMPTY_TARGETS, seats);

    expect(hint?.title).toBe(`Stadt von ${seats[1]!.name}`);
  });

  it('erklaert einen Hafen', () => {
    const harbor = scenario.harbors[0]!;
    const onBoard = new Set(board.topology.hexes);
    // Dieselbe Stelle, an der die Marke gezeichnet wird.
    const hint = boardHintAt(harborAnchor(harbor.edge, onBoard), state, EMPTY_TARGETS, seats);

    expect(hint?.title.startsWith('Hafen')).toBe(true);
    expect(hint?.lines[0]).toContain(`Tausche ${harbor.ratio}`);
  });

  it('sagt nichts weit draussen auf See', () => {
    expect(boardHintAt({ x: 99, y: 99 }, state, EMPTY_TARGETS, seats)).toBeNull();
  });
});
