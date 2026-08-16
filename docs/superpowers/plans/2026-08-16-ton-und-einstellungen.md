# Ton und Einstellungen — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Spiel bekommt 23 synthetisierte Klaenge, einen Einstellungen-Dialog
mit drei Lautstaerken, und online hoert man am Pegel, ob ein Zug einen selbst
betrifft.

**Architecture:** Der Server sagt im `GameEvent` neu, **welcher** Zug geschehen
ist (`move: { type, actor }`); was das klingt, entscheidet allein der Client.
Eine reine Funktion `cueFor(move, situation)` bildet Zug auf Klang ab, gefuellt
von zwei Erhebern (einer aus `GameState` fuer den Hotseat, einer aus
`PlayerView` fuer online). Die Klaenge selbst sind Daten (Oszillatoren,
Huellkurven), abgespielt von einer bewusst dummen WebAudio-Schicht; eine mp3
kann jeden einzelnen ersetzen.

**Tech Stack:** TypeScript strict, React 19, Vitest (node als Voreinstellung,
jsdom je Datei), Zod im Protokoll, WebAudio ohne Bibliothek.

**Spec:** `docs/superpowers/specs/2026-08-16-ton-und-einstellungen-design.md`

## Global Constraints

- Branch: `etappe-10-ton`. Alle Commits dorthin.
- **Prosa in Docs und Kommentaren ohne Umlaute** (`ae/oe/ue/ss`). **Alles, was
  ein Spieler liest, mit Umlauten** — Dialogtexte, `aria-label`, Beschriftungen.
- Antworten und Kommentare auf Deutsch, Bezeichner und Code auf Englisch.
- **Keine `Co-Authored-By`-Zeile in Commit-Messages.**
- `packages/shared` bekommt keine Laufzeit-Abhaengigkeit ausser `zod`. Der
  Client bekommt **keine** neue Abhaengigkeit — WebAudio ist eingebaut.
- Der Reducer bleibt rein: kein `Date.now()`, kein `Math.random()`, kein I/O.
  Der Klang landet als Datenfeld im Zustand, abgespielt wird an der Kante.
- Kein Hex-Wert in einer Komponente. Farben kommen aus den Variablen in
  `index.css`.
- **Nicht `.button--ghost` benutzen** — cream auf Pergament, 1,05:1, unsichtbar.
- Vor jedem Commit: `pnpm -w typecheck`, `pnpm -w test`, `pnpm -w format:check`.
- Neue Testdateien, die rendern, brauchen `// @vitest-environment jsdom` in
  Zeile 1 und importieren aus `../test/dom`.

---

### Task 1: `move` im Protokoll

Der Client erfaehrt online bisher nur einen deutschen Satz. Er bekommt ein Feld
dazu, das sagt, welcher Zug es war.

**Files:**
- Modify: `packages/shared/src/game/actions.ts` (ans Ende)
- Modify: `packages/shared/src/protocol/events.ts:59-73`
- Test: `packages/shared/src/game/actions.test.ts`, `packages/shared/src/protocol/events.test.ts`

**Interfaces:**
- Produces: `GAME_ACTION_TYPES`, `GameActionTypeSchema`, `MoveSchema`,
  `type Move = { type: GameActionType; actor: string }`; `GameEvent.move?: Move`

- [ ] **Step 1: Write the failing test**

In `packages/shared/src/game/actions.test.ts` anhaengen:

```ts
import { GAME_ACTION_TYPES, GameActionSchema, GameActionTypeSchema } from './actions.js';

describe('GameActionTypeSchema', () => {
  it('zaehlt genau die Zweige der Union auf', () => {
    // Die Union kennt ihre Zweige zur Laufzeit: jede Option ist ein ZodObject
    // mit einem Literal als `type`. Damit ist die Liste pruefbar und nicht nur
    // abgeschrieben.
    const fromUnion = GameActionSchema.options.map((option) => option.shape.type.value);

    expect([...GAME_ACTION_TYPES].sort()).toEqual([...fromUnion].sort());
  });

  it('nimmt einen bekannten Typ an und einen erfundenen nicht', () => {
    expect(GameActionTypeSchema.safeParse('buildCity').success).toBe(true);
    expect(GameActionTypeSchema.safeParse('buildCastle').success).toBe(false);
  });
});
```

In `packages/shared/src/protocol/events.test.ts` anhaengen:

```ts
it('traegt den Zug, wenn einer geschehen ist - und ohne ihn bleibt es gueltig', () => {
  const base = { version: 3, view: aPlayerView(), actions: [], sentAt: 1_700_000_000_000 };

  const withMove = GameEventSchema.safeParse({
    ...base,
    entry: 'Ada baut eine Stadt',
    move: { type: 'buildCity', actor: 'u1' },
  });
  expect(withMove.success).toBe(true);
  expect(withMove.success && withMove.data.move?.type).toBe('buildCity');

  expect(GameEventSchema.safeParse(base).success).toBe(true);
  expect(GameEventSchema.safeParse({ ...base, move: { type: 'nope', actor: 'u1' } }).success).toBe(
    false,
  );
});
```

`aPlayerView()` ist der bestehende Aufbau in dieser Datei; wenn sie eine andere
Hilfsfunktion benutzt, deren Namen verwenden.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared test -- --run src/game/actions.test.ts src/protocol/events.test.ts`
Expected: FAIL — `GAME_ACTION_TYPES` ist nicht exportiert.

- [ ] **Step 3: Write minimal implementation**

Ans Ende von `packages/shared/src/game/actions.ts`:

```ts
/**
 * Die Zugarten als Liste, fuer Stellen, die einen Typ ohne die ganze Aktion
 * brauchen - das Protokoll schickt sie seit dem Ton mit.
 *
 * Die Liste steht doppelt zur Union, und das ist Absicht: `satisfies` faengt
 * jeden Tippfehler, `AssertNever` unten faengt jeden **vergessenen** Zweig.
 * Ohne den zweiten Waechter waere ein neuer Zugtyp einfach stumm.
 */
export const GAME_ACTION_TYPES = [
  'placeSetupSettlement',
  'placeSetupRoad',
  'rollDice',
  'discard',
  'moveRobber',
  'buildRoad',
  'buildSettlement',
  'buildCity',
  'buyDevelopmentCard',
  'playKnight',
  'playRoadBuilding',
  'playYearOfPlenty',
  'playMonopoly',
  'tradeWithBank',
  'offerTrade',
  'respondTrade',
  'counterTrade',
  'acceptTrade',
  'rejectCounter',
  'withdrawTrade',
  'timeout',
  'dropFromTrade',
  'rejoinTrade',
  'endTurn',
] as const satisfies readonly GameActionType[];

type AssertNever<T extends never> = T;
type _NoActionTypeForgotten = AssertNever<
  Exclude<GameActionType, (typeof GAME_ACTION_TYPES)[number]>
>;

export const GameActionTypeSchema = z.enum(GAME_ACTION_TYPES);
```

In `packages/shared/src/protocol/events.ts`, Import ergaenzen und vor
`GameEventSchema` einfuegen:

```ts
import { GameActionSchema, GameActionTypeSchema } from '../game/actions.js';
import { PlayerIdSchema } from '../game/player.js';

/**
 * Welcher Zug zu diesem Stand gefuehrt hat.
 *
 * Der Client hatte bisher nur `entry` - einen fertigen deutschen Satz. Daraus
 * laesst sich nichts ableiten ausser Text. Was **passiert** ist, steht hier;
 * was daraus wird (Klang, spaeter vielleicht eine Uebersetzung), entscheidet
 * der Empfaenger. Deshalb steht hier der Zugtyp und keine Ausgabeanweisung.
 */
export const MoveSchema = z.object({
  type: GameActionTypeSchema,
  actor: PlayerIdSchema,
});

export type Move = z.infer<typeof MoveSchema>;
```

Und in `GameEventSchema` direkt unter `entry`:

```ts
  /** Der Zug zu diesem Stand. Steht genau dann da, wenn `entry` dasteht. */
  move: MoveSchema.optional(),
```

Falls `packages/shared/src/protocol/index.ts` die Typen einzeln reexportiert,
`MoveSchema` und `Move` dort ergaenzen.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared test` — Expected: PASS
Run: `pnpm -w typecheck` — Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/actions.ts packages/shared/src/game/actions.test.ts packages/shared/src/protocol/events.ts packages/shared/src/protocol/events.test.ts packages/shared/src/protocol/index.ts
git commit -m "Der Spielstand sagt jetzt auch, welcher Zug ihn erzeugt hat"
```

---

### Task 2: Der Server schickt den Zug mit

`broadcastGame` bekommt den Uebergang statt des fertigen Satzes und rechnet
`entry` **und** `move` selbst aus. Das loest nebenbei vier Kopien derselben
`describeTransition`-Zeile auf.

**Files:**
- Modify: `apps/server/src/rooms/broadcast.ts:47-75`
- Modify: `apps/server/src/rooms/clock.ts:66-76`
- Modify: `apps/server/src/ws/handlers/room.ts:83-88`, `:315-323`, `:366-372`
- Test: `apps/server/src/rooms/broadcast.test.ts` (anlegen, falls nicht vorhanden)

**Interfaces:**
- Consumes: `Move` aus Task 1
- Produces: `broadcastGame(room, sinks, transition?: Transition)` mit
  `interface Transition { before: GameState; action: GameAction; after: GameState }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { broadcastGame } from './broadcast.js';
// Raum und Senken wie in den bestehenden Server-Tests aufbauen.

describe('broadcastGame', () => {
  it('schickt Satz und Zug, wenn ein Uebergang mitkommt', () => {
    const sent: { type: string; payload: any }[] = [];
    const room = aStartedRoom();
    const before = room.game!;
    const action = { type: 'rollDice', player: room.seats[0]!.userId } as const;
    const after = before; // fuer den Test genuegt derselbe Stand

    broadcastGame(room, sinksCapturing(room, sent), { before, action, after });

    expect(sent[0]!.payload.move).toEqual({ type: 'rollDice', actor: room.seats[0]!.userId });
    expect(typeof sent[0]!.payload.entry).toBe('string');
  });

  it('schickt weder Satz noch Zug, wenn keiner mitkommt', () => {
    const sent: { type: string; payload: any }[] = [];
    const room = aStartedRoom();

    broadcastGame(room, sinksCapturing(room, sent));

    expect(sent[0]!.payload.move).toBeUndefined();
    expect(sent[0]!.payload.entry).toBeUndefined();
  });
});
```

`aStartedRoom()` und die Senken wie in den vorhandenen Tests unter
`apps/server/src/rooms/` bzw. `apps/server/src/ws/` aufbauen — dort gibt es
bereits Aufbauhilfen fuer Raeume mit laufender Partie; die wiederverwenden statt
neu zu erfinden.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/server test -- --run src/rooms/broadcast.test.ts`
Expected: FAIL — `broadcastGame` nimmt einen String, kein Objekt.

- [ ] **Step 3: Write minimal implementation**

`apps/server/src/rooms/broadcast.ts` — Import und Signatur:

