import { describe, expect, it, vi } from 'vitest';
import { GAME_EVENT, ROOM_EVENT } from '@conquerist/shared';
import { broadcastGame, broadcastRoom } from './broadcast.js';
import { createRoom, joinRoom, startGame, type Room } from './room.js';
import type { EventSink } from '../ws/events.js';

function runningRoom(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'sende-probe');
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

  const started = startGame(room, 'u1');
  if (!started.ok) throw new Error(started.error);
  return started.room;
}

function sinks(ids: readonly string[]): Map<string, EventSink[]> {
  return new Map(ids.map((id) => [id, [{ send: vi.fn() } as unknown as EventSink]]));
}

describe('Zustellung', () => {
  it('schickt jedem Spieler eine eigene Sicht', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets);

    for (const [userId, list] of targets) {
      const send = list[0]!.send as unknown as ReturnType<typeof vi.fn>;
      expect(send).toHaveBeenCalledTimes(1);

      const [type, payload] = send.mock.calls[0]!;
      expect(type).toBe(GAME_EVENT);
      expect(payload.view.you).toBe(userId);
    }
  });

  it('zeigt niemandem fremde Handkarten', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets);

    const send = targets.get('u2')![0]!.send as unknown as ReturnType<typeof vi.fn>;
    const payload = send.mock.calls[0]![1];

    for (const player of payload.view.players) {
      if (player.id === 'u2') expect(player.resources).not.toBeNull();
      else expect(player.resources).toBeNull();
    }
    expect(JSON.stringify(payload)).not.toContain('"rng"');
  });

  it('schickt jedem nur seine eigenen erlaubten Zuege', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets);

    const withActions = [...targets.values()].filter((list) => {
      const send = list[0]!.send as unknown as ReturnType<typeof vi.fn>;
      return send.mock.calls[0]![1].actions.length > 0;
    });

    // In der Gruendungsphase darf genau einer setzen.
    expect(withActions).toHaveLength(1);
  });

  it('schickt den Raumzustand an alle gleich', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastRoom(room, targets);

    for (const list of targets.values()) {
      const send = list[0]!.send as unknown as ReturnType<typeof vi.fn>;
      expect(send.mock.calls[0]![0]).toBe(ROOM_EVENT);
      expect(send.mock.calls[0]![1].code).toBe('K7X2');
    }
  });
});
