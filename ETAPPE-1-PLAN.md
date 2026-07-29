# Etappe 1 — Plan (TEMPORÄR)

> **Diese Datei ist Arbeitsmaterial, kein Projektdokument.**
> Sie hält den abgestimmten Plan für Etappe 1 fest, damit die Arbeit ohne
> Verlust wieder aufgenommen werden kann. **Nach Abschluss von Etappe 1
> löschen** — der Inhalt wandert dann verdichtet in `PROGRESS.md`.

**Stand:** 2026-07-30. Plan abgestimmt, alle offenen Fragen entschieden.
**Nächster Schritt:** Freigabe („los") → Dateien anlegen.
Vorher wird kein Code geschrieben.

**Ausgangslage:** Etappe 0 ist fertig, committet und gepusht
(`etappe-0-grundgeruest`, Commit `1ff6ff5`), noch nicht in `main` gemerged.
Für Etappe 1 einen eigenen Branch abzweigen: `etappe-1-geometrie`.

---

## Umfang

`packages/shared`: Hex-Geometrie, kanonische Vertex/Edge-IDs,
Szenario-Generator, RuleSet-Gerüst.
`apps/server` und `apps/client` bleiben in dieser Etappe **unangetastet**.

Erste Etappe mit echter Spiellogik, also die erste, in der Regel 2 greift:
`(state, action) => newState`, kein `Date.now()`, kein `Math.random()`,
Zufall ausschließlich über einen übergebenen Seed. Alles reine Funktion und
ohne Infrastruktur testbar.

---

## Dateiliste

### `packages/shared/src/random`

| Datei             | Zweck                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prng.ts`         | Deterministischer PRNG als **unveränderlicher Wert**: `createRng(seed)`, `nextUint32(rng) → [value, nextRng]`. Muss in Node und Browser bitgleich laufen.      |
| `shuffle.ts`      | Fisher-Yates auf Basis von `prng.ts`, gibt gemischtes Array **und** neuen RNG-Zustand zurück.                                                                  |
| `prng.test.ts`    | Reproduzierbarkeit: gleicher Seed → gleiche Folge; verschiedene Seeds → verschiedene; Verteilung grob gleichmäßig; erste Werte gegen fest eingetragene Zahlen. |
| `shuffle.test.ts` | Permutation bleibt Permutation, gleicher Seed → gleiche Reihenfolge, leeres Array.                                                                             |

### `packages/shared/src/geometry`

| Datei            | Zweck                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hex.ts`         | Axiale Koordinate `{ q, r }`, Umrechnung nach Cube, `hexNeighbor`, `hexDistance`, `hexRing`, `hexSpiral`, `hexEquals`, `hexToId`/`hexFromId`.                  |
| `directions.ts`  | Die sechs Richtungen als Index 0–5 mit dokumentierten axialen Deltas — bewusst **ohne** Himmelsrichtungsnamen (Entscheidung B). Mit ASCII-Skizze im Kommentar. |
| `vertex.ts`      | Kanonische Knoten-ID (Siedlungsplatz). Aus jedem `(hex, corner)`-Bezug wird derselbe ID abgeleitet; `vertexHexes`, `vertexNeighbors`, `vertexEdges`.           |
| `edge.ts`        | Kanonische Kanten-ID (Straßenplatz). `edgeHexes`, `edgeVertices`, `edgeNeighbors`.                                                                             |
| `board.ts`       | Leitet aus einer Hex-Menge die vollständige Topologie ab: alle Knoten, alle Kanten, Nachbarschaftslisten. Reine Ableitung, nichts gespeichert.                 |
| `index.ts`       | Barrel.                                                                                                                                                        |
| `hex.test.ts`    | Nachbarschaft, Distanz, Ring- und Spiralgrößen, ID-Roundtrip.                                                                                                  |
| `vertex.test.ts` | Kanonizität: alle drei Bezugswege auf denselben Knoten liefern denselben ID; ein Knoten hat 3 Hexe und 3 Kanten; Randfälle.                                    |
| `edge.test.ts`   | Kanonizität aus beiden Richtungen, 2 Hexe und 2 Knoten pro Kante.                                                                                              |
| `board.test.ts`  | Basisspiel: 19 Hexe, 54 Knoten, 72 Kanten. Beide Layouts zusätzlich gegen die Eulersche Formel.                                                                |

### `packages/shared/src/scenario`

| Datei                     | Zweck                                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terrain.ts`              | Geländearten und Ressourcen als `Record<Id, …>`-fähige String-Ids, nicht als feste Felder (Regel 5).                                                                                                                       |
| `harbor.ts`               | Hafen-Typen und Tauschverhältnisse (2:1 je Ressource, 3:1 generisch).                                                                                                                                                      |
| `definition.ts`           | `ScenarioDefinition` mit Zod: Hex-Liste mit Gelände und Zahlenchip, Häfen, `robberStart`. Knoten und Kanten werden **nicht** gespeichert, sondern abgeleitet.                                                              |
| `fairness.ts`             | Die vier Fairness-Bedingungen als reine Prädikate, einzeln testbar.                                                                                                                                                        |
| `blueprints/classic34.ts` | Basisspiel, 19 Hexe, Layout 3-4-5-4-3.                                                                                                                                                                                     |
| `blueprints/classic56.ts` | Erweiterung, 30 Hexe, Layout 3-4-5-6-5-4-3.                                                                                                                                                                                |
| `generator.ts`            | `generateScenario(blueprint, seed) → ScenarioDefinition`. Mischt Gelände und Chips deterministisch, setzt den Räuber.                                                                                                      |
| `index.ts`                | Barrel.                                                                                                                                                                                                                    |
| `definition.test.ts`      | Schema akzeptiert Gültiges, lehnt doppelte Hexe, unbekanntes Gelände, Chip auf der Wüste ab.                                                                                                                               |
| `fairness.test.ts`        | Jede der vier Bedingungen gegen ein absichtlich verletzendes Brett.                                                                                                                                                        |
| `generator.test.ts`       | Gleicher Seed → identisches Brett; verschiedene Seeds → verschiedene; Geländeanzahlen und Chipsumme stimmen immer; jedes erzeugte Brett besteht das eigene Schema **und** alle Fairness-Bedingungen. Für beide Blueprints. |

### `packages/shared/src/rules`

| Datei             | Zweck                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ruleset.ts`      | Baukosten, Siegpunktziel, Stapelgrößen, Handkartenlimit als Zod-validierte Daten plus die Instanz des Basisspiels. Nur Werte, keine Logik. |
| `index.ts`        | Barrel.                                                                                                                                    |
| `ruleset.test.ts` | Schema lehnt negative Kosten und unbekannte Ressourcen ab.                                                                                 |

### Geändert

`packages/shared/src/index.ts` (Re-Export), `PROGRESS.md`.
Am Ende: **diese Datei löschen.**

---

## Die drei kritischsten Entscheidungen

### A) Knoten- und Kanten-Identität wird aus den Nachbarhexen abgeleitet, nicht vergeben

Das ist die Entscheidung, an der ein Catan-Klon steht oder fällt. Ein
Siedlungsplatz ist von drei Hexen aus erreichbar, ein Straßenplatz von zwei —
und alle Wege müssen zwingend dieselbe Identität ergeben, sonst baut ein
Spieler zwei Siedlungen auf denselben Punkt.

Zwei gängige Verfahren:

1. **Besitzer-Verfahren.** Jeder Knoten „gehört" genau einem Hex (etwa dessen
   Ecke 0 oder 1), jede Kante einem Hex (Kante 0, 1 oder 2). Kurze IDs wie
   `v:0,0,1`. Verlangt eine Normalisierungsfunktion, die jeden Bezug auf den
   Besitzer zurückrechnet.
