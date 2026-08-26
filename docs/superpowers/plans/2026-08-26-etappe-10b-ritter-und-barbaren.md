# Etappe 10b — Ritter und Barbaren

> **Für agentische Ausführung:** ERFORDERLICHE UNTER-SKILL: `superpowers:executing-plans`
> (oder `superpowers:subagent-driven-development`). Die Schritte tragen Checkboxen.

**Ziel:** Ritterfiguren auf dem Brett — bauen, aktivieren, aufwerten, versetzen,
vertreiben, den Räuber vertreiben —, Stadtmauern samt erweitertem Handkartenlimit, die
Fahrstrecke bis zur Küste, der Barbarenüberfall mit Retter-Chips und Städteverlust, und
die Räubersperre bis zum ersten Überfall.

**Ansatz:** Ritter stehen wie Siedlungen und Städte in der Brettbelegung
(`GameState.knights`), nicht beim Spieler — es gibt genau eine Wahrheit darüber, wer wo
steht. Die Erweiterung hängt weiterhin an Merkmalen des Regelwerks (`barbarianTrack > 0`,
ein Preis in `buildCosts`) und nicht an seinem Namen; jede neue Regel liegt als
`can…`/`apply…`-Paar in `game/cities/`, und `legalActions` benutzt dieselben `can…`.
Alle neuen Zustandsfelder tragen Vorgabewerte, damit gespeicherte Partien weiter parsen.

**Technik:** TypeScript strict · Zod 4 · Vitest · React 19 + SVG · pnpm-Monorepo

**Spec:** `docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md` (Abschnitte 2,
3, 5, 6, 8.1, 8.2, 8.5, 9)
**Regelquelle:** `docs/regeln-staedte-und-ritter.md` (Abschnitte 6, 7.1–7.4, 9, 10)
**Vorgänger:** Etappe 10a, `PROGRESS.md` ab „Etappe 10a — Handelswaren und der dritte
Würfel"

## Globale Rahmenbedingungen

Diese gelten für **jede** Aufgabe und werden nicht wiederholt:

- **Antworten auf Deutsch, Code und Bezeichner auf Englisch.** Sichtbare Texte deutsch,
  mit Umlauten. Kommentare deutsch, in `shared` und `server` **ohne** Umlaute (bestehende
  Konvention: `ue`, `ae`, `oe`, `ss`); im Client mit Umlauten.
- **`shared` hat keine Runtime-Dependency außer `zod`.**
- **Spiellogik ist pur:** `(state, action) => newState`. Kein `Math.random()`, kein
  `Date.now()`, kein I/O. Zufall nur über den `rng` im Zustand.
- **Jede Regel zweimal:** `can…` prüft nur und gibt `RuleViolation | null`, `apply…`
  prüft und wendet an und gibt `ReduceResult`. `legalActions` benutzt dieselben `can…`.
- **Neue Logik in `shared` bekommt Tests.**
- **Jedes neue Zustandsfeld bekommt einen Vorgabewert** (`.default(…)`), und jeder
  `z.record` mit Enum-Schlüssel, der um Schlüssel wächst, wird zu `z.partialRecord` mit
  auffüllendem `.transform`. Grund: seit Etappe 6 liegt der **Startzustand** jeder Partie
  als JSON in der Datenbank; ein neues Pflichtfeld oder ein neuer Pflichtschlüssel läßt
  beim nächsten Serverstart jede laufende Partie am Schema scheitern.
- **Kein Hex-Wert in einer Komponente.** Farben kommen aus `index.css`-Variablen bzw.
  `apps/client/src/game/labels.ts`. Farben am SVG per `style`, nie als Attribut.
- **Spezifität nachzählen**, wenn eine neue CSS-Regel eine bestehende schlagen soll
  (`CLAUDE.md`, die Falle ist dreimal zugeschnappt).
- **Designregel 5:** Bewegung erklärt einen Zustandswechsel oder entfällt. Bei
  `prefers-reduced-motion` wird nicht animiert **und nicht gewartet**, und
  `animation-delay` gehört negativ in denselben Block wie `animation-duration`.
- **`PROGRESS.md` wird mitgeschrieben**, nicht nachgereicht (Aufgabe 17).
- **Commit-Botschaften ohne `Co-Authored-By`.**
- Branch: `etappe-10-staedte-und-ritter`. Ausgangspunkt: `6acb025`.
- Abnahme je Aufgabe: `pnpm typecheck` und die betroffenen Tests. Volle Abnahme
  (`pnpm typecheck && pnpm test && pnpm build && pnpm format:check`) in Aufgabe 17.

## Bewußte Abweichungen von Spec und Regelwerk

Drei Stellen weichen ab, alle mit Grund. Sie gehören **wörtlich** in den
`PROGRESS.md`-Abschnitt von 10b, damit sie beim nächsten Lesen eine Entscheidung sind und
kein Fehler.

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

## Dateiplan

| Datei                                              | Rolle                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/shared/src/rules/ruleset.ts`             | ändern — neue Buildables/Pieces, `PieceCounts`, `victoryPoints.defender`, `handLimitPerWall` |
| `packages/shared/src/rules/cities.ts`              | ändern — Preise für Mauer, Ritter, Aufwertung, Aktivierung; Rittervorrat                     |
| `packages/shared/src/game/player.ts`               | ändern — `piecesLeft` teilweise, `defenderPoints`, `improvements`                            |
| `packages/shared/src/game/state.ts`                | ändern — `knights`, `Building.wall`                                                          |
| `packages/shared/src/game/cities/tracks.ts`        | **neu** — nur die drei Bereichs-Ids (der Rest kommt in 10c)                                  |
| `packages/shared/src/game/cities/knights.ts`       | **neu** — bauen, aktivieren, aufwerten, Stärkerechnung                                       |
| `packages/shared/src/game/cities/knightMoves.ts`   | **neu** — Wegsuche im eigenen Netz                                                           |
| `packages/shared/src/game/cities/knightActions.ts` | **neu** — versetzen, vertreiben, Räuber vertreiben, Ausweichen                               |
| `packages/shared/src/game/cities/walls.ts`         | **neu** — Stadtmauer bauen, Handkartenlimit                                                  |
| `packages/shared/src/game/cities/barbarians.ts`    | ändern — Fahrstrecke zu Ende, Kampf, Retter-Chips, Städteverlust                             |
| `packages/shared/src/game/cities/turn.ts`          | ändern — Überfall bei Ankunft                                                                |
| `packages/shared/src/game/cities/index.ts`         | ändern — neue Sammelpunkte                                                                   |
| `packages/shared/src/game/build.ts`                | ändern — ein Ritter belegt den Knoten                                                        |
| `packages/shared/src/game/roads.ts`                | ändern — ein fremder Ritter unterbricht die Strecke                                          |
| `packages/shared/src/game/robber.ts`               | ändern — Räubersperre, Handkartenlimit mit Mauern                                            |
| `packages/shared/src/game/scoring.ts`              | ändern — Retter-Chips als Summand                                                            |
| `packages/shared/src/game/phase.ts`                | ändern — `displacePending`                                                                   |
| `packages/shared/src/game/actions.ts`              | ändern — sieben neue Zugarten                                                                |
| `packages/shared/src/game/errors.ts`               | ändern — neue Ablehnungsgründe                                                               |
| `packages/shared/src/game/reducer.ts`              | ändern — Phasenliste, Verteiler, `endTurn`                                                   |
| `packages/shared/src/game/legal.ts`                | ändern — die neuen Züge aufzählen                                                            |
| `packages/shared/src/game/playerView.ts`           | ändern — `knights`, `defenderPoints`, `defenders`                                            |
| `packages/shared/src/game/labels.ts`               | ändern — Ritterwörter                                                                        |
| `packages/shared/src/game/log.ts`                  | ändern — Verlaufssätze                                                                       |
| `apps/client/src/board/shapes.ts`                  | ändern — Rittersilhouetten und Mauersockel                                                   |
| `apps/client/src/board/BoardSvg.tsx`               | ändern — Ritter und Mauern zeichnen                                                          |
| `apps/client/src/game/targets.ts`                  | ändern — neue Zielarten                                                                      |
| `apps/client/src/game/view.ts`                     | ändern — `phaseText` für `displacePending`, Handkartenlimit mit Mauern                       |
| `apps/client/src/game/labels.ts`                   | ändern — Ritterstufen                                                                        |
| `apps/client/src/panels/ActionPanel.tsx`           | ändern — Mauer und Ritter in der Bauleiste                                                   |
| `apps/client/src/panels/KnightPanel.tsx`           | **neu** — die vier Ritteraktionen                                                            |
| `apps/client/src/panels/BarbarianTrack.tsx`        | ändern — die Ritterstärke steht jetzt da                                                     |
| `apps/client/src/screens/GameScreen.tsx`           | ändern — Bau- und Rittermodus, Ausweichmodus                                                 |
| `apps/client/src/index.css`                        | ändern — Ritter, Mauer, Ritterleiste                                                         |
| `PROGRESS.md`                                      | ändern — Abschnitt 10b                                                                       |

---

## Aufgabe 1: Bauteile und Buildables im Regelwerk

**Warum zuerst:** `PIECE_IDS` und `BUILDABLE_IDS` wachsen, und beide stecken in einem
`z.record` mit Enum-Schlüssel. In Zod 4 ist so ein Record **erschöpfend** — genau die
Falle, die in 10a schon einmal jede gespeicherte Partie gekostet hätte. Das gehört
gelöst, bevor irgendetwas darauf baut.

**Dateien:**

- Ändern: `packages/shared/src/rules/ruleset.ts`
- Ändern: `packages/shared/src/game/player.ts`
- Test: `packages/shared/src/rules/ruleset.test.ts`

**Schnittstellen — liefert:**

```ts
// rules/ruleset.ts
export const BUILDABLE_IDS = [
  'road',
  'settlement',
  'city',
  'developmentCard',
  'wall',
  'knight',
  'knightUpgrade',
  'knightActivation',
] as const;

export const PIECE_IDS = [
  'road',
  'settlement',
  'city',
  'wall',
  'knight1',
  'knight2',
  'knight3',
] as const;

