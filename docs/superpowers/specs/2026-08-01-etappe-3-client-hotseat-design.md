# Etappe 3 — Client: SVG-Brett und Hotseat

Stand: 2026-08-01, Branch `etappe-3-client-hotseat`.

Erstmals sichtbar: das Brett aus Etappe 1 gezeichnet, die Regeln aus Etappe 2
bedienbar, eine vollstaendige Partie ohne Netzwerk. `packages/shared` bleibt
unangetastet — die Etappe fuegt nur `apps/client` hinzu. Faellt beim Umsetzen
doch eine Luecke in `shared` auf, ist das ein eigener, benannter Punkt und kein
stiller Nebeneffekt.

## Abgrenzung

**Rein:** Startbildschirm (Namen, Farben, Brett, Seed), SVG-Brett, vollstaendige
Hotseat-Partie von der Gruendung bis zum Sieg, Bankhandel, die Sieben mit
Abwerfen und Raeuber, Verlaufsanzeige.

**Raus:** Netzwerk — der Hotseat laeuft ohne Server; die Etappe-0-Diagnose baut
erst eine Verbindung auf, wenn man sie aufklappt. Spielerhandel und
Entwicklungskarten sind Etappe 8. Rueckgaengig gibt es nicht: mit verdeckter
Information ab Etappe 5 waere es ohnehin nicht haltbar.

## Der Kern: der Client kennt keine einzige Regel

Kein `if (genug Holz)`, kein „ist dieser Knoten frei". Die Oberflaeche ruft
`legalActions(state, viewer)` und baut daraus drei Nachschlagekarten:

```
VertexId -> GameAction        (Siedlung oder Stadt — am Ort eindeutig)
EdgeId   -> GameAction        (Strasse)
HexId    -> GameAction[]      (Raeuber; je moeglichem Opfer ein Eintrag)
```

Was in einer Karte steht, leuchtet und ist anklickbar. Ein Klick schlaegt nach
und schickt die gefundene Aktion durch `reduce`. Damit existiert die
Regelauslegung weiterhin genau einmal — dieselbe Kopplung, die `legalActions`
und `reduce` in Etappe 2 schon teilen, reicht bis in die Oberflaeche.

Die Zielart ist am Ort eindeutig, deshalb braucht es keinen Baumodus: eine Stadt
ist nur moeglich, wo die eigene Siedlung steht, eine Siedlung nur auf einem
freien Knoten. Sollte `legalActions` je zwei Aktionen fuer denselben Knoten
liefern, ist das ein Fehler und keine Bedienfrage — ein Test haelt fest, dass
die Karte eindeutig ist.

## Module

Neu unter `apps/client/src/`. Die reine Schicht ist bewusst gross und die
React-Schicht duenn: was rein ist, laesst sich ohne DOM in vielen Faellen
pruefen.

| Datei                     | Zweck                                                                                                                                                       | rein |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `board/layout.ts`         | Feld → Mittelpunkt und Ecken (Spitze oben); Knotenposition = Schwerpunkt seiner drei Felder; Kante = Strecke zwischen ihren Endknoten; Ausmasse → `viewBox` | ja   |
| `game/targets.ts`         | `legalActions` → die drei Klickkarten                                                                                                                       | ja   |
| `game/view.ts`            | `GameState` → Anzeigemodell, einschliesslich Verdecken fremder Haende                                                                                       | ja   |
| `game/log.ts`             | `(vorher, action, nachher)` → Verlaufssatz                                                                                                                  | ja   |
| `game/labels.ts`          | deutsche Namen fuer Ressourcen, Gelaende, Hafenarten, Regelverstoesse                                                                                       | ja   |
| `game/useHotseatGame.ts`  | `useReducer` ueber `reduce`; haelt Zustand, Aktionsfolge, Verlauf, letzte Ablehnung                                                                         | nein |
| `seats.ts`                | Sitz: `id`, Name, Farbe — der Teil, den `shared` bewusst nicht kennt                                                                                        | ja   |
| `board/BoardSvg.tsx`      | Felder, Chips, Haefen, Raeuber, Strassen, Bauwerke, Ziele                                                                                                   | —    |
| `panels/*.tsx`            | Tisch, Status, Aktionen, Verlauf, Warteliste                                                                                                                | —    |
| `dialogs/*.tsx`           | Handel, Abwerfen, Opferwahl                                                                                                                                 | —    |
| `screens/StartScreen.tsx` | Spielerzahl 3–6, Namen, Farben, Brettwahl, Seed; darunter aufklappbar die Etappe-0-Diagnose                                                                 | —    |
| `screens/GameScreen.tsx`  | Brett und Panels                                                                                                                                            | —    |
| `App.tsx`                 | Bildschirmwahl Start ↔ Partie                                                                                                                               | —    |

