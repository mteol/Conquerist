import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { ServerMessage } from '@conquerist/shared';
import { createEventSender, type EventSink } from './events.js';
import type { Session } from './router.js';

/**
 * Wrapper um eine einzelne WebSocket-Verbindung.
 *
 * Zweck: die Anwendung soll nie direkt auf einem `ws`-Objekt arbeiten. Seit
 * Etappe 4 haengen Sitzung und Ereignissenke hier - beide muessen die einzelne
 * Nachricht ueberdauern, und die Verbindung ist genau das, was so lange lebt.
 */
export class Connection {
  readonly id: string;

  /**
   * Wer an dieser Leitung sitzt. Startet leer; `hello` fuellt sie.
   *
   * Der Server liest die Identitaet ausschliesslich hier und nie aus einer
   * eingehenden Nachricht - sonst koennte sich jeder als jeder ausgeben.
   */
  readonly session: Session = { userId: null, roomCode: null };

  /** Ungefragtes Senden, jede Nachricht vorher gegen ihr Schema geprueft. */
  readonly events: EventSink;

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
    /**
     * Wird gerufen, wenn ein Ereignis sein eigenes Schema verletzt. Es geht
     * dann NICHT hinaus - der Aufrufer soll es laut protokollieren.
     */
    onInvalidEvent: (type: string, message: string) => void = () => undefined,
  ) {
    this.id = randomUUID();
    this.events = createEventSender((raw) => {
      if (this.isOpen) this.socket.send(raw);
    }, onInvalidEvent);
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
