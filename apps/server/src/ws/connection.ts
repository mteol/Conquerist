import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { ServerMessage } from '@conquerist/shared';

/**
 * Wrapper um eine einzelne WebSocket-Verbindung.
 *
 * Zweck: die Anwendung soll nie direkt auf einem `ws`-Objekt arbeiten. Ab
 * Etappe 4 haengen hier `userId` und `gameId` dran, ohne dass Router oder
 * Handler angepasst werden muessen.
 */
export class Connection {
  readonly id: string;

  /**
   * Heartbeat-Flag auf PROTOKOLL-Ebene (RFC 6455), nicht auf Anwendungsebene.
   * Wird bei jedem eingehenden Protokoll-Pong auf true gesetzt und vom
   * Heartbeat-Intervall auf false zurueckgesetzt. Siehe `heartbeat.ts`.
   */
  isAlive = true;

  /** Wird nach dem ersten close() nicht mehr zurueckgesetzt. */
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    /** Origin des Browsers, wie im Upgrade geprueft. Fuer Logs. */
    readonly origin: string,
  ) {
    this.id = randomUUID();
  }

  get isOpen(): boolean {
    // 1 === WebSocket.OPEN. Numerisch, damit der Wrapper keine ws-Konstante braucht.
    return !this.closed && this.socket.readyState === 1;
  }

  /** Serialisiert und sendet. Auf einer geschlossenen Verbindung ein No-op. */
  send(message: ServerMessage): void {
    if (!this.isOpen) return;
    this.socket.send(JSON.stringify(message));
  }

  /** Protokoll-Ping (Control Frame). Nicht die Anwendungsnachricht "ping". */
  pingProtocol(): void {
    if (!this.isOpen) return;
    this.socket.ping();
  }

  /** Sauberer Close-Handshake. */
  close(code = 1000, reason = 'server closing'): void {
    this.closed = true;
    this.socket.close(code, reason);
  }

  /** Harter Abbruch ohne Handshake - fuer Verbindungen, die nicht mehr antworten. */
  terminate(): void {
    this.closed = true;
    this.socket.terminate();
  }
}

/**
 * Registry aller offenen Verbindungen.
 *
 * Ab Etappe 5 ist das die Basis fuer Broadcasts an einen Spieltisch; in
 * Etappe 0 braucht es sie fuer den Heartbeat und fuer das Herunterfahren.
 */
export class ConnectionHub {
  private readonly connections = new Set<Connection>();

  get size(): number {
    return this.connections.size;
  }

  add(connection: Connection): void {
    this.connections.add(connection);
  }

  remove(connection: Connection): void {
    this.connections.delete(connection);
  }

  [Symbol.iterator](): IterableIterator<Connection> {
    // Kopie: Heartbeat und Shutdown entfernen waehrend der Iteration Eintraege.
    return [...this.connections][Symbol.iterator]();
  }

  closeAll(code = 1001, reason = 'server shutting down'): void {
    for (const connection of this) {
      connection.close(code, reason);
    }
    this.connections.clear();
  }
}
