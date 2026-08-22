# Schmale Geräte: Querformat und Setzen mit dem Finger

Stand: 2026-08-22, `main` (`c6e371a`).

Der Spielbildschirm ist auf einem Handy unbenutzbar. Das steht seit dem
Browser-Durchgang vom 20. August in `PROGRESS.md` und ist zweimal nachgemessen
worden — es ist kein Verdacht, sondern ein Befund mit Zahlen. Dieser Entwurf
räumt ihn ab und beantwortet dabei die zweite Hälfte der Frage: wie man mit dem
Finger eine Siedlung setzt.

Dritter von drei Entwürfen dieses Tages, unabhängig von den anderen
(`2026-08-22-auftaktwuerfeln-design.md`,
`2026-08-22-karten-vor-dem-wurf-design.md`).

## Was es heute gibt

`.game` in `apps/client/src/index.css:1950` rechnet den seitlichen Einzug so:

```css
--tray-strip: max(14.75rem, calc((100vw - 1.5rem - 1.09 * (100vh - 1.5rem)) / 2));
```

`.board-area` bekommt ihn zweimal als `margin`. Wegen des `max(…)` fällt er
**nie unter 236 px je Seite**. Gemessen (Brettbreite über Fensterbreite):

| Fenster | 480 | 560 | 700 | 900 | 1184 |
| ------- | --- | --- | --- | --- | ---- |
| Brett   | 0   | 60  | 200 | 400 | 684  |

Der Wert ist als Entscheidung entstanden und war für breite Bildschirme richtig:
die Ablage steht dort **neben** dem Brett in der leeren See, und das Brett wächst
um die ganze Höhe der früheren unteren Zeile. Auf einem schmalen Gerät gibt es
diese leere See nicht — dort zieht dieselbe Formel dem Brett alles ab.

Die Trefferflächen: `BoardSvg.tsx:612` gibt jedem Knoten einen unsichtbaren
Kreis mit `r={0.22}` viewBox-Einheiten, und `onPick` handelt sofort — ein Klick
setzt.

## Die Rechnung, die den zweiten Teil hart macht

Nimmt man dem Brett den Einzug, ist es auf einem 740-px-Gerät im Querformat rund
**330 px** breit. Die `viewBox` mißt 9,76 Einheiten, also **≈ 34 px je
Umkreisradius** — und benachbarte Knoten liegen genau **einen** Radius
auseinander. Eine Fingerkuppe braucht 44 px.

Bei der **ersten** Setzung ist jeder Knoten des Bretts erlaubt; die Abstandsregel
dünnt erst danach aus. Direktes Tippen ist dort also nicht knapp, sondern
mehrdeutig: unter dem Finger liegen zwei erlaubte Ziele, und welches getroffen
wird, entscheidet die Zeichenreihenfolge.

Deshalb ist „mehr Fläche" allein keine Lösung. Es braucht beides.

## Die Entscheidungen

| Frage        | Antwort                                                             |
| ------------ | ------------------------------------------------------------------- |
| Orientierung | **Querformat.** Im Hochformat ein wegtippbarer Hinweis, kein Riegel |
| Layout       | Brett füllt alles, Ablage **an den Rändern darüber**                |
| Setzen       | **Tippen, dann bestätigen** — ein Weg für Maus und Finger           |
| Zoom         | **Nein** (siehe Offenes)                                            |

„Ein Weg für Maus und Finger" ist die tragende Entscheidung: ein Touch-Sonderweg
wäre ein zweiter Satz Interaktionen, den kein Test am Schreibtisch je erwischt.

## Der Entwurf

### 1. Der Umschaltpunkt

`@media (max-width: 60rem)` (960 px). Nicht weiter unten: die Meßreihe zeigt bei
900 px Fenster ein 400 px breites Brett, und das ist schon zu klein. Nicht weiter
oben: bis dahin trägt die Ecken-Ablage, wofür sie gebaut ist.

