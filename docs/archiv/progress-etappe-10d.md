# Fortschritt — Etappe 10d-1, 10d-2 und die Regelfragen (Archiv)

## Etappe 10d-1 — Fortschrittskarten: die drei Stapel und die zwanzig Karten des eigenen Zuges (2026-09-02, `etappe-10d-fortschrittskarten`)

Achtunddreißig Commits von `0209003` (Fünfundzwanzig Karten auf drei Stapeln) bis `a26eab8`
(merchantTargets liest jetzt die echte Regel statt sie nachzubauen), dazu die zwei
Plan-Commits `c4e109f` und `61d75df` davor. Plan:
`docs/superpowers/plans/2026-08-31-etappe-10d1-fortschrittskarten.md`, Entwurf weiterhin in
`docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md` (Abschnitte 1.3, 4, 5.1–5.3,
6, 9).

Was jetzt geht: die Fortschrittskarten aus Städte & Ritter. Drei Stapel (Wissenschaft, Handel,
Politik) liegen beim Aufbau gemischt bereit; ein rotes Stadttor auf dem Ereigniswürfel lässt
den Spieler am Zug einen Stapel wählen und ziehen. Alle 25 Karten sind spielbar — als eine
einzige Aktion `playProgress` mit einer eigenen diskriminierten Union, genau wie geplant. Das
Handlimit von vier Fortschrittskarten wirkt über `progressDiscardPending`; wer beim
Aquädukt-Bonus leer ausgeht, wählt jetzt selbst über `aqueductPending`, statt dass eine feste
Regel entscheidet. `defenderPending` löst den Gleichstand beim Barbarenüberfall auf, ebenfalls
als echte Wahl. Am Bildschirm zeigen die drei Stapel ihre Resthöhe, die eigene Hand liegt aus,
und jede Karte lässt sich mit ein bis zwei Klicks spielen — Bischof, Diplomat, Intrige,
Erfinder, Ingenieur, Medizin, Schmied und Straßenbau laufen über dieselbe „erst was, dann
wo"-Abstraktion (`pickMode.ts`) wie zuvor schon Bau- und Rittermodus.

### Abnahme

