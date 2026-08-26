# Etappe 10c — Stadtausbau und Metropolen

> **Für agentische Ausführung:** ERFORDERLICHE UNTER-SKILL: `superpowers:executing-plans`
> (oder `superpowers:subagent-driven-development`). Die Schritte tragen Checkboxen.

**Ziel:** Die drei Ausbaubereiche mit ihren fünf Stufen und Preisen, der Zusatznutzen ab
Stufe 3 (Aquädukt, Gilde, Festung), die drei Metropolen samt Übergabe bei Stufe 5 und der
Regel über die freie Stadt — dazu am Bildschirm das Fortschritt-Tableau und die kompakte
Leiste je Mitspieler.

**Ansatz:** Die Stufenliste, ihre Preise und ihre Namen liegen in `shared`
(`game/cities/tracks.ts`), weil der Server den Verlaufssatz baut und zwei Namenslisten
auseinanderliefen. Der Zusatznutzen ab Stufe 3 ist **kein Zustandsfeld**, sondern eine
Frage an die Stufe (`hasAqueduct`, `hasGuild`, `hasFortress`). Die Metropole steht **am
Gebäude** (`Building.metropolis`) und nicht in einer Tabelle beim Spieler — dieselbe
Begründung wie bei der Stadtmauer in 10b. Jedes neue Zustandsfeld trägt einen
Vorgabewert, damit gespeicherte Partien weiter parsen.

**Technik:** TypeScript strict · Zod 4 · Vitest · React 19 + SVG · pnpm-Monorepo

