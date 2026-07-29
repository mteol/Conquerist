# Fortschritt

## Etappe 0 — Monorepo-Grundgeruest, WS-Ping/Pong ✅

Stand: 2026-07-30, Branch `etappe-0-grundgeruest`.

### Abnahme

| Pruefung                                      | Ergebnis                                            |
| --------------------------------------------- | --------------------------------------------------- |
| `pnpm install`                                | gruen                                               |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                               |
| `pnpm test`                                   | 70 Tests gruen (shared 20, server 13, client 37)    |
| `pnpm build`                                  | gruen, Client-Bundle 269 kB (82 kB gzip)            |
| `pnpm dev`, Browser auf 5173                  | „Verbunden", Ping-Button liefert `pong` mit Latenz  |
| `pnpm --filter @conquerist/server acceptance` | 7/7 gruen, Ping/Pong durch den Vite-Proxy bei ~3 ms |

Zusaetzlich belegt statt angenommen:

- `predev` laeuft tatsaechlich (dank `enable-pre-post-scripts=true` in `.npmrc`).
- Server loest `@conquerist/shared` mit der `development`-Condition auf
  `packages/shared/src/index.ts` auf, ohne Condition auf `dist/index.js`.
- Vite serviert im Dev-Modus `/@fs/.../packages/shared/src/index.ts`, also die
  Quelle — kein veraltetes `dist` im Browser.
- Eine Aenderung in `packages/shared/src` loest Vite-Reload **und**
  tsx-Serverneustart aus, ohne manuellen Rebuild.
- Fremder Origin wird mit HTTP 403 **vor** dem Handshake abgewiesen,
  falscher Pfad mit 404.

### Versionen

Aufgeloest beim Aufsetzen, jeweils die zum Zeitpunkt neuesten:

| Paket              | Version |
| ------------------ | ------- |
| TypeScript         | 7.0.2   |
| Vite               | 8.1.5   |
| Vitest             | 4.1.10  |
| React / React DOM  | 19.2.8  |
| Fastify            | 5.10.0  |
| ws                 | 8.21.1  |
| zod                | 4.4.3   |
| tsx                | 4.23.1  |
| Prettier           | 3.9.6   |
| Node (Entwicklung) | 24.15.0 |
| pnpm               | 11.18.0 |

TypeScript 7 (die neu implementierte Toolchain) traegt Project References,
`composite`, `emitDeclarationOnly` und die strengen Optionen dieses Repos
vollstaendig — geprueft mit `tsc -b --clean` und vollstaendigem Neubau.

### Getroffene Entscheidungen

**`shared` wird zweigleisig aufgeloest.** Typpruefung laeuft ueber TS Project
References (`tsc -b` baut `shared` bei Bedarf selbst). Zur Laufzeit greift in der
Entwicklung die `development`-Condition der `exports`-Map und liefert die
TypeScript-Quelle; im Produktionsbuild die `default`-Condition und damit `dist`.
Die Alternative — nur `dist` plus paralleler `tsc --watch` — waere ein
Dauerlieferant fuer „warum wirkt meine Aenderung nicht".

**Typen kommen ausschliesslich aus den Zod-Schemas** (`z.infer`). Unter
`exactOptionalPropertyTypes` ist ein handgeschriebenes `replyTo?: string` nicht
zuweisungskompatibel zu Zods `replyTo?: string | undefined`; ein Schema als
einzige Wahrheit erspart die Castfolge.

**Protokoll-Registry in `shared`** (`protocol/registry.ts`) als einzige Quelle
fuer Request- und Response-Typen. Auf der Leitung bleibt der Envelope generisch
(`type: string`, `payload: unknown`); die Typisierung existiert nur zur
Compile-Zeit. Im gesamten Nachrichtenpfad gibt es genau zwei Casts, je einen
direkt hinter der Validierung in `router.ts` und in `transport.ts`.

**Der Router validiert auch die Antwort.** Zwei Gruende: Drift zwischen Handler
und Registry fliegt sofort auf, und was nicht im Response-Schema steht, kann den
Server nicht verlassen — die Vorarbeit fuer Regel 4 (verdeckte Information) ab
Etappe 4. Der Test `strippt Felder, die nicht im Response-Schema stehen` haelt
das fest.

