import { describe, expect, it } from 'vitest';
import { legalActions, setupPlayer } from '@conquerist/shared';
import {
  applyAction,
  configureRoom,
  createRoom,
  joinRoom,
  leaveRoom,
  setConnected,
  startGame,
  type Room,
} from './room.js';

function room(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'raum-probe');
  if (!created.ok) throw new Error(created.error);
  return created.room;
}

function withThree(): Room {
  let current = room();
  for (const [id, name] of [
    ['u2', 'Ben'],
    ['u3', 'Cem'],
  ] as const) {
    const joined = joinRoom(current, id, name);
    if (!joined.ok) throw new Error(joined.error);
    current = joined.room;
  }
  return current;
}

describe('Raum', () => {
  it('setzt den Ersteller auf den ersten Platz und macht ihn zum Host', () => {
    const created = room();
    expect(created.hostId).toBe('u1');
    expect(created.seats).toHaveLength(1);
    expect(created.seats[0]).toMatchObject({ userId: 'u1', name: 'Anna', connected: true });
    expect(created.game).toBeNull();
  });

  it('vergibt Farben in der Reihenfolge des Beitritts', () => {
    const full = withThree();
    expect(new Set(full.seats.map((seat) => seat.color)).size).toBe(3);
  });

  it('laesst niemanden zweimal beitreten, sondern erkennt ihn wieder', () => {
    const again = joinRoom(withThree(), 'u2', 'Ben');
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.room.seats).toHaveLength(3);
  });

  it('weist ab, wenn der Tisch voll ist', () => {
    const result = joinRoom(withThree(), 'u4', 'Dana');
    expect(result.ok).toBe(false);
  });

  it('startet nur auf Wunsch des Hosts', () => {
    const full = withThree();
    expect(startGame(full, 'u2').ok).toBe(false);

    const started = startGame(full, 'u1');
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.room.game).not.toBeNull();
      expect(started.room.version).toBeGreaterThan(full.version);
    }
  });

  it('startet nicht mit unvollstaendigem Tisch', () => {
    expect(startGame(room(), 'u1').ok).toBe(false);
  });

  it('nimmt einen Zug nur vom richtigen Spieler an', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const running = started.room;
    const game = running.game!;

    const first = legalActions(game, setupPlayer(game)!)[0]!;
    const wrongPlayer = running.seats.find((seat) => seat.userId !== setupPlayer(game))!;

    // Fremder Zug: abgelehnt, Zustand unveraendert.
    const rejected = applyAction(running, wrongPlayer.userId, first);
    expect(rejected.ok).toBe(false);

    const accepted = applyAction(running, setupPlayer(game)!, first);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.room.version).toBe(running.version + 1);
  });

  it('laesst den Host die Partie im Wartebereich noch umstellen', () => {
    const changed = configureRoom(room(), 'u1', 5, 'anderer-seed');

    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.room.seatCount).toBe(5);
      expect(changed.room.seed).toBe('anderer-seed');
      expect(changed.room.version).toBeGreaterThan(room().version);
    }
  });

  it('laesst nur den Host umstellen', () => {
    expect(configureRoom(withThree(), 'u2', 6, 'egal').ok).toBe(false);
  });

  it('macht den Tisch nicht kleiner als die Zahl derer, die schon sitzen', () => {
    // Sonst muesste jemand seinen Platz raeumen, den er schon hat - und der
    // Wartebereich waere der falsche Ort, das zu entscheiden.
    expect(configureRoom(withThree(), 'u1', 3, 'raum-probe').ok).toBe(true);
    const shrunk = configureRoom(withThree(), 'u1', 2, 'raum-probe');
    expect(shrunk.ok).toBe(false);
  });

  it('weist eine Tischgroesse ohne passendes Brett zurueck', () => {
    expect(configureRoom(room(), 'u1', 7, 'raum-probe').ok).toBe(false);
  });

  it('stellt eine laufende Partie nicht mehr um', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);

    expect(configureRoom(started.room, 'u1', 4, 'zu-spaet').ok).toBe(false);
  });

  it('behaelt den Platz, wenn die Verbindung abbricht', () => {
    const gone = setConnected(withThree(), 'u2', false);
    expect(gone.seats).toHaveLength(3);
    expect(gone.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(false);
  });

  it('gibt einen Platz im Wartebereich frei, aber nicht in der laufenden Partie', () => {
    const waiting = leaveRoom(withThree(), 'u2');
    expect(waiting.seats).toHaveLength(2);

    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const afterLeave = leaveRoom(started.room, 'u2');
    expect(afterLeave.seats).toHaveLength(3);
    expect(afterLeave.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(false);
  });
});
