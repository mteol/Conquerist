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
- **Design ist Abnahmekriterium, nicht Nacharbeit.** Siehe unten.
- **`PROGRESS.md` wird ohne Aufforderung fortgeschrieben.** Siehe unten.

## Design

Das Spiel wird angeschaut, bevor es verstanden wird. Ein Bildschirm, der
funktioniert und billig aussieht, ist nicht fertig. Diese Regeln gelten ab
Etappe 4 für jede Oberfläche.

**1. Erst der Entwurf, dann das Markup.** Vor jedem neuen Bildschirm drei Sätze
festhalten: welche Rolle die Fläche hat, wie sie aufgebaut ist, und was das eine
Element ist, an das man sich erinnert. Ohne diesen Satz entsteht die Vorlage,
die überall passt und nirgends gemeint ist.

**2. Die Farbwelt steht und wird nicht neu erfunden.** Tiefsee-Tinte für die
Fläche, Pergament für alles Bedienbare, Geländefarben als Akzente — und die
Geländefarben sind dieselben wie in `game/labels.ts` und `shared/seats.ts`.
Neue Elemente leiten sich aus den Variablen in `index.css` ab. **Kein Hex-Wert
in einer Komponente**; wer eine Farbe braucht, die es nicht gibt, legt sie als
Variable an und begründet sie.

**3. Die Schrift trägt die Persönlichkeit, nicht ein Webfont.** Kein
Font-Download. Der Charakter kommt aus der Setzung: großer Gewichtssprung, enge
Laufweite in der Anzeige, weite Sperrung in Kleinlabels, **überall
Tabellenziffern**. In einem Spiel, in dem dauernd Zahlen verglichen werden,
darf keine Ziffer springen.

**4. Das Brett ist der Held.** Es bekommt den Platz und die Sättigung; Panels,
Leisten und Dialoge sind ruhig und ordnen sich unter. Boldness wird an einer
Stelle ausgegeben, nicht auf jeder Fläche.

**5. Bewegung erklärt einen Zustandswechsel oder entfällt.** Würfeln, Bauen,
Räuber, Zugwechsel, eintreffende Ressourcen — dort hilft Animation beim
Verstehen, wer gerade was getan hat. Dekoratives Schweben, Dauer-Glow und
Verlaufsflächen ohne Anlass fliegen raus. `prefers-reduced-motion` wird
respektiert; es steht bereits in `index.css`.

**6. Struktur codiert Inhalt.** Nummerierung, Trennlinien und Eyebrows nur da,
wo die Reihenfolge oder die Gruppe wirklich etwas bedeutet. Ein `01 / 02 / 03`
über Dingen, die keine Folge sind, ist Dekoration.

**7. Qualitätsboden, ohne ihn zu erwähnen.** Bedienbar bis zum schmalen
Handy-Fenster, sichtbarer Tastaturfokus, ausreichender Kontrast auf der
Tiefsee-Fläche, keine springenden Layouts beim Nachladen. Farbe ist nie der
einzige Träger einer Information — Spielerfarben brauchen zusätzlich Namen oder
Form.

**8. Texte sind Designmaterial.** Aktiv, Satzanfang groß, sonst klein. Benannt
wird, was der Spieler tut, nicht wie es im Code heißt. Ein Wort bleibt durch
den ganzen Ablauf gleich: Wer „Straße bauen" drückt, liest im Verlauf „hat eine
Straße gebaut". Fehler sagen, was passiert ist und was jetzt hilft; leere
Flächen laden zu einer Handlung ein statt sich zu entschuldigen.

**Was es nicht wird:** Creme-Fläche mit Serifen-Display und Terrakotta-Akzent,
Fast-Schwarz mit einem grellen Grün, Glaskarten mit Farbverlauf. Das sind die
drei Voreinstellungen, die jede generierte Oberfläche gerade trägt, und sie
kämen für dieses Spiel nicht aus dem Material, sondern aus der Gewohnheit.

**Fallen, die schon zugeschnappt sind:**
- Eine CSS-Regel schlägt immer das gleichnamige SVG-Präsentationsattribut.
  `.road { stroke: transparent }` hat jede gebaute Straße unsichtbar gemacht,
  obwohl `stroke={farbe}` am Element stand. Farben am SVG deshalb per `style`.
