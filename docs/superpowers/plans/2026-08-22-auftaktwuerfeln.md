# Auftaktwürfeln Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vor der Gründungsphase würfeln alle Spieler reihum aus, wer beginnt; der Höchste rückt in `players` auf Index 0 und setzt zuerst.

**Architecture:** Eine neue Phase `opening` im Zustandsautomaten, aber **keine neue Aktion** — `rollDice` bedeutet, was die Phase sagt, und wird in `applyAction` einmal verzweigt. Die Auswertung liegt in einem eigenen `game/opening.ts`. Weil `lastRoll` auch im Auftakt gesetzt wird, fliegen die Würfel im Client ohne eine neue Zeile.

**Tech Stack:** TypeScript (ESM, `tsc -b`), Zod, Vitest, React 19, pnpm-Workspace.

**Spec:** `docs/superpowers/specs/2026-08-22-auftaktwuerfeln-design.md`

## Global Constraints

- **Kommentare und Bezeichner im Quelltext sind ASCII-transliteriert** („Gruendung", „Wuerfel", „naechster"). **Texte für Menschen** — Verstoßmeldungen, Verlaufssätze, Beschriftungen — tragen echte Umlaute („Das geht erst nach dem Würfeln"). Beides steht so in jeder bestehenden Datei; nicht vermischen.
- Kommentare erklären **warum**, nicht was. Der Bestand ist ausführlich kommentiert — neue Bauteile im selben Ton.
- Zufall **ausschließlich** aus `state.rng` über die Funktionen in `random/`. Nie `Math.random()`.
- Jeder neue Zustand geht durch sein Zod-Schema; `GameStateSchema.parse` in `testGame` fängt unmögliche Testzustände.
- `noUncheckedIndexedAccess` ist an: `array[0]` ist `T | undefined` und muss behandelt werden.
- Tests: `pnpm --filter @conquerist/shared test`, `pnpm --filter @conquerist/client test`. Ganze Abnahme: `pnpm typecheck && pnpm test && pnpm build && pnpm format:check`.
- Commits auf Deutsch, ASCII, ohne Trailer — wie der Bestand (`git log`).

**Der Compiler ist hier ein Werkzeug, kein Hindernis:** `phaseTextOf` (`apps/client/src/game/view.ts:167`) und `actingPlayers` schalten erschöpfend über `phase.kind`. Sobald `opening` im Schema steht, nennt `pnpm typecheck` jede Stelle, die einen Zweig braucht. Diese Liste ist die Arbeitsliste.

---

### Task 1: Die Phase im Schema

**Files:**

- Modify: `packages/shared/src/game/phase.ts`
- Test: `packages/shared/src/game/phase.test.ts`

**Interfaces:**

- Consumes: `RollSchema` aus `./dice.js`, `PlayerIdSchema` aus `./player.js`
- Produces: Phasenvariante `{ kind: 'opening', rolls: Record<string, Roll>, pending: PlayerId[], round: number }`; `openingRoller(phase): PlayerId | null`

- [ ] **Step 1: Write the failing test**

An `packages/shared/src/game/phase.test.ts` anhängen:

```ts
import { openingRoller, PhaseSchema } from './phase.js';

describe('die Auftaktphase', () => {
  it('nimmt Wuerfe, Warteschlange und Runde auf', () => {
    const phase = {
      kind: 'opening',
      rolls: {
        p1: [
          { die: 'w6a', value: 5 },
          { die: 'w6b', value: 4 },
        ],
      },
      pending: ['p2', 'p3'],
      round: 0,
    };

    expect(() => PhaseSchema.parse(phase)).not.toThrow();
  });

  it('lehnt eine negative Stechrunde ab', () => {
    expect(() =>
      PhaseSchema.parse({ kind: 'opening', rolls: {}, pending: [], round: -1 }),
    ).toThrow();
  });
});

describe('openingRoller', () => {
  it('nennt den Vordersten der Warteschlange', () => {
    expect(openingRoller({ kind: 'opening', rolls: {}, pending: ['p2', 'p3'], round: 0 })).toBe(
      'p2',
    );
  });

  it('gibt null zurueck, wenn die Runde vollstaendig ist', () => {
    // Der Fall, in dem ausgewertet wird - nicht der Fall, in dem jemand wartet.
    expect(openingRoller({ kind: 'opening', rolls: {}, pending: [], round: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/phase.test.ts`
Expected: FAIL — `openingRoller` existiert nicht, und `PhaseSchema.parse` lehnt `kind: 'opening'` ab.

- [ ] **Step 3: Write minimal implementation**

In `phase.ts` den Import ergänzen:

```ts
import { RollSchema } from './dice.js';
```

Als **erste** Variante in die `PhaseSchema`-Union (vor `setup`, weil sie zeitlich davor liegt):

