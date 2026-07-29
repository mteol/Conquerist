import type { ConnectionHub } from './connection.js';

/**
 * HEARTBEAT AUF PROTOKOLL-EBENE.
 *
 * Diese Datei hat nichts mit der Anwendungsnachricht "ping"/"pong" zu tun.
 * Die beiden Ebenen unterscheiden sich vollstaendig:
 *
 *   Diese Ebene (RFC 6455 Control Frames)
 *     - `socket.ping()` / `'pong'`-Event der ws-Bibliothek
 *     - laeuft NICHT durch Envelope, Router oder Zod
 *     - im Browser-JavaScript ueberhaupt nicht beobachtbar
 *     - Zweck: der SERVER erkennt Clients, die weg sind, ohne ein
 *       Close-Frame geschickt zu haben (Stromausfall, Netzwechsel,
 *       halb offenes TCP)
 *
 *   Anwendungsebene (siehe shared/src/protocol/ping.ts)
 *     - normale Nachricht mit Korrelations-ID
 *     - Zweck: der CLIENT messt RTT, schaetzt den Uhrenversatz und erkennt
 *       seinerseits tote Verbindungen - denn diese Ebene hier kann er nicht
 *       beobachten
 *
 * Beide Richtungen sind noetig, weil jede Seite nur ihre eigene Sicht hat.
 */

export const HEARTBEAT_INTERVAL_MS = 30_000;

export interface HeartbeatOptions {
  readonly intervalMs?: number;
  readonly onTerminate?: (connectionId: string) => void;
}

/**
 * Startet das Heartbeat-Intervall und gibt die Stopp-Funktion zurueck.
 *
 * Ablauf pro Tick und Verbindung:
 *   1. `isAlive === false`? Dann kam seit dem letzten Tick kein Pong -> terminate().
 *   2. Sonst `isAlive = false` setzen und einen Protokoll-Ping senden.
 *
 * Das Pong-Event setzt `isAlive` wieder auf true (verdrahtet in `attach.ts`).
 * Eine Verbindung hat damit ein ganzes Intervall Zeit zu antworten; der
 * Worst Case bis zur Erkennung ist knapp zwei Intervalle.
 */
export function startHeartbeat(hub: ConnectionHub, options: HeartbeatOptions = {}): () => void {
  const intervalMs = options.intervalMs ?? HEARTBEAT_INTERVAL_MS;

  const timer = setInterval(() => {
    for (const connection of hub) {
      if (!connection.isAlive) {
        options.onTerminate?.(connection.id);
        connection.terminate();
        hub.remove(connection);
        continue;
      }

      connection.isAlive = false;
      connection.pingProtocol();
    }
  }, intervalMs);

  // Der Heartbeat darf den Prozess nicht am Leben halten.
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
