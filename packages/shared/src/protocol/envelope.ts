import { z } from 'zod';

/**
 * Transport-Envelope fuer alle WebSocket-Nachrichten.
 *
 * Wichtig: Die exportierten Typen werden ausnahmslos aus den Zod-Schemas
 * abgeleitet (`z.infer`) und niemals danebengeschrieben. Grund ist
 * `exactOptionalPropertyTypes`: ein handgeschriebenes `replyTo?: string` ist
 * nicht zuweisungskompatibel zu dem, was Zod fuer `.optional()` inferiert
 * (`replyTo?: string | undefined`). Ein Schema, eine Wahrheit, keine Casts.
 */

/** Fehlercodes, die der Transport selbst erzeugt - vor jeder Anwendungslogik. */
export const ProtocolErrorCode = {
  /** Nachricht war kein gueltiges JSON. */
  BAD_JSON: 'BAD_JSON',
  /** JSON war gueltig, entsprach aber nicht dem Envelope-Schema. */
  BAD_ENVELOPE: 'BAD_ENVELOPE',
  /** Envelope war gueltig, aber fuer `type` ist kein Handler registriert. */
  UNKNOWN_TYPE: 'UNKNOWN_TYPE',
  /** Handler existiert, aber die Payload hat sein Schema nicht bestanden. */
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  /**
   * Der Handler hat abgelehnt, und der Aufrufer darf wissen warum.
   *
   * Der Unterschied zu `INTERNAL` ist der Adressat: „Der Tisch ist voll" ist
   * eine Auskunft an den Spieler, „Datenbank weg" eine an den Betreiber. Beides
   * als Serverfehler auszugeben, macht das eine unbrauchbar und das andere
   * gespraechig.
   */
  REJECTED: 'REJECTED',
  /** Der Handler hat unerwartet geworfen. Der Grund bleibt im Log. */
  INTERNAL: 'INTERNAL',
} as const;

export type ProtocolErrorCode = (typeof ProtocolErrorCode)[keyof typeof ProtocolErrorCode];

export const ProtocolErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
});

export type ProtocolError = z.infer<typeof ProtocolErrorSchema>;

/** Client -> Server. `id` korreliert die Antwort, `payload` ist erst nach Handler-Validierung typisiert. */
export const ClientMessageSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
});

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Server -> Client. `replyTo` fehlt bei Broadcasts und bei Fehlern ohne verwertbare `id`. */
export const ServerMessageSchema = z.object({
  replyTo: z.string().min(1).optional(),
  type: z.string().min(1),
  ok: z.boolean(),
  error: ProtocolErrorSchema.optional(),
  payload: z.unknown().optional(),
});

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

/**
 * Baut eine Erfolgsantwort.
 *
 * Optionale Felder werden bedingt gespreizt statt auf `undefined` gesetzt -
 * unter `exactOptionalPropertyTypes` ist `{ replyTo: undefined }` etwas anderes
 * als ein fehlender Schluessel, und auf der Leitung soll der Schluessel fehlen.
 */
export function successMessage(
  type: string,
  payload: unknown,
  replyTo?: string | undefined,
): ServerMessage {
  return {
    type,
    ok: true,
    ...(replyTo === undefined ? {} : { replyTo }),
    ...(payload === undefined ? {} : { payload }),
  };
}

/** Baut eine Fehlerantwort. `replyTo` fehlt, wenn die Anfrage keine verwertbare `id` hatte. */
export function errorMessage(
  code: ProtocolErrorCode | string,
  message: string,
  replyTo?: string | undefined,
): ServerMessage {
  return {
    type: 'error',
    ok: false,
    error: { code, message },
    ...(replyTo === undefined ? {} : { replyTo }),
  };
}

/**
 * Rettet die Korrelations-ID aus einer Nachricht, die das Envelope-Schema
 * NICHT bestanden hat. Ohne das bekaeme der Client bei einem kaputten Envelope
 * eine Antwort ohne `replyTo` und muesste seinen Request ins Timeout laufen
 * lassen, statt ihn sofort abzulehnen.
 */
export function salvageCorrelationId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const id = (value as Record<string, unknown>)['id'];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * Verdichtet Zod-Issues zu einer Zeile, die im Client-Log brauchbar ist.
 * Strukturell typisiert statt gegen `z.ZodIssue`, damit ein Zod-Major-Update
 * nicht diese Datei anfasst.
 */
export function formatIssues(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}
