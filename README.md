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

Dann <http://localhost:5173> oeffnen. Der Startbildschirm bietet zwei Wege, und
die Verben sagen den Unterschied:

- **Online spielen** — Name eintragen, „Partie erstellen". Es entsteht ein Raum
  mit vierstelligem Code; die anderen treten ueber den Code oder den
  Einladungslink bei. Sind alle Plaetze besetzt, startet der Ersteller.
  Jeder sieht nur seine eigenen Handkarten, ein Reload kostet den Platz nicht.
- **An einem Geraet** — „Lokale Partie starten" fuehrt sofort in eine
  vollstaendige Partie am selben Bildschirm: Gruendung, Wuerfeln, Bauen,
  Bankhandel, Raeuber, Sieg. Auch hier ist offen nur die Hand dessen, der
  gerade handeln darf — der Bildschirm wandert weiter, die Handkarten sollen es
  nicht.

Die lokale Partie braucht **keinen Server**. Sie baut ihre Sicht und ihre
Zugliste mit denselben Funktionen selbst, die der Server benutzt; deshalb ist
es dieselbe Oberflaeche.

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
ungueltiger Payload. Dazu spielt es eine echte Dreierpartie ueber drei
getrennte Verbindungen und prueft dabei, was Etappe 4+5 ausmacht: eigene Sicht
je Empfaenger, verdeckte fremde Handkarten, kein `rng` auf der Leitung, keine
Zuege fuer andere, und ein Reconnect, der den Platz und den Stand zurueckbringt.

## Pakete

| Paket             | Scope                | Inhalt                                                                                                         |
| ----------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | `@conquerist/shared` | Protokoll, Hex-Geometrie, Szenario-Generator, Spiellogik. Reines TypeScript, einzige Runtime-Dependency `zod`. |
| `apps/server`     | `@conquerist/server` | Fastify 5 plus rohes `ws`, SQLite, Autoritaet ueber den Spielzustand.                                          |
| `apps/client`     | `@conquerist/client` | React 19 mit Vite, SVG-Brett, Wartebereich, Online- und lokale Partie.                                         |

Der Client **kennt keine Spielregel**. Er bekommt eine Liste erlaubter Zuege,
sortiert sie nach Ort (Knoten, Kante, Feld) und schickt beim Klick die
gefundene Aktion hinaus. Lokal holt er die Liste selbst, online kommt sie vom
Server — `legalActions` braucht den vollen Zustand, und den hat seit Etappe 5
nur der Server. Dadurch gibt es genau eine Regelauslegung, und sie liegt in
`shared`.

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

Im Betrieb faellt der Proxy weg: `pnpm build` legt den Client nach
`apps/client/dist`, und der Server liefert ihn selbst aus. Damit ist jede
Verbindung gleichen Ursprungs — und genau das erlaubt die Origin-Regel ohne
Konfiguration. Ein Tunnel (Cloudflare, ngrok) auf Port 8080 funktioniert
dadurch mit jeder wechselnden Adresse, ohne dass jemand vor dem Spieleabend
eine Liste pflegt.

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

| Variable        | Default                                       | Zweck                                              |
| --------------- | --------------------------------------------- | -------------------------------------------------- |
| `PORT`          | `8080`                                        | Port des Fastify-Servers                           |
| `HOST`          | `127.0.0.1`                                   | Loopback, damit der Dev-Server nicht im LAN haengt |
| `NODE_ENV`      | `development`                                 | steuert das Log-Level                              |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | zusaetzlich erlaubte Origins, kommasepariert       |
| `DATABASE_FILE` | `./data/conquerist.db`                        | SQLite-Datei; `:memory:` ist erlaubt               |

Gleicher Ursprung ist immer erlaubt, auch ohne Eintrag in `CLIENT_ORIGIN` — die
Liste ist nur fuer den Dev-Proxy noetig.

Die Konfiguration wird beim Start per Zod validiert; ein falscher Wert beendet
den Prozess mit einer lesbaren Meldung statt spaeter als `NaN` aufzutauchen.

## Deployment (Coolify)

Ein Container traegt beides: der Server liefert den gebauten Client mit aus.
Das ist keine Bequemlichkeit, sondern der Grund, warum keine Origin-Liste
gepflegt werden muss — siehe unten.

**Anwendung anlegen:** Build Pack `Dockerfile`, Branch `main`, Base Directory
`/`, Port **8477**, „Is it a static site?" aus. Das Dockerfile liegt in der
Repository-Wurzel.

In der Entwicklung bleibt es bei **8080** (`config.ts`, `vite.config.ts`);
8477 gilt nur im Container. Der Grund ist der Zielhost: dort ist 8080 bereits
vergeben, und wenn schon eine andere Zahl, dann ueberall dieselbe — Host-Port,
Container-Port und Port-Feld.

**Umgebungsvariablen:**

| Variable        | Wert                  | Warum                                                   |
| --------------- | --------------------- | ------------------------------------------------------- |
| `NODE_ENV`      | `production`          | Log-Level `info` statt `debug`                          |
| `HOST`          | `0.0.0.0`             | der Default `127.0.0.1` waere im Container unerreichbar |
| `PORT`          | `8477`                | derselbe Wert wie im Port-Feld der Anwendung            |
| `DATABASE_FILE` | `/data/conquerist.db` | zeigt auf das Volume, nicht ins Containerdateisystem    |

**Ohne Domain, nur im Heimnetz:** unter _Ports Mappings_ `8477:8477`
eintragen. Dann laeuft der Verkehr direkt an den Container, ohne Traefik und
ohne TLS, erreichbar unter `http://<server-ip>:8477`. Die Origin-Regel traegt
auch das: Host und Origin sind dieselben. **Achtung:** mit einem Port-Mapping
kann Coolify nicht rollierend tauschen — beim Redeploy ist die Anwendung
kurz weg, und eine laufende Partie verliert ihre Verbindung.

**`CLIENT_ORIGIN` bleibt ungesetzt.** `isAllowedOrigin` vergleicht Host und
Port, nicht das Schema: der Browser sendet `https://…`, der Server sieht intern
`http`, und gleicher Ursprung stimmt trotzdem, solange der Proxy den
urspruenglichen `Host` durchreicht. Die Domain gehoert deshalb in keine Liste.

**Persistent Storage: ein _Volume_ auf `/data`**, ausdruecklich kein Bind
Mount. Das Image legt `/data` an und uebereignet es dem Benutzer `node`; ein
frisch angelegtes Volume erbt diese Rechte beim ersten Einhaengen, ein Bind
Mount auf ein Host-Verzeichnis nicht — dort gehoert der Ordner root, und der
Server stirbt mit `unable to open database file`.

**Health-Check:** `GET /health` antwortet ohne Datenbankzugriff; das Dockerfile
bringt einen `HEALTHCHECK` mit, der ihn alle 30 Sekunden abfragt.

**Ein Redeploy kostet keine Partie.** Gespeichert werden Startzustand und
Action-Log, wiederhergestellt wird per `replay` — beides liegt auf dem Volume.
Der Container darf jederzeit ersetzt werden, solange das Volume bleibt.

**Nur eine Instanz.** Raumverzeichnis, Wecker und die Anmelde-Drossel liegen im
Speicher des Prozesses; zwei Replicas haetten zwei verschiedene Wahrheiten.