/** Ein vollstaendiger Teilevorrat aus dem, was genannt ist - alles andere null. */
export function pieceCounts(part: Partial<Record<PieceId, number>>): Record<PieceId, number>;

export const PieceCountsSchema: z.ZodType<Record<PieceId, number>>;
export type PieceCounts = Record<PieceId, number>;

// RuleSet neu:
//   pieceStock: PieceCountsSchema
//   victoryPoints.defender: z.number().int().min(0).default(0)
//   handLimitPerWall: z.number().int().min(0).default(0)
```

- [x] **Schritt 1: Den fehlschlagenden Test schreiben**

An `packages/shared/src/rules/ruleset.test.ts` anhängen:

```ts
describe('Teilevorraete', () => {
  it('fuellen fehlende Bauteile mit null auf', () => {
    const parsed = PieceCountsSchema.parse({ road: 15, settlement: 5, city: 4 });
    expect(parsed).toEqual({
      road: 15,
      settlement: 5,
      city: 4,
      wall: 0,
      knight1: 0,
      knight2: 0,
      knight3: 0,
    });
  });

  it('lesen eine gespeicherte Basispartie weiter ein', () => {
    const stored = { ...CLASSIC_RULES, pieceStock: { road: 15, settlement: 5, city: 4 } };
    const parsed = RuleSetSchema.parse(JSON.parse(JSON.stringify(stored)));
    expect(parsed.pieceStock.knight1).toBe(0);
    expect(parsed.pieceStock.road).toBe(15);
  });

  it('weisen ein Bauteil ab, das es nicht gibt', () => {
    expect(() => PieceCountsSchema.parse({ catapult: 1 })).toThrow();
  });

  it('geben dem Basisspiel keine Retter-Chips und keine Mauern', () => {
    expect(CLASSIC_RULES.victoryPoints.defender).toBe(0);
    expect(CLASSIC_RULES.handLimitPerWall).toBe(0);
    expect(CLASSIC_RULES.pieceStock.knight1).toBe(0);
    expect(CLASSIC_RULES.pieceStock.wall).toBe(0);
  });
});
```

- [x] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

`pnpm --filter @conquerist/shared test -- ruleset` — erwartet: `PieceCountsSchema` ist
nicht exportiert.

- [x] **Schritt 3: Umsetzen**

In `rules/ruleset.ts`:

- `BUILDABLE_IDS` und `PIECE_IDS` um die oben genannten Einträge erweitern. Kommentar an
  `PIECE_IDS`: **je Stufe ein eigener Vorrat**, weil die Regel je Stufe auf zwei begrenzt
  und nicht insgesamt auf sechs — ein Zähler `knight: 6` könnte das nicht ausdrücken.
- `pieceCounts` und `PieceCountsSchema` nach dem Vorbild von `cardAmounts` /
  `CardAmountsSchema` anlegen, mit demselben Kommentargrund (gespeicherte Partien).
- `RuleSet.pieceStock: PieceCountsSchema`.
- `victoryPoints` um `defender: z.number().int().min(0).default(0)` erweitern —
  Vorgabewert, weil das RuleSet gespeicherter Partien das Feld nicht hat.
- `handLimitPerWall: z.number().int().min(0).default(0)` — was **eine** Stadtmauer zum
  Handkartenlimit beiträgt. Steht im Regelwerk und nicht im Code, damit eine Variante mit
  anderem Aufschlag ein zweites RuleSet ist und kein zweiter Codepfad.
- `CLASSIC_RULES` und `CLASSIC_RULES_56`: `pieceStock: pieceCounts({ road: 15,
settlement: 5, city: 4 })`, `victoryPoints.defender: 0`, `handLimitPerWall: 0`.
  Kommentar: die Nullen sagen „gibt es an diesem Tisch nicht", dieselbe Haltung wie bei
  den drei Handelswaren im `resourceBank` des Basisspiels.

In `game/player.ts`:

- `piecesLeft: PieceCountsSchema` statt `z.record(PieceIdSchema, …)`.
- `defenderPoints: z.number().int().min(0).default(0)` — Siegpunkt-Chips „Retter Catans".
  **Öffentlich**: sie liegen offen vor dem Spieler.
- `improvements: z.partialRecord(TrackIdSchema, z.number().int().min(0).max(5)).default({})`
  — die Ausbaustufen. Sie gehören zu 10c und stehen hier trotzdem schon, aus **einem**
  Grund: die Festung (Politik, Stufe 3) ist die Bedingung für die dritte Ritterstufe, und
  ohne das Feld müßte `canUpgradeKnight` sie fest verneinen. Eine Regel, die „nie" sagt,
  wo „noch nicht" gilt, ist genau der Knopf, der nie angeht. Teilweise und nicht
  vollständig, weil ein nicht begonnener Bereich keine Null braucht.

- [x] **Schritt 4: Test laufen lassen und Erfolg sehen**

`pnpm --filter @conquerist/shared test -- ruleset` — grün. Danach der volle Lauf
`pnpm --filter @conquerist/shared test`: es dürfen **keine** bestehenden Tests fallen. Wo
ein Test `piecesLeft` oder `pieceStock` wörtlich vergleicht (`toEqual`), erwartet er
jetzt sieben Schlüssel — solche Erwartungen werden auf `toMatchObject` umgestellt oder um
die Nullen ergänzt, nicht die Auffüllung aufgeweicht.

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/rules/ruleset.ts packages/shared/src/rules/ruleset.test.ts packages/shared/src/game/player.ts
git commit -m "Sieben Bauteile statt drei - und keine verlorene Partie dabei"
```

---

## Aufgabe 2: Der Ritter im Zustand, die Mauer am Gebäude

**Dateien:**

- Ändern: `packages/shared/src/game/state.ts`
- Neu: `packages/shared/src/game/cities/tracks.ts`
- Ändern: `packages/shared/src/game/cities/index.ts`
- Ändern: `packages/shared/src/game/setup.ts` (`createGame` füllt die neuen Felder)
- Test: `packages/shared/src/game/state.test.ts` (**neu**)

**Schnittstellen — liefert:**

```ts
// game/cities/tracks.ts
export const TRACK_IDS = ['trade', 'politics', 'science'] as const;
export type TrackId = (typeof TRACK_IDS)[number];
export const TrackIdSchema: z.ZodEnum<…>;
/** Ab welcher Stufe die Festung Maechtige Ritter erlaubt. */
export const FORTRESS_LEVEL = 3;

// game/state.ts
export const KNIGHT_LEVELS = [1, 2, 3] as const;
export type KnightLevel = 1 | 2 | 3;
export const KnightSchema: z.ZodObject<{
  owner, level, active, activatedOnTurn, upgradedThisTurn
}>;
export type Knight = { owner: PlayerId; level: KnightLevel; active: boolean;
                       activatedOnTurn: number | null; upgradedThisTurn: boolean };
// GameState:  knights: z.record(z.string(), KnightSchema).default({})
// Building:   wall: z.boolean().default(false)
```

- [x] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/game/state.test.ts`:

```ts
describe('Ritter im Zustand', () => {
  it('kommen als leere Belegung, wenn eine gespeicherte Partie sie nicht kennt', () => {
    const stored = JSON.parse(JSON.stringify(gameWithPlayers(3)));
    delete stored.knights;
    expect(GameStateSchema.parse(stored).knights).toEqual({});
  });

  it('tragen Stufe, Helm und den Zug ihrer Aktivierung', () => {
    const knight = KnightSchema.parse({
      owner: 'a',
      level: 2,
      active: true,
      activatedOnTurn: 4,
      upgradedThisTurn: false,
    });
    expect(knight.level).toBe(2);
  });

  it('kennen keine vierte Stufe', () => {
    expect(() =>
      KnightSchema.parse({
        owner: 'a',
        level: 4,
        active: false,
        activatedOnTurn: null,
        upgradedThisTurn: false,
      }),
    ).toThrow();
  });
});

describe('Stadtmauer am Gebaeude', () => {
  it('fehlt in einer gespeicherten Partie und heisst dann: keine', () => {
    expect(BuildingSchema.parse({ owner: 'a', kind: 'city' }).wall).toBe(false);
  });
});
```

`gameWithPlayers` kommt aus `game/fixtures.ts` — dort nachsehen, wie die bestehenden
Tests einen Zustand bauen, und dieselbe Hilfe benutzen.

- [x] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`game/cities/tracks.ts` anlegen — **nur** die Ids, `TrackIdSchema` und `FORTRESS_LEVEL`.
Kopfkommentar: die fünf Stufen, ihre Namen, Kosten und Schwellen kommen in 10c; hier
steht, was 10b braucht, nämlich der Bereich, an dem die Festung hängt.

`game/state.ts`:

- `KnightSchema` mit den fünf Feldern aus Spec 2.1, samt der dortigen Begründungen:
  - `activatedOnTurn` ist eine **Zahl und kein Flag „darf handeln"** — ein abgeleiteter
    Wert, den man speichert, ist ein Wert, den man nachzuziehen vergißt.
  - `upgradedThisTurn`, weil ein Ritter je Zug nur einmal steigen darf; `endTurn` setzt
    es zurück.
- `GameState.knights: z.record(z.string(), KnightSchema).default({})`. Kommentar:
  **warum am Zustand und nicht beim Spieler** — Ritter stehen auf Kreuzungen wie
  Siedlungen und Städte, und die Belegung des Bretts steht einmal in `buildings`,
  `roads` und `knights` und nirgends sonst; zwei Wahrheiten liefen bei der ersten
  Vertreibung auseinander.
- `BuildingSchema.wall: z.boolean().default(false)`. Kommentar: die Mauer gehört
  **einer bestimmten Stadt** und nicht einem Spieler — nur so fällt sie beim Überfall mit
  der richtigen Stadt.

`game/setup.ts`: `createGame` bekommt `knights: {}`, und jeder Spieler
`defenderPoints: 0`, `improvements: {}`. `piecesLeft: { ...rules.pieceStock }` bleibt und
trägt jetzt sieben Schlüssel.

`game/cities/index.ts`: `export * from './tracks.js';`

- [x] **Schritt 4: Test laufen lassen und Erfolg sehen**

`pnpm --filter @conquerist/shared test` — grün.

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game packages/shared/src/rules
git commit -m "Ritter stehen auf Kreuzungen, Mauern an Staedten"
```

