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

---

## Etappe 1 — `shared`: Hex-Geometrie, kanonische Ids, Szenario-Generator ✅

Stand: 2026-07-31, Branch `etappe-1-geometrie`.

Erste Etappe mit echter Spiellogik und damit die erste, in der Regel 2 greift:
alles reine Funktion, kein `Date.now()`, kein `Math.random()`, Zufall
ausschliesslich ueber einen uebergebenen Seed. `apps/server` und `apps/client`
sind unangetastet.

### Abnahme

| Pruefung                                      | Ergebnis                                                     |
| --------------------------------------------- | ------------------------------------------------------------ |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                        |
| `pnpm test`                                   | 289 Tests gruen (shared 239, server 13, client 37)           |
| `pnpm build`                                  | gruen, Client-Bundle 278 kB (84 kB gzip)                     |
| `pnpm format:check`                           | gruen                                                        |
| `pnpm --filter @conquerist/server acceptance` | 7/7 gruen — die Etappe-0-Kette traegt das groessere `shared` |

Zusaetzlich belegt statt angenommen:

- **Zwei unabhaengige Konstruktionen desselben Bretts stimmen ueberein.**
  `hexRowLayout([3,4,5,4,3])` und `hexSpiral(origin, 2)` liefern dieselbe
  Feldmenge. Waere eine von beiden falsch, koennten sie es nicht.
- **Beide Layouts erfuellen die Eulersche Formel** (`V − E + H = 1`):
  Basisspiel 54 − 72 + 19, Erweiterung 80 − 109 + 30. Fuer 3-4-5-6-5-4-3 steht
  die Knotenzahl nicht vorab fest — der Test kommt trotzdem ohne abgeschriebene
  Zahl aus und faellt bei jedem Adjazenzfehler durch.
- **Kanonizitaet ueber jedes Feld des Bretts**, nicht an Stichproben: fuer alle
  19 Felder und alle sechs Ecken liefert jeder der drei Zugaenge dieselbe
  Knoten-Id, fuer jede Kante beide Zugaenge dieselbe Kanten-Id.
- **500 Seeds je Blueprint** ergeben 500 verschiedene Bretter, und **alle 500
  erfuellen die strengste Fairnessstufe** — keines faellt in eine Lockerung.

### Zahlen zu den beiden Brettern

| Blueprint   | Layout        | Felder | Knoten | Kanten | Kuestenkanten | Haefen |
| ----------- | ------------- | -----: | -----: | -----: | ------------: | -----: |
| `classic34` | 3-4-5-4-3     |     19 |     54 |     72 |            30 |      9 |
| `classic56` | 3-4-5-6-5-4-3 |     30 |     80 |    109 |            38 |     11 |

### Getroffene Entscheidungen

**Knoten- und Kanten-Identitaet ist strukturell** (Entscheidung A des Plans,
umgesetzt in `geometry/canonical.ts`). Die Id _ist_ die sortierte Menge der
angrenzenden Felder: `v:0,0|1,-1|1,0`, `e:0,0|1,0`. Sie traegt damit ihren
eigenen Beweis — man liest die Nachbarfelder direkt ab, was ab Etappe 6 im
Action-Log und in SQLite mehr zaehlt als kurze Ids.

Zwei Punkte, die beim Umsetzen wichtiger waren als erwartet:

- **Sortiert wird numerisch, nicht als Text.** Textsortierung liefert dasselbe
  Ergebnis, solange alle Koordinaten einstellig sind, und ordnet ab einem
  groesseren Szenario `10,-1` vor `9,0` ein. Ein Test haelt genau diesen Fall
  fest.
- **Jede Id wird beim Einlesen gegengeprueft**: `decodeVertexId` baut die Id aus
  den gelesenen Feldern neu und vergleicht. Was sich nicht selbst reproduziert,
  ist nicht kanonisch und fliegt raus, bevor es zwei Namen fuer denselben Platz
  gibt. Zusaetzlich muessen die Felder paarweise benachbart sein — sonst liesse
  sich eine syntaktisch gueltige, geometrisch unmoegliche Id bauen, und die kaeme
  ab Etappe 4 ueber das Netz.

**Die Geometrie bleibt orientierungsagnostisch** (Entscheidung B): Richtungen
sind Indizes 0–5 mit dokumentierten Deltas. Ob die Felder spitz oder flach oben
stehen, entscheidet sich in Etappe 3 am SVG und beruehrt keine einzige Datei
hier.

**Der PRNG ist ein unveraenderlicher Wert** (Entscheidung C): `sfc32` mit
`cyrb128` als Seed-Hash, `nextUint32(rng) → [wert, naechsterRng]`. Bitgleich in
Node und Browser, weil ausschliesslich `Math.imul`, `|0`, `>>>` und `<<`
verwendet werden — alle in ECMAScript exakt definiert, keine
Fliesskommaschritte. Drei Ergaenzungen zum Plan:

- **Fester Vorlauf von 12 verworfenen Ziehungen** nach dem Seeden. Ohne ihn
  koennen aehnliche Seeds (`"seed-a"` / `"seed-b"`) in den ersten Werten
  korrelieren. Der Vorlauf ist Teil des Verfahrens und darf sich nicht mehr
  aendern.
- **`nextInt` zieht ohne Modulo-Verzerrung** (Rejection Sampling). Bei einem
  Wuerfel faellt die Verzerrung nicht auf, beim Mischen von 19 Plaettchen schon.
- **Die Regressionssperre steht**: Startzustand und die ersten acht Werte zum
  Seed `"conquerist"` sowie zehn Wuerfelwuerfe sind fest eingetragen. Wer am
  PRNG schraubt, bricht jedes laufende Spiel — das soll ein roter Test sagen,
  nicht ein Spieler.

**Zugehoerigkeit zum Brett ist einheitlich definiert:** ein Knoten oder eine
Kante gehoert dazu, sobald mindestens eines der angrenzenden Felder dazugehoert.
Das ist genau die Kuestenregel — Siedlung am Rand erlaubt, Strasse entlang der
Kueste auch. Die Nachbarschaftslisten werden anschliessend aus den _Brettkanten_
abgeleitet und nicht aus der Geometrie, damit kein Knoten einen Nachbarn nennt,
zu dem keine baubare Kante fuehrt.

### Abweichung vom Plan: die Chipvergabe

Der Plan sah fuer die Zahlenchips **Rejection Sampling** vor: mischen, die vier
Bedingungen pruefen, bei Verstoss neu mischen. Nachgemessen an je 2000 rein
gemischten Brettern:

| Bedingung verletzt              | `classic34` | `classic56` |
| ------------------------------- | ----------: | ----------: |
| zwei gleiche Zahlen benachbart  |      90,3 % |      99,2 % |
| zwei 6er/8er benachbart         |      86,2 % |      96,4 % |
| Pip-Summe ausserhalb des Bandes |      24,5 % |      60,7 % |
| zu grosser Gelaendecluster      |      22,5 % |      56,3 % |
| **mindestens eine**             |  **98,7 %** | **100,0 %** |

Blindes Mischen kann diese Bedingungen also nicht erfuellen. Beim grossen Brett
haette der Generator in 2000 Versuchen kein einziges gueltiges Ergebnis
geliefert, sondern immer nur die Lockerungsstufen durchlaufen — die Fairness
waere auf dem Papier geblieben.

**Umgesetzt ist deshalb eine konstruktive Vergabe:** die Chips werden in
Spiralreihenfolge gelegt, an jedem Feld nur aus den Chips, die mit den bereits
gelegten Nachbarn vertraeglich sind, mit Rueckschritt bei Sackgassen und einem
Schrittbudget. Zufaellig bleibt es, weil die Probierreihenfolge aus dem
gemischten Vorrat und damit aus dem Seed kommt.

Was vom Plan unveraendert bleibt:

- Die vier Bedingungen und **alle** Schwellen stehen im Blueprint, nicht im Code.
- Rejection Sampling bleibt als aeussere Schleife — es verteilt das Gelaende
  (dort reicht es: 78 % bzw. 44 % Annahmequote) und faengt ein aufgebrauchtes
  Schrittbudget ab.
- Die Lockerungsstufen bleiben, samt Auffangstufe, die jedes Brett annimmt.
  `generateScenario` endet damit garantiert mit einem Ergebnis.
- `checkFairness` prueft das fertige Brett noch einmal unabhaengig. Der Solver
  ist nie die einzige Instanz, die ueber Fairness urteilt.

Ergebnis: 500/500 Seeds erfuellen bei beiden Blueprints die strengste Stufe, bei
rund 2,6 ms (`classic34`) bzw. 5,6 ms (`classic56`) je Brett.

### Offene Punkte

- **Hafenpositionen sind gegen die Schachtel zu pruefen.** Das war schon im Plan
  der offene Punkt und ist es geblieben. Eingebaut ist eine dokumentierte,
  symmetrische Anordnung: `classic34` neun Haefen im Abstandsmuster 3-3-4
  (dreimal, schliesst den 30er-Ring genau), `classic56` elf Haefen im Muster 3-4
  (sechs Dreier, fuenf Vierer, schliesst den 38er-Ring genau). Bei `classic56`
  ist zusaetzlich die **Anzahl** der Haefen nicht belastbar bekannt. Weil es
  reine Daten sind, ist die Korrektur ein Zahlentausch in
  `blueprints/classic*.ts`.
- **Die Hafenplaetze sind fest, nur die Arten werden gemischt.** Ob die Plaetze
  ebenfalls variieren sollen, ist eine Spielentscheidung und noch nicht
  getroffen.
- **Knoten- und Kanten-Ids sind einfache String-Aliase**, keine Branded Types.
  Ein `EdgeId` laesst sich also dort einsetzen, wo ein `VertexId` erwartet wird.
  Zur Laufzeit faellt das sofort auf (Praefix `v:` / `e:`, jede Decode-Funktion
  wirft), zur Compile-Zeit nicht. Nachziehen, falls es einmal wirklich passiert.
- **Das Client-Bundle ist um 8 kB gewachsen** (269 → 278 kB), obwohl der Client
  nichts aus Geometrie oder Szenario benutzt. Ursache ist vermutlich der
  Barrel-Export in `shared/src/index.ts` zusammen mit den Zod-Schemas. Vor
  Etappe 9 pruefen, ob feinere Einstiegspunkte noetig sind.
- Die Erinnerungsposten aus Etappe 0 gelten unveraendert weiter: kein ESLint,
  keine React-Komponententests, kein CI, kompilierte Testdateien im `dist`, kein
  Node-Version-Pin.

---

## Etappe 2 — `shared`: GameState + Reducer, Basisregeln ✅

Stand: 2026-07-31, Branch `etappe-2-reducer`.

Alles unter `packages/shared/src/game/`. `apps/server` und `apps/client` sind
unangetastet. Erstmals gilt die Purity-Regel fuer den Spielzustand:
`(state, action) => newState`, kein `Date.now()`, kein `Math.random()`.

### Abnahme

| Pruefung                                      | Ergebnis                                           |
| --------------------------------------------- | -------------------------------------------------- |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                              |
| `pnpm test`                                   | 492 Tests gruen (shared 442, server 13, client 37) |
| `pnpm build`                                  | gruen, Client-Bundle 283 kB (86 kB gzip)           |
| `pnpm format:check`                           | gruen                                              |
| `pnpm --filter @conquerist/server acceptance` | 7/7 gruen, gegen frisch gestartete Server          |

`shared` waechst damit von 239 auf 442 Tests.

### Was der Integrationstest belegt

`game.integration.test.ts` spielt eine vollstaendige Partie auf dem erzeugten
Basisbrett — drei Spieler, fester Seed, eine stumpfe aber deterministische
Strategie — von `createGame` bis `phase === 'finished'`. Geprueft wird dabei:

- Die Partie **endet**, mit einem Sieger, der das Siegpunktziel erreicht hat,
  und niemand sonst erreicht es.
- **Nach jedem einzelnen Zug** stimmt die Kartenbilanz: Bank plus alle Haende
  ergeben immer dieselbe Summe. Karten wechseln den Besitzer, sie entstehen und
  verschwinden nicht. Das ist die schaerfste Invariante, die das Spiel kennt,
  und sie faengt Fehler in Ertrag, Handel, Diebstahl und Baukosten auf einmal.
- Die Bauteilvorraete gehen auf — einschliesslich der Siedlung, die beim Ausbau
  zur Stadt in den Vorrat zurueckwandert.
- **Regel 2, belegt statt behauptet:** `replay(startzustand, aktionsfolge)`
  ergibt exakt denselben Endzustand, Feld fuer Feld, samt Zufallszustand.

### Getroffene Entscheidungen

**Der Reducer wirft nicht, er antwortet.**
`reduce(state, action) → { ok: true, state } | { ok: false, error }`. Ein
abgelehnter Zug ist ein normaler Ausgang, kein Programmfehler. Der Server
braucht ab Etappe 4 den Ablehnungsgrund fuer seine Fehlerantwort, die
Oberflaeche ab Etappe 3 die Frage „darf ich das?", ohne den Zug probeweise
auszufuehren.

**Jede Regel gibt es als `can…` und als `apply…`** — und `apply…` ruft `can…`
auf. `legalActions` benutzt dieselben `can…`-Funktionen. Damit existiert die
Regelauslegung genau einmal; zwei Auslegungen waeren genau der Fehler, den die
Aufteilung verhindert. Ein Test haelt die Kopplung fest: _was `legalActions`
nennt, muss `reduce` annehmen_.

**Der Zugablauf ist ein expliziter Zustandsautomat**
(`setup → rollPending → main`, mit `discardPending` und `robberPending` als
Zwischenstufen nach einer Sieben). `discardPending` merkt sich namentlich, wer
noch abwerfen muss — genau der Punkt, an dem Etappe 5 auf mehrere Spieler
gleichzeitig wartet. Eine Aktion zur falschen Zeit ist ein gewoehnlicher
`RuleViolation`, kein Sonderfall im Code.

**Der Zufall liegt im Zustand.** `rollDice` und der Diebstahl verbrauchen den
RNG aus Etappe 1 und legen den Nachfolgezustand zurueck.
**Merkposten fuer Etappe 5:** der RNG-Zustand gehoert zur geheimen Haelfte. Wer
ihn kennt, rechnet jeden kuenftigen Wuerfelwurf voraus — er steht auf derselben
Liste wie die Handkarten der Mitspieler und darf nie in eine `PlayerView`.

**Keine Ereignisliste im Ergebnis.** Urspruenglich war `ReduceResult` mit einer
`events`-Liste geplant. Beim Ausarbeiten war das Vorbau nach Regel 5: der Wurf
steht als `lastRoll` im Zustand, die Ertraege sind ableitbar, und in der
Hotseat-Partie aus Etappe 3 ist ohnehin alles sichtbar. Der konkrete Anlass
entsteht in **Etappe 5** — ein Diebstahl ist fuer die Beteiligten eine andere
Nachricht als fuer den Rest des Tisches. Dann mit Anlass statt auf Verdacht.

**Siegpunkte werden gerechnet, nicht gespeichert.** Ein Feld im Spielerzustand
waere eine zweite Wahrheit neben der Belegung des Bretts und liefe beim ersten
vergessenen Nachziehen auseinander.

**Die Laengste Handelsstrasse ist der laengste Kantenzug**, nicht der laengste
Pfad: keine Strasse zweimal, Knoten schon. Der Unterschied ist im Spiel
sichtbar — eine Schleife zaehlt ganz, eine Kreuzung mit drei Armen nur zwei
davon. Erschoepfende Tiefensuche von jedem Endpunkt; bei hoechstens fuenfzehn
Strassen schnell genug und offensichtlich richtig. Eine fremde Siedlung
unterbricht die Strecke, enden darf sie dort.

**Bank- und Hafenhandel sind dabei** (Spielerhandel bleibt Etappe 8). Ohne ihn
koennte ein Spieler mit fuenfzehn Erz und ohne Holz nie wieder bauen, und
Etappe 3 waere kein vollstaendiges Spiel. Der Kurs wird **abgeleitet, nicht
mitgeschickt**: ein Client, der sich sein Verhaeltnis selbst aussucht, waere
genau das Ergebnis statt der Absicht, die Regel 3 ausschliesst.

**Das Brett wird gemerkt, nicht gespeichert.** `boardOf(scenario)` leitet die
Topologie einmal je Szenario ab und haelt sie in einer `WeakMap`. Von aussen
eine reine Funktion; im `GameState` steht sie nicht, weil sie dort von den
Feldern abweichen koennte.

### Aenderungen an Etappe-1-Dateien

- **`ScenarioDefinition` kennt jetzt `minPlayers` / `maxPlayers`.** Fuer wie
  viele Spieler ein Brett taugt, ist eine Eigenschaft des Bretts und nicht des
  Regelwerks: 19 Felder tragen keine sechs Spieler. `createGame` prueft die
  Tischgroesse dagegen. Die Werte kommen aus dem Blueprint (`classic34` 3–4,
  `classic56` 5–6).
- **Das RuleSet kennt `victoryPoints` und `longestRoadMinimum`.** Damit steht
  auch in der Wertung keine Zahl im Code — eine Variante mit dreifach zaehlenden
  Staedten ist ein zweites RuleSet und kein zweiter Codepfad.

### Offene Punkte

- **Kein `PlayerView`, kein State-Filtering.** Der `GameState` ist die volle
  Serversicht. Die Aufteilung kommt in Etappe 5; der Zustand ist so gebaut, dass
  sie eine reine Projektion sein kann (geheim sind `rng` und die `resources` der
  Mitspieler).
- **`legalActions` zaehlt das Abwerfen nicht auf.** Bei acht Handkarten gibt es
  dutzende gueltige Kombinationen; sie alle aufzulisten waere nutzlos. Wie viele
  Karten faellig sind, sagt `discardCountFor` — die Auswahl trifft der Spieler.
  Die Oberflaeche in Etappe 3 braucht dafuer ein eigenes Bedienelement.
- **`game/fixtures.ts` ist Testmaterial im Quellbaum.** Es steht nicht im
  Barrel, wird aber mitkompiliert — dieselbe Unsauberkeit wie bei den
  Testdateien im `dist`, mit derselben Begruendung aufgeschoben.
- **Die Strategie im Integrationstest ist stumpf** (Stadt vor Siedlung vor
  Strasse, sonst tauschen, sonst Zug beenden). Sie belegt, dass eine Partie
  laeuft und endet, nicht dass das Spiel ausgewogen ist. Balance ist eine Frage
  fuer Etappe 3, wenn man zusieht.
- Die Erinnerungsposten aus Etappe 0 und 1 gelten unveraendert: kein ESLint,
  keine React-Komponententests, kein CI, kompilierte Testdateien im `dist`, kein
  Node-Version-Pin, Hafenpositionen gegen die Schachtel zu pruefen, Knoten- und
  Kanten-Ids ohne Branded Types.

### Naechste Etappe

**Etappe 3 — `client`: SVG-Board + Hotseat.** Erstmals sichtbar: das Brett aus
Etappe 1 gerendert, die Regeln aus Etappe 2 bedienbar, ein vollstaendiges Spiel
ohne Netzwerk. Dort entscheidet sich auch, ob die Felder spitz oder flach oben
stehen — die Geometrie ist dazu bewusst orientierungsagnostisch geblieben.

Wie gehabt: zuerst ein Plan zur Abnahme, dann Code.

---

## Etappe 3 — `client`: SVG-Brett und Hotseat ✅

Stand: 2026-08-01, Branch `etappe-3-client-hotseat`.

Alles unter `apps/client/src/`. **`packages/shared` ist unangetastet** — keine
Zeile, keine Datei. Das war die Probe aufs Exempel fuer Etappen 1 und 2: was
dort gebaut wurde, hat fuer eine vollstaendige Oberflaeche gereicht, ohne
Nachbesserung.

Entwurf und Plan liegen unter `docs/superpowers/`.

### Abnahme

| Pruefung                                      | Ergebnis                                           |
| --------------------------------------------- | -------------------------------------------------- |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                              |
| `pnpm test`                                   | 548 Tests gruen (shared 442, server 13, client 93) |
| `pnpm build`                                  | gruen, Client-Bundle 328 kB (99 kB gzip), CSS 6 kB |
| `pnpm format:check`                           | gruen                                              |
| `pnpm --filter @conquerist/server acceptance` | 7/7 gruen, gegen laufende Server                   |

Der Client waechst damit von 37 auf 93 Tests. Der Erinnerungsposten „keine
React-Komponententests" aus Etappe 0 ist erledigt.

### Was die Tests belegen

- **Die Zeichnung kann nicht von der Geometrie abweichen.** Die Ecken eines
  Feldes werden nicht aus Winkeln gerechnet, sondern aus den Knoten-Ids
  abgeleitet: eine Id _ist_ die Menge ihrer drei Felder, und der Schwerpunkt
  dieser drei Mittelpunkte ist genau die Ecke. Der Test prueft das ueber **alle**
  19 Felder und alle sechs Ecken gegen `vertexId` — dieselbe Idee wie der
  Kanonizitaetstest aus Etappe 1.
- **Die Ausrichtung ist festgeschrieben**: die oberste Ecke liegt senkrecht ueber
  dem Mittelpunkt, im Abstand eines Umkreisradius. Bei Kante oben laegen dort
  zwei Ecken; der Test faellt dann durch.
- **Die Klickkarte ist vollstaendig und eindeutig.** Was `legalActions` nennt,
  steht in genau einer Karte und genau einmal — als Mengenvergleich geprueft,
  nicht als Stichprobe. Zwei Aktionen auf demselben Knoten waeren ein
  Widerspruch in den Regeln, deshalb wirft der Aufbau dort.
- **Eine ganze Partie laeuft ueber die Klickkarten** (`fullGame.test.ts`), auf
  beiden Brettern, bis `phase === 'finished'`. Gezaehlt wird dabei, dass die
  Sonderwege wirklich vorkommen und nicht nur moeglich sind: Abwerfen nach einer
  Sieben, Raeuber versetzen, Bankhandel. Und: **`replay` baut aus der im Client
  gesammelten Folge denselben Endzustand** — Regel 2 gilt damit auch ueber die
  Oberflaeche, und Etappe 6 kann die Folge unveraendert uebernehmen.
- **Verdecken ist eine Projektion**, kein Ausblenden: fremde Haende werden zu
  `null`, die eigene nie, die Kartenzahl bleibt sichtbar.
- Mit jsdom: Klick auf einen leuchtenden Knoten setzt die Siedlung und schaltet
  auf die Strasse weiter; nach der Gruendung ist nichts baubar, bevor gewuerfelt
  ist; der Abwerf-Dialog gehoert genau einer Person.

### Getroffene Entscheidungen

**Der Client kennt keine einzige Regel.** Kein `if (genug Holz)`, kein „ist der
Knoten frei". Die Oberflaeche ruft `legalActions(state, player)` und sortiert
die Antwort nach Ort (`game/targets.ts`): Knoten, Kante, Feld. Ein Klick
schlaegt darin nach und schickt die gefundene Aktion durch `reduce`. Damit
existiert die Regelauslegung weiterhin genau einmal — dieselbe Kopplung, die
`legalActions` und `reduce` sich seit Etappe 2 teilen, reicht jetzt bis in den
Knopf.

**Gebaut wird „Brett zuerst", ohne Baumodus.** Klick auf einen leuchtenden
Knoten setzt eine Siedlung, auf die eigene Siedlung eine Stadt, auf eine
leuchtende Kante eine Strasse. Das geht, weil die Zielart am Ort eindeutig ist —
und der Test auf Eindeutigkeit haelt genau diese Voraussetzung fest.

**Ausrichtung: Spitze oben.** Die Reihen 3-4-5-4-3 liegen damit waagerecht, wie
im Blueprint und wie auf dem Tisch. Die Entscheidung faellt ausschliesslich in
`board/layout.ts`; `shared` bleibt orientierungsagnostisch.

**Nichts am Brett ist hartkodiert.** Gezeichnet wird die Feldliste des
Szenarios, der `viewBox` folgt aus den tatsaechlichen Ausmassen. `classic56` mit
3-4-5-6-5-4-3 faellt ohne eine Zeile Sonderfall an — belegt durch die
Sechserpartie im Test.

**Die Panels schweben, das Brett wird dazwischen eingepasst.** Der naheliegende
Fehler waere, das Brett unter die Panels zu rechnen; dann laegen genau die
Randknoten darunter, auf die man in der Gruendungsphase klickt. Stattdessen hat
`.board-area` einen Einzug in Panelbreite, und das SVG passt sich per
`preserveAspectRatio` hinein — ohne Messung zur Laufzeit.

**Trefferflaechen statt Pixelrechnung.** Knoten sind `<circle>`, Kanten `<line>`
mit unsichtbarer breiter Fassung. Der Browser trifft, nicht eine eigene
Abstandsrechnung — und damit gibt es keine zweite Geometrie neben Etappe 1.

**Namen und Farben gehoeren in den Client** (`seats.ts`). `PlayerState` kennt
`id`, `resources`, `piecesLeft` — mehr nicht, und das ist richtig: wie jemand
heisst, ist keine Regelfrage. Ab Etappe 4 wird aus der Sitz-Id eine `user_id`
(Regel 7), ohne Aenderung an der Logik.

**Verdecken ist die Vorarbeit fuer `PlayerView`.** Der Schalter im Tisch-Panel
zeigt fremde Haende nur als Anzahl. Die Projektion ist eine reine Funktion
(`game/view.ts`) — in Etappe 5 wird daraus dieselbe Projektion, nur
serverseitig und nicht mehr abschaltbar.

**Der Kurs im Handelsfenster wird abgeleitet, nicht gewaehlt.** `tradeRateFor`
liefert ihn, hinaus gehen nur `give` und `receive`. Ein Client, der sich sein
Verhaeltnis aussucht, waere genau das Ergebnis statt der Absicht, die Regel 3
ausschliesst.

**Die Etappe-0-Diagnose ist umgezogen, nicht weggeworfen** — in ein
zugeklapptes Feld auf dem Startbildschirm. Dabei ist ein echter Fehler
aufgefallen und behoben: `<details>` rendert seinen Inhalt auch zugeklappt und
versteckt ihn nur optisch. `useConnection` waere also gelaufen, und eine
Hotseat-Partie haette eine WebSocket-Verbindung aufgebaut, die sie nicht
braucht. Jetzt entsteht der Inhalt erst beim Aufklappen; ein Test haelt das
fest.

**Der Seed steht im Startbildschirm.** Vorbelegt aus `crypto` — die einzige
Stelle im Projekt mit echtem Zufall, und die Grenze zwischen Welt und Logik.
Ab dem Eingabefeld ist alles wieder reproduzierbar: ein Brett, das komisch
aussieht, ist damit ein Fehlerbericht statt einer Erinnerung.

### Abweichungen vom Plan

- **Ein Test mehr als geplant.** `fullGame.test.ts` war nicht vorgesehen. Er ist
  entstanden, weil das Durchspielen von Hand im Browser nicht automatisierbar
  ist — er geht dieselben Wege wie die Oberflaeche und faengt eine Sackgasse ab,
  bevor sie jemand in der Brettmitte findet. Er ersetzt das Zuschauen nicht.
- **Zwei Testerwartungen im Plan waren falsch** und wurden beim Umsetzen
  korrigiert: `replay` liefert ein `ReduceResult` und keinen Zustand, und
  „Gruendungssiedlung" enthaelt kein grossgeschriebenes „Siedlung".
- **Die Sechserpartie im Test bekommt eine ausgeschriebene Frist** (30 s statt
  der voreingestellten 5 s). Sie ist wirklich so lang: `actionTargets` fragt in
  jedem Schritt `legalActions`, und das laeuft ueber alle Knoten, Kanten und
  Kurse. Im Spiel geschieht das einmal je Bild und faellt nicht auf.

### Offene Punkte

- **Von Hand gespielt wurde noch nicht.** Die Kette laeuft, die Partie laeuft
  automatisch durch, aber niemand hat zugesehen. Was dabei zu pruefen ist:
  Lesbarkeit der Zahlenchips und Hafenmarken, ob das Brett bei schmalem Fenster
  noch unter ein Panel geraet, und ob die Partie sich gut anfuehlt. Das ist der
  erste Punkt fuer die naechste Sitzung.
- **Keine Sitzverwaltung ueber die Partie hinaus.** „Zurueck zum Start" wirft
  die Partie weg. Ohne Persistenz (Etappe 6) waere alles andere Vorbau.
- **Kein Rueckgaengig.** Bewusst: mit verdeckter Information ab Etappe 5 waere es
  nicht haltbar.
- **Keine Animationen.** Ein Wurf erscheint, er rollt nicht.
- **Der Verlauf haelt Saetze, keine Ereignisse.** Abgeleitet aus dem
  Zustandsuebergang. Ereignisse bekommen ihren Anlass in Etappe 5.
- **Das Client-Bundle waechst von 283 auf 328 kB** (86 → 99 kB gzip). Erwartbar:
  Etappe 3 ist die erste, die `shared` wirklich benutzt. Der Hinweis aus Etappe 1
  auf feinere Einstiegspunkte bleibt fuer Etappe 9 stehen.
- Die Erinnerungsposten aus Etappe 0 bis 2 gelten weiter: kein ESLint, kein CI,
  kompilierte Testdateien im `dist`, kein Node-Version-Pin, Hafenpositionen
  gegen die Schachtel zu pruefen, Knoten- und Kanten-Ids ohne Branded Types.

### Naechste Etappe

**Etappe 4 — `server`: WS-Infra, SQLite, Gast-Identitaet.** Aus dem Hotseat wird
ein Tisch mit mehreren Geraeten. Der Client hat dafuer schon die richtige Form:
`useHotseatGame` haelt Zustand und Aktionsfolge an einer Stelle, und die
verdeckte Ansicht ist bereits eine Projektion.

Wie gehabt: zuerst ein Plan zur Abnahme, dann Code.

---

## Etappe 4+5 — Online-Partie: Server als Autoritaet ✅

Stand: 2026-08-02, Branch `etappe-4-online`.

Beide Etappen zusammen, weil sie eine Sache sind: ein Server, der den Zustand
haelt, ist ohne Client, der ihn liest, nicht abnehmbar. Aus dem Hotseat ist ein
Tisch auf sechs Geraeten geworden.

Entwurf und Plan liegen unter `docs/superpowers/`.

### Abnahme

| Pruefung                                      | Ergebnis                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                |
| `pnpm test`                                   | 640 Tests gruen (shared 462, server 50, client 128)  |
| `pnpm build`                                  | gruen, Client-Bundle 346 kB (104 kB gzip), CSS 17 kB |
| `pnpm format:check`                           | gruen                                                |
| `pnpm --filter @conquerist/server acceptance` | 21/21 gruen, gegen laufende Server                   |

Die Zahlen sind der Stand **nach** dem Nachtrag weiter unten. Bei der Abnahme
selbst waren es 611 Tests und 19 Pruefungen; die Differenz kam beim ersten
Ausprobieren von Hand dazu.

Die Abnahme ist von 7 auf 19 Pruefungen gewachsen. Die zwoelf neuen spielen
eine echte Dreierpartie ueber drei getrennte WebSocket-Verbindungen: anmelden,
Raum erstellen, beitreten, starten, die Gruendungsphase durchspielen, und dabei
pruefen, was diese Etappe ausmacht — jeder bekommt seine eigene Sicht, fremde
Handkarten sind `null`, `rng` steht in keiner Nachricht, nur einer hat Zuege,
ein Zug fuer einen anderen wird abgelehnt, ein Abriss macht den Platz nicht
frei, und das Sitzungsgeheimnis bringt dieselbe Person mit ihrem Stand zurueck.

### Was die Tests belegen

- **Die Geheimhaltungsgrenze haelt, und zwar rekursiv geprueft.** Der Test
  sammelt alle Schluessel des Sichtbaums ein und sucht `rng` darin — nicht nur
  auf der obersten Ebene. Wer den Zufallszustand kennt, rechnet jeden kuenftigen
  Wurf voraus.
- **Ein Ereignis, das sein Schema verletzt, geht nicht hinaus.** Der Test
  schickt eine `view`, die keine `PlayerView` ist, und prueft, dass **nichts**
  gesendet wird. Lieber ein Spieler ohne Aktualisierung als ein `rng` auf der
  Leitung.
- **Der Raum ist ohne Netz und ohne Datenbank pruefbar.** Neun Tests fuer
  Beitritt, Farbvergabe, vollen Tisch, Start nur durch den Host, Fremdzug,
  Abriss und Verlassen — alle gegen reine Funktionen.
- **Beide Seiten rechnen das Abwerfen gleich.** Der Client hat mit
  `discardCountForView` zum ersten Mal eine Rechnung, die es auch in `shared`
  gibt; ein Test vergleicht beide ueber alle Spieler.

### Getroffene Entscheidungen

**Der Raum ist ein Wert, kein Objekt mit Methoden.** Jeder Uebergang gibt einen
neuen Raum zurueck — dieselbe Denkweise wie beim `GameState` aus Etappe 2, und
aus demselben Grund: so ist jeder Schritt ohne Socket pruefbar. Codes erfinden
und Nachrichten verschicken passiert deshalb ausdruecklich woanders.

**Zwei Protokoll-Registries statt einer mit leeren Feldern.** Die bestehende
bildet Anfrage auf Antwort ab. Ein Ereignis hat keine Anfrage und damit weder
`responseType` noch Request-Schema. Zwei leere Felder mit Erklaerung waeren
schlechter als zwei Registries mit klarem Zweck.

**Zugestellt wird je Empfaenger, nicht je Raum.** Ein gemeinsamer Broadcast
waere bequemer und wuerde jedem die Handkarten aller schicken. Stattdessen
entsteht fuer jeden eine eigene `PlayerView` — und die erlaubten Zuege gleich
mit, denn `legalActions` braucht den vollen Zustand und laeuft deshalb auf dem
Server.

**Das Gast-Geheimnis liegt gehasht in der Datenbank.** Es ist faktisch ein
Passwort: wer es hat, ist diese Person. Und in Etappe 7 wird aus genau dieser
Zeile per UPDATE ein richtiges Konto — wer jetzt Klartext speichert, hat das
Datenleck dann schon eingebaut. Ein unbekanntes Geheimnis wird abgelehnt statt
still durch einen neuen Gast ersetzt; sonst waere ein Tippfehler im
`localStorage` nicht von einem Angriff zu unterscheiden.

**Gleicher Ursprung ist erlaubt.** Bis Etappe 3 stand dort eine feste
Origin-Liste. Eine Tunneladresse wechselt bei jedem Start, und eine Liste, die
man vor jedem Spieleabend pflegt, pflegt niemand. Der Server liefert den Client
jetzt selbst aus; damit ist jede Verbindung gleichen Ursprungs, und die
Ablehnung fremder Origins bleibt trotzdem in Kraft.

**Der Reconnect hat keinen eigenen Zweig.** Beim Verbindungsaufbau laeuft immer
dieselbe Folge: `hello` mit dem gespeicherten Geheimnis, danach `joinRoom`,
falls ein Code bekannt ist. Findet der Server die Person an einem Tisch,
schickt er Raum und Partie von sich aus. Das ist der ganze Reconnect.

**Ein Stand mit kleinerer `version` wird verworfen** — und zwar so, dass
dasselbe Objekt zurueckkommt, damit React gar nicht erst neu rendert. Nach
einem Reconnect treffen Raum- und Spielstand dicht hintereinander ein, und
dazwischen kann ein Zug liegen.

**Die Woerter sind nach `shared` gewandert, die Farben nicht.** Der Server baut
seit dieser Etappe den Verlaufssatz — er ist der einzige, der beide Zustaende
kennt. Also brauchen beide Seiten dieselben deutschen Bezeichnungen. Die
Gelaendefarben blieben im Client, direkt neben den Variablen in `index.css`,
mit denen sie uebereinstimmen muessen. Der Server hat fuer eine Farbe keine
Verwendung.

**Der Schalter „Fremde Haende verdecken" ist verschwunden.** Verdeckt ist keine
Ansichtssache mehr, sondern der Zustand. `resources === null` heisst jetzt
„gehoert jemand anderem" und nicht „ausgeblendet" — ein Unterschied, den man
der Oberflaeche nicht mehr abgewoehnen kann. Auch die lokale Partie zeigt nur
noch die Hand dessen, der handeln darf: der Bildschirm wandert weiter, die
Handkarten sollen es nicht.

**Die Dialoge lesen ihre Auswahl aus der Aktionsliste.** Wer als Opfer eines
Raeuberzugs in Frage kommt, stand bisher in einer Client-Rechnung ueber fremde
Handkarten — die es jetzt nicht mehr gibt. Die moeglichen Opfer stehen in den
Zuegen, die erlaubt sind. Dasselbe beim Banktausch. Das ist kein Umweg, sondern
die konsequente Fassung von „der Client kennt keine Regel".

### Design

Der Abschnitt „Design" in `CLAUDE.md` ist mit dieser Etappe entstanden und ab
jetzt Abnahmekriterium. Drei Sachen sind daraus konkret geworden:

- **Der Wartebereich zeigt leere Plaetze als Spielsteine.** Jeder noch freie
  Platz steht als gestrichelter Umriss in genau der Farbe, die er bekommen
  wird. Wie viele fehlen, sieht man, ohne eine Zahl zu lesen — die Zahl steht
  trotzdem daneben, weil Farbe und Form nie allein etwas tragen duerfen.
- **Die Verben trennen die beiden Wege.** Online wird eine Partie _erstellt_
  (danach wartet man), an einem Geraet wird sie _gestartet_ (sie laeuft
  sofort). Der Unterschied steht im Wort und nicht in einer Hervorhebung.
- **Bewegt wird nur, wo sich der Zustand aendert:** der Raeuber gleitet (man
  soll sehen, woher er kam), ein neues Bauwerk waechst kurz auf, und ein
  Kartenzuwachs erscheint als `+2` am Sitz. Der Zuwachs kommt aus der Differenz
  zweier `cardCount` — nicht aus einer Ertragsrechnung, denn die waere die
  Regel ein zweites Mal. Er verblasst ausserdem nicht von selbst: eine
  abgeschaltete Animation steht sofort an ihrem Ende, ein ausblendender Chip
  waere fuer alle mit `prefers-reduced-motion` von Anfang an unsichtbar.

### Abweichungen vom Plan

