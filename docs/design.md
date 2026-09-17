# Design

Ausführliche Designregeln und die Fallen, die schon zugeschnappt sind. Die Kurzfassung steht in `CLAUDE.md`. **Vor jeder Arbeit an der Oberfläche lesen.**

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

**Und es gibt eine eigene Anzeigeschrift — gezeichnet, nicht geladen.**
`screens/Wordmark.tsx` (zehn Buchstaben) und `type/Numerals.tsx` (zehn Ziffern)
sitzen auf **einem** Raster: Versalhöhe 100, Stammbreite 17, Fase 17 außen und
10 im engen Innenraum. Wo eine Schrift rundet, sitzt eine Schräge. Wer ein
Zeichen ändert oder hinzufügt, hält diese drei Zahlen ein — eine Fase von 12 an
einer Stelle sieht nicht nach Variante aus, sondern nach Versehen. Die Ziffern
haben **alle denselben Vorschub** (81), auch die schmale Eins; genau darin
besteht eine Tabellenziffer.

Sie ist eine **Anzeigeschrift** und keine zweite Grundschrift. Sie steht, wo
die Zahl der Inhalt ist und groß dasteht — Zahlenchip, Würfelsumme. Eine
laufende Zeile („0 Karten", „wirft 3 ab") bleibt Fließtext; eine Anzeigeschrift
mitten im Satz ist keine Persönlichkeit, sondern ein Setzfehler.

**Derselbe Winkel trägt auch die Bedienung.** `corner-shape: bevel` schneidet
Knöpfe, Felder, Rahmen und Dialoge aus demselben 45-Grad-Schnitt (eine Regel,
`index.css`). Nicht geschnitten wird Spielmaterial — Karten, Würfel, Chips,
Bauteile haben ihre Form aus der Wirklichkeit. Und **nie per `clip-path`**: das
schneidet den Kontaktschatten mit ab, und der ist der ganze Unterschied
zwischen „liegt auf dem Tisch" und „ist ein Rechteck".

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
  überschreiben soll, zählt ihre Spezifität nach. **Derselbe Block hat es ein
  zweites Mal getan:** `.chip__pips { font-size: 0.19px }` verlor gegen
  `.chip text { font-size: 0.32px }`, und die Augen ragten über den Chiprand.
  Wer eine Falle an einer Stelle behebt, sieht im selben Block nach, wo sie noch
  steht.
- **Eine Animation, die laenger dauert als ihr Zustandswechsel, muss ihn
  aufhalten.** Wurf, Verlaufszeile, Plaketten und Klang stammen aus **einer**
  Zustandsaenderung und erscheinen im selben Augenblick. Sobald die Wuerfel eine
  Sekunde fliegen, steht die Zahl im Verlauf, bevor sie faellt - die Animation
  erklaert dann nicht mehr den Wechsel (Designregel 5), sie kommt ihm hinterher.
  `useSettledRoll` haelt deshalb die **ganze** Vorfuehrung an, und zwar
  **vor** `useCueSound`: sonst ist der Wurf zu hoeren, bevor er liegt.
- **Wo Bewegung ausfaellt, faellt auch das Warten aus.** Eine Sekunde Stillstand
  ohne sichtbaren Grund ist kein Spannungsbogen, sondern eine hakende
  Oberflaeche. Bei `prefers-reduced-motion` - und ueberall, wo es kein
  `matchMedia` gibt - wird deshalb gar nicht gewartet, nicht bloss nicht
  animiert.
- **Ein Element, das waehrend einer Animation weiterlebt, sperrt sich selbst.**
  Die Klickkarte stammt aus dem Stand von vorhin und laesst das Werfen
  selbstverstaendlich noch zu; ohne ein eigenes `disabled` am Becher schickt der
  zweite Klick einen zweiten Wurf.
- **`advanceTimersByTime` allein flusht kein React.** Der Wecker feuert, aber
  was er an Zustand setzt, haengt danach in der Warteschlange - ohne `act` liest
  der Test den Bildschirm von _vor_ dem Timer und meldet einen Fehler, den es
  nicht gibt.
