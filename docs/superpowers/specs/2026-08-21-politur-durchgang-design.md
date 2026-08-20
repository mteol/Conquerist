# Der Politur-Durchgang — ein Bildschirm ist eine Fläche, keine Rolle

Stand: 2026-08-21, `main` (`a96ccbe`), Chrome 151 gegen `pnpm dev`.

Der Durchgang vom 16.08. hat den Spielbildschirm vermessen und dort aufgeräumt.
Die **Vorspiel-Bildschirme** — Hauptmenü, Partie starten, Wartebereich — standen
damals nicht auf dem Zettel. Sie sind jetzt vermessen, und sie sind der Ort, an
dem die Oberfläche noch nach Formular aussieht statt nach Spiel.

Dazu kommt ein Befund, den der erste Durchgang ausdrücklich offengelassen hat
(„Ungesehen bleiben die zwei Viewport-Breakpoints"): einer von beiden ist kaputt,
und zwar so, daß das Spiel auf einem Telefon nicht spielbar ist.

## Wie gemessen wurde

Client auf `5173`, Server auf `8080`. Fenster maximiert (1920×945), die
Meßbreiten deshalb über ein `iframe` fester Größe auf derselben Origin —
`resize_window` meldet in dieser Erweiterung Erfolg und läßt `innerWidth`
stehen. Im Rahmen bestätigt: `innerWidth/innerHeight` = 1280/720, Media Queries
lösen gegen den Rahmen auf.

Gemessen wurde nicht angesehen, sondern gezählt: `documentElement.scrollHeight`
gegen `innerHeight`, `getBoundingClientRect()` am Brett über elf Fensterbreiten,
`[data-target="true"]` ausgezählt, `getComputedStyle` an den Reglern. Ein
Bildschirm, von dem hier steht „scrollt", scrollt mit einer Zahl dahinter.

Durchlaufen: Hauptmenü → lokal starten → Partie gegründet; Hauptmenü → online →
Raum erstellt → Wartebereich; Einstellungen geöffnet. Nicht durchlaufen: Handel,
Räuber, Abwerfen, Entwicklungskarten — dieselbe Lücke wie beim ersten Durchgang,
sie brauchen eine Partie mit vollen Händen.

## Die Meßlatte

**Ein Bildschirm paßt bei 1280×720 ohne zu scrollen.** Das ist der kleinste
ernstzunehmende Laptop; wer das trägt, trägt alles darüber. Unterhalb davon —
Telefon, schmales Fenster — ist Scrollen die natürliche Geste und kein Fehler.

Diese Zahl ist neu und steht bisher nirgends. Genau daran liegt es, daß der
Wartebereich einen Bildschirm und einen halben hoch geworden ist, ohne daß es
jemandem aufgefallen wäre: es gab keine Grenze, gegen die man ihn hätte prüfen
können.

## Befunde

Sortiert nach Gewicht.

### B1 — Unter 496 px Fensterbreite ist das Brett null Pixel breit

Der schwerste Befund. Gemessene Brettbreite (`svg.board`, Höhe konstant 720):

| Fenster | 1600 | 1280 | 1100 | 992 | 900 | 760 | 640 | 540 | 480 | 420 | 390 |
| ------- | ---: | ---: | ---: | --: | --: | --: | --: | --: | --: | --: | --: |
| Brett   |  759 |  759 |  604 | 496 | 404 | 264 | 144 |  44 |   0 |   0 |   0 |

Die Reihe ist exakt `Fensterbreite − 496`, oben durch die Höhe gedeckelt. Die
Ursache steht in `index.css` an `.game`:

```css
--tray-strip: max(14.75rem, calc((100vw - 1.5rem - 1.09 * (100vh - 1.5rem)) / 2));
```

`14.75rem` sind 236 px, zweimal 236 plus 24 px Polsterung sind die 496. Der
`max()` ist als **Boden** gedacht — „das Brett wird an keiner Fenstergröße
kleiner als vorher", so steht es im Kommentar. Auf einem breiten Fenster stimmt
das auch. Auf einem schmalen ist derselbe Boden ein **Deckel für das Brett**:
die Ecken bekommen ihre 236 px zugesichert, und was übrig bleibt, bekommt das
Brett — bei 480 px bleibt nichts übrig.

Der Kommentar sagt „Beides ist derselbe Wert, und daran hängt, daß sich Brett
und Ablage nie überdecken können." Das ist wahr und war nie das Problem. Das
Problem ist, daß unter der Regel keine Media Query liegt, die sie aufhebt: die
Eckenablage ist auf jeder Breite eine Ecke, auch auf einer, die keine zwei Ecken
mehr hat.

Nachgesehen: bei 390 px steht kein einziges Sechseck auf dem Bildschirm. Die
Bauleiste bricht auf sechs Zeilen, Kaufstapel und Bauteile schneiden am rechten
Rand ab, „Handel" und „Zug beenden" liegen über den Bauteilen.

**Was folgt.** Unterhalb einer Schwelle hört die Eckenablage auf, eine Ecke zu
sein, und wird eine Leiste unter dem Brett. `--tray-strip` bekommt dort den
Boden `0`.

**Die Schwelle ist 62 rem (992 px)**, und sie wird nicht neu erfunden: es ist
der Breakpoint, den `index.css` schon führt. Er paßt auch der Rechnung nach.
Zwei Ecken kosten `2 × 14.75rem = 29.5rem`; was darüber hinausgeht, bekommt das
Brett. Bei 62 rem sind das gemessen 496 px Brett — schmal, aber ein Brett. Bei
der nächsten Stufe darunter (900 px) sind es 404, bei 760 px noch 264, und ab
da ist es kein Brett mehr, sondern ein Rest. Die Grenze liegt also dort, wo
ohnehin schon eine liegt, und zwar an der richtigen Stelle.

### B2 — Der Wartebereich ist anderthalb Bildschirme hoch und zu zwei Dritteln leer

Dokumenthöhe gegen 720 px Viewport:

| Bildschirm              | Höhe | Überhang |
| ----------------------- | ---: | -------: |
| Hauptmenü               |  720 |        0 |
| Partie starten — online |  929 | **+209** |
| Partie starten — lokal  | 1081 | **+361** |
| Wartebereich            | 1326 | **+606** |
| Spielbildschirm         |  720 |        0 |

Der Wartebereich ist eine `min(100%, 34rem)`-Spalte, mittig auf 1280 px. Er
scrollt 606 px — und links und rechts davon stehen je 300 px leere See. Er zahlt
also mit Höhe für Platz, den er nebenan geschenkt bekäme.

Unter der Falte liegen dabei **beide Handlungen des Bildschirms**: „Partie
starten" und „Tisch verlassen". Ein Bildschirm, dessen einzige Aufgabe das
Warten ist, versteckt das Ende des Wartens.

**Und der Seed steht dort ohne sein Brett.** Im StartScreen zeigt „Neu würfeln"
sofort, was es tut — das Brett steht daneben und ändert sich beim Tippen. Im
Wartebereich, wo derselbe Seed noch einmal verstellbar ist, ist die Vorschau
weg. Genau dort ist die Entscheidung teurer: es sitzen schon Leute am Tisch.

**Was folgt.** Zwei Spalten und eine Brettvorschau. Tisch und Code links, die
drei Einstellkästen rechts, das Brett dazwischen — dieselbe `BoardSvg` wie im
StartScreen, nicht ein zweites Bild, das so ähnlich aussieht.

### B3 — Der erste Zug jeder Partie ist versteckt

In der Gründungsphase sagt die Statuszeile „Gründung: Spieler 1 setzt eine
Siedlung". Auf dem Brett stehen zu diesem Zeitpunkt **null** Zielmarken
(`[data-target="true"]`: 0). Das einzige freigegebene Bedienelement des ganzen
Bildschirms ist ein 30 px großes Bauteil unten rechts in der Ecke; erst dessen
Klick bringt 54 Marken hervor.

Das ist das Bauen in zwei Schritten, und für das laufende Spiel ist es richtig:
erst was, dann wo. In der **Gründung** gibt es aber nichts zu wählen. Es gibt
genau eine Sache, die man tun kann, der Bildschirm sagt sie in Worten, und
trotzdem muß man sie erst noch einmal in einer Ecke bestätigen. Der erste
Eindruck des Spiels ist ein Brett, das nicht reagiert.

**Was folgt.** In `setup`-Phasen ist der Schritt „was" bereits beantwortet; die
Knoten werden sofort markiert. Der Zweischritt bleibt, wo er etwas entscheidet.

### B4 — Die Statuszeile steht zweimal, wortgleich in der Sache

B6 aus dem Durchgang vom 16.08., unverändert. Oben rechts steht „Gründung:
Spieler 1 setzt eine Siedlung", oben in der Mitte in der Bauleiste „Siedlung
bauen: Knoten auf dem Brett wählen". Zwei Zeilen, dieselbe Auskunft, 400 px
auseinander.

Dazu neu: **die Bauleiste liegt über der obersten Hex-Reihe.** Sie ist ein
Kasten mit Akzentrahmen, der auf dem Brett schwimmt, und das Brett ist der Held
(Regel 4).

**Was folgt.** Eine Zeile, an einem Ort. Der Abbruch gehört dorthin, wo die
Auskunft steht.

### B5 — Würfel und leere Hand sind graue Kacheln

Vor dem ersten Wurf stehen unten rechts zwei einfarbig graue Rechtecke ohne
Augen, ohne Beschriftung, ohne Rahmen (`aria-label` sagt korrekt „Noch kein
Wurf" — sichtbar sagt es nichts). Unten links stehen für eine leere Hand zwei
schraffierte leere Kacheln.

Beides liest sich als fehlendes Bild, nicht als Zustand. Regel 8 sagt: leere
Flächen laden zu einer Handlung ein, statt sich zu entschuldigen. Diese hier tun
weder das eine noch das andere — sie sehen kaputt aus.

**Was folgt.** Der Becher vor dem Wurf zeigt, daß er ein Becher ist. Die leere
Hand sagt, was sie füllen würde.

### B6 — Drei Regler in Betriebssystem-Form

Die Lautstärkeregler sind `<input type="range">` mit `appearance: auto`
(gemessen). `accent-color` ist gesetzt und ist der See-Ton `rgb(29 84 104)` —
die **Farbe** stimmt also. Die **Form** nicht: runder Griff, runde Bahn, in
einer Oberfläche, in der jeder Knopf, jedes Feld und jeder Dialog aus demselben
45-Grad-Schnitt kommt (`corner-shape: bevel`).

Es ist die einzige Stelle im Spiel, an der das Betriebssystem durchschlägt.

**Was folgt.** Bahn und Griff bekommen denselben Schnitt wie alles andere.
`accent-color` bleibt, wo der native Weg gut genug ist.

### B7 — Kleinkram mit Namen

- **Der lokale Startknopf ist `.button`, der Online-Startknopf `.button--go`.**
  Dieselbe Rolle — „hier fängt die Partie an" — in zwei Gewichten.
- **„Verbindung und Diagnose (Etappe 0)"** steht als Klapptür auf dem
  Endnutzer-Bildschirm. Der Inhalt ist richtig aufgeschoben (er entsteht erst
  beim Öffnen, ein Test hält das fest); die **Tür** gehört trotzdem nicht dahin.
- **Zwei Auswahlbilder in einem Formular.** Die Spieleranzahl sind gezeichnete
  Sechseck-Chips, die Handkarten-Frage zwei Zeilen darunter sind native Radios.
- **Der Titel „Partie starten — lokal" bricht auf drei Zeilen**, rund 180 px —
  die Hälfte des Überhangs dieses Bildschirms steht in seiner Überschrift.
- **Die Tischliste oben links** setzt „0 SP · 0 Karten" in gedämpftem Grau bei
  rund 11 px auf die dunkle See.

## Die Richtung

### 1. Ein Bildschirm ist eine Fläche, keine Rolle

Der Spielbildschirm ist längst eine Fläche: `height: 100vh`, `overflow: hidden`,
ein Raster, alles findet darin seinen Platz. Die Vorspiel-Bildschirme sind
Rollen — sie stapeln Abschnitte, bis sie fertig sind, und was nicht paßt, hängt
unten heraus.

Sie werden Flächen, nach derselben Regel. Was in einer Spalte nicht Platz
findet, geht in die zweite; erst wenn auch das nicht reicht, wird etwas
ausklappbar.

**Ausklappen ist das letzte Mittel, nicht das erste.** Ein zugeklappter
Abschnitt kostet einen Klick und nimmt die Möglichkeit, zwei Dinge zu
vergleichen. Er lohnt sich dort, wo etwas selten gebraucht wird (die Farbwahl,
wenn die Farbe schon paßt) — nicht dort, wo etwas nur lang ist.

Unter 62 rem gilt die Regel nicht mehr. Dort wird gescrollt, und das ist richtig.

### 2. Das Brett steht auf jeder Breite

Aus B1 folgt keine Zahl, sondern eine Zuständigkeit: `--tray-strip` entscheidet
heute allein, wieviel Platz das Brett bekommt, und kennt nur den Fall „es ist
genug da". Der zweite Fall bekommt einen eigenen Zweig, und beide Fälle bekommen
einen Test, der die Formel festhält — sonst ist der nächste, der an der Zahl
dreht, wieder derjenige, der das Brett verschwinden läßt.

### 3. Zustand ist gezeichnet, nicht ausgegraut

Aus B5 und B6 und aus dem alten B5 („der Kaufstapel dimmt seine Auskunft mit")
kommt derselbe Satz: die Oberfläche zeigt Zustände, indem sie Dinge blasser
macht. Blasser ist keine Auskunft. Ein Becher, der noch nicht geworfen wurde,
sieht aus wie ein Becher; eine Hand ohne Karten sagt, was hineingehört.

### 4. Die Meßlatte kommt in `CLAUDE.md`

Als Regel 9, mit der Zahl darin. Der Durchgang vom 16.08. hat unter „Fallen"
notiert, warum: `.button--ghost` wurde an seinen drei Fundstellen repariert und
war Monate später an der vierten immer noch unsichtbar. Ein Befund ohne Regel
kommt wieder.

## Reihenfolge

1. **B1** — das Brett auf schmalen Fenstern. Größter Schaden, kleinster
   Eingriff, unabhängig von allem Weiteren.
2. **B4 und B3** — die doppelte Statuszeile und die Gründung. Beides am
   Spielbildschirm, beides am selben Ort im Code.
3. **B2** — der Wartebereich zweispaltig mit Brettvorschau. Der größte Umbau.
4. **StartScreen** — Titel, Diagnose, Chips, Startknopf (B7), und damit die
   restlichen 209 bzw. 361 px.
5. **B5 und B6** — Becher, leere Hand, Regler.
6. **5b — die vier ungesehenen Dialoge.** Handel, Gegenangebot, Abwerfen,
   Räuber-Opfer und die Entwicklungskarten, erreicht über eine durchgespielte
   Hotseat-Partie. Was dort gefunden wird, ist ein Nachtrag zu dieser Spec und
   kein neuer Durchgang.
7. **Regel 9 in `CLAUDE.md`**, zusammen mit dem Nachtrag in `PROGRESS.md`.

Jeder Schritt endet mit einer Messung im Iframe-Prüfstand, nicht mit einem
Blick. Die Tabellen oben sind die Vorher-Werte.

## Was dieser Durchgang nicht gesehen hat

- **Handel, Räuber, Abwerfen, Entwicklungskarten — noch nicht.** Eine
  Gründungspartie erreicht sie nicht; am 16.08. blieb es deshalb dabei. Diesmal
  nicht: die vier Dialoge stehen als **eigener Schritt 5b** in der Reihenfolge.
  Der Weg dorthin ist eine lokale Partie zu dritt, durch die Gründung gespielt
  und so lange gewürfelt, bis Hände voll sind — im Hotseat ist das ohne zweites
  Gerät machbar, weil alle drei Spieler an demselben Bildschirm sitzen. Der
  Räuber kommt mit der ersten Sieben von selbst; kommt er nicht, wird der Seed
  gewechselt statt gewartet.
- **Berührung.** Alle Aussagen zu Trefferflächen sind gerechnet.
- **Zwei Geräte am selben Raum.** Der Wartebereich ist aus einem Browser
  vermessen, mit einem Sitzenden und zwei freien Plätzen.
- **Die Konto-Dialoge.** Registrieren und Anmelden sind nicht geöffnet worden.
