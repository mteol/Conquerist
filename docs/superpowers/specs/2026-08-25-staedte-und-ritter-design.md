# Städte & Ritter — Entwurf

**Stand:** 25.08.2026 · Branch `etappe-10-staedte-und-ritter` · aufgesetzt auf `5c0a713`

Die Regeln stehen in `docs/regeln-staedte-und-ritter.md` und werden hier nicht
wiederholt. Dieses Dokument sagt, **wie** sie in dieses Programm kommen: welche
Typen, welche Zustandsfelder, welche Aktionen, welche Module, welche Bildsprache
— und in welcher Reihenfolge.

Umgesetzt wird in fünf Etappen (10a bis 10e, Abschnitt 9). Der Zustand wird
einmal hier entworfen und nicht fünfmal nachgebessert; die Etappen füllen ihn.

---

## 1. Leitentscheidungen

Fünf Entscheidungen tragen den Rest. Sie stehen hier mit ihrem Grund, weil
später im Code nur noch das Ergebnis steht.

### 1.1 Handelswaren sind Karten, nicht Rohstoffe — und nicht ein zweiter Vorrat

Handelswaren verhalten sich in fast allem wie Rohstoffe: sie liegen auf der
Hand, zählen beim Abwerfen nach einer 7 mit, werden vom Räuber gestohlen,
werden gehandelt, werden von Großhändler und Sabotage getroffen. Sie
unterscheiden sich in wenigem, aber Scharfem: sie bezahlen **nie** ein Bauwerk,
sie entstehen **nur** an Städten und nur an drei Landschaften, das Aquädukt gibt
sie **nicht** her, und es gibt **keinen** 2:1-Hafen für sie.

Ein zweiter Mengensatz neben `ResourceAmounts` müßte jede Handoperation
doppelt führen — Abwerfen, Stehlen, Kartenzahl, Angebot, Gegenangebot,
Bankhandel. Das wären zwei Wahrheiten über dieselbe Hand.

Deshalb: **ein Mengensatz, zwei Id-Typen.**

```ts
// scenario/terrain.ts
export const RESOURCE_IDS = ['brick', 'lumber', 'wool', 'grain', 'ore'] as const;
export const COMMODITY_IDS = ['paper', 'cloth', 'coin'] as const;
export const CARD_IDS = [...RESOURCE_IDS, ...COMMODITY_IDS] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];
export type CommodityId = (typeof COMMODITY_IDS)[number];
export type CardId = (typeof CARD_IDS)[number];

/** Welche Handelsware eine Stadt an diesem Gelände zusätzlich abwirft. */
export const TERRAIN_COMMODITY: Readonly<Record<TerrainId, CommodityId | null>> = {
  forest: 'paper',
  pasture: 'cloth',
  mountains: 'coin',
  hills: null,
  fields: null,
  desert: null,
};
```

`ResourceId` bleibt unverändert der enge Typ. Baukosten, Häfen,
`TERRAIN_YIELD`, `playYearOfPlenty`, das Rohstoffmonopol und das Aquädukt
behalten ihn und bleiben damit compilergeschützt: „hier darf keine Handelsware
stehen" ist eine Typaussage und keine Prüfung zur Laufzeit.

`ResourceAmounts` wird zu **`CardAmounts`**, Schlüssel `CardId`. Der Rename ist
mechanisch (29 Dateien, 115 Stellen, der Compiler führt ihn) und macht die
Namen wahr: ein achtstelliger Record namens „Ressourcen" wäre genau die zweite
Wahrheit, die `terrain.ts` im Kopfkommentar schon ausschließt.

Betroffene Umbenennungen:

| alt                                                     | neu                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ResourceAmounts` / `ResourceAmountsSchema`             | `CardAmounts` / `CardAmountsSchema`                                                                      |
| `EMPTY_RESOURCES`                                       | `EMPTY_CARDS`                                                                                            |
| `addResources` / `subtractResources` / `scaleResources` | `addCards` / `subtractCards` / `scaleCards`                                                              |
| `countResources`                                        | `countCards` — **Namenskollision** mit `development.ts#countCards`; jene wird zu `countDevelopmentCards` |
| `resourceAt`                                            | `cardAt`                                                                                                 |
| `canAfford`                                             | bleibt (Kosten sind weiter `CardAmounts`, faktisch nur Rohstoffe)                                        |

`game/resources.ts` heißt danach `game/cards.ts`.

### 1.2 Welche Kartensorten im Spiel sind, ist Daten

`CARD_IDS` hat acht Einträge, das Basisspiel kennt fünf. Ohne eine Angabe
zeigte das Handpanel dort drei leere Stapel und `legalActions` böte 64 statt 25
Bankgeschäfte an.

`RuleSet` bekommt deshalb:

```ts
/** Welche Kartensorten an diesem Tisch im Spiel sind. */
cards: z.array(CardIdSchema).min(1).default([...RESOURCE_IDS]),
```

Gelesen von `HandPanel`, dem Abwurfdialog, dem Angebotsdialog, `legalActions`
(Bankhandel) und `labels.resourceList`. Das Basisspiel bleibt dadurch
unverändert, ohne eine Zeile Sonderfall.

Nicht abgeleitet aus `resourceBank`: ein Vorrat darf mitten in der Partie auf
Null fallen, und eine Sorte verschwände dann aus der Bedienung.

### 1.3 Fehlende Schlüssel in gespeicherten Partien müssen aufgefüllt werden

Seit Etappe 6 liegt der **Startzustand** einer Partie als JSON in der Datenbank;
der Rest entsteht per `replay`. Diese Startzustände tragen fünfstellige
Mengensätze. Nach 1.1 rechnet `subtractCards` dort mit `undefined`, und
`undefined - 0` ist `NaN` — lautlos, sichtbar erst Runden später als unmögliche
Handkartenzahl.

