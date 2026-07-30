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
2. shared: GameState + Reducer, Basisregeln
3. client: SVG-Board + Hotseat (vollständiges Spiel ohne Netzwerk)
4. server: WS-Infra, SQLite, Gast-Identität
5. Client-Anbindung, State-Filtering, Reconnect
6. Persistence: Action-Log + Snapshot, Lobby
7. Auth: Registrierung, Login, Gast-Account beanspruchen
8. Handel, Entwicklungskarten
9. Docker + Coolify
10. Erweiterungen

## Aktueller Stand
Etappen 0 und 1 fertig, beide auf eigenen Branches, noch nichts in `main`.
Als Nächstes Etappe 2: GameState + Reducer.

Was in `shared` schon steht:
- `protocol/` — Envelope, Registry, Ping (Etappe 0)
- `random/` — Seed-basierter PRNG als unveränderlicher Wert, Shuffle
- `geometry/` — Hex, Richtungen 0–5, kanonische Knoten-/Kanten-IDs, Topologie
- `scenario/` — Gelände, Häfen, Zod-Definition, Fairness, Blueprints, Generator
- `rules/` — RuleSet (Baukosten, Siegpunktziel, Vorräte, Handkartenlimit)

Details, getroffene Entscheidungen und offene Punkte stehen in `PROGRESS.md` —
das ist die maßgebliche Standsdatei, diese hier nennt nur die Landmarken.
