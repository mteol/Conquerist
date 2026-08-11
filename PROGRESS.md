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
