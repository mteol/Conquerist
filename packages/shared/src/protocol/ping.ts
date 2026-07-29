import { z } from 'zod';

/**
 * Anwendungsnachricht "ping"/"pong".
 *
 * ACHTUNG - nicht mit dem Heartbeat verwechseln. Es gibt zwei Ebenen:
 *
 *   1. WebSocket-Protokoll-Ping (RFC 6455 Control Frame).
 *      Liegt unterhalb der Anwendung, ist in `apps/server/src/ws/heartbeat.ts`
 *      implementiert und im Browser-JavaScript ueberhaupt nicht sichtbar.
 *      Zweck: der Server erkennt toten Clients.
 *
 *   2. Diese Nachricht hier. Laeuft als normaler Request durch Envelope,
 *      Router und Zod-Validierung. Zweck: der Client messt RTT, schaetzt den
 *      Uhrenversatz und erkennt halb offene Verbindungen - denn Ebene 1 kann
 *      er von sich aus nicht beobachten.
 */

export const PING = 'ping';
export const PONG = 'pong';

/** Ping tragt (noch) keine Nutzdaten. Leeres Objekt statt `null`, damit spaeter Felder ergaenzt werden koennen. */
export const PingRequestSchema = z.object({});

export type PingRequest = z.infer<typeof PingRequestSchema>;

/**
 * `serverTime` ist die Server-Uhr in Millisekunden seit Epoch.
 * Der Client leitet daraus zusammen mit dem gemessenen RTT den Uhrenversatz ab
 * (NTP-Prinzip). Ab Etappe 5 haengen daran Zug-Timer und synchrone Animationen.
 */
export const PongResponseSchema = z.object({
  serverTime: z.number().int().nonnegative(),
});

export type PongResponse = z.infer<typeof PongResponseSchema>;