```ts
  /**
   * Der Auftakt: reihum wuerfelt jeder einmal, der Hoechste beginnt.
   *
   * `rolls` haelt **nur die laufende Runde**. Ein Stechen ersetzt sie, statt sie
   * zu ergaenzen - was vorher fiel, hat fuer die Entscheidung keine Bedeutung
   * mehr, und wer es nachlesen will, findet es im Verlauf. Zwei Runden
   * gleichzeitig im Zustand hiesse, an jeder Auswertung mitzudenken, welche
   * gilt.
   *
   * `pending` ist Warteschlange und zugleich die Antwort auf "wer ist dran" -
   * dieselbe Bauform wie bei `discardPending`, nur der Reihe nach statt
   * gleichzeitig.
   */
  z.object({
    kind: z.literal('opening'),
    /** Was in dieser Wurfrunde schon gefallen ist. */
    rolls: z.record(z.string(), RollSchema),
    /** Wer in dieser Wurfrunde noch werfen muss, in Sitzreihenfolge. */
    pending: z.array(PlayerIdSchema),
    /** 0 ist die erste Runde, ab 1 ist es ein Stechen. */
    round: z.number().int().min(0),
  }),
```

Den Ablaufplan im Kopfkommentar der Datei um den Auftakt ergänzen (`opening ──► setup ──► rollPending`).

Am Ende der Datei:

```ts
/** Wer im Auftakt als Naechstes wirft - `null`, wenn die Runde vollstaendig ist. */
export function openingRoller(phase: Extract<Phase, { kind: 'opening' }>): PlayerId | null {
  return phase.pending[0] ?? null;
}
```

`PlayerId` dafür als Typ importieren: `import { PlayerIdSchema, type PlayerId } from './player.js';`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/phase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/phase.ts packages/shared/src/game/phase.test.ts
git commit -m "Der Auftakt bekommt eine Phase"
```

---

### Task 2: Die Auswertung

**Files:**

- Create: `packages/shared/src/game/opening.ts`
- Create: `packages/shared/src/game/opening.test.ts`

**Interfaces:**

- Consumes: `rollAll`, `yieldTotal` aus `./dice.js`; `ok`, `GameState`, `ReduceResult` aus `./state.js`
- Produces: `applyOpeningRoll(state: GameState): ReduceResult`; `highestRollers(state: GameState, rolls: Readonly<Record<string, Roll>>): readonly PlayerId[]`; `rotateToFirst(players: GameState['players'], id: PlayerId): GameState['players']`

Die zwei Helfer sind **exportiert und einzeln geprüft**: an ihnen hängt die Entscheidung, und über einen echten Wurf sind sie nur mit Glück zu treffen.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/game/opening.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES } from '../rules/index.js';
import { yieldTotal } from './dice.js';
import { testGame, TEST_PLAYERS } from './fixtures.js';
import { applyOpeningRoll, highestRollers, rotateToFirst } from './opening.js';

/** Ein Zustand im Auftakt: alle drei warten, nichts ist gefallen. */
function inOpening() {
  return testGame({
    phase: { kind: 'opening', rolls: {}, pending: [...TEST_PLAYERS], round: 0 },
    turn: 0,
  });
}

describe('highestRollers', () => {
  it('nennt den Hoechsten', () => {
    const state = inOpening();
    const rolls = {
      p1: [
        { die: 'w6a', value: 3 },
        { die: 'w6b', value: 2 },
      ],
      p2: [
        { die: 'w6a', value: 6 },
        { die: 'w6b', value: 4 },
      ],
      p3: [
        { die: 'w6a', value: 1 },
        { die: 'w6b', value: 1 },
      ],
    };

    expect(highestRollers(state, rolls)).toEqual(['p2']);
  });

  it('nennt bei Gleichstand alle Gleichen in Sitzreihenfolge', () => {
    const state = inOpening();
    const rolls = {
      p1: [
        { die: 'w6a', value: 5 },
        { die: 'w6b', value: 4 },
      ],
      p2: [
        { die: 'w6a', value: 2 },
        { die: 'w6b', value: 1 },
      ],
      p3: [
        { die: 'w6a', value: 6 },
        { die: 'w6b', value: 3 },
      ],
    };

    expect(highestRollers(state, rolls)).toEqual(['p1', 'p3']);
  });

  it('uebergeht, wer in dieser Runde nicht geworfen hat', () => {
    // Im Stechen wirft nur, wer gleichauf lag. Die uebrigen duerfen nicht
    // dadurch gewinnen, dass ihr fehlender Wurf als Null zaehlt.
    const state = inOpening();
    const rolls = {
      p2: [
        { die: 'w6a', value: 1 },
        { die: 'w6b', value: 1 },
      ],
    };

    expect(highestRollers(state, rolls)).toEqual(['p2']);
  });
});

describe('rotateToFirst', () => {
  it('dreht die Liste, ohne jemanden zu verlieren', () => {
    const state = inOpening();
    const rotated = rotateToFirst(state.players, 'p3');

    expect(rotated.map((player) => player.id)).toEqual(['p3', 'p1', 'p2']);
    expect(rotated).toHaveLength(state.players.length);
  });

  it('laesst die Liste stehen, wenn der Sieger schon vorn sitzt', () => {
    const state = inOpening();
    expect(rotateToFirst(state.players, 'p1').map((player) => player.id)).toEqual([
      ...TEST_PLAYERS,
    ]);
  });
});

describe('applyOpeningRoll', () => {
  it('schreibt den Wurf und nimmt den Werfer aus der Warteschlange', () => {
    const result = applyOpeningRoll(inOpening());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toMatchObject({ kind: 'opening', pending: ['p2', 'p3'], round: 0 });
    if (result.state.phase.kind !== 'opening') return;
    expect(result.state.phase.rolls['p1']).toBeDefined();
  });

  it('legt den Wurf auf lastRoll, damit die Wuerfel fliegen koennen', () => {
    const result = applyOpeningRoll(inOpening());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRoll).toHaveLength(CLASSIC_RULES.dice.length);
  });

  it('verbraucht den Zufall, statt zweimal dasselbe zu wuerfeln', () => {
    const first = applyOpeningRoll(inOpening());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.rng).not.toEqual(inOpening().rng);
  });

  it('entscheidet, sobald die Runde vollstaendig ist', () => {
    // Deterministisch ohne Seed-Raterei: wir wuerfeln die Runde durch und
    // rechnen aus den gefallenen Wuerfeln nach, was herauskommen musste.
    let state = inOpening();
    const totals = new Map<string, number>();

    for (const player of TEST_PLAYERS) {
      const result = applyOpeningRoll(state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      totals.set(player, yieldTotal(state.rules.dice, state.lastRoll ?? []));
    }

    const best = Math.max(...totals.values());
    const winners = TEST_PLAYERS.filter((id) => totals.get(id) === best);

    if (winners.length === 1) {
      expect(state.phase).toEqual({ kind: 'setup', placement: 0, settlement: null });
      expect(state.players[0]?.id).toBe(winners[0]);
      expect(state.currentPlayerIndex).toBe(0);
    } else {
      expect(state.phase).toEqual({ kind: 'opening', rolls: {}, pending: winners, round: 1 });
    }
  });

  it('wirft, wenn der Zustand gar nicht im Auftakt steht', () => {
    // Ein Programmierfehler und kein Spielzug - deshalb eine Ausnahme und
    // kein `rejected`, wie bei `playerAt`.
    expect(() => applyOpeningRoll(testGame())).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/opening.test.ts`
