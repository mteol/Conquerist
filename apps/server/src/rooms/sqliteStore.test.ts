import { describe, expect, it } from 'vitest';
import { legalActions, setupPlayer } from '@conquerist/shared';
import { openDatabase } from '../db/database.js';
import { Users } from '../identity/users.js';
import { Sessions } from '../identity/sessions.js';
import { SqliteRoomStore } from './sqliteStore.js';
import { applyAction, createRoom, joinRoom, startGame, type Room } from './room.js';

/** Drei Gaeste anlegen und ihre Ids zurueckgeben - rooms verweist auf users. */
function withUsers(): { store: SqliteRoomStore; ids: string[] } {
  const database = openDatabase(':memory:');
  const users = new Users(database, new Sessions(database));
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
    store.save(waitingRoom(ids));

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
