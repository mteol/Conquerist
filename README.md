# Conquerist

Rundenbasiertes Multiplayer-Brettspiel (Catan-artig) im Browser.
Lernprojekt zweier Entwickler mit Anspruch auf saubere Architektur.

Die verbindlichen Architekturregeln stehen in [CLAUDE.md](./CLAUDE.md),
der Fortschritt pro Etappe in [PROGRESS.md](./PROGRESS.md).

## Schnellstart

```powershell
pnpm install
pnpm dev
```

Dann <http://localhost:5173> oeffnen. Erwartet: der Startbildschirm mit Spielern,
Brett und Seed. „Partie starten" fuehrt in eine vollstaendige Hotseat-Partie am
selben Geraet — Gruendung, Wuerfeln, Bauen, Bankhandel, Raeuber, Sieg.

Die Hotseat-Partie braucht **keinen Server**. Die Verbindung wird erst
aufgebaut, wenn man auf dem Startbildschirm „Verbindung und Diagnose" aufklappt;
dort liefert der Ping-Button `pong` samt Round-Trip-Zeit. Ueber das Netz gespielt
wird ab Etappe 5.

`predev` baut `packages/shared` einmal vor, damit Editor und Typpruefung auf
einem frischen Clone sofort korrekte Typen sehen.

## Skripte im Root

| Befehl           | Wirkung                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `pnpm dev`       | Server (8080) und Client (5173) parallel, beide mit Hot Reload    |
| `pnpm build`     | Alle Pakete in Topologie-Reihenfolge                              |
| `pnpm test`      | Vitest ueber alle Pakete                                          |
| `pnpm typecheck` | `tsc -b` ueber das Solution-File, baut `shared` bei Bedarf selbst |
| `pnpm format`    | Prettier ueber das ganze Repo                                     |

Ende-zu-Ende-Pruefung gegen einen laufenden `pnpm dev`:

```powershell
pnpm --filter @conquerist/server acceptance
```

Prueft `/health`, den WS-Handshake durch den Vite-Proxy, Ping/Pong sowie die
Ablehnung von fremdem Origin, falschem Pfad, unbekanntem Nachrichtentyp und
ungueltiger Payload.

## Pakete

| Paket             | Scope                | Inhalt                                                                                                         |
| ----------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | `@conquerist/shared` | Protokoll, Hex-Geometrie, Szenario-Generator, Spiellogik. Reines TypeScript, einzige Runtime-Dependency `zod`. |
| `apps/server`     | `@conquerist/server` | Fastify 5 plus rohes `ws`, Autoritaet ueber den Spielzustand.                                                  |
| `apps/client`     | `@conquerist/client` | React 19 mit Vite, SVG-Brett und Hotseat-Partie.                                                               |

Der Client **kennt keine Spielregel**. Er fragt `legalActions`, sortiert die
Antwort nach Ort (Knoten, Kante, Feld) und schickt beim Klick die gefundene
Aktion durch `reduce`. Dadurch gibt es genau eine Regelauslegung, und sie liegt
in `shared` — dort, wo ab Etappe 4 auch der Server sie benutzt.

## Ports und Netzwerkweg

```
Browser  ──http──▶  Vite 5173  ──proxy──▶  Fastify 8080
         ──ws/ws──▶     /ws     ──ws────▶     /ws
```

Der Client kennt **keine Portnummer**: er verbindet auf
`${ws|wss}://${location.host}/ws`. In der Entwicklung nimmt Vite den Upgrade auf
5173 an und leitet ihn nach 8080 weiter (`ws: true` im Proxy).

Daraus folgt die Stolperstelle, die man einmal wissen muss: der Server sieht im
`Origin`-Header **5173**, nicht seinen eigenen Port. `CLIENT_ORIGIN` ist deshalb
auf den Vite-Origin gesetzt, nicht auf den Server-Origin.

## Zwei Ping-Ebenen

Sie heissen aehnlich und haben nichts miteinander zu tun:

|                     | Protokoll-Heartbeat                     | Anwendungsnachricht                                                         |
| ------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Wo                  | `apps/server/src/ws/heartbeat.ts`       | `packages/shared/src/protocol/ping.ts`                                      |
| Was                 | RFC-6455-Control-Frame, `socket.ping()` | normale Nachricht durch Envelope, Router und Zod                            |
| Richtung            | Server fragt, alle 30 s                 | Client fragt, bei Funkstille alle 20 s                                      |
| Wozu                | Server erkennt tote Clients             | Client messt RTT, schaetzt die Server-Uhr, erkennt halb offene Verbindungen |
| Sichtbar im Browser | **nein**                                | ja                                                                          |

Beide Richtungen sind notwendig, weil jede Seite nur ihre eigene Sicht hat: der
Protokoll-Ping des Servers ist im Browser-JavaScript nicht beobachtbar, ein
rein passiver Waechter im Client wuerde also gesunde, ruhige Verbindungen
abschiessen.

## Umgebungsvariablen

Alle mit Entwicklungs-Defaults, siehe [apps/server/.env.example](./apps/server/.env.example).

| Variable        | Default                                       | Zweck                                                |
| --------------- | --------------------------------------------- | ---------------------------------------------------- |
| `PORT`          | `8080`                                        | Port des Fastify-Servers                             |
| `HOST`          | `127.0.0.1`                                   | Loopback, damit der Dev-Server nicht im LAN haengt   |
| `NODE_ENV`      | `development`                                 | steuert das Log-Level                                |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | erlaubte Origins fuer den WS-Upgrade, kommasepariert |

Die Konfiguration wird beim Start per Zod validiert; ein falscher Wert beendet
den Prozess mit einer lesbaren Meldung statt spaeter als `NaN` aufzutauchen.