```ts
import {
  GAME_EVENT,
  OVER_EVENT,
  ROOM_EVENT,
  describeTransition,
  legalActions,
  playerViewOf,
  type GameAction,
  type GameState,
  type Seat,
} from '@conquerist/shared';

/**
 * Der Zug, der zu diesem Stand gefuehrt hat - vorher, was, nachher.
 *
 * Bis hierher rechnete jede der vier Aufrufstellen ihren Verlaufssatz selbst
 * aus; mit dem Zugtyp im Ereignis waere daraus die fuenfte Kopie geworden.
 * Jetzt reicht jede Stelle den Uebergang durch und diese Datei entscheidet, was
 * daraus im Ereignis landet.
 */
export interface Transition {
  readonly before: GameState;
  readonly action: GameAction;
  readonly after: GameState;
}

export function broadcastGame(room: Room, sinks: Sinks, transition?: Transition): void {
  const game = room.game;
  if (game === null) return;

  const seats: readonly Seat[] = room.seats.map((seat) => ({
    id: seat.userId,
    name: seat.name,
    color: seat.color,
  }));
  const connected = new Map(room.seats.map((seat) => [seat.userId, seat.connected]));
  const sentAt = Date.now();

  const entry =
    transition === undefined
      ? undefined
      : describeTransition(transition.before, transition.action, transition.after, seats);
  const move =
    transition === undefined
      ? undefined
      : { type: transition.action.type, actor: transition.action.player };

  for (const seat of room.seats) {
    const targets = sinks.get(seat.userId) ?? [];
    if (targets.length === 0) continue;

    const payload = {
      version: room.version,
      view: playerViewOf(game, seat.userId, seats, room.version, connected),
      actions: legalActions(game, seat.userId),
      sentAt,
      ...(entry === undefined ? {} : { entry }),
      ...(move === undefined ? {} : { move }),
    };

    for (const sink of targets) sink.send(GAME_EVENT, payload);
  }
}
```

`apps/server/src/rooms/clock.ts` — den Block ab `const seats` bis
`broadcastGame(...)` ersetzen durch:

```ts
    broadcastGame(
      acted.room,
      deps.sinks.map,
      acted.room.game === null ? undefined : { before, action, after: acted.room.game },
    );
```

Den nun unbenutzten `describeTransition`-Import und die lokale `seats`-Variable
entfernen (der Typprueffehler zeigt beides an).

`apps/server/src/ws/handlers/room.ts` — an allen drei Stellen dasselbe Muster;
`before` heisst dort schon so, die Nachher-Seite ist `acted.room.game`:

```ts
    broadcastGame(
      acted.room,
      sinks.map,
      before === null || acted.room.game === null
        ? undefined
        : { before, action, after: acted.room.game },
    );
```

An der dritten Stelle (`:366`) heisst die Vorher-Seite `game` statt `before` —
dort `{ before: game, action, after: acted.room.game }`. Die drei Aufrufe ohne
Uebergang (Join, Start, Reconnect) bleiben unveraendert.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/server test` — Expected: PASS (auch die
bestehenden Handler-Tests, die `entry` pruefen)
Run: `pnpm -w typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src
git commit -m "Der Verlaufssatz entsteht dort, wo er verschickt wird - und der Zug daneben"
```

---

### Task 3: Das Klangvokabular und die Zuordnung

Reine Datei, kein DOM, kein Ton. Hier steht, **welcher** Klang zu einem Zug
gehoert und wie laut.

**Files:**
- Create: `apps/client/src/audio/cues.ts`
- Create: `apps/client/src/audio/cueFor.ts`
- Test: `apps/client/src/audio/cueFor.test.ts`

**Interfaces:**
- Consumes: `Move` aus Task 1
- Produces: `type Cue` (23 Werte), `interface Sound { cue: Cue; gain: number; note?: number }`,
  `interface SoundEvent { seq: number; sounds: readonly Sound[] }`, `interface Situation`,
  `FOREIGN_GAIN = 0.4`, `cueFor(move: Move, situation: Situation): readonly Sound[]`

- [ ] **Step 1: Write the failing test**

`apps/client/src/audio/cueFor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FOREIGN_GAIN, type Situation } from './cues';
import { cueFor } from './cueFor';

const quiet: Situation = {
  foreign: false,
  gained: 0,
  lost: 0,
  becameMyTurn: false,
  mustDiscard: false,
  offerToMe: false,
  finished: false,
  diceTotal: null,
};

const cues = (sounds: readonly { cue: string }[]): string[] => sounds.map((s) => s.cue);

