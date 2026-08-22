# Entwicklungskarten vor dem Wurf

Stand: 2026-08-22, `main` (`c6e371a`).

Eine Entwicklungskarte darf heute erst nach dem Würfeln gespielt werden. Damit
fehlt der Zug, um den es bei der Ritterkarte eigentlich geht: den Räuber vom
eigenen Feld holen, **bevor** die Erträge fallen.

Zweiter von drei Entwürfen dieses Tages, unabhängig von den anderen
(`2026-08-22-auftaktwuerfeln-design.md`,
`2026-08-22-schmale-geraete-design.md`).

## Was es heute gibt

`PHASE_ACTIONS.rollPending` (`packages/shared/src/game/reducer.ts:49`) läßt genau
eine Aktion zu:

```ts
rollPending: ['rollDice'],
```

`legalActions` (`game/legal.ts:69`) sagt dasselbe noch einmal: in `rollPending`
gibt es ein `rollDice` für den Spieler am Zug und sonst nichts.

Und `developmentRules.ts:44` prüft für Kauf **und** Ausspielen dieselbe
Bedingung:

```ts
function canActNow(state: GameState, player: PlayerId): RuleViolation | null {
  if (state.phase.kind !== 'main') {
    return violation(RuleViolationCode.WRONG_PHASE, 'Das geht erst nach dem Würfeln');
  }
  ...
```

Die beiden anderen Regeln stehen schon richtig und bleiben unangetastet: eine
Karte je Zug (`state.developmentPlayed`, in `endTurn` zurückgesetzt) und die
Sperre der frisch gekauften (`isPlayable`, `development.ts:77`:
`card.boughtOnTurn < turn`).

## Die Entscheidungen

| Frage                       | Antwort                                                     |
| --------------------------- | ----------------------------------------------------------- |
| Welche Karten               | **Alle vier** — Ritter, Straßenbau, Erfindung, Monopol       |
| Kaufen vor dem Wurf         | **Nein.** Erst würfeln, gekauft wird danach                  |
| Eine Karte je Zug           | **Bleibt**                                                  |
| Frisch gekaufte Karte       | **Bleibt gesperrt**                                         |

Alle vier und nicht nur der Ritter: das ist die echte Catan-Regel, und eine
Hausregel „nur der Ritter darf vorher" müßte man an jedem Tisch erklären.

## Der Entwurf

Drei Eingriffe. Der dritte ist der Grund, warum das kein Einzeiler ist.

### 1. Die vier Aktionen in `rollPending`

`PHASE_ACTIONS.rollPending` bekommt `playKnight`, `playRoadBuilding`,
`playYearOfPlenty` und `playMonopoly` dazu. **`buyDevelopmentCard` nicht** —
gekauft wird nach dem Wurf.

`legal.ts:69` muß mit: dort steht heute eine feste Liste mit einem Eintrag, und
was `legalActions` nicht nennt, zeigt der Client nicht als spielbar an. Der Zweig
für `rollPending` sammelt künftig dieselben Kartenzüge wie der für `main` —
gemeinsame Hilfsfunktion, damit die Liste nicht an zwei Stellen wächst.

### 2. `canActNow` wird geteilt

Kauf und Ausspielen prüfen heute dieselbe Funktion, und die verlangt `main`. Ab
jetzt sind es zwei Bedingungen:

- **`canBuyNow`** — nur `main`. Text bleibt „Das geht erst nach dem Würfeln", und
  er ist dort weiter wahr.
- **`canPlayNow`** — `main` **oder** `rollPending`. Der Verstoßtext muß neu
  formuliert werden: „Das geht erst nach dem Würfeln" wäre falsch, sobald es vor
  dem Würfeln geht. Er sagt künftig, daß es im eigenen Zug geht und sonst nicht.

Die Prüfungen auf „am Zug" und „sitzt am Tisch" bleiben in beiden gleich und
stehen genau einmal.

### 3. `robberPending` muß wissen, wohin zurück

`applyMoveRobber` (`game/robber.ts:168`) setzt hart:

```ts
const moved: GameState = { ...state, robber: hex, phase: { kind: 'main' } };
```