`CardAmountsSchema` bekommt deshalb ein `.transform`, das jede fehlende Sorte
mit `0` ergänzt:

```ts
export const CardAmountsSchema = z
  .record(CardIdSchema, z.number().int().min(0))
  .transform((amounts) => {
    const full = {} as CardAmounts;
    for (const card of CARD_IDS) full[card] = amounts[card] ?? 0;
    return full;
  });
```

Das ist zugleich der Schutz für jede spätere Sorte. Ein Test lädt einen
fünfstelligen Mengensatz und prüft die acht Schlüssel.

**Kein Migrationsschritt in der Datenbank.** Das Schema der Tabellen ändert
sich nicht; es ändert sich, wie der Inhalt gelesen wird. `MIGRATIONS` bleibt bei
drei Schritten.

### 1.4 Der Ereigniswürfel fällt in der Schale, seine Bedeutung liegt woanders

`rules/dice.ts` schließt im Kopfkommentar ausdrücklich aus, daß dort steht, was
ein Würfel _auslöst_. Daran halten wir uns:

- `rules/cities.ts` bringt `CITIES_DICE` mit — dieselben zwei Augenwürfel plus
  `{ id: 'event', faces: 6, countsTowardYield: false, render: 'event' }`.
- `game/cities/event.ts` sagt, was die sechs Seiten bedeuten.

`DieSpec` bekommt genau ein neues Feld:

```ts
/** Wie die Oberfläche eine Seite zeigt. Augen oder Symbole. */
render: z.enum(['pips', 'event']).default('pips'),
```

Ein Feld und keine Fallunterscheidung nach Id: `DiceTray` fragt die Daten, nicht
den Namen. Sechs Augen zu malen, wo ein Schiff gehört, wäre schlimmer als gar
kein Bild.

Der **rote** Würfel ist einer der beiden zählenden, benannt über seine Id
(`'second'`). Keine dritte Würfel-Id und keine Umbenennung: gespeicherte Würfe
tragen `die: 'first' | 'second'`, und `yieldTotal` überliest ohnehin, was die
Schale nicht kennt.

```ts
// game/cities/event.ts
export const EVENT_DIE = 'event';
export const PROGRESS_DIE = 'second';

export type EventFace = 'ship' | 'trade' | 'politics' | 'science';

/** Seite 1 bis 6 des Ereigniswürfels. Drei Schiffe, drei Stadttore. */
export const EVENT_FACES: readonly EventFace[] = [
  'ship',
  'ship',
  'ship',
  'trade',
  'politics',
  'science',
];
```

### 1.5 Zwei Kartensysteme, nicht ein verallgemeinertes

Fortschrittskarten ersetzen Entwicklungskarten **im Regelwerk**, nicht im Code.
Sie unterscheiden sich in allem außer der Tatsache, daß sie verdeckt auf der
Hand liegen: gekauft gegen erwürfelt, ein Stapel gegen drei, eine je Zug gegen
beliebig viele, Rundensperre gegen keine, Handlimit 0 gegen 4.

Beide in einen Typ zu zwingen spart eine Datei und kostet jede Regel darin. Also:
`PlayerState` trägt `developmentCards` **und** `progressCards`, und das RuleSet
bestimmt, welches System läuft (`developmentDeck` gesetzt gegen `progressDecks`
gesetzt). In einer Städte-&-Ritter-Partie ist `developmentCards` immer leer und
`deck` immer `[]` — und `buyDevelopmentCard` ist dort schon deshalb unmöglich,
weil `buildCosts.developmentCard` fehlt.

Was sie **teilen**, ist die Gestaltung: Kartenkörper, Motivhandschrift und die
Plakette am Tisch. Siehe 8.3.

---

## 2. Der Zustand

Alle neuen Felder tragen einen Vorgabewert, damit gespeicherte Basispartien
weiter parsen — dieselbe Bauform und derselbe Grund wie bei `rollTally`.

### 2.1 `GameState`

```ts
/** Kreuzungs-Id -> welcher Ritter darauf steht. */
knights: z.record(z.string(), KnightSchema).default({}),

/** Das Barbarenschiff. `null` heißt: ohne Erweiterung. */
barbarians: BarbarianStateSchema.nullable().default(null),

/** Die Händlerfigur. `null`, solange keine Karte „Händler" gespielt wurde. */
merchant: z.object({ hex: z.string(), owner: PlayerIdSchema }).nullable().default(null),

/** Die drei Fortschrittsstapel, von oben nach unten. **Geheim** wie `deck`. */
progressDecks: z.record(TrackIdSchema, z.array(ProgressCardIdSchema)).default({}),
```

```ts
export const KnightSchema = z.object({
  owner: PlayerIdSchema,
  /** 1 Einfacher, 2 Starker, 3 Mächtiger Ritter — zugleich seine Stärke. */
  level: z.number().int().min(1).max(3),
  /** Trägt er einen Helm? */
  active: z.boolean(),
  /**
   * In welchem Zug er aktiviert wurde. `null`, solange er passiv ist.
   *
   * Ohne diese Zahl ist die Regel „frühestens im nächsten Zug" nicht prüfbar:
   * ein Ritter, der eben aktiviert wurde, sieht sonst aus wie einer, der seit
   * drei Runden bereitsteht.
   */
  activatedOnTurn: z.number().int().min(0).nullable(),
  /**
   * Ob er in diesem Zug schon aufgewertet wurde. Ein Ritter darf je Zug nur
   * einmal steigen; `endTurn` setzt das zurück.
   */
  upgradedThisTurn: z.boolean(),
});

export const BarbarianStateSchema = z.object({
  /** 0 bis `trackLength`. Bei `trackLength` landen sie. */
  position: z.number().int().min(0),
  /** Wie oft sie schon gelandet sind. `0` sperrt den Räuber. */
  attacks: z.number().int().min(0),
});
```

