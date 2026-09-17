# Fortschritt — Etappen 10a bis 10c (Archiv)

## Etappe 10a — Handelswaren und der dritte Würfel (2026-08-26, `etappe-10-staedte-und-ritter`)

Der Beginn von **Städte & Ritter**. Die Regeln liegen als Referenz in
`docs/regeln-staedte-und-ritter.md`, der Entwurf für alle fünf Teiletappen in
`docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md`, der Plan für
diese in `docs/superpowers/plans/2026-08-25-etappe-10a-handelswaren-und-der-dritte-wuerfel.md`.

Was jetzt geht: eine Partie nach Städte-&-Ritter-Regeln, im Wartebereich und
lokal wählbar. Drei Würfel, davon einer mit Symbolen. Handelswaren als eigene
Karten auf der Hand, im Bank- und Hafenhandel, im Abwurf und im Angebot.
Gründung mit Siedlung **und Stadt**. 13 Siegpunkte, keine Entwicklungskarten,
keine Größte Rittermacht. Das Barbarenschiff fährt.

### Abnahme

| Prüfung             | Ergebnis                                                 |
| ------------------- | -------------------------------------------------------- |
| `pnpm typecheck`    | grün                                                     |
| `pnpm test`         | grün — shared 703 / 42, server 211 / 22, client 459 / 44 |
| `pnpm build`        | grün, Client-Bundle 451 kB (133 kB gzip), CSS 55.9 kB    |
| `pnpm format:check` | grün                                                     |

Vorher: 638 / 202 / 432. Neu also 65 Tests in `shared`, 9 im Server, 27 im
Client.

### Getroffene Entscheidungen

**Ein Mengensatz, zwei Id-Typen.** Handelswaren liegen auf derselben Hand wie
Rohstoffe und werden gestohlen, abgeworfen und gehandelt wie sie — ein zweiter
Mengensatz daneben müßte jede Handoperation doppelt führen und wäre eine zweite
Wahrheit über dieselbe Hand. `ResourceAmounts` heißt deshalb `CardAmounts` und
hat als Schlüssel `CardId` (acht Sorten). `ResourceId` bleibt der enge Typ:
Baukosten, Häfen, Geländeertrag und das Aquädukt behalten ihn und sind damit
compilergeschützt. Der Rename ging über 39 Dateien und hat kein Verhalten
geändert — gemessen daran, daß 647 / 202 / 432 Tests grün blieben, ohne daß eine
Erwartung angefaßt wurde.

**Zod 4 macht ein `z.record` mit Enum-Schlüssel erschöpfend, und das wäre
beinahe teuer geworden.** Seit Etappe 6 liegt der Startzustand jeder Partie als
JSON in der Datenbank; die dort abgelegten Mengensätze haben fünf Schlüssel.
Erwartet hatte ich einen stillen Rechenfehler (`undefined - 0` ist `NaN`).
Tatsächlich schlägt schon das **Einlesen** fehl: sechs Testfehler, alle mit
„expected number, received undefined". Ohne `partialRecord` wäre beim nächsten
Serverstart jede laufende Partie weg gewesen. Eingelesen wird jetzt, was
dasteht; `cardAmounts` ergänzt den Rest mit null.

Damit fällt eine Zusage weg, und sie steht als Test da: eine ausgelassene Sorte
in einer Kostenzeile wird nicht mehr abgewiesen, sie bedeutet null. Was bleibt,
ist der Schutz vor dem Tippfehler — einen Schlüssel, den es nicht gibt, weist
Zod weiterhin ab.

**Fehlend heißt nicht kostenlos.** Aus derselben Umstellung sind `buildCosts`
und `developmentDeck` teilweise geworden: was fehlt, gibt es an diesem Tisch
nicht. `priceOf` gab bisher `EMPTY_CARDS` zurück, wenn das Regelwerk keinen
Preis nennt — in Städte & Ritter hätte das jede Entwicklungskarte zum Nulltarif
hergegeben, und der leere Stapel hätte den Fehler nur verdeckt. Am Bildschirm
fällt aus demselben Grund der Kaufstapel weg, wo das Regelwerk ihn nicht preist:
dort stand ein Ersatzpreis aus lauter Nullen, und „kostenlos" ist die falsche
Auskunft über etwas, das es nicht gibt.

**Welche Kartensorten am Tisch liegen, ist Daten** (`RuleSet.cards`). Sonst böte
`legalActions` an einem Basistisch vierundsechzig Bankgeschäfte statt
fünfundzwanzig. Nicht aus `resourceBank` abgeleitet — ein Vorrat darf mitten in
der Partie auf null fallen, und eine Sorte verschwände dann aus der Bedienung.

**Der Ereigniswürfel fällt in der Schale, seine Bedeutung liegt woanders.**
`DieSpec.render` sagt, ob eine Seite Augen oder Symbole trägt — ein Datenfeld
und keine Fallunterscheidung nach Id im Browser. **Was** die Symbole bedeuten,
steht in `game/cities/event.ts`; `rules/dice.ts` schließt das im Kopf
ausdrücklich aus. Der rote Würfel heißt weiter `second`: eine dritte Id machte
jeden gespeicherten Wurf unlesbar.

**Woran die Erweiterung hängt, ist ein Merkmal und kein Name.** Ob die zweite
Setzung eine Stadt ist, entscheidet `rules.barbarianTrack > 0` und nicht
`rules.id === 'cities'`. Wer eine Variante baut, die Handelswaren kennt und
anders heißt, bekäme sonst die falsche Gründung.

**Die Handelsware ist dieselbe Karte in anderer Ausführung.** Pergamentkörper
mit geländefarbenem Rand statt ganzflächiger Geländefarbe. Papier kommt aus dem
Wald, aber Holz und Papier dürfen nicht gleich aussehen — man hält beide
gleichzeitig und zählt sie vor dem Abwerfen unter Zeitdruck. Zwei Komponenten
wären zwei Gelegenheiten auseinanderzulaufen; die Begründung stand im Kopf von
`ResourceCard.tsx` schon, als es fünf Sorten gab.

**Die Farbe trägt am Ereigniswürfel nicht allein.** Die drei Stadttore heißen in
der Schachtel nur gelb, blau und grün. Hier steht in jedem Tor zusätzlich das
Motiv der Handelsware, mit der sein Bereich bezahlt wird — wer ein gelbes Tor
sieht, soll wissen, daß er Tuch verbaut hat.

**Das Schiff gleitet, es springt nicht.** Eine `transition` auf `transform` und
keine `animation`: eine Animation läuft beim Einhängen und nicht beim
Aktualisieren, und hier bleibt derselbe Knoten stehen. Der Stand kommt aus
derselben zurückgehaltenen `view` wie alles andere — das Schiff rückt vor,
**nachdem** die Würfel liegen.

**`THROW_MS` rechnete den Versatz von zwei Würfeln ein.** Der dritte ist 140 ms
nach dem ersten unterwegs; der Tisch wäre aufgegangen, während er noch rollte,
und der Verlaufssatz stünde wieder vor dem Wurf — genau der Fehler, gegen den
es `useSettledRoll` gibt. Gezählt wird jetzt, was wirklich fällt (`throwMs`),
und der Versatz steht nur noch an einem Ort statt in Blatt und Bauteil.

### Der Durchgang im Browser — vier Befunde, alle gemessen

Zum ersten Mal seit Etappe 8 ist die Oberfläche im Browser angesehen worden.
Vier Dinge sind dabei aufgefallen, die kein Test gefunden hat.

**1. Die Regelwerkswahl überlappte sich.** Sie stand in `.seatcount`, und dessen
Label ist ein 2,9 rem breites Sechseck für **eine Ziffer**. „Städte & Ritter"
lief darüber hinaus. Eigene Klasse `.variantpick`, Breite folgt dem Wort;
nachgemessen liegt „Basisspiel" jetzt bei 48–145 px und „Städte & Ritter"
beginnt bei 153.

**2. Die Barbarenleiste lag auf dem Tischpanel.** Beide standen fest oben links.
Die Höhe des Tisches hängt an der Zahl der Spieler (gemessen 104 px zu dritt),
also kann kein fester Abstand darunter stimmen — eine Spalte, in der beide
fließen, kann es. `.leftrail` trägt jetzt die Lage, `.panel--table` steht
`static`. Nachgemessen: Tisch 12–116, Leiste 126–169.