| Prüfung             | Ergebnis                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm typecheck`    | grün                                                              |
| `pnpm -r test`      | grün — shared 1151 (59 Dateien), server 211 (22), client 572 (53) |
| `pnpm build`        | grün, Client-Bundle 515,85 kB (150,64 kB gzip), CSS 59,99 kB      |
| `pnpm format:check` | grün                                                              |

Gelaufen am 02.09.2026 auf `a26eab8`, danach vier Umlaut-Korrekturen (siehe unten) und alle
vier Befehle ein zweites Mal grün auf demselben Stand bestätigt — die Zahlen ändern sich durch
reine Kommentarkorrekturen nicht.

Vorher (10c, Endstand `620a0f7`): shared 966, server 211, client 510. Neu also 185 Tests in
`shared`, keiner im Server, 62 im Client — erwartungsgemäß: die gesamte Spiellogik der 25
Karten und der Wurfkette liegt in `shared`, der Server kennt Fortschrittskarten nur als Teil
des ohnehin generischen Aktionsstroms.

**Aufgabe 16 (der Browser-Durchgang und seine Behebung, siehe eigener Abschnitt unten) fügt
danach elf weitere Tests hinzu:** `pnpm -r test` grün mit shared 1154 (59 Dateien), server
211 (22, unverändert), client 580 (53) — `pnpm typecheck` und `pnpm format:check` beide
weiterhin grün.

Der in der Aufgabenstellung angekündigte flackernde Test
(`apps/client/src/screens/GameScreen.test.tsx`, „löscht mit jeder neuen Absicht die vorige
samt halbfertigem Ritterzug", ~1,94 s gegen ein 5-s-Budget) ist in keinem der beiden vollen
Läufe umgefallen. Bekannte Altlast, siehe Offene Punkte.

### Getroffene Entscheidungen

**Die Kette der Wartephasen läuft über benannte Nachfolgerfunktionen, kein `rollStage`-Feld
im Zustand.** `rollDice` reicht nach jedem Zwischenschritt an die nächste Funktion weiter
(`afterDefenderPhase` → `afterDiscardPhase` → `afterAqueductPhase`), genau wie im Plan
vorgegeben. Grund: jedes neue Pflichtfeld im `GameState` ohne Vorgabewert ließe jede
gespeicherte Partie am Schema scheitern — seit Etappe 6 liegt der Zustand als JSON in der
Datenbank.

**`canPlaceMerchant` wird benannt exportiert, nicht mit Stern.** Ein Stern-Export aus
`cities/index.ts` brächte `applyMerchant` mit heraus, das ein zweites Mal in
`progress/commerce.ts` so heißt; ein mehrdeutiger Stern-Export verschwindet in ESM
stillschweigend statt einen Fehler zu werfen. Der Client (`targets.ts`, `merchantTargets`)
liest seither dieselbe Funktion statt sie nachzubauen — ein neuer Test vergleicht beide für
jedes Feld des Testbretts und fand keinen Unterschied.

**Sieben Karten mit Angabe teilen sich eine Bauform mit Händler und Bischof.** Erfinder,
Ingenieur, Medizin, Schmied, Straßenbau, Diplomat und Intrige laufen über dieselbe sechste
Absicht in `PickIntent` (`usePickMode`); die Zielmengen liest der Client ausschließlich aus
den sieben vorgerechneten Feldern der Spielersicht, keine eigene Regelauslegung im Client.
Die vier Karten mit bis zu zwei Angaben (Erfinder, Schmied, Straßenbau, Diplomat) führen
einen zweiten Klick, außer die zweite Liste ist leer — dann ist die Karte mit einer Angabe
schon fertig.

**`CardCategory` kennt seit dem letzten Commit kein `unwired` mehr.** Mit der vollständigen
Verdrahtung aller 25 Karten gibt es an diesem Tisch keine Handkarte mehr, die mit Angabe
daläge und trotzdem gesperrt wäre: Buchdruck und Verfassung kommen laut `draw.ts` nie in die
Hand (sie liegen sofort offen als Siegpunktkarten), und die fünf Arten, die auf eine fremde
Antwort warten, fehlen an diesem Tisch ganz aus `CITIES_RULES.progressDecks` (siehe
Abweichung 1). `hex` und die sieben neu verdrahteten Karten verschmelzen zu einer Kategorie
`board`; die restlichen sieben werden zu `inert` — ein Zweig einzig für die Erschöpfung des
Switches, den kein Test mehr erreichen kann, weil keine dieser Karten je auf der Hand liegt.

**Drei strukturgleiche Zwei-Schritt-Felder in `GameScreen.tsx` sind jetzt eine
Abstraktion.** `pickMode.ts` löst den in 10c als offener Punkt vermerkten dritten
Zwei-Schritt-Block (nach `buildMode` und `knightMode`) auf, statt eine vierte eigene
Variante zu bauen.

**`aqueductPending` und `defenderPending` liegen in derselben Datei (`rollFlow.ts`) wie
`progressDiscardPending`**, obwohl das Aquädukt selbst aus 10c stammt. Grund: alle drei sind
Stationen derselben Wurfkette, und eine Wahl an einer Stelle offen zu lassen, an der die
anderen beiden längst als echte Wahl gebaut sind, hätte dieselbe Baustelle zweimal aufgemacht
(siehe Abweichung 3).

### Bewußte Abweichungen von Spec und Regelwerk

Vier Stellen weichen ab, alle mit Grund:

1. **Auf den Stapeln liegen 43 Karten statt 54.** Das Regelwerk (11.1–11.3) kennt 54; die
   fünf Arten, die auf eine fremde Antwort warten — Großhändler, Spionage, Deserteur,
   Handelshafen, Hochzeit —, stehen in `CITIES_RULES.progressDecks` noch nicht und kommen
   in 10d-2 dazu. Sie fehlen **im Regelwerk** und nicht als Sperre im Regelcode: „was
   fehlt, gibt es an diesem Tisch nicht" ist die Zusage, die `developmentDeck` schon gibt,
   und so kostet 10d-2 an dieser Stelle einen Tabelleneintrag statt einer Fallunterscheidung.
   Bis dahin ist der Kartenmix gegenüber dem Brettspiel verschoben — eine gespielte Partie
   sieht mehr Wissenschaft (18 von 43 statt 18 von 54) als vorgesehen.
2. **Die Kartenmotive fehlen.** Die Spec nennt für 10d „Kartenmotive"; hier tragen die
   Karten Grundton je Stapel und ihren Namen. Grund: fünfundzwanzig gezeichnete Motive
   hängen an keiner Regel und wären der größte Einzelblock der größten Etappe der Reihe.
   Sie kommen als eigene Runde, wie bei den Entwicklungskarten.
3. **`aqueductPending` gehört nicht zu 10d.** Es ist der offene Punkt aus 10c. Es kommt
   trotzdem hierher, weil diese Etappe die Wurfsequenz ohnehin aufmacht und
   `defenderPending` dieselbe Bauform hat.
4. **Der Kartenzug hat keine Frist.** `deadlineOf` kennt `progressDiscardPending`,
   `defenderPending` und `aqueductPending` nicht — dieselbe Lücke wie bei den Ritter- und
   Ausbauzügen aus 10b und 10c. Sie wird gemeinsam mit ihnen gelöst oder gar nicht.

### Der Durchgang im Browser — vier Befunde, drei behoben

Der erste Anlauf war BLOCKED (Chrome-Erweiterung ohne Verbindung); der nachgeholte Durchgang
hat stattgefunden. Neun der zehn Messpunkte sind mit Zahl oder Log-Beleg abgenommen, beide
Viewport-Breakpoints geprüft (392 px effektiv und 636 px effektiv) — Belege in
`task-16-report.md`.

**Messpunkt 7 (Aquädukt) wurde nicht erreicht.** Wissenschaft kam über mehr als 60
Spielrunden nie über Stufe 1 hinaus, weil wiederholte Barbarenniederlagen den Spielern die
Stadt schneller nahmen, als sie neu gebaut werden konnte — kein Software-Befund, sondern
Partieverlauf dieser einen Testpartie, aber der Prüfpunkt selbst steht damit weiter aus
(siehe Offene Punkte).

Vier Befunde, drei davon behoben (`task-16-fix-report.md` trägt Ursache, Behebung, die
nachgerechneten Kontrastwerte und die deckenden Tests je Befund):

**B (hoch) — Kartennamen auf Politik und Wissenschaft kaum lesbar.**
`apps/client/src/index.css` überschrieb mit `.devcard__name { color: var(--ink-base); }` die
vom Elternelement (`.devcard__face`, `ProgressPanel.tsx`) geerbte, pro Bereich passende
Tinte — ein Spezifitätsfehler, keine Designentscheidung. Gemessen vorher: Politik 2,39:1,
Wissenschaft 2,58:1 (beide unter WCAG-AA 4,5:1). Kur: `.devcard__face` trägt jetzt die
dunkle Grundtinte als eigene, überschreibbare Regel, `.devcard__name` erbt sie
(`color: inherit`) statt sie zu erzwingen. Nachgerechnet aus den tatsächlichen
`--track-*`/`--on-sea`-Werten: Politik 5,29:1, Wissenschaft 4,91:1 — beide über der Schwelle,
Handel unverändert bei 5,40:1.

**A (mittel) — die Stadttor-Ziehung fehlte im Verlauf.** `describeGains` in
`packages/shared/src/game/log.ts` zählte nur `player.resources`; der Ziehpfad am
Ereigniswürfel-Stadttor (`drawProgressCards`) ändert `progressCards` und blieb damit
unerwähnt, obwohl der Stapel sichtbar sank. Kur: `describeProgressDraw` meldet jetzt, wer
gezogen hat und aus welchem Bereich (z. B. „p1 zieht eine Wissenschaftskarte"), redigiert um
die gezogene Karte selbst — die bleibt wie beim Entwicklungskartenkauf nicht öffentlich.

**C (mittel) — der Abwerfen-Dialog konnte sich festfressen.** `DiscardDialog.tsx` prüfte die
Bestandsgrenze außerhalb des funktionalen `setChosen`-Updaters, gegen den Stand aus dem
laufenden Rendering. Landeten zwei `+`-Klicks auf derselben Sorte im selben Schub (Doppel-
Klick, oder ein Browser, der für eine Geste zwei `click`-Ereignisse ausliefert), sahen beide
denselben veralteten Stand und ließen beide Erhöhungen durch — eine Sorte stand über dem
Bestand, „Abwerfen (7/7)" blieb bedienbar, jeder Klick wurde vom Server lautlos abgelehnt.
Kur, beide Hälften: die Grenzprüfung sitzt jetzt im Updater selbst und sieht dadurch
garantiert den zuletzt angewandten Stand statt eines veralteten Schnappschusses (Vorauswahl
kann so gar nicht mehr über den Bestand steigen); zusätzlich sperrt der Knopf unabhängig
davon, sobald irgendeine gewählte Sorte den Bestand übersteigt — unabhängig davon, wodurch.
Ein Test je Hälfte reproduziert den jeweils alten Fehler exakt (rohe Doppel-`click`-Events im
selben `act`, bzw. ein von außen schrumpfender Bestand bei stehender Auswahl) und hält ihn
fest.

**D (gering) — nicht behoben, siehe Offene Punkte.**

### Offene Punkte

- **Fünf Kartenarten fehlen dem Tisch**, weil sie auf eine fremde Antwort warten und noch
  keinen Ort dafür haben: Großhändler, Spionage, Deserteur, Handelshafen, Hochzeit. Dazu
  `progressPending` als der Wartezustand, den sie brauchen. Das ist 10d-2 (siehe Abweichung
  1).
- **Die 25 Kartenmotive fehlen** (Abweichung 2) — bis dahin tragen die Karten nur Grundton
  und Namen.
- **`deadlineOf` kennt die drei neuen Wartephasen nicht** — `progressDiscardPending`,
  `defenderPending`, `aqueductPending` bleiben unbefristet, dieselbe Lücke wie bei den
  Ritter- und Ausbauzügen aus 10b und 10c (Abweichung 4).
- **Messpunkt 7 (Aquädukt als echte Frage) ist ungeprüft geblieben** — siehe Abschnitt oben.
  Kein Software-Befund; ein künftiger Durchgang braucht eine Partie, in der mindestens ein
  Spieler Wissenschaft über Stufe 1 hinaus ausbaut (etwa mit gebauten Rittern gegen die
  Barbaren, damit keine Stadt verlorengeht).
- **Befund D — die Auszeichnungskarte „Rittermacht" überlappt das Spielbrett bei rund 396 px
  Breite** (`.awardcard__name`), bewusst zurückgestellt: rein kosmetisch, tritt nur im sehr
  schmalen Hochformat auf, und das Spiel zeigt für genau dieses Format bereits einen „Quer
  halten"-Hinweis (`index.css:6933`). Nachstellen: `iframe` mit `width: 396px` auf
  `localhost:5173`, Gründungsphase mit „Wer beginnt?"-Dialog betrachten.
- **`apps/client/src/screens/GameScreen.test.tsx` flackert unter Last.** Der Test „löscht mit
  jeder neuen Absicht die vorige samt halbfertigem Ritterzug" liegt bei rund 1,94 s knapp an
  der 5-s-Grenze der Suite und fällt gelegentlich unter Last um — eine bekannte Altlast, kein
  Befund dieser Etappe. In beiden vollen Läufen dieser Abnahme grün geblieben.
- **Zwei Testabdeckungslücken.** Straßenbau (die Fortschrittskarte) fehlt der Test „spielt mit
  einer Angabe, wenn keine zweite geht" — Schmied und Diplomat haben ihn, Straßenbau (noch)
  nicht. Medizin fehlt der Fall „leer ohne die Karte auf der Hand".
- **Ein Lecktest prüft über Teilstrings statt über Schlüsselmengen.**
  `packages/shared/src/game/playerView.test.ts:349-351` sichert die verdeckte Spielersicht
  mit `expect(JSON.stringify(withoutRules)).not.toContain('bishop')` (und `'saboteur'`,
  `'irrigation'`) ab. Das ist zerbrechlich: heißt ein künftiges Sichtfeld `bishop*` — in
  10d-2 naheliegend, weil auch der Bischof (Intrige, im Original „Bischof"/`bishop`) ein
  eigenes Ziel braucht —, fällt der Test grundlos um, ohne dass die Spielersicht tatsächlich
  leckt. Eine Prüfung auf Schlüsselmengen (welche Felder `withoutRules` trägt, statt eine
  Zeichenkette danach zu durchsuchen) wäre robuster.
- Die offenen Punkte aus Etappe 9 (Volume, HTTPS, Sicherung, Drossel im Wartebereich) gelten
  unverändert weiter.

### Nächste Etappe

**10d-2 — die fünf wartenden Kartenarten.** Großhändler, Spionage, Deserteur, Handelshafen
und Hochzeit brauchen `progressPending` als eigenen Wartezustand für eine fremde Antwort,
dazu ihren Platz in `CITIES_RULES.progressDecks` und in `legalActions`. Messpunkt 7
(Aquädukt als echte Frage) gehört ebenfalls dorthin, sofern nicht vorher eine eigene Partie
das nachholt (siehe Offene Punkte).

## Etappe 10d-2 — die fünf Karten, die auf eine fremde Antwort warten (2026-09-16, `etappe-10d2-wartende-karten`)

Einundzwanzig Commits von `fb588dc` (Die Phase progressPending und die Aktion answerProgress,
noch ohne Karte) bis `15b1508` (Formatierung der Etappe 10d-2 nach prettier), dazu der
Plan-Commit `dc33c81` davor und dieser Abschnitt danach. Branch ab `main` = `ba3e4c4`. Plan:
`docs/superpowers/plans/2026-09-15-etappe-10d2-wartende-karten.md`, Entwurf weiterhin in
`docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md` (Abschnitte 5.3, 5.5 und der
Zuschnitt von 10d-2 in Abschnitt 9).

Was jetzt geht: die letzten fünf Fortschrittskarten — Großhändler, Spionage, Deserteur,
Handelshafen, Hochzeit. Sie teilen sich **eine** Wartephase `progressPending` und **eine**
Aktion `answerProgress`; ein Verteiler (`answerRules.ts`) gibt je Karte an eine eigene Datei
unter `cities/progress/` ab. Auf den Stapeln liegen jetzt 54 Karten statt 43, die
Zusammensetzung des Brettspiels. Jede Wartephase hat eine Frist von 60 s — nicht nur die fünf
neuen Karten, sondern auch Abwerfen, Räuber, Ausweichen, Stapelwahl, Aquädukt und Abgeben —, und
beide Uhren (Server und lokale Partie) vollstrecken sie. Am Bildschirm wählt der Spielende eine
Person bzw. eine Sorte, die Gefragten antworten in einem Zähl-, Aufdeck- oder Sortendialog oder
am Brett (Deserteur), und eine Wartezeile unter dem Status zählt die Frist herunter. Der
Verlauf nennt jede Karte, jede Antwort und jeden Fristablauf, redigiert um das, was nur zwei
Personen sehen dürfen.

### Abnahme

| Prüfung             | Ergebnis                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm typecheck`    | grün                                                              |
| `pnpm -r test`      | grün — shared 1262 (66 Dateien), server 213 (22), client 609 (59) |
| `pnpm build`        | grün, Client-Bundle 537,08 kB (156,04 kB gzip), CSS 60,17 kB      |
| `pnpm format:check` | grün                                                              |

