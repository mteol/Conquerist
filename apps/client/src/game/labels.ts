import {
  RESOURCE_LABELS,
  TERRAIN_LABELS,
  harborLabel,
  resourceList,
  type ResourceId,
  type TerrainId,
} from '@conquerist/shared';

/**
 * Farben der Oberflaeche - und die Woerter aus `shared` zum Durchreichen.
 *
 * Die deutschen Bezeichnungen stehen seit Etappe 4 in
 * `packages/shared/src/game/labels.ts`, weil der Server den Verlaufssatz baut.
 * Die Farben sind hier geblieben: sie muessen mit den Variablen in `index.css`
 * uebereinstimmen, und dort haben sie ihren zweiten Ort. Wer eine aendert,
 * aendert beide.
 */
export { RESOURCE_LABELS, TERRAIN_LABELS, harborLabel, resourceList };

/** Gelaendefarben - kraeftig genug, dass die Zahlenchips darauf lesbar bleiben. */
export const TERRAIN_COLORS: Readonly<Record<TerrainId, string>> = {
  hills: '#b4623a',
  forest: '#2f6b3a',
  pasture: '#7fb069',
  fields: '#e0b34a',
  mountains: '#8a8f98',
  desert: '#ddc9a3',
};

/**
 * Die Farbe einer Ressource ist die Farbe des Gelaendes, das sie abwirft.
 *
 * Keine zweite Farbwelt: wer Lehm sucht, sucht die Farbe der Huegel. Genutzt
 * fuer die Hafenmarken und die Kartenstapel in den Dialogen.
 */
export const RESOURCE_COLORS: Readonly<Record<ResourceId, string>> = {
  brick: TERRAIN_COLORS.hills,
  lumber: TERRAIN_COLORS.forest,
  wool: TERRAIN_COLORS.pasture,
  grain: TERRAIN_COLORS.fields,
  ore: TERRAIN_COLORS.mountains,
};