describe('cueFor', () => {
  it('gibt jedem Bauzug seinen eigenen Klang', () => {
    expect(cues(cueFor({ type: 'buildRoad', actor: 'a' }, quiet))).toEqual(['build.road']);
    expect(cues(cueFor({ type: 'buildSettlement', actor: 'a' }, quiet))).toEqual([
      'build.settlement',
    ]);
    expect(cues(cueFor({ type: 'buildCity', actor: 'a' }, quiet))).toEqual(['build.city']);
  });

  it('nimmt die Gruendungszuege auf dieselben Klaenge', () => {
    expect(cues(cueFor({ type: 'placeSetupRoad', actor: 'a' }, quiet))).toEqual(['build.road']);
    expect(cues(cueFor({ type: 'placeSetupSettlement', actor: 'a' }, quiet))).toEqual([
      'build.settlement',
    ]);
  });

  it('laesst den Wurf poltern und danach landen, mit der Augensumme als Ton', () => {
    const sounds = cueFor({ type: 'rollDice', actor: 'a' }, { ...quiet, diceTotal: 9 });

    expect(cues(sounds)).toEqual(['dice.roll', 'dice.land']);
    expect(sounds[1]!.note).toBe(9);
  });

  it('gibt der Sieben einen eigenen Klang statt eines hohen Pings', () => {
    const sounds = cueFor({ type: 'rollDice', actor: 'a' }, { ...quiet, diceTotal: 7 });

    expect(cues(sounds)).toEqual(['dice.roll', 'dice.seven']);
  });

  it('haengt den Ertrag an, wenn Karten zugelaufen sind', () => {
    const sounds = cueFor({ type: 'rollDice', actor: 'a' }, { ...quiet, diceTotal: 5, gained: 2 });

    expect(cues(sounds)).toContain('gain.self');
  });

  it('daempft fremde Zuege', () => {
    const sounds = cueFor({ type: 'buildCity', actor: 'b' }, { ...quiet, foreign: true });

    expect(sounds[0]!.gain).toBe(FOREIGN_GAIN);
  });

  it('nimmt die Daempfung zurueck, wenn der fremde Zug mich trifft', () => {
    const robbed = cueFor(
      { type: 'moveRobber', actor: 'b' },
      { ...quiet, foreign: true, lost: 1 },
    );
    expect(robbed.every((sound) => sound.gain === 1)).toBe(true);

    const offered = cueFor(
      { type: 'offerTrade', actor: 'b' },
      { ...quiet, foreign: true, offerToMe: true },
    );
    expect(offered[0]!.gain).toBe(1);
  });

  it('meldet den eigenen Zug, das Abwerfen und das Ende zusaetzlich', () => {
    expect(cues(cueFor({ type: 'endTurn', actor: 'b' }, { ...quiet, becameMyTurn: true }))).toEqual([
      'turn.mine',
    ]);
    expect(
      cues(cueFor({ type: 'rollDice', actor: 'b' }, { ...quiet, diceTotal: 7, mustDiscard: true })),
    ).toContain('discard.required');
    expect(
      cues(cueFor({ type: 'buildCity', actor: 'a' }, { ...quiet, finished: true })),
    ).toContain('game.over');
  });

  it('bleibt still, wo Ton nur stoeren wuerde', () => {
    expect(cueFor({ type: 'endTurn', actor: 'a' }, quiet)).toEqual([]);
    expect(cueFor({ type: 'dropFromTrade', actor: 'b' }, { ...quiet, foreign: true })).toEqual([]);
    expect(cueFor({ type: 'rejoinTrade', actor: 'b' }, { ...quiet, foreign: true })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/cueFor.test.ts`
Expected: FAIL — Modul `./cues` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/audio/cues.ts`:

```ts
import type { Move } from '@conquerist/shared';

/**
 * Das Klangvokabular - 23 Namen, mehr gibt es nicht.
 *
 * Es ist eine Liste und kein loser String-Typ, damit `voices.ts` einen
 * vollstaendigen `Record` fuehren muss: ein neuer Cue ohne Rezept uebersetzt
 * nicht.
 */
export const CUES = [
  'ui.click',
  'ui.confirm',
  'ui.cancel',
  'ui.error',

  'build.road',
  'build.settlement',
  'build.city',

  'dice.roll',
  'dice.land',
  'dice.seven',

  'gain.self',

  'robber.move',
  'robber.steal',
  'discard.required',

  'card.buy',
  'card.knight',
  'card.play',

  'trade.offer',
  'trade.accept',
  'trade.reject',
  'trade.timeout',

  'turn.mine',
  'game.over',
] as const;

export type Cue = (typeof CUES)[number];

/**
 * Ein Klang mit seiner Ausloesung.
 *
 * `gain` und `note` stehen hier und nicht im Katalog: derselbe Cue klingt
 * gedaempft, wenn ihn ein anderer ausgeloest hat, und `dice.land` traegt die
 * Augensumme als Tonhoehe. Beides gehoert zum Vorfall, nicht zum Klang.
 */
export interface Sound {
  readonly cue: Cue;
  readonly gain: number;
  readonly note?: number;
}

/** Wie laut ein fremder Zug ist, der einen nichts angeht. */
export const FOREIGN_GAIN = 0.4;

/**
 * Der Klang zum letzten Zug, wie er im Zustand liegt.
 *
 * Er steht hier und nicht im Spielmodul, obwohl die Reduzierer ihn fuellen:
 * sonst muesste die Tonschicht aus `game/` importieren, um ihre eigene Eingabe
 * zu kennen. `seq` zaehlt mit - ohne ihn bliebe derselbe Klang zweimal
 * hintereinander stumm, und in `StrictMode` ist er die Sperre gegen den
 * doppelt laufenden Effekt.
 */
export interface SoundEvent {
  readonly seq: number;
  readonly sounds: readonly Sound[];
}

/**
 * Was ein Klang ueber die Lage wissen muss - und sonst nichts.
 *
 * Der Hotseat haelt `GameState`, online liegt nur eine `PlayerView` vor. Eine
 * Funktion mit zwei Zustandswelten waeren zwei Funktionen mit einem Namen;
 * deshalb steht diese Erhebung dazwischen. Sie wird von zwei Erhebern gefuellt
 * (`situation.ts`), und `cueFor` kennt keinen von beiden.
 */
export interface Situation {
  /** Ein anderer hat gezogen. Im Hotseat nie - dort ist jeder „ich". */
  readonly foreign: boolean;
  /** Wie viele Karten mir zugelaufen sind. */
  readonly gained: number;
  /** Wie viele mir abhanden gekommen sind. */
  readonly lost: number;
  readonly becameMyTurn: boolean;
  readonly mustDiscard: boolean;
  /** Ein Angebot wartet auf meine Antwort. */
  readonly offerToMe: boolean;
  /** Die Partie ist mit genau diesem Zug vorbei. */
  readonly finished: boolean;
  readonly diceTotal: number | null;
}

export type { Move };
```

`apps/client/src/audio/cueFor.ts`:

```ts
import { FOREIGN_GAIN, type Cue, type Move, type Situation, type Sound } from './cues';

/**
 * Welcher Zug wie klingt.
 *
 * Rein und ohne Zustand: Eingabe ist der Zug und die erhobene Lage, Ausgabe
 * eine Liste Klaenge. Damit ist die ganze Zuordnung mit Objektliteralen
 * pruefbar, ohne Spielstand und ohne AudioContext.
 *
 * Stumm bleiben `endTurn` (der Zugwechsel meldet sich mit `turn.mine`, wenn er
 * mich betrifft) sowie `dropFromTrade`/`rejoinTrade` - das sind Nachrichten
 * ueber eine Verbindung, kein Zug am Tisch.
 */
export function cueFor(move: Move, situation: Situation): readonly Sound[] {
  const level = loudness(situation);
  const sounds: Sound[] = [];

  const add = (cue: Cue, note?: number): void => {
    sounds.push(note === undefined ? { cue, gain: level } : { cue, gain: level, note });
  };
  // Was mich betrifft, wird nicht gedaempft, auch wenn es von fremd kommt.
  const addMine = (cue: Cue): void => {
    sounds.push({ cue, gain: 1 });
  };

  switch (move.type) {
    case 'placeSetupRoad':
    case 'buildRoad':
      add('build.road');
      break;
    case 'placeSetupSettlement':
    case 'buildSettlement':
      add('build.settlement');
      break;
    case 'buildCity':
      add('build.city');
      break;

    case 'rollDice':
      add('dice.roll');
      if (situation.diceTotal !== null) {
        if (situation.diceTotal === 7) add('dice.seven');
        else add('dice.land', situation.diceTotal);
      }
      break;

    // Abwerfen ist dasselbe Kartenrutschen wie ein Diebstahl - Karten
    // verlassen die Hand, und der Anlass ist derselbe Raeuber.
    case 'discard':
      add('robber.steal');
      break;

    case 'moveRobber':
      add('robber.move');
      if (situation.lost > 0) addMine('robber.steal');
      break;

    case 'buyDevelopmentCard':
      add('card.buy');
      break;
    case 'playKnight':
      add('card.knight');
      break;
    case 'playRoadBuilding':
      add('card.play');
      add('build.road');
      break;
    case 'playYearOfPlenty':
    case 'playMonopoly':
      add('card.play');
      break;

    case 'tradeWithBank':
    case 'acceptTrade':
      add('trade.accept');
      break;
    case 'offerTrade':
    case 'counterTrade':
      add('trade.offer');
      break;
    // Dass ueberhaupt geantwortet wurde, ist die Nachricht - **was** geantwortet
    // wurde, steht nicht im Zug, und ein geratener Klang waere schlimmer als
    // ein neutraler.
    case 'respondTrade':
      add('ui.confirm');
      break;
    case 'rejectCounter':
    case 'withdrawTrade':
      add('trade.reject');
      break;
    case 'timeout':
      add('trade.timeout');
      break;

    case 'dropFromTrade':
    case 'rejoinTrade':
    case 'endTurn':
      break;
  }

  if (situation.gained > 0) addMine('gain.self');
  if (situation.mustDiscard) addMine('discard.required');
  if (situation.becameMyTurn) addMine('turn.mine');
  if (situation.finished) addMine('game.over');

  return sounds;
}

function loudness(situation: Situation): number {
  if (!situation.foreign) return 1;

  const concerns =
    situation.offerToMe || situation.lost > 0 || situation.becameMyTurn || situation.finished;

  return concerns ? 1 : FOREIGN_GAIN;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/cueFor.test.ts`
Expected: PASS (10 Tests)

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/audio
git commit -m "Welcher Zug wie klingt - als reine Funktion, ohne einen Ton"
```

---

### Task 4: Die zwei Erheber

Sie fuellen dieselbe `Situation`, jeder aus seiner Welt.

**Files:**
- Create: `apps/client/src/audio/situation.ts`
- Test: `apps/client/src/audio/situation.test.ts`

**Interfaces:**
- Consumes: `Situation` aus Task 3
- Produces: `situationFromGame(before: GameState, after: GameState, action: GameAction): Situation`,
  `situationFromView(before: PlayerView | null, after: PlayerView, move: Move): Situation`

- [ ] **Step 1: Write the failing test**

`apps/client/src/audio/situation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { playerViewOf, reduce, type GameState } from '@conquerist/shared';
import { situationFromGame, situationFromView } from './situation';

// Die Fixtures des Repos benutzen - `packages/shared/src/game/fixtures.ts` wird
// von den bestehenden Client-Tests bereits verwendet; dort nachsehen, wie ein
// Spielstand mit laufender Partie entsteht.

describe('situationFromGame (Hotseat)', () => {
  it('haelt nichts fuer fremd - am selben Geraet ist jeder „ich"', () => {
    const before = aRunningGame();
    const after = reduce(before, aRollFor(before)).state;

    expect(situationFromGame(before, after, aRollFor(before)).foreign).toBe(false);
  });

  it('zaehlt den Ertrag ueber alle Spieler zusammen', () => {
    const before = aRunningGame();
    const action = aRollFor(before);
    const after = reduce(before, action).state;

    const total = (state: GameState): number =>
      state.players.reduce((sum, p) => sum + countOf(p.resources), 0);

    expect(situationFromGame(before, after, action).gained).toBe(
      Math.max(0, total(after) - total(before)),
    );
  });

  it('meldet das Ende genau beim Uebergang', () => {
    const { before, action, after } = aWinningMove();

    expect(situationFromGame(before, after, action).finished).toBe(true);
    expect(situationFromGame(after, after, action).finished).toBe(false);
  });
});

describe('situationFromView (online)', () => {
  it('erkennt den fremden Zug an seinem Urheber', () => {
    const view = aViewFor('u1');

    expect(situationFromView(view, view, { type: 'buildCity', actor: 'u2' }).foreign).toBe(true);
    expect(situationFromView(view, view, { type: 'buildCity', actor: 'u1' }).foreign).toBe(false);
  });

  it('liest Gewinn und Verlust aus der eigenen Handkartenzahl', () => {
    const before = aViewFor('u1', { cards: 3 });
    const after = aViewFor('u1', { cards: 5 });

    expect(situationFromView(before, after, { type: 'rollDice', actor: 'u1' }).gained).toBe(2);
    expect(situationFromView(after, before, { type: 'moveRobber', actor: 'u2' }).lost).toBe(2);
  });

  it('meldet „du bist dran" nur beim Wechsel', () => {
    const notMine = aViewFor('u1', { currentIs: 'u2' });
    const mine = aViewFor('u1', { currentIs: 'u1' });

    expect(situationFromView(notMine, mine, { type: 'endTurn', actor: 'u2' }).becameMyTurn).toBe(
      true,
    );
    expect(situationFromView(mine, mine, { type: 'buildRoad', actor: 'u1' }).becameMyTurn).toBe(
      false,
    );
  });

  it('haelt ein fremdes Angebot fuer meins, ein eigenes nicht', () => {
    const before = aViewFor('u1');
    const after = aViewFor('u1', { phase: 'tradePending' });

    expect(situationFromView(before, after, { type: 'offerTrade', actor: 'u2' }).offerToMe).toBe(
      true,
    );
    expect(situationFromView(before, after, { type: 'offerTrade', actor: 'u1' }).offerToMe).toBe(
      false,
    );
  });

  it('vertraegt den ersten Stand ohne Vorgaenger', () => {
    const after = aViewFor('u1');

    const situation = situationFromView(null, after, { type: 'rollDice', actor: 'u1' });

    expect(situation.gained).toBe(0);
    expect(situation.lost).toBe(0);
    expect(situation.becameMyTurn).toBe(false);
  });
});
```

Die Hilfsfunktionen (`aRunningGame`, `aViewFor`, …) in dieser Datei anlegen und
dabei `packages/shared/src/game/fixtures.ts` benutzen — die bestehenden
Client-Tests (`game/view.test.ts`, `game/onlineState.test.ts`) zeigen, wie dort
ein Spielstand und eine `PlayerView` entstehen. Keine neuen Fixtures erfinden,
solange die vorhandenen reichen.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/situation.test.ts`
Expected: FAIL — Modul `./situation` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/audio/situation.ts`:

```ts
import {
  countResources,
  yieldTotal,
  type GameAction,
  type GameState,
  type PlayerView,
} from '@conquerist/shared';
import type { Move, Situation } from './cues';

/**
 * Die Lage aus einer Hotseat-Partie.
 *
 * `foreign` ist immer `false` und `becameMyTurn` immer `false`: am selben
 * Geraet gibt es niemanden, der „ich" waere, und ein „du bist dran" an einen
 * Bildschirm, den ohnehin gerade jemand anschaut, ist Laerm. Der Ertrag zaehlt
 * deshalb ueber **alle** Spieler - was auf den Tisch kommt, kommt zu dir.
 */
export function situationFromGame(
  before: GameState,
  after: GameState,
  action: GameAction,
): Situation {
  const total = (state: GameState): number =>
    state.players.reduce((sum, player) => sum + countResources(player.resources), 0);

  const difference = total(after) - total(before);

  return {
    foreign: false,
    gained: Math.max(0, difference),
    lost: action.type === 'moveRobber' ? Math.max(0, -difference) : 0,
    becameMyTurn: false,
    mustDiscard:
      after.phase.kind === 'discardPending' && before.phase.kind !== 'discardPending',
    offerToMe: false,
    finished: before.phase.kind !== 'finished' && after.phase.kind === 'finished',
    diceTotal: after.lastRoll === null ? null : yieldTotal(after.rules.dice, after.lastRoll),
  };
}

/**
 * Die Lage aus zwei aufeinanderfolgenden Sichten.
 *
 * Wer „ich" ist, steht in der Sicht selbst (`view.you`) - es muss keine Id von
 * aussen mitgereicht werden. Gewinn und Verlust kommen aus der eigenen
 * Handkartenzahl: das ist das Einzige, was in der eigenen Sicht verlaesslich
 * steht, und genau worum es beim Ton geht.
 *
 * `before` ist `null` beim ersten Stand nach dem Beitritt. Dann gibt es keinen
 * Unterschied, nur einen Anfang - und der klingt nicht.
 */
export function situationFromView(
  before: PlayerView | null,
  after: PlayerView,
  move: Move,
): Situation {
  const me = after.you;
  const cardsIn = (view: PlayerView): number =>
    view.players.find((player) => player.id === me)?.cardCount ?? 0;
  const currentIn = (view: PlayerView): string | undefined =>
    view.players[view.currentPlayerIndex]?.id;

  const difference = before === null ? 0 : cardsIn(after) - cardsIn(before);

  const discardsNow =
    after.phase.kind === 'discardPending' && after.phase.pending.includes(me);
  const discardedBefore =
    before !== null && before.phase.kind === 'discardPending' && before.phase.pending.includes(me);

  return {
    foreign: move.actor !== me,
    gained: Math.max(0, difference),
    lost: Math.max(0, -difference),
    becameMyTurn: before !== null && currentIn(before) !== me && currentIn(after) === me,
    mustDiscard: discardsNow && !discardedBefore,
    // Ein Angebot oder Gegenangebot von jemand anderem wartet auf mich.
    offerToMe: after.phase.kind === 'tradePending' && move.actor !== me,
    finished: after.phase.kind === 'finished' && before?.phase.kind !== 'finished',
    diceTotal: after.lastRoll === null ? null : yieldTotal(after.rules.dice, after.lastRoll),
  };
}
```

Falls `countResources` oder `yieldTotal` nicht aus `@conquerist/shared`
exportiert werden, in `packages/shared/src/game/index.ts` ergaenzen — beide sind
reine Funktionen ohne Nebenwirkung.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/situation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/audio packages/shared/src/game/index.ts
git commit -m "Zwei Erheber, eine Lage: Hotseat aus dem Zustand, online aus der Sicht"
```

---

### Task 5: Die Rezepte und die Sample-Ausnahmen

Jeder Cue bekommt seine Synthesevorschrift als Daten. Kein Ton, kein
AudioContext — nur Zahlen.

**Files:**
- Create: `apps/client/src/audio/voices.ts`
- Create: `apps/client/src/audio/samples.ts`
- Test: `apps/client/src/audio/voices.test.ts`

**Interfaces:**
- Consumes: `Cue`, `Sound` aus Task 3
- Produces: `type Layer`, `interface Recipe { layers: readonly Layer[] }`,
  `VOICES: Record<Cue, Recipe>`, `recipeFor(sound: Sound): Recipe`,
  `SAMPLES: Partial<Record<Cue, string>>`

- [ ] **Step 1: Write the failing test**

`apps/client/src/audio/voices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CUES } from './cues';
import { recipeFor, VOICES } from './voices';
import { SAMPLES } from './samples';

describe('VOICES', () => {
  it('kennt jeden Cue', () => {
    for (const cue of CUES) {
      expect(VOICES[cue]?.layers.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('haelt jeden Klang kurz - nichts laeuft laenger als eine Sekunde', () => {
    for (const cue of CUES) {
      const end = Math.max(
        ...VOICES[cue].layers.map((layer) => (layer.at ?? 0) + (layer.attack ?? 0) + layer.decay),
      );
      expect(end).toBeLessThanOrEqual(1000);
    }
  });

  it('laesst den Wuerfel poltern, bevor er landet', () => {
    expect(VOICES['dice.roll'].layers.length).toBeGreaterThanOrEqual(4);
    // Der Ping haengt hinten am Poltern - deshalb traegt er seinen Versatz im
    // Rezept und braucht keinen Zeitplaner darueber.
    expect(VOICES['dice.land'].layers[0]!.at ?? 0).toBeGreaterThan(400);
  });

  it('stimmt den Landeklang nach der Augensumme', () => {
    const low = recipeFor({ cue: 'dice.land', gain: 1, note: 2 });
    const high = recipeFor({ cue: 'dice.land', gain: 1, note: 12 });
    const firstTone = (recipe: { layers: readonly any[] }): number =>
      recipe.layers.find((layer) => layer.kind === 'tone')!.from;

    expect(firstTone(high)).toBeGreaterThan(firstTone(low));
  });

  it('laesst ein Rezept ohne Ton unveraendert', () => {
    expect(recipeFor({ cue: 'build.city', gain: 1 })).toEqual(VOICES['build.city']);
  });
});

describe('SAMPLES', () => {
  it('ist leer, solange keine Datei ausgesucht wurde', () => {
    // Die Synthese ist die Voreinstellung. Was hier steht, ist eine bewusste
    // Ausnahme - und jede Ausnahme braucht eine Datei unter public/sounds/.
    for (const url of Object.values(SAMPLES)) {
      expect(url).toMatch(/^\/sounds\/.+\.(mp3|ogg|wav)$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/voices.test.ts`
Expected: FAIL — Modul `./voices` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/audio/voices.ts`:

```ts
import type { Cue, Sound } from './cues';

/**
 * Ein Klang ist eine Liste Schichten, und eine Schicht ist Zahlen.
 *
 * Absichtlich Daten statt Code: so ist der ganze Katalog im node-Test
 * nachrechenbar, und `engine.ts` bleibt eine dumme Uebersetzung nach WebAudio.
 * Zeiten in Millisekunden, Frequenzen in Hertz, `gain` von 0 bis 1.
 */
export type Layer = {
  /** Versatz zum Beginn des Klangs. */
  readonly at?: number;
  readonly attack?: number;
  readonly decay: number;
  readonly gain: number;
} & (
  | { readonly kind: 'tone'; readonly wave: OscillatorType; readonly from: number; readonly to?: number }
  | {
      readonly kind: 'noise';
      readonly filter: BiquadFilterType;
      readonly from: number;
      readonly to?: number;
      readonly q?: number;
    }
);

export interface Recipe {
  readonly layers: readonly Layer[];
}

/*
 * Die Klangwelt: ein Holztisch, kein Raumschiff.
 *
 * Gefiltertes Rauschen fuer alles, was aufgesetzt wird; gestimmte Toene mit
 * schnellem Abfall fuer alles, was gemeldet wird. Die Toene liegen auf einer
 * Pentatonik ueber A3, damit zwei gleichzeitige Klaenge nie schief zueinander
 * stehen. Laut werden nur der Wuerfel und das Ende - alles andere ordnet sich
 * unter, wie die Panels unter dem Brett.
 */
const A3 = 220;
const knock = (at: number, gain: number, from: number): Layer => ({
  kind: 'noise',
  filter: 'bandpass',
  from,
  q: 1.4,
  at,
  attack: 1,
  decay: 70,
  gain,
});

export const VOICES: Record<Cue, Recipe> = {
  'ui.click': { layers: [knock(0, 0.16, 1800)] },
  'ui.confirm': {
    layers: [{ kind: 'tone', wave: 'triangle', from: A3 * 2, to: A3 * 3, attack: 2, decay: 90, gain: 0.16 }],
  },
  'ui.cancel': {
    layers: [{ kind: 'tone', wave: 'triangle', from: A3 * 2, to: A3 * 1.5, attack: 2, decay: 90, gain: 0.14 }],
  },
  'ui.error': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 0.75, attack: 3, decay: 130, gain: 0.2 },
      { kind: 'tone', wave: 'sine', from: A3 * 0.6, at: 110, attack: 3, decay: 190, gain: 0.2 },
    ],
  },

  'build.road': { layers: [knock(0, 0.3, 700), { kind: 'tone', wave: 'sine', from: A3, attack: 2, decay: 110, gain: 0.14 }] },
  'build.settlement': {
    layers: [knock(0, 0.34, 900), { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 2, decay: 150, gain: 0.16 }],
  },
  'build.city': {
    layers: [
      knock(0, 0.4, 620),
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 2, decay: 160, gain: 0.17 },
      { kind: 'tone', wave: 'sine', from: A3 * 2, at: 90, attack: 2, decay: 220, gain: 0.17 },
    ],
  },

  // Fuenf Ticks, unregelmaessig - regelmaessig klaenge es nach Maschine.
  'dice.roll': {
    layers: [knock(0, 0.22, 2600), knock(90, 0.18, 2200), knock(170, 0.2, 2900), knock(260, 0.16, 2400), knock(380, 0.14, 3100)],
  },
  'dice.land': {
    layers: [{ kind: 'tone', wave: 'triangle', from: A3 * 2, at: 500, attack: 2, decay: 260, gain: 0.26 }],
  },
  'dice.seven': {
    layers: [
      { kind: 'tone', wave: 'sawtooth', from: A3 * 0.75, to: A3 * 0.5, at: 500, attack: 4, decay: 420, gain: 0.24 },
      { kind: 'noise', filter: 'lowpass', from: 900, to: 300, at: 500, attack: 4, decay: 380, gain: 0.18 },
    ],
  },

  'gain.self': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 2, attack: 2, decay: 90, gain: 0.14 },
      { kind: 'tone', wave: 'sine', from: A3 * 2.25, at: 70, attack: 2, decay: 90, gain: 0.13 },
      { kind: 'tone', wave: 'sine', from: A3 * 2.5, at: 140, attack: 2, decay: 110, gain: 0.12 },
    ],
  },

  'robber.move': {
    layers: [
      { kind: 'noise', filter: 'lowpass', from: 700, to: 180, attack: 6, decay: 320, gain: 0.26 },
      { kind: 'tone', wave: 'sine', from: A3 * 0.5, attack: 6, decay: 260, gain: 0.18 },
    ],
  },
  'robber.steal': {
    layers: [{ kind: 'noise', filter: 'highpass', from: 1200, to: 4200, attack: 8, decay: 200, gain: 0.2 }],
  },
  'discard.required': {
    layers: [
      { kind: 'tone', wave: 'triangle', from: A3 * 1.5, attack: 3, decay: 140, gain: 0.2 },
      { kind: 'tone', wave: 'triangle', from: A3 * 1.25, at: 130, attack: 3, decay: 200, gain: 0.2 },
    ],
  },

  'card.buy': {
    layers: [{ kind: 'noise', filter: 'bandpass', from: 2600, to: 1400, q: 0.8, attack: 6, decay: 180, gain: 0.2 }],
  },
  'card.knight': {
    layers: [knock(0, 0.34, 1500), { kind: 'tone', wave: 'square', from: A3 * 1.5, attack: 2, decay: 130, gain: 0.1 }],
  },
  'card.play': {
    layers: [{ kind: 'tone', wave: 'triangle', from: A3 * 1.5, to: A3 * 2.25, attack: 3, decay: 190, gain: 0.18 }],
  },

  'trade.offer': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 2, attack: 3, decay: 150, gain: 0.22 },
      { kind: 'tone', wave: 'sine', from: A3 * 3, at: 140, attack: 3, decay: 240, gain: 0.22 },
    ],
  },
  'trade.accept': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 3, decay: 130, gain: 0.2 },
      { kind: 'tone', wave: 'sine', from: A3 * 2.25, at: 110, attack: 3, decay: 200, gain: 0.2 },
    ],
  },
  'trade.reject': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 3, decay: 130, gain: 0.18 },
      { kind: 'tone', wave: 'sine', from: A3, at: 110, decay: 200, attack: 3, gain: 0.18 },
    ],
  },
  'trade.timeout': {
    layers: [{ kind: 'tone', wave: 'sine', from: A3, to: A3 * 0.75, attack: 6, decay: 380, gain: 0.16 }],
  },

  'turn.mine': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 4, decay: 200, gain: 0.24 },
      { kind: 'tone', wave: 'sine', from: A3 * 2.25, at: 160, attack: 4, decay: 300, gain: 0.24 },
    ],
  },
  // Die einzige Stelle mit Melodie - hier wird die Boldness ausgegeben.
  'game.over': {
    layers: [
      { kind: 'tone', wave: 'triangle', from: A3 * 1.5, attack: 4, decay: 220, gain: 0.28 },
      { kind: 'tone', wave: 'triangle', from: A3 * 2, at: 170, attack: 4, decay: 240, gain: 0.28 },
      { kind: 'tone', wave: 'triangle', from: A3 * 3, at: 340, attack: 4, decay: 420, gain: 0.28 },
    ],
  },
};