- **Eine Farbe, die im Blatt steht, ist damit noch nicht gezeigt.** `.chip__hot`
  hat die Sechs und die Acht seit Etappe 3 rot gefärbt — nur stand darüber
  `.chip text`, und eine Klasse plus ein Typ schlägt eine Klasse allein. Die
  Regel hat nie gegriffen, aufgefallen ist es erst im ersten Playtest, weil die
  Farbe ja im Blatt stand. Wer eine Regel schreibt, die eine bestehende
  überschreiben soll, zählt ihre Spezifität nach.
- **Eine Animation, die beim Einhängen läuft, läuft beim Aktualisieren nicht.**
  Der Ausbau zur Stadt hat denselben Knoten behalten, React hat das Element
  aktualisiert statt es neu einzuhängen, und `animation: settle` blieb still —
  aus einem Punkt wurde lautlos ein größerer Punkt. Wer einen *Wechsel* zeigen
  will, gibt dem Element ein `key`, das sich mit dem Wechsel ändert
  (`key={building.kind}`, `key={state.robber}`). Sonst zeigt die Animation nur
  das erste Mal etwas.
- **Erst messen, dann erklären — auch bei „das sieht man nicht".** Zu „am
  Brettrand sind die Straßen unsichtbar" war die erste Vermutung ein fehlendes
  Element. Eine Sonde (Brett in eine Datei rendern, Koordinaten und Klassen
  auszählen) hat gezeigt: alle 30 Küstenkanten liegen in der `viewBox`, tragen
  ihre Klasse und ihre Farbe. Die Ursache war der Untergrund — halb dunkle See.
  Ohne die Sonde wäre ein Fehler gesucht worden, den es nicht gab.
- **Was einstellbar wird, hört auf, ableitbar zu sein.** Die Sitzfarbe folgte
  aus der Position (`seatColorAt(index)`), und daran hingen drei Stellen, die
  fröhlich neu durchzählten — `joinRoom`, `leaveRoom` und der Wiederaufbau aus
  der Datenbank. Sobald sie gewählt wird, ist jedes dieser Neuzählen ein
  Eingriff in eine fremde Entscheidung, und die Spalte in der Datenbank ist
  keine Redundanz mehr, sondern die einzige Wahrheit. Beim nächsten „das kann
  man doch ausrechnen" gilt: nur solange es niemand aussuchen darf.
- Eine Animation, die etwas ausblendet, ist bei `prefers-reduced-motion` von
  Anfang an unsichtbar — die abgeschaltete Animation steht sofort an ihrem
  Ende. Für Information deshalb nur Eingangs-, nie Ausgangsanimationen.
- **`prefers-reduced-motion` kürzt nur, was man ihm nennt.** Der übliche Block
  setzt `animation-duration` — die **Verzögerung** bleibt stehen, und mit
  `backwards` hängt das Element solange in seiner Anfangsstellung fest. Bei
  einem Eingang heißt die „unsichtbar": das Hauptmenü hatte damit keine
  Animation mehr, aber immer noch eine Choreografie (gemessen: die drei
  Einträge sprangen bei 333/396/459 ms nacheinander ins Bild). `animation-delay`
  gehört deshalb in denselben Block, negativ.
- **Ein fester Aufschlag auf einen Wert, der nicht überall gleich ist, ist kein
  fester Effekt.** Die Aufprallwelle hob jedes Hex um `+0.34` — in der Mitte
  nicht ganz das Doppelte, am Rand fast das Siebenfache, also nach außen hin
  lauter statt leiser. Wer eine Ruhelage anhebt, rechnet in Anteilen davon.
- **Eine Komponente, die `null` zurückgibt, ist nicht ausgehängt.** Ihr Zustand
  lebt weiter. Der Angebotsdialog hielt deshalb ein angefangenes Gegenangebot
  über das Ende der Handelsrunde hinweg fest — beim nächsten Angebot standen
  noch die alten Mengen im Formular, aus einer Hand, die sie nicht mehr hergab,
  und der Absendeknopf war offen. Wer Zustand hält, der zu *einem* Vorgang
  gehört, setzt ihn zurück, sobald sich der Vorgang ändert; „wird ja neu
  gerendert" heißt nicht „fängt neu an".
- **Ein Protokollcode gehört nicht in einen Satz für den Spieler.**
  `ServerError` klebte den Code vor die Meldung, und auf dem Bildschirm stand
  „REJECTED: Angeboten werden kann nur, was auf der Hand liegt". Der Server
  schreibt seine Ablehnungstexte für Menschen; der Code bleibt als Feld am
  Fehler, für Diagnose — nicht als Präfix.
