import { z } from 'zod';

import {
  hexFromId,
  hexNeighbors,
  hexToId,
  type BoardTopology,
  type HexId,
} from '../geometry/index.js';
import type { HexPlacement } from './definition.js';
import { chipPips } from './terrain.js';

/**
 * Die vier Fairnessbedingungen als reine Praedikate.
 *
 * Sie beschreiben, was ein Brett *nicht* sein darf. Der Generator wuerfelt
 * dagegen und mischt neu, solange etwas verletzt ist (`generator.ts`) - die
 * Bedingungen selbst wissen davon nichts und sind einzeln testbar.
 *
 * Alle Schwellen kommen von aussen, aus dem Blueprint. Im Code steht keine
 * Zahl, die ein Szenario nicht ueberschreiben koennte.
 */

/** Chips, die als ertragsstark gelten: die beiden mit fuenf Pips. */
const HIGH_CHIPS: readonly number[] = [6, 8];

export const FAIRNESS_RULE_IDS = [
  'adjacentHighChips',
  'adjacentEqualChips',
  'terrainCluster',
  'vertexPips',
] as const;

export type FairnessRuleId = (typeof FAIRNESS_RULE_IDS)[number];

export interface FairnessViolation {
  readonly rule: FairnessRuleId;
  readonly message: string;
}

export const FairnessRulesSchema = z.object({
  /** Keine zwei 6er oder 8er nebeneinander. */
  forbidAdjacentHighChips: z.boolean(),
  /** Keine zwei gleichen Zahlen nebeneinander. */
  forbidAdjacentEqualChips: z.boolean(),
  /** Groesster erlaubter zusammenhaengender Block gleichen Gelaendes. */
  maxTerrainClusterSize: z.number().int().min(1),
  /** Untere Schranke der Augensumme eines vollwertigen Siedlungsplatzes. */
  minVertexPips: z.number().int().min(0),
  /** Obere Schranke derselben Summe. */
  maxVertexPips: z.number().int().min(0),
});

export type FairnessRules = z.infer<typeof FairnessRulesSchema>;

