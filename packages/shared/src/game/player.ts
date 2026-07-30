import { z } from 'zod';

import { PieceIdSchema, ResourceAmountsSchema } from '../rules/index.js';

/**
 * Ein Spieler aus Sicht der Spiellogik.
 *
 * `PlayerId` ist die `user_id` aus Regel 7 - auch Gaeste haben eine. Name,
 * Farbe und Verbindungsstatus gehoeren nicht hierher: die Logik rechnet mit
 * Identitaeten, nicht mit Anzeigeeigenschaften. Was am Bildschirm steht,
 * entscheidet Etappe 3.
 *
 * Was ein Spieler gebaut hat, steht nicht hier, sondern in der Belegung von
 * Knoten und Kanten im `GameState` - sonst gaebe es zwei Wahrheiten darueber,
 * wem eine Siedlung gehoert.
 */

export const PlayerIdSchema = z.string().min(1);

export type PlayerId = z.infer<typeof PlayerIdSchema>;

export const PlayerStateSchema = z.object({
  id: PlayerIdSchema,
  /** Die Handkarten. Ab Etappe 5 die geheime Haelfte. */
  resources: ResourceAmountsSchema,
  /** Wie viele Teile noch im Vorrat liegen. Aufgebraucht heisst: nicht mehr baubar. */
  piecesLeft: z.record(PieceIdSchema, z.number().int().min(0)),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;
