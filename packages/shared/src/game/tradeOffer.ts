import { z } from 'zod';

import { ResourceAmountsSchema } from '../rules/index.js';
import { PlayerIdSchema } from './player.js';

/**
 * Die Datentypen des Spielerhandels - nur Form, keine Regel.
 *
 * Eigene Datei und nicht in `playerTrade.ts`: `phase.ts` braucht die Schemas,
 * und die Regeln brauchen `state.ts`, das wiederum `phase.ts` braucht. Ohne
 * diese Trennung stuenden zur Ladezeit drei Module im Kreis.
 */

export const TradeOfferSchema = z.object({
  from: PlayerIdSchema,
  /** Was der Anbieter hergibt. */
  give: ResourceAmountsSchema,
  /** Was er dafuer will. */
  want: ResourceAmountsSchema,
});

export type TradeOffer = z.infer<typeof TradeOfferSchema>;

/**
 * Die Antwort eines Mitspielers. Genau eine je Spieler.
 *
 * `automatic` unterscheidet die Ablehnung, die jemand ausgesprochen hat, von
 * der, die aus einem Verbindungsverlust entstanden ist. Nur die zweite wird bei
 * der Rueckkehr wieder zurueckgenommen - Gesprochenes bleibt stehen.
 */
export const TradeResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('accepted') }),
  z.object({ kind: z.literal('declined'), automatic: z.boolean() }),
  z.object({
    kind: z.literal('countered'),
    /** Aus Sicht des Konternden: was **er** hergibt. */
    give: ResourceAmountsSchema,
    want: ResourceAmountsSchema,
  }),
]);

export type TradeResponse = z.infer<typeof TradeResponseSchema>;
