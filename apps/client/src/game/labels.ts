import {
  CARD_LABELS,
  COMMODITY_LABELS,
  RESOURCE_LABELS,
  TERRAIN_LABELS,
  harborLabel,
  resourceList,
  type CardId,
  type CommodityId,
  type ResourceId,
  type TerrainId,
  type TrackId,
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
export {
  CARD_LABELS,
  COMMODITY_LABELS,
  RESOURCE_LABELS,
  TERRAIN_LABELS,
  harborLabel,
  resourceList,
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

/**
 * Die Farbe einer Handelsware ist die des Gelaendes, aus dem sie kommt.
 *
 * Sie traegt sie aber als **Rand** und nicht als Flaeche - siehe
 * `ResourceCard`. Zwei Karten mit derselben Farbe und derselben Flaeche waeren
 * im Vorbeisehen dieselbe Karte, und man haelt Holz und Papier gleichzeitig
 * auf der Hand.
 */
export const COMMODITY_COLORS: Readonly<Record<CommodityId, string>> = {
  paper: TERRAIN_COLORS.forest,
  cloth: TERRAIN_COLORS.pasture,
  coin: TERRAIN_COLORS.mountains,
};

/** Die Farbe zu jeder Kartensorte - Rohstoff wie Handelsware. */
export const CARD_COLORS: Readonly<Record<CardId, string>> = {
  ...RESOURCE_COLORS,
  ...COMMODITY_COLORS,
};

/**
 * Die Farbe eines Bereichs - kein eigener Hex-Wert, sondern ein Zeiger auf
 * `index.css`. Dort stehen `--track-trade`, `--track-politics` und
 * `--track-science` schon für die Würfelseiten der Barbaren
 * (`.die__event-gate--*`); der Metropolenaufsatz auf dem Brett nutzt dieselbe
 * Variable, statt eine zweite Palette anzulegen, die mit der ersten
 * auseinanderlaufen könnte.
 */
export const TRACK_COLORS: Readonly<Record<TrackId, string>> = {
  trade: 'var(--track-trade)',
  politics: 'var(--track-politics)',
  science: 'var(--track-science)',
};
