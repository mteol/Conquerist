import { describe, expect, it, vi } from 'vitest';
import { GAME_EVENT, ROOM_EVENT, setupPlayer } from '@conquerist/shared';
import { broadcastGame, broadcastRoom } from './broadcast.js';
import { createRoom, joinRoom, setConnected, startGame, type Room } from './room.js';
import type { EventSink } from '../ws/events.js';

function runningRoom(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'sende-probe', 10);
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

  it('gibt die Zuege eines Getrennten an niemand anderen weiter', () => {
    const running = runningRoom();
    const game = running.game!;
    const acting = setupPlayer(game)!;

    // Der, der dran ist, faellt aus der Verbindung.
    const room = setConnected(running, acting, false);
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets);

    // Genau hier steht die Partie: Zuege gibt es nur fuer den, der handeln
    // darf, und sein Ausfall macht daraus keine Zuege fuer die anderen. Es
    // haelt also niemand das Spiel an - es kann schlicht keiner weiterspielen.
    for (const [userId, list] of targets) {
      const send = list[0]!.send as unknown as ReturnType<typeof vi.fn>;
      const payload = send.mock.calls[0]![1];
      expect(payload.actions.length > 0).toBe(userId === acting);
    }
  });

  it('meldet den Getrennten in jeder Sicht als getrennt', () => {
    const running = runningRoom();
    const room = setConnected(running, 'u2', false);
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets);

    const send = targets.get('u1')![0]!.send as unknown as ReturnType<typeof vi.fn>;
    const players = send.mock.calls[0]![1].view.players;

    expect(players.find((entry: { id: string }) => entry.id === 'u2').connected).toBe(false);
    expect(players.find((entry: { id: string }) => entry.id === 'u3').connected).toBe(true);
  });

  it('schickt Satz und Zug, wenn ein Uebergang mitkommt', () => {
    const room = runningRoom();
    const game = room.game!;
    const actor = setupPlayer(game)!;
    const action = {
      type: 'placeSetupSettlement',
      player: actor,
      vertex: 'v:0,0|1,-1|1,0',
    } as const;
    const targets = sinks(['u1', 'u2', 'u3']);

    broadcastGame(room, targets, { before: game, action, after: game });

    for (const list of targets.values()) {
      const send = list[0]!.send as unknown as ReturnType<typeof vi.fn>;
      const payload = send.mock.calls[0]![1];

      // Beides entsteht jetzt hier statt bei vier Aufrufern - und beides
      // beschreibt denselben Zug, es kann also nicht auseinanderlaufen.
      expect(payload.move).toEqual({ type: 'placeSetupSettlement', actor });
      expect(payload.entry).toContain('Gründungssiedlung');
    }
  });

  it('schickt weder Satz noch Zug, wenn keiner mitkommt', () => {
    const room = runningRoom();
    const targets = sinks(['u1', 'u2', 'u3']);

    // Beitritt, Start und Reconnect stellen einen Stand zu, der aus keinem Zug
    // entstanden ist. Ein erfundener Satz dazu waere eine Luege im Verlauf.
    broadcastGame(room, targets);

    const send = targets.get('u1')![0]!.send as unknown as ReturnType<typeof vi.fn>;
    const payload = send.mock.calls[0]![1];

    expect(payload.move).toBeUndefined();
    expect(payload.entry).toBeUndefined();
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
