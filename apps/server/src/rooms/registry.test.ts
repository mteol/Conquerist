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