- **Aufgabe 13 und 14 sind ein Commit geworden.** Die Weiche in `App.tsx`
  gehoerte laut Plan zu 13, kann aber erst stehen, wenn der Spielbildschirm
  eine Sicht liest — das ist 14. Ein Zwischenstand, in dem eine gestartete
  Online-Partie nirgends hinfuehrt, waere ein wissentlich kaputter Commit
  gewesen.
- **Kein Ertrag steigt ueber dem Feld auf.** Der Plan sah „+1 Erz" ueber dem
  ausschuettenden Feld vor. Dafuer muesste der Client wissen, welches Feld bei
  einer Acht liefert und ob der Raeuber es blockiert — das ist die Ertragsregel,
  ein zweites Mal ausgelegt. Stattdessen der Zuwachs je Spieler aus der
  Differenz; das _warum_ steht im Verlaufssatz, den der Server baut.
- **Der Wurf zaehlt sich nicht ein.** Vier Sekundenzehntel hochzaehlende
  Ziffern sind Dekoration, die sich als Information ausgibt. Der Wurf steht da,
  sobald er da ist.
- **Zwei Testerwartungen aus dem Plan waren falsch** und wurden beim Umsetzen
  korrigiert: ein Array-Literal aus Konstanten weitet seine Literaltypen zu
  `string` (`as const` noetig), und der Startknopf im Wartebereich heisst
  „Partie starten" wie auf dem Startbildschirm — nicht „Starten", wie der
  Testfilter es erwartete. Design-Regel 8 (ein Wort bleibt durch den ganzen
  Ablauf gleich) schlaegt hier den Plan.
- **`tradeRateFor` in `shared` nimmt jetzt einen Strukturtyp** statt eines
  vollen `GameState`. Es braucht nur Brett und Belegung; so kann auch eine
  `PlayerView` den Kurs ausrechnen, ohne dass eine Regel doppelt ausgelegt
  wird — es ist dieselbe Funktion.

### Offene Punkte

- **Von Hand gespielt wurde immer noch nicht.** Die Abnahme spielt eine Partie
  ueber das Protokoll durch, aber niemand hat zu sechst an sechs Geraeten
  gesessen. Der Punkt aus Etappe 3 bleibt damit offen und waechst: dazu kommt
  jetzt, ob der Wartebereich auf einem Handy taugt und ob der Zuwachs-Chip
  auffaellt, ohne zu stoeren.
- **Kein Tunnel ausprobiert.** Die Origin-Regel ist dafuer gebaut und getestet,
  aber es lief noch kein `cloudflared` dagegen.
- **Ein Neustart wirft laufende Partien weg.** Die Raeume liegen im Speicher;
  Persistenz ist Etappe 6. Beim Entwickeln faellt das auf, weil `tsx watch` bei
  jedem Speichern neu startet.
- **Kein Rundenwechsel-Hinweis fuer den, der nicht dran ist.** Online sieht man
  am Tisch, wer handelt, aber es holt einen nichts an den Bildschirm zurueck.
- **Kein Schutz gegen einen Host, der einfach geht.** Verlaesst er den
  Wartebereich, rueckt der naechste Sitz nach — in einer laufenden Partie
  passiert nichts, der Platz bleibt getrennt stehen.
- Die Erinnerungsposten aus Etappe 0 bis 3 gelten weiter: kein ESLint, kein CI,
  kein Node-Version-Pin, Hafenpositionen gegen die Schachtel zu pruefen,
  Knoten- und Kanten-Ids ohne Branded Types.

### Nachtrag: was das erste Ausprobieren von Hand gebracht hat

Der offene Punkt „von Hand gespielt wurde noch nicht" ist angegangen worden,
und er hat sofort geliefert. Vier Dinge in derselben Sitzung:

**Der Server kam mit seinem eigenen Standardwert nie hoch.** `better-sqlite3`
legt den Ordner einer Datenbankdatei nicht an, sondern wirft „directory does
not exist" - und `data/` steht in `.gitignore`, existiert auf einem frischen
Clone also nicht. Aufgefallen ist es erst beim Start ohne `DATABASE_FILE`; die
Abnahme hatte es nie getroffen, weil sie gegen `:memory:` laeuft. **Die
Lehre:** ein Standardwert, den kein Test benutzt, ist ungetestet - auch wenn
alles drumherum gruen ist. `openDatabase` legt den Ordner jetzt an, mit Test.

**„Tisch verlassen" wirkte nicht.** Ursache war nicht der Knopf, sondern eine
Luecke zwischen zwei richtigen Entscheidungen: der Server nimmt den Platz weg
und schickt den neuen Raumstand an alle, **die am Tisch sitzen** - den
Verlassenden also nicht mehr. Der Client hatte aber keinen Weg, seinen Raum
selbst loszuwerden, und blieb im Wartebereich stehen. Nachgemessen statt
geraten:

```
Ereignisse bei Ben nach dem Verlassen: []
Ereignisse bei Anna (bleibt sitzen):   ["room.state"]
```

Behoben auf der Client-Seite (`{ type: 'left' }` raeumt den Zustand nach der
Bestaetigung), nicht durch eine Sonderzustellung an Leute, die nicht mehr
mitspielen. Dazu der erste Test mit einer Socket-Attrappe fuer `useOnlineGame`

- der Transport war seit Etappe 0 gegen `SocketLike` gebaut, jetzt zahlt es
  sich aus.

**Die Partie laesst sich im offenen Wartebereich umstellen.** Tischgroesse und
Seed, solange niemand gestartet hat - eine Runde soll nicht neu gegruendet
werden muessen, weil doch einer mehr mitspielt. Drei Grenzen im Server: nur der
Host, nicht kleiner als die Zahl der Sitzenden, und nicht mehr nach dem Start.
Die Tischgroesse wird dabei **am Tisch selbst** eingestellt - der Host legt
einen Platz dazu, und derselbe gestrichelte Umriss, der den freien Platz
anzeigt, ist das Ergebnis. Steuerelement und Anzeige sind dasselbe.

**Handkarten und Trennungen sind sichtbar geworden.** Unten links liegt die
eigene Hand: ein Stapel je Ressource, Kartenfarbe gleich Gelaendefarbe vom
Brett, Motiv als zweiter Traeger, Anzahl als Plakette. Kein Stapel fuer eine
Ressource ohne Karten - eine Null kostet dieselbe Flaeche wie eine Karte und
sagt weniger.

Beim Trennen war die wichtigere Erkenntnis, dass **nichts zu bauen war**: die
Partie steht von selbst, weil es Zuege nur fuer den gibt, der handeln darf, und
der sie ohne Verbindung nicht schicken kann. Gefehlt hat nur die Auskunft. Ein
Test haelt die Invariante jetzt fest (getrennter Spieler am Zug -> niemand
sonst bekommt Zuege), und das Statuspanel sagt es in zwei Staerken: wer nur weg
ist, steht klein und grau da; wartet die Partie auf ihn, bekommt der Satz eine
Kante und erklaert, warum nichts passiert.

**Lokal ist das Zudecken eine Einstellung geworden**, keine Vorschrift. Am
selben Geraet wandert der Bildschirm weiter; wer nebeneinander sitzt und
ohnehin alles sieht, will den Zwischenschritt nicht. Voreingestellt ist
zugedeckt - die vorsichtigere Annahme.

### Noch offen nach dem ersten Ausprobieren

- **Eine ganze Partie zu sechst auf sechs Geraeten** ist weiterhin nicht
  gespielt worden. Was bisher lief, war eine Sitzung mit mehreren Fenstern.
- **Kein Tunnel ausprobiert.** Die Origin-Regel ist dafuer gebaut und getestet,
  aber es lief noch kein `cloudflared` dagegen.
- **Im Wartebereich fehlt das Brett zum Seed.** Der Host wuerfelt neu und sieht
  nur eine Zeichenkette; auf dem Startbildschirm ist das Brett zum Seed der
  Held.
- **Die Kartenmotive sind ungeprueft.** Fuenf von Hand gezeichnete SVG-Pfade,
  nie in Originalgroesse angesehen - Schaf und Aehre koennen auf 26 px daneben
  liegen.
- **Das Brett ist kleiner geworden**, weil die Ablage unten links Platz
  braucht (Einzug von 5,5 auf 11 rem).

### Naechste Etappe

**Etappe 6 — Persistenz: Action-Log und Snapshot, Lobby.** Der Raum ist bereits
ein Wert und damit das, was sich ablegen laesst; die Aktionsfolge ist seit
Etappe 3 genau die Eingabe fuer `replay`. Beides trifft sich hier.

Wie gehabt: zuerst ein Plan zur Abnahme, dann Code.

---

## Etappe 6 — Persistenz und „Deine Partien" ✅

Stand: 2026-08-02, Branch `etappe-4-online`.

Entwurf und Plan liegen unter `docs/superpowers/`.

### Abnahme

| Pruefung                                      | Ergebnis                                              |
| --------------------------------------------- | ----------------------------------------------------- |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                 |
| `pnpm test`                                   | 665 Tests gruen (shared 462, server 72, client 131)   |
| `pnpm build`                                  | gruen, Client-Bundle 348 kB (105 kB gzip), CSS 17 kB  |
| `pnpm format:check`                           | gruen                                                 |
| `pnpm --filter @conquerist/server acceptance` | 23/23 gruen, gegen laufende Server                    |
| Kaltstart von Hand                            | Server abgewuergt, neu gestartet, Partie unveraendert |

Der Kaltstart ist die Pruefung, die kein Test abdeckt: eine Dreierpartie bis in
die Gruendungsphase gespielt, den Serverprozess hart beendet, aus derselben
Datei neu gestartet — im Log `"rooms":1, Raeume von der Platte geladen` — und
mit dem Sitzungsgeheimnis zurueck in dieselbe Partie. Gleicher Raum, gleiche
Phase, dieselben vier Bauwerke.

### Was die Tests belegen

- **Ein Raum ueberlebt den Weg durch die Datenbank, samt Zufallszustand.**
  `roundtrip.test.ts` legt eine Partie ueber eine echte Datei an, spielt sechs
  Zuege, wirft die Registry weg und baut sie neu — `expect(loaded.game).toEqual(
room.game)` schliesst `rng` ein. Ohne ihn wuerfelte die Partie nach einem
  Neustart anders weiter, und das faellt erst Runden spaeter auf.
- **Der Wartebereich ueberlebt genauso.** Eine Partie, die noch nicht begonnen
  hat, ist auch eine.
- **Ein kaputter Raum nimmt die anderen nicht mit.** Ein Zug, den es in der
  gespeicherten Lage nicht geben kann, laesst `replay` scheitern; der Raum wird
  uebersprungen und laut protokolliert, die uebrigen stehen.
- **Ein Plattenfehler wirft den Betrieb nicht um.** Ein Store, der beim
  Schreiben wirft, laesst den Raum trotzdem entstehen — er ist regelgerecht,
  nur ungesichert.
- **Die Uebersicht traegt nichts Verdecktes hinaus.** Weder `resources` noch
  `rng` stehen in einer Zusammenfassung, geprueft im Test und in der Abnahme.

### Getroffene Entscheidungen

**Kein Snapshot, und das ist gemessen.** Eine kuenstlich auf 4000 Zuege
verlaengerte Partie stellt sich in 19 ms wieder her, ihr Log ist 152 kB gross;
eine echte Partie liegt bei rund 3 ms und 25 kB. Ein Snapshot kauft dafuer
nichts und kostet eine zweite Darstellung desselben Sachverhalts — eine, die
von der ersten abweichen kann, ohne dass es jemand merkt. Das Action-Log war
seit Etappe 2 das Versprechen von Regel 2; hier wird es eingeloest.

**Der Startzustand geht als Ganzes auf die Platte, nicht nur der Seed.** Ein
`GameState` traegt Szenario und RuleSet als Kopie in sich (Entscheidung aus
Etappe 2). Damit spielt eine alte Partie nach einer Aenderung an
`CLASSIC_RULES` unter den Regeln weiter, unter denen sie begonnen hat. Wuerde
nur der Seed gespeichert und der Startzustand neu gebaut, waere jede
Regelanpassung ein stiller Bruch aller laufenden Partien.

**`rooms/room.ts` ist unangetastet geblieben.** Der Raum ist ein Wert und
rechnet nicht mit Datenbanken — die Entscheidung aus Etappe 4 hat sich hier
ausgezahlt: alle Raumtests laufen unveraendert weiter, und die Persistenz sitzt
vollstaendig in der Registry hinter einer Schnittstelle.

**Die Schnittstelle hat zwei Umsetzungen, nicht eine.** `MemoryRoomStore` ist
kein Zierrat: eine Schnittstelle mit genau einem Implementierer ist meist nur
ein umbenannter Aufruf. Und die Registry-Tests laufen weiter ohne Datei.

**Drei Dinge stehen bewusst nicht in der Datenbank.** Kein `name` und kein
`color` je Sitz (der Name steht in `users`, die Farbe folgt aus der Position),
kein `connected` (verbunden zu sein gehoert diesem Serverlauf, nicht der
Partie — nach einem Neustart ist niemand verbunden), und kein abgeleiteter
Spielzustand. `version` dagegen **muss** gespeichert werden: der Client
verwirft kleinere Versionen, und finge sie nach einem Neustart wieder bei 1 an,
ignorierte jeder noch offene Browser den frischen Stand.

**Ein Schreibfehler nimmt einen angenommenen Zug nicht zurueck.** Der Zug ist
bereits regelgerecht; ihn nachtraeglich am Plattenzustand scheitern zu lassen
hiesse, dass dieselbe Aktion mal gilt und mal nicht. Der Speicher ist die
Wahrheit des Betriebs, die Platte die Absicherung.

**Wer in mehreren Raeumen sitzt, wird nicht mehr automatisch in einen
geschoben.** `hello` oeffnet nur noch dann von sich aus einen Raum, wenn es
genau einer ist. Bei mehreren entscheidet die Liste — welcher gemeint ist,
weiss nur der Spieler. Umgekehrt gilt eine Trennung jetzt in **allen** seinen
Raeumen: eine Verbindung gehoert der Person, nicht einem Raum.

### Abweichungen vom Plan

- **`RoomStore` ist duenner geworden als im Entwurf.** Kein `ordinal` von
  aussen (die laufende Nummer ist eine Speicherfrage, und ein von aussen
  gereichter Zaehler waere eine Gelegenheit, ihn falsch zu fuehren) und kein
  `roomsOf` (nach `loadAll` liegt alles im Speicher; eine Datenbankabfrage
  waere ein zweiter Weg zu einer Auskunft, die schon da ist). Der Entwurf wurde
  entsprechend nachgezogen.
- **Beim Pruefen von Hand war die erste Erwartung falsch, nicht der Code.** Die
  Versionsnummer war nach dem Neustart 16 statt 12 — richtig so: jedes Trennen
  und Anmelden zaehlt sie hoch. Die Anforderung ist „faellt nicht zurueck", und
  genau das prueft sie jetzt.

### Offene Punkte

- **Ein Umbau am Reducer kann alte Logs unbrauchbar machen.** Keine Vorkehrung,
  bewusst: jede (Versionsnummern, Migrationen) kostet in einem Projekt dieser
  Groesse mehr als sie bringt. Ein Snapshot waere davor uebrigens genauso wenig
  sicher.
- **Keine Frist fuer verwaiste Partien.** Leere Raeume verschwinden nach fuenf
  Minuten, beendete bleiben liegen und fallen nur aus der Liste. Eine Partie,
  an die seit Wochen niemand zurueckkommt, bleibt.
- **Kein Rauswerfen und keine Hostuebergabe** in laufenden Partien.
- **Keine oeffentliche Partieliste.** Beitritt bleibt ueber Code und Link — eine
  eigene Frage, falls sie je gestellt wird.
- Die Erinnerungsposten aus Etappe 0 bis 5 gelten weiter: kein ESLint, kein CI,
  kein Node-Version-Pin, nie zu sechst auf sechs Geraeten gespielt, kein Tunnel
  ausprobiert.

### Naechste Etappe

**Entwicklungskarten** — vorgezogen aus Etappe 8. Der Platz dafuer steht seit
Etappe 2: `developmentCard` hat einen Preis in `BUILDABLE_IDS`, und `PIECE_IDS`
schliesst sie ausdruecklich aus, weil sie der Bank gehoeren.

## Entwicklungskarten — vorgezogen aus Etappe 8 ✅

Stand: 2026-08-02, Branch `etappe-4-online`. Commits `8245f13` (Regeln) und
`327c73c` (Oberflaeche).

**Nachgetragen.** Dieser Abschnitt und der naechste sind nach den Commits
geschrieben worden, nicht mit ihnen. Die Zahlen in der Abnahme sind am Stand
`5203d96` gemessen und gelten fuer beide Abschnitte zusammen.

### Abnahme

| Pruefung                                      | Ergebnis                                               |
| --------------------------------------------- | ------------------------------------------------------ |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                  |
| `pnpm test`                                   | 701 Tests gruen (shared 483, server 74, client 144)    |
| `pnpm build`                                  | gruen, Client-Bundle 361 kB (108 kB gzip), CSS 19,8 kB |
| `pnpm format:check`                           | gruen                                                  |

### Getroffene Entscheidungen

**Die zweite geheime Haelfte des Zustands.** Bis hierher waren es `rng` und die
Handkarten der Mitspieler; jetzt auch, wer welche Entwicklungskarte haelt und
was noch im Stapel liegt. Wer den Stapel kennt, weiss vor dem Kauf, was er
zieht — derselbe Bruch wie ein bekannter Wuerfelzustand. `deck` verlaesst den
Server nie, `PlayerView` traegt nur `deckLeft`.

**Oeffentlich ist dagegen, was offen liegt.** Ausgespielte Ritter
(`playedKnights`) und die Anzahl der Karten auf einer fremden Hand
(`developmentCount`) — beides waere am Tisch abzaehlbar, und was abzaehlbar
ist, darf kein Geheimnis der Oberflaeche sein.

**Siegpunktkarten werden nie gespielt, sie zaehlen.** Deshalb stehen sie in
`victoryPointsOf` und nicht in `legalActions`. Und deshalb gibt es
`publicVictoryPointsOf` daneben: der Punktestand eines Mitspielers darf die
verdeckten Karten nicht ueber die Differenz verraten.

**`boughtOnTurn` an der Karte, nicht am Spieler.** Eine Karte darf nicht in der
Runde gespielt werden, in der sie gekauft wurde. Steht der Vermerk an der
Karte, ist die Regel eine Eigenschaft der Karte und keine Buchfuehrung
nebenher; `spend` nimmt ausserdem die **aelteste** spielbare Karte einer Art —
sonst waere bei zwei Rittern nach dem Ausspielen des frischen der alte
weiterhin gesperrt.

**Drei der fuenf Karten stehen nicht in `legalActions`.** Strassenbau,
Erfindung und Monopol brauchen eine Auswahl, die der Spieler trifft; sie alle
aufzuzaehlen waere jedes Kantenpaar, jedes Rohstoffpaar, jede Sorte — derselbe
Grund, aus dem das Abwerfen dort fehlt. Was spielbar **waere**, sagt
`playableCards` in der Sicht; ob die Auswahl zulaessig war, prueft trotzdem der
Reducer.

**Der Strassenbau laeuft ueber das Brett, nicht ueber ein Fenster.** Wo eine
Strasse hinkann, sieht man dort und nirgends besser. Die Anschlussregel bleibt
dabei auf dem Server: `roadBuildingTargets` liefert je moeglicher **erster**
Kante die Kanten, die danach noch gingen — eine Zuordnung und keine flache
Liste, weil die zweite von der ersten abhaengt.

**Der Ritter zieht den Raeuber nicht selbst.** `playKnight` gibt die Karte ab
und stellt die Phase auf `robberPending`; versetzt wird mit einem eigenen
`moveRobber`. Eine Aktion, die zwei Dinge auf einmal tut, muesste beide Regeln
in sich tragen — und die zweite Auslegung ist immer die mit dem Fehler.

### Offene Punkte

- **Kein Handel zwischen Spielern.** Bleibt in Etappe 8.

**Nicht mehr offen: der Ritter bleibt hinter dem Wurf.** In der Schachtel darf
er davor, hier nicht — die Ausnahme kostet eine Sonderregel in jeder
Phasenpruefung und bringt fuers Basisspiel wenig. Am 2026-08-02 vom Nutzer
bestaetigt, damit eine getroffene Entscheidung und kein Versaeumnis. Wer sie
spaeter doch will, baut sie als Regelwert und nicht als zweiten Zweig.

## Zwischenstuecke — Hauptmenue und eine ehrliche Ablehnung ✅

Stand: 2026-08-02, Branch `etappe-4-online`. Commits `76b2adc` und `5203d96`.
Ebenfalls nachgetragen, Zahlen siehe oben.

### Getroffene Entscheidungen

**Das Menue fragt nichts.** Titel, drei Wege, sonst nichts — Name, Seed und
Tischgroesse gehoeren auf den Bildschirm dahinter, hier waeren sie drei Fragen
vor der ersten Entscheidung. Drei gleichwertige Zeilen ohne Hervorhebung:
welcher Weg der richtige ist, weiss der Spieler und nicht der Bildschirm.
„Weiterspielen" erscheint nur, wenn es etwas fortzusetzen gibt, und traegt als
einziges den Akzent — es ist kein vierter Weg, sondern die Rueckkehr in etwas
Angefangenes.

**Der Hintergrund ist das Hexfeld selbst**, gezeichnet mit den Funktionen des
Bretts und nicht als Muster oder Textur. Ohne Bewegung, mit Absicht: ein
driftendes Raster erklaert keinen Zustandswechsel (Regel 5).

**Eine Ablehnung ist kein Serverfehler.** Ein werfender Handler wurde bis dahin
ausnahmslos zu `INTERNAL` mit einer nichtssagenden Meldung. Richtig, solange
niemand weiss, was schiefging — aber wo der Handler es weiss und die Meldung
fuer Spieler geschrieben ist, waere „Interner Serverfehler" zweimal falsch: sie
stimmt nicht, und sie hilft nicht. `RejectedError` traegt ihren Text jetzt als
`REJECTED` hinaus und laeuft nicht durch `onHandlerError` — sie ist ein
normaler Ausgang und kein Vorfall.

**Ein Geheimnis, das der Server nicht kennt, wird weggeworfen.** Genau das
passiert nach einem Datenbankwechsel. Es weiter mitzuschicken sperrt einen
dauerhaft aus; der Client vergisst es und meldet sich ohne an.

## Wuerfel als Spielmaterial — und ein Durchgang durch den Spielfluss ✅

Stand: 2026-08-02, Branch `etappe-4-online`.

Zwei Dinge in einem Zug: die Wuerfel werden zu dem, was sie im Spiel sind — und
weil dafuer der halbe Wurfweg angefasst wurde, gleich ein Durchgang durch den
Spielfluss. Drei Fehler dabei gefunden, alle reproduziert, alle behoben.

### Abnahme

| Pruefung                                      | Ergebnis                                               |
| --------------------------------------------- | ------------------------------------------------------ |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                  |
| `pnpm test`                                   | 719 Tests gruen (shared 492, server 74, client 153)    |
| `pnpm build`                                  | gruen, Client-Bundle 361 kB (108 kB gzip), CSS 20,9 kB |
| `pnpm format:check`                           | gruen                                                  |

### Getroffene Entscheidungen

**Die Wuerfelschale steht im RuleSet.** `rules/dice.ts` beschreibt je Wuerfel
`id`, `faces` und `countsTowardYield`; `robberRoll` sagt, welche Summe den
Raeuber ruft. Bis dahin stand „zwei Sechsseitige" an drei Stellen gleichzeitig
— als Tupel im Zustand, als zwei Ziehungen im Reducer, als zwei Kaestchen im
Browser —, und die Sieben stand als Zahl im Code. Eine Erweiterung mit einem
Ereigniswuerfel haette alle vier finden muessen. Jetzt ist sie ein zweites
RuleSet und kein zweiter Codepfad (Regel 5).

**Der Wurf ist eine Liste, und jedes Ergebnis nennt seinen Wuerfel.** Nicht die
Summe: die liesse sich nicht in die einzelnen Augen zurueckrechnen, und genau
die liegen auf dem Tisch. Nicht die blosse Reihenfolge: der erste Wuerfel, den
eine Erweiterung dazwischenschiebt, verschoebe sonst stillschweigend die
Bedeutung aller gespeicherten Wuerfe. Die Ertragszahl kommt aus `yieldTotal`
und wird gerechnet, nicht gespeichert — dieselbe Haltung wie bei den
Siegpunkten.

**`dice` und `robberRoll` tragen einen Zod-Vorgabewert.** Das ist keine
Bequemlichkeit: seit Etappe 6 liegt der Startzustand samt RuleSet als JSON auf
der Platte. Ohne Vorgabe faenden die neuen Felder dort kein Gegenstueck,
`GameStateSchema.safeParse` schluege fehl, und jede laufende Partie waere beim
naechsten Serverstart weg. Die Wurffolge selbst bleibt bitgleich — alte
Action-Logs replayen unveraendert.

**Die Wuerfel sind der Knopf.** „Wuerfeln" stand neben ihnen und tat, was sie
darstellen; zwei Dinge fuer eine Sache sind eine Erklaerung zu viel. Der
`DiceTray` sitzt jetzt oben in der Aktionsleiste, an der Stelle des Knopfes,
und die Leiste liest sich in der Reihenfolge eines Zuges: werfen, handeln und
kaufen, beenden. Aus dem `StatusPanel` sind die Wuerfel verschwunden — zweimal
dieselben Augen an zwei Ecken waeren eine Verdopplung.

**Gewuerfelt werden darf, was die Aktionsliste hergibt.** Ob die Wuerfel atmen,
haengt an `targets.roll !== null` und an keiner Rechnung im Browser. Der Client
kennt weiterhin keine Regel.

**Bewegung endet in Ruhelage und traegt nie allein.** Das Atmen haengt an „du
musst werfen" und hoert auf, sobald das nicht mehr gilt; das Fallen zeigt, dass
ein neuer Wurf liegt. Beide Keyframes enden beim normalen Wuerfel — die globale
`prefers-reduced-motion`-Regel schaltet Animationen auf einen Augenblick, sie
stehen dann sofort an ihrem Ende, und das darf kein aufgeblasener oder halb
gedrehter Wuerfel sein. Weil dann gar nichts mehr zappelt, tragen die
Aufforderung ein Wort und der Wurf seine Zahl.

**Dass gewuerfelt wurde, wird aus dem Phasenwechsel gelesen.** `rolled` in der
`GameView` ist wahr, wenn der vorige Stand `rollPending` war und dieser nicht
mehr — aus `rollPending` fuehrt genau ein Zug heraus. Ein Vergleich der
Augenzahlen haette zweimal dieselbe Sechs als „kein neuer Wurf" verschluckt,
ein Zaehler im Zustand waere eine zweite Wahrheit neben der Phase gewesen.

**Augenbilder statt Ziffern, bis es keine mehr gibt.** Eine Ziffer im Kaestchen
ist eine Zahlenanzeige, ein Muster ist ein Wuerfel. Ueber sechs Seiten hinaus
gibt es kein gewohntes Muster — dann steht die Zahl da, und eine Erweiterung
mit achtseitigen Wuerfeln bleibt lesbar, ohne dass jemand Punkte erfindet.

### Drei Fehler im Spielfluss

**Die Endabrechnung widersprach sich selbst.** `playerViewOf` haelt die
verdeckten Siegpunktkarten aus fremden Punktestaenden heraus — waehrend des
Spiels richtig, danach falsch: der Endstand listete den Sieger bei allen
anderen mit zwei von drei noetigen Punkten, es fehlten genau die Karten, mit
denen er gewonnen hat. Bei `phase.kind === 'finished'` faellt die Geheimhaltung
jetzt. `scoring.ts` sagte es die ganze Zeit — „erst der Sieg deckt sie auf" —,
nur tat es niemand.

**Der Verlauf hat den Sieg nie gemeldet.** Der Zweig dafuer stand in `log.ts`
beim Zugende, und dort kann er gar nicht auftreten: `finalize` prueft den Sieg
nur fuer den Spieler am Zug, und beim Zugende ist das schon der naechste.
Gewonnen wird immer _mit_ einem Zug — mit einer Stadt, einer Karte, einem
Ritter —, und der Verlauf meldete davon nur den Zug. Der Uebergang von „laeuft"
auf „vorbei" ist unabhaengig von der Zugart lesbar und haengt jetzt hinten an.

**Die Strassenbaukarte war unspielbar, wenn nur eine Strasse ging.** Der
Bildschirm schickte die Aktion erst bei zwei Kanten. Wer die letzte Strasse aus
dem Vorrat legte oder danach nirgends mehr anschloss, bekam eine Sackgasse: auf
dem Brett leuchtete nichts mehr, und die Karte liess sich nur abbrechen —
obwohl `playRoadBuilding` eine einzelne Strasse ausdruecklich annimmt. Gibt es
keine zweite, geht sie jetzt mit einer hinaus.

### Was der Durchgang sonst ergeben hat

- **Ein Sieg im fremden Zug wird erst beim naechsten eigenen Zug bemerkt.** Wer
  durch den Zug eines anderen die Laengste Handelsstrasse und damit das Ziel
  erreicht, gewinnt, sobald er selbst wieder handelt — in der Praxis
  unmittelbar nach seinem Wurf. Ein Test haelt das seit Etappe 2 als gewollt
  fest, und es endet auf dem eigenen Zug, wie es die Regel verlangt. Nur eine
  Sieben kann noch einen Abwurf dazwischenschieben.
- **`piecesLeft` wird mal mit `?? 0` gelesen und mal ohne** (`build.ts` gegen
  `developmentRules.ts` und `legal.ts`). Der Typ ist vollstaendig, das `?? 0`
  ist tot. Kosmetisch, aber ein Hinweis darauf, dass beim Lesen nicht klar ist,
  welcher Fall gemeint war.
- **`discardPending` mit einem getrennten Spieler steht still**, ohne Frist und
  ohne Ersatzzug. Das `StatusPanel` sagt wenigstens, dass das der Grund ist.
  Bleibt offen — dieselbe Frage wie das Rauswerfen aus Etappe 6.

### Naechste Etappe

Unveraendert **Etappe 7: Auth** — Registrierung, Login, Gast-Account
beanspruchen. Die Wuerfel waren ein Vorgriff auf Etappe 10 nur insoweit, als
sie ihn billiger machen: die Schale ist Daten, die Erweiterung braucht keinen
Codepfad.

## Ein Wort fuer eine Sache: „Partie" ✅

Stand: 2026-08-02, Branch `etappe-4-online`. Zwei Entscheidungen des Nutzers,
beide klein und beide vorher als offene Punkte notiert.

### Abnahme

| Pruefung                                      | Ergebnis                                               |
| --------------------------------------------- | ------------------------------------------------------ |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                  |
| `pnpm test`                                   | 719 Tests gruen (shared 492, server 74, client 153)    |
| `pnpm build`                                  | gruen, Client-Bundle 361 kB (108 kB gzip), CSS 20,9 kB |
| `pnpm format:check`                           | gruen                                                  |

### Getroffene Entscheidungen

**„Partie" ueberall, „Spiel" nirgends.** Das Menue sagte „Spiel starten" und
„Spiel beitreten", der Rest der Anwendung durchgaengig „Partie" — „Deine
Partien", „Die Partie laeuft bereits", „Lokale Partie starten". Zwei Woerter
fuer dieselbe Sache liest man als zwei Sachen (Regel 8). Geaendert an vier
Stellen: die drei Menueeintraege, die Ueberschrift des Startbildschirms, sein
Eyebrow „Partie beitreten" und die Ablehnung `GAME_OVER` in `reducer.ts` — die
sieht der Spieler, sie ist Bildschirmtext wie jeder andere.

**Und gleich gebaut, nicht nur gleich benannt.** Aus „Spiel starten — online",
„Lokal spielen", „Spiel beitreten" ist „Partie starten — online", „Partie
starten — lokal", „Partie beitreten" geworden. Drei Zeilen untereinander sind
eine Liste, und eine Liste, deren Eintraege verschieden gebaut sind, laesst
einen nach dem Unterschied suchen, den es nicht gibt: erst das Was, dann das
Wie. Der Startbildschirm traegt danach wortgleich dieselbe Ueberschrift wie der
Eintrag, ueber den man hergekommen ist.

**Der Ritter bleibt hinter dem Wurf.** Bestaetigt statt beibehalten: die
Abweichung von der Schachtel war seit den Entwicklungskarten notiert, und sie
ist jetzt entschieden. `developmentRules.ts` sagt das im Kopfkommentar, damit
beim naechsten Lesen niemand einen vergessenen Punkt darin sieht. Wer sie
spaeter doch will, baut sie als Regelwert und nicht als zweiten Zweig — dieselbe
Form wie bei der Wuerfelschale.

### Offene Punkte

Keine neuen. Der Nutzer hat weitere Menuearbeit angekuendigt; was genau, steht
noch nicht fest.

## Die Ankunft: eine gezeichnete Wortmarke und eine Choreografie ✅

Stand: 2026-08-02, Branch `etappe-4-online`. Die angekuendigte Menuearbeit. Der
Bildschirm bekommt einen Titel, der ihm gehoert, und einen Eingang.

### Abnahme

| Pruefung                                      | Ergebnis                                               |
| --------------------------------------------- | ------------------------------------------------------ |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                  |
| `pnpm test`                                   | 726 Tests gruen (shared 492, server 74, client 160)    |
| `pnpm build`                                  | gruen, Client-Bundle 362 kB (109 kB gzip), CSS 22,6 kB |
| `pnpm format:check`                           | gruen                                                  |

Nicht geprueft: **wie sich die Animation im Browser anfuehlt.** Es stand keine
Browsersteuerung zur Verfuegung. Die Buchstabenformen und die Flugpose wurden
gerastert und angesehen (ein eigener Scanline-Rasterer im Scratchpad, kein
Bestandteil des Projekts); die Zeitverhaeltnisse sind gerechnet, nicht gesehen.
Wer sie das erste Mal laufen sieht, sollte auf zwei Dinge achten: ob 240 ms
schnell genug wirken und ob die Welle im Hexfeld sichtbar oder nur messbar ist.

### Getroffene Entscheidungen

**Der Titel ist gezeichnet, nicht gesetzt — und damit bleibt Regel 3 heil.**
Der Wunsch war „eine bessere Schriftart fuer das Logo", und Regel 3 verbietet
den Font-Download. Die drei Wege waren: einen Subset-Font mitbuendeln (haette
die Regel aufgeweicht), die Systemschrift nur staerker setzen (haette kaum
etwas geaendert), oder die zehn Buchstaben zeichnen. Es sind jetzt zehn Pfade in
`Wordmark.tsx` — kein Font, kein Download, keine Regel gebogen.

**Die Schrift ist aus demselben Winkel geschnitten wie das Brett.** Das ist der
Grund, warum das Zeichnen nicht nur der billigste Ausweg war, sondern der
bessere Entwurf: wo eine normale Schrift rundet, hat diese eine Fase. C, O, Q,
S und U bekommen abgeschraegte Ecken statt Boegen; E, N, I und T sind ohnehin
eckig. Damit ist der Titel nicht „eine Schrift, die zum Spiel passt", sondern
aus demselben Material wie das Hexfeld dahinter, das schon mit den Funktionen
des Bretts gezeichnet wird. Ein Raster haelt alle zehn zusammen: Versalhoehe
100, Stammbreite 17 ueberall, Fase 17 aussen und 10 im Innenraum. Wer einen
Buchstaben aendert, haelt diese drei Zahlen ein — eine Fase von 12 an einer
Stelle sieht nicht nach Variante aus, sondern nach Versehen.

**Regel 5 gilt weiter, der Eingang ist keine Ausnahme davon.** „Bewegung
erklaert einen Zustandswechsel oder entfaellt" — der Eingang _ist_ ein
Zustandswechsel: vorher war nichts da, jetzt ist die Anwendung da. Deshalb
schnellt die Marke herein und rastet ein, der Aufprall laeuft einmal als Welle
durchs Hexfeld, die Wege fallen von oben nach. Danach steht alles still. Was
ausdruecklich nicht gebaut wurde, obwohl es angeboten war: Dauerbewegung,
Atmen, Parallaxe am Mauszeiger. Das waere Dekoration und faellt unter denselben
Satz. Der Kommentar in `MenuScreen.tsx`, der bisher „ohne Bewegung, mit
Absicht" sagte, sagt jetzt, warum es diese eine gibt.

**`backwards` statt `both`, und diesmal aus zwei Gruenden.** Der bekannte:
`prefers-reduced-motion` setzt die Dauer auf 0.01 ms, die Animation steht also
sofort an ihrem Ende — ein Ende darf deshalb nie „unsichtbar" heissen. Der
neue: `both` laesst die Schlussbildmarke fuer immer stehen. Der Eingang der
Menueeintraege endet auf `translateY(0)`, und das haette jedes spaetere
`transform` beim Hover ueberstimmt — die Knoepfe haetten sich nach dem
Eingang nicht mehr geruehrt. Das ist beim Schreiben aufgefallen, nicht beim
Testen; ein Test darauf gibt es nicht, weil jsdom keine Animationen aufloest.

**Die Falle mit dem Praesentationsattribut waere fast ein zweites Mal
zugeschnappt.** In `CLAUDE.md` steht seit `.road { stroke: transparent }`, dass
eine CSS-Regel immer das gleichnamige SVG-Praesentationsattribut schlaegt. Die
Buchstabengruppen tragen ihre Position als `transform`-Attribut — eine
CSS-Animation auf derselben Gruppe haette alle zehn Buchstaben auf x = 0
uebereinandergelegt. Die Animation laeuft deshalb auf dem `path` in der Gruppe.
`Wordmark.test.tsx` haelt genau das fest: Attribut auf der Gruppe, kein
Inline-`transform`, genau ein `path` darin.

**Die Ruhelage jedes Hex steht als Variable am Element.** Die Welle hebt jedes
Hex kurz aus seiner Deckkraft und laesst es zurueckfallen. Damit sie weiss,
wohin zurueck, gibt `HexField.tsx` die aus dem Abstand gerechnete Ruhelage als
`--rest` mit; die Keyframes beginnen und enden dort. Ohne das fiele die Flaeche
nach der Welle auf null. Dieselbe Zahl steuert die Verzoegerung — deshalb
laeuft die Welle als Ring nach aussen und blinkt nicht als ganze Flaeche.