Gelaufen am 16.09.2026 auf `15b1508` als eine Befehlskette
(`pnpm typecheck && pnpm -r test && pnpm build && pnpm format:check`, Rückgabewert 0). Vite
warnt wie bisher, dass der Chunk über 500 kB liegt.

**`format:check` war vor diesem Lauf rot:** 26 Dateien, alle in dieser Etappe geändert
(`cities/progress/*`, `timeout.ts`, `legal.ts`, `log.test.ts`, `playerView.test.ts`,
`SpyDialog.tsx`, `ProgressPanel.tsx`, `WaitingClock.test.tsx`, der Plan u. a.) — keine Datei
außerhalb von `ba3e4c4..48b9676`. Sie sind im eigenen Commit `15b1508` mit `prettier --write`
formatiert worden, ausdrücklich nur die 26 gelisteten. Der Diff ist reine Formatierung: mit allen
Leerzeichen herausgerechnet bleiben nur nachgezogene Kommas, Semikolons am Anweisungsende,
entfernte Klammern um einen Pfeilfunktionsrumpf und die Tabellenstriche im Plan.
`pnpm typecheck` und `pnpm -r test` liefen danach einmal eigens grün (dieselben Zahlen wie oben),
bevor die Abnahmekette lief.

Vorher (10d-1, Endstand nach dem Browser-Durchgang): shared 1154 (59 Dateien), server 211 (22),
client 580 (53), Bundle 515,85 kB. Neu also 108 Tests in `shared`, zwei im Server (der Wecker
vollstreckt die Antwortfrist) und 29 im Client. Das Bundle wächst um 21,23 kB.

