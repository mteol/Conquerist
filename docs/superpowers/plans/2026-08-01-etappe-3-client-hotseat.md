# Etappe 3 — Client: SVG-Brett und Hotseat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine vollstaendige Catan-artige Partie im Browser spielbar machen — Startbildschirm, SVG-Brett, Hotseat von der Gruendung bis zum Sieg — ohne eine Zeile Spielregel im Client.

**Architecture:** Die Oberflaeche fragt `legalActions(state, player)` und baut daraus Nachschlagekarten (Knoten/Kante/Feld → Aktion). Ein Klick schlaegt darin nach und schickt die Aktion durch `reduce`. Alles Rechnende liegt in reinen Modulen ohne React (Layout, Klickkarten, Anzeigemodell, Verlaufssaetze) und wird ohne DOM getestet; die React-Schicht darueber ist duenn und bekommt wenige, gezielte jsdom-Tests.

**Tech Stack:** React 19, TypeScript 7 (strict), Vite 8, Vitest 4, Testing Library + jsdom, `@conquerist/shared` (Etappen 1–2).

## Global Constraints

- **`packages/shared` bleibt unangetastet.** Faellt eine Luecke auf, wird sie als eigener Punkt gemeldet, nicht nebenbei gefuellt.
- **Keine Regel im Client.** Kein `if (genug Holz)`, kein „ist der Knoten frei". Einzige Quellen: `legalActions`, `reduce`, `tradeRateFor`, `discardCountFor`, `victoryPointsOf`, `victimsAt`.
- **Antworten und Anzeigetexte auf Deutsch, Code und Bezeichner auf Englisch.** Kommentare erklaeren das Warum.
- **Vollstaendige Dateien, keine Ausschnitte.**
- **TypeScript strict** mit `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`. Indexzugriffe liefern `| undefined` — das muss behandelt werden.
- **Kein `Math.random()`, kein `Date.now()` in Spiel-naher Logik.** Einzige Ausnahme: der Seed-Vorschlag im Startbildschirm (`crypto.getRandomValues`).
- **Ausrichtung: Spitze oben.**
- **Commit-Nachrichten auf Deutsch, ohne `Co-Authored-By`-Zeile.**
- Nach jeder Aufgabe muss `pnpm --filter @conquerist/client test` gruen sein; am Ende zusaetzlich `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`.
- Formatierung vor jedem Commit: `pnpm prettier --write <geaenderte Dateien>`.

**Spezifikation:** `docs/superpowers/specs/2026-08-01-etappe-3-client-hotseat-design.md`

## Dateien im Ueberblick

| Datei                                             | Verantwortung                                           |
| ------------------------------------------------- | ------------------------------------------------------- |
| `apps/client/src/seats.ts`                        | Sitze: Id, Name, Farbe; Farbpalette fuer sechs Spieler  |
| `apps/client/src/board/layout.ts`                 | Feld/Knoten/Kante → Punkte, Ausmasse, `viewBox`         |
| `apps/client/src/game/targets.ts`                 | `legalActions` → Klickkarten                            |
| `apps/client/src/game/labels.ts`                  | deutsche Bezeichner                                     |
| `apps/client/src/game/view.ts`                    | `GameState` → Anzeigemodell, Verdecken                  |
| `apps/client/src/game/log.ts`                     | Zustandsuebergang → Verlaufssatz                        |
| `apps/client/src/game/hotseat.ts`                 | reiner Reducer ueber `reduce` (Zustand, Folge, Verlauf) |
| `apps/client/src/game/useHotseatGame.ts`          | duenner React-Haken darum                               |
| `apps/client/src/board/BoardSvg.tsx`              | das Brett; meldet nur, wo geklickt wurde                |
| `apps/client/src/panels/*.tsx`                    | Tisch, Status, Aktionen, Verlauf, Warteliste            |
| `apps/client/src/dialogs/*.tsx`                   | Abwerfen, Handel, Opferwahl                             |
| `apps/client/src/screens/GameScreen.tsx`          | setzt Brett, Panels und Dialoge zusammen                |
| `apps/client/src/screens/StartScreen.tsx`         | Sitze, Brett, Seed, aufklappbare Diagnose               |
| `apps/client/src/diagnostics/ConnectionPanel.tsx` | die Etappe-0-Anzeige, umgezogen                         |
| `apps/client/src/test/dom.ts`                     | `render`/`screen` mit automatischem Aufraeumen          |

---

### Task 1: Sitze und Farben

**Files:**

- Create: `apps/client/src/seats.ts`
- Test: `apps/client/src/seats.test.ts`

**Interfaces:**

- Consumes: nichts.
- Produces: `interface Seat { readonly id: PlayerId; readonly name: string; readonly color: string }`, `SEAT_COLORS: readonly string[]` (sechs Farben), `defaultSeats(count: number): Seat[]`, `seatsById(seats: readonly Seat[]): ReadonlyMap<PlayerId, Seat>`, `MIN_SEATS = 3`, `MAX_SEATS = 6`.

- [ ] **Step 1: Write the failing test**

`apps/client/src/seats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, defaultSeats, seatsById } from './seats';

describe('Sitze', () => {
  it('haelt fuer jede erlaubte Tischgroesse eine eigene Farbe bereit', () => {
    expect(SEAT_COLORS).toHaveLength(MAX_SEATS);
    expect(new Set(SEAT_COLORS).size).toBe(MAX_SEATS);
  });

  it('vergibt eindeutige Ids und Farben', () => {
    const seats = defaultSeats(6);

    expect(seats).toHaveLength(6);
    expect(new Set(seats.map((seat) => seat.id)).size).toBe(6);
    expect(new Set(seats.map((seat) => seat.color)).size).toBe(6);
    expect(seats.map((seat) => seat.name)).toEqual([
      'Spieler 1',
      'Spieler 2',
      'Spieler 3',
      'Spieler 4',
      'Spieler 5',
      'Spieler 6',
    ]);
  });

  it('weist Tischgroessen ausserhalb der Grenzen zurueck', () => {
    expect(() => defaultSeats(MIN_SEATS - 1)).toThrow(RangeError);
    expect(() => defaultSeats(MAX_SEATS + 1)).toThrow(RangeError);
  });

  it('schlaegt Sitze ueber ihre Id nach', () => {
    const seats = defaultSeats(3);
    const map = seatsById(seats);

    expect(map.get(seats[1]!.id)?.name).toBe('Spieler 2');
    expect(map.get('unbekannt')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/seats.test.ts`
Expected: FAIL — `Failed to resolve import "./seats"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/seats.ts`:

```ts
import type { PlayerId } from '@conquerist/shared';

/**
 * Ein Sitz am Tisch: Id, Name, Farbe.
 *
 * `PlayerState` in `shared` kennt nur `id`, `resources` und `piecesLeft` - wie
 * ein Spieler heisst, ist keine Regelfrage. Deshalb fuehrt der Client diese
 * Liste selbst und uebergibt `createGame` nur die Ids. Ab Etappe 4 wird aus der
 * Id eine `user_id` (Regel 7), ohne dass sich an der Logik etwas aendert.
 */
export interface Seat {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
}

/** Kleinste und groesste Tischgroesse ueber beide Bretter. */
export const MIN_SEATS = 3;
export const MAX_SEATS = 6;

/**
 * Sechs unterscheidbare Farben - so viele, wie `classic56` Spieler traegt.
 *
 * Ausgewaehlt auf Unterscheidbarkeit auch bei Rot-Gruen-Schwaeche: die Paare
 * Rot/Gruen und Blau/Violett trennen sich zusaetzlich in der Helligkeit.
 */
export const SEAT_COLORS: readonly string[] = [
  '#c0392b',
  '#2c6fbb',
  '#e08a2e',
  '#3f8f5b',
  '#8e5bb5',
  '#d8d3c7',
];

/** Standardbesetzung: durchnummerierte Ids, Namen und die Farben der Reihe nach. */
export function defaultSeats(count: number): Seat[] {
  if (!Number.isInteger(count) || count < MIN_SEATS || count > MAX_SEATS) {
    throw new RangeError(
      `defaultSeats: ${MIN_SEATS} bis ${MAX_SEATS} Spieler, angefragt waren ${count}`,
    );
  }

  return Array.from({ length: count }, (_unused, index) => ({
    id: `p${index + 1}`,
    name: `Spieler ${index + 1}`,
    color: SEAT_COLORS[index]!,
  }));
}

/** Nachschlagetabelle Id -> Sitz. */
export function seatsById(seats: readonly Seat[]): ReadonlyMap<PlayerId, Seat> {
  return new Map(seats.map((seat) => [seat.id, seat]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/seats.test.ts`
Expected: PASS, 4 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/seats.ts apps/client/src/seats.test.ts
git add apps/client/src/seats.ts apps/client/src/seats.test.ts
git commit -m "Client: Sitze mit Namen und Farben"
```

---

### Task 2: Brettgeometrie im SVG

**Files:**

- Create: `apps/client/src/board/layout.ts`
- Test: `apps/client/src/board/layout.test.ts`

**Interfaces:**

- Consumes: nichts aus frueheren Aufgaben.
- Produces: `interface Point { readonly x: number; readonly y: number }`, `hexCenter(hex: Hex): Point`, `vertexPoint(vertex: VertexId): Point`, `hexCorners(hex: Hex): readonly Point[]`, `edgeSegment(edge: EdgeId): readonly [Point, Point]`, `edgeMidpoint(edge: EdgeId): Point`, `viewBoxOf(hexIds: readonly HexId[], padding: number): string`.

**Der Kniff:** Die Ecken eines Feldes werden **nicht** aus Winkeln gerechnet, sondern aus den Knoten-Ids abgeleitet — eine Knoten-Id _ist_ die Menge ihrer drei Felder, und der Schwerpunkt dieser drei Mittelpunkte ist genau die Ecke. Damit kann die Zeichnung gar nicht von der Geometrie aus Etappe 1 abweichen; ein Winkelversatz waere sonst ein stiller Fehler, der erst beim Klicken auffaellt.

- [ ] **Step 1: Write the failing test**

`apps/client/src/board/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_56,
  boardOf,
  generateScenario,
  hexFromId,
  hexVertices,
  vertexId,
} from '@conquerist/shared';
import { edgeSegment, hexCenter, hexCorners, vertexPoint, viewBoxOf } from './layout';

const round = (value: number): number => Math.round(value * 1e6) / 1e6;

