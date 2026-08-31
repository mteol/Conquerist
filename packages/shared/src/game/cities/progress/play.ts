import { z } from 'zod';

import { CardIdSchema, CommodityIdSchema, ResourceIdSchema } from '../../../scenario/index.js';
import { TrackIdSchema } from '../tracks.js';

/**
 * Was eine Fortschrittskarte zum Spielen braucht.
 *
 * Fuenfundzwanzig Eintraege in `GameActionSchema` wuerden die Hauptunion
 * verdoppeln und die Erweiterung ueber die Datei verteilen. Deshalb eine
 * eigene Union unter **einer** Aktion (`playProgress`) - dieselbe Grenze wie
 * bei den Entwicklungskarten in `developmentRules.ts`.
 *
 * Die fuenf Karten, die auf eine fremde Antwort warten, fehlen hier: sie
 * kommen mit ihrer Phase erst in 10d-2 (`masterMerchant`, `spy`, `deserter`,
 * `tradeHarbor`, `wedding`). An diesem Tisch (`CITIES_RULES.progressDecks`)
 * liegen sie ohnehin nicht.
 *
 * **`DieValueSchema` gibt es nicht.** `dice.ts` exportiert nur
 * `DieResultSchema` und `RollSchema`, keinen Typ fuer eine einzelne Augenzahl.
 * Fuer Alchemie steht die Zahl deshalb inline und ohne eigenen exportierten
 * Typ.
 */
export const ProgressPlaySchema = z.discriminatedUnion('card', [
  /** Vor dem Wurf: beide Wuerfel bestimmen. */
  z.object({
    card: z.literal('alchemist'),
    first: z.number().int().min(1).max(6),
    second: z.number().int().min(1).max(6),
  }),
  /** Kran: welcher Ausbau in diesem Zug billiger wird. */
  z.object({ card: z.literal('crane'), track: TrackIdSchema }),
  z.object({ card: z.literal('mining') }),
  z.object({ card: z.literal('irrigation') }),
  z.object({ card: z.literal('printer') }),
  /** Erfinder: zwei Zahlenchips tauschen. */
  z.object({ card: z.literal('inventor'), a: z.string(), b: z.string() }),
  /** Ingenieur: wo die gratis Stadtmauer hinkommt. */
  z.object({ card: z.literal('engineer'), vertex: z.string() }),
  /** Medizin: welche Siedlung zur Stadt wird. */
  z.object({ card: z.literal('medicine'), vertex: z.string() }),
  /** Schmied: bis zu zwei Ritter, die je eine Stufe steigen. */
  z.object({ card: z.literal('smith'), vertices: z.array(z.string()).max(2) }),
  /** Strassenbau: bis zu zwei gratis Strassen. */
  z.object({ card: z.literal('roadBuilding'), edges: z.array(z.string()).max(2) }),
  /** Haendler: wohin die Figur kommt. */
  z.object({ card: z.literal('merchant'), hex: z.string() }),
  z.object({ card: z.literal('resourceMonopoly'), resource: ResourceIdSchema }),
  z.object({ card: z.literal('commodityMonopoly'), commodity: CommodityIdSchema }),
  /** Handelsflotte: welche Sorte bis Zugende beliebig oft 2:1 geht. */
  z.object({ card: z.literal('merchantFleet'), sort: CardIdSchema }),
  /** Bischof: wohin der Raeuber versetzt wird. */
  z.object({ card: z.literal('bishop'), hex: z.string() }),
  /**
   * Diplomat: welche Strasse entfernt wird, und wo die eigene sofort neu
   * gesetzt wird - `rebuildAt` fehlt, wenn es dafuer keine passende Kante gibt.
   */
  z.object({
    card: z.literal('diplomat'),
    edge: z.string(),
    rebuildAt: z.string().optional(),
  }),
  z.object({ card: z.literal('warlord') }),
  /** Intrige: welcher fremde Ritter vertrieben wird. */
  z.object({ card: z.literal('intrigue'), vertex: z.string() }),
  z.object({ card: z.literal('saboteur') }),
  z.object({ card: z.literal('constitution') }),
]);

export type ProgressPlay = z.infer<typeof ProgressPlaySchema>;