## Namen und Farben gehoeren in den Client

`PlayerState` kennt `id`, `resources` und `piecesLeft` — mehr nicht. Das ist
richtig so: wie ein Spieler heisst, ist keine Regelfrage. Der Client fuehrt
deshalb eine eigene Sitzliste `{ id, name, color }` und uebergibt `createGame`
nur die Ids. Ab Etappe 4 wird aus dieser Id eine `user_id` (Regel 7), ohne dass
sich an der Logik etwas aendert.

Die Sitzliste fasst **drei bis sechs** Sitze und haelt sechs unterscheidbare
Farben bereit. Welches Brett dazu waehlbar ist, sagt das Szenario selbst
(`minPlayers` / `maxPlayers`): `classic34` traegt drei bis vier Spieler,
`classic56` fuenf bis sechs. Der Startbildschirm liest diese Werte, statt die
Grenzen ein zweites Mal aufzuschreiben — `createGame` wirft sonst mit Recht.

## Darstellung

**Ausrichtung: Spitze oben.** Die Reihen 3-4-5-4-3 liegen damit waagerecht, wie
im Blueprint und wie auf dem Tisch. Die Entscheidung faellt ausschliesslich im
SVG; keine Datei in `shared` aendert sich dadurch.

**Nichts ist hartkodiert.** Gezeichnet wird die Feldliste des Szenarios; der
`viewBox` folgt aus den tatsaechlichen Ausmassen. `classic56` mit 3-4-5-6-5-4-3
faellt damit ohne eine Zeile Sonderfall an.

**Knoten- und Kantenpositionen kommen aus der Id.** Eine Knoten-Id _ist_ die
sortierte Menge ihrer drei Felder, also ist der Schwerpunkt dieser drei
Mittelpunkte exakt die Ecke. Eine Kante wird zwischen ihren beiden Endknoten
gezogen (`topology.edgeVertices`). Es gibt damit keine zweite Geometrie neben
der aus Etappe 1.

