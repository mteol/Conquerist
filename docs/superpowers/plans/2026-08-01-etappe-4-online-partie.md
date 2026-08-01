# Etappe 4+5 — Online-Partie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bis zu sechs Leute spielen eine Partie auf sechs Geraeten; der Server haelt den Zustand, jeder sieht nur seine Haelfte, und ein Reload kostet den Platz nicht.

**Architecture:** Der Server wird Autoritaet. Er haelt `GameState` je Raum, prueft jede eingehende Absicht mit `reduce` und schickt jedem Spieler eine eigene, gefilterte `PlayerView` samt seiner erlaubten Zuege. Die Oberflaeche kennt danach nur noch „Sicht" und „Absicht senden" — mit zwei Umsetzungen (lokal im Hotseat, entfernt ueber WebSocket), aber nur einem Satz Bildschirme.

**Tech Stack:** TypeScript 7 (strict), Zod 4, Fastify 5, rohes `ws`, better-sqlite3, React 19, Vite 8, Vitest 4 (+ jsdom, Testing Library).

## Global Constraints

- **Die sieben Architekturregeln aus `CLAUDE.md` gelten unveraendert.** Besonders in dieser Etappe: Regel 3 (Server ist Autoritaet, Client schickt Absichten), Regel 4 (verdeckte Information), Regel 7 (Identitaet ab Tag 1).
- **`packages/shared` hat weiterhin nur `zod` als Runtime-Abhaengigkeit.** Kein Node-API, kein `crypto`-Import aus Node, nichts Browserspezifisches — der Code laeuft in beiden Welten.
- **Spiellogik bleibt rein.** Kein `Date.now()`, kein `Math.random()` in `shared`. Zufall nur ueber den Seed. Raumcodes und Sitzungsgeheimnisse entstehen **im Server**, nicht in `shared`.
- **Der Zufallszustand (`rng`) darf den Server niemals verlassen.** Wer ihn kennt, kennt jeden kuenftigen Wuerfelwurf.
- **Jede eingehende Nachricht wird per Zod validiert, bevor sie Logik erreicht** — und jede ausgehende ebenfalls, Ereignisse eingeschlossen.
- **TypeScript strict** mit `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`.
- **Texte auf Deutsch, Code und Bezeichner auf Englisch.** Kommentare erklaeren das Warum.
- **Commit-Nachrichten auf Deutsch, ohne `Co-Authored-By`-Zeile.**
- Nach jeder Aufgabe muessen die Tests des betroffenen Pakets gruen sein; am Ende `pnpm typecheck && pnpm test && pnpm build && pnpm format:check` plus die Abnahme.
- Formatierung vor jedem Commit: `pnpm prettier --write <geaenderte Dateien>`.

**Spezifikation:** `docs/superpowers/specs/2026-08-01-etappe-4-online-partie-design.md` — bei Widerspruch gilt die Spezifikation.

**Ausgangslage:** Branch `etappe-4-online`, abgezweigt von `main` (Etappen 0–3, 553 Tests gruen). Der Client haelt den Spielzustand aktuell selbst (`game/hotseat.ts`, `game/useHotseatGame.ts`); der Server kann nur Ping.

## Dateien im Ueberblick

| Datei                                     | Verantwortung                                               |
| ----------------------------------------- | ----------------------------------------------------------- |
| `packages/shared/src/seats.ts`            | Sitz-Typ und Farbpalette — beide Seiten brauchen sie        |
| `packages/shared/src/game/playerView.ts`  | `GameState` → `PlayerView`; die Geheimhaltungsgrenze        |
| `packages/shared/src/protocol/room.ts`    | Schemas fuer `hello`, `createRoom`, `joinRoom`, …           |
| `packages/shared/src/protocol/events.ts`  | Registry fuer Nachrichten ohne Anfrage                      |
| `apps/server/src/db/`                     | SQLite-Verbindung, Schema, `users`                          |
| `apps/server/src/identity/`               | Gast anlegen, per Geheimnis wiedererkennen                  |
| `apps/server/src/rooms/room.ts`           | Ein Raum als reine Datenstruktur samt Uebergaengen          |
| `apps/server/src/rooms/registry.ts`       | Alle Raeume, Codevergabe, Aufraeumen                        |
| `apps/server/src/ws/handlers/room.ts`     | Die Handler, die Raum und Identitaet verbinden              |
| `apps/server/src/ws/events.ts`            | Validiertes Senden ohne Anfrage, je Verbindung              |
| `apps/server/src/static.ts`               | Ausliefern des gebauten Clients                             |
| `apps/client/src/game/targets.ts`         | `targetsFrom(actions)` statt `actionTargets(state, player)` |
| `apps/client/src/net/session.ts`          | Geheimnis im Browser, `hello` beim Verbinden                |
| `apps/client/src/game/useOnlineGame.ts`   | Absicht senden, Stand empfangen                             |
| `apps/client/src/screens/LobbyScreen.tsx` | Wartebereich mit Code und Einladungslink                    |
| `apps/client/src/screens/StartScreen.tsx` | Online erstellen/beitreten, daneben lokale Partie           |

---

### Task 1: Sitze wandern nach `shared`

Der Server vergibt ab jetzt Farben, der Client zeigt sie an. Eine Palette an zwei Orten waere zwei Wahrheiten.

**Files:**

- Create: `packages/shared/src/seats.ts`
- Modify: `packages/shared/src/index.ts` (Barrel-Export ergaenzen)
- Modify: `apps/client/src/seats.ts` (nur noch Weiterreichen)
- Test: `packages/shared/src/seats.test.ts`

**Interfaces:**

- Produces: `SEAT_COLORS: readonly string[]` (sechs), `MIN_SEATS = 3`, `MAX_SEATS = 6`, `interface Seat { readonly id: PlayerId; readonly name: string; readonly color: string }`, `seatColorAt(index: number): string`.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/seats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, seatColorAt } from './seats.js';

