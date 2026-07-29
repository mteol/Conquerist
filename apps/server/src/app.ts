import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from './config.js';

/**
 * Baut die Fastify-Instanz, ohne zu lauschen.
 *
 * Getrennt von `server.ts`, damit Tests die App instanziieren koennen, ohne
 * einen Port zu belegen.
 */
export function buildApp(config: ServerConfig): FastifyInstance {
  // Ein einziges Objektliteral, kein Ternaer um die gesamten Optionen: Fastify
  // unterscheidet HTTP/HTTP2 ueber Overloads, und ein Union-Typ als Argument
  // laesst die Aufloesung auf der falschen Signatur landen.
  const app = Fastify({
    logger: { level: config.isProduction ? 'info' : 'debug' },
    forceCloseConnections: true,
  });

  app.get('/health', async () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    now: Date.now(),
  }));

  return app;
}
