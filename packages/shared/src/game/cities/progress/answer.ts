import { z } from 'zod';

import { CardAmountsSchema } from '../../../rules/index.js';
import { CommodityIdSchema, ResourceIdSchema } from '../../../scenario/index.js';
import { PlayerIdSchema } from '../../player.js';
import { ProgressCardIdSchema } from './cards.js';

/**
 * Was eine wartende Fortschrittskarte als Antwort bekommt, und was zwischen
 * zwei Runden feststeht (Spec 5.3, Korrektur vom 2026-09-02).
 *
 * **Eine Union unter einer Aktion** (`answerProgress`), dieselbe Grenze wie
 * `ProgressPlaySchema` unter `playProgress`. Nur zwei der fuenf Antworten sind
 * ein Kartenbuendel - die Spionage antwortet mit einer Karte, der Deserteur mit
 * einer Kreuzung -, und `tsc` prueft den Verteiler in `answerRules.ts` so
 * erschoepfend wie den der Karten.
 *
 * Geantwortet wird bei Hochzeit und Handelshafen von den anderen, bei
 * Spionage und Grosshaendler vom Spielenden selbst nach dem Blick in die fremde
 * Hand, beim Deserteur erst vom Opfer und dann vom Spielenden.
 */
export const ProgressAnswerSchema = z.discriminatedUnion('card', [
  /** Genau zwei Karten, oder alle, wer weniger hat. */
  z.object({ card: z.literal('wedding'), gift: CardAmountsSchema }),
  z.object({ card: z.literal('tradeHarbor'), commodity: CommodityIdSchema }),
  z.object({ card: z.literal('spy'), take: ProgressCardIdSchema }),
  /** Genau zwei Karten, oder alle, wenn das Opfer weniger hat. */
  z.object({ card: z.literal('masterMerchant'), take: CardAmountsSchema }),
  /** Runde 1: welcher eigene Ritter faellt. Runde 2: wohin der Ueberlaeufer kommt. */
  z.object({ card: z.literal('deserter'), vertex: z.string() }),
]);

export type ProgressAnswer = z.infer<typeof ProgressAnswerSchema>;

/** Die fuenf Karten, die auf eine Antwort warten. */
export type WaitingCard = ProgressAnswer['card'];

/**
 * Was waehrend der Phase feststeht - je Karte.
 *
 * **Die Karte steht nur hier**, nicht zusaetzlich an der Phase: zwei Felder
 * fuer dieselbe Aussage waeren zwei Wahrheiten.
 *
 * Beim Deserteur heisst `replacement === null` Runde 1 (das Opfer waehlt), ein
 * gesetzter Wert Runde 2 (der Spielende setzt). Die Stufe darin ist schon die
 * **erzwungene** Ersatzstufe, nicht die gefallene - siehe `deserter.ts`.
 */
export const ProgressPendingPayloadSchema = z.discriminatedUnion('card', [
  z.object({ card: z.literal('wedding') }),
  z.object({ card: z.literal('tradeHarbor'), resource: ResourceIdSchema }),
  z.object({ card: z.literal('spy'), victim: PlayerIdSchema }),
  z.object({ card: z.literal('masterMerchant'), victim: PlayerIdSchema }),
  z.object({
    card: z.literal('deserter'),
    victim: PlayerIdSchema,
    replacement: z
      .object({
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        active: z.boolean(),
      })
      .nullable(),
  }),
]);

export type ProgressPendingPayload = z.infer<typeof ProgressPendingPayloadSchema>;