/**
 * Das Rezept zu einem Vorfall - gestimmt, wenn er eine Note mitbringt.
 *
 * Ein Halbton je Auge, um die Sieben herum: die Zwei liegt tief, die Zwoelf
 * hoch, und dazwischen steigt es gleichmaessig. Die Zahl steht sichtbar auf dem
 * Brett; der Ton kommt dazu und ersetzt sie nicht.
 */
export function recipeFor(sound: Sound): Recipe {
  const base = VOICES[sound.cue];
  if (sound.note === undefined) return base;

  const factor = 2 ** ((sound.note - 7) / 12);

  return {
    layers: base.layers.map((layer) =>
      layer.kind === 'tone'
        ? { ...layer, from: layer.from * factor, ...(layer.to === undefined ? {} : { to: layer.to * factor }) }
        : layer,
    ),
  };
}
```

`apps/client/src/audio/samples.ts`:

```ts
import type { Cue } from './cues';

/**
 * Wo eine mp3 die Synthese ersetzt.
 *
 * **Die Synthese ist die Voreinstellung und bleibt es.** Ein Eintrag hier ist
 * eine bewusste Ausnahme fuer genau einen Klang. Faellt die Datei aus - nicht
 * da, nicht dekodierbar, zu langsam - klingt weiter die Synthese; ein fehlendes
 * Sample darf nie ein stummes Spiel bedeuten.
 *
 * Einbauen: Datei nach `apps/client/public/sounds/` legen (Vite kopiert den
 * Ordner unveraendert nach `dist`) und die Zeile entkommentieren.
 *
 * Die Liste ist zugleich die Einkaufsliste - je Zeile steht, was gesucht wird.
 */