2. **Strukturelles Verfahren.** Die ID _ist_ die sortierte Menge der
   angrenzenden Hexe: `v:0,0|1,-1|1,0`, `e:0,0|1,0`.

**Gewählt: 2.** Der Rechenaufwand ist derselbe — Verfahren 1 braucht seine
Normalisierung ohnehin — aber die ID trägt ihren eigenen Beweis: man liest die
drei Hexe direkt ab. Bei 54 Knoten und einem Adjazenzfehler ist das der
Unterschied zwischen einer Minute und einem Abend. Ab Etappe 6 landen diese IDs
im Action-Log und in SQLite, wo Lesbarkeit noch mehr zählt.

Wichtig dabei: die Identität wird gegen die **unendliche Ebene** berechnet,
nicht gegen das Brett. Ein Randknoten grenzt auf dem Brett nur an ein oder zwei
Hexe, geometrisch aber immer an drei. Rechnet man gegen das Brett, ändert sich
die ID eines Randknotens, sobald ein Szenario größer wird — und die
Erweiterbarkeit aus Regel 5 wäre dahin.

Falls die Länge später störte: 54 Knoten auf einen kompakten Index abzubilden
ist eine Nachschlagetabelle und kein Umbau. Umgekehrt wäre es einer.

### B) Die Geometrie bleibt orientierungsagnostisch