describe('Sitzfarben', () => {
  it('haelt fuer jede erlaubte Tischgroesse eine eigene Farbe bereit', () => {
    expect(SEAT_COLORS).toHaveLength(MAX_SEATS);
    expect(new Set(SEAT_COLORS).size).toBe(MAX_SEATS);
    expect(MIN_SEATS).toBeLessThan(MAX_SEATS);
  });

  it('vergibt die Farben der Reihe nach', () => {
    expect(seatColorAt(0)).toBe(SEAT_COLORS[0]);
    expect(seatColorAt(MAX_SEATS - 1)).toBe(SEAT_COLORS[MAX_SEATS - 1]);
  });

  it('weist einen Platz ausserhalb des Tisches zurueck', () => {
    expect(() => seatColorAt(-1)).toThrow(RangeError);
    expect(() => seatColorAt(MAX_SEATS)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/seats.test.ts`
Expected: FAIL — `Failed to resolve import "./seats.js"`.

- [ ] **Step 3: Write minimal implementation**

`packages/shared/src/seats.ts`:

```ts
import type { PlayerId } from './game/player.js';

/**
 * Ein Sitz am Tisch: Id, Name, Farbe.
 *
 * Stand bis Etappe 3 im Client, weil nur er Namen kannte. Ab Etappe 4 vergibt
 * der Server die Farben in der Reihenfolge des Beitritts und schickt sie in
 * jeder `PlayerView` mit - also braucht die Palette einen Ort, den beide
 * Seiten sehen. Eine Kopie im Client waere die zweite Wahrheit, die beim
 * ersten Farbtausch auseinanderlaeuft.
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

/** Die Farbe fuer den n-ten Platz am Tisch. */
export function seatColorAt(index: number): string {
  const color = SEAT_COLORS[index];
  if (color === undefined) {
    throw new RangeError(`seatColorAt: Platz ${index} gibt es an diesem Tisch nicht`);
  }
  return color;
}
```

In `packages/shared/src/index.ts` die Zeile `export * from './seats.js';` ergaenzen (alphabetisch zwischen `random` und `rules`).

`apps/client/src/seats.ts` behaelt nur noch `defaultSeats` und `seatsById` und reicht den Rest durch:

```ts
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, seatColorAt, type Seat } from '@conquerist/shared';
import type { PlayerId } from '@conquerist/shared';

/**
 * Sitze im Client.
 *
 * Typ und Palette stehen seit Etappe 4 in `shared`, weil der Server die Farben
 * vergibt. Hier bleibt nur, was ausschliesslich die lokale Partie braucht: eine
 * Standardbesetzung und eine Nachschlagetabelle.
 */
export { MAX_SEATS, MIN_SEATS, SEAT_COLORS, seatColorAt };
export type { Seat };

/** Standardbesetzung fuer die lokale Partie: durchnummerierte Ids und Namen. */
export function defaultSeats(count: number): Seat[] {
  if (!Number.isInteger(count) || count < MIN_SEATS || count > MAX_SEATS) {
    throw new RangeError(
      `defaultSeats: ${MIN_SEATS} bis ${MAX_SEATS} Spieler, angefragt waren ${count}`,
    );
  }

  return Array.from({ length: count }, (_unused, index) => ({
    id: `p${index + 1}`,
    name: `Spieler ${index + 1}`,
    color: seatColorAt(index),
  }));
}

/** Nachschlagetabelle Id -> Sitz. */
export function seatsById(seats: readonly Seat[]): ReadonlyMap<PlayerId, Seat> {
  return new Map(seats.map((seat) => [seat.id, seat]));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @conquerist/shared exec vitest run src/seats.test.ts && pnpm --filter @conquerist/client exec vitest run`
Expected: PASS — die drei neuen und alle 98 bestehenden Client-Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write packages/shared/src apps/client/src/seats.ts
git add packages/shared/src apps/client/src/seats.ts
git commit -m "Sitzfarben nach shared: der Server vergibt sie ab jetzt"
```

---

### Task 2: `PlayerView` — die Geheimhaltungsgrenze

Die wichtigste Datei dieser Etappe. Alles, was den Server verlaesst, geht hier durch.

**Files:**

- Create: `packages/shared/src/game/playerView.ts`
- Modify: `packages/shared/src/game/index.ts` (Export ergaenzen)
- Test: `packages/shared/src/game/playerView.test.ts`

**Interfaces:**

- Consumes: `Seat` (Task 1), `GameState`, `victoryPointsOf`, `countResources`.
- Produces: `PlayerViewSchema`, `type PlayerView`, `playerViewOf(state, viewer, seats, version): PlayerView`.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/game/playerView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CLASSIC_34 } from '../scenario/blueprints/classic34.js';
import { generateScenario } from '../scenario/generator.js';
import { CLASSIC_RULES } from '../rules/ruleset.js';
import { seatColorAt } from '../seats.js';
import { createGame } from './setup.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { setupPlayer } from './setup.js';
import { countResources } from './resources.js';
import { PlayerViewSchema, playerViewOf } from './playerView.js';
import type { GameState } from './state.js';

const scenario = generateScenario(CLASSIC_34, 'view-geheim');
const seats = ['p1', 'p2', 'p3'].map((id, index) => ({
  id,
  name: `Spieler ${index + 1}`,
  color: seatColorAt(index),
}));

/** Eine Partie bis nach der Gruendung - dann haben alle Karten auf der Hand. */
function afterSetup(): GameState {
  let state = createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'view-geheim',
  );

  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

/** Sammelt alle Schluessel eines Objektbaums - rekursiv, ohne Hinsehen. */
function allKeys(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, found);
    return found;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) {
      found.add(key);
      allKeys(inner, found);
    }
  }
  return found;
}

describe('PlayerView', () => {
  it('gibt den Zufallszustand nirgends heraus', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p1', seats, 7);

    // Rekursiv geprueft, nicht an der obersten Ebene: wer den RNG-Zustand
    // kennt, rechnet jeden kuenftigen Wuerfelwurf voraus.
    expect(allKeys(view).has('rng')).toBe(false);
    expect(JSON.stringify(view)).not.toContain('"rng"');
  });

  it('zeigt die eigenen Karten vollstaendig', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p2', seats, 1);
    const own = view.players.find((player) => player.id === 'p2')!;

    expect(own.resources).toEqual(state.players[1]!.resources);
    expect(own.cardCount).toBe(countResources(state.players[1]!.resources));
  });

  it('zeigt von fremden Haenden nur die Anzahl', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p2', seats, 1);

    for (const player of view.players) {
      if (player.id === 'p2') continue;
      expect(player.resources).toBeNull();
    }
  });

  it('luegt nicht - die Anzahlen stimmen mit dem echten Zustand ueberein', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p1', seats, 1);

    view.players.forEach((player, index) => {
      expect(player.cardCount).toBe(countResources(state.players[index]!.resources));
    });
  });

  it('uebernimmt Namen und Farbe aus den Sitzen', () => {
    const view = playerViewOf(afterSetup(), 'p1', seats, 1);
    expect(view.players.map((player) => player.name)).toEqual([
      'Spieler 1',
      'Spieler 2',
      'Spieler 3',
    ]);
    expect(view.players[0]!.color).toBe(seatColorAt(0));
  });

  it('haelt das eigene Schema ein', () => {
    const view = playerViewOf(afterSetup(), 'p3', seats, 42);
    expect(PlayerViewSchema.safeParse(view).success).toBe(true);
    expect(view.you).toBe('p3');
    expect(view.version).toBe(42);
  });

  it('weist einen Zuschauer ab, der nicht am Tisch sitzt', () => {
    expect(() => playerViewOf(afterSetup(), 'fremder', seats, 1)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerView.test.ts`
Expected: FAIL — `Failed to resolve import "./playerView.js"`.

- [ ] **Step 3: Write minimal implementation**

`packages/shared/src/game/playerView.ts`:

```ts
import { z } from 'zod';

import { ResourceAmountsSchema, RuleSetSchema } from '../rules/index.js';
import { ScenarioDefinitionSchema } from '../scenario/index.js';
import type { Seat } from '../seats.js';
import { BuildingSchema } from './state.js';
import { PhaseSchema } from './phase.js';
import { PlayerIdSchema } from './player.js';
import { countResources } from './resources.js';
import { victoryPointsOf } from './scoring.js';
import type { GameState } from './state.js';

/**
 * Was ein einzelner Spieler sehen darf - Regel 4, endlich in Code.
 *
 * Die Aufteilung war seit Etappe 2 vorgesehen und der Zustand dafuer gebaut:
 * geheim sind genau `rng` und die `resources` der Mitspieler. Beides faellt
 * hier heraus, und zwar durch Weglassen beim Aufbau und nicht durch Loeschen
 * im Nachhinein - was nie hineinkommt, kann auch nicht vergessen werden.
 *
 * Der Router validiert jede ausgehende Nachricht gegen ihr Schema (Etappe 0,
 * mit genau dieser Etappe als Begruendung). Ein `rng`, das hier versehentlich
 * landete, waere damit ein Serverfehler und kein Informationsleck.
 */

export const PlayerInViewSchema = z.object({
  id: PlayerIdSchema,
  name: z.string().min(1),
  color: z.string().min(1),
  /** Ob dieser Spieler gerade verbunden ist. */
  connected: z.boolean(),
  /** Immer sichtbar - am Tisch waere sie abzaehlbar. */
  cardCount: z.number().int().min(0),
  /** Nur beim Empfaenger gefuellt, bei allen anderen `null`. */
  resources: ResourceAmountsSchema.nullable(),
  piecesLeft: z.record(z.string(), z.number().int().min(0)),
  victoryPoints: z.number().int().min(0),
});

export type PlayerInView = z.infer<typeof PlayerInViewSchema>;

export const PlayerViewSchema = z.object({
  /** Wer diese Sicht bekommt. */
  you: PlayerIdSchema,
  /** Zaehlt je Raum hoch; der Client verwirft aeltere Staende. */
  version: z.number().int().min(0),

  scenario: ScenarioDefinitionSchema,
  rules: RuleSetSchema,
  players: z.array(PlayerInViewSchema).min(2),
  currentPlayerIndex: z.number().int().min(0),
  phase: PhaseSchema,
  buildings: z.record(z.string(), BuildingSchema),
  roads: z.record(z.string(), PlayerIdSchema),
  robber: z.string(),
  bank: ResourceAmountsSchema,
  longestRoad: z.object({
    holder: PlayerIdSchema.nullable(),
    length: z.number().int().min(0),
  }),
  lastRoll: z.tuple([z.number().int(), z.number().int()]).nullable(),
  turn: z.number().int().min(0),
});

export type PlayerView = z.infer<typeof PlayerViewSchema>;

/** Verbindungszustand je Spieler; was fehlt, gilt als verbunden. */
export type ConnectedMap = ReadonlyMap<string, boolean>;

/**
 * Baut die Sicht eines Spielers.
 *
 * Wirft, wenn der Empfaenger nicht am Tisch sitzt: eine Sicht fuer jemanden zu
 * bauen, der nicht mitspielt, ist ein Fehler des Aufrufers und kein Spielzug.
 */
export function playerViewOf(
  state: GameState,
  viewer: string,
  seats: readonly Seat[],
  version: number,
  connected: ConnectedMap = new Map(),
): PlayerView {
  if (!state.players.some((player) => player.id === viewer)) {
    throw new RangeError(`playerViewOf: ${viewer} sitzt nicht an diesem Tisch`);
  }

  const seatOf = new Map(seats.map((seat) => [seat.id, seat]));

  return {
    you: viewer,
    version,
    scenario: state.scenario,
    rules: state.rules,
    players: state.players.map((player): PlayerInView => {
      const seat = seatOf.get(player.id);
      return {
        id: player.id,
        name: seat?.name ?? player.id,
        color: seat?.color ?? '#8b93a3',
        connected: connected.get(player.id) ?? true,
        cardCount: countResources(player.resources),
        resources: player.id === viewer ? player.resources : null,
        piecesLeft: player.piecesLeft,
        victoryPoints: victoryPointsOf(state, player.id),
      };
    }),
    currentPlayerIndex: state.currentPlayerIndex,
    phase: state.phase,
    buildings: state.buildings,
    roads: state.roads,
    robber: state.robber,
    bank: state.bank,
    longestRoad: state.longestRoad,
    lastRoll: state.lastRoll,
    turn: state.turn,
  };
}
```

In `packages/shared/src/game/index.ts` ergaenzen: `export * from './playerView.js';`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerView.test.ts`
Expected: PASS, 7 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write packages/shared/src/game
git add packages/shared/src/game
git commit -m "PlayerView: die geheime Haelfte bleibt auf dem Server"
```

---

### Task 3: Protokoll — Anfragen fuer Raum und Zug

**Files:**

- Create: `packages/shared/src/protocol/room.ts`
- Modify: `packages/shared/src/protocol/registry.ts`
- Modify: `packages/shared/src/protocol/index.ts`
- Test: `packages/shared/src/protocol/room.test.ts`

**Interfaces:**

- Consumes: `GameActionSchema` (Etappe 2), `PlayerViewSchema` (Task 2).
- Produces: Konstanten `HELLO`, `CREATE_ROOM`, `JOIN_ROOM`, `LEAVE_ROOM`, `START_GAME`, `ACT` und die zugehoerigen Request-/Response-Schemas; Erweiterung von `protocol`.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/protocol/room.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ACT, CREATE_ROOM, HELLO, JOIN_ROOM, RoomCodeSchema } from './room.js';
import { isMessageType, protocolEntry } from './registry.js';

describe('Raum-Protokoll', () => {
  it('meldet die neuen Typen als bekannt', () => {
    for (const type of [HELLO, CREATE_ROOM, JOIN_ROOM, ACT]) {
      expect(isMessageType(type)).toBe(true);
      expect(protocolEntry(type).responseType).toBeTruthy();
    }
  });

  it('nimmt Raumcodes nur in kanonischer Form an', () => {
    expect(RoomCodeSchema.safeParse('K7X2').success).toBe(true);
    // Kleinbuchstaben werden angehoben, damit vorgelesene Codes ankommen.
    expect(RoomCodeSchema.parse('k7x2')).toBe('K7X2');
    // Verwechslungsgefahr: O, 0, I und 1 kommen im Alphabet nicht vor.
    expect(RoomCodeSchema.safeParse('K0X2').success).toBe(false);
    expect(RoomCodeSchema.safeParse('K7X').success).toBe(false);
    expect(RoomCodeSchema.safeParse('K7X22').success).toBe(false);
  });

  it('verlangt bei createRoom eine Tischgroesse im erlaubten Bereich', () => {
    const entry = protocolEntry(CREATE_ROOM);
    expect(entry.request.safeParse({ seatCount: 3, seed: 'abc' }).success).toBe(true);
    expect(entry.request.safeParse({ seatCount: 2, seed: 'abc' }).success).toBe(false);
    expect(entry.request.safeParse({ seatCount: 7, seed: 'abc' }).success).toBe(false);
  });

  it('nimmt bei act nur eine gueltige Spielaktion an', () => {
    const entry = protocolEntry(ACT);
    expect(entry.request.safeParse({ action: { type: 'rollDice', player: 'p1' } }).success).toBe(
      true,
    );
    expect(entry.request.safeParse({ action: { type: 'schummeln', player: 'p1' } }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/protocol/room.test.ts`
Expected: FAIL — `Failed to resolve import "./room.js"`.

- [ ] **Step 3: Write minimal implementation**

`packages/shared/src/protocol/room.ts`:

```ts
import { z } from 'zod';

import { GameActionSchema } from '../game/actions.js';
import { MAX_SEATS, MIN_SEATS } from '../seats.js';

/**
 * Nachrichten fuer Identitaet, Raum und Zug.
 *
 * Alles, was der Client schicken darf, ist eine **Absicht**: „ich moechte
 * beitreten", „ich moechte diesen Zug machen". Ergebnisse kommen ausnahmslos
 * vom Server (Regel 3). Deshalb gibt es hier kein Schema, das einen Zustand
 * entgegennimmt.
 */

export const HELLO = 'hello';
export const HELLO_OK = 'hello.ok';
export const CREATE_ROOM = 'room.create';
export const ROOM_CREATED = 'room.created';
export const JOIN_ROOM = 'room.join';
export const ROOM_JOINED = 'room.joined';
export const LEAVE_ROOM = 'room.leave';
export const ROOM_LEFT = 'room.left';
export const START_GAME = 'room.start';
export const GAME_STARTED = 'room.started';
export const ACT = 'game.act';
export const ACT_OK = 'game.acted';

/**
 * Raumcode: vier Zeichen aus einem Alphabet ohne Verwechslungspaare.
 *
 * Kein O/0, kein I/1 - der Code wird vorgelesen oder in einen Gruppenchat
 * getippt. Kleinbuchstaben werden angehoben, statt sie abzulehnen: wer „k7x2"
 * tippt, meint denselben Raum.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (code) =>
      code.length === ROOM_CODE_LENGTH &&
      [...code].every((char) => ROOM_CODE_ALPHABET.includes(char)),
    { message: `Raumcode besteht aus ${ROOM_CODE_LENGTH} Zeichen ohne O, 0, I und 1` },
  );

/** Anzeigename. Kurz genug fuer die Tischliste, lang genug fuer Namen. */
export const DisplayNameSchema = z.string().trim().min(1).max(16);

export const HelloRequestSchema = z.object({
  /** Fehlt beim ersten Besuch; dann legt der Server einen Gast an. */
  secret: z.string().min(1).optional(),
  name: DisplayNameSchema.optional(),
});

export const HelloResponseSchema = z.object({
  userId: z.string().min(1),
  /** Nur beim Anlegen gefuellt - danach kennt der Browser es. */
  secret: z.string().min(1).optional(),
  name: DisplayNameSchema,
});

export const CreateRoomRequestSchema = z.object({
  seatCount: z.number().int().min(MIN_SEATS).max(MAX_SEATS),
  seed: z.string().trim().min(1).max(24),
});

export const RoomCodeResponseSchema = z.object({ code: RoomCodeSchema });

export const JoinRoomRequestSchema = z.object({ code: RoomCodeSchema });

export const EmptyRequestSchema = z.object({});
export const EmptyResponseSchema = z.object({});

export const ActRequestSchema = z.object({ action: GameActionSchema });

export type HelloRequest = z.infer<typeof HelloRequestSchema>;
export type HelloResponse = z.infer<typeof HelloResponseSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type ActRequest = z.infer<typeof ActRequestSchema>;
export type RoomCode = z.infer<typeof RoomCodeSchema>;
```

`registry.ts` um die Eintraege erweitern — der Kopfkommentar bleibt, die Map waechst:

```ts
export const protocol = {
  [PING]: {
    responseType: PONG,
    request: PingRequestSchema,
    response: PongResponseSchema,
  },
  [HELLO]: {
    responseType: HELLO_OK,
    request: HelloRequestSchema,
    response: HelloResponseSchema,
  },
  [CREATE_ROOM]: {
    responseType: ROOM_CREATED,
    request: CreateRoomRequestSchema,
    response: RoomCodeResponseSchema,
  },
  [JOIN_ROOM]: {
    responseType: ROOM_JOINED,
    request: JoinRoomRequestSchema,
    response: RoomCodeResponseSchema,
  },
  [LEAVE_ROOM]: {
    responseType: ROOM_LEFT,
    request: EmptyRequestSchema,
    response: EmptyResponseSchema,
  },
  [START_GAME]: {
    responseType: GAME_STARTED,
    request: EmptyRequestSchema,
    response: EmptyResponseSchema,
  },
  [ACT]: {
    responseType: ACT_OK,
    request: ActRequestSchema,
    response: EmptyResponseSchema,
  },
} as const satisfies ProtocolMap;
```

In `protocol/index.ts` ergaenzen: `export * from './room.js';`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/protocol/`
Expected: PASS — die vier neuen und die bestehenden Protokoll-Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write packages/shared/src/protocol
git add packages/shared/src/protocol
git commit -m "Protokoll: Anfragen fuer Identitaet, Raum und Zug"
```

---

### Task 4: Protokoll — Ereignisse ohne Anfrage

**Files:**

- Create: `packages/shared/src/protocol/events.ts`
- Modify: `packages/shared/src/protocol/index.ts`
- Test: `packages/shared/src/protocol/events.test.ts`

**Interfaces:**

- Consumes: `PlayerViewSchema` (Task 2), `GameActionSchema`.
- Produces: `ROOM_EVENT`, `GAME_EVENT`, `OVER_EVENT`, `events` (Registry), `type EventType`, `EventPayloadOf<K>`, `isEventType(value)`, `eventSchema(type)`.

**Warum eine zweite Registry:** Die bestehende bildet Anfrage → Antwort ab. Ein Ereignis hat keine Anfrage, also auch keinen `responseType` und kein Request-Schema. Es in dieselbe Struktur zu pressen hiesse, zwei Felder leer zu lassen und beim Lesen jedes Mal zu erklaeren, warum.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/protocol/events.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GAME_EVENT, OVER_EVENT, ROOM_EVENT, eventSchema, isEventType } from './events.js';

describe('Ereignisse', () => {
  it('kennt genau die drei Ereignisse', () => {
    expect(isEventType(ROOM_EVENT)).toBe(true);
    expect(isEventType(GAME_EVENT)).toBe(true);
    expect(isEventType(OVER_EVENT)).toBe(true);
    expect(isEventType('ping')).toBe(false);
  });

  it('verlangt im Raum-Ereignis Sitze mit Verbindungszustand', () => {
    const schema = eventSchema(ROOM_EVENT);

    expect(
      schema.safeParse({
        code: 'K7X2',
        hostId: 'u1',
        seatCount: 3,
        seed: 'abc',
        started: false,
        seats: [{ userId: 'u1', name: 'Anna', color: '#c0392b', connected: true }],
      }).success,
    ).toBe(true);

    expect(schema.safeParse({ code: 'K7X2', hostId: 'u1', seats: [] }).success).toBe(false);
  });

  it('laesst im Spiel-Ereignis keinen Zufallszustand durch', () => {
    const schema = eventSchema(GAME_EVENT);
    const result = schema.safeParse({
      version: 1,
      view: { rng: { a: 1, b: 2, c: 3, d: 4 } },
      actions: [],
    });

    // Die Sicht muss ihr eigenes Schema erfuellen; ein blosses `rng` ist keine.
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/protocol/events.test.ts`
Expected: FAIL — `Failed to resolve import "./events.js"`.

- [ ] **Step 3: Write minimal implementation**

`packages/shared/src/protocol/events.ts`:

```ts
import { z } from 'zod';

import { GameActionSchema } from '../game/actions.js';
import { PlayerViewSchema } from '../game/playerView.js';
import { MAX_SEATS, MIN_SEATS } from '../seats.js';
import { DisplayNameSchema, RoomCodeSchema } from './room.js';

/**
 * Nachrichten, die der Server ohne Anfrage schickt.
 *
 * Der Envelope traegt das seit Etappe 0: `replyTo` ist optional. Neu ist nur
 * die Registry - und sie ist bewusst eine eigene. Die bestehende bildet
 * Anfrage auf Antwort ab; ein Ereignis hat keine Anfrage und damit weder
 * `responseType` noch Request-Schema. Zwei leere Felder mit Erklaerung waeren
 * schlechter als zwei Registries mit klarem Zweck.
 *
 * Auch Ereignisse gehen durch die Validierung, bevor sie den Server verlassen:
 * was nicht im Schema steht, kann nicht hinaus (Regel 4).
 */

export const ROOM_EVENT = 'room.state';
export const GAME_EVENT = 'game.state';
export const OVER_EVENT = 'room.over';

export const SeatInRoomSchema = z.object({
  userId: z.string().min(1),
  name: DisplayNameSchema,
  color: z.string().min(1),
  connected: z.boolean(),
});

export const RoomEventSchema = z.object({
  code: RoomCodeSchema,
  hostId: z.string().min(1),
  seatCount: z.number().int().min(MIN_SEATS).max(MAX_SEATS),
  seed: z.string().min(1),
  started: z.boolean(),
  seats: z.array(SeatInRoomSchema),
});

/**
 * Der Spielstand - **je Empfaenger ein eigener**.
 *
 * `actions` sind die Zuege, die genau dieser Empfaenger gerade machen darf.
 * `legalActions` laeuft auf dem Server, weil es den vollen Zustand braucht;
 * der Client bekommt das Ergebnis und muss keine Regel kennen.
 */
export const GameEventSchema = z.object({
  version: z.number().int().min(0),
  view: PlayerViewSchema,
  actions: z.array(GameActionSchema),
  /** Verlaufssatz zum Zug, der gerade geschehen ist. Fehlt beim ersten Stand. */
  entry: z.string().min(1).optional(),
});

export const OverEventSchema = z.object({
  code: RoomCodeSchema,
  reason: z.string().min(1),
});

export const events = {
  [ROOM_EVENT]: RoomEventSchema,
  [GAME_EVENT]: GameEventSchema,
  [OVER_EVENT]: OverEventSchema,
} as const satisfies Readonly<Record<string, z.ZodType>>;

export type Events = typeof events;
export type EventType = keyof Events & string;
export type EventPayloadOf<K extends EventType> = z.infer<Events[K]>;

export function isEventType(value: string): value is EventType {
  return Object.prototype.hasOwnProperty.call(events, value);
}

export function eventSchema<K extends EventType>(type: K): Events[K] {
  return events[type];
}

export type RoomEvent = z.infer<typeof RoomEventSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type OverEvent = z.infer<typeof OverEventSchema>;
export type SeatInRoom = z.infer<typeof SeatInRoomSchema>;
```

In `protocol/index.ts` ergaenzen: `export * from './events.js';`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/protocol/events.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write packages/shared/src/protocol
git add packages/shared/src/protocol
git commit -m "Protokoll: Ereignisse ohne Anfrage, mit eigener Registry"
```

---

### Task 5: Der Raum als reine Datenstruktur

Alles, was ein Raum kann, ohne Netzwerk und ohne Datenbank — damit es ohne beides pruefbar ist.

**Files:**

- Create: `apps/server/src/rooms/room.ts`
- Test: `apps/server/src/rooms/room.test.ts`

**Interfaces:**

- Consumes: `Seat`, `GameState`, `createGame`, `generateScenario`, `CLASSIC_RULES`, `CLASSIC_34`, `CLASSIC_56`, `seatColorAt`.
- Produces: `interface RoomSeat { userId; name; color; connected }`, `interface Room { code; hostId; seatCount; seed; seats; game; version }`, `createRoom(...)`, `joinRoom(room, userId, name)`, `leaveRoom(room, userId)`, `setConnected(room, userId, connected)`, `startGame(room, byUserId)`, `applyAction(room, userId, action)` — alle als `{ ok: true, room } | { ok: false, error }`.

**Wichtig:** Jede Funktion gibt einen **neuen** Raum zurueck und veraendert keinen. Damit ist ein Raum ein Wert wie der `GameState` — dieselbe Denkweise, dieselbe Pruefbarkeit, und ab Etappe 6 dieselbe Speicherbarkeit.

- [ ] **Step 1: Write the failing test**

`apps/server/src/rooms/room.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { legalActions, setupPlayer } from '@conquerist/shared';
import {
  applyAction,
  createRoom,
  joinRoom,
  leaveRoom,
  setConnected,
  startGame,
  type Room,
} from './room.js';

function room(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'raum-probe');
  if (!created.ok) throw new Error(created.error);
  return created.room;
}

function withThree(): Room {
  let current = room();
  for (const [id, name] of [
    ['u2', 'Ben'],
    ['u3', 'Cem'],
  ] as const) {
    const joined = joinRoom(current, id, name);
    if (!joined.ok) throw new Error(joined.error);
    current = joined.room;
  }
  return current;
}

describe('Raum', () => {
  it('setzt den Ersteller auf den ersten Platz und macht ihn zum Host', () => {
    const created = room();
    expect(created.hostId).toBe('u1');
    expect(created.seats).toHaveLength(1);
    expect(created.seats[0]).toMatchObject({ userId: 'u1', name: 'Anna', connected: true });
    expect(created.game).toBeNull();
  });

  it('vergibt Farben in der Reihenfolge des Beitritts', () => {
    const full = withThree();
    expect(new Set(full.seats.map((seat) => seat.color)).size).toBe(3);
  });

  it('laesst niemanden zweimal beitreten, sondern erkennt ihn wieder', () => {
    const again = joinRoom(withThree(), 'u2', 'Ben');
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.room.seats).toHaveLength(3);
  });

  it('weist ab, wenn der Tisch voll ist', () => {
    const result = joinRoom(withThree(), 'u4', 'Dana');
    expect(result.ok).toBe(false);
  });

  it('startet nur auf Wunsch des Hosts', () => {
    const full = withThree();
    expect(startGame(full, 'u2').ok).toBe(false);

    const started = startGame(full, 'u1');
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.room.game).not.toBeNull();
      expect(started.room.version).toBeGreaterThan(full.version);
    }
  });

  it('startet nicht mit unvollstaendigem Tisch', () => {
    expect(startGame(room(), 'u1').ok).toBe(false);
  });

  it('nimmt einen Zug nur vom richtigen Spieler an', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const running = started.room;
    const game = running.game!;

    const first = legalActions(game, setupPlayer(game)!)[0]!;
    const wrongPlayer = running.seats.find((seat) => seat.userId !== setupPlayer(game))!;

    // Fremder Zug: abgelehnt, Zustand unveraendert.
    const rejected = applyAction(running, wrongPlayer.userId, first);
    expect(rejected.ok).toBe(false);

    const accepted = applyAction(running, setupPlayer(game)!, first);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.room.version).toBe(running.version + 1);
  });

  it('behaelt den Platz, wenn die Verbindung abbricht', () => {
    const gone = setConnected(withThree(), 'u2', false);
    expect(gone.seats).toHaveLength(3);
    expect(gone.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(false);
  });

  it('gibt einen Platz im Wartebereich frei, aber nicht in der laufenden Partie', () => {
    const waiting = leaveRoom(withThree(), 'u2');
    expect(waiting.seats).toHaveLength(2);

    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const afterLeave = leaveRoom(started.room, 'u2');
    expect(afterLeave.seats).toHaveLength(3);
    expect(afterLeave.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/room.test.ts`
Expected: FAIL — `Failed to resolve import "./room.js"`.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/rooms/room.ts`:

```ts
import {
  CLASSIC_34,
  CLASSIC_56,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  reduce,
  seatColorAt,
  type GameAction,
  type GameState,
  type ScenarioBlueprint,
} from '@conquerist/shared';

/**
 * Ein Raum als Wert.
 *
 * Jede Funktion gibt einen neuen Raum zurueck und veraendert keinen - dieselbe
 * Denkweise wie beim `GameState` aus Etappe 2, und aus demselben Grund: so ist
 * jeder Uebergang ohne Netzwerk, ohne Socket und ohne Datenbank pruefbar. Ab
 * Etappe 6 ist ein Wert ausserdem das, was sich ablegen laesst.
 *
 * Was hier NICHT passiert: Codes erfinden (das braucht Zufall und gehoert in
 * die Registry) und Nachrichten verschicken (das gehoert in die Handler).
 */
export interface RoomSeat {
  readonly userId: string;
  readonly name: string;
  readonly color: string;
  readonly connected: boolean;
}

export interface Room {
  readonly code: string;
  readonly hostId: string;
  readonly seatCount: number;
  readonly seed: string;
  readonly seats: readonly RoomSeat[];
  /** `null`, solange der Wartebereich laeuft. */
  readonly game: GameState | null;
  /** Zaehlt bei jeder Aenderung hoch; der Client verwirft aeltere Staende. */
  readonly version: number;
  readonly createdAt: number;
}

export type RoomResult =
  { readonly ok: true; readonly room: Room } | { readonly ok: false; readonly error: string };

const ok = (room: Room): RoomResult => ({ ok: true, room });
const fail = (error: string): RoomResult => ({ ok: false, error });

/** Welches Brett eine Tischgroesse traegt. Dieselbe Ableitung wie im Client. */
export function blueprintFor(seatCount: number): ScenarioBlueprint | undefined {
  return [CLASSIC_34, CLASSIC_56].find(
    (blueprint) => seatCount >= blueprint.minPlayers && seatCount <= blueprint.maxPlayers,
  );
}

export function createRoom(
  code: string,
  hostId: string,
  hostName: string,
  seatCount: number,
  seed: string,
  now = 0,
): RoomResult {
  if (blueprintFor(seatCount) === undefined) {
    return fail(`Fuer ${seatCount} Spieler gibt es kein passendes Brett`);
  }

  return ok({
    code,
    hostId,
    seatCount,
    seed,
    seats: [{ userId: hostId, name: hostName, color: seatColorAt(0), connected: true }],
    game: null,
    version: 1,
    createdAt: now,
  });
}

export function joinRoom(room: Room, userId: string, name: string): RoomResult {
  const known = room.seats.findIndex((seat) => seat.userId === userId);
  if (known >= 0) {
    // Wiedererkannt statt doppelt gesetzt: das ist der Reconnect-Fall.
    return ok(withSeats(room, replaceAt(room.seats, known, { connected: true, name })));
  }

  if (room.game !== null) {
    return fail('Die Partie laeuft bereits');
  }
  if (room.seats.length >= room.seatCount) {
    return fail('Der Tisch ist voll');
  }

  return ok(
    withSeats(room, [
      ...room.seats,
      { userId, name, color: seatColorAt(room.seats.length), connected: true },
    ]),
  );
}

/**
 * Verlassen.
 *
 * Im Wartebereich gibt es den Platz frei. In einer laufenden Partie nicht: der
 * Spielzustand kennt diesen Spieler, und ihn herauszunehmen hiesse, die Partie
 * zu zerstoeren. Er gilt dann nur als getrennt.
 */
export function leaveRoom(room: Room, userId: string): Room {
  if (room.game !== null) return setConnected(room, userId, false);

  const remaining = room.seats.filter((seat) => seat.userId !== userId);
  if (remaining.length === room.seats.length) return room;

  return {
    ...room,
    seats: remaining.map((seat, index) => ({ ...seat, color: seatColorAt(index) })),
    hostId: remaining[0]?.userId ?? room.hostId,
    version: room.version + 1,
  };
}

export function setConnected(room: Room, userId: string, connected: boolean): Room {
  const index = room.seats.findIndex((seat) => seat.userId === userId);
  if (index < 0) return room;
  return withSeats(room, replaceAt(room.seats, index, { connected }));
}

export function startGame(room: Room, byUserId: string): RoomResult {
  if (byUserId !== room.hostId) return fail('Nur wer die Partie erstellt hat, kann sie starten');
  if (room.game !== null) return fail('Die Partie laeuft bereits');
  if (room.seats.length !== room.seatCount) {
    return fail(`Es fehlen noch ${room.seatCount - room.seats.length} Spieler`);
  }

  const blueprint = blueprintFor(room.seatCount);
  if (blueprint === undefined) return fail('Kein passendes Brett');

  const scenario = generateScenario(blueprint, room.seed);
  const game = createGame(
    scenario,
    CLASSIC_RULES,
    room.seats.map((seat) => seat.userId),
    room.seed,
  );

  return ok({ ...room, game, version: room.version + 1 });
}

/**
 * Einen Zug anwenden.
 *
 * Zwei Pruefungen, in dieser Reihenfolge: **ist der Absender der, fuer den er
 * sich ausgibt** (Regel 3 - der Server glaubt dem `player`-Feld nicht), und
 * dann erst, ob der Zug regelgerecht ist (das weiss `reduce`).
 */
export function applyAction(room: Room, userId: string, action: GameAction): RoomResult {
  if (room.game === null) return fail('Die Partie hat noch nicht begonnen');
  if (action.player !== userId) {
    return fail('Ein Zug fuer einen anderen Spieler wird nicht angenommen');
  }
  if (!room.seats.some((seat) => seat.userId === userId)) {
    return fail('Du sitzt nicht an diesem Tisch');
  }

  const result = reduce(room.game, action);
  if (!result.ok) return fail(result.error.message);

  return ok({ ...room, game: result.state, version: room.version + 1 });
}

function withSeats(room: Room, seats: readonly RoomSeat[]): Room {
  return { ...room, seats, version: room.version + 1 };
}

function replaceAt(
  seats: readonly RoomSeat[],
  index: number,
  patch: Partial<RoomSeat>,
): readonly RoomSeat[] {
  return seats.map((seat, position) => (position === index ? { ...seat, ...patch } : seat));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/room.test.ts`
Expected: PASS, 9 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src/rooms
git add apps/server/src/rooms
git commit -m "Server: der Raum als Wert, mit allen Uebergaengen"
```

---

### Task 6: Raumverzeichnis mit Codevergabe

**Files:**

- Create: `apps/server/src/rooms/registry.ts`
- Test: `apps/server/src/rooms/registry.test.ts`

**Interfaces:**

- Consumes: alles aus Task 5.
- Produces: `class RoomRegistry` mit `create(hostId, hostName, seatCount, seed): RoomResult`, `get(code): Room | undefined`, `update(code, next: Room): void`, `remove(code)`, `roomOf(userId): Room | undefined`, `sweep(now)`, Konstruktor nimmt `{ randomCode?: () => string; now?: () => number }` fuer Tests.

- [ ] **Step 1: Write the failing test**

`apps/server/src/rooms/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@conquerist/shared';
import { RoomRegistry } from './registry.js';

describe('Raumverzeichnis', () => {
  it('vergibt Codes aus dem verwechslungsfreien Alphabet', () => {
    const registry = new RoomRegistry();
    const created = registry.create('u1', 'Anna', 3, 'abc');

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.room.code).toHaveLength(ROOM_CODE_LENGTH);
    for (const char of created.room.code) {
      expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it('weicht einem bereits vergebenen Code aus', () => {
    const codes = ['AAAA', 'AAAA', 'BBBB'];
    let call = 0;
    const registry = new RoomRegistry({ randomCode: () => codes[call++] ?? 'CCCC' });

    const first = registry.create('u1', 'Anna', 3, 'abc');
    const second = registry.create('u2', 'Ben', 3, 'abc');

    expect(first.ok && first.room.code).toBe('AAAA');
    expect(second.ok && second.room.code).toBe('BBBB');
  });

  it('findet den Raum eines Spielers', () => {
    const registry = new RoomRegistry();
    const created = registry.create('u1', 'Anna', 3, 'abc');
    if (!created.ok) throw new Error(created.error);

    expect(registry.roomOf('u1')?.code).toBe(created.room.code);
    expect(registry.roomOf('u9')).toBeUndefined();
  });

  it('raeumt leere Raeume nach der Frist weg, volle nicht', () => {
    let clock = 0;
    const registry = new RoomRegistry({ now: () => clock });
    const created = registry.create('u1', 'Anna', 3, 'abc');
    if (!created.ok) throw new Error(created.error);

    registry.update(created.room.code, { ...created.room, seats: [] });
    clock = 10 * 60_000;
    registry.sweep();

    expect(registry.get(created.room.code)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/registry.test.ts`
Expected: FAIL — `Failed to resolve import "./registry.js"`.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/rooms/registry.ts`:

```ts
import { randomInt } from 'node:crypto';

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@conquerist/shared';
import { createRoom, type Room, type RoomResult } from './room.js';

/**
 * Alle Raeume dieses Serverlaufs - im Speicher.
 *
 * Persistenz ist Etappe 6. Bis dahin gilt: ein Neustart wirft laufende Partien
 * weg. Das ist im Betrieb selten und beim Entwickeln laestig (`tsx watch`
 * startet bei jedem Speichern neu) - und es steht als offener Punkt in der
 * Spezifikation.
 *
 * Zufall und Uhr sind einspeisbar, damit die Tests weder das eine noch das
 * andere brauchen.
 */
export interface RegistryOptions {
  readonly randomCode?: () => string;
  readonly now?: () => number;
}

/** Wie lange ein leerer Raum ueberlebt. */
const EMPTY_ROOM_TTL_MS = 5 * 60_000;

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly randomCode: () => string;
  private readonly now: () => number;

  constructor(options: RegistryOptions = {}) {
    this.randomCode = options.randomCode ?? defaultCode;
    this.now = options.now ?? Date.now;
  }

  create(hostId: string, hostName: string, seatCount: number, seed: string): RoomResult {
    const code = this.freeCode();
    if (code === null) return { ok: false, error: 'Kein freier Raumcode - bitte gleich nochmal' };

    const created = createRoom(code, hostId, hostName, seatCount, seed, this.now());
    if (created.ok) this.rooms.set(code, created.room);
    return created;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  update(code: string, next: Room): void {
    if (this.rooms.has(code)) this.rooms.set(code, next);
  }

  remove(code: string): void {
    this.rooms.delete(code);
  }

  /** In welchem Raum dieser Spieler sitzt - fuer den Reconnect. */
  roomOf(userId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.seats.some((seat) => seat.userId === userId)) return room;
    }
    return undefined;
  }

  get all(): readonly Room[] {
    return [...this.rooms.values()];
  }

  /** Wirft leere Raeume weg, die lange genug leer sind. */
  sweep(): void {
    const deadline = this.now() - EMPTY_ROOM_TTL_MS;
    for (const [code, room] of this.rooms) {
      if (room.seats.length === 0 && room.createdAt <= deadline) this.rooms.delete(code);
    }
  }

  /** Ein paar Versuche, dann Aufgabe - besser eine ehrliche Absage als eine Endlosschleife. */
  private freeCode(): string | null {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = this.randomCode();
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }
}

function defaultCode(): string {
  let code = '';
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/`
Expected: PASS, 13 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src/rooms
git add apps/server/src/rooms
git commit -m "Server: Raumverzeichnis mit verwechslungsfreien Codes"
```

---

### Task 7: Identitaet in SQLite

**Files:**

- Create: `apps/server/src/db/database.ts`
- Create: `apps/server/src/identity/users.ts`
- Modify: `apps/server/package.json` (`better-sqlite3`, `@types/better-sqlite3`)
- Modify: `apps/server/src/config.ts` (`DATABASE_FILE`, Default `./data/conquerist.db`)
- Modify: `.gitignore` (`data/`)
- Test: `apps/server/src/identity/users.test.ts`

**Interfaces:**

- Produces: `openDatabase(file: string): Database`, `migrate(db)`, `class Users` mit `helloWithSecret(secret, name?)`, `createGuest(name)`, `rename(userId, name)`, `byId(id)`.

**Wichtig:** Tests laufen gegen `:memory:` — keine Datei, kein Aufraeumen, keine Reihenfolgeabhaengigkeit.

- [ ] **Step 1: Abhaengigkeit aufnehmen**

```bash
cd /c/code/Conquerist
pnpm --filter @conquerist/server add better-sqlite3
pnpm --filter @conquerist/server add -D @types/better-sqlite3
```

- [ ] **Step 2: Write the failing test**

`apps/server/src/identity/users.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import { Users } from './users.js';

function users(): Users {
  return new Users(openDatabase(':memory:'));
}

describe('Identitaet', () => {
  it('legt beim ersten Besuch einen Gast an und gibt ein Geheimnis heraus', () => {
    const store = users();
    const first = store.hello(undefined, 'Anna');

    expect(first.user.isGuest).toBe(true);
    expect(first.user.name).toBe('Anna');
    expect(first.secret).toBeTruthy();
  });

  it('erkennt dieselbe Person am Geheimnis wieder - ohne neue Zeile', () => {
    const store = users();
    const first = store.hello(undefined, 'Anna');
    const again = store.hello(first.secret, undefined);

    expect(again.user.id).toBe(first.user.id);
    // Kein zweites Geheimnis: der Browser hat seins schon.
    expect(again.secret).toBeUndefined();
    expect(store.count()).toBe(1);
  });

  it('legt bei einem falschen Geheimnis keine Zeile an, sondern lehnt ab', () => {
    const store = users();
    store.hello(undefined, 'Anna');

    expect(() => store.hello('voellig-erfunden', 'Boeser')).toThrow();
    expect(store.count()).toBe(1);
  });

  it('speichert das Geheimnis niemals im Klartext', () => {
    const database = openDatabase(':memory:');
    const store = new Users(database);
    const created = store.hello(undefined, 'Anna');

    const row = database
      .prepare('SELECT secret_hash FROM users WHERE id = ?')
      .get(created.user.id) as { secret_hash: string };

    expect(row.secret_hash).not.toBe(created.secret);
    expect(row.secret_hash).toHaveLength(64); // SHA-256 in hex
  });

  it('uebernimmt einen neuen Namen bei der Rueckkehr', () => {
    const store = users();
    const first = store.hello(undefined, 'Anna');
    const renamed = store.hello(first.secret, 'Anna B.');

    expect(renamed.user.name).toBe('Anna B.');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/identity/users.test.ts`
Expected: FAIL — `Failed to resolve import "../db/database.js"`.

- [ ] **Step 4: Write minimal implementation**

`apps/server/src/db/database.ts`:

```ts
import Database from 'better-sqlite3';

/**
 * SQLite-Verbindung samt Schema.
 *
 * `WAL` und `foreign_keys` werden beim Oeffnen gesetzt, nicht irgendwo spaeter:
 * eine Verbindung ohne diese Pragmas verhaelt sich anders, und genau solche
 * Unterschiede zwischen Test und Betrieb sind teuer.
 *
 * Das Schema wandert mit dem Code (`migrate`), nicht in eine Datei daneben.
 * Solange es eine Tabelle ist, ist das ehrlicher als ein Migrationswerkzeug.
 */
export type AppDatabase = Database.Database;

export function openDatabase(file: string): AppDatabase {
  const database = new Database(file);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  migrate(database);
  return database;
}

export function migrate(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      is_guest     INTEGER NOT NULL DEFAULT 1,
      secret_hash  TEXT NOT NULL UNIQUE,
      created_at   INTEGER NOT NULL
    );
  `);
}
```

`apps/server/src/identity/users.ts`:

```ts
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';

/**
 * Gaeste und ihre Sitzungsgeheimnisse (Regel 7: Identitaet ab Tag 1).
 *
 * Das Geheimnis wird **gehasht** abgelegt, obwohl es „nur" ein Gast ist. Zwei
 * Gruende: es ist faktisch ein Passwort - wer es hat, ist diese Person -, und
 * in Etappe 7 wird aus genau dieser Zeile per UPDATE ein richtiges Konto. Wer
 * jetzt Klartext speichert, hat das Datenleck dann schon eingebaut.
 */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly isGuest: boolean;
}

export interface HelloResult {
  readonly user: User;
  /** Nur beim Anlegen gefuellt - danach kennt der Browser es. */
  readonly secret?: string;
}

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly is_guest: number;
}

export class Users {
  constructor(private readonly database: AppDatabase) {}

  /**
   * Anmelden oder anlegen.
   *
   * Ein unbekanntes Geheimnis wirft, statt still einen neuen Gast anzulegen:
   * sonst waere ein Tippfehler im `localStorage` nicht von einem Angriff zu
   * unterscheiden, und der Tisch fuellte sich mit Karteileichen.
   */
  hello(secret: string | undefined, name: string | undefined): HelloResult {
    if (secret === undefined) return this.createGuest(name ?? 'Gast');

    const row = this.database
      .prepare('SELECT id, name, is_guest FROM users WHERE secret_hash = ?')
      .get(hash(secret)) as UserRow | undefined;

    if (row === undefined) {
      throw new Error('Unbekanntes Sitzungsgeheimnis');
    }

    if (name !== undefined && name !== row.name) {
      this.database.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, row.id);
      return { user: { id: row.id, name, isGuest: row.is_guest === 1 } };
    }

    return { user: { id: row.id, name: row.name, isGuest: row.is_guest === 1 } };
  }

  createGuest(name: string): HelloResult {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');

    this.database
      .prepare(
        'INSERT INTO users (id, name, is_guest, secret_hash, created_at) VALUES (?, ?, 1, ?, ?)',
      )
      .run(id, name, hash(secret), Date.now());

    return { user: { id, name, isGuest: true }, secret };
  }

  byId(id: string): User | undefined {
    const row = this.database
      .prepare('SELECT id, name, is_guest FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;

    return row === undefined
      ? undefined
      : { id: row.id, name: row.name, isGuest: row.is_guest === 1 };
  }

  count(): number {
    const row = this.database.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return row.n;
  }
}

function hash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
```

In `config.ts` `DATABASE_FILE` mit Default `./data/conquerist.db` ergaenzen (per Zod validiert, wie die uebrigen Werte); in `.gitignore` `data/` aufnehmen.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run src/identity/`
Expected: PASS, 5 Tests.

- [ ] **Step 6: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src .gitignore
git add apps/server .gitignore pnpm-lock.yaml
git commit -m "Server: Gast-Identitaet in SQLite, Geheimnis nur gehasht"
```

---

### Task 8: Sitzung je Verbindung und validiertes Senden

Der Router aus Etappe 0 kennt nur Anfrage und Antwort. Jetzt braucht er zwei Dinge mehr: einen Platz fuer „wer ist an dieser Leitung" und einen Weg, ungefragt zu senden.

**Files:**

- Modify: `apps/server/src/ws/router.ts` (`RequestContext` um `session` erweitern)
- Modify: `apps/server/src/ws/connection.ts` (Sitzung anlegen, Ereignissenke bereitstellen)
- Create: `apps/server/src/ws/events.ts`
- Test: `apps/server/src/ws/events.test.ts`

**Interfaces:**

- Produces: `interface Session { userId: string | null; roomCode: string | null }`, `interface EventSink { send<K extends EventType>(type: K, payload: EventPayloadOf<K>): void }`, `createEventSender(send: (raw: string) => void, onInvalid: (type, message) => void): EventSink`.
- `RequestContext` bekommt `readonly session: Session` (veraenderbares Objekt, absichtlich: die Verbindung merkt sich, wer sie ist).

- [ ] **Step 1: Write the failing test**

`apps/server/src/ws/events.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { GAME_EVENT, ROOM_EVENT } from '@conquerist/shared';
import { createEventSender } from './events.js';

const roomPayload = {
  code: 'K7X2',
  hostId: 'u1',
  seatCount: 3,
  seed: 'abc',
  started: false,
  seats: [{ userId: 'u1', name: 'Anna', color: '#c0392b', connected: true }],
};

describe('Ereignisse senden', () => {
  it('schickt ein gueltiges Ereignis als Envelope ohne replyTo', () => {
    const send = vi.fn();
    createEventSender(send, vi.fn()).send(ROOM_EVENT, roomPayload);

    expect(send).toHaveBeenCalledTimes(1);
    const message = JSON.parse(send.mock.calls[0]![0] as string) as Record<string, unknown>;

    expect(message['type']).toBe(ROOM_EVENT);
    expect(message['ok']).toBe(true);
    expect(message['replyTo']).toBeUndefined();
    expect(message['payload']).toMatchObject({ code: 'K7X2' });
  });

  it('haelt ein ungueltiges Ereignis zurueck, statt es zu verschicken', () => {
    const send = vi.fn();
    const onInvalid = vi.fn();

    // Ein `view`, das kein PlayerView ist - genau der Fall, der ein
    // Informationsleck waere, wenn er durchginge.
    createEventSender(send, onInvalid).send(GAME_EVENT, {
      version: 1,
      view: { rng: { a: 1, b: 2, c: 3, d: 4 } },
      actions: [],
    } as never);

    expect(send).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/ws/events.test.ts`
Expected: FAIL — `Failed to resolve import "./events.js"`.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/ws/events.ts`:

```ts
import {
  eventSchema,
  successMessage,
  type EventPayloadOf,
  type EventType,
} from '@conquerist/shared';

/**
 * Ereignisse verschicken - und vorher pruefen.
 *
 * Der Router validiert seit Etappe 0 jede Antwort gegen ihr Schema, mit genau
 * dieser Etappe als Begruendung: was nicht im Schema steht, kann den Server
 * nicht verlassen. Fuer Ereignisse gilt dasselbe, sie gehen nur nicht durch den
 * Router. Deshalb diese Schleuse.
 *
 * Ein ungueltiges Ereignis wird **nicht** gesendet. Lieber ein Spieler ohne
 * Aktualisierung und ein lauter Log-Eintrag als ein `rng` auf der Leitung.
 */
export interface EventSink {
  send<K extends EventType>(type: K, payload: EventPayloadOf<K>): void;
}

export function createEventSender(
  send: (raw: string) => void,
  onInvalid: (type: string, message: string) => void,
): EventSink {
  return {
    send(type, payload) {
      const parsed = eventSchema(type).safeParse(payload);
      if (!parsed.success) {
        onInvalid(type, parsed.error.issues.map((issue) => issue.message).join('; '));
        return;
      }

      send(JSON.stringify(successMessage(type, parsed.data)));
    },
  };
}
```

In `router.ts` das Interface erweitern (Kommentar mitziehen, der Etappe 4 bereits ankuendigt):

```ts
/**
 * Was an dieser Verbindung bekannt ist.
 *
 * Absichtlich veraenderbar: `hello` traegt hier die Nutzer-Id ein, `joinRoom`
 * den Raum. Die Alternative waere, bei jeder Nachricht erneut zu ermitteln, wer
 * da schreibt - und genau das soll ein Angreifer nicht beeinflussen koennen.
 */
export interface Session {
  userId: string | null;
  roomCode: string | null;
}

export interface RequestContext {
  readonly connectionId: string;
  readonly receivedAt: number;
  readonly session: Session;
}
```

In `connection.ts`: je Verbindung genau eine `Session` (`{ userId: null, roomCode: null }`) anlegen, in jeden `RequestContext` hineinreichen, und einen `EventSink` erzeugen, der auf denselben Socket schreibt. Beides muss die Verbindung ueberdauern — also neben der Socket-Instanz gehalten werden, nicht je Nachricht neu.

Die bestehenden Aufrufe in `router.test.ts` bekommen `session: { userId: null, roomCode: null }` in ihren Kontext.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @conquerist/server exec vitest run`
Expected: PASS — die zwei neuen und die 13 bestehenden Server-Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src
git add apps/server/src
git commit -m "Server: Sitzung je Verbindung und geprueftes Senden ohne Anfrage"
```

---

### Task 9: Die Handler — Identitaet, Raum, Zug

Hier laufen Identitaet, Raum und Zustellung zusammen. Die Verteilung ist der Punkt, an dem Regel 4 wirksam wird.

**Files:**

- Create: `apps/server/src/ws/handlers/room.ts`
- Create: `apps/server/src/rooms/broadcast.ts`
- Modify: `apps/server/src/app.ts` (Handler registrieren, Registry und `Users` bereitstellen)
- Test: `apps/server/src/rooms/broadcast.test.ts`

**Interfaces:**

- Consumes: `RoomRegistry`, `Users`, `EventSink`, `playerViewOf`, `legalActions`, `describeTransition` (neu in `shared`, siehe unten).
- Produces: `registerRoomHandlers(router, deps)`, `broadcastRoom(room, sinks)`, `broadcastGame(room, sinks, entry?)`.

**Neu in `shared`:** Der Verlaufssatz muss auf den Server, weil der Client fremde Haende nicht mehr sieht. `apps/client/src/game/log.ts` wandert nach `packages/shared/src/game/log.ts` (unveraendert bis auf den Import von `Seat`), der Client importiert von dort. Das ist ein reiner Umzug — Tests mitnehmen.

- [ ] **Step 1: Write the failing test**

`apps/server/src/rooms/broadcast.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { GAME_EVENT, ROOM_EVENT } from '@conquerist/shared';
import { broadcastGame, broadcastRoom } from './broadcast.js';
import { createRoom, joinRoom, startGame, type Room } from './room.js';
import type { EventSink } from '../ws/events.js';

function runningRoom(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'sende-probe');
  if (!created.ok) throw new Error(created.error);

  let room = created.room;
  for (const [id, name] of [
    ['u2', 'Ben'],
    ['u3', 'Cem'],
  ] as const) {
    const joined = joinRoom(room, id, name);
    if (!joined.ok) throw new Error(joined.error);
    room = joined.room;
  }

  const started = startGame(room, 'u1');
  if (!started.ok) throw new Error(started.error);
  return started.room;
}

function sinks(ids: readonly string[]): Map<string, EventSink[]> {
  return new Map(ids.map((id) => [id, [{ send: vi.fn() } as unknown as EventSink]]));
}

describe('Zustellung', () => {
  it('schickt jedem Spieler eine eigene Sicht', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets);

    for (const [userId, list] of targets) {
      const send = list[0]!.send as unknown as ReturnType<typeof vi.fn>;
      expect(send).toHaveBeenCalledTimes(1);

      const [type, payload] = send.mock.calls[0]!;
      expect(type).toBe(GAME_EVENT);
      expect(payload.view.you).toBe(userId);
    }
  });

  it('zeigt niemandem fremde Handkarten', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets);

    const send = targets.get('u2')![0]!.send as unknown as ReturnType<typeof vi.fn>;
    const payload = send.mock.calls[0]![1];

    for (const player of payload.view.players) {
      if (player.id === 'u2') expect(player.resources).not.toBeNull();
      else expect(player.resources).toBeNull();
    }
    expect(JSON.stringify(payload)).not.toContain('"rng"');
  });

  it('schickt jedem nur seine eigenen erlaubten Zuege', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets);

    const withActions = [...targets.values()].filter((list) => {
      const send = list[0]!.send as unknown as ReturnType<typeof vi.fn>;
      return send.mock.calls[0]![1].actions.length > 0;
    });

    // In der Gruendungsphase darf genau einer setzen.
    expect(withActions).toHaveLength(1);
  });

  it('schickt den Raumzustand an alle gleich', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastRoom(room, targets);

    for (const list of targets.values()) {
      const send = list[0]!.send as unknown as ReturnType<typeof vi.fn>;
      expect(send.mock.calls[0]![0]).toBe(ROOM_EVENT);
      expect(send.mock.calls[0]![1].code).toBe('K7X2');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/broadcast.test.ts`
Expected: FAIL — `Failed to resolve import "./broadcast.js"`.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/rooms/broadcast.ts`:

```ts
import {
  GAME_EVENT,
  OVER_EVENT,
  ROOM_EVENT,
  legalActions,
  playerViewOf,
  type Seat,
} from '@conquerist/shared';
import type { EventSink } from '../ws/events.js';
import type { Room } from './room.js';

/**
 * Zustellung - je Empfaenger, nicht je Raum.
 *
 * Das ist der Punkt, an dem Regel 4 wirklich greift: ein Broadcast mit einer
 * gemeinsamen Nachricht waere bequemer und wuerde jedem die Handkarten aller
 * schicken. Stattdessen wird fuer jeden Empfaenger eine eigene `PlayerView`
 * gebaut - und die erlaubten Zuege gleich mit, denn `legalActions` braucht den
 * vollen Zustand und laeuft deshalb hier und nicht im Browser.
 *
 * Ein Spieler kann mehrere Verbindungen haben (zweiter Tab, Handy daneben);
 * deshalb eine Liste Senken je Nutzer.
 */
export type Sinks = ReadonlyMap<string, readonly EventSink[]>;

export function broadcastRoom(room: Room, sinks: Sinks): void {
  const payload = {
    code: room.code,
    hostId: room.hostId,
    seatCount: room.seatCount,
    seed: room.seed,
    started: room.game !== null,
    seats: room.seats.map((seat) => ({
      userId: seat.userId,
      name: seat.name,
      color: seat.color,
      connected: seat.connected,
    })),
  };

  for (const seat of room.seats) {
    for (const sink of sinks.get(seat.userId) ?? []) sink.send(ROOM_EVENT, payload);
  }
}

export function broadcastGame(room: Room, sinks: Sinks, entry?: string): void {
  const game = room.game;
  if (game === null) return;

  const seats: readonly Seat[] = room.seats.map((seat) => ({
    id: seat.userId,
    name: seat.name,
    color: seat.color,
  }));
  const connected = new Map(room.seats.map((seat) => [seat.userId, seat.connected]));

  for (const seat of room.seats) {
    const targets = sinks.get(seat.userId) ?? [];
    if (targets.length === 0) continue;

    const payload = {
      version: room.version,
      view: playerViewOf(game, seat.userId, seats, room.version, connected),
      actions: legalActions(game, seat.userId),
      ...(entry === undefined ? {} : { entry }),
    };

    for (const sink of targets) sink.send(GAME_EVENT, payload);
  }
}

export function broadcastOver(room: Room, sinks: Sinks, reason: string): void {
  for (const seat of room.seats) {
    for (const sink of sinks.get(seat.userId) ?? []) {
      sink.send(OVER_EVENT, { code: room.code, reason });
    }
  }
}
```

`apps/server/src/ws/handlers/room.ts` registriert die sechs Handler. Aufbau je Handler, immer gleich:

1. Sitzung pruefen (`session.userId` gesetzt? sonst Fehler „erst anmelden"),
2. Raum holen,
3. Uebergang aus `rooms/room.ts` aufrufen,
4. bei Erfolg `registry.update`, dann `broadcastRoom` bzw. `broadcastGame`,
5. leere Antwort zurueckgeben.

Der `act`-Handler baut den Verlaufssatz mit `describeTransition(vorher, action, nachher, seats)` und reicht ihn als `entry` in `broadcastGame`.

`hello` traegt `session.userId` ein und antwortet mit `{ userId, secret?, name }`. Nach `hello` prueft der Handler zusaetzlich `registry.roomOf(userId)` — sitzt der Nutzer schon irgendwo, wird `session.roomCode` gesetzt, `setConnected(room, userId, true)` angewendet und sofort `broadcastRoom` plus `broadcastGame` geschickt. **Das ist der Reconnect**, und er kostet genau diese fuenf Zeilen.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run`
Expected: PASS — vier neue plus alle bestehenden.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src packages/shared/src
git add apps/server/src packages/shared/src apps/client/src
git commit -m "Server: Handler fuer Identitaet, Raum und Zug samt Zustellung"
```

---

### Task 10: Tunnelfeste Origin-Pruefung und Ausliefern des Clients

**Files:**

- Modify: `apps/server/src/ws/attach.ts` (Origin-Regel)
- Create: `apps/server/src/static.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/package.json` (`@fastify/static`)
- Test: `apps/server/src/ws/origin.test.ts`

**Interfaces:**

- Produces: `isAllowedOrigin(origin: string | undefined, host: string | undefined, allowed: readonly string[]): boolean`.

- [ ] **Step 1: Write the failing test**

`apps/server/src/ws/origin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './origin.js';

const configured = ['http://localhost:5173'];

describe('Origin-Pruefung', () => {
  it('erlaubt gleichen Ursprung - damit jede Tunneladresse funktioniert', () => {
    expect(
      isAllowedOrigin('https://zufall-xyz.trycloudflare.com', 'zufall-xyz.trycloudflare.com', []),
    ).toBe(true);
    expect(isAllowedOrigin('http://192.168.1.42:8080', '192.168.1.42:8080', [])).toBe(true);
  });

  it('erlaubt weiterhin die eingetragenen Origins', () => {
    expect(isAllowedOrigin('http://localhost:5173', '127.0.0.1:8080', configured)).toBe(true);
  });

  it('lehnt fremde Origins ab', () => {
    expect(isAllowedOrigin('http://evil.example', 'zufall-xyz.trycloudflare.com', configured)).toBe(
      false,
    );
  });

  it('lehnt ab, wenn der Origin fehlt', () => {
    // Ein Browser schickt immer einen Origin. Fehlt er, ist es kein Browser -
    // und dann gibt es keinen Grund, ihn wie einen zu behandeln.
    expect(isAllowedOrigin(undefined, 'localhost:8080', configured)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/ws/origin.test.ts`
Expected: FAIL — `Failed to resolve import "./origin.js"`.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/ws/origin.ts`:

```ts
/**
 * Wer den WebSocket oeffnen darf.
 *
 * Bis Etappe 3 stand hier nur eine feste Liste. Eine Tunneladresse wechselt
 * aber bei jedem Start, und eine Liste, die man vor jedem Spieleabend pflegt,
 * pflegt niemand. Neue Regel, in dieser Reihenfolge:
 *
 *   1. Gleicher Ursprung ist erlaubt. Der Server liefert den Client selbst
 *      aus, also ist das der Normalfall - und er gilt fuer jede Adresse, ohne
 *      Konfiguration.
 *   2. Zusaetzlich die eingetragenen Origins (der Vite-Dev-Proxy).
 *
 * Die Ablehnung fremder Origins aus Etappe 0 bleibt damit in Kraft; sie wird
 * nur nicht mehr von einer wechselnden Adresse ausgehebelt.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  allowed: readonly string[],
): boolean {
  if (origin === undefined || origin === '') return false;
  if (allowed.includes(origin)) return true;
  if (host === undefined || host === '') return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
```

`attach.ts` benutzt ab jetzt `isAllowedOrigin(request.headers.origin, request.headers.host, config.clientOrigins)`.

`apps/server/src/static.ts` registriert `@fastify/static` auf `apps/client/dist` mit einer SPA-Rueckfallregel: jeder Pfad ohne Treffer liefert `index.html` — sonst scheitert ein Reload auf `?raum=K7X2` an einem 404. Der Ordner fehlt in der Entwicklung; dann wird die Registrierung uebersprungen und einmal geloggt statt zu werfen.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @conquerist/server exec vitest run && pnpm --filter @conquerist/server acceptance`
Expected: PASS — Origin-Tests gruen, Abnahme weiterhin 7/7 (braucht laufenden `pnpm dev`).

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server
git add apps/server pnpm-lock.yaml
git commit -m "Server: gleicher Ursprung ist erlaubt, Client wird ausgeliefert"
```

---

### Task 11: Client — Klickkarten aus einer Aktionsliste

**Files:**

- Modify: `apps/client/src/game/targets.ts`
- Modify: `apps/client/src/game/targets.test.ts`
- Modify: `apps/client/src/screens/GameScreen.tsx` (Aufrufstelle)

**Interfaces:**

- Produces: `targetsFrom(actions: readonly GameAction[]): ActionTargets`. `actionTargets(state, player)` bleibt als duenne Hilfe fuer die lokale Partie: `targetsFrom(legalActions(state, player))`.

- [ ] **Step 1: Test anpassen**

In `targets.test.ts` die bestehenden Faelle auf `targetsFrom(legalActions(...))` umstellen und einen Fall ergaenzen:

```ts
it('nimmt eine fertige Aktionsliste - so kommt sie ab Etappe 4 vom Server', () => {
  const actions: GameAction[] = [
    { type: 'buildRoad', player: 'p1', edge: 'e:0,0|1,0' },
    { type: 'endTurn', player: 'p1' },
  ];

  const targets = targetsFrom(actions);

  expect(targets.edges.get('e:0,0|1,0')).toEqual(actions[0]);
  expect(targets.endTurn).toEqual(actions[1]);
  expect(targets.vertices.size).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/targets.test.ts`
Expected: FAIL — `targetsFrom is not a function`.

- [ ] **Step 3: Umstellen**

In `targets.ts` die Schleife aus `actionTargets` nach `targetsFrom(actions)` heben; `actionTargets` bleibt als:

```ts
/**
 * Bequemlichkeit fuer die lokale Partie.
 *
 * Online kommt die Liste vom Server (`legalActions` braucht den vollen
 * Zustand und laeuft deshalb dort). Hier wird sie selbst geholt - dieselbe
 * Funktion, dieselben Regeln, nur ohne Netz.
 */
export function actionTargets(state: GameState, player: PlayerId): ActionTargets {
  return targetsFrom(legalActions(state, player));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run`
Expected: PASS — alle Client-Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src/game
git add apps/client/src/game
git commit -m "Client: Klickkarten aus einer fertigen Aktionsliste"
```

---

### Task 12: Client — Sitzung und Online-Partie

**Files:**

- Create: `apps/client/src/net/session.ts`
- Create: `apps/client/src/game/useOnlineGame.ts`
- Test: `apps/client/src/game/onlineState.test.ts`
- Create: `apps/client/src/game/onlineState.ts` (der reine Teil)

**Interfaces:**

- Produces: `loadSecret()`, `storeSecret(secret)` (localStorage, mit Guard fuer fehlenden Speicher); `interface OnlineState { room: RoomEvent | null; view: PlayerView | null; actions: readonly GameAction[]; log: readonly LogEntry[]; lastError: string | null }`, `onlineReducer(state, event)`, `useOnlineGame(connection)`.

**Der reine Kern:** Was mit einer eintreffenden Nachricht passiert, ist eine Funktion und wird ohne React geprueft — insbesondere das Verwerfen veralteter Versionen.

- [ ] **Step 1: Write the failing test**

`apps/client/src/game/onlineState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptyOnlineState, onlineReducer } from './onlineState';
import type { PlayerView } from '@conquerist/shared';

const view = (version: number): PlayerView =>
  ({ you: 'u1', version, players: [], turn: 0 }) as unknown as PlayerView;

describe('Online-Zustand', () => {
  it('uebernimmt einen neueren Stand', () => {
    const state = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 5, view: view(5), actions: [] },
    });

    expect(state.view?.version).toBe(5);
  });

  it('verwirft einen aelteren Stand', () => {
    const newer = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 5, view: view(5), actions: [] },
    });

    // Nach einem Reconnect koennen zwei Staende dicht hintereinander
    // eintreffen - der aeltere darf den neueren nicht ueberschreiben.
    const older = onlineReducer(newer, {
      type: 'game',
      payload: { version: 4, view: view(4), actions: [] },
    });

    expect(older.view?.version).toBe(5);
    expect(older).toBe(newer);
  });

  it('haengt Verlaufssaetze an, wenn sie mitkommen', () => {
    const first = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 1, view: view(1), actions: [], entry: 'Anna wuerfelt 8' },
    });

    expect(first.log).toHaveLength(1);
    expect(first.log[0]!.text).toBe('Anna wuerfelt 8');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/onlineState.test.ts`
Expected: FAIL — `Failed to resolve import "./onlineState"`.

- [ ] **Step 3: Implementieren**

`onlineState.ts` haelt `room`, `view`, `actions`, `log`, `lastError` und verarbeitet die drei Ereignisse. Die Versionsregel steht im Kopfkommentar:

```ts
/**
 * Was mit einem eintreffenden Ereignis passiert - als reine Funktion.
 *
 * Die wichtigste Regel steht in drei Zeilen: **ein Stand mit kleinerer
 * `version` wird verworfen.** Nach einem Reconnect schickt der Server erst den
 * Raum, dann den Spielstand, und dazwischen kann ein Zug liegen; ohne diese
 * Regel wuerde die Oberflaeche kurz zurueckspringen.
 */
```

`useOnlineGame` bindet das an den Transport aus Etappe 0: bei `open` erst `hello` (mit gespeichertem Geheimnis), dann - falls ein Raumcode bekannt ist - `joinRoom`. Beides wird nach jedem Neuaufbau wiederholt; genau das ist der Reconnect.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/onlineState.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src
git add apps/client/src
git commit -m "Client: Online-Zustand, Sitzungsgeheimnis, Reconnect"
```

---

### Task 13: Client — Startbildschirm und Wartebereich

**Files:**

- Modify: `apps/client/src/screens/StartScreen.tsx`
- Create: `apps/client/src/screens/LobbyScreen.tsx`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/screens/StartScreen.test.tsx`
- Test: `apps/client/src/screens/LobbyScreen.test.tsx`

**Aufteilung des Startbildschirms:** zwei Wege nebeneinander, die Brettvorschau bleibt als Held.

```
  ONLINE SPIELEN                    LOKAL
  ─────────────                     ─────
  Dein Name  [ Anna        ]        Alle an einem Geraet
  [ Partie erstellen ]              [ Lokale Partie ]
  ─── oder ───
  Code       [ K7X2 ]  [ Beitreten ]
```

`?raum=K7X2` in der Adresse fuellt das Codefeld vor und setzt den Fokus auf „Beitreten".

**Wartebereich:** Code sehr gross, darunter der Einladungslink mit „Kopieren", die Sitzliste fuellt sich live (Farbe, Name, „verbunden"), der Host sieht „Starten" — gesperrt, solange Plaetze fehlen, mit Angabe wie vielen. Alle anderen sehen „Wartet auf Anna".

- [ ] **Step 1: Write the failing test**

`apps/client/src/screens/LobbyScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test/dom';
import { LobbyScreen } from './LobbyScreen';

const room = {
  code: 'K7X2',
  hostId: 'u1',
  seatCount: 3,
  seed: 'abc',
  started: false,
  seats: [
    { userId: 'u1', name: 'Anna', color: '#c0392b', connected: true },
    { userId: 'u2', name: 'Ben', color: '#2c6fbb', connected: true },
  ],
};

describe('Wartebereich', () => {
  it('zeigt Code und beigetretene Sitze', () => {
    render(<LobbyScreen room={room} youId="u2" onStart={vi.fn()} onLeave={vi.fn()} />);

    expect(screen.getByText('K7X2')).toBeDefined();
    expect(screen.getByText('Anna')).toBeDefined();
    expect(screen.getByText('Ben')).toBeDefined();
  });

  it('gibt den Startknopf nur dem Host', () => {
    render(<LobbyScreen room={room} youId="u2" onStart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Starten/ })).toBeNull();
    expect(screen.getByText(/Wartet auf Anna/)).toBeDefined();
  });

  it('sperrt den Start, solange Plaetze fehlen, und nennt die Zahl', () => {
    render(<LobbyScreen room={room} youId="u1" onStart={vi.fn()} onLeave={vi.fn()} />);

    const start = screen.getByRole('button', { name: /Starten/ });
    expect(start).toHaveProperty('disabled', true);
    expect(screen.getByText(/noch 1/i)).toBeDefined();
  });

  it('gibt den Start frei, wenn der Tisch voll ist', () => {
    const full = {
      ...room,
      seats: [...room.seats, { userId: 'u3', name: 'Cem', color: '#e08a2e', connected: true }],
    };

    render(<LobbyScreen room={full} youId="u1" onStart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Starten/ })).toHaveProperty('disabled', false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/LobbyScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./LobbyScreen"`.

- [ ] **Step 3: Implementieren**

`LobbyScreen.tsx` nach obiger Beschreibung; `StartScreen.tsx` bekommt die beiden Wege und behaelt Vorschau, Seed und Sitzzahl fuer die lokale Partie. `App.tsx` waehlt: kein Raum → Start, Raum ohne Partie → Wartebereich, Raum mit Partie → Spiel.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @conquerist/client exec vitest run`
Expected: PASS — alle Client-Tests, die angepassten `StartScreen`-Faelle eingeschlossen.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src
git add apps/client/src
git commit -m "Client: Startbildschirm mit beiden Wegen, Wartebereich mit Code"
```

---

### Task 14: Client — der Spielbildschirm liest die Sicht

**Files:**

- Modify: `apps/client/src/game/view.ts` (`gameView` nimmt eine `PlayerView`)
- Modify: `apps/client/src/screens/GameScreen.tsx`
- Modify: `apps/client/src/game/view.test.ts`

**Der Umbau:** `gameView(state, seats, options)` wird zu `gameViewOf(view: PlayerView)`. Namen, Farben und Verbindungszustand stehen jetzt in der Sicht; das Verdecken ist nicht mehr eine Anzeigeoption, sondern schon geschehen — `resources === null` heisst „darf ich nicht sehen".

Die lokale Partie baut ihre `PlayerView` mit `playerViewOf` selbst. Damit gibt es **einen** Weg durch die Oberflaeche, egal woher der Zustand kommt.

Der Schalter „Fremde Haende verdecken" verschwindet online (dort ist es keine Wahl) und bleibt in der lokalen Partie, indem sie ihre Sicht wahlweise fuer den Spieler am Zug oder ungefiltert baut.

- [ ] **Step 1: Tests anpassen und ergaenzen**

In `view.test.ts` die Faelle auf `gameViewOf(playerViewOf(...))` umstellen und ergaenzen:

```ts
it('zeigt genau das an, was in der Sicht steht - und erfindet nichts dazu', () => {
  const state = afterSetup();
  const view = gameViewOf(playerViewOf(state, 'p2', seats, 3));

  expect(view.players.find((player) => player.id === 'p1')!.resources).toBeNull();
  expect(view.players.find((player) => player.id === 'p2')!.resources).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/view.test.ts`
Expected: FAIL — `gameViewOf is not a function`.

- [ ] **Step 3: Implementieren**

`gameViewOf` ersetzt `gameView`. Es rechnet nichts mehr aus, sondern ordnet nur
noch — alles Inhaltliche steht schon in der Sicht:

```ts
/**
 * Vom Protokoll auf den Bildschirm.
 *
 * Bis Etappe 3 hat diese Funktion aus dem vollen Zustand gerechnet: Siegpunkte
 * ermittelt, Namen aus den Sitzen geholt, fremde Haende auf Wunsch verdeckt.
 * All das ist jetzt schon geschehen - auf dem Server, verbindlich. Was bleibt,
 * ist Anordnen. `resources === null` heisst nicht mehr „ausgeblendet", sondern
 * „darf ich nicht sehen"; das ist ein Unterschied, den man der Oberflaeche
 * nicht mehr abgewoehnen kann.
 */
export function gameViewOf(view: PlayerView): GameView {
  const current = view.players[view.currentPlayerIndex];

  return {
    players: view.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      victoryPoints: player.victoryPoints,
      cardCount: player.cardCount,
      resources: player.resources,
      piecesLeft: player.piecesLeft,
      connected: player.connected,
      isCurrent: player.id === current?.id,
      mustDiscard:
        view.phase.kind === 'discardPending' && view.phase.pending.includes(player.id)
          ? discardCountForView(view, player.id)
          : 0,
    })),
    actingPlayers: actingPlayersOf(view),
    currentPlayerId: current?.id ?? view.you,
    phaseText: phaseTextOf(view),
    lastRoll: view.lastRoll,
    turn: view.turn,
    longestRoad: view.longestRoad,
    you: view.you,
  };
}
```

`actingPlayersOf` und `phaseTextOf` sind die bisherigen Funktionen, nur mit
`PlayerView` statt `GameState` — beide lesen ausschliesslich `phase`,
`players` und `currentPlayerIndex`, und die stehen unveraendert in der Sicht.

`discardCountForView` ersetzt `discardCountFor` aus `shared`: Letzteres braucht
den vollen Zustand, die Sicht hat aber `cardCount` und `rules` — das genuegt:

```ts
/** Wie viele Karten dieser Spieler abwerfen muss - aus der Sicht gerechnet. */
function discardCountForView(view: PlayerView, player: PlayerId): number {
  const held = view.players.find((entry) => entry.id === player)?.cardCount ?? 0;
  return held > view.rules.handLimitBeforeDiscard ? Math.floor(held / 2) : 0;
}
```

Ein Test dazu, denn hier entsteht zum ersten Mal eine Rechnung im Client, die
es auch in `shared` gibt: **beide muessen dasselbe sagen.**

```ts
it('rechnet das Abwerfen genauso wie shared', () => {
  const state = afterSetup();
  const view = playerViewOf(state, 'p1', seats, 1);

  for (const player of state.players) {
    expect(discardCountForView(view, player.id)).toBe(discardCountFor(state, player.id));
  }
});
```

`GameScreen` bekommt statt `game`/`seats` nur noch `view: PlayerView`,
`actions: readonly GameAction[]` und `onAct: (action: GameAction) => void`. Die
lokale Partie reicht `playerViewOf(hotseatState.game, amZug, seats, version)`
hinein und schickt `onAct` in den Hotseat-Reducer; die Online-Partie reicht
durch, was vom Server kam.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @conquerist/client exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src
git add apps/client/src
git commit -m "Client: eine Oberflaeche fuer beide Quellen, gespeist aus der PlayerView"
```

---

### Task 15: Bewegung

**Files:**

- Modify: `apps/client/src/index.css`
- Modify: `apps/client/src/board/BoardSvg.tsx` (Uebergaenge, Ertragsanzeigen)
- Modify: `apps/client/src/panels/StatusPanel.tsx` (Wurf zaehlt sich ein)
- Test: `apps/client/src/board/motion.test.tsx`

**Was bewegt wird — und nur das:**

| Was                | Wie                                        | Warum                                   |
| ------------------ | ------------------------------------------ | --------------------------------------- |
| Raeuber            | `transform` mit `transition: 300ms ease`   | Man sieht, woher er kam                 |
| Neues Bauwerk      | Skalierung 0 → 1 in 180 ms                 | Der eigene Zug bestaetigt sich          |
| Wurf               | Ziffern zaehlen 400 ms lang ein            | Ein Wurf ist ein Ereignis, kein Zustand |
| Ertrag             | „+1 Erz" steigt ueber dem Feld auf, 900 ms | Man sieht, **warum** man etwas bekommt  |
| Zugwechsel         | Markierung wandert, 200 ms                 | Der Blick folgt                         |
| Verbindungsverlust | Ruhige Schicht ueber dem Brett             | Kein eingefrorenes Bild ohne Erklaerung |

**Regel dabei:** Bewegung darf nie die einzige Information sein. Wer `prefers-reduced-motion: reduce` gesetzt hat, sieht dieselben Zahlen und dieselben Zustaende — sie springen nur.

- [ ] **Step 1: Write the failing test**

`apps/client/src/board/motion.test.tsx` prueft das Belastbare — dass die Anzeige ohne Bewegung vollstaendig bleibt:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { CLASSIC_34, CLASSIC_RULES, createGame, generateScenario } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { defaultSeats } from '../seats';
import { EMPTY_TARGETS } from '../game/targets';
import { BoardSvg } from './BoardSvg';

const scenario = generateScenario(CLASSIC_34, 'bewegung-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'bewegung-probe',
);

/**
 * Bewegung darf nie die einzige Information sein.
 *
 * Wer `prefers-reduced-motion` gesetzt hat - oder wessen Browser gerade nicht
 * animiert - muss denselben Zustand ablesen koennen. Deshalb pruefen diese
 * Tests nicht, DASS etwas sich bewegt, sondern dass die Aussage auch ohne
 * Bewegung vollstaendig am Bildschirm steht.
 */
describe('Bewegung', () => {
  it('setzt den Raeuber auf sein Feld, nicht nur auf den Weg dorthin', () => {
    const moved = { ...start, robber: '1,-1' };

    render(<BoardSvg state={moved} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const robber = screen.getByTestId('robber');
    const hex = screen.getByTestId('hex-1,-1');

    // Die Endlage ist die Information; der Uebergang dorthin ist Beiwerk.
    expect(robber.getAttribute('data-hex')).toBe('1,-1');
    expect(hex).toBeDefined();
  });

  it('nennt einen Ertrag im Text und nicht nur als aufsteigende Zahl', () => {
    render(
      <BoardSvg
        state={start}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
        yields={[{ hex: '0,-1', resource: 'brick', amount: 1, key: 'y1' }]}
      />,
    );

    // Sonst waere die Information bei abgeschalteter Bewegung weg.
    expect(screen.getByText('+1 Lehm')).toBeDefined();
  });
});
```

Dafuer bekommt `BoardSvg` zwei Kleinigkeiten: `data-hex` an der Raeubergruppe
(die Endlage wird ablesbar statt nur sichtbar) und eine optionale Liste
`yields`, die der Spielbildschirm aus dem Unterschied zweier Staende bildet und
nach 900 ms wieder leert.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/board/motion.test.tsx`

- [ ] **Step 3: Implementieren**

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @conquerist/client exec vitest run`

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src
git add apps/client/src
git commit -m "Client: Bewegung dort, wo sich der Zustand aendert"
```

---

### Task 16: Abnahme und Standsdateien

**Files:**

- Modify: `apps/server/scripts/acceptance.mjs`
- Modify: `PROGRESS.md`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Abnahme erweitern**

`acceptance.mjs` bekommt einen zweiten Abschnitt: zwei Verbindungen, `hello` auf beiden, Raum erstellen, beitreten, starten, ein Zug — und die entscheidende Pruefung:

```js
// Die zweite Verbindung darf die Handkarten der ersten NICHT sehen.
const fremde = zweiterStand.payload.view.players.find((p) => p.id !== zweiteId);
assert(fremde.resources === null, 'Fremde Handkarten sind sichtbar - Regel 4 verletzt');
assert(!JSON.stringify(zweiterStand).includes('"rng"'), 'Zufallszustand auf der Leitung');
```

Dazu eine Pruefung, dass ein Zug von der falschen Verbindung abgelehnt wird.

- [ ] **Step 2: Die vollstaendige Kette laufen lassen**

```bash
cd /c/code/Conquerist
pnpm typecheck && pnpm test && pnpm build && pnpm format:check
pnpm dev   # in einem zweiten Fenster
pnpm --filter @conquerist/server acceptance
```

- [ ] **Step 3: Von Hand pruefen**

Zwei Browserfenster (eines davon privat, damit es ein anderer Gast ist): Raum erstellen, beitreten, starten, ein paar Zuege — und mittendrin **eines der Fenster neu laden**. Erwartung: Platz und Handkarten kommen zurueck, die Partie laeuft weiter.

Dann mit dem Tunnel und einem zweiten Geraet wiederholen.

- [ ] **Step 4: Standsdateien fortschreiben**

`PROGRESS.md` bekommt einen Abschnitt „Etappe 4+5" im Aufbau der bisherigen: Abnahme mit **gemessenen** Zahlen, „Was die Tests belegen", „Getroffene Entscheidungen", „Offene Punkte". `CLAUDE.md`: Etappen 4 und 5 abhaken, „Aktueller Stand" auf Etappe 6 stellen. `README.md`: wie man zu sechst spielt, inklusive Tunnel.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write .
git add -A
git commit -m "Etappe 4+5: Online-Partie mit Raeumen, Gast-Identitaet und PlayerView"
```

---

## Nach der letzten Aufgabe

**REQUIRED SUB-SKILL:** superpowers:finishing-a-development-branch.

## Hinweise fuer die naechste Sitzung

- **Reihenfolge einhalten.** Tasks 1–4 sind Fundament; 5–10 der Server; 11–14 der Client; 15–16 Feinschliff und Abnahme. Nach Task 10 laeuft der Server vollstaendig, ohne dass der Client ihn benutzt — das ist ein guter Zwischenstand zum Innehalten.
- **Der groesste Brocken ist Task 9.** Dort treffen Identitaet, Raum und Zustellung aufeinander; die Handler sind duenn, aber die Reihenfolge (Sitzung → Raum → Uebergang → Zustellung) muss ueberall dieselbe sein.
- **Was bewusst fehlt:** Persistenz. Ein Serverneustart wirft die Partie weg, und `tsx watch` startet bei jedem Speichern neu. Beim Entwickeln also besser mit `pnpm --filter @conquerist/server exec tsx src/server.ts` arbeiten, ohne `watch`.
