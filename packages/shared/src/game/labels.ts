import type { CardAmounts } from '../rules/ruleset.js';
import type { HarborDefinition } from '../scenario/harbor.js';
import {
  CARD_IDS,
  type CardId,
  type CommodityId,
  type ResourceId,
  type TerrainId,
} from '../scenario/terrain.js';

/**
 * Die deutschen Woerter zu den Ids.
 *
 * Stand bis Etappe 3 vollstaendig im Client, weil nur er etwas anzeigte. Seit
 * Etappe 4 baut der **Server** den Verlaufssatz (`log.ts`) - er ist der
 * einzige, der beide Zustaende kennt, und der Client sieht fremde Haende nicht
 * mehr. Damit brauchen beide Seiten dieselben Woerter.
 *
 * Was NICHT mitgewandert ist: die Farben. Die stehen weiter in
 * `apps/client/src/game/labels.ts`, direkt neben den Variablen in `index.css`,
 * mit denen sie uebereinstimmen muessen. Der Server hat fuer eine Farbe keine
 * Verwendung, und zwei Orte fuer dieselbe Farbe waeren zwei Wahrheiten.
 */
export const RESOURCE_LABELS: Readonly<Record<ResourceId, string>> = {
  brick: 'Lehm',
  lumber: 'Holz',
  wool: 'Wolle',
  grain: 'Korn',
  ore: 'Erz',
};

/**
 * Die Handelswaren aus Staedte & Ritter.
 *
 * "Muenzen" steht im Plural, weil die Karte so heisst - eine einzelne Muenze
 * gibt es im Spiel nicht.
 */
export const COMMODITY_LABELS: Readonly<Record<CommodityId, string>> = {
  paper: 'Papier',
  cloth: 'Tuch',
  coin: 'Münzen',
};

/** Das deutsche Wort zu jeder Kartensorte - Rohstoff wie Handelsware. */
export const CARD_LABELS: Readonly<Record<CardId, string>> = {
  ...RESOURCE_LABELS,
  ...COMMODITY_LABELS,
};

export const TERRAIN_LABELS: Readonly<Record<TerrainId, string>> = {
  hills: 'Hügel',
  forest: 'Wald',
  pasture: 'Weide',
  fields: 'Feld',
  mountains: 'Gebirge',
  desert: 'Wüste',
};

/** „3:1 beliebig" oder „2:1 Erz". */
export function harborLabel(harbor: HarborDefinition): string {
  return harbor.resource === undefined
    ? `${harbor.ratio}:1 beliebig`
    : `${harbor.ratio}:1 ${RESOURCE_LABELS[harbor.resource]}`;
}

/** Zaehlt eine Kartenmenge auf; leer bleibt nicht leer, sondern wird benannt. */
export function resourceList(amounts: CardAmounts): string {
  /*
   * Ueber `CARD_IDS` und nicht ueber `RESOURCE_IDS`: eine Handelsware liegt
   * auf derselben Hand und geht ueber denselben Tisch. In einer Basispartie
   * steht trotzdem nie eine dabei - dort ist ihre Menge null, und was null
   * ist, wird nicht genannt.
   */
  const parts = CARD_IDS.filter((card) => (amounts[card] ?? 0) > 0).map(
    (card) => `${amounts[card] ?? 0} ${CARD_LABELS[card]}`,
  );

  return parts.length === 0 ? 'nichts' : parts.join(', ');
}