---

## Aufgabe 3: Ein Ritter belegt seinen Knoten und unterbricht fremde Straßen

**Warum vor dem Bauen:** beide Regeln sind Bedingungen, die `canBuildKnight` selbst
braucht (ein Ritter darf nicht auf einen belegten Knoten), und beide betreffen Dateien
außerhalb von `cities/`. Sie zuerst zu ziehen hält die neuen Dateien frei von
Rückgriffen.

**Dateien:**

- Ändern: `packages/shared/src/game/build.ts` (`canPlaceSettlementAt`)
- Ändern: `packages/shared/src/game/roads.ts` (`isBlocked`)
- Test: `packages/shared/src/game/build.test.ts`, `packages/shared/src/game/roads.test.ts`

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

`build.test.ts`:

```ts
it('laesst auf einer Kreuzung mit Ritter nichts bauen - auch nicht dem Besitzer', () => {
  const state = { ...base, knights: { [vertex]: knightOf('a', 1) } };
  expect(canPlaceSettlementAt(state, vertex)?.code).toBe(RuleViolationCode.VERTEX_OCCUPIED);
});

it('laesst neben einem Ritter bauen - er ist kein Bauwerk', () => {
  const state = { ...base, knights: { [neighbour]: knightOf('b', 1) } };
  expect(canPlaceSettlementAt(state, vertex)).toBeNull();
});
```

`roads.test.ts`:

```ts
it('unterbricht die Strecke an einem fremden Ritter', () => {
  // Vier Strassen in einer Reihe, in der Mitte ein fremder Ritter.
  expect(longestRoadLength(withForeignKnight, 'a')).toBe(2);
});

it('laesst den eigenen Ritter durch', () => {
  expect(longestRoadLength(withOwnKnight, 'a')).toBe(4);
});

it('laesst die Strecke am fremden Ritter enden', () => {
  // Startknoten mit fremdem Ritter: die Strecke endet dort und zaehlt voll.
  expect(longestRoadLength(knightAtEnd, 'a')).toBe(4);
});
```

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`build.ts`, in `canPlaceSettlementAt`, direkt nach der Prüfung auf `state.buildings`:

```ts
/*
 * Ein Ritter belegt seine Kreuzung wie ein Bauwerk - auch der eigene. Die
 * Regel sagt es ausdruecklich: wer dort bauen will, muss ihn erst versetzen,
 * und geht das nicht, kann er dort nicht bauen. Eine Ausnahme fuer den eigenen
 * Ritter waere ein Ritter, der von seinem eigenen Haus verschluckt wird.
 */
if (state.knights[vertex] !== undefined) {
  return violation(RuleViolationCode.VERTEX_OCCUPIED, `Auf ${vertex} steht ein Ritter`);
}
```

Die Abstandsregel bleibt unberührt: sie fragt nach Nachbar**bauwerken**, und ein Ritter
ist keines.

`roads.ts`, `isBlocked`:

```ts
/** Steht hier etwas Fremdes, das die Strecke unterbricht? */
function isBlocked(state: GameState, player: PlayerId, vertex: VertexId): boolean {
  const building = state.buildings[vertex];
  if (building !== undefined && building.owner !== player) return true;

  /*
   * Ein fremder Ritter unterbricht wie ein fremdes Dorf - so steht es in der
   * Anleitung, und es ist der Grund, warum ein Ritter ueberhaupt ein Zug gegen
   * eine fremde Laengste Handelsstrasse ist. Der eigene unterbricht nicht: man
   * geht durch die eigene Stellung hindurch.
   */
  const knight = state.knights[vertex];
  return knight !== undefined && knight.owner !== player;
}
```

Der Kopfkommentar von `roads.ts` bekommt einen Satz dazu: **Ritter unterbrechen wie
Gebäude**, und die Suche prüft am Startknoten weiterhin nicht — die Strecke endet dort.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game/build.ts packages/shared/src/game/roads.ts packages/shared/src/game/build.test.ts packages/shared/src/game/roads.test.ts
git commit -m "Ein fremder Ritter steht im Weg"
```

---

## Aufgabe 4: Ritter bauen, aktivieren, aufwerten

**Dateien:**

- Neu: `packages/shared/src/game/cities/knights.ts`
- Test: `packages/shared/src/game/cities/knights.test.ts` (**neu**)
- Ändern: `packages/shared/src/game/cities/index.ts`
- Ändern: `packages/shared/src/rules/cities.ts` (Preise und Vorrat)
- Ändern: `packages/shared/src/game/errors.ts`

**Schnittstellen — liefert:**

```ts
export function knightAt(state: GameState, vertex: VertexId): Knight | undefined;
/** Der Bauteil-Bezeichner zu einer Ritterstufe: `knight1` .. `knight3`. */
export function knightPiece(level: KnightLevel): PieceId;
/** Die Staerke aller aktivierten Ritter eines Spielers. */
export function knightStrengthOf(source: KnightSource, player: PlayerId): number;
/** Die Staerke der Ritter Catans - ueber alle Spieler. */
export function catanStrength(source: KnightSource): number;
/** Ob dieser Ritter in diesem Zug noch handeln darf. */
export function knightMayAct(state: GameState, vertex: VertexId, player: PlayerId): boolean;
/** Ob dieser Spieler Starke zu Maechtigen Rittern aufwerten darf (Festung). */
export function hasFortress(player: PlayerState): boolean;

export function canBuildKnight(state, player, vertex): RuleViolation | null;
export function applyBuildKnight(state, player, vertex): ReduceResult;
export function canActivateKnight(state, player, vertex): RuleViolation | null;
export function applyActivateKnight(state, player, vertex): ReduceResult;
export function canUpgradeKnight(state, player, vertex): RuleViolation | null;
export function applyUpgradeKnight(state, player, vertex): ReduceResult;

/** Was `catanStrength` wirklich braucht - damit auch eine PlayerView rechnen kann. */
export interface KnightSource {
  readonly knights: GameState['knights'];
}
```

**Neue Ablehnungsgründe in `errors.ts`:**

```
NO_KNIGHT_HERE       — auf dieser Kreuzung steht kein eigener Ritter
KNIGHT_ALREADY_ACTIVE— dieser Ritter traegt schon einen Helm
KNIGHT_NOT_ACTIVE    — ein passiver Ritter handelt nicht
KNIGHT_JUST_ACTIVATED— frisch aktiviert; handeln darf er ab dem naechsten Zug
KNIGHT_MAX_LEVEL     — ein Maechtiger Ritter steigt nicht weiter
KNIGHT_NEEDS_FORTRESS— Stark zu Maechtig verlangt die Festung
KNIGHT_ALREADY_UPGRADED — je Zug steigt ein Ritter nur einmal
```

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

`knights.test.ts`. Die Fälle, jeder als eigenes `it`:

_Bauen_

- baut auf eine freie Kreuzung mit eigener Straße daneben und zieht 1 Wolle + 1 Erz ab
- **kennt keine Abstandsregel**: direkt neben der eigenen Siedlung geht es
- weist eine Kreuzung ohne eigene Straße ab (`NOT_CONNECTED`)
- weist eine belegte Kreuzung ab (`VERTEX_OCCUPIED`), auch wenn dort ein eigener Ritter
  steht
- kommt **passiv** ins Spiel (`active === false`, `activatedOnTurn === null`)
- weist ab, wenn der Vorrat `knight1` leer ist (`NO_PIECES_LEFT`) — der dritte Einfache
  Ritter geht nicht, obwohl Karten da wären
- gibt die bezahlten Karten an die Bank zurück
- weist an einem Basistisch ab, weil das Regelwerk keinen Preis nennt

_Aktivieren_

- setzt den Helm auf und zieht 1 Getreide ab
- merkt sich `activatedOnTurn === state.turn`
- geht **im selben Zug**, in dem der Ritter gebaut wurde
- weist einen schon aktiven Ritter ab (`KNIGHT_ALREADY_ACTIVE`)
- weist einen fremden Ritter ab (`NO_KNIGHT_HERE`)

_Aufwerten_

- macht aus Einfach Stark, verschiebt den Vorrat (`knight1 +1`, `knight2 -1`) und zieht
  1 Wolle + 1 Erz ab
- **verbraucht nicht**: wer schon zwei Starke stehen hat, kann nicht aufwerten
  (`NO_PIECES_LEFT`)
- läßt Stark zu Mächtig **nicht** ohne Festung zu (`KNIGHT_NEEDS_FORTRESS`)
- läßt Stark zu Mächtig **mit** Festung zu (`improvements.politics = 3`)
- weist einen Mächtigen Ritter ab (`KNIGHT_MAX_LEVEL`)
- läßt denselben Ritter im selben Zug kein zweites Mal steigen
  (`KNIGHT_ALREADY_UPGRADED`)
- **aktiv bleibt aktiv, passiv bleibt passiv**, und `activatedOnTurn` bleibt stehen

_Stärke_

- `knightStrengthOf` zählt nur **aktivierte** Ritter und summiert ihre Stufen
- `catanStrength` summiert über alle Spieler

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: `rules/cities.ts` ergänzen**

```ts
buildCosts: {
  road:       cardAmounts({ brick: 1, lumber: 1 }),
  settlement: cardAmounts({ brick: 1, lumber: 1, wool: 1, grain: 1 }),
  city:       cardAmounts({ grain: 2, ore: 3 }),
  wall:       cardAmounts({ brick: 2 }),
  knight:     cardAmounts({ wool: 1, ore: 1 }),
  knightUpgrade:    cardAmounts({ wool: 1, ore: 1 }),
  knightActivation: cardAmounts({ grain: 1 }),
},

pieceStock: pieceCounts({
  road: 15, settlement: 5, city: 4,
  wall: 3, knight1: 2, knight2: 2, knight3: 2,
}),