**3. „Größte Rittermacht" lag an einem Städte-&-Ritter-Tisch aus** und versprach
„ab 3 Ritter" — ein Wettlauf, den niemand laufen kann, um einen Preis, der null
zählt. `awardsOf` zählt jetzt nur auf, was das Regelwerk auch bepunktet. Woran
es hängt, ist der Punktwert und kein Name: damit braucht ein späteres Regelwerk
ohne Handelsstraße hier auch keinen Eintrag.

**4. Der farbige Rand der Handelsware kam im Handelsdialog nie an.** Die Regel
stand da, gegriffen hat sie nie: `.rescard` deklariert weiter unten im Blatt die
**Kurzform** `border: 1px solid …`, und bei gleicher Spezifität gewinnt die
spätere Zeile. Gemessen 1 px in `rgba(22 32 42 / 55%)` statt 3 px in
Geländefarbe — während dieselbe Absicht an der Handkarte ankam, weil ihr
Selektor zwei Klassen hat. **Das ist die Falle, die in `CLAUDE.md` zweimal
steht, und ich bin ein drittes Mal hineingelaufen.** Die Regel steht jetzt
hinter `.rescard`; nachgemessen 3 px in `rgb(47 107 58)`.

Dazu eine Korrektur an einer Zahl, die ich geschrieben und nicht gemessen
hatte: das Motiv im Stadttor sollte „rund neunzehn Pixel" groß sein, im Browser
waren es 13,8. Der Grund ist, daß ein Motiv seinen 24er-Kasten nicht ausfüllt —
das Tuch belegt davon fünfzehn Einheiten in der Breite. Mit `scale(0.78)` sind
es jetzt gemessene 14,9 × 17,9 px, und der Torbogen ist dafür dünner geworden
(2,9 statt 3,5 px), weil er sonst der Held war und nicht der Rahmen.

Eine Nebenbemerkung zur Meßweise: eine Sonde an einem **geklonten** SVG lieferte
17,4 × 22,4 px — eine Zahl über etwas, das so nirgends steht, weil die Kopie
ihre Größe vom Probenrahmen bekommt. Gemessen wird am eingehängten Element.

**Was der Durchgang bestätigt hat:** der Server lädt **13 bestehende Räume** von
der Platte — Migration und Kartenauffüllung halten am echten Bestand. Drei
Würfel fallen, der dritte trägt ein Symbol und keine Augen. Die Vorleseansage
lautet „Wurf: 2 und 5, zusammen 7, Ereignis: Handel". Nach der Gründung steht
„Barbaren 3" (drei Städte). Das Schiff rückt bei Schiffswürfen vor. Tuch fällt
an der Weide und liegt als Pergamentkarte neben Wolle und Erz. Der
Handelsdialog trägt acht Sorten in zwei Reihen und läuft in einem 544 px
breiten Fenster nicht über.

### Abweichungen vom Plan

**Aufgabe 10 (Bankhandel) wurde vor Aufgabe 4 gezogen.** `legalActions` über
`rules.cards` zu zählen setzt voraus, daß `canTradeWithBank` eine `CardId`
annimmt — sonst steht dazwischen ein Zustand, der nicht typprüft.

**Die Wahl im StartScreen kam erst beim Browser-Durchgang dazu.** Sie stand im
Plan und ist beim Abarbeiten untergegangen; aufgefallen ist es, weil ohne sie
keine lokale Städte-&-Ritter-Partie zu starten war.

### Offene Punkte

- **Das Schiff hält ein Feld vor der Küste an.** Eine Zeile in `advanceShip`,
  mit Begründung im Code. Der Kampf braucht Ritter; ohne sie wäre die
  Verteidigung immer null, und alle sieben Schiffswürfe verlöre jeder
  Städtebesitzer eine Stadt. Fällt in 10b.
- **Die drei Stadttore des Ereigniswürfels werden gelesen und tun nichts.** Die
  Fortschrittskarten kommen in 10d.
- **Der Räuber ist frei wie im Basisspiel.** Die Sperre bis zum ersten Überfall
  gehört zum Überfall und kommt mit ihm in 10b.
- **Die Ritterstärke fehlt in der Barbarenleiste.** `defenders` ist `null`, weil
  es noch keine Ritter gibt — eine Null, die niemals steigen kann, sagt „gerade
  nicht" über etwas, das nie geht. Die Leiste nimmt die Zahl schon entgegen.
- **Die Barbarenleiste ist noch leise gesetzt**, und das ist eine bewußte
  Vertagung: sie trägt heute eine Zahl und ab 10b zwei, die gegeneinander
  stehen. Ihre endgültige Gewichtung gehört in den Zug, in dem der Vergleich
  entsteht.
- **Der Handelsdialog ist nach der Korrektur gemessen, aber nicht neu
  fotografiert** — der Renderer der Browser-Erweiterung fror beim Bildmachen ein
  (ein bekanntes Verhalten). Die Messung am eingehängten Element ist die härtere
  Auskunft, aber ein Bild fehlt.
- **Die zwei Viewport-Breakpoints (`26rem`, `62rem`) sind weiterhin ungesehen.**
  Die Leiste bekommt unter 40 rem eine kürzere Fahrstrecke; nachgemessen ist
  auch das nicht.

### Nächste Etappe

**10b — Ritter und Barbaren.** Ritterfiguren auf Kreuzungen, bauen, aktivieren,
aufwerten, versetzen, vertreiben, den Räuber vertreiben. Die Fahrstrecke bis zu
Ende, der Kampf mit allen Sonderfällen, die Retter-Chips, die Stadtmauern und
die Räubersperre.

---

## Etappe 10b — Ritter und Barbaren (2026-08-26, `etappe-10-staedte-und-ritter`)

Vierzehn Commits von `1a161f2` (Bauteile und Zustand) bis `1e53766` (Bedienung). Der
Plan steht in `docs/superpowers/plans/2026-08-26-etappe-10b-ritter-und-barbaren.md`, der
Entwurf für alle fünf Teiletappen in
`docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md`.

Was jetzt geht: Ritterfiguren auf Kreuzungen — bauen, aktivieren, aufwerten, versetzen,
vertreiben, ausweichen, den Räuber verjagen. Stadtmauern samt erweitertem
Handkartenlimit. Die Fahrstrecke bis zur Küste, der Barbarenüberfall mit Retter-Chips
und Städteverlust, und die Räubersperre bis zum ersten Überfall.

### Abnahme

| Prüfung             | Ergebnis                                                 |
| ------------------- | -------------------------------------------------------- |
| `pnpm typecheck`    | grün                                                     |
| `pnpm test`         | grün — shared 894 / 48, server 211 / 22, client 485 / 45 |
| `pnpm build`        | grün, Client-Bundle 472 kB (139 kB gzip), CSS 57.5 kB    |
| `pnpm format:check` | grün                                                     |

Vorher: 703 / 211 / 459. Neu also 191 Tests in `shared`, keiner im Server, 26 im Client.
Elf davon sind erst nach dem Durchgang im Browser dazugekommen — sie halten Befunde fest,
die kein Test gesehen hatte.
Der Server hat keine bekommen, und das ist die Antwort auf eine Frage, die man beim
Lesen stellt: die Erweiterung fügt keine Nachricht und keinen Handler hinzu. Sieben neue
Zugarten reisen als `game.act` durch dasselbe Rohr wie alle anderen, weil das Protokoll
seit Etappe 4 die Aktion validiert und nicht ihre Art aufzählt.

### Getroffene Entscheidungen

**Ritter stehen im `GameState`, nicht beim Spieler.** Die Belegung des Bretts steht
einmal in `buildings`, `roads` und `knights` und nirgends sonst. Ein zweiter Ort, an dem
ein Spieler seine Figuren führt, wäre eine zweite Wahrheit darüber, wer wo steht — und
die erste Vertreibung, bei der eine Figur den Besitzer nicht wechselt, sondern den Ort,
hätte beide auseinanderlaufen lassen.