- **`disabled` allein sieht man nicht.** An einem Knopf mit eigenem
  Hintergrund ändert das Attribut die Farben nicht; ohne eine Regel für den
  Zustand ist die Sperre im Browser gemessen **identisch** zum offenen Knopf.
  Wer etwas sperrt, um es sichtbar zu machen, prüft nach, dass man es sieht —
  sonst ist der Fix genau der Fehler, den er beheben sollte.
- **Ein Bedienelement lügt in beide Richtungen.** Ein Knopf, der nie angeht
  (der Siegpunkt), sagt „gerade nicht" über etwas, das nie geht; ein Knopf, der
  immer angeht und an der Grenze lautlos klemmt (die `+` im Abwurf und im
  Angebot), verspricht eine Wirkung, die es nicht gibt. Beide Male ist die Kur
  dieselbe: **Zustand und Wirkung fragen dieselbe Funktion**, damit sie nicht
  auseinanderlaufen können.
- **Eine Sonde am falschen Ort sagt „kaputt" über etwas Heiles.**
  `document.querySelectorAll('audio')` fand die Musikspur nicht — `new Audio()`
  erzeugt ein Element, das gar nicht im Dokument hängt. Erst ein Haken um
  `Audio`, `play()` und `AudioContext`, **vor** der ersten Geste gesetzt, hat
  gezeigt, dass alles läuft. Vor dem Befund „geht nicht" steht die Frage, ob die
  Messung überhaupt hinsehen kann.
- **Ein Automat, der den ersten freien Knopf drückt, findet die toten.** Er hat
  auf „Lehm +" gedrückt, weil der als erster nicht gesperrt war, und der Zähler
  blieb stehen — ein Mensch hätte den Knopf gar nicht erst probiert. Beim
  Durchklicken lohnt es sich, absichtlich das zu drücken, was niemand drückt.
- **Ein Suchlauf, der nur Zeichenketten ansieht, findet keinen JSX-Text.**
  „Der Kurs ergibt sich aus deinen Haefen" steht zwischen zwei Tags und trägt
  keine Anführungszeichen; der erste Umlaut-Suchlauf meldete deshalb sauber.
  Sichtbarer Text ist beides — Literal **und** Kinderknoten.
- **Ein Befund, der an seinen Fundstellen repariert wird, kommt wieder.** Der
  Browser-Durchlauf hat `.button--ghost` als creme auf Pergament gemeldet,
  1,05:1, „an rund zehn Stellen unsichtbar". Behoben wurden damals die drei
  Antwortknöpfe am Angebot und das Zahnrad — die Klasse blieb, wie sie war, und
  „Abbrechen" im Handel war Monate später immer noch unsichtbar. Repariert wird
  die Ursache; geht das nicht (`--ink` liegt nicht an jedem Grund vor), dann an
  der Stelle, an der der Untergrund **garantiert** ist, und mit dem Grund im
  Kommentar.
- **Eine Zielmarke, die nur am leeren Platz hängt, fehlt genau da, wo schon
  etwas steht.** `building === undefined ? Marke : Bauwerk` war für Straßen und
  Siedlungen richtig und für den Ausbau zur Stadt tödlich: dort sind _alle_
  Ziele bebaut, das Brett blieb vollkommen ruhig, und anklickbar war es die
  ganze Zeit. Wer einen Zustand als „entweder/oder" schreibt, prüft, ob es einen
  Zug gibt, in dem beides zugleich gilt.
- **Eine Maßangabe in Textmetriken ist keine Maßangabe.** Wie breit fünf `·`
  werden, hängt an der Schrift, die gerade da ist — nicht ausrechenbar und auf
  einem Rechner ohne Segoe UI eine andere Zahl. Was in eine Form passen muss,
  wird gezeichnet und nicht gesetzt; dann ist es rechenbar und damit prüfbar,
  auch ohne Layout-Engine.