**Der Platz in der Reihe ist eine Zahl, keine Klasse.** `MenuScreen.tsx` gibt
jedem Eintrag `--i`, das CSS rechnet daraus die Verzoegerung. Vier Klassen fuer
vier Verzoegerungen waeren dieselbe Auskunft, nur haendisch gepflegt — und beim
fuenften Eintrag vergessen. „Weiterspielen" schiebt die drei Wege eine Stufe
weiter, damit nie zwei Eintraege gleichzeitig fallen; ein Test haelt beide
Faelle fest.

### Abweichungen vom Plan

Die Wortmarke hat eine Eigenschaft `animated`, die nur das Hauptmenue setzt.
Das ist Vorbau im Sinne von Regel 5, nicht im Sinne von „fuer spaeter": stuende
die Marke irgendwo sonst, duerfte sie dort nicht bei jedem Aufruf wieder
losfliegen. Die Voreinstellung ist deshalb „steht einfach da".

### Offene Punkte

- **Die Animation ist ungesehen.** Siehe Abnahme. Die Zahlen (240 ms Flug,
  8 ms Versatz je Buchstabe, 65 ms zwischen den Eintraegen) sind ein Entwurf
  und sollen nach dem ersten Ansehen angefasst werden, nicht verteidigt.
- **Der Startbildschirm traegt weiter den gesetzten Titel.** Er koennte die
  Wortmarke bekommen, aber kleiner und ohne Eingang. Bewusst nicht
  mitgemacht — das war nicht die Aufgabe, und ein zweiter Ort fuer dieselbe
  Marke will erst entschieden sein.
- **Der Schwanz des „Q" endet auf der Grundlinie**, statt darunter
  auszulaufen. Bei 744 Einheiten Wortbreite liest es sich als Q; wer die Marke
  einmal sehr gross setzt, sollte noch einmal hinsehen.

### Naechste Etappe

Unveraendert **Etappe 7: Auth** — Registrierung, Login, Gast-Account
beanspruchen.

## Die Choreografie zum ersten Mal gesehen ✅

Stand: 2026-08-11, Branch `etappe-4-online`, direkt nach `1fa1b55`. Der
Abschnitt davor endete mit „die Animation ist ungesehen" und der Bitte, die
Zahlen nach dem ersten Ansehen anzufassen statt zu verteidigen. Das ist jetzt
passiert — im Browser, mit gemessenen Werten. Zwei Dinge waren zu aendern, die
Zahlen selbst keins davon.

### Abnahme

| Pruefung                                      | Ergebnis                                               |
| --------------------------------------------- | ------------------------------------------------------ |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                  |
| `pnpm test`                                   | 726 Tests gruen (shared 492, server 74, client 160)    |
| `pnpm build`                                  | gruen, Client-Bundle 362 kB (109 kB gzip), CSS 22,7 kB |
| `pnpm format:check`                           | gruen                                                  |

**Diese Aenderung hat keinen Test.** Beides sind reine CSS-Aenderungen, und
jsdom loest keine Animationen auf — ein Test haette hier nur behauptet, dass
eine Klasse gesetzt ist. Belegt ist es stattdessen im Browser: die Werte unten
sind aus dem laufenden Client abgelesen (`getComputedStyle` auf der Spitze der
Welle, Echtzeitmessung fuer den Reduce-Fall), nicht nachgerechnet. Der
Reduce-Test hat seine Regeln aus dem geladenen Stylesheet gezogen statt sie
nachzubauen, damit er den Code prueft und nicht meine Vorstellung davon.

### Die beiden offenen Fragen von letztem Mal, beantwortet

**„Wirken 240 ms schnell genug?" — ja, und zwar weil die Kurve vorne liegt.**
`cubic-bezier(0.12, 0.72, 0.16, 1)` ist so stark vorne lastig, dass die Marke
nach etwa der Haelfte der Zeit praktisch angekommen ist; der Rest gehoert dem
Einrasten. Bei 45 ms steht sie noch links, geschert und in die Laenge gezogen,
bei 100 ms rauscht sie heran, bei 170 ms sitzt sie. Das liest sich als
Schnappen und nicht als Reinrutschen. Die Zahl bleibt.

**„Ist die Welle sichtbar oder nur messbar?" — sichtbar, und das war das
Problem.** Siehe unten.

### Getroffene Entscheidungen

**Der Hub der Welle ist ein Anteil der Ruhelage, kein fester Betrag.** Vorher
stand im Keyframe `calc(var(--rest) + 0.34)` — fuer jedes Hex derselbe Aufschlag.
Das klang richtig und war es nicht, weil die Ruhelage eben nicht ueberall
dieselbe ist: in der Mitte (0,40) ist der Aufschlag nicht ganz das Doppelte, am
Rand (0,06) fast das Siebenfache. Gemessen:

|       | Ruhelage | Spitze alt | Faktor alt | Spitze neu | Faktor neu |
| ----- | -------- | ---------- | ---------- | ---------- | ---------- |
| Mitte | 0,40     | 0,74       | 1,85x      | 0,74       | 1,85x      |
| Rand  | 0,06     | 0,40       | 6,67x      | 0,111      | 1,85x      |

Das Rand-Hex erreichte auf seiner Spitze genau die Helligkeit, die das Zentrum
in Ruhe hat. Die Welle wurde nach aussen also lauter statt leiser — ein
Aufprall, der beim Wandern kraeftiger wird, erzaehlt das Gegenteil eines
Aufpralls. Dazu kam, dass ihr lautester Moment (Rand-Spitze bei 666 ms) genau
dorthin fiel, wo die Menueeintraege landen (320 bis 750 ms): der Hintergrund
schrie im selben Augenblick, in dem die Bedienelemente ankamen, und das ist
Regel 4 auf den Kopf gestellt. Jetzt steht dort `calc(var(--rest) * 1.85)`, und
die Strichstaerke folgt derselben Logik (`calc(0.012 + var(--rest) * 0.045)`).
In der Mitte aendert sich damit nichts, am Rand zerfaellt die Welle so, wie sich
das Feld selbst nach aussen verliert.

**Das Heben rechnet das CSS aus `--rest`, es gibt keine zweite Variable.**
`HexField.tsx` musste dafuer nicht angefasst werden — die Ruhelage steht ohnehin
schon am Element, und der Hub ist eine Funktion davon. Eine eigene `--lift`
waere dieselbe Auskunft ein zweites Mal und beim naechsten Anfassen die
Gelegenheit, dass die beiden auseinanderlaufen.

**`prefers-reduced-motion` schaltete die Choreografie nicht ab — nur ihre
Geschwindigkeit.** Der Block in `index.css` setzte `animation-duration` und
`transition-duration` auf 0,01 ms, aber nicht die **Verzoegerung**. Mit
`backwards` heisst eine ueberlebende Verzoegerung: das Element haengt in seiner
Anfangsstellung fest, und die heisst bei einem Eingang „unsichtbar". Gemessen in
Echtzeit, bevor es behoben war:

```
t =   4 ms   0 von 3 Eintraegen sichtbar
t = 333 ms   1
t = 396 ms   2
t = 459 ms   3
```

Also eine knappe halbe Sekunde leere Flaeche und dann ein dreifaches
Aufploppen — keine Animation mehr, aber immer noch eine Choreografie, und
genau die war abbestellt worden. Der Block kuerzt jetzt auch
`animation-delay`, und zwar auf **-1 ms**: negativ, damit die Animation schon
vorbei ist, bevor das erste Bild gezeichnet wird. Null waere nur fast richtig,
das liesse den Anfangszustand noch ein Bild lang stehen. `!important` schlaegt
dabei auch das `style`-Attribut — noetig, weil die Verzoegerung der Hexe von
`HexField.tsx` genau dort landet. Nach der Aenderung stehen bei t = 0 alle drei
Eintraege und der Untertitel da.

**Die falsche Aussage ist korrigiert, nicht stillschweigend ersetzt.** In
`MenuScreen.tsx` stand, bei `prefers-reduced-motion` stehe die Flaeche „sofort
fertig da", und im Abschnitt davor in dieser Datei sinngemaess dasselbe. Das
war schlicht nicht wahr. Der Kommentar sagt jetzt, was stattdessen passierte
und warum die Schlussstellung allein nicht genuegt — eine Falle, die man
zweimal stellt, wenn man nur den Code repariert und die Begruendung stehen
laesst.

### Abweichungen vom Plan

Keine — es gab keinen Plan ausser „ansehen und die Zahlen anfassen". Angefasst
wurden am Ende nicht die Zahlen, sondern zwei Regeln dahinter; die Zeitwerte
haben sich im Ansehen bestaetigt.

### Offene Punkte

- **Nur in einem Browser und einem Fenster gesehen** (Chrome, breites Fenster).
  Das schmale Handy-Fenster aus Regel 7 ist fuer diesen Bildschirm noch
  ungeprueft.
- **Der echte Reduce-Modus ist nicht geschaltet worden.** Geprueft wurde mit
  den Regeln aus dem eigenen Stylesheet, angewandt ohne das Media-Query — das
  prueft die Deklarationen, nicht das Umschalten des Systems.
- Aus dem Abschnitt davor bleiben offen: **der Startbildschirm mit dem
  gesetzten Titel** und **der Schwanz des „Q"**. Beide unveraendert.

### Naechste Etappe

Unveraendert **Etappe 7: Auth** — Registrierung, Login, Gast-Account
beanspruchen.

---

## Etappe 7 — Auth: Registrierung, Login, Gast-Konto beanspruchen ✅

Stand: 2026-08-11, Branch `etappe-4-online`.

Aus einer Zeile in `users` (Gast, `is_guest = true`, kein Zugangsdaten) wird ein
richtiges Konto — genau das UPDATE, das Regel 7 seit Etappe 4 verspricht. Neun
Aufgaben: Migrationsgeruest, `sessions`-Tabelle und Users-Umbau, Passwoerter mit
`scrypt`, das Protokoll der vier Auth-Nachrichten, die Accounts-Ablaeufe und
ihre Handler, die Identitaet im Client, die Konto-Ecke, der Dialog, und
schliesslich das Verdrahten hier.

### Abnahme

| Pruefung                                      | Ergebnis                                                      |
| --------------------------------------------- | ------------------------------------------------------------- |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                         |
| `pnpm test`                                   | 785 Tests gruen (shared 499, server 108, client 178)          |
| `pnpm build`                                  | gruen, Client-Bundle 366,55 kB (109,90 kB gzip), CSS 23,89 kB |
| `pnpm format:check`                           | gruen                                                         |

**Nicht in dieser Tabelle: der Durchlauf im Browser.** Siehe „Offene Punkte"
unten — er steht zum Zeitpunkt dieses Commits noch aus.

### Getroffene Entscheidungen