Keiner der bekannten Lastflackerer (`GameScreen.test.tsx`, `hotseatClock.test.tsx`) ist in den
beiden vollen Läufen dieser Abnahme umgefallen. Während der Etappe ist einer einmal umgefallen:
in Aufgabe 8 lief „Ingenieur: baut die gratis Mauer" im ersten Volllauf in den 5-s-Timeout,
einzeln und im Wiederholungslauf grün, ohne dass Client-Code angefasst war (siehe Offene
Punkte).

### Getroffene Entscheidungen

**Eine Phase, eine Aktion, eine eigene Antwort-Union.** Die fünf Karten warten alle in
`progressPending { by, pending, payload }` und werden alle mit `answerProgress` beantwortet. Die
Antwort ist eine eigene diskriminierte Union (`ProgressAnswerSchema`, Diskriminator `card`) —
dieselbe Grenze wie `playProgress` / `ProgressPlaySchema` aus 10d-1. Ein Verteiler
(`answerRules.ts`) prüft die Antwort gegen `payload.card` und gibt an `wedding.ts`,
`tradeHarbor.ts`, `spy.ts`, `masterMerchant.ts` und `deserter.ts` ab. Wer geantwortet hat, fällt
aus `pending`; die letzte Antwort führt zurück nach `main`. `actorFor` gibt für die Phase `null`
— es wird gleichzeitig geantwortet (Abweichung 6).

**`revealsTo` ist die einzige geöffnete Stelle der Geheimhaltung.** In `playerViewOf` stand
zweimal `player.id === viewer ? … : null`; daraus ist eine benannte Funktion
`revealsTo(state, viewer, player)` geworden, die **je ein Feld** öffnet: dem Großhändler die
fremden Handkarten, der Spionage die fremden Fortschrittskarten — für eine Person, eine Hand,
eine Phase. Hochzeit und Deserteur öffnen nichts (fünf Fälle getestet). Der Verlauf liest nie,
was die Spionage nimmt, was bei der Hochzeit verschenkt wird, welche Sorten der Großhändler nimmt
oder welche Kreuzung der Deserteur wählt.

**Fristen sind eine Dauer, kein Zeitpunkt im Zustand.** `deadlineOf` liefert
`{ kind: 'after', ms, owner }` für jede Wartephase und behält `{ kind: 'at', at, owner }` nur
für das Angebot, dessen Frist ein Neustart nicht verlängern darf. Der Wecker rechnet `now + ms`
selbst und stellt sich nach jedem Zug neu — die Frist gilt je Stand. Mit Zeitpunkten bräuchte
ein Dutzend Aktionen ein `at` und jede gespeicherte Phase ein Pflichtfeld. Die Dauer steht als
`rules.pendingAnswerMs` im Regelwerk, mit `.default(60_000)` für gespeicherte Regelwerke ohne
das Feld.

**Ein Geschenk verfällt, eine Pflicht wird abgenommen.** `timeout.ts` ist jetzt ein Verteiler
über die Phasen (vorher stand `applyTimeout` in `playerTrade.ts` und endete fest mit `main`).
Wer auf eine Gabe wartet und schweigt, verzichtet: Spionage und Großhändler enden ohne Wirkung,
Aquädukt und Stapelwahl des Verteidigers gehen am Vordersten vorbei, die zweite Runde des
Deserteurs verfällt. Wer etwas schuldet, bekommt es deterministisch abgenommen: Abwerfen vom
größten Stapel abwärts, Abgeben der ersten zählenden Fortschrittskarte, der Räuber in die Wüste
oder auf ein Feld ohne fremdes Bauwerk, der verdrängte Ritter auf die erste freie Kreuzung,
Hochzeit, Handelshafen und die erste Runde des Deserteurs nach fester Reihenfolge. Sonst wäre
Abwesenheit ein Zug. **Jede abgenommene Pflicht geht durch dieselbe `apply…`** wie die eines
Menschen — `applyDiscard`, `applyMoveRobber`, `applyAnswerProgress` usw. Die eine Stelle, an der
der Ablauf die Regel doch nachbaute (die Rückgabe eines verdrängten Ritters in den Vorrat), fand
der Review; sie ist jetzt ein Helfer `returnKnightToSupply`, den Vertreibung und Fristablauf
beide rufen (`232c77a`).

**`canPlaceKnightAt` ist aus `canBuildKnight` herausgelöst.** Der Deserteur stellt einen Ritter
auf, den niemand bezahlt und der nicht immer ein Einfacher ist. Die Frage nach dem Platz —
Brett, freier Platz, eigene Straße — ist trotzdem dieselbe, und zwei Auslegungen davon wären
auseinandergelaufen. `canBuildKnight` ruft die neue Funktion; sein Verhalten ist laut Review
unverändert.

**Ein Countdown, zwei Fundstellen.** Der Countdown aus dem Angebotsdialog ist ein Haken
(`useCountdown`), den jetzt zwei Stellen lesen: der Angebotsdialog und die neue Wartezeile
(`WaitingClock`) unter dem Status. Die Wartezeile ist Auskunft, kein Bedienelement — gedämpfte
Tinte wie „Runde N" darüber, Tabellenziffern, damit die Zahl beim Herunterzählen nicht springt.
Die Spec: „den Countdown gibt es beim Angebot schon, er bekommt eine zweite Fundstelle und keine
zweite Umsetzung."

**Laufende Partien behalten ihr Regelwerk mit 43 Karten.** Gespeichert wird der Startzustand
samt `RuleSet`; wer eine Partie vor dieser Etappe begonnen hat, spielt sie mit 43 Karten zu
Ende. Das ist gewollt — eine Regeländerung mitten in einer Partie wäre ein Eingriff in sie. Neue
Partien bekommen 54. Die gespeicherte Partie `__fixtures__/saved-10c.json` liest weiter mit
ihrem eigenen Regelwerk.

