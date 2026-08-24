import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@conquerist/shared';
import { RoomRegistry } from './registry.js';
import { MemoryRoomStore } from './store.js';

describe('Raumverzeichnis', () => {
  it('vergibt Codes aus dem verwechslungsfreien Alphabet', () => {
    const registry = new RoomRegistry();
    const created = registry.create('u1', 'Anna', 3, 'abc', 10);

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

    const first = registry.create('u1', 'Anna', 3, 'abc', 10);
    const second = registry.create('u2', 'Ben', 3, 'abc', 10);

    expect(first.ok && first.room.code).toBe('AAAA');
    expect(second.ok && second.room.code).toBe('BBBB');
  });

  it('findet den Raum eines Spielers', () => {
    const registry = new RoomRegistry();
    const created = registry.create('u1', 'Anna', 3, 'abc', 10);
    if (!created.ok) throw new Error(created.error);

    expect(registry.roomOf('u1')?.code).toBe(created.room.code);
    expect(registry.roomOf('u9')).toBeUndefined();
  });

  it('raeumt leere Raeume nach der Frist weg, volle nicht', () => {
    let clock = 0;
    const registry = new RoomRegistry({ now: () => clock });
    const created = registry.create('u1', 'Anna', 3, 'abc', 10);
    if (!created.ok) throw new Error(created.error);

    registry.update(created.room.code, { ...created.room, seats: [] });
    clock = 10 * 60_000;
    registry.sweep();

    expect(registry.get(created.room.code)).toBeUndefined();
  });

  it('legt jeden Raum im Store ab', () => {
    const store = new MemoryRoomStore();
    const registry = new RoomRegistry({ store });
    const created = registry.create('u1', 'Anna', 3, 'abc', 10);
    if (!created.ok) throw new Error(created.error);

    expect(store.loadAll().map((room) => room.code)).toEqual([created.room.code]);
  });

  it('schreibt den ausloesenden Zug ins Log, aber nur wenn es einen gab', () => {
    const store = new MemoryRoomStore();
    const registry = new RoomRegistry({ store });
    const created = registry.create('u1', 'Anna', 3, 'abc', 10);
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
    const created = registry.create('u1', 'Anna', 3, 'abc', 10);
    if (!created.ok) throw new Error(created.error);

    registry.remove(created.room.code);

    expect(store.loadAll()).toEqual([]);
  });

  it('baut sich aus einem Store wieder auf', () => {
    const store = new MemoryRoomStore();
    const first = new RoomRegistry({ store });
    const created = first.create('u1', 'Anna', 3, 'abc', 10);
    if (!created.ok) throw new Error(created.error);

    const second = RoomRegistry.load(store);

    expect(second.get(created.room.code)?.seed).toBe('abc');
  });

  it('findet alle Raeume, in denen jemand sitzt', () => {
    const registry = new RoomRegistry();
    const first = registry.create('u1', 'Anna', 3, 'abc', 10);
    const second = registry.create('u1', 'Anna', 4, 'def', 10);
    if (!first.ok || !second.ok) throw new Error('Anlegen fehlgeschlagen');

    expect(registry.roomsOf('u1')).toHaveLength(2);
    expect(registry.roomsOf('u9')).toHaveLength(0);
  });

  it('laesst einen Plattenfehler den Betrieb nicht umwerfen', () => {
    const store = new MemoryRoomStore();
    const kaputt = {
      ...store,
      save: () => {
        throw new Error('Platte voll');
      },
      appendAction: store.appendAction.bind(store),
      remove: store.remove.bind(store),
      abandon: store.abandon.bind(store),
      loadAll: store.loadAll.bind(store),
    };
    const seen: string[] = [];
    const registry = new RoomRegistry({
      store: kaputt,
      onWriteError: (code) => seen.push(code),
    });

    // Der Raum entsteht trotzdem - er ist regelgerecht, nur ungesichert.
    const created = registry.create('u1', 'Anna', 3, 'abc', 10);

    expect(created.ok).toBe(true);
    expect(seen).toHaveLength(1);
  });
});