**Spec:** `docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md` (Abschnitte
2.2, 2.3, 2.4, 4 „Bereiche", 5.1 `improveCity`, 5.4, 6, 8.2, 8.4, 9)
**Regelquelle:** `docs/regeln-staedte-und-ritter.md` (Abschnitt 8, ohne 8.1)
**Vorgänger:** Etappe 10b, `PROGRESS.md` ab „Etappe 10b — Ritter und Barbaren"

## Globale Rahmenbedingungen

Diese gelten für **jede** Aufgabe und werden nicht wiederholt:

- **Antworten auf Deutsch, Code und Bezeichner auf Englisch.** Sichtbare Texte deutsch,
  mit Umlauten — das schließt Stufennamen und Verlaufssätze ein. Kommentare deutsch, in
  `shared` und `server` **ohne** Umlaute (`ue`, `ae`, `oe`, `ss`); im Client mit Umlauten.
- **`shared` hat keine Runtime-Dependency außer `zod`.**
- **Spiellogik ist pur:** `(state, action) => newState`. Kein `Math.random()`, kein
  `Date.now()`, kein I/O. Zufall nur über den `rng` im Zustand.
- **Jede Regel zweimal:** `can…` prüft nur und gibt `RuleViolation | null`, `apply…`
  prüft und wendet an und gibt `ReduceResult`. `legalActions` benutzt dieselben `can…`.
- **Neue Logik in `shared` bekommt Tests.**
- **Jedes neue Zustandsfeld bekommt einen Vorgabewert** (`.default(…)`), und jeder
  `z.record` mit Enum-Schlüssel, der um Schlüssel wachsen kann, ist ein
  `z.partialRecord` mit auffüllendem `.transform`. Grund: seit Etappe 6 liegt der
  **Startzustand** jeder Partie als JSON in der Datenbank.
- **Kein Hex-Wert in einer Komponente.** Farben kommen aus `index.css`-Variablen; die
  Bereichsfarben stehen dort schon als `--track-trade`, `--track-politics`,
  `--track-science`. Farben am SVG per `style`, nie als Attribut.
- **Spezifität nachzählen**, wenn eine neue CSS-Regel eine bestehende schlagen soll
  (`CLAUDE.md`; die Falle ist inzwischen viermal zugeschnappt).
- **Designregel 7:** Farbe ist nie der einzige Träger. Jede Bereichsfarbe steht neben
  einem Wort oder einer Form.
- **Trefferflächen mindestens 44 px** — die Lehre aus dem Browser-Durchgang zu 10b, wo
  die Ritterknöpfe mit 32,2 px unter Fingergröße lagen.
- **`PROGRESS.md` wird mitgeschrieben**, nicht nachgereicht (Aufgabe 12).
- **Commit-Botschaften ohne `Co-Authored-By`.**
- Branch: `etappe-10-staedte-und-ritter`. Ausgangspunkt: `e08c3d6`.
- Abnahme je Aufgabe: `pnpm typecheck` und die betroffenen Tests. Volle Abnahme
  (`pnpm typecheck && pnpm test && pnpm build && pnpm format:check`) in Aufgabe 12.

## Bewußte Abweichungen von Spec und Regelwerk

Zwei Stellen weichen ab, beide mit Grund. Sie gehören **wörtlich** in den
`PROGRESS.md`-Abschnitt von 10c.

1. **Die freie Stadt ist nur nötig, wenn der Aufsatz auch wirklich kommt.** Die Anleitung
   sagt, wer nur eine Stadt hat und die schon Metropole ist, komme in den anderen
   Bereichen nur bis Stufe 3. Sie sagt nicht, ob das auch gilt, wenn die Metropole des
   Bereichs längst einer anderen Person gehört und Stufe 4 also gar keinen Aufsatz
   einbringt. Wir legen es so aus: die freie Stadt ist Bedingung genau dann, wenn dieser
   Ausbau die Metropole **einbringt**. Alles andere bestrafte jemanden für einen
   Wettlauf, den er ohnehin schon verloren hat.
2. **Die Fortschrittskarten kommen nicht in 10c.** `progressThreshold` steht hier
   trotzdem, weil das Tableau die rote Ziffer je Stufe **anzeigt** — das ist die Zahl,
   nach der man beim Würfeln sucht, und ohne sie wäre die Leiter eine Treppe ohne Ziel.
   Gezogen wird erst in 10d; die drei Stadttore des Ereigniswürfels bleiben bis dahin
   wirkungslos.

## Dateiplan

| Datei                                               | Rolle                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/shared/src/game/cities/tracks.ts`         | ändern — Stufennamen, Preise, Schwelle, `TRACK_COMMODITY`, Zusatznutzen |
| `packages/shared/src/rules/ruleset.ts`              | ändern — `victoryPoints.metropolis`, `improveCity` als Buildable        |
| `packages/shared/src/rules/cities.ts`               | ändern — `victoryPoints.metropolis: 2`                                  |
| `packages/shared/src/game/state.ts`                 | ändern — `Building.metropolis`                                          |
| `packages/shared/src/game/cities/improvements.ts`   | **neu** — `canImproveCity` / `applyImproveCity`, Metropolenvergabe      |
| `packages/shared/src/game/cities/knights.ts`        | ändern — `hasFortress` zieht nach `tracks.ts` um                        |
| `packages/shared/src/game/cities/barbarians.ts`     | ändern — Metropolen sind vor den Barbaren geschützt                     |
| `packages/shared/src/game/trade.ts`                 | ändern — die Gilde tauscht Handelswaren 2:1                             |
| `packages/shared/src/game/yield.ts`                 | ändern — das Aquädukt für den, der leer ausgeht                         |
| `packages/shared/src/game/cities/turn.ts`           | ändern — das Aquädukt in den Wurf einhängen                             |
| `packages/shared/src/game/scoring.ts`               | ändern — die Metropole als Summand                                      |
| `packages/shared/src/game/actions.ts`               | ändern — `improveCity` mit `track` und optionalem `metropolisAt`        |
| `packages/shared/src/game/errors.ts`                | ändern — neue Ablehnungsgründe                                          |
| `packages/shared/src/game/reducer.ts`               | ändern — Verteiler und Phasenliste                                      |
| `packages/shared/src/game/legal.ts`                 | ändern — `improveCity` aufzählen                                        |
| `packages/shared/src/game/playerView.ts`            | ändern — `improvements` sind öffentlich                                 |
| `packages/shared/src/game/log.ts`                   | ändern — „hat die Gilde gebaut", Metropolenwechsel                      |
| `packages/shared/src/game/game.integration.test.ts` | ändern — eine Partie bis zur ersten Metropole                           |
| `apps/client/src/board/shapes.ts`                   | ändern — der Metropolenaufsatz                                          |
| `apps/client/src/board/BoardSvg.tsx`                | ändern — den Aufsatz zeichnen                                           |
| `apps/client/src/panels/TrackPanel.tsx`             | **neu** — das Fortschritt-Tableau                                       |
| `apps/client/src/panels/TrackStrip.tsx`             | **neu** — die kompakte Dreierleiste je Mitspieler                       |
| `apps/client/src/panels/TablePanel.tsx`             | ändern — die Leiste je Sitz einhängen                                   |
| `apps/client/src/screens/GameScreen.tsx`            | ändern — das Tableau stellen                                            |
| `apps/client/src/game/targets.ts`                   | ändern — `improveCity` und die Metropolenwahl                           |
| `apps/client/src/index.css`                         | ändern — Tableau, Leiste, Aufsatz                                       |
| `PROGRESS.md`                                       | ändern — Abschnitt 10c                                                  |

---

## Aufgabe 1: Die Bereiche bekommen ihre Stufen

**Warum zuerst:** alles andere fragt diese Tabelle. Solange sie nicht steht, hätte jede
Regel ihre eigene Vorstellung von „Stufe 3".

**Dateien:**

- Ändern: `packages/shared/src/game/cities/tracks.ts`
- Ändern: `packages/shared/src/game/cities/knights.ts` (`hasFortress` zieht um)
- Test: `packages/shared/src/game/cities/tracks.test.ts` (**neu**)

**Schnittstellen — liefert:**

```ts
// game/cities/tracks.ts
/** Womit ein Bereich bezahlt wird. */
export const TRACK_COMMODITY: Readonly<Record<TrackId, CommodityId>> = {
  trade: 'cloth',
  politics: 'coin',
  science: 'paper',
};

/**
 * Die fuenf Stufen je Bereich, von 1 bis 5 - mit ihrem Artikel.
 *
 * Der Artikel steht **daneben** und nicht im Namen: der Verlaufssatz braucht
 * ihn ("Anna baut **die** Gilde"), das Tableau nicht (dort steht "Gilde" unter
 * der Stufe). Ihn in den Namen zu schreiben und zum Anzeigen abzuschneiden
 * waere eine Grammatik im Code - dieselbe Falle, die in 10b zu
 * `KNIGHT_LABELS_DATIVE` gefuehrt hat. Fuenfzehn deutsche Artikel folgen keiner
 * Regel, die man ableiten koennte.
 */
export interface TrackStep {
  readonly name: string;
  /** "der", "die" oder "das" - fuer den Verlaufssatz. */
  readonly article: 'der' | 'die' | 'das';
}

export const TRACK_STEPS: Readonly<Record<TrackId, readonly TrackStep[]>> = {
  science: [
    { name: 'Schule', article: 'die' },
    { name: 'Bibliothek', article: 'die' },
    { name: 'Aquädukt', article: 'das' },
    { name: 'Theater', article: 'das' },
    { name: 'Universität', article: 'die' },
  ],
  trade: [
    { name: 'Markt', article: 'der' },
    { name: 'Zunft', article: 'die' },
    { name: 'Gilde', article: 'die' },
    { name: 'Bank', article: 'die' },
    { name: 'Handelszentrum', article: 'das' },
  ],
  politics: [
    { name: 'Rathaus', article: 'das' },
    { name: 'Botschaft', article: 'die' },
    { name: 'Festung', article: 'die' },
    { name: 'Gericht', article: 'das' },
    { name: 'Rat Catans', article: 'der' },
  ],
};

/** Die hoechste Stufe, die ein Bereich hat. */
export const MAX_TRACK_LEVEL = 5;

/** Ab welcher Stufe der Aufsatz vergeben wird. */
export const METROPOLIS_LEVEL = 4;

/** Die n-te Stufe kostet n Handelswaren ihrer Sorte. */
export function improvementCost(track: TrackId, level: number): CardAmounts;

/** Wie die n-te Stufe dieses Bereichs heisst - ohne Artikel. */
export function stepName(track: TrackId, level: number): string;

/** Dieselbe Stufe mit Artikel: "die Gilde", "das Theater", "der Rat Catans". */
export function stepWithArticle(track: TrackId, level: number): string;

/** Ab welcher roten Augenzahl abwaerts eine Fortschrittskarte faellt: Stufe + 1. */
export function progressThreshold(level: number): number;

/** Die erreichte Stufe dieses Spielers in diesem Bereich. */
export function levelOf(player: PlayerState, track: TrackId): number;

export function hasAqueduct(player: PlayerState): boolean; // science >= 3
export function hasGuild(player: PlayerState): boolean; // trade >= 3
export function hasFortress(player: PlayerState): boolean; // politics >= 3
```

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/game/cities/tracks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { EMPTY_CARDS } from '../cards.js';
import { gameWithCities } from '../fixtures.js';
import type { PlayerState } from '../player.js';
import {
  FORTRESS_LEVEL,
  MAX_TRACK_LEVEL,
  METROPOLIS_LEVEL,
  TRACK_COMMODITY,
  TRACK_IDS,
  TRACK_STEPS,
  hasAqueduct,
  hasFortress,
  hasGuild,
  improvementCost,
  levelOf,
  progressThreshold,
  stepName,
  stepWithArticle,
} from './tracks.js';

function playerWith(improvements: PlayerState['improvements']): PlayerState {
  return { ...gameWithCities().players[0]!, improvements };
}

describe('Die drei Bereiche', () => {
  it('haben je fuenf Stufen', () => {
    for (const track of TRACK_IDS) {
      expect(TRACK_STEPS[track]).toHaveLength(MAX_TRACK_LEVEL);
    }
  });

  it('werden je mit einer eigenen Handelsware bezahlt', () => {
    expect(new Set(Object.values(TRACK_COMMODITY)).size).toBe(TRACK_IDS.length);
  });

  it('nennt die dritte Stufe beim Namen', () => {
    expect(stepName('science', 3)).toBe('Aquädukt');
    expect(stepName('trade', 3)).toBe('Gilde');
    expect(stepName('politics', 3)).toBe('Festung');
  });

  it('kennt zu jedem Namen seinen Artikel', () => {
    expect(stepWithArticle('trade', 3)).toBe('die Gilde');
    expect(stepWithArticle('science', 4)).toBe('das Theater');
    expect(stepWithArticle('politics', 5)).toBe('der Rat Catans');
  });

  it('wirft fuer eine Stufe, die es nicht gibt', () => {
    expect(() => stepName('trade', 6)).toThrow(RangeError);
  });

  it('setzen Festung und Metropole auf die Stufen, an denen sie haengen', () => {
    expect(FORTRESS_LEVEL).toBe(3);
    expect(METROPOLIS_LEVEL).toBe(4);
  });
});

describe('improvementCost', () => {
  it('nimmt fuer die n-te Stufe n Handelswaren ihrer Sorte', () => {
    expect(improvementCost('trade', 1)).toEqual({ ...EMPTY_CARDS, cloth: 1 });
    expect(improvementCost('science', 4)).toEqual({ ...EMPTY_CARDS, paper: 4 });
    expect(improvementCost('politics', 5)).toEqual({ ...EMPTY_CARDS, coin: 5 });
  });

  it('wirft fuer eine Stufe, die es nicht gibt', () => {
    expect(() => improvementCost('trade', 0)).toThrow(RangeError);
    expect(() => improvementCost('trade', 6)).toThrow(RangeError);
  });
});

describe('progressThreshold', () => {
  it('gibt Stufe plus eins', () => {
    expect(progressThreshold(1)).toBe(2);
    expect(progressThreshold(5)).toBe(6);
  });
});

describe('levelOf und der Zusatznutzen', () => {
  it('nennt einen nicht begonnenen Bereich null', () => {
    expect(levelOf(playerWith({}), 'science')).toBe(0);
  });

  it('gibt das Aquaedukt ab Wissenschaft drei', () => {
    expect(hasAqueduct(playerWith({ science: 2 }))).toBe(false);
    expect(hasAqueduct(playerWith({ science: 3 }))).toBe(true);
  });

  it('gibt die Gilde ab Handel drei', () => {
    expect(hasGuild(playerWith({ trade: 2 }))).toBe(false);
    expect(hasGuild(playerWith({ trade: 3 }))).toBe(true);
  });

  it('gibt die Festung ab Politik drei', () => {
    expect(hasFortress(playerWith({ politics: 2 }))).toBe(false);
    expect(hasFortress(playerWith({ politics: 3 }))).toBe(true);
  });

  it('haelt die drei auseinander', () => {
    const nurHandel = playerWith({ trade: 5 });
    expect(hasGuild(nurHandel)).toBe(true);
    expect(hasAqueduct(nurHandel)).toBe(false);
    expect(hasFortress(nurHandel)).toBe(false);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

Run: `pnpm --filter @conquerist/shared test tracks`
Erwartet: FAIL — `TRACK_STEPS` und die übrigen Namen gibt es nicht.

- [ ] **Schritt 3: Umsetzen**

`tracks.ts` bekommt die Tabellen. Der Kopfkommentar wird umgeschrieben: er sagt heute,
was 10c bringen wird — jetzt bringt er es, und der Satz muß das sagen statt es zu
versprechen. Die neuen Kommentare tragen ihre Gründe:

- **Die Stufennamen stehen in `shared` und nicht im Client**, weil der Server den
  Verlaufssatz baut („hat die Gilde gebaut"). Zwei Namenslisten liefen auseinander.
- **`improvementCost` wirft**, statt einen leeren Mengensatz zu geben. Eine Stufe, die es
  nicht gibt, ist ein Fehler im Aufrufer und kein Spielzug — dieselbe Grenze, die
  `costOf` in `build.ts` zieht. Ein `EMPTY_CARDS` gäbe die Stufe zum Nulltarif her.
- **`levelOf` liest `improvements[track] ?? 0`.** Ein nicht begonnener Bereich braucht
  keine Null im Zustand; was fehlt, ist null.

```ts
export function improvementCost(track: TrackId, level: number): CardAmounts {
  if (!Number.isInteger(level) || level < 1 || level > MAX_TRACK_LEVEL) {
    throw new RangeError(
      `improvementCost: Stufe ${level} gibt es nicht (1 bis ${MAX_TRACK_LEVEL})`,
    );
  }
  return { ...EMPTY_CARDS, [TRACK_COMMODITY[track]]: level };
}

function stepAt(track: TrackId, level: number): TrackStep {
  const step = TRACK_STEPS[track][level - 1];
  if (step === undefined) {
    throw new RangeError(`stepAt: Stufe ${level} gibt es in ${track} nicht`);
  }
  return step;
}

export function stepName(track: TrackId, level: number): string {
  return stepAt(track, level).name;
}

export function stepWithArticle(track: TrackId, level: number): string {
  const step = stepAt(track, level);
  return `${step.article} ${step.name}`;
}

export function levelOf(player: PlayerState, track: TrackId): number {
  return player.improvements[track] ?? 0;
}

export function hasAqueduct(player: PlayerState): boolean {
  return levelOf(player, 'science') >= AQUEDUCT_LEVEL;
}
```

`AQUEDUCT_LEVEL`, `GUILD_LEVEL` und `FORTRESS_LEVEL` stehen als drei Konstanten mit dem
Wert 3 nebeneinander — nicht eine geteilte Konstante. Der Kommentar sagt warum: sie sind
drei verschiedene Regeln, die zufällig dieselbe Zahl tragen, und wer eine davon
verschiebt, soll die anderen nicht mitverschieben.

`knights.ts`: `hasFortress` fällt dort weg und wird aus `tracks.ts` importiert. Der
Kommentar am Import sagt, warum sie umgezogen ist: sie gehört zu den Ausbaustufen, und
seit die Stufenliste steht, hat sie dort einen Ort.

- [ ] **Schritt 4: Test laufen lassen und Erfolg sehen**

Run: `pnpm --filter @conquerist/shared test` — grün, auch `knights.test.ts`.

- [ ] **Schritt 5: Commit**

```bash
git add packages/shared/src/game/cities
git commit -m "Drei Bereiche, fuenfzehn Stufen, drei Zusatznutzen"
```

---

## Aufgabe 2: Die Metropole am Gebäude

**Dateien:**

- Ändern: `packages/shared/src/game/state.ts`
- Ändern: `packages/shared/src/rules/ruleset.ts` (`victoryPoints.metropolis`)
- Ändern: `packages/shared/src/rules/cities.ts`
- Ändern: `packages/shared/src/game/build.ts`, `packages/shared/src/game/setup.ts`
  (die zwei Stellen, die ein `Building` bauen)
- Test: `packages/shared/src/game/state.test.ts`, `packages/shared/src/rules/cities.test.ts`

**Schnittstellen — liefert:**

```ts
// game/state.ts, BuildingSchema neu:
//   metropolis: TrackIdSchema.nullable().default(null)

// rules/ruleset.ts, victoryPoints neu:
//   metropolis: z.number().int().min(0).default(0)
```

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

An `packages/shared/src/game/state.test.ts` anhängen:

```ts
describe('Metropole am Gebaeude', () => {
  it('fehlt in einer gespeicherten Partie und heisst dann: keine', () => {
    expect(BuildingSchema.parse({ owner: 'p1', kind: 'city' }).metropolis).toBeNull();
  });

  it('traegt den Bereich, aus dem sie kommt', () => {
    const parsed = BuildingSchema.parse({ owner: 'p1', kind: 'city', metropolis: 'trade' });
    expect(parsed.metropolis).toBe('trade');
  });

  it('kennt keinen Bereich, den es nicht gibt', () => {
    expect(() =>
      BuildingSchema.parse({ owner: 'p1', kind: 'city', metropolis: 'kultur' }),
    ).toThrow();
  });
});
```

An `packages/shared/src/rules/cities.test.ts` anhängen:

```ts
it('zaehlt eine Metropole mit zwei Punkten ueber der Stadt', () => {
  expect(CITIES_RULES.victoryPoints.metropolis).toBe(2);
});

it('kennt an einem Basistisch keine Metropolen', () => {
  expect(CLASSIC_RULES.victoryPoints.metropolis).toBe(0);
});
```

- [ ] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

Run: `pnpm --filter @conquerist/shared test state.test cities.test`
Erwartet: FAIL — `metropolis` gibt es weder am Gebäude noch in den Punktwerten.

- [ ] **Schritt 3: Umsetzen**

`state.ts`, `BuildingSchema`:

```ts
/**
 * Metropolenaufsatz auf dieser Stadt, mit seinem Bereich - `null` heisst keiner.
 *
 * Am **Gebaeude** und nicht beim Spieler, aus demselben Grund wie die Mauer:
 * "diese Stadt ist Metropole" ist eine Frage an das Bauwerk. Eine Tabelle
 * `metropolis: Record<TrackId, PlayerId>` waere eine zweite Wahrheit darueber,
 * wo der Aufsatz steht - und beim ersten Barbarenueberfall, der Staedte
 * zurueckstuft, liefe sie mit der ersten auseinander.
 *
 * Mit Vorgabe: gespeicherte Partien kennen das Feld nicht.
 */
metropolis: TrackIdSchema.nullable().default(null),
```

`ruleset.ts`, `victoryPoints`:

```ts
/**
 * Was ein Metropolenaufsatz **zusaetzlich** zur Stadt zaehlt.
 *
 * Zwei, nicht vier: die Stadt darunter zaehlt ihre eigenen zwei weiter. Wer
 * hier vier eintraegt, zaehlt die Stadt doppelt.
 */
metropolis: z.number().int().min(0).default(0),
```

`cities.ts`: `metropolis: 2` neben `defender: 1`. In `CLASSIC_RULES` **nichts** eintragen
— der Vorgabewert ist null, und der Kommentar dort sagt schon, warum die Felder auf null
stehen statt zu fehlen.

`build.ts` und `setup.ts`: die Stellen, die ein `Building` erzeugen, tragen jetzt
`metropolis: null`. Der Compiler zeigt sie; es sind dieselben, die in 10b `wall: false`
bekommen haben.

- [ ] **Schritt 4: Tests laufen lassen und Erfolg sehen**

Run: `pnpm --filter @conquerist/shared test` — grün.

- [ ] **Schritt 5: Commit**

```bash
git add packages/shared/src
git commit -m "Der Aufsatz gehoert der Stadt"
```

---

## Aufgabe 3: Ausbauen, und wer dabei die Metropole bekommt

**Dateien:**

- Neu: `packages/shared/src/game/cities/improvements.ts`
- Test: `packages/shared/src/game/cities/improvements.test.ts` (**neu**)
- Ändern: `packages/shared/src/game/cities/index.ts`
- Ändern: `packages/shared/src/game/errors.ts`

**Schnittstellen — liefert:**

`BuildingSource` ist der Typ aus `cities/barbarians.ts` (`{ buildings }`) und wird von
dort importiert — dieselbe Quelle, aus der schon `barbarianStrength` liest.

```ts
/** Wer den Aufsatz dieses Bereichs haelt - `null`, wenn ihn niemand hat. */
export function metropolisHolder(source: BuildingSource, track: TrackId): PlayerId | null;

/** Wo der Aufsatz dieses Bereichs steht - `null`, wenn nirgends. */
export function metropolisAt(source: BuildingSource, track: TrackId): VertexId | null;

/** Ob dieser Ausbau den Aufsatz einbringt. */
export function claimsMetropolis(state: GameState, player: PlayerId, track: TrackId): boolean;

export function canImproveCity(
  state: GameState,
  player: PlayerId,
  track: TrackId,
  metropolisAt?: VertexId,
): RuleViolation | null;

export function applyImproveCity(
  state: GameState,
  player: PlayerId,
  track: TrackId,
  metropolisAt?: VertexId,
): ReduceResult;
```

**Neue Ablehnungsgründe in `errors.ts`:**

```
NEEDS_CITY            — Ausbauen verlangt mindestens eine eigene Stadt
TRACK_MAX_LEVEL       — dieser Bereich ist auf der hoechsten Stufe
METROPOLIS_REQUIRED   — dieser Ausbau bringt den Aufsatz, also fehlt die Stadt dafuer
METROPOLIS_NOT_WANTED — dieser Ausbau bringt keinen Aufsatz, die Stadt gehoert nicht dazu
INVALID_METROPOLIS    — die genannte Stadt taugt nicht: fremd, keine Stadt, oder besetzt
```

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

`improvements.test.ts`. Die Fälle, jeder als eigenes `it`:

_Bauen_

- baut Stufe 1 im Handel und zieht **1 Tuch** ab
- baut Stufe 2 und zieht **2 Tuch** ab — der Preis folgt der Stufe
- weist ab, wenn die Handelsware fehlt (`INSUFFICIENT_RESOURCES`)
- weist ab, wer keine Stadt hat (`NEEDS_CITY`) — **die Stufen bleiben ihm trotzdem**,
  geprüft an einem Spieler mit `improvements.trade = 2` und ohne Stadt
- weist Stufe 6 ab (`TRACK_MAX_LEVEL`)
- weist an einem Basistisch ab (`WRONG_PHASE`, dieselbe Absage wie bei Rittern und
  Mauern: das Regelwerk kennt den Ausbau nicht)
- gibt die bezahlten Handelswaren an die Bank zurück

_Die Metropole_

- Stufe 4 bei unvergebenem Aufsatz **verlangt** eine Stadt (`METROPOLIS_REQUIRED`)
- Stufe 4 mit genannter eigener Stadt setzt den Aufsatz dorthin
- Stufe 3 mit genannter Stadt wird abgewiesen (`METROPOLIS_NOT_WANTED`)
- eine **fremde** Stadt wird abgewiesen (`INVALID_METROPOLIS`)
- eine eigene **Siedlung** wird abgewiesen (`INVALID_METROPOLIS`)
- eine eigene Stadt, die **schon einen Aufsatz trägt**, wird abgewiesen
  (`INVALID_METROPOLIS`)
- Stufe 5, während ein anderer den Aufsatz hält und selbst **nicht** auf 5 steht:
  verlangt eine Stadt, nimmt den Aufsatz vom Vorbesitzer und setzt ihn um
- Stufe 5, während ein anderer den Aufsatz hält und **selbst auf 5 steht**: kein
  Aufsatzwechsel, und eine genannte Stadt wird abgewiesen (`METROPOLIS_NOT_WANTED`)
- Stufe 5, während man den Aufsatz **selbst** hält: kein Wechsel, keine Stadt nötig
- **Abweichung 1**: Stufe 4, während der Aufsatz einem anderen gehört — hier bringt der
  Ausbau nichts ein, also ist **keine** freie Stadt nötig und eine genannte wird
  abgewiesen

_Die freie Stadt_

- wer nur eine Stadt hat und die schon Metropole ist, kommt in einem anderen Bereich
  bis Stufe 3 und wird bei Stufe 4 abgewiesen (`METROPOLIS_REQUIRED`)

- [ ] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [ ] **Schritt 3: Umsetzen**

Kopfkommentar von `improvements.ts`: der Stadtausbau ist ein Zug ohne Ort — er verändert
eine Zahl beim Spieler und, wenn der Aufsatz kommt, genau ein Gebäude. Deshalb steht die
Metropolenvergabe **hier** und nicht in `build.ts`: sie ist die Folge eines Ausbaus und
kein eigener Bauzug.

`claimsMetropolis` ist der Kern und bekommt den längsten Kommentar:

```ts
/**
 * Ob dieser Ausbau den Aufsatz einbringt.
 *
 * Zwei Faelle, und nur diese zwei:
 *
 *  - **Stufe 4 und der Aufsatz ist frei.** Wer als Erster dort ankommt, bekommt
 *    ihn.
 *  - **Stufe 5, waehrend ihn jemand haelt, der selbst noch nicht auf 5 steht.**
 *    Das ist die einzige Art, wie eine Metropole den Besitzer wechselt.
 *
 * Alles andere bringt nichts ein - auch Stufe 4, wenn der Aufsatz schon
 * vergeben ist. Das ist die Auslegung aus Abweichung 1: die freie Stadt haengt
 * daran, ob der Aufsatz **kommt**, nicht an der Stufe.
 */
export function claimsMetropolis(state: GameState, player: PlayerId, track: TrackId): boolean {
  const next = levelOf(findPlayer(state, player)!, track) + 1;
  const holder = metropolisHolder(state, track);

  if (next === METROPOLIS_LEVEL) return holder === null;
  if (next !== MAX_TRACK_LEVEL) return false;
  if (holder === null || holder === player) return false;

  // Wer selbst auf der hoechsten Stufe steht, ist sicher.
  return levelOf(findPlayer(state, holder)!, track) < MAX_TRACK_LEVEL;
}
```

`canImproveCity`, der Reihe nach:

1. Der Spieler sitzt am Tisch (`UNKNOWN_PLAYER`).
2. Das Regelwerk kennt den Ausbau — geprüft an `rules.improvementTracks`, einem neuen
   `boolean` im RuleSet? **Nein**: geprüft an `rules.barbarianTrack > 0`, demselben
   Merkmal, an dem die ganze Erweiterung hängt (10a hat das entschieden: ein Merkmal und
   kein Name). Sonst `WRONG_PHASE` mit „An diesem Tisch gibt es keinen Stadtausbau".
3. Die nächste Stufe existiert (`TRACK_MAX_LEVEL`).
4. Mindestens eine eigene Stadt (`NEEDS_CITY`). Kommentar: **die Stufen bleiben, wer
   alle Städte verliert** — er darf nur nicht weiterbauen. Deshalb hängt die Prüfung am
   Zug und nicht am Zustand.
5. `claimsMetropolis` gegen `metropolisAt`: gefordert und fehlt → `METROPOLIS_REQUIRED`;
   nicht gefordert und genannt → `METROPOLIS_NOT_WANTED`.
6. Ist eine Stadt genannt: eigene Stadt, `kind === 'city'`, `metropolis === null`
   (`INVALID_METROPOLIS`).
7. Die Handelswaren reichen (`INSUFFICIENT_RESOURCES`).

`applyImproveCity`: Stufe um eins erhöhen, Preis an die Bank, und wenn der Aufsatz kommt:
ihn beim Vorbesitzer entfernen und an der genannten Stadt setzen. Beides in **einem**
`buildings`-Durchlauf, damit kein Zwischenzustand mit zwei Aufsätzen desselben Bereichs
entsteht.

- [ ] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [ ] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Eine Stufe hoeher, und wer dabei die Metropole nimmt"
```

---

## Aufgabe 4: Der Zusatznutzen wirkt

**Warum eine eigene Aufgabe:** Aquädukt und Gilde greifen in zwei Dateien außerhalb von
`cities/`, und beide sind Regeln, die man einzeln prüfen können muß.

**Dateien:**

- Ändern: `packages/shared/src/game/trade.ts` (Gilde)
- Ändern: `packages/shared/src/game/yield.ts` (Aquädukt)
- Ändern: `packages/shared/src/game/cities/turn.ts` (das Aquädukt in den Wurf)
- Test: `packages/shared/src/game/trade.test.ts`, `packages/shared/src/game/yield.test.ts`

**Schnittstellen — liefert:**

```ts
// game/trade.ts — die Quelle waechst um die Spieler, weil die Gilde beim Spieler steht.
export interface HarborSource {
  readonly scenario: GameState['scenario'];
  readonly buildings: GameState['buildings'];
  readonly players: readonly PlayerState[];
}

// game/yield.ts
/**
 * Wer beim Wurf leer ausging und das Aquaedukt hat, nimmt einen Rohstoff.
 *
 * `pick` ist die Wahl des Spielers - in 10c trifft sie der Zustand, siehe
 * Kommentar. Gibt denselben Zustand zurueck, wenn niemand betroffen ist.
 */
export function grantAqueduct(state: GameState, before: GameState): GameState;
```

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

`trade.test.ts`:

```ts
describe('Die Gilde', () => {
  it('tauscht Handelswaren 2:1', () => {
    const state = withGuild(gameWithCities(), 'p1');
    expect(tradeRateFor(state, 'p1', 'cloth')).toBe(2);
  });

  it('laesst den Kurs fuer Rohstoffe unberuehrt', () => {
    const state = withGuild(gameWithCities(), 'p1');
    expect(tradeRateFor(state, 'p1', 'brick')).toBe(4);
  });

  it('gilt nur fuer den, der sie gebaut hat', () => {
    const state = withGuild(gameWithCities(), 'p1');
    expect(tradeRateFor(state, 'p2', 'cloth')).toBe(4);
  });

  it('schlaegt einen 3:1-Hafen, aber nicht einen 2:1-Hafen', () => {
    // Der Hafen bleibt der bessere Kurs, wo er besser ist - `tradeRateFor`
    // nimmt weiterhin das Beste, was dieser Spieler erreicht.
    const state = withGuild(gameWithCities(), 'p1');
    expect(tradeRateFor(state, 'p1', 'paper')).toBe(2);
  });
});
```

`withGuild` ist eine lokale Hilfe im Test: sie setzt `improvements.trade = 3` beim
genannten Spieler.

Die drei Hilfen im `yield.test.ts` stehen genauso lokal:

```ts
/** Derselbe Zustand, aber mit dieser Ausbaustufe in der Wissenschaft. */
function withScience(state: GameState, id: string, level: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === id ? { ...p, improvements: { ...p.improvements, science: level } } : p,
    ),
  };
}

/** Die Hand eines Spielers - kurz, weil jeder Test sie vergleicht. */
function handOf(state: GameState, id: string): CardAmounts {
  return state.players.find((p) => p.id === id)!.resources;
}

/** `base` ohne Ertrag, `gained` mit einer Karte mehr fuer p1. */
const base = gameWithCities();
const gained = giving(base, 'p1', { brick: 1 });
```

`yield.test.ts`:

```ts
describe('Das Aquaedukt', () => {
  it('gibt einen Rohstoff, wer beim Wurf leer ausging', () => {
    // p1 hat Wissenschaft 3 und liegt an keinem Feld mit dieser Zahl.
    const after = grantAqueduct(withScience(base, 'p1', 3), base);
    expect(countCards(handOf(after, 'p1'))).toBe(countCards(handOf(base, 'p1')) + 1);
  });

  it('gibt nichts, wer etwas bekommen hat', () => {
    const after = grantAqueduct(withScience(gained, 'p1', 3), base);
    expect(handOf(after, 'p1')).toEqual(handOf(gained, 'p1'));
  });

  it('gibt nichts ohne Wissenschaft drei', () => {
    const after = grantAqueduct(withScience(base, 'p1', 2), base);
    expect(handOf(after, 'p1')).toEqual(handOf(base, 'p1'));
  });

  it('nimmt den Rohstoff aus der Bank', () => {
    const after = grantAqueduct(withScience(base, 'p1', 3), base);
    expect(countCards(after.bank)).toBe(countCards(base.bank) - 1);
  });

  it('gibt nichts, wenn die Bank keinen Rohstoff mehr hat', () => {
    const leer = { ...withScience(base, 'p1', 3), bank: EMPTY_CARDS };
    expect(handOf(grantAqueduct(leer, base), 'p1')).toEqual(handOf(leer, 'p1'));
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [ ] **Schritt 3: Umsetzen**

`trade.ts`: `HarborSource` bekommt `players`. `tradeRateFor` prüft nach der Hafenschleife:

```ts
/*
 * Die Gilde: zwei gleiche **Handelswaren** gegen eine beliebige Karte. Sie
 * steht beim Spieler und nicht am Brett - deshalb traegt `HarborSource` seit
 * dieser Etappe die Spielerliste mit. Rohstoffe beruehrt sie nicht: der Kurs
 * fuer Lehm bleibt, was der beste Hafen hergibt.
 *
 * Sie tritt gegen die Haefen an und gewinnt nur, wo sie besser ist - dieselbe
 * `Math.min`-Logik wie zwischen zwei Haefen. Ein eigener Zweig "Gilde schlaegt
 * alles" waere falsch: ein 2:1-Hafen auf Papier ist genauso gut.
 */
const owner = state.players.find((entry) => entry.id === player);
if (owner !== undefined && isCommodity(give) && hasGuild(owner) && GUILD_RATE < best) {
  best = GUILD_RATE;
}
```

`isCommodity` steht in `scenario/terrain.ts:49` und wird importiert — nicht neu gebaut.
`GUILD_RATE` ist eine `2` mit Namen, direkt neben `DEFAULT_RATE` in derselben Datei.

`yield.ts`: `grantAqueduct(state, before)` vergleicht die Handgrößen vor und nach der
Ausschüttung. Wer nicht gewachsen ist und `hasAqueduct` hat, bekommt einen Rohstoff.

**Welchen Rohstoff?** Die Regel läßt die Wahl. Eine Wahl wäre eine Phase, und diese Phase
läge mitten im Wurf — dieselbe Überlegung, mit der 10b die Städtewahl beim Überfall
entschieden hat. Genommen wird deshalb nach einer festen Regel: **der Rohstoff, von dem
die Bank am meisten hat**, bei Gleichstand der in `RESOURCE_IDS` zuerst genannte. Das
steht als bewußte Abweichung in `PROGRESS.md` und als Kommentar im Code, samt dem
Hinweis, daß ein `aqueductPending` der Ort wäre, wenn die Wahl später kommen soll.

**Nicht bei einer Sieben.** `grantAqueduct` wird in `turn.ts` nur auf dem Ertragspfad
gerufen, nicht auf dem Sieben-Pfad. Der Kommentar sagt es an der Aufrufstelle, weil man
es dort sucht.

`turn.ts`: der Kopfkommentar bekommt den vierten Schritt aus Spec 5.4 („Aquädukt: wer
leer ausging …"), und `resolveEvent` bleibt unberührt — das Aquädukt hängt am Ertrag und
nicht am Ereignis. Eingehängt wird es in `reducer.ts` `rollDice`, direkt nach
`distributeYield`.

- [ ] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [ ] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Aquaedukt und Gilde tun etwas"
```

---

## Aufgabe 5: Metropolen sind vor den Barbaren geschützt

**Dateien:**

- Ändern: `packages/shared/src/game/cities/barbarians.ts`
- Test: `packages/shared/src/game/cities/barbarians.test.ts`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

```ts
it('nimmt keine Metropole', () => {
  const state = landed({
    buildings: { [RICH]: city('p1'), [POOR]: { ...city('p1'), metropolis: 'trade' } },
    knights: {},
  });

  expect(barbarianOutcome(state).losses).toEqual([{ player: 'p1', vertex: RICH }]);
});

it('verschont, wer nur Metropolen hat', () => {
  const state = landed({
    buildings: { [POOR]: { ...city('p1'), metropolis: 'trade' } },
    knights: {},
  });

  expect(barbarianOutcome(state).won).toBe(false);
  expect(barbarianOutcome(state).losses).toEqual([]);
});

it('zaehlt die Metropole trotzdem zur Staerke der Barbaren', () => {
  // Sie ist eine Stadt auf dem Brett - geschuetzt heisst nicht unsichtbar.
  const state = landed({
    buildings: { [POOR]: { ...city('p1'), metropolis: 'trade' } },
    knights: {},
  });

  expect(barbarianStrength(state)).toBe(1);
});
```

- [ ] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [ ] **Schritt 3: Umsetzen**

In `cityToLose` fällt jede Stadt mit `metropolis !== null` aus den Kandidaten. Der
Kommentar sagt beides: **geschützt heißt nicht unsichtbar** — sie zählt weiter zur
Stärke der Barbaren, sie kann nur nicht genommen werden. Und: wer **nur** Metropolen hat,
ist damit gar nicht betroffen; `cityToLose` gibt `null`, und `barbarianOutcome` läßt ihn
aus den Betroffenen fallen, wie es der Spieler ohne Stadt schon tut.

- [ ] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [ ] **Schritt 5: Commit**

```bash
git add packages/shared/src/game/cities
git commit -m "Die Barbaren lassen die Metropolen stehen"
```

---

## Aufgabe 6: Der Zug im Protokoll, im Reducer und in der Aktionsliste

**Dateien:**

- Ändern: `packages/shared/src/game/actions.ts`
- Ändern: `packages/shared/src/game/reducer.ts`
- Ändern: `packages/shared/src/game/legal.ts`
- Ändern: `packages/shared/src/game/scoring.ts`
- Test: `packages/shared/src/game/actions.test.ts`, `legal.test.ts`, `scoring.test.ts`

**Neue Zugart:**

```ts
z.object({
  ...Base,
  type: z.literal('improveCity'),
  track: TrackIdSchema,
  /**
   * Wohin der Aufsatz kommt - **nur**, wenn dieser Ausbau ihn einbringt.
   * `canImproveCity` weist beides ab: das Fehlen, wo er faellig ist, und die
   * Angabe, wo keiner kommt.
   */
  metropolisAt: z.string().optional(),
}),
```

`improveCity` gehört auch in `GAME_ACTION_TYPES` — der zweite Wächter
(`NoActionTypeForgotten`) fängt sonst den Compiler-Fehler.

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

- `actions.test.ts`: `improveCity` parst mit und ohne `metropolisAt`; der Typ steht in
  `GAME_ACTION_TYPES`; ein Bereich, den es nicht gibt, wird abgewiesen
- `legal.test.ts`: in `main` steht je Bereich höchstens **ein** `improveCity` — und bei
  fälligem Aufsatz **je freier eigener Stadt eines**, weil die Stadt Teil des Zuges ist
- `legal.test.ts`: an einem Basistisch steht keines
- `scoring.test.ts`: eine Metropole zählt vier Punkte (2 Stadt + 2 Aufsatz) und zählt
  **öffentlich**

- [ ] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [ ] **Schritt 3: Umsetzen**

`reducer.ts`: `PHASE_ACTIONS.main` um `improveCity`, ein Zweig in `applyAction`.

`scoring.ts`, in `publicVictoryPointsOf`, in derselben Schleife über die Gebäude:

```ts
if (building.metropolis !== null) points += values.metropolis;
```

Kommentar: **öffentlich**, weil der Aufsatz auf dem Brett steht — und **zusätzlich** zur
Stadt, deren zwei Punkte die Zeile darüber schon zählt.

`legal.ts`, in `main`:

```ts
for (const track of TRACK_IDS) {
  if (!claimsMetropolis(state, player, track)) {
    if (canImproveCity(state, player, track) === null) {
      actions.push({ type: 'improveCity', player, track });
    }
    continue;
  }
  /*
   * Bringt der Ausbau den Aufsatz, ist die Stadt Teil des Zuges - also ein
   * Zug je moeglicher Stadt. Sonst stuende in der Liste ein Zug, den `reduce`
   * ablehnt, und die zwei Auslegungen liefen auseinander.
   */
  for (const [vertex] of Object.entries(state.buildings)) {
    if (canImproveCity(state, player, track, vertex) === null) {
      actions.push({ type: 'improveCity', player, track, metropolisAt: vertex });
    }
  }
}
```

- [ ] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [ ] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Ein Zug, der eine Stufe steigt"
```

---

## Aufgabe 7: Was der Tisch sieht und was im Verlauf steht

**Dateien:**

- Ändern: `packages/shared/src/game/playerView.ts`
- Ändern: `packages/shared/src/game/log.ts`
- Test: `packages/shared/src/game/playerView.test.ts`, `log.test.ts`

**`PlayerInView` neu:**

```ts
/**
 * Erreichte Ausbaustufe je Bereich. **Oeffentlich** - die Anleitung sagt es
 * selbst ("solltest du die Fortschritt-Tableaus der anderen im Auge behalten").
 * Wer sie nicht sieht, sieht die Metropole nicht kommen.
 */
improvements: z.partialRecord(TrackIdSchema, z.number().int().min(0).max(5)).default({}),
```

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

- `playerViewOf` trägt `improvements` bei **jedem** Spieler, nicht nur beim Empfänger
- Verlaufssätze, jeder als eigenes `it`:
  - `Anna baut die Gilde` — der Stufenname aus `TRACK_STEPS`
  - `Anna baut das Theater und setzt eine Metropole` — wenn der Aufsatz neu kommt
  - `Anna baut das Handelszentrum und nimmt Ben die Metropole ab` — beim Wechsel

- [ ] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [ ] **Schritt 3: Umsetzen**

`log.ts`, `case 'improveCity'`: der Satz liest aus dem **Übergang**, ob ein Aufsatz kam
und ob er jemandem abgenommen wurde — dieselbe Haltung wie beim Überfall in 10b. Der
Stufenname kommt aus `stepName(action.track, levelOf(after, …))`, also aus dem Zustand
**nachher**: vorher wäre es die alte Stufe.

Der Artikel kommt aus `stepWithArticle` (Aufgabe 1) — „die Gilde", „das Theater", „der
Rat Catans". Fünfzehn deutsche Artikel folgen keiner ableitbaren Regel, deshalb stehen sie
als Feld neben dem Namen und nicht als Grammatik im Code. Das Tableau nimmt `stepName`
ohne Artikel; beide lesen dieselbe Tabelle.

- [ ] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [ ] **Schritt 5: Commit**

```bash
git add packages/shared/src/game
git commit -m "Der Tisch sieht die Stufen, der Verlauf nennt sie beim Namen"
```

---

## Aufgabe 8: Ein Integrationstest bis zur ersten Metropole

**Dateien:**

- Ändern: `packages/shared/src/game/game.integration.test.ts`

- [ ] **Schritt 1: Den Test schreiben**

Eine Partie nach `CITIES_RULES` über den Reducer, mit festem Seed, mit derselben stumpfen
Strategie wie die beiden vorigen Integrationstests — erweitert um `improveCity` in der
Reihenfolge und um den Bankhandel auf Handelswaren, damit der Ausbau überhaupt bezahlbar
wird.

Geprüft werden **Invarianten nach der ersten Metropole**, nicht ihr Weg:

- genau ein Gebäude trägt `metropolis === 'trade' | 'politics' | 'science'` je Bereich
- der Halter steht auf Stufe ≥ 4 in diesem Bereich
- seine Siegpunkte enthalten die vier (Stadt plus Aufsatz)
- der Kartenbestand ist über die ganze Strecke unverändert

Der Test darf **nicht** an einer bestimmten Wurffolge hängen.

- [ ] **Schritt 2: Test laufen lassen und Erfolg sehen**

- [ ] **Schritt 3: Commit**

```bash
git add packages/shared/src/game/game.integration.test.ts
git commit -m "Eine Partie bis zur ersten Metropole"
```

---

## Aufgabe 9: Der Aufsatz auf dem Brett

**Dateien:**

- Ändern: `apps/client/src/board/shapes.ts`
- Ändern: `apps/client/src/board/BoardSvg.tsx`
- Ändern: `apps/client/src/index.css`
- Test: `apps/client/src/board/BoardSvg.test.tsx`

**Der Entwurf (Designregel 1):**

- **Rolle:** eine Metropole sagt zwei Dinge auf einen Blick — daß diese Stadt eine ist,
  und **welcher Bereich** sie hervorgebracht hat. **Aufbau:** ein Aufsatz **auf** der
  Stadtsilhouette, in der Bereichsfarbe, im selben Raster `-10 -9 20 17` wie die übrigen
  Formen. **Woran man sich erinnert:** die Farbe oben auf dem Dach.
- **Farbe ist nicht der einzige Träger** (Designregel 7): der Aufsatz trägt je Bereich
  eine eigene Form — Waage (Handel), Krone (Politik), Zahnrad-Sonne (Wissenschaft). Wer
  die Farben nicht unterscheidet, unterscheidet die Umrisse.
- **Die Mauer bleibt, wo sie ist.** Sockel unten, Aufsatz oben, Stadt dazwischen: eine
  ummauerte Metropole zeigt beides, und keins verdeckt das andere.

**Schnittstellen — liefert:**

```ts
/** Der Metropolenaufsatz je Bereich, im Raster von `VIEWBOX`. */
export const METROPOLIS_PATHS: Readonly<Record<TrackId, string>>;
```

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

- eine Stadt mit `metropolis: 'trade'` zeigt `[data-testid="metropolis-<vertex>"]`
- eine Stadt ohne Aufsatz zeigt keines
- der Aufsatz trägt seine Bereichsfarbe **per `style`**, nicht als Attribut
- er trägt `data-track` mit dem Bereich
- die drei Bereiche zeichnen **verschiedene** Pfade
- eine ummauerte Metropole zeigt Mauer **und** Aufsatz

- [ ] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [ ] **Schritt 3: Umsetzen**

`shapes.ts`: die drei Pfade, jeder mit einem Satz dazu, was er darstellt und warum er von
den anderen unterscheidbar ist. Sie sitzen über dem Stadtdach (y kleiner als −8).

`BoardSvg.tsx`: in derselben Gruppe wie Stadt und Mauer, **nach** dem Bauwerkspfad
gezeichnet. `key={`metropolis-${building.metropolis}`}`, damit der Wechsel des Bereichs
neu einhängt und die Einblendung noch einmal läuft — die Falle aus `CLAUDE.md`.

Die Bereichsfarbe kommt aus `getComputedStyle`? **Nein.** Sie kommt aus einer kleinen
Tabelle in `apps/client/src/game/labels.ts`, die auf die CSS-Variablen zeigt
(`var(--track-trade)` usw.) — dieselbe Bauform wie bei den Sitzfarben. Kein Hex-Wert in
der Komponente.

`index.css`: `.metropolis` mit derselben Kontur wie `.vertex__building` (1.15 im
Pfadraum) — es ist dasselbe Material.

- [ ] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [ ] **Schritt 5: Commit**

```bash
git add apps/client/src/board apps/client/src/index.css apps/client/src/game/labels.ts
git commit -m "Ein Aufsatz auf dem Dach"
```

---

## Aufgabe 10: Das Fortschritt-Tableau und die kompakte Leiste

**Dateien:**

- Neu: `apps/client/src/panels/TrackPanel.tsx`
- Neu: `apps/client/src/panels/TrackStrip.tsx`
- Ändern: `apps/client/src/panels/TablePanel.tsx`
- Ändern: `apps/client/src/screens/GameScreen.tsx`
- Ändern: `apps/client/src/game/targets.ts`
- Ändern: `apps/client/src/index.css`
- Test: `apps/client/src/panels/TrackPanel.test.tsx` (**neu**),
  `apps/client/src/screens/GameScreen.test.tsx`

**Der Entwurf (Designregel 1) für das Tableau:**

- **Rolle:** die Stelle, an der man sieht, wo man steht, was der nächste Schritt kostet
  und wie hoch die Chance auf eine Karte ist. **Aufbau:** drei Leitern nebeneinander, je
  fünf Stufen in Bereichsfarbe — gebaute Stufen gefüllt, die nächste als Umriß mit ihrem
  Preis, der Rest leer. **Woran man sich erinnert:** die rote Ziffer rechts an jeder
  Stufe, die man beim Würfeln sucht.
- Die Schwelle wird mit `Numerals.tsx` gesetzt — tabellarische Ziffern, weil man sie
  ständig mit dem gefallenen roten Würfel vergleicht und keine Ziffer springen darf.
- Stufe 3 trägt ihr Wort (Aquädukt / Gilde / Festung), Stufe 4 die Metropolenform aus
  Aufgabe 9. **Dieselbe Form wie auf dem Brett** — wer sie im Tableau sieht, erkennt sie
  am Knoten wieder.
- **Es ist kein Knopf mit einem Bild darin.** Die gebauten Stufen sind Auskunft; nur die
  **nächste** Stufe ist bedienbar, und nur sie trägt eine Trefferfläche von 44 px.

**Der Entwurf für die kompakte Leiste am Tisch:**

- **Rolle:** dieselbe Auskunft über die **anderen**, in einer Zeile. **Aufbau:** drei
  Punktreihen 0–5 in Bereichsfarbe. **Woran man sich erinnert:** wer nah an der Vier ist.
- Sie steht je Sitz in `TablePanel`, unter dem Namen — dort steht schon, was öffentlich
  ist (Karten, Punkte, Auszeichnungen).

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

`TrackPanel.test.tsx`:

- drei Leitern zu je fünf Stufen
- gebaute Stufen tragen `data-built="true"`, die übrigen `"false"`
- **nur die nächste Stufe ist ein Knopf**, und er ist gesperrt, wenn die Klickkarte
  nichts anbietet
- der Knopf trägt den Preis im `title` („Gilde: 3 Tuch")
- jede Stufe trägt ihre Schwelle als Ziffer (Stufe 1 → 2, Stufe 5 → 6)
- das Tableau erscheint **nicht**, wo das Regelwerk keinen Ausbau kennt
- ein Klick meldet den Bereich nach oben

`GameScreen.test.tsx`:

- bringt der Ausbau den Aufsatz, leuchten nach dem Klick die eigenen freien Städte, und
  die Hinweisleiste sagt „Wohin kommt die Metropole?"
- bringt er keinen, wird sofort geschickt und das Brett bleibt ruhig
- an einem Basistisch gibt es kein Tableau

- [ ] **Schritt 2: Tests laufen lassen und Fehlschlag sehen**

- [ ] **Schritt 3: Umsetzen**

`targets.ts`: `ActionTargets` bekommt

```ts
/** Je Bereich der Ausbauzug ohne Aufsatz - `null`, wo er gerade nicht geht. */
readonly improve: ReadonlyMap<TrackId, GameAction>;
/** Je Bereich die Staedte, auf die der faellige Aufsatz koennte. */
readonly metropolis: ReadonlyMap<TrackId, ReadonlyMap<VertexId, GameAction>>;
```

Zwei Karten aus demselben Grund wie bei den Rittern in 10b: derselbe Bereich kann einen
Zug ohne Stadt **oder** mehrere mit Stadt hervorbringen, und eine Karte, die beides
führt, müßte lügen.

`GameScreen.tsx`: ein Zustand `metropolisFor: TrackId | null`, gesetzt beim Klick auf
eine Stufe, deren Zug eine Stadt verlangt. Er setzt `buildMode` und `knightMode` zurück
— dieselbe Regel wie zwischen jenen beiden, und der Kommentar dort gilt wörtlich weiter.
Zurückgesetzt bei `view.version`, an derselben Stelle wie die anderen.

`index.css`: `.tracks`, `.tracks__ladder`, `.tracks__step`, `.tracks__threshold`,
`.trackstrip`. Die Bereichsfarbe kommt aus `--track-*`. **Spezifität nachzählen** gegen
`.panel …`. Trefferfläche der nächsten Stufe mindestens 44 px.

- [ ] **Schritt 4: Tests laufen lassen und Erfolg sehen**

- [ ] **Schritt 5: Commit**

```bash
git add apps/client/src
git commit -m "Drei Leitern, und wer wo steht"
```

---

## Aufgabe 11: Der Durchgang im Browser

**Kein Test ersetzt das.** Der Durchgang zu 10b hat elf Befunde geliefert, von denen
keiner durch einen Test gefallen wäre — darunter zwei, die die tragenden Entscheidungen
der Etappe verfehlten. Diese Etappe bringt ein ganzes Panel und eine neue Silhouette.

- [ ] **Schritt 1: Bauen und starten**

`pnpm build`, dann `DATABASE_FILE=":memory:" pnpm --filter @conquerist/server start`, dann
eine lokale Städte-&-Ritter-Partie öffnen.

**Zwei Meßnotizen aus 10b, die Zeit sparen:** die Screenshots der Erweiterung sind nicht
maßstabsgetreu zum Fenster (1568 px Bild gegen 1920 px Viewport) — klicken über `find`
und Element-Referenz, messen über `getBoundingClientRect`. Und zwischen zwei Klicks auf
dasselbe Bedienelement gehört ein `await`, sonst umgeht der Treiber jede React-Sperre,
die ihren Zustand aus dem Render-Scope liest.

- [ ] **Schritt 2: Durchsehen und messen**

Nachzusehen, jedes mit einer **gemessenen** Zahl:

1. Das Tableau: passen drei Leitern zu je fünf Stufen in die Ecke, und wie hoch bauen sie?
2. Die Schwellenziffer: steht sie tabellarisch, springt sie zwischen Stufen nicht?
3. Kontrast jeder Bereichsfarbe auf ihrem Grund — die drei `--track-*` sind für Pergament
   gemischt und stehen hier vielleicht auf der Tiefsee. Der Befund aus 10b (3,05:1 statt
   4,5:1) kam genau so zustande.
4. Die nächste Stufe als Knopf: **gemessen** 44 px, und gesperrt sichtbar anders als offen.
5. Die kompakte Leiste je Sitz: erkennt man drei Bereiche, ohne die Farben zu kennen?
6. Der Metropolenaufsatz auf dem Brett: erkennt man den Bereich, und verdeckt er die
   Stadtform? Eine ummauerte Metropole zeigt beides?
7. Die Metropolenwahl: leuchten genau die eigenen freien Städte?
8. Absichtlich das drücken, was niemand drückt — Stufe 4 ohne freie Stadt, Stufe 5 als
   sicherer Halter.
9. Die zwei Viewport-Breakpoints (`26rem`, `62rem`) — sie sind seit 10b gemessen und
   sollen es bleiben; das Tableau ist neu in derselben Ecke.
10. Das Aquädukt: bekommt man wirklich eine Karte, wenn man leer ausgeht — und im Verlauf
    steht es?

- [ ] **Schritt 3: Befunde beheben und die Zahl dazu notieren**

Jeder Befund wird an seiner **Ursache** behoben, nicht an seiner Fundstelle
(`CLAUDE.md`), und mit der Messung davor und danach in `PROGRESS.md` festgehalten.

- [ ] **Schritt 4: Commit**

```bash
git add -A
git commit -m "Was der Browser zum Stadtausbau gesagt hat"
```

---

## Aufgabe 12: Abnahme und `PROGRESS.md`

- [ ] **Schritt 1: Volle Abnahme**

```bash
pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Die Zahlen aus dem Testlauf (je Paket Tests/Dateien) und die Bundlegröße aus dem Build
**abschreiben**, nicht schätzen.

- [ ] **Schritt 2: Den Abschnitt schreiben**

`PROGRESS.md`, in der bestehenden Form:

- Überschrift und Stand (Datum, Branch, Commits)
- **Abnahme** als Tabelle mit den gemessenen Zahlen
- **Getroffene Entscheidungen** — je Absatz eine, fett angeführt, mit dem Grund.
  Mindestens: die Metropole am Gebäude statt beim Spieler; die Stufennamen in `shared`;
  der Zusatznutzen als Frage an die Stufe statt als Feld; drei Konstanten mit dem Wert 3
  statt einer geteilten; `improveCity` trägt die Metropole mit, statt sie in eine zweite
  Phase zu schieben; die zwei Zielkarten im Client; `HarborSource` wächst um die
  Spielerliste, weil die Gilde beim Spieler steht.
- **Bewußte Abweichungen** — die zwei aus dem Kopf dieses Plans **wörtlich**, dazu die
  Wahl des Aquädukt-Rohstoffs aus Aufgabe 4.
- **Abweichungen vom Plan**, falls es welche gab.
- **Der Durchgang im Browser** mit den Befunden aus Aufgabe 11, jeder mit seiner Messung
  davor und danach.
- **Offene Punkte** — darunter: die Wahl des Aquädukt-Rohstoffs trifft das Spiel
  (`aqueductPending` wäre der Ort), die Zugzeit für den Ausbau ist weiterhin unbefristet,
  und was der Browser-Durchgang offengelassen hat.
- **Nächste Etappe:** 10d — Fortschrittskarten.

- [ ] **Schritt 3: Commit**

```bash
git add PROGRESS.md
git commit -m "Was in 10c entschieden wurde"
```

---

## Selbstprüfung gegen die Spec

| Spec-Stelle                                     | Aufgabe                |
| ----------------------------------------------- | ---------------------- |
| 2.2 `improvements` öffentlich in der PlayerView | 7                      |
| 2.3 `Building.metropolis`                       | 2                      |
| 2.4 Metropolenhalter wird nicht gespeichert     | 3 (`metropolisHolder`) |
| 4 `TRACK_COMMODITY`, `TRACK_STEPS`              | 1                      |
| 4 `improvementCost`, `progressThreshold`        | 1                      |
| 4 `hasAqueduct` / `hasGuild` / `hasFortress`    | 1, 4                   |
| 5.1 `improveCity` mit `metropolisAt`            | 6                      |
| 5.1 Auslegung „freie Stadt"                     | 3 — Abweichung 1       |
| 5.4 Aquädukt als vierter Schritt im Wurf        | 4                      |
| 6 Modulschnitt `cities/improvements.ts`         | 3                      |
| 8.2 Metropolenaufsatz an der Stadt              | 9                      |
| 8.4 Das Fortschritt-Tableau                     | 10                     |
| 8.4 Die kompakte Dreierleiste am Tisch          | 10                     |
| 9 „10c" vollständig                             | alle                   |
| 10 Integrationstest bis zur ersten Metropole    | 8                      |
| 10 Im Browser nachgesehen                       | 11                     |

**Nicht in 10c und mit Absicht:** die Fortschrittskarten samt Ziehbedingung und den drei
Stapeln (10d), der Händler (10d), Burg 1 / Burg 2 (10e). `progressThreshold` steht
trotzdem schon hier — der Grund steht als Abweichung 2 im Kopf.