**Origin-Pruefung vor dem Handshake**, im `upgrade`-Listener. Fuer einen fremden
Origin entsteht nie eine WebSocket-Instanz.

**Zwei Ping-Ebenen, bewusst beide.** Server-Heartbeat (RFC-6455-Control-Frame,
30 s) erkennt tote Clients. Client-Keepalive (Anwendungsnachricht, nach 20 s
Funkstille) erkennt halb offene Verbindungen — notwendig, weil der Protokoll-Ping
im Browser-JavaScript unsichtbar ist und ein rein passiver Waechter im Client
gesunde, ruhige Verbindungen abschiessen wuerde. Nebenprodukt: laufende RTT- und
Uhrenmessung.

**Adaptiver Request-Timeout** statt fester Zahl: `srtt + 4 * rttvar`, geklemmt
auf 2–15 s, Verfahren wie beim TCP-Retransmission-Timeout. Ein Timeout lehnt nur
seinen Request ab und fasst die Verbindung nicht an — nur der Keepalive trennt.

**Karenzzeit von 500 ms**, bevor eine Trennung in der UI erscheint, plus
Sofort-Retry bei `online` und `visibilitychange` (mit 1-s-Bremse). Beides sitzt
im Transport und nicht in der UI, weil es sich nachtraeglich nur durch Umbau von
`transport.ts` einziehen liesse.

### Offene Punkte

- **Kein ESLint.** Bewusst weggelassen: TypeScript mit `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals` und
  `noUnusedParameters` plus Prettier deckt in diesem Projekt fast alles ab, was
  ein Standard-Ruleset gefunden haette. Nachziehen, sobald konkrete Regeln fehlen
  (Kandidaten: `no-floating-promises`, `exhaustive-deps` fuer React-Hooks) —
  beides braucht typbewusstes Linting, also die entsprechende Einrichtung.
- **Keine React-Komponententests.** `src/net` ist vollstaendig getestet,
  `App.tsx` und `useConnection.ts` nicht. Sinnvoll ab Etappe 3, wenn es echte
  Oberflaeche gibt; dann mit Testing Library und jsdom.
- **Kein CI.** `pnpm typecheck && pnpm test && pnpm build` laeuft derzeit nur
  lokal. Vor dem ersten Merge in `main` einrichten.
- **Testdateien landen im `dist`.** `src/**/*.test.ts` ist Teil des
  Build-Projekts, damit die Tests typgeprueft werden; dadurch liegt kompiliertes
  Testmaterial in `dist`. Fuer private Pakete harmlos, aber unsauber. Aufraeumen,
  falls `shared` je veroeffentlicht wird.
- **Kein `.nvmrc` / Volta-Pin.** `engines.node` steht auf `>=22`, die
  tatsaechliche Version ist nirgends festgenagelt. Relevant, sobald der zweite
  Entwickler oder Docker dazukommt (Etappe 9).
- **Reconnect nur mit anonymer Verbindung.** Nach einem Reconnect ist der Client
  fuer den Server ein neuer Fremder. Die Zuordnung zu einem Spieler kommt in
  Etappe 4 (`users`, Gast-Identitaet) und Etappe 5 (State-Filtering) — bis dahin
  gibt es bewusst keine Sitzungs-ID im Protokoll, weil nichts dahintersteht.

### Naechste Etappe

**Etappe 1 — `shared`: Hex-Geometrie, kanonische Vertex/Edge-IDs,
Szenario-Generator.** Erste Etappe mit echter Spiellogik, damit auch die erste,
in der die Purity-Regel greift: `(state, action) => newState`, kein `Date.now()`,
kein `Math.random()`, Zufall nur ueber einen uebergebenen Seed.

Der abgestimmte Plan liegt in [ETAPPE-1-PLAN.md](./ETAPPE-1-PLAN.md) —
temporaere Datei, wird nach Abschluss von Etappe 1 geloescht und ihr Inhalt
verdichtet hierher uebernommen.
