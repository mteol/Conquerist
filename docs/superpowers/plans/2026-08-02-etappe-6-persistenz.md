# Etappe 6 — Persistenz und „Deine Partien" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Serverneustart kostet keine Partie, und wer zurueckkommt, sieht seine Partien und geht mit einem Klick hinein.

**Architecture:** Gespeichert wird der Startzustand einer Partie plus die Folge der angenommenen Zuege; wiederhergestellt wird durch `replay`. Kein Snapshot — gemessen dauert die Wiederherstellung einer kuenstlich verlaengerten 4000-Zuege-Partie 19 ms. Die Persistenz sitzt hinter einer Schnittstelle (`RoomStore`) in der `RoomRegistry`; `rooms/room.ts` bleibt der reine Wert, der er seit Etappe 4 ist.

**Tech Stack:** TypeScript 7 (strict), Zod 4, better-sqlite3, Fastify 5, rohes `ws`, React 19, Vitest 4.

## Global Constraints

- **Die sieben Architekturregeln aus `CLAUDE.md` gelten unveraendert.** Besonders Regel 2 (reine Logik — der Zustand ist aus dem Action-Log rekonstruierbar) und Regel 4 (verdeckte Information).
- **Der Abschnitt „Design" in `CLAUDE.md` ist bindend** — erst Entwurf in drei Saetzen, dann Markup. Farben nur aus den Variablen in `index.css`, keine Hex-Werte in Komponenten.
- **`packages/shared` hat weiterhin nur `zod` als Runtime-Abhaengigkeit.** Die Persistenz ist Serversache und fasst `shared` nicht an.
- **`apps/server/src/rooms/room.ts` wird nicht veraendert.** Der Raum ist ein Wert; wer dort eine Datenbank hineinreicht, verliert die vierzehn Tests, die ohne Netz und ohne Platte laufen.
- **TypeScript strict** mit `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`.
- **Texte auf Deutsch, Code und Bezeichner auf Englisch.** Kommentare erklaeren das Warum.
- **Commit-Nachrichten auf Deutsch, ohne `Co-Authored-By`-Zeile.**
- Nach jeder Aufgabe muessen die Tests des betroffenen Pakets gruen sein; am Ende `pnpm typecheck && pnpm test && pnpm build && pnpm format:check` plus die Abnahme.
- Formatierung vor jedem Commit: `pnpm prettier --write <geaenderte Dateien>`.
- **Vorsicht:** `pnpm typecheck 2>&1 | tail` verschluckt den Exit-Code. Ohne Pipe laufen lassen, sonst rutscht ein Typfehler in den Commit.

**Spezifikation:** `docs/superpowers/specs/2026-08-02-etappe-6-persistenz-design.md` — bei Widerspruch gilt die Spezifikation.

## Dateien im Ueberblick

| Datei                                     | Verantwortung                                            |
| ----------------------------------------- | -------------------------------------------------------- |
| `apps/server/src/db/database.ts`          | Schema um `rooms`, `room_seats`, `room_actions`          |
| `apps/server/src/rooms/store.ts`          | `RoomStore`-Schnittstelle und `MemoryRoomStore`          |
| `apps/server/src/rooms/sqliteStore.ts`    | `SqliteRoomStore` — schreiben, laden, wiederherstellen   |
| `apps/server/src/rooms/registry.ts`       | bekommt den Store; `update` nimmt die ausloesende Aktion |
| `apps/server/src/rooms/summary.ts`        | `Room` → `RoomSummary` fuer die Liste                    |
| `packages/shared/src/protocol/room.ts`    | `MY_ROOMS` und `RoomSummarySchema`                       |
| `apps/server/src/ws/handlers/room.ts`     | `room.mine`, Aktion an `update` durchreichen             |
| `apps/server/src/server.ts`               | Store bauen, Registry aus ihm laden                      |
| `apps/client/src/game/useOnlineGame.ts`   | `myRooms` abrufen und halten                             |
| `apps/client/src/screens/StartScreen.tsx` | „Deine Partien" als Karten                               |

---

### Task 1: Schema fuer Raeume, Sitze und Log

**Files:**

- Modify: `apps/server/src/db/database.ts`
- Test: `apps/server/src/db/database.test.ts` (bestehend, ergaenzen)

**Interfaces:**

- Produces: drei zusaetzliche Tabellen in `migrate(database)`.

- [ ] **Step 1: Write the failing test**

In `apps/server/src/db/database.test.ts` ergaenzen:

```ts
it('legt die Tabellen fuer Raeume, Sitze und Log an', () => {
  const database = openDatabase(':memory:');

  const names = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];

  expect(names.map((row) => row.name)).toEqual(
    expect.arrayContaining(['room_actions', 'room_seats', 'rooms', 'users']),
  );
  database.close();
});

it('raeumt Sitze und Log mit, wenn ein Raum verschwindet', () => {
  const database = openDatabase(':memory:');
  database
    .prepare('INSERT INTO users (id, name, is_guest, secret_hash, created_at) VALUES (?,?,1,?,0)')
    .run('u1', 'Anna', 'hash-1');
  database
    .prepare(
      'INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at) VALUES (?,?,?,?,?,?)',
    )
    .run('K7X2', 'u1', 3, 'abc', 1, 0);
  database
    .prepare('INSERT INTO room_seats (code, position, user_id) VALUES (?,?,?)')
    .run('K7X2', 0, 'u1');
  database
    .prepare('INSERT INTO room_actions (code, ordinal, action) VALUES (?,?,?)')
    .run('K7X2', 0, '{}');

  database.prepare('DELETE FROM rooms WHERE code = ?').run('K7X2');

  // Ohne ON DELETE CASCADE bliebe Muell liegen, den niemand mehr findet.
  const seats = database.prepare('SELECT COUNT(*) AS n FROM room_seats').get() as { n: number };
  const actions = database.prepare('SELECT COUNT(*) AS n FROM room_actions').get() as { n: number };
  expect(seats.n).toBe(0);
  expect(actions.n).toBe(0);
  database.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/db/`
Expected: FAIL — `no such table: rooms`.

- [ ] **Step 3: Write minimal implementation**

In `apps/server/src/db/database.ts` den `migrate`-Rumpf um die drei Tabellen erweitern. Der bestehende `users`-Block bleibt unveraendert davor stehen:

