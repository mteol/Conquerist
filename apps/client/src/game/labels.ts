import {
  RESOURCE_IDS,
  type HarborDefinition,
  type ResourceAmounts,
  type ResourceId,
  type TerrainId,
} from '@conquerist/shared';

/**
 * Anzeigetexte und Farben - der einzige Ort, an dem aus Ids Deutsch wird.
 *
 * `shared` bleibt englisch, weil dort die Ids stehen, die ab Etappe 6 in der
 * Datenbank landen. Uebersetzt wird an der Oberflaeche, einmal.
 */
export const RESOURCE_LABELS: Readonly<Record<ResourceId, string>> = {
  brick: 'Lehm',
  lumber: 'Holz',
  wool: 'Wolle',
  grain: 'Korn',
  ore: 'Erz',
};

export const TERRAIN_LABELS: Readonly<Record<TerrainId, string>> = {
  hills: 'Huegel',
  forest: 'Wald',
  pasture: 'Weide',
  fields: 'Feld',
  mountains: 'Gebirge',
  desert: 'Wueste',
};

/** Gelaendefarben - kraeftig genug, dass die Zahlenchips darauf lesbar bleiben. */
export const TERRAIN_COLORS: Readonly<Record<TerrainId, string>> = {
  hills: '#b4623a',
  forest: '#2f6b3a',
  pasture: '#7fb069',
  fields: '#e0b34a',
  mountains: '#8a8f98',
  desert: '#ddc9a3',
};

/** „3:1 beliebig" oder „2:1 Erz". */
export function harborLabel(harbor: HarborDefinition): string {
  return harbor.resource === undefined
    ? `${harbor.ratio}:1 beliebig`
    : `${harbor.ratio}:1 ${RESOURCE_LABELS[harbor.resource]}`;
}

/** Zaehlt eine Kartenmenge auf; leer bleibt nicht leer, sondern wird benannt. */
export function resourceList(amounts: ResourceAmounts): string {
  const parts = RESOURCE_IDS.filter((resource) => (amounts[resource] ?? 0) > 0).map(
    (resource) => `${amounts[resource] ?? 0} ${RESOURCE_LABELS[resource]}`,
  );

  return parts.length === 0 ? 'nichts' : parts.join(', ');
}