**Zwei Golden-Werte sind der Stapeländerung gefolgt, nicht umgekehrt.** `progressDecksAndRng`
zieht einen durchgehenden Zufallsstrom durch die drei Mischvorgänge; größere Stapel verschieben
ihn. `setup.test.ts` erwartet deshalb 18/18 statt 14/11 für Handel und Politik, und
`game.integration.test.ts` zieht als erste Karte den Straßenbau statt des Schmieds — per
`git stash` belegt, `setup.ts` unberührt. Der Integrationstest spielt jetzt den Straßenbau mit
Kanten aus `progressRoadBuildingTargets` statt einer eigenen Brettrechnung; Seed, Strategie und
Setzungen blieben, weil jede Änderung die Zugzahl und damit wieder die gezogene Karte
verschiebt. Das `if (result.ok) expect(…)` dort ist im selben Zug zur unbedingten Zusicherung
geworden.

### Bewußte Abweichungen von Spec und Regelwerk

Acht Stellen, alle mit Grund:

1. **Die 25 Kartenmotive entfallen.** Am 2026-09-02 als letzter, abtrennbarer Block
   vorgesehen; am 2026-09-15 vom Menschen gestrichen, weil die Reihe fertig werden soll. Die
   Karten behalten Grundton je Stapel und Namen.
2. **`progressPending` trägt kein Feld `answers`.** Die Skizze in 5.3 führt es als „was schon
   geantwortet wurde". Hier wirkt jede Antwort **sofort** — nichts liest sie später —, und ein
   Datensatz der Antworten stünde in `PlayerView.phase` offen am Tisch: welche zwei Karten p2
   bei der Hochzeit verschenkt hat, während der Verlauf bewusst nur die Anzahl nennt. Wer schon
   geantwortet hat, steht nicht mehr in `pending`.
3. **Die Karte steht nur in `payload.card`, nicht zusätzlich als `card` an der Phase.** Zwei
   Felder für dieselbe Aussage wären zwei Wahrheiten.
4. **Die Antwortfrist ist `rules.pendingAnswerMs` = 60 000 ms.** Die Spec nennt keinen Wert;
   60 s ist die Angebotsfrist. Die Frist gilt **je Stand**: der Wecker stellt sich nach jedem
   Zug neu, und bei Warteschlangen, die der Reihe nach handeln (`defenderPending`,
   `aqueductPending`, `progressDiscardPending`), nimmt der Ablauf **nur dem Vordersten** ab —
   wer hinter einem Abwesenden steht, verliert nichts. Wo gleichzeitig geantwortet wird
   (`discardPending`, Hochzeit, Handelshafen), antwortet der Ablauf für alle Übrigen.
5. **Die lokale Partie vollstreckt dieselben Fristen.** Ein Codepfad; dieselbe Begründung wie
   beim Angebot in Etappe 8 — ein Countdown, der nie auslöst, wäre eine Anzeige, die lügt.
6. **`progressPending` handelt gleichzeitig** (`actorFor` gibt `null`, wie bei
   `discardPending`). Keine der fünf Karten greift auf einen endlichen gemeinsamen Vorrat: der
   Handelshafen ist bei Ausspielen gedeckt, die Hochzeit nimmt aus fremden Händen.
7. **Der Handelshafen ist ohne Tauschpartner nicht spielbar.** Die Spec regelt den Fall nicht;
   dieselbe Haltung wie bei der Hochzeit („spielbar nur, wenn überhaupt jemand mehr Punkte
   hat").
8. **Der Lecktest prüft Werte statt Teilstrings.** Die offene Liste nannte „Schlüsselmengen";
   geprüft wird jetzt, dass kein **Wert** der Sicht außerhalb von `rules` eine Karte aus dem
   Stapel ist. Ein Feldname wie `bishopTargets` ist ein Schlüssel und fällt damit nicht mehr
   falsch an.

**Drei Auslegungen aus dem Entwurf, die dem Menschen genannt, aber nicht bestätigt sind.** Sie
stehen so im Plan und sind beim Umsetzen nicht stillschweigend gedreht worden:

- `activatedOnTurn = state.turn` beim Deserteur;
- die strenge Deckungsprüfung beim Handelshafen. **Der Schlussreview hat daran ein Leck
  gefunden:** `canTradeHarbor` zählt die Mitspieler, die mindestens eine Handelsware halten —
  verdeckte Information. `legalActions` und `isClickable` im `ProgressPanel` machen das Ergebnis
  sichtbar: wer die Karte hält, erfährt in jedem Zug, ob überhaupt jemand Handelswaren hat, und
  bekommt eine Schranke für ihre Zahl (so viele Rohstoffe muss er decken). Nicht umgebaut, weil
  die strenge Prüfung wörtlich in der Spec steht. Die Alternative, als Entscheidung beim
  Menschen: die Spielbarkeit nur an öffentlichen Größen messen (etwa Deckung ≥ Zahl der
  Mitspieler, die überhaupt Karten halten) und die tatsächlichen Tauschpartner erst beim Öffnen
  der Phase bestimmen;
- `robberPending` und `displacePending` stehen in der Fristenliste, obwohl sie dem Spieler am
  Zug gehören und nicht einem Wartenden.

### Der Durchgang im Browser — vier Befunde, zwei behoben

Der Durchgang lief am 16.09.2026 in lokalen Partien mit Städte-&-Ritter-Regeln (`pnpm dev`,
Chrome-Erweiterung) auf dem Stand `6d00c9e`. Damit die fünf Karten in vertretbarer Rundenzahl
zustande kamen, gab es **vorübergehende, nie committete** Eingriffe in
`packages/shared/src/game/setup.ts`: die fünf Karten oben auf ihren Stapeln; dem ersten Spieler
`improvements: { science: 3, trade: 3, politics: 3 }` statt nur `science: 3` (mit Stufe 0 in
Handel und Politik zieht er die Karten nie); den Mitspielern `defenderPoints` 2, je eine Karte
Medizin und alle Startrohstoffe samt Tuch und Münzen (sonst haben Hochzeit und Großhändler
niemanden mit mehr Punkten, die Spionage nichts zu sehen, der Handelshafen keine Handelsware und
der Deserteur keinen fremden Ritter). Befunde, die nur aus diesen Setzungen folgen, zählen
nicht. Am Ende war `setup.ts` zurückgesetzt und `git status` sauber.

Die zehn Messpunkte:

1. **Hochzeit** ✅ — der Dialog erscheint nacheinander bei Spieler 2 und 3 („Hochzeit: schenke
   Spieler 1 zwei Karten", Knopf „Schenken (2/2)"), Verlauf „Spieler 3 schenkt Spieler 1 zwei
   Karten" ohne Sorte, Hand 17 → 21. **Der Fall „alle" (unter zwei Karten) ist nicht erzeugt
   worden.**
2. **Handelshafen** ✅ — Hand p1 Lehm 5, Wolle 5, Korn 2, Tuch 1: die Wahl bietet genau
   Lehm/Wolle/Korn. Der Antwortdialog bei p2 zeigt nur „Tuch" (Zustand über React-Fiber
   gelesen: p2 hielt nur Tuch), p3 ohne Handelsware wird nicht gefragt; Knopf „Tauschen";
   Verlauf „Spieler 2 gibt Spieler 1 Tuch für Korn".