victoryPoints: { …, defender: 1 },
handLimitPerWall: 2,
```

Kommentar am `pieceStock`: **je Person gezählt**, deshalb steht in `CITIES_RULES_56`
dieselbe Zeile — die 5–6-Ergänzung bringt zwölf weitere Ritter für zwei weitere
Personen, also je Person unverändert sechs.

Der bestehende Gleichheitstest in `rules/cities.test.ts` wird um `pieceStock`,
`handLimitPerWall` und `victoryPoints.defender` erweitert: zwischen `CITIES_RULES` und
`CITIES_RULES_56` weichen weiterhin nur `resourceBank` und `castleTurns` ab.

- [x] **Schritt 4: `knights.ts` umsetzen**

Kopfkommentar der Datei: was ein Ritter ist (Figur auf einer Kreuzung, Stufe = Stärke,
Helm = aktiviert), und daß die **Züge** eines Ritters in `knightActions.ts` stehen — hier
steht, wie er entsteht und wächst.

Kernpunkte:

- `knightPiece(level)` gibt `` `knight${level}` `` als `PieceId` zurück. Eine Funktion
  und keine Tabelle: die drei Namen folgen der Stufe, und eine Tabelle wäre eine zweite
  Stelle, an der die Zahl steht.
- `canBuildKnight`: Knoten auf dem Brett, frei (`canPlaceSettlementAt` **nicht**
  benutzen — die trägt die Abstandsregel, und die gilt hier ausdrücklich nicht; statt
  dessen `buildings[vertex]`, `knights[vertex]` und Brettzugehörigkeit selbst prüfen),
  mindestens eine angrenzende **eigene Straße**, Preis und Vorrat.
- Bezahlt wird über dieselbe Mechanik wie in `build.ts`. Weil `pay` dort privat ist, wird
  es exportiert (`payFor(state, player, cost, pieces)`), statt eine zweite Buchung
  danebenzustellen — zwei Stellen, die Karten an die Bank zurückgeben, wären zwei
  Gelegenheiten, eine zu vergessen.
- `applyActivateKnight` setzt `active: true, activatedOnTurn: state.turn`. Kommentar:
  `state.turn` zählt volle Runden, und weil jeder je Runde einmal handelt, heißt
  „`activatedOnTurn < state.turn`" genau „ab dem nächsten eigenen Zug".
- `applyUpgradeKnight` verschiebt zwischen den Vorräten (`knightPiece(level) +1`,
  `knightPiece(level+1) -1`) und setzt `upgradedThisTurn: true`.
- `hasFortress(player)` liest `player.improvements.politics ?? 0 >= FORTRESS_LEVEL`.
- `knightMayAct` prüft: eigener Ritter, `active`, `activatedOnTurn !== null`,
  `activatedOnTurn < state.turn`.

- [x] **Schritt 5: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 6: Commit**

```bash
git add packages/shared/src/game/cities packages/shared/src/rules/cities.ts packages/shared/src/rules/cities.test.ts packages/shared/src/game/errors.ts packages/shared/src/game/build.ts
git commit -m "Ritter bauen, Helm aufsetzen, eine Stufe steigen"
```

---

## Aufgabe 5: Wo ein Ritter hinziehen kann

**Warum eigene Datei:** die Wegsuche ist ein Stück Graphenarbeit mit einer eigenen Regel
(„an fremden Rittern nicht vorbei") und wird von **drei** Stellen gebraucht: versetzen,
vertreiben und das Ausweichen des Vertriebenen. Sie neben den Zügen zu führen hieße, sie
dreimal auszulegen.

**Dateien:**

- Neu: `packages/shared/src/game/cities/knightMoves.ts`
- Test: `packages/shared/src/game/cities/knightMoves.test.ts` (**neu**)

**Schnittstellen — liefert:**

```ts
/**
 * Welche Kreuzungen dieser Spieler von `from` aus ueber **eigene Strassen**
 * erreicht, ohne an einem fremden Ritter vorbeizuziehen.
 *
 * `from` selbst ist nicht dabei. Enthalten sind auch belegte Kreuzungen - ob
 * dort gelandet werden darf, entscheidet der Zug und nicht der Weg.
 */
export function reachableVertices(
  state: GameState,
  player: PlayerId,
  from: VertexId,
): ReadonlySet<VertexId>;

/** Ob dort ein Ritter stehenbleiben darf: kein Bauwerk, kein Ritter. */
export function vertexIsFree(state: GameState, vertex: VertexId): boolean;
```

- [x] **Schritt 1: Den fehlschlagenden Test schreiben**

Die Fälle:

- eine gerade Straßenkette: alle Knoten der Kette sind erreichbar, der Startknoten nicht
- eine fremde Straße dazwischen bricht die Kette (nur eigene Straßen tragen)
- ein **fremder Ritter** auf einem Zwischenknoten schneidet alles dahinter ab, der
  Knoten selbst bleibt in der Menge (dorthin kann vertrieben werden)
- ein **eigener** Ritter auf einem Zwischenknoten schneidet nicht ab
- eine fremde **Siedlung** auf einem Zwischenknoten schneidet **nicht** ab — die
  Anleitung nennt nur Ritter, und die Längste Handelsstraße ist eine andere Frage als der
  Weg einer Figur. (Das ist eine Auslegung und steht als solche im Kommentar und in
  `PROGRESS.md`.)
- ohne eigene Straßen ist die Menge leer

- [x] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

Breitensuche über `board.topology.vertexEdges` / `edgeVertices`, Kante nur, wenn
`state.roads[edge] === player`. Ein Knoten wird aufgenommen; **weitergegangen** wird von
ihm nur, wenn dort **kein fremder Ritter** steht. Der Kopfkommentar hält beides fest:
warum der fremde Ritter aufgenommen, aber nicht überschritten wird (man darf ihn
vertreiben, aber nicht an ihm vorbei), und warum eine fremde Siedlung nicht sperrt.

- [x] **Schritt 4: Test laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game/cities/knightMoves.ts packages/shared/src/game/cities/knightMoves.test.ts packages/shared/src/game/cities/index.ts
git commit -m "Wie weit ein Ritter kommt"
```

---

## Aufgabe 6: Versetzen, vertreiben, ausweichen, den Räuber jagen

**Dateien:**

- Neu: `packages/shared/src/game/cities/knightActions.ts`
- Test: `packages/shared/src/game/cities/knightActions.test.ts` (**neu**)
- Ändern: `packages/shared/src/game/phase.ts` (`displacePending`)
- Ändern: `packages/shared/src/game/errors.ts`

**Schnittstellen — liefert:**

```ts
export function canMoveKnight(state, player, from: VertexId, to: VertexId): RuleViolation | null;
export function applyMoveKnight(state, player, from, to): ReduceResult;
export function canChaseRobber(state, player, vertex: VertexId): RuleViolation | null;
export function applyChaseRobber(state, player, vertex): ReduceResult;
export function canPlaceDisplacedKnight(state, player, vertex): RuleViolation | null;
export function applyPlaceDisplacedKnight(state, player, vertex): ReduceResult;
/** Wohin ein vertriebener Ritter ausweichen koennte. Leer heisst: er kommt vom Brett. */
export function displacementTargets(state, owner: PlayerId, from: VertexId): VertexId[];
```

**Neue Phase in `phase.ts`:**

```ts
/**
 * Ein vertriebener Ritter sucht seinen neuen Platz.
 *
 * Umgesetzt wird er von **seinem Besitzer** und nicht vom Angreifer - deshalb
 * haelt die Phase, wem er gehoert, und `actorFor` gibt genau ihn zurueck. Sein
 * Zustand reist mit: Stufe und Helm bleiben, nur der Ort wechselt.
 *
 * `from` ist die Kreuzung, von der er vertrieben wurde. Sie steht hier, weil
 * die Ausweichkreuzung in seinem eigenen Netz liegen muss - gerechnet von dort,
 * wo er stand, und nicht von irgendwo.
 *
 * Gibt es keinen Platz, oeffnet die Phase gar nicht erst: der Ritter kommt vom
 * Brett. Eine Phase, die auf eine Wahl ohne Moeglichkeiten wartet, haelt den
 * Tisch fuer nichts an.
 */
z.object({
  kind: z.literal('displacePending'),
  owner: PlayerIdSchema,
  level: z.number().int().min(1).max(3),
  active: z.boolean(),
  activatedOnTurn: z.number().int().min(0).nullable(),
  from: z.string(),
}),
```

**Neue Ablehnungsgründe:**

```
KNIGHT_UNREACHABLE   — dorthin fuehrt kein eigener Weg
KNIGHT_TARGET_TAKEN  — dort steht etwas, das sich nicht vertreiben laesst
KNIGHT_TOO_WEAK      — der fremde Ritter dort ist mindestens ebenso stark
ROBBER_NOT_ADJACENT  — der Raeuber steht an keinem der drei Felder
ROBBER_LOCKED        — der Raeuber bleibt bis zum ersten Barbarenueberfall stehen
NOT_DISPLACING       — dieser Spieler setzt gerade keinen vertriebenen Ritter
```

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

_Versetzen_

- zieht auf eine freie erreichbare Kreuzung; der Ritter steht danach dort und **nicht**
  mehr am Ausgangspunkt
- **deaktiviert** ihn dabei (`active: false`, `activatedOnTurn: null`) — je aktivem
  Ritter eine Aktion je Zug
- weist einen **passiven** Ritter ab (`KNIGHT_NOT_ACTIVE`)
- weist einen **frisch aktivierten** Ritter ab (`KNIGHT_JUST_ACTIVATED`)
- weist ein Ziel ab, das nicht über eigene Straßen erreichbar ist (`KNIGHT_UNREACHABLE`)
- weist ein Ziel mit eigenem Bauwerk ab (`KNIGHT_TARGET_TAKEN`)
- weist ein Ziel mit **eigenem** Ritter ab (`KNIGHT_TARGET_TAKEN`) — eigene Ritter
  vertreibt man nicht

_Vertreiben_

- zieht auf einen **schwächeren** fremden Ritter, übernimmt die Kreuzung und öffnet
  `displacePending` mit dem Zustand des Vertriebenen
- weist einen **gleich starken** fremden Ritter ab (`KNIGHT_TOO_WEAK`)
- weist einen **stärkeren** fremden Ritter ab (`KNIGHT_TOO_WEAK`)
- gibt den Ritter **vom Brett**, wenn es keine Ausweichkreuzung gibt: kein
  `displacePending`, `knight{level}` wandert in den Vorrat des Besitzers zurück