- **Eine Probe an der falschen Stelle ist schlimmer als keine.** Gegen einen
  Startfehler im Container kam ein `RUN import(...)` ins Dockerfile — aber in
  die **Bau**-Stufe, wo der Workspace unter `/app` noch liegt. Dort konnte ein
  Symlink nach draußen die Auflösung retten, die in der Laufzeitstufe
  scheiterte: der Build war grün, der Container startete trotzdem nicht, und
  die Probe hatte den Verdacht sogar noch entkräftet. Wer etwas nachweisen
  will, weist es in der Umgebung nach, in der es gelten soll.
- **`pnpm deploy` legt Workspace-Pakete als Symlink in seinen virtuellen
  Store.** Wird der Zielordner danach woanders hinkopiert, zeigt der Link ins
  Leere, und Node sagt dazu nur „Cannot find package". Deshalb heißt der Pfad
  im Dockerfile schon in der Bau-Stufe so, wie er drüben heißen wird.
- **Ein einmal veröffentlichter Migrationsschritt wird nie wieder angefasst.**
  Er beschreibt den Stand, den es einmal gab. Wer ihn ändert, gibt Bestands-
  und Neudatenbanken verschiedene Schemata — deren `user_version` steht auf
  derselben Zahl, aber die Tabellen darunter sind nicht mehr dieselben. Wer
  eine Spalte braucht, hängt hinten einen neuen Schritt an
  (`MIGRATIONS` in `apps/server/src/db/database.ts`).

## Etappenplan
0. ✅ Monorepo-Grundgerüst, WS-Ping/Pong
1. ✅ shared: Hex-Geometrie, kanonische Vertex/Edge-IDs, Szenario-Generator
2. ✅ shared: GameState + Reducer, Basisregeln
3. ✅ client: SVG-Board + Hotseat (vollständiges Spiel ohne Netzwerk)
4. ✅ server: WS-Infra, SQLite, Gast-Identität
5. ✅ Client-Anbindung, State-Filtering, Reconnect
6. ✅ Persistence: Action-Log, „Deine Partien"
7. ✅ Auth: Registrierung, Login, Gast-Account beanspruchen
8. ✅ Handel, Entwicklungskarten
9. ✅ Docker + Coolify
10. Erweiterungen

## Aktueller Stand
Etappen 0 bis 9 fertig. Danach kam der **erste Playtest** und mit ihm zwei
Runden Anpassungen (`etappe-10-playtest`, siehe `PROGRESS.md`): heiße
Zahlenchips, ein Schließkreuz in jedem Dialog, Farbe und Name als eigene
Entscheidung im Wartebereich, ein einstellbares Siegpunktziel, der Bauvorrat,
Umlaute in allen sichtbaren Texten — und dann **Bauen in zwei Schritten**
(erst was, dann wo), ein ablehnbares Gegenangebot (`rejectCounter`), der
Kaufstapel als Material statt als Knopf, eigene Silhouetten für Siedlung und
Stadt (`board/shapes.ts`), Konturen unter den Straßen und getauschte Ecken für
Verlauf und Status. Die Oberfläche ist dabei durchgehend **nicht** im Browser
nachgesehen worden — das ist der größte offene Posten.

Seit Etappe 9 liegt **alles in `main`** — der
Merge der Kette 4–9 (`7872f27`) hat den Rückstand aufgelöst, den `main` seit
Etappe 3 hatte. Coolify baut diesen Branch.

Das Spiel läuft als **ein** Container: der Server liefert den gebauten Client
mit aus, und genau daran hängt die Origin-Regel (gleicher Ursprung, deshalb
keine Domain im Code und kein `CLIENT_ORIGIN` in Produktion). Die SQLite-Datei
gehört auf ein Volume unter `/data`; im Container hört der Server auf **8477**,
in der Entwicklung weiterhin auf 8080. Die Einstellungen stehen in `README.md`
unter „Deployment (Coolify)", die Geschichte der drei Fehlschläge in
`PROGRESS.md`.

Seit Etappe 9 laufen **Sitzungen ab**: gleitend, 60 Tage Untätigkeit, jede
Verwendung setzt neu an (`SESSION_TTL_MS` in `identity/sessions.ts`, dritter
Migrationsschritt `stepSessionExpiry`). Gleitend deshalb, weil dieselbe Tabelle
die Gast-Identitäten trägt — eine absolute Frist nähme einem Gast mitten im
Betrieb seine Partien. Dazu drosselt `identity/loginThrottle.ts` die Anmeldung:
zehn Fehlversuche je **Login-Name** in fünfzehn Minuten, danach ein Satz mit
Wartezeit. Je Name und nicht je IP, weil hinter dem Proxy alle dieselbe haben.
Ein Serverneustart kostet keine Partie mehr: gespeichert wird der Startzustand
plus das Action-Log, wiederhergestellt per `replay` — **kein Snapshot**, das ist
gemessen (4000 Züge = 19 ms).