```ts
export function migrate(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      is_guest     INTEGER NOT NULL DEFAULT 1,
      secret_hash  TEXT NOT NULL UNIQUE,
      created_at   INTEGER NOT NULL
    );

    /*
     * Ein Raum. Der Spielzustand steht NICHT hier, sondern folgt aus
     * start_state plus room_actions - das ist die Entscheidung dieser Etappe.
     * version wird mitgespeichert, weil der Client kleinere Versionen verwirft:
     * finge sie nach einem Neustart wieder bei 1 an, ignorierte jeder noch
     * offene Browser den frischen Stand.
     */
    CREATE TABLE IF NOT EXISTS rooms (
      code         TEXT PRIMARY KEY,
      host_id      TEXT NOT NULL REFERENCES users(id),
      seat_count   INTEGER NOT NULL,
      seed         TEXT NOT NULL,
      version      INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      start_state  TEXT,
      finished_at  INTEGER
    );

    /*
     * Kein name und kein color: der Name steht in users, die Farbe folgt aus
     * der Position. Beides hier zu wiederholen waere die zweite Wahrheit.
     */
    CREATE TABLE IF NOT EXISTS room_seats (
      code      TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      position  INTEGER NOT NULL,
      user_id   TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (code, position)
    );

    CREATE TABLE IF NOT EXISTS room_actions (
      code     TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      ordinal  INTEGER NOT NULL,
      action   TEXT NOT NULL,
      PRIMARY KEY (code, ordinal)
    );
  `);
}
```

`ON DELETE CASCADE` wirkt nur, weil `openDatabase` beim Oeffnen `foreign_keys = ON` setzt — das steht dort seit Etappe 4 und ist genau dafuer da.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run src/db/`
Expected: PASS, 4 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src/db
git add apps/server/src/db
git commit -m "Schema fuer Raeume, Sitze und Action-Log"
```

---

### Task 2: `RoomStore` und die Attrappe fuer Tests

**Files:**

- Create: `apps/server/src/rooms/store.ts`
- Test: `apps/server/src/rooms/store.test.ts`

**Interfaces:**

- Consumes: `Room` und `GameAction`.
- Produces: `interface RoomStore { save(room); appendAction(code, action); remove(code); loadAll() }` und `class MemoryRoomStore implements RoomStore`.

**Warum eine Attrappe:** Die Registry-Tests aus Etappe 4 laufen ohne Datei und sollen es bleiben. Ausserdem beweist eine zweite Umsetzung, dass die Schnittstelle wirklich eine ist und nicht bloss die SQLite-Aufrufe umbenennt.

- [ ] **Step 1: Write the failing test**

`apps/server/src/rooms/store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GameAction } from '@conquerist/shared';
import { MemoryRoomStore } from './store.js';
import { createRoom, joinRoom, type Room } from './room.js';

function room(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'store-probe');
  if (!created.ok) throw new Error(created.error);
  return created.room;
}

const roll: GameAction = { type: 'rollDice', player: 'u1' };

