# Projekt: conquerist

Multiplayer-Brettspiel (Catan-artig), rundenbasiert, Web.
Zwei Entwickler, Lernprojekt mit Anspruch auf saubere Architektur.

## Stack
pnpm-Monorepo · TypeScript strict · React 19 + Vite (SVG-Rendering)
Fastify 5 + Raw WebSocket (`ws`) · SQLite (better-sqlite3) · Vitest
Deployment später: Docker auf Coolify

## Struktur
- `packages/shared` — Spiellogik, Typen, Protokoll. **Reines TypeScript.**
- `apps/server` — WebSocket-Server, Autorität über den Spielzustand
- `apps/client` — React-Frontend

Paket-Scope: `@conquerist/shared`, `@conquerist/server`, `@conquerist/client`

## Unverhandelbare Architekturregeln

1. **`shared` hat keine Runtime-Dependencies außer `zod`.**
   Kein React, kein Node-API, kein Framework. Muss im Browser UND in Node laufen.

2. **Spiellogik ist pur.** `(state, action) => newState`.
   Keine Seiteneffekte, kein I/O, kein Math.random(), kein Date.now().
   Zufall ausschließlich über einen übergebenen Seed.
   Grund: Server validiert, Client sagt Züge voraus, Tests laufen ohne
   Infrastruktur, und der Zustand ist aus dem Action-Log rekonstruierbar.

3. **Der Server ist die Autorität.** Der Client schickt Absichten, keine
   Ergebnisse. Jede eingehende Nachricht wird per Zod validiert, BEVOR sie
   die Logik erreicht.

4. **Verdeckte Information.** Handkarten sind geheim. Es gibt GameState
   (Server) und PlayerView (was ein einzelner Spieler sehen darf).
   Niemals den vollen State an Clients senden.

5. **Erweiterbarkeit ohne Vorbau.** Zuerst das Basisspiel, aber:
   - Board datengetrieben (ScenarioDefinition), nie hartkodiert
   - Actions als Discriminated Union
   - Regelwerte (Baukosten, Siegpunktziel, Stapelgroessen) in einem RuleSet
   - Ressourcen/Bauteile als Record<Id, number>, nicht als feste Felder
   Kein Plugin-System, keine Abstraktion "fuer spaeter" ohne konkreten Bedarf.

6. **Netzwerkprotokoll:** Envelope mit Korrelations-ID
   ({ id, type, payload } -> { replyTo, ok, error?, payload? }).
   Heartbeat serverseitig. Jeder Broadcast traegt eine hochzaehlende version.

7. **Identität ab Tag 1.** Jeder Spieler ist ein Eintrag in `users`, auch Gäste
   (`is_guest = true`, ohne Zugangsdaten). Spiele referenzieren immer eine
   `user_id`, nie einen losen Namensstring. Registrierung ist später ein
   UPDATE auf die bestehende Zeile, kein neuer Datentyp.

## Arbeitsweise
- In klar abgegrenzten Etappen. Nicht vorgreifen, nichts "schon mal mitmachen".
- Vollständige Dateien, keine Ausschnitte.
- Entscheidungen kurz begründen — das Warum, nicht nur das Was.
- Bei Unklarheit nachfragen statt raten.
- Neue Logik in shared bekommt Tests.
- Antworten auf Deutsch, Code und Bezeichner auf Englisch.

## Etappenplan
0. ✅ Monorepo-Grundgerüst, WS-Ping/Pong
1. ✅ shared: Hex-Geometrie, kanonische Vertex/Edge-IDs, Szenario-Generator
2. ✅ shared: GameState + Reducer, Basisregeln
3. ✅ client: SVG-Board + Hotseat (vollständiges Spiel ohne Netzwerk)
4. server: WS-Infra, SQLite, Gast-Identität
5. Client-Anbindung, State-Filtering, Reconnect
6. Persistence: Action-Log + Snapshot, Lobby
7. Auth: Registrierung, Login, Gast-Account beanspruchen
8. Handel, Entwicklungskarten
9. Docker + Coolify
10. Erweiterungen

## Aktueller Stand
Etappen 0 bis 3 fertig, je auf eigenem Branch, noch nichts in `main`.
Als Nächstes Etappe 4: Server mit WS-Infra, SQLite und Gast-Identität.

Was in `shared` schon steht:
- `protocol/` — Envelope, Registry, Ping (Etappe 0)
- `random/` — Seed-basierter PRNG als unveränderlicher Wert, Shuffle
- `geometry/` — Hex, Richtungen 0–5, kanonische Knoten-/Kanten-IDs, Topologie
- `scenario/` — Gelände, Häfen, Zod-Definition, Fairness, Blueprints, Generator
- `rules/` — RuleSet (Baukosten, Siegpunkte, Vorräte, Handkartenlimit)
- `game/` — GameState, Actions, Reducer, Basisregeln. Einstiegspunkte:
  `createGame`, `reduce`, `legalActions`, `replay`. Der Reducer wirft nicht,
  er gibt `{ ok, state }` oder `{ ok: false, error }` zurück.

Regeln liegen je in eigener Datei, jeweils als `can…` (nur prüfen) und
`apply…` (prüfen und anwenden). `legalActions` benutzt dieselben `can…` —
neue Regeln bitte genauso, damit es weiter nur eine Auslegung gibt.

Was im Client steht (Etappe 3):
- `seats.ts` — Name und Farbe je Spieler; `shared` kennt beides bewusst nicht
- `board/` — Feld/Knoten/Kante zu Punkten (Spitze oben), das SVG-Brett
- `game/` — Klickkarten, Anzeigemodell samt Verdecken, Verlaufssätze,
  Hotseat-Zustand
- `panels/`, `dialogs/`, `screens/`, `diagnostics/` — Oberfläche

**Der Client kennt keine Regel.** Er fragt `legalActions`, sortiert die Antwort
nach Ort (`game/targets.ts`), und ein Klick schickt die gefundene Aktion durch
`reduce`. Kein `if (genug Holz)` im Client — sonst gäbe es zwei Auslegungen.
Knoten- und Kantenpositionen kommen aus der Id (Schwerpunkt der angrenzenden
Felder), nicht aus einer zweiten Winkelrechnung.

Details, getroffene Entscheidungen und offene Punkte stehen in `PROGRESS.md` —
das ist die maßgebliche Standsdatei, diese hier nennt nur die Landmarken.