_Ausweichen_

- `placeDisplacedKnight` setzt ihn mit **unverändertem** Zustand (Stufe, Helm,
  `activatedOnTurn`) auf eine freie erreichbare Kreuzung und geht zurück nach `main`
- weist eine Kreuzung außerhalb seines Netzes ab (`KNIGHT_UNREACHABLE`)
- weist jemanden ab, der nicht der Besitzer ist (`NOT_DISPLACING`)

_Räuber vertreiben_

- öffnet `robberPending` mit `resume: 'main'`, wenn der Räuber an einem der drei
  angrenzenden Felder steht, und deaktiviert den Ritter
- weist ab, wenn der Räuber woanders steht (`ROBBER_NOT_ADJACENT`)
- weist ab, solange der Räuber gesperrt ist (`ROBBER_LOCKED`)

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

Kopfkommentar von `knightActions.ts`: **`moveKnight` deckt das Vertreiben mit ab.** Ziel
frei heißt versetzen, Ziel von einem schwächeren fremden Ritter besetzt heißt vertreiben.
Zwei Aktionen für denselben Zug (ein Ritter zieht auf eine Kreuzung) wären zwei
Regelauslegungen darüber, wohin er ziehen darf.

`applyMoveKnight`, der Reihe nach:

1. `canMoveKnight` prüfen.
2. Den Ritter von `from` nehmen, deaktiviert nach `to` setzen.
3. Stand dort ein fremder Ritter: `displacementTargets` rechnen. Ist die Liste leer, den
   Vertriebenen in den Vorrat seines Besitzers zurückgeben und in `main` bleiben. Sonst
   `displacePending` öffnen.

`applyChaseRobber` setzt `phase: { kind: 'robberPending', resume: 'main' }` und
deaktiviert den Ritter. Kommentar: **das Stehlen kommt als eigener `moveRobber`** — die
bestehende Phase kann genau das, samt Opferwahl und Zufallsziehung, und ein zweiter Weg
dorthin wäre eine zweite Auslegung derselben Regel.

`displacementTargets(state, owner, from)` = `reachableVertices(state, owner, from)`
gefiltert auf `vertexIsFree`.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Ein Ritter zieht, ein anderer weicht aus"
```

---

## Aufgabe 7: Stadtmauern und das größere Handkartenlimit

**Dateien:**

- Neu: `packages/shared/src/game/cities/walls.ts`
- Test: `packages/shared/src/game/cities/walls.test.ts` (**neu**)
- Ändern: `packages/shared/src/game/robber.ts` (`discardCountFor`)
- Ändern: `packages/shared/src/game/errors.ts`

**Schnittstellen — liefert:**

```ts
export function canBuildWall(state, player, vertex): RuleViolation | null;
export function applyBuildWall(state, player, vertex): ReduceResult;
/** Wie viele Staedte dieses Spielers eine Mauer tragen. */
export function wallsOf(source: BuildingSource, player: PlayerId): number;
/**
 * Ab wie vielen Handkarten dieser Spieler abwerfen muss.
 *
 * Nimmt eine Quelle statt eines `GameState`, damit auch der Browser mit
 * derselben Funktion rechnet - Mauern stehen offen am Brett, und zwei
 * Rechnungen fuer dieselbe Zahl liefen auseinander.
 */
export function handLimitOf(source: HandLimitSource, player: PlayerId): number;

export interface HandLimitSource {
  readonly buildings: GameState['buildings'];
  readonly rules: Pick<RuleSet, 'handLimitBeforeDiscard' | 'handLimitPerWall'>;
}
```

**Neuer Ablehnungsgrund:** `NOT_OWN_CITY` — auf dieser Kreuzung steht keine eigene Stadt.
Dazu `WALL_EXISTS` — diese Stadt hat schon eine Mauer.

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

- baut unter eine eigene Stadt und zieht 2 Lehm ab
- weist eine eigene **Siedlung** ab (`NOT_OWN_CITY`)
- weist eine **fremde** Stadt ab (`NOT_OWN_CITY`)
- weist eine Stadt mit Mauer ab (`WALL_EXISTS`)
- weist ab, wenn der Vorrat leer ist — die vierte Mauer geht nicht (`NO_PIECES_LEFT`)
- `handLimitOf`: ohne Mauer 7, mit einer 9, mit dreien 13
- `handLimitOf` an einem Basistisch: immer 7, weil `handLimitPerWall` dort null ist
- `discardCountFor` wirft mit zwei Mauern erst ab elf Karten ab

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`walls.ts` mit dem üblichen `can…`/`apply…`-Paar. `applyBuildWall` setzt
`wall: true` am Gebäude und zieht `wall` aus dem Vorrat.

`robber.ts`: `discardCountFor` benutzt `handLimitOf(state, player)` statt
`state.rules.handLimitBeforeDiscard`. Der Kopfkommentar bekommt einen Satz: **das Limit
ist keine Konstante mehr** — jede Stadtmauer hebt es, und die Zahl steht deshalb in
`walls.ts` und nicht hier.

Achtung auf den Ladezirkel: `robber.ts` importiert aus `cities/walls.ts`, und `walls.ts`
darf deshalb **nicht** aus `robber.ts` importieren. Prüfen, daß `walls.ts` nur `board`,
`errors`, `cards` und `state` zieht.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Hinter einer Mauer haelt man mehr Karten"
```

---

## Aufgabe 8: Der Überfall

**Dateien:**

- Ändern: `packages/shared/src/game/cities/barbarians.ts`
- Ändern: `packages/shared/src/game/cities/turn.ts`
- Test: `packages/shared/src/game/cities/barbarians.test.ts`
- Test: `packages/shared/src/game/cities/turn.test.ts`

**Schnittstellen — liefert:**

```ts
/** Wie viel dieser Spieler zur Verteidigung beigetragen hat. */
export function defenseContributions(state: GameState): ReadonlyMap<PlayerId, number>;

/** Der Ausgang eines Ueberfalls, gerechnet ohne ihn anzuwenden. */
export interface BarbarianOutcome {
  readonly barbarians: number;
  readonly defenders: number;
  readonly won: boolean;
  /** Wer den Retter-Chip bekommt. `null` bei Gleichstand oder Niederlage. */
  readonly savior: PlayerId | null;
  /** Wessen Stadt faellt, und welche. Leer, wenn die Ritter gewonnen haben. */
  readonly losses: readonly { readonly player: PlayerId; readonly vertex: VertexId }[];
}

export function barbarianOutcome(state: GameState): BarbarianOutcome;
export function applyBarbarianAttack(state: GameState): GameState;
```

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

_Fahrstrecke_

- `advanceShip` rückt bis auf das letzte Feld vor — die Wartelinie aus 10a ist weg
- `hasLanded` ist wahr, sobald `position >= track`

_Ausgang_

- Ritter genau so stark wie die Barbaren: **die Ritter gewinnen** (Gleichstand zugunsten
  der Verteidigung)
- der alleinige Höchstbeitragende bekommt einen Retter-Chip
- bei Gleichstand an der Spitze bekommt **niemand** einen Chip (bewußte Abweichung 1)
- wer nichts beigetragen hat, bekommt auch als einziger Spieler keinen Chip
- Barbaren stärker: **nur Städtebesitzer** sind betroffen, wer nur Siedlungen hat, bleibt
  verschont
- unter den Betroffenen verliert der mit den **wenigsten** Beitragspunkten
- bei Gleichstand der Niedrigsten verlieren **alle** von ihnen je eine Stadt
- eine verlorene Stadt wird zur **Siedlung**, die Mauer geht mit (`wall: false`, Mauer
  zurück in den Vorrat), `city +1` und `settlement -1` im Vorrat
- wer alle fünf Siedlungen verbaut hat: die zurückgestufte Stadt steht trotzdem da, und
  `settlement` fällt nicht unter null — geprüft wird, daß der Vorrat nie negativ wird
- **welche** Stadt fällt: zuerst eine ohne Mauer, dann die mit dem geringsten
  Ertragswert, bei Gleichstand die mit der kleineren Knoten-Id

_Nachher_

- alle aktivierten Ritter **aller** Spieler sind danach passiv
- das Schiff steht wieder auf Feld 0, `attacks` ist um eins gestiegen
- `robberIsFree` ist danach wahr

_Im Wurf_

- `resolveEvent` mit einer Schiffsseite auf dem vorletzten Feld läßt landen und wertet
  aus
- `resolveEvent` mit einer Stadttorseite rührt das Schiff nicht an

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`barbarians.ts`:

- Die Wartelinie in `advanceShip` fällt; der Kommentar dazu wird durch einen ersetzt, der
  sagt, daß die Grenze in 10b gefallen ist und warum sie einmal dastand.
- `defenseContributions` summiert je Spieler die Stufen seiner **aktivierten** Ritter.
- `barbarianOutcome` rechnet den Ausgang, **ohne** ihn anzuwenden. Getrennt, weil die
  Oberfläche denselben Vergleich zeigt (`BarbarianTrack`), und weil ein Test einen
  Ausgang prüfen kann, ohne einen halben Zug zu bauen.
- Den Ertragswert einer Stadt für die Auswahl: Summe über die angrenzenden Felder von
  `pipsOf(number)` = `6 - |7 - number|`, Wüste und Felder ohne Zahl zählen null. Als
  eigene, kommentierte Funktion `cityValueAt(state, vertex)` — mit dem Grund: **das ist
  die Wahl, die ein Mensch träfe**, und sie steht als Regel da statt als Zufall.
- `applyBarbarianAttack` wendet an: Chip oder Städteverluste, dann alle Ritter passiv,
  Schiff auf 0, `attacks + 1`.