Seit Etappe 7 ist ein Gast ein richtiges Konto auf Wunsch: `users` trägt
`login`, `password_hash` (`scrypt`) und die freiwillige `email` (tut noch
nichts), das Sitzungsgeheimnis liegt in einer eigenen Tabelle `sessions`
(`token_hash`, `user_id`, `created_at`) statt in `users` selbst — erst dieser
Umzug erlaubt mehrere gleichzeitig angemeldete Geräte pro Konto. Die
Migrationsliste (`MIGRATIONS` in `apps/server/src/db/database.ts`, gezählt
über `PRAGMA user_version`) steht bei zwei Schritten: `stepInitialSchema`
(Etappe 4–6, eingefroren) und `stepSessionsAndAccounts` (Etappe 7, `sessions`
plus der Umbau von `users`).

Seit Etappe 8 gibt es Handel zwischen Spielern, und mit ihm **Zeit als
Infrastruktur**. Ein Angebot ist eine eigene Phase (`tradePending`) und
blockiert den Zug; Mitspieler sagen zu, lehnen ab oder kontern, der Anbieter
wählt den Partner. Die Frist steht als `expiresAt` im Zustand, gespeist aus
einem `at`, das die Aktion mitbringt und **der Server stempelt**
(`stampAction`) — der Reducer liest nie eine Uhr (Regel 2). Ihr Ablauf ist eine
gewöhnliche Aktion (`timeout`), eingeworfen vom Wecker je Raum
(`apps/server/src/rooms/clock.ts`), der dafür nur `deadlineOf(state)` liest.
Ein zweites Zeitlimit später (Abwurffrist, Zugzeit) kostet ein Feld in seiner
Phase und einen Zweig in `deadlineOf`.

Etappe 8 ist im Browser durchgespielt, samt Gegenangebot und Zuschlag; der
Nachtrag dazu steht in `PROGRESS.md`. Ungesehen bleiben die zwei
Viewport-Breakpoints (`26rem`, `62rem`).

Drei Aktionen kommen **nur** vom Server: `timeout`, `dropFromTrade`,
`rejoinTrade`. Sie laufen über `applySystemAction` (ohne Absenderprüfung), und
der ACT-Handler weist sie ab, wenn ein Client sie schickt.

Was in `shared` schon steht:
- `protocol/` — Envelope, Registry, Ping (Etappe 0)
- `random/` — Seed-basierter PRNG als unveränderlicher Wert, Shuffle
- `geometry/` — Hex, Richtungen 0–5, kanonische Knoten-/Kanten-IDs, Topologie
- `scenario/` — Gelände, Häfen, Zod-Definition, Fairness, Blueprints, Generator
- `rules/` — RuleSet (Baukosten, Siegpunkte, Vorräte, Handkartenlimit)
- `seats.ts` — Sitz-Typ und Farbpalette (Etappe 4; der Server vergibt Farben)
- `game/` — GameState, Actions, Reducer, Basisregeln. Einstiegspunkte:
  `createGame`, `reduce`, `legalActions`, `replay`. Der Reducer wirft nicht,
  er gibt `{ ok, state }` oder `{ ok: false, error }` zurück.
  Dazu seit Etappe 4: `playerView.ts` (die Geheimhaltungsgrenze), `log.ts`
  (Verlaufssätze — der Server baut sie), `labels.ts` (die deutschen Wörter;
  die **Farben** blieben im Client neben `index.css`)

Dazu seit Etappe 8: `tradeOffer.ts` (die Datentypen des Angebots — eigene
Datei, damit `phase.ts` sie ohne Ladezirkel importieren kann), `playerTrade.ts`
(alle Regeln des Spielerhandels) und `deadline.ts` (`deadlineOf` — die einzige
Stelle, an der jemand nachsieht, ob eine Uhr läuft).

Regeln liegen je in eigener Datei, jeweils als `can…` (nur prüfen) und
`apply…` (prüfen und anwenden). `legalActions` benutzt dieselben `can…` —
neue Regeln bitte genauso, damit es weiter nur eine Auslegung gibt.

Was im Server steht (Etappe 4/5, `identity/` seit Etappe 7 erweitert):
- `db/` — SQLite samt Migrationsliste (`database.ts`, `MIGRATIONS` über
  `PRAGMA user_version`)