export const SAMPLES: Partial<Record<Cue, string>> = {
  // 'ui.click':          '/sounds/click.mp3',       // trockener Knopf, ~50 ms
  // 'ui.confirm':        '/sounds/confirm.mp3',     // kurze Bestaetigung, ~120 ms
  // 'ui.cancel':         '/sounds/cancel.mp3',      // Ruecknahme, ~120 ms
  // 'ui.error':          '/sounds/error.mp3',       // abgelehnt, leise, ~300 ms
  // 'build.road':        '/sounds/road.mp3',        // Holz auf Holz, ~150 ms
  // 'build.settlement':  '/sounds/settlement.mp3',  // Aufsetzen, ~200 ms
  // 'build.city':        '/sounds/city.mp3',        // schwerer Aufsatz, ~250 ms
  // 'dice.roll':         '/sounds/dice-roll.mp3',   // Wuerfel poltern, ~500 ms
  // 'dice.land':         '/sounds/dice-land.mp3',   // Ping beim Liegenbleiben
  // 'dice.seven':        '/sounds/seven.mp3',       // dunkel, unheilvoll, ~500 ms
  // 'gain.self':         '/sounds/gain.mp3',        // Karten kommen, ~250 ms
  // 'robber.move':       '/sounds/robber.mp3',      // dumpfes Aufsetzen, ~350 ms
  // 'robber.steal':      '/sounds/steal.mp3',       // Karte rutscht weg, ~200 ms
  // 'discard.required':  '/sounds/discard.mp3',     // Aufforderung, ~300 ms
  // 'card.buy':          '/sounds/card-buy.mp3',    // Karte ziehen, ~200 ms
  // 'card.knight':       '/sounds/knight.mp3',      // fester Schlag, ~200 ms
  // 'card.play':         '/sounds/card-play.mp3',   // Karte legen, ~200 ms
  // 'trade.offer':       '/sounds/offer.mp3',       // ruft, zweitoenig, ~350 ms
  // 'trade.accept':      '/sounds/accept.mp3',      // Handschlag, ~300 ms
  // 'trade.reject':      '/sounds/reject.mp3',      // Absage, ~300 ms
  // 'trade.timeout':     '/sounds/timeout.mp3',     // Frist verfaellt, ~400 ms
  // 'turn.mine':         '/sounds/your-turn.mp3',   // ruhiger Anruf, ~400 ms
  // 'game.over':         '/sounds/game-over.mp3',   // Schlussfigur, ~800 ms
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/voices.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/audio
git commit -m "Dreiundzwanzig Klaenge als Zahlen, und die Liste, auf der mp3s stuenden"
```

---

### Task 6: Die Engine

Die einzige Datei, die WebAudio anfasst — und die einzige ohne Test. Sie trifft
keine Entscheidung: welcher Cue, welches Rezept, welcher Pegel steht fest, wenn
sie gerufen wird.

**Files:**
- Create: `apps/client/src/audio/engine.ts`

**Interfaces:**
- Consumes: `Sound`, `recipeFor`, `SAMPLES`, `AudioSettings` (Task 7 liefert den
  Typ; diese Task definiert nur den Verbrauch)
- Produces: `createEngine(): Engine` mit
  `{ play(sound: Sound): void; apply(settings: AudioSettings): void; close(): void }`

**Reihenfolge-Hinweis:** Diese Task benutzt `AudioSettings` aus Task 7. Wer
strikt der Reihenfolge folgt, macht Task 7 zuerst — sie ist kleiner. Der Plan
laesst sie hier stehen, weil die Engine der Grund fuer die Einstellungen ist.

- [ ] **Step 1: Implementierung schreiben (kein Test - siehe Begruendung unten)**

`apps/client/src/audio/engine.ts`:

```ts
import type { Sound } from './cues';
import { SAMPLES } from './samples';
import type { AudioSettings } from './settings';
import { recipeFor, type Layer } from './voices';

/**
 * Die Uebersetzung nach WebAudio - und sonst nichts.
 *
 * **Diese Datei hat bewusst keinen Test.** In node gibt es keinen
 * `AudioContext`; ein nachgebauter prueft den Nachbau. Deshalb liegt alles, was
 * entscheidet, darueber (`cueFor`, `situation`, `voices`, `settings`) und ist
 * dort geprueft - hier bleibt Verdrahtung, damit ihr Ungeprueftsein billig ist.
 * Nachgesehen wird sie im Browser, mit Ohren.
 *
 * Der Kontext entsteht **beim ersten Klang**, nicht beim Laden: Browser geben
 * Audio erst nach einer Nutzergeste frei, und ein vorher gebauter Kontext
 * startet suspendiert und schreibt eine Warnung in die Konsole.
 */
export interface Engine {
  readonly play: (sound: Sound) => void;
  readonly apply: (settings: AudioSettings) => void;
  readonly close: () => void;
}

/** Wie viele Stimmen gleichzeitig - darueber wird es eine Wand statt eines Spiels. */
const MAX_VOICES = 8;
/** Derselbe Cue zweimal innerhalb dieser Spanne ist einmal zu viel. */
const DEDUPE_MS = 60;

export function createEngine(): Engine {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  let settings: AudioSettings | null = null;

  const buffers = new Map<string, AudioBuffer>();
  const lastPlayed = new Map<string, number>();
  let voices = 0;

  const ensure = (): boolean => {
    if (context !== null) return true;

    // Safari kennt nur den praefixierten Namen.
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) return false;

    context = new Ctor();
    master = context.createGain();
    sfx = context.createGain();
    music = context.createGain();
    master.connect(context.destination);
    sfx.connect(master);
    music.connect(master);
    if (settings !== null) apply(settings);

    return true;
  };

  const apply = (next: AudioSettings): void => {
    settings = next;
    if (context === null || master === null || sfx === null || music === null) return;

    const level = (bus: { level: number; muted: boolean }): number => (bus.muted ? 0 : bus.level);
    // Kurze Rampe statt Sprung: ein harter Gain-Wechsel knackt hoerbar.
    const at = context.currentTime;
    master.gain.setTargetAtTime(level(next.master), at, 0.02);
    sfx.gain.setTargetAtTime(level(next.sfx), at, 0.02);
    music.gain.setTargetAtTime(level(next.music), at, 0.02);
  };

  const noiseBuffer = (ctx: AudioContext, ms: number): AudioBuffer => {
    const frames = Math.max(1, Math.ceil((ctx.sampleRate * ms) / 1000));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  };

  const playLayer = (ctx: AudioContext, target: GainNode, layer: Layer, gain: number): void => {
    const start = ctx.currentTime + (layer.at ?? 0) / 1000;
    const attack = (layer.attack ?? 2) / 1000;
    const decay = layer.decay / 1000;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(layer.gain * gain, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    envelope.connect(target);

    if (layer.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      osc.frequency.setValueAtTime(layer.from, start);
      if (layer.to !== undefined) osc.frequency.exponentialRampToValueAtTime(layer.to, start + attack + decay);
      osc.connect(envelope);
      osc.start(start);
      osc.stop(start + attack + decay + 0.02);
      osc.onended = () => {
        envelope.disconnect();
        voices -= 1;
      };
    } else {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, (layer.at ?? 0) + attack * 1000 + layer.decay + 20);
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter;
      filter.frequency.setValueAtTime(layer.from, start);
      if (layer.to !== undefined) filter.frequency.exponentialRampToValueAtTime(layer.to, start + attack + decay);
      if (layer.q !== undefined) filter.Q.setValueAtTime(layer.q, start);
      source.connect(filter);
      filter.connect(envelope);
      source.start(start);
      source.stop(start + attack + decay + 0.02);
      source.onended = () => {
        filter.disconnect();
        envelope.disconnect();
        voices -= 1;
      };
    }

    voices += 1;
  };

  const playSample = (ctx: AudioContext, target: GainNode, buffer: AudioBuffer, gain: number): void => {
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, ctx.currentTime);
    envelope.connect(target);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(envelope);
    source.start();
    source.onended = () => {
      envelope.disconnect();
      voices -= 1;
    };
    voices += 1;
  };

  const load = (ctx: AudioContext, cue: string, url: string): void => {
    // Nebenlaeufig und ohne Anspruch: klappt es, ersetzt das Sample beim
    // naechsten Mal die Synthese. Klappt es nicht, bleibt es bei der Synthese -
    // fuer immer, ohne Fehlermeldung an den Spieler.
    void fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(url))))
      .then((raw) => ctx.decodeAudioData(raw))
      .then((buffer) => {
        buffers.set(cue, buffer);
      })
      .catch(() => {
        buffers.delete(cue);
      });
  };

  const play = (sound: Sound): void => {
    if (!ensure() || context === null || sfx === null) return;
    if (settings !== null && (settings.master.muted || settings.sfx.muted)) return;

    const now = context.currentTime * 1000;
    const last = lastPlayed.get(sound.cue);
    if (last !== undefined && now - last < DEDUPE_MS) return;
    lastPlayed.set(sound.cue, now);

    if (voices >= MAX_VOICES) return;
    if (context.state === 'suspended') void context.resume();

    const url = SAMPLES[sound.cue];
    if (url !== undefined) {
      const buffer = buffers.get(sound.cue);
      if (buffer !== undefined) {
        playSample(context, sfx, buffer, sound.gain);
        return;
      }
      load(context, sound.cue, url);
      // Kein Warten: bis das Sample da ist, klingt die Synthese.
    }

    for (const layer of recipeFor(sound).layers) playLayer(context, sfx, layer, sound.gain);
  };

  const close = (): void => {
    void context?.close();
    context = null;
    master = null;
    sfx = null;
    music = null;
    buffers.clear();
    lastPlayed.clear();
    voices = 0;
  };

  return { play, apply, close };
}
```

- [ ] **Step 2: Typprüfung statt Test**

Run: `pnpm -w typecheck`
Expected: keine Fehler. (Task 7 muss dafuer fertig sein — sie liefert
`AudioSettings`.)

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/audio/engine.ts
git commit -m "Die Engine: Rezepte nach WebAudio uebersetzen, mehr tut sie nicht"
```

