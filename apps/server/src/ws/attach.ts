import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { WS_PATH } from '@conquerist/shared';
import type { ServerConfig } from '../config.js';
import { Connection, ConnectionHub } from './connection.js';
import { startHeartbeat } from './heartbeat.js';
import type { EventSink } from './events.js';
import type { MessageRouter, Session } from './router.js';

/** Board-Nachrichten sind klein. Ein Limit verhindert, dass jemand Speicher belegt. */
const MAX_PAYLOAD_BYTES = 64 * 1024;

export interface AttachOptions {
  readonly httpServer: HttpServer;
  readonly config: ServerConfig;
  readonly router: MessageRouter;
  readonly log: Logger;
  /**
   * Wird beim Schliessen einer Verbindung gerufen. Kein Client fragt danach,
   * deshalb ist es kein Handler - der Tisch muss es trotzdem erfahren.
   */
  readonly onClosed?: (session: Session, events: EventSink) => void;
}

/** Minimale Logger-Form, damit diese Datei nicht an Fastify haengt. */
export interface Logger {
  info(payload: unknown, message?: string): void;
  warn(payload: unknown, message?: string): void;
  error(payload: unknown, message?: string): void;
}

export interface WebSocketRuntime {
  readonly hub: ConnectionHub;
  close(): Promise<void>;
}

/**
 * Haengt einen rohen `ws`-Server manuell an den Fastify-HTTP-Server.
 *
 * `noServer: true` bedeutet: `ws` bringt keinen eigenen HTTP-Server mit und
 * uebernimmt den Upgrade nur, wenn wir ihn explizit uebergeben. Genau dieses
 * Fenster brauchen wir fuer die Origin-Pruefung.
 */
export function attachWebSocketServer(options: AttachOptions): WebSocketRuntime {
  const { httpServer, config, router, log, onClosed } = options;

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_PAYLOAD_BYTES,
    // Aus: Kompression kostet bei kleinen Frames mehr Latenz und CPU als sie
    // Bytes spart. Fuer ein rundenbasiertes Spiel mit Nachrichten im
    // dreistelligen Byte-Bereich ist das der falsche Handel.
    perMessageDeflate: false,
  });

  const hub = new ConnectionHub();

  /**
   * ORIGIN-PRUEFUNG VOR DEM HANDSHAKE.
   *
   * Der Check sitzt im `upgrade`-Listener und damit vor `handleUpgrade`. Fuer
   * einen fremden Origin entsteht nie eine WebSocket-Instanz - nach dem
   * Handshake waere die Verbindung bereits etabliert und eine Ablehnung nur
   * noch Kosmetik.
   */
  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const { pathname } = new URL(request.url ?? '/', 'http://placeholder.invalid');

    if (pathname !== WS_PATH) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    const origin = request.headers.origin;

    if (origin === undefined || !config.clientOrigins.includes(origin)) {
      log.warn(
        { origin: origin ?? '(fehlt)', allowed: config.clientOrigins },
        'WebSocket-Upgrade abgelehnt: Origin nicht erlaubt',
      );
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      handleConnection(ws, origin);
    });
  };

  function handleConnection(ws: WebSocket, origin: string): void {
    const connection = new Connection(ws, origin, (type, message) => {
      // Zurueckgehalten statt verschickt: ein Ereignis, das sein Schema
      // verletzt, koennte Verdecktes tragen (Regel 4).
      log.error({ connectionId: connection.id, type, message }, 'Ereignis verletzt sein Schema');
    });
    hub.add(connection);
    log.info({ connectionId: connection.id, origin, open: hub.size }, 'WebSocket verbunden');

    // Protokoll-Ebene: bestaetigt dem Heartbeat, dass der Client lebt.
    // Hat nichts mit der Anwendungsnachricht "pong" zu tun.
    ws.on('pong', () => {
      connection.isAlive = true;
    });

    ws.on('message', (data, isBinary) => {
      void (async () => {
        if (isBinary) {
          // Etappe 0 spricht ausschliesslich JSON-Text.
          connection.close(1003, 'binary frames not supported');
          return;
        }

        const response = await router.dispatch(data.toString(), {
          connectionId: connection.id,
          receivedAt: Date.now(),
          session: connection.session,
          events: connection.events,
        });

        connection.send(response);
      })();
    });

    ws.on('error', (error) => {
      log.error({ connectionId: connection.id, err: error }, 'WebSocket-Fehler');
    });

    ws.on('close', (code, reason) => {
      hub.remove(connection);
      onClosed?.(connection.session, connection.events);
      log.info(
        {
          connectionId: connection.id,
          code,
          reason: reason.toString(),
          open: hub.size,
        },
        'WebSocket getrennt',
      );
    });
  }

  httpServer.on('upgrade', onUpgrade);

  const stopHeartbeat = startHeartbeat(hub, {
    onTerminate: (connectionId) => {
      log.warn({ connectionId }, 'Heartbeat: kein Protokoll-Pong, Verbindung terminiert');
    },
  });

  return {
    hub,
    close: async () => {
      stopHeartbeat();
      httpServer.off('upgrade', onUpgrade);
      hub.closeAll();
      await new Promise<void>((resolve) => {
        wss.close(() => {
          resolve();
        });
      });
    },
  };
}

/** Antwortet auf einen abgelehnten Upgrade mit einem HTTP-Status und schliesst den Socket. */
function rejectUpgrade(socket: Duplex, status: number, statusText: string): void {
  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
}
