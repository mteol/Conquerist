import { describe, expect, it } from 'vitest';

import {
  buildBoardTopology,
  coastalEdgeRing,
  edgeHexes,
  hexFromId,
  hexToId,
} from '../geometry/index.js';
import { CLASSIC_34 } from './blueprints/classic34.js';
import { CLASSIC_56 } from './blueprints/classic56.js';
import { ScenarioDefinitionSchema, type ScenarioDefinition } from './definition.js';
import { checkFairness } from './fairness.js';
import { generateScenario, type ScenarioBlueprint } from './generator.js';
import { RESOURCE_IDS, type TerrainId } from './terrain.js';

/** Genug Seeds, um Zufall von Systematik zu unterscheiden, ohne den Lauf auszubremsen. */
const SEEDS = Array.from({ length: 40 }, (_, index) => `seed-${index}`);

function terrainCounts(scenario: ScenarioDefinition): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const placement of scenario.hexes) {
    counts[placement.terrain] = (counts[placement.terrain] ?? 0) + 1;
  }
  return counts;
}

function chipMultiset(scenario: ScenarioDefinition): number[] {
  return scenario.hexes
    .map((placement) => placement.chip)
    .filter((chip): chip is number => chip !== undefined)
    .sort((a, b) => a - b);
}

describe.each([
  ['classic34', CLASSIC_34, 19],
  ['classic56', CLASSIC_56, 30],
])('generateScenario (%s)', (_name, blueprint: ScenarioBlueprint, expectedHexes) => {
  const scenario = generateScenario(blueprint, 'conquerist');

  it('erzeugt aus demselben Seed dasselbe Brett', () => {
    expect(generateScenario(blueprint, 'conquerist')).toEqual(scenario);
  });

  it('erzeugt aus verschiedenen Seeds verschiedene Bretter', () => {
    const boards = new Set(SEEDS.map((seed) => JSON.stringify(generateScenario(blueprint, seed))));
    expect(boards.size).toBe(SEEDS.length);
  });

  it('legt die vorgesehene Anzahl Felder', () => {
    expect(scenario.hexes).toHaveLength(expectedHexes);
  });

  it('haelt die Gelaendeanzahlen des Blueprints ein - bei jedem Seed', () => {
    for (const seed of SEEDS) {
      expect(terrainCounts(generateScenario(blueprint, seed))).toEqual(blueprint.terrainCounts);
    }
  });

  it('legt genau die Zahlenchips des Blueprints - bei jedem Seed', () => {
    const expected = [...blueprint.chips].sort((a, b) => a - b);
    for (const seed of SEEDS) {
      expect(chipMultiset(generateScenario(blueprint, seed))).toEqual(expected);
    }
  });

  it('besteht das eigene Schema - bei jedem Seed', () => {
    for (const seed of SEEDS) {
      const result = ScenarioDefinitionSchema.safeParse(generateScenario(blueprint, seed));
      expect(result.success).toBe(true);
    }
  });

  it('erfuellt die strengste Fairnessstufe - bei jedem Seed', () => {
    const strictest = blueprint.fairness[0]!.rules;

    for (const seed of SEEDS) {
      const board = generateScenario(blueprint, seed);
      const topology = buildBoardTopology(board.hexes.map((placement) => hexFromId(placement.hex)));

      expect(checkFairness(board.hexes, topology, strictest)).toEqual([]);
    }
  });

  it('setzt den Raeuber auf ein Feld des Bretts', () => {
    for (const seed of SEEDS) {
      const board = generateScenario(blueprint, seed);
      const ids = new Set(board.hexes.map((placement) => placement.hex));

      expect(ids).toContain(board.robberStart);
    }
  });

  it('setzt den Raeuber auf eine Wueste', () => {
    for (const seed of SEEDS) {
      const board = generateScenario(blueprint, seed);
      const robbed = board.hexes.find((placement) => placement.hex === board.robberStart);

      expect(robbed?.terrain).toBe<TerrainId>('desert');
    }
  });

  it('legt die Haefen auf Kuestenkanten, keine zweimal', () => {
    const topology = buildBoardTopology(
      scenario.hexes.map((placement) => hexFromId(placement.hex)),
    );
    const coast = new Set(coastalEdgeRing(topology));
    const onBoard = new Set(scenario.hexes.map((placement) => placement.hex));

    expect(scenario.harbors).toHaveLength(blueprint.harborTypes.length);
    expect(new Set(scenario.harbors.map((harbor) => harbor.edge)).size).toBe(
      scenario.harbors.length,
    );

    for (const harbor of scenario.harbors) {
      expect(coast).toContain(harbor.edge);
      expect(edgeHexes(harbor.edge).filter((hex) => onBoard.has(hexToId(hex)))).toHaveLength(1);
    }
  });

  it('verteilt die Haefen mit Abstand ueber den Rand', () => {
    const topology = buildBoardTopology(
      scenario.hexes.map((placement) => hexFromId(placement.hex)),
    );
    const ring = coastalEdgeRing(topology);
    const positions = scenario.harbors
      .map((harbor) => ring.indexOf(harbor.edge))
      .sort((a, b) => a - b);

    for (let i = 0; i < positions.length; i += 1) {
      const gap =
        i === positions.length - 1
          ? ring.length - positions[i]! + positions[0]!
          : positions[i + 1]! - positions[i]!;
      expect(gap).toBeGreaterThanOrEqual(2);
    }
  });

  it('gibt jede Ressource genau einmal als 2:1-Hafen aus', () => {
    const twoForOne = scenario.harbors.filter((harbor) => harbor.ratio === 2);
    const resources = twoForOne.map((harbor) => harbor.resource);

    expect([...resources].sort()).toEqual([...RESOURCE_IDS].sort());
  });

  it('mischt die Hafenarten mit, laesst die Plaetze aber fest', () => {
    const other = generateScenario(blueprint, 'anderer-seed');

    const placesHere = scenario.harbors.map((harbor) => harbor.edge).sort();
    const placesThere = other.harbors.map((harbor) => harbor.edge).sort();
    expect(placesThere).toEqual(placesHere);
  });
});

describe('generateScenario (Randfaelle)', () => {
  it('lehnt einen Blueprint ab, dessen Gelaendeanzahlen nicht zum Layout passen', () => {
    const broken: ScenarioBlueprint = {
      ...CLASSIC_34,
      terrainCounts: { ...CLASSIC_34.terrainCounts, forest: CLASSIC_34.terrainCounts.forest + 1 },
    };

    expect(() => generateScenario(broken, 'egal')).toThrow(RangeError);
  });

  it('lehnt einen Blueprint ab, dessen Chipanzahl nicht zu den Ertragsfeldern passt', () => {
    const broken: ScenarioBlueprint = { ...CLASSIC_34, chips: CLASSIC_34.chips.slice(1) };

    expect(() => generateScenario(broken, 'egal')).toThrow(RangeError);
  });

  it('lehnt einen Blueprint ab, der mehr Haefen als Kuestenplaetze vorsieht', () => {
    const broken: ScenarioBlueprint = {
      ...CLASSIC_34,
      harborSpacing: [1],
      harborTypes: Array.from({ length: 40 }, () => ({ ratio: 3 as const })),
    };

    expect(() => generateScenario(broken, 'egal')).toThrow(RangeError);
  });
});