---

### Task 7: Die Einstellungen

**Files:**
- Create: `apps/client/src/audio/settings.ts`
- Test: `apps/client/src/audio/settings.test.ts`

**Interfaces:**
- Produces: `type Bus = 'master' | 'sfx' | 'music'`,
  `interface BusSetting { level: number; muted: boolean }`,
  `type AudioSettings = Record<Bus, BusSetting>`, `DEFAULT_AUDIO`,
  `parseAudioSettings(raw: string | null): AudioSettings`,
  `loadAudioSettings(): AudioSettings`, `storeAudioSettings(settings: AudioSettings): void`

- [ ] **Step 1: Write the failing test**

`apps/client/src/audio/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO, parseAudioSettings } from './settings';

describe('parseAudioSettings', () => {
  it('nimmt die Voreinstellungen, wenn nichts gespeichert ist', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO);
  });

  it('ueberlebt Unsinn im Speicher', () => {
    expect(parseAudioSettings('das ist kein JSON')).toEqual(DEFAULT_AUDIO);
    expect(parseAudioSettings('null')).toEqual(DEFAULT_AUDIO);
    expect(parseAudioSettings('[1,2,3]')).toEqual(DEFAULT_AUDIO);
  });

  it('liest, was da ist, und ergaenzt, was fehlt', () => {
    const parsed = parseAudioSettings(JSON.stringify({ sfx: { level: 0.5, muted: true } }));

    expect(parsed.sfx).toEqual({ level: 0.5, muted: true });
    expect(parsed.master).toEqual(DEFAULT_AUDIO.master);
  });

  it('haelt jede Lautstaerke zwischen null und eins', () => {
    const parsed = parseAudioSettings(
      JSON.stringify({ master: { level: 4 }, sfx: { level: -2 }, music: { level: 'laut' } }),
    );

    expect(parsed.master.level).toBe(1);
    expect(parsed.sfx.level).toBe(0);
    expect(parsed.music.level).toBe(DEFAULT_AUDIO.music.level);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/settings.test.ts`
Expected: FAIL — Modul `./settings` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/audio/settings.ts`:

```ts
/**
 * Die drei Lautstaerken, gespeichert wie das Sitzungsgeheimnis: duldsam.
 *
 * Der Speicher wirft in einem privaten Fenster schon beim Lesen (siehe
 * `net/session.ts`), und ein kaputter Inhalt darf das Spiel nicht anhalten -
 * ohne Einstellungen gilt eben die Voreinstellung. Deshalb ist das Rechnende
 * (`parseAudioSettings`) von der Ablage getrennt: die Entscheidung ist im
 * node-Test pruefbar, der Speicherzugriff braucht keinen.
 */
const KEY = 'conquerist.audio';

export type Bus = 'master' | 'sfx' | 'music';

export interface BusSetting {
  /** 0 bis 1. */
  readonly level: number;
  readonly muted: boolean;
}

export type AudioSettings = Record<Bus, BusSetting>;

export const DEFAULT_AUDIO: AudioSettings = {
  master: { level: 0.7, muted: false },
  sfx: { level: 1, muted: false },
  music: { level: 0.7, muted: false },
};

const BUSES: readonly Bus[] = ['master', 'sfx', 'music'];

export function parseAudioSettings(raw: string | null): AudioSettings {
  if (raw === null) return DEFAULT_AUDIO;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_AUDIO;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_AUDIO;

  const source = parsed as Record<string, unknown>;
  const result = {} as Record<Bus, BusSetting>;

  for (const bus of BUSES) {
    const entry = source[bus];
    const fallback = DEFAULT_AUDIO[bus];

    if (typeof entry !== 'object' || entry === null) {
      result[bus] = fallback;
      continue;
    }

    const { level, muted } = entry as { level?: unknown; muted?: unknown };

    result[bus] = {
      level:
        typeof level === 'number' && Number.isFinite(level)
          ? Math.min(1, Math.max(0, level))
          : fallback.level,
      muted: typeof muted === 'boolean' ? muted : fallback.muted,
    };
  }

  return result;
}

export function loadAudioSettings(): AudioSettings {
  try {
    return parseAudioSettings(window.localStorage.getItem(KEY));
  } catch {
    return DEFAULT_AUDIO;
  }
}

