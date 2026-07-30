import { z } from 'zod';

import { edgeHexes, hexFromId, hexNeighbors, hexToId, type HexId } from '../geometry/index.js';
import { HarborSchema } from './harbor.js';
import { ChipSchema, TerrainIdSchema, producesResource } from './terrain.js';

/**
 * Ein Szenario beschreibt ein Brett - und nur das Brett.
 *
 * Gespeichert werden die Felder mit Gelaende und Zahlenchip, die Haefen und der
 * Raeuberstart. Knoten und Kanten stehen bewusst *nicht* darin: sie folgen aus
 * den Feldern (`buildBoardTopology`). Eine gespeicherte Knotenliste waere eine
 * zweite Wahrheit, die von der ersten abweichen kann.
 *
 * Abgrenzung zum RuleSet: Gelaendeanzahlen und Chipverteilung sind
 * Szenariodaten, Baukosten und Siegpunktziel sind Regeln (`rules/ruleset.ts`).
 */

/** Id eines Felds in der Form `"q,r"`. */
export const HexIdSchema = z
  .string()
  .regex(/^-?\d+,-?\d+$/, 'Keine gueltige Hex-Id, erwartet "q,r"');

export const HexPlacementSchema = z.object({
  hex: HexIdSchema,
  terrain: TerrainIdSchema,
  /** Fehlt genau dann, wenn das Gelaende nichts abwirft. */
  chip: ChipSchema.optional(),
});

export type HexPlacement = z.infer<typeof HexPlacementSchema>;

const ScenarioShapeSchema = z.object({
  /** Stabiler Bezeichner, etwa `"classic34"`. */
  id: z.string().min(1),
  /** Anzeigename. */
  name: z.string().min(1),
  hexes: z.array(HexPlacementSchema).min(1),
  harbors: z.array(HarborSchema),
  /** Feld, auf dem der Raeuber beginnt. Muss zum Brett gehoeren. */
  robberStart: HexIdSchema,
  /**
   * Fuer wie viele Spieler das Brett gedacht ist.
   *
   * Gehoert zum Szenario und nicht zum RuleSet: 19 Felder tragen keine sechs
   * Spieler, und das liegt am Brett, nicht an den Baukosten. `createGame`
   * prueft die Tischgroesse dagegen.
   */
  minPlayers: z.number().int().min(2),
  maxPlayers: z.number().int().min(2),
});

/**
 * Prueft, ob alle Felder ueber Nachbarschaft zusammenhaengen.
 *
 * Ein Brett aus zwei getrennten Inseln laesst sich zwar aufbauen, aber weder
 * bespielen noch mit einer Hafenreihe umranden - `coastalEdgeRing` haette
 * ebenfalls keinen einzelnen Rundweg. Lieber hier ein klarer Fehler als dort
 * ein unklarer.
 */
function isConnected(hexIds: readonly HexId[]): boolean {
  const remaining = new Set(hexIds);
  const first = hexIds[0];
  if (first === undefined) return true;

  const queue: HexId[] = [first];
  remaining.delete(first);

  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const neighbour of hexNeighbors(hexFromId(current))) {
      const id = hexToId(neighbour);
      if (remaining.delete(id)) queue.push(id);
    }
  }

  return remaining.size === 0;
}

export const ScenarioDefinitionSchema = ScenarioShapeSchema.superRefine((scenario, ctx) => {
  if (scenario.maxPlayers < scenario.minPlayers) {
    ctx.addIssue({
      code: 'custom',
      path: ['maxPlayers'],
      message: `maxPlayers (${scenario.maxPlayers}) liegt unter minPlayers (${scenario.minPlayers})`,
    });
  }

  const hexIds = scenario.hexes.map((placement) => placement.hex);
  const onBoard = new Set<HexId>();

  scenario.hexes.forEach((placement, index) => {
    if (onBoard.has(placement.hex)) {
      ctx.addIssue({
        code: 'custom',
        path: ['hexes', index, 'hex'],
        message: `Feld ${placement.hex} kommt mehrfach vor`,
      });
    }
    onBoard.add(placement.hex);

    const needsChip = producesResource(placement.terrain);
    if (needsChip && placement.chip === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['hexes', index, 'chip'],
        message: `${placement.terrain} wirft Ressourcen ab und braucht deshalb einen Zahlenchip`,
      });
    }
    if (!needsChip && placement.chip !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['hexes', index, 'chip'],
        message: `${placement.terrain} wirft nichts ab und darf keinen Zahlenchip tragen`,
      });
    }
  });

  if (!onBoard.has(scenario.robberStart)) {
    ctx.addIssue({
      code: 'custom',
      path: ['robberStart'],
      message: `Der Raeuber startet auf ${scenario.robberStart}, das nicht zum Brett gehoert`,
    });
  }

  if (!isConnected(hexIds)) {
    ctx.addIssue({
      code: 'custom',
      path: ['hexes'],
      message: 'Die Felder haengen nicht zusammen',
    });
  }

  const usedEdges = new Set<string>();
  scenario.harbors.forEach((harbor, index) => {
    if (usedEdges.has(harbor.edge)) {
      ctx.addIssue({
        code: 'custom',
        path: ['harbors', index, 'edge'],
        message: `Auf der Kante ${harbor.edge} liegt bereits ein Hafen`,
      });
    }
    usedEdges.add(harbor.edge);

    // Ein Hafen sitzt an der Kueste: genau eines der beiden Felder gehoert zum
    // Brett. Im Inneren waere er unerreichbar, ganz ausserhalb sinnlos.
    const touching = edgeHexes(harbor.edge).filter((hex) => onBoard.has(hexToId(hex)));
    if (touching.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['harbors', index, 'edge'],
        message: `Die Kante ${harbor.edge} ist keine Kuestenkante (${touching.length} angrenzende Felder auf dem Brett, erwartet genau eines)`,
      });
    }
  });
});

export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;
