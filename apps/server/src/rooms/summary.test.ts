import { describe, expect, it } from 'vitest';
import { createRoom, joinRoom, startGame, type Room } from './room.js';
import { summaryOf } from './summary.js';

function full(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'liste-probe');
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
  return room;
}

describe('Zusammenfassung', () => {
  it('nennt den Wartebereich ungestartet und laesst die Runde weg', () => {
    const summary = summaryOf(full(), 'u2');

    expect(summary.started).toBe(false);
    expect(summary.turn).toBeUndefined();
    expect(summary.yourTurn).toBeUndefined();
    expect(summary.seats.map((seat) => seat.name)).toEqual(['Anna', 'Ben', 'Cem']);
  });

  it('sagt bei einer laufenden Partie, wer dran ist', () => {
    const started = startGame(full(), 'u1');
    if (!started.ok) throw new Error(started.error);

    // In der Gruendung setzt der erste Spieler zuerst.
    expect(summaryOf(started.room, 'u1').yourTurn).toBe(true);
    expect(summaryOf(started.room, 'u2').yourTurn).toBe(false);
    expect(summaryOf(started.room, 'u1').turn).toBe(0);
  });

  it('traegt keine Handkarten und keinen Zufallszustand hinaus', () => {
    const started = startGame(full(), 'u1');
    if (!started.ok) throw new Error(started.error);

    const text = JSON.stringify(summaryOf(started.room, 'u1'));
    expect(text).not.toContain('rng');
    expect(text).not.toContain('resources');
  });
});
