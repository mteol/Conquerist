import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/**
 * Den gebauten Client mit ausliefern.
 *
 * Der Grund ist nicht Bequemlichkeit, sondern die Origin-Regel: liefert der
 * Server die Seite selbst aus, ist jede WebSocket-Verbindung gleichen
 * Ursprungs (`ws/origin.ts`) - und damit funktioniert jede Tunneladresse ohne
 * eine Liste, die vor jedem Spieleabend gepflegt werden muesste.
 *
 * Die Rueckfallregel ist noetig, weil der Client seine Raeume ueber die URL
 * fuehrt: ein Reload auf `/?raum=K7X2` trifft keine Datei. Ohne den Rueckfall
 * auf `index.html` waere das ein 404 statt einer Partie.
 *
 * Fehlt der Ordner - in der Entwicklung der Normalfall, dort liefert Vite -,
 * wird uebersprungen und einmal geloggt. Ein Wurf waere hier falsch: der
 * Server ohne Client ist ein brauchbarer Zustand, nur eben keiner mit Seite.
 */
export function registerClient(app: FastifyInstance): boolean {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '../../client/dist');

  if (!existsSync(root)) {
    app.log.info({ root }, 'Kein gebauter Client gefunden - es wird nur die API ausgeliefert');
    return false;
  }

  void app.register(fastifyStatic, { root });

  app.setNotFoundHandler((request, reply) => {
    // Nur GET-Anfragen ohne Treffer sind Seitenaufrufe. Ein POST ins Leere
    // bleibt ein 404 - sonst bekaeme ein Tippfehler in der API eine HTML-Seite.
    if (request.method !== 'GET') {
      void reply.code(404).send({ error: 'Not Found' });
      return;
    }
    void reply.sendFile('index.html');
  });

  app.log.info({ root }, 'Client wird mit ausgeliefert');
  return true;
}
