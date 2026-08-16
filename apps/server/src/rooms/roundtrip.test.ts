import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SEAT_COLORS, legalActions, setupPlayer } from '@conquerist/shared';
import { openDatabase } from '../db/database.js';
import { Users } from '../identity/users.js';
import { Sessions } from '../identity/sessions.js';
import { RoomRegistry } from './registry.js';
import { SqliteRoomStore } from './sqliteStore.js';
import { applyAction, chooseColor, configureRoom, joinRoom, startGame } from './room.js';

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
    const users = new Users(firstDb, new Sessions(firstDb));
    const ids = ['Anna', 'Ben', 'Cem'].map((name) => users.hello(undefined, name).user.id);
    const first = new RoomRegistry({ store: new SqliteRoomStore(firstDb) });

    const created = first.create(ids[0]!, 'Anna', 3, 'neustart', 10);
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
    const users = new Users(firstDb, new Sessions(firstDb));
    const id = users.hello(undefined, 'Anna').user.id;
    const first = new RoomRegistry({ store: new SqliteRoomStore(firstDb) });
    const created = first.create(id, 'Anna', 4, 'wartend', 10);
    if (!created.ok) throw new Error(created.error);
    firstDb.close();

    const secondDb = openDatabase(path);
    const second = RoomRegistry.load(new SqliteRoomStore(secondDb));

    expect(second.get(created.room.code)?.seatCount).toBe(4);
    expect(second.get(created.room.code)?.game).toBeNull();
    secondDb.close();
  });

  /*
   * Farbe und Ziel sind seit Etappe 10 Entscheidungen und keine Ableitungen -
   * und damit das erste, was ein Neustart verlieren koennte. Vorher folgte die
   * Farbe der Position und das Ziel stand in `CLASSIC_RULES`; beides liess sich
   * nach einem Neustart neu ausrechnen, diese beiden nicht.
   */
  it('behaelt gewaehlte Farbe und eingestelltes Ziel ueber den Neustart', () => {
    const path = file();

    const firstDb = openDatabase(path);
    const users = new Users(firstDb, new Sessions(firstDb));
    const ids = ['Anna', 'Ben'].map((name) => users.hello(undefined, name).user.id);
    const first = new RoomRegistry({ store: new SqliteRoomStore(firstDb) });

    const created = first.create(ids[0]!, 'Anna', 3, 'farbig', 10);
    if (!created.ok) throw new Error(created.error);
    const code = created.room.code;

    const joined = joinRoom(created.room, ids[1]!, 'Ben');
    if (!joined.ok) throw new Error(joined.error);

    const colored = chooseColor(joined.room, ids[1]!, SEAT_COLORS[5]!);
    if (!colored.ok) throw new Error(colored.error);

    const configured = configureRoom(colored.room, ids[0]!, 3, 'farbig', 15);
    if (!configured.ok) throw new Error(configured.error);
    first.update(code, configured.room);
    firstDb.close();

    const secondDb = openDatabase(path);
    const second = RoomRegistry.load(new SqliteRoomStore(secondDb));
    const back = second.get(code);

    expect(back?.victoryPointGoal).toBe(15);
    expect(back?.seats.find((seat) => seat.userId === ids[1])?.color).toBe(SEAT_COLORS[5]);
    secondDb.close();
  });
});