- **Eine Animation, die beim Einhängen läuft, läuft beim Aktualisieren nicht.**
  Der Ausbau zur Stadt hat denselben Knoten behalten, React hat das Element
  aktualisiert statt es neu einzuhängen, und `animation: settle` blieb still —
  aus einem Punkt wurde lautlos ein größerer Punkt. Wer einen _Wechsel_ zeigen
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
  und der Absendeknopf war offen. Wer Zustand hält, der zu _einem_ Vorgang
  gehört, setzt ihn zurück, sobald sich der Vorgang ändert; „wird ja neu
  gerendert" heißt nicht „fängt neu an".
- **Ein Kommentar, der eine Absicht beschreibt, ist kein Nachweis, dass sie im
  Blatt steht.** An `.dice--waiting` stand zwei Etappen lang, die zwei
  `--ink`-Zeilen seien gefallen, weil dunkle Tinte auf der Tiefsee „dieselbe
  unsichtbare Schrift" wäre. Gefallen sind sie — **umgestellt wurde nichts**,
  und ohne Umstellung fällt `--ink` auf den Grundwert aus `:root` zurück, und
  der ist dunkel. Die Würfelsumme stand damit bei gemessenen 1,13:1, die
  Aufforderung „Würfeln" bei 2,5:1. Wer einen Wegfall beschreibt, schreibt
  dazu, was **stattdessen** gilt, und misst es nach.
- **Eine Variable, die ein Kind setzt, holt seine Geschwister nicht ab.** Die
  Kur oben gehört an `.dice-tray` und nicht an `.dice`: „Würfeln" steht _neben_
  dem Becher, nicht darin. Am Becher gesetzt hätte die Umstellung die Summe
  geholt und das Wort daneben stehen lassen — der halbe Fix, der aussieht wie
  ein ganzer. Vor einer Zeile mit `--ink` steht die Frage, wer alles davon
  erben muss.
- **Ein negativer Einzug gehört dorthin, wo das Polster steht.** `.sea-chart`
  trug `inset: -0.75rem`, um das Polster von `.game` auszugleichen. Der
  Startbildschirm hat kein Polster und erbte die Regel trotzdem: das Netz ragte
  12 px über jede Seite hinaus und schob der Seite einen waagerechten
  Rollbalken unter — von einem Element, das man nicht anfassen kann. Ein
  Bauteil kennt das Polster seines Trägers nicht; der Ausgleich steht beim
  Träger.
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
- **Ein `once` auf einer Geste, die scheitern darf, ist ein Versuch und kein
  Anlauf.** Der Browser gibt Audio erst nach einer Nutzergeste frei — und darf
  auch die erste noch ablehnen. Ein Listener mit `{ once: true }` hätte die
  Musik in genau diesem Fall für immer stumm gelassen, ohne dass man ihm das
  ansieht. Er bleibt deshalb hängen, und `playMusic` ist so gebaut, dass ein
  zweiter Aufruf bei laufender Spur nichts tut. Wer eine Handlung an eine Geste
  hängt, die fehlschlagen kann, fragt zuerst, was der zweite Versuch kostet.
- **Ein Effekt unter `StrictMode` läuft doppelt.** `main.tsx` lässt ihn an, und
  in der Entwicklung klang deshalb jeder Zug zweimal, bis eine Sperre auf die
  Folgenummer dazukam (`useCueSound` in `audio/useAudio.tsx`). Wer einen Effekt
  schreibt, der etwas _auslöst_ statt etwas _einzurichten_, braucht eine
  Kennung, die sagt, ob es schon passiert ist.
- **Eine Grenze, die die falsche Einheit zählt, ist ein Fehler.** Die
  Stimmensperre stand auf acht _Schichten_; ein Würfelwurf kostet allein sechs
  (Klick plus fünf Ticks), und alles danach fiel weg — der Verlauf meldete
  „Spieler 1 +2", und der Ertragsklang kam nicht. Gezählt wird jetzt, was der
  Spieler als _einen_ Klang hört, nicht, woraus er gebaut ist.
- **Ein Wächter, den der Compiler wegwirft, wacht nicht.** `noUnusedLocals`
  verwirft einen nur lokal deklarierten Typ; der Vollständigkeitsbeweis für die
  Zugtypen (`NoActionTypeForgotten` in `game/actions.ts`) ist deshalb
  exportiert, obwohl ihn niemand benutzt.
