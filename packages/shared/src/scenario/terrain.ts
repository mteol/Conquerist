import { z } from 'zod';

/**
 * Gelaendearten und Ressourcen.
 *
 * Beides sind String-Ids und keine festen Felder eines Objekts - Regel 5:
 * Ressourcen und Bauteile werden als `Record<Id, number>` gefuehrt. Eine
 * sechste Ressource ist damit ein Eintrag in einer Liste und nicht ein
 * Umbau jeder Struktur, die Ressourcen anfasst.
 */

/** Die handelbaren Ressourcen. Die Wueste liefert keine. */
export const RESOURCE_IDS = ['brick', 'lumber', 'wool', 'grain', 'ore'] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];

export const ResourceIdSchema = z.enum(RESOURCE_IDS);

/** Die Gelaendearten des Basisspiels. */
export const TERRAIN_IDS = ['hills', 'forest', 'pasture', 'fields', 'mountains', 'desert'] as const;

export type TerrainId = (typeof TERRAIN_IDS)[number];

export const TerrainIdSchema = z.enum(TERRAIN_IDS);

/**
 * Was ein Feld abwirft. `null` heisst: nichts - das ist die Wueste.
 *
 * Bewusst `null` und nicht ein fehlender Schluessel: so erzwingt der Compiler
 * einen Eintrag, sobald jemand eine Gelaendeart hinzufuegt.
 */
export const TERRAIN_YIELD: Readonly<Record<TerrainId, ResourceId | null>> = {
  hills: 'brick',
  forest: 'lumber',
  pasture: 'wool',
  fields: 'grain',
  mountains: 'ore',
  desert: null,
};

/** Die Ressource eines Gelaendes, oder `null` bei der Wueste. */
export function terrainYield(terrain: TerrainId): ResourceId | null {
  return TERRAIN_YIELD[terrain];
}

/** Ob auf diesem Gelaende ein Zahlenchip liegen muss. */
export function producesResource(terrain: TerrainId): boolean {
  return TERRAIN_YIELD[terrain] !== null;
}

/**
 * Die moeglichen Zahlenchips. Die Sieben fehlt: sie ruft den Raeuber und liegt
 * deshalb auf keinem Feld.
 */
export const CHIP_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const;

export type ChipNumber = (typeof CHIP_NUMBERS)[number];

/**
 * Augenwahrscheinlichkeit ("Pips") je Zahlenchip: die Anzahl der Wuerfelpaare,
 * die diese Summe ergeben. Die 6 und die 8 sind mit je fuenf Wegen die
 * ertragreichsten, die 2 und die 12 mit je einem die schwaechsten.
 *
 * Grundlage der Fairnessbedingung, die den Ueber-Knoten und die tote Brettecke
 * verhindert - siehe `fairness.ts`.
 */
export const CHIP_PIPS: Readonly<Record<ChipNumber, number>> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

/** Pips eines Chips; `0`, wenn kein Chip liegt (Wueste). */
export function chipPips(chip: number | undefined): number {
  if (chip === undefined) return 0;
  return CHIP_PIPS[chip as ChipNumber] ?? 0;
}

export const ChipSchema = z
  .number()
  .int()
  .refine((value) => (CHIP_NUMBERS as readonly number[]).includes(value), {
    message: `Zahlenchip muss einer von ${CHIP_NUMBERS.join(', ')} sein (die Sieben ruft den Raeuber)`,
  });
