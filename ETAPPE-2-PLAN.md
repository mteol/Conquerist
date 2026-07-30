# Etappe 2 — Plan (TEMPORÄR)

> **Diese Datei ist Arbeitsmaterial, kein Projektdokument.**
> Sie hält den abgestimmten Plan für Etappe 2 fest, damit die Arbeit ohne
> Verlust wieder aufgenommen werden kann. **Nach Abschluss von Etappe 2
> löschen** — der Inhalt wandert dann verdichtet in `PROGRESS.md`.

**Stand:** 2026-07-31. Vier Grundsatzfragen entschieden, zwei Punkte brauchen
noch deine Entscheidung (Abschnitt „Was ich von dir brauche").
**Nächster Schritt:** Freigabe („los") → Dateien anlegen.
Vorher wird kein Code geschrieben.

**Ausgangslage:** Etappe 1 ist fertig und committet (`etappe-1-geometrie`,
Commits `48ea654` und `4400995`), noch nicht gepusht, nichts in `main`.
Für Etappe 2 einen eigenen Branch abzweigen: `etappe-2-reducer`.

---

## Umfang

`packages/shared/src/game/`: GameState, Actions, Reducer, Basisregeln.
`apps/server` und `apps/client` bleiben in dieser Etappe **unangetastet**.

Etappe 1 hat das Brett gebaut. Etappe 2 baut das Spiel darauf — und zwar
vollständig genug, dass Etappe 3 daraus eine spielbare Hotseat-Partie machen
kann, ohne dass an den Regeln nachgebessert werden muss.

**Drin:** Gründungsphase, Zugablauf, Würfeln, Ertragsverteilung, Räuber,
Bauen (Straße/Siedlung/Stadt), Handel mit Bank und Häfen, Längste
Handelsstraße, Siegpunkte, Spielende.

**Draußen, mit Absicht:** Netzwerk (Etappe 4/5), Oberfläche (Etappe 3),
`PlayerView` und State-Filtering (Etappe 5), Action-Log-Persistenz (Etappe 6),
Spielerhandel, Entwicklungskarten und Größte Rittermacht (Etappe 8).

---

## Dateiliste

Alles neu unter `packages/shared/src/game/`.

### Zustand und Vokabular

| Datei        | Zweck                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `player.ts`  | `PlayerId` (= `user_id` nach Regel 7), `PlayerState`: Handkarten, verbaute Teile, Siegpunkte. Farbe/Name gehören nicht in die Logik.                                         |
| `state.ts`   | `GameState` mit Zod: Szenario, RuleSet, Spieler in Zugreihenfolge, Belegung von Knoten und Kanten, Räuberposition, Bankvorrat, Phase, RNG-Zustand, Rundenzähler, `lastRoll`. |
| `phase.ts`   | Der Zugablauf als expliziter Zustandsautomat. Ohne ihn wird jede Regel zu einem Sonderfall in `reducer.ts`.                                                                  |
| `actions.ts` | Die Spielzüge als Discriminated Union mit Zod (Regel 5).                                                                                                                     |
| `errors.ts`  | `RuleViolation`: stabiler Code plus lesbare Begründung. Der Code geht ab Etappe 4 über die Leitung, der Text in die Oberfläche.                                              |

### Regeln, je eine Datei, je einzeln testbar

| Datei        | Zweck                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup.ts`   | `createGame(scenario, ruleSet, playerIds, seed)` und die Gründungsphase: zwei Siedlungen und zwei Straßen im Schlangensystem, die zweite Siedlung wirft sofort Ertrag ab.                             |
| `yield.ts`   | Ertragsverteilung zur gewürfelten Zahl. Siedlung 1, Stadt 2, das Räuberfeld liefert nichts. Enthält die Knappheitsregel der Bank (siehe unten).                                                       |
| `build.ts`   | Bauen: Straße (schließt an eigene Straße oder eigene Siedlung an, Kante frei), Siedlung (Abstandsregel: kein Nachbarknoten belegt, plus Anbindung an eigene Straße), Stadt (auf eigene Siedlung).     |
| `robber.ts`  | Die Sieben: Abwerfen über dem Handkartenlimit (Hälfte, abgerundet), Räuber versetzen (nicht auf das eigene Feld zurück), einem Anlieger genau eine Karte stehlen — zufällig aus seiner Hand, per RNG. |
| `trade.ts`   | Handel mit der Bank: 4:1 generisch, 3:1 am generischen Hafen, 2:1 am passenden Ressourcen-Hafen. Ein Hafen zählt, wenn der Spieler auf einem der beiden Knoten seiner Kante gebaut hat.               |
| `roads.ts`   | Längste Handelsstraße: längster Kantenzug im eigenen Straßennetz, unterbrochen durch fremde Siedlungen und Städte.                                                                                    |
| `scoring.ts` | Siegpunkte (Siedlung 1, Stadt 2, Längste Straße 2) und Spielende.                                                                                                                                     |

### Einstiegspunkte

| Datei        | Zweck                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reducer.ts` | `reduce(state, action) → ReduceResult`. Prüft Phase und Zugrecht, delegiert an die Regeldateien, rechnet danach Bonus und Siegpunkte neu.                |
| `legal.ts`   | `legalActions(state, player)`. Leitet aus demselben Zustand ab, was gerade erlaubt ist — für ausgegraute Knöpfe in Etappe 3 und Zugvorschau in Etappe 5. |
| `replay.ts`  | `replay(initial, actions)`: eine Faltung über `reduce`. Klein, aber der Beleg für Regel 2 — und die Vorarbeit für das Action-Log in Etappe 6.            |
| `index.ts`   | Barrel.                                                                                                                                                  |

### Tests

Je Regeldatei eine Testdatei, dazu `reducer.test.ts` (Phasen und Zugrecht),
`legal.test.ts` und `replay.test.ts`. Zusätzlich `game.integration.test.ts`:
eine vollständige Partie mit festem Seed von `createGame` bis
`phase === 'finished'`, gespielt von einer einfachen deterministischen Strategie.

### Geändert

`packages/shared/src/index.ts` (Re-Export), `PROGRESS.md`, `CLAUDE.md`
(Etappenplan und Stand). Am Ende: **diese Datei löschen.**

---

## Die vier kritischsten Entscheidungen

### A) Der Reducer wirft nicht, er antwortet

```ts
export type ReduceResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: RuleViolation };
```

Der Server braucht ab Etappe 4 einen Ablehnungsgrund für seine Fehlerantwort,
und die Oberfläche braucht ab Etappe 3 die Frage „darf ich das?", ohne den Zug
probeweise auszuführen. Eine Ausnahme kann beides nicht liefern, ohne dass jeder
Aufrufer sie fängt und wieder in Daten übersetzt.

`legalActions` beantwortet dieselbe Frage von der anderen Seite und benutzt
**dieselben** Prüffunktionen aus den Regeldateien — nicht eine zweite
Regelauslegung daneben. Genau das ist der Grund, warum die Regeln in eigenen
Dateien liegen und nicht im Reducer.

### B) Der Zugablauf ist ein expliziter Zustandsautomat

```
setup ──► rollPending ──► main ──► (nächster Spieler) rollPending
             │                       │
             │ Wurf = 7              └──► finished
             ▼
        discardPending ──► robberPending ──► main
```

`discardPending` merkt sich, **wer** noch abwerfen muss; erst wenn die Menge
leer ist, geht es weiter. Ohne diesen Zwischenzustand müsste der Reducer bei
jeder eingehenden Aktion neu erraten, ob gerade abgeworfen oder gebaut wird —
und Etappe 5 hätte keinen sauberen Punkt, an dem sie auf mehrere Spieler
gleichzeitig wartet.

Jede Aktion nennt ihre erlaubten Phasen. Eine Aktion zur falschen Zeit ist ein
gewöhnlicher `RuleViolation` mit klarer Begründung, kein Sonderfall.

### C) Der Zufall liegt im Zustand — und gehört zur geheimen Hälfte

Der RNG-Zustand aus Etappe 1 ist ein Feld des `GameState`. `rollDice` verbraucht
ihn und legt den Nachfolgezustand zurück; dasselbe gilt fürs Stehlen. Damit ist
eine Partie aus Startseed und Aktionsfolge exakt rekonstruierbar — das ist
Regel 2, und `replay.ts` belegt es.

**Wichtige Folge für Etappe 5, hier festgehalten, damit sie nicht untergeht:**
Der RNG-Zustand darf niemals in einer `PlayerView` landen. Wer ihn hat, rechnet
jeden künftigen Würfelwurf voraus. Er steht damit auf derselben Liste wie die
Handkarten der Mitspieler.

### D) Längste Handelsstraße als längster Kantenzug

Gesucht ist der längste Weg im eigenen Straßennetz, der keine Straße zweimal
benutzt — ein längster Kantenzug, nicht der längste Pfad. Über einen Knoten mit
fremder Siedlung oder Stadt führt er nicht hindurch; er darf dort enden.

Bei höchstens 15 Straßen je Spieler ist erschöpfende Tiefensuche von jedem
Endpunkt aus schnell genug, und sie ist offensichtlich richtig. Eine Heuristik
wäre hier die schlechtere Wahl: der Fehler fiele erst im Spiel auf, und zwar als
falscher Sieger.

Vergabe: ab fünf Straßen, zwei Siegpunkte, Wechsel nur bei echtem Übertreffen —
bei Gleichstand behält der bisherige Inhaber.

---

## Entschiedene Fragen

**1. Fehlerweg: Result-Typ.** Siehe Entscheidung A.

**2. Handel mit Bank und Häfen gehört in Etappe 2.** Begründung: ohne ihn kann
eine Partie festfahren — ein Spieler mit fünfzehn Erz und ohne Holz kommt nie
wieder ins Spiel. Etappe 3 soll ein _vollständiges_ Spiel zeigen, nicht eines
mit einer bekannten Sackgasse. Die Hafendaten liegen seit Etappe 1 fertig da.
Spielerhandel bleibt Etappe 8.

**3. Würfelzufall über den RNG im Zustand.** Siehe Entscheidung C.

**4. Längste Handelsstraße in Etappe 2.** Sie ist zwei Siegpunkte wert; ohne sie
endet das Spiel zum falschen Zeitpunkt. Die Größte Rittermacht wartet
zwangsläufig auf die Entwicklungskarten und bleibt Etappe 8.

---

## Was ich von dir brauche

### 1. Ereignisliste im Ergebnis — ich empfehle: nein

In der Auswahl stand `ReduceResult` mit einer Liste `events: GameEvent[]`
daneben. Beim Ausarbeiten halte ich das für Vorbau, den Regel 5 ausschließt:

- Der Würfelwurf steht ohnehin als `lastRoll` im Zustand.
- Die Erträge sind aus Brett, Wurf und Belegung ableitbar — die Oberfläche in
  Etappe 3 rechnet sie sowieso, um sie zu zeigen.
- In Etappe 3 (Hotseat) ist alles sichtbar; niemand braucht eine Meldung über
  etwas, das er nicht sehen darf.

Der echte Bedarf entsteht in **Etappe 5**: ein Diebstahl ist für die beiden
Beteiligten eine andere Nachricht als für den Rest des Tisches. Dort gehört das
Thema hin, zusammen mit `PlayerView` — und dann mit konkretem Anlass statt auf
Verdacht.

**Vorschlag:** `ReduceResult` ohne `events`, und in `PROGRESS.md` als
ausdrücklicher Merkposten für Etappe 5. Sag Bescheid, wenn du sie lieber gleich
willst.

### 2. Der Zuschnitt ist groß — soll ich teilen?

Etappe 2 sind nach diesem Plan rund 15 Quelldateien plus Tests, gut das
Anderthalbfache von Etappe 1. Das liegt an der Sache: ein halber Regelsatz ist
nicht spielbar und damit auch nicht abnehmbar.

Zwei Möglichkeiten:

- **In einem Zug** (mein Vorschlag). Am Ende steht eine vollständige Partie, die
  der Integrationstest von Anfang bis Ende durchspielt. Die Abnahme ist eindeutig.
- **Geteilt in 2a und 2b.** 2a: Zustand, Aktionen, Phasen, Bauen, Ertrag,
  Zugablauf. 2b: Räuber, Handel, Längste Straße, Wertung, Spielende. Früherer
  Zwischenstand, aber 2a lässt sich nur an Einzelregeln abnehmen, nicht an einer
  Partie.

---

## Offene Punkte, die ich unterwegs so entscheide

Kleinkram, den ich nicht zur Abstimmung stellen will — hier nur, damit du
widersprechen kannst:

- **Knappe Bank.** Reicht der Vorrat einer Ressource nicht für alle
  Anspruchsberechtigten, geht niemand leer aus, sondern es gilt die
  Originalregel: betrifft es genau einen Spieler, bekommt er, was noch da ist;
  betrifft es mehrere, bekommt keiner von ihnen etwas.
- **Spielende.** Ein Spieler gewinnt nur in seinem eigenen Zug, sobald er das
  Siegpunktziel erreicht. Das Spiel geht danach in `finished` und nimmt keine
  Aktion mehr an.
- **Spielerzahl.** `createGame` prüft sie gegen das Szenario: `classic34` drei
  bis vier, `classic56` fünf bis sechs. Die Grenzen kommen als Daten in den
  Blueprint, nicht als Zahl in den Code.
- **Abwerfen bei der Sieben.** Wer über dem Handkartenlimit des RuleSets liegt,
  wirft die Hälfte ab, abgerundet, und wählt selbst aus.
- **Räuber versetzen.** Nicht auf das Feld zurück, auf dem er schon steht.
  Bestohlen wird ein Spieler, der am neuen Feld gebaut hat und Karten hat.

---

## Erinnerungsposten aus Etappe 0 und 1

Unverändert offen, hier nur als Kontext:

- Kein ESLint, keine React-Komponententests, kein CI, kompilierte Testdateien
  im `dist`, kein Node-Version-Pin.
- Hafenpositionen sind gegen die Schachtel zu prüfen, bei `classic56` auch die
  Anzahl.
- Client-Bundle ist in Etappe 1 um 8 kB gewachsen, ohne dass der Client die
  neuen Module benutzt. Vor Etappe 9 anschauen.
- Knoten- und Kanten-Ids sind einfache String-Aliase, keine Branded Types.