**`activatedOnTurn` ist eine Zahl und kein Flag „darf handeln".** Gezählt wird in
`state.turn`, also in vollen Runden; weil jeder je Runde einmal handelt, heißt
`activatedOnTurn < state.turn` genau „ab dem nächsten eigenen Zug". Ein abgeleiteter
Wert, den man speichert, ist ein Wert, den man nachzuziehen vergißt — und der Fehler
sähe aus wie ein Ritter, der zweimal im selben Zug handelt.

**Je Ritterstufe ein eigener Vorrat** (`knight1` bis `knight3`), und Aufwerten verschiebt
zwischen ihnen. Das ist keine Buchhaltung um ihrer selbst willen: in der Schachtel liegen
je Person zwei Figuren jeder Stufe, und „wer schon zwei Starke stehen hat, kann nicht
aufwerten" ist eine Regel, die man ohne getrennte Vorräte nicht prüfen kann.

**`moveKnight` deckt das Vertreiben mit ab.** Ist das Ziel frei, ist es ein Versetzen;
steht dort ein schwächerer fremder Ritter, ist es ein Vertreiben. Zwei Zugarten für
denselben Zug — ein Ritter zieht auf eine Kreuzung — wären zwei Regelauslegungen darüber,
wohin er ziehen darf, und die erste Abweichung fände niemand.

**`pieceStock` und `piecesLeft` füllen auf, was fehlt.** Beide sind `z.partialRecord` mit
auffüllendem `.transform`. Der Grund ist derselbe wie bei `cardAmounts` in 10a und hätte
denselben Preis gehabt: seit Etappe 6 liegt der Startzustand jeder Partie als JSON in der
Datenbank, dort stehen drei Bauteile, und seit dieser Etappe gibt es sieben. Ein neuer
Pflichtschlüssel hätte beim nächsten Serverstart jede laufende Partie am Schema scheitern
lassen.

**`improvements` ist das einzige Stück 10c, das schon dasteht.** An der Festung (Politik,
Stufe 3) hängt die dritte Ritterstufe. Ohne das Feld müßte 10b sie fest verneinen und 10c
eine Verneinung wieder aufmachen — ein Zustand, in dem eine Regel zwischendurch lügt.

**`handLimitOf` steht an einem Ort und rechnet für beide Seiten.** Es nimmt eine Quelle
(`buildings` plus zwei Regelwerte) statt eines `GameState`, und damit rechnet der Browser
mit derselben Funktion wie der Server. Mauern stehen offen am Brett; zwei Rechnungen für
dieselbe Zahl liefen auseinander, und die Stelle, an der es auffiele, wäre ein Abwurf.

**Die Datei mit dem Limit darf nicht zurückgreifen.** `robber.ts` zieht sein Limit aus
`cities/walls.ts`, also zieht `walls.ts` nichts aus `robber.ts` — und bezahlt deshalb von
Hand statt über `payFor` aus `build.ts`. Ein Ladezirkel wäre der Preis für drei
gesparte Zeilen.

**Im Client bekommen die Ritterzüge eigene Zielkarten.** Auf einer freien Kreuzung am
eigenen Straßennetz sind eine Siedlung **und** ein Ritter zugleich möglich. Die
`claim`-Sperre in `targetsFrom` gegen doppelte Belegung ist richtig und soll bleiben —
zwei Bauwerke auf einem Knoten wären ein Widerspruch in den Regeln. Zwei verschiedene
Zugarten am selben Ort sind keiner, sie brauchen nur zwei Karten.

**Die Stärke eines Ritters steht in Fahnenspitzen und nicht in seiner Größe.** So
unterscheidet das Spiel selbst, und es ist derselbe Grund, aus dem die Stadt kein
größerer Punkt ist: Größe liest man nur im Vergleich, Spitzen kann man zählen. Aktiv und
passiv unterscheidet ein Helm und keine Deckkraft — ein halbdurchsichtiger Ritter läse
sich als „gesperrt", nicht als „ruht", und ein ruhender Ritter ist nicht gesperrt, ihm
fehlt nur sein Getreide.

**Die Mauer liegt vor der Stadt und nicht darunter.** Im Spiel ist sie ein Sockel, aber
die Stadtsilhouette endet bei y 7 und darunter liegt genau eine Einheit — ein Sockel wäre
ein Strich gewesen. Vor der Stadt gezeichnet nimmt das Zinnenband ihr das untere Drittel
und läßt Dach und Giebel stehen, und genau so sieht eine ummauerte Stadt aus.

**Die Ritterleiste fragt „was tun", das Brett antwortet „wo".** Dasselbe
Zwei-Schritt-Muster wie beim Bauen, und aus demselben Grund: eine Figur ist auf dem Brett
rund zwanzig Pixel groß, vier Knöpfe daran wären vier Trefferflächen unter Fingergröße,
und drei davon wären fast immer gesperrt. An einem Basistisch erscheint die Leiste **gar
nicht** — nicht grau, sondern weg, weil vier Knöpfe, die nie angehen, „gerade nicht" über
etwas sagen, das dort nie geht.

**Die Barbarenleiste stellt jetzt zwei Zahlen gegeneinander.** Das ist die Gewichtung,
die 10a bewußt vertagt hat: sie entsteht erst mit dem Vergleich, und vorher gab es nur
eine Zahl. Gleichstand zählt als „hält", weil die Regel so entscheidet. Die Farbe trägt
dabei nicht allein (Designregel 7) — unter der Ritterzahl steht das Wort, das dasselbe
sagt.

