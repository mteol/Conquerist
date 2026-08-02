/**
 * Verbindungszustand als Maschine, nicht als Boolean.
 *
 * Ein `isConnected: boolean` reicht nicht: die UI muss "wir versuchen es
 * gerade wieder" von "endgueltig zu" unterscheiden koennen, und sie braucht
 * Versuchszaehler und naechsten Versuchszeitpunkt, um "neu verbinden in 3s"
 * samt Sofort-Button anzeigen zu koennen, ohne den Transport anzufassen.
 */
export type ConnectionStatus =
  /** Erster Verbindungsaufbau laeuft. */
  | 'connecting'
  /** Verbindung steht, Requests sind moeglich. */
  | 'open'
  /** Verbindung war weg, Backoff laeuft oder ein Versuch ist unterwegs. */
  | 'reconnecting'
  /** Bewusst geschlossen. Es laeuft kein Wiederverbindungsversuch. */
  | 'closed';

export interface ConnectionState {
  readonly status: ConnectionStatus;
  /** Zahl der fehlgeschlagenen Versuche seit der letzten offenen Verbindung. */
  readonly attempt: number;
  /** Zeitstempel des naechsten geplanten Versuchs, `null` wenn keiner geplant ist. */
  readonly nextRetryAt: number | null;
  /** Letzte gemessene Umlaufzeit in ms. */
  readonly rttMs: number | null;
  /** `Date.now() + clockOffsetMs` ergibt die Server-Uhr. */
  readonly clockOffsetMs: number | null;
  /** Grund des letzten Verbindungsverlusts, fuer die Anzeige. */
  readonly lastError: string | null;
}

export type ConnectionListener = (state: ConnectionState) => void;

/**
 * Empfaenger fuer Nachrichten ohne Anfrage.
 *
 * Die Payload bleibt `unknown`: welches Schema fuer welchen Typ gilt, weiss die
 * Ereignis-Registry in `shared`. Der Transport reicht durch und deutet nicht -
 * sonst muesste er das Spiel kennen.
 */
export type ServerEventListener = (type: string, payload: unknown) => void;

/**
 * Minimale Form eines WebSockets.
 *
 * Der Transport programmiert gegen dieses Interface statt gegen den globalen
 * `WebSocket`, damit die Tests eine Attrappe einsetzen koennen - ohne jsdom,
 * ohne offenen Port.
 */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

/** `WebSocket.OPEN`, numerisch - damit types.ts keine DOM-Konstante braucht. */
export const SOCKET_OPEN = 1;
