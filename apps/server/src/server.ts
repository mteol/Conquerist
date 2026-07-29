import { WS_PATH } from '@conquerist/shared';
import { ConfigError, loadConfig } from './config.js';
import { buildApp } from './app.js';
import { MessageRouter } from './ws/router.js';
import { registerPingHandler } from './ws/handlers/ping.js';
import { attachWebSocketServer } from './ws/attach.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp(config);

  const router = new MessageRouter({
    onHandlerError: (type, error, context) => {
      app.log.error({ type, err: error, connectionId: context.connectionId }, 'Handler-Fehler');
    },
  });

  registerPingHandler(router);

  // Reihenfolge: den upgrade-Listener registrieren, BEVOR gelauscht wird.
  const ws = attachWebSocketServer({
    httpServer: app.server,
    config,
    router,
    log: app.log,
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