**Warum Ritter im `GameState` und nicht beim Spieler:** sie stehen auf
Kreuzungen, genau wie Siedlungen und Städte. Die Belegung des Bretts steht
einmal in `buildings`, `roads` und künftig `knights` und nirgends sonst — sonst
gäbe es zwei Wahrheiten darüber, wer wo steht, und die liefen bei der ersten
Vertreibung auseinander.

**Warum `activatedOnTurn` und nicht ein Flag „darf handeln":** ein abgeleiteter
Wert, den man speichert, ist ein Wert, den man nachzuziehen vergißt. Die Zahl
steht, die Regel rechnet.

### 2.2 `PlayerState`

```ts
/** Erreichte Ausbaustufe je Bereich, 0 bis 5. **Öffentlich.** */
improvements: z.record(TrackIdSchema, z.number().int().min(0).max(5)).default({}),

/** Fortschrittskarten auf der Hand. Geheim — außer den Siegpunktkarten. */
progressCards: z.array(ProgressCardSchema).default([]),

/** Siegpunkt-Chips „Retter Catans". Öffentlich. */
defenderPoints: z.number().int().min(0).default(0),
```

Die Ausbaustufen sind **öffentlich** und stehen deshalb auch in der
`PlayerView` jedes Mitspielers. Die Anleitung sagt es selbst: „solltest du die
Fortschritt-Tableaus der anderen im Auge behalten." Wer sie nicht sieht, sieht
die Metropole nicht kommen — und die Metropole ist der halbe Wettlauf.

### 2.3 `Building`

```ts
export const BuildingSchema = z.object({
  owner: PlayerIdSchema,
  kind: z.enum(BUILDING_KINDS),
  /** Stadtmauer unter dieser Stadt. */
  wall: z.boolean().default(false),
  /** Metropolenaufsatz auf dieser Stadt, mit seinem Bereich. */
  metropolis: TrackIdSchema.nullable().default(null),
});
```

Mauer und Aufsatz gehören **einer bestimmten Stadt**, nicht einem Spieler. Nur
so fällt die Mauer beim Barbarenüberfall mit der richtigen Stadt, und nur so ist
„die Metropole ist geschützt" eine Frage an das Gebäude statt eine Rechnung über
den Spieler.

### 2.4 Was **nicht** in den Zustand kommt

- **Siegpunkte.** Weiter gerechnet, nicht gespeichert (`scoring.ts`). Metropole,
  Händler und Retter-Chips kommen dort als Summanden dazu.
- **Die Stärke der Barbaren.** Das ist die Anzahl der Städte auf dem Brett und
  damit ableitbar. Eine gespeicherte Zahl liefe beim ersten Überfall auseinander.
- **Die Stärke der Ritter Catans.** Summe über `knights` mit `active`.
- **Wer welche Metropole hält.** Steht am Gebäude (2.3). Eine zweite Tabelle
  `metropolis: Record<Track, PlayerId>` wäre genau die zweite Wahrheit.
- **Ob der Räuber frei ist.** Folgt aus `barbarians.attacks > 0`.

---

## 3. Die Regelwerke

`rules/cities.ts`:

```ts
export const CITIES_DICE: DiceSpec = [
  { id: 'first', faces: 6, countsTowardYield: true, render: 'pips' },
  { id: 'second', faces: 6, countsTowardYield: true, render: 'pips' },
  { id: 'event', faces: 6, countsTowardYield: false, render: 'event' },
];

export const CITIES_RULES: RuleSet = {
  id: 'cities',
  cards: [...CARD_IDS],
  buildCosts: {
    road:       { brick: 1, lumber: 1 },
    settlement: { brick: 1, lumber: 1, wool: 1, grain: 1 },
    city:       { grain: 2, ore: 3 },
    wall:       { brick: 2 },
    knight:     { wool: 1, ore: 1 },
    knightUpgrade: { wool: 1, ore: 1 },
    knightActivation: { grain: 1 },
    // developmentCard fehlt — es gibt sie nicht mehr.
  },
  pieceStock: { road: 15, settlement: 5, city: 4, wall: 3, knight1: 2, knight2: 2, knight3: 2 },
  resourceBank: { brick: 19, …, paper: 12, cloth: 12, coin: 12 },
  victoryPointGoal: 13,
  victoryPoints: {
    settlement: 1, city: 2, longestRoad: 2,
    largestArmy: 0,        // es gibt sie nicht
    developmentCard: 0,    // es gibt sie nicht
    metropolis: 2, merchant: 1, defender: 1, progressCard: 1,
  },
  handLimitBeforeDiscard: 7,
  handLimitPerWall: 2,
  progressHandLimit: 4,
  progressDecks: { trade: {…}, politics: {…}, science: {…} },
  barbarianTrack: 7,
  castleTurns: false,
  dice: CITIES_DICE,
  robberRoll: 7,
};

export const CITIES_RULES_56: RuleSet = {
  ...CITIES_RULES,
  resourceBank: { …, paper: 18, cloth: 18, coin: 18 },
  castleTurns: true,   // Burg 1 / Burg 2, siehe 7
};
```