**Zwei kurze Tabellen statt einer Grammatik.** `KNIGHT_LABELS` nennt die drei Stufen im
Nominativ, `KNIGHT_LABELS_DATIVE` dieselben drei im Dativ („wertet ihn zum **Starken**
Ritter auf"). Die zweite aus der ersten abzuleiten wäre eine Endungsregel für starke
Adjektive — richtig für genau diese drei Wörter und falsch beim vierten.

### Bewußte Abweichungen von Spec und Regelwerk

Diese drei stehen wörtlich so schon im Kopf des Plans und gehören hierher, damit sie beim
nächsten Lesen eine Entscheidung sind und kein Fehler.

1. **`defenderPending` kommt nicht in 10b, sondern in 10d.** Bei Gleichstand nach einem
   gewonnenen Barbarenkampf zieht laut Regel jeder Beteiligte eine Fortschrittskarte
   seiner Wahl. In 10b gibt es keine Fortschrittsstapel. Eine Phase, die auf eine Wahl
   zwischen drei Stapeln wartet, die es nicht gibt, hielte den Tisch für nichts an. Bei
   Gleichstand passiert deshalb in 10b **nichts** — kein Chip, keine Karte.
2. **Welche Stadt die Barbaren nehmen, entscheidet das Spiel und nicht der Spieler.** Die
   Regel läßt die Wahl. Eine Wahl wäre eine Phase, und diese Phase läge **mitten im
   Würfelwurf**: der Überfall wird vor den Erträgen abgehandelt, also müßte die
   angehaltene Ertragsphase samt Wurfsumme in der Phase mitgeführt und danach fortgesetzt
   werden. Das ist der Umbau des Wurfs für einen Fall, der je Partie höchstens zweimal
   eintritt. Genommen wird deshalb nach einer festen Regel, die dieselbe Wahl trifft, die
   ein Mensch träfe: **zuerst eine Stadt ohne Mauer**, darunter die mit dem **geringsten
   Ertragswert** (Summe der Augenwahrscheinlichkeit der angrenzenden Zahlenchips), bei
   Gleichstand die mit der kleineren Knoten-Id. Ein `cityLossPending` bleibt als offener
   Punkt vermerkt.
3. **Die Variante „mehr Taktik"** (jeder entscheidet, wie viele Ritter er einsetzt) ist
   wie in der Spec nicht vorgesehen. Alle aktivierten Ritter kämpfen, alle werden danach
   deaktiviert.

### Der Durchgang im Browser — elf Befunde, alle gemessen

Der Durchgang, der in der ersten Sitzung ausgefallen war, ist nachgeholt: Chrome
verbunden, lokale Städte-&-Ritter-Partie über den ausgelieferten Build. Er hat elf
Befunde geliefert, von denen **kein einziger** durch einen Test gefallen wäre.

Vorweg eine Meßnotiz, die zweimal Zeit gekostet hat: die Screenshots der Erweiterung sind
1568 px breit, das Fenster war 1920 px — Klicks nach Bildkoordinaten landen 24 % daneben.
Gearbeitet wird deshalb über Element-Referenzen und gemessene Rechtecke, nicht über
abgelesene Pixel. Der erste Fehlklick sah wie ein Produktfehler aus („die Regelwerkswahl
greift nicht") und war keiner.

**1. Unter der Regelwerkswahl stand „Basisspiel", auch bei Städte & Ritter.** Die Zeile
zeigt den Namen des **Brett-Bauplans**, und der hieß `'Basisspiel (3-4 Spieler)'` — ein
Wort mit zwei Bedeutungen, drei Zeilen unter dem Schalter, an dem man gerade die andere
gewählt hat. Behoben an der Ursache: die Baupläne benennen jetzt das Brett
(`Standardbrett (3-4 Spieler)`, `Großes Brett (5-6 Spieler)`), und „Basisspiel" heißt im
ganzen Produkt genau eine Sache.

**2. Die zweite Gründungssetzung sagte „Siedlung" und setzte eine Stadt.** An zwei
Stellen: der Bauknopf hieß „Siedlung" (weil die Aktion `placeSetupSettlement` heißt), und
der Verlauf meldete „setzt die Gründungssiedlung". Eine Ursache: niemand fragte, **was**
diese Setzung an diesem Tisch ist. `setupBuildingKind` wußte es längst — sie nimmt jetzt
eine Quelle statt eines `GameState`, damit der Browser dieselbe Funktion fragen kann
(dieselbe Bauform wie `handLimitOf`). Nachgemessen: Runde 1 dreimal `build-settlement`,
Runde 2 dreimal `build-city`, Hinweis „Gründung: Knoten für die Stadt wählen".

Mitgefallen ist der Straßensatz eine Ebene tiefer: „an der eben gesetzten Siedlung" stand
auch dort, wo eine Stadt steht.

**3. „Spieler 1 und Spieler 2 und Spieler 3 verliert eine Stadt".** Zweimal falsch in
einem Satz — die Aufzählung und das Verb. Dieselbe `join(' und ')`-Zeile stand ein
zweites Mal in `view.ts` („A und B und C muss abwerfen"). Beide gehen jetzt über
`nameList` in `shared/game/labels.ts`, und das Verb folgt der Anzahl.

**4. Der Ritter ist nicht kleiner als eine Siedlung.** Der Kommentar am `scale`-Faktor
behauptete es und begründete es mit der fehlenden Abstandsregel. Gemessen: Ritter
31,0 × 31,8 px, Siedlung 30,5 × 35,6 px — gleich breit. Der kleinere Faktor wird davon
aufgewogen, daß die Figur samt Fahne im Pfadraum breiter ist als ein Haus. Auch der Grund
trägt nicht: eine Bretteinheit sind gemessen 94,2 px, zwischen zwei Rittern auf
benachbarten Kreuzungen bleiben 63 px. **Die Zahl bleibt, der Satz daneben ist
korrigiert** — hier stand eine Behauptung, die niemand nachgerechnet hatte.

**5. Zwei Sprachen für „gesperrt", zehn Pixel auseinander.** Der gesperrte Bauknopf trug
`cursor: not-allowed`, der gesperrte Ritterknopf `cursor: default`. Jetzt beide
`not-allowed`. Die Deckkraft bleibt unterschiedlich (Bauteil 1, Rittermodus 0,42) und das
mit Grund: das Bauteil ist Spielmaterial und sagt seine Sperre über die graue Zahl und
den fehlenden Schatten, der Modus ist ein Knopf.

**6. Die Ritterknöpfe waren 32,2 px groß.** Diese Leiste gibt es, weil vier Knöpfe an
einer Ritterfigur von zwanzig Pixeln vier Trefferflächen **unter Fingergröße** wären —
und dann standen dort selbst 32,2 px, wo 44 nötig sind. Die Begründung der Leiste
widersprach ihrer Ausführung. Nachgemessen: 44,0 × 44,0 px.

**7. „Aufwerten: kein Ritter kann gerade steigen" nannte den falschen Grund.** Im Browser
stand der Satz vor einem Ritter, der sehr wohl steigen konnte — es fehlten Wolle und Erz.
Ein gesperrter Knopf, der den falschen Grund nennt, ist schlimmer als einer, der keinen
nennt: er schickt auf die falsche Suche. Der Nachbarknopf machte es längst richtig
(„kein Ritter ohne Helm, **oder das Getreide fehlt**"). Nachgemessen: „Aufwerten: kein
Ritter kann steigen, oder Wolle und Erz fehlen".

**8. Die Fahnenspitzen verschmolzen — und das trifft die tragende Entscheidung der
Etappe.** Die Stärke steht in Spitzen und nicht in der Größe, weil man Spitzen **zählen**
kann. Gemessen standen sie 1,7 px auseinander und trugen eine Kontur von 2,4 px: zwei
benachbarte Spitzen berührten sich mit ihren Rändern, drei wären ein Balken gewesen. Die
Zusage war nicht eingelöst.

Behoben an beiden Ursachen: die Teilung im Pfad wächst (Höhe 2,6 → 2,0, Teilung
3,4 → 3,6), und die Spitzen bekommen eine eigene, dünnere Kontur (1,15 → 0,55). An einem
echten Ritter der Stufe 2 nachgemessen: Lücke **2,21 px** gegen eine Kontur von 0,76 px —
die Ränder berühren sich nicht mehr. Auf die Vollbild-Einheit umgerechnet sind das
3,4 px Lücke statt 1,7.

**9. Unter 26 rem lief die Bedienung aus dem Fenster.** Bei 396 px Fensterbreite gemessen:
die Bauleiste war 340,7 px breit, begann bei x 205 und endete bei **546** — 150 px hinter
dem Rand. Die Ritterleiste darunter lag mit 400–546 **vollständig** außerhalb. Einen
Rollbalken gab es nicht (`.game` hat `overflow: hidden`), abgeschnitten war es trotzdem.

Mit drei Bauteilen fiel das nicht auf; seit dieser Etappe sind es fünf, und die
Ritterleiste ist ganz neu. Die Ursache sind zwei Zeilen: `.build` hatte `flex-wrap:
nowrap`, und `.tray__controls` durfte als Flex-Item nicht unter seine Inhaltsbreite
schrumpfen (`min-width` steht dort auf `auto`). Beides gehört zusammen — `flex-wrap`
allein bricht nichts. Nachgemessen bei 400 px: Bauleiste rechts **393,6**, Ritterleiste
rechts 393,6, beides im Fenster, kein Rollbalken.

**Damit ist der Punkt zu, der seit Etappe 8 als „die zwei Viewport-Breakpoints sind
ungesehen" dastand.** Bei 636 px paßt ohnehin alles (Bauleiste 340,7 px, rechtsbündig).

**10. Der Stand in der Barbarenleiste verfehlte den Kontrast.** Gegen die Tiefsee
gemessen: `--ok` 3,67:1, `--bad` 3,09:1 — und der Stand steht in 9,28 px, also kleinem
Text, der 4,5:1 braucht. Der Kommentar im Blatt behauptete, die drei Farben seien „für
die dunkle Fläche gemischt"; als **Fläche** stimmt das (`.seat__gain` trägt helle Schrift
darauf und verlöre sie, wenn man sie aufhellt), als **Schrift** nicht. Deshalb ein drittes
Tripel neben dem für Pergament: `--ok-on-sea` (#4fa86d) und `--bad-on-sea` (#e0705e),
nachgemessen 4,96:1 und 4,61:1.

**11. Der Mauersockel ist gemessen und in Ordnung.** Kein Befund, aber Punkt 3 der Liste:
die Mauer ist 29,9 × 9,6 px an einer Stadt von 26,9 × 22,4 px, deckt **36 %** der
Stadthöhe und ragt beidseitig 1,5 px hinaus. Dach und Giebel bleiben stehen, die Zinnen
sind als Zacken erkennbar — genau das, was der Kopfkommentar von `WALL_PATH` verspricht.

### Was der Durchgang bestätigt hat

Die Räubersperre greift: nach einer Sieben ging es ohne `robberPending` weiter, im
Verlauf steht „Spieler 2 würfelt 7" und direkt danach der Abwurf. Nach dem ersten
Überfall ist der Räuber frei („Spieler 2 versetzt den Räuber"). Der Überfall selbst läuft
und wird erzählt. Die Gründung setzt Siedlung **und** Stadt (3 + 3 auf dem Brett). Der
Handelsdialog trägt acht Sorten in zwei Reihen, die Handelswaren mit geländefarbenem Rand
— die 10a-Korrektur hält. Der Bauleistenmodus geht mit dem zweiten Druck wieder aus, und
ohne Modus leuchtet nichts. Ein Basistisch zeigt weiterhin genau drei Bauteile und **keine**
Ritterleiste. Das Handkartenlimit stimmt: 12 Karten ohne Mauer, 6 abzuwerfen.

### Ein Fund außerhalb dieser Etappe

Der Abwurfdialog sperrt sein **Minus**, wenn der gewählte Wert über dem eigenen Vorrat
liegt: `canStep` prüft `next > held` in beide Richtungen. Wer je in diesen Zustand käme,
säße fest — der Dialog stand auf „Abwerfen (40/4)", und jeder einzelne Knopf war grau.

**Erreicht hat ihn ein Treiber, der vierzig Klicks in einen Frame legte**, und das kann
ein Mensch nicht: die Prüfung liest `chosen` aus dem Render-Scope, also sahen alle vierzig
Klicks denselben Anfangszustand. Über die Bedienung ist der Zustand nicht erreichbar, und
deshalb bleibt der Code, wie er ist — die Etappe wächst nicht um einen Umbau ohne
beobachtbaren Nutzen. Drei Tests in `dialogs.test.tsx` halten fest, daß der Rückweg offen
bleibt, auch wenn die geforderte Zahl erreicht ist.

### Abweichungen vom Plan

**Aufgabe 2 war beim Aufsetzen dieser Etappe implementiert, aber ohne ihre Tests.**
`state.test.ts` gab es nicht; die Prüfungen aus Schritt 1 der Aufgabe sind nachgeholt
worden und liefen sofort grün, weil sie bestehenden Code prüfen. Kein roter Lauf also,
und das ist ein Mangel dieser sechs Tests — was sie festhalten, haben sie nicht selbst
erzwungen.

**Aufgabe 11 (Verlaufssätze) ist mit Aufgabe 10 zusammengefallen, soweit der Compiler es
verlangte.** `describeAction` schaltet erschöpfend über alle Zugarten; die sieben neuen
Zweige mußten im selben Commit stehen wie die Zugarten selbst, sonst hätte der Baum nicht
übersetzt. `describeAttack`, `playerView` und die Etiketten sind in ihrem eigenen Commit
geblieben.

**`legal.ts` hat in Aufgabe 6 einen leeren `displacePending`-Zweig bekommen** und in
Aufgabe 10 seinen richtigen. Der leere trug seinen Grund als Kommentar: die Zugart, die
er hätte aufzählen sollen, gab es zu diesem Zeitpunkt nicht, und eine Aufzählung von
Zügen, die niemand schicken kann, wäre eine Auskunft ins Leere gewesen.

**Die Testfixture `testGame` leitet Vorrat und Bank jetzt aus dem Regelwerk ab**, das ihr
mitgegeben wird. Vorher standen dort fest die Werte des Basisspiels, und damit saß an
jedem Städte-&-Ritter-Tisch niemand vor Ritterfiguren: jeder Ritterbau schlug mit
`NO_PIECES_LEFT` fehl, ohne daß der Test danach gefragt hätte. Aufgefallen ist es an elf
Testfehlern in Aufgabe 4, die alle dasselbe sagten.

### Offene Punkte

- **Ein Mächtiger Ritter ist in 10b nicht zu sehen.** Stufe 3 verlangt die Festung
  (Politik 3), und die gibt es erst in 10c. Gemessen sind deshalb eine und zwei
  Fahnenspitzen; daß auch die dritte einzeln steht, folgt aus derselben Teilung im Pfad,
  ist aber nicht am Bild geprüft.
- **Die Ritterleiste ist an einem schmalen Fenster zwei Reihen hoch** (gemessen 93,6 px
  bei 400 px Fensterbreite), die Bauleiste drei (217,7 px). Zusammen liegen sie über dem
  Brett, wie es die Ecken-Ablage seit Etappe 8 vorsieht. Ob das auf einem Handy im
  Querformat noch trägt, ist eine Frage an den nächsten Playtest und nicht an eine
  Messung.
- **Ein `cityLossPending` fehlt** — siehe Abweichung 2. Wer die Wahl haben will, braucht
  einen Wurf, der sich anhalten und fortsetzen läßt.
- **Ritter- und Ausweichzüge sind unbefristet.** `deadlineOf` kennt sie nicht; wer in
  `displacePending` weggeht, hält den Tisch an, bis jemand den Raum verläßt. Dieselbe
  Lücke, die der Handel in Etappe 8 mit einer Frist geschlossen hat — und dieselbe Stelle
  wäre die Antwort.
- **Die Variante „mehr Taktik" fehlt** — siehe Abweichung 3.
- **Die drei Stadttore des Ereigniswürfels werden weiterhin gelesen und tun nichts.** Die
  Fortschrittskarten kommen in 10d.
- Die zwei Viewport-Breakpoints sind **nicht** mehr offen: sie sind in diesem Durchgang
  gemessen worden (Befund 9), und der Fehler, den sie verdeckt haben, ist behoben.
- Die offenen Punkte aus Etappe 9 (Volume, HTTPS, Sicherung, Drossel im Wartebereich)
  gelten unverändert weiter.

### Nächste Etappe

**10c — Stadtausbau und Metropolen.** Die drei Bereiche (Handel, Politik,
Wissenschaft), die fünf Stufen je Bereich, die Metropolen und was sie schützen. Das Feld
`improvements` steht dafür schon im Zustand.

---

## Etappe 10c — Stadtausbau und Metropolen (2026-08-27, `etappe-10-staedte-und-ritter`)

Einundzwanzig Commits von `452e7a9` (drei Bereiche, fünfzehn Stufen) bis `620a0f7`
(Prettier über den Abschnitt), dazu der Plan-Commit `fa03be0` davor. Plan:
`docs/superpowers/plans/2026-08-26-etappe-10c-stadtausbau-und-metropolen.md`, Entwurf für
alle fünf Teiletappen: `docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md`.

Was jetzt geht: der Stadtausbau aus Städte & Ritter. Drei Bereiche (Handel, Politik,
Wissenschaft) zu je fünf Stufen, bezahlt mit der zugehörigen Handelsware. Die Metropole als
Aufsatz auf einer Stadt — drei Stück, je Bereich eine, mit zwei zusätzlichen Siegpunkten und
der Bedingung der freien Stadt bei Gleichstand. Das Fortschritt-Tableau in der Ecke zeigt
alle fünfzehn Stufen samt der Schwelle, nach der beim Würfeln gesucht wird. Jeder Sitz trägt
eine kompakte Leiste mit drei Punktreihen. Das Aquädukt (Wissenschaft 3) und die Gilde
(Handel 3) tun etwas; die Festung (Politik 3) ist an den Mächtigen Ritter aus 10b
angeschlossen.

### Abnahme

| Prüfung             | Ergebnis                                                     |
| ------------------- | ------------------------------------------------------------ |
| `pnpm typecheck`    | grün                                                         |
| `pnpm test`         | grün — shared 966 / 50, server 211 / 22, client 510 / 47     |
| `pnpm build`        | grün, Client-Bundle 480,95 kB (141,59 kB gzip), CSS 59,21 kB |
| `pnpm format:check` | grün                                                         |

Gelaufen am 27.08.2026 auf `5074032`, abgeschrieben in `task-12-abnahme.md`. Der Commit
danach (`e5ec8a4`) ist eine reine Umlaut-Korrektur in Kommentaren und Testnamen und ändert
an diesen Zahlen nichts; zur Sicherheit erneut `pnpm --filter @conquerist/client test`
gelaufen, weiterhin 510 grün.

Vier weitere Commits folgen `e5ec8a4`, keiner davon ändert diese Zahlen: `500d63e` hält eine
Entscheidung fest, `48d6d01` behebt den unter „Offene Punkte" beschriebenen flackernden
`StartScreen`-Test (eigene, dort abgeschriebene Vorher/Nachher-Zahlen), `b8f7087` trägt
einen Abnahme-Nachtrag nach und `620a0f7` ist reines Prettier. Die Abschlussreview über alle
21 Commits bis `620a0f7` hat eigene Befunde gebracht (vier Important, vier Minor,
`abschluss-befunde.md`), behoben in `abschluss-report.md` — 1687 Tests vorher, alle grün,
auf `620a0f7` bestätigt.

Vorher (10b): 894 / 211 / 485. Neu also 72 Tests in `shared`, keiner im Server, 25 im
Client. Gewachsen ist vor allem `packages/shared` (die fünfzehn Stufen, der Ausbauzug, die
Metropole am Gebäude) und `apps/client` (Tableau und kompakte Leiste sind neu).

### Getroffene Entscheidungen

**Die Metropole hängt am Gebäude, nicht am Spieler.** `Building.metropolis: TrackId | null`
statt eines Feldes am Spieler — Grund: Städte und Mauern stehen seit jeher am Brett und
werden von dort gelesen (`cityToLose` beim Barbarenüberfall, `scoring.ts` bei den
Siegpunkten, `BoardSvg.tsx` beim Zeichnen). Ein zweiter Ort, an dem festgehalten wird, wer
welche Metropole hält, wäre eine zweite Wahrheit über dieselbe Frage — genau die Falle, gegen
die sich Etappe 10b bei den Rittern schon einmal entschieden hat (Ritter stehen im
`GameState`, nicht beim Spieler).

**Die Stufennamen und -artikel liegen in `shared`, nicht im Client.** `TRACK_STEPS` mit Name
und Artikel für alle fünfzehn Stufen steht in `cities/tracks.ts`. Grund: `stepName` und
`stepWithArticle` werden von den Verlaufssätzen (`log.ts`, in `shared`) und vom
Fortschritt-Tableau (Client) gleichermaßen gebraucht. Zwei Tabellen an zwei Orten liefen bei
der ersten neuen Stufe auseinander; eine Tabelle mit zwei Lesern nicht.

**Der Zusatznutzen ist eine Frage an die Stufe, kein eigenes Feld am Zustand.**
`hasAqueduct`, `hasGuild` und `hasFortress` lesen `levelOf(source, track) >= AQUEDUCT_LEVEL`
(bzw. `GUILD_LEVEL`, `FORTRESS_LEVEL`) aus `improvements` — es gibt kein separates Flag „hat
Aquädukt" im Zustand. Grund: der Zusatznutzen ist vollständig aus der erreichten Stufe
ableitbar; ein eigenes Feld wäre eine zweite Buchführung über dieselbe Zahl, die bei jeder
Änderung der Stufe mitgezogen werden müsste, ohne dass sie je etwas anderes sagen könnte.

**Drei Konstanten mit dem Wert 3, keine geteilte.** `AQUEDUCT_LEVEL`, `GUILD_LEVEL` und
`FORTRESS_LEVEL` tragen alle den Wert 3, sind aber drei getrennte Bezeichner statt eines
gemeinsamen `LEVEL_3`. Grund: es sind drei verschiedene Regeln (Wissenschaft, Handel,
Politik), die zufällig bei derselben Stufe greifen. Eine geteilte Konstante würde eine
Kopplung behaupten, die es inhaltlich nicht gibt, und bräche beim ersten Regelwerk, das sie
auseinanderzieht.

**`improveCity` trägt die Metropole gleich mit, statt eine zweite Phase zu öffnen.** Die
Zugart hat ein optionales Feld `metropolisAt`; wer mit diesem Ausbau die Bereichsmetropole
einbringt, nennt im selben Zug, an welcher eigenen freien Stadt sie steht. Grund: eine
zweite Phase — erst ausbauen, dann separat die Metropole setzen — hätte den Tisch zwischen
zwei Zügen offengehalten, für einen Fall, den `legalActions` mit einem eigenen Zug je
möglicher Stadt in einem Klick erledigt.

**Der Client bekommt zwei Zielkarten für den Ausbau: `improve` und `metropolis`.** Genau wie
bei den Rittern in 10b, wo Versetzen und Vertreiben getrennte Karten bekamen, obwohl beides
über `moveKnight` läuft. Grund: `improveCity` ohne `metropolisAt` ist ein einziger Klick auf
eine Stufe, mit `metropolisAt` ein zweistufiger (erst der Bereich, dann die Stadt). Eine
gemeinsame Karte hätte entweder den einfachen Fall verkompliziert oder den doppelten
verschluckt.

**`HarborSource.players` wächst um die Spielerliste, weil die Gilde beim Spieler steht.**
Der Hafenhandel braucht jetzt von jedem Spieler `id` und `improvements`, nicht mehr nur die
eigenen Daten des Handelnden. Grund: der Gildenkurs (`hasGuild`) muss aus Sicht jedes am
Handel beteiligten Spielers geprüft werden können, und `GameScreen.tsx` reicht dafür eine
`PlayerView` statt eines vollen `PlayerState` herein. Der neue Typ ist deshalb der
strukturelle Mindesttyp `Pick<PlayerState, 'id'> & TrackLevelSource` (letzteres
`Pick<PlayerState, 'improvements'>`), den sowohl `GameState.players` als auch
`PlayerView.players` erfüllen, ohne dass eine Seite mehr verspricht, als sie hat.

### Bewußte Abweichungen von Spec und Regelwerk

1. **Die freie Stadt ist nur nötig, wenn der Aufsatz auch wirklich kommt.** Die Anleitung
   sagt, wer nur eine Stadt hat und die schon Metropole ist, komme in den anderen Bereichen
   nur bis Stufe 3. Sie sagt nicht, ob das auch gilt, wenn die Metropole des Bereichs längst
   einer anderen Person gehört und Stufe 4 also gar keinen Aufsatz einbringt. Wir legen es so
   aus: die freie Stadt ist Bedingung genau dann, wenn dieser Ausbau die Metropole
   **einbringt**. Alles andere bestrafte jemanden für einen Wettlauf, den er ohnehin schon
   verloren hat.
2. **Die Fortschrittskarten kommen nicht in 10c.** `progressThreshold` steht hier trotzdem,
   weil das Tableau die rote Ziffer je Stufe **anzeigt** — das ist die Zahl, nach der man
   beim Würfeln sucht, und ohne sie wäre die Leiter eine Treppe ohne Ziel. Gezogen wird erst
   in 10d; die drei Stadttore des Ereigniswürfels bleiben bis dahin wirkungslos.
3. **Die Rohstoffwahl beim Aquädukt folgt einer festen Regel, nicht der freien Wahl des
   Spielers.** Das Regelwerk lässt offen, wer beim Aquädukt-Bonus wählt; eine echte Wahl wäre
   eine Phase, die den laufenden Würfelwurf anhalten und später fortsetzen müsste — dieselbe
   Art Umbau, die 10b beim `cityLossPending` schon einmal aus genau diesem Grund vertagt hat.
   Vergeben wird deshalb, wovon die Bank am meisten hat, bei Gleichstand nach der
   `RESOURCE_IDS`-Reihenfolge. Bei zwei Anspruchsberechtigten im selben Wurf zieht
   `grantAqueduct` eine lokale `remainingBank` mit, die nach jeder Vergabe sinkt, damit nicht
   beide dieselbe letzte Karte bekommen. `aqueductPending` bleibt der Ort für eine spätere
   echte Wahl.

### Der Durchgang im Browser — vier Befunde, alle behoben und nachgemessen

Chrome verbunden, lokale Städte-&-Ritter-Partie über den ausgelieferten Build, Seed
`3d1p6y5j`, Viewport 1920 × 945 px, Wurzelschrift 16 px, `DATABASE_FILE=":memory:"`.
Kontrastwerte nach WCAG-2.1-Leuchtdichte, Vordergrund über den tatsächlich zusammengesetzten
Hintergrund gelegt. Alle vier Befunde sind an ihrer Ursache behoben und im laufenden Blatt
nach einem frischen Build nachgemessen worden (nicht nur nachgerechnet).

**A. Die Schwellenziffer der nächsten Stufe sprang.** Vorher 6,72 × 9,59 px gegen 8,06 ×
11,52 px bei den vier übrigen Ziffern — 83 % der Größe, Mitte 4,28 px weiter rechts, in
allen drei Leitern gleich. Ursache: `.tracks__step--next` ist ein `<button>` und erbte die
Schriftgröße des Nutzeragenten (13,3333 px) statt der 16 px, die die `<div>`-Stufen vom
Blatt bekommen — die Ziffer selbst ist ein SVG-Pfad, der sich in `em` bemisst. Kur:
`font: inherit` auf `.tracks__step--next`. Nachher: alle fünfzehn Ziffern messen dieselben
8,06 × 11,52 px. Der verbleibende 3,61-px-Versatz und warum er kein Mangel ist, steht unter
Offene Punkte.

**B. Die kompakte Leiste fiel unter den Kontrast, zum zweiten Mal seit 10b.** Sieben von
neun Werten rissen 4,5:1, `Pol` am aktiven Sitz stand bei 1,25:1 und war mit bloßem Auge
nicht mehr zu finden. Ursache: die drei `--track-*` sind für Pergament gemischt, die
kompakte Leiste stellte sie auf die Tiefsee. Kur: ein drittes Tripel neben `--ok-on-sea`/
`--bad-on-sea` aus 10b — `--track-trade-on-sea`, `--track-politics-on-sea`,
`--track-science-on-sea`. Nachher: aktiver Sitz 4,91:1 / 4,86:1 / 4,81:1, übrige Sitze
8,33:1 / 8,24:1 / 8,16:1 — alle neun Werte über der Schwelle, `POL` und `WIS` am
vergrößerten Bild jetzt lesbar, wo vorher nichts zu erkennen war.

**C. Dasselbe Problem im Tableau-Kopf.** `.tracks__name` stand ebenfalls auf der Tiefsee,
4,77:1 / 2,11:1 / 2,28:1. Dieselbe Kur wie B, an einer zweiten Fundstelle, damit nicht eine
von beiden beim nächsten Durchgang wieder auffällt. Nachher: 8,33:1 / 8,24:1 / 8,16:1.

**D. Das Wort auf Stufe 3 war unsichtbar, solange die Stufe nicht gebaut ist.** Vorher
1,05:1 (helle Schrift auf hellem Pergament) im ungebauten Fall; im gebauten Fall zusätzlich
Handel bei 2,34:1 (helle Schrift auf Gold). Ursache: eine einzige Farbregel, die nur den
gebauten Fall traf und pauschal für alle drei Bereiche galt. Kur: die ungebaute Stufe
bekommt dunkle Tinte (`--ink`), die gebaute liest je Bereich die Farbe, die auf ihrem
eigenen Grund trägt (`TRACK_BUILT_WORD_COLORS`). Nachher: ungebaut 13,31:1, gebaut Handel
5,40:1, Politik und Wissenschaft unverändert gut (5,29:1 / 4,91:1). Am vergrößerten Bild
bestätigt: Gilde, Festung und Aquädukt stehen lesbar auf ihren Sprossen.

**Kein Befund, nachgemessen und in Ordnung:** das Tableau passt in die Ecke (151,19 ×
174 px, 12 px Luft zum Rand), drei Leitern zu je fünf Stufen, die nächste Stufe ist ein
Knopf mit 44,0 × 44,0 px Trefferfläche, gesperrt unterscheidet sich an drei Merkmalen
(Deckkraft, Schatten, Zeiger), und Designregel 7 ist erfüllt — jede Bereichsfarbe steht
neben einem Wort.

**Was der Durchgang nicht erreicht hat, steht unter Offene Punkte** (die Punkte 6, 7, 8 und
10 der Prüfliste, sowie Punkt 9, die Viewport-Breakpoints).

### Abweichungen vom Plan

**Die Dateilisten des Plans waren an mehreren Rufstellen unvollständig.** Aufgabe 4 durfte
`reducer.ts` ändern (das Einhängen des Aquädukts in `rollDice` verlangte es, die Liste
nannte die Datei nicht), Aufgabe 9 `game/labels.ts` (die Bereichsfarben-Tabelle stand im
Fließtext, nicht in der Liste), Aufgabe 6 `log.ts`/`log.test.ts` (`describeAction` ist ein
erschöpfender `switch` ohne `default`; ohne einen `improveCity`-Zweig hätte `tsc` mit
„Function lacks ending return statement" abgebrochen). Dieselbe Klasse Fehler wie schon in
10b bei `cardAmounts`/`pieceStock`: der Compiler zeigt die Lücke, der Umsetzer hatte keine
Wahl.

**`CLASSIC_RULES` bekam ein Feld, das der Plan wörtlich verboten hatte.** Aufgabe 2 sollte
laut Plantext „nichts eintragen", weil der Vorgabewert null sei. Tatsächlich ist
`CLASSIC_RULES: RuleSet` explizit getypt, und `z.infer` macht ein Feld mit `.default(...)`
im Ausgangstyp nicht optional — ohne `metropolis: 0` (genau wie beim Nachbarfeld
`defender: 0`) scheiterte `pnpm typecheck`, das dieselbe Aufgabe als Abnahme verlangt. Der
Plantext lag hier falsch, nicht der Umsetzer.

**Ein Test, der wörtlich aus dem Plan stammte, maß den falschen Fall.** Der Gildentest gegen
einen 3:1-Hafen setzte den Spieler auf `CENTER_VERTEX` — einen Knoten, der an keinem der
beiden Testhäfen liegt. Der Test bewies deshalb dasselbe wie der hafenlose Fall davor, nur
unter einem Namen, der etwas anderes versprach. Der eigene Vorflug-Scan vor der Ausführung
hatte das nicht gefangen, weil er Testcode gegen Signaturen prüft und nicht gegen die
Geometrie des Testbretts — eine Lücke, die für den Rest der Etappe nachgeholt wurde (nur
Aufgabe 5 nennt überhaupt Knoten, dort war die Brettgeometrie in Ordnung). Der Test heißt
jetzt nur noch nach dem, was er tatsächlich zeigt, und zeigt es doppelt (ohne Gilde 3, mit
Gilde 2).

**Der Plan schrieb den falschen Kasus vor.** Zwei Stellen verlangten `stepWithArticle`
(Nominativ) für den Verlaufssatz nach „baut" — grammatikalisch richtig bei „die Gilde" und
„das Theater", falsch bei den zwei maskulinen Stufennamen („baut der Markt" statt „baut den
Markt"). Der Plan hatte den Fehler nicht gesehen, weil alle drei Beispielsätze in Aufgabe 7
feminin oder neutral sind — dort fallen Nominativ und Akkusativ zusammen. Die Kur ist
dieselbe wie bei `KNIGHT_LABELS_DATIVE` aus 10b: eine dritte, kurze und abschließende
Tabelle (`stepInAccusative`, drei Einträge für „der"/„die"/„das"), keine Endungsregel aus
dem Code abgeleitet.

**Ein Reviewer-Befund wurde bewusst nicht in derselben Aufgabe behoben.** Dass kein Test den
Verlust eines vorhandenen Aufsatzes beim Barbarenüberfall abdeckt, stimmt für Aufgabe 2 —
und ist trotzdem richtig so: das Regelwerk (Abschnitt 8.2) sagt, Metropolen seien vor den
Barbaren immer geschützt, und genau das baut Aufgabe 5. Ein Test in Aufgabe 2 hätte das
Gegenteil der Spec festgeschrieben und wäre in Aufgabe 5 sofort wieder umzuschreiben
gewesen.

**Ein zweiter Reviewer-Befund blieb ebenfalls stehen, aus dem umgekehrten Grund.** Der Test
„zählt die Metropole trotzdem zur Stärke" war von Anfang an grün und hätte in der
vorgesehenen Reihenfolge gar nicht rot sein können — trotzdem bleibt er stehen: er sichert
die naheliegendste falsche Umsetzung ab, den Metropolenfilter versehentlich auch in
`barbarianStrength` zu setzen. Ein Test, der eine Nicht-Änderung festhält, ist ein Zaun,
kein Scheintest.

**`PROGRESS.md` entsteht am Stück in Aufgabe 12, nicht aufgabenweise.** Die globale Regel
„wird mitgeschrieben, nicht nachgereicht (Aufgabe 12)" ist mehrdeutig gelesen worden; der
Klammerzusatz nennt die Aufgabe, die den Abschnitt schreibt, und die Absicht ist, dass er
innerhalb dieser Etappe entsteht und nicht in eine spätere verschoben wird — genau wie in
10a und 10b, wo ebenfalls ein Abschnitt je Etappe stand, nicht je Aufgabe.

### Offene Punkte

- **Die Rohstoffwahl beim Aquädukt trifft weiterhin das Spiel, nicht der Spieler** —
  `aqueductPending` wäre der Ort für eine echte Wahl (siehe Abweichung 3 oben).
- **Der Ausbauzug ist weiterhin unbefristet.** `deadlineOf` kennt `improveCity` nicht —
  dieselbe Lücke, die in 10b für Ritter- und Ausweichzüge offen blieb und dort wie hier
  denselben Ort als Antwort hätte.
- **Vier Punkte des Browser-Durchgangs sind ungeprüft geblieben, weil die gespielte Partie
  nicht weit genug kam.** Über 31 Runden (Gründung, Würfeln, Abwerfen, Räuber, Bauen,
  Ausbauen) ist kein Spieler über Wissenschaft Stufe 2 hinausgekommen — Papier fällt nur an
  Waldstädten, und der Nachschub reichte für Stufe 3 (3 Papier) und 4 (4 Papier) nicht.
  Ungeprüft blieben: der Metropolenaufsatz auf dem Brett (erkennt man den Bereich, verdeckt
  er die Stadtform), die Metropolenwahl unter den eigenen freien Städten, die zwei
  Randfälle Stufe 4 ohne freie Stadt / Stufe 5 als sicherer Halter, und das Aquädukt selbst
  (bekommt man wirklich eine Karte, steht es im Verlauf). Sie sind durch Tests gedeckt, aber
  keiner der elf Befunde aus 10b wäre durch einen Test gefunden worden.
- **Die zwei Viewport-Breakpoints sind ebenfalls ungeprüft geblieben — aus einem
  Werkzeuggrund.** `resize_window` ändert die Fensterbreite nicht, solange das
  Chrome-Fenster maximiert ist: nach `resize_window(400, 800)` blieb `outerWidth` bei 1920,
  nur die Höhe folgte (945 → 889). Ein `window.open` mit fester Breite scheitert am
  Popup-Blocker mangels Nutzergeste. Der Weg dahin ist, das Fenster vor dem nächsten
  Durchgang aus der Maximierung zu lösen.
- **Nach der Behebung von Befund A bleibt ein Versatz von 3,61 px, und das ist kein
  Mangel.** Die Mitte der Ziffer der nächsten Stufe sitzt weiterhin etwas rechts von den
  vier darüber (1801,38 gegen 1797,77) — nicht mehr, weil die Schriftgröße abweicht (das ist
  behoben), sondern weil die Trefferfläche der nächsten Stufe 44 px breit ist, die vier
  anderen Sprossen aber nur 2,3 rem = 36,8 px, und die Ziffer am rechten Rand ihrer Sprosse
  sitzt. Wer das beseitigen will, muss entweder alle Sprossen auf 44 px verbreitern (das
  Tableau wüchse von 151 auf rund 175 px) oder die Ziffer aus der Sprosse lösen — beides
  eine Entwurfsfrage für den nächsten Playtest, keine Fehlerbehebung.
- **`StartScreen.test.tsx` lief unter der Last der vollen Suite reproduzierbar in einen
  Timeout — dieselbe Krankheit wie `hotseatClock.test.tsx` gleich darunter.** Der Test
  `zeichnet zu einem anderen Seed ein anderes Brett` tippte über den gemeinsamen Helfer
  `neuTippen` zwei zehnstellige Seeds zeichenweise ein, also rund vierzig vollständige
  Brett-Neuzeichnungen (19 Felder je Tastendruck) für einen Test mit 5 s Budget. Allein
  lief die Datei in 9,5–22 s grün; unter 46 parallel laufenden Dateien (63–97 s
  Gesamtlaufzeit der Suite) fiel er dreimal hintereinander — zweimal bei einem anderen
  Umsetzer, einmal hier. Die Ursache lag **vor** dieser Etappe: der Kommentar am Helfer
  beschrieb bereits eine erste Kur (eine gemeinsame `userEvent`-Sitzung mit `delay: null`
  statt dreier getrennter, dazu ein `waitFor` auf den Feldwert gegen das verzögerte
  Zurücklesen aus dem kontrollierten Zustand), die den Fehler seltener machte, ohne ihn zu
  beheben — sie nahm die Verzögerung zwischen den Tastendrücken weg, nicht deren Zahl, und
  die blieb bei rund vierzig Renderings. Kur: `neuTippen` heißt jetzt `neuBefuellen` und
  ersetzt `user.type` durch `user.clear` + `user.paste` — der Seed steht in einem Schritt
  statt in zehn, und was der Test wirklich prüft (zwei Seeds ergeben zwei Bretter) ändert
  sich nicht. Nachher: Einzellauf 9,54 s (vorher 21,63 s), volle Suite dreimal
  hintereinander grün (510/510 Tests, 47/47 Dateien), davon einer unter vergleichbarer
  Last wie der zuvor gescheiterte Lauf (82,86 s gegen 96,23 s). Details und die
  Vorher/Nachher-Befehle stehen in `task-13-report.md`.
- **`hotseatClock.test.tsx` flackert.** Einmal in einen Timeout gelaufen, im
  Wiederholungslauf grün — ein Zeit-Test, der manchmal rot ist, ist kein Zaun mehr. Noch
  ungeklärt, ob dieselbe Ursache greift (viele Renderings unter Last) oder eine eigene.
- **Die Umlaut-Regel ist in dieser Etappe dreimal hintereinander gerissen** (Aufgaben 9, 10, 11) und jedes Mal in einer eigenen Fixrunde nachgezogen worden, statt sich für Aufgabe 12
  zu sammeln — ein gesammelter Fix träfe sonst auf einen Diff, in dem niemand mehr weiß,
  welcher Kommentar aus welcher Aufgabe stammt. Das Muster hat sich dabei verschärft: erst
  sah es aus, als hielten neue Dateien die Konvention, während geänderte Bestandsdateien in
  die ASCII-Schreibweise ihrer Nachbarschaft zurückfielen (Aufgabe 9, 10); beim dritten Mal
  (Aufgabe 11) saß der Fehler in brandneuen Testdateien und in Testnamen, nicht mehr nur in
  Bestandscode. Eine Rahmenbedingung, die dreimal hintereinander übersehen wird, ist keine
  Frage der Sorgfalt mehr, sondern eine offene Frage an das Werkzeug — ob ein Lint- oder
  Pre-Commit-Schritt näher an der Ursache läge als eine manuelle Fixrunde je Aufgabe.
- **Der dritte strukturgleiche Zwei-Schritt-Block.** `metropolisFor` in `GameScreen.tsx` ist
  nach `buildMode` und `knightMode` das dritte Feld, das erst „was tun" und dann „wo" fragt
  — bei einer vierten Gelegenheit ist eine gemeinsame Abstraktion fällig.
- Die offenen Punkte aus Etappe 9 (Volume, HTTPS, Sicherung, Drossel im Wartebereich) und
  aus Etappe 10b (ein Mächtiger Ritter ungesehen, `cityLossPending` fehlt, Variante „mehr
  Taktik" fehlt, Fortschrittskarten kommen erst in 10d) gelten unverändert weiter.

### Nächste Etappe

**10d — Fortschrittskarten.** Die drei Stadttore des Ereigniswürfels bekommen Wirkung: die
drei Stapel, das Ziehen bei Aquädukt, Metropolenkampf und Sieg, `defenderPending` und
`aqueductPending` als echte Wahl statt einer festen Regel.

---
