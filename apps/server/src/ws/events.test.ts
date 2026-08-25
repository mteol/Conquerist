import { describe, expect, it, vi } from 'vitest';
import { GAME_EVENT, ROOM_EVENT } from '@conquerist/shared';
import { createEventSender } from './events.js';

const roomPayload = {
  code: 'K7X2',
  hostId: 'u1',
  seatCount: 3,
  seed: 'abc',
  victoryPointGoal: 10,
  variant: 'classic' as const,
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