- **Ein einmal veröffentlichter Migrationsschritt wird nie wieder angefasst.**
  Er beschreibt den Stand, den es einmal gab. Wer ihn ändert, gibt Bestands-
  und Neudatenbanken verschiedene Schemata — deren `user_version` steht auf
  derselben Zahl, aber die Tabellen darunter sind nicht mehr dieselben. Wer
  eine Spalte braucht, hängt hinten einen neuen Schritt an
  (`MIGRATIONS` in `apps/server/src/db/database.ts`).
- **Eine Deckkraft unter einem Pixel Strichbreite ist nicht die Deckkraft, die
  dasteht.** Die Geländetextur stand auf `stroke-width: 0.012` — im Browser
  gemessen **0.78 Pixel**. Unterhalb eines Pixels zeichnet der Browser nicht
  dünner, sondern blasser: er verteilt den Strich auf zwei Pixelreihen und
  rechnet die Deckung herunter. Von 17 Prozent kamen rund 13 an, auf einem
  Grund, gegen den sie ohnehin nur 1.23:1 standen — die Textur war nicht
  „leise", wie ihr Kommentar behauptete, sie war **weg**. Wer eine Feinheit in
  Brettmaßen setzt, rechnet sie einmal in Pixel um; unter 1 px gilt die Zahl im
  Blatt nicht mehr.
- **Dieselbe Tinte auf sechs Farben ist nicht sechsmal dieselbe Textur, und
  derselbe Kontrast auf sechs Mustern auch nicht.** Zweimal am selben Tag: erst
  stand die Einheitstinte auf der Wüste bei 1.41:1 und auf dem dunklen Wald bei
  1.23:1 — am schwächsten genau dort, wo die Unterscheidung am nötigsten war.
  Dann standen alle sechs auf 1.50:1, und Hügel und Acker sahen trotzdem
  doppelt so laut aus: der Ziegelverband belegt **25.3 Prozent** seiner Kachel,
  der Wald **9.8**. Ein Muster aus durchlaufenden Linien füllt eine Fläche, ein
  Muster aus vereinzelten Marken tupft sie an. Wer eine Textur einstellt,
  rechnet gegen den **eigenen** Grund und gegen die **eigene** Deckung.
- **Ein weicher heller Rand um ein Objekt ist ein Glow, auch wenn er
  „Küstensaum" heißt.** Drei gleichmäßig verteilte Untiefen (0.34/0.20/0.10 bei
  7/10/15 Prozent) liefen zu einem Verlauf zusammen und sahen aus wie das, was
  Designregel 5 hinauswirft. Was Wasser um eine Küste tut, ist ungleichmäßig:
  am Land deutlich, nach außen sich verlierend. Eine Stufung, die man nicht
  zählen kann, ist keine.
- **Ein grüner Testlauf ist kein Beweis, dass die Tests halten.** Zwei neue
  Testdateien haben `StartScreen.test.tsx` zum Kippen gebracht — und auf dem
  gestashten Stand, ohne eine einzige Änderung, fielen **zwei von drei** vollen
  Läufen. Der Fehler war die ganze Zeit da; die zusätzliche Last hat ihn nur
  sichtbar gemacht. Wer einen Flake sieht, misst ihn **auf dem Stand davor**,
  bevor er die eigene Änderung verdächtigt.
- **`userEvent.clear(feld)` und `userEvent.type(feld, …)` sind zwei Sitzungen
  und teilen keinen Zustand.** Die Direkt-API legt für jeden Aufruf ein neues
  `setup()` an; was der eine Aufruf an Tastendrücken in der Schlange hat, weiß
  der nächste nicht, und user-event setzt obendrein echte Verzögerungen
  zwischen die Tasten. Unter 35 parallelen Testdateien landeten Restzeichen aus
  `brett-zwei` im nächsten Feld (`"weiAnna"`). Eine gemeinsame Sitzung mit
  `delay: null` — und danach auf den Wert **im Feld** warten, denn bei einem
  kontrollierten Input kommt er aus dem React-Zustand zurück, und wer sofort
  danach liest, liest den Stand von vorher.