**Nur zwei Zeilen weichen am großen Tisch ab, und das ist richtig gemessen:**
die 5–6-Ergänzung bringt 12 weitere Ritter, 12 Helme und 6 Mauern — verteilt auf
**zwei zusätzliche Personen**, also je Person unverändert 6 Ritter und 3 Mauern.
`pieceStock` ist je Spieler gezählt und bleibt deshalb gleich. Zusätzliche
Fortschrittskarten bringt die Ergänzung ausdrücklich keine. Es bleiben der
Vorrat an Handelswaren (12 → 18 je Sorte) und die Zugweitergabe. Ein Test
bewacht diese Gleichheit, wie er es für `CLASSIC_RULES_56` schon tut.

`BUILDABLE_IDS` wächst um `wall`, `knight`, `knightUpgrade`, `knightActivation`.
`PIECE_IDS` wächst um `wall`, `knight1`, `knight2`, `knight3` — je Stufe ein
eigener Vorrat, denn die Regel begrenzt **je Stufe** auf zwei, nicht insgesamt
auf sechs.

**Aufwerten verschiebt zwischen den drei Rittervorräten**, es verbraucht nicht:
ein Einfacher Ritter, der Starker wird, gibt `knight1` zurück und nimmt
`knight2`. Wer schon zwei Starke Ritter stehen hat, kann deshalb nicht
aufwerten — und genau das ist die Regel. Ein einziger Zähler `knight: 6` könnte
sie nicht ausdrücken.

`victoryPoints.largestArmy: 0` statt eines gestrichenen Feldes: das Feld ist
Pflicht im Schema, und eine Null sagt „gibt es hier nicht" ohne einen zweiten
Codepfad. `recomputeLargestArmy` läuft weiter und findet nie einen Halter, weil
niemand Ritterkarten spielt.

`rulesFor(seatCount)` bekommt eine Schwester `citiesRulesFor(seatCount)`; welches
der beiden Paare gilt, entscheidet die Auswahl im Wartebereich (siehe 8.6).

---

## 4. Die Bereiche

```ts
// game/cities/tracks.ts
export const TRACK_IDS = ['trade', 'politics', 'science'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

/** Womit ein Bereich bezahlt wird. */
export const TRACK_COMMODITY: Readonly<Record<TrackId, CommodityId>> = {
  trade: 'cloth',
  politics: 'coin',
  science: 'paper',
};

/** Die fünf Stufen je Bereich, von 1 bis 5. */
export const TRACK_STEPS: Readonly<Record<TrackId, readonly string[]>> = {
  science: ['Schule', 'Bibliothek', 'Aquädukt', 'Theater', 'Universität'],
  trade: ['Markt', 'Zunft', 'Gilde', 'Bank', 'Handelszentrum'],
  politics: ['Rathaus', 'Botschaft', 'Festung', 'Gericht', 'Rat Catans'],
};

/** Die n-te Stufe kostet n Handelswaren ihrer Sorte. */
export function improvementCost(track: TrackId, level: number): CardAmounts;

/** Ab welcher roten Augenzahl abwärts eine Fortschrittskarte fällt: Stufe + 1. */
export function progressThreshold(level: number): number {
  return level + 1;
}
```

