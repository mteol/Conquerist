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
- Eine Animation, die etwas ausblendet, ist bei `prefers-reduced-motion` von
  Anfang an unsichtbar — die abgeschaltete Animation steht sofort an ihrem
  Ende. Für Information deshalb nur Eingangs-, nie Ausgangsanimationen.

## Etappenplan
0. ✅ Monorepo-Grundgerüst, WS-Ping/Pong
1. ✅ shared: Hex-Geometrie, kanonische Vertex/Edge-IDs, Szenario-Generator
2. ✅ shared: GameState + Reducer, Basisregeln
3. ✅ client: SVG-Board + Hotseat (vollständiges Spiel ohne Netzwerk)
4. ✅ server: WS-Infra, SQLite, Gast-Identität
5. ✅ Client-Anbindung, State-Filtering, Reconnect
6. ✅ Persistence: Action-Log, „Deine Partien"
7. Auth: Registrierung, Login, Gast-Account beanspruchen
8. Handel, Entwicklungskarten
9. Docker + Coolify
10. Erweiterungen

## Aktueller Stand
Etappen 0 bis 6 fertig. 0–3 liegen in `main`, 4–6 auf `etappe-4-online`.
Ein Serverneustart kostet keine Partie mehr: gespeichert wird der Startzustand
plus das Action-Log, wiederhergestellt per `replay` — **kein Snapshot**, das ist
gemessen (4000 Züge = 19 ms).

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

Regeln liegen je in eigener Datei, jeweils als `can…` (nur prüfen) und
`apply…` (prüfen und anwenden). `legalActions` benutzt dieselben `can…` —
neue Regeln bitte genauso, damit es weiter nur eine Auslegung gibt.

Was im Server steht (Etappe 4/5):
- `db/`, `identity/` — SQLite, Gäste; das Sitzungsgeheimnis liegt **nur gehasht**
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
