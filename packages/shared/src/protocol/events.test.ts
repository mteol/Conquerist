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
        victoryPointGoal: 10,
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