export function storeAudioSettings(settings: AudioSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Kein Speicher, keine Erinnerung. Das ist eine Einbusse, kein Fehler.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/audio/settings.ts apps/client/src/audio/settings.test.ts
git commit -m "Drei Lautstaerken, duldsam gelesen und ohne Anspruch gespeichert"
```

---

### Task 8: Der Klang landet im Zustand

Beide Reduzierer bekommen ein Feld neben `log`. Sie bleiben rein — abgespielt
wird erst in Task 9.

**Files:**
- Modify: `apps/client/src/game/hotseat.ts:19-25`, `:56-67`
- Modify: `apps/client/src/game/onlineState.ts:16-46`, `:71-88`
- Test: `apps/client/src/game/hotseat.test.ts`, `apps/client/src/game/onlineState.test.ts`

**Interfaces:**
- Consumes: `cueFor`, `situationFromGame`, `situationFromView`, `SoundEvent` (Task 3)
- Produces: `HotseatState.sound: SoundEvent | null`, `OnlineState.sound: SoundEvent | null`

- [ ] **Step 1: Write the failing test**

In `apps/client/src/game/hotseat.test.ts` anhaengen:

```ts
it('legt den Klang zum Zug ab und zaehlt ihn hoch', () => {
  const start = startHotseat(aRunningGame());

  const after = hotseatReducer(start, { type: 'apply', action: aBuildRoad(start.game) }, seats);

  expect(after.sound?.sounds.map((sound) => sound.cue)).toEqual(['build.road']);
  expect(after.sound?.seq).toBe(1);
});

it('laesst den letzten Klang stehen, wenn ein Zug abgelehnt wird', () => {
  const start = startHotseat(aRunningGame());
  const built = hotseatReducer(start, { type: 'apply', action: aBuildRoad(start.game) }, seats);

  const rejected = hotseatReducer(built, { type: 'apply', action: anIllegalMove() }, seats);

  // Kein neuer Klang, aber auch kein Ruecksetzen - sonst spielte der alte
  // Klang beim naechsten gueltigen Zug ein zweites Mal.
  expect(rejected.sound).toBe(built.sound);
});
```

In `apps/client/src/game/onlineState.test.ts` anhaengen:

```ts
it('macht aus dem gemeldeten Zug einen Klang', () => {
  const state = onlineReducer(emptyOnlineState, {
    type: 'game',
    payload: { ...aGameEvent(), move: { type: 'buildCity', actor: 'u2' } },
  });

  expect(state.sound?.sounds.map((sound) => sound.cue)).toEqual(['build.city']);
  expect(state.sound?.seq).toBe(aGameEvent().version);
});

it('bleibt still, wenn kein Zug gemeldet wurde', () => {
  const state = onlineReducer(emptyOnlineState, { type: 'game', payload: aGameEvent() });

  expect(state.sound).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client test -- --run src/game/hotseat.test.ts src/game/onlineState.test.ts`
Expected: FAIL — `sound` existiert nicht auf dem Zustand.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/game/hotseat.ts` — Imports, Typ und Reduzierer:

```ts
import { cueFor } from '../audio/cueFor';
import type { SoundEvent } from '../audio/cues';
import { situationFromGame } from '../audio/situation';
```

Der Klang steht im Zustand und nicht in einem Aufruf, damit der Reducer rein
bleibt (Regel 2): abgespielt wird an der Kante, geprueft wird hier.

In `HotseatState` ergaenzen:

```ts
  readonly sound: SoundEvent | null;
```

In `startHotseat`: `return { game, actions: [], log: [], lastError: null, sound: null };`

Im Erfolgszweig von `hotseatReducer`:

```ts
  const sounds = cueFor(
    { type: event.action.type, actor: event.action.player },
    situationFromGame(state.game, result.state, event.action),
  );

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
    // Ein stiller Zug laesst den alten Eintrag stehen; er ist laengst gespielt,
    // und ein Ruecksetzen auf null waere ein zweiter Anlass fuer denselben Klang.
    sound: sounds.length === 0 ? state.sound : { seq: state.actions.length + 1, sounds },
  };
```

`apps/client/src/game/onlineState.ts` — analog:

```ts
import { cueFor } from '../audio/cueFor';
import type { SoundEvent } from '../audio/cues';
import { situationFromView } from '../audio/situation';
```

In `OnlineState`: `readonly sound: SoundEvent | null;`
In `emptyOnlineState`: `sound: null,`

Im `game`-Zweig, nach der Versionsprüfung:

```ts
      const move = event.payload.move;
      const sounds =
        move === undefined
          ? []
          : cueFor(move, situationFromView(state.view, event.payload.view, move));
```

und im zurueckgegebenen Objekt:

```ts
        sound: sounds.length === 0 ? state.sound : { seq: event.payload.version, sounds },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client test` — Expected: PASS (auch die
bestehenden Reduzierer-Tests; sie vergleichen ganze Zustandsobjekte und muessen
das neue Feld ggf. mitfuehren)

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/game
git commit -m "Der Klang zum Zug steht im Zustand, nicht in einem Nebeneffekt"
```

---

### Task 9: Der Ton-Kontext und der delegierte Klick

Hier wird zum ersten Mal wirklich etwas hoerbar.

**Files:**
- Create: `apps/client/src/audio/useAudio.tsx`
- Test: `apps/client/src/audio/useAudio.test.tsx`

**Interfaces:**
- Consumes: `createEngine`, `loadAudioSettings`, `storeAudioSettings`, `SoundEvent`
- Produces: `<AudioProvider>`, `useAudio(): { settings, setBus, play }`,
  `useCueSound(event: SoundEvent | null): void`

- [ ] **Step 1: Write the failing test**

`apps/client/src/audio/useAudio.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { AudioProvider, useAudio, useCueSound } from './useAudio';
import type { SoundEvent } from './cues';

// Die Engine wird ersetzt: geprueft wird, **was** gespielt werden soll, nicht
// ob WebAudio funktioniert - das gibt es in jsdom nicht.
const played: string[] = [];
vi.mock('./engine', () => ({
  createEngine: () => ({
    play: (sound: { cue: string }) => played.push(sound.cue),
    apply: () => {},
    close: () => {},
  }),
}));

function Harness({ event }: { event: SoundEvent | null }): JSX.Element {
  useCueSound(event);
  return (
    <>
      <button type="button">Bauen</button>
      <button type="button" disabled>
        Gesperrt
      </button>
      <button type="button" data-sound="confirm">
        Zusagen
      </button>
    </>
  );
}

describe('der delegierte Klick', () => {
  it('macht aus jedem Knopfdruck einen Klang', async () => {
    played.length = 0;
    render(
      <AudioProvider>
        <Harness event={null} />
      </AudioProvider>,
    );

    await userEvent.click(screen.getByText('Bauen'));

    expect(played).toEqual(['ui.click']);
  });

  it('laesst einen gesperrten Knopf stumm', async () => {
    played.length = 0;
    render(
      <AudioProvider>
        <Harness event={null} />
      </AudioProvider>,
    );

    await userEvent.click(screen.getByText('Gesperrt'));

    expect(played).toEqual([]);
  });

  it('laesst data-sound den Vorgabeklang schlagen', async () => {
    played.length = 0;
    render(
      <AudioProvider>
        <Harness event={null} />
      </AudioProvider>,
    );

    await userEvent.click(screen.getByText('Zusagen'));

    expect(played).toEqual(['ui.confirm']);
  });
});

describe('useCueSound', () => {
  it('spielt einen neuen Klang genau einmal', () => {
    played.length = 0;
    const event: SoundEvent = { seq: 1, sounds: [{ cue: 'build.city', gain: 1 }] };
    const { rerender } = render(
      <AudioProvider>
        <Harness event={event} />
      </AudioProvider>,
    );

    // Zweites Rendern mit derselben `seq` - im StrictMode passiert genau das,
    // und ohne die Sperre klaenge jeder Zug doppelt.
    rerender(
      <AudioProvider>
        <Harness event={event} />
      </AudioProvider>,
    );

    expect(played).toEqual(['build.city']);
  });

  it('spielt denselben Klang wieder, wenn er neu ausgeloest wurde', () => {
    played.length = 0;
    const { rerender } = render(
      <AudioProvider>
        <Harness event={{ seq: 1, sounds: [{ cue: 'build.road', gain: 1 }] }} />
      </AudioProvider>,
    );
    rerender(
      <AudioProvider>
        <Harness event={{ seq: 2, sounds: [{ cue: 'build.road', gain: 1 }] }} />
      </AudioProvider>,
    );

    expect(played).toEqual(['build.road', 'build.road']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/useAudio.test.tsx`
Expected: FAIL — Modul `./useAudio` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/audio/useAudio.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { CUES, type Cue, type Sound, type SoundEvent } from './cues';
import { createEngine } from './engine';
import {
  DEFAULT_AUDIO,
  loadAudioSettings,
  storeAudioSettings,
  type AudioSettings,
  type Bus,
} from './settings';

interface AudioApi {
  readonly settings: AudioSettings;
  readonly setBus: (bus: Bus, next: { level?: number; muted?: boolean }) => void;
  readonly play: (sound: Sound) => void;
}

const AudioContextValue = createContext<AudioApi | null>(null);

/**
 * Ton fuer die ganze Anwendung.
 *
 * Der delegierte Klick sitzt hier und nicht an hundert Knoepfen: ein Listener
 * am Fenster, `closest('button')`, fertig. Wer einen anderen Klang will,
 * schreibt `data-sound="confirm"` ans Element - das ist die einzige Stelle, an
 * der eine Komponente je von Ton erfaehrt.
 */
export function AudioProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO);
  const engine = useMemo(() => createEngine(), []);

  // Erst nach dem Einhaengen lesen: `loadAudioSettings` fasst `window` an.
  useEffect(() => {
    setSettings(loadAudioSettings());
  }, []);

  useEffect(() => {
    engine.apply(settings);
  }, [engine, settings]);

  useEffect(() => {
    return () => {
      engine.close();
    };
  }, [engine]);

  const play = useCallback(
    (sound: Sound) => {
      engine.play(sound);
    },
    [engine],
  );

  const setBus = useCallback((bus: Bus, next: { level?: number; muted?: boolean }) => {
    setSettings((current) => {
      const updated: AudioSettings = { ...current, [bus]: { ...current[bus], ...next } };
      storeAudioSettings(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    const onDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest('button, [role="button"]');
      if (button === null) return;
      if (button instanceof HTMLButtonElement && button.disabled) return;
      if (button.getAttribute('aria-disabled') === 'true') return;

      play({ cue: cueOf(button.getAttribute('data-sound')), gain: 1 });
    };

    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('pointerdown', onDown);
    };
  }, [play]);

  const api = useMemo<AudioApi>(() => ({ settings, setBus, play }), [settings, setBus, play]);

  return <AudioContextValue.Provider value={api}>{children}</AudioContextValue.Provider>;
}

/** `data-sound="confirm"` meint `ui.confirm`; alles Unbekannte bleibt der Klick. */
function cueOf(attribute: string | null): Cue {
  if (attribute === null) return 'ui.click';
  const candidate = `ui.${attribute}`;
  return (CUES as readonly string[]).includes(candidate) ? (candidate as Cue) : 'ui.click';
}

export function useAudio(): AudioApi {
  const api = useContext(AudioContextValue);
  if (api === null) throw new Error('useAudio: kein AudioProvider im Baum');
  return api;
}

/**
 * Spielt, was der Reducer abgelegt hat - jede `seq` genau einmal.
 *
 * Die Sperre ist keine Vorsicht, sondern Notwendigkeit: `main.tsx` laeuft mit
 * `StrictMode`, und der laesst jeden Effekt in der Entwicklung doppelt laufen.
 * Ohne sie klaenge in der Entwicklung jeder Zug zweimal, und man suchte den
 * Fehler im Klang statt im Effekt.
 */
export function useCueSound(event: SoundEvent | null): void {
  const { play } = useAudio();
  const lastSeq = useRef<number | null>(null);

  useEffect(() => {
    if (event === null || event.seq === lastSeq.current) return;
    lastSeq.current = event.seq;
    for (const sound of event.sounds) play(sound);
  }, [event, play]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client test -- --run src/audio/useAudio.test.tsx`
Expected: PASS (5 Tests)

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/audio
git commit -m "Ein Listener fuer hundert Knoepfe, und eine Sperre gegen den doppelten Effekt"
```

---

### Task 10: Der Einstellungen-Dialog und das Zahnrad

**Files:**
- Create: `apps/client/src/dialogs/SettingsDialog.tsx`
- Create: `apps/client/src/screens/SettingsButton.tsx`
- Modify: `apps/client/src/index.css` (neuer Abschnitt; `.corner` bekommt Platz)
- Test: `apps/client/src/dialogs/settings.test.tsx`

**Interfaces:**
- Consumes: `useAudio`, `AudioSettings`, `Bus`, `CloseButton`
- Produces: `<SettingsDialog onClose />`, `<SettingsButton />`

- [ ] **Step 1: Write the failing test**

`apps/client/src/dialogs/settings.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, userEvent } from '../test/dom';
import { AudioProvider } from '../audio/useAudio';
import { SettingsButton } from '../screens/SettingsButton';

vi.mock('../audio/engine', () => ({
  createEngine: () => ({ play: () => {}, apply: () => {}, close: () => {} }),
}));

const openSettings = async (): Promise<void> => {
  render(
    <AudioProvider>
      <SettingsButton />
    </AudioProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
};

describe('Einstellungen', () => {
  it('zeigt drei Regler mit ihren Namen', async () => {
    await openSettings();

    expect(screen.getByRole('slider', { name: 'Gesamt' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Effekte' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Musik' })).toBeDefined();
  });

  it('bewegt einen Regler und zeigt den Wert an', async () => {
    await openSettings();

    fireEvent.change(screen.getByRole('slider', { name: 'Effekte' }), { target: { value: '40' } });

    expect(screen.getByText('40 %')).toBeDefined();
  });

  it('schaltet stumm, ohne den Wert zu verlieren', async () => {
    await openSettings();
    fireEvent.change(screen.getByRole('slider', { name: 'Gesamt' }), { target: { value: '55' } });

    const mute = screen.getByRole('button', { name: 'Gesamt stummschalten' });
    await userEvent.click(mute);

    expect(mute.getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('slider', { name: 'Gesamt' }) as HTMLInputElement).value).toBe('55');
  });

  it('merkt sich die Werte ueber das Schliessen hinaus', async () => {
    await openSettings();
    fireEvent.change(screen.getByRole('slider', { name: 'Musik' }), { target: { value: '20' } });
    await userEvent.click(screen.getByTestId('modal-close'));
    await userEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));

    expect((screen.getByRole('slider', { name: 'Musik' }) as HTMLInputElement).value).toBe('20');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client test -- --run src/dialogs/settings.test.tsx`
Expected: FAIL — `SettingsButton` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/dialogs/SettingsDialog.tsx`:

```tsx
import type { JSX } from 'react';
import { useAudio } from '../audio/useAudio';
import type { Bus } from '../audio/settings';
import { CloseButton } from './CloseButton';

/**
 * Einstellungen - heute nur Ton, aber der Ort ist der Punkt.
 *
 * Alles bisher Einstellbare haengt an dem Bildschirm, auf dem es gebraucht
 * wird. Lautstaerke gilt ueberall, also braucht sie eine Stelle, die auch
 * ueberall erreichbar ist. Weitere Abschnitte kommen hier dazu, nicht daneben.
 */
const ROWS: readonly { readonly bus: Bus; readonly label: string }[] = [
  { bus: 'master', label: 'Gesamt' },
  { bus: 'sfx', label: 'Effekte' },
  { bus: 'music', label: 'Musik' },
];

export function SettingsDialog({ onClose }: { readonly onClose: () => void }): JSX.Element {
  const { settings, setBus } = useAudio();

  return (
    <div className="modal" role="dialog" aria-label="Einstellungen">
      <div className="modal__box">
        <CloseButton onClose={onClose} label="Einstellungen" />
        <h2>Einstellungen</h2>

        <h3 className="settings__group">Ton</h3>
        {ROWS.map(({ bus, label }) => {
          const setting = settings[bus];
          const percent = Math.round(setting.level * 100);

          return (
            <div key={bus} className="settings__row">
              <button
                type="button"
                className="settings__mute"
                aria-pressed={setting.muted}
                aria-label={`${label} stummschalten`}
                onClick={() => setBus(bus, { muted: !setting.muted })}
              >
                {/* Zwei Zustaende, zwei Formen - Farbe allein traegt hier nichts. */}
                <svg viewBox="-8 -8 16 16" aria-hidden="true">
                  <path d="M -5 -2.5 L -2.5 -2.5 L 0.5 -5.5 L 0.5 5.5 L -2.5 2.5 L -5 2.5 Z" />
                  {setting.muted ? (
                    <path d="M 3 -3 L 6.5 3 M 6.5 -3 L 3 3" />
                  ) : (
                    <path d="M 3 -3 A 4 4 0 0 1 3 3" fill="none" />
                  )}
                </svg>
              </button>

              <label className="settings__label" htmlFor={`volume-${bus}`}>
                {label}
              </label>
              <input
                id={`volume-${bus}`}
                className="settings__slider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                aria-label={label}
                onChange={(event) => setBus(bus, { level: Number(event.target.value) / 100 })}
              />
              <span className="settings__value">{percent} %</span>
            </div>
          );
        })}

        <p className="modal__hint">
          Musik gibt es noch nicht — der Regler wartet auf sie.
        </p>
      </div>
    </div>
  );
}
```

`apps/client/src/screens/SettingsButton.tsx`:

```tsx
import { useState, type JSX } from 'react';
import { SettingsDialog } from '../dialogs/SettingsDialog';

/**
 * Ein Zahnrad fuer alle Bildschirme.
 *
 * Fest verankert oben rechts, ueber der Konto-Ecke - deshalb bekommt `.corner`
 * in `index.css` rechts Platz reserviert. Ein Einbauort statt drei: der Knopf
 * haengt in `App.tsx` neben dem Konto-Dialog und ist damit ueberall da, wo
 * ueberhaupt etwas gerendert wird.
 */
export function SettingsButton(): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="settings-button"
        aria-label="Einstellungen"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="-12 -12 24 24" aria-hidden="true">
          <circle cx="0" cy="0" r="3.4" />
          <path d="M 0 -9 L 0 -6 M 0 6 L 0 9 M -9 0 L -6 0 M 6 0 L 9 0 M -6.4 -6.4 L -4.2 -4.2 M 4.2 4.2 L 6.4 6.4 M 6.4 -6.4 L 4.2 -4.2 M -4.2 4.2 L -6.4 6.4" />
        </svg>
      </button>
      {open ? <SettingsDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
```

`apps/client/src/index.css` — neuer Abschnitt ans Ende, und `.corner` bekommt
Platz. Bei `.corner` (Zeile ~522) das `padding` aendern:

```css
  /* Rechts liegt seit dem Ton das Zahnrad fest verankert. Ohne diesen Platz
     laege „Abmelden" darunter - im schmalen Fenster, wo die Ecke umbricht,
     sogar zweizeilig. */
  padding: 1.1rem 3.6rem 1.1rem 1.4rem;
```

und in der Media Query bei `max-width: 26rem`:

```css
    padding: 0.75rem 3rem 0.75rem 0.9rem;
```

Neuer Abschnitt:

```css
/* --- Einstellungen -------------------------------------------------------- */

/*
 * Das Zahnrad sitzt ueber allem und immer an derselben Stelle. Es uebernimmt
 * die Setzung von `.corner__action` - gedaempftes Pergament auf Tiefsee, die
 * dort nachweislich traegt. **Nicht** `.button--ghost`: cream auf Pergament
 * misst 1,05:1 und ist an rund zehn Stellen unsichtbar.
 */
.settings-button {
  position: fixed;
  top: 0.9rem;
  right: 1rem;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--on-sea-muted);
  cursor: pointer;
  transition: color 140ms ease;
}

.settings-button:hover,
.settings-button:focus-visible {
  color: var(--on-sea);
}

.settings-button svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.settings__group {
  margin: 0.4rem 0 0.2rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--on-parchment-muted);
}

.settings__row {
  display: grid;
  grid-template-columns: auto 5.5rem 1fr 3.2rem;
  align-items: center;
  gap: 0.7rem;
  padding: 0.35rem 0;
}

.settings__mute {
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

.settings__mute svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: currentcolor;
  stroke: currentcolor;
  stroke-width: 1.4;
  stroke-linecap: round;
}

.settings__mute[aria-pressed='true'] {
  color: var(--on-parchment-muted);
}

.settings__slider {
  width: 100%;
  accent-color: var(--sea-deep);
}

/* Tabellenziffern, wie ueberall - ein Prozentwert darf beim Schieben nicht
   springen. */
.settings__value {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--on-parchment-muted);
}

@media (max-width: 26rem) {
  .settings__row {
    grid-template-columns: auto 4.5rem 1fr 2.8rem;
    gap: 0.5rem;
  }
}
```

**Achtung:** Die Variablennamen (`--on-sea`, `--on-sea-muted`,
`--on-parchment-muted`, `--sea-deep`) vor dem Schreiben in `index.css`
nachsehen und die tatsaechlich vorhandenen verwenden — kein Hex-Wert in der
Komponente und keine erfundene Variable.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client test -- --run src/dialogs/settings.test.tsx`
Expected: PASS (4 Tests)

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/dialogs/SettingsDialog.tsx apps/client/src/dialogs/settings.test.tsx apps/client/src/screens/SettingsButton.tsx apps/client/src/index.css
git commit -m "Ein Zahnrad oben rechts und drei Regler dahinter"
```

---

### Task 11: Verdrahtung, Browser-Durchlauf, PROGRESS.md

Jetzt erst klingt das Spiel. Bis hierher war alles Vorbereitung.

**Files:**
- Modify: `apps/client/src/App.tsx:31-39`, `:56-69`, `:235-240`
- Modify: `apps/client/src/game/useLocalGame.ts:29-53`
- Modify: `apps/client/src/game/useOnlineGame.ts` (Rueckgabe um `sound` ergaenzen)
- Modify: `PROGRESS.md`
- Modify: `CLAUDE.md` (Abschnitt „Aktueller Stand")

**Interfaces:**
- Consumes: alles aus Task 1-10

- [ ] **Step 1: Den Ton anschliessen**

`apps/client/src/game/useLocalGame.ts` — `LocalGame` um `readonly sound: SoundEvent | null`
ergaenzen und im Rueckgabeobjekt `sound: state.sound` mitgeben.

`apps/client/src/game/useOnlineGame.ts` — dort wird `state` bereits
durchgereicht; `state.sound` ist damit ohne Aenderung erreichbar. Falls die
Rueckgabe die Felder einzeln aufzaehlt, `sound` ergaenzen.

`apps/client/src/App.tsx`:

```tsx
import { AudioProvider, useCueSound } from './audio/useAudio';
import { SettingsButton } from './screens/SettingsButton';

export function App(): JSX.Element {
  const [local, setLocal] = useState<LocalSession | null>(null);

  return (
    <AudioProvider>
      {local === null ? (
        <Online onStartLocal={(game, seats, options) => setLocal({ game, seats, options })} />
      ) : (
        <Local session={local} onLeave={() => setLocal(null)} />
      )}
      <SettingsButton />
    </AudioProvider>
  );
}
```

In `Local`: `const game = useLocalGame(...); useCueSound(game.sound);`
In `Online`: `const online = useOnlineGame(); useCueSound(online.state.sound);`

`SettingsButton` steht **ausserhalb** von `screen`, damit er auf jedem
Bildschirm da ist — auch im Wartebereich und im Spiel.

- [ ] **Step 2: Abnahme fahren**

```bash
pnpm -w typecheck && pnpm -w test && pnpm -w build && pnpm -w format:check
```
Expected: alles gruen.

- [ ] **Step 3: Browser-Durchlauf — mit Ohren**

Der Durchlauf ist **Bedingung, nicht offener Punkt.** `pnpm dev`, dann der
Reihe nach:

1. Erster Klick auf dem Hauptmenue macht Ton; **keine** Autoplay-Warnung in der
   Konsole.
2. Lokale Partie: Gruendung, Wuerfeln, Bauen (Strasse/Siedlung/Stadt), Raeuber,
   Abwerfen, Handel, Entwicklungskarte. Jeder Klang sitzt auf seinem Ereignis
   und nicht daneben; nichts klingt doppelt (StrictMode!).
3. Zwei Fenster online, zwei Konten: fremde Zuege sind hoerbar leiser, ein
   Angebot an mich ist es nicht, „du bist dran" kommt beim Zugwechsel.
4. Dialog: alle drei Regler bewegen, alle drei stumm schalten, neu laden — die
   Werte stehen noch.
5. Das Zahnrad verdeckt auf **keinem** Bildschirm etwas, auch nicht bei 396 px
   (zwei Iframes fester Breite auf derselben Origin, wie beim letzten
   Durchlauf).

Was dabei auffaellt, wird sofort behoben oder ausdruecklich in `PROGRESS.md`
notiert — nicht stillschweigend gelassen.

- [ ] **Step 4: PROGRESS.md und CLAUDE.md fortschreiben**

In `PROGRESS.md` einen Abschnitt zum Ton anhaengen: was gebaut wurde, **warum
der Zugtyp ins Protokoll kam** (der Client bekam bis dahin nur einen deutschen
Satz), warum `engine.ts` keinen Test hat, und was der Browser-Durchlauf
tatsaechlich ergeben hat — mit den Befunden, nicht mit „lief gut".

In `CLAUDE.md` den Abschnitt „Aktueller Stand" um zwei Saetze zum Ton ergaenzen
und in die Fallenliste aufnehmen, was dabei zugeschnappt ist (mindestens: ein
Effekt unter `StrictMode` laeuft doppelt, deshalb die `seq`-Sperre).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Das Spiel klingt: Ton angeschlossen, im Browser nachgehoert"
```

---

## Selbstpruefung des Plans

**Spec-Abdeckung.** Ziel 1 (23 Cues, synthetisiert) → Task 3, 5. Ziel 2
(mp3 ersetzt einzeln, Rueckfall auf Synthese) → Task 5, 6. Ziel 3 (Dialog,
drei Lautstaerken, Stummschalter) → Task 7, 10. Ziel 4 (beide Modi, eine
Implementierung) → Task 3, 4, 8. Ziel 5 (Abstufung online) → Task 3 (`loudness`),
4 (`situationFromView`). Ziel 6 (Browser) → Task 11. Protokoll und
`broadcastGame`-Aufraeumung → Task 1, 2. Vertraeglichkeit (optionales Feld,
keine Migration) → Task 1. Barrierefreiheit (`aria-pressed`, `aria-label`,
sichtbarer Fokus, Ton nie alleiniger Traeger) → Task 10.

**Was der Plan gegenueber der Spec praeziser macht:**
- Die `Situation` hat acht Felder mit festgelegter Bedeutung; die Spec nannte
  sie, ohne jede zu definieren.
- `discard` klingt wie `robber.steal` (Karten verlassen die Hand, derselbe
  Anlass), `respondTrade` neutral wie `ui.confirm` — **was** geantwortet wurde,
  steht nicht im `move`, und ein geratener Klang waere schlimmer als ein
  neutraler.
- Der Ping haengt als `at: 500` im Rezept von `dice.land`, nicht in einem
  Zeitplaner darueber.
- **Neu und in der Spec nicht bedacht:** `main.tsx` laeuft mit `StrictMode`,
  Effekte laufen in der Entwicklung doppelt. Ohne die `seq`-Sperre in
  `useCueSound` klaenge jeder Zug zweimal. Task 9 prueft genau das.
