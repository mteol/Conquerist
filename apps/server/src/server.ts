import { WS_PATH } from '@conquerist/shared';
import { ConfigError, loadConfig } from './config.js';
import { buildApp } from './app.js';
import { MessageRouter } from './ws/router.js';
import { registerPingHandler } from './ws/handlers/ping.js';
import { handleDisconnect, registerRoomHandlers } from './ws/handlers/room.js';
import { attachWebSocketServer } from './ws/attach.js';
import { openDatabase } from './db/database.js';
import { Users } from './identity/users.js';
import { Sessions } from './identity/sessions.js';
import { RoomRegistry } from './rooms/registry.js';
import { SqliteRoomStore } from './rooms/sqliteStore.js';
import { SinkHub } from './ws/sinks.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp(config);

  const database = openDatabase(config.databaseFile);
  const store = new SqliteRoomStore(database, (message, detail) => {
    app.log.error(detail as object, message);
  });
  // Eine einzige Instanz: sonst saehe jede Stelle ihre eigenen Sitzungen,
  // statt derselben Sitzungstabelle.
  const sessions = new Sessions(database);

  const deps = {
    // Aus dem, was auf der Platte liegt: ein Neustart kostet keine Partie.
    registry: RoomRegistry.load(store, {
      onWriteError: (code, error) => {
        // Der Zug ist bereits angenommen - hier wird protokolliert, nicht
        // zurueckgenommen.
        app.log.error({ code, err: error }, 'Raum liess sich nicht schreiben');
      },
    }),
    users: new Users(database, sessions),
    sinks: new SinkHub(),
  };

  app.log.info({ rooms: deps.registry.all.length }, 'Raeume von der Platte geladen');

  const router = new MessageRouter({
    onHandlerError: (type, error, context) => {
      app.log.error({ type, err: error, connectionId: context.connectionId }, 'Handler-Fehler');
    },
  });

  registerPingHandler(router);
  registerRoomHandlers(router, deps);

  // Reihenfolge: den upgrade-Listener registrieren, BEVOR gelauscht wird.
  const ws = attachWebSocketServer({
    httpServer: app.server,
    config,
    router,
    log: app.log,
    onClosed: (session, events) => {
      handleDisconnect(deps, session, events);
    },
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info({ signal, openConnections: ws.hub.size }, 'Server fahrt herunter');
    await ws.close();
    await app.close();
    process.exit(0);
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }

  await app.listen({ port: config.port, host: config.host });

  app.log.info(
    {
      origins: config.clientOrigins,
      wsPath: WS_PATH,
      registeredMessageTypes: router.registeredTypes,
    },
    'WebSocket bereit',
  );
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    // Kein Stacktrace: bei einem Konfigurationsfehler ist die Meldung die Information.
    console.error(error.message);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});
