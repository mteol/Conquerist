# Architektur und Landkarte des Codes

Wo was liegt und warum. Aus `CLAUDE.md` ausgelagert (Stand 10d-2); bei Bedarf gezielt lesen.

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

Seit dem **Ton** (`etappe-10-ton`) klingt das Spiel: 23 synthetisierte Klänge
unter `apps/client/src/audio/`, ein Einstellungen-Dialog mit Gesamt-, Effekt-
und Musiklautstärke hinter einem festen Zahnrad oben rechts. Kein Audio-Byte im
Image — jeder Klang ist ein Rezept aus Zahlen, und `samples.ts` führt alle 23
als auskommentierte Zeilen, falls später eine mp3 einen davon ersetzen soll.

Seit dem 19.08. gibt es **Musik**, und sie ist die eine bewusste Ausnahme davon:
`apps/client/public/music/catan.mp3` (2,22 MB) läuft als Schleife über alle
Bildschirme, angehängt an denselben Musik-Bus, den der Ton schon angelegt hatte
(`audio/music.ts`, `playMusic` in `audio/engine.ts`). Effekte bleiben Rezepte —
eine Melodie lässt sich nicht aus Hüllkurven bauen. Sie startet bei der ersten
Nutzergeste, nie beim Laden, und ihr Ausfall ist immer still.

Am **Spielbildschirm** stehen seit demselben Tag der Status oben rechts neben
der Verlaufstür (`.topline`) und die Würfel ganz außen in der unteren rechten
Ecke, mit Kaufstapel und Bauteilen links daneben. Das `ActionPanel` stellt
seither nur noch die Bauteile und braucht keine `GameView` mehr. Und die
**Entwicklungskarten sind Karten geworden**: derselbe Kartenkoerper wie in der
Hand, Pergament statt Geländefarbe, dazu fünf gezeichnete Motive in
`panels/DevelopmentGlyph.tsx` — dieselbe Handschrift wie `ResourceGlyph.tsx`.
Der Name bleibt hier auf der Karte stehen, weil alle fünf dasselbe Pergament
sind und das Motiv sonst allein trüge. Der Siegpunkt ist dabei **kein Knopf**:
er wird nie gespielt, und ein dauerhaft gesperrtes Bedienelement sagt „gerade
nicht" über etwas, das nie geht.
Dafür sagt das Protokoll neuerdings, **welcher** Zug einen Stand erzeugt hat
(`move: { type, actor }` im `GameEvent`): der Client bekam vorher nur den
fertigen deutschen Verlaufssatz und hätte den Klang aus Text raten müssen.

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
- `type/` — die gezeichnete Anzeigeschrift. `Numerals.tsx` hält die zehn
  Ziffern, `Numeral` setzt sie in ein SVG (Brett), `NumeralText` in eine Zeile
  (Satz). Die Buchstaben liegen aus historischen Gründen noch in
  `screens/Wordmark.tsx` — ein Raster, zwei Dateien.
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