`turn.ts`: nach `advanceShip` prüfen, ob gelandet wurde, und dann `applyBarbarianAttack`
aufrufen. Der Kopfkommentar wird um den Grund für die Reihenfolge ergänzt, der bisher als
Vorgriff dastand — jetzt gilt er wirklich.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game/cities
git commit -m "Die Barbaren landen"
```

---

## Aufgabe 9: Der Räuber bleibt stehen, bis sie gelandet sind

**Dateien:**

- Ändern: `packages/shared/src/game/robber.ts`
- Ändern: `packages/shared/src/game/reducer.ts` (`rollDice`)
- Test: `packages/shared/src/game/robber.test.ts`

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

- `canMoveRobber` weist ab, solange `barbarians.attacks === 0` (`ROBBER_LOCKED`)
- nach dem ersten Überfall geht es
- an einem Basistisch geht es immer — dort gibt es keine Barbaren, auf die man warten
  könnte
- eine Sieben vor dem ersten Überfall: es wird **abgeworfen**, danach geht es direkt
  nach `main`, ohne `robberPending`
- eine Sieben vor dem ersten Überfall **ohne** jemanden über dem Limit: direkt `main`
- eine Sieben **in der Runde des ersten Überfalls**: der Räuber darf schon versetzt
  werden — der Angriff kommt vor dem Ertrag, und `resolveEvent` läuft vor dem
  Sieben-Zweig

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

In `canMoveRobber` als **erste** Prüfung `robberIsFree(state)`. In `applyDiscard` und in
`rollDice` die Folgephase über eine gemeinsame Hilfe wählen:

```ts
/**
 * Wohin es nach einer Sieben weitergeht.
 *
 * Solange die Barbaren nicht gelandet sind, bleibt der Raeuber stehen - dann
 * ist mit dem Abwerfen alles getan. Eine Phase `robberPending`, in der jeder
 * Zug abgewiesen wird, waere ein Tisch, der auf nichts wartet.
 */
export function afterDiscardPhase(state: GameState): Phase;
```

Beide Aufrufer benutzen sie. Sie steht in `robber.ts`, weil dort die Sieben zu Hause ist.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Vor dem ersten Ueberfall ruehrt sich der Raeuber nicht"
```

---

## Aufgabe 10: Die Züge im Protokoll, im Reducer und in der Aktionsliste

**Dateien:**

- Ändern: `packages/shared/src/game/actions.ts`
- Ändern: `packages/shared/src/game/reducer.ts`
- Ändern: `packages/shared/src/game/legal.ts`
- Ändern: `packages/shared/src/game/scoring.ts`
- Test: `packages/shared/src/game/actions.test.ts`, `reducer.test.ts`, `legal.test.ts`,
  `scoring.test.ts`, `phase.test.ts`

**Neue Zugarten (flach in `GameActionSchema`, Spec 5.1):**

```ts
z.object({ ...Base, type: z.literal('buildWall'), vertex: z.string() }),
z.object({ ...Base, type: z.literal('buildKnight'), vertex: z.string() }),
z.object({ ...Base, type: z.literal('activateKnight'), vertex: z.string() }),
z.object({ ...Base, type: z.literal('upgradeKnight'), vertex: z.string() }),
z.object({ ...Base, type: z.literal('moveKnight'), from: z.string(), to: z.string() }),
z.object({ ...Base, type: z.literal('chaseRobber'), vertex: z.string() }),
z.object({ ...Base, type: z.literal('placeDisplacedKnight'), vertex: z.string() }),
```

Alle sieben gehören auch in `GAME_ACTION_TYPES` — der zweite Wächter
(`NoActionTypeForgotten`) fängt sonst den Compiler-Fehler, und genau dafür steht er da.

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

- `actions.test.ts`: jede der sieben Aktionen parst; `GAME_ACTION_TYPES` enthält sie
- `reducer.test.ts`:
  - `buildKnight` in `rollPending` wird abgewiesen (`WRONG_PHASE`)
  - `placeDisplacedKnight` darf **der Besitzer** schicken, auch wenn er nicht am Zug ist
  - `placeDisplacedKnight` von jemand anderem wird abgewiesen (`NOT_YOUR_TURN`)
  - `endTurn` setzt `upgradedThisTurn` aller Ritter zurück
  - nach einem gesetzten Ritter wird die Längste Handelsstraße neu gerechnet — ein
    Ritter mitten in einer fremden Fünferstraße nimmt ihr den Titel
- `legal.test.ts`: in `main` stehen `buildKnight`, `activateKnight`, `upgradeKnight`,
  `moveKnight`, `chaseRobber`, `buildWall`, sobald sie möglich sind — und keine davon an
  einem Basistisch
- `legal.test.ts`: in `displacePending` steht **nur** `placeDisplacedKnight`, und nur für
  den Besitzer
- `scoring.test.ts`: ein Retter-Chip zählt einen Punkt, und er zählt **öffentlich**
  (`publicVictoryPointsOf`)

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`reducer.ts`:

- `PHASE_ACTIONS.main` um die sechs Züge erweitern (ohne `placeDisplacedKnight`).
- `PHASE_ACTIONS.displacePending = ['placeDisplacedKnight']`.
- `actorFor`: `if (state.phase.kind === 'displacePending') return state.phase.owner;`
  Kommentar: der Besitzer setzt um, nicht der Angreifer — deshalb steht hier ein
  ausdrücklicher Zweig und nicht der Spieler am Zug.
- `applyAction` um sieben Zweige.
- `endTurn` setzt zusätzlich `knights` mit `upgradedThisTurn: false` zurück. Kommentar:
  über **alle** Ritter und nicht nur die des Spielers am Zug — aufwerten kann ohnehin nur
  er, und eine Schleife über alle ist eine Bedingung weniger, die falsch sein kann.

`scoring.ts`: `publicVictoryPointsOf` bekommt
`points += (hand?.defenderPoints ?? 0) * values.defender;`. Kommentar: die Chips liegen
offen, deshalb **public** und nicht erst in `victoryPointsOf`.

`legal.ts`, in `main`, über die Knoten des Bretts:

```ts
if (canBuildKnight(state, player, vertex) === null) …
if (canBuildWall(state, player, vertex) === null) …
if (canActivateKnight(state, player, vertex) === null) …
if (canUpgradeKnight(state, player, vertex) === null) …
if (canChaseRobber(state, player, vertex) === null) …
```

und für das Versetzen je eigenem Ritter, der handeln darf, über
`reachableVertices` statt über alle Knoten — sonst stünde für jeden Ritter das ganze
Brett in der Liste, und `canMoveKnight` liefe rund tausendmal je Aufruf.

Neuer Zweig `case 'displacePending':` — nur für `state.phase.owner`, über
`displacementTargets`.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Sieben neue Zuege, eine neue Phase"
```

---

## Aufgabe 11: Was der Spieler sieht und was im Verlauf steht

**Dateien:**

- Ändern: `packages/shared/src/game/playerView.ts`
- Ändern: `packages/shared/src/game/labels.ts`
- Ändern: `packages/shared/src/game/log.ts`
- Test: `packages/shared/src/game/playerView.test.ts`, `log.test.ts`

**`PlayerView` neu:**

```ts
/** Wer wo steht. **Oeffentlich** - Ritter stehen sichtbar auf dem Brett. */
knights: z.record(z.string(), KnightSchema).default({}),
/** Die Staerke der Ritter Catans, ueber alle Spieler. */
defenders: z.number().int().min(0).default(0),
```

`PlayerInView` neu: `defenderPoints: z.number().int().min(0).default(0)`.

**`labels.ts` neu:**

```ts
export const KNIGHT_LABELS: Readonly<Record<KnightLevel, string>> = {
  1: 'Einfacher Ritter',
  2: 'Starker Ritter',
  3: 'Mächtiger Ritter',
};
```

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

- `playerViewOf` trägt `knights` unverändert weiter — sie sind öffentlich
- `defenders` ist die Summe über **alle** aktivierten Ritter, nicht nur die eigenen
- `defenderPoints` steht bei jedem Spieler, nicht nur beim Empfänger
- Verlaufssätze:
  - `Anna baut einen Ritter`
  - `Anna setzt einem Ritter den Helm auf`
  - `Anna wertet einen Ritter zum Starken Ritter auf`
  - `Anna versetzt einen Ritter`
  - `Anna vertreibt Bens Ritter`
  - `Ben weicht mit seinem Ritter aus`
  - `Anna schickt einen Ritter hinter dem Räuber her`
  - `Anna baut eine Stadtmauer`
  - Der Wurf, der einen Überfall auslöst: `Anna würfelt 8 - die Barbaren landen, die
Ritter halten (4 gegen 3) - Ben wird Retter Catans` bzw. `… die Barbaren siegen (2
gegen 3) - Ben verliert eine Stadt`

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`log.ts`: `describeAction` bekommt sieben neue Zweige. Für `moveKnight` entscheidet der
Vergleich von vorher und nachher, ob versetzt oder vertrieben wurde — der Verlauf liest
aus dem Übergang und nicht aus der Absicht, dieselbe Haltung wie im Kopfkommentar der
Datei.

Für den Überfall eine eigene Hilfe `describeAttack(before, after, nameOf): string | null`,
die aus dem Unterschied von `barbarians.attacks` liest, ob einer stattgefunden hat, und
aus dem Unterschied von `buildings` bzw. `defenderPoints`, wie er ausging. Angehängt an
den `rollDice`-Satz. Kommentar: **aus dem Übergang gelesen und nicht aus einem Ereignis**
— dieselbe Begründung, die im Kopf der Datei schon steht.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Der Tisch sieht die Ritter, der Verlauf erzaehlt vom Ueberfall"
```

---

## Aufgabe 12: Ein Integrationstest bis zum ersten Überfall

**Dateien:**

- Ändern: `packages/shared/src/game/game.integration.test.ts`

- [x] **Schritt 1: Den Test schreiben**

Eine Partie nach `CITIES_RULES` über den Reducer, mit festem Seed:

1. Auftakt und Gründung durchspielen (jeder eine Siedlung und eine Stadt).
2. Ritter bauen, aktivieren, im nächsten Zug versetzen.
3. So oft würfeln, bis das Schiff siebenmal vorgerückt ist — die Würfe kommen aus dem
   Seed, also wird gezählt statt gesteuert; der Test läuft eine feste Zahl von Runden und
   prüft danach `attacks >= 1`.
4. Prüfen: `robberIsFree` ist wahr, alle Ritter sind passiv, das Schiff steht auf 0, und
   die Summe aus Städten und Retter-Chips paßt zum Ausgang.

Der Test darf **nicht** an einer bestimmten Wurffolge hängen. Was geprüft wird, sind die
Invarianten nach dem Überfall, nicht sein Ausgang.