Expected: FAIL — `./opening.js` existiert nicht.

- [ ] **Step 3: Write minimal implementation**

`packages/shared/src/game/opening.ts`:

```ts
import { rollAll, yieldTotal, type Roll } from './dice.js';
import type { PlayerId } from './player.js';
import { ok, type GameState, type ReduceResult } from './state.js';

/**
 * Der Auftakt: wer am hoechsten wuerfelt, beginnt.
 *
 * Gewuerfelt wird mit **derselben** Schale und aus **demselben** Zufallszustand
 * wie im Spiel. Der Auftakt verbraucht damit Zufall, den die Partie sonst
 * spaeter gezogen haette - unproblematisch, solange es aus dem Seed folgt, und
 * `replay` reproduziert es. Ein zweiter Zufallsstrom nur fuer den Auftakt waere
 * genau die zweite Wahrheit, die `setup.ts` fuer Stapel und RNG vermeidet.
 */

/**
 * Wer die hoechste Summe geworfen hat - mehrere bei Gleichstand.
 *
 * Zaehlt ueber `yieldTotal` und nicht ueber alle Augen: ein Wuerfel, den das
 * RuleSet nicht mitzaehlen laesst, soll auch nicht bestimmen, wer anfaengt. Es
 * gibt eine Vorstellung von "die Zahl, die zaehlt", und sie steht in `dice.ts`.
 *
 * Wer in dieser Runde nicht geworfen hat, zaehlt nicht mit. Im Stechen wirft
 * nur, wer gleichauf lag; ohne diese Zeile gewaenne bei lauter Nullen der Rest
 * des Tisches.
 */
export function highestRollers(
  state: GameState,
  rolls: Readonly<Record<string, Roll>>,
): readonly PlayerId[] {
  const totals = state.players
    .filter((player) => rolls[player.id] !== undefined)
    .map((player) => ({
      id: player.id,
      total: yieldTotal(state.rules.dice, rolls[player.id] ?? []),
    }));

  const best = Math.max(...totals.map((entry) => entry.total));

  return totals.filter((entry) => entry.total === best).map((entry) => entry.id);
}

/**
 * Dreht die Spielerliste, bis `id` vorn steht.
 *
 * Gefahrlos, weil Farbe und Name am `Seat` haengen und ueber die Id
 * nachgeschlagen werden, nicht ueber den Index in `players`. `players` ist die
 * Zugreihenfolge - genau das steht als ihre Bedeutung in `state.ts` -, und
 * `setupPlayerIndex` rechnet danach von allein richtig.
 */
export function rotateToFirst(players: GameState['players'], id: PlayerId): GameState['players'] {
  const index = players.findIndex((player) => player.id === id);
  if (index < 0) {
    throw new RangeError(`rotateToFirst: ${id} sitzt nicht an diesem Tisch`);
  }

  return [...players.slice(index), ...players.slice(0, index)];
}

/** Ein Wurf im Auftakt - und, wenn die Runde damit voll ist, die Entscheidung. */
export function applyOpeningRoll(state: GameState): ReduceResult {
  const phase = state.phase;
  if (phase.kind !== 'opening') {
    throw new RangeError('applyOpeningRoll: Der Zustand steht nicht im Auftakt');
  }

  const roller = phase.pending[0];
  if (roller === undefined) {
    throw new RangeError('applyOpeningRoll: Im Auftakt wartet niemand auf einen Wurf');
  }

  const [roll, rng] = rollAll(state.rules.dice, state.rng);
  const rolls = { ...phase.rolls, [roller]: roll };
  const pending = phase.pending.slice(1);

  // `lastRoll` auch hier: daran haengt die Wurfbahn im Client, und sie soll den
  // Auftakt nicht als Sonderfall kennen muessen.
  const rolled: GameState = { ...state, rng, lastRoll: roll };

  if (pending.length > 0) {
    return ok({ ...rolled, phase: { kind: 'opening', rolls, pending, round: phase.round } });
  }

  const winners = highestRollers(rolled, rolls);
  const winner = winners.length === 1 ? winners[0] : undefined;

  if (winner === undefined) {
    return ok({
      ...rolled,
      phase: { kind: 'opening', rolls: {}, pending: [...winners], round: phase.round + 1 },
    });
  }

  return ok({
    ...rolled,
    players: rotateToFirst(rolled.players, winner),
    currentPlayerIndex: 0,
    phase: { kind: 'setup', placement: 0, settlement: null },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/opening.test.ts`