**Das urspruenglich geplante Migrations-SQL haette Daten vernichtet, und zwar
still.** Der erste Entwurf legte `sessions` an, bevor `users` umgebaut war;
beim anschliessenden `DROP TABLE users` haette `ON DELETE CASCADE` die gerade
erst geretteten Sitzungsgeheimnisse sofort wieder geloescht — dieselbe
Transaktion, die sie retten sollte, haette sie am Ende wieder mitgenommen.
Dazu kamen drei weitere Grenzen, alle gegen SQLite 3.53.4 nachgemessen statt
vermutet: `ALTER TABLE ... DROP COLUMN` lehnt eine `UNIQUE`-Spalte ab
(„cannot drop UNIQUE column"), `PRAGMA foreign_keys` laesst sich mitten in
einer Transaktion nicht umschalten (SQLite ignoriert es kommentarlos), und
`ALTER TABLE ... RENAME TO` haelt eine aufgeschobene Fremdschluesselpruefung
nicht bei — `COMMIT` meldet trotz korrektem Endzustand einen Verstoss. Gebaut
wurde stattdessen: `PRAGMA defer_foreign_keys = ON` (die Pruefung wandert ans
Transaktionsende), eine Zwischentabelle `users_staging` fuer das, was aus der
alten Zeile ueberlebt, `users` unter demselben Namen neu angelegt statt per
`RENAME TO` dorthin gelangt, und `sessions` **erst danach** befuellt — genau
in dieser Reihenfolge, damit `DROP TABLE users` nichts mehr trifft, was schon
in Sicherheit ist. Alle vier Punkte stehen jetzt auch als Kommentar in
`stepSessionsAndAccounts` (`apps/server/src/db/database.ts`), damit die
Reihenfolge nicht wie Zufall aussieht.

**`createGuest` und `createAccountWithSession` sind transaktional**, weil
beide in zwei Tabellen schreiben (`users` und `sessions`). Ohne Transaktion
bliebe bei einem Abbruch zwischen beiden Schreibvorgaengen ein Nutzer ohne
Sitzung zurueck — beim Gast dauerhaft unerreichbar, weil ihm ohne Sitzung kein
Geheimnis mehr zugeordnet werden kann.

**Beim Identitaetswechsel wird die alte Senke aus dem `SinkHub` entfernt.**
Meldet sich eine Verbindung um (Login, Logout), bekommt sie eine neue
Identitaet — ohne das Entfernen empfienge sie aber weiter Broadcasts der
verlassenen Identitaet. Das ist ein Informationsleck ueber eine
Identitaetsgrenze hinweg (Regel 4) und zugleich ein wachsendes Speicherleck,
weil die alte Senke nie wieder abgeraeumt wuerde.

**Bei unbekanntem Login wird trotzdem gegen einen Hash geprueft** —
`DUMMY_HASH` in `accounts.ts`. Ohne ihn antwortet der Server bei einem
unbekannten Login sofort und bei einem falschen Passwort erst nach der
`scrypt`-Berechnung; die Antwortzeit verriete dann genau das, was die
gemeinsame Fehlermeldung „Benutzername oder Passwort stimmt nicht" bewusst
verschweigt.

**Der Kontodialog-Zustand lebt in `Online()` (`App.tsx`), nicht in
`MenuScreen` oder `StartScreen`.** Beide Bildschirme tragen dieselbe
Konto-Ecke und sollen denselben Dialog oeffnen — ein `useState` an einer
Stelle statt derselben Logik zweimal in zwei Bildschirmen.

**Eine Absage des Servers haelt den Dialog offen.** `register` und `login`
werfen bei Ablehnung (Login vergeben, falsches Passwort, offene Gast-Partien
ohne Bestaetigung); der Fangblock in `submitAccount` traegt die Meldung in
`accountProblem`, ruft aber `setAccount(null)` nicht auf. Ohne diese
Unterscheidung waere die Meldung verschwunden, bevor sie jemand liest — der
Dialog schliesst nur bei Erfolg.

**Die Warnung im Dialog zaehlt aus derselben Quelle wie „Weiterspielen
(n)".** `online.myRooms.length` speist beides. Der Server rechnet die Zahl
nicht selbst aus (er bekommt bei `auth.login` keine eigene Anfrage danach),
und der Dialog wiederholt die Rechnung nicht — er bekommt sie als
`openGuestGames` gereicht.

**Der Platz der Konto-Ecke in der Eingangs-Choreografie ist eine Rechnung,
keine feste Zahl.** `MenuScreen` gibt ihr `order={resumeShown ? 4 : 3}` —
einen Schritt hinter dem hoechsten `--i` der drei Wege (2, oder 3 mit
„Weiterspielen" davor). Eine feste `4` waere bei einem vierten Menueeintrag
still falsch geworden; so faellt die Ecke immer zuletzt ein, unabhaengig
davon, wie viele Eintraege vor ihr liegen. `StartScreen` bekommt dieselbe
Komponente ohne `order` — dieser Bildschirm hatte nie eine Eingangs-Choreografie
und soll auch keine bekommen.

### Abweichungen vom Plan

Keine am fertigen Verhalten — die Migrations-Abweichung oben war eine
Korrektur **waehrend** der Umsetzung (Aufgabe 2), kein nachtraeglicher Bruch
mit einem bereits abgenommenen Plan: der urspruengliche Entwurf ist nie
gelaufen.

### Offene Punkte

- **Kein Passwort-vergessen.** Es gibt keinen Mailversand — die freiwillige
  E-Mail-Adresse liegt dafuer bereit, tut aber nichts (siehe unten).
- **Kein Rate-Limit auf `auth.login`.** Solange der Server nicht oeffentlich
  erreichbar ist, ist das risikolos; noetig, sobald das der Fall ist
  (Etappe 9).
- **Sitzungen laufen nie ab.** `sessions` kennt kein Ablaufdatum und keine
  Bereinigung.
- **Keine Kontoloeschung.**
- **Die freiwillige E-Mail tut heute nichts** — kein Versand, keine
  Bestaetigung. Bewusst so entschieden, und im Dialog auch so beschriftet
  („Tut heute noch nichts"); sie liegt fuer eine spaetere
  Passwort-Wiederherstellung bereit.
- **Der Durchlauf im Browser steht zum Zeitpunkt dieses Commits noch aus.**
  Gast-Partie anlegen und dann Konto anlegen (die Partie muss unter
  „Weiterspielen" stehen bleiben), Abmelden und wieder Anmelden (die Partie
  ist wieder da), zwei Fenster mit demselben Konto (beide bleiben
  angemeldet), das schmale Fenster (die Ecke beruehrt die Wortmarke nicht),
  und ein Neuladen mit Blick auf die Choreografie (faellt die Ecke zuletzt?)
  — das alles ist bislang nur gegen Komponententests belegt, nicht gesehen.
  Wird nachgetragen.
- **Eine Sicherungskopie der echten `data/`-Datenbank vor dem ersten
  Migrationslauf** (`VACUUM INTO` auf eine Kopie, bevor `stepSessionsAndAccounts`
  gegen den echten Bestand laeuft) wurde vorgeschlagen, aber nicht eingebaut.
  Die Migration ist gegen Testdaten durchgespielt und nachgewiesenermassen
  sicher (siehe „Getroffene Entscheidungen" oben), aber „nachgewiesenermassen
  sicher am Testdatensatz" ist nicht dasselbe wie „eine Sicherung existiert,
  falls doch". Die Entscheidung, ob das noetig ist, liegt beim Nutzer.

### Naechste Etappe

**Etappe 8 — Handel zwischen Spielern.** Entwicklungskarten sind bereits aus
Etappe 8 vorgezogen (siehe weiter oben in dieser Datei); was bleibt, ist der
Tausch zwischen zwei Spielern selbst.

## Etappe 8 — Handel zwischen Spielern ✅

Stand: 2026-08-12, Branch `etappe-4-online`, aufsetzend auf `903b327`.

Entwicklungskarten waren schon vorgezogen (siehe weiter oben); was fehlte, war
der Tausch ueber den Tisch. Fuenfzehn Aufgaben: die Phase und ihre Datentypen,
die fuenf Zuege der Verhandlung, die Frist als Infrastruktur, Verbindungsverlust
und Rueckkehr, Aktionsliste und Sicht, der Wecker im Server, zwei Dialoge im
Client und die lokale Uhr.

Entwurf und Plan liegen in
`docs/superpowers/specs/2026-08-12-etappe-8-handel-design.md` und
`docs/superpowers/plans/2026-08-12-etappe-8-handel.md`.

### Abnahme

| Pruefung                                      | Ergebnis                                                      |
| --------------------------------------------- | ------------------------------------------------------------- |
| `pnpm typecheck` (`tsc -b`, alle drei Pakete) | gruen                                                         |
| `pnpm test`                                   | 886 Tests gruen (shared 568, server 121, client 197)          |
| `pnpm build`                                  | gruen, Client-Bundle 380,33 kB (113,25 kB gzip), CSS 24,94 kB |
| `pnpm format:check`                           | gruen                                                         |

Zum Vergleich der Stand aus Etappe 7: 785 Tests, Bundle 366,55 kB. Der Handel
kostet also 101 Tests und 13,8 kB.

**Nicht in dieser Tabelle: der Durchlauf im Browser.** Siehe „Offene Punkte" —
er steht zum Zeitpunkt dieses Commits noch aus.

### Am laufenden Server durchgespielt (nachgetragen 2026-08-12)

Der Browser blieb aus (die Chrome-Erweiterung war nicht verbunden), aber der
**laufende Server** wurde ueber drei echte WebSocket-Verbindungen durchgefahren
— kein Mock, kein Testdouble, derselbe Prozess, den `pnpm dev` startet.
Bestaetigt hat das genau die Punkte, die kein Komponententest erreicht:

- Der Server **stempelt `at`**: mitgeschickt wurde `at: 0`, die Frist stand
  danach 60 s in der Zukunft. Ohne den Stempel laege sie im Jahr 1970.
- Ein offenes Angebot **blockiert den Zug** — `endTurn` kam zurueck mit
  „endTurn passt nicht in die Phase tradePending".
- Der Mitspieler bekommt genau zwei `respondTrade` in seiner Aktionsliste.
- Ein **Gegenangebot verlaengert die Frist**: gemessene 1209 ms nach 1200 ms
  Wartezeit, gerechnet auf der Serveruhr.
- **Verbindungsabbruch** traegt die automatische Ablehnung ein, der
  **Reconnect** mit demselben Geheimnis nimmt sie wieder heraus — und der
  Zurueckgekehrte hat „Annehmen" wieder in seiner Liste.
- Der **Zuschlag** bewegt je eine Karte in jede Richtung; der Verlauf lautete
  „Ben ist nicht mehr da … | Ben ist zurueck … | Ben nimmt das Angebot an |
  Anna tauscht mit Ben".
- Der **Wecker** hat nach 60 s von selbst zugeschlagen: „Die Zeit fuer Annas
  Angebot ist abgelaufen".
- **Neustart mit abgelaufener Frist**: Angebot angelegt, Server beendet, Frist
  im Aus verstreichen lassen, Server wieder gestartet — der Raum kam aus der
  Datenbank zurueck und stand sofort wieder in `main`. Der erste Weckerlauf war
  faellig, genau wie oben behauptet.

Gelaufen ist das gegen eine eigene Datenbankdatei; die echte `data/` wurde
nicht angefasst. Was damit **weiterhin ungeprueft** ist, ist ausschliesslich
das Aussehen: Reiter, Antwortliste, Countdown, schmales Fenster.

### Getroffene Entscheidungen

**Das Angebot ist eine Phase, kein Feld daneben.** Ein offenes Angebot
blockiert Bauen, Bankhandel, Kartenkauf und Zugende. Stuende es als Feld neben
`phase: 'main'`, waere diese Sperre eine zweite Regel neben `PHASE_ACTIONS` —
zwei Wahrheiten ueber denselben Sachverhalt. Als Knoten im Automaten aus
`phase.ts` ist es dieselbe Regel wie jede andere Phasensperre. `actorFor` gibt
fuer `tradePending` `null` zurueck, genau wie fuer `discardPending`: es handeln
mehrere, und wer genau was darf, prueft `playerTrade.ts`.

**Das Angebot lebt im `GameState`, nicht im Raum.** Der Gegenentwurf waere, das
Verhandeln im Server zu halten und nur den fertigen Tausch als Aktion zu
fuehren. Er scheitert dreifach: lokal gibt es keinen Raum (also keinen Handel),
ein Serverneustart verloere jedes offene Angebot, und der Server muesste die
Angebotsregeln ein zweites Mal auslegen. Der Beleg steht als Test in
`game.integration.test.ts`: `replay` aus Startzustand und Aktionsfolge ergibt
ein offenes Angebot **samt Frist** wieder.

**Zeit kommt als Daten herein, nie aus einer Uhr im Reducer.** Regel 2 verbietet
`Date.now()` in der Logik. Gebaut wurde deshalb: `expiresAt` im Zustand,
gespeist aus einem `at` an der Aktion; `deadlineOf(state)` als einzige Stelle,
an der jemand nachsieht, ob eine Uhr laeuft; und `timeout` als gewoehnliche
Aktion, die nur gilt, wenn die Frist wirklich um ist. Ein zweites Zeitlimit
(Abwurffrist, Zugzeit) braucht ein Feld in seiner Phase und einen Zweig in
`deadlineOf` — sonst nichts.

**Der Zeitstempel kommt vom Server, immer.** `stampAction` ueberschreibt `at`,
bevor `reduce` laeuft **und bevor der Zug ins Log geht**. Beides ist noetig:
ohne das erste koennte sich ein Client eine Frist von zehn Minuten stempeln,
ohne das zweite ergaebe `replay` nach einem Neustart eine andere Frist als die,
die wirklich galt.

**Drei Aktionen kommen nur vom Server.** `timeout` ist niemandes Absicht;
`dropFromTrade` und `rejoinTrade` sprechen **ueber** einen anderen Spieler. Sie
kaemen durch `applyAction` gar nicht durch, weil der prueft, dass Absender und
`player`-Feld dieselbe Person sind — deshalb ein zweiter Eingang
`applySystemAction` ohne diese Pruefung, und im ACT-Handler eine Abweisung fuer
den Fall, dass ein Client es trotzdem versucht.

**Ein Angebot verfaellt nur an lauter Neins von Hand.** Ist auch nur eine
Ablehnung automatisch entstanden (Verbindungsverlust), bleibt es bis zur Frist
offen. Ohne diese Unterscheidung toetete ein Abbruch von zwei Sekunden genau
das Angebot, das gerade wiederkommen sollte. `TradeResponse` traegt dafuer ein
`automatic`-Feld, und `rejoinTrade` nimmt ausschliesslich solche Ablehnungen
zurueck — Gesprochenes bleibt stehen.

**`tradeOfferMs` bekommt eine Vorgabe, und das ist keine Bequemlichkeit.** Seit
Etappe 6 liegt das RuleSet jeder laufenden Partie als JSON in der Datenbank. Ein
Pflichtfeld ohne `.default` liesse `GameStateSchema.safeParse` an jedem
gespeicherten Spielstand scheitern, und jede laufende Partie waere beim
naechsten Serverstart weg. Dieselbe Falle, vor der die Datei bei `dice` und
`robberRoll` schon warnt.

**Gegenangebote sammeln sich, sie ersetzen nicht.** Ein Gegenangebot ist die
Antwort dieses Spielers; das Original bleibt stehen, und der Anbieter waehlt am
Ende zwischen Zusagen und Gegenangeboten. Der Gegenentwurf (Rollentausch) liesse
die uebrigen Spieler aus der Runde fallen und koennte beliebig hin- und
hergehen. `acceptTrade` traegt deshalb **keine Mengen**: bei einer Zusage gelten
die des Angebots, bei einem Gegenangebot dessen eigene — beides steht im
Zustand, und ein Client, der die Mengen mitschickte, koennte sie erfinden.

**Beim Gegenangebot wird nicht geprueft, ob der Anbieter zahlen koennte.** Eine
Ablehnung aus diesem Grund verriete dem Konternden etwas ueber eine verdeckte
Hand. Geprueft wird es beim Zuschlag, wo ohnehin beide Seiten geprueft werden.
Aus demselben Grund entscheidet die Zusagen-Pruefung nur ueber die **eigene**
Aktionsliste: wer nicht zahlen kann, sieht einen gesperrten Knopf, der Tisch
sieht eine gewoehnliche Ablehnung.

**`GameEvent` traegt jetzt ein `sentAt`.** Fristen stehen als Serverzeit im
Zustand. Ohne einen Bezugspunkt zeigte eine um zwei Minuten falsch gehende
Rechneruhr eine Frist, die laengst abgelaufen ist — oder eine, die nie endet.
Der Client rechnet je Stand seinen Versatz neu; gestempelt wird einmal je
Broadcast und nicht je Empfaenger, damit alle denselben Bezugspunkt bekommen.

**Die lokale Partie bekommt denselben Wecker.** `useHotseatGame` stempelt seine
Aktionen selbst und wirft `timeout` ein, wenn die Frist um ist. Die Alternative
waere gewesen, den Countdown lokal auszublenden — dann haette die lokale Partie
eine Frist im Zustand, die niemand vollstreckt, und der Dialog zeigte eine Uhr,
die nichts bedeutet.

**Eine Komponente fuer beide Mengenwahlen.** `TradeAmounts` traegt das Angebot
im Handelsfenster und das Gegenangebot im Angebotsdialog. Zweimal dasselbe
Formular waere zweimal dieselbe Sperre gewesen — und beim naechsten Mal nur an
einer Stelle gepflegt.

### Abweichungen vom Plan

Keine am Verhalten. Drei Kleinigkeiten an den Tests, alle waehrend der
Umsetzung aufgefallen: `replay` gibt ein `ReduceResult` zurueck und keinen
`GameState` (die Planvorlage hatte das falsch); `log.test.ts` benennt seine
Testsitze `p1`/`p2` statt „Spieler 1"; und das Repo hat kein `jest-dom`, also
`toHaveProperty('disabled', true)` statt `toBeDisabled()`. In allen drei Faellen
war die Erwartung falsch, nicht der Code.

### Im Browser gesehen (nachgetragen 2026-08-12)

Drei Tabs, drei Urspruenge (`localhost:5173` fuer den Vite-Client,
`127.0.0.1:8080` und `localhost:8080` fuer den vom Server ausgelieferten Build)
— verschiedene Origins heisst getrennter `localStorage` und damit drei echte
Identitaeten in einem Browser.

Gesehen und bestaetigt:

- Die **zwei Reiter** „Bank | Spieler" im Handelsfenster, der Spieler-Reiter mit
  Mengenspalten, Obergrenze aus der eigenen Hand („von 1") und gesperrtem Knopf,
  solange eine Seite leer ist.
- Das **Angebot beim Mitspieler**: „Anna bietet an / 1 Lehm fuer 1 Holz" samt
  Countdown („Noch 54 Sekunden").
- **Annehmen gesperrt mit ehrlicher Begruendung** („Dir fehlt, was dafuer
  verlangt wird.") bei dem, der nicht zahlen kann — waehrend der Tisch nur eine
  gewoehnliche Ablehnung sieht. Regel 4, sichtbar.
- **Ablehnen** und die Verlaufssaetze („Gast lehnt das Angebot ab").
- **Fristablauf im Browser**, dreimal: „Die Zeit fuer Annas Angebot ist
  abgelaufen", eingeworfen vom Wecker des Servers.
- Ein Angebot, auf das **niemand antworten konnte, weil zwei Tabs weg waren**,
  blieb bis zur Frist stehen statt sofort zu sterben — und die Statusecke sagte
  dazu „Gast und Gast sind gerade getrennt."

### Zwei Fehler, die erst der Browser gezeigt hat

**Der Handelsknopf hing allein an den Bankgeschaeften** — `disabled={targets.trades.length === 0}`
in `ActionPanel.tsx`. Wer weniger als vier gleiche Karten hielt, also fast jeder,
der handeln moechte, kam gar nicht erst an den neuen Reiter. Das war ein Fehler
**dieser Etappe**: die Dialogtests pruefen den Dialog, nicht den Weg dorthin.
Behoben, indem `canOfferTrade` durch `GameView` bis in den Knopf durchgereicht
wird; zwei Tests halten beide Richtungen fest (Commit `99c7aea`).

**`createRoom` und `joinRoom` haben sich ohne Geheimnis neu angemeldet**
(`useOnlineGame.ts`). Der Server legt dann einen neuen Gast an und schaltet die
Sitzung auf ihn um: der Raum gehoerte jemandem, dessen Geheimnis niemand
behalten hat. Sichtbar dreifach — der Gastgeber bekam seinen eigenen
„Partie starten"-Knopf nicht, sein Sitz stand als „verbunden" statt „du" da, und
nach einem Neuladen fand `room.mine` fuer das gespeicherte Geheimnis nichts
mehr. Der Fehler stammt aus **Etappe 5** (`git log -L` zeigt auf `73cae49`),
nicht aus dieser Etappe, blockierte aber den Durchlauf vollstaendig. Behoben und
mit drei Tests festgehalten (Commit `aa87a8e`).

## Etappe 8 — Browser-Nachtrag (2026-08-12, `etappe-4-online`)

Der Rest des Browser-Durchlaufs, den die Uebergabe
`docs/superpowers/plans/2026-08-12-etappe-8-browser-nachtrag.md` beschrieben
hat. Sie ist damit erledigt und geloescht.

**Abnahme** — gemessen nach den beiden Korrekturen weiter unten:

| Schritt             | Ergebnis                                                    |
| ------------------- | ----------------------------------------------------------- |
| `pnpm typecheck`    | sauber                                                      |
| `pnpm test`         | **894** gruen (shared 568, server 121, client 205; +3 neue) |
| `pnpm build`        | `index.js` 380,59 kB, gzip 113,33 kB; CSS 24,94 kB          |
| `pnpm format:check` | sauber                                                      |

**Warum es diesmal klappte: die Frist wurde vorher hochgesetzt.** Beim ersten
Anlauf lief dreimal die 60-Sekunden-Frist ab, bevor jemand antworten konnte.
Statt schnell zu sein, stand `tradeOfferMs` fuer den Durchlauf auf einer Stunde
und wurde vor dem Commit zurueckgedreht — `git diff` auf `ruleset.ts` ist leer.
Der Countdown zeigte dabei „Noch 3599 Sekunden", was nebenbei belegt, dass er
den Wert aus dem RuleSet liest und nicht aus einer eigenen Zahl.

### Die zwei fehlenden Bilder — gesehen

Der Aufbau war der aus der Uebergabe: drei Tabs, drei Urspruenge, drei echte
Identitaeten. Anna stand vom ersten Bild an als „du" am Tisch, und das
Handelsfenster oeffnete, obwohl sie keine vier gleichen Karten fuer ein
Bankgeschaeft hielt — `aa87a8e` und `99c7aea` tragen also auch im Browser.

Gelegt wurde **1 Korn fuer 1 Lehm**, und zwar mit Absicht so: Lehm hielten
beide Mitspieler, damit „Annehmen" bei keinem zu Recht gesperrt war und die
Antwortliste **beide** Antwortarten nebeneinander zeigen konnte.

- **Die Antwortliste des Anbieters** mit `⇄ Gast bietet 1 Holz fuer 1 Korn` und
  `✓ Gast nimmt an`, jede Zeile mit eigenem Knopf „Mit … tauschen".
- **Das Gegenangebot-Formular** im Angebotsdialog: Angebotskopf, Countdown, der
  Satz „Dein Gegenangebot ersetzt deine Antwort — und gibt allen neue
  Bedenkzeit", darunter dieselbe Mengenwahl wie im Handelsfenster.
- **Der Zuschlag auf das Gegenangebot.** Bewusst dieses statt der Zusage
  gewaehlt: Annas Hand ging von `L1 H0 W0 K2 E0` auf `L1 H1 W0 K1 E0`, also
  1 Korn gegen 1 Holz — die Mengen des _Gegenangebots_, nicht die des Originals
  (das lautete 1 Korn fuer 1 **Lehm**). Damit ist im Betrieb belegt, was der
  Entwurf behauptet: `acceptTrade` traegt keine Mengen, sie kommen aus dem
  Zustand. Der nicht gewaehlte Mitspieler behielt seine Karten unveraendert.

### Das schmale Fenster — gemessen statt fotografiert

**Ein Bild davon gibt es nicht.** Das Chrome-Fenster liess sich in dieser
Umgebung nicht unter 1920 px bringen; die Fernsteuerung meldete Erfolg und
bewirkte nichts, ein Popup mit fester Breite fing der Blocker ab.

Entscheidbar war die Frage trotzdem, denn **auf den Angebotsdialog wirkt keine
einzige Media Query** — die beiden im Projekt (`index.css:530` bei `26rem`,
`index.css:802` bei `62rem`) gelten der Konto-Ecke und dem Startbildschirm. Das
Verhalten des Dialogs haengt allein an Containerbreiten (`.modal__box`
`min-width: min(22rem, 100%)`, `.trade` `auto-fit/minmax(15rem, 1fr)`, `.cards`
`flex-wrap`). Bei auf 360-px-Geometrie gezwungenem Container:

- Dialogbreite 328 px, **kein Ueberlauf** an irgendeinem Element
- `.trade` klappt auf **eine** Spalte, „Du gibst" ueber „Du moechtest"
- die fuenf Rohstoffkacheln brechen auf **zwei** Zeilen um
- die Antwortzeile wird zweizeilig (33 → 57 px), ihr Knopf bleibt innerhalb

Was das **nicht** deckt, sind die beiden echten Viewport-Breakpoints. Sie
bleiben ungesehen und stehen unten als offener Punkt.

### Zwei Fehler, die erst der zweite Durchlauf gezeigt hat

**Ein angefangenes Gegenangebot ueberlebte das Ende seiner Runde.** Beim
zweiten Angebot stand im Formular eines Mitspielers noch „1 Holz" — aus einer
Hand, die inzwischen keins mehr hielt —, und „Gegenangebot abschicken" war
offen. Der Grund: `TradeOfferDialog` gibt bei fremder Phase `null` **zurueck**,
wird dabei aber nicht ausgehaengt, also ueberleben `countering`, `counterGive`
und `counterWant`. Die Obergrenze („von 0") wurde nachgefuehrt, die _gewaehlte_
Menge nicht neu geklemmt. Der Server hat abgewiesen, es ist also kein
Datenschaden — aber der Client bot eine Handlung an, die es nicht gibt, und das
ist genau das, was die Hausregel „der Client kennt keine Regel" verhindern
soll. Behoben, indem der Dialog die drei Werte zuruecksetzt, sobald sich das
Angebot aendert, auf das sie antworten. Fehler **dieser Etappe**; zwei Tests
halten beide Wege fest (neues Angebot, und Runde dazwischen vorbei).

**Die Abweisung erschien als roher Protokollcode.** Auf dem Bildschirm stand
`REJECTED: Angeboten werden kann nur, was auf der Hand liegt`. Quelle war
`net/transport.ts`, wo `ServerError` seine Meldung als `` `${code}: ${detail}` ``
zusammensetzte; die Oberflaeche zeigt sie unveraendert. Dabei schreibt der
Server seine Ablehnungstexte ausdruecklich fuer den Spieler (`router.ts`, der
`RejectedError`-Zweig) — der Client machte sie mit dem Praefix kaputt.
`ServerError.message` ist jetzt der Text des Servers; der Code bleibt als Feld
`protocolCode` fuer Diagnose und Fallunterscheidung. Fehler aus **Etappe 5**,
trifft aber jede Abweisung im ganzen Spiel, deshalb hier miterledigt. Ein
bestehender Test hielt das alte Format fest (`toThrow(/INVALID_PAYLOAD/)`) und
wurde mit umgeschrieben — er beschrieb den Fehler, nicht die Absicht.

**Nachgetragen zur Ehrlichkeit:** Die erste Korrektur ist im Browser gefunden,
aber nur im Test wieder geprueft worden; die zweite ebenso. Nach den Aenderungen
lief kein dritter Durchlauf mehr.

### Offene Punkte

- **Die zwei Viewport-Breakpoints sind weiterhin ungesehen** (`26rem`
  Konto-Ecke, `62rem` Startbildschirm). Der Angebotsdialog ist bei 360 px
  vermessen und in Ordnung, aber gemessen ist nicht angeschaut.
- **Die Schrittknoepfe der Mengenwahl messen 22 × 22 px** (`.cards__stepper
button`, `1.4rem`). Das ist bei jeder Fensterbreite so und liegt unter dem,
  was ein Finger auf einem Handy sicher trifft. Aufgefallen beim Vermessen der
  schmalen Ansicht; nicht geaendert, weil es eine Entwurfsentscheidung ist und
  keine Korrektur.
- **Verliert der Anbieter die Verbindung, steht die Partie**, bis er
  wiederkommt. Die Frist raeumt zwar das Angebot ab, aber der Zug bleibt bei
  ihm. Das ist heute schon so, wenn jemand mitten in `main` verschwindet.
- **Kein Gegenangebot auf ein Gegenangebot.** Der Anbieter entscheidet, oder es
  verfaellt.
- **Kein Handel ausserhalb des eigenen Zugs.** Wer nicht am Zug ist, kann nur
  antworten.
- **Die Frist gilt dem Angebot, nicht dem Zug.** Wer gar nichts tut, blockiert
  die Partie weiterhin unbegrenzt — das braeuchte eine Zugzeit, und die
  Infrastruktur dafuer steht mit dieser Etappe bereit.
- **`tradeOfferMs` ist je RuleSet fest**, nicht je Raum einstellbar.

### Naechste Etappe

**Etappe 9 — Docker und Coolify.** Damit wird der Server oeffentlich
erreichbar; die beiden Punkte, die Etappe 7 dafuer vorgemerkt hat (Rate-Limit
auf `auth.login`, Sitzungsablauf), gehoeren dann dazu.

## Etappe 9 — Docker und Coolify ✅

Stand: 2026-08-13, Branch `etappe-9-deployment`, danach nach `main` gemergt
(`7738246` Entwurf, `a29da6d` Plan, `59f3956` Sitzungsfrist, `7281ee3` Drossel,
`fb6e7d0` Verdrahtung, `3fa8b74` Dockerfile, `7872f27` Merge der Etappen 4–9
nach `main`, `46c9d23`/`c59f46d`/`ab31362` die drei Korrekturen aus den
Deployment-Versuchen, `646babe` der Port).

**Abnahme** — gemessen auf dem Stand von `646babe`:

| Schritt             | Ergebnis                                                    |
| ------------------- | ----------------------------------------------------------- |
| `pnpm typecheck`    | sauber                                                      |
| `pnpm test`         | **915** gruen (shared 568, server **142**, client 205; +21) |
| `pnpm build`        | `index.js` 380,59 kB, gzip 113,33 kB; CSS 24,94 kB          |
| `pnpm format:check` | sauber                                                      |
| Deployment          | Coolify v4.1.2, Container `Running (healthy)`               |

Die 21 neuen Tests: 7 zur Sitzungsfrist (davon 2 zum Migrationsschritt), 6 zur
Drossel, 4 zu ihrer Verdrahtung in `Accounts.login`, 4 zu `loadConfig`.

### Getroffene Entscheidungen

**Ein Container, nicht zwei.** Der Server liefert den gebauten Client mit aus,
wie es `static.ts` seit Etappe 4 vorsieht. Die verbreitete Aufteilung (nginx
fuer die Dateien, Node fuer die API) haette genau das zerlegt, was die
Origin-Regel zusammenhaelt: `isAllowedOrigin` erlaubt den Upgrade, wenn Seite
und Server denselben Ursprung haben. Zwei Container heissen zwei Urspruenge und
damit wieder eine gepflegte `CLIENT_ORIGIN`-Liste.

**In Produktion ist `CLIENT_ORIGIN` leer, und die Domain steht nirgends im
Code.** `isAllowedOrigin` vergleicht `new URL(origin).host === host`
(`ws/origin.ts:26`), also Host und Port — **nicht das Schema**. Hinter einer
TLS-Terminierung sendet der Browser `https://`, der Server sieht intern `http`,
und der Vergleich stimmt trotzdem. Dasselbe traegt im Heimnetz ueber
`http://<ip>:8477`. Nachgeprueft vor dem Bauen, nicht gehofft.

**Die Sitzungsfrist ist gleitend, weil `sessions` auch Gaeste traegt.**
`users.hello(secret)` schlaegt das Geheimnis in derselben Tabelle nach. Eine
absolute Frist haette einem Gast mitten im Betrieb seine Identitaet und damit
seine Partien genommen; gleitend trifft sie nur den, der 60 Tage nicht da war.
Verlaengert wird gedrosselt — hoechstens einmal am Tag je Sitzung, denn wie
lange die letzte Verwendung her ist, steht bereits in `expires_at`. Ein
`last_used_at` daneben waere ein zweites Feld fuer dieselbe Auskunft.

**Der Client musste dafuer nicht angefasst werden.** Ein abgelaufenes
Geheimnis laesst `hello` werfen, und genau diesen Fall raeumt
`useOnlineGame.ts:212-219` seit Etappe 5 ab: Geheimnis vergessen, ohne
Geheimnis neu gruessen. Ein abgelaufener Gast wird also wieder ein Gast.

**Der Migrationsschritt kennt keine Uhr.** `stepSessionExpiry` fuellt
`expires_at` aus `created_at` und traegt die 60 Tage als Zahl, nicht als Import
von `SESSION_TTL_MS`. Ein Schritt, der eine Konstante liest, aendert sein
Ergebnis, sobald jemand die Konstante aendert — und waere dann nicht mehr der
Schritt, der einmal veroeffentlicht wurde. Am echten lokalen Bestand
durchgelaufen: `user_version: 3`, 25 Sitzungen mit Frist, die frueheste faellig
am 1. Oktober 2026 (60 Tage nach dem 2. August, an dem die ersten Gaeste
entstanden).

**Das Rate-Limit zaehlt je Login-Name, nicht je Absender.** Hinter Coolifys
Proxy haben alle Spieler dieselbe IP; ein Zaehler darauf traefe entweder alle
oder niemanden. Gezaehlt wird auch ein Name, den es gar nicht gibt — sonst
verriete die Drossel, welche Konten existieren, und machte den `DUMMY_HASH` in
`accounts.ts` zunichte, der genau dafuer dasteht. Weil damit der Angreifer die
Schluessel waehlt, hat die Tabelle eine Obergrenze. Am laufenden Server
durchgespielt: Versuche 1 bis 10 „Benutzername oder Passwort stimmt nicht.",
der elfte „Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." — der
Protokollcode steht daneben, nicht davor (die Lehre aus dem Etappe-8-Nachtrag).

**Die Drossel sitzt vor der KDF.** Eine gesperrte Anmeldung soll nicht auch
noch `scrypt` bezahlen. `recordSuccess` steht direkt nach dem Passwortvergleich
und nicht nach der Gast-Warnung: dass jemand die Bestaetigung fuer seine
offenen Gastpartien noch nicht gegeben hat, ist kein Fehlversuch.

**Der Port ist ueberall dieselbe Zahl.** Im Container koennte nichts
kollidieren — er hat seinen eigenen Netzwerk-Namensraum —, aber Host-Port,
Container-Port und das Port-Feld in Coolify sind drei Stellen, und zwei
verschiedene Zahlen darin sind eine Verwechslung, die irgendwann passiert. Auf
dem Zielhost war 8080 als totes Traefik-Mapping vergeben, 8090 gehoert
`linkedin-dash-web`, 8000 dem Coolify-Dashboard; es wurde 8477. **In der
Entwicklung bleibt es bei 8080**, dort haengen `config.ts` und der Vite-Proxy
daran, und die Zahl ist frei.

### Vier Anlaeufe, drei Fehler — und was sie gelehrt haben

Auf dem Entwicklungsrechner ist kein Docker installiert. Das Dockerfile wurde
also geschrieben, ohne es bauen zu koennen; der erste Build war der auf
Coolify. Das war eine bewusste Entscheidung (der Plan sagt es vorher), und sie
hat drei Runden gekostet:

**1. `gyp ERR! find Python`.** Der Entwurf behauptete, `better-sqlite3` werde
„gegen glibc vorgebaut ausgeliefert" — fuer Node 24 auf linux/x64 gibt es
diese Binary nicht, es faellt auf `node-gyp` zurueck, und das slim-Image bringt
keinen Compiler mit. Die Wahl von Debian statt Alpine blieb richtig, aber aus
dem anderen Grund: uebersetzen geht auf glibc ohne Zusatzarbeit. `python3`,
`make` und `g++` stehen jetzt in der Bau-Stufe, vor dem Kopieren der
Manifeste, damit die Schicht im Cache bleibt; die Laufzeitstufe bekommt nur die
fertige `.node`-Datei.

**2. `Cannot find package '@conquerist/shared'`.** Der Build lief, der
Container startete nicht. `pnpm deploy` legt das Workspace-Paket als **Symlink**
in seinen virtuellen Store unterhalb des Zielordners; das Dockerfile kopierte
diesen Ordner im Laufzeit-Image an eine andere Stelle, und danach zeigte der
Link ins Leere. Ohne Docker liess sich das trotzdem nachsehen — `pnpm deploy`
braucht keins, und die Struktur im Ausgabeordner beantwortete die Frage in
dreissig Sekunden.

**3. Die Probe an der falschen Stelle ist schlimmer als keine.** Gegen Fehler 2
kam ein Auflaufversuch ins Dockerfile: `import('@conquerist/shared')` als
`RUN`. Er stand in der **Bau**-Stufe, wo der Workspace unter `/app` noch liegt —
also konnte ein Link nach draussen die Aufloesung retten, die drueben
scheiterte. Der Build war gruen, der Container startete wieder nicht. Die Probe
steht jetzt hinter dem `COPY` in der Laufzeit-Stufe und prueft **jede**
Laufzeit-Abhaengigkeit, nicht nur die erste; `better-sqlite3` laedt dabei seine
uebersetzte `.node`-Datei, was zugleich zeigt, dass sie den Umzug ueberstanden
hat. Dazu liegt `@conquerist/shared` jetzt als echtes Verzeichnis in
`node_modules` — das Paket ist ein `dist`-Ordner und eine `package.json`, seine
einzige Abhaengigkeit haengt ohnehin direkt am Server, der Link war keine
Ersparnis wert.

Dazu zwei Stolpersteine ohne Codeanteil: der Host-Port 8080 war belegt
(`Bind for :::8080 failed: port is already allocated`), und mit einem
Port-Mapping kann Coolify **nicht rollierend tauschen** — es entfernt den alten
Container, bevor der neue steht. Beim Wechsel ist die Anwendung also kurz weg,
und eine laufende Partie verliert ihre Verbindung.

### Abweichungen vom Plan

- **Der Plan nannte zwei Aufrufer von `new Accounts(...)`, es sind drei.**
  `ws/handlers/auth.test.ts` baut sich seine eigene Fixture; der Compiler fand
  es, aber erst nach dem Testlauf. Ein `grep` beim Planschreiben haette es
  vorher gezeigt.
- **Ein lokaler `pnpm deploy --prod`-Versuch stellte den Workspace auf
  Produktionsabhaengigkeiten um**, worauf `pnpm` die `node_modules` aufraeumen
  wollte und ohne Terminal abbrach. Mit `pnpm install` repariert, danach die
  Abnahme erneut gemessen.
- **Der Durchlauf endete im Heimnetz statt unter einer Domain.** Der Server
  steht hinter einem Router ohne Portfreigabe; erreichbar ist er ueber
  `http://192.168.178.22:8477` per Port-Mapping, also **ohne Traefik und ohne
  TLS**. Der Plan sah HTTPS unter eigener Domain vor; das bleibt offen.

### Offene Punkte

- **Der Browser-Durchlauf ist unvollstaendig.** Gesehen sind die Seite und
  eine offene Verbindung im Heimnetz. **Nicht** nachgestellt: eine Partie zu
  zweit mit Handel, ein Redeploy mit ueberlebender Partie, und die Drossel im
  Browser (sie ist am laufenden Dev-Server ueber das Protokoll belegt, nicht
  ueber die Oberflaeche).
- **Ob ein Volume auf `/data` haengt, ist nicht bestaetigt.** „Healthy" beweist
  es nicht: das Dockerfile setzt `DATABASE_FILE=/data/conquerist.db` selbst und
  legt `/data` im Image an, der Server schreibt also auch ohne Volume
  klaglos — nur eben in den Container. Solange das nicht geprueft ist, gilt
  jede Partie dort als fluechtig.
- **Kein HTTPS, keine Domain.** Damit laeuft der WebSocket als `ws://`,
  unverschluesselt im Heimnetz. Beides braucht Portfreigaben (80/443) und
  einen A-Record; die dynamische IP braeuchte zusaetzlich DynDNS.
- **Keine Sicherung der Datenbank.** Ein Volume ueberlebt Redeploys, nicht den
  Verlust des Servers.
- **Ein Angreifer kann ein bekanntes Konto 15 Minuten aussperren**, indem er
  zehnmal falsch raet. Bewusster Preis des Zaehlens je Name.
- **Die Zaehler sind nach einem Neustart weg**, sie liegen im Speicher.
- **Abgelaufene Sitzungen werden nur beim Start und beim Anfassen geraeumt.**
- **Nur eine Instanz.** Raumverzeichnis, Wecker und Drossel liegen im Speicher,
  die Datenbank ist eine Datei.
- **Die zwei Viewport-Breakpoints aus Etappe 8 sind weiterhin ungesehen.**

### Naechste Etappe

**Etappe 10 — Erweiterungen.** Davor gehoert der Rest dieser Etappe zu Ende
gebracht: das Volume bestaetigen, die Partie zu zweit ueber das Netz spielen,
und der Weg nach draussen mit HTTPS.

## Nach dem ersten Playtest — neun Anpassungen (2026-08-13, `etappe-10-playtest`)

Stand: 2026-08-13, Branch `etappe-10-playtest`, abgezweigt von `main` (`4158e07`).

Das Spiel ist zum ersten Mal von Menschen gespielt worden, und die Liste, die
dabei entstanden ist, hat einen gemeinsamen Nenner: **nichts davon war ein
Absturz.** Neun Beobachtungen aus einer Runde, davon zwei echte Fehler (die
heissen Zahlen, der Einladungslink), vier fehlende Auskuenfte (Vorrat, Farbe,
Ziel, Name) und drei Stellen, an denen die Oberflaeche etwas anderes sagte als
sie meinte.

### Abnahme

| Pruefung            | Ergebnis                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `pnpm typecheck`    | gruen (`tsc -b`, alle drei Pakete)                                           |
| `pnpm test`         | 948 Tests gruen (shared 568, server 161, client 219)                         |
| `pnpm build`        | gruen, Client-Bundle 385,51 kB (114,66 kB gzip), CSS 27,03 kB (6,35 kB gzip) |
| `pnpm format:check` | gruen                                                                        |
| Browser             | **nicht gelaufen** — siehe „Offene Punkte"                                   |

Zum Vergleich: Etappe 9 stand bei 838 Tests. Dazu gekommen sind 110, davon 27
neu geschrieben (17 Server, 10 Client), der Rest aus dem Anpassen bestehender
Vorrichtungen.

### Getroffene Entscheidungen

**Die Sechs und die Acht waren rot — nur nie sichtbar.** `.chip__hot` mit
`fill: #a52a1e` stand seit Etappe 3 im Blatt, darueber `.chip text` mit
`fill: #16202a`. Eine Klasse plus ein Typ schlaegt eine Klasse allein, also hat
die Regel nie gegriffen, und niemand hat es gemerkt, weil die Farbe ja dastand.
Die Regel heisst jetzt `.chip text.chip__hot`. Wer eine Farbe schreibt, hat sie
damit noch nicht gezeigt.

**„Heiss" wird aus der Wuerfelschale abgeleitet, nicht als `6 || 8` getippt.**
`isHot` liest die hoechste Augenwahrscheinlichkeit aus derselben `PIPS`-Tabelle,
aus der die Punktreihe unter der Zahl kommt. Ein Regelwerk mit anderen Wuerfeln
faerbt damit von selbst die richtigen Chips. Die Punktreihe faerbt sich mit —
Rot ist nie der einzige Traeger.

**Ein zweites Farbtripel fuer Pergament.** `--ok`, `--warn` und `--bad` sind
fuer die Tiefsee-Flaeche gemischt und stehen auf einem Zahlenchip oder einem
Knopf aus Pergament zu hell. Statt im Einzelfall abzuweichen, gibt es jetzt
`--ok-ink`, `--warn-ink` und `--bad-ink`: gleiche Bedeutung, anderer Untergrund.

**Das Schliesskreuz ist eine eigene Komponente und nimmt Escape mit.** Jeder
Dialog hatte seinen Ausweg schon, aber unten und ausgeschrieben — im Playtest
hat jemand versehentlich „Handel" gedrueckt und ihn nicht gefunden, weil er
unter drei Reitern und zwei Kartenlisten stand. `CloseButton` sitzt oben rechts,
in jedem schliessbaren Fenster an derselben Stelle, und haengt seinen
Escape-Horcher an sein eigenes Leben: solange das Kreuz da ist, gibt es einen
Ausweg. Es ersetzt den unteren Knopf **nicht** — „Abbrechen" sagt, was passiert,
das Kreuz sagt nur, wo man drueckt. Klick auf den Hintergrund schliesst weiter
nichts: beim Abwerfen und beim Angebot gibt es kein Zumachen, und ein
Hintergrund, der mal schliesst und mal nicht, ist schlimmer als einer, der es
nie tut.

**Drei Antworten, drei Farben.** Annehmen/Ablehnen/Anpassen trugen `button`,
`button` und `button--ghost` — zwei sahen gleich aus, und der dritte war auf
Pergament praktisch unsichtbar. Im Playtest hat niemand gesehen, dass sich ein
Angebot anpassen laesst. Jetzt gruen, rot und gelb, und auf jedem steht
weiterhin, was er tut: wer Rot und Gruen nicht unterscheidet, liest die Woerter.

**Fehlt das Annehmen, tritt der Satz an seine Stelle — Ablehnen bleibt.** Der
gesperrte Knopf mit der Erklaerung daneben liess einen erst hindruecken und dann
lesen. Jetzt steht „Nicht genügend Ressourcen" dort, wo der Knopf war. Das
Ablehnen daneben ist eine bewusste Abweichung von der woertlichen Bitte: der
Anbieter wartet auf eine Antwort, und ohne Ablehnen bekaeme er sie erst, wenn
die Frist ablaeuft — ein Fenster, das einem den kurzen Weg nimmt, haelt den
ganzen Tisch auf.

**„Gegenangebot" heisst jetzt ueberall „Angebot anpassen".** Knopf, Hinweis und
Absender tragen dasselbe Wort (Regel 8). Der Verlaufssatz („haelt dagegen")
bleibt, er beschreibt das Ergebnis und nicht die Bedienung.

**Der Bauvorrat steht neben den Wuerfeln.** `piecesLeft` lag seit Etappe 4 in
jeder `PlayerView` und wurde nirgends gezeigt; dass die letzte Strasse gelegt
war, merkte man an der Absage des Servers. Drei Zeilen, je die Silhouette vom
Brett in der eigenen Farbe und die Zahl daneben. **Die Null verschwindet nicht**,
sondern wird blass: ein fehlender Eintrag saehe aus wie ein Anzeigefehler, und
gerade die Null ist die Auskunft, auf die es ankommt. Das ist bewusst anders als
bei der Hand, wo eine Ressource ohne Karten keinen Stapel hat — dort ist das
Fehlen die Auskunft, hier waere es das Gegenteil.

**Der Einladungslink tritt nicht mehr von selbst bei.** Sein Code stand beim
ersten Rendern in `codeRef`, und der Anmelde-Effekt schickte gleich hinter
`hello` ein `room.join` hinterher. Wer dem Link folgte, sass als „Gast" am Tisch,
bevor er einen Namen eintippen konnte. `codeRef` faengt jetzt bei `null` an; der
Link fuellt nur noch das Feld auf dem Startbildschirm. Der Reconnect haengt nicht
daran: nach einem echten Beitritt steht der Code drin, und wer in genau einem
Raum sitzt, bekommt ihn ohnehin von `hello` aus geoeffnet.

**Umbenennen ist `user.rename` und nicht `room.rename`.** Der Name gehoert der
Person und nicht dem Sitz (Regel 7). Der Server schreibt ihn in `users` und zieht
ihn durch **jeden** Raum nach, an dem diese Person sitzt — seit Etappe 6 koennen
das mehrere sein, und ein Name, der nur in einem ankommt, ist danach zweierlei.
Laeuft dort eine Partie, geht auch der Spielstand hinaus: die Namen stehen in der
`PlayerView`, und ohne das hiesse der Umbenannte erst nach dem naechsten Zug
anders. Nicht ueber `hello` mit neuem Namen, obwohl das schon umbenennen kann:
das waere die halbe Anmeldung fuer eine Textaenderung, samt allem, was daran
haengt.

**Die Farbe ist keine Funktion des Platzes mehr.** `seatColorAt(index)` ging,
solange sie niemand aussuchen konnte. Jetzt gibt `firstFreeColor` dem Naechsten
die erste freie, `chooseColor` laesst nehmen, was frei ist, und `leaveRoom`
**faerbt niemanden mehr um** — bis Etappe 9 zaehlte es die Verbliebenen neu
durch, und wer sich Violett ausgesucht hatte, sass danach in Rot, weil vor ihm
jemand gegangen war. Belegt ist belegt, kein Tausch: zwei Spieler, die
gleichzeitig tauschen wollen, waeren eine Verhandlung und keine Einstellung. Wer
die Farbe eines anderen will, fragt ihn.

**Die Farbwahl trennt sich vom Umstellen des Tisches.** `room.color` ist eine
eigene Nachricht und kein Feld an `room.configure`: die Tischgroesse stellt der
Gastgeber fuer alle ein, die Farbe waehlt jeder fuer sich. Zwei verschiedene
Berechtigungen in einer Nachricht waeren eine Nachricht, die man nur zur Haelfte
annehmen kann. Im Wartebereich ist das sichtbar: „Dein Platz" ist ein eigener
Kasten ohne `canConfigure` davor.

**Sechs Farben mit Namen.** `SEAT_COLOR_NAMES` in `shared`, gleiche Reihenfolge
wie `SEAT_COLORS` und nur darueber verbunden — eine Tabelle von Farbwert auf
Namen waere ein zweiter Ort, an dem jemand eine Farbe aendern koennte, ohne den
Namen mitzuaendern. Eine Auswahl aus sechs Flecken laesst sich sonst weder
vorlesen noch benennen, und Rot neben Orange ist nicht fuer jeden ein
Unterschied.

**Der freie Platz zeigt keine Farbe mehr.** Bis Etappe 9 stand er in der Farbe,
die dieser Platz bekommen wuerde. Das war ein Versprechen, das der Wartebereich
seit der Farbwahl nicht mehr halten kann — der Naechste sucht sie sich aus.
Jetzt `currentColor`.

**Das Siegpunktziel steht am Raum und geht beim Start ins RuleSet.** Eingestellt
wird es im Wartebereich, und dort gibt es noch kein Spiel, in dem es stehen
koennte. `startGame` schreibt `{ ...CLASSIC_RULES, victoryPointGoal }` genau
einmal in die Partie; ab da traegt sie ihr eigenes Regelwerk (es geht als Teil
des Startzustands auf die Platte), und eine spaetere Aenderung am Raum erreicht
sie nicht mehr. Derselbe Grund, aus dem eine alte Partie eine Aenderung an
`CLASSIC_RULES` ueberlebt.

**Fuenf bis zwanzig, Vorgabe zehn — und die Grenzen stehen in `shared`.**
`RuleSetSchema` laesst ab 2 alles zu; es beschreibt, was das Regelwerk
darstellen kann, nicht was ein Tisch sinnvoll einstellt.
`MIN_VICTORY_POINT_GOAL` und `MAX_VICTORY_POINT_GOAL` sind die Grenzen fuer die
Bedienung, und sie stehen in `shared`, weil der Server dieselbe Grenze noch
einmal prueft. Im Protokoll traegt das Feld eine Vorgabe: eingestellt wird es im
Wartebereich, und ein Pflichtfeld zwaenge den Startbildschirm zu einer Frage, die
dort niemand stellen will.

**Vierter Migrationsschritt: `room_seats.color` und `rooms.victory_point_goal`.**
Beides waren Ableitungen und deshalb keine Spalte. Wer sie einstellen kann, muss
sie speichern — sonst sitzt nach jedem Neustart jeder wieder in der Farbe seines
Platzes, und ein Wartebereich mit Ziel 15 startet mit 10. Der Bestand bekommt
genau das, was vorher galt: die Farbe der Position und die Zehn aus der
Schachtel. Die sechs Farbwerte stehen als Zeichenkette im Schritt und nicht als
Import aus `SEAT_COLORS` — ein Schritt, der eine Konstante liest, aendert sein
Ergebnis, sobald jemand die Konstante aendert, und waere dann nicht mehr der
Schritt, der einmal veroeffentlicht wurde. Dieselbe Regel wie bei den 60 Tagen in
`stepSessionExpiry`.

**Umlaute nur dort, wo ein Spieler liest.** Betroffen sind die Wortlisten
(`Hügel`, `Wüste`), die Verlaufssaetze, die Ablehnungstexte der Regeln und des
Servers und die restlichen Oberflaechentexte im Client. **Nicht** angefasst:
Kommentare, Testnamen und die geworfenen Invarianten, die ihre Funktion vorn im
Satz nennen (`coastalEdgeRing:`, `resourceAt:`, `hexRing:`). Die sind an uns
gerichtet und folgen derselben Konvention wie die Bezeichner. Die Grenze ist
sichtbar: was ein `violation` oder ein `fail` traegt, hat Umlaute; was ein
`throw new RangeError` traegt, nicht.

**Ein leerer Name geht gar nicht erst hinaus.** Nebenbefund beim Umbau von
`identify`: `DisplayNameSchema` verlangt mindestens ein Zeichen, und der Server
haette damit die ganze Anmeldung abgewiesen statt nur den Namen. Getroffen haette
das „Zurück in die Partie" bei geleertem `localStorage` — man kaeme in keine
eigene Partie mehr hinein, mit einer Meldung ueber ein Feld, das man nirgends
sieht.

### Abweichungen von der Liste

**Punkt 8 woertlich haette Annehmen _und_ Ablehnen entfernt.** Nach Rueckfrage
bleibt Ablehnen stehen — Begruendung oben.

**Punkt 3 ist ueber den Handelsdialog hinausgegangen.** Gefragt war das Kreuz im
Handelsfenster; bekommen haben es alle vier schliessbaren Dialoge (Handel, Wen
bestehlen, Erfindung/Monopol, Konto). Ein Kreuz, das nur in einem Fenster oben
rechts sitzt, ist keine Stelle, an der man sucht.

### Offene Punkte

- **Kein Browser-Durchlauf.** Die Zahlen oben sind gemessen, die Oberflaeche ist
  es nicht: auf 5173 lief bereits ein Dev-Server, und ein zweiter daneben waere
  ein Streit um den Port gewesen. Ungesehen sind damit **alle** neuen Flaechen —
  die roten Chips, die Vorratsanzeige neben den Wuerfeln, die Farbwahl und das
  Ziel im Wartebereich, das Kreuz in den Dialogen und die drei farbigen
  Antwortknoepfe. Zwei Stellen sind dabei am ehesten verdaechtig: die Ablage
  unten links ist auf 14,5 rem gedeckelt (`.panel`), und Wuerfel plus Vorrat
  teilen sich diese Breite jetzt zu zweit; und `.lobby__you` ist ein vierter
  Kasten in einer Spalte, die vorher drei hatte.
- **Die Farbwahl kennt keinen Tausch.** Wer die Farbe eines anderen will, muss
  ihn bitten, sie freizugeben. Bewusst so — ein Tausch waere eine Verhandlung
  mit Zusage, also eher ein zweites `tradePending` als eine Einstellung.
- **Das Siegpunktziel steht nur im Wartebereich.** Waehrend der Partie sagt keine
  Flaeche, gegen welche Zahl gespielt wird; sie liegt in
  `view.rules.victoryPointGoal` und waere im Statusfeld unterzubringen.
- **Umbenennen waehrend einer laufenden Partie ist erlaubt und im Browser
  ungeprueft.** Der Verlauf behaelt dabei die alten Saetze — sie sind zu dem
  Zeitpunkt entstanden, zu dem die Person noch so hiess. Das ist gewollt, koennte
  aber beim Lesen verwirren.
- **Die zwei Viewport-Breakpoints aus Etappe 8 sind weiterhin ungesehen**, und
  die neuen Flaechen sind in ihnen erst recht nicht geprueft.
- Die offenen Punkte aus Etappe 9 (Volume, HTTPS, Sicherung, Drossel im
  Speicher, eine Instanz) gelten unveraendert weiter.

### Naechste Etappe

Diese hier im Browser ansehen, zu zweit ueber das Netz, mit dem Einladungslink —
das ist die Probe, die alle neun Punkte gleichzeitig trifft. Danach der Rest von
Etappe 9 (Volume, HTTPS) und dann Etappe 10.

## Zweiter Durchgang nach dem Playtest — acht Anpassungen (2026-08-14, `etappe-10-playtest`)

Stand: 2026-08-14, Branch `etappe-10-playtest`, direkt auf den ersten Durchgang
gesetzt.

Diesmal ging es weniger um Fehlendes als um Missverstaendliches: drei der acht
Punkte betreffen Stellen, an denen die Oberflaeche etwas zeigte, das man anders
gelesen hat, als es gemeint war.

### Abnahme

| Pruefung            | Ergebnis                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `pnpm typecheck`    | gruen (`tsc -b`, alle drei Pakete)                                           |
| `pnpm test`         | 976 Tests gruen (shared 576, server 161, client 239)                         |
| `pnpm build`        | gruen, Client-Bundle 391,10 kB (115,96 kB gzip), CSS 29,73 kB (6,80 kB gzip) |
| `pnpm format:check` | gruen                                                                        |
| Browser             | **nicht gelaufen** — siehe „Offene Punkte"                                   |

### Der Fall, der zuerst gemessen und dann erklaert wurde

**„Am Brettrand sind die Strassen unsichtbar" — am Element lag es nicht.** Vor
jeder Aenderung eine Sonde: ein Brett in eine Datei gerendert und nachgesehen,
wo eine Kuestenstrasse landet. Ergebnis: alle 30 Kuestenkanten liegen in der
`viewBox` (null Punkte ausserhalb), die Strasse traegt `road road--built`, sie
traegt ihre Farbe im `style`, und sie steht in der Zeichenreihenfolge hinter
allen Feldern. Es war also nichts weg — es war nur nichts zu sehen.

Der Grund ist der Untergrund. Eine Strasse im Inneren liegt zwischen zwei hellen
Gelaendefeldern; eine an der Kueste liegt zur Haelfte auf der dunklen See, und
ein dunkelblauer (`#2c6fbb`) oder violetter (`#8e5bb5`) Streifen darauf
verschwindet. Die Loesung ist die aus der Kartografie: **eine Kontur unter der
Strasse**, in derselben Tinte wie die Feldraender.

Die Kontur wird in einem **eigenen Durchgang** gezeichnet - erst alle Konturen,
dann alle Strassen. Ein Wrapper je Kante waere naheliegender gewesen und haette
an jeder Kreuzung die Kontur der zweiten Strasse ueber die Farbe der ersten
gelegt.

### Getroffene Entscheidungen

**Ein Gegenangebot ist eine Frage und keine Auskunft.** Es stand als Zeile
zwischen „lehnt ab" und „nimmt an", in derselben Form - und die Richtung stand
aus der Sicht des Konternden da („Ben bietet 1 Erz für 3 Holz"). Wer sein
eigenes Angebot vor Augen hat, liest das zwangslaeufig falsch herum. Jetzt ein
eigener Kasten mit zwei **beschrifteten** Zeilen aus der Sicht dessen, der ihn
liest: „Du gibst" und „Du bekommst". Keine Reihenfolge mehr, die man raten muss.

**Neue Aktion `rejectCounter`.** Der Anbieter konnte ein Gegenangebot nur
annehmen oder sein ganzes Angebot zuruecknehmen. Wer von einem von drei
Mitspielern etwas bekam, das er nicht wollte, beendete damit die Runde fuer alle

- auch fuer die, die noch ueberlegten. Das Gegenstueck zu `acceptTrade`, und wie
  dieses ohne Mengen: welches Gegenangebot gemeint ist, steht in der Antwort des
  Partners.

**Eine vierte Antwortart `rejected` statt eines bequemen `declined`.** Sie als
Ablehnung zu fuehren waere ein Feld weniger gewesen und im Verlauf eine Luege:
dort staende, der Konternde habe abgelehnt, obwohl er gerade das Gegenteil getan
hat. Sie traegt die Mengen des ausgeschlagenen Angebots weiter - geloescht
stuende der Partner wieder auf `undefined` und duerfte erneut antworten, und aus
dem Ausschlagen wuerde eine Einladung, dasselbe noch einmal zu schicken.

**Ausschlagen laeuft ueber `withResponse` und nicht von Hand.** Dort steht die
eine Stelle, an der eine Runde endet, sobald niemand mehr zusagt oder kontert -
und genau das kann ein Ausschlagen ausloesen, wenn es die letzte offene Antwort
war.

**Wer geantwortet hat, sieht keine Knoepfe mehr.** Vorher standen drei gesperrte
da und kein Wort darueber, worauf man wartet. Ein gesperrter Knopf ist ein
Angebot, das man zurueckzieht, ohne es zu sagen. Jetzt steht da, was man getan
hat („Du hast abgelehnt.") und was noch fehlt („Es fehlt noch die Antwort eines
Mitspielers."). Ein **offenes** Gegenangebot zaehlt dabei nicht als fertige
Antwort: der Anbieter kann es ausschlagen, und dann ist man wieder dran.

**Gebaut wird in zwei Schritten.** Vorher leuchtete das Brett an jeder Stelle,
an der irgendetwas moeglich war - Strassen, Siedlungen und Staedte gleichzeitig
-, und was ein Klick brachte, ergab sich aus dem Ort. Jetzt sagt man erst was,
dann zeigt das Brett wo. Der Knopf traegt dabei die eigentliche Auskunft: er ist
genau dann bedienbar, wenn es Karten **und** eine Stelle gibt - beides steckt
schon in `legalActions`, es wurde nur nie gezeigt.

**Die Gruendung und der Raeuber bleiben einstufig.** Beides ist keine Wahl: in
der Gruendung gibt es genau eine Sache zu setzen, und der Raeuber muss versetzt
werden. Ein Knopf davor waere ein Schritt, der nichts entscheidet.

**`buildable` zaehlt Stellen und liefert kein `boolean`.** „An drei Stellen
moeglich" sagt mehr als „moeglich" (es steht im `title`), und eine Null ist
dieselbe Auskunft wie ein `false`, nur ohne zweiten Typ.

**Der Kaufstapel ist Material und kein Knopf.** „Karte kaufen" stand als dritter
Knopf zwischen „Handel" und „Zug beenden", in derselben Form wie die Bedienung
daneben - obwohl es das einzige Spielmaterial unter ihnen war. Jetzt ein Stapel
aus drei Ruecken mit der Zahl darauf, zwischen Hand und Bauleiste. Der Ruecken
traegt **kein Motiv**: was auf einer Entwicklungskarte steht, weiss beim Kauf
niemand, auch der Kaeufer nicht.

**Die Ablage ist eine Zeile geworden.** Sie liest sich von links nach rechts wie
ein Zug: was man hat, was man kaufen kann, was man damit tut. Als Spalte war sie
hoch und schmal; als Zeile wird sie flacher, und das Brett darueber gewinnt.

**Die Stadt ist keine groessere Siedlung mehr.** Sie war derselbe Punkt mit
groesserem Radius - die schwaechste Unterscheidung, die es gibt: Groesse liest
man nur im Vergleich, und zwei eigene Bauwerke stehen selten nebeneinander. Jetzt
ein Haus und ein Haus mit Anbau, unterscheidbar auch einzeln und in Graustufen.

**Die Silhouetten stehen in `board/shapes.ts` und damit an einem Ort.** Brett,
Wartebereich, Vorratsanzeige und Bauleiste zeichnen dieselben Pfade. Wer unten
in seinem Vorrat eine Stadt sieht, erkennt sie oben auf dem Brett wieder; vier
Zeichnungen fuer dasselbe Bauwerk waeren vier Gelegenheiten, dass eine abweicht.

**Die Konturbreite steht im Pfadmass, nicht im Brettmass.** Der Pfad steckt in
einem `scale(0.02)`; eine Linienbreite von 0.03 waere darin auf ein Sechzigstel
geschrumpft. 1,4 im Pfadraum ergeben rund 0.03 auf dem Brett - genau so viel wie
vorher am Punkt.

**`key` ist die ganze Mechanik hinter „der Ausbau war nicht zu sehen".** Beim
Ausbau zur Stadt bleibt der Knoten derselbe; React aktualisiert das Element,
statt es neu einzuhaengen, und eine Animation, die beim Einhaengen laeuft, laeuft
dann gar nicht. Mit `key={building.kind}` wird aus dem Ausbau ein neues Element,
und der Ring geht auf. Dasselbe beim Raeuber: der Ring am Zielfeld haengt an
`key={state.robber}`.

**Der Raeuber zieht laenger und mit Bogen** (460 ms statt 300, `cubic-bezier`
mit Ueberschwinger). Beides - Ring und Bogen - ist Beiwerk: wo er steht, sagt
die Figur selbst und `data-hex` daneben. Bei abgeschalteter Bewegung steht der
Ring sofort an seinem Ende, also unsichtbar, und das ist hier richtig.

**Verlauf und Status haben die Ecken getauscht.** Wer am Zug ist, liest man
staendig und beilaeufig; den Verlauf liest man selten und dann genau. Das
Beilaeufige gehoert in die Naehe der Ablage, in der man ohnehin handelt. Vorher
war es umgekehrt, und der Blick sprang bei jedem Zug quer ueber den Bildschirm.

### Was beim Testen aufgefallen ist

**Ein Test, der auf einen gesperrten Knopf drueckt, prueft nichts.** Der erste
Entwurf zum Zwei-Schritt-Bauen tat genau das: er waehlte „Siedlung", und in
diesem Stand sind nach der Gruendung alle Knoten durch die Abstandsregel
gesperrt. Der Test war gruen und hat nichts gemessen. Nachgezaehlt (7 Strassen,
2 Staedte, 0 Siedlungen), dann mit Strasse und Stadt geprueft.

**Zwei Entwuerfe mit `if (disabled) return` sind ersatzlos geflogen.** Ein Test,
der sich selbst ueberspringt, wenn die Vorbedingung fehlt, ist ein gruener
Haken ohne Aussage. Statt dessen ein von Hand gesetzter Zustand mit Karten fuer
alles - welche Rohstoffe die Gruendung abwirft, haengt am Seed.

### Abweichungen

**Punkt 6 hat auch die Siedlung angefasst.** Gefragt war nur die Stadt. Eine
Stadt als Haus mit Anbau neben einer Siedlung als Punkt waeren aber zwei
Formensprachen auf einem Brett gewesen.

### Offene Punkte

- **Weiterhin kein Browser-Durchlauf.** Die Zahlen sind gemessen, die Oberflaeche
  nicht. Ungesehen sind vor allem: die Ablage als Zeile (sie reicht jetzt bis
  `right: 15.5rem` und teilt sich die untere Bahn mit dem Statusfeld), die
  Bauleiste, der Kaufstapel, die beiden neuen Silhouetten auf Brettgroesse und
  die zwei Ringe.
- **Ob die Kontur reicht, ist eine Vermutung mit Begruendung.** Gemessen ist,
  dass am Element nichts fehlte; dass der Untergrund die Ursache war, folgt aus
  den Farbwerten und nicht aus einem Bild. Sollte es weiter unsichtbar sein,
  liegt es woanders, und dann ist die Sonde in der Aenderungsgeschichte der
  richtige Anfang.
- **Ein ausgeschlagenes Gegenangebot laesst sich nicht erneuern.** Wer
  dagegengehalten hat und ausgeschlagen wurde, ist fuer diese Runde raus.
  Bewusst so: alles andere waere eine Einladung, dasselbe noch einmal zu
  schicken.
- **Der Bau-Modus ueberlebt keinen fremden Zug.** Jeder neue Stand raeumt ihn
  weg - was eben noch ging, kann jetzt am Vorrat oder am Nachbarn scheitern.
  Online heisst das: waehrend andere ziehen, muss man neu waehlen.
- Die offenen Punkte des ersten Durchgangs und aus Etappe 9 gelten weiter.

### Naechste Etappe

Unveraendert: diese beiden Durchgaenge im Browser ansehen, zu zweit ueber das
Netz. Es ist inzwischen die einzige Probe, die noch aussteht - und die einzige,
die die Haelfte dieser Punkte ueberhaupt beruehrt.

## Ton und Einstellungen (2026-08-16, `etappe-10-ton`)

Das Spiel war stumm. Jetzt hat es 23 Klaenge, einen Einstellungen-Dialog mit
drei Lautstaerken und in der Online-Partie eine Abstufung: eigene Zuege voll,
fremde gedaempft, was mich angeht wieder voll.

Entwurf: `docs/superpowers/specs/2026-08-16-ton-und-einstellungen-design.md`,
Plan: `docs/superpowers/plans/2026-08-16-ton-und-einstellungen.md`.

### Der Fund, der alles bestimmt hat

**Online erfaehrt der Client nie, welcher Zug geschehen ist.** `GameEvent` trug
`version`, `view`, `actions`, `sentAt` und `entry` - einen fertigen deutschen
Satz. Der Hotseat hat die `GameAction` in der Hand, online liegt nur Text vor.
Ohne Eingriff braeuchte der Ton zwei Ableitungen: eine aus der Aktion, eine aus
einem Satz oder aus dem Zustandsunterschied.

Deshalb traegt `GameEvent` jetzt `move: { type, actor }` - **was** passiert ist.
Was daraus wird, entscheidet der Empfaenger; eine Ausgabeanweisung gehoerte
nicht ins Protokoll. `GameActionTypeSchema` ist ein `z.enum` mit zwei
Waechtern: `satisfies` faengt Tippfehler, ein `AssertNever` faengt vergessene
Zweige. Der zweite ist **exportiert**, weil `noUnusedLocals` einen lokalen Typ
verwirft - und ein weggeworfener Waechter waecht nichts. Nachgewiesen: eine
entfernte Zeile ergab `Type '"buildCity"' does not satisfy the constraint
'never'`.

Nebenbei faellt eine Kopie weg. `broadcastGame` bekommt statt des fertigen
Satzes den Uebergang (`{ before, action, after }`) und rechnet `entry` **und**
`move` selbst aus; vorher rief jede der vier Aufrufstellen `describeTransition`
eigenhaendig, und die fuenfte Kopie fuer `move` waere dazugekommen. `seatsOf`
in `ws/handlers/room.ts` ist damit ersatzlos verschwunden.

### Aufbau

Sieben Module unter `apps/client/src/audio/`, geschnitten nach dem, was eine
Entscheidung trifft, und dem, was nur verdrahtet:

- `cues.ts` - 23 Namen, `Sound`, `SoundEvent`, `Situation`
- `cueFor.ts` - Zug plus Lage ergibt Klaenge. Rein, 10 Tests, kein DOM.
- `situation.ts` - **zwei** Erheber, weil der Hotseat `GameState` haelt und
  online nur `PlayerView` vorliegt. Eine Funktion mit zwei Zustandswelten
  waeren zwei Funktionen mit einem Namen; dazwischen steht eine Erhebung aus
  acht Feldern.
- `voices.ts` - jeder Klang als **Daten** (Schichten aus Oszillator oder
  gefiltertem Rauschen, Huellkurve in ms). Deshalb braucht das Wuerfelpoltern
  keinen Sonderfall: fuenf Rauschschichten bei `at: 0, 90, 170, 260, 380`.
- `samples.ts` - alle 23 Cues als auskommentierte Zeilen. Synthese ist die
  Voreinstellung; eine mp3 ist die Ausnahme und faellt bei Fehler auf die
  Synthese zurueck.
- `settings.ts` - drei Busse, duldsam gelesen wie das Sitzungsgeheimnis.
- `engine.ts` - die einzige Datei mit WebAudio, **bewusst ohne Test**: in node
  gibt es keinen `AudioContext`, ein nachgebauter prueft den Nachbau.

Der Klang landet als Feld im Zustand (`sound: { seq, sounds }`), abgespielt
wird an der Kante. Die Reduzierer bleiben rein (Regel 2).

Knopfklicks fassen **keinen** der rund hundert Knoepfe an: ein delegierter
`pointerdown`-Listener am Fenster, `closest('button')`, `data-sound` als einzige
Ausnahme. Derselbe Listener ist die Freischaltung - Browser geben Audio erst
nach einer Nutzergeste frei, und die erste Geste ist ohnehin ein Klick.

### Was der Browser-Durchlauf gefunden hat

Diesmal **in** der Abnahme und nicht dahinter. Gemessen mit einer Sonde, die
`AudioContext.createOscillator`/`createBufferSource` umhuellt und mitschreibt,
was wirklich im Graphen landet.

Bestaetigt: erster Klick erzeugt genau einen Kontext und eine Rauschstimme
(`ui.click`), keine Autoplay-Warnung. `build.settlement` = ein Klopfen plus
330 Hz (A3 x 1,5). `dice.land` folgt der Augensumme - 349 Hz bei einer Drei,
415 Hz bei einer Sechs, 523 Hz bei einer Zehn; die Sieben bekommt stattdessen
`dice.seven` auf 165 Hz. `moveRobber` = Tiefensweep plus 110 Hz.

Drei Befunde, alle behoben:

1. **Das Zahnrad war eine Sonne.** Ein Kreis mit acht Strahlen ohne Rad
   herum ist ueberall das Helligkeitssymbol. Ein zweiter Kreis macht aus
   Strahlen Zaehne.
2. **Das Zahnrad lag auf dem Verlauf.** Gemessen: Knopf 1519-1553, Panel
   1478-1556. Es dort liegen zu lassen waere der `.button--ghost`-Fehler
   gewesen - seine Farbe ist fuer Tiefsee gemischt und auf Pergament kaum
   sichtbar. Der Verlauf weicht deshalb nach unten aus (`top: 3.3rem`), nicht
   zur Seite: so bleibt seine Kante an der Bildschirmkante.
3. **Die Stimmensperre verschluckte den Ertrag.** Der Verlauf meldete
   „Spieler 1 +2", und kein Blip kam. Ursache: `MAX_VOICES = 8` zaehlte
   **Schichten**, und ein Wurf kostet allein sechs (Klick plus fuenf Ticks) -
   alles danach fiel weg. Gezaehlt werden jetzt **Klaenge** (`MAX_CUES = 6`,
   je Cue eine Uhr ueber seine Dauer). Ein Klang ist eine Einheit; angefangen
   wird er ganz oder gar nicht.

Dazu eine Luecke zwischen Spec und Code, die erst der Verlaufssatz sichtbar
gemacht hat: `gain.self` spielte immer dieselbe Dreiklangfigur, versprochen war
„ein Blip je Karte, bei vier gedeckelt". `Sound.count` kuerzt das Rezept jetzt
auf die Zahl der Karten - bei „+1" klingt ein Blip, bei „+2" zwei.

Und noch eine Messung: bei 392 px lagen die letzten drei Pixel von „Anmelden"
unter dem Zahnrad - unsichtbar knapp, dort aber nicht mehr klickbar. Das
Polster in der schmalen Media Query steht jetzt auf 3,25rem. Nachgemessen bei
360, 396, 768 und 1280 px: keine Ueberlappung mehr.

### Lehren

- **Ein Effekt unter `StrictMode` laeuft doppelt.** Ohne die `seq`-Sperre in
  `useCueSound` klaenge in der Entwicklung jeder Zug zweimal, und man suchte
  den Fehler im Klang statt im Effekt.
- **Eine Grenze, die die falsche Einheit zaehlt, ist ein Fehler.** Acht
  Schichten klangen nach „reichlich" und waren weniger als zwei Klaenge.
- **Der Verlaufssatz ist die beste Probe fuer den Ton.** „+2" gegen zwei Blips
  ist eine Zusicherung, die man ohne Ohren pruefen kann - und sie hat beide
  Klangfehler aufgedeckt.

### Offene Punkte

- **Gehoert hat das noch niemand.** Geprueft ist, _dass_ zur richtigen Zeit die
  richtigen Frequenzen geplant werden, nicht _wie_ es klingt. Ob die 23
  Rezepte zusammen einen Tisch ergeben, entscheidet das erste Zuhoeren.
- **Die Abstufung fremder Zuege ist nur im Test belegt**, nicht zu zweit ueber
  das Netz. Dafuer braucht es zwei Fenster und zwei Konten.
- **Musik gibt es nicht.** Bus, Regler und Speicher stehen; die Spur ist leer.
- Der Spielbildschirm hat weiterhin keine einzige Media Query - der
  Verlaufs-Umzug aendert daran nichts.

## Der Tisch — Layout ohne Rahmen, Haefen im Wasser (2026-08-19, `main`)

Vier Sachen aus einer Sitzung: ein Bauwerk, das beim Bauen riesig ueber dem
Brett stand, Haefen unter Strassen, ein neues Layout und der Zwei-Schritt-Bau
in der Gruendung. Alle vier vom Menschen am Bildschirm gemeldet, keine davon
von einem Test.

### Das riesige Haus

Beim Bauen erschien die Silhouette einmal ganz gross quer ueber dem Brett und
sprang dann an ihren Platz. Der Pfad trug seine Lage als `transform`-Attribut
und gleichzeitig ueber `.building` die Einblendung `settle`, die `transform`
animiert. **Eine CSS-Animation schlaegt das gleichnamige
Praesentationsattribut** - fuer 180 ms war `translate(...) scale(0.023)` schlicht
weg, und der Pfad stand in seinem eigenen Mass da: rund 20 Einheiten breit, wo
ein Feld eine misst, und am Nullpunkt statt am Knoten.

Eingeschleppt wurde das in `dd3d467`: `settle` stammt aus `d8b8eea`, damals war
das Bauwerk ein `<circle cx cy r>` ohne `transform` - kein Konflikt. Der
Wechsel auf einen Pfad mit `transform`-Attribut hat die Kollision erst erzeugt.
Jetzt traegt eine Gruppe die Lage und wird nie animiert, der Pfad darin bewegt
sich in seinem eigenen Raum.

### Haefen ins Wasser

Die Marke sass auf `edgeMidpoint` - derselben Stelle, ueber die eine Strasse
laeuft. Wer auf einer Hafenkante baute, legte seinen Balken mitten durch den
Hafen, und weil die Strassen spaeter gezeichnet werden, blieb vom Hafen nichts.

`harborAnchor` setzt sie jetzt `HARBOR_OFFSET = 0.42` in die See, im rechten
Winkel von der Kante weg. Die Richtung kommt aus dem **angrenzenden Landfeld**
und nicht aus dem Brettschwerpunkt: beim runden `classic34` liefe beides aufs
selbe hinaus, bei einem laenglichen Szenario schoebe der Schwerpunkt die Marke
aufs Land. Dazu zwei Stege zu den Endknoten - bis dahin stand **nirgends,
welche zwei Knoten ein Hafen bedient**.

### Der Tisch

Regel: **was man anfassen koennte, behaelt einen Koerper; was nur Auskunft ist,
wird Schrift auf dem Tisch.** Vier Dinge trugen denselben Pergamentkasten
(Spielerliste, Status, Bedienleiste, Hand) - genau der liess das Spiel wie eine
Anwendung aussehen. Karten, Wuerfel, Kaufstapel, Bauteile und Knoepfe behalten
ihren hellen Koerper und bekommen `--lift`, einen kurzen Kontaktschatten dicht
unter der Kante. Das ist die eigentliche Arbeit: Rahmen wegzunehmen macht Dinge
nur flach, der Schatten macht sie liegend.

Technisch haengt es an zwei Zeilen - `.panel` und `.hand` definieren `--ink`
lokal auf die Farben fuer dunklen Grund um, und alles darin folgt. Dafuer gibt
es `--ink-base`, das nie ueberschrieben wird, damit die hellen Dinge _innerhalb_
ihre dunkle Tinte zurueckholen koennen.

Dazu: `.game` ist ein Raster (`minmax(0, 1fr) auto`) statt `bottom: 11rem` im
Einzug des Bretts - eine Zahl, die an zwei Stellen stimmen muss, stimmt
irgendwann an einer nicht mehr. Der Vorrat steht am Bauknopf statt als eigene
Liste darueber (`StockPanel` entfaellt; es waren zwei Zeilen je Bauteil, eine
zum Zaehlen, eine zum Druecken). Der Verlauf liegt hinter einem Symbol neben
dem Zahnrad - was man selten liest, braucht eine Tuer und keine Wand. Der
Phasentext in der Bedienleiste ist weg, er stand woertlich doppelt.

### Zwei Schritte auch in der Gruendung

Die Gruendung war einstufig, begruendet mit „ein Knopf davor entscheidet
nichts". Das stimmt fuer sich und geht am Punkt vorbei: die Gruendung ist der
Moment, in dem man die Bedienung **lernt**. Wer seine ersten vier Zuege macht,
indem er irgendwo auf ein leuchtendes Brett klickt, steht in der ersten
Hauptrunde vor einem dunklen Brett. `buildKindOf` kennt jetzt
`placeSetupSettlement` und `placeSetupRoad`, alles andere folgt daraus. Kostet
zwoelf zusaetzliche Klicks ueber die Gruendung; in derselben Funktion wieder
raus.

### Was der Browser-Durchlauf gefunden hat

Diesmal in der Abnahme. Drei Fehler, keinen davon hat ein Test gesehen.

1. **Die Wuerfel waren zwei leere Kaestchen.** `.die__pip` benutzt `var(--ink)`,
   und der Wuerfel liegt in der Bedienleiste, die `--ink` auf Cremeweiss
   umstellt: cremefarbene Augen auf cremefarbenem Wuerfel. Genau die Falle, fuer
   die `--ink-base` gebaut war - und ausgerechnet der Wuerfel war vergessen.
2. **Zwoelf Prozent Bretthoehe an einen geratenen Rand verschenkt.** Fuer die
   Haefen war `PADDING` von 0.6 auf 0.95 gesetzt worden, geschaetzt. Gemessen
   mit `getBBox()`: das Brett zeichnete 8.69 von 9.90 viewBox-Einheiten, die
   Haefen ragen tatsaechlich nur **0.35** ueber die Feldecken. Die Zahl ist
   jetzt in ihre zwei Gruende zerlegt (`PADDING = 0.2` Luft plus
   `HARBOR_REACH = 0.35`). Ausnutzung 88 % -> **95 %**, Brett 633 von 663 px
   Flaechenhoehe bei 1920x889.
3. **Das Verlaufsblatt blieb schmal, obwohl `max-width: 21rem` dranstand.** Es
   haengt in `.log-corner`, und die ist nur so breit wie ihr Symbol (74 px) -
   als Containing Block deckelt sie die verfuegbare Breite eines absolut
   positionierten Kindes. `max-width` war nie erreichbar; `width` steht ueber
   dieser Rechnung.

Dazu eine Regression aus dem Umbau selbst: ohne Kasten ist `.hand__head` so
breit wie die Kartenreihe, also wanderte die Gesamtzahl mit jeder neuen Sorte
ueber den Bildschirm. Sie steht jetzt fest neben ihrer Beschriftung.

Karten von 2,3rem auf 4,6rem (Flaeche 5,8rem, Motiv 3,1rem) - die alte Groesse
war eine Rechnung um einen Rahmen herum, den es nicht mehr gibt.

### Lehren

- **Eine CSS-Animation schlaegt das gleichnamige Praesentationsattribut.**
  Dasselbe Muster wie die unsichtbaren Strassen in Etappe 3, nur andersherum:
  dort schlug eine Regel ein Attribut, hier eine Animation. Wer Lage und
  Bewegung auf dieselbe Eigenschaft legt, verliert die Lage.
- **Eine umdefinierbare Farbvariable braucht einen unverschiebbaren
  Grundwert** - und dann muss man jeden hellen Koerper darin auch wirklich
  finden. Der Wuerfel war vergessen, und kein Test kann das sehen.
- **Zahlen, die man beim Umbau schaetzt, bleiben stehen.** 0.95 statt 0.55 hat
  ueber eine Sitzung hinweg zwoelf Prozent Brett gekostet und faellt nur beim
  Messen auf.
- **Ein `max-width` ist nur so gross wie der Containing Block erlaubt.**

### Offene Punkte

- Der Spielbildschirm hat weiterhin keine einzige Media Query - der Umbau auf
  ein Raster macht das nicht besser und nicht schlechter.
- Links und rechts vom Brett stehen je rund 380 px leere See. Das ist
  Geometrie und kein Fehler: das Brett ist fast quadratisch, das Fenster breit,
  also begrenzt die Hoehe. Groesser wird es nur mit einer flacheren Ablage - und
  die ist jetzt von den grossen Karten bestimmt.
- Die Gruendung kostet zwoelf zusaetzliche Klicks. Ob das im Spiel zaeh wirkt,
  entscheidet der naechste Playtest.

## Der Vorrat als Material — Bauteile ohne Rahmen, ein Ruecken fuer die Bank (2026-08-19, `main`)

Nachtrag zum Layout aus derselben Woche, wieder vom Menschen am Bildschirm
gemeldet: der Tisch stimmt fast, aber die Bauteile stehen noch als Knoepfe
darauf. Drei Aenderungen, alle in der Ablage.

### Die Bauteile liegen jetzt, statt zu klicken

`.build__pick` war eine Pergamentplatte mit Rand, Schatten und Beschriftung -
also genau dieselbe Form wie „Handel" und „Zug beenden", mit einer 1.05rem
grossen Silhouette darin. Der Kaufstapel daneben hatte diese Form schon
verloren, weil er Material ist und keine Bedienung; die drei Bauteile im
eigenen Vorrat sind dasselbe und behielten sie trotzdem.

Jetzt: kein Rahmen, keine Flaeche, die Silhouette von 1.05rem auf 2.5rem, die
Vorratszahl von rechts daneben nach **unten darunter**. Was von der Platte
bleibt, ist der kurze `drop-shadow` dicht unter der Kante - er ist der
Unterschied zwischen „liegt auf dem Tisch" und „ist auf den Tisch gemalt", und
er sitzt jetzt am gezeichneten Umriss statt am Kasten drumherum.

**Der Name ist weg.** Er stand neben einer Form, die auf dem Brett dasselbe
bedeutet - Haus, Haus mit Anbau, Balken - und war die Beschriftung eines
Bildes, das schon spricht. Er bleibt im `title` und als vorgelesener Name des
Knopfes; die Silhouetten unterscheiden sich einzeln und nicht nur im Vergleich
(deshalb hat die Stadt seit dem Playtest einen Anbau statt eines groesseren
Radius).

Ohne Rahmen braucht die **Auswahl** eine neue Form: sie war eine goldene
Fuellung des Knopfes. Jetzt ist sie ein Lichtfleck auf dem Tisch
(`radial-gradient` unter dem Stueck), das Stueck steht dabei angehoben, und die
Zahl darunter wechselt auf den Akzent. Drei Traeger fuer eine Auskunft, damit
nicht die Farbe allein sie traegt.

### Der Kartenruecken traegt jetzt doch ein Motiv

In `DeckPanel.tsx` stand seit dem Playtest: **„Der Ruecken traegt kein Motiv"** -
was auf einer Entwicklungskarte steht, weiss beim Kauf niemand, ein Ritter
darauf waere ein Versprechen, das der Stapel nicht halten kann.

Der Satz stimmt und war trotzdem die falsche Regel. Er verbietet Motive, die
vom **Inhalt** reden. Ein Ruecken redet aber vom **Stapel** - „diese Karten
gehoeren zusammen und keine verraet sich" - und das ist die aelteste Aufgabe
eines Kartenruecken ueberhaupt. Ohne ihn war die Bank ein leeres beiges
Rechteck neben fuenf gezeichneten Handkarten.

Das Motiv, drei Lagen, alle aus vorhandenem Material:

1. **Das Feld** - ein Gitter kleiner Sechsecke, versetzt gesetzt. Das Sechseck
   ist die Grundform des Bretts; als Papierstruktur gelesen macht es aus dem
   Ruecken eine Karte _dieses_ Spiels statt einer Ruckseite mit Rautenmuster.
2. **Die Fassung** - zwei eingerueckte Linien, aussen kraeftig, innen fein. Die
   Grammatik jedes Kartenruecken, den es je gab: sie macht aus einem Rechteck
   eine Karte.
3. **Das Siegel** - eine Scheibe aus Tiefsee-Tinte mit goldenem Ring, darin ein
   Sechseck aus Pergamentlinie, **und das Sechseck ist leer**. Genau da steckt
   der alte Einwand: das Siegel sagt „verschlossen", nicht „Ritter". Der
   gestrichelte Ring darum ist die Perforation, an der man aufbricht.

Keine Farbe, die es nicht schon gab: Pergament, Tiefsee, der Akzent aus
`--fields`. Alle Werte stehen in `index.css`, keiner in der Komponente
(Designregel 2); das SVG traegt nur Klassen. Die Rueckseiten der **Handkarten**
sind ein anderer Stapel und behalten ihr eigenes Streifenmuster - gleiche
Zeichnung hiesse gleiche Herkunft, und die stimmt nicht.

Dazu die Groesse: 3.1rem x 4.2rem -> **4.6rem x 5.8rem**, also Handkartenmass.
Dieselbe Sorte Ding in zwei Groessen war schon vorher schief, und ein Motiv
haette in der kleinen ohnehin nichts sagen koennen. Die Stapelzahl sass mitten
auf der obersten Karte und steht jetzt **darunter**, auf derselben Hoehe wie
die Vorratszahlen unter den Bauteilen; die Aufschrift („Karte kaufen" /
„Stapel leer") steht darunter. Kaufbar heisst jetzt: der Ring am Siegel wird
kraeftig - die Auskunft sitzt im Motiv, weil es den Rahmen nicht mehr gibt, der
sie vorher trug.

### Zwei Bewegungen, und beide sind ein Griff

Designregel 5 sagt: Bewegung erklaert einen Zustandswechsel oder entfaellt. Das
hier ist der Grenzfall, den sie nicht nennt - eine Bewegung, die keinen Wechsel
erklaert, sondern eine **Moeglichkeit**:

- Das Bauteil hebt sich beim Darueberfahren und wird groesser, sein Schatten
  laenger und weicher. Ohne den wachsenden Schatten liest sich die Hebung als
  Verschiebung.
- Die oberste Karte des Stapels hebt sich und kippt leicht - die Bewegung, mit
  der man eine Karte von einem Stapel nimmt, also genau das, was der Klick tut.
  Die Ruecken darunter bleiben liegen, sonst huepft der ganze Stapel.

Beide haengen an `:hover` **und** `:focus-visible`: eine Ruckmeldung, die nur
die Maus bekommt, ist eine halbe.

Bei `prefers-reduced-motion` faellt die Verschiebung ganz weg statt schneller
zu werden. **Der globale Block ganz oben kuerzt nur die Dauer** - ein Sprung um
0.22rem in 0.01ms ist immer noch ein Sprung, und zwar ein besonders
unangenehmer. Uebrig bleiben der laengere Schatten und der Lichtfleck; beide
stehen ohnehin still.

### Lehren

- **Ein Verbot im Kommentar kann richtig begruendet und trotzdem zu weit
  gefasst sein.** „Kein Motiv, weil der Inhalt geheim ist" hat auch das Motiv
  verboten, das gar nicht vom Inhalt redet. Wer eine Regel aufschreibt, schreibt
  dazu, _worauf_ sie zielt - sonst gilt sie spaeter fuer den Nachbarfall mit.
- **Wer einen Rahmen wegnimmt, nimmt auch alles weg, was am Rahmen hing.** Die
  Auswahlmarkierung war eine Fuellung, der Bereit-Zustand ein Rand. Beides
  musste neu erfunden werden, und zwar im Ding selbst.
- **`prefers-reduced-motion` kuerzt nur, was man ihm nennt** - schon wieder.
  Beim Hauptmenue war es die Verzoegerung, hier ist es der Zielwert einer
  Transition.

### Der Browser-Durchlauf (statische Vorschau)

Diesmal **vor** der Abgabe, und nicht am Spiel, sondern an einer nachgebauten
Seite mit denselben Regeln - der Kaufstapel und die Bauleiste haengen sonst an
einer laufenden Partie.

- Die **Sitzfarben auf der See** tragen: Rot und Blau stehen als 2.5rem grosse
  Silhouette klar auf `--sea-900`, der `drop-shadow` trennt zusaetzlich. Der
  befuerchtete Grenzfall Blau `#2c6fbb` ist keiner.
- Das **Sechseckgitter war bei 4.6rem zu fein** - bei 74 px Kartenbreite und
  0.45 Einheiten Strichbreite auf 14 % Deckkraft blieb ein Grauschleier ohne
  Form. Kachel von 9.2x8 auf 12x12, Sechseck-Radius 1.8 -> 2.6, Strich 0.45 ->
  0.55, Deckkraft 0.14 -> 0.2. Jetzt liest man die Form.
- Das **Siegel war zu klein**, um in echter Groesse etwas zu sagen: Scheibe
  9.6 -> 11.5, Sechseck darin 5.2 -> 6.9 mit Strich 1 -> 1.4, Perforation
  12.4 -> 14.
- Die **zwei Fassungslinien** lagen 1.8 Einheiten auseinander, also 2.9 px, und
  verschmolzen zu einer dicken Kante. Die innere von 5.2 auf 6.4 nach innen.

**Und die Messung selbst ging fast schief.** Zum Vergroessern hatte ich per
JavaScript den Rest der Seite geloescht - und damit das `<defs>` mit Muster und
Verlauf, die in einem _anderen_ SVG standen. Das Gitter war danach nicht
schwach, sondern **weg**, und der Befund „traegt nicht" waere ein Befund ueber
meinen eigenen Eingriff gewesen. Erst ein Nebeneinander alt/neu in einer Datei,
jedes SVG mit eigenen Defs, hat die Frage beantwortet.

### Offene Punkte

- **Im Spiel selbst noch nicht gesehen.** Die Vorschau war ein Nachbau; offen
  bleiben die Zeilenhoehe der Ablage mit dem groesseren Stapel und wie sich das
  Ganze neben Brett und Handkarten macht.
- Die **eigenen** Entwicklungskarten (`.devcard`) sind jetzt die letzten
  Pergament-Chips in der Ablage: kleine Knoepfe mit Name und Zahl neben einer
  grossen gezeichneten Bank. Entweder werden sie auch Karten - dann brauchen
  sie fuenf Vorderseiten - oder sie bleiben bewusst eine Liste. Offen.

## Duennere Strassen, groessere Haeuser, die Zugknoepfe nach unten links (2026-08-19, `main`)

Drei Befunde vom Menschen am Bildschirm, alle aus derselben Beobachtung: das
Brett ist der Held, aber auf ihm gewinnt die Tinte gegen die Spielerfarbe, und
die Bedienung, die man in jedem Zug braucht, liegt am weitesten weg von dem,
worauf man dabei sieht.

### Abnahme

| Prüfung             | Ergebnis                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                         |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 298 / 33       |
| `pnpm build`        | grün — `index.js` 406.97 kB (gzip 120.98), `index.css` 34.11 kB (7.65) |
| `pnpm format:check` | grün (dabei fiel eine alte Kursiv-Schreibweise in PROGRESS.md an)      |
| Browser             | lokale Partie, Gründung durchgespielt, 6 Siedlungen und 6 Strassen     |

### Die Strasse war ein schwarzer Balken mit farbigem Kern

Gerechnet, nicht geschaetzt: ein Balken von 0.16 lag in einer Kontur von 0.24.
Das sind **0.04 Tinte auf jeder Seite**, also je Rand ein Viertel der
Strassenbreite - quer ueber die drei Streifen gemessen war mehr Rand als
Strasse. Die Spielerfarbe, an der man die Strasse ueberhaupt erkennen soll, war
der kleinste Anteil an ihrer eigenen Zeichnung.

Jetzt 0.115 in 0.15, also 0.0175 je Seite, und die Kontur steht auf 72 %
Deckkraft statt voll. Eine Haarlinie, die die Form haelt, statt einer Fassung,
die sie traegt. Was die Kontur einmal geloest hat - Strassen an der Kueste
verschwanden auf der dunklen See -, loest sie in dieser Breite unveraendert:
sie muss die Farbe **abgrenzen**, nicht einrahmen.

**Die Trefferflaeche bleibt, wo sie war.** `.road` traegt weiter 0.14; nur die
gebaute Strasse ist schmaler geworden. Eine freie Kante ist zum Anklicken da,
und die soll nicht mitschrumpfen, weil das Ergebnis duenner aussehen soll. Die
gestrichelte Vorschau (`.road--target`) liegt bei 0.125 - sie zeigt jetzt die
Breite, die daraus wird, und nicht mehr eine breitere.

### Die Haeuser waren kleiner als der Zahlenchip

Auch das faellt erst auf, wenn man es nebeneinander legt: die Siedlung stand mit
`scale(0.023)` auf 0.28 Brettbreite, der Zahlenchip in der Feldmitte hat 0.34
Radius, also 0.68 Durchmesser. Das **Bauwerk** war weniger als halb so gross wie
die Zahl auf dem Feld daneben - und ein Bauwerk ist das, was man auf einem
Brett zaehlt.

Jetzt 0.027 (Siedlung) und 0.0245 (Stadt): 0.32 und 0.44 breit. Die Stadt
bekommt bewusst den kleineren Faktor, weil ihr Pfad breiter ist (18 Einheiten
gegen 12) - der Unterschied zwischen beiden soll die **Form** tragen (Haus mit
Anbau), nicht die Groesse, das steht seit dem Playtest so in `board/shapes.ts`.

Dazu die Kontur von 1.4 auf 1.15 im Pfadraum. Sie skaliert mit dem Bauwerk mit,
und 1.4 waeren bei `scale(0.027)` von 0.032 auf 0.038 gewachsen: das Haus haette
seinen Rand mitwachsen lassen und waere **schwaerzer** geworden statt groesser.
1.15 × 0.027 sind wieder 0.031 - dieselbe Haarlinie an einem groesseren Haus.

### „Handel" und „Zug beenden" liegen jetzt unter den Handkarten

Sie sassen am rechten Ende der Bedienleiste, in der Reihenfolge eines Zuges:
werfen, bauen, handeln, beenden. Die Reihenfolge stimmt - die **Haeufigkeit**
nicht. „Zug beenden" ist der Knopf, den man in jedem einzelnen Zug drueckt, und
er lag diagonal gegenueber der Hand, auf die man beim Ueberlegen sieht. Genau
der Befund, aus dem der Status schon zweimal umgezogen ist.

Neu als eigene Komponente `panels/TurnPanel.tsx` und nicht als Rest von
`ActionPanel`: die Leiste dort ist eine Zeile in der Ablage, dieser Block eine
Spalte darunter - zwei Orte, also zwei Bausteine. Die linke Spalte ist damit ein
Stapel aus drei Lagen: Handkarten, Entwicklungskarten, Zugknoepfe.

**Was es kostet, und zwar gemessen.** Im Browser bei 1568×744: die Ablage waechst
von 190 auf 233 px, das Brett schrumpft von 518 auf 475 px Hoehe - **43 px, also
8,3 %**. Das Brett ist auf einem breiten Fenster immer hoehen- und nie
breitenbegrenzt, deshalb ist jede Zeile in der Ablage direkt Bretthoehe. Der
Preis ist bewusst bezahlt: die Ecke unten links trifft man mit der Maus ohne zu
zielen, und der Weg vom Ueberlegen zum Beenden ist ein Blick nach unten statt
einer Diagonale. Wer die 43 px zurueckwill, holt sie an der Kartengroesse
(4.6rem) und nicht an den Knoepfen.

### Der Browser-Durchlauf

Diesmal am laufenden Spiel und nicht an einem Nachbau: lokale Partie mit drei
Sitzen, Gruendung durchgespielt (6 Siedlungen, 6 Strassen), dann alt gegen neu
verglichen, indem die alten Werte als Stilblock nachtraeglich ueber die neuen
gelegt wurden. Der Unterschied ist im Nebeneinander deutlich und nicht
uebersteuert: die Strassen lesen sich weiter als Balken in Spielerfarbe, nicht
als Striche.

Nebenbefund, kein Fehler: in der Gruendung leuchtet das Brett erst, nachdem man
„Siedlung" bzw. „Strasse" gedrueckt hat. Das ist seit dem zweiten Playtest-Durchgang
Absicht (`buildKindOf` nennt die Gruendungszuege) - die Gruendung ist der Moment,
in dem man die Bedienung lernt.

### Offene Punkte

- **Der schwarze Rand der Felder** (`.hex`, 0.024 volle Tinte) ist unangetastet.
  Gemeint war die Fassung der Strassen; falls das Gitter selbst zu praesent
  wirkt, ist es dieselbe Sorte Aenderung und eine Zeile.
- Die zwei Viewport-Breakpoints (`26rem`, `62rem`) sind weiterhin ungesehen -
  und die linke Spalte ist mit den Knoepfen darunter hoeher geworden.

## Zwei Rahmen, die niemand bestellt hat, und zwei Leinen statt einer Gabel (2026-08-19, `main`)

Drei Befunde vom Menschen am Bildschirm, zwei davon derselbe Satz: „die Rahmen
sind noch da und sollen weg". Einer davon war ein Fehler und kein Geschmack.

### Abnahme

| Prüfung             | Ergebnis                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                         |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 298 / 33       |
| `pnpm build`        | grün — `index.js` 407.36 kB (gzip 121.14), `index.css` 33.69 kB (7.58) |
| `pnpm format:check` | grün                                                                   |
| Browser             | lokale Partie, Gründung durchgespielt, ein Wurf, Hafen im Nahbild      |

### Der Rahmen um die Handkarte war ein zweites `.card`

Der Kasten um jede Handkarte stand nirgends im Kartenblatt - er kam aus dem
Diagnoseblock **aus Etappe 0**. Dort lag ein zweites `.card`: Pergamentkasten
mit `padding: 1rem`, Rand und Fläche, für eine Seite, die es seit Etappe 3 nicht
mehr gibt. Es stand **weiter unten** im Blatt als die Handkarte und hat sie
damit geschlagen — dieselbe Falle wie bei den heißen Zahlenchips, nur diesmal
andersherum: nicht eine Regel, die nie gegriffen hat, sondern eine, die gegriffen
hat, ohne dass sie jemand gemeint hätte.

Im Browser gemessen, was das gekostet hat: von den 74 px, die `width: 4.6rem`
ergibt, blieben der Karte selbst **40** — der Rest ging an einen Innenabstand,
den niemand für sie geschrieben hat. Die Ablage war dadurch 46 px höher und das
Brett genau so viel niedriger (642 statt 688 px bei 1920×911). Ein toter
CSS-Block hat also fast genau so viel Bretthöhe gekostet, wie der Umzug der
Zugknöpfe einen Commit vorher **bewusst** gekostet hat (43 px). Nur stand das
nirgends.

Gelöscht wurde der tote Block, nicht die Handkarte umbenannt: `.card__title`
gehörte dazu und wurde ebenfalls von niemandem mehr benutzt (`ConnectionPanel`
verwendet `.status`, `.metrics`, `.hint`, `.error`). Über der Handkarte steht
jetzt, warum der Name einmal doppelt vergeben war.

### Die Würfelschale ist weg, die Würfel bleiben

`.dice--waiting` war eine Pergamentplatte mit Rand und Kontaktschatten — also
derselbe Körper, den die Bauteile und der Kaufstapel in den zwei Commits davor
verloren haben, und aus demselben Grund: **ein Würfel ist selbst das Ding.** Er
hat eine helle Fläche, eine Kante und einen Schatten; eine zweite helle Fläche
darunter macht daraus ein Bedienelement mit einem Bild darin.

Was „du darfst werfen" jetzt trägt: das Atmen der Würfel, das Wort „Würfeln"
darunter und der Zeiger. Das Wort ist der Träger, der ohne Bewegung auskommt —
bei `prefers-reduced-motion` steht das Atmen still, und dann darf die Auskunft
nicht mit ihm verschwinden.

**Die zwei `--ink`-Zeilen mussten mit.** Sie stellten die Tinte auf dunkel, weil
darunter Pergament lag. Ohne Pergament liegt die Wurfzahl auf der Tiefsee, und
dunkle Tinte wäre dort dieselbe unsichtbare Schrift, die beim Tisch schon einmal
die Würfelaugen verschluckt hat — nur andersherum. Im Browser nachgemessen:
`.dice__total` steht jetzt auf `rgb(233 225 207)`.

### Vom Hafen führen zwei Leinen an Land, keine Gabel

Die Stege liefen als gerade Linien von der **Mitte** der Marke zu den zwei
Knoten. Zwei gerade Linien von einem Punkt zu zwei Ecken sind eine Gabel; sie
zeigt richtig auf beide Knoten und sieht dabei nach nichts aus.

Jetzt ein `path` statt einer `line`: er fängt knapp **innerhalb** der Marke an
(0.20 statt 0), damit unter dem Kreis kein Knick entsteht, und läuft in einem
Bogen zum Knoten. Der Kontrollpunkt liegt in der Mitte der Strecke, um 0.055 von
der Kantenmitte weggeschoben — dadurch biegen sich beide Leinen **nach außen**
und spiegelbildlich, ohne dass irgendwo ein Vorzeichen von der Lage des Hafens
auf dem Brett abhinge. Dazu 0.04 statt 0.045 Strichbreite.

Der Bogen unterscheidet sie zugleich von allem anderen auf dem Brett: Straßen
sind immer gerade. Und `fill: none` gehört dazu, sobald aus einer Linie ein Pfad
wird - sonst füllt er die Fläche zwischen Sehne und Bogen aus.

### Lehre

**Ein Klassenname ist ein globaler Bezeichner, und CSS sagt nichts, wenn er
doppelt vergeben ist.** Beide Blöcke waren für sich richtig, keiner war ein
Tippfehler, und die Kaskade hat entschieden, wer gewinnt: der weiter unten. Wer
eine Klasse anlegt, sucht sie einmal im Blatt — und wer einen Bildschirm
abschafft, nimmt seine Regeln mit.

### Offene Punkte

- Weiterhin ungesehen: die zwei Viewport-Breakpoints (`26rem`, `62rem`).
- Der schwarze Rand der Felder (`.hex`) ist nach wie vor unangetastet.

## Das Brett bekommt die Fläche: Ablage in zwei Ecken (2026-08-19, `main`)

Auftrag vom Menschen am Bildschirm: Überlappungen und überflüssige Auskünfte
weg, und einmal genau hinsehen, wie das Brett steht und wie groß es ist. Dazu
wurde eine lokale Partie im Browser gespielt und **gemessen**, statt geschätzt.

### Abnahme

| Prüfung             | Ergebnis                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                            |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 298 / 33          |
| `pnpm build`        | grün — `index.js` 407.35 kB (gzip 121.14), `index.css` 34.01 kB (7.67)    |
| `pnpm format:check` | grün                                                                      |
| Browser             | lokale Partie bei 1920×889, dazu 1280×800, 1024×700 und 900×950 im Rahmen |

### Der Befund: das Brett hatte ein Drittel der Breite und drei Viertel der Höhe

Gemessen bei 1920×889, gezeichnete Brettfläche (Felder plus Häfen, nicht das
SVG-Element): **640 × 640 px.** Daneben lagen links und rechts je rund 640 px
leere See, und darunter eine Ablage von 187 px, deren Mitte über gut 1200 px
vollständig leer war. Das Brett ist mit `xMidYMid meet` auf jedem breiten
Fenster höhen- und nie breitenbegrenzt — jede Zeile unter ihm geht ihm also
direkt von der Größe ab, während der Platz daneben ungenutzt bleibt.

### Die Ablage liegt jetzt in den zwei unteren Ecken

`.game` ist eine Lage statt zweier Rasterzeilen; die Ablage liegt als
Überlagerung darüber, links die Karten mit „Handel" und „Zug beenden", rechts
Status, Kaufstapel, Würfel und Bauteile. Das Brett läuft über die volle Höhe.

**Dass sich beide nie überdecken können, ist keine Sichtprüfung, sondern eine
Rechnung.** Ein Wert trägt sie:

```
--tray-strip: max(14.75rem, (100vw - 1.5rem - 1.09 × (100vh - 1.5rem)) / 2)
```

Er ist zugleich der seitliche Einzug von `.board-area` **und** die Höchstbreite
einer Ecke. Damit beginnt die Brettfläche genau dort, wo eine Ecke endet, und
das Brett steht als `meet`-Einpassung immer mittig darin — es kann die Ecke also
nicht erreichen. Der zweite Teil ist `max(...)`: wird der Streifen schmaler als
der alte feste Einzug von 14.75rem, gilt wieder dieser, das Brett wird
breitenbegrenzt und ist so groß wie vorher. **Das Brett wird an keiner
Fenstergröße kleiner als vorher** — nachgemessen, indem die alten Regeln in der
laufenden Partie wieder darübergelegt wurden:

| Fenster  | vorher | nachher | Gewinn |
| -------- | ------ | ------- | ------ |
| 1920×889 | 640 px | 826 px  | +29 %  |
| 1280×800 | 555 px | 698 px  | +26 %  |
| 1024×700 | 459 px | 470 px  | +2 %   |
| 900×950  | 358 px | 358 px  | ±0     |

1.09 ist das Seitenverhältnis der `viewBox` (9.76 / 9.1 = 1.0725) plus Luft. Es
steht als Zahl im Blatt, weil CSS `viewBoxOf` nicht fragen kann; ein zu kleiner
Wert kostet nur Ecke, nie Brett.

Was in einer schmalen Ecke nicht mehr in die Breite passt, bricht um und wächst
**nach oben** — dort ist Platz, unter dem Brett nicht. Bei 1280×800 stapeln sich
Kaufstapel, Würfel und Bauteile deshalb zu einer 321 px hohen Ecke, und das
Brett bleibt unangetastet.

### Zwei Auskünfte, die niemand brauchte

**Die eigene Zeile am Tisch stand als `L2 H0 W0 K0 E1`** — fünf
Anfangsbuchstaben mit Zahlen, an genau der Stelle, an der bei allen anderen „3
Karten" steht. Zweierlei war daran falsch: dieselbe Auskunft liegt unten links
als Kartenstapel, in Farbe und mit Motiv, und in dieser Form konnte sie niemand
lesen, ohne den Code zu kennen. Der Tisch beantwortet die Frage, die man über
**andere** stellt — wie viel hat er —, und die beantwortet er jetzt für alle
gleich.

**Der Name unter jeder Handkarte ist weg**, dieselbe Entscheidung wie beim
Vorrat: er beschriftete ein Bild, das schon spricht (Geländefarbe plus Motiv),
und kostete unter jeder Karte eine Zeile. Für Vorlesewerkzeuge steht er weiter
da, zusammen mit der Menge; sichtbar bleibt er im `title`.

### Überlappungen

Bei 1920×889 wurden **alle** sichtbaren Elemente des Spielbildschirms paarweise
auf Schnittflächen geprüft (99 Stück, ohne SVG-Innenleben). Übrig blieben nur
gewollte: die Stapeltiefe hinter einer Karte und die Plakette auf ihrer Ecke.
Die eine echte Kollision lag zwischen Verlaufs-Panel und Brett — sie ist mit der
Ecken-Ablage weg, weil das Brett den oberen Rand nicht mehr braucht.

### Offene Punkte

- Der Verlauf legt sich beim Öffnen weiterhin über die See am rechten Rand; bei
  einem sehr flachen Fenster reicht er ins Brett. Er ist ein Schalter, den man
  wieder zumacht — beobachten.
- Die zwei Viewport-Breakpoints (`26rem`, `62rem`) sind weiterhin ungesehen.
- Der schwarze Rand der Felder (`.hex`) ist nach wie vor unangetastet.

## Der Status nach oben, die Würfel in die Ecke — und die erste Musik (2026-08-19, `main`)

Stand: nach `b467aab`. Zwei Umzüge auf dem Spielbildschirm und eine mp3, die zum
ersten Mal im Image liegt.

### Abnahme

| Prüfung             | Ergebnis                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                         |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 303 / 33       |
| `pnpm build`        | grün — `index.js` 407.88 kB (gzip 121.28), `index.css` 34.04 kB (7.69) |
| `pnpm format:check` | grün                                                                   |
| Browser             | **nicht gelaufen** — die Chrome-Erweiterung war nicht verbunden        |

Die fünf Tests mehr im Client: drei zur Musik (`audio/useAudio.test.tsx`), zwei
zu den Plätzen im Baum (`screens/GameScreen.test.tsx`).

### Der Status stand zwischen Dingen, nach denen man greift

Er ist einen Tag zuvor ans Ende der rechten Ablage gewandert, und dort saß er
falsch — nicht zu weit weg, sondern in der falschen Sorte Fläche. Die rechte
Ecke ist die Reihe, die die Maus abfährt: Kaufstapel, Bauteile, Würfel. Ein Satz
darin ist kein Ding, sondern eine Unterbrechung, und er verschiebt beim
Zugwechsel auch noch die Höhe der Ecke, weil er mal eine und mal zwei Zeilen
braucht.

Jetzt steht er **oben rechts, links neben der Verlaufstür**. Das ist kein
Ausweichen auf freie Fläche, sondern eine Gruppe: Status und Verlauf sagen
beide, wie die Partie steht — das eine ständig und beiläufig, das andere selten
und dann genau. Ein Ort für „was ist gerade", einer für „was liegt auf dem
Tisch". Der Statussatz ist rechtsbündig gesetzt, weil er mitwächst („Spieler 2
ist am Zug" gegen „Gründung: Spieler 3 setzt eine Siedlung"); links ausgerichtet
wanderte sein Ende bei jedem Zugwechsel und mit ihm der Abstand zum Knopf.

Beides hängt in einem neuen `.topline`, und der trägt dieselbe
`pointer-events`-Regelung wie `.tray`: die Zeile liegt über dem Brett, der
Status ist Schrift ohne Körper, also fängt sie nichts, und der Verlaufsknopf
holt sich das Fangen einzeln zurück. Ohne das läge ein unsichtbarer Kasten über
den oberen Feldern.

**Was dabei wegfiel:** `.log-corner` war bis hierher selbst am Bildschirmrand
festgenagelt (`position: fixed` plus `top`/`right`) und ist jetzt das letzte
Glied der Zeile. Der Ort ist derselbe geblieben — die Zeile endet dort, wo die
Ecke endete —, aber der Abstand zum Nachbarn kommt aus einem `gap` statt aus
einer zweiten festen Zahl.

### Die Würfel lagen mitten in der Reihe

Sie standen als erste Zeile in der Bauleiste, weil ein Zug mit ihnen anfängt.
Nur ist die Reihenfolge im Ablauf nicht die Reihenfolge auf dem Tisch: nach dem
Umbau der Ablage in zwei Ecken saßen sie zwischen Kaufstapel und Bauteilen, also
an der Stelle einer Reihe, die man am schlechtesten trifft — mit Nachbarn auf
beiden Seiten.

Jetzt liegen sie **ganz außen, in der Bildschirmecke selbst**. Eine
Bildschirmecke ist das einzige Ziel, das eine Maus ohne Zielen erreicht: man
fährt hin, bis es nicht weiter geht. Genau das verdient der eine Knopf, mit dem
jeder einzelne Zug anfängt. Es ist dieselbe Überlegung, die „Zug beenden" nach
unten links gebracht hat — der Anfang eines Zuges und sein Ende liegen jetzt in
je einer Ecke, und dazwischen liegt das Material.

**Der Umzug ist ein Umzug im Baum, keine `order`-Regel.** Die Würfel hängen
jetzt als eigenes Stück im `GameScreen` neben dem `ActionPanel` statt darin. Mit
`order` in CSS wäre die Reihenfolge am Bildschirm eine andere als die im
Dokument — und damit eine andere für Tastatur und Vorlesewerkzeug als für die
Maus. Das ist die Art Trick, die genau einmal gutgeht.

**Daraus folgt eine Vereinfachung, die niemand geplant hat:** das `ActionPanel`
brauchte die `GameView` nur für die Augen und den Wurf. Ohne die Würfel bekommt
es sie nicht mehr, und `onRoll` auch nicht — es stellt jetzt die Bauteile und
die Absage des Servers, und was es dafür braucht, steht in der Klickkarte und im
eigenen Vorrat. Ebenso weggefallen: `.tray__side`, die zweite Hülle um die
rechte Ecke. Es gab sie nur, um den Statussatz auf eine eigene Zeile darüber zu
heben. Eine Ecke, ein Element.

### Die Musik ist die eine Ausnahme von „kein Audio-Byte im Image"

Beim Ton war die Zusage eindeutig: 23 Klänge als Rezepte aus Zahlen,
`samples.ts` führt sie als auskommentierte Einkaufsliste, und im Image liegt
kein Byte Audio. Das gilt weiter — für **Effekte**. Ein Klick, ein Würfel, ein
Handschlag lassen sich aus Hüllkurven bauen, und ein Rezept wiegt nichts. Ein
Stück Musik lässt sich das nicht: synthetisiert wäre es eine Tonfolge und kein
Stück.

Deshalb liegt jetzt eine Datei da (`public/music/catan.mp3`, 2,22 MB) und
kostet, was sie kostet. Das ist die bewusste Abweichung von der Zusage, und sie
steht hier, damit sie beim nächsten Lesen kein Versehen ist. `samples.ts` bleibt
leer.

**Ein `<audio>`-Element und kein dekodierter Puffer.** Die Datei ist Minuten
lang; über `decodeAudioData` läge sie als PCM im Speicher, also ein Vielfaches
ihrer zwei Megabyte, und die Schleife müsste man selbst bauen. Das Element
streamt und bekommt `loop` geschenkt. Über `createMediaElementSource` hängt es
trotzdem am **selben Musik-Bus**, der seit dem Ton fertig dasteht — damit gilt
für die Spur derselbe Regler wie für alles andere, ohne eine zweite
Lautstärkerechnung daneben. Der Kommentar an `ensure()`, der das vorausgesagt
hat, stimmte: an dieser Stelle hat sich nichts geändert.

**Sie fängt bei der ersten Geste an, nicht beim Laden** — aus demselben Grund,
aus dem der `AudioContext` erst beim ersten Klang entsteht. Der Anlauf hängt an
`pointerdown` **und** `keydown`: wer mit der Tastatur spielt, hat sonst nie eine
erste Geste. Und die Listener melden sich **nicht** nach dem ersten Mal ab. Das
ist die eigentliche Entscheidung dahinter: `playMusic` tut bei laufender Spur
nichts, und ein Anlauf, den der Browser abgelehnt hat, bekommt so bei der
nächsten Geste einen zweiten. Ein `once: true` hätte genau diesen Fall
verspielt — und man hätte ihm nicht angesehen, dass er fehlt.

**Stumm heißt still, der Regler auf null heißt leise.** Das sind zwei
verschiedene Absichten: wer den Regler herunterzieht, will das Stück leiser, und
wenn er ihn wieder aufdreht, soll es dort weiterlaufen, wo es inzwischen steht.
Wer stummschaltet, will es weg — dann soll es auch keine Leitung und keinen Takt
kosten, also wird pausiert. Angehalten wird allerdings **nach** der Blende, mit
120 ms Verzug: `pause()` mitten in der Gain-Rampe schneidet die Welle ab, wo sie
gerade steht, und das hört man als Knacks. 120 ms sind rund das Sechsfache der
Zeitkonstante der Rampe, also praktisch Stille.

Jeder Ausfall ist still und keiner ist laut: kein `Audio` im Fenster, kein
`MediaElementSource`, eine abgelehnte Wiedergabe — in allen drei Fällen bleibt
es bei der Stille, und die Effekte klingen weiter. Dieselbe Zusage wie bei den
Samples. Der Satz „Musik gibt es noch nicht — der Regler wartet auf sie" ist aus
dem Einstellungen-Dialog verschwunden; er wartet nicht mehr.

### Was jsdom prüfen kann und was nicht

Zwei neue Tests im `GameScreen` prüfen die **Ordnung im Baum** und ausdrücklich
nicht das Aussehen: der Status liegt im `.topline` und **vor** der Verlaufstür,
die Würfel sind das letzte Kind von `.tray__controls` und haben die Bauteile
links neben sich. jsdom hat keine Layout-Engine — wie breit etwas ist und ob
sich zwei Dinge überdecken, kann hier niemand messen, das bleibt dem
Browser-Durchlauf. Aber beide Umzüge sind mit einer verrutschten CSS-Regel
wieder da, wo sie waren; mit einer verrutschten Klammer nicht, und genau das
fangen die Tests.

Drei Tests zur Musik in `audio/useAudio.test.tsx`: vor der ersten Geste nichts,
nach einem Klick der Anlauf, nach einem Tastendruck ebenso. Dass dabei zwei
Gesten zwei Anläufe erzeugen, steht als Zusage im Test — ob daraus zwei Spuren
werden, entscheidet die Engine und nicht der Haken.

### Offene Punkte

- **Der Browser-Durchlauf fehlt wieder**, diesmal nicht aus Nachlässigkeit,
  sondern weil die Chrome-Erweiterung nicht verbunden war. Ungesehen sind damit:
  ob die Musik im Browser tatsächlich anspringt, ob der Status oben rechts bei
  einem langen Phasensatz mit dem Brett ins Gehege kommt, und ob die Würfel in
  der Ecke bei schmalem Fenster noch neben statt unter dem Brett liegen.
- Der Statussatz hat `max-width: min(22rem, 34vw)`. Die Zahl ist gesetzt und
  nicht gemessen — sie soll den Satz zweizeilig halten, geprüft ist das nicht.
- Die 2,22 MB im Image sind nicht gemessen: was sie für den ersten Aufruf über
  eine langsame Leitung heißen, weiß niemand. Die Spur lädt erst nach der ersten
  Geste, blockt also nichts — aber sie teilt sich die Leitung mit allem anderen.
- Die zwei Viewport-Breakpoints (`26rem`, `62rem`) sind weiterhin ungesehen.
- Der schwarze Rand der Felder (`.hex`) ist nach wie vor unangetastet.

### Nächste Etappe

Etappe 10 (Erweiterungen) — davor steht weiter der Browser-Durchlauf über den
ganzen Spielbildschirm, jetzt mit zwei Umzügen und einer Tonspur mehr darin.

## Die Entwicklungskarten werden Karten (2026-08-19, `main`)

Stand: nach `9b51b83`. Fünf gezeichnete Motive, ein Kartenkörper statt eines
Textknöpfchens, und ein Knopf weniger, der nie angeht.

### Abnahme

| Prüfung             | Ergebnis                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                         |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 306 / 33       |
| `pnpm build`        | grün — `index.js` 410.11 kB (gzip 121.91), `index.css` 34.42 kB (7.75) |
| `pnpm format:check` | grün                                                                   |
| Browser             | **nicht gelaufen** — die Chrome-Erweiterung war weiter nicht verbunden |

Statt des Durchlaufs ein Musterbogen als eigene Seite: die fünf Karten in
Originalgröße neben einer Handkarte, die Motive einzeln auf 4,6 rem vergrößert,
dazu die drei Zustände. Er ist ein **Abzug** und keine zweite Quelle — die Pfade
darin sind aus `DevelopmentGlyph.tsx` kopiert und veralten, sobald dort jemand
etwas ändert.

### Der beste Platz für ein Motiv ist eine Karte

Die Frage war, wo die Grafiken hingehören. Die Antwort steckte im Befund: es gab
gar keinen Platz für eine. Die Entwicklungskarten waren das einzige Kartending
am Tisch **ohne Kartenkörper** — ein Knopf mit `padding: 0.3rem 0.5rem` und
0,72 rem Schrift, direkt neben Handkarten von 4,6 × 5,8 rem und einem
Kaufstapel derselben Größe. Ein Motiv hätte dort nirgends hingepasst.

Das ist derselbe Befund, aus dem der Kaufstapel im August seine heutige Größe
bekommen hat — „eine Karte ist eine Karte, und 3.1rem neben 4.6rem hat aus der
Bank ein Beiwerk gemacht" —, nur schärfer: eine Beschriftung neben einer Karte
ist nicht ein kleineres Ding, sondern gar keins. Also bekommt jede
Entwicklungskarte denselben Körper: 4,6 × 5,8 rem, dieselbe Stapeltiefe
(gedeckelt bei vier), dieselbe Plakette (`.card__count`, wiederverwendet — es
gibt genau eine Plakette in diesem Spiel), derselbe Kontaktschatten.

**Pergament statt Geländefarbe** bleibt der Unterschied und ist der ganze
Unterschied: Rohstoffe kommen vom Brett, Entwicklungskarten von der Bank. Woher
etwas stammt, liest man am Material.

**Am Bildschirm bleiben sie, wo sie waren** — zweite Reihe in der linken unteren
Ecke, zwischen Hand und Zugknöpfen. Die eigenen Karten liegen bei den eigenen
Karten; die Bank liegt gegenüber. Der Preis steht unter „Offene Punkte": die
Ecke wird höher.

### Der Name bleibt stehen, obwohl er unter den Handkarten weggefallen ist

Unter den Rohstoffkarten ist er im August verschwunden, weil er ein Bild
beschriftete, das schon spricht: Geländefarbe **und** Motiv tragen dort dieselbe
Aussage doppelt. Hier tragen sie das nicht — alle fünf Karten sind dasselbe
Pergament, das Motiv wäre der einzige Träger. Farbe oder Form allein dürfen nie
allein tragen (Designregel 7), also steht der Name auf der Karte. Er steht
**auf** ihr und nicht darunter: unter der Karte kostete er in jeder Reihe eine
Zeile, die dem Brett abgeht, und auf einer Spielkarte steht ohnehin, was sie
ist.

### Fünf Motive, eine Handschrift

Sie liegen in `panels/DevelopmentGlyph.tsx`, direkt neben `ResourceGlyph.tsx`,
und halten sich an dieselben Regeln: 24 × 24 als Quadrat, einfarbig dunkel
gefüllt, gleiche Kantenrundung. Wer beide Reihen übereinander sieht, soll zwei
Sorten Karten erkennen und **einen** Zeichner.

**Gezeigt wird die Wirkung, nicht der Name** (Designregel 8). „Erfindung" heißt
die Karte, aber was sie tut, sind zwei Rohstoffe aus der Bank — also liegen dort
zwei Karten und keine Glühbirne.

- **Ritter** — ein geschlossener Helm. Sehschlitz, Nasensteg und zwei Luftlöcher
  sind **Löcher im selben Pfad** (`fill-rule: evenodd`) und keine hellen Striche
  darüber. Ein aufgemalter Schlitz stimmte nur auf einer Kartenfarbe; ein Loch
  auf jeder.
- **Straßenbau** — zwei Straßen. Derselbe Balken mit runden Enden, den eine
  gebaute Straße auf dem Brett ist; wer die Karte spielt, sucht danach gleich
  eine Kante. Sie berühren sich nicht, sonst wären sie ein Balken.
- **Erfindung** — zwei Karten. Eine Karte ist in diesem Spiel die Form, in der
  ein Rohstoff vorkommt, also zwei davon für zwei Rohstoffe, in der Sprache, die
  der Tisch schon spricht. Sie überlappen **nicht**: zwei gleich gefüllte
  Formen, die sich schneiden, sind eine Form.
- **Monopol** — ein Sack mit zugebundenem Hals. Kein Pfeildiagramm; die
  Nachbarn im Blatt sind Ziegel, Baum und Schaf, also Dinge. Der Sack ist die
  dingliche Fassung von „alle geben dir ab".
- **Siegpunkt** — eine Krone. Die einzige Karte ohne Handlung, also ein Zeichen
  für den Ausgang und keines für ein Werkzeug.

### Ein Knopf, der nie angeht, ist keiner

Der Siegpunkt wird **nie** gespielt. Als Knopf wäre er in jeder Lage gesperrt,
und ein Bedienelement, das in keinem Zustand jemals bedienbar wird, sagt „gerade
nicht" über etwas, das nie geht. Blass daliegend sähe der eigene Punkt außerdem
aus wie ein Fehler — dabei ist er das Beste, was auf der Hand liegen kann.

Er ist deshalb ein `div` und kein `button`, in voller Deckkraft und ohne Ring:
Besitz statt Handlung. Das ist dieselbe Unterscheidung, die der Tisch schon
zwischen Dingen und Auskünften macht, nur eine Ebene tiefer — hier zwischen
Material, das man anfasst, und Material, das man nur hat.

### Offene Punkte

- **Niemand hat die Zeichnungen gesehen.** Sie sind aus Koordinaten gebaut und
  im Kopf geprüft, nicht am Bildschirm. Die drei wackligsten: der **Sack**
  (könnte als Wolke lesen — Alternative wären drei zusammenlaufende Pfeile), die
  **zwei Karten** bei 2,4 rem (könnten als zwei Türen lesen) und die **zwei
  Straßen**, die knapp am Gleichheitszeichen liegen.
- **Die linke Ecke wird höher.** Eine zweite Reihe echter Karten kostet rund
  5,8 rem plus Fuge. Bei 1920×889 ist der Ecken-Streifen ~476 px breit, fünf
  Karten passen nebeneinander; bei 1280×800 sind es nur 236 px, also drei je
  Reihe — hält jemand vier oder fünf Sorten, bricht die Reihe um und die Ecke
  wächst um weitere 5,8 rem. Ungemessen, ob sie dann noch unter dem Brett
  vorbeikommt.
- `GameScreen.test.tsx` → „sperrt das Bauen, solange nicht gewürfelt ist" lief
  in einem Lauf **5032 ms** und damit knapp über die Standardfrist von 5000 ms;
  im nächsten Lauf war er grün. Der Test klickt zwölf Gründungszüge durch und
  liegt damit an der Grenze — er wird beim nächsten langsamen Rechner rot, ohne
  dass jemand etwas kaputt gemacht hat.
- Die Viewport-Breakpoints (`26rem`, `62rem`) sind weiterhin ungesehen.

### Nächste Etappe

Unverändert Etappe 10 (Erweiterungen) — und davor weiterhin der
Browser-Durchlauf, jetzt mit fünf ungesehenen Zeichnungen mehr auf der Liste.

## Drei Befunde vom Spieltisch (2026-08-19, `main`)

Stand: nach `6ae509a`. Drei Meldungen aus dem laufenden Spiel — die Farbe im
Bankhandel, die unsichtbaren Ziele beim Stadtbau, die Augen über dem Chiprand.
Alle drei haben eine nachweisbare Ursache im Blatt, keine ist Geschmack.

### Abnahme

| Prüfung             | Ergebnis                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                         |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 309 / 33       |
| `pnpm build`        | grün — `index.js` 410.70 kB (gzip 122.09), `index.css` 34.99 kB (7.87) |
| `pnpm format:check` | grün                                                                   |
| Browser             | **nicht gelaufen** — Chrome-Erweiterung weiterhin nicht verbunden      |

### Die Augen ragten über den Chiprand — und der Grund stand schon in CLAUDE.md

Gemeldet: „die Punkte von den Zahlen im Inneren der Felder überlappen mit dem
Rand von dem Kreis". Die Ursache ist die **dritte** Wiederholung derselben
Falle:

```css
.chip text {
  font-size: 0.32px;
} /* eine Klasse plus ein Typ */
.chip__pips {
  font-size: 0.19px;
} /* eine Klasse allein — verliert */
```

Die 0,19 px haben nie gegolten. Gerendert wurden 0,32 px, und fünf Mittelpunkte
in dieser Größe sind breiter als die Scheibe, in der sie liegen (Radius 0,34).
Dieselbe Kaskadenfalle wie bei der roten Sechs, zwei Regeln weiter oben im
selben Block — dort war sie mit einem schärferen Selektor behoben worden
(`.chip text.chip__hot`), hier nicht.

**Behoben wurde sie diesmal nicht mit einem schärferen Selektor, sondern mit dem
Verzicht auf Schrift.** Die Augen sind jetzt gezeichnete Kreise (`ChipPips` in
`BoardSvg.tsx`), Abstand 0,055, Radius 0,022. Der Grund ist der zweite, schwerere
Teil des Befunds: die Breite eines `·` hängt an den Metriken einer Schrift. Wie
viel Vorschub Segoe UI ihm gibt, lässt sich nicht ausrechnen, und auf einem
Rechner ohne Segoe UI ist es eine andere Zahl — die Regel wäre also selbst dann
nur zufällig richtig gewesen, wenn sie gegriffen hätte. Eine gezeichnete Form
hat keine Metrik.

Gerechnet: fünf Punkte spannen 0,22, der äußerste sitzt mit seinem Radius 0,272
vom Mittelpunkt, der Chip misst 0,34. **Und das ist jetzt ein Test** — die Lage
von Kreisen ist reine Attributrechnung und braucht keine Layout-Engine, also
prüft `BoardSvg.test.tsx` für jeden Chip im Szenario, dass jeder Punkt innerhalb
bleibt.

### Beim Stadtbau blieb das Brett vollkommen ruhig

Gemeldet: „beim Bauen von Städten sollen die Häuser markiert werden für
Sichtbarkeit". Der Code sagt, warum: die Zielmarke hing am **leeren** Knoten.

```tsx
{
  building === undefined ? isTarget ? <Marke /> : null : <Bauwerk />;
}
```

Beim Ausbau zur Stadt sind aber _alle_ Ziele bebaut. Es gab also keinen Fall, in
dem überhaupt etwas leuchtete: man drückt „Stadt", die Bauleiste bestätigt die
Wahl, und das Brett bleibt, wie es war. Anklickbar waren die Häuser die ganze
Zeit — der Klick hängt an der Gruppe, nicht an der Marke —, nur sah man nicht,
welches gemeint ist. Das wirkt genau so, wie es aussieht: als ginge es nicht.

Jede bebaute Zielstelle bekommt deshalb einen **Hof**: dieselbe Marke wie am
leeren Knoten, größer (Radius 0,235) und **unter** dem Bauwerk. Gleiches
Material, gleiche Aussage, und das Haus steht darauf statt darunter. Kein
zweiter Ring — der hätte sich mit der Aufbau-Welle (`build-flash`, Radius 0,34)
gestapelt und dieselbe Sache zweimal gesagt. Er ist blasser als die Marke am
leeren Knoten (34 % statt 62 %): dort ist sie das einzige Zeichen, hier liegt
ein Haus darauf, und das soll das laute Ding bleiben.

Dazu wandert `cursor: pointer` von der Marke auf die Gruppe — das Bauwerk liegt
über ihr, und wer auf das Haus zeigt, zeigt auf das Ziel.

### „Weiß auf weiß" im Bankhandel — zwei Ursachen, beide behoben

Die Meldung ließ zwei Lesarten zu, und beide Male steckte ein echter Fehler
dahinter. Deshalb sind beide behoben.

**Erstens: der Rohstoff hatte dort als einziger keine Farbe.** Auf der Hand ist
ein Rohstoff eine Karte in der Geländefarbe mit seinem Motiv; in „Erfindung" und
„Monopol" ebenso (`ResourcePickDialog`). Im Bankhandel standen fünf gleiche
Pergamentpillen mit Text darin. Dieselbe Sache muss überall gleich aussehen,
sonst ist es nicht mehr dieselbe Sache — also trägt sie auch hier Farbe und
Motiv (`Choice` in `TradeDialog.tsx`).

Das Feld bleibt dabei ein `radio`; ausgeblendet wird nur seine Zeichnung, nicht
das Feld — die Gruppe ist weiter mit Pfeiltasten bedienbar, und `:has(input:
focus-visible)` holt den Fokusring zurück. Die Zeile für den Bestand steht immer
da, auch leer: beim Bekommen sagt ein Bestand nichts, und ohne sie wären die
zwei Reihen verschieden hoch (derselbe Kniff wie bei der Aufforderung unter den
Würfeln).

**Gewählt wird mit zwei Ringen, innen Tinte und außen Gold** — und das ist kein
Schmuck. Ein einzelner Ring geht auf fünf verschiedenen Geländefarben nicht:
Gold allein verschwände auf dem Korn (beides `--fields`), Tinte allein säße auf
dem dunklen Wald fast unsichtbar, und gegen die Pergamentfläche des Dialogs muss
der Ring auch noch stehen. Zwei Ringe stehen auf jedem dieser Gründe.

**Zweitens: `.button--ghost` ist auf Pergament creme auf creme.** Die Klasse
setzt `color: var(--on-sea)` — richtig auf der Tiefsee, wo sie sonst überall
steht, und im Dialog gemessene **1,05:1**. Betroffen: „Abbrechen" im Handel,
„Auswahl zurücksetzen" bei Erfindung und Monopol, „Abbrechen" beim Räuberopfer.

Der Befund selbst ist nicht neu — er steht seit dem Browser-Durchlauf im August
in `CLAUDE.md` („cream auf Pergament = 1,05:1, an rund zehn Stellen
unsichtbar"). Behoben wurden damals die drei Antwortknöpfe am Angebot und das
Zahnrad; **die Klasse selbst blieb, wie sie war**, und damit alle anderen
Stellen. Das ist die eigentliche Lehre: wer einen Befund an seinen Fundstellen
repariert statt an seiner Ursache, bekommt ihn wieder.

Repariert wird er jetzt an `.modal__box .button--ghost` und **nicht** in der
Klasse. Der naheliegende Weg wäre `--ink: inherit` gewesen, damit der körperlose
Knopf die Tinte seines Grundes nimmt — nur liegt `--ink` nicht an jedem Grund
vor: `.mode` etwa trägt Tiefsee, definiert `--ink` aber nicht um, und dort wäre
daraus dunkle Tinte auf dunklem Grund geworden. Also derselbe Fehler, nur
woanders. Der Dialogkasten ist der eine Ort, an dem der Untergrund **immer**
Pergament ist.

### Ein Test mit eigener Frist statt eines Flakes

`GameScreen.test.tsx` → „sperrt das Bauen, solange nicht gewürfelt ist" ist beim
letzten Stand einmal an der 5000-ms-Standardfrist gescheitert und beim
Nachschreiben dieser Abnahme noch einmal. Allein läuft er in 4,7 s, parallel
neben `shared` und `server` reicht das nicht. Er hat jetzt 20 s.

Erhöht und nicht gekürzt: was er prüft, braucht die zwölf Gründungszüge. Ein
Test, der je nach Rechnerlast fällt, ist schlimmer als ein langsamer — er kostet
jedes Mal die Frage, ob diesmal wirklich etwas kaputt ist.

### Offene Punkte

- **Weiterhin nichts davon im Browser gesehen.** Bei den ersten beiden Befunden
  wiegt das leichter als sonst: der Chip ist gerechnet und getestet, der Hof ist
  eine Marke, die es an anderer Stelle schon gibt. Die Farbkarten im Bankhandel
  sind dagegen neu gesetzt — Breite 4 rem, Motiv 1,8 rem, fünf davon je Reihe in
  einem Dialog von höchstens 34 rem. Ob das in einer Reihe bleibt oder umbricht,
  ist ungemessen.
- Eine Sorte, von der man nichts hat, lässt sich im Bankhandel weiter auswählen;
  die Absage kommt erst am „Tauschen"-Knopf. Ableitbar wäre es (`canTrade` über
  alle Empfangssorten), ohne eine Regel in den Client zu schreiben — bewusst
  nicht gemacht, weil es über die Meldung hinausginge.
- `.button--ghost` ist an seiner Ursache immer noch nicht heil: außerhalb von
  Dialogen steht er weiter auf `--on-sea`, und der nächste helle Untergrund
  außerhalb eines `.modal__box` bringt ihn zurück.
- Die zwei Viewport-Breakpoints (`26rem`, `62rem`) sind weiterhin ungesehen.

### Nächste Etappe

Unverändert Etappe 10 — und davor der Browser-Durchlauf, der inzwischen die
längste Liste des Projekts vor sich herschiebt.

## Der Browser-Durchlauf, endlich (2026-08-19, `main`)

Stand: nach `fd6a292`. Die Chrome-Erweiterung war verbunden, und damit ist zum
ersten Mal seit Wochen nachgesehen statt behauptet worden. Bestätigt: alle drei
Befunde vom Spieltisch, die Musik, das neue Layout, die Entwicklungskarten.
Gefunden: drei Dinge, die kein Test sehen konnte.

### Abnahme

| Prüfung             | Ergebnis                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                         |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 311 / 33       |
| `pnpm build`        | grün — `index.js` 410.81 kB (gzip 122.12), `index.css` 35.07 kB (7.88) |
| `pnpm format:check` | grün                                                                   |
| Browser             | **gelaufen** — lokale Partie bei 1920×889, Gründung bis Runde 5        |

### Was bestätigt ist — und zwar gemessen, nicht angesehen

**Die Augen im Zahlenchip.** Radius der Scheibe 27,24 px, weiteste Reichweite
eines Punktes 21,82 px — 80 % des Radius, 5,4 px Luft bis zum Rand. Der Befund
ist weg und bleibt weg, weil dieselbe Rechnung jetzt im Test steht.

**Die Häuser beim Stadtbau.** Nach dem Druck auf „Stadt" waren zwei Knoten
markiert, beide mit Bauwerk, beide mit Hof darunter. Der helle Teller unter dem
roten Haus liest sich auf Braun, Grau und Grün gleich gut.

**Der Bankhandel.** Fünf Karten in Geländefarbe mit Motiv, die Bestände darunter
(„0" blass), Doppelring bei der Auswahl — auf dem dunklen Wald und auf dem
gelben Korn gleichermaßen sichtbar. „Abbrechen" misst jetzt `rgb(22 32 42)` auf
`rgb(240 230 210)`, also rund 15:1 statt 1,05:1.

**Das Layout.** Bei 1920×889: Status 1700–1819, Verlaufsknopf 1831–1865,
Zahnrad 1871–1905 — eine Zeile, keine Überschneidung, 15 px Rand. Die Ablage
endet rechts bei 1908, der Würfelbecher ist nicht angeschnitten. `scrollWidth`
gleich `innerWidth`: nichts läuft seitlich über.

**Die Musik läuft.** Nachgewiesen mit einer Sonde um `Audio`, `play()` und
`AudioContext`, vor der ersten Geste gesetzt: nach dem ersten echten Klick steht
im Protokoll `AudioContext` → `neu: /music/catan.mp3` → `play() gerufen` →
`play() ok`, dazu `loop: true`, `paused: false`, `readyState: 4` und eine
laufende Uhr. **Der erste Versuch, sie zu finden, ging daneben:**
`document.querySelectorAll('audio')` fand nichts, weil `new Audio()` ein
Element erzeugt, das gar nicht im Dokument hängt. Eine Sonde am falschen Ort
sagt „kaputt" über etwas Heiles.

**Die Entwicklungskarten** liegen als Karten unter der Hand, der Helm ist bei
2,4 rem als Helm zu erkennen, der Name steht darunter.

### Was der Durchlauf gefunden hat

**1. Drei sichtbare Texte ohne Umlaute.** Im Handel stand „Der Kurs ergibt sich
aus deinen **Haefen**", im Konto-Dialog „kommst du **ueber** dieses **Geraet**
nicht mehr an sie heran" und „liegt **fuer** eine **spaetere**
Passwort-Wiederherstellung". Die Grenze steht seit dem ersten Playtest im Blatt
— alles, was ein Spieler liest, hat Umlaute — und ist an drei Stellen
durchgerutscht. Gefunden mit einem Suchlauf über alle `.tsx` nach
`ae|oe|ue`-Wörtern außerhalb von Kommentaren; **der erste Versuch fand nichts**,
weil er nur Zeilen mit Anführungszeichen ansah und JSX-Text zwischen Tags keine
hat.

**2. Ein `+`, das nichts tut.** Im Abwurffenster stand „Lehm — von 0" mit einem
bedienbaren `+` daneben. Beide Stepper (`DiscardDialog`, `TradeAmounts`) klemmen
seit jeher **im Handler** und haben den Knopf nie gesperrt: an der Grenze
passiert lautlos nichts. Aufgefallen ist es, weil ein Automatikklick genau
darauf drückte und der Zähler stehenblieb.

Es ist dieselbe Lüge wie der dauerhaft gesperrte Siegpunkt-Knopf, nur
andersherum: dort sah etwas tot aus, das keine Handlung ist, hier sieht etwas
lebendig aus, das nichts bewirkt. Behoben, indem **Knopfzustand und Wirkung
dieselbe Funktion fragen** — `canStep` im Abwurf, das vorhandene `step` im
Angebot, das ohnehin schon `null` für „geht nicht" zurückgibt. Zwei getrennte
Ausdrücke derselben Regel wären auseinandergelaufen.

Nach oben ist im Abwurf auch die geforderte Zahl eine Grenze: wer vier von vier
gewählt hat, sieht alle `+` erlöschen.

**3. Die Sperre war unsichtbar.** Und das ist der eigentliche Fund. Nach dem
Einbau von `disabled` maß der Browser für gesperrten und offenen Stepper
**exakt dieselbe** Schrift-, Grund- und Randfarbe und dieselbe Deckkraft:
`disabled` allein ändert an einem Knopf mit eigenem Hintergrund nichts, und die
Regel für den Zustand fehlte. Der Fix wäre also im Verhalten richtig und am
Bildschirm nicht vorhanden gewesen — genau der Fehler, den er beheben sollte.
`.cards__stepper button:disabled` trägt jetzt dieselben `opacity: 0.4` und
`cursor: not-allowed` wie `.button:disabled` und `.pick__card:disabled`, damit
„geht nicht" überall gleich aussieht. Dazu bekam die Hover-Regel ihr
`:not(:disabled)`.

### Wie das Durchspielen ging

Die Gründung und ein paar Runden wurden per Skript geklickt (`dispatchEvent`
auf die Knöpfe der Klickkarte). Zwei Dinge daran sind notierenswert:

- **Synthetische Klicks reichen nicht überall.** Der Anlauf der Musik hängt an
  `pointerdown`; ein abgeschicktes `click` löst ihn nicht aus. Was am Ton hängt,
  muss echt geklickt werden.
- **Ein Automat, der den ersten freien Knopf drückt, findet die toten.** Er hat
  auf „Lehm +" gedrückt, weil der als erster nicht gesperrt war — und genau
  daran ist Befund 2 aufgefallen. Ein Mensch hätte den Knopf gar nicht erst
  probiert.

### Offene Punkte

- Die zwei Viewport-Breakpoints (`26rem`, `62rem`) sind weiterhin ungesehen —
  nachgesehen wurde nur bei 1920×889.
- Eine Sorte, von der man nichts hat, lässt sich im **Bankhandel** weiter
  auswählen; nur die Stepper im Angebot sind jetzt ehrlich. Dieselbe Ableitung
  wäre dort über `canTrade` möglich.
- `.button--ghost` ist außerhalb von `.modal__box` weiter creme; der nächste
  helle Untergrund bringt ihn zurück.
- Der schwarze Rand der Felder (`.hex`) ist nach wie vor unangetastet.

### Nächste Etappe

Etappe 10 (Erweiterungen). Der Browser-Durchlauf steht zum ersten Mal seit
Wochen **nicht** mehr davor.

## Die Würfel fliegen über das Brett (2026-08-19, `main`)

Stand: nach `8ef52c9`. Zwei CSS-3D-Kuben, ein Bogen über das Brett — und ein
Tisch, der schweigt, solange sie unterwegs sind.

**Entwurf.** Rolle: der Wurf ist der Augenblick, in dem eine Runde kippt; er
gehört aufs Brett und nicht in eine Ecke. Aufbau: zwei Kuben springen aus der
Ablage, taumeln über das Brett und fallen in ihren Platz zurück. Woran man sich
erinnert: dass der Verlauf die Zahl erst verrät, wenn der Würfel sie zeigt.

### Abnahme

| Prüfung             | Ergebnis                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                         |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 319 / 34       |
| `pnpm build`        | grün — `index.js` 412.51 kB (gzip 122.80), `index.css` 36.25 kB (8.17) |
| `pnpm format:check` | grün                                                                   |
| Browser             | lokale Partie bei 1920×889, Wurf im Flug und nach der Landung gemessen |

Der ganze Wurf kostet **1,7 kB** im Skript und **1,2 kB** im Blatt.

### Keine Bibliothek, keine Physik — und das ist kein Sparen

`three.js` samt einer Physik-Engine wiegt 300–600 kB gegen ein Bundle von 410 kB.
Das allein wäre schon ein Argument. Das eigentliche ist ein anderes:

> **Das Ergebnis steht fest, bevor der Würfel fällt.**

Es kommt aus dem Seed, der Reducer hat es ausgewürfelt (Architekturregel 2), und
keine Simulation darf es bestimmen. Ein physikalisch geworfener Würfel, der sich
auf eine andere Zahl legt als die, die im Zustand steht, wäre ein Fehler, den
niemand mehr einfinge — man müsste ihn also ohnehin auf seine Fläche
**steuern**. Damit fällt der Hauptgrund für echte Physik weg, und übrig bleibt
das, was ein Würfel wirklich ist: sechs Flächen um eine Mitte.

Der Kubus steht in `transform-style: preserve-3d`, seine sechs Seiten je um die
halbe Kantenlänge nach außen geschoben. Gesteuert wird er über zwei Zahlen:
`--fx` und `--fy` sind die Drehung, bei der genau die geworfene Fläche vorn
steht (`FACE_TURN` in `DiceTray.tsx`, die Umkehrung des Würfelnetzes). Die
Animation dreht von **drei ganzen Umdrehungen davor** in diese Lage hinein — das
taumelt sichtbar und landet trotzdem exakt.

Gegenüberliegende Flächen ergeben sieben, wie bei einem echten Würfel. Wer beim
Taumeln zwei Kanten zugleich sieht, soll nichts Falsches sehen.

Der Bogen fängt und endet bei `translate3d(0,0,0)`, also **an Ort und Stelle**.
Damit muss niemand die Bildschirmkoordinaten der Ablage messen: der Würfel
springt aus seinem Platz heraus und fällt in ihn zurück. Der Scheitel steht in
`vw`/`vh` — wie weit „über das Brett" ist, weiß nur das Fenster. Das `scale` am
Scheitel ist die Tiefe; ohne es sähe der Bogen aus wie ein Schieben auf der
Tischplatte.

### Der Haken war nicht die Grafik, sondern die Zeit

Wurf, Verlaufszeile, die Zuwachsplaketten am Tisch und der Klang stammen alle
aus **einer** Zustandsänderung und erscheinen deshalb im selben Augenblick.
Solange die Würfel an Ort und Stelle umsprangen, war das richtig. Würfel, die
eine Sekunde über das Brett trudeln, zeigen ihre Zahl dagegen erst am Ende — und
dann steht sie im Verlauf schon, bevor sie fällt. Die Animation erklärte dann
nicht mehr den Zustandswechsel (Designregel 5), sie käme ihm hinterher.

Also hält `game/useSettledRoll.ts` **die ganze Vorführung** an: Sicht,
Klickkarte, Verlauf und Klang. Wer wirft, sieht bis zur Landung genau den Tisch,
den er vorher hatte.

Drei Entscheidungen darin:

**Er liegt um die Partie und nicht in ihr.** In `App.tsx` umschließt er
`useLocalGame` beziehungsweise `online.state` — und zwar **vor** `useCueSound`.
Stünde der Klang davor, wäre der Wurf zu hören, bevor er liegt. Online wartet
damit auch der Bildschirm des Mitspielers, der nur zusieht: der Wurf ist für
alle derselbe Augenblick.

**Nur eine Auskunft geht vor der Landung durch:** der Wurf selbst, als
`landing`. Die Würfel müssen wissen, worauf sie fallen sollen. Alles andere
erfährt der Tisch erst, wenn sie liegen.

**Ohne Bewegung gibt es auch kein Warten.** Bei `prefers-reduced-motion` fliegt
nichts, und eine Sekunde Stillstand ohne sichtbaren Grund wäre kein
Spannungsbogen, sondern eine hakende Oberfläche. Dasselbe gilt, wo es gar kein
`matchMedia` gibt: im Zweifel wird nicht gewartet.

Woran der Haken erkennt, dass ein Stand aus einem Wurf kam, wusste der Client
schon — daran hängt seit dem Ton die Fall-Animation. Die Bedingung ist dafür aus
dem Anzeigemodell in eine eigene Funktion gewandert (`cameFromRoll` in
`game/view.ts`): **zwei Abschriften derselben Bedingung wären beim ersten Umbau
auseinandergelaufen**, und dann hätte der Tisch gewartet, ohne dass etwas
fliegt, oder umgekehrt.

Dazu eine Kleinigkeit mit Folgen: **der Becher sperrt sich während des Fluges
selbst.** Die Klickkarte stammt aus dem Stand von vorhin und lässt das Werfen
selbstverständlich noch zu — ein zweiter Klick hätte einen zweiten Wurf
geschickt.

### Was ein Kubus nicht kann

Sechs Flächen. Für einen achtseitigen Würfel aus einem späteren Regelwerk gäbe
es keine Zuordnung, und eine erfundene wäre schlechter als keine — dann bleibt
es beim Umspringen an Ort und Stelle. Gezeigt wird ohnehin, was in `spec` steht.

### Im Browser gemessen

Bei 1920×889, lokale Partie, echter Klick auf die Würfel:

| Zeitpunkt  | Befund                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- |
| im Flug    | zwei `.cube`, Phase noch „Spieler 1 muss würfeln", Becher gesperrt, „Die Würfel fallen" |
| gesteuert  | `--fx: -90deg` (Fünf) und `--fy: 180deg` (Sechs)                                        |
| nach 1,1 s | keine Kuben mehr, „Wurf: 5 und 6, zusammen 11", Summe 11                                |
| Verlauf    | „Spieler 1 würfelt 11 — Spieler 1 +2, Spieler 2 +1" — erst jetzt                        |

Keine Meldung in der Konsole.

### Ein Test, der ohne Layout-Engine etwas beweist

Vier Tests in `game/useSettledRoll.test.tsx` prüfen nicht, DASS etwas fliegt —
das kann jsdom nicht sehen —, sondern **welchen Stand der Bildschirm bekommt und
wann**: der Tisch bleibt bis zur Landung auf dem alten Stand samt seinem
Verlauf, ein Stand ohne Wurf geht sofort durch, bei reduzierter Bewegung wird
gar nicht gewartet, und ein Stand, der **während** des Fluges eintrifft, öffnet
den Tisch nicht vorzeitig, geht aber auch nicht verloren — übernommen wird am
Ende der neueste.

Zwei Dinge daran waren beim Schreiben nicht offensichtlich:

- **`advanceTimersByTime` allein reicht nicht.** Der Wecker feuert, aber was er
  an Zustand setzt, hängt danach in der Warteschlange; ohne `act` liest der
  nächste Blick den Bildschirm von **vor** der Landung, und der Test meldet
  einen Fehler, den es nicht gibt.
- **Die Wurfaktion heißt `rollDice`, nicht `roll`.** Im Client heißt das Feld
  der Klickkarte `roll`, im Protokoll heißt der Zug anders — ein Test, der nach
  dem falschen Namen sucht, findet nichts und behauptet, es gäbe keinen Wurf.

Dazu vier in `DiceTray.test.tsx`: die Kuben stehen auf der geworfenen Zahl, die
Summe bleibt bis zur Landung weg, während des Fluges nimmt der Becher keinen
Klick an, und ein achtseitiger Würfel fliegt gar nicht erst.

### Offene Punkte

- **Der Klang liegt jetzt vollständig auf der Landung.** Schöner wäre das
  Poltern (`dice.roll`) beim Abwurf und der Aufschlag (`dice.land`) beim
  Auftreffen — dafür müsste die Klangliste eines Ereignisses aufgeteilt werden,
  und das ist eine eigene Etappe wert.
- Der Bogen ist an keiner anderen Fenstergröße als 1920×889 gesehen. Der
  Scheitel steht in `vw`/`vh`, sollte also mitwandern — gemessen ist das nicht.
- Reduzierte Bewegung ist im Test belegt, aber nicht im Browser nachgestellt.
- Online ist der Haken ungesehen: dass **jeder** Bildschirm wartet, ist bisher
  nur die Bauart, nicht die Beobachtung.

### Nächste Etappe

Etappe 10 (Erweiterungen).

## Eine Karte für alle Rohstoffe — und ein Klang dafür (2026-08-19, `main`)

Stand: nach `d05ab4c`. Die Kartenoptik aus dem Bankhandel gilt jetzt überall, wo
ein Rohstoff vorkommt — und die Karten sind nicht mehr stumm.

### Abnahme

| Prüfung             | Ergebnis                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                            |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 320 / 34          |
| `pnpm build`        | grün — `index.js` 413.16 kB (gzip 122.99), `index.css` 36.22 kB (8.17)    |
| `pnpm format:check` | grün                                                                      |
| Browser             | lokale Partie 1920×889: Bankhandel, Angebot, Gegenangebot, Klang gemessen |

### Den Rohstoff gab es fünfmal

Als Stapel auf der Hand, als Farbplatte in „Erfindung", als Karte im Bankhandel
— und als **nackten Text** im Abwurffenster, im Angebotsformular und in den
Bedingungen eines Angebots. Die drei letzten waren ausgerechnet die Stellen, an
denen man unter einer laufenden Frist aussucht, was man hergibt.

Jetzt gibt es **eine** Karte (`panels/ResourceCard.tsx`), und die Fenster bauen
um sie herum: der Bankhandel legt ein `label` mit verstecktem Radiofeld darum,
Abwurf und Angebot einen Schrittzähler darunter, die Bedingungen gar nichts. Wer
die Karte ändert, ändert sie überall.

**Die Handkarte bleibt draußen.** Sie ist 4,6 rem breit, trägt Stapeltiefe und
liegt auf dem Tisch statt in einem Fenster — ein anderes Ding, nicht eine
größere Ausgabe von diesem.

Drei Kleinigkeiten, die dabei mit abfielen:

- **`von 3` statt einer nackten Zahl.** Der Bankhandel schrieb den Bestand als
  Ziffer unter den Namen; das Abwurffenster sagte „von 3". Jetzt sagen es beide
  gleich — und die leere Zeile auf der Empfangsseite bleibt, sonst wären die
  zwei Reihen verschieden hoch.
- **Der Pergamentkasten um Abwurf und Angebot ist weg.** Er umrahmte einmal drei
  Textzeilen; eine Karte in einem Kasten wäre ein Ding in einer Kiste.
- **`.cards__label`, `.cards__held` und `.pick__name` sind gelöscht**, nicht nur
  ungenutzt. Tote Klassennamen im Blatt sind in diesem Projekt schon einmal
  teuer geworden.

### Die Karten waren als einzige Bedienelemente im Spiel stumm

Der delegierte Klick sucht `closest('button, [role="button"]')`. Eine wählbare
Rohstoffkarte ist ein **`label`** mit einem versteckten Radiofeld darin — also
fand er nichts, und im Bankhandel klickte jeder Knopf, nur die Karte nicht.

Behoben an zwei Stellen:

1. `[data-sound]` steht mit in der Auswahl. Wer einen Klang an ein Element
   schreibt, meint damit auch, dass es einen bekommt — und das Attribut gab es
   längst.
2. Ein Klang mehr im Vokabular: **`ui.card`**, ein kurzer weicher Rauschstrich
   nach unten (3400 → 2100 Hz, 75 ms, `gain` 0.13). Ein eigener Klang und nicht
   `ui.click`, weil es kein Knopf ist: **eine Karte raschelt, ein Knopf klackt.**
   Der Unterschied trägt eine echte Auskunft — am Ton hört man, ob man Material
   bewegt oder etwas auslöst. Ihn tragen die Rohstoffkarten und die
   Schrittzähler, die ja Kartenmengen stellen.

Das Vokabular steht damit bei 24 Klängen; `samples.ts` führt den neuen wie alle
anderen als auskommentierte Zeile.

### Im Browser gemessen

Sonde um `createBufferSource`/`createOscillator`, Zähler vor jedem Klick
zurückgesetzt:

| Klick                            | Ergebnis                                              |
| -------------------------------- | ----------------------------------------------------- |
| Schrittzähler `+` (ein `button`) | 1 Klangquelle, `data-sound="card"`, Wert 0 → 1        |
| Rohstoffkarte (ein **`label`**)  | 1 Klangquelle, Radiofeld gewählt, `tagName` = `LABEL` |

Der zweite ist der Beweis: vor der Änderung wäre der Zähler auf 0 geblieben.

Gesehen: Bankhandel (zwei gleich hohe Reihen, „von 0/2/1"), Angebotsformular
(Karten mit Zählern darunter, gesperrte `+` sichtbar blass), Bedingungen eines
Angebots (**Korn ×2 „für" Holz ×1** als zwei Karten mit Plaketten statt „2 Korn
für 1 Holz") und das Gegenangebot.

### Offene Punkte

- Im **Gegenangebot** brechen die zwei Spalten bei fünf Sorten auf je zwei
  Zeilen um, und die zweite Zeile steht linksbündig unter der ersten. Es liest
  sich, ist aber nicht schön — der Dialog ist dort am schmalsten.
- `ui.card` ist nur über die Sonde belegt, **gehört** hat ihn noch niemand: der
  Musikregler des Rechners steht auf 0 %, die Effekte auf 30 %.
- Der Klang des Wurfs liegt weiterhin vollständig auf der Landung (siehe den
  Abschnitt davor).

### Nächste Etappe

Etappe 10 (Erweiterungen).

## Die Felder werden Material: matt und flächig texturiert (2026-08-20, `main`)

Stand: nach `355d18b`. Ein Feld war bis hierher genau zwei Dinge: eine Füllfarbe
und eine 0.024 breite Kontur. Damit war das Brett — nach Designregel 4 der Held
des Bildschirms — die flachste Fläche darauf, flacher als die Karten, die Würfel
und der Kaufstapel. Und die Farbe trug die Geländeinformation **allein**, was
Regel 7 widerspricht.

### Abnahme

| Prüfung             | Ergebnis                                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                             |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 324 / 35           |
| `pnpm build`        | grün — `index.js` 415.94 kB (gzip 123.74), `index.css` 36.43 kB (8.24)     |
| `pnpm format:check` | grün                                                                       |
| Browser             | lokale Partie 1920×889: Gründung durchgeklickt, 6 Siedlungen und 6 Straßen |

Vier neue Tests (`board/terrain.test.tsx`), dazu zwei bestehende in
`BoardSvg.test.tsx` auf den Chip umgehängt, der jetzt außerhalb der Feldgruppe
liegt (`data-testid="chip-…"` statt eines Weges über `parentElement`).

### Zwei Fassungen, und die erste war eine Lehre

**Fassung eins** setzte je Feld fünf gezeichnete Objekte in ein Band am unteren
Rand — Tannen, Ähren, ein Schaf, Ziegel — und gab den Feldern einen
Lichtverlauf mit heller Fase an der Oberkante. Beides war falsch, und beides
sah man erst im Browser:

- **Ein heller Grat an der Oberkante ist ein Glanzlicht, und Glanz heißt
  glatt.** Ein Plättchen aus Karton oder ein Holzfeld hat keines. Das Brett sah
  aus wie aus Plastik — technisch sauber, materiell falsch.
- **Fünf Objekte in einem Band sind ein gesetztes Designelement, kein
  Gelände.** Man sah ein Motiv auf einer leeren Fläche, nicht ein Feld, das aus
  etwas besteht.

**Fassung zwei** ist die ausgelieferte: matt und flächig. Die Verläufe sind weg,
an ihrer Stelle steht eine **richtungslose** Randabdunklung (`hex-matte`, ein
Radialverlauf von durchsichtig auf 13 %) — es gibt keine Lichtquelle mehr, also
auch keinen Reflex, nur eine Kante, an der die Farbe in den Karton zieht. Die
Tiefe kommt jetzt aus der Textur und aus dem Küstenschatten.

### Die Textur ist eine Kachel, kein Motiv

`board/terrain.tsx` hält sechs `<pattern>`-Kacheln: Tannen im Wald, Grasbüschel
auf der Weide, Furchen im Acker, Ziegelverband in der Lehmgrube, Zacken im
Gebirge, Dünenwellen in der Wüste. Das Feld wird damit gefüllt — ein zweites
Sechseck über der Geländefarbe, **kein `clipPath` nötig**: eine Füllung endet am
Rand ihrer Form, und die Form _ist_ das Feld.

**`userSpaceOnUse` und nicht `objectBoundingBox`.** Das ist die eine
Entscheidung, an der hier alles hängt: die Voreinstellung würde jede Kachel auf
die Fläche des einzelnen Feldes rechnen, und zwei benachbarte Waldfelder zeigten
zwei Kacheln statt eines Waldes. Mit `userSpaceOnUse` hängt die Textur am Brett;
sie läuft über die Feldgrenze durch. Der Unterschied zwischen Landschaft und
Raster kostet ein Attribut.

Damit fällt auch die ganze Freistellungsrechnung der ersten Fassung weg: der
Zahlenchip ist deckend, eine Textur darunter verdeckt nichts, und Straßen und
Bauwerke liegen ohnehin darüber.

### Die Textur ist sehr leise, und das ist der Punkt

`.terrain-fill` steht auf 16 %, `.terrain-line` auf 17 % — gerechnet ergibt das
zwischen Marke und Feld einen Kontrast von **1.22 (Wald) bis 1.39 (Wüste)**.

Das ist bewusst weit weniger als die 46 %, mit denen das Motivband der ersten
Fassung endete. Eine Fläche verträgt weniger Kontrast als ein Einzelmotiv: was
über das **ganze** Feld läuft, läuft auch unter jeder Straße und hinter jedem
Bauwerk durch. Die Geländeunterscheidung kommt jetzt aus dem **Muster** und
nicht aus der Deutlichkeit einer einzelnen Form — Spitzen gegen Rundungen gegen
Furchen liest man auch leise, weil sie eine Fläche füllen. Genau das war der
Ausweg aus der Zwickmühle, in der Fassung eins steckte: dort musste eine einzige
Lasur auf sechs ungleichen Geländefarben gleichzeitig sichtbar und
zurückhaltend sein, und das ging nicht (Wald erreichte selbst bei 66 % nur 2.18,
während die Wüste bei 4.9 zum Fleck wurde — derselbe feste Aufschlag auf
ungleiche Werte wie bei der Aufprallwelle im Hauptmenü).

### Was der Test prüft — und was er nicht mehr prüft

Bei einer gekachelten Fläche ist das Wichtigste unsichtbar, solange es stimmt,
und springt sofort ins Auge, sobald es nicht stimmt: **die Naht.** Eine Linie,
die bei x = 0 auf einer anderen Höhe anfängt als sie bei x = Breite endet, macht
aus jeder Kachelgrenze einen Knick — und aus einer Textur ein Gitter.
`terrain.test.tsx` rechnet das für jeden Pfad nach, der die Kachel durchquert.

Dazu: jedes Gelände hat eine Kachel, jede Kachel steht auf `userSpaceOnUse` (die
Aussage oben ist damit eingerastet, nicht bloß aufgeschrieben), und keine
gezeichnete Marke ragt aus ihrer Kachel — was hinausragt, wird abgeschnitten,
und ein abgeschnittener Baum sieht aus wie ein Zeichenfehler. Geprüft werden
dabei die **Stützpunkte**, nicht jede Zahl im `d`: die Dünenwelle braucht
Kontrollpunkte außerhalb der Kachel, sonst bekäme sie ihren Ausschlag nicht.

Weggefallen ist die Freistellungsrechnung der ersten Fassung (Abstand jedes
Motivpunkts zu den sechs Kantengeraden und zum Chipradius). Sie hatte ihren
Zweck erfüllt und dabei zweimal zugeschlagen — eine Tanne stand 0.24 Einheiten
zu hoch, ein Schafskopf ragte in den Chip —, aber mit einer Textur, die überall
durchläuft, prüft sie nichts mehr.

### Zwei Fallen auf dem Weg, beide vom Messen aufgedeckt

**`drop-shadow` rechnet an einem SVG-Element in Pixeln, nicht in Brettmaßen.**
Der Küstenschatten stand zuerst auf `0 0.045px 0.07px` — in der Annahme, ein
Feld messe 1, das wären also rund vier Pixel. Gerendert kam nichts heraus. Eine
Probe in Rot zeigte: bei `0.4px` ist der Saum knapp zwei Pixel breit, nicht
zwanzig. Er skaliert damit **nicht** mit dem Brett, und das ist richtig — er
kommt nicht aus der Karte, sondern aus dem Licht im Raum.

Die Probe selbst log dabei zweimal, bevor sie die Wahrheit sagte: ein Inline-Stil
wurde vom nächsten React-Rendern überschrieben, und ein Wert im Blatt kam wegen
hängendem CSS-HMR gar nicht an. Beide Male sah es aus, als zeige der Filter
nichts. Erst `invert(1)` — sichtbar oder nicht, ohne Zwischentöne — bewies, dass
die Regel überhaupt greift.

**Zwei gleiche Marken in regelmäßigem Versatz sind immer ein Raster.** Das
Gebirge hatte zuerst zwei identische Winkel je Kachel, um eine halbe Kachel
versetzt. Am Bildschirm ergab das ein sauberes Rautengitter — eine Steppdecke,
kein Gebirge. Erst vier Winkel in vier Größen an ungleichen Abständen lösen es
auf. Wald und Weide haben aus demselben Grund je drei Marken statt zwei.

Der Schlagschatten hängt weiterhin an **einer** Gruppe über allen Feldern: innen
stoßen die Sechsecke ohne Lücke aneinander, dort kann nichts fallen, übrig
bleibt der Umriss zur See. Neunzehn einzelne Schatten hätten aus einem Brett
einen Stapel gemacht.

### Offene Punkte

- `hex-matte` und die sechs Kachel-Ids sind Dokument-IDs. Stünden zwei Bretter
  zugleich im DOM, gäbe es sie doppelt; identisch definiert, also folgenlos,
  aber es ist eine Annahme und keine Garantie.
- Der Küstenschatten ist der einzige Wert am Brett, der nicht mitskaliert.
- Die Textur ist bei 1.22 bis 1.39 Kontrast bewusst unterhalb jeder
  Kontrastnorm. Sie ist ein **zusätzlicher** Träger neben der Farbe, kein Ersatz
  — wer die Farbe nicht unterscheiden kann, unterscheidet die Muster, aber nur
  bei ausreichender Feldgröße (siehe Nachtrag).

### Nachtrag: die Breakpoints, gemessen — und ein Fund, der älter ist als diese Arbeit

Das Fenster ließ sich nicht verkleinern (`resize_window` meldete Erfolg,
`innerWidth` blieb bei 1920). Ein **Iframe auf `localhost:5173`** löst das: darin
ist `100vw` die Iframe-Breite, also bekommt die App einen echten schmalen
Viewport, ohne dass das Fenster mitspielen muss.

**Der Startbildschirm ist in Ordnung.** Die `62rem`-Grenze schaltet wie gebaut:
einspaltig bis 988 px, zweispaltig ab 1096 px, das Brett per `order: -1` oben.
Auf 386 px misst es 335×312, also 34,3 px je Umkreisradius. Die Prägung ist
dort am Rand ihrer Lesbarkeit — sie wirkt als Textur, einzelne Tannen oder Ähren
liest man nicht mehr. Der Unterschied zwischen Spitzen (Wald), Zacken (Gebirge)
und Senkrechten (Korn) bleibt trotzdem sichtbar, und die Zahlenchips sind
lesbar. Nichts bricht.

**Der Spielbildschirm ist auf einem Handy unbenutzbar**, und das hat mit dieser
Arbeit nichts zu tun. `--tray-strip` ist der Einzug je Seite und fällt wegen
`max(14.75rem, …)` **nie unter 236 px**; `.board-area` bekommt ihn zweimal als
`margin`. Gemessene Reihe (Breite des Bretts über der Viewport-Breite):

| Viewport | 382 | 496 | 636 | 764 | 896 | 1020 | 1196 | 1436 |
| -------- | --- | --- | --- | --- | --- | ---- | ---- | ---- |
| Brett    | 0   | 0   | 140 | 268 | 400 | 524  | 700  | 889  |

Unter rund 500 px ist das Brett **null Pixel breit**. Nachgewiesen, dass es
vorbestehend ist: mit `git stash` auf den Stand von `355d18b` zurück, dieselbe
Messung im Iframe — Brett 0×816, `.terrain` 0 (der Stash griff also wirklich).
Danach `git stash pop`.

Das ist **nicht** in diesem Zug behoben: die Ecken-Ablage neben dem Brett ist
eine bewusste Entscheidung aus `etappe-10`, und sie auf schmalen Geräten
aufzulösen ist ein eigener Entwurf (die Ablagen müssten unter das Brett
wandern), keine Zeile im Stilblatt. Es steht hier, damit es beim nächsten Mal
nicht wieder als „ungesehen" durchgeht.

### Nächste Etappe

Etappe 10 (Erweiterungen) — unverändert. Davor lohnt der Spielbildschirm auf
schmalen Geräten: er ist unter ~500 px Breite gemessen unbedienbar.

## Ein Winkel für alles: Ziffern, Seekarte, Fase (2026-08-20, `main`)

Stand: nach `9f46423`. Die Frage war nicht, ob die Oberfläche funktioniert — sie
tut es —, sondern warum sie trotz aller Arbeit brav aussieht. Der Blick in den
Browser hat es in einem Bild beantwortet: gezeichnetes Gelände mit Tannen,
Zacken und Furchen, und darauf sitzen die Zahlenchips in **`Segoe UI Bold`**.
Das meistbetrachtete Ding einer Partie war das einzige, das nach Webseite
aussah.

Der Befund dahinter ist größer. `Wordmark.tsx` hat dem Spiel ein eigenes
Buchstabensystem gegeben — Versalhöhe 100, Stammbreite 17, Fase 17 außen und 10
innen, „aus demselben Winkel geschnitten wie das Brett". Es stand **genau
einmal** auf dem Hauptmenü und danach nie wieder. Ein guter Titel über einer
Anwendung ist kein System.

Drei Züge, alle aus diesem einen Winkel:

1. **Die Ziffern** (`type/Numerals.tsx`) — zehn Zeichen auf dem Raster der
   Wortmarke, auf dem Zahlenchip und an der Würfelsumme.
2. **Die Seekarte** (`screens/SeaChart.tsx`) — Rhumbenlinien unter Brett und
   Aufbau, statt eines leeren Radialverlaufs auf dem größten Anteil des Bildes.
3. **Die Fase** — `corner-shape: bevel` auf allem Bedienbaren, statt des einen
   Radius, der überall passt und nirgends gemeint ist.

### Abnahme

| Prüfung             | Ergebnis                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                         |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 326 / 35       |
| `pnpm build`        | grün — `index.js` 418.50 kB (gzip 124.69), `index.css` 37.12 kB (8.46) |
| `pnpm format:check` | grün                                                                   |
| Browser             | 1184×615 und 380×740: Menü, Aufbau, lokale Partie bis zum ersten Wurf  |

Zwei neue Tests in `BoardSvg.test.tsx`, zwei bestehende umgehängt. Der Zuwachs
ist echt und nicht nur Umbau: dass auf einem Chip **die richtige Zahl** steht,
stand vorher nirgends — geprüft war nur die Markierung „heiß".

### Die Ziffern: dieselbe Begründung, die die Augen schon hatten

Die Punkte unter der Chipzahl sind in `d05ab4c` gezeichnete Kreise geworden, und
der Grund stand schon damals da: **eine gezeichnete Form hat keine Metrik, die
eine fehlende Schrift verändern könnte.** Für die Zahl darüber galt derselbe
Satz die ganze Zeit mit — sie war nur nicht drangekommen. Jetzt ist sie es, und
damit fallen `.chip text` und `.chip text.chip__hot` ersatzlos weg: genau die
zwei Regeln, an denen sich die Spezifitätsfalle aus `CLAUDE.md` zweimal
geschlossen hat. Was am Element steht, kann kein Selektor mehr überholen.

**Alle zehn Ziffern haben denselben Vorschub (81), auch die schmale Eins.** Bei
den Buchstaben ist er je Zeichen verschieden; hier wäre das ein Fehler. Regel 3
verlangt Tabellenziffern, und „11" darf gegen „10" auf dem Nachbarchip nicht
wackeln.

### Ohne Browser gezeichnet — und trotzdem nachgesehen

Zehn Ziffern von Hand als Pfaddaten zu schreiben und zu hoffen, ist keine
Methode. Solange die Chrome-Erweiterung nicht verbunden war, ist deshalb erst
ein **Scanline-Füller** entstanden, der `M/H/V/L/Z` nach even-odd rastert und
als ASCII ausgibt. Er hat sich sofort bezahlt gemacht: sechs Ziffern saßen, drei
nicht. Die **1** hatte eine zu kurze Fahne, die **3** eine so tiefe Taille, dass
sie in Richtung „8" kippte, und die **7** stand mit dem Fuß so weit links, dass
sie aus ihrem Vorschub fiel. Alle drei waren im ASCII in einem Blick zu sehen —
und keine davon hätte ein Test gefunden.

Später kam der Browser doch, und die Erweiterung hat ihre eigene Falle
mitgebracht: der Viewport steht fest auf einer Größe, die `resize_window` nicht
ändert, und **nach jedem `zoom` liefert `screenshot` weiter dessen Ausschnitt** —
zweimal sah es aus, als sei die Seite zusammengebrochen. Beides löst ein neuer
Tab; für echte Fensterbreiten bleibt der Iframe-Trick aus `9f46423`.

### Die See war der größte leere Anteil des Bildes

Der Spielbildschirm gibt dem Brett die Höhe und schiebt die Ablagen in die zwei
unteren Ecken. Was dabei entsteht, sind links und rechts Streifen von je
mindestens 236 px, dazu der Rand oben — zusammen rund ein Drittel der Fläche,
und darauf stand ein Radialverlauf.

Was dort jetzt liegt, ist nicht Zierat, sondern Material: das Netz der
Kompasslinien ist **das** Kennzeichen einer Seekarte, und um dieses Brett herum
ist Wasser mit Häfen daran. Sechzehn Peilungen, neun Knoten, und alle Knoten
benutzen **dieselben** Richtungen — das ist der Punkt an einer Rhumbenlinie, sie
hält ihre Peilung, und deshalb verzahnt sich das Netz, statt sternförmig zu
zerfallen. **Der Hauptknoten sitzt in der Mitte, also unter dem Brett:** die
Linien kommen nicht irgendwoher, sie kommen unter der Insel hervor.

Acht Nebenknoten und nicht sechzehn wie in der Vorlage. Die Vorlage ist auch das
ganze Blatt und hat kein Brett in der Mitte; bei sechzehn wird aus dem Netz ein
Gewebe, und ein Gewebe trägt Textur — dann streitet die See mit dem Gelände
darauf (Regel 4).

**Auf dem Startbildschirm hängt eine engere Maske**, und das ist der Unterschied
zwischen Wasser und Tapete. Mit der Maske des Spielbildschirms liefen die Linien
quer durch Überschrift und Formular; ein Netz unter einem Text ist keine Karte
mehr, sondern Zierat hinter einer Auskunft (Regel 6). Es bleibt jetzt bei der
Ecke, in der wirklich See ist.

### Die Fase kostet keinen Schatten — und das war die Bedingung

`clip-path` hätte dieselbe Form gemacht **und den Kontaktschatten
mitgeschnitten**, und der ist der ganze Unterschied zwischen „liegt auf dem
Tisch" und „ist ein Rechteck". `corner-shape: bevel` schneidet stattdessen die
Ecke, die `border-radius` ohnehin schon vermaßt hat: kein Betrag ändert sich,
`box-shadow` folgt der neuen Kontur von selbst, und wo die Eigenschaft fehlt,
bleibt die Ecke rund — also der Stand von vorher, kein Ausfall.

Geschnitten wird nicht alles. **Karten, Würfel, Zahlenchips und Bauteile
behalten ihre Form**, weil sie Spielmaterial sind und sie aus der Wirklichkeit
haben — eine Spielkarte mit geschnittenen Ecken ist keine Karte mehr, sondern
ein Plättchen. Die Trennlinie ist damit eine Auskunft und kein Geschmack:
gedrucktes Papier gegen gestanzte Bedienung.

### Zwei Fehler, gemessen statt geahnt

**Der eine ist älter als diese Arbeit.** Die Würfelsumme stand mit **1.13:1** auf
der Tiefsee, die Aufforderung „Würfeln" daneben mit **2.5:1**. Die Ursache steht
seit `9b51b83` im Blatt — und zwar als Kommentar, der beschreibt, was gerade
nicht passiert ist: an `.dice--waiting` heißt es, die zwei `--ink`-Zeilen seien
gefallen, weil dunkle Tinte auf der Tiefsee „dieselbe unsichtbare Schrift" wäre.
Gefallen sind sie; **umgestellt wurde nichts**, und ohne Umstellung fällt `--ink`
auf den Grundwert aus `:root` zurück — und der ist dunkel.

Die Lehre ist nicht die Farbe, sondern der Satz daneben: **ein Kommentar, der
eine Absicht beschreibt, ist kein Nachweis, dass sie im Blatt steht.**
Aufgefallen ist es erst, als die Summe eine gezeichnete Form wurde und jemand
nachgesehen hat, ob sie ankommt. Die Zeilen stehen jetzt an `.dice-tray` und
nicht an `.dice`: die Aufforderung ist eine Schwester der Würfel und keine
Tochter, am Becher gesetzt hätte die Umstellung die Summe geholt und das Wort
daneben stehen lassen — der halbe Fix, der aussieht wie ein ganzer. Gemessen
jetzt **11.18:1** und **5.83:1**, der Würfel behält seine dunkle Tinte lokal
(15.28:1 auf Pergament).

**Der andere war frisch und selbst gemacht.** `.sea-chart` trug `inset: -0.75rem`,
um das Polster von `.game` auszugleichen. Der Startbildschirm hat kein Polster,
die Regel aber trotzdem geerbt: das Netz ragte dort 12 px über jede Seite hinaus
und schob der Seite einen **waagerechten Rollbalken** unter — Regel 7, und
ausgelöst von einem Element, das man nicht einmal anfassen kann. Der Ausgleich
steht jetzt dort, wo das Polster steht (`.game .sea-chart`), und nicht im
Bauteil. Gemessen auf allen drei Bildschirmen und bei 380 px: `scrollWidth -
clientWidth` = 0.

### Offene Punkte

- Die Hafenmarken (`2:1`, `3:1`) stehen weiter in `Segoe UI` — mitten auf dem
  Brett, neben den gezeichneten Chipzahlen. Sie brauchen einen Doppelpunkt, den
  das Ziffernraster nicht kennt.
- Kleine laufende Zahlen (`0 SP`, `0 Karten`, die Bauvorräte) bleiben
  Fließtext. Das ist Absicht — eine Anzeigeschrift mitten im Satz ist keine
  Persönlichkeit, sondern ein Setzfehler —, aber es ist eine Grenze, die jemand
  anders ziehen könnte.
- `corner-shape` ist jung. Wo es fehlt, ist die Ecke rund; geprüft wurde nur in
  Chrome 151.
- Die Deutlichkeit des Netzes (7 % Strahlen, 5 % Ring) ist am Auge gesetzt und
  nicht gemessen. Sie liegt bewusst unter jeder Kontrastnorm — sie trägt keine
  Information.

### Nächste Etappe

Etappe 10 (Erweiterungen) — unverändert. Der schmale Spielbildschirm aus dem
Nachtrag zu `9f46423` steht weiter davor: unter rund 500 px ist das Brett 0 px
breit, und das ist ein eigener Entwurf und keine Zeile im Stilblatt.

## Das Gelände kommt an: Textur, Deckung, Küste (2026-08-20, `main`)

Stand: nach `0b72a31`. Der Auftrag war „das Spielfeld ist ein bisschen
charakterlos, der Stil ist aber gut" — also nicht die Farbwelt umwerfen,
sondern herausfinden, warum die Handschrift, die Wortmarke und Ziffern
inzwischen haben, an der Feldkante aufhört.

Die Antwort war eine Messung und keine Geschmacksfrage.

### Der Befund: die Textur stand im Blatt und kam nie an

Bei 65 Pixeln je Bretteinheit — das Brett stand in einem 1184er Fenster auf
644 Pixeln — war der Texturstrich **0.78 Pixel** breit. Unterhalb eines Pixels
zeichnet der Browser nicht dünner, sondern blasser: er verteilt den Strich auf
zwei Pixelreihen und rechnet die Deckung herunter. Von den 17 Prozent im Blatt
kamen rund 13 an, auf einem Waldgrün, gegen das sie ohnehin nur **1.23:1**
standen. Eine Tanne war dabei **6.8 Pixel** hoch.

Die Textur war also nicht „leise" (so stand es im Kommentar) — sie war **weg**,
und das Feld las sich als Farbfläche mit einer 1.56 Pixel starken Kante drum
herum. Das Stärkste am Feld war seine Grenze. Genau daher der Eindruck
„Farbraster statt Landschaft".

**Ein Kommentar, der eine Absicht beschreibt, ist kein Nachweis, dass sie
ankommt** — die Falle steht seit zwei Etappen in `CLAUDE.md`, und sie hat hier
ein drittes Mal zugeschnappt, diesmal nicht über Spezifität, sondern über
Subpixel.

### Drei Züge

1. **Der Strich auf 0.02** (1.3 Pixel). Das ist die Untergrenze, ab der eine
   Deckkraft überhaupt bedeutet, was dasteht.
2. **Die Stärke je Gelände**, gegen den eigenen Grund gerechnet statt einmal
   für alle geraten — und die Richtung nach der Helligkeit des Grundes.
3. **Ein Küstensaum** aus drei Untiefen, statt allein eines Schlagschattens.

### Die Tinte: eine Farbe ist nicht sechsmal dieselbe Textur

Die alte Einheitstinte stand auf der Wüste bei 1.41:1 und auf dem Wald bei
1.23:1 — dort, wo das Feld am dunkelsten ist und die Unterscheidung am
nötigsten wäre, war sie am schwächsten. Jeder Zielwert ist jetzt ausgerechnet
(Luminanz nach WCAG, Tinte über Grund gemischt).

**Die Richtung folgt aus der Helligkeit und aus nichts sonst.** Auf dem Wald
(Luminanz 0.114) braucht dunkle Tinte 46 Prozent für das, wofür helle 20
genügen; eine dunkle Marke auf einem dunklen Feld wird zum Loch, bevor sie
sichtbar wird. Wald und Hügel zeichnen deshalb in Pergament, die vier helleren
Gelände in Tiefsee-Tinte. Dieselbe Rechnung wie bei der Straßenkontur: was auf
jedem Untergrund gelten soll, richtet sich nach dem Untergrund.

### Der zweite Befund: Dichte ist nicht Kontrast

Mit sechsmal 1.50 im Blatt sahen Hügel und Acker am Bildschirm trotzdem
deutlich lauter aus als der Rest. Nachgemessen (Pfadlänge mal Strichbreite,
bei gefüllten Marken die Fläche des abgetasteten Umrisses, gegen die
Kachelfläche) belegt der Ziegelverband **25.3 Prozent** seiner Kachel, der Wald
**9.8** — Faktor 2.58. Ein Muster aus durchlaufenden Linien füllt eine Fläche,
ein Muster aus vereinzelten Marken tupft sie an; derselbe Kontrast je Strich
ergibt dann nicht dieselbe Textur.

Gedämpft wird mit `sqrt(11.2 / Deckung)`, gedeckelt bei 1 — die dichten
Gelände werden leiser, die dünnen nicht lauter. **Die Wurzel ist ein Kompromiss
und wird im Blatt auch so genannt:** voll linear korrigiert wäre der
Ziegelverband auf 1.22 gefallen, also fast zurück auf den Zustand, den diese
Etappe beheben sollte.

| Gelände   | Deckung | Dämpfung | Ziel  | Alpha | Tinte     |
| --------- | ------- | -------- | ----- | ----- | --------- |
| forest    | 9.8 %   | 1.000    | 1.500 | 20 %  | Pergament |
| pasture   | 12.0 %  | 0.965    | 1.483 | 23 %  | Tiefsee   |
| mountains | 12.0 %  | 0.969    | 1.484 | 26 %  | Tiefsee   |
| desert    | 15.9 %  | 0.841    | 1.421 | 19 %  | Tiefsee   |
| fields    | 17.7 %  | 0.797    | 1.398 | 19 %  | Tiefsee   |
| hills     | 25.3 %  | 0.666    | 1.333 | 19 %  | Pergament |

### Was der Blick aus der Nähe noch gefunden hat

Die viewBox lässt sich als Zoom benutzen — echtes SVG-Zoom, das alles korrekt
größer rendert, im Gegensatz zum `zoom` der Chrome-Erweiterung, der weiter den
alten Ausschnitt liefert. Vergrößert kamen zwei Dinge heraus, die im Ganzen
nicht auffielen:

- **Der Acker war ein Streifenmuster.** Zwischen zwei Furchen lag weniger als
  das Vierfache der Strichbreite — dicht genug, dass das Auge es als Flimmern
  liest statt als Furche. Kachelhöhe von 0.09 auf 0.115, und die Auslenkung ist
  mitgewachsen: eine flachere Welle in einer höheren Kachel wäre eine gerade
  Linie geworden.
- **Die Weide war mit Vögeln bestreut.** Drei gerade Halme aus einem Punkt,
  symmetrisch und gleich lang, sind kein Büschel, sondern ein **Ypsilon**. Die
  äußeren Halme sind jetzt Bögen; der mittlere bleibt gerade, denn drei Bögen
  wären eine Palme.

### Die Küste: erst ein Glow, dann eine Karte

Der Schlagschatten sagt „die Landmasse liegt auf der See". Er sagt nichts
darüber, **was** die See ist — und der Hintergrund tut das bereits, mit
Rhumbenlinien und Kompassrose. Es fehlte der Übergang.

Die Säume sind kein eigener Umriss der Landmasse, sondern dieselben neunzehn
Sechsecke noch einmal, als breite Kontur und unter den Feldern: was nach innen
ragt, verschwindet unter den Nachbarn, sichtbar bleibt der Überstand zur See.
Damit skalieren sie **mit** dem Brett, anders als der Schlagschatten — richtig,
denn sie gehören zur Karte, nicht zum Licht im Raum.

**Der erste Versuch war ein Glow.** Gleichmäßig verteilte Breiten und
Deckkräfte (0.34/0.20/0.10 bei 7/10/15 Prozent) liefen zu einem weichen hellen
Schein zusammen — genau das, was Designregel 5 hinauswirft. Was Wasser um eine
Küste tut, ist etwas anderes: unmittelbar am Land flach und deutlich, nach
außen sich verlierend. Das innerste Band ist deshalb schmal und mit Abstand das
kräftigste (0.07 bei 26 Prozent).

Die Deckkraft steht an der **Gruppe** und nicht am Strich: neunzehn Konturen
überlappen sich an jeder Feldecke, und zwei halbdurchsichtige Striche
übereinander sind dunkler als einer — am Strich gesetzt zeigte die Küste an
jeder Ecke einen Knoten.

### Ein fremder Testfehler, den die neue Last aufgedeckt hat

`pnpm test` fiel plötzlich in `StartScreen.test.tsx`, mit Werten wie
`"weiAnna"` und `"eiAnna"` — Restzeichen aus einem **vorherigen** Tippvorgang
(`brett-zwei`), die verspätet im nächsten Feld landeten. Der fallende Test
wechselte von Lauf zu Lauf.

**Gemessen statt vermutet:** auf dem gestashten Stand, ohne eine einzige
Änderung am Brett, fielen **zwei von drei** vollen Läufen. Der Fehler war
vorher da; die vier neuen Tests haben nur die Last erhöht, unter der er
sichtbar wird. Der grüne Lauf zu Beginn der Etappe war Glück.

Zwei Ursachen greifen ineinander, und die erste Kur hat nur die erste
erwischt (danach fiel noch einer von vier Läufen):

1. Die **Direkt-API** von user-event legt für jeden Aufruf eine neue Sitzung
   an; `clear` und `type` teilen deshalb keinen Zustand, und was die eine an
   Tastendrücken in der Schlange hat, weiß die andere nicht. Dazu setzt
   user-event echte Verzögerungen zwischen Tastendrücke — auf einer ruhigen
   Maschine unsichtbar, unter 35 parallelen Testdateien nicht mehr. Kur: eine
   gemeinsame Sitzung mit `delay: null`.
2. Das Feld ist **kontrolliert**, sein Wert kommt aus dem React-Zustand
   _zurück_. Wer unmittelbar nach dem Tippen das Brett ausliest, liest im
   Zweifel das von vorher — und `zeichnet zu einem anderen Seed ein anderes
Brett` vergleicht dann zweimal dasselbe. Kur: auf den Wert im Feld warten,
   denn er stammt aus demselben Zustandswechsel wie das Brett.

Danach fünf von fünf Läufen grün.

### Ein Befund, der offen bleibt

Beim Messen der schmalen Fenster (Iframe-Trick) kam heraus, dass der bekannte
Layout-Befund **schlimmer ist als bisher notiert**. Weiter oben stand „unter
~500 px Breite unbedienbar"; gemessen wird das Brett schon weit vorher
unbrauchbar klein:

| Fenster | Brett  |
| ------- | ------ |
| 1184 px | 684 px |
| 900 px  | 400 px |
| 700 px  | 200 px |
| 560 px  | 60 px  |
| 480 px  | 0 px   |

Bei 900 px Fenster ist der Texturstrich wieder unter einem Pixel — aber das ist
kein Texturbefund, sondern eine Folge davon, dass das Brett dort schon zu klein
zum Spielen ist. Repariert wird die Ursache; die Textur zu deckeln wäre ein
Pflaster auf dem falschen Problem. Der Befund gehört vor Etappe 10.

### Abnahme

| Prüfung             | Ergebnis                                                                              |
| ------------------- | ------------------------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                                        |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 330 / 35                      |
| `pnpm test` fünfmal | grün, fünf von fünf (vorher fielen zwei von drei)                                     |
| `pnpm build`        | grün — `index.js` 419.02 kB (gzip 124.87), `index.css` 37.58 kB (8.56)                |
| `pnpm format:check` | grün                                                                                  |
| Browser             | Gründungsphase durchgeklickt: Straßen und Häuser lesen auf der lauteren Textur sauber |

Vier neue Tests. Zwei halten die Kacheln (jede trägt ihre Geländeklasse — die
Kopplung ins Blatt ist eine Zeichenkette und bricht sonst still; und keine
Kachel schrumpft wieder unter die Größe, bei der eine Form eine Form bleibt).
Zwei halten die Küste: dass die Säume **unter** den Feldern liegen (rutschen
sie dahinter, liegt ein Pergamentschleier über dem ganzen Brett) und dass jedes
Band jedes Feld säumt und von außen nach innen schmaler wird.

## Drei Befunde aus dem Playtest: Raster, Stapel, Bumerang (2026-08-21, `main`)

Drei Dinge am Tisch bemängelt, drei Ursachen, die alle drei messbar waren und
keine davon Geschmack.

### 1. „Alles zu symmetrisch in den Feldern"

Und Acker und Wüste trugen obendrein **dieselbe** Textur: beide eine
durchlaufende Sinuswelle, einmal 0.3 breit und einmal 0.34. Zwei verschiedene
`d`-Zeichenketten, dieselbe Form — der Unterschied lag allein in der Füllfarbe,
und damit war die Textur genau dort wirkungslos, wo sie gebraucht wird. Farbe
ist nie der einzige Träger (Designregel 7).

Der Rastereindruck hatte drei Ursachen:

1. **Eine Kachel wiederholt sich, und zwar exakt** — das ist die Definition von
   `<pattern>` und keine Schwäche der Zeichnung. Bei 0.4 Breite passte die
   Waldkachel gut viermal in eine Feldbreite; das Auge braucht drei
   Wiederholungen für ein Raster und bekam vier.
2. **Gleich große Marken sind ein Gitter**, auch wenn sie unregelmäßig stehen —
   drei Tannen derselben Höhe lesen sich als Punktraster mit Jitter.
3. **Eine gespiegelte Marke ist die symmetrischste Form überhaupt.** Die
   Gebirgszacken waren gleichschenklige Winkel, also viermal dieselbe Figur.

Behoben in dieser Reihenfolge:

- **Zwei Lagen je Gelände mit teilerfremden Perioden.** Wald ist 0.62 breit,
  seine Streulage 0.97; dasselbe Bild kommt erst nach 0.62 × 97 = 60 Einheiten
  wieder. Das Brett misst sieben — es gibt auf ihm keine zweite Stelle, die
  aussieht wie eine erste. Kein `Math.random()`: Zufall in der Zeichnung wäre
  ein Bild, das bei jedem Rendern anders aussieht.
- **Die Streulage trägt die größten Marken** und ist dünn besetzt — der alte
  Baum, der Doppelgipfel, der Dünenkamm, der Feldstein. Größe als Unterschied
  wirkt nur, wenn das Große selten ist.
- **Marken in verschiedenen Größen und Arten je Kachel.** Wald: sechs Tannen
  von 0.1 bis 0.2, und `spread` variiert dazu die Breite je Höhe — ohne den
  zweiten Freiheitsgrad ist jede Tanne dieselbe Tanne in einem anderen Zoom.
  Neben den Graten liegt Geröll, neben den Furchen Stoppeln, neben den Rippeln
  Kiesel.
- **Kein Grat ist mehr gleichschenklig**; welche Flanke länger ist, wechselt.
- **Der Ziegelverband ist wild statt regelmäßig** — vier Lagen von 0.09 bis
  0.115 Höhe, zwei bis drei Steine je Lage, jeder anders lang. Der alte halbe
  Versatz war ein Läuferverband, und ein Läuferverband ist gerade _das_ Gitter.
  Keine Fuge liegt mehr auf der Kachelkante: eine Linie bei y = 0 wird von der
  Kachel halbiert und käme schmaler heraus als ihre Nachbarinnen.
- **Die Wüste ist neu gezeichnet:** gebrochene Rippel in fünf Längen plus zwei
  Kiesel. Durchlaufend gegen gebrochen liest man auch leise — und das ist der
  Unterschied zum Acker, den vorher nur die Farbe machte.

**Drei neue Prüfungen, und alle drei hätten den alten Stand gefangen:**

- dass die zwei Lagen sich erst nach mehr als zwölf Einheiten gemeinsam
  wiederholen (sonst ist die zweite Lage nur eine zweite Kachel — 0.6 und 0.9
  sieht harmlos aus und fällt auf 1.8),
- dass die Marken einer Kachel mindestens anderthalbfach verschieden groß sind,
- dass die **größte** Marke eines Geländes in keinem anderen noch einmal
  vorkommt, **formgleich geprüft und nicht zeichengleich**: jede Marke wird auf
  ihren eigenen Rahmen normiert, Größe und Ort fallen heraus. Genau daran wäre
  Acker/Wüste gescheitert. Die Kontrollpunkte zählen dabei mit — die alte
  Ackerwelle hatte drei Stützpunkte auf einer Geraden, ihre ganze Welle steckte
  in den Kontrollpunkten.

### 2. Die Kartenstapel fächern beim Darüberfahren auf

Für alle drei Stapel an _einer_ Stelle im Blatt: Rohstoffe in der Hand,
Entwicklungskarten daneben, Kaufstapel in der anderen Ecke. Drei Pixel zur
Seite, drei nach oben und zwei Grad je Lage, Drehpunkt unten in der Mitte — die
Bewegung, mit der man einen Stapel mit dem Daumen aufspreizt. Sie erklärt, was
die Plakette behauptet: dass darunter noch welche liegen.

**Der Versatz musste dafür erst aus dem `style`-Attribut heraus.** Er stand als
fertiges `transform` an jeder Karte, und ein Inline-Stil schlägt jede Regel im
Blatt — die Fächerregel wäre gelaufen und hätte nichts bewirkt. Das ist die
Falle aus `CLAUDE.md` in der anderen Richtung (dort schlägt eine CSS-Regel ein
SVG-Attribut); das Ergebnis ist dasselbe: eine Regel, die dasteht und nie
greift. Übergeben wird jetzt nur `--i`, die Lage im Stapel.

**`--fan` ist ein Schalter (0/1) und keine Strecke.** Der Grund steht bei
`prefers-reduced-motion`: Bewegung abbestellen heißt, den Schalter
zurückzulegen. `transform: none` hätte alle Karten aufeinandergelegt — aus einem
Stapel wäre eine Karte geworden, und das ist keine ruhigere Oberfläche, sondern
eine falsche. Hätte der Fächer seine Zielwerte selbst geführt, müsste die
Ruhelage dort ein zweites Mal stehen; zwei Stellen mit denselben Zahlen laufen
auseinander.

Dazu hebt sich die oberste Karte um zwei Pixel und der Schatten geht von
`--lift` auf das neue `--lift-raised` — ohne ihn ist die Verschiebung nur eine
Verschiebung und keine Höhe. Beim spielbaren Ring musste die Spezifität
nachgezählt werden: `box-shadow` ist eine Eigenschaft und keine Liste, die
Anhebe-Regel wirft den Ring mit weg. Die Ausnahme hat dieselben drei Klassen
und steht **später** — das ist der ganze Ausschlag.

### 3. Was eine Entwicklungskarte tut, steht jetzt auf dem Bildschirm

Der Satz stand im `title` und war damit praktisch nicht da: ein
Browser-Kurzhinweis kommt nach rund einer Sekunde Stillstand, in der Schrift des
Betriebssystems — und auf einem **gesperrten** Knopf in den meisten Browsern gar
nicht. Ausgerechnet die gesperrte Karte ist die, bei der man nachliest; die
spielbare drückt man.

Jetzt eine Zeile über der Reihe: Name als Eyebrow, darunter der Satz. **Über der
Reihe und nicht an der Karte** — ein Zettel an der Karte wäre 4.6rem breit und
deckte beim Ritter fünf Zeilen lang die Nachbarn zu. **Absolut gesetzt**, damit
die Karten nicht rücken, wenn er kommt und geht: eine Erklärung, die den Stapel
verschiebt, auf den man gerade zielt, nimmt einem das Ziel weg. `pointer-events:
none`, sonst flackerte sie an ihrer eigenen Unterkante.

**Zeigen und Verbergen hängen am Listeneintrag, nicht am Knopf** — ein gesperrter
Knopf feuert keine Mausereignisse. `onFocus`/`onBlur` daneben, weil eine
Erklärung, die nur die Maus findet, für die Tastatur nicht existiert; dazu
`aria-describedby` an jeder Karte, damit sie auch ohne Zeigegerät da ist.

### 4. Der Wurf sah aus wie ein Bumerang — und das war die Verteilung

„Kurz zur Mitte fliegen und dann zurück bouncen." Anfang und Ende sind derselbe
Ort, die Bahn muss also umkehren; ob das nach Wurf oder nach Gummiband aussieht,
entscheidet allein, **wo** der Rückweg stattfindet.

**Gemessen, nicht vermutet** (Animation angehalten und Bild für Bild
ausgelesen):

| Zeit | alt: x / y      | neu: x / y      |
| ---- | --------------- | --------------- |
| 13 % | —               | −363 / −220     |
| 15 % | −244 / **−271** | —               |
| 26 % | —               | −461 / **−293** |
| 30 % | −461 / −293     | —               |
| 42 % | —               | **−313 / 0**    |
| 52 % | **−89 / 0**     | −201 / −18      |
| 63 % | −42 / **−82**   | —               |
| 66 % | —               | −49 / 0         |

Zwei Fehler stehen in dieser Tabelle:

1. **Der Aufschlag lag zu spät und zu nah.** Von 460 Pixeln Rückweg lagen 370 in
   der Luft und 90 auf dem Tisch — man sah einen Bogen hin und einen Bogen
   zurück. Jetzt schlägt er bei 42 % auf und weit draußen (−313), und die
   restlichen 58 % der Zeit rollt er über den Tisch. Das ist die längste
   zusammenhängende Bewegung des ganzen Wurfs.
2. **Der Aufstieg war viel zu schnell und die Sprünge viel zu hoch.** Nach der
   Hälfte der Steigzeit stand der Würfel auf 92 % der Höhe und hing dann oben
   herum; ein geworfener Körper ist zur Halbzeit auf drei Vierteln (`v·t −
g·t²/2`), jetzt sind es 75 %. Und der zweite Sprung stand auf 0.28 des
   Scheitels, also **82 Pixel** — ein Wurf, kein Aufprall. Die Sprunghöhen
   stehen jetzt in `rem` und nicht im Verhältnis zum Scheitel: wie hoch ein
   Würfel zurückkommt, hängt an ihm und nicht daran, wie weit jemand ihn
   geworfen hat. 24, 10, 4 Pixel — je gut vier Zehntel des vorigen.

Dafür ist der Wurf von **einem** `transform` auf **vier Lagen** gegangen: Weg,
Sprung, Drehung, Schatten. In einem `transform` haben die vier nur _eine_
Zeitkurve, und dann sieht jede aus wie der Mittelwert der drei anderen. Getrennt
bekommt jede ihre eigene — waagerecht Reibung, senkrecht Schwerkraft (hinauf
`ease-out`, herunter `ease-in`, je Halbwelle einzeln).

**Der Schatten ist der eigentliche Tisch.** Er hängt an der waagerechten Bahn
und nicht am Sprung: er folgt dem Wurf, aber nicht der Höhe — genau das macht
ihn zur Fläche, auf der etwas liegen kann. Weit und blass heißt „weit oben", eng
und dunkel heißt „gleich aufgeschlagen". `translateZ(-2.2rem)` statt `z-index`:
in einem `preserve-3d`-Raum sortiert der Browser nach Tiefe, ein `z-index` ist
dort wirkungslos, und der Schatten schnitte quer durch den Würfel.

**Die Drehung rollt jetzt, statt zu taumeln.** Bis zum Aufschlag drehen sich
beide Achsen, danach steht `--fx` fest und nur noch `rotateY` läuft — in
Vierteln (270, 180, 90, 0) und auf denselben Prozentzahlen wie die Aufschläge:
ein Würfel kippt beim Aufsetzen und nicht dazwischen.

`THROW_MS` ist von 1080 auf 1180 mitgewachsen. Es ist die einzige Kopplung
zwischen Blatt und Ablauf und bricht still.

### Abnahme

| Prüfung             | Ergebnis                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                           |
| `pnpm test`         | grün — shared 579 / 35 Dateien, server 163 / 20, client 335 / 35         |
| `pnpm build`        | grün — `index.js` 422.14 kB (gzip 125.50), `index.css` 41.69 (9.07)      |
| `pnpm format:check` | grün                                                                     |
| Browser             | Brett im Spiel angesehen; Wurfbahn angehalten und Bild für Bild gemessen |

Neun neue Tests. Fünf halten die Textur (beide Lagen je Gelände, das gemeinsame
Vielfache der Perioden, der Größenunterschied in der Kachel, die eigene
Leitmarke je Gelände, die Kachelgrößen jetzt für beide Lagen). Drei halten die
Erklärzeile (sie kommt und geht, sie kommt **auch an der gesperrten Karte**, und
der Satz hängt zusätzlich ohne Maus an jeder Karte). Einer hält die Grenze
zwischen Komponente und Blatt: die Karte sagt, _wo_ sie im Stapel liegt, das
Blatt entscheidet, _was_ daraus wird.

### Was offen bleibt

Der Layout-Befund von gestern steht unverändert: unter rund 900 px Fensterbreite
ist das Brett zu klein zum Spielen. Er gehört weiter vor Etappe 10.

## Der Auftakt: ausgewürfelt, wer beginnt (2026-08-22, `auftakt-karten-schmale-geraete`)

Stand: nach `496843d`. Eine Partie fing bis hierher damit an, daß Spieler 1
setzt — und Spieler 1 war, wer im Wartebereich zuerst geklickt hatte. Der beste
Startplatz auf dem Brett gehörte damit der schnellsten Hand. Jetzt wird
ausgewürfelt.

Drei Entwürfe sind an diesem Tag entstanden (`docs/superpowers/specs/2026-08-22-*`),
umgesetzt ist bislang der erste. Die anderen zwei — Entwicklungskarten vor dem
Wurf, schmale Geräte — haben ihre Pläne und warten.

### Eine Phase, aber keine Aktion

Der Auftakt ist eine Phase vor der Gründung: `rolls` für die laufende Runde,
`pending` als Warteschlange, `round` für das Stechen. Als Phase und nicht als
Feld daneben, aus demselben Grund, den `phase.ts:56` schon für `tradePending`
nennt — während ausgewürfelt wird, ist jede andere Aktion verboten, und als
Phase ist ein zu früh gesetztes Haus derselbe gewöhnliche Regelverstoß wie
jeder andere.

**Eine neue Aktion gibt es dagegen nicht.** `rollDice` bedeutet, was die Phase
sagt, und verzweigt an genau einer Stelle in `applyAction`. Das ist der Grund,
warum Protokoll, Envelope, Serverräume, `legalActions` und die Wurfbahn im
Client unverändert bleiben konnten: `rollDice` steht dort schon überall. Eine
zweite Aktion `rollForOrder` hätte in acht Dateien einen Zwilling gebraucht,
der dasselbe tut.

Wer am höchsten wirft, rückt in `players` auf Index 0. Bei Gleichstand stechen
nur die Gleichen, so oft wie nötig.

### Der Verdacht, der keiner war — und der, der einer war

**Die Rotation färbt niemanden um.** Farbe und Name hängen am `Seat` und werden
per Id nachgeschlagen (`seats.ts`), nicht über den Index in `players`. Im
Browser nachgemessen, nachdem Spieler 2 mit einer 8 gewonnen hatte: Spieler 2
`rgb(44,111,187)`, Spieler 3 `rgb(224,138,46)`, Spieler 1 `rgb(192,57,43)` —
jeder behielt seine Farbe, obwohl die Liste sich gedreht hat.

**Der Entwurf hatte dafür an anderer Stelle unrecht.** Er behauptete, die
Würfel flögen „ohne eine neue Zeile", weil der Auftakt `lastRoll` setzt. Das
stimmte nicht: `cameFromRoll` erkannte einen Wurf allein daran, daß er
`rollPending` verläßt — und im Auftakt bleibt die Phase dieselbe. Ohne den
neuen Zweig hätte der Auftakt lautlos gewürfelt, die Würfel lägen einfach da.
Woran man ihn jetzt erkennt: die Warteschlange wird kürzer, oder der Auftakt
ist vorbei.

### Was der Umbau gekostet hat

`createGame` startet in der neuen Phase, und das brach **37 Tests** in allen
drei Paketen — erwartet: bis hierher ging jeder Test davon aus, daß Spieler 1
zuerst setzt. Repariert wurde nach einer Regel: `afterOpening(…)` um den Aufbau
legen und alles, was am Index hing, an die Id binden. Die Startphase
zurückzubiegen wäre die zweite Wahrheit gewesen, die dieser Zug gerade
abschafft.

Drei Tests spielen den Auftakt seither **wirklich mit** statt ihn zu
überspringen: die ganze Partie in `shared`, die ganze Partie über die
Klickkarten im Client, und der Raum im Server — letzterer über `applyAction`,
also über den Weg, den ein echter Zug nimmt.

Zwei kleine Helfer sind dabei entstanden, und bewußt zwei: `afterOpening` in
`shared/game/fixtures.ts` und noch einmal in `apps/client/src/test/opening.ts`.
Der `shared`-Helfer steht **nicht im Barrel** — Testmaterial gehört nicht zur
öffentlichen Oberfläche des Pakets —, und diese Grenze aufzuweichen wäre teurer
gewesen als zwölf Zeilen doppelt.

### Abnahme

| Prüfung             | Ergebnis                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                                |
| `pnpm test`         | grün — shared 610 / 36 Dateien, server 163 / 20, client 351 / 36              |
| `pnpm build`        | grün                                                                          |
| `pnpm format:check` | grün                                                                          |
| Browser             | Lokale Partie zu dritt: Auftakt durchgewürfelt, Sieger setzt, Farben gemessen |

Im Browser der Reihe nach gesehen: die Auftakttafel liegt da, bevor irgend
etwas gesetzt werden kann; der Würfelknopf wirkt reihum und die Würfel fliegen
wie im Spiel (Spieler 1 eine 3, Spieler 2 eine 8, Spieler 3 eine 6); danach
steht Spieler 2 vorn und setzt; die Bauleiste meldet „Siedlung: 54 Stellen",
und die Setzung wird angenommen.

**54 Stellen** ist nebenbei der Beleg für den zweiten offenen Entwurf: bei der
ersten Setzung ist wirklich jeder Knoten des Bretts erlaubt, und genau deshalb
ist ein Fingertipp dort mehrdeutig.

33 neue Tests. Sie halten die Reihenfolge (jeder wirft genau einmal, nur der
Vorderste darf), das Stechen (nur die Gleichen, und es endet — über einen
Streifen fester Saaten erzwungen, weil ein Zweig, den die Prüfung nur manchmal
betritt, ungeprüft ist), die Rotation, die Sperre (kein Haus im Auftakt), die
Bestimmtheit, den Verlaufssatz und die Auftakttafel.

### Was offen bleibt

- **Keine Frist im Auftakt.** Wer nicht wirft, hält die Partie an — genau wie
  heute schon in der Gründung. `deadlineOf` kennt weiter nur `tradePending`.
- **Der Layout-Befund** steht unverändert: unter rund 900 px Fensterbreite ist
  das Brett zu klein zum Spielen. Der Entwurf dazu liegt jetzt vor
  (`2026-08-22-schmale-geraete-design.md`), umgesetzt ist er nicht.
- **Entwicklungskarten vor dem Wurf** sind entworfen und geplant, nicht gebaut.

## Entwicklungskarten vor dem Wurf (2026-08-22, `auftakt-karten-schmale-geraete`)

Stand: nach `8278685`. Eine Entwicklungskarte durfte bis hierher erst nach dem
Würfeln gespielt werden. Damit fehlte der Zug, um den es bei der Ritterkarte
eigentlich geht: den Räuber vom eigenen Feld holen, **bevor** die Erträge
fallen.

### Die Freigabe war das Kleinste daran

Drei Eingriffe, und der dritte trägt die anderen.

`canActNow` prüfte für Kauf **und** Ausspielen dieselbe Bedingung („Das geht
erst nach dem Würfeln"). Sie zerfällt jetzt in `canBuyNow` (nur `main`) und
`canPlayNow` (`main` oder `rollPending`). Der Verstoßtext beim Ausspielen sagt
dabei „nur im eigenen Zug" — der alte Satz war ab sofort schlicht nicht mehr
wahr.

**Der eigentliche Eingriff ist `resume` in `robberPending`.** `applyMoveRobber`
setzte hart `phase: { kind: 'main' }`. Solange der Räuber nur nach einer Sieben
oder nach einem Ritter _in_ der Hauptphase wanderte, war das richtig. Ein Ritter
vor dem Wurf wäre über denselben Weg in die Hauptphase gekommen — und der Wurf
dieser Runde wäre **ersatzlos ausgefallen**: Räuber versetzt, geerntet nie,
und niemand hätte gesehen, wo es verlorenging. Die Phase trägt jetzt, was nach
ihr kommt: nach einer Sieben `main`, nach einem Ritter die Phase, aus der er
gespielt wurde.

Kein Feld `rollOwed` daneben, aus dem Grund, den `phase.ts` überall angibt: der
Automat sagte „Hauptphase", das Feld sagte „es fehlt noch ein Wurf", und jede
Regel müßte beide lesen. `resume` beginnt mit dem Umweg und verschwindet mit
ihm.

### Was von selbst kam

Die drei Karten mit Auswahl — Straßenbau, Erfindung, Monopol — brauchten
**keine Zeile**. Sie stehen nicht als fertige Züge in `legalActions` (es wären
dutzende Kombinationen), sondern kommen über `playableDevelopmentCards`, und
das fragt `canPlayDevelopmentCard`. Mit der Trennung von Kauf und Ausspielen
erlaubt es sie von selbst.

**Der Client ebenso.** `view.playableCards` in der `PlayerView` kommt direkt
aus derselben Funktion, und die Hand hat keine eigene Phasenabfrage. Der Plan
hatte für diesen Fall zwei erlaubte Ausgänge vorgesehen; eingetreten ist der
gute. Drei Wächtertests halten fest, daß es so bleibt.

### Abnahme

| Prüfung             | Ergebnis                                                         |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm typecheck`    | grün (`tsc -b`, keine Ausgabe)                                   |
| `pnpm test`         | grün — shared 626 / 36 Dateien, server 163 / 20, client 355 / 36 |
| `pnpm build`        | grün                                                             |
| `pnpm format:check` | grün                                                             |
| Browser             | **nicht** — statt dessen ein Test durch die ganze Oberfläche     |

Die letzte Zeile ist eine Entscheidung und kein Versäumnis. Um im Browser an
eine spielbare Ritterkarte zu kommen, müßte eine Partie bis dorthin gespielt
werden — viele Klicks für einen Blick, der nichts festhält. Statt dessen geht
ein Test den Weg wirklich: über `useLocalGame` den Ritter anklicken, den Räuber
versetzen, gegebenenfalls das Opfer wählen — und dann steht am Statussatz
wieder „muß würfeln". Fiele der Wurf aus, stünde dort „ist am Zug".

Abgelesen wird am **Statussatz** und nicht am Würfelknopf: dessen Beschriftung
kommt vom letzten Wurf („Wurf: 2 und 6, zusammen 8") und nicht von der Phase.
Das war beim Schreiben ein Fehlschlag und ist jetzt ein Kommentar im Test.

13 neue Tests.

### Was offen bleibt

- **Der Layout-Befund.** Unverändert; der Entwurf und der Plan liegen vor.
- **Ein Sieg durch eine Karte vor dem Wurf** ist möglich und richtig — `finalize`
  läuft in `rollPending` genauso. Ein eigener Test dafür steht aus.