Solange der Räuber nur nach einer Sieben oder nach einem Ritter **in** der
Hauptphase wandert, ist das richtig. Ein Ritter vor dem Wurf käme über denselben
Weg in die Hauptphase — **und der Wurf fiele ersatzlos aus.** Der Spieler hätte
den Räuber versetzt, geerntet würde in dieser Runde nie, und niemand sähe, wo es
verlorenging.

Also trägt die Phase, was nach ihr kommt:

```ts
z.object({ kind: z.literal('robberPending'), resume: z.enum(['main', 'rollPending']) })
```

- Nach einer Sieben: `resume: 'main'` — gewürfelt ist schon.
- Nach einem Ritter: die Phase, in der er gespielt wurde.

`applyMoveRobber` setzt dann `phase: { kind: phase.resume }` statt einer festen
Zeichenkette. Beide Zielphasen sind feldlos, also bleibt das ein einzeiliger
Ausdruck.

Die Alternative — ein Feld `rollOwed: boolean` neben der Phase — wäre eine zweite
Wahrheit über den Zugablauf: der Automat sagte „Hauptphase", das Feld sagte „es
fehlt noch ein Wurf", und jede Regel müßte beide lesen. `resume` steht dort, wo
der Umweg beginnt, und verschwindet mit ihm.

**`discardPending` bekommt kein `resume`.** Abgeworfen wird ausschließlich nach
einer Sieben, und die kommt nur aus einem Wurf — dort ist der Rückweg immer
`main`. Ein Feld, dessen Wert nie variiert, ist eine Frage, die sich niemand
stellt.

## Was daran neu ist und was nicht

| Bauteil                        | Gibt es schon als                       |
| ------------------------------ | --------------------------------------- |
| Aktion in mehreren Phasen      | `timeout`, `dropFromTrade` in `tradePending` |
| Phase mit Nutzlast             | `discardPending.pending`, `tradePending.offer` |
| Eine Karte je Zug              | `developmentPlayed`                     |
| Kartensperre nach Kauf         | `isPlayable`                            |
| Räuber ohne Sieben             | `playKnight` (`developmentRules.ts:182`) |

**Wirklich neu ist ein Ding:** ein Umweg, der weiß, woher er kam.

## Reihenfolge

1. **`resume` in `robberPending`** — Schema, die drei Stellen, die die Phase
   bauen, und `applyMoveRobber`. Zuerst, weil es allein schon eine Änderung mit
   Tests ist und die anderen zwei darauf aufsetzen.
2. **`canActNow` teilen** — `canBuyNow` und `canPlayNow`, neuer Verstoßtext.
3. **Die Freigabe** — `PHASE_ACTIONS` und `legalActions`.
4. **Client** — die Hand muß in `rollPending` spielbar sein. Wenn `legalActions`
   stimmt, folgt das ohne eine eigene Regel im Client; zu prüfen ist, ob
   `HandPanel` und `ActionPanel` ihre Sperre aus `actions` ziehen und nicht aus
   der Phase.

Die Tests, die den Entwurf halten müssen: ein Ritter in `rollPending` führt über
den Räuber **zurück nach `rollPending`** (der eigentliche Befund), eine Sieben
führt weiter nach `main`, Kaufen in `rollPending` wird abgelehnt, die Karte je
Zug gilt über den Wurf hinweg (Ritter vor dem Wurf ⇒ keine zweite Karte danach),
und `legalActions` nennt in `rollPending` genau die spielbaren Karten.

## Was dieser Entwurf offenläßt

- **Die Reihenfolge Ritter/Wurf als Statussatz.** Daß man vor dem Wurf noch etwas
  tun *darf*, ist eine Möglichkeit, keine Aufforderung. Ob der Statussatz sie
  nennt, ist eine Frage der Oberfläche und nicht dieser Regel.
- **`isPlayable` und `turn`.** Die Sperre der frisch gekauften Karte vergleicht
  `boughtOnTurn < turn`, und `turn` zählt volle Runden, nicht einzelne Züge. Das
  ist der Stand von heute und wird hier nicht angefaßt.
- **Straßenbau vor dem Wurf und die Längste Handelsstraße.** `finalize`
  (`reducer.ts:128`) rechnet sie nach jedem Zug neu und prüft den Sieg nur, wenn
  der Handelnde am Zug ist — beides gilt in `rollPending` genauso. Ein Sieg durch
  eine Karte vor dem Wurf ist damit möglich und richtig; ein Test hält es fest.