Der Umschaltpunkt hängt an der **Breite**, nicht an `orientation`. Ein Tablet im
Hochformat mit 800 px ist derselbe Fall wie ein Handy quer, und ein Laptop im
schmalen Fenster auch — das ist der Fall, den man beim Bauen ständig hat.

### 2. Unter dem Umschaltpunkt: die Ablage wandert über die See

- `.board-area { margin: 0 }` — `--tray-strip` greift nicht mehr, das Brett nimmt
  Breite und Höhe. Aus 268 px werden ~330 px, aus 0 px auf einem 480-px-Gerät ein
  spielbares Brett.
- `.tray__hand` wird ein flacher Streifen am unteren Rand mit den Kartenkanten
  (~3,2 rem) und fährt auf Tipp hoch. Zugeklappt verdeckt er See, nicht Brett.
- `.tray__controls` (Kaufstapel, Bedienleiste) wird eine Reihe runder Knöpfe am
  rechten Rand.
- `.panel--table` (Spielerliste) schrumpft auf eine Zeile oben links,
  `.topline` bleibt, wo sie ist.

Das folgt der Regel, die in `index.css:1998` schon steht — „was man anfassen
könnte, behält einen Körper; was nur Auskunft ist, wird Schrift auf dem Tisch" —
eine Bildschirmgröße weiter gedacht: **was einen Körper hat, legt sich auf die
See, statt neben dem Brett Platz zu verlangen.**

Im Hochformat unter 30 rem ein Hinweis „quer halten", wegtippbar. Kein harter
Riegel: wer im Hochformat nur zusehen will, soll das dürfen.

### 3. Setzen: tippen, dann bestätigen

Drei Teile, und der erste ist eine reine Funktion.

**`apps/client/src/board/pick.ts`:**

```ts
nearestTarget(punkt: Point, ziele: readonly PickTarget[], maxAbstand: number): PickTarget | null
```

