# Auftaktwürfeln — wer beginnt

Stand: 2026-08-22, `main` (`c6e371a`).

Eine Partie fängt heute damit an, daß Spieler 1 die erste Siedlung setzt. Wer
Spieler 1 ist, hat der Wartebereich entschieden — nach Beitrittsreihenfolge.
Gewürfelt wird darüber nichts, und der beste Startplatz auf dem Brett gehört
damit dem, der zuerst geklickt hat.

Das ist der erste von drei Entwürfen dieses Tages. Die anderen zwei
(`2026-08-22-karten-vor-dem-wurf-design.md`,
`2026-08-22-schmale-geraete-design.md`) teilen mit diesem keine Zeile Code und
stehen deshalb getrennt.

## Was es heute gibt

`createGame` (`packages/shared/src/game/setup.ts:30`) setzt
`phase: { kind: 'setup', placement: 0, settlement: null }` und
`currentPlayerIndex: 0`. Der Zustandsautomat in `phase.ts` kennt **keine** Phase
vor der Gründung; sein Kopfkommentar zeichnet `setup ──► rollPending ──► main`.

Die Würfel selbst sind fertig und liegen richtig:

- `rollAll` (`game/dice.ts`) würfelt die ganze Schale aus dem übergebenen
  Zufallszustand und gibt den verbrauchten Zufall zurück.
- `lastRoll` im Zustand hält „die gefallenen Würfel und nicht ihre Summe"
  (`state.ts`) — genau, damit die Oberfläche sie zeigen kann.
- `useSettledRoll` (`apps/client/src/game/useSettledRoll.ts`) läßt sie über das
  Brett fliegen, `DiceTray` zeichnet sie.

Es fehlt also nicht die Würfelmechanik, sondern eine Phase, in der ein Wurf
etwas anderes bedeutet als Ertrag.

## Die Entscheidungen

| Frage          | Antwort                                                         |
| -------------- | --------------------------------------------------------------- |
| Wann           | **Einmal**, vor der Gründung                                    |
| Wer wirft wann | **Reihum** in Sitzreihenfolge, jeder löst selbst aus            |
| Gleichstand    | **Stechen** unter den Gleichen, wieder reihum, so oft wie nötig |
| Wirkung        | `players` wird **rotiert**, der Sieger steht auf Index 0        |
| Bühne          | **Auf dem Brett**, mit der vorhandenen Wurfbahn                 |
| Frist          | **Keine**                                                       |

## Der Entwurf

### 1. Eine Phase und kein Feld daneben

`phase.ts:56` begründet für `tradePending`, wann eine Phase die richtige Form
ist:

> Als Phase und nicht als Feld daneben: daß während eines Angebots nicht gebaut
> wird, ist damit dieselbe Regel wie jede andere Phasensperre und keine zweite
> Wahrheit neben `PHASE_ACTIONS`.

Für den Auftakt gilt das in Reinform: während ausgewürfelt wird, ist **jede**
andere Aktion verboten. Als Feld neben `setup` müßte jede Regel diesen Sonderfall
selbst kennen; als Phase ist ein zu früh gesetztes Haus derselbe gewöhnliche
Regelverstoß wie jeder andere.

```ts
z.object({
  kind: z.literal('opening'),
  /** Was in dieser Wurfrunde schon gefallen ist. */
  rolls: z.record(z.string(), RollSchema),
  /** Wer in dieser Wurfrunde noch werfen muß, in Sitzreihenfolge. */
  pending: z.array(PlayerIdSchema),
  /** 0 ist die erste Runde, ab 1 ist es ein Stechen. */
  round: z.number().int().min(0),
});
```

`rolls` hält **nur die laufende Runde**. Ein Stechen ersetzt sie, statt sie zu
ergänzen: was vorher fiel, hat für die Entscheidung keine Bedeutung mehr, und wer
es nachlesen will, findet es im Verlauf. Zwei Runden gleichzeitig im Zustand zu
halten hieße, an jeder Auswertung „welche Runde gilt" mitzudenken.

`pending` ist die Warteschlange und zugleich die Antwort auf „wer ist dran" —
dieselbe Bauform wie `discardPending.pending`, nur der Reihe nach statt
gleichzeitig. `actorFor` (`reducer.ts:79`) bekommt einen Zweig:
`phase.pending[0]`.

`round` steht nicht für die Logik da (sie ergibt sich aus `pending` und `rolls`),
sondern für den Verlaufssatz und die Oberfläche: „Stechen" muß dranstehen, sonst
sieht ein zweiter Wurf wie ein Fehler aus.

