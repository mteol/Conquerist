import { describe, expect, it, vi } from 'vitest';
import { stampAction, type GameAction, type GameState } from '@conquerist/shared';

import { createRoomClock } from './clock.js';
import { RoomRegistry } from './registry.js';
import { applyAction, createRoom, joinRoom, startGame, type Room } from './room.js';
import { SinkHub } from '../ws/sinks.js';

/**
 * Uhr und Zeitgeber kommen von aussen herein - kein Test wartet hier echte
 * sechzig Sekunden.
 */
function withThree(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'wecker-probe');
  if (!created.ok) throw new Error(created.error);

  let current = created.room;
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

/** Eine laufende Partie in der Hauptphase, u1 am Zug und mit drei Holz. */
function inMainPhase(): Room {
  const started = startGame(withThree(), 'u1');
  if (!started.ok) throw new Error(started.error);
  const game = started.room.game!;

  const running: GameState = {
    ...game,
    phase: { kind: 'main' },
    currentPlayerIndex: 0,
    players: game.players.map((player, index) =>
      index === 0 ? { ...player, resources: { ...player.resources, lumber: 3 } } : player,
    ),
  };

  return { ...started.room, game: running };
}

const OFFER: GameAction = {
  type: 'offerTrade',
  player: 'u1',
  give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
  want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
  at: 0,
};

/** Registry mit einem Raum, in dem seit `at` ein Angebot liegt. */
function registryWithOffer(at: number): { registry: RoomRegistry; room: Room } {
  const registry = new RoomRegistry({ randomCode: () => 'K7X2' });
  const base = inMainPhase();
  // Der Raum muss in der Registry stehen, sonst greift `update` nicht.
  registry.create('u1', 'Anna', 3, 'wecker-probe');
  registry.update('K7X2', base);

  const acted = applyAction(base, 'u1', stampAction(OFFER, at));
  if (!acted.ok) throw new Error(acted.error);
  registry.update('K7X2', acted.room);

  return { registry, room: acted.room };
}

function clockFor(registry: RoomRegistry, now: number) {
  const schedule = vi.fn((_run: () => void, _ms: number) => 1 as unknown as NodeJS.Timeout);
  const cancel = vi.fn();
  const clock = createRoomClock({
    registry,
    sinks: new SinkHub(),
    now: () => now,
    schedule,
    cancel,
  });

  return { clock, schedule, cancel };
}

describe('createRoomClock', () => {
  it('stellt den Wecker auf die verbleibende Zeit', () => {
    const { registry, room } = registryWithOffer(10_000);
    const { clock, schedule } = clockFor(registry, 20_000);

    clock.arm('K7X2');

    const total = room.game!.rules.tradeOfferMs;
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule.mock.calls[0]![1]).toBe(10_000 + total - 20_000);
  });

  it('ist sofort faellig, wenn die Frist beim Laden schon abgelaufen war', () => {
    const { registry, room } = registryWithOffer(10_000);
    const past = 10_000 + room.game!.rules.tradeOfferMs + 5_000;
    const { clock, schedule } = clockFor(registry, past);

    clock.arm('K7X2');

    // Nach einem Neustart raeumt der erste Lauf das Angebot ab - keine
    // negative Wartezeit, sondern null.
    expect(schedule.mock.calls[0]![1]).toBe(0);
  });

  it('stellt gar nichts, wenn keine Frist laeuft', () => {
    const registry = new RoomRegistry({ randomCode: () => 'K7X2' });
    registry.create('u1', 'Anna', 3, 'wecker-probe');
    registry.update('K7X2', inMainPhase());

    const { clock, schedule } = clockFor(registry, 0);
    clock.arm('K7X2');

    expect(schedule).not.toHaveBeenCalled();
  });

  it('beendet das Angebot, wenn der Wecker klingelt', () => {
    const { registry, room } = registryWithOffer(10_000);
    const due = 10_000 + room.game!.rules.tradeOfferMs;

    const runs: (() => void)[] = [];
    const clock = createRoomClock({
      registry,
      sinks: new SinkHub(),
      now: () => due,
      schedule: (run) => {
        runs.push(run);
        return 1 as unknown as NodeJS.Timeout;
      },
      cancel: () => undefined,
    });

    clock.arm('K7X2');
    runs[0]!();

    expect(registry.get('K7X2')?.game?.phase).toEqual({ kind: 'main' });
  });

  it('raeumt den Wecker beim Abbestellen ab', () => {
    const { registry } = registryWithOffer(10_000);
    const { clock, cancel } = clockFor(registry, 10_000);

    clock.arm('K7X2');
    clock.disarm('K7X2');

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('stellt beim erneuten Stellen den alten Wecker ab', () => {
    const { registry } = registryWithOffer(10_000);
    const { clock, schedule, cancel } = clockFor(registry, 10_000);

    clock.arm('K7X2');
    clock.arm('K7X2');

    expect(schedule).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