3. **Spionage** ✅ mit Einschränkung — Personenwahl mit Name, 4-px-Farbrand und „4 Siegpunkte",
   217×44; Aufdeckdialog „Spieler 2s Fortschrittskarten" zeigt „Medizin" (101×44), kein
   Schließkreuz; Verlauf „Spieler 1 nimmt Spieler 2 eine Fortschrittskarte" ohne Namen; danach
   im `body.innerText` nur eigene Kartennamen. **Einschränkung:** die fremde Karte war Medizin,
   die p1 selbst schon hielt — die Leckprüfung hat hier wenig Trennschärfe.
4. **Großhändler** ✅ — Tisch p3 4 SP, p1 3 SP, p2 4 SP: Personenwahl mit genau 2 Knöpfen
   (217×44); Aufdeckdialog bei p1 zeigt p3s Hand, „Nehmen (0/2)" 143×44; Korn 8 → 6 bei p3,
   2 → 4 bei p1; Verlauf „Spieler 1 nimmt Spieler 3 zwei Karten" ohne Sorte.
5. **Deserteur** ✅ — Runde 1 bei p2 genau seine 2 Ritter als Ziel; Runde 2 bei p1 zwei
   Kreuzungen, beide Endpunkt einer p1-Straße; der Überläufer steht auf Stufe 1, inaktiv
   (Opfer-Ritter Stufe 1); Verlauf „Spieler 2 gibt einen Ritter auf" / „Spieler 1 stellt einen
   Überläufer auf".
6. **Wartezeile** ✅ — „Noch 44..41 Sekunden", Breite des `<b>` 13,81 px über 3 s konstant
   (`tabular-nums`).
7. **Fristablauf** ✅ — in der Abwurfphase nach 60 s Verlauf „Die Zeit ist abgelaufen - Spieler
   3, Spieler 1 und Spieler 2 werfen von selbst ab", Hände danach 9/13/12.
8. **Aquädukt** ✅ — der in 10d-1 nicht erreichte Messpunkt: der Dialog fragt beim leeren Wurf,
   die Wahl Erz kommt an (Verlauf „Spieler 1 nimmt Erz aus dem Aquädukt", Hand 3 → 4). Dabei
   Befund A.
9. **Kontrast `.status__clock`** ✅ — bei 1920×889: rgb(148,167,176) auf `.game` (rgb(15,44,59)
   plus radialer Verlauf rgb(29,84,104) → transparent 70 %, am Text Alpha 0,22–0,24) =
   5,16–5,22:1. Gegen den Verlaufsmittelpunkt wären es 3,34:1, deshalb an den schmalen Breiten
   am echten Text nachgemessen (siehe unten).
10. **Trefferflächen** ✅ für die Knöpfe selbst — Person 217×44, Abbrechen 116×44, Aufdeckkarte
    101×44, Nehmen 143×44; Farbe als 4-px-Rand plus Name plus „4 Siegpunkte". Dabei Befunde B
    und C.

**Breakpoints** über zwei `iframe` fester Größe (396×800 und 900×800) auf `localhost:5173`,
jeweils eigene Partie: Personenwahl des Großhändlers bei 396 px ✅ (Knöpfe 143×68, nichts über
dem Rand) und 900 px ✅; Zählerdialog des Großhändlers bei 396 px ✅ (Panel 16..378 von 394)
und 900 px ✅ (177..721 von 898); Spionage-Dialoge bei 396 px ✅ (Personenwahl ohne Überlauf,
Aufdeckdialog 16..378 von 394, Karte 101×44), **bei 900 px nicht eigens gemessen** (gleiche
Komponente, breiterer Rahmen). Kontrast `.status__clock` am echten Text: 900 px 4,75–5,04:1 ✅,
396 px an den Kanten des Statusfelds 4,67–4,85:1 ✅.

Vier Befunde (die Buchstaben springen von C auf E; D ist der offene Befund aus 10d-1):

**A — der Aquädukt-Dialog bestätigte mit „Karte spielen"**, obwohl keine Karte gespielt wird —
die Vorgabe von `ResourcePickDialog`. Behoben in `58c6420`: der Knopf heißt „Nehmen"; der Review
hat alle sieben Aufrufstellen von `ResourcePickDialog` geprüft. Nachkontrolle im Browser: Knöpfe
„Lehm..Erz, Auswahl zurücksetzen, Nehmen", die Wahl kommt an.

**B — das Schließkreuz der Personenwahl maß 36×36 px** (< 44). `CloseButton` ist eine
Bestandskomponente, der Befund galt also für alle Dialoge. Behoben in `48b9676`: eine
unsichtbare Trefferfläche `.modal__close::before` mit `inset: -0.25rem`, 44×44 px; sichtbar
bleibt das Kreuz 36×36. Nachkontrolle: `elementFromPoint` trifft bei ±21 px vom Mittelpunkt (x
und y) das Kreuz, bei +23 px nicht; der Klick schließt den Dialog.

Beide Behebungen mit eigenem Commit und Test, RED jeweils belegt; danach shared 1262, server
213, client 609.

**C — die Stepper im Zählerdialog (Hochzeit, Großhändler) messen 22×22 px** (< 44). Nicht
behoben, siehe Offene Punkte: die Stepper stehen seit 10b im Abwurfdialog (`DiscardDialog`),
„− 0 +" liegen so dicht, dass 44-px-Trefferflächen einander und die Zahl überdecken würden —
das ist ein Umbau des Dialogs, kein Fix.

**E — bei 396 px überlappt `.panel--status` (x 159..293) die Tischliste (`.seat` bis x 238).**
Das besteht schon ohne Frist (Status 174..293, y 14..51); die neue Wartezeile aus Aufgabe 12
verlängert die Überlappung bis y 107 in die dritte Tischzeile. Nicht behoben, siehe Offene
Punkte: die Überlappung besteht schon ohne 10d-2, tritt nur im schmalen Hochformat auf, für das
das Spiel „Quer halten" anzeigt, und bei 900 px besteht sie nicht.

Zwei Beobachtungen, die nicht aus 10d-2 stammen: p1 hielt nach dem Ziehen im eigenen Zug fünf
Fortschrittskarten, das Abgeben kam erst beim nächsten Wurf eines anderen. Die Regelstelle
beantwortet das (Regel 11): „Zieht man eine 5. Karte: am Zug — sofort eine ausspielen; nicht am
Zug — eine beliebige unter den Stapel zurücklegen." Am Zug heißt es also **ausspielen**, nicht
abgeben — und das erzwingt heute nichts. Eine Regellücke aus 10d-1, siehe Offene Punkte. Und bei 900 px liegen die Ecke der Fortschrittskarten und das
Tableau über dem Brett (Screenshot) — ein Layoutthema aus 10c/10d-1.

### Offene Punkte

- **Die 25 Kartenmotive sind gestrichen, nicht verschoben** (Abweichung 1). Die Karten tragen
  Grundton je Stapel und Namen, und dabei bleibt es.
- **Keine Zugzeit für `main` und `rollPending`.** `deadlineOf` kennt jetzt jede Wartephase, aber
  wer am Zug ist und nicht würfelt oder den Zug nicht beendet, hält die Partie weiter unbegrenzt
  an.
- **Die drei unbestätigten Auslegungen** (siehe oben) warten auf die Bestätigung des Menschen.
- **Befund C — Stepper 22×22 px im Zählerdialog** (Hochzeit, Großhändler, Abwerfen). Auf
  Touchgeräten bleiben sie fummelig, bis der Dialog umgebaut wird.
- **Befund E — `.panel--status` überlappt bei 396 px die Tischliste**, mit der Wartezeile bis in
  die dritte Tischzeile. Im Hochformat-Handy ist der Status über den Namen schlecht lesbar, bis
  jemand die Kopfzeile für schmale Breiten umbaut. Nachstellen: `iframe` mit 396×800 auf
  `localhost:5173`, eine Wartephase mit Frist.
- **Befund D aus 10d-1 — die Auszeichnungskarte „Rittermacht" überlappt bei rund 396 px das
  Brett** (`.awardcard__name`). In dieser Etappe nicht angefasst, weiter offen.
- **`apps/client/src/screens/GameScreen.test.tsx` flackert unter Last.** In Aufgabe 8 lief
  „Ingenieur: baut die gratis Mauer" einmal in den 5-s-Timeout; dazu die Altlast „löscht mit
  jeder neuen Absicht die vorige samt halbfertigem Ritterzug" aus 10d-1 und
  `hotseatClock.test.tsx` aus 10c. In beiden vollen Läufen dieser Abnahme grün geblieben.
- **Was der Durchgang nicht erreicht hat:** der Fall „alle" bei der Hochzeit (unter zwei
  Karten); eine trennscharfe Leckprüfung der Spionage (die gesehene Karte lag schon auf der
  eigenen Hand); die Spionage-Dialoge bei 900 px. Die Frage, ob p1 nach dem Ziehen im eigenen
  Zug mit fünf Fortschrittskarten sofort abgeben müsste, beantwortet Regel 11 (nächster Punkt).