### 2. Keine neue Aktion — `rollDice` bedeutet, was die Phase sagt

`PHASE_ACTIONS` bekommt `opening: ['rollDice']`. Die Aktion heißt „ich werfe die
Würfel"; **was** ein Wurf bewirkt, entscheidet die Phase. Das ist genau die
Arbeitsteilung, die `reducer.ts:33` für sich beansprucht — er prüft, _wer_ _wann_
handeln darf, und gibt die Auslegung an die Regeldatei ab.

Der Gewinn ist groß und einmalig: Protokoll (`protocol/`), Envelope, die
Serverräume, `legalActions`, der Würfelknopf im Client und die Wurfbahn
funktionieren **unverändert**. `rollDice` steht schon in jedem dieser Wege. Eine
zweite Aktion `rollForOrder` hätte in acht Dateien einen Zwilling gebraucht, der
dasselbe tut.

Die Auswertung kommt in ein eigenes `game/opening.ts` mit `applyOpeningRoll`, und
`applyAction` verzweigt an einer Stelle:

```ts
case 'rollDice':
  return state.phase.kind === 'opening' ? applyOpeningRoll(state) : rollDice(state);
```

### 3. Die Auflösung

`applyOpeningRoll` würfelt mit `rollAll(state.rules.dice, state.rng)`, schreibt
das Ergebnis nach `rolls`, nimmt den Werfer aus `pending` und setzt `lastRoll` —
**letzteres ist der ganze Grund, warum die fliegenden Würfel ohne eine neue Zeile
im Client funktionieren.**

Ist `pending` danach leer:

- Höchste Summe gewinnt.
- **Ein** Höchster: `players` wird rotiert, bis er auf Index 0 steht,
  `currentPlayerIndex = 0`, `phase = { kind: 'setup', placement: 0, settlement: null }`.
  Die Schlangenreihenfolge der Gründung fällt damit von allein richtig heraus —
  `setupPlayerIndex` (`phase.ts`) rechnet auf Indizes und bleibt unangetastet.
- **Mehrere** Höchste: neue Runde, `pending` sind die Gleichen in
  Sitzreihenfolge, `rolls` wird geleert, `round + 1`.

Die Summe kommt aus **`yieldTotal(state.rules.dice, roll)`**, nicht aus einer
eigenen Addition über alle Augen. Ein Würfel, den das RuleSet nicht mitzählen
läßt (`countsTowardYield: false`), soll auch nicht bestimmen, wer anfängt: es gibt
eine Vorstellung von „die Zahl, die zählt", und die steht schon in `dice.ts`.

Gewürfelt wird aus demselben `rng` wie alles andere. Der Auftakt verbraucht damit
Zufall, den die Partie sonst später gezogen hätte — das ist unproblematisch,
solange es aus dem Seed folgt, und `replay` reproduziert es. Ein zweiter
Zufallsstrom nur für den Auftakt wäre die Sorte zweite Wahrheit, die `setup.ts:71`
für Stapel und RNG ausdrücklich vermeidet.

### 4. Die Rotation färbt niemanden um

Das ist die Stelle, an der dieser Entwurf ein Bumerang sein könnte, und sie ist
nachgesehen: Farbe und Name hängen am `Seat`, und der wird über `seatsById`
(`apps/client/src/seats.ts`) **per Id** nachgeschlagen, nicht über den Index in
`state.players`. Der Server vergibt die Farben ebenso beim Beitritt und nicht aus
der Spielerliste des Zustands.

