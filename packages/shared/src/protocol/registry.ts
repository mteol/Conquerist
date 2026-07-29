import type { z } from 'zod';
import { PING, PONG, PingRequestSchema, PongResponseSchema } from './ping.js';

/**
 * Protokoll-Registry: die einzige Quelle fuer Request- und Response-Typen.
 *
 * Client und Server leiten ihre Signaturen hieraus ab, statt beide Seiten von
 * Hand zu typisieren und die Payload per Cast durchzureichen. Auf der Leitung
 * aendert sich dadurch nichts - der Envelope bleibt `{ id, type, payload }` mit
 * `type: string` und `payload: unknown`. Die Registry existiert ausschliesslich
 * zur Compile-Zeit.
 */

export interface ProtocolEntry {
  /** `type` der Antwortnachricht. Der Router setzt ihn automatisch. */
  readonly responseType: string;
  readonly request: z.ZodType;
  readonly response: z.ZodType;
}

export type ProtocolMap = Readonly<Record<string, ProtocolEntry>>;

export const protocol = {
  [PING]: {
    responseType: PONG,
    request: PingRequestSchema,
    response: PongResponseSchema,
  },
} as const satisfies ProtocolMap;

export type Protocol = typeof protocol;

/** Alle registrierten Request-Typen. Ab Etappe 2 wachsen hier die Spielzuege hinein. */
export type MessageType = keyof Protocol & string;

export type RequestOf<K extends MessageType> = z.infer<Protocol[K]['request']>;
export type ResponseOf<K extends MessageType> = z.infer<Protocol[K]['response']>;

export function isMessageType(value: string): value is MessageType {
  return Object.prototype.hasOwnProperty.call(protocol, value);
}

export function protocolEntry<K extends MessageType>(type: K): Protocol[K] {
  return protocol[type];
}