- **Regel 11 ist am Zug nicht erzwungen — eine Regellücke aus 10d-1.** Wer am Zug eine fünfte
  verdeckte Fortschrittskarte bekommt, muss sofort eine **ausspielen** (nicht abgeben). Heute
  steht er danach in `main`, darf spielen, muss aber nicht; erst der nächste Wurf findet ihn über
  dem Limit und lässt ihn abgeben (`continueAfterEvent`). 10d-2 erweitert die Lücke um einen
  zweiten Weg: die Spionage legt die genommene Karte dem Spielenden am Zug auf die Hand. Der
  Kommentar in `spy.ts` nennt die Pflicht jetzt ausdrücklich als nicht erzwungen. Die
  Erzwingung selbst gehört nicht in diese Etappe.
- **Offene Regelfrage: darf der Deserteur einen mächtigen Ritter ohne Festung stellen?**
  Regel 7.4: „Einfach → Stark jederzeit. **Stark → Mächtig erst nach der Festung** (Politik,
  dritte Ausbaustufe). Aktiv bleibt aktiv, passiv bleibt passiv. **Je Zug darf ein Ritter nur
  einmal aufgewertet werden.**" Die Deserteur-Zeile in 11.3 sagt zur Festung nichts, und
  `replacementLevel` (`deserter.ts`) setzt Stufe 3 auch ohne Festung ein, wenn der gefallene
  Ritter mächtig war. Ob der Überläufer ein Aufwerten ist (dann gälte die Festung) oder ein
  Ersetzen (dann nicht), entscheidet der Mensch; der Code ist unverändert.
- **Die Umlaut-Regel für Client-Testnamen ist ungeklärt.** Neue Client-Testnamen stehen in
  ASCII-Umschrift (`view.test.ts` „laesst alle Wartenden gleichzeitig handeln",
  `CloseButton.test.tsx`, `GameScreen.test.tsx`), obwohl die Regel für den Client Umlaute
  verlangt — laut Review ist der Bestand im Client aber überwiegend ASCII. Regel gegen Bestand
  entscheiden. In `shared` und `server` ist der Umlaut-Suchlauf dieser Abnahme sauber: keine
  Kommentar- oder Testnamenzeile mit Umlaut.
- **Kleinere Punkte aus den Reviews**, alle heute unerreichbar, ungetestete Randfälle oder
  kosmetisch:
  - `timeout.test.ts`: ungetestet sind Aquädukt und Verteidiger mit leerer Bank bzw. leeren
    Stapeln, der letzte Verteidiger, die dritte Räuberstufe, der Deserteur-Gleichstand über die
    Kreuzungs-Id und ein `timeout` von einem Nicht-Vordersten. (Der nicht trennscharfe
    Räubertest und der falsche Kopfkommentar sind in der Fixwelle des Schlussreviews behoben.)
  - Der Vorschub der Warteschlange „solange Bank bzw. Stapel reichen" steht doppelt in
    `timeout.ts` und `rollFlow.ts` (so im Plan).
  - `tradeHarbor.ts`: `?? COMMODITY_IDS[0]` erfindet eine sicher abgelehnte Antwort, und ein
    abgelehnter Ablauf stellt den Wecker in `clock.ts` nie neu. Den `!acted.ok`-Wettlauf im
    Wecker hat der Schlussreview am Code geprüft: `system()`, die Aktions-Handler und `fire`
    laufen synchron (`registry.update` → Wecker stellen → Verteilen, seit I1 in dieser Reihenfolge), jede anders beendete Frist
    stellt den Wecker ab, bevor er klingeln könnte — der Wettlauf ist unerreichbar. Übrig blieb,
    dass ein trotzdem abgelehnter Ablauf den Tisch lautlos anhielte; er schreibt jetzt eine
    Warnung ins Log (M5).
  - `log.ts`: `pending[0] ?? ''` erzeugt bei leerer Warteschlange einen verstümmelten Satz
    statt eines sichtbaren Fehlers.
  - Der zweite Zweig von `canAnswerTradeHarbor` (Deckung des Spielenden) ist ungetestet.
  - `spy.ts` mit `findPlayer(…)!` und `splice(indexOf)` ohne eigenen Schutz; `deserter.ts` liest
    `piecesLeft` ohne `?? 0`.
  - `ProgressPanel.tsx` wächst je Karte (vier Kategorien, vier Helfer, drei Dialogzweige) —
    Kandidat für eine Bündelung.
- Die offenen Punkte aus Etappe 9 (Volume, HTTPS, Sicherung, Drossel im Wartebereich) gelten
  unverändert weiter.