- `identity/` — Gäste und Konten (`users.ts`), Sitzungen in eigener Tabelle
  (`sessions.ts`, nur der Hash liegt in der Datenbank), Passwort-Hashing mit
  `scrypt` (`password.ts`), Registrieren/Anmelden/Abmelden (`accounts.ts`)
- `rooms/` — der Raum als Wert (`room.ts`), Codevergabe und Persistenz
  (`registry.ts`), Zustellung je Empfänger (`broadcast.ts`), Ablage hinter einer
  Schnittstelle (`store.ts`, `sqliteStore.ts`), Übersicht (`summary.ts`)
- `ws/` — Router, Sitzung je Verbindung, geprüftes Senden ohne Anfrage,
  Origin-Regel (gleicher Ursprung ist erlaubt — dafür Tunnel ohne Konfiguration)

Was im Client steht:
- `seats.ts` — reicht Typ und Palette aus `shared` durch, plus lokale Besetzung
- `board/` — Feld/Knoten/Kante zu Punkten (Spitze oben), das SVG-Brett
- `game/` — Klickkarten, Anzeigemodell, Hotseat- und Online-Zustand
- `net/` — Transport, Sitzungsgeheimnis, Einladungslink
- `panels/`, `dialogs/`, `screens/`, `diagnostics/` — Oberfläche.
  `HandPanel` liegt unten links: ein Stapel je Ressource, Kartenfarbe gleich
  Geländefarbe, Motiv als zweiter Träger. Lokal ist das Zudecken beim
  Zugwechsel eine Einstellung (`LocalOptions`), online greift es nie.

**Der Client kennt keine Regel.** Er bekommt eine Aktionsliste, sortiert sie
nach Ort (`game/targets.ts`), und ein Klick schickt die gefundene Aktion
hinaus. Lokal holt er die Liste selbst über `legalActions`, online kommt sie
vom Server. Kein `if (genug Holz)` im Client — sonst gäbe es zwei Auslegungen.
Auch die Dialoge lesen ihre Auswahl aus der Aktionsliste (welches Opfer, welcher
Tausch), nicht aus einer eigenen Rechnung über fremde Handkarten: die sieht der
Client seit Etappe 5 gar nicht mehr.

**Ein Satz Bildschirme für beide Quellen.** `GameScreen` bekommt eine
`PlayerView` und eine Aktionsliste. Die lokale Partie baut beides mit denselben
Funktionen selbst (`useLocalGame`), die Online-Partie bekommt beides geschickt.
Knoten- und Kantenpositionen kommen aus der Id (Schwerpunkt der angrenzenden
Felder), nicht aus einer zweiten Winkelrechnung.

Details, getroffene Entscheidungen und offene Punkte stehen in `PROGRESS.md` —
das ist die maßgebliche Standsdatei, diese hier nennt nur die Landmarken.

## Die Standsdatei wird mitgeschrieben, nicht nachgereicht

**`PROGRESS.md` gehört zu jeder Arbeit, die etwas verändert — ohne dass jemand
danach fragt.** Wer eine Etappe, ein Stück davon oder eine Korrektur abliefert,
schreibt den Abschnitt dazu und committet ihn mit. Nachträglich ist er
schlechter: die Begründung, warum es so und nicht anders gebaut wurde, ist im
Moment der Entscheidung noch da und eine Woche später rekonstruiert.

Der Abschnitt folgt der Form, die schon dasteht:

- **Überschrift und Stand** — was, wann, welcher Branch, welche Commits.
- **Abnahme** als Tabelle: `pnpm typecheck`, `pnpm test` (mit den Zahlen je
  Paket), `pnpm build` (mit Bundlegröße), `pnpm format:check`. **Zahlen werden
  gemessen, nicht geschätzt** — eine erfundene Testzahl macht die ganze Tabelle
  wertlos.
- **Getroffene Entscheidungen** — je Absatz eine, fett angeführt, mit dem
  Grund. Das ist der eigentliche Wert der Datei: was gebaut wurde, steht im
  Code, warum es so gebaut wurde, nur hier.
- **Abweichungen vom Plan**, falls es welche gab.
- **Offene Punkte** — auch die bewussten. Eine Abweichung von den Spielregeln,
  die niemand aufgeschrieben hat, ist beim nächsten Lesen ein Fehler.
- **Nächste Etappe**.

Wer die Datei nachträgt statt sie mitzuschreiben, sagt das im Abschnitt dazu
und kennzeichnet, welche Zahlen an welchem Stand gemessen wurden.