Expected: PASS (12 Tests)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/opening.ts packages/shared/src/game/opening.test.ts
git commit -m "Der Auftakt wertet aus: hoechster Wurf, Stechen, Rotation"
```

---

### Task 3: Der Reducer laesst den Auftakt zu

**Files:**

- Modify: `packages/shared/src/game/reducer.ts` (`PHASE_ACTIONS` ab :47, `actorFor` ab :79, `applyAction` ab :175)
- Test: `packages/shared/src/game/reducer.test.ts`

**Interfaces:**

- Consumes: `applyOpeningRoll` aus `./opening.js`, `openingRoller` aus `./phase.js`
- Produces: `reduce(state, { type: 'rollDice', player })` wirkt im Auftakt als Auftaktwurf

- [ ] **Step 1: Write the failing test**

An `packages/shared/src/game/reducer.test.ts` anhängen:

```ts
describe('der Auftakt im Reducer', () => {
  const inOpening = () =>
    testGame({
      phase: { kind: 'opening', rolls: {}, pending: ['p1', 'p2', 'p3'], round: 0 },
      turn: 0,
    });

  it('laesst nur den Vordersten der Warteschlange wuerfeln', () => {
    const result = reduce(inOpening(), { type: 'rollDice', player: 'p2' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.NOT_YOUR_TURN);
  });

  it('nimmt im Auftakt keine Siedlung an', () => {
    // Der ganze Sinn einer Phase: ein zu frueh gesetztes Haus ist ein
    // gewoehnlicher Regelverstoss und kein Sonderfall im Code.
    const result = reduce(inOpening(), {
      type: 'placeSetupSettlement',
      player: 'p1',
      vertex: CENTER_VERTEX,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('wuerfelt im Auftakt keinen Ertrag aus', () => {
    const result = reduce(inOpening(), { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.map((player) => player.resources)).toEqual(
      inOpening().players.map((player) => player.resources),
    );
  });
});
```

Fehlende Importe in der Testdatei ergänzen (`CENTER_VERTEX` aus `./fixtures.js`, `RuleViolationCode` aus `./errors.js`) — nur, falls sie dort noch nicht stehen.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/reducer.test.ts`
Expected: FAIL — `rollDice` ist in `opening` nicht erlaubt (`WRONG_PHASE` statt `NOT_YOUR_TURN`), und der dritte Test verteilt Ertrag.

- [ ] **Step 3: Write minimal implementation**

In `reducer.ts`:

```ts
import { applyOpeningRoll } from './opening.js';
import { openingRoller, setupPlacementCount, setupPlayerIndex } from './phase.js';
```

(die vorhandene `phase.js`-Importzeile ergänzen, nicht verdoppeln)

`PHASE_ACTIONS` bekommt als ersten Eintrag:

```ts
  opening: ['rollDice'],
```

In `actorFor`, vor der `setup`-Zeile:

```ts
if (state.phase.kind === 'opening') return openingRoller(state.phase);
```

In `applyAction`:

```ts
    case 'rollDice':
      // Die Aktion heisst "ich werfe die Wuerfel". Was ein Wurf bedeutet,
      // entscheidet die Phase - deshalb hier ein Zweig und keine zweite Aktion,
      // die durch Protokoll, Server und Oberflaeche mitgeschleppt werden muss.
      return state.phase.kind === 'opening' ? applyOpeningRoll(state) : rollDice(state);
```

In `finalize` den Auftakt wie die Gründung ausnehmen — dort gibt es nichts zu gewinnen:

```ts
if (
  scored.phase.kind === 'opening' ||
  scored.phase.kind === 'setup' ||
  scored.phase.kind === 'finished'
) {
  return scored;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/reducer.ts packages/shared/src/game/reducer.test.ts
git commit -m "rollDice bedeutet im Auftakt etwas anderes"
```

---

### Task 4: `legalActions` im Auftakt

**Files:**

- Modify: `packages/shared/src/game/legal.ts` (Schalter ab :48)
- Test: `packages/shared/src/game/legal.test.ts`

**Interfaces:**

- Consumes: `openingRoller` aus `./phase.js`
- Produces: `legalActions(state, player)` gibt im Auftakt `[{ type: 'rollDice', player }]` für den Vordersten, sonst `[]`

- [ ] **Step 1: Write the failing test**

An `packages/shared/src/game/legal.test.ts` anhängen:

```ts
describe('legalActions im Auftakt', () => {
  const inOpening = () =>
    testGame({
      phase: { kind: 'opening', rolls: {}, pending: ['p2', 'p3'], round: 0 },
      turn: 0,
    });

  it('bietet dem Vordersten das Wuerfeln an', () => {
    expect(legalActions(inOpening(), 'p2')).toEqual([{ type: 'rollDice', player: 'p2' }]);
  });

  it('bietet den Wartenden nichts an', () => {
    expect(legalActions(inOpening(), 'p3')).toEqual([]);
    expect(legalActions(inOpening(), 'p1')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/legal.test.ts`
Expected: FAIL — der Schalter kennt `opening` nicht und fällt in den Standardzweig.

- [ ] **Step 3: Write minimal implementation**

In `legal.ts` den Import um `openingRoller` ergänzen und als ersten Fall in den Schalter:

```ts
    case 'opening':
      return openingRoller(state.phase) === player ? [{ type: 'rollDice', player }] : [];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/legal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/legal.ts packages/shared/src/game/legal.test.ts
git commit -m "Der Wuerfelknopf erscheint im Auftakt von allein"
```

---

### Task 5: Die Partie beginnt im Auftakt

Der Eingriff, der den Bestand anfasst: bis hier war der Auftakt erreichbar, aber niemand landete darin. Jetzt schon — und jeder Test, der bisher von `setup` als Startphase ausging, fällt.

**Files:**

- Modify: `packages/shared/src/game/setup.ts:30-66` (`createGame`)
- Modify: `packages/shared/src/game/fixtures.ts` (neuer Helfer `afterOpening`)
- Test: `packages/shared/src/game/setup.test.ts`
- Reparatur: alles, was `pnpm test` danach meldet

**Interfaces:**

- Consumes: `reduce` aus `./reducer.js` (nur in `fixtures.ts`)
- Produces: `createGame(...)` liefert `phase: { kind: 'opening', rolls: {}, pending: [...playerIds], round: 0 }`; `afterOpening(state: GameState): GameState`

- [ ] **Step 1: Write the failing test**

An `packages/shared/src/game/setup.test.ts` anhängen:

```ts
describe('createGame und der Auftakt', () => {
  it('startet im Auftakt und nicht in der Gruendung', () => {
    const game = createGame(TEST_SCENARIO, CLASSIC_RULES, TEST_PLAYERS, 'saat');

    expect(game.phase).toEqual({
      kind: 'opening',
      rolls: {},
      pending: [...TEST_PLAYERS],
      round: 0,
    });
  });

  it('kommt ueber den Auftakt in die Gruendung, mit allen Spielern', () => {
    const game = afterOpening(createGame(TEST_SCENARIO, CLASSIC_RULES, TEST_PLAYERS, 'saat'));

    expect(game.phase).toEqual({ kind: 'setup', placement: 0, settlement: null });
    expect([...game.players].map((player) => player.id).sort()).toEqual([...TEST_PLAYERS].sort());
  });

  it('ist bei gleicher Saat derselbe Auftakt', () => {
    const a = afterOpening(createGame(TEST_SCENARIO, CLASSIC_RULES, TEST_PLAYERS, 'saat'));
    const b = afterOpening(createGame(TEST_SCENARIO, CLASSIC_RULES, TEST_PLAYERS, 'saat'));

    expect(a.players.map((player) => player.id)).toEqual(b.players.map((player) => player.id));
  });
});
```

`afterOpening` aus `./fixtures.js` importieren.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/setup.test.ts`
Expected: FAIL — `afterOpening` existiert nicht, `createGame` startet in `setup`.

- [ ] **Step 3: Write minimal implementation**

In `setup.ts`, in `createGame`:

```ts
    currentPlayerIndex: 0,
    // Vor der Gruendung wird ausgewuerfelt, wer beginnt. Erst danach steht
    // fest, wer auf Index 0 sitzt - siehe `opening.ts`.
    phase: { kind: 'opening', rolls: {}, pending: [...playerIds], round: 0 },
```

In `fixtures.ts` ans Ende:

```ts
/**
 * Wuerfelt den Auftakt zu Ende.
 *
 * Fuer alle Tests, die die Gruendung oder das Spiel pruefen und den Auftakt nur
 * hinter sich bringen wollen. Wer den Auftakt selbst prueft, wuerfelt einzeln.
 */
export function afterOpening(state: GameState): GameState {
  let current = state;

  // Ein Stechen endet mit Wahrscheinlichkeit eins, aber nicht nach einer festen
  // Zahl von Runden. Der Riegel faengt eine kaputte Auswertung ab, statt den
  // Testlauf haengen zu lassen.
  for (let guard = 0; guard < 200 && current.phase.kind === 'opening'; guard += 1) {
    const roller = current.phase.pending[0];
    if (roller === undefined) throw new Error('afterOpening: Warteschlange leer im Auftakt');

    const result = reduce(current, { type: 'rollDice', player: roller });
    if (!result.ok) throw new Error(`afterOpening: ${result.error.message}`);
    current = result.state;
  }

  if (current.phase.kind === 'opening') throw new Error('afterOpening: Der Auftakt endet nicht');

  return current;
}
```

Import in `fixtures.ts` ergänzen: `import { reduce } from './reducer.js';`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/setup.test.ts`
Expected: PASS

- [ ] **Step 5: Den Bestand reparieren**

Run: `pnpm typecheck && pnpm test`

Erwartet fallen jetzt Tests und Typen an den Stellen, die `createGame` benutzen und danach `setup` erwarten. Bekannte Kandidaten:

- `packages/shared/src/game/game.integration.test.ts`
- `apps/client/src/game/fullGame.test.ts`
- `apps/client/src/game/hotseat.test.ts`
- `apps/server/src/rooms/room.test.ts`, `roundtrip.test.ts`

**Regel für die Reparatur:** Tests, die den Auftakt nicht prüfen wollen, legen `afterOpening(...)` um ihren `createGame`-Aufruf. **Nicht** die Startphase wieder auf `setup` biegen — das wäre die zweite Wahrheit, die dieser Plan gerade abschafft. Der Durchlauf-Test in `fullGame.test.ts` soll den Auftakt hingegen **mitspielen**: er ist der einzige, der die ganze Partie von vorn prüft.

Für den Client und den Server: `apps/client/src/game/useHotseatGame.ts` und `apps/server/src/rooms/room.ts:281` erzeugen die Partie und brauchen **keine** Änderung — sie starten jetzt im Auftakt, und das ist der Sinn der Sache.

- [ ] **Step 6: Run the full suite**

Run: `pnpm typecheck && pnpm test`
Expected: grün. Ausgabe notieren (Testzahlen je Paket) — sie geht in die Abnahme.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Jede Partie beginnt mit dem Auftakt"
```

---

### Task 6: Der Verlaufssatz

**Files:**

- Modify: `packages/shared/src/game/log.ts` (`case 'rollDice'` ab :60)
- Test: `packages/shared/src/game/log.test.ts`

**Interfaces:**

- Consumes: `yieldTotal` aus `./dice.js` (steht dort vermutlich schon)
- Produces: Verlaufssatz für den Auftaktwurf

- [ ] **Step 1: Write the failing test**

An `packages/shared/src/game/log.test.ts` anhängen:

```ts
describe('der Verlaufssatz im Auftakt', () => {
  it('nennt den Wurf und nicht den Ertrag', () => {
    const before = testGame({
      phase: { kind: 'opening', rolls: {}, pending: ['p1', 'p2', 'p3'], round: 0 },
      turn: 0,
    });
    const result = reduce(before, { type: 'rollDice', player: 'p1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const action = { type: 'rollDice', player: 'p1' } as const;
    const text = describeTransition(before, action, result.state, seats);

    expect(text).toContain('Auftakt');
    expect(text).not.toContain('erntet');
  });

  it('sagt, wenn ein Stechen noetig wird', () => {
    const before = testGame({
      phase: {
        kind: 'opening',
        rolls: {
          p1: [
            { die: 'w6a', value: 4 },
            { die: 'w6b', value: 3 },
          ],
        },
        pending: ['p2'],
        round: 0,
      },
      players: testGame().players.slice(0, 2),
      turn: 0,
    });
    const result = reduce(before, { type: 'rollDice', player: 'p2' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const action = { type: 'rollDice', player: 'p2' } as const;
    const text = describeTransition(before, action, result.state, seats);

    // Entweder ist entschieden oder es wird gestochen - beides muss der Satz sagen.
    expect(text === '' ? 'leer' : text).toMatch(/beginnt|Stechen/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/log.test.ts`
Expected: FAIL — der Satz spricht von Ertrag.

- [ ] **Step 3: Write minimal implementation**

In `log.ts`, im `case 'rollDice'`, **vor** der Ertragsauswertung:

```ts
if (before.phase.kind === 'opening') {
  const total = yieldTotal(before.rules.dice, after.lastRoll ?? []);

  if (after.phase.kind === 'setup') {
    const first = after.players[0]?.id;
    return `Auftakt: ${who} wuerfelt ${total} - ${first === undefined ? 'niemand' : nameOf(first)} beginnt`;
  }
  if (after.phase.kind === 'opening' && after.phase.round > before.phase.round) {
    return `Auftakt: ${who} wuerfelt ${total} - Gleichstand, es wird gestochen`;
  }
  return `Auftakt: ${who} wuerfelt ${total}`;
}
```

Der Zweig gehört in `describeAction` (`log.ts:45`), wo `who` und `nameOf` schon bereitstehen; `before` und `after` sind dort ebenfalls Parameter. `yieldTotal` ist in der Datei bereits importiert.

**Umlaute:** Dieser Text ist für Menschen, also „würfelt" mit Umlaut schreiben — der Codeblock oben ist ASCII, weil er in dieser Planungsdatei steht.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/log.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/log.ts packages/shared/src/game/log.test.ts
git commit -m "Der Verlauf erzaehlt den Auftakt"
```

---

### Task 7: Die Sicht des Clients

**Files:**

- Modify: `apps/client/src/game/view.ts` (`actingPlayers` ab :139, `phaseTextOf` ab :167)
- Test: `apps/client/src/game/view.test.ts`

**Interfaces:**

- Consumes: `PlayerView.phase` mit der Variante `opening`
- Produces: `actingPlayers(view)` nennt im Auftakt den Vordersten; `phaseTextOf` liefert den Statussatz

- [ ] **Step 1: Write the failing test**

An `apps/client/src/game/view.test.ts` anhängen:

```ts
describe('der Auftakt in der Sicht', () => {
  const opening = (pending: string[], round = 0) => ({
    phase: { kind: 'opening' as const, rolls: {}, pending, round },
    players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    currentPlayerIndex: 0,
  });

  it('laesst den Vordersten handeln', () => {
    expect(actingPlayers(opening(['p2', 'p3']))).toEqual(['p2']);
  });

  it('laesst niemanden handeln, wenn die Runde vollstaendig ist', () => {
    expect(actingPlayers(opening([]))).toEqual([]);
  });
});
```

Dazu im vorhandenen `phaseTextOf`-Testblock (oder analog dazu, wie die Datei es hält):

```ts
it('sagt im Auftakt, wer wuerfelt', () => {
  const view = viewFixture({
    phase: { kind: 'opening', rolls: {}, pending: ['p2', 'p3'], round: 0 },
  });

  expect(phaseTextOf(view)).toBe('Auftakt: Spieler 2 würfelt');
});

it('nennt das Stechen beim Namen', () => {
  const view = viewFixture({
    phase: { kind: 'opening', rolls: {}, pending: ['p1', 'p3'], round: 1 },
  });

  expect(phaseTextOf(view)).toBe('Stechen: Spieler 1 würfelt');
});
```

`viewFixture` ist der Helfer, den die Datei für `PlayerView` schon benutzt — den vorhandenen nehmen, keinen zweiten bauen. Heißt er anders, den vorhandenen Namen verwenden.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/view.test.ts`
Expected: FAIL — im Auftakt fällt `actingPlayers` in den Standardzweig, und `phaseTextOf` hat keinen Fall.

- [ ] **Step 3: Write minimal implementation**

In `actingPlayers`, vor `case 'setup'`:

```ts
    case 'opening':
      return view.phase.pending.slice(0, 1);
```

In `phaseTextOf`:

```ts
    case 'opening': {
      const roller = view.phase.pending[0] ?? null;
      const auftakt = view.phase.round === 0 ? 'Auftakt' : 'Stechen';
      return `${auftakt}: ${nameOf(roller)} würfelt`;
    }
```

`PhaseSource` (`view.ts:117`) trägt `phase` bereits als vollen Phasentyp — dort ist nichts zu ändern.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/view.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/game/view.ts apps/client/src/game/view.test.ts
git commit -m "Der Statussatz kennt den Auftakt"
```

---

### Task 8: Die Auftakttafel

**Files:**

- Create: `apps/client/src/panels/OpeningPanel.tsx`
- Create: `apps/client/src/panels/OpeningPanel.test.tsx`
- Modify: `apps/client/src/screens/GameScreen.tsx` (Einbau neben `.board-area`, um :315)
- Modify: `apps/client/src/index.css` (Abschnitt „Spielbildschirm")

**Interfaces:**

- Consumes: `PlayerView` (`view.phase` mit `kind: 'opening'`), `Seat`-Nachschlag wie in `TablePanel`
- Produces: `<OpeningPanel view={view} seats={seats} />` — rendert nichts, wenn die Phase nicht `opening` ist

- [ ] **Step 1: Write the failing test**

`apps/client/src/panels/OpeningPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpeningPanel } from './OpeningPanel';

const seats = [
  { id: 'p1', name: 'Spieler 1', color: 'rot' },
  { id: 'p2', name: 'Spieler 2', color: 'blau' },
];

const view = (
  pending: string[],
  rolls: Record<string, { die: string; value: number }[]>,
  round = 0,
) =>
  ({
    phase: { kind: 'opening' as const, rolls, pending, round },
    players: [
      { id: 'p1', name: 'Spieler 1' },
      { id: 'p2', name: 'Spieler 2' },
    ],
  }) as never;

describe('OpeningPanel', () => {
  it('zeigt die Summe dessen, der schon geworfen hat', () => {
    render(
      <OpeningPanel
        view={view(['p2'], {
          p1: [
            { die: 'w6a', value: 5 },
            { die: 'w6b', value: 4 },
          ],
        })}
        seats={seats}
      />,
    );

    expect(screen.getByText('Spieler 1')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('nennt den, der gerade wirft', () => {
    render(<OpeningPanel view={view(['p2'], {})} seats={seats} />);

    expect(screen.getByTestId('opening-roller')).toHaveTextContent('Spieler 2');
  });

  it('sagt beim Stechen, dass es eines ist', () => {
    render(<OpeningPanel view={view(['p1', 'p2'], {}, 1)} seats={seats} />);

    expect(screen.getByText(/Stechen/)).toBeInTheDocument();
  });

  it('zeichnet nichts, wenn kein Auftakt laeuft', () => {
    const { container } = render(
      <OpeningPanel view={{ phase: { kind: 'main' }, players: [] } as never} seats={seats} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
```

Den Seat-Typ und die Render-Hilfen so verwenden, wie `apps/client/src/panels/panels.test.tsx` es tut — dort steht das Muster für Panels mit `seats`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/panels/OpeningPanel.test.tsx`
Expected: FAIL — `./OpeningPanel` existiert nicht.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/panels/OpeningPanel.tsx`:

```tsx
import { yieldTotal, type PlayerView } from '@conquerist/shared';

import type { Seat } from '../seats';

/**
 * Die Auftakttafel: wer wie hoch geworfen hat und wer gerade wirft.
 *
 * Sie zeichnet nur den laufenden Auftakt. Was in einer frueheren Stechrunde
 * fiel, steht im Verlauf - der Zustand haelt bewusst nur die laufende Runde,
 * damit nirgends zu entscheiden ist, welche gilt.
 *
 * Die Wuerfel selbst zeichnet sie nicht: die fliegen ueber `useSettledRoll` wie
 * im Spiel, weil der Auftaktwurf `lastRoll` genauso setzt wie jeder andere.
 */
export function OpeningPanel({
  view,
  seats,
}: {
  readonly view: PlayerView;
  readonly seats: readonly Seat[];
}) {
  if (view.phase.kind !== 'opening') return null;

  const { rolls, pending, round } = view.phase;
  const roller = pending[0] ?? null;
  const nameOf = (id: string): string => seats.find((seat) => seat.id === id)?.name ?? id;

  return (
    <div className="opening" role="status">
      <p className="opening__title">{round === 0 ? 'Wer beginnt?' : 'Stechen'}</p>
      <ol className="opening__seats">
        {view.players.map((player) => {
          const roll = rolls[player.id];
          const total = roll === undefined ? null : yieldTotal(view.rules.dice, roll);

          return (
            <li key={player.id} className="opening__seat" data-active={player.id === roller}>
              <span className="opening__name">{nameOf(player.id)}</span>
              <span className="opening__total">{total ?? '·'}</span>
            </li>
          );
        })}
      </ol>
      {roller !== null && (
        <p className="opening__roller" data-testid="opening-roller">
          {nameOf(roller)} würfelt
        </p>
      )}
    </div>
  );
}
```

`view.rules` steht zur Verfügung (`playerView.ts:65` und `:152` führen das RuleSet mit), `yieldTotal` rechnet also im Client mit derselben Regel wie im Reducer.

In `GameScreen.tsx`, direkt nach `</div>` von `.board-area` (um :333):

```tsx
<OpeningPanel view={display} seats={seats} />
```

In `index.css` im Abschnitt „Spielbildschirm" die Tafel als Ding auf dem Tisch anlegen: mittig über dem Brett, heller Körper mit Kontaktschatten (das Muster steht bei `.tray`), `pointer-events: none` für die Tafel selbst — sie ist Auskunft, der Würfelknopf liegt woanders.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/panels/OpeningPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/panels/OpeningPanel.tsx apps/client/src/panels/OpeningPanel.test.tsx apps/client/src/screens/GameScreen.tsx apps/client/src/index.css
git commit -m "Die Auftakttafel liegt auf dem Tisch"
```

---

### Task 9: Abnahme

**Files:**

- Modify: `PROGRESS.md`

- [ ] **Step 1: Die ganze Abnahme fahren**

```bash
pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Alle vier müssen grün sein. Die Testzahlen je Paket notieren.

- [ ] **Step 2: Im Browser ansehen**

`pnpm dev`, eine lokale Partie mit drei Spielern starten. Zu prüfen:

1. Die Auftakttafel steht da, bevor irgendetwas gesetzt werden kann.
2. Der Würfelknopf wirkt reihum, und die Würfel fliegen wie im Spiel.
3. Nach dem letzten Wurf steht der Höchste vorn und setzt die erste Siedlung.
4. Die Farben der Spieler haben sich **nicht** verschoben.

Punkt 4 ist der Bumerang-Verdacht aus dem Entwurf. Er ist am Quelltext geprüft (`seats.ts` schlägt per Id nach), aber er gehört gesehen.

- [ ] **Step 3: `PROGRESS.md` fortschreiben**

Einen Abschnitt im Ton der bestehenden Einträge: Stand, was gebaut wurde, die Abnahmetabelle, wie viele Tests dazugekommen sind, und was offen bleibt (die fehlende Frist im Auftakt).

- [ ] **Step 4: Commit**

```bash
git add PROGRESS.md
git commit -m "Der Auftakt ist abgenommen"
```

---

## Self-Review

**Spec-Abdeckung:** Abschnitt 1 (Phase) → Task 1. Abschnitt 2 (keine neue Aktion) → Task 3. Abschnitt 3 (Auflösung, `yieldTotal`, RNG) → Task 2. Abschnitt 4 (Rotation gefahrlos) → Task 2 (`rotateToFirst`) und Task 9 Schritt 2 Punkt 4. Abschnitt 5 (Oberfläche) → Tasks 7 und 8. Abschnitt 6 (Server/Protokoll: nichts) → Task 5 Schritt 5 hält ausdrücklich fest, dass Server und Hotseat unverändert bleiben. Abschnitt 7 (keine Frist) → nicht umgesetzt, ausdrücklich; steht in Task 9 Schritt 3 als offener Punkt.

**Namen quer geprüft:** `openingRoller` (Tasks 1, 3, 4), `applyOpeningRoll` (Tasks 2, 3), `highestRollers`/`rotateToFirst` (Task 2), `afterOpening` (Task 5). Die Phasenfelder heißen in jedem Task `rolls`, `pending`, `round`.

**Beim Selbstdurchgang nachgeschlagen und im Plan festgeschrieben** statt dem Ausführenden überlassen: `describeTransition(before, action, after, seats)` ist die Signatur (`log.ts:27`), der Zweig gehört in `describeAction` mit dem dort vorhandenen `who`/`nameOf`; und `PlayerView` führt `rules` mit (`playerView.ts:65`), die Auftakttafel darf also `yieldTotal` benutzen. Keine Stelle im Plan verlangt noch eine eigene Entscheidung.