Axiale Koordinaten `{ q, r }` zur Speicherung, Cube-Koordinaten für Distanz und
Rotation. Die Richtungen sind aber **Indizes 0–5 mit dokumentierten Deltas**,
nicht `NORTH_EAST` und Freunde.

Grund: ob die Hexe spitz oder flach oben stehen, ist eine reine
Darstellungsfrage und entscheidet sich in Etappe 3 am SVG. Die Mathematik ist
davon unberührt — Nachbarschaft, Distanz, Ringe und die kanonischen IDs sind
identisch. Nur die Umrechnung in Pixel unterscheidet sich, und die gehört in den
Client.

Namen wie `NORTH_EAST` würden diese Entscheidung jetzt einbetonieren, in
`shared` sichtbar machen und beim ersten Blick aufs gerenderte Brett zu einer
Umbenennung durch alle Dateien führen.

### C) Der PRNG ist ein unveränderlicher Wert, kein Objekt mit Zustand

`nextUint32(rng)` gibt `[value, nextRng]` zurück; der Aufrufer führt den Zustand
weiter. Umständlicher als `rng.next()`, aber Regel 2 verlangt genau das: der
Zustand muss aus dem Action-Log rekonstruierbar sein, und ein PRNG mit
verstecktem Innenleben macht Zeitreise unmöglich. Ab Etappe 2 hängt daran jeder
Würfelwurf.

Dazu drei Festlegungen:

- **Algorithmus:** `sfc32` mit `cyrb128` als Seed-Hash. Klein, gut getestet, nur
  32-Bit-Ganzzahloperationen — also bitgleich in Node und im Browser. Keine
  Fließkommaakkumulation, die zwischen Engines abweichen könnte. Server und
  Client müssen aus demselben Seed dasselbe Brett bauen; das ist keine
  Bequemlichkeit, sondern Voraussetzung.
- **Seed ist ein String.** Aus `"conquerist-42"` lässt sich ein teilbarer
  Spielcode machen; eine Zahl kann das nicht besser und liest sich schlechter.
- **Der Test hält die Folge fest.** `prng.test.ts` prüft die ersten Werte gegen
  fest eingetragene Zahlen. Wenn jemand später am PRNG schraubt, brechen alle
  bestehenden Spiele — das soll ein roter Test sagen, nicht ein Spieler.

---

## Entschiedene Fragen

**1. Häfen: jetzt.** `HarborDefinition` wird Teil der `ScenarioDefinition`:
Küstenkante plus Tauschverhältnis. Basisspiel: fünf 2:1-Häfen (einer je
Ressource) und vier 3:1-Häfen. Nur Daten und Topologie — die Handelsregeln
bleiben Etappe 8.

**2. Faires Verteilungssystem, das nicht immer dasselbe Brett ergibt.**
Zahlenchips kommen in Spiralreihenfolge aufs Brett (erzeugt spürbar bessere
Verteilungen als reines Mischen), darüber laufen vier Bedingungen:

- keine zwei 6er oder 8er benachbart
- keine zwei gleichen Zahlen benachbart
- kein Knoten mit extremer Pip-Summe — die Augenwahrscheinlichkeit jeder Zahl
  (2 und 12 haben 1 Pip, 6 und 8 haben 5) wird pro Siedlungsplatz aufsummiert
  und muss in einem Band liegen. Verhindert sowohl den Über-Knoten als auch die
  tote Brettecke.
