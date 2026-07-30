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