/** Paare benachbarter Felder, jedes Paar genau einmal. */
function* adjacentPairs(
  hexes: readonly HexPlacement[],
  topology: BoardTopology,
): Generator<readonly [HexPlacement, HexPlacement]> {
  const byId = new Map<HexId, HexPlacement>(hexes.map((placement) => [placement.hex, placement]));
  const seen = new Set<string>();

  for (const id of topology.hexes) {
    const placement = byId.get(id);
    if (placement === undefined) continue;

    for (const neighbour of hexNeighbors(hexFromId(id))) {
      const neighbourId = hexToId(neighbour);
      const other = byId.get(neighbourId);
      if (other === undefined) continue;

      const key = id < neighbourId ? `${id}/${neighbourId}` : `${neighbourId}/${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      yield [placement, other];
    }
  }
}

/**
 * Keine zwei ertragsstarken Chips nebeneinander.
 *
 * Zwei 6er oder 8er an einem Feldpaar erzeugen den Siedlungsplatz, an dem das
 * Spiel entschieden wird, bevor es angefangen hat.
 */
export function checkAdjacentHighChips(
  hexes: readonly HexPlacement[],
  topology: BoardTopology,
): readonly FairnessViolation[] {
  const violations: FairnessViolation[] = [];

  for (const [first, second] of adjacentPairs(hexes, topology)) {
    if (
      first.chip !== undefined &&
      second.chip !== undefined &&
      HIGH_CHIPS.includes(first.chip) &&
      HIGH_CHIPS.includes(second.chip)
    ) {
      violations.push({
        rule: 'adjacentHighChips',
        message: `Die ${first.chip} auf ${first.hex} liegt neben der ${second.chip} auf ${second.hex}`,
      });
    }
  }

  return violations;
}

/** Keine zwei gleichen Zahlen nebeneinander. Felder ohne Chip zaehlen nicht. */
export function checkAdjacentEqualChips(
  hexes: readonly HexPlacement[],
  topology: BoardTopology,
): readonly FairnessViolation[] {
  const violations: FairnessViolation[] = [];

  for (const [first, second] of adjacentPairs(hexes, topology)) {
    if (first.chip !== undefined && first.chip === second.chip) {
      violations.push({
        rule: 'adjacentEqualChips',
        message: `Die ${first.chip} liegt auf ${first.hex} und auf dem Nachbarfeld ${second.hex}`,
      });
    }
  }

  return violations;
}

/**
 * Kein zu grosser Block gleichen Gelaendes.
 *
 * Ohne diese Bedingung besteht ein Brett gelegentlich zur Haelfte aus Wald -
 * formal zufaellig, zum Spielen unbrauchbar.
 */
export function checkTerrainClusters(
  hexes: readonly HexPlacement[],
  topology: BoardTopology,
  maxClusterSize: number,
): readonly FairnessViolation[] {
  const byId = new Map<HexId, HexPlacement>(hexes.map((placement) => [placement.hex, placement]));
  const visited = new Set<HexId>();
  const violations: FairnessViolation[] = [];

  for (const start of topology.hexes) {
    if (visited.has(start)) continue;
    const startPlacement = byId.get(start);
    if (startPlacement === undefined) continue;

    const terrain = startPlacement.terrain;
    const cluster: HexId[] = [];
    const queue: HexId[] = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.pop()!;
      cluster.push(current);

      for (const neighbour of hexNeighbors(hexFromId(current))) {
        const neighbourId = hexToId(neighbour);
        if (visited.has(neighbourId)) continue;
        if (byId.get(neighbourId)?.terrain !== terrain) continue;

        visited.add(neighbourId);
        queue.push(neighbourId);
      }
    }

    if (cluster.length > maxClusterSize) {
      violations.push({
        rule: 'terrainCluster',
        message: `${cluster.length} zusammenhaengende Felder der Art ${terrain} (${cluster.join(', ')}), erlaubt sind ${maxClusterSize}`,
      });
    }
  }

  return violations;
}

/**
 * Die Augensumme jedes vollwertigen Siedlungsplatzes muss in einem Band liegen.
 *
 * Gewertet werden nur Knoten mit drei Feldern auf dem Brett. Randknoten haben
 * ein oder zwei und laegen zwangslaeufig unter jeder sinnvollen Untergrenze -
 * sie mitzupruefen wuerde jedes Brett verwerfen.
 *
 * Die Bedingung faengt beide Enden: den Ueber-Knoten, an dem sich alles
 * entscheidet, und die tote Ecke, in der niemand siedeln will.
 */
export function checkVertexPips(
  hexes: readonly HexPlacement[],
  topology: BoardTopology,
  minPips: number,
  maxPips: number,
): readonly FairnessViolation[] {
  const byId = new Map<HexId, HexPlacement>(hexes.map((placement) => [placement.hex, placement]));
  const violations: FairnessViolation[] = [];

  for (const vertex of topology.vertices) {
    const around = topology.vertexHexes.get(vertex) ?? [];
    if (around.length < 3) continue;

    const pips = around.reduce((sum, id) => sum + chipPips(byId.get(id)?.chip), 0);

    if (pips < minPips || pips > maxPips) {
      violations.push({
        rule: 'vertexPips',
        message: `Der Siedlungsplatz ${vertex} kommt auf ${pips} Pips, erlaubt sind ${minPips} bis ${maxPips}`,
      });
    }
  }

  return violations;
}

/** Alle eingeschalteten Bedingungen auf einmal. */
export function checkFairness(
  hexes: readonly HexPlacement[],
  topology: BoardTopology,
  rules: FairnessRules,
): readonly FairnessViolation[] {
  return [
    ...(rules.forbidAdjacentHighChips ? checkAdjacentHighChips(hexes, topology) : []),
    ...(rules.forbidAdjacentEqualChips ? checkAdjacentEqualChips(hexes, topology) : []),
    ...checkTerrainClusters(hexes, topology, rules.maxTerrainClusterSize),
    ...checkVertexPips(hexes, topology, rules.minVertexPips, rules.maxVertexPips),
  ];
}
