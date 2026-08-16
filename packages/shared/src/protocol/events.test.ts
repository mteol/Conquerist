import { describe, expect, it } from 'vitest';
import { TEST_PLAYERS, testGame } from '../game/fixtures.js';
import { playerViewOf } from '../game/playerView.js';
import type { Seat } from '../seats.js';
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

  it('traegt den Zug, wenn einer geschehen ist - und bleibt ohne ihn gueltig', () => {
    const schema = eventSchema(GAME_EVENT);
    const seats: readonly Seat[] = TEST_PLAYERS.map((id, index) => ({
      id,
      name: `Spieler ${index + 1}`,
      color: '#c0392b',
    }));
    const base = {
      version: 3,
      view: playerViewOf(testGame(), TEST_PLAYERS[0], seats, 3),
      actions: [],
      sentAt: 1_700_000_000_000,
    };

    const withMove = schema.safeParse({
      ...base,
      entry: 'Spieler 1 baut eine Stadt',
      move: { type: 'buildCity', actor: TEST_PLAYERS[0] },
    });
    expect(withMove.success).toBe(true);
    expect(withMove.success && withMove.data.move?.type).toBe('buildCity');

    // Ein Stand ohne Zug gibt es weiterhin: Beitritt, Start, Reconnect.
    expect(schema.safeParse(base).success).toBe(true);

    // Ein erfundener Zugtyp kommt nicht durch - sonst waere das Feld ein
    // beliebiger String und der Empfaenger muesste raten.
    expect(
      schema.safeParse({ ...base, move: { type: 'buildCastle', actor: TEST_PLAYERS[0] } }).success,
    ).toBe(false);
  });
});