describe('Brettgeometrie', () => {
  it('legt das Ursprungsfeld in den Ursprung', () => {
    expect(hexCenter({ q: 0, r: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('stellt die Felder mit der Spitze nach oben', () => {
    const corners = hexCorners({ q: 0, r: 0 });
    const top = corners.reduce((best, point) => (point.y < best.y ? point : best));

    // Spitze oben heisst: die oberste Ecke liegt senkrecht ueber dem Mittelpunkt
    // und im Abstand eines Umkreisradius. Bei Kante oben lægen dort zwei Ecken.
    expect(round(top.x)).toBe(0);
    expect(round(top.y)).toBe(-1);
    expect(corners).toHaveLength(6);
  });

  it('setzt benachbarte Felder im Abstand einer Feldbreite nebeneinander', () => {
    const a = hexCenter({ q: 0, r: 0 });
    const b = hexCenter({ q: 1, r: 0 });

    expect(round(Math.hypot(b.x - a.x, b.y - a.y))).toBe(round(Math.sqrt(3)));
  });

  it('liefert fuer jeden Knoten dieselbe Stelle, egal ueber welches Feld man ihn nennt', () => {
    const scenario = generateScenario(CLASSIC_34, 'layout-probe');
    const board = boardOf(scenario);

    for (const hexId of board.topology.hexes) {
      const hex = hexFromId(hexId);
      const corners = hexCorners(hex);

      hexVertices(hex).forEach((vertex, corner) => {
        const fromId = vertexPoint(vertex);
        const fromCorner = corners[corner]!;

        expect(round(fromId.x)).toBe(round(fromCorner.x));
        expect(round(fromId.y)).toBe(round(fromCorner.y));
        expect(vertex).toBe(vertexId(hex, corner));
      });
    }
  });

  it('zieht jede Kante zwischen zwei benachbarten Ecken', () => {
    const scenario = generateScenario(CLASSIC_34, 'layout-probe');
    const board = boardOf(scenario);

    for (const edge of board.topology.edges) {
      const [from, to] = edgeSegment(edge);
      expect(round(Math.hypot(to.x - from.x, to.y - from.y))).toBe(1);
    }
  });

  it('umschliesst jedes Feld beider Bretter', () => {
    for (const blueprint of [CLASSIC_34, CLASSIC_56]) {
      const scenario = generateScenario(blueprint, 'viewbox-probe');
      const hexes = scenario.hexes.map((placement) => placement.hex);
      const [x, y, width, height] = viewBoxOf(hexes, 0.2).split(' ').map(Number) as number[];

      for (const hexId of hexes) {
        for (const corner of hexCorners(hexFromId(hexId))) {
          expect(corner.x).toBeGreaterThanOrEqual(x!);
          expect(corner.x).toBeLessThanOrEqual(x! + width!);
          expect(corner.y).toBeGreaterThanOrEqual(y!);
          expect(corner.y).toBeLessThanOrEqual(y! + height!);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/board/layout.test.ts`
Expected: FAIL — `Failed to resolve import "./layout"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/board/layout.ts`:

```ts
import {
  edgeVertices,
  hexFromId,
  hexVertices,
  vertexHexes,
  type EdgeId,
  type Hex,
  type HexId,
  type VertexId,
} from '@conquerist/shared';

/**
 * Vom Sechseckgitter auf die Zeichenflaeche - und nur das.
 *
 * Masseinheit ist der Umkreisradius eines Feldes (= 1). Wie gross das Brett am
 * Bildschirm erscheint, entscheidet allein der `viewBox` des SVG; hier steht
 * keine Pixelzahl.
 *
 * Ausrichtung: **Spitze oben**. Damit liegen die Reihen 3-4-5-4-3 waagerecht,
 * wie im Blueprint und wie auf dem Tisch. Die Entscheidung faellt hier und
 * nirgends sonst - die Geometrie in `shared` ist bewusst orientierungsagnostisch
 * geblieben.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Abstand zweier benachbarter Feldmittelpunkte bei Spitze oben. */
const ROW_STEP = Math.sqrt(3);

/** Mittelpunkt eines Feldes. */
export function hexCenter(hex: Hex): Point {
  return { x: ROW_STEP * (hex.q + hex.r / 2), y: 1.5 * hex.r };
}

/**
 * Die Stelle eines Knotens.
 *
 * Die Id *ist* die sortierte Menge der drei angrenzenden Felder (Etappe 1),
 * und der Schwerpunkt dreier Feldmittelpunkte, die sich paarweise beruehren,
 * ist genau die gemeinsame Ecke. Die Zeichnung kann damit gar nicht von der
 * Geometrie abweichen - eine zweite Rechnung aus Winkeln koennte es.
 */
export function vertexPoint(vertex: VertexId): Point {
  const hexes = vertexHexes(vertex);
  let x = 0;
  let y = 0;

  for (const hex of hexes) {
    const center = hexCenter(hex);
    x += center.x;
    y += center.y;
  }

  return { x: x / hexes.length, y: y / hexes.length };
}

/** Die sechs Ecken eines Feldes, in Eckenreihenfolge - abgeleitet aus den Knoten-Ids. */
export function hexCorners(hex: Hex): readonly Point[] {
  return hexVertices(hex).map(vertexPoint);
}

/** Die Strecke einer Kante: ihre beiden Endknoten. */
export function edgeSegment(edge: EdgeId): readonly [Point, Point] {
  const [from, to] = edgeVertices(edge);
  if (from === undefined || to === undefined) {
    throw new TypeError(`edgeSegment: ${edge} hat keine zwei Endknoten`);
  }
  return [vertexPoint(from), vertexPoint(to)];
}

/** Die Mitte einer Kante - dort sitzt die Hafenmarke. */
export function edgeMidpoint(edge: EdgeId): Point {
  const [from, to] = edgeSegment(edge);
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/**
 * Der `viewBox`, der alle Felder umschliesst.
 *
 * Aus den tatsaechlichen Ausmassen gerechnet, nicht aus der Brettgroesse
 * geraten: `classic56` mit 3-4-5-6-5-4-3 faellt damit ohne Sonderfall an.
 */
export function viewBoxOf(hexIds: readonly HexId[], padding: number): string {
  if (hexIds.length === 0) {
    throw new RangeError('viewBoxOf: Ein Brett braucht mindestens ein Feld');
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const hexId of hexIds) {
    for (const corner of hexCorners(hexFromId(hexId))) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
  }

  return [
    minX - padding,
    minY - padding,
    maxX - minX + 2 * padding,
    maxY - minY + 2 * padding,
  ].join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/board/layout.test.ts`
Expected: PASS, 6 Tests.

Schlaegt die Probe „Spitze nach oben" fehl, ist **nicht** der Test falsch: dann liefert `hexCenter` eine andere Ausrichtung. `x` und `y` sind dann vertauscht (Kante oben) — zurueck zu der Formel oben.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/board/layout.ts apps/client/src/board/layout.test.ts
git add apps/client/src/board
git commit -m "Client: Brettgeometrie fuer das SVG, Spitze oben"
```

---

### Task 3: Klickkarten aus `legalActions`

**Files:**

- Create: `apps/client/src/game/targets.ts`
- Test: `apps/client/src/game/targets.test.ts`

**Interfaces:**

- Consumes: nichts aus frueheren Aufgaben.
- Produces: `interface ActionTargets { readonly vertices: ReadonlyMap<VertexId, GameAction>; readonly edges: ReadonlyMap<EdgeId, GameAction>; readonly hexes: ReadonlyMap<HexId, readonly GameAction[]>; readonly trades: readonly GameAction[]; readonly roll: GameAction | null; readonly endTurn: GameAction | null }`, `actionTargets(state: GameState, player: PlayerId): ActionTargets`, `EMPTY_TARGETS: ActionTargets`.

- [ ] **Step 1: Write the failing test**

`apps/client/src/game/targets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  type GameAction,
  type GameState,
} from '@conquerist/shared';
import { actionTargets } from './targets';

const scenario = generateScenario(CLASSIC_34, 'targets-probe');
const ids = ['p1', 'p2', 'p3'];

function fresh(): GameState {
  return createGame(scenario, CLASSIC_RULES, ids, 'targets-probe');
}

/** Spielt die Gruendungsphase mit der jeweils ersten erlaubten Wahl durch. */
function afterSetup(): GameState {
  let state = fresh();

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const action = legalActions(state, player)[0]!;
    const result = reduce(state, action);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

describe('Klickkarten', () => {
  it('legt jede Gruendungssiedlung auf ihren Knoten', () => {
    const state = fresh();
    const player = setupPlayer(state)!;
    const targets = actionTargets(state, player);

    expect(targets.edges.size).toBe(0);
    expect(targets.roll).toBeNull();
    expect(targets.vertices.size).toBeGreaterThan(0);

    for (const [vertex, action] of targets.vertices) {
      expect(action.type).toBe('placeSetupSettlement');
      expect(action).toMatchObject({ player, vertex });
    }
  });

  it('nennt nach der Siedlung nur noch die anschliessenden Kanten', () => {
    let state = fresh();
    const player = setupPlayer(state)!;
    const first = legalActions(state, player)[0]!;
    const result = reduce(state, first);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;

    const targets = actionTargets(state, player);

    expect(targets.vertices.size).toBe(0);
    expect(targets.edges.size).toBeGreaterThan(0);
    for (const action of targets.edges.values()) {
      expect(action.type).toBe('placeSetupRoad');
    }
  });

  it('bietet vor dem Wuerfeln nur das Wuerfeln an', () => {
    const state = afterSetup();
    const player = state.players[state.currentPlayerIndex]!.id;
    const targets = actionTargets(state, player);

    expect(state.phase.kind).toBe('rollPending');
    expect(targets.roll).toEqual({ type: 'rollDice', player });
    expect(targets.endTurn).toBeNull();
    expect(targets.vertices.size).toBe(0);
    expect(targets.edges.size).toBe(0);
    expect(targets.trades).toHaveLength(0);
  });

  it('bietet einem Spieler ohne Zugrecht nichts an', () => {
    const state = afterSetup();
    const other = state.players[1]!.id;
    const targets = actionTargets(state, other);

    expect(targets.roll).toBeNull();
    expect(targets.endTurn).toBeNull();
    expect(targets.vertices.size).toBe(0);
  });

  it('verteilt jede Aktion aus legalActions auf genau eine Stelle', () => {
    const state = afterSetup();
    const player = state.players[state.currentPlayerIndex]!.id;
    const rolled = reduce(state, { type: 'rollDice', player });
    if (!rolled.ok) throw new Error(rolled.error.message);

    const after = rolled.state;
    const actor = after.phase.kind === 'main' ? player : after.players[0]!.id;
    const expected = legalActions(after, actor);
    const targets = actionTargets(after, actor);

    const collected: GameAction[] = [
      ...targets.vertices.values(),
      ...targets.edges.values(),
      ...[...targets.hexes.values()].flat(),
      ...targets.trades,
      ...(targets.roll === null ? [] : [targets.roll]),
      ...(targets.endTurn === null ? [] : [targets.endTurn]),
    ];

    expect(collected).toHaveLength(expected.length);
    expect(new Set(collected.map((action) => JSON.stringify(action)))).toEqual(
      new Set(expected.map((action) => JSON.stringify(action))),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/targets.test.ts`
Expected: FAIL — `Failed to resolve import "./targets"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/game/targets.ts`:

```ts
import {
  legalActions,
  type EdgeId,
  type GameAction,
  type GameState,
  type HexId,
  type PlayerId,
  type VertexId,
} from '@conquerist/shared';

/**
 * Was der Spieler wo anklicken kann - abgeleitet, nicht selbst gewusst.
 *
 * Der Client kennt keine Regel. Er fragt `legalActions` und sortiert die
 * Antwort nach Ort: Knoten, Kante, Feld. Ein Klick schlaegt hier nach und
 * schickt die gefundene Aktion durch `reduce`. Damit gibt es weiterhin genau
 * eine Regelauslegung - dieselbe, die `legalActions` und `reduce` sich seit
 * Etappe 2 teilen.
 *
 * Warum die Zielart am Ort eindeutig ist: eine Stadt ist nur moeglich, wo die
 * eigene Siedlung steht, eine Siedlung nur auf einem freien Knoten. Zwei
 * Aktionen auf demselben Knoten waeren ein Widerspruch in den Regeln und kein
 * Bedienproblem - deshalb wirft der Aufbau dort, statt still die erste zu
 * nehmen.
 */
export interface ActionTargets {
  readonly vertices: ReadonlyMap<VertexId, GameAction>;
  readonly edges: ReadonlyMap<EdgeId, GameAction>;
  /** Raeuberziele: je moeglichem Opfer eine Aktion, deshalb eine Liste. */
  readonly hexes: ReadonlyMap<HexId, readonly GameAction[]>;
  readonly trades: readonly GameAction[];
  readonly roll: GameAction | null;
  readonly endTurn: GameAction | null;
}

/** Nichts anklickbar - fuer Spieler, die gerade nicht handeln duerfen. */
export const EMPTY_TARGETS: ActionTargets = {
  vertices: new Map(),
  edges: new Map(),
  hexes: new Map(),
  trades: [],
  roll: null,
  endTurn: null,
};

export function actionTargets(state: GameState, player: PlayerId): ActionTargets {
  const vertices = new Map<VertexId, GameAction>();
  const edges = new Map<EdgeId, GameAction>();
  const hexes = new Map<HexId, GameAction[]>();
  const trades: GameAction[] = [];
  let roll: GameAction | null = null;
  let endTurn: GameAction | null = null;

  const claim = <K, V>(map: Map<K, V>, key: K, value: V, what: string): void => {
    if (map.has(key)) {
      throw new RangeError(`actionTargets: ${what} ${String(key)} ist doppelt belegt`);
    }
    map.set(key, value);
  };

  for (const action of legalActions(state, player)) {
    switch (action.type) {
      case 'placeSetupSettlement':
      case 'buildSettlement':
      case 'buildCity':
        claim(vertices, action.vertex, action, 'Knoten');
        break;

      case 'placeSetupRoad':
      case 'buildRoad':
        claim(edges, action.edge, action, 'Kante');
        break;

      case 'moveRobber': {
        const bucket = hexes.get(action.hex);
        if (bucket === undefined) hexes.set(action.hex, [action]);
        else bucket.push(action);
        break;
      }

      case 'tradeWithBank':
        trades.push(action);
        break;

      case 'rollDice':
        roll = action;
        break;

      case 'endTurn':
        endTurn = action;
        break;

      case 'discard':
        // `legalActions` zaehlt das Abwerfen bewusst nicht auf - bei acht
        // Handkarten gaebe es dutzende gueltige Kombinationen. Der Dialog
        // stellt sie zusammen. Dieser Zweig ist reine Vollstaendigkeit.
        break;
    }
  }

  return { vertices, edges, hexes, trades, roll, endTurn };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/targets.test.ts`
Expected: PASS, 5 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/game/targets.ts apps/client/src/game/targets.test.ts
git add apps/client/src/game
git commit -m "Client: Klickkarten aus legalActions"
```

---

### Task 4: Deutsche Bezeichner

**Files:**

- Create: `apps/client/src/game/labels.ts`
- Test: `apps/client/src/game/labels.test.ts`

**Interfaces:**

- Consumes: nichts.
- Produces: `RESOURCE_LABELS: Readonly<Record<ResourceId, string>>`, `TERRAIN_LABELS: Readonly<Record<TerrainId, string>>`, `TERRAIN_COLORS: Readonly<Record<TerrainId, string>>`, `harborLabel(harbor: HarborDefinition): string`, `resourceList(amounts: ResourceAmounts): string`.

- [ ] **Step 1: Write the failing test**

`apps/client/src/game/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RESOURCE_IDS, TERRAIN_IDS } from '@conquerist/shared';
import {
  RESOURCE_LABELS,
  TERRAIN_COLORS,
  TERRAIN_LABELS,
  harborLabel,
  resourceList,
} from './labels';

describe('Bezeichner', () => {
  it('benennt jede Ressource und jedes Gelaende', () => {
    for (const resource of RESOURCE_IDS) {
      expect(RESOURCE_LABELS[resource]).toBeTruthy();
    }
    for (const terrain of TERRAIN_IDS) {
      expect(TERRAIN_LABELS[terrain]).toBeTruthy();
      expect(TERRAIN_COLORS[terrain]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('unterscheidet die Hafenarten', () => {
    expect(harborLabel({ edge: 'e:0,0|1,0', ratio: 3 })).toBe('3:1 beliebig');
    expect(harborLabel({ edge: 'e:0,0|1,0', ratio: 2, resource: 'ore' })).toBe('2:1 Erz');
  });

  it('zaehlt nur auf, was vorhanden ist', () => {
    expect(resourceList({ brick: 2, lumber: 0, wool: 1, grain: 0, ore: 0 })).toBe(
      '2 Lehm, 1 Wolle',
    );
    expect(resourceList({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 })).toBe('nichts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/labels.test.ts`
Expected: FAIL — `Failed to resolve import "./labels"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/game/labels.ts`:

```ts
import {
  RESOURCE_IDS,
  type HarborDefinition,
  type ResourceAmounts,
  type ResourceId,
  type TerrainId,
} from '@conquerist/shared';

/**
 * Anzeigetexte und Farben - der einzige Ort, an dem aus Ids Deutsch wird.
 *
 * `shared` bleibt englisch, weil dort die Ids stehen, die ab Etappe 6 in der
 * Datenbank landen. Uebersetzt wird an der Oberflaeche, einmal.
 */
export const RESOURCE_LABELS: Readonly<Record<ResourceId, string>> = {
  brick: 'Lehm',
  lumber: 'Holz',
  wool: 'Wolle',
  grain: 'Korn',
  ore: 'Erz',
};

export const TERRAIN_LABELS: Readonly<Record<TerrainId, string>> = {
  hills: 'Huegel',
  forest: 'Wald',
  pasture: 'Weide',
  fields: 'Feld',
  mountains: 'Gebirge',
  desert: 'Wueste',
};

/** Gelaendefarben - kraeftig genug, dass die Zahlenchips darauf lesbar bleiben. */
export const TERRAIN_COLORS: Readonly<Record<TerrainId, string>> = {
  hills: '#b4623a',
  forest: '#2f6b3a',
  pasture: '#7fb069',
  fields: '#e0b34a',
  mountains: '#8a8f98',
  desert: '#ddc9a3',
};

/** „3:1 beliebig" oder „2:1 Erz". */
export function harborLabel(harbor: HarborDefinition): string {
  return harbor.resource === undefined
    ? `${harbor.ratio}:1 beliebig`
    : `${harbor.ratio}:1 ${RESOURCE_LABELS[harbor.resource]}`;
}

/** Zaehlt eine Kartenmenge auf; leer bleibt nicht leer, sondern wird benannt. */
export function resourceList(amounts: ResourceAmounts): string {
  const parts = RESOURCE_IDS.filter((resource) => (amounts[resource] ?? 0) > 0).map(
    (resource) => `${amounts[resource] ?? 0} ${RESOURCE_LABELS[resource]}`,
  );

  return parts.length === 0 ? 'nichts' : parts.join(', ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/labels.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/game/labels.ts apps/client/src/game/labels.test.ts
git add apps/client/src/game
git commit -m "Client: deutsche Bezeichner und Gelaendefarben"
```

---

### Task 5: Anzeigemodell und Verdecken

**Files:**

- Create: `apps/client/src/game/view.ts`
- Test: `apps/client/src/game/view.test.ts`

**Interfaces:**

- Consumes: `Seat`, `seatsById` (Task 1).
- Produces: `actingPlayers(state: GameState): readonly PlayerId[]`, `interface PlayerView { id; name; color; victoryPoints; cardCount; resources: ResourceAmounts | null; piecesLeft; isCurrent; mustDiscard }`, `interface GameView { players: readonly PlayerView[]; actingPlayers; currentPlayerId; phaseText: string; lastRoll; turn; longestRoad }`, `gameView(state, seats, options: { readonly viewer: PlayerId | null; readonly conceal: boolean }): GameView`.

- [ ] **Step 1: Write the failing test**

`apps/client/src/game/view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  victoryPointsOf,
  type GameState,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { actingPlayers, gameView } from './view';

const scenario = generateScenario(CLASSIC_34, 'view-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const result = reduce(state, legalActions(state, player)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

describe('Anzeigemodell', () => {
  it('nennt in der Gruendung den Spieler aus der Schlange, nicht den Index', () => {
    const state = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
    expect(actingPlayers(state)).toEqual([setupPlayer(state)]);
  });

  it('nennt sonst den Spieler am Zug', () => {
    const state = afterSetup();
    expect(actingPlayers(state)).toEqual([state.players[state.currentPlayerIndex]!.id]);
  });

  it('uebernimmt Namen und Farbe aus den Sitzen und rechnet die Siegpunkte', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: false });

    expect(view.players.map((player) => player.name)).toEqual([
      'Spieler 1',
      'Spieler 2',
      'Spieler 3',
    ]);
    expect(view.players[0]!.color).toBe(seats[0]!.color);
    expect(view.players[1]!.victoryPoints).toBe(victoryPointsOf(state, ids[1]!));
  });

  it('zeigt offen alle Haende', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: false });

    for (const player of view.players) {
      expect(player.resources).not.toBeNull();
    }
  });

  it('verdeckt fremde Haende, die eigene nie', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: true });

    expect(view.players[0]!.resources).not.toBeNull();
    expect(view.players[1]!.resources).toBeNull();
    expect(view.players[2]!.resources).toBeNull();

    // Die Anzahl bleibt sichtbar - sie ist am Tisch ohnehin abzaehlbar.
    for (const player of view.players) {
      expect(player.cardCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('sagt in jeder Phase, was zu tun ist', () => {
    const setup = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
    expect(gameView(setup, seats, { viewer: null, conceal: false }).phaseText).toContain(
      'Gruendung',
    );

    const rolling = afterSetup();
    expect(gameView(rolling, seats, { viewer: null, conceal: false }).phaseText).toContain(
      'wuerfeln',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/view.test.ts`
Expected: FAIL — `Failed to resolve import "./view"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/game/view.ts`:

```ts
import {
  countResources,
  discardCountFor,
  setupPlayer,
  victoryPointsOf,
  type GameState,
  type PlayerId,
  type ResourceAmounts,
  type RuleSet,
} from '@conquerist/shared';
import { seatsById, type Seat } from '../seats';

/**
 * Die Projektion vom Zustand auf das, was am Bildschirm steht.
 *
 * Zwei Gruende, das als reine Funktion zu bauen: es laesst sich ohne DOM in
 * vielen Faellen pruefen, und es ist die ehrliche Vorarbeit fuer Etappe 5 -
 * `PlayerView` wird genau so eine Projektion sein, nur serverseitig und dann
 * nicht mehr abschaltbar.
 */
export interface PlayerView {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly victoryPoints: number;
  readonly cardCount: number;
  /** `null`, wenn verdeckt. Die Anzahl bleibt trotzdem sichtbar. */
  readonly resources: ResourceAmounts | null;
  readonly piecesLeft: RuleSet['pieceStock'];
  readonly isCurrent: boolean;
  /** Wie viele Karten dieser Spieler gerade abwerfen muss; 0, wenn keine. */
  readonly mustDiscard: number;
}

export interface GameView {
  readonly players: readonly PlayerView[];
  /** Wer jetzt handeln darf - in der Gruendung aus der Schlange, nach einer Sieben mehrere. */
  readonly actingPlayers: readonly PlayerId[];
  readonly currentPlayerId: PlayerId;
  readonly phaseText: string;
  readonly lastRoll: readonly [number, number] | null;
  readonly turn: number;
  readonly longestRoad: GameState['longestRoad'];
}

export interface ViewOptions {
  /** Wessen Karten offen bleiben, wenn verdeckt wird. */
  readonly viewer: PlayerId | null;
  readonly conceal: boolean;
}

/**
 * Wer handeln darf.
 *
 * In der Gruendung folgt der Zug der Schlange und nicht `currentPlayerIndex`;
 * nach einer Sieben sind es alle, die noch abwerfen muessen - `applyDiscard`
 * nimmt sie in beliebiger Reihenfolge.
 */
export function actingPlayers(state: GameState): readonly PlayerId[] {
  switch (state.phase.kind) {
    case 'setup': {
      const player = setupPlayer(state);
      return player === null ? [] : [player];
    }
    case 'discardPending':
      return state.phase.pending;
    case 'finished':
      return [];
    default:
      return [state.players[state.currentPlayerIndex]!.id];
  }
}

function phaseText(state: GameState, names: ReadonlyMap<PlayerId, Seat>): string {
  const nameOf = (id: PlayerId): string => names.get(id)?.name ?? id;

  switch (state.phase.kind) {
    case 'setup':
      return state.phase.settlement === null
        ? `Gruendung: ${nameOf(setupPlayer(state) ?? '')} setzt eine Siedlung`
        : `Gruendung: ${nameOf(setupPlayer(state) ?? '')} setzt die zugehoerige Strasse`;
    case 'rollPending':
      return `${nameOf(state.players[state.currentPlayerIndex]!.id)} muss wuerfeln`;
    case 'discardPending':
      return `Sieben: ${state.phase.pending.map(nameOf).join(' und ')} muss abwerfen`;
    case 'robberPending':
      return `${nameOf(state.players[state.currentPlayerIndex]!.id)} versetzt den Raeuber`;
    case 'main':
      return `${nameOf(state.players[state.currentPlayerIndex]!.id)} ist am Zug`;
    case 'finished':
      return `${nameOf(state.phase.winner)} hat gewonnen`;
  }
}

export function gameView(state: GameState, seats: readonly Seat[], options: ViewOptions): GameView {
  const byId = seatsById(seats);
  const current = state.players[state.currentPlayerIndex]!.id;

  const players = state.players.map((player): PlayerView => {
    const seat = byId.get(player.id);
    const open = !options.conceal || player.id === options.viewer;

    return {
      id: player.id,
      name: seat?.name ?? player.id,
      color: seat?.color ?? '#8b93a3',
      victoryPoints: victoryPointsOf(state, player.id),
      cardCount: countResources(player.resources),
      resources: open ? player.resources : null,
      piecesLeft: player.piecesLeft,
      isCurrent: player.id === current,
      mustDiscard:
        state.phase.kind === 'discardPending' && state.phase.pending.includes(player.id)
          ? discardCountFor(state, player.id)
          : 0,
    };
  });

  return {
    players,
    actingPlayers: actingPlayers(state),
    currentPlayerId: current,
    phaseText: phaseText(state, byId),
    lastRoll: state.lastRoll,
    turn: state.turn,
    longestRoad: state.longestRoad,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/view.test.ts`
Expected: PASS, 6 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/game/view.ts apps/client/src/game/view.test.ts
git add apps/client/src/game
git commit -m "Client: Anzeigemodell mit Verdecken fremder Haende"
```

---

### Task 6: Verlaufssaetze

**Files:**

- Create: `apps/client/src/game/log.ts`
- Test: `apps/client/src/game/log.test.ts`

**Interfaces:**

- Consumes: `Seat`, `seatsById` (Task 1), `RESOURCE_LABELS`, `resourceList` (Task 4).
- Produces: `describeTransition(before: GameState, action: GameAction, after: GameState, seats: readonly Seat[]): string`.

- [ ] **Step 1: Write the failing test**

`apps/client/src/game/log.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  type GameAction,
  type GameState,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { describeTransition } from './log';

const scenario = generateScenario(CLASSIC_34, 'log-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function apply(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('Verlaufssaetze', () => {
  it('nennt die Gruendungssiedlung beim Namen des Spielers', () => {
    const before = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    const action = legalActions(before, setupPlayer(before)!)[0]!;
    const after = apply(before, action);

    expect(describeTransition(before, action, after, seats)).toContain('Spieler 1');
    expect(describeTransition(before, action, after, seats)).toContain('Siedlung');
  });

  it('nennt beim Wurf die Augenzahl', () => {
    let state = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    while (state.phase.kind === 'setup') {
      state = apply(state, legalActions(state, setupPlayer(state)!)[0]!);
    }

    const player = state.players[state.currentPlayerIndex]!.id;
    const action: GameAction = { type: 'rollDice', player };
    const after = apply(state, action);
    const sum = after.lastRoll![0] + after.lastRoll![1];

    expect(describeTransition(state, action, after, seats)).toContain(String(sum));
  });

  it('faellt fuer unbekannte Sitze auf die Id zurueck statt zu werfen', () => {
    const before = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    const action = legalActions(before, setupPlayer(before)!)[0]!;
    const after = apply(before, action);

    expect(describeTransition(before, action, after, [])).toContain('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/log.test.ts`
Expected: FAIL — `Failed to resolve import "./log"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/game/log.ts`:

```ts
import { countResources, type GameAction, type GameState, type PlayerId } from '@conquerist/shared';
import { seatsById, type Seat } from '../seats';
import { RESOURCE_LABELS, resourceList } from './labels';

/**
 * Ein Satz je Zug, abgeleitet aus dem Zustandsuebergang.
 *
 * Etappe 2 hat die Ereignisliste im `ReduceResult` bewusst nicht gebaut - sie
 * bekommt ihren Anlass erst in Etappe 5, wenn ein Diebstahl fuer die
 * Beteiligten eine andere Nachricht ist als fuer den Rest des Tisches. Bis
 * dahin genuegt der Vergleich von vorher und nachher, und er hat einen Vorzug:
 * er kann nicht von dem abweichen, was wirklich passiert ist.
 */
export function describeTransition(
  before: GameState,
  action: GameAction,
  after: GameState,
  seats: readonly Seat[],
): string {
  const byId = seatsById(seats);
  const nameOf = (id: PlayerId): string => byId.get(id)?.name ?? id;
  const who = nameOf(action.player);

  switch (action.type) {
    case 'placeSetupSettlement':
      return `${who} setzt die Gruendungssiedlung`;
    case 'placeSetupRoad':
      return `${who} setzt die Gruendungsstrasse`;

    case 'rollDice': {
      const roll = after.lastRoll;
      if (roll === null) return `${who} wuerfelt`;
      const gains = describeGains(before, after, byId);
      return `${who} wuerfelt ${roll[0] + roll[1]}${gains === '' ? '' : ` - ${gains}`}`;
    }

    case 'discard':
      return `${who} wirft ab: ${resourceList(action.resources)}`;

    case 'moveRobber':
      return action.victim === null
        ? `${who} versetzt den Raeuber auf ${action.hex}`
        : `${who} versetzt den Raeuber auf ${action.hex} und bestiehlt ${nameOf(action.victim)}`;

    case 'buildRoad':
      return `${who} baut eine Strasse`;
    case 'buildSettlement':
      return `${who} baut eine Siedlung`;
    case 'buildCity':
      return `${who} baut eine Stadt`;

    case 'tradeWithBank':
      return `${who} tauscht ${RESOURCE_LABELS[action.give]} gegen ${RESOURCE_LABELS[action.receive]}`;

    case 'endTurn':
      return after.phase.kind === 'finished'
        ? `${nameOf(after.phase.winner)} gewinnt die Partie`
        : `${who} beendet den Zug`;
  }
}

/** Wer beim Wurf wie viele Karten bekommen hat - aus dem Unterschied gelesen. */
function describeGains(
  before: GameState,
  after: GameState,
  names: ReadonlyMap<PlayerId, Seat>,
): string {
  const parts: string[] = [];

  after.players.forEach((player, index) => {
    const previous = before.players[index];
    if (previous === undefined) return;

    const gained = countResources(player.resources) - countResources(previous.resources);
    if (gained > 0) {
      parts.push(`${names.get(player.id)?.name ?? player.id} +${gained}`);
    }
  });

  return parts.join(', ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/log.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/game/log.ts apps/client/src/game/log.test.ts
git add apps/client/src/game
git commit -m "Client: Verlaufssaetze aus dem Zustandsuebergang"
```

---

### Task 7: Der Hotseat-Zustand

**Files:**

- Create: `apps/client/src/game/hotseat.ts`
- Create: `apps/client/src/game/useHotseatGame.ts`
- Test: `apps/client/src/game/hotseat.test.ts`

**Interfaces:**

- Consumes: `describeTransition` (Task 6), `Seat` (Task 1).
- Produces: `interface LogEntry { readonly turn: number; readonly text: string }`, `interface HotseatState { readonly game: GameState; readonly actions: readonly GameAction[]; readonly log: readonly LogEntry[]; readonly lastError: string | null }`, `type HotseatEvent = { readonly type: 'apply'; readonly action: GameAction } | { readonly type: 'dismissError' }`, `startHotseat(game: GameState): HotseatState`, `hotseatReducer(state: HotseatState, event: HotseatEvent, seats: readonly Seat[]): HotseatState`, `useHotseatGame(game: GameState, seats: readonly Seat[])` → `{ readonly state: HotseatState; readonly dispatch: (action: GameAction) => void; readonly dismissError: () => void }`.

**Warum der Reducer die Sitze als drittes Argument nimmt:** Der Verlaufssatz braucht Namen, der Zustand soll sie aber nicht doppelt fuehren. Ein Argument statt eines Feldes haelt `HotseatState` frei von Anzeigekram — und der Reducer bleibt rein.

- [ ] **Step 1: Write the failing test**

`apps/client/src/game/hotseat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  replay,
  setupPlayer,
  type GameAction,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { hotseatReducer, startHotseat, type HotseatState } from './hotseat';

const scenario = generateScenario(CLASSIC_34, 'hotseat-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'hotseat-probe',
);

const apply = (state: HotseatState, action: GameAction): HotseatState =>
  hotseatReducer(state, { type: 'apply', action }, seats);

describe('Hotseat-Zustand', () => {
  it('beginnt ohne Aktionen, ohne Verlauf und ohne Fehler', () => {
    const state = startHotseat(start);

    expect(state.game).toBe(start);
    expect(state.actions).toHaveLength(0);
    expect(state.log).toHaveLength(0);
    expect(state.lastError).toBeNull();
  });

  it('haengt jede angenommene Aktion an Folge und Verlauf', () => {
    const state = apply(startHotseat(start), legalActions(start, setupPlayer(start)!)[0]!);

    expect(state.actions).toHaveLength(1);
    expect(state.log).toHaveLength(1);
    expect(state.log[0]!.text).toContain('Spieler 1');
    expect(state.game).not.toBe(start);
  });

  it('haelt eine abgelehnte Aktion fest, ohne den Zustand anzufassen', () => {
    const before = startHotseat(start);
    const state = apply(before, { type: 'endTurn', player: 'p1' });

    expect(state.game).toBe(before.game);
    expect(state.actions).toHaveLength(0);
    expect(state.lastError).not.toBeNull();
  });

  it('raeumt die Fehlermeldung wieder weg', () => {
    const failed = apply(startHotseat(start), { type: 'endTurn', player: 'p1' });
    const cleared = hotseatReducer(failed, { type: 'dismissError' }, seats);

    expect(cleared.lastError).toBeNull();
  });

  it('sammelt eine Folge, aus der replay denselben Zustand baut', () => {
    let state = startHotseat(start);

    for (let step = 0; step < 40 && state.game.phase.kind !== 'finished'; step += 1) {
      const player =
        state.game.phase.kind === 'setup'
          ? setupPlayer(state.game)!
          : state.game.players[state.game.currentPlayerIndex]!.id;
      const options = legalActions(state.game, player);
      const action = options[options.length - 1];
      if (action === undefined) break;
      state = apply(state, action);
    }

    expect(state.actions.length).toBeGreaterThan(5);
    expect(replay(start, state.actions)).toEqual(state.game);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/hotseat.test.ts`
Expected: FAIL — `Failed to resolve import "./hotseat"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/game/hotseat.ts`:

```ts
import { reduce, type GameAction, type GameState } from '@conquerist/shared';
import type { Seat } from '../seats';
import { describeTransition } from './log';

/**
 * Der Zustand einer Hotseat-Partie: das Spiel, die Folge, der Verlauf.
 *
 * Die **Aktionsfolge** ist kein Zierrat. Sie ist genau die Eingabe fuer
 * `replay` und damit die Bruecke zu Etappe 6 (Action-Log und Snapshot). Ein
 * Test haelt fest, dass sie den Endzustand reproduziert.
 *
 * Rueckgaengig gibt es bewusst nicht: mit verdeckter Information ab Etappe 5
 * waere es nicht haltbar, und ein halber Rueckweg ist schlimmer als keiner.
 */
export interface LogEntry {
  readonly turn: number;
  readonly text: string;
}

export interface HotseatState {
  readonly game: GameState;
  readonly actions: readonly GameAction[];
  readonly log: readonly LogEntry[];
  /** Der letzte Ablehnungsgrund - sichtbar, bis er weggeraeumt wird. */
  readonly lastError: string | null;
}

export type HotseatEvent =
  { readonly type: 'apply'; readonly action: GameAction } | { readonly type: 'dismissError' };

export function startHotseat(game: GameState): HotseatState {
  return { game, actions: [], log: [], lastError: null };
}

/**
 * Rein, damit er ohne React pruefbar ist - der Haken darunter ist nur noch
 * Verdrahtung.
 */
export function hotseatReducer(
  state: HotseatState,
  event: HotseatEvent,
  seats: readonly Seat[],
): HotseatState {
  if (event.type === 'dismissError') {
    return state.lastError === null ? state : { ...state, lastError: null };
  }

  const result = reduce(state.game, event.action);
  if (!result.ok) {
    // Ueber das Brett ist nur klickbar, was legalActions genannt hat. Greifen
    // kann dieser Zweig nur dort, wo der Spieler frei zusammenstellt - beim
    // Abwerfen und beim Handel. Deshalb eine sichtbare Meldung statt eines
    // stillen Abbruchs.
    return { ...state, lastError: result.error.message };
  }

  return {
    game: result.state,
    actions: [...state.actions, event.action],
    log: [
      ...state.log,
      {
        turn: result.state.turn,
        text: describeTransition(state.game, event.action, result.state, seats),
      },
    ],
    lastError: null,
  };
}
```

`apps/client/src/game/useHotseatGame.ts`:

```ts
import { useCallback, useMemo, useReducer } from 'react';
import type { GameAction, GameState } from '@conquerist/shared';
import type { Seat } from '../seats';
import { hotseatReducer, startHotseat, type HotseatEvent, type HotseatState } from './hotseat';

/**
 * Duenner Haken um den reinen Reducer.
 *
 * Alles Rechnende steht in `hotseat.ts` und wird ohne DOM geprueft; hier bleibt
 * nur die Bindung an React.
 */
export interface HotseatGame {
  readonly state: HotseatState;
  readonly dispatch: (action: GameAction) => void;
  readonly dismissError: () => void;
}

export function useHotseatGame(game: GameState, seats: readonly Seat[]): HotseatGame {
  const reducer = useMemo(
    () => (state: HotseatState, event: HotseatEvent) => hotseatReducer(state, event, seats),
    [seats],
  );

  const [state, send] = useReducer(reducer, game, startHotseat);

  const dispatch = useCallback((action: GameAction) => {
    send({ type: 'apply', action });
  }, []);

  const dismissError = useCallback(() => {
    send({ type: 'dismissError' });
  }, []);

  return { state, dispatch, dismissError };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/hotseat.test.ts`
Expected: PASS, 5 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/game
git add apps/client/src/game
git commit -m "Client: Hotseat-Zustand mit Aktionsfolge und Verlauf"
```

---

### Task 8: Das Brett als SVG

**Files:**

- Create: `apps/client/src/board/BoardSvg.tsx`
- Create: `apps/client/src/test/dom.ts`
- Modify: `apps/client/vitest.config.ts`
- Modify: `apps/client/package.json` (devDependencies)
- Test: `apps/client/src/board/BoardSvg.test.tsx`

**Interfaces:**

- Consumes: `hexCenter`, `hexCorners`, `edgeSegment`, `edgeMidpoint`, `viewBoxOf` (Task 2), `ActionTargets` (Task 3), `TERRAIN_COLORS`, `harborLabel` (Task 4), `Seat` (Task 1).
- Produces: `type Place = { readonly kind: 'vertex' | 'edge' | 'hex'; readonly id: string }`, `BoardSvg(props: { state: GameState; targets: ActionTargets; seats: readonly Seat[]; onPick: (place: Place) => void }): JSX.Element`. Test-Ids: `hex-<id>`, `vertex-<id>`, `edge-<id>`, jeweils mit `data-target="true"`, wenn anklickbar.

**Warum `onPick` und nicht `onAction`:** Ein Feld kann mehrere Raeuberaktionen tragen (je Opfer eine). Die Auswahl ist eine Dialogfrage und gehoert nicht ins Brett. `BoardSvg` meldet nur, wo geklickt wurde; `GameScreen` entscheidet.

- [ ] **Step 1: Testumgebung fuer DOM-Tests einrichten**

```bash
cd /c/code/Conquerist
pnpm --filter @conquerist/client add -D jsdom @testing-library/react @testing-library/user-event
```

`apps/client/vitest.config.ts` — die `include`-Zeile erweitern, damit `.tsx`-Tests gefunden werden; der Kommentar wird nachgezogen:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Wie im Dev-Server: gegen die shared-Quelle testen, nicht gegen dist.
    conditions: ['development', 'module', 'node', 'import', 'default'],
  },
  test: {
    /**
     * `node` als Voreinstellung: `src/net` und die reinen Module aus Etappe 3
     * (Layout, Klickkarten, Anzeigemodell, Verlauf) brauchen keinen DOM, und
     * ohne jsdom laufen sie spuerbar schneller.
     *
     * Die wenigen Dateien, die wirklich rendern, schalten sich einzeln um -
     * mit `// @vitest-environment jsdom` in der ersten Zeile. Eine
     * Umgebungswahl je Datei ist ehrlicher als eine Musterliste in der
     * Konfiguration, die mit jedem neuen Verzeichnis nachgepflegt werden will.
     */
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

`apps/client/src/test/dom.ts`:

```ts
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Gemeinsamer Einstieg fuer alle Tests, die wirklich rendern.
 *
 * Testing Library raeumt nur automatisch auf, wenn Vitest mit globalen
 * Testfunktionen laeuft - das tut dieses Repo nicht. Statt in jeder Datei ein
 * `afterEach(cleanup)` zu wiederholen, steht es hier einmal und kommt mit dem
 * Import mit.
 */
afterEach(cleanup);

export { render, screen, within, fireEvent } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
```

- [ ] **Step 2: Write the failing test**

`apps/client/src/board/BoardSvg.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  setupPlayer,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { actionTargets } from '../game/targets';
import { BoardSvg } from './BoardSvg';

const scenario = generateScenario(CLASSIC_34, 'board-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'board-probe',
);

describe('BoardSvg', () => {
  it('zeichnet jedes Feld des Szenarios', () => {
    render(
      <BoardSvg
        state={start}
        targets={actionTargets(start, 'p1')}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    for (const placement of scenario.hexes) {
      expect(screen.getByTestId(`hex-${placement.hex}`)).toBeDefined();
    }
  });

  it('hebt genau die Knoten hervor, die in der Klickkarte stehen', () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={vi.fn()} />);

    const marked = screen
      .getAllByTestId(/^vertex-/)
      .filter((element) => element.dataset['target'] === 'true');

    expect(marked).toHaveLength(targets.vertices.size);
  });

  it('meldet den angeklickten Knoten', async () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    const vertex = [...targets.vertices.keys()][0]!;
    const onPick = vi.fn();

    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={onPick} />);
    await userEvent.click(screen.getByTestId(`vertex-${vertex}`));

    expect(onPick).toHaveBeenCalledWith({ kind: 'vertex', id: vertex });
  });

  it('meldet nichts, wenn der Knoten nicht in der Klickkarte steht', async () => {
    const targets = actionTargets(start, 'p3');
    const onPick = vi.fn();

    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={onPick} />);
    const anyVertex = screen.getAllByTestId(/^vertex-/)[0]!;
    await userEvent.click(anyVertex);

    expect(onPick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/board/BoardSvg.test.tsx`
Expected: FAIL — `Failed to resolve import "./BoardSvg"`.

- [ ] **Step 4: Write minimal implementation**

`apps/client/src/board/BoardSvg.tsx`:

```tsx
import type { JSX } from 'react';
import {
  boardOf,
  hexFromId,
  type GameState,
  type PlayerId,
  type VertexId,
} from '@conquerist/shared';
import { seatsById, type Seat } from '../seats';
import { TERRAIN_COLORS, harborLabel } from '../game/labels';
import type { ActionTargets } from '../game/targets';
import { edgeMidpoint, edgeSegment, hexCenter, hexCorners, vertexPoint, viewBoxOf } from './layout';

/**
 * Das Brett. Zeichnet den Zustand und meldet, wo geklickt wurde - mehr nicht.
 *
 * Es kennt keine Regel und keine Aktion: ein Feld kann mehrere Raeuberziele
 * tragen (je moeglichem Opfer eines), und diese Auswahl ist eine Dialogfrage.
 * Deshalb `onPick` mit einem Ort statt `onAction` mit einem Zug.
 */
export interface Place {
  readonly kind: 'vertex' | 'edge' | 'hex';
  readonly id: string;
}

export interface BoardSvgProps {
  readonly state: GameState;
  readonly targets: ActionTargets;
  readonly seats: readonly Seat[];
  readonly onPick: (place: Place) => void;
}

/** Wie viel Luft um das Brett bleibt, in Umkreisradien. */
const PADDING = 0.6;

/** Augenwahrscheinlichkeit eines Chips - fuer die Punktreihe unter der Zahl. */
const PIPS: Readonly<Record<number, number>> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

export function BoardSvg({ state, targets, seats, onPick }: BoardSvgProps): JSX.Element {
  const board = boardOf(state.scenario);
  const colors = seatsById(seats);
  const colorOf = (player: PlayerId): string => colors.get(player)?.color ?? '#8b93a3';

  return (
    <svg
      className="board"
      viewBox={viewBoxOf(board.topology.hexes, PADDING)}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Spielbrett"
    >
      {state.scenario.hexes.map((placement) => {
        const hex = hexFromId(placement.hex);
        const center = hexCenter(hex);
        const points = hexCorners(hex)
          .map((corner) => `${corner.x},${corner.y}`)
          .join(' ');
        const isTarget = targets.hexes.has(placement.hex);

        return (
          <g key={placement.hex}>
            <polygon
              data-testid={`hex-${placement.hex}`}
              data-target={isTarget ? 'true' : 'false'}
              className={isTarget ? 'hex hex--target' : 'hex'}
              points={points}
              fill={TERRAIN_COLORS[placement.terrain]}
              onClick={isTarget ? () => onPick({ kind: 'hex', id: placement.hex }) : undefined}
            />
            {placement.chip === undefined ? null : (
              <g className="chip" pointerEvents="none">
                <circle cx={center.x} cy={center.y} r={0.34} />
                <text
                  x={center.x}
                  y={center.y}
                  className={placement.chip === 6 || placement.chip === 8 ? 'chip__hot' : undefined}
                >
                  {placement.chip}
                </text>
                <text x={center.x} y={center.y + 0.24} className="chip__pips">
                  {'·'.repeat(PIPS[placement.chip] ?? 0)}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {state.scenario.harbors.map((harbor) => {
        const middle = edgeMidpoint(harbor.edge);
        return (
          <text
            key={harbor.edge}
            className="harbor"
            x={middle.x}
            y={middle.y}
            pointerEvents="none"
            data-testid={`harbor-${harbor.edge}`}
          >
            {harborLabel(harbor)}
          </text>
        );
      })}

      <g className="robber" pointerEvents="none">
        <circle
          cx={hexCenter(hexFromId(state.robber)).x}
          cy={hexCenter(hexFromId(state.robber)).y}
          r={0.22}
        />
      </g>

      {board.topology.edges.map((edge) => {
        const [from, to] = edgeSegment(edge);
        const owner = state.roads[edge];
        const isTarget = targets.edges.has(edge);

        return (
          <line
            key={edge}
            data-testid={`edge-${edge}`}
            data-target={isTarget ? 'true' : 'false'}
            className={roadClass(owner !== undefined, isTarget)}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={owner === undefined ? undefined : colorOf(owner)}
            onClick={isTarget ? () => onPick({ kind: 'edge', id: edge }) : undefined}
          />
        );
      })}

      {board.topology.vertices.map((vertex) => (
        <VertexMark
          key={vertex}
          vertex={vertex}
          state={state}
          isTarget={targets.vertices.has(vertex)}
          colorOf={colorOf}
          onPick={onPick}
        />
      ))}
    </svg>
  );
}

function roadClass(built: boolean, isTarget: boolean): string {
  if (built) return 'road road--built';
  return isTarget ? 'road road--target' : 'road';
}

function VertexMark({
  vertex,
  state,
  isTarget,
  colorOf,
  onPick,
}: {
  readonly vertex: VertexId;
  readonly state: GameState;
  readonly isTarget: boolean;
  readonly colorOf: (player: PlayerId) => string;
  readonly onPick: (place: Place) => void;
}): JSX.Element {
  const point = vertexPoint(vertex);
  const building = state.buildings[vertex];

  return (
    <g
      data-testid={`vertex-${vertex}`}
      data-target={isTarget ? 'true' : 'false'}
      className={building === undefined ? 'vertex' : `vertex vertex--${building.kind}`}
      onClick={isTarget ? () => onPick({ kind: 'vertex', id: vertex }) : undefined}
    >
      {/* Unsichtbare Trefferflaeche: der Browser trifft, nicht eine eigene
          Abstandsrechnung. */}
      <circle className="vertex__hit" cx={point.x} cy={point.y} r={0.22} />
      {building === undefined ? (
        isTarget ? (
          <circle className="vertex__target" cx={point.x} cy={point.y} r={0.13} />
        ) : null
      ) : (
        <circle
          className="vertex__building"
          cx={point.x}
          cy={point.y}
          r={building.kind === 'city' ? 0.2 : 0.14}
          fill={colorOf(building.owner)}
        />
      )}
    </g>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/board/BoardSvg.test.tsx`
Expected: PASS, 4 Tests.

- [ ] **Step 6: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src apps/client/vitest.config.ts apps/client/package.json
git add apps/client
git commit -m "Client: Brett als SVG mit Trefferflaechen"
```

---

### Task 9: Panels

**Files:**

- Create: `apps/client/src/panels/TablePanel.tsx`
- Create: `apps/client/src/panels/StatusPanel.tsx`
- Create: `apps/client/src/panels/ActionPanel.tsx`
- Create: `apps/client/src/panels/LogPanel.tsx`
- Test: `apps/client/src/panels/panels.test.tsx`

**Interfaces:**

- Consumes: `GameView`, `PlayerView` (Task 5), `ActionTargets` (Task 3), `LogEntry` (Task 7), `RESOURCE_LABELS`, `RESOURCE_IDS` (Task 4).
- Produces:
  - `TablePanel(props: { view: GameView; conceal: boolean; onConcealChange: (value: boolean) => void })`
  - `StatusPanel(props: { view: GameView })`
  - `ActionPanel(props: { view: GameView; targets: ActionTargets; error: string | null; onRoll: () => void; onEndTurn: () => void; onOpenTrade: () => void; onDismissError: () => void })`
  - `LogPanel(props: { entries: readonly LogEntry[] })`

- [ ] **Step 1: Write the failing test**

`apps/client/src/panels/panels.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  type GameState,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { gameView } from '../game/view';
import { actionTargets } from '../game/targets';
import { ActionPanel } from './ActionPanel';
import { TablePanel } from './TablePanel';

const scenario = generateScenario(CLASSIC_34, 'panels-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = createGame(scenario, CLASSIC_RULES, ids, 'panels-probe');
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

describe('TablePanel', () => {
  it('zeigt offen die Karten aller Spieler', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: false });

    render(<TablePanel view={view} conceal={false} onConcealChange={vi.fn()} />);

    expect(screen.getAllByTestId(/^hand-/)).toHaveLength(3);
    expect(screen.queryAllByTestId(/^hand-count-/)).toHaveLength(0);
  });

  it('zeigt verdeckt nur noch Anzahlen - ausser bei sich selbst', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: true });

    render(<TablePanel view={view} conceal={true} onConcealChange={vi.fn()} />);

    expect(screen.getAllByTestId(/^hand-/)).toHaveLength(1);
    expect(screen.getAllByTestId(/^hand-count-/)).toHaveLength(2);
  });

  it('meldet das Umschalten weiter', async () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: false });
    const onConcealChange = vi.fn();

    render(<TablePanel view={view} conceal={false} onConcealChange={onConcealChange} />);
    await userEvent.click(screen.getByLabelText('Fremde Haende verdecken'));

    expect(onConcealChange).toHaveBeenCalledWith(true);
  });
});

describe('ActionPanel', () => {
  it('sperrt Handel und Zugende, solange nicht gewuerfelt ist', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: null, conceal: false });
    const targets = actionTargets(state, view.currentPlayerId);

    render(
      <ActionPanel
        view={view}
        targets={targets}
        error={null}
        onRoll={vi.fn()}
        onEndTurn={vi.fn()}
        onOpenTrade={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Wuerfeln' })).not.toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Handel' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Zug beenden' })).toHaveProperty('disabled', true);
  });

  it('zeigt den Ablehnungsgrund und laesst ihn wegraeumen', async () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: null, conceal: false });
    const onDismissError = vi.fn();

    render(
      <ActionPanel
        view={view}
        targets={actionTargets(state, view.currentPlayerId)}
        error="Vor dem Bauen fehlt der Wurf"
        onRoll={vi.fn()}
        onEndTurn={vi.fn()}
        onOpenTrade={vi.fn()}
        onDismissError={onDismissError}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Vor dem Bauen fehlt der Wurf');
    await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
    expect(onDismissError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/panels/panels.test.tsx`
Expected: FAIL — `Failed to resolve import "./ActionPanel"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/panels/TablePanel.tsx`:

```tsx
import type { JSX } from 'react';
import { RESOURCE_IDS } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { GameView, PlayerView } from '../game/view';

/**
 * Der Tisch: wer sitzt da, wie viele Punkte, was auf der Hand.
 *
 * Der Schalter verdeckt fremde Haende und zeigt nur noch die Anzahl. Er ist
 * mehr als Bequemlichkeit: die verdeckte Ansicht ist genau die Projektion, die
 * ab Etappe 5 `PlayerView` heisst - dann serverseitig und nicht abschaltbar.
 */
export interface TablePanelProps {
  readonly view: GameView;
  readonly conceal: boolean;
  readonly onConcealChange: (value: boolean) => void;
}

export function TablePanel({ view, conceal, onConcealChange }: TablePanelProps): JSX.Element {
  return (
    <section className="panel panel--table">
      <h2 className="panel__title">Tisch</h2>

      {view.players.map((player) => (
        <PlayerRow
          key={player.id}
          player={player}
          acting={view.actingPlayers.includes(player.id)}
        />
      ))}

      <label className="panel__toggle">
        <input
          type="checkbox"
          checked={conceal}
          onChange={(event) => onConcealChange(event.currentTarget.checked)}
        />
        Fremde Haende verdecken
      </label>
    </section>
  );
}

function PlayerRow({
  player,
  acting,
}: {
  readonly player: PlayerView;
  readonly acting: boolean;
}): JSX.Element {
  return (
    <div
      className={acting ? 'seat seat--acting' : 'seat'}
      style={{ borderLeftColor: player.color }}
      data-testid={`seat-${player.id}`}
    >
      <span className="seat__name">{player.name}</span>
      <span className="seat__points">{player.victoryPoints} SP</span>

      {player.resources === null ? (
        <span className="seat__hand" data-testid={`hand-count-${player.id}`}>
          {player.cardCount} Karten
        </span>
      ) : (
        <span className="seat__hand" data-testid={`hand-${player.id}`}>
          {RESOURCE_IDS.map(
            (resource) =>
              `${RESOURCE_LABELS[resource].slice(0, 1)}${player.resources?.[resource] ?? 0}`,
          ).join(' ')}
        </span>
      )}

      {player.mustDiscard > 0 ? (
        <span className="seat__pending">wirft {player.mustDiscard} ab</span>
      ) : null}
    </div>
  );
}
```

`apps/client/src/panels/StatusPanel.tsx`:

```tsx
import type { JSX } from 'react';
import type { GameView } from '../game/view';

/** Runde, letzter Wurf, was gerade dran ist. */
export function StatusPanel({ view }: { readonly view: GameView }): JSX.Element {
  return (
    <section className="panel panel--status">
      <div className="status__phase">{view.phaseText}</div>
      <div className="status__turn">Runde {view.turn}</div>
      {view.lastRoll === null ? null : (
        <div className="status__dice" data-testid="last-roll">
          <span className="die">{view.lastRoll[0]}</span>
          <span className="die">{view.lastRoll[1]}</span>
          <span className="status__sum">{view.lastRoll[0] + view.lastRoll[1]}</span>
        </div>
      )}
    </section>
  );
}
```

`apps/client/src/panels/ActionPanel.tsx`:

```tsx
import type { JSX } from 'react';
import type { ActionTargets } from '../game/targets';
import type { GameView } from '../game/view';

/**
 * Die Knoepfe, die nicht auf dem Brett liegen.
 *
 * Gesperrt wird nicht nach eigenem Wissen, sondern nach der Klickkarte: was
 * `legalActions` nicht genannt hat, ist grau. Der Handelsknopf oeffnet ein
 * Fenster - der Kurs wird dort abgeleitet und nicht gewaehlt (Regel 3).
 */
export interface ActionPanelProps {
  readonly view: GameView;
  readonly targets: ActionTargets;
  readonly error: string | null;
  readonly onRoll: () => void;
  readonly onEndTurn: () => void;
  readonly onOpenTrade: () => void;
  readonly onDismissError: () => void;
}

export function ActionPanel({
  view,
  targets,
  error,
  onRoll,
  onEndTurn,
  onOpenTrade,
  onDismissError,
}: ActionPanelProps): JSX.Element {
  return (
    <section className="panel panel--actions">
      <button type="button" className="button" disabled={targets.roll === null} onClick={onRoll}>
        Wuerfeln
      </button>
      <button
        type="button"
        className="button"
        disabled={targets.trades.length === 0}
        onClick={onOpenTrade}
      >
        Handel
      </button>
      <button
        type="button"
        className="button button--go"
        disabled={targets.endTurn === null}
        onClick={onEndTurn}
      >
        Zug beenden
      </button>

      <p className="panel__hint">{view.phaseText}</p>

      {error === null ? null : (
        <div role="alert" className="panel__error">
          {error}
          <button type="button" className="button button--ghost" onClick={onDismissError}>
            Verstanden
          </button>
        </div>
      )}
    </section>
  );
}
```

`apps/client/src/panels/LogPanel.tsx`:

```tsx
import type { JSX } from 'react';
import type { LogEntry } from '../game/hotseat';

/** Der Verlauf, juengster Eintrag oben. Mehr als zwanzig braucht niemand im Blick. */
export function LogPanel({ entries }: { readonly entries: readonly LogEntry[] }): JSX.Element {
  const recent = entries.slice(-20).reverse();

  return (
    <section className="panel panel--log">
      <h2 className="panel__title">Verlauf</h2>
      <ol className="log">
        {recent.map((entry, index) => (
          <li key={`${entries.length - index}`} className="log__entry">
            {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/panels/panels.test.tsx`
Expected: PASS, 5 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/panels
git add apps/client/src/panels
git commit -m "Client: Panels fuer Tisch, Status, Aktionen und Verlauf"
```

---

### Task 10: Dialoge — Abwerfen, Handel, Opferwahl

**Files:**

- Create: `apps/client/src/dialogs/DiscardDialog.tsx`
- Create: `apps/client/src/dialogs/TradeDialog.tsx`
- Create: `apps/client/src/dialogs/VictimDialog.tsx`
- Test: `apps/client/src/dialogs/dialogs.test.tsx`

**Interfaces:**

- Consumes: `RESOURCE_LABELS` (Task 4), `PlayerView` (Task 5).
- Produces:
  - `DiscardDialog(props: { player: PlayerView; required: number; onConfirm: (resources: ResourceAmounts) => void })`
  - `TradeDialog(props: { player: PlayerView; rateFor: (give: ResourceId) => number; canTrade: (give: ResourceId, receive: ResourceId) => boolean; onConfirm: (give: ResourceId, receive: ResourceId) => void; onClose: () => void })`
  - `VictimDialog(props: { hex: HexId; victims: readonly PlayerView[]; onChoose: (victim: PlayerId) => void; onClose: () => void })`

**Warum `rateFor` und `canTrade` als Funktionen hereingereicht werden:** damit der Dialog `tradeRateFor` und `canTradeWithBank` benutzt, ohne den `GameState` zu kennen — und damit im Test ohne Spielaufbau geprueft werden kann. Die Regel bleibt in `shared`.

- [ ] **Step 1: Write the failing test**

`apps/client/src/dialogs/dialogs.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ResourceId } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import type { PlayerView } from '../game/view';
import { DiscardDialog } from './DiscardDialog';
import { TradeDialog } from './TradeDialog';

const player: PlayerView = {
  id: 'p1',
  name: 'Spieler 1',
  color: '#c0392b',
  victoryPoints: 2,
  cardCount: 8,
  resources: { brick: 3, lumber: 2, wool: 2, grain: 1, ore: 0 },
  piecesLeft: { road: 13, settlement: 3, city: 4 },
  isCurrent: true,
  mustDiscard: 4,
};

describe('DiscardDialog', () => {
  it('bestaetigt erst, wenn genau die geforderte Zahl gewaehlt ist', async () => {
    const onConfirm = vi.fn();
    render(<DiscardDialog player={player} required={4} onConfirm={onConfirm} />);

    const confirm = screen.getByRole('button', { name: /Abwerfen/ });
    expect(confirm).toHaveProperty('disabled', true);

    await userEvent.click(screen.getByLabelText('Lehm mehr'));
    await userEvent.click(screen.getByLabelText('Lehm mehr'));
    await userEvent.click(screen.getByLabelText('Holz mehr'));
    await userEvent.click(screen.getByLabelText('Wolle mehr'));

    expect(screen.getByRole('button', { name: /Abwerfen/ })).toHaveProperty('disabled', false);
    await userEvent.click(screen.getByRole('button', { name: /Abwerfen/ }));

    expect(onConfirm).toHaveBeenCalledWith({ brick: 2, lumber: 1, wool: 1, grain: 0, ore: 0 });
  });

  it('laesst nicht mehr waehlen, als auf der Hand liegt', async () => {
    render(<DiscardDialog player={player} required={4} onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('Korn mehr'));
    await userEvent.click(screen.getByLabelText('Korn mehr'));

    expect(screen.getByTestId('chosen-grain').textContent).toBe('1');
  });
});

describe('TradeDialog', () => {
  it('zeigt den abgeleiteten Kurs und schickt nur die Absicht', async () => {
    const onConfirm = vi.fn();
    const rateFor = (give: ResourceId): number => (give === 'brick' ? 2 : 4);

    render(
      <TradeDialog
        player={player}
        rateFor={rateFor}
        canTrade={(give, receive) => give !== receive}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText('Lehm abgeben'));
    await userEvent.click(screen.getByLabelText('Erz bekommen'));

    expect(screen.getByTestId('rate').textContent).toContain('2:1');
    await userEvent.click(screen.getByRole('button', { name: /Tauschen/ }));

    expect(onConfirm).toHaveBeenCalledWith('brick', 'ore');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/dialogs/dialogs.test.tsx`
Expected: FAIL — `Failed to resolve import "./DiscardDialog"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/dialogs/DiscardDialog.tsx`:

```tsx
import { useState, type JSX } from 'react';
import { EMPTY_RESOURCES, RESOURCE_IDS, type ResourceAmounts } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { PlayerView } from '../game/view';

/**
 * Abwerfen nach einer Sieben.
 *
 * `legalActions` zaehlt diese Aktion bewusst nicht auf - bei acht Handkarten
 * gaebe es dutzende gueltige Kombinationen. Der Dialog stellt sie zusammen und
 * gibt genau die gewaehlten Karten zurueck; die Zahl prueft am Ende trotzdem
 * `applyDiscard`, denn geprueft wird dort, wo die Regel steht.
 *
 * Sichtbar ist er nur fuer den Betroffenen. Was noch fehlt, damit es
 * weitergeht, steht fuer alle im Aktionspanel.
 */
export interface DiscardDialogProps {
  readonly player: PlayerView;
  readonly required: number;
  readonly onConfirm: (resources: ResourceAmounts) => void;
}

export function DiscardDialog({ player, required, onConfirm }: DiscardDialogProps): JSX.Element {
  const [chosen, setChosen] = useState<ResourceAmounts>({ ...EMPTY_RESOURCES });
  const held = player.resources ?? EMPTY_RESOURCES;
  const total = RESOURCE_IDS.reduce((sum, resource) => sum + (chosen[resource] ?? 0), 0);

  const change = (resource: (typeof RESOURCE_IDS)[number], delta: number): void => {
    setChosen((current) => {
      const next = (current[resource] ?? 0) + delta;
      // Nicht mehr als vorhanden und nicht mehr als gefordert - das ist keine
      // Regel, sondern Bedienkomfort. Die Regel steht in applyDiscard.
      if (next < 0 || next > (held[resource] ?? 0)) return current;
      if (delta > 0 && total >= required) return current;
      return { ...current, [resource]: next };
    });
  };

  return (
    <div className="modal" role="dialog" aria-label={`${player.name} wirft ab`}>
      <div className="modal__box">
        <h2>
          {player.name}, wirf {required} Karten ab
        </h2>
        <p className="modal__hint">
          Nur du siehst dieses Fenster. {player.cardCount} Karten auf der Hand.
        </p>

        <div className="cards">
          {RESOURCE_IDS.map((resource) => (
            <div key={resource} className="cards__item">
              <span className="cards__label">{RESOURCE_LABELS[resource]}</span>
              <span className="cards__held">von {held[resource] ?? 0}</span>
              <div className="cards__stepper">
                <button
                  type="button"
                  aria-label={`${RESOURCE_LABELS[resource]} weniger`}
                  onClick={() => change(resource, -1)}
                >
                  −
                </button>
                <span data-testid={`chosen-${resource}`}>{chosen[resource] ?? 0}</span>
                <button
                  type="button"
                  aria-label={`${RESOURCE_LABELS[resource]} mehr`}
                  onClick={() => change(resource, 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="button button--go"
          disabled={total !== required}
          onClick={() => onConfirm(chosen)}
        >
          Abwerfen ({total}/{required})
        </button>
      </div>
    </div>
  );
}
```

`apps/client/src/dialogs/TradeDialog.tsx`:

```tsx
import { useState, type JSX } from 'react';
import { RESOURCE_IDS, type ResourceId } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { PlayerView } from '../game/view';

/**
 * Bankhandel.
 *
 * Der Kurs wird **abgeleitet, nicht gewaehlt**: `rateFor` kommt aus
 * `tradeRateFor`, der beste erreichbare Hafen gilt automatisch. Ein Client, der
 * sein Verhaeltnis selbst aussucht, waere genau das Ergebnis statt der Absicht,
 * die Regel 3 ausschliesst - deshalb geht auch nur `give` und `receive` hinaus.
 *
 * Spielerhandel bekommt in Etappe 8 einen zweiten Reiter in genau diesem
 * Fenster.
 */
export interface TradeDialogProps {
  readonly player: PlayerView;
  readonly rateFor: (give: ResourceId) => number;
  readonly canTrade: (give: ResourceId, receive: ResourceId) => boolean;
  readonly onConfirm: (give: ResourceId, receive: ResourceId) => void;
  readonly onClose: () => void;
}

export function TradeDialog({
  player,
  rateFor,
  canTrade,
  onConfirm,
  onClose,
}: TradeDialogProps): JSX.Element {
  const [give, setGive] = useState<ResourceId | null>(null);
  const [receive, setReceive] = useState<ResourceId | null>(null);
  const ready = give !== null && receive !== null && canTrade(give, receive);

  return (
    <div className="modal" role="dialog" aria-label="Handel mit der Bank">
      <div className="modal__box">
        <h2>Handel mit der Bank</h2>
        <p className="modal__hint">
          Der Kurs ergibt sich aus deinen Haefen — der beste gilt automatisch.
        </p>

        <fieldset className="cards">
          <legend>Du gibst ab</legend>
          {RESOURCE_IDS.map((resource) => (
            <label key={resource} className="cards__choice">
              <input
                type="radio"
                name="give"
                aria-label={`${RESOURCE_LABELS[resource]} abgeben`}
                checked={give === resource}
                onChange={() => setGive(resource)}
              />
              {RESOURCE_LABELS[resource]} ({player.resources?.[resource] ?? 0})
            </label>
          ))}
        </fieldset>

        <p className="modal__rate" data-testid="rate">
          {give === null ? 'Kurs: —' : `Kurs: ${rateFor(give)}:1`}
        </p>

        <fieldset className="cards">
          <legend>Du bekommst</legend>
          {RESOURCE_IDS.map((resource) => (
            <label key={resource} className="cards__choice">
              <input
                type="radio"
                name="receive"
                aria-label={`${RESOURCE_LABELS[resource]} bekommen`}
                checked={receive === resource}
                onChange={() => setReceive(resource)}
              />
              {RESOURCE_LABELS[resource]}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className="button button--go"
          disabled={!ready}
          onClick={() => {
            if (give !== null && receive !== null) onConfirm(give, receive);
          }}
        >
          Tauschen
        </button>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
```

`apps/client/src/dialogs/VictimDialog.tsx`:

```tsx
import type { JSX } from 'react';
import type { HexId, PlayerId } from '@conquerist/shared';
import type { PlayerView } from '../game/view';

/**
 * Wen der Raeuber bestiehlt.
 *
 * Erscheint nur, wenn am Zielfeld mehr als ein Anlieger mit Karten wohnt - bei
 * genau einem waehlt `GameScreen` ihn ohne Rueckfrage, denn `canMoveRobber`
 * laesst das Auslassen dann ohnehin nicht zu.
 */
export interface VictimDialogProps {
  readonly hex: HexId;
  readonly victims: readonly PlayerView[];
  readonly onChoose: (victim: PlayerId) => void;
  readonly onClose: () => void;
}

export function VictimDialog({ hex, victims, onChoose, onClose }: VictimDialogProps): JSX.Element {
  return (
    <div className="modal" role="dialog" aria-label="Wen bestehlen?">
      <div className="modal__box">
        <h2>Wen bestehlen?</h2>
        <p className="modal__hint">Am Feld {hex} wohnen mehrere mit Karten.</p>

        {victims.map((victim) => (
          <button
            key={victim.id}
            type="button"
            className="button"
            style={{ borderLeftColor: victim.color }}
            onClick={() => onChoose(victim.id)}
          >
            {victim.name} ({victim.cardCount} Karten)
          </button>
        ))}

        <button type="button" className="button button--ghost" onClick={onClose}>
          Doch nicht
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/dialogs/dialogs.test.tsx`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/dialogs
git add apps/client/src/dialogs
git commit -m "Client: Dialoge fuer Abwerfen, Handel und Opferwahl"
```

---

### Task 11: Der Spielbildschirm

**Files:**

- Create: `apps/client/src/screens/GameScreen.tsx`
- Modify: `apps/client/src/index.css` (Abschnitt „Etappe 3" anhaengen)
- Test: `apps/client/src/screens/GameScreen.test.tsx`

**Interfaces:**

- Consumes: alles aus den Tasks 1–10.
- Produces: `GameScreen(props: { game: GameState; seats: readonly Seat[]; onLeave: () => void }): JSX.Element`.

**Zusammenspiel, das hier entschieden wird:**

- `viewer` = der erste Eintrag aus `actingPlayers(state)` (in der Gruendung die Schlange, beim Abwerfen der erste Wartende, sonst der Spieler am Zug).
- Der Abwerf-Dialog erscheint fuer `pending[0]` und geht die Liste der Reihe nach durch; wer noch fehlt, steht fuer alle im Statuspanel (`phaseText` nennt beide Namen). `applyDiscard` nimmt jeden aus `pending` in beliebiger Reihenfolge — eine freie Wahl waere also spaeter ohne Aenderung an `shared` moeglich, hat aber im Hotseat keinen Anlass.
- Klick auf ein Feld mit genau einem Raeuberziel fuehrt es sofort aus; bei mehreren oeffnet `VictimDialog`.
- Das Brett liegt in `.board-area`, deren CSS-Einzug die Panelbreiten aussparen — dort wird der Einwand „Panels verdecken Randknoten" geloest.

- [ ] **Step 1: Write the failing test**

`apps/client/src/screens/GameScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  setupPlayer,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { GameScreen } from './GameScreen';

const scenario = generateScenario(CLASSIC_34, 'screen-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'screen-probe',
);

describe('GameScreen', () => {
  it('beginnt in der Gruendungsphase beim ersten Spieler', () => {
    render(<GameScreen game={start} seats={seats} onLeave={vi.fn()} />);

    expect(screen.getAllByText(/Gruendung/)[0]).toBeDefined();
    expect(screen.getByTestId('seat-p1')).toBeDefined();
  });

  it('setzt auf Klick eine Siedlung und schaltet auf die Strasse weiter', async () => {
    render(<GameScreen game={start} seats={seats} onLeave={vi.fn()} />);

    const vertex = (legalActions(start, setupPlayer(start)!)[0] as { readonly vertex: string })
      .vertex;
    await userEvent.click(screen.getByTestId(`vertex-${vertex}`));

    // Nach der Siedlung leuchten nur noch die anschliessenden Kanten.
    expect(
      screen.getAllByTestId(/^vertex-/).filter((node) => node.dataset['target'] === 'true'),
    ).toHaveLength(0);
    expect(
      screen.getAllByTestId(/^edge-/).filter((node) => node.dataset['target'] === 'true').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Strasse/)[0]).toBeDefined();
  });

  it('schreibt jeden Zug in den Verlauf', async () => {
    render(<GameScreen game={start} seats={seats} onLeave={vi.fn()} />);

    const vertex = (legalActions(start, setupPlayer(start)!)[0] as { readonly vertex: string })
      .vertex;
    await userEvent.click(screen.getByTestId(`vertex-${vertex}`));

    expect(screen.getByText(/setzt die Gruendungssiedlung/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/GameScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./GameScreen"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/screens/GameScreen.tsx`:

```tsx
import { useCallback, useMemo, useState, type JSX } from 'react';
import {
  canTradeWithBank,
  discardCountFor,
  tradeRateFor,
  victimsAt,
  type GameState,
  type PlayerId,
  type ResourceAmounts,
  type ResourceId,
} from '@conquerist/shared';
import type { Seat } from '../seats';
import { BoardSvg, type Place } from '../board/BoardSvg';
import { actionTargets, EMPTY_TARGETS } from '../game/targets';
import { useHotseatGame } from '../game/useHotseatGame';
import { actingPlayers, gameView } from '../game/view';
import { ActionPanel } from '../panels/ActionPanel';
import { LogPanel } from '../panels/LogPanel';
import { StatusPanel } from '../panels/StatusPanel';
import { TablePanel } from '../panels/TablePanel';
import { DiscardDialog } from '../dialogs/DiscardDialog';
import { TradeDialog } from '../dialogs/TradeDialog';
import { VictimDialog } from '../dialogs/VictimDialog';

/**
 * Setzt Brett, Panels und Dialoge zusammen - und trifft dabei die wenigen
 * Entscheidungen, die keine Regel sind:
 *
 * - Wessen Sicht gilt: der erste aus `actingPlayers`. In der Gruendung ist das
 *   die Schlange, nach einer Sieben der erste Wartende, sonst der Spieler am
 *   Zug.
 * - Ein Feld mit genau einem Raeuberziel wird sofort ausgefuehrt; bei mehreren
 *   fragt der Dialog.
 * - Das Brett liegt in `.board-area`, deren Einzug die Panels aussparen. Damit
 *   liegt kein Feld je unter einem Panel - die Randknoten der Gruendung bleiben
 *   anklickbar.
 */
export interface GameScreenProps {
  readonly game: GameState;
  readonly seats: readonly Seat[];
  readonly onLeave: () => void;
}

export function GameScreen({ game, seats, onLeave }: GameScreenProps): JSX.Element {
  const { state, dispatch, dismissError } = useHotseatGame(game, seats);
  const [conceal, setConceal] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [robberHex, setRobberHex] = useState<string | null>(null);

  const current = state.game;
  const viewer = actingPlayers(current)[0] ?? null;
  const view = useMemo(
    () => gameView(current, seats, { viewer, conceal }),
    [current, seats, viewer, conceal],
  );
  const targets = useMemo(
    () => (viewer === null ? EMPTY_TARGETS : actionTargets(current, viewer)),
    [current, viewer],
  );

  const pick = useCallback(
    (place: Place) => {
      if (place.kind === 'vertex') {
        const action = targets.vertices.get(place.id);
        if (action !== undefined) dispatch(action);
        return;
      }
      if (place.kind === 'edge') {
        const action = targets.edges.get(place.id);
        if (action !== undefined) dispatch(action);
        return;
      }

      const options = targets.hexes.get(place.id) ?? [];
      if (options.length === 1) dispatch(options[0]!);
      else if (options.length > 1) setRobberHex(place.id);
    },
    [targets, dispatch],
  );

  const discarding =
    current.phase.kind === 'discardPending' ? (current.phase.pending[0] ?? null) : null;

  return (
    <main className="game">
      <div className="board-area">
        <BoardSvg state={current} targets={targets} seats={seats} onPick={pick} />
      </div>

      <TablePanel view={view} conceal={conceal} onConcealChange={setConceal} />
      <StatusPanel view={view} />
      <LogPanel entries={state.log} />

      <ActionPanel
        view={view}
        targets={targets}
        error={state.lastError}
        onRoll={() => {
          if (targets.roll !== null) dispatch(targets.roll);
        }}
        onEndTurn={() => {
          if (targets.endTurn !== null) dispatch(targets.endTurn);
        }}
        onOpenTrade={() => setTradeOpen(true)}
        onDismissError={dismissError}
      />

      {discarding === null ? null : (
        <DiscardDialog
          player={view.players.find((player) => player.id === discarding)!}
          required={discardCountFor(current, discarding)}
          onConfirm={(resources: ResourceAmounts) => {
            dispatch({ type: 'discard', player: discarding, resources });
          }}
        />
      )}

      {tradeOpen && viewer !== null ? (
        <TradeDialog
          player={view.players.find((player) => player.id === viewer)!}
          rateFor={(give: ResourceId) => tradeRateFor(current, viewer, give)}
          canTrade={(give: ResourceId, receive: ResourceId) =>
            canTradeWithBank(current, viewer, give, receive) === null
          }
          onConfirm={(give, receive) => {
            dispatch({ type: 'tradeWithBank', player: viewer, give, receive });
            setTradeOpen(false);
          }}
          onClose={() => setTradeOpen(false)}
        />
      ) : null}

      {robberHex !== null && viewer !== null ? (
        <VictimDialog
          hex={robberHex}
          victims={victimsAt(current, robberHex, viewer).map((id: PlayerId) =>
            view.players.find((player) => player.id === id)!,
          )}
          onChoose={(victim) => {
            const action = (targets.hexes.get(robberHex) ?? []).find(
              (candidate) => candidate.type === 'moveRobber' && candidate.victim === victim,
            );
            if (action !== undefined) dispatch(action);
            setRobberHex(null);
          }}
          onClose={() => setRobberHex(null)}
        />
      ) : null}

      {current.phase.kind === 'finished' ? (
        <div className="modal" role="dialog" aria-label="Partie beendet">
          <div className="modal__box">
            <h2>{view.phaseText}</h2>
            <ol>
              {view.players.map((player) => (
                <li key={player.id}>
                  {player.name}: {player.victoryPoints} Siegpunkte
                </li>
              ))}
            </ol>
            <button type="button" className="button button--go" onClick={onLeave}>
              Zurueck zum Start
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/GameScreen.test.tsx`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Das Aussehen anlegen**

An `apps/client/src/index.css` anhaengen — der Einzug in `.board-area` ist der inhaltliche Teil, alles andere ist Beiwerk:

```css
/* --- Etappe 3: Spielbildschirm ------------------------------------------ */

.game {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #7fa9c8;
}

/*
 * Der Punkt, an dem die schwebenden Panels unschaedlich werden: das Brett wird
 * nicht unter sie gerechnet, sondern in die freie Flaeche dazwischen eingepasst.
 * Ohne diesen Einzug lægen genau die Randknoten unter den Panels, auf die man in
 * der Gruendungsphase klickt.
 */
.board-area {
  position: absolute;
  inset: 0.5rem 15rem 4rem 15rem;
}

.board {
  width: 100%;
  height: 100%;
}

.panel {
  position: absolute;
  max-width: 14rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  backdrop-filter: blur(3px);
  font-size: 0.8rem;
}

.panel--table {
  top: 0.5rem;
  left: 0.5rem;
}
.panel--status {
  top: 0.5rem;
  right: 0.5rem;
  text-align: right;
}
.panel--actions {
  bottom: 0.5rem;
  left: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.panel--log {
  bottom: 0.5rem;
  right: 0.5rem;
}

.panel__title {
  margin: 0 0 0.4rem;
  font-size: 0.65rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--muted);
}

.seat {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
  padding: 0.15rem 0.3rem;
  border-left: 3px solid var(--muted);
  border-radius: 4px;
}
.seat--acting {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.seat__name {
  font-weight: 600;
}
.seat__hand {
  margin-left: auto;
  font-family: ui-monospace, monospace;
  color: var(--muted);
}

.hex {
  stroke: #2b2b2b;
  stroke-width: 0.02;
  stroke-linejoin: round;
}
.hex--target {
  cursor: pointer;
}

.chip circle {
  fill: #f4efe2;
  stroke: #2b2b2b;
  stroke-width: 0.015;
}
.chip text {
  font-size: 0.34px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  fill: #2b2b2b;
}
.chip__hot {
  fill: #b02a2a;
}
.chip__pips {
  font-size: 0.2px;
  letter-spacing: 0.04px;
}

.harbor {
  font-size: 0.16px;
  text-anchor: middle;
  fill: #1c2027;
}
.robber circle {
  fill: #33312e;
  stroke: #11100f;
  stroke-width: 0.02;
}

.road {
  stroke: transparent;
  stroke-width: 0.12;
  stroke-linecap: round;
}
.road--built {
  stroke-width: 0.12;
}
.road--target {
  stroke: rgb(255 255 255 / 55%);
  stroke-dasharray: 0.14 0.1;
  cursor: pointer;
}

.vertex__hit {
  fill: transparent;
}
.vertex__target {
  fill: rgb(255 255 255 / 60%);
  stroke: #fff;
  stroke-width: 0.03;
  cursor: pointer;
}
.vertex__building {
  stroke: #1a1a1a;
  stroke-width: 0.03;
}

.modal {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(10 13 18 / 55%);
}
.modal__box {
  min-width: 20rem;
  padding: 1rem 1.2rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  text-align: center;
}
.modal__hint {
  color: var(--muted);
  font-size: 0.85rem;
}

.cards {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  border: 0;
}
.cards__item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: center;
}
.cards__stepper {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}
.panel__error {
  margin-top: 0.4rem;
  color: var(--bad);
}
```

- [ ] **Step 6: Run test to verify it still passes**

Run: `pnpm --filter @conquerist/client exec vitest run`
Expected: PASS — alle Client-Tests.

- [ ] **Step 7: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src
git add apps/client/src
git commit -m "Client: Spielbildschirm mit Brett, Panels und Dialogen"
```

---

### Task 12: Startbildschirm und Verdrahtung

**Files:**

- Create: `apps/client/src/screens/StartScreen.tsx`
- Create: `apps/client/src/diagnostics/ConnectionPanel.tsx`
- Modify: `apps/client/src/App.tsx` (vollstaendig ersetzen)
- Test: `apps/client/src/screens/StartScreen.test.tsx`

**Interfaces:**

- Consumes: `defaultSeats`, `MIN_SEATS`, `MAX_SEATS`, `SEAT_COLORS` (Task 1), `GameScreen` (Task 11).
- Produces: `StartScreen(props: { onStart: (game: GameState, seats: readonly Seat[]) => void }): JSX.Element`, `randomSeed(): string`, `blueprintsFor(playerCount: number): readonly ScenarioBlueprint[]`.

**Umzug:** Der gesamte Etappe-0-Inhalt aus `App.tsx` (Verbindungsanzeige, Ping-Knopf, RTT-Metriken, `RetryHint`, `Metric`, `signed`, `formatTime`, `formatOptionalTime`) wandert unveraendert nach `diagnostics/ConnectionPanel.tsx` und wird dort als `ConnectionPanel()` exportiert. Der Haken `useConnection` wird **nur dort** aufgerufen — dadurch baut der Hotseat keine WebSocket-Verbindung auf, solange das Feld zugeklappt ist.

- [ ] **Step 1: Write the failing test**

`apps/client/src/screens/StartScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { blueprintsFor, StartScreen } from './StartScreen';

describe('Startbildschirm', () => {
  it('bietet je Tischgroesse nur die Bretter an, die sie tragen', () => {
    expect(blueprintsFor(3).map((blueprint) => blueprint.id)).toEqual(['classic34']);
    expect(blueprintsFor(4).map((blueprint) => blueprint.id)).toEqual(['classic34']);
    expect(blueprintsFor(6).map((blueprint) => blueprint.id)).toEqual(['classic56']);
  });

  it('zeigt eine Namenszeile je Spieler und passt sie der Tischgroesse an', async () => {
    render(<StartScreen onStart={vi.fn()} />);

    expect(screen.getAllByLabelText(/^Name von Spieler/)).toHaveLength(3);

    await userEvent.selectOptions(screen.getByLabelText('Spieler'), '6');
    expect(screen.getAllByLabelText(/^Name von Spieler/)).toHaveLength(6);
  });

  it('startet eine Partie mit den eingetragenen Namen', async () => {
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} />);

    const firstName = screen.getAllByLabelText(/^Name von Spieler/)[0]!;
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Anna');
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    const [game, seats] = onStart.mock.calls[0]!;
    expect(seats[0].name).toBe('Anna');
    expect(game.players).toHaveLength(3);
    expect(game.phase.kind).toBe('setup');
  });

  it('baut aus demselben Seed dasselbe Brett', async () => {
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} />);

    const seed = screen.getByLabelText('Seed');
    await userEvent.clear(seed);
    await userEvent.type(seed, 'immer-gleich');
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }));

    const [first] = onStart.mock.calls[0]!;
    const [second] = onStart.mock.calls[1]!;
    expect(first.scenario).toEqual(second.scenario);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/StartScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./StartScreen"`.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/screens/StartScreen.tsx`:

```tsx
import { useState, type JSX } from 'react';
import {
  CLASSIC_34,
  CLASSIC_56,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  type GameState,
  type ScenarioBlueprint,
} from '@conquerist/shared';
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, defaultSeats, type Seat } from '../seats';
import { ConnectionPanel } from '../diagnostics/ConnectionPanel';

/**
 * Wo eine Partie anfaengt.
 *
 * Der Seed steht sichtbar im Formular und ist ueberschreibbar. Das kostet fast
 * nichts und macht jede Partie exakt wiederholbar: ein Brett, das komisch
 * aussieht, ist damit ein Fehlerbericht statt einer Erinnerung.
 *
 * Der Vorschlag kommt aus `crypto` - echter Zufall, und die einzige Stelle im
 * Projekt, an der das erlaubt ist. Regel 2 gilt fuer die Logik; die Grenze
 * zwischen Welt und Logik ist genau dieses Eingabefeld.
 */
export interface StartScreenProps {
  readonly onStart: (game: GameState, seats: readonly Seat[]) => void;
}

const BLUEPRINTS: readonly ScenarioBlueprint[] = [CLASSIC_34, CLASSIC_56];

/**
 * Welche Bretter eine Tischgroesse tragen.
 *
 * Die Grenzen stehen im Szenario (`minPlayers` / `maxPlayers`) und werden hier
 * gelesen, nicht wiederholt - sonst gaebe es zwei Wahrheiten, und `createGame`
 * wuerde mit Recht werfen.
 */
export function blueprintsFor(playerCount: number): readonly ScenarioBlueprint[] {
  return BLUEPRINTS.filter(
    (blueprint) => playerCount >= blueprint.minPlayers && playerCount <= blueprint.maxPlayers,
  );
}

/** Ein aussprechbarer Vorschlag, damit man ihn abtippen und weitersagen kann. */
export function randomSeed(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(36).padStart(2, '0')).join('');
}

export function StartScreen({ onStart }: StartScreenProps): JSX.Element {
  const [seats, setSeats] = useState<Seat[]>(() => defaultSeats(3));
  const [seed, setSeed] = useState(randomSeed);
  const [blueprintId, setBlueprintId] = useState(CLASSIC_34.id);
  const [problem, setProblem] = useState<string | null>(null);

  const available = blueprintsFor(seats.length);
  const chosen = available.find((entry) => entry.id === blueprintId) ?? available[0];

  const resize = (count: number): void => {
    const next = defaultSeats(count);
    // Bereits eingetragene Namen ueberleben das Vergroessern.
    setSeats(next.map((seat, index) => ({ ...seat, name: seats[index]?.name ?? seat.name })));
    const fitting = blueprintsFor(count)[0];
    if (fitting !== undefined) setBlueprintId(fitting.id);
  };

  const rename = (index: number, name: string): void => {
    setSeats((current) =>
      current.map((seat, position) => (position === index ? { ...seat, name } : seat)),
    );
  };

  const start = (): void => {
    if (chosen === undefined) {
      setProblem(`Fuer ${seats.length} Spieler gibt es kein passendes Brett`);
      return;
    }

    try {
      const scenario = generateScenario(chosen, seed);
      const game = createGame(
        scenario,
        CLASSIC_RULES,
        seats.map((seat) => seat.id),
        seed,
      );
      setProblem(null);
      onStart(game, seats);
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <main className="page">
      <header className="page__header">
        <h1>Conquerist</h1>
        <p className="page__subtitle">Etappe 3 &middot; Hotseat am selben Geraet</p>
      </header>

      <section className="card">
        <label className="field">
          Spieler
          <select
            aria-label="Spieler"
            value={seats.length}
            onChange={(event) => resize(Number(event.currentTarget.value))}
          >
            {Array.from(
              { length: MAX_SEATS - MIN_SEATS + 1 },
              (_unused, index) => MIN_SEATS + index,
            ).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        {seats.map((seat, index) => (
          <label key={seat.id} className="field">
            <span
              className="swatch"
              style={{ background: SEAT_COLORS[index] }}
              aria-hidden="true"
            />
            <input
              aria-label={`Name von Spieler ${index + 1}`}
              value={seat.name}
              onChange={(event) => rename(index, event.currentTarget.value)}
            />
          </label>
        ))}

        <label className="field">
          Brett
          <select
            aria-label="Brett"
            value={chosen?.id ?? ''}
            onChange={(event) => setBlueprintId(event.currentTarget.value)}
          >
            {available.map((blueprint) => (
              <option key={blueprint.id} value={blueprint.id}>
                {blueprint.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Seed
          <input
            aria-label="Seed"
            value={seed}
            onChange={(event) => setSeed(event.currentTarget.value)}
          />
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setSeed(randomSeed())}
          >
            Wuerfeln
          </button>
        </label>

        {problem === null ? null : <p className="error">{problem}</p>}

        <button type="button" className="button button--go" onClick={start}>
          Partie starten
        </button>
      </section>

      <details className="card">
        <summary>Verbindung und Diagnose (Etappe 0)</summary>
        <ConnectionPanel />
      </details>
    </main>
  );
}
```

`apps/client/src/diagnostics/ConnectionPanel.tsx`: den kompletten Inhalt der bisherigen `App.tsx` uebernehmen — `PingResult`, `STATUS_LABEL`, die drei `<section className="card">`-Bloecke, `Metric`, `RetryHint`, `signed`, `formatTime`, `formatOptionalTime` — und als `export function ConnectionPanel(): JSX.Element` mit einem `<>…</>` um die Abschnitte exportieren. Kopfkommentar:

```tsx
/**
 * Die Diagnoseseite aus Etappe 0, unveraendert - nur umgezogen.
 *
 * Sie sitzt jetzt in einem zugeklappten Feld auf dem Startbildschirm. Das ist
 * kein Schoenheitsgrund: `useConnection` laeuft nur, wenn diese Komponente
 * gerendert wird, und damit baut eine Hotseat-Partie keine WebSocket-Verbindung
 * auf. Etappe 5 knuepft hier wieder an.
 */
```

`apps/client/src/App.tsx` — vollstaendig ersetzen:

```tsx
import { useState, type JSX } from 'react';
import type { GameState } from '@conquerist/shared';
import type { Seat } from './seats';
import { GameScreen } from './screens/GameScreen';
import { StartScreen } from './screens/StartScreen';

/**
 * Zwei Bildschirme, mehr braucht Etappe 3 nicht: Start oder Partie.
 *
 * Kein Router - es gibt keine Adressen, die jemand teilen koennte. Das aendert
 * sich mit der Lobby in Etappe 6; dann mit Anlass.
 */
interface Session {
  readonly game: GameState;
  readonly seats: readonly Seat[];
}

export function App(): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);

  if (session === null) {
    return <StartScreen onStart={(game, seats) => setSession({ game, seats })} />;
  }

  return <GameScreen game={session.game} seats={session.seats} onLeave={() => setSession(null)} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/StartScreen.test.tsx`
Expected: PASS, 4 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src
git add apps/client/src
git commit -m "Client: Startbildschirm, Diagnose umgezogen, Bildschirmwahl"
```

---

### Task 13: Abnahme und Standsdateien

**Files:**

- Modify: `PROGRESS.md` (Abschnitt „Etappe 3" anhaengen)
- Modify: `CLAUDE.md` (Etappenplan und „Aktueller Stand")
- Delete: `docs/superpowers/specs/…` bleibt; nichts loeschen.

- [ ] **Step 1: Die vollstaendige Kette laufen lassen**

```bash
cd /c/code/Conquerist
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm --filter @conquerist/server acceptance
```

Erwartung: alles gruen; `pnpm test` nennt die 492 Tests aus Etappe 2 plus die neuen im Client. Schlaegt etwas fehl, wird es behoben, **bevor** die Standsdateien geschrieben werden — eine Abnahmetabelle mit erfundenen Zahlen ist schlimmer als keine.

- [ ] **Step 2: Von Hand spielen**

```bash
cd /c/code/Conquerist
pnpm dev
```

Im Browser auf `http://localhost:5173` durchspielen und dabei notieren, was tatsaechlich passiert:

1. Dreierpartie auf `classic34`: Gruendung mit allen sechs Setzungen, ein voller Zug, Bankhandel, Sieg.
2. Eine Sieben abwarten (Seed notieren, falls sie ausbleibt) — Abwerfen bei zwei Betroffenen, Raeuber versetzen, Opferwahl.
3. Sechserpartie auf `classic56`: Gruendung und ein paar Zuege, um Brettgroesse und Einpassung zu pruefen.
4. Fenster schmal ziehen: liegt ein Feld unter einem Panel? Wenn ja, `.board-area`-Einzug nachziehen.

- [ ] **Step 3: `PROGRESS.md` fortschreiben**

Einen Abschnitt „## Etappe 3 — `client`: SVG-Brett und Hotseat ✅" anhaengen, im Aufbau der bisherigen Etappen: Abnahmetabelle mit den **gemessenen** Zahlen aus Step 1, „Was die Tests belegen", „Getroffene Entscheidungen" (Brett-zuerst statt Baumodus; Ecken aus den Knoten-Ids statt aus Winkeln; Klickkarten als einzige Verbindung zwischen Regel und Oberflaeche; Panels schwebend, Brett eingepasst; Verdecken als reine Projektion und Vorarbeit fuer `PlayerView`), „Offene Punkte" (mindestens: kein ESLint, kein CI, kein Node-Pin, Hafenpositionen gegen die Schachtel, Ids ohne Branded Types — plus was beim Spielen von Hand aufgefallen ist), „Naechste Etappe".

- [ ] **Step 4: `CLAUDE.md` nachziehen**

- Im Etappenplan `3.` mit ✅ versehen.
- „Aktueller Stand" auf „Etappen 0 bis 3 fertig" umschreiben und als Naechstes Etappe 4 (Server: WS-Infra, SQLite, Gast-Identitaet) nennen.
- Einen kurzen Absatz „Was im Client steht" nach dem Vorbild von „Was in `shared` schon steht" ergaenzen: `board/` (Layout und SVG), `game/` (Klickkarten, Anzeigemodell, Verlauf, Hotseat-Zustand), `panels/`, `dialogs/`, `screens/`, `diagnostics/` — mit dem Satz, dass der Client keine Regel kennt und alles ueber `legalActions` und `reduce` laeuft.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write PROGRESS.md CLAUDE.md
git add PROGRESS.md CLAUDE.md
git commit -m "Etappe 3: SVG-Brett und Hotseat im Client"
```

---

## Nach der letzten Aufgabe

**REQUIRED SUB-SKILL:** superpowers:finishing-a-development-branch — Tests bestaetigen, Moeglichkeiten vorlegen, Entscheidung ausfuehren. Die bisherigen Etappen liegen je auf einem eigenen Branch und **nichts** ist in `main`; diese Etappe folgt demselben Muster, solange nicht anders entschieden wird.