Das nächstgelegene erlaubte Ziel in viewBox-Einheiten, oder `null`, wenn keines
innerhalb von `maxAbstand` liegt. Ohne DOM, ohne React — damit ist die eigentliche
Regel („was habe ich getroffen") prüfbar, ohne einen Klick zu simulieren.

**`BoardSvg` bekommt eine durchsichtige Fangfläche** über dem Brett und verliert
die Trefferkreise je Ziel. Sie rechnet die Klickstelle über die CTM des SVG in
viewBox-Koordinaten und fragt `nearestTarget`. Der Grund, das nicht mit größeren
Kreisen je Ziel zu lösen: bei 34 px Abstand und 44 px Finger **überlappen** sie,
und dann entscheidet die Zeichenreihenfolge — eine willkürliche Wahrheit an der
Stelle, wo es genau eine geben muß.

Die Zielmarken bleiben sichtbar, wie sie sind (`vertex__target`, `r={0.13}`). Sie
sagen weiter, wo etwas hingehört; sie fangen nur nichts mehr.

**Die Auswahl lebt im `GameScreen`** als `pending: PickTarget | null` neben dem
schon vorhandenen `buildMode`:

- Erster Tipp: `pending` wird gesetzt, ein halbdurchsichtiges Haus (bzw. Straße,
  Stadt, Räuber) steht dort, daneben „Hier setzen".
- Weiterer Tipp: `pending` wandert. Kein Fehlgriff kostet etwas.
- „Hier setzen": die Aktion geht ab — derselbe `onPick`-Weg wie heute, nur einen
  Schritt später.
- Escape oder Tipp ins Leere: `pending` wird geräumt.

Das gilt **auf allen Geräten**. Ein zweiter Schritt am Schreibtisch ist der Preis
dafür, daß es nur eine Interaktion gibt — und er nimmt dort einen zweiten Befund
mit, den ein Fehlklick heute sofort und unwiderruflich auslöst.

Betroffen sind alle Zielarten: Knoten (Siedlung, Stadt), Kanten (Straße) und
Felder (Räuber). Sie gehen schon heute alle durch `onPick`.

### 4. Was das Vorschau-Brett angeht

`BoardSvg` zeichnet auch die Vorschau auf dem Startbildschirm
(`.start__preview .board`, `index.css:942`). Dort gibt es keine Ziele, also fängt
die Fangfläche nichts und es ändert sich nichts. Ein Test hält fest, daß eine
Fangfläche ohne Ziele keine Aktion auslöst.

## Was daran neu ist und was nicht

| Bauteil                       | Gibt es schon als                       |
| ----------------------------- | --------------------------------------- |
| Umschaltpunkt im Blatt        | `62rem` auf dem Startbildschirm         |
| Ablage über dem Brett         | `.panel`, `.topline` (`pointer-events`) |
| Zielmarken auf dem Brett      | `vertex__target`, Kanten- und Feldziele |
| Zwischenzustand im Bildschirm | `buildMode` im `GameScreen`             |
| Reine Geometrie mit Tests     | `board/layout.ts`                       |

**Wirklich neu sind zwei Dinge:** eine Fangfläche, die aus einem Punkt ein Ziel
macht, und ein Zug, der zwischen Absicht und Ausführung stehenbleibt.

## Reihenfolge

1. **`pick.ts`** — `nearestTarget` mit Tests. Zuerst, weil es die einzige neue
   Regel ist und ohne Oberfläche prüfbar.
2. **`BoardSvg`** — Fangfläche statt Trefferkreise.
3. **`GameScreen`** — `pending`, Geist, „Hier setzen", Escape.
4. **Das Blatt** — Umschaltpunkt, Streifen, Knopfreihe, Hochformat-Hinweis.

Schritt 3 vor Schritt 4: das Setzen muß stimmen, ehe das Brett wächst, sonst
weiß man beim Messen nicht, welche der beiden Änderungen den Treffer gebracht
hat.

Die Tests, die den Entwurf halten müssen: `nearestTarget` (das nähere gewinnt,
außerhalb der Reichweite `null`, gleicher Abstand bleibt bestimmt), der erste Tipp
handelt **nicht**, „Hier setzen" handelt, ein zweiter Tipp verschiebt statt zu
setzen, Escape räumt, und die Fangfläche ohne Ziele tut nichts. Dazu die Messung
im Browser: Brettbreite bei 480, 740 und 900 px, im Iframe wie beim letzten Mal
(`resize_window` wirkt in dieser Umgebung nicht — das ist notiert).

## Was dieser Entwurf offenläßt

- **Zoom und Verschieben.** Bewußt draußen: es verlagert die Arbeit auf den
  Spieler, hilft an der Maus nichts, und mit „tippen, dann bestätigen" ist der
  Befund behoben. Wenn die Messung am Ende zeigt, daß das Brett auf einem
  480-px-Gerät trotzdem zu klein bleibt, ist Zoom die nächste Antwort und ein
  eigener Entwurf.
- **Die Lupe am Finger.** Der schönere Weg, verworfen wegen des Aufwands: ein
  zweites, versetzt gezeichnetes Brett, und „Loslassen setzt" verzeiht kein
  Zittern.
- **Die Ablage im Querformat auf großen Tablets.** Zwischen 60 rem und dem
  Punkt, an dem die Ecken wirklich in der See stehen, liegt ein Bereich, in dem
  beide Layouts gehen. Der Umschaltpunkt entscheidet dort nach Zahl und nicht
  nach Geschmack; ob 60 rem die richtige Zahl ist, sagt die Messung.
- **Die Wurfbahn auf schmalen Geräten.** Die Würfel fliegen über das Brett und
  landen in der Ecke, in der jetzt Knöpfe stehen. Wohin sie dort fallen, ist beim
  Umbau zu sehen und hier nicht entschieden.