### Schlussreview und seine Fixwelle

Der Review über die ganze Etappe (Base `b3d8476`) fand einen echten Fehler, einen Befund zur
Geheimhaltung, zwei Regelfragen und drei kleinere Punkte. Behoben, je mit eigenem Commit und —
wo Code betroffen ist — mit einem Test, der vorher rot war:

- **I1 — der Dauer-Countdown log nach Wiederverbinden, Beitritt oder Umbenennen** (`9c482c6`).
  `useCountdown` rechnete eine Dauer ab der Ankunft einer neuen `view.version`; diese drei
  Handler erhöhen die Version und verteilen die Partie, stellen den Wecker aber nicht neu. Kam
  ein Abwesender nach 45 s zurück, sprang bei allen die Anzeige auf „Noch 60 Sekunden", obwohl
  der Server nach 15 s abnimmt — genau die Anzeige, die Abweichung 5 ausschließen soll. Jetzt
  merkt sich der Wecker den fälligen Zeitpunkt in Serverzeit (`RoomClock.dueAt`), der
  Spielstand trägt ihn als optionales `dueAt` im `GameEventSchema`, und der Client rechnet die
  Dauer daraus mit dem vorhandenen `clockOffset` wie beim Angebot. Damit der Stand eines Zuges
  schon die neue Frist trägt, stellen alle Aufrufstellen den Wecker jetzt **vor** dem Verteilen.
  Lokal bleibt die Rechnung ab der Ankunft: dort stellt sich die Uhr mit jedem Stand neu. Ein
  Countdown, zwei Leser — unverändert.
- **M5** (`051b3cb`) — ein abgelehnter Fristablauf schreibt eine Warnung (Raum,
  Ablehnungsgrund) ins Log.
- **M6** (`8f99887`) — `timeout.test.ts`: der Räubertest ist trennscharf (eine fremde Siedlung
  am ersten legalen Feld, Gegenprobe belegt), der Angebotsablauf prüft wieder die Rohstoffe von
  p2, der Kopfkommentar stimmt.
- **M7** (`ddd781c`) — die Hochzeit ist im `ProgressPanel` nur anklickbar, wenn die
  Aktionsliste sie nennt; vorher lief der Klick ohne Mitspieler mit mehr Punkten in eine
  Ablehnung des Servers. Der Kommentar spricht von fünf Karten ohne Angabe.

Beim Menschen liegen drei Fragen, alle nur dokumentiert: das Leck der strengen Deckungsprüfung
beim Handelshafen (I2, bei den unbestätigten Auslegungen), die nicht erzwungene Ausspielpflicht
aus Regel 11 (M3) und der mächtige Überläufer ohne Festung (M4), beide unter Offene Punkte.

Abnahme nach der Fixwelle: `pnpm typecheck && pnpm -r test && pnpm build && pnpm format:check`
grün — shared 1263 (66 Dateien), server 222 (22), client 614 (59); Client-Bundle 537,29 kB
(156,12 kB gzip), CSS 60,17 kB.

## Die offenen Regelfragen aus 10d-2 — entschieden am 16.09.2026

Branch `etappe-10d3-regelfragen` ab `fc10a11`. Vier Fragen lagen beim Menschen; alle vier sind
entschieden, drei davon sind umgesetzt, die vierte ist eine Schreibregel.

1. **Handelshafen ohne Leck** (`ac97142`). Ob die Karte spielbar ist, hängt nur noch an
   öffentlichen Größen: so viele Rohstoffe der gewählten Sorte, wie Mitspieler überhaupt
   Handkarten halten. Wer davon wirklich Handelsware hat, steht erst beim Ausspielen fest; hält
   niemand eine, ist die Karte ohne Wirkung gespielt. Ein Test hält fest, dass
   `canPlayProgress` und `legalActions` mit und ohne fremde Handelswaren dasselbe sagen.
   Preis: die Deckung ist strenger als nötig, wenn Mitspieler nur Rohstoffe halten.
2. **Deserteur nach der offiziellen FAQ** (`f169aec`, catan.com, Städte & Ritter, Fragen 82–85).
   Ein aktiver Überläufer darf **sofort** handeln (Frage 83) — `activatedOnTurn` steht jetzt eine
   Runde zurück, statt ihn für den laufenden Zug zu sperren; das war eine der drei unbestätigten
   Auslegungen. Der mächtige Überläufer braucht keine Festung (Frage 84) — der Code tat das schon,
   jetzt steht es im Test. Ebenso Frage 82: für einen einfachen Ritter ohne Vorrat gibt es keinen
   Ersatz.
3. **Regel 11 erzwungen** (`feb515a`, `ebf6293`, `a5ad607`). Wer am Zug mehr als vier zählende
   Fortschrittskarten hält, darf nur noch eine ausspielen oder eine abgeben. **Keine neue Phase**,
   sondern abgeleitet (`mustShedProgressCard` in `draw.ts`): die fünfte Karte kommt über
   Stadttor, Stapelwahl und Spionage, und alle drei Wege enden in `main` — eine Prüfung dort
   erreicht sie alle, ohne dass ein Weg sie vergessen kann. Der Reducer lehnt alles andere mit
   `PROGRESS_LIMIT_FIRST` ab; `legalActions`, `playableDevelopmentCards` und `canOfferAnything`
   sagen dasselbe. Abgeben geht über das vorhandene `discardProgressCard`, das jetzt auch in
   `main` gilt. Keine Frist, wie für `main` überhaupt. Am Bildschirm: Statussatz „… muss eine
   Fortschrittskarte ausspielen oder abgeben", ein Knopf „Karte abgeben" neben dem gesperrten
   Zugende und der vorhandene Abgabedialog, diesmal mit Kreuz, weil Ausspielen auch geht.
   **Bewusste Vereinfachung:** Abgeben ist immer erlaubt, nicht erst, wenn keine Karte spielbar
   wäre — ob eine Karte mit Brettwahl (Ingenieur, Bischof …) spielbar ist, lässt sich nicht
   billig aufzählen, und wer abgibt statt auszuspielen, schadet nur sich selbst.
4. **Testnamen im Client ohne Umlaute.** Die Regel folgt dem Bestand: Testnamen überall in
   ASCII-Umschrift, Kommentare im Client weiter mit Umlauten.

Nicht im Browser geprüft. Abnahme: `pnpm typecheck && pnpm -r test && pnpm build &&
pnpm format:check` grün — shared 1276 (67 Dateien), server 222 (22), client 618 (59);
Client-Bundle 538,88 kB (156,48 kB gzip).

### Nächste Etappe

**10e — Burg 1 / Burg 2 zu fünft und sechst.** Fünf und sechs Personen am Städte-&-Ritter-Tisch
nach Abschnitt 7 des Entwurfs; am Bildschirm sichtbar, wer den vollen und wer den angepassten
Zug hat und was im angepassten Zug fehlt.
