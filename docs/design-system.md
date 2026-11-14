# Designsystem „Seekarte"

Die Regeln für jede Fläche des Spiels. `docs/design.md` bleibt gültig (Grundsätze
und die Liste der Fallen); dieses Dokument legt fest, **woraus** gebaut wird.
Die Werte stehen in `apps/client/src/styles/tokens.css`, die Bausteine in
`styles/system.css`, die Karte in `chart/SeaChart.tsx`.

## Die Idee

Conquerist wird an einem **Kartentisch** gespielt. Auf dem Tisch liegt eine
Seekarte, auf der Karte liegt die Insel, und alles, was man anfasst, ist ein
Stück Pergament oder ein Spielstein, der daraufgelegt wurde. Daraus folgen drei
Materialien, und jedes hat genau eine Aufgabe:

| Material          | Wofür                                                 | Woran man es erkennt                                             |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| **See**           | Der Grund. Auskunft, die man liest und nicht anfasst. | Tiefsee-Tinte, Windstrahlennetz, kursive Kartenschrift           |
| **Pergament**     | Alles Bedienbare: Knöpfe, Felder, Dialoge.            | Heller Körper, gefaste Ecken, Kontaktschatten                    |
| **Spielmaterial** | Brett, Steine, Karten, Würfel, Chips.                 | Form aus der Wirklichkeit, volle Sättigung, eigener Schattenwurf |

Wer etwas Neues baut, entscheidet zuerst, welches der drei es ist. Ein Viertes
gibt es nicht: kein Glas, keine halbtransparente Kachel, kein Verlauf als
Fläche. Ein Knopf, der wie See aussieht (durchscheinend auf Dunkel), ist nur
für Nebenwege erlaubt (`.button--ghost`) — alles, was den Zug voranbringt, ist
Pergament.

**Das eine Element**, an das man sich erinnert, ist die Karte selbst: das
Windstrahlennetz mit seiner Windrose (`SeaChart`). Sie liegt auf **jedem**
Bildschirm und ist überall dieselbe. Alles andere bleibt ruhig.

### Woher das kommt

Portolankarten wurden auf ein Netz aus Kurslinien gezeichnet: sechzehn Punkte
auf einem Kreis, jeder mit jedem verbunden, die Linien nach Wind in drei Tinten
(Hauptwinde dunkel, Halbwinde grün, Viertelwinde rot). Erst kam das Netz, dann
die Küste. Genau so ist der Bildschirm gebaut: Netz, darauf die Insel.
Seekarten setzen außerdem alles, was Wasser ist, in **Kursiv** — daher die
Kartenschrift. Der **Kartenrand** (doppelte Linie um ein Blatt) und der
**Maßstab** (Leiste aus vollen und leeren Feldern) kommen aus derselben Quelle.

## Farbe

Die Farbwelt aus `design.md` Regel 2 bleibt: Tiefsee, Pergament, Gelände- und
Sitzfarben. Neu sind nur die Kartentinten (`--chart-*`), gemischt aus dem
Bestand. Kein Hex-Wert in einer Komponente.

- Die See ist dunkler geworden (`--sea-900` als Grund, `--sea-700` nur als
  Untiefe unter der Insel). Das Brett bekommt dadurch die Sättigung allein.
- Schrift auf der See: `--on-sea` (Inhalt), `--on-sea-muted` (Beschriftung).
  Kleine Schrift braucht 4,5:1 — nachmessen, nicht schätzen.
- Sitzfarbe ist nie alleiniger Träger: immer mit Namen oder Form.
- Gelb (`--accent`) heißt „das ist jetzt dran": der nächste Schritt des Zugs,
  der aktive Sitz, der Fokus. Nicht als Schmuck verwenden.

## Schrift

Zwei Stimmen und die gezeichnete Anzeigeschrift.

| Stimme                         | Wo                                                                   | Wie                                    |
| ------------------------------ | -------------------------------------------------------------------- | -------------------------------------- |
| `--font-ui`                    | Alles Bedienbare, jede Zahl, alles auf Pergament                     | 400 / 650, Tabellenziffern             |
| `--font-chart` (`.chartlabel`) | Beschriftung **auf der See**: Bereichsnamen, Statuszusätze, Hinweise | kursiv, Satzschreibung, keine Sperrung |
| `Wordmark` / `Numerals`        | Wo eine Zahl oder der Name groß der Inhalt ist                       | unverändert, siehe `design.md` Regel 3 |

Grade: `--text-xs` 12 · `--text-sm` 13 · `--text-md` 15 · `--text-lg` 18 ·
`--text-xl` 24 · `--text-2xl` 34 px. **Nichts steht unter 12 px.**

Verboten, weil es die Handschrift jeder generierten Oberfläche ist:

- gesperrte Versal-Kleinlabels („TISCH", „KARTE KAUFEN", „HAN / POL / WIS") —
  stattdessen `.chartlabel` in Satzschreibung und das ausgeschriebene Wort;
- Festbreitenschrift für kleine Angaben (Seed, Kartenzahl) — Tabellenziffern
  der `--font-ui` leisten dasselbe;
- Halbgeviertstrich als Etikett („Partie starten — online"), Mittelpunkte als
  Trenner, Pfeil hinter Knopftext;
- eine Überzeile über jeder Überschrift.

Eine Beschriftung steht nur, wo sie etwas sagt, das man sonst nicht wüsste.
Über einer Liste von Sitzen muss nicht „Tisch" stehen, wenn man die Sitze sieht.

## Form, Abstand, Tiefe

- **Fase** für Bedienbares (`corner-shape: bevel`), Tiefe `--corner-sm/md/lg`.
  Spielmaterial wird nie geschnitten. Nie `clip-path`.
- **Abstände** nur aus `--space-1 … 7` (4-px-Raster).
- **Drei Lagen Tiefe:** `--lift` (liegt), `--lift-raised` (angehoben),
  `--sheet` (ein Blatt über der Karte). Kein weicher Weitschatten, kein Glow.
- **Das Blatt** (`.sheet`): Pergament mit Kartenrand. Dialoge, Verlaufsblatt,
  Tafeln im Wartebereich. Der Kartenrand ist die einzige Verzierung.
- **Der Maßstab** (`.scalebar`): für jedes „n von m" — Siegpunkte, Restzeit,
  Ausbaustufen. Ersetzt Punktreihen aus Textzeichen (`ooooo`).
- Trefferflächen mindestens 44 px auf groben Zeigern, sichtbarer Fokus überall.

## Bewegung

Bewegung erklärt einen Zustandswechsel oder entfällt (`design.md` Regel 5).
Neu ist, dass sie **ein System** ist: Dauer und Kurve kommen aus den Tokens,
und die Art der Bewegung kommt aus dem Material.

### Jedes Material bewegt sich auf seine Weise

| Material      | Erscheinen                                          | Kurve           | Nie                    |
| ------------- | --------------------------------------------------- | --------------- | ---------------------- |
| See / Schrift | `ink-in`: sie erscheint, ohne Ortswechsel           | linear          | gleiten, hüpfen        |
| Pergament     | `sheet-in`: von knapp darüber aufgelegt             | `--ease-out`    | federn, drehen         |
| Spielstein    | `piece-in`: von oben hingestellt, ein Hauch zu weit | `--ease-settle` | einblenden ohne Fall   |
| Karte         | `deal-in`: vom Stapel her zugeschoben               | `--ease-out`    | aus dem Nichts wachsen |

### Drei Stufen, je nach Gewicht des Ereignisses

1. **Klein — Antwort auf die eigene Eingabe.** `--t-press` / `--t-quick`.
   Knopf drücken, Zeiger darüber, Auswahl. Sofort, nie blockierend. Jeder
   Klick bekommt eine sichtbare Antwort am Element selbst.
2. **Mittel — etwas auf dem Tisch hat sich geändert.** `--t-move` / `--t-enter`.
   Stein gebaut, Karte bekommen, Dialog auf, Plakette vergeben. Zeigt, **wo**
   es passiert ist und **wem**.
3. **Groß — der Moment gehört allen.** `--t-travel` / `--t-stage`. Wurf,
   Räuber zieht, Zugwechsel, Barbaren landen, Sieg. Höchstens eine große
   Bewegung zugleich; sie darf die Vorführung aufhalten (`useSettledRoll`),
   alles andere darf das nicht.

### Regeln

- Dauer und Kurve **nur** aus `tokens.css`. Keine Zahl in Millisekunden in
  einer Flächendatei (Ausnahme: die durchgerechnete Würfelphysik in `dice.css`).
- Ankommen bremst (`--ease-out`), Gehen beschleunigt (`--ease-in`) und ist
  kürzer (`--t-exit`). Für **Information** nur Eingänge.
- Was nacheinander ankommt, kommt mit `--stagger` Versatz, höchstens fünf Lagen.
- Ein Wechsel am selben Element braucht ein `key`, sonst läuft nichts
  (`design.md`, Fallen).
- Kein Dauerlauf: nichts pulsiert, atmet oder schwebt ohne Ende. Was auf eine
  Handlung wartet, zeigt das **einmal** beim Erscheinen und danach durch
  seinen Zustand (Farbe, Linie), nicht durch Blinken.
- Zeiger darüber: Pergament und Spielmaterial heben sich (Schatten geht mit).
  Schrift und Linien auf der See heben sich nicht — sie werden deutlicher.
- `prefers-reduced-motion`: der Block in `base.css` kürzt alles; wo eine
  Bewegung eine Wartezeit begründet, entfällt auch das Warten.

## Aufbau der Flächen

- **Das Brett ist der Held** und steht in der Mitte. Was um es herum steht,
  ist an den Rand der Karte geschrieben, nicht in Kästen gestellt.
- **Der Status ist die Kartusche** (das Titelfeld einer Karte): wer am Zug ist,
  steht als größte Schrift der Ecke da, mit Sitzfarbe **und** Namen; darunter
  in Kartenschrift, was gerade verlangt ist.
- **Links oben der Tisch** (wer sitzt, wer führt), **unten links die eigene
  Hand**, **unten rechts das, womit man den Zug macht** (Bauen, Würfeln). Die
  Reihenfolge liest sich wie ein Zug.
- Dialoge sind Blätter über der Karte; dahinter wird die Karte dunkler, nicht
  unscharf.

## Arbeitsweise

- CSS liegt je Fläche in `apps/client/src/styles/*.css`; `index.css` ist nur
  die Importreihenfolge (= Kaskade). Tests, die das Blatt als Text prüfen,
  lesen `test/stylesheet.ts`.
- Wer eine Regel überschreibt, zählt ihre Spezifität nach und löscht die alte,
  statt eine zweite daneben zu stellen.
- Abnahme einer Fläche: im Browser **gesehen** bei 1440×900, 1184×615 und
  396×800, mit und ohne `prefers-reduced-motion`.