Die Stufennamen stehen in `shared`, nicht im Client: der Server baut den
Verlaufssatz („hat die Gilde gebaut"), und zwei Namenslisten liefen auseinander.
Die **Farben** bleiben wie gehabt im Client neben `index.css`.

Der Zusatznutzen ab Stufe 3 ist kein Zustandsfeld, sondern eine Frage an die
Stufe:

```ts
export function hasAqueduct(player: PlayerState): boolean; // science >= 3
export function hasGuild(player: PlayerState): boolean; // trade   >= 3
export function hasFortress(player: PlayerState): boolean; // politics >= 3
```

---

## 5. Neue Zugarten

### 5.1 Flach in `GameActionSchema`

| Aktion                 | Nutzlast                 | Phase                                |
| ---------------------- | ------------------------ | ------------------------------------ |
| `buildWall`            | `vertex`                 | `main`                               |
| `buildKnight`          | `vertex`                 | `main`                               |
| `activateKnight`       | `vertex`                 | `main`                               |
| `upgradeKnight`        | `vertex`                 | `main`                               |
| `moveKnight`           | `from`, `to`             | `main`                               |
| `chaseRobber`          | `vertex`                 | `main`                               |
| `improveCity`          | `track`, `metropolisAt?` | `main`                               |
| `placeDisplacedKnight` | `vertex`                 | `displacePending`                    |
| `pickProgressDeck`     | `track`                  | `defenderPending`                    |
| `discardProgressCard`  | `card`                   | `progressDiscardPending`             |
| `playProgress`         | `card: ProgressPlay`     | `main`, `rollPending` (nur Alchemie) |

**`moveKnight` deckt das Vertreiben mit ab.** Ziel frei heißt versetzen, Ziel
von einem schwächeren fremden Ritter besetzt heißt vertreiben. Zwei Aktionen für
denselben Zug (ein Ritter zieht auf eine Kreuzung) wären zwei Regelauslegungen
darüber, wohin er ziehen darf.

**`improveCity` trägt die Metropole mit.** `metropolisAt` ist genau dann
**Pflicht**, wenn dieser Ausbau die Metropole des Bereichs **einbringt** — also
Stufe 4 bei noch unvergebener Metropole, oder Stufe 5, während sie jemand hält,
der selbst nicht auf Stufe 5 steht. Angegeben wird eine eigene Stadt ohne
Aufsatz. In jedem anderen Fall muß das Feld fehlen.

Ein nachgelagerter zweiter Zug wäre eine Phase für eine Entscheidung, die sich
nicht aufschieben läßt — und ein optionales Feld, das mal Pflicht und mal
verboten ist, gehört in `canImproveCity` und nicht in den Kopf des Aufrufers.

**Eine Regelstelle, die wir auslegen müssen:** die Anleitung sagt, wer nur eine
Stadt hat und die schon Metropole ist, komme in den anderen Bereichen nur bis
Stufe 3. Sie sagt nicht, ob das auch gilt, wenn die Metropole des Bereichs
längst einer anderen Person gehört und Stufe 4 also gar keinen Aufsatz
einbringt. Wir legen es so aus: **die freie Stadt ist nur nötig, wenn der
Aufsatz auch wirklich kommt.** Alles andere würde jemanden für den Wettlauf
bestrafen, den er ohnehin schon verloren hat. Steht als bewußte Abweichung im
`PROGRESS.md`-Abschnitt von 10c.

### 5.2 Die Fortschrittskarten als eigene Union

25 Karten als 25 Einträge in `GameActionSchema` würden die Hauptunion
verdoppeln und die Erweiterung über die Datei verteilen. Stattdessen:

```ts
// game/cities/progress/play.ts
export const ProgressPlaySchema = z.discriminatedUnion('card', [
  z.object({ card: z.literal('alchemist'), first: Die, second: Die }),
  z.object({ card: z.literal('crane'), track: TrackIdSchema }),
  z.object({ card: z.literal('inventor'), a: z.string(), b: z.string() }),
  z.object({ card: z.literal('merchant'), hex: z.string() }),
  z.object({ card: z.literal('resourceMonopoly'), resource: ResourceIdSchema }),
  z.object({ card: z.literal('commodityMonopoly'), commodity: CommodityIdSchema }),
  z.object({ card: z.literal('masterMerchant'), victim: PlayerIdSchema }),
  z.object({ card: z.literal('spy'), victim: PlayerIdSchema }),
  …
]);

// actions.ts
z.object({ ...Base, type: z.literal('playProgress'), play: ProgressPlaySchema }),
```

`reduce` bekommt **einen** Zweig `playProgress` und gibt an
`game/cities/progress/progressRules.ts` ab — dieselbe Grenze wie bei
`developmentRules.ts`.

### 5.3 Neue Phasen

```
displacePending        { owner, level, active, from }   -> placeDisplacedKnight
defenderPending        { pending: PlayerId[] }          -> pickProgressDeck
progressDiscardPending { pending: PlayerId[] }          -> discardProgressCard
```

- **`displacePending`** — den vertriebenen Ritter setzt _sein Besitzer_ um, nicht
  der Angreifer. Gibt es keine freie Kreuzung im eigenen Netz, entfällt die
  Phase und der Ritter kommt vom Brett.
- **`defenderPending`** — bei Gleichstand nach einem gewonnenen Barbarenkampf
  zieht jeder Beteiligte von einem **beliebigen** Stapel. Eine Wahl, also eine
  Phase, mit derselben `pending`-Bauform wie `discardPending`.
- **`progressDiscardPending`** — wer außerhalb seines Zuges eine fünfte
  Fortschrittskarte zieht, gibt eine ab. Eine Wahl, also eine Phase. Am Zug ist
  es keine: dort muß sofort **gespielt** werden, und das kann der Spieler in
  `main` ohnehin.

**Sieben Fortschrittskarten verlangen eine Entscheidung von jemand anderem.**
Das ist beim Durchsehen des Entwurfs aufgefallen und ist die eigentliche
Schwierigkeit von 10d — nicht die Zahl der Karten, sondern daß ein Teil von
ihnen den Zug anhält und auf fremde Eingaben wartet. Es ist derselbe Fall wie
`discardPending` und `tradePending`, und er bekommt dieselbe Bauform:

| Karte        | wer entscheidet                                           | was                            |
| ------------ | --------------------------------------------------------- | ------------------------------ |
| Großhändler  | der Spielende, **nachdem** er die fremde Hand gesehen hat | 2 Karten wählen                |
| Spionage     | der Spielende, nachdem er die fremden Karten gesehen hat  | 1 Karte wählen                 |
| Deserteur    | das Opfer                                                 | welcher Ritter fällt           |
| Handelshafen | jede andere Person                                        | welche Handelsware sie hergibt |
| Hochzeit     | jede Person mit mehr Punkten                              | welche 2 Karten sie schenkt    |
| Sabotage     | jede Betroffene                                           | welche Hälfte sie abwirft      |
| Intrige      | der Besitzer des vertriebenen Ritters                     | wohin er ausweicht             |

Zwei davon brauchen **nichts Neues**: Sabotage benutzt `discardPending`, Intrige
benutzt `displacePending` aus 10b. Die übrigen fünf teilen sich **eine** Phase,
weil sie dieselbe Form haben — eine Warteliste und eine Antwort je Person:

```ts
z.object({
  kind: z.literal('progressPending'),
  card: ProgressCardIdSchema,
  /** Wer noch antworten muß. Leer heißt: die Karte ist fertig. */
  pending: z.array(PlayerIdSchema),
  /** Wer die Karte gespielt hat — an ihn geht der Ertrag. */
  by: PlayerIdSchema,
  /** Was schon geantwortet wurde. */
  answers: z.record(z.string(), CardAmountsSchema),
});
```

Beim Großhändler und bei der Spionage steht `pending` auf dem Spielenden selbst,
und die `PlayerView` deckt ihm für die Dauer dieser Phase **genau die eine**
fremde Hand auf. Das ist die einzige Stelle der ganzen Erweiterung, an der die
Geheimhaltungsgrenze aus Regel 4 sich öffnet — sie öffnet sich für eine Person,
für eine Hand, für eine Phase, und `playerViewOf` bekommt dafür einen
ausdrücklichen Zweig mit Test.

Eine Frist bekommen diese Phasen **nicht** — anders als das Angebot. Wer nicht
antwortet, hält den Tisch auf; das ist derselbe offene Punkt wie bei den
Ritterzügen (Abschnitt 11) und wird gemeinsam mit ihnen gelöst oder gar nicht.

### 5.4 Was der Reducer zusätzlich tut

`finalize` bekommt einen dritten Schritt. Heute: Längste Handelsstraße neu
rechnen, Sieg prüfen. Neu davor: **Ritterstärke ist nirgends gespeichert**, also
nichts nachzuziehen — aber die Metropolen wechseln beim `improveCity` und die
Längste Handelsstraße kann durch einen **gesetzten oder vertriebenen Ritter**
brechen. `recomputeLongestRoad` muß Ritter als Unterbrecher kennen; das ist eine
Änderung in `roads.ts` und keine neue Nacharbeit.

Der Wurf selbst wird länger. `rollDice` heißt künftig sinngemäß:

```
1. würfeln, Wurf und Zählung festhalten
2. Ereigniswürfel auswerten
   ship  -> Schiff vorrücken; bei Ankunft: Barbarenkampf (kann Städte kosten,
            kann `defenderPending` öffnen), Schiff zurücksetzen, attacks + 1
   Tor   -> alle Berechtigten im Uhrzeigersinn ziehen lassen
3. Ertragsphase wie bisher, mit 1+1 an Städten (7 -> abwerfen/Räuber)
4. Aquädukt: wer leer ausging und Stufe 3 Wissenschaft hat, nimmt einen Rohstoff
```

Die Reihenfolge ist die der Anleitung und sie ist nicht beliebig: der
Barbarenangriff kommt **vor** dem Ertrag, und genau daran hängt, daß in der
Runde des ersten Angriffs eine gewürfelte 7 den Räuber schon bewegen darf.

Ausgelagert nach `game/cities/turn.ts` als `resolveEvent(state, roll)` — der
Reducer bleibt der, der Phase und Absender prüft, und die Auswertung liegt bei
der Erweiterung.

---

## 6. Modulschnitt

```
packages/shared/src/
  scenario/terrain.ts        + COMMODITY_IDS, CARD_IDS, TERRAIN_COMMODITY
  rules/dice.ts              + DieSpec.render
  rules/ruleset.ts           + cards, neue Buildables/Pieces/victoryPoints-Felder
  rules/cities.ts            CITIES_RULES, CITIES_RULES_56, CITIES_DICE
  game/cards.ts              (war resources.ts) — Mengenrechnung über CardId
  game/setup.ts              zweite Setzung ist eine Stadt, Startertrag von ihr
  game/yield.ts              Stadtertrag 1 Rohstoff + 1 Handelsware
  game/roads.ts              Ritter unterbrechen die Längste Handelsstraße
  game/robber.ts             Sperre bis zum ersten Überfall, Mauern im Limit
  game/trade.ts              Bank- und Hafenhandel über CardId, Gilde 2:1
  game/scoring.ts            Metropole, Händler, Retter-Chips als Summanden
  game/cities/
    event.ts                 Ereigniswürfel: Seiten und ihre Bedeutung
    turn.ts                  resolveEvent — die Auswertung eines Wurfs
    commodities.ts           Stadtertrag 1+1, Handelswaren-Hilfen
    walls.ts                 canBuildWall / applyBuildWall, Handkartenlimit
    knights.ts               Ritter bauen / aktivieren / aufwerten
    knightActions.ts         versetzen / vertreiben / Räuber vertreiben
    barbarians.ts            Fahrstrecke, Stärkerechnung, Überfall
    tracks.ts                Bereiche, Stufen, Kosten, Schwellen
    improvements.ts          canImproveCity / applyImproveCity, Metropolen
    merchant.ts              Händlerfigur, 2:1 und Siegpunkt
    progress/
      cards.ts               Ids, Stapelzusammensetzung, Handlimit
      play.ts                ProgressPlaySchema
      draw.ts                Ziehbedingung am roten Würfel, Reihenfolge
      progressRules.ts       canPlayProgress / applyPlayProgress (Verteiler)
      science.ts trade.ts politics.ts   die Wirkungen, je Stapel eine Datei
```

Regeln liegen weiter je Datei als `can…` (nur prüfen) und `apply…` (prüfen und
anwenden); `legalActions` benutzt dieselben `can…`. Keine Ausnahme für die
Erweiterung — das ist die Regel, die verhindert, daß es zwei Auslegungen gibt.

**Warum ein Unterordner und nicht flach in `game/`:** es sind fünfzehn Dateien.
Flach wäre `game/` danach zur Hälfte Erweiterung, und die Frage „was gehört zu
Städte & Ritter" hätte keine Antwort mehr im Dateisystem.

Im Server ändert sich nichts an der Struktur. `applySystemAction` bekommt keinen
neuen Fall; die neuen Phasen haben keine Fristen. **Offen und bewußt: Ritter- und
Ausbauzüge sind unbefristet** — wer im Ausbau trödelt, hält den Tisch auf.
`deadlineOf` wäre die Stelle, an der eine Zugzeit ansetzt; sie kommt nicht in
dieser Etappenreihe.

---

## 7. Fünf und sechs Personen: Burg 1 / Burg 2

Die Ausgabe 2025 hat die Außerordentliche Bauphase abgeschafft. Statt ihrer
wandern zwei Marker, immer drei Plätze auseinander.

Zwei Felder mit ähnlichem Namen, und sie sind nicht dasselbe: `RuleSet.castleTurns`
sagt, **ob** an diesem Tisch mit den Marken gespielt wird; `GameState.castles`
sagt, **wo sie gerade liegen**.

```ts
// GameState
castles: z.object({
  /** Index in `players`. Wer den vollen Zug spielt. */
  first: z.number().int().min(0),
  /** Index in `players`. Wer den angepaßten Zug spielt. */
  second: z.number().int().min(0),
}).nullable().default(null),
```

`currentPlayerIndex` bleibt, was er ist: wer **gerade** handeln darf. `castles`
sagt, welcher der beiden Züge das ist:

- `currentPlayerIndex === castles.first` → voller Zug (würfeln, mit allen
  handeln, alles bauen).
- `currentPlayerIndex === castles.second` → angepaßter Zug: **kein Wurf**, Handel
  **nur mit der Bank**, kein `offerTrade`, keine Alchemie; bauen, Ritteraktionen,
  Stadtausbau und Fortschrittskarten wie sonst.

`endTurn` schaltet: nach Burg 1 auf Burg 2 desselben Zugs, nach Burg 2 beide
Marker eins nach links und zurück auf `rollPending`.

Das ist **ein Feld und zwei Zweige in `PHASE_ACTIONS`**, keine zweite
Phasenschleife. Der angepaßte Zug bekommt dafür eine eigene Phase `main` mit
Unterscheidung — konkret: `PHASE_ACTIONS.main` bleibt die volle Liste, und
`applyAction` weist `rollDice`, `offerTrade` und Alchemie ab, wenn der
Handelnde auf Burg 2 sitzt. Eine eigene Phase `mainRestricted` wäre die
Alternative; sie ist ehrlicher gegenüber `legalActions` und wird in der
Umsetzung von 10e entschieden, sobald der Aufwand beider Wege sichtbar ist.

Das Brett ist `classic56` und steht schon.

---

## 8. Oberfläche

Die Designregeln aus `CLAUDE.md` gelten unverändert. Für jede neue Fläche steht
der Dreisatz aus Regel 1 im Etappenplan, nicht hier. Was hier steht, ist die
gemeinsame Bildsprache.

### 8.1 Ritter aufs Brett

In `board/shapes.ts`, im selben Raum wie Siedlung und Stadt (rund 20 Einheiten
breit, um den Nullpunkt), damit die Silhouetten zusammen gelesen werden können.

- **Die Stufe steht als Fähnchenspitzen** — eine, zwei oder drei. So
  unterscheidet das Spiel sie selbst („Die Stärke eines Ritters wird durch die
  Anzahl der Spitzen an der Fahne dargestellt"), und man kann sie **zählen**,
  statt Größen zu vergleichen. Größe ist die schwächste Unterscheidung, die es
  gibt — der Grund, warum die Stadt kein größerer Punkt ist.
- **Aktiv/passiv über den Helm**, nicht über Deckkraft. Ein halbtransparenter
  Ritter liest sich als „gesperrt", nicht als „ruht".
- Farbe ist die Sitzfarbe, per `style` am SVG (die Falle aus `CLAUDE.md`).

### 8.2 Mauer und Metropole an der Stadt

Die Stadtmauer als **Sockel unter** der Stadtsilhouette, der Metropolenaufsatz
als **Aufsatz darauf** in der Bereichsfarbe. Beide sitzen am Gebäude, weil sie
dort hingehören — und der Aufsatz sagt zugleich, welcher Bereich es war.

### 8.3 Handelswarenkarten

Rohstoffkarten sind ganzflächig geländefarben, Motiv als zweiter Träger.
Handelswaren bekommen einen **Pergamentkörper mit geländefarbenem Rand** und ein
eigenes Motiv (Bogen, Ballen, Münzstapel).

Der Grund: Papier kommt aus dem Wald, aber Holz und Papier dürfen nicht gleich
aussehen — man hält beide gleichzeitig auf der Hand und muß sie im Vorbeisehen
unterscheiden. Gleiche Farbe, andere Fläche heißt „vom selben Land, andere Art
von Karte". Farbe ist dabei nie der einzige Träger (Designregel 7): das Motiv
trägt mit, und der Stapel ist beschriftet.

### 8.4 Das Fortschritt-Tableau

**Rolle:** die Stelle, an der man sieht, wo man steht, was der nächste Schritt
kostet und wie hoch die Chance auf eine Karte ist. **Aufbau:** drei Leitern
nebeneinander, je fünf Stufen, in Bereichsfarbe — gebaute Stufen gefüllt, die
nächste als Umriß mit ihrem Preis, der Rest leer. **Woran man sich erinnert:**
die rote Ziffer rechts an jeder Stufe, die man beim Würfeln sucht.

Die Schwelle wird mit `Numerals.tsx` gesetzt — tabellarische Ziffern, weil man
sie ständig mit dem gefallenen roten Würfel vergleicht und keine Ziffer springen
darf. Stufe 3 trägt ihr Wort (Aquädukt / Gilde / Festung), Stufe 4 die
Metropolenform.

Dazu am Tisch je Mitspieler eine **kompakte Dreierleiste 0–5**. Die Stufen sind
öffentlich, und wer sie nicht sieht, sieht die Metropole nicht kommen.

### 8.5 Die Barbarenleiste und der dritte Würfel

Sieben Stationen am Brettrand, das Schiff darauf, daneben zwei Zahlen: Stärke
der Barbaren (Städte auf dem Brett) gegen Stärke der aktivierten Ritter. Das ist
die Spannungsanzeige der ganzen Erweiterung und bekommt einen Platz, keine
Randnotiz. Bewegung erklärt hier einen Zustandswechsel (Regel 5): das Schiff
rückt sichtbar vor, wenn es vorrückt.

Der Ereigniswürfel steht in `DiceTray` neben den beiden anderen und zeigt
**Symbole** — Schiff oder Stadttor in Bereichsfarbe. `render: 'event'` steuert
das aus den Daten.

### 8.6 Auswahl im Wartebereich

Das Regelwerk wird gewählt wie schon das Siegpunktziel: **Basisspiel** oder
**Städte & Ritter**. Die Tischgröße bestimmt danach wie bisher Brett und
Vorräte (`blueprintFor`, `rulesFor` / `citiesRulesFor`). Das Siegpunktziel steht
bei Städte & Ritter auf 13 und bleibt einstellbar.

---

## 9. Die fünf Etappen

Jede Etappe endet mit Abnahme (`typecheck`, `test`, `build`, `format:check`),
einem Abschnitt in `PROGRESS.md` und einem Commit. Jede bekommt vor der
Umsetzung ihren eigenen Plan.

### 10a — Handelswaren und der dritte Würfel

Das Fundament. Kartenmodell (1.1–1.3), `RuleSet.cards`, `CITIES_RULES`,
Ereigniswürfel als Schale und als Bild, Stadtertrag 1+1, Gründung mit Siedlung
und **Stadt**, Startrohstoffe von der Stadt, 13 Siegpunkte, keine
Entwicklungskarten, keine Größte Rittermacht, Bank- und Hafenhandel mit
Handelswaren, Abwerfen und Stehlen zählen sie mit. Client: Handelswarenkarten,
dritter Würfel mit Symbolen, Auswahl im Wartebereich.

**Bewußt noch nicht:** das Schiff fährt, aber der Angriff bleibt aus, und der
Räuber ist frei wie im Basisspiel. Ein Überfall ohne Ritter würde jede Partie in
der ersten Viertelstunde zerlegen. Das steht als offener Punkt in `PROGRESS.md`,
damit es beim nächsten Lesen kein Fehler ist, sondern eine Entscheidung.

### 10b — Ritter und Barbaren

Ritter im Zustand und auf dem Brett, bauen/aktivieren/aufwerten,
versetzen/vertreiben/Räuber vertreiben samt `displacePending`, Ritter als
Straßenunterbrecher in `roads.ts`, Fahrstrecke, Barbarenkampf mit allen
Sonderfällen (nur Städtebesitzer, Metropolen geschützt, Gleichstand,
Ausweichkette), Retter-Chips, `defenderPending`, Stadtmauern samt
Handkartenlimit, Räubersperre bis zum ersten Überfall. Client: Rittersilhouetten,
Mauersockel, Barbarenleiste.

### 10c — Stadtausbau und Metropolen

`improvements`, die drei Bereiche mit ihren fünf Stufen und Kosten, Stufe 3 mit
Aquädukt / Gilde / Festung, Metropolen mit Übergabe bei Stufe 5, die Regel über
die freie Stadt. Client: das Fortschritt-Tableau und die kompakte Leiste am
Tisch.

Die Festung schaltet hier die dritte Ritterstufe frei — der Verweis zeigt nach
hinten auf 10b und nicht nach vorn.

### 10d — Fortschrittskarten

Drei Stapel, Ziehbedingung am roten Würfel, Ziehreihenfolge im Uhrzeigersinn,
Handlimit 4 samt `progressDiscardPending`, die 25 Kartenwirkungen, die
Händlerfigur, Siegpunktkarten offen. Client: drei Stapel, Kartenmotive,
Auswahldialoge.

**Diese Etappe ist die größte**, und ihr Gewicht liegt nicht bei der Zahl der
Karten, sondern bei den sieben, die auf eine fremde Antwort warten (5.3). Wenn
sie zu groß wird, teile ich sie **nicht** an der Stapelgrenze, sondern an dieser:
zuerst die Karten, die im eigenen Zug fertig werden, danach `progressPending`
und die sieben. Die Stapelgrenze wäre eine hübsche Naht durch die falsche
Stelle — sie zerschnitte dreimal dieselbe Phase.

### 10e — Fünf und sechs Personen

Burg 1 / Burg 2 nach Abschnitt 7. Client: sichtbar, wer den vollen und wer den
angepaßten Zug hat, und was im angepaßten Zug fehlt.

---

## 10. Prüfung

- **Jede neue Regeldatei bekommt Tests**, wie es `CLAUDE.md` verlangt.
- **Ein Regressionstest auf das Kartenmodell:** ein fünfstelliger Mengensatz aus
  einer gespeicherten Partie muß acht Schlüssel ergeben (1.3).
- **Ein Test bewacht die Gleichheit** von `CITIES_RULES` und `CITIES_RULES_56`
  in allem außer Vorrat — dieselbe Bauform, die `CLASSIC_RULES_56` schon hat.
- **Ein Integrationstest je Etappe** spielt eine Partie über den Reducer:
  10a bis zum ersten Handelswaren-Ertrag, 10b bis zum ersten Überfall, 10c bis
  zur ersten Metropole, 10d bis zur ersten gespielten Karte, 10e über einen
  vollen Doppelzug.
- **Im Browser nachgesehen** wird je Etappe, nicht am Ende. Der größte offene
  Posten des Projekts ist, daß die Oberfläche seit Etappe 8 nicht angesehen
  wurde; diese Reihe soll ihn nicht vergrößern.

## 11. Offene Punkte

- **Zugzeit.** Ritter- und Ausbauzüge sind unbefristet. `deadlineOf` wäre die
  Stelle; nicht Teil dieser Reihe.
- **Die Variante „mehr Taktik"** (jeder entscheidet, wie viele Ritter er
  einsetzt) ist nicht vorgesehen. Sie wäre eine weitere Phase nach der Landung
  und ein Feld im RuleSet.
- **Seefahrer** ist nicht vorgesehen und in `docs/regeln-staedte-und-ritter.md`
  nur der Vollständigkeit halber vermerkt.
- **`mainRestricted` gegen zwei Zweige in `applyAction`** (Abschnitt 7) wird in
  10e entschieden, nicht hier.