- keine drei gleichen Geländearten als Cluster, damit nicht das halbe Brett
  Wald ist

Umsetzung als Rejection Sampling mit begrenzter Versuchszahl: bei Verletzung
wird mit dem weitergeführten RNG-Zustand neu gemischt, nach N Versuchen werden
die Bedingungen stufenweise gelockert — statt endlos zu schleifen oder zu
werfen. Bleibt deterministisch, weil derselbe Seed dieselbe Versuchsfolge
erzeugt. **Alle Schwellen stehen im Blueprint, nicht im Code.**

„Nicht immer dasselbe" ist damit der Seed. Die Tests prüfen beides: dass
verschiedene Seeds verschiedene Bretter ergeben **und** dass jedes erzeugte
Brett alle vier Bedingungen erfüllt.

**3. 5–6-Spieler-Erweiterung wird mitgebaut.** Zweiter Blueprint, Layout
3-4-5-6-5-4-3 = 30 Hexe, 28 Zahlenchips, zwei Wüsten.

Zahlen zur Kontrolle:

- Basisspiel: 4 Wald, 4 Weide, 4 Feld, 3 Hügel, 3 Berg, 1 Wüste = 19 Hexe,
  18 Chips (2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12).
- Erweiterung: 6 Wald, 6 Weide, 6 Feld, 5 Hügel, 5 Berg, 2 Wüste = 30 Hexe,
  28 Chips (2 und 12 je zweimal, 3 bis 11 ohne 7 je dreimal).

Da 3-4-5-6-5-4-3 kein reguläres Sechseck ist, steht die Knoten- und Kantenzahl
nicht vorab fest. Der Test prüft sie deshalb gegen die **Eulersche Formel**
(`V − E + Flächen = 2`, Flächen = Hexe + Außenfläche). Fürs Basisspiel geht die
Rechnung auf: 54 − 72 + 20 = 2. Das ist der härtere Test, weil er jeden
Adjazenzfehler auffliegen lässt, ohne dass die Zahl vorher bekannt sein muss.

**4. `robberStart` steht explizit in der Definition.** Ein Szenario mit zwei
Wüsten oder mit Räuberstart woanders ist dann kein Sonderfall, sondern nur
andere Daten.

**5. RuleSet wird mitgebaut.** `src/rules/ruleset.ts` mit Baukosten,
Siegpunktziel, Stapelgrößen, Handkartenlimit als Zod-validierte Daten plus die
Instanz des Basisspiels. Nur Werte, keine Logik — die kommt mit dem Reducer in
Etappe 2.

Abgrenzung: Geländeanzahlen und Chipverteilung sind **Szenariodaten**,
Baukosten und Siegpunktziel sind **RuleSet**.

---

## Offener Punkt

Die **exakten Hafenpositionen** am Brettrand und die Hafenzahl der
5–6-Erweiterung sind nicht belastbar bekannt. Entschieden: eine dokumentierte,
spielbar-symmetrische Anordnung einbauen und hier sowie in `PROGRESS.md` als
„gegen die Schachtel zu prüfen" vermerken. Weil es reine Daten sind, ist die
Korrektur später ein Zahlentausch in einer Datei und kein Umbau — deshalb nicht
darauf warten.

Wer die Schachtel zur Hand hat: Positionen durchgeben, dann wird direkt der
richtige Wert eingetragen.

---

## Erinnerungsposten aus Etappe 0

Steht auch in `PROGRESS.md`, hier nur als Kontext für die nächste Sitzung:

- Kein ESLint (begründet). Nachziehkandidaten: `no-floating-promises`,
  `exhaustive-deps`.
- Keine React-Komponententests — sinnvoll ab Etappe 3.
- Kein CI. Vor dem ersten Merge in `main` einrichten.
- Kompilierte Testdateien liegen im `dist`.
- Kein Node-Version-Pin (`engines.node` steht auf `>=22`).
- `CLAUDE.md` steht in `.prettierignore` und wird nicht umformatiert.