**Aufteilung (Variante C).** Das Brett fuellt die Flaeche, die Panels schweben
halbtransparent darueber: Tisch oben links (mit dem Schalter „Fremde Haende
verdecken"), Runde und Wuerfel oben rechts, Aktionen unten links, Verlauf unten
rechts. Damit kein Feld je unter einem Panel liegt, wird das Brett **in das
freie Rechteck zwischen den Panels eingepasst** — per CSS-Einzug am
Brettbehaelter plus `preserveAspectRatio="xMidYMid meet"`, ohne Messung zur
Laufzeit. Das ist der Punkt, an dem die Randknoten der Gruendungsphase
anklickbar bleiben.

**Trefferflaechen statt Pixelrechnung.** Knoten sind `<circle>`, Kanten `<line>`
mit einer unsichtbaren breiteren Fassung darueber. Der Browser trifft, nicht
eine eigene Abstandsrechnung.

## Bedienung

**Bauen: Brett zuerst.** Klick auf einen leuchtenden Knoten setzt eine Siedlung,
auf die eigene Siedlung eine Stadt, auf eine leuchtende Kante eine Strasse. Kein
Baumodus, kein Werkzeug.

**Handel: ein Knopf, ein Fenster.** Im Fenster waehlt man, was man abgibt und
was man bekommt. Der Kurs steht daneben und kommt aus `tradeRateFor` — der beste
erreichbare Hafen gilt automatisch. Das Verhaeltnis wird nicht mitgeschickt
(Regel 3: der Client schickt Absichten, keine Ergebnisse). Spielerhandel bekommt
in Etappe 8 einen zweiten Reiter in genau diesem Fenster.

**Verdecken.** Standard ist offen. Der Schalter im Tisch-Panel zeigt fremde
Haende nur noch als Anzahl. Wer „selbst" ist, ergibt sich aus dem Zustand: in
der Gruendung `setupPlayer`, beim Abwerfen der Spieler, dessen Dialog offen ist,
sonst der Spieler am Zug. Die Projektion ist eine reine Funktion und damit die
ehrliche Vorarbeit fuer `PlayerView` in Etappe 5.

**Die Sieben.** `applyDiscard` nimmt jeden aus `phase.pending` in beliebiger
Reihenfolge. Deshalb: fuer alle sichtbar steht da, worauf gewartet wird („Anna
und Ben muessen abwerfen"), und der Abwerf-Dialog gehoert immer genau einer
Person — er geht die Liste der Reihe nach durch. Dass der Reducer auch jede
andere Reihenfolge annimmt, bleibt Reserve: eine freie Wahl waere spaeter ohne
Aenderung an `shared` moeglich, hat im Hotseat aber keinen Anlass. Ist die Liste leer, folgt der
Raeuber; gibt es am Zielfeld mehrere Anlieger mit Karten, fragt derselbe
Dialogplatz nach dem Opfer.

**Gewonnen.** Bei `phase.kind === 'finished'` liegt ein Abschluss ueber dem
Brett: Sieger, Punktestand aller, und ein Weg zurueck zum Startbildschirm.

## Datenfluss und Fehlerbehandlung

```
Klick → Aktion aus der Karte → reduce(state, action)
          ok: true  → neuer Zustand, Aktion an die Folge, Verlaufssatz
          ok: false → Meldung aus errors.ts in der Aktionsleiste
```

Der Fehlerpfad ist ein Netz, kein Normalfall: ueber das Brett ist nur klickbar,
was `legalActions` genannt hat. Greifen kann er nur dort, wo der Spieler frei
zusammenstellt — Abwerfen und Handel. Genau deshalb bekommt er eine sichtbare
Meldung und keinen stillen Abbruch.

Die **Aktionsfolge** ist kein Zierrat: sie ist genau die Eingabe fuer `replay`
und damit die Bruecke zu Etappe 6. Ein Test prueft, dass die im Client
gesammelte Folge den Endzustand reproduziert.

## Tests

Ohne DOM, wie in `shared`:

- Layout: Feld → Mittelpunkt; die Probe, dass alle drei Zugaenge zu einem Knoten
  dieselbe Position ergeben (dieselbe Idee wie der Kanonizitaetstest aus
  Etappe 1); `viewBox` umschliesst jedes Feld beider Blueprints.
- Klickkarten: was `legalActions` nennt, steht in genau einer Karte und genau
  einmal; nichts anderes steht darin.
- Anzeigemodell: Siegpunkte, Vorraete, Kartenzahlen; Verdecken zeigt fremde
  Haende nur als Anzahl und die eigene vollstaendig.
- Verlaufssaetze fuer jede Aktionsart.

Mit jsdom und Testing Library — wenige, gezielte Faelle am Weg vom Klick zur
Aktion:

- Klick auf einen leuchtenden Knoten erzeugt `buildSettlement` und veraendert
  den Zustand.
- Vor dem Wuerfeln ist nichts Baubares hervorgehoben und der Handelsknopf
  gesperrt.
- Der Abwerf-Dialog erscheint nur fuer den Betroffenen und gibt genau die
  gewaehlten Karten zurueck.
- Eine Sieben mit zwei Betroffenen: die Warteliste nennt beide, nach dem ersten
  Abwerfen nur noch einen.

Damit ist der Erinnerungsposten „keine React-Komponententests" aus Etappe 0
erledigt. `pnpm test` muss weiterhin die 492 bestehenden Tests gruen lassen.

## Bewusste Zugestaendnisse

- **Der Seed-Vorschlag kommt aus `crypto`.** Also echter Zufall im Client. Regel
  2 gilt fuer die Logik; die Grenze zwischen Welt und Logik ist genau dieses
  eine Eingabefeld. Ab dort ist alles wieder reproduzierbar.
- **Kein Rueckgaengig.** Bewusst, siehe Abgrenzung.
- **Keine Animationen.** Ein Wurf erscheint, er rollt nicht. Bewegung ist eine
  eigene Frage und hat in der Etappe, die Korrektheit sichtbar machen soll,
  nichts verloren.
- **Der Verlauf haelt Saetze, keine Ereignisse.** Etappe 2 hat die Ereignisliste
  bewusst nicht gebaut; sie bekommt ihren Anlass in Etappe 5, wenn ein Diebstahl
  fuer die Beteiligten eine andere Nachricht ist als fuer den Rest des Tisches.
  Bis dahin leitet der Client seine Saetze aus dem Zustandsuebergang ab.

## Abnahme

| Pruefung                                      | Erwartung                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm typecheck`                              | gruen                                                                               |
| `pnpm test`                                   | die 492 bestehenden gruen, neue Client-Tests dazu                                   |
| `pnpm build`                                  | gruen                                                                               |
| `pnpm format:check`                           | gruen                                                                               |
| `pnpm --filter @conquerist/server acceptance` | 7/7 gruen — die Etappe-0-Kette traegt weiter                                        |
| Partie von Hand                               | Gruendung, Sieben mit Abwerfen und Raeuber, Hafenhandel, Sieg — auf beiden Brettern |