describe('MemoryRoomStore', () => {
  it('gibt zurueck, was hineingelegt wurde', () => {
    const store = new MemoryRoomStore();
    store.save(room());

    expect(store.loadAll().map((entry) => entry.code)).toEqual(['K7X2']);
  });

  it('ersetzt einen Raum, statt ihn ein zweites Mal abzulegen', () => {
    const store = new MemoryRoomStore();
    const first = room();
    store.save(first);

    const joined = joinRoom(first, 'u2', 'Ben');
    if (!joined.ok) throw new Error(joined.error);
    store.save(joined.room);

    expect(store.loadAll()).toHaveLength(1);
    expect(store.loadAll()[0]!.seats).toHaveLength(2);
  });

  it('haelt die Zuege in der Reihenfolge, in der sie kamen', () => {
    const store = new MemoryRoomStore();
    store.save(room());
    store.appendAction('K7X2', roll);
    store.appendAction('K7X2', { type: 'endTurn', player: 'u1' });

    expect(store.actionsOf('K7X2').map((action) => action.type)).toEqual(['rollDice', 'endTurn']);
  });

  it('nimmt mit dem Raum auch sein Log weg', () => {
    const store = new MemoryRoomStore();
    store.save(room());
    store.appendAction('K7X2', roll);

    store.remove('K7X2');

    expect(store.loadAll()).toEqual([]);
    expect(store.actionsOf('K7X2')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/store.test.ts`
Expected: FAIL — `Cannot find module './store.js'`.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/rooms/store.ts`:

```ts
import type { GameAction } from '@conquerist/shared';
import type { Room } from './room.js';

/**
 * Wo Raeume liegen, wenn der Prozess nicht mehr laeuft.
 *
 * Eine Schnittstelle und nicht gleich SQLite, aus zwei Gruenden: die
 * Registry-Tests aus Etappe 4 sollen weiter ohne Datei laufen, und eine zweite
 * Umsetzung beweist, dass hier wirklich eine Grenze ist - eine Schnittstelle
 * mit genau einem Implementierer ist meist nur ein umbenannter Aufruf.
 *
 * Was NICHT darin steht: eine laufende Nummer fuer das Log (die weiss der Store
 * besser als sein Aufrufer) und eine Abfrage „in welchen Raeumen sitzt X" (nach
 * `loadAll` liegt alles ohnehin im Speicher).
 */
export interface RoomStore {
  /** Legt den Raum ab oder ersetzt ihn. */
  save(room: Room): void;
  /** Haengt einen angenommenen Zug an das Log dieses Raums. */
  appendAction(code: string, action: GameAction): void;
  remove(code: string): void;
  /** Alle Raeume, jeder mit wiederhergestellter Partie. */
  loadAll(): Room[];
}

/** Fuer Tests, die keine Datei wollen. */
export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();
  private readonly actions = new Map<string, GameAction[]>();

  save(room: Room): void {
    this.rooms.set(room.code, room);
  }

  appendAction(code: string, action: GameAction): void {
    const log = this.actions.get(code);
    if (log === undefined) this.actions.set(code, [action]);
    else log.push(action);
  }

  remove(code: string): void {
    this.rooms.delete(code);
    this.actions.delete(code);
  }

  loadAll(): Room[] {
    return [...this.rooms.values()];
  }

  /** Nur fuer Tests - die Schnittstelle kennt das Log nicht von aussen. */
  actionsOf(code: string): readonly GameAction[] {
    return this.actions.get(code) ?? [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/store.test.ts`
Expected: PASS, 4 Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src/rooms
git add apps/server/src/rooms
git commit -m "RoomStore als Schnittstelle, mit Attrappe fuer Tests"
```

---

### Task 3: `SqliteRoomStore` — schreiben und wiederherstellen

Die Aufgabe, in der die Etappe steht oder faellt.

**Files:**

- Create: `apps/server/src/rooms/sqliteStore.ts`
- Test: `apps/server/src/rooms/sqliteStore.test.ts`

**Interfaces:**

- Consumes: `AppDatabase`, `RoomStore`, `Room`, `RoomSeat`, `replay`, `GameStateSchema`, `GameActionSchema`, `seatColorAt`.
- Produces: `class SqliteRoomStore implements RoomStore`, Konstruktor `(database: AppDatabase, log?: (message: string, detail: unknown) => void)`.

- [ ] **Step 1: Write the failing test**

`apps/server/src/rooms/sqliteStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { legalActions, setupPlayer } from '@conquerist/shared';
import { openDatabase } from '../db/database.js';
import { Users } from '../identity/users.js';
import { SqliteRoomStore } from './sqliteStore.js';
import { applyAction, createRoom, joinRoom, startGame, type Room } from './room.js';

/** Drei Gaeste anlegen und ihre Ids zurueckgeben - rooms verweist auf users. */
function withUsers(): { store: SqliteRoomStore; ids: string[] } {
  const database = openDatabase(':memory:');
  const users = new Users(database);
  const ids = ['Anna', 'Ben', 'Cem'].map((name) => users.hello(undefined, name).user.id);
  return { store: new SqliteRoomStore(database), ids };
}

function waitingRoom(ids: readonly string[]): Room {
  const created = createRoom('K7X2', ids[0]!, 'Anna', 3, 'platte-probe');
  if (!created.ok) throw new Error(created.error);

  let room = created.room;
  for (const [index, name] of [
    [1, 'Ben'],
    [2, 'Cem'],
  ] as const) {
    const joined = joinRoom(room, ids[index]!, name);
    if (!joined.ok) throw new Error(joined.error);
    room = joined.room;
  }
  return room;
}

describe('SqliteRoomStore', () => {
  it('bringt einen Wartebereich unveraendert zurueck', () => {
    const { store, ids } = withUsers();
    const room = waitingRoom(ids);
    store.save(room);

    const [loaded] = store.loadAll();

    expect(loaded?.code).toBe('K7X2');
    expect(loaded?.seatCount).toBe(3);
    expect(loaded?.seed).toBe('platte-probe');
    expect(loaded?.game).toBeNull();
    expect(loaded?.seats.map((seat) => seat.name)).toEqual(['Anna', 'Ben', 'Cem']);
  });

  it('fuehrt einen geladenen Raum als getrennt', () => {
    const { store, ids } = withUsers();
    store.save(waitingRoom(ids));

    // Verbunden zu sein gehoert diesem Serverlauf, nicht der Partie.
    expect(store.loadAll()[0]!.seats.every((seat) => !seat.connected)).toBe(true);
  });

  it('stellt eine laufende Partie Zug fuer Zug wieder her - samt Zufallszustand', () => {
    const { store, ids } = withUsers();
    const started = startGame(waitingRoom(ids), ids[0]!);
    if (!started.ok) throw new Error(started.error);

    let room = started.room;
    store.save(room);

    for (let step = 0; step < 6; step += 1) {
      const player = setupPlayer(room.game!)!;
      const action = legalActions(room.game!, player)[0]!;
      const acted = applyAction(room, player, action);
      if (!acted.ok) throw new Error(acted.error);
      room = acted.room;
      store.save(room);
      store.appendAction(room.code, action);
    }

    const [loaded] = store.loadAll();

    // Der Zufallszustand muss mitkommen, sonst wuerfelt die Partie nach einem
    // Neustart anders weiter als vorher - und das faellt erst spaeter auf.
    expect(loaded?.game).toEqual(room.game);
    expect(loaded?.version).toBe(room.version);
  });

  it('ueberspringt einen Raum, dessen Log nicht mehr passt, und laesst die anderen stehen', () => {
    const { store, ids } = withUsers();
    const started = startGame(waitingRoom(ids), ids[0]!);
    if (!started.ok) throw new Error(started.error);
    store.save(started.room);
    // Ein Zug, den es in dieser Lage nicht geben kann.
    store.appendAction('K7X2', { type: 'endTurn', player: ids[0]! });

    const heil = createRoom('M8Y3', ids[0]!, 'Anna', 3, 'heil');
    if (!heil.ok) throw new Error(heil.error);
    store.save(heil.room);

    const loaded = store.loadAll();

    // Eine kaputte Partie darf die anderen nicht mitnehmen.
    expect(loaded.map((entry) => entry.code)).toEqual(['M8Y3']);
  });

  it('nimmt mit dem Raum auch Sitze und Log weg', () => {
    const { store, ids } = withUsers();
    store.save(waitingRoom(ids));
    store.remove('K7X2');

    expect(store.loadAll()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/sqliteStore.test.ts`
Expected: FAIL — `Cannot find module './sqliteStore.js'`.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/rooms/sqliteStore.ts`:

```ts
import {
  GameActionSchema,
  GameStateSchema,
  replay,
  seatColorAt,
  type GameAction,
  type GameState,
} from '@conquerist/shared';
import type { AppDatabase } from '../db/database.js';
import type { Room, RoomSeat } from './room.js';
import type { RoomStore } from './store.js';

/**
 * Raeume in SQLite.
 *
 * Gespeichert wird der Startzustand plus die Folge der angenommenen Zuege;
 * wiederhergestellt wird durch `replay`. Kein Snapshot: gemessen dauert die
 * Wiederherstellung einer kuenstlich verlaengerten Partie mit 4000 Zuegen
 * 19 ms, und ein Snapshot waere eine zweite Darstellung desselben
 * Sachverhalts - eine, die von der ersten abweichen kann.
 *
 * Der Startzustand geht als Ganzes auf die Platte und nicht nur als Seed: ein
 * `GameState` traegt Szenario und RuleSet als Kopie in sich, und damit spielt
 * eine alte Partie auch nach einer Aenderung an `CLASSIC_RULES` unter den
 * Regeln weiter, unter denen sie begonnen hat.
 */
interface RoomRow {
  readonly code: string;
  readonly host_id: string;
  readonly seat_count: number;
  readonly seed: string;
  readonly version: number;
  readonly created_at: number;
  readonly start_state: string | null;
}

interface SeatRow {
  readonly position: number;
  readonly user_id: string;
  readonly name: string;
}

export class SqliteRoomStore implements RoomStore {
  constructor(
    private readonly database: AppDatabase,
    /** Wird gerufen, wenn ein Raum beim Laden uebersprungen wird. */
    private readonly log: (message: string, detail: unknown) => void = () => undefined,
  ) {}

  save(room: Room): void {
    const finishedAt = room.game?.phase.kind === 'finished' ? Date.now() : null;

    const write = this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at, start_state, finished_at)
           VALUES (@code, @hostId, @seatCount, @seed, @version, @createdAt, @startState, @finishedAt)
           ON CONFLICT(code) DO UPDATE SET
             host_id = @hostId, seat_count = @seatCount, seed = @seed,
             version = @version, finished_at = @finishedAt,
             -- Der Startzustand wird nie ueberschrieben: er entsteht einmal
             -- beim Start und ist danach der Anker fuer das ganze Log.
             start_state = COALESCE(rooms.start_state, @startState)`,
        )
        .run({
          code: room.code,
          hostId: room.hostId,
          seatCount: room.seatCount,
          seed: room.seed,
          version: room.version,
          createdAt: room.createdAt,
          startState: this.startStateFor(room),
          finishedAt,
        });

      this.database.prepare('DELETE FROM room_seats WHERE code = ?').run(room.code);
      const seat = this.database.prepare(
        'INSERT INTO room_seats (code, position, user_id) VALUES (?, ?, ?)',
      );
      room.seats.forEach((entry, position) => {
        seat.run(room.code, position, entry.userId);
      });
    });

    write();
  }

  appendAction(code: string, action: GameAction): void {
    this.database
      .prepare(
        `INSERT INTO room_actions (code, ordinal, action)
         VALUES (?, (SELECT COALESCE(MAX(ordinal) + 1, 0) FROM room_actions WHERE code = ?), ?)`,
      )
      .run(code, code, JSON.stringify(action));
  }

  remove(code: string): void {
    this.database.prepare('DELETE FROM rooms WHERE code = ?').run(code);
  }

  loadAll(): Room[] {
    const rows = this.database
      .prepare('SELECT * FROM rooms ORDER BY created_at')
      .all() as RoomRow[];

    const rooms: Room[] = [];
    for (const row of rows) {
      const room = this.rebuild(row);
      if (room !== null) rooms.push(room);
    }
    return rooms;
  }

  /**
   * Der Startzustand einer Partie.
   *
   * Er wird aus dem *aktuellen* Zustand nicht ableitbar - deshalb schreibt ihn
   * `save` nur, solange die Datenbank noch keinen hat, und `startGame` ist der
   * erste Aufruf nach dem Start. Vorher ist er `null`.
   */
  private startStateFor(room: Room): string | null {
    return room.game === null ? null : JSON.stringify(room.game);
  }

  /** Ein Raum aus seiner Zeile - oder `null`, wenn er sich nicht bauen laesst. */
  private rebuild(row: RoomRow): Room | null {
    const seatRows = this.database
      .prepare(
        `SELECT s.position, s.user_id, u.name
         FROM room_seats s JOIN users u ON u.id = s.user_id
         WHERE s.code = ? ORDER BY s.position`,
      )
      .all(row.code) as SeatRow[];

    const seats: RoomSeat[] = seatRows.map((entry, index) => ({
      userId: entry.user_id,
      name: entry.name,
      color: seatColorAt(index),
      // Verbunden ist eine Eigenschaft dieses Serverlaufs. Nach einem Neustart
      // ist niemand verbunden, bis er sich meldet.
      connected: false,
    }));

    let game: GameState | null = null;
    if (row.start_state !== null) {
      const rebuilt = this.rebuildGame(row.code, row.start_state);
      if (rebuilt === null) return null;
      game = rebuilt;
    }

    return {
      code: row.code,
      hostId: row.host_id,
      seatCount: row.seat_count,
      seed: row.seed,
      seats,
      game,
      version: row.version,
      createdAt: row.created_at,
    };
  }

  private rebuildGame(code: string, startState: string): GameState | null {
    const start = GameStateSchema.safeParse(JSON.parse(startState));
    if (!start.success) {
      this.log('Startzustand passt nicht mehr zum Schema', { code });
      return null;
    }

    const rows = this.database
      .prepare('SELECT action FROM room_actions WHERE code = ? ORDER BY ordinal')
      .all(code) as { action: string }[];

    const actions: GameAction[] = [];
    for (const entry of rows) {
      const parsed = GameActionSchema.safeParse(JSON.parse(entry.action));
      if (!parsed.success) {
        this.log('Zug im Log passt nicht mehr zum Schema', { code });
        return null;
      }
      actions.push(parsed.data);
    }

    const result = replay(start.data, actions);
    if (!result.ok) {
      // Uebersprungen statt geworfen: eine kaputte Partie darf nicht alle
      // anderen mitnehmen. Sie bleibt in der Datenbank und laesst sich ansehen.
      this.log('Partie laesst sich nicht wiederherstellen', { code, error: result.error.message });
      return null;
    }

    return result.state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/`
Expected: PASS — 6 neue plus die 20 bestehenden Raum- und Zustellungstests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src/rooms
git add apps/server/src/rooms
git commit -m "Raeume in SQLite: Startzustand plus Log, wiederhergestellt per replay"
```

---

### Task 4: Die Registry schreibt mit

**Files:**

- Modify: `apps/server/src/rooms/registry.ts`
- Modify: `apps/server/src/rooms/registry.test.ts`

**Interfaces:**

- Consumes: `RoomStore`, `MemoryRoomStore`.
- Produces: `RegistryOptions` bekommt `store?: RoomStore`; `update(code, next, appended?)`; `roomsOf(userId): readonly Room[]`; `RoomRegistry.load(store, options?)` als statische Fabrik.

- [ ] **Step 1: Write the failing test**

In `apps/server/src/rooms/registry.test.ts` ergaenzen:

```ts
it('legt jeden Raum im Store ab', () => {
  const store = new MemoryRoomStore();
  const registry = new RoomRegistry({ store });
  const created = registry.create('u1', 'Anna', 3, 'abc');
  if (!created.ok) throw new Error(created.error);

  expect(store.loadAll().map((room) => room.code)).toEqual([created.room.code]);
});

it('schreibt den ausloesenden Zug ins Log, aber nur wenn es einen gab', () => {
  const store = new MemoryRoomStore();
  const registry = new RoomRegistry({ store });
  const created = registry.create('u1', 'Anna', 3, 'abc');
  if (!created.ok) throw new Error(created.error);
  const code = created.room.code;

  registry.update(code, { ...created.room, version: 2 });
  expect(store.actionsOf(code)).toHaveLength(0);

  registry.update(code, { ...created.room, version: 3 }, { type: 'rollDice', player: 'u1' });
  expect(store.actionsOf(code)).toHaveLength(1);
});

it('nimmt einen weggeraeumten Raum auch aus dem Store', () => {
  const store = new MemoryRoomStore();
  const registry = new RoomRegistry({ store, now: () => 0 });
  const created = registry.create('u1', 'Anna', 3, 'abc');
  if (!created.ok) throw new Error(created.error);

  registry.update(created.room.code, { ...created.room, seats: [] });
  registry.remove(created.room.code);

  expect(store.loadAll()).toEqual([]);
});

it('baut sich aus einem Store wieder auf', () => {
  const store = new MemoryRoomStore();
  const first = new RoomRegistry({ store });
  const created = first.create('u1', 'Anna', 3, 'abc');
  if (!created.ok) throw new Error(created.error);

  const second = RoomRegistry.load(store);

  expect(second.get(created.room.code)?.seed).toBe('abc');
});

it('findet alle Raeume, in denen jemand sitzt', () => {
  const registry = new RoomRegistry();
  const first = registry.create('u1', 'Anna', 3, 'abc');
  const second = registry.create('u1', 'Anna', 4, 'def');
  if (!first.ok || !second.ok) throw new Error('Anlegen fehlgeschlagen');

  expect(registry.roomsOf('u1')).toHaveLength(2);
  expect(registry.roomsOf('u9')).toHaveLength(0);
});
```

Den Import in derselben Datei ergaenzen: `import { MemoryRoomStore } from './store.js';`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/registry.test.ts`
Expected: FAIL — `store` ist keine bekannte Option, `roomsOf` und `RoomRegistry.load` gibt es nicht.

- [ ] **Step 3: Write minimal implementation**

In `apps/server/src/rooms/registry.ts`:

```ts
export interface RegistryOptions {
  readonly randomCode?: () => string;
  readonly now?: () => number;
  /**
   * Wohin Raeume geschrieben werden. Ohne Store laeuft alles wie vor Etappe 6
   * rein im Speicher - genau das brauchen die Tests, die keine Datei wollen.
   */
  readonly store?: RoomStore;
}
```

Im Rumpf der Klasse `private readonly store: RoomStore | undefined;` ergaenzen und im Konstruktor `this.store = options.store;` setzen.

`create` schreibt nach dem Ablegen mit:

```ts
const created = createRoom(code, hostId, hostName, seatCount, seed, this.now());
if (created.ok) {
  this.rooms.set(code, created.room);
  this.store?.save(created.room);
}
return created;
```

`update` bekommt das dritte Argument:

```ts
  /**
   * Ein Raum hat sich geaendert - und `appended` ist der Zug, der es ausgeloest
   * hat, falls es einer war. Beitritt, Umstellen und Verlassen kommen ohne.
   *
   * Ein Schreibfehler wirft hier nicht: der Zug ist bereits regelgerecht
   * angenommen, und ihn nachtraeglich am Plattenzustand scheitern zu lassen
   * hiesse, dass dieselbe Aktion mal gilt und mal nicht.
   */
  update(code: string, next: Room, appended?: GameAction): void {
    if (!this.rooms.has(code)) return;
    this.rooms.set(code, next);

    try {
      this.store?.save(next);
      if (appended !== undefined) this.store?.appendAction(code, appended);
    } catch (error) {
      this.onWriteError(code, error);
    }
  }
```

`remove` ergaenzt `this.store?.remove(code);`, und `sweep` benutzt weiterhin `this.rooms.delete` — dort stattdessen `this.remove(code)` aufrufen, damit auch die Platte aufgeraeumt wird. Achtung: nicht waehrend der Iteration ueber `this.rooms` loeschen, sondern erst sammeln:

```ts
  sweep(): void {
    const deadline = this.now() - EMPTY_ROOM_TTL_MS;
    const gone = [...this.rooms.values()]
      .filter((room) => room.seats.length === 0 && room.createdAt <= deadline)
      .map((room) => room.code);

    for (const code of gone) this.remove(code);
  }
```

Dazu die zwei neuen Auskuenfte:

```ts
  /** Alle Raeume, in denen dieser Spieler sitzt. */
  roomsOf(userId: string): readonly Room[] {
    return [...this.rooms.values()].filter((room) =>
      room.seats.some((seat) => seat.userId === userId),
    );
  }

  /** Eine Registry aus dem, was auf der Platte liegt. */
  static load(store: RoomStore, options: RegistryOptions = {}): RoomRegistry {
    const registry = new RoomRegistry({ ...options, store });
    for (const room of store.loadAll()) registry.rooms.set(room.code, room);
    return registry;
  }
```

Und ein Fehlerhaken in den Optionen, damit der Server ihn protokollieren kann:

```ts
  readonly onWriteError?: (code: string, error: unknown) => void;
```

im Interface, im Konstruktor `this.onWriteError = options.onWriteError ?? (() => undefined);` mit dem Feld
`private readonly onWriteError: (code: string, error: unknown) => void;`.

`roomOf` bleibt unveraendert — es liefert weiter den ersten Treffer und wird von `hello` benutzt.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/`
Expected: PASS — 5 neue plus alle bestehenden.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src/rooms
git add apps/server/src/rooms
git commit -m "Die Registry schreibt mit: was im Speicher liegt, liegt auf der Platte"
```

---

### Task 5: Protokoll — „Deine Partien"

**Files:**

- Modify: `packages/shared/src/protocol/room.ts`
- Modify: `packages/shared/src/protocol/registry.ts`
- Test: `packages/shared/src/protocol/room.test.ts` (bestehend, ergaenzen)

**Interfaces:**

- Produces: `MY_ROOMS`, `MY_ROOMS_OK`, `RoomSummarySchema`, `MyRoomsResponseSchema`, `type RoomSummary`.

- [ ] **Step 1: Write the failing test**

In `packages/shared/src/protocol/room.test.ts` ergaenzen:

```ts
it('beschreibt eine Partie in der Liste vollstaendig', () => {
  const entry = protocolEntry(MY_ROOMS);

  expect(
    entry.response.safeParse({
      rooms: [
        {
          code: 'K7X2',
          seatCount: 3,
          started: true,
          turn: 4,
          yourTurn: true,
          seats: [{ name: 'Anna', color: '#c0392b', connected: false }],
        },
      ],
    }).success,
  ).toBe(true);

  // `turn` und `yourTurn` gehoeren zu einer laufenden Partie und fehlen sonst.
  expect(
    entry.response.safeParse({
      rooms: [{ code: 'K7X2', seatCount: 3, started: false, seats: [] }],
    }).success,
  ).toBe(true);
});
```

Den Import oben ergaenzen: `MY_ROOMS` aus `./room.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/protocol/`
Expected: FAIL — `MY_ROOMS` ist nicht exportiert.

- [ ] **Step 3: Write minimal implementation**

In `packages/shared/src/protocol/room.ts` ergaenzen:

```ts
export const MY_ROOMS = 'room.mine';
export const MY_ROOMS_OK = 'room.mine.ok';

/**
 * Eine Partie, wie sie auf einer Karte am Startbildschirm steht.
 *
 * Bewusst kein Spielzustand: die Liste soll zeigen, wo man weitermachen kann,
 * nicht die Partie vorwegnehmen. Wer hineingeht, bekommt seine `PlayerView`
 * wie immer - gefiltert, und nicht aus dieser Zusammenfassung.
 */
export const RoomSummarySchema = z.object({
  code: RoomCodeSchema,
  seatCount: z.number().int().min(MIN_SEATS).max(MAX_SEATS),
  started: z.boolean(),
  seats: z.array(
    z.object({
      name: DisplayNameSchema,
      color: z.string().min(1),
      connected: z.boolean(),
    }),
  ),
  /** Nur bei laufenden Partien. */
  turn: z.number().int().min(0).optional(),
  yourTurn: z.boolean().optional(),
});

export const MyRoomsResponseSchema = z.object({ rooms: z.array(RoomSummarySchema) });

export type RoomSummary = z.infer<typeof RoomSummarySchema>;
```

In `packages/shared/src/protocol/registry.ts` den Eintrag ergaenzen (und die Importliste mitziehen):

```ts
  [MY_ROOMS]: {
    responseType: MY_ROOMS_OK,
    request: EmptyRequestSchema,
    response: MyRoomsResponseSchema,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/protocol/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write packages/shared/src/protocol
git add packages/shared/src/protocol
git commit -m "Protokoll: die eigenen Partien abfragen"
```

---

### Task 6: Zusammenfassung und Handler

**Files:**

- Create: `apps/server/src/rooms/summary.ts`
- Test: `apps/server/src/rooms/summary.test.ts`
- Modify: `apps/server/src/ws/handlers/room.ts`

**Interfaces:**

- Consumes: `Room`, `RoomSummary`, `actingPlayerOf` (neu, siehe unten).
- Produces: `summaryOf(room: Room, viewer: string): RoomSummary`.

- [ ] **Step 1: Write the failing test**

`apps/server/src/rooms/summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRoom, joinRoom, startGame, type Room } from './room.js';
import { summaryOf } from './summary.js';

function full(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'liste-probe');
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
  return room;
}

describe('Zusammenfassung', () => {
  it('nennt den Wartebereich ungestartet und laesst die Runde weg', () => {
    const summary = summaryOf(full(), 'u2');

    expect(summary.started).toBe(false);
    expect(summary.turn).toBeUndefined();
    expect(summary.yourTurn).toBeUndefined();
    expect(summary.seats.map((seat) => seat.name)).toEqual(['Anna', 'Ben', 'Cem']);
  });

  it('sagt bei einer laufenden Partie, wer dran ist', () => {
    const started = startGame(full(), 'u1');
    if (!started.ok) throw new Error(started.error);

    // In der Gruendung setzt der erste Spieler zuerst.
    expect(summaryOf(started.room, 'u1').yourTurn).toBe(true);
    expect(summaryOf(started.room, 'u2').yourTurn).toBe(false);
    expect(summaryOf(started.room, 'u1').turn).toBe(0);
  });

  it('traegt keine Handkarten und keinen Zufallszustand hinaus', () => {
    const started = startGame(full(), 'u1');
    if (!started.ok) throw new Error(started.error);

    const text = JSON.stringify(summaryOf(started.room, 'u1'));
    expect(text).not.toContain('rng');
    expect(text).not.toContain('resources');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/summary.test.ts`
Expected: FAIL — `Cannot find module './summary.js'`.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/rooms/summary.ts`:

```ts
import { legalActions, type RoomSummary } from '@conquerist/shared';
import type { Room } from './room.js';

/**
 * Ein Raum, wie er auf einer Karte am Startbildschirm steht.
 *
 * Bewusst duenn: die Liste soll zeigen, wo man weitermachen kann. Handkarten,
 * Bauwerke und der Zufallszustand haben hier nichts verloren - wer hineingeht,
 * bekommt seine gefilterte `PlayerView` wie immer. Regel 4 gilt auch fuer eine
 * Uebersicht.
 *
 * `yourTurn` wird aus `legalActions` gelesen und nicht aus `currentPlayerIndex`:
 * in der Gruendungsphase folgt der Zug der Schlange, nach einer Sieben duerfen
 * mehrere handeln. Es gibt genau eine Stelle, die das weiss.
 */
export function summaryOf(room: Room, viewer: string): RoomSummary {
  const seats = room.seats.map((seat) => ({
    name: seat.name,
    color: seat.color,
    connected: seat.connected,
  }));

  const game = room.game;
  if (game === null) {
    return { code: room.code, seatCount: room.seatCount, started: false, seats };
  }

  return {
    code: room.code,
    seatCount: room.seatCount,
    started: true,
    seats,
    turn: game.turn,
    yourTurn: legalActions(game, viewer).length > 0,
  };
}
```

In `apps/server/src/ws/handlers/room.ts` den Handler ergaenzen (Importe `MY_ROOMS` aus `@conquerist/shared` und `summaryOf` aus `../../rooms/summary.js` mitziehen):

```ts
router.register(MY_ROOMS, (_payload, context) => {
  const user = requireUser(context, users);

  return {
    rooms: registry
      .roomsOf(user.id)
      // Beendete Partien fallen aus der Liste - sie bleiben in der
      // Datenbank, aber niemand kann dort weitermachen.
      .filter((room) => room.game?.phase.kind !== 'finished')
      .map((room) => summaryOf(room, user.id)),
  };
});
```

Im `ACT`-Handler die Aktion an die Registry durchreichen — die Zeile

```ts
registry.update(acted.room.code, acted.room);
```

wird zu

```ts
registry.update(acted.room.code, acted.room, payload.action);
```

Und im `HELLO`-Handler den Reconnect an mehrere Raeume anpassen. Bisher steht
dort `registry.roomOf(...)`, was den ersten Treffer nimmt. Mit Persistenz sitzt
jemand plausibel in zweien — einem Wartebereich und einer laufenden Partie —,
und dann waere „der erste" eine Willkuer. Der Block

```ts
    const existing = registry.roomOf(result.user.id);
    if (existing !== undefined) {
```

wird zu

```ts
    /*
     * Sitzt der Nutzer in genau einem Raum, wird der geoeffnet - das ist der
     * haeufige Fall und der Reconnect aus Etappe 5. Sitzt er in mehreren,
     * oeffnet der Server KEINEN: welcher gemeint ist, weiss nur er selbst, und
     * die Liste auf dem Startbildschirm fragt ihn.
     */
    const mine = registry.roomsOf(result.user.id);
    const existing = mine.length === 1 ? mine[0] : undefined;
    if (existing !== undefined) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server exec vitest run`
Expected: PASS — alle Servertests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src
git add apps/server/src
git commit -m "Server: die eigenen Partien auflisten, Zuege ins Log durchreichen"
```

---

### Task 7: Der Server laedt beim Start

**Files:**

- Modify: `apps/server/src/server.ts`
- Test: `apps/server/src/rooms/roundtrip.test.ts`

**Interfaces:**

- Consumes: `SqliteRoomStore`, `RoomRegistry.load`.

**Der Test dieser Aufgabe ist die Etappe in einem Test:** eine Partie anlegen, spielen, die Registry wegwerfen und aus derselben Datei neu bauen.

- [ ] **Step 1: Write the failing test**

`apps/server/src/rooms/roundtrip.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { legalActions, setupPlayer } from '@conquerist/shared';
import { openDatabase } from '../db/database.js';
import { Users } from '../identity/users.js';
import { RoomRegistry } from './registry.js';
import { SqliteRoomStore } from './sqliteStore.js';
import { applyAction, joinRoom, startGame } from './room.js';

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function file(): string {
  const base = mkdtempSync(join(tmpdir(), 'conquerist-rt-'));
  dirs.push(base);
  return join(base, 'conquerist.db');
}

describe('Ein Neustart kostet keine Partie', () => {
  it('bringt eine laufende Partie unveraendert zurueck', () => {
    const path = file();

    // --- Erster Serverlauf -------------------------------------------------
    const firstDb = openDatabase(path);
    const users = new Users(firstDb);
    const ids = ['Anna', 'Ben', 'Cem'].map((name) => users.hello(undefined, name).user.id);
    const first = new RoomRegistry({ store: new SqliteRoomStore(firstDb) });

    const created = first.create(ids[0]!, 'Anna', 3, 'neustart');
    if (!created.ok) throw new Error(created.error);
    const code = created.room.code;

    let room = created.room;
    for (const [index, name] of [
      [1, 'Ben'],
      [2, 'Cem'],
    ] as const) {
      const joined = joinRoom(room, ids[index]!, name);
      if (!joined.ok) throw new Error(joined.error);
      room = joined.room;
      first.update(code, room);
    }

    const started = startGame(room, ids[0]!);
    if (!started.ok) throw new Error(started.error);
    room = started.room;
    first.update(code, room);

    for (let step = 0; step < 6; step += 1) {
      const player = setupPlayer(room.game!)!;
      const action = legalActions(room.game!, player)[0]!;
      const acted = applyAction(room, player, action);
      if (!acted.ok) throw new Error(acted.error);
      room = acted.room;
      first.update(code, room, action);
    }
    firstDb.close();

    // --- Zweiter Serverlauf ------------------------------------------------
    const secondDb = openDatabase(path);
    const second = RoomRegistry.load(new SqliteRoomStore(secondDb));
    const loaded = second.get(code);

    // Der Zufallszustand muss mitkommen: ohne ihn wuerfelt die Partie nach dem
    // Neustart anders weiter, und das faellt erst Runden spaeter auf.
    expect(loaded?.game).toEqual(room.game);
    expect(loaded?.version).toBe(room.version);
    expect(loaded?.seats.map((seat) => seat.name)).toEqual(['Anna', 'Ben', 'Cem']);
    // Niemand ist verbunden, bis er sich meldet.
    expect(loaded?.seats.every((seat) => !seat.connected)).toBe(true);
    secondDb.close();
  });

  it('bringt auch einen Wartebereich zurueck', () => {
    const path = file();

    const firstDb = openDatabase(path);
    const users = new Users(firstDb);
    const id = users.hello(undefined, 'Anna').user.id;
    const first = new RoomRegistry({ store: new SqliteRoomStore(firstDb) });
    const created = first.create(id, 'Anna', 4, 'wartend');
    if (!created.ok) throw new Error(created.error);
    firstDb.close();

    const secondDb = openDatabase(path);
    const second = RoomRegistry.load(new SqliteRoomStore(secondDb));

    expect(second.get(created.room.code)?.seatCount).toBe(4);
    expect(second.get(created.room.code)?.game).toBeNull();
    secondDb.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/roundtrip.test.ts`
Expected: FAIL, solange Task 3 und 4 nicht stehen; danach PASS. Laeuft dieser Test schon gruen, ist er trotzdem der Beleg fuer die Etappe — dann weiter zu Step 3.

- [ ] **Step 3: Write minimal implementation**

In `apps/server/src/server.ts` die Registry aus dem Store bauen:

```ts
const database = openDatabase(config.databaseFile);
const store = new SqliteRoomStore(database, (message, detail) => {
  app.log.error({ ...(detail as object) }, message);
});

const deps = {
  registry: RoomRegistry.load(store, {
    onWriteError: (code, error) => {
      // Der Zug ist bereits angenommen - hier wird protokolliert, nicht
      // zurueckgenommen.
      app.log.error({ code, err: error }, 'Raum liess sich nicht schreiben');
    },
  }),
  users: new Users(database),
  sinks: new SinkHub(),
};

app.log.info({ rooms: deps.registry.all.length }, 'Raeume von der Platte geladen');
```

Die Importe fuer `SqliteRoomStore` ergaenzen.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @conquerist/server exec vitest run && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/server/src
git add apps/server/src
git commit -m "Der Server laedt seine Raeume beim Start"
```

---

### Task 8: „Deine Partien" auf dem Startbildschirm

**Files:**

- Modify: `apps/client/src/game/useOnlineGame.ts`
- Modify: `apps/client/src/screens/StartScreen.tsx`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/index.css`
- Test: `apps/client/src/screens/StartScreen.test.tsx` (bestehend, ergaenzen)

**Entwurf in drei Saetzen** (Design-Regel 1 aus `CLAUDE.md`):

- **Rolle:** Der Startbildschirm bekommt eine dritte Auskunft neben „erstellen" und „beitreten" — wo du schon sitzt.
- **Aufbau:** Die Karten stehen **ueber** den beiden Wegen, weil Weitermachen naeher liegt als Neuanfangen; fehlen sie, aendert sich am Bildschirm nichts.
- **Das eine Element:** jede Karte traegt die Sitzreihe als dieselben Spielsteine wie der Wartebereich, in denselben Farben. Man erkennt seinen Tisch an der Aufstellung, bevor man den Code gelesen hat.

- [ ] **Step 1: Write the failing test**

In `apps/client/src/screens/StartScreen.test.tsx` ergaenzen:

```ts
it('zeigt die eigenen Partien und fuehrt mit einem Klick zurueck', async () => {
  const onResume = vi.fn();
  render(
    <StartScreen
      onStartLocal={vi.fn()}
      onCreateRoom={vi.fn()}
      onJoinRoom={vi.fn()}
      onResume={onResume}
      myRooms={[
        {
          code: 'K7X2',
          seatCount: 3,
          started: true,
          turn: 4,
          yourTurn: true,
          seats: [
            { name: 'Anna', color: '#c0392b', connected: true },
            { name: 'Ben', color: '#2c6fbb', connected: false },
          ],
        },
      ]}
    />,
  );

  expect(screen.getByText('K7X2')).toBeDefined();
  expect(screen.getByText(/du bist dran/i)).toBeDefined();

  await userEvent.click(screen.getByRole('button', { name: /Zurück/ }));
  expect(onResume).toHaveBeenCalledWith('K7X2');
});

it('laesst den Bereich ganz weg, wenn es keine eigenen Partien gibt', () => {
  render(
    <StartScreen
      onStartLocal={vi.fn()}
      onCreateRoom={vi.fn()}
      onJoinRoom={vi.fn()}
      onResume={vi.fn()}
      myRooms={[]}
    />,
  );

  expect(screen.queryByText(/Deine Partien/i)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/StartScreen.test.tsx`
Expected: FAIL — `onResume` und `myRooms` gibt es nicht.

- [ ] **Step 3: Write minimal implementation**

`StartScreenProps` um zwei Angaben erweitern:

```ts
  /** Partien, an denen dieser Spieler sitzt. Leer heisst: der Bereich fehlt. */
  readonly myRooms?: readonly RoomSummary[];
  readonly onResume?: (code: string) => void;
```

`RoomSummary` aus `@conquerist/shared` importieren. In der Destrukturierung der
Props beide mit Vorgabe aufnehmen, damit die bestehenden Aufrufstellen ohne
Aenderung weiterlaufen:

```ts
  myRooms = [],
  onResume,
```

Im Rumpf, direkt nach dem `error`-Absatz und **vor** den beiden Wegen:

```tsx
{
  myRooms.length === 0 ? null : (
    <section className="way">
      <span className="eyebrow">Deine Partien</span>
      <ol className="resume">
        {myRooms.map((entry) => (
          <li key={entry.code} className="resume__card">
            <div className="resume__head">
              <span className="resume__code">{entry.code}</span>
              <span className="resume__state">
                {!entry.started
                  ? `wartet · ${entry.seats.length} von ${entry.seatCount}`
                  : entry.yourTurn === true
                    ? `Runde ${entry.turn ?? 0} · du bist dran`
                    : `Runde ${entry.turn ?? 0}`}
              </span>
            </div>

            <div className="resume__seats">
              {entry.seats.map((seat) => (
                <span key={seat.name} className="resume__seat">
                  <SeatPiece color={seat.color} open={!seat.connected} />
                  {seat.name}
                </span>
              ))}
            </div>

            <button type="button" className="button" onClick={() => onResume?.(entry.code)}>
              Zurück in die Partie
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

`SeatPiece` aus `LobbyScreen.tsx` exportieren (dort das `function SeatPiece` zu `export function SeatPiece` machen) und hier importieren — dieselbe Silhouette in beiden Listen, eine Quelle.

Die CSS-Regeln in `index.css` **direkt hinter dem `.way`-Block** ergaenzen, weil sie dazugehoeren:

```css
.resume {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.resume__card {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgb(233 225 207 / 14%);
  border-radius: var(--radius);
  background: rgb(0 0 0 / 22%);
}

.resume__head {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
  justify-content: space-between;
}

.resume__code {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--parchment);
}

.resume__state {
  color: var(--on-sea-muted);
  font-size: 0.78rem;
}

.resume__seats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--on-sea-muted);
}

.resume__seat {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}
```

In `useOnlineGame.ts` die Liste holen und halten:

```ts
const [myRooms, setMyRooms] = useState<readonly RoomSummary[]>([]);

const refreshMyRooms = useCallback(async (): Promise<void> => {
  try {
    const { rooms } = await send(MY_ROOMS, {});
    setMyRooms(rooms);
  } catch {
    // Ohne Liste faellt der Bereich weg. Das ist eine Einbusse, kein Fehler.
    setMyRooms([]);
  }
}, [send]);
```

Im Anmelde-Effect nach dem erfolgreichen `hello` ergaenzen: `if (!cancelled) await refreshMyRooms();` und `refreshMyRooms` in die Rueckgabe sowie in die Abhaengigkeiten des Effects aufnehmen. `MY_ROOMS` und `type RoomSummary` aus `@conquerist/shared` importieren.

In `App.tsx` die beiden Angaben an `StartScreen` durchreichen:

```tsx
        myRooms={online.myRooms}
        onResume={(code) => {
          // Kein eigener Einstiegsweg: `room.join` erkennt einen bekannten Sitz
          // seit Etappe 4 wieder. Ein zweiter waere ein zweiter Weg fuer
          // dieselbe Sache.
          void online.joinRoom(code, loadName() ?? '');
        }}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @conquerist/client exec vitest run`
Expected: PASS — alle Client-Tests.

- [ ] **Step 5: Commit**

```bash
cd /c/code/Conquerist
pnpm prettier --write apps/client/src
git add apps/client/src
git commit -m "Client: die eigenen Partien auf dem Startbildschirm"
```

---

### Task 9: Abnahme und Standsdateien

**Files:**

- Modify: `apps/server/scripts/acceptance.mjs`
- Modify: `PROGRESS.md`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Die Abnahme um die Liste erweitern**

In `apps/server/scripts/acceptance.mjs`, innerhalb von `onlineGame()` nach dem Start der Partie:

```js
const mine = await anna.send('room.mine', {});
record(
  'Die eigenen Partien lassen sich abfragen',
  mine.rooms.length === 1 && mine.rooms[0].code === code && mine.rooms[0].started === true,
  `${mine.rooms.length} Partie(n)`,
);
record(
  'Die Liste traegt keine Handkarten hinaus',
  !JSON.stringify(mine).includes('resources') && !JSON.stringify(mine).includes('rng'),
  'nichts Verdecktes in der Uebersicht',
);
```

- [ ] **Step 2: Abnahme fahren**

Run (braucht laufendes `pnpm dev`): `pnpm --filter @conquerist/server acceptance`
Expected: 23/23 gruen.

- [ ] **Step 3: Den Neustart von Hand pruefen**

`pnpm dev` laufen lassen, im Browser eine Online-Partie starten und ein paar Zuege machen. Dann in `apps/server/src/server.ts` ein Leerzeichen speichern, damit `tsx watch` neu startet. Erwartet: der Browser verbindet sich neu, und die Partie steht mit demselben Stand da. Das Ergebnis in `PROGRESS.md` festhalten — es ist die einzige Pruefung dieser Etappe, die kein Test abdecken kann.

- [ ] **Step 4: Standsdateien nachziehen**

- `CLAUDE.md`: Etappe 6 im Etappenplan auf ✅, den Abschnitt „Aktueller Stand" nachziehen, `rooms/store.ts` und `rooms/sqliteStore.ts` in der Serverliste ergaenzen.
- `PROGRESS.md`: neuer Abschnitt „Etappe 6" nach dem Muster der bisherigen — Abnahme-Tabelle, was die Tests belegen, getroffene Entscheidungen, Abweichungen, offene Punkte, naechste Etappe.
- `README.md`: unter „Umgebungsvariablen" bleibt `DATABASE_FILE`, aber der Satz „Ein Neustart wirft laufende Partien weg" faellt weg, falls er dort steht.

- [ ] **Step 5: Volle Abnahme und Commit**

```bash
cd /c/code/Conquerist
pnpm typecheck && pnpm test && pnpm build && pnpm format:check
pnpm prettier --write .
git add -A
git commit -m "Etappe 6 abgenommen: Standsdateien und Abnahmeskript nachgezogen"
```

---

## Nach der letzten Aufgabe

Etappe 6 ist damit fertig. Offen bleiben, bewusst:

- Ein Umbau am Reducer kann alte Logs unbrauchbar machen.
- Keine Frist fuer Partien, an die niemand zurueckkommt.
- Kein Rauswerfen und keine Hostuebergabe in laufenden Partien.
- Die oeffentliche Partieliste — eine eigene Frage, falls sie je gestellt wird.

## Hinweise fuer die naechste Sitzung

**Etappe 7 — Registrierung, Login, Gast-Account beanspruchen.** Die Zeile in
`users` ist seit Etappe 4 dafuer gebaut: aus einem Gast wird per UPDATE ein
Konto, kein neuer Datentyp. Die Raeume verweisen bereits auf `users(id)` und
muessen dafuer nicht angefasst werden.