Nach der Rotation ist `players` also weiter die Zugreihenfolge — und genau das
ist ihre dokumentierte Bedeutung („Die Spieler in Zugreihenfolge", `state.ts`) —
während Farbe, Name und Platz im Wartebereich unverändert an der Id kleben.

Die Reihenfolge im Wartebereich und die Zugreihenfolge fallen damit auseinander,
sobald gewürfelt wurde. Das ist gewollt und der sichtbare Sinn der Sache; die
Spielerliste auf dem Spielbildschirm zeigt ohnehin die Zugreihenfolge.

### 5. Was die Oberfläche zeigt

Eine **Auftakttafel** über dem Brett, solange `view.phase.kind === 'opening'`:
die Mitspieler in Sitzreihenfolge, je Zeile die gefallene Summe, ein Fehlen für
die, die noch nicht geworfen haben, und eine Marke am Werfer. Darüber fliegen die
Würfel wie im Spiel.

Der Würfelknopf ist der vorhandene: `legalActions` liefert in `opening` ein
`rollDice` für `pending[0]`, und `ActionPanel` zeigt, was legal ist. In der
lokalen Partie folgt die Sicht dem Handelnden ohne Zutun — `useLocalGame`
begründet das schon so: „Es gilt die Sicht dessen, der handeln darf."

`log.ts:60` (`case 'rollDice'`) bekommt einen Zweig: im Auftakt heißt der Satz
nicht „würfelt eine 9 und erntet", sondern nennt Wurf und, wenn die Runde
vollständig ist, das Ergebnis samt Stechen. Der Klang ist derselbe Würfelklang.

### 6. Server und Protokoll: nichts

`playerView.ts:177` gibt `phase: state.phase` als Ganzes weiter. Die Auftakttafel
bekommt ihre Daten damit ohne eine neue Zeile im Protokoll, und die geheime
Hälfte bleibt geheim — `rolls` sind öffentlich, sie liegen auf dem Tisch.

Im Server ändert sich nur, daß eine frisch erzeugte Partie in `opening` statt in
`setup` startet, und das erledigt `createGame`. `room.ts:281` bleibt, wie es ist.

### 7. Keine Frist

Wer nicht wirft, blockiert die Partie. Das ist heute in der Gründungsphase genauso
und wird hier nicht gelöst: `deadlineOf` (`game/deadline.ts`) kennt allein
`tradePending`, und eine zweite Fristenart ist ein eigener Entwurf. Der Kommentar
dort sagt, wo sie hinkäme („ein zweites Zeitlimit ergänzt hier einen Zweig und
sonst nichts") — sie kommt jetzt nur nicht.

## Was daran neu ist und was nicht

| Bauteil                      | Gibt es schon als            |
| ---------------------------- | ---------------------------- |
| Phase mit Warteschlange      | `discardPending`             |
| Mehrere handeln nacheinander | `setupPlayerIndex`, Schlange |
| Wurf aus dem Zustand         | `rollAll`, `lastRoll`        |
| Wurf auf dem Brett zeigen    | `useSettledRoll`, `DiceTray` |
| Phase reist zum Client       | `playerView.ts:177`          |
| Aktion je Phase erlaubt      | `PHASE_ACTIONS`              |

**Wirklich neu ist ein Ding:** eine Aktion, deren Bedeutung von der Phase
abhängt. Alles übrige ist eine zweite Anwendung von etwas, das schon steht.

## Reihenfolge

1. **`shared`** — `opening` in `phase.ts`, `opening.ts` mit `applyOpeningRoll`,
   der Zweig in `applyAction`, `actorFor`, `PHASE_ACTIONS`, `legalActions`,
   `createGame`. Mit Tests, wie jede neue Logik in `shared`.
2. **`log.ts`** — der Zweig im Verlaufssatz.
3. **Client** — die Auftakttafel, und der Zweig in `situation`/`labels`, damit
   der Statussatz nicht „Gründung" sagt, während gewürfelt wird.

Schritt 1 trägt alles Weitere: solange die Phase nicht steht, hätte jeder
Bildschirm darüber eine eigene Auslegung, und der Client kennt keine Regel.

Die Tests, die den Entwurf halten müssen: die Reihenfolge (jeder wirft genau
einmal, und nur der Vorderste in `pending` darf), das Stechen (nur die Gleichen,
und es endet), die Rotation (Sieger auf Index 0, und niemandes Farbe wandert),
die Sperre (kein `placeSetupSettlement` in `opening`), die Bestimmtheit (derselbe
Seed, dieselbe Reihenfolge) und `playerView` (kein `rng` im Auftakt).

## Was dieser Entwurf offenläßt

- **Die Frist.** Siehe 7. Wer im Auftakt weggeht, hält die Partie an.
- **Der Auftakt in gespeicherten Partien.** Ein Zustand aus der Datenbank, der
  vor dieser Änderung entstanden ist, kennt `opening` nicht — er steht in `setup`
  oder weiter und läuft normal weiter. Nur die Zod-Schemata müssen die neue
  Phase kennen, ehe ein neuer Zustand geschrieben wird; eine Wanderung alter
  Zustände braucht es nicht.
- **Ob der Sieger etwas anderes gewinnt als den ersten Zug.** In manchen
  Varianten darf er stattdessen die Sitzordnung wählen. Nicht hier.
