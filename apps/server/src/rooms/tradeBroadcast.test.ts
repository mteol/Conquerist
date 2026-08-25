import { describe, expect, it, vi } from 'vitest';
import { EMPTY_CARDS, GAME_EVENT } from '@conquerist/shared';
import { broadcastGame } from './broadcast.js';
import { applyAction, createRoom, joinRoom, startGame, type Room } from './room.js';
import { rollOpening } from './openingFixture.js';
import type { EventSink } from '../ws/events.js';

/**
 * Ein vollstaendiger Handel ueber den Raum - und was dabei zugestellt wird.
 *
 * Der Reducer taeuscht hier niemanden: `applyAcceptTrade` schreibt beide Seiten
 * in einem Uebergang. Die Frage dieses Tests ist eine andere - **kommt der neue
 * Stand bei beiden Clients an**. Genau dort lag im Playtest der Bruch: einer
 * sah die Karte wechseln, der andere nicht.
 *
 * Deshalb wird nach jedem Zug gesendet und am Ende zweierlei geprueft: der
 * Inhalt der letzten Sicht je Empfaenger, und dass die `version` fuer jeden
 * Empfaenger **streng** waechst. Das zweite ist keine Formalie: der Client
 * verwirft in `onlineState.ts` jedes Ereignis, dessen Version nicht groesser
 * ist als die vorliegende. Eine wiederholte Version ist dort ein stiller
 * Verlust und sieht im Spiel aus wie ein halb ausgefuehrter Tausch.
 */

function sinks(ids: readonly string[]): Map<string, EventSink[]> {
  return new Map(ids.map((id) => [id, [{ send: vi.fn() } as unknown as EventSink]]));
}

/** Zwei Spieler, Hauptphase, bekannte Haende - alles andere waere Wurfglueck. */
function tableReadyToTrade(): Room {
  const created = createRoom('H4N2', 'u1', 'Anna', 3, 'handel-probe', 10);
  if (!created.ok) throw new Error(created.error);

  let seated = created.room;
  for (const [id, name] of [
    ['u2', 'Ben'],
    ['u3', 'Cem'],
  ] as const) {
    const joined = joinRoom(seated, id, name);
    if (!joined.ok) throw new Error(joined.error);
    seated = joined.room;
  }

  const started = startGame(seated, 'u1');
  if (!started.ok) throw new Error(started.error);

  const room = rollOpening(started.room);
  const game = room.game;
  if (game === null) throw new Error('Die Partie laeuft nicht');

  return {
    ...room,
    game: {
      ...game,
      phase: { kind: 'main' },
      currentPlayerIndex: game.players.findIndex((player) => player.id === 'u1'),
      players: game.players.map((player) => ({
        ...player,
        resources:
          player.id === 'u1'
            ? { ...EMPTY_CARDS, brick: 2 }
            : player.id === 'u2'
              ? { ...EMPTY_CARDS, grain: 2 }
              : { ...EMPTY_CARDS },
      })),
    },
  };
}

/** Jede Zustellung an diesen Empfaenger, in der Reihenfolge des Sendens. */
function deliveries(targets: Map<string, EventSink[]>, userId: string) {
  const send = targets.get(userId)![0]!.send as unknown as ReturnType<typeof vi.fn>;
  return send.mock.calls
    .filter(([type]) => type === GAME_EVENT)
    .map(([, payload]) => payload as { version: number; view: { players: readonly any[] } });
}

/** Die eigene Hand aus der letzten Sicht dieses Empfaengers. */
function ownHand(targets: Map<string, EventSink[]>, userId: string) {
  const last = deliveries(targets, userId).at(-1);
  if (last === undefined) throw new Error(`${userId} hat gar nichts bekommen`);
  return last.view.players.find((player) => player.id === userId)!.resources;
}

describe('Ein Handel, wie ihn beide Seiten erleben', () => {
  it('stellt den fertigen Tausch beiden Spielern zu', () => {
    let room = tableReadyToTrade();
    const targets = sinks(['u1', 'u2', 'u3']);

    const steps = [
      [
        'u1',
        {
          type: 'offerTrade',
          player: 'u1',
          give: { ...EMPTY_CARDS, brick: 1 },
          want: { ...EMPTY_CARDS, grain: 1 },
          at: 1_000,
        },
      ],
      ['u2', { type: 'respondTrade', player: 'u2', response: 'accepted' }],
      ['u1', { type: 'acceptTrade', player: 'u1', partner: 'u2' }],
    ] as const;

    for (const [actor, action] of steps) {
      const acted = applyAction(room, actor, action as never);
      if (!acted.ok) throw new Error(`${action.type}: ${acted.error}`);
      room = acted.room;
      broadcastGame(room, targets);
    }

    // Anna gab einen Lehm und bekam ein Getreide.
    expect(ownHand(targets, 'u1')).toMatchObject({ brick: 1, grain: 1 });
    // Ben genau andersherum - und das ist die Zeile, die im Playtest fehlte.
    expect(ownHand(targets, 'u2')).toMatchObject({ grain: 1, brick: 1 });
  });

  it('laesst die Version fuer jeden Empfaenger streng wachsen', () => {
    let room = tableReadyToTrade();
    const targets = sinks(['u1', 'u2', 'u3']);

    const steps = [
      [
        'u1',
        {
          type: 'offerTrade',
          player: 'u1',
          give: { ...EMPTY_CARDS, brick: 1 },
          want: { ...EMPTY_CARDS, grain: 1 },
          at: 1_000,
        },
      ],
      ['u2', { type: 'respondTrade', player: 'u2', response: 'accepted' }],
      ['u1', { type: 'acceptTrade', player: 'u1', partner: 'u2' }],
    ] as const;

    for (const [actor, action] of steps) {
      const acted = applyAction(room, actor, action as never);
      if (!acted.ok) throw new Error(`${action.type}: ${acted.error}`);
      room = acted.room;
      broadcastGame(room, targets);
    }

    for (const userId of ['u1', 'u2', 'u3']) {
      const versions = deliveries(targets, userId).map((payload) => payload.version);
      expect(versions.length).toBe(3);
      for (let i = 1; i < versions.length; i += 1) {
        expect(versions[i]).toBeGreaterThan(versions[i - 1]!);
      }
    }
  });
});
