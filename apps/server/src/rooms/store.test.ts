import { describe, expect, it } from 'vitest';
import type { GameAction } from '@conquerist/shared';
import { MemoryRoomStore } from './store.js';
import { createRoom, joinRoom, type Room } from './room.js';

function room(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'store-probe', 10);
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