- [x] **Schritt 2: Test laufen lassen und Erfolg sehen**

- [x] **Schritt 3: Commit**

```bash
git add packages/shared/src/game/game.integration.test.ts
git commit -m "Eine Partie bis zur Kueste"
```

---

## Aufgabe 13: Ritter und Mauern auf dem Brett

**Dateien:**

- Ändern: `apps/client/src/board/shapes.ts`
- Ändern: `apps/client/src/board/BoardSvg.tsx`
- Ändern: `apps/client/src/index.css`
- Test: `apps/client/src/board/BoardSvg.test.tsx`

**Der Entwurf (Designregel 1), für die neuen Formen:**

- **Rolle:** ein Ritter sagt auf einen Blick drei Dinge — wem er gehört, wie stark er ist
  und ob er handeln kann. **Aufbau:** dieselbe Bildsprache wie Siedlung und Stadt, rund
  20 Einheiten breit um den Nullpunkt, in `board/shapes.ts` neben ihnen. **Woran man sich
  erinnert:** die Spitzen an der Fahne — man **zählt** sie, statt Größen zu vergleichen.
- **Die Stufe steht als Fähnchenspitzen**, eine, zwei oder drei. So unterscheidet das
  Spiel selbst („Die Stärke eines Ritters wird durch die Anzahl der Spitzen an der Fahne
  dargestellt"), und Größe ist die schwächste Unterscheidung, die es gibt — derselbe
  Grund, aus dem die Stadt kein größerer Punkt ist.
- **Aktiv/passiv über den Helm**, nicht über Deckkraft. Ein halbtransparenter Ritter
  liest sich als „gesperrt", nicht als „ruht".
- **Die Mauer ist ein Sockel unter der Stadt** — sie sitzt am Gebäude, weil sie dort
  hingehört, und sie verbreitert die Silhouette, ohne sie zu ersetzen.

**Schnittstellen — liefert:**

```ts
/** Der Ritter ohne Fahne: Sockel und Rumpf. */
export const KNIGHT_PATH: string;
/** Die Fahnenspitzen je Stufe - eine, zwei, drei. */
export const KNIGHT_PENNANTS: Readonly<Record<1 | 2 | 3, string>>;
/** Der Helm des aktivierten Ritters. */
export const KNIGHT_HELMET_PATH: string;
/** Der Mauersockel unter einer Stadt. */
export const WALL_PATH: string;
```

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

`BoardSvg.test.tsx`:

- ein Ritter auf einem Knoten erscheint als `[data-testid="knight-<vertex>"]` und trägt
  die Sitzfarbe **per `style`** (nicht als Attribut)
- er trägt `data-level` mit seiner Stufe und `data-active`
- ein aktivierter Ritter zeigt zusätzlich den Helm, ein passiver nicht
- eine Stadt mit Mauer zeigt `[data-testid="wall-<vertex>"]`, eine ohne nicht
- die Zahl der Spitzen entspricht der Stufe (drei Pfade bei Stufe 3)

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`shapes.ts`: die vier Pfade im Raster `-10 -9 20 17` (`VIEWBOX`), mit demselben
Kopfkommentar-Ton wie die bestehenden. Die Spitzen sitzen an einem Fahnenmast rechts vom
Rumpf, damit sie auch bei kleiner Darstellung einzeln stehen.

`BoardSvg.tsx`:

- `BoardSource` bekommt `knights: GameState['knights']`.
- `VertexMark` zeichnet den Ritter, wenn `state.knights[vertex]` gesetzt ist — an
  derselben Stelle, an der sonst das Bauwerk steht, mit demselben `translate/scale`-Muster
  und derselben `key`-Regel: `key={`knight-${knight.level}-${knight.active}`}`, damit die
  Einblendung beim Aufwerten und beim Aufsetzen des Helms **noch einmal** läuft. Der
  Kommentar dazu verweist auf die Falle in `CLAUDE.md` (eine Animation, die beim
  Einhängen läuft, läuft beim Aktualisieren nicht).
- Die Mauer zeichnet `VertexMark` **unter** der Stadt, vor dem Bauwerkspfad.
- `BUILDING_SCALE` bekommt einen Eintrag `knight` — Ritter etwas kleiner als eine
  Siedlung (sie stehen dichter beieinander, weil für sie keine Abstandsregel gilt). Der
  Faktor wird nach dem Browser-Durchgang (Aufgabe 16) nachgemessen und dort begründet.

`index.css`: `.knight`, `.knight__pennant`, `.knight__helmet`, `.wall`. Keine Farbe im
Blatt, die die Sitzfarbe schlägt — die kommt per `style`. Spezifität der neuen Regeln
gegen `.vertex …` nachzählen.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add apps/client/src/board apps/client/src/index.css
git commit -m "Ritter mit Fahne, Staedte mit Sockel"
```

---

## Aufgabe 14: Die neuen Ziele in der Klickkarte

**Dateien:**

- Ändern: `apps/client/src/game/targets.ts`
- Test: `apps/client/src/game/targets.test.ts`

**Schnittstellen — `ActionTargets` neu:**

```ts
export type BuildableKind = 'road' | 'settlement' | 'city' | 'wall' | 'knight';

/** Die Ritterzuege, je nach Art an ihrem Ort. */
readonly knightBuild: ReadonlyMap<VertexId, GameAction>;
readonly wallBuild:  ReadonlyMap<VertexId, GameAction>;
readonly activate:   ReadonlyMap<VertexId, GameAction>;
readonly upgrade:    ReadonlyMap<VertexId, GameAction>;
readonly chase:      ReadonlyMap<VertexId, GameAction>;
/** Von welcher Kreuzung wohin. Zwei Klicks, deshalb zwei Ebenen. */
readonly moves:      ReadonlyMap<VertexId, ReadonlyMap<VertexId, GameAction>>;
readonly displace:   ReadonlyMap<VertexId, GameAction>;
```

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

- `buildKnight` und `buildSettlement` auf **demselben** Knoten landen in verschiedenen
  Karten und werfen nicht (`claim` würde sonst „doppelt belegt" melden) — das ist der
  eigentliche Grund für die eigenen Karten, und der Test hält ihn fest
- `buildable.knight` und `buildable.wall` zählen ihre Stellen
- `moves` gruppiert nach Ausgangskreuzung
- `displace` sammelt `placeDisplacedKnight`

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`targetsFrom` bekommt die neuen Zweige, `EMPTY_TARGETS` die leeren Karten, `buildKindOf`
die zwei neuen Bauteile. Kommentar an den eigenen Karten: **warum nicht in `vertices`** —
auf einer freien Kreuzung sind Siedlung **und** Ritter zugleich möglich, und die
`claim`-Sperre gegen doppelte Belegung ist richtig und soll bleiben.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add apps/client/src/game/targets.ts apps/client/src/game/targets.test.ts
git commit -m "Zwei Zuege auf derselben Kreuzung"
```

---

## Aufgabe 15: Die Bedienung — Bauleiste, Ritterleiste, Ausweichen

**Dateien:**

- Ändern: `apps/client/src/panels/ActionPanel.tsx`
- Neu: `apps/client/src/panels/KnightPanel.tsx`
- Ändern: `apps/client/src/panels/BarbarianTrack.tsx`
- Ändern: `apps/client/src/screens/GameScreen.tsx`
- Ändern: `apps/client/src/game/view.ts`
- Ändern: `apps/client/src/game/labels.ts`
- Ändern: `apps/client/src/index.css`
- Test: `apps/client/src/panels/KnightPanel.test.tsx` (**neu**),
  `apps/client/src/screens/GameScreen.test.tsx`

**Der Entwurf (Designregel 1) für die Ritterleiste:**

- **Rolle:** die Antwort auf „was kann ich mit meinen Rittern jetzt tun". Vier Fragen,
  vier Knöpfe, jeder genau dann bedienbar, wenn es dafür eine Stelle gibt.
- **Aufbau:** eine Reihe neben der Bauleiste, dieselbe Bauform wie dort — Symbol groß,
  Wort im `title` und für Vorlesewerkzeuge. Sie erscheint **gar nicht**, wenn dieser Tisch
  keine Ritter kennt; ein leerer Rahmen wäre eine Auskunft über nichts.
- **Woran man sich erinnert:** daß ein Klick auf einen Knopf das Brett zum Sprechen
  bringt — dasselbe Zwei-Schritt-Muster wie beim Bauen, und deshalb dieselbe
  Hinweisleiste (`.mode`) unten.

**Warum keine Knöpfe am einzelnen Ritter:** ein Ritter ist auf dem Brett rund zwanzig
Pixel groß. Vier Aktionen daran wären vier Trefferflächen unter Fingergröße, und drei
davon wären fast immer gesperrt. Die Frage kommt zuerst („was tun"), die Stelle danach —
genau wie beim Bauen seit dem Playtest.

- [x] **Schritt 1: Die fehlschlagenden Tests schreiben**

`KnightPanel.test.tsx`:

- alle vier Knöpfe sind gesperrt, wenn die Klickkarte nichts anbietet
- ein Knopf geht an, sobald es für ihn eine Stelle gibt
- ein Klick meldet den Modus nach oben, ein zweiter schaltet ihn wieder aus
- **die Leiste erscheint nicht**, wenn das Regelwerk keinen Ritterpreis nennt

`GameScreen.test.tsx`:

- „Ritter" in der Bauleiste zeigt auf dem Brett die Kreuzungen, auf denen einer gebaut
  werden kann — und **nicht** die Siedlungsstellen
- „Versetzen" leuchtet zuerst die eigenen handlungsfähigen Ritter an; nach dem Klick auf
  einen davon nur noch dessen Ziele
- in `displacePending` steht die Hinweisleiste „Wohin weicht dein Ritter aus?", und nur
  die Ausweichkreuzungen leuchten
- die Bauleiste zeigt an einem Basistisch weiterhin genau drei Bauteile

- [x] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [x] **Schritt 3: Umsetzen**

`ActionPanel.tsx`:

- Statt über `PIECE_IDS` über eine eigene Liste
  `BUILD_PIECES: readonly BuildableKind[] = ['road','settlement','city','wall','knight']`,
  **gefiltert auf `costs[kind] !== undefined`**. Kommentar: was das Regelwerk nicht
  preist, gibt es an diesem Tisch nicht — dieselbe Regel, nach der schon der Kaufstapel
  wegfällt. Ohne den Filter stünden an einem Basistisch zwei Knöpfe, die nie angehen.
- Der Vorrat am Ritterknopf ist `piecesLeft.knight1` — man baut immer den Einfachen. Der
  Kommentar sagt es, damit die Zahl nicht als „alle Ritter" gelesen wird.
- `BUILD_LABELS` und `STOCK_LABELS` um `wall` („Stadtmauer" / „Stadtmauern") und `knight`
  („Ritter" / „Ritter") ergänzen.

`KnightPanel.tsx`: vier Knöpfe (`activate`, `upgrade`, `move`, `chase`) mit
`aria-pressed`, `disabled` und `title` nach dem Vorbild der Bauleiste. Die Symbole:
Helm, aufwärts weisende Fahnenspitze, zwei Fußspuren, der Räuberstein — alle im
24er-Raster wie die übrigen Zeichen.

`GameScreen.tsx`:

- `knightMode: 'activate' | 'upgrade' | 'move' | 'chase' | null` und
  `movingFrom: VertexId | null` als Zustand, beide zurückgesetzt bei `view.version`
  (dieselbe Stelle, an der `buildMode` schon zurückgesetzt wird — der Kommentar dort gilt
  wörtlich weiter).
- `buildMode` und `knightMode` schließen einander aus: wer den einen setzt, löscht den
  anderen. Kommentar: zwei gleichzeitig leuchtende Absichten wären genau das Raten, gegen
  das der zweite Schritt eingeführt wurde.
- `boardTargets` bekommt vor den bestehenden Fällen zwei neue: `displacePending` (immer,
  ohne Modus — es ist keine Wahl, sondern eine Pflicht, genau wie der Räuber) und
  `knightMode` (die passende Karte, beim Versetzen zweistufig über `movingFrom`).
  Ebenso `buildMode === 'knight' | 'wall'` → die eigenen Karten statt der gefilterten
  `vertices`.
- `commit` für einen Knoten sieht in dieser Reihenfolge nach: `displace`, dann
  `knightMode`, dann `targets.vertices` wie bisher.
- Die Hinweisleiste `.mode` bekommt Texte für die vier Rittermodi und für
  `displacePending`.
- `BarbarianTrack` bekommt `defenders={view.defenders}` statt `null`. Der Kommentar dort
  („die Zahl kommt in Etappe 10b dazu") wird durch den ersetzt, der jetzt gilt.

`BarbarianTrack.tsx`: `defenders` bleibt `number | null` — `null` heißt weiterhin „an
diesem Tisch gibt es keine Ritter". Neu: die beiden Zahlen stehen **gegeneinander**, und
die Leiste sagt mit einer Klasse, wer gerade vorn liegt (`--holding` /
`--losing`). Das ist die Gewichtung, die 10a bewußt vertagt hat, weil sie erst mit dem
Vergleich entsteht. Farbe ist dabei nicht der einzige Träger (Designregel 7): das Wort
darunter sagt „hält" bzw. „unterlegen".

`view.ts`: `phaseTextOf` bekommt `displacePending` — „<Name> setzt seinen vertriebenen
Ritter um". `discardCountForView` rechnet mit `handLimitOf` aus `shared` statt mit
`rules.handLimitBeforeDiscard`; die Sicht hat `buildings` und `rules`, also genügt sie
der `HandLimitSource`. Der bestehende Test, der beide Rechnungen vergleicht, deckt das
mit ab.

- [x] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [x] **Schritt 5: Commit**

```bash
git add apps/client/src
git commit -m "Erst was, dann wo - auch fuer Ritter"
```

---

## Aufgabe 16: Der Durchgang im Browser

**Kein Test ersetzt das.** Der Durchgang in 10a hat vier Befunde geliefert, die kein Test
gefunden hat — Überlappungen, eine nie greifende CSS-Regel, ein Knopf, der „gerade nicht"
über etwas sagte, das nie ging. Diese Etappe bringt mehr neue Fläche als 10a.

- [x] **Schritt 1: Bauen und starten**

`pnpm build`, danach den Server starten und eine lokale Städte-&-Ritter-Partie öffnen.

- [x] **Schritt 2: Durchsehen und messen**

Nachzusehen, jedes mit einer **gemessenen** Zahl statt einer Einschätzung:

1. Ein Ritter auf dem Brett: Größe im Verhältnis zu Siedlung und Zahlenchip, Farbe,
   Zählbarkeit der Spitzen, Sichtbarkeit des Helms. Gemessen am **eingehängten** Element,
   nicht an einem geklonten SVG (die Falle aus 10a).
2. Zwei Ritter auf benachbarten Kreuzungen — für sie gilt keine Abstandsregel, also
   stehen sie näher beieinander als je zwei Bauwerke. Überlappen sie?
3. Der Mauersockel unter einer Stadt: erkennt man ihn, und schluckt er die Stadtform?
4. Die Bauleiste mit fünf Bauteilen: paßt sie in die Ecke, und paßt sie noch unter
   40 rem?
5. Die Ritterleiste: erscheint sie an einem Basistisch **nicht**?
6. Die Barbarenleiste mit zwei Zahlen: Kontrast beider Seiten auf ihrem Grund, und ist
   ohne die Farbe erkennbar, wer vorn liegt?
7. Jeder der vier Rittermodi: leuchtet das Brett an den richtigen Stellen, und geht der
   Modus mit einem zweiten Klick wieder aus?
8. Ein gesperrter Knopf ist **gemessen** anders als ein offener (die Falle aus
   `CLAUDE.md`: `disabled` allein sieht man nicht).
9. Absichtlich das drücken, was niemand drückt — „Aufwerten" mit einem Mächtigen Ritter,
   „Räuber vertreiben" vor dem ersten Überfall.
10. Die zwei Viewport-Breakpoints (`26rem`, `62rem`) — sie sind seit Etappe 8 offen und
    sollen es nach dieser Etappe nicht immer noch sein.

- [x] **Schritt 3: Befunde beheben und die Zahl dazu notieren**

Jeder Befund wird an seiner **Ursache** behoben, nicht an seiner Fundstelle
(`CLAUDE.md`), und mit der Messung davor und danach in `PROGRESS.md` festgehalten.

- [x] **Schritt 4: Commit**

```bash
git add -A
git commit -m "Was der Browser zu den Rittern gesagt hat"
```

---

## Aufgabe 17: Abnahme und `PROGRESS.md`

- [x] **Schritt 1: Volle Abnahme**

```bash
pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Die Zahlen aus dem Testlauf (je Paket Tests/Dateien) und die Bundlegröße aus dem Build
**abschreiben**, nicht schätzen — eine erfundene Zahl macht die ganze Tabelle wertlos.

- [x] **Schritt 2: Den Abschnitt schreiben**

`PROGRESS.md`, in der bestehenden Form:

- Überschrift und Stand (Datum, Branch, Commits)
- **Abnahme** als Tabelle mit den gemessenen Zahlen
- **Getroffene Entscheidungen** — je Absatz eine, fett angeführt, mit dem Grund.
  Mindestens: Ritter im `GameState` statt beim Spieler; `activatedOnTurn` als Zahl statt
  als Flag; je Stufe ein eigener Vorrat; `moveKnight` deckt das Vertreiben mit ab; die
  Auffüllung von `pieceStock` und `piecesLeft`; `improvements` als einziges Feld aus 10c,
  weil die Festung sonst nicht prüfbar wäre; `handLimitOf` an **einem** Ort für Browser
  und Server; die eigenen Zielkarten im Client, weil auf einer freien Kreuzung zwei Züge
  zugleich möglich sind.
- **Abweichungen vom Plan**, falls es welche gab.
- **Offene Punkte** — darunter **wörtlich** die drei bewußten Abweichungen aus dem Kopf
  dieses Plans, dazu: die Zugzeit für Ritter- und Ausweichzüge ist weiterhin unbefristet
  (`deadlineOf` wäre die Stelle), die Variante „mehr Taktik" fehlt, und was der
  Browser-Durchgang offengelassen hat.
- **Nächste Etappe:** 10c — Stadtausbau und Metropolen.

- [x] **Schritt 3: Commit**

```bash
git add PROGRESS.md
git commit -m "Was in 10b entschieden wurde"
```

---

## Selbstprüfung gegen die Spec

| Spec-Stelle                                   | Aufgabe                        |
| --------------------------------------------- | ------------------------------ |
| 2.1 `knights`, `KnightSchema`                 | 2                              |
| 2.1 `barbarians` (schon da), Landung          | 8                              |
| 2.2 `defenderPoints`                          | 1, 10                          |
| 2.3 `Building.wall`                           | 2, 7                           |
| 2.4 Ritterstärke wird gerechnet, nicht gelegt | 4 (`catanStrength`)            |
| 3 `BUILDABLE_IDS` / `PIECE_IDS` wachsen       | 1                              |
| 3 Aufwerten verschiebt zwischen den Vorräten  | 4                              |
| 5.1 sieben neue Zugarten                      | 10                             |
| 5.3 `displacePending`                         | 6                              |
| 5.3 `defenderPending`                         | vertagt auf 10d — Abweichung 1 |
| 5.4 `recomputeLongestRoad` kennt Ritter       | 3                              |
| 5.4 Reihenfolge im Wurf                       | 8, 9                           |
| 6 Modulschnitt `cities/`                      | 4, 5, 6, 7, 8                  |
| 8.1 Rittersilhouetten                         | 13                             |
| 8.2 Mauersockel                               | 13                             |
| 8.5 Barbarenleiste mit zwei Zahlen            | 15                             |
| 9 „10b" vollständig                           | alle                           |
| 10 Integrationstest bis zum ersten Überfall   | 12                             |
| 10 Im Browser nachgesehen                     | 16                             |

**Nicht in 10b und mit Absicht:** `improveCity`, `progressDecks`, die Metropole, der
Händler, Burg 1 / Burg 2. Das Feld `improvements` steht als einziges Stück 10c schon da,
und der Grund steht in Aufgabe 1.
