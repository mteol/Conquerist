import { describe, expect, it } from 'vitest';

import { createRng } from '../random/index.js';
import { RuleViolationCode } from './errors.js';
import { CENTER_VERTEX, gameWithCities, giving, hand, testGame } from './fixtures.js';
import {
  afterDiscardPhase,
  applyDiscard,
  applyMoveRobber,
  canMoveRobber,
  discardCountFor,
  playersMustDiscard,
  victimsAt,
} from './robber.js';
import { CITIES_RULES } from '../rules/index.js';
import { reduce } from './reducer.js';
import { PhaseSchema } from './phase.js';
import { countCards } from './cards.js';
import type { GameState } from './state.js';

/** Ein Knoten am Huegelfeld `1,-1`, der nicht neben `CENTER_VERTEX` liegt. */
const HILLS_VERTEX_B = 'v:0,-1|1,-2|1,-1';

function resourcesOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!.resources;
}

describe('discardCountFor', () => {
  it('verlangt nichts bis zum Handkartenlimit', () => {
    const state = giving(testGame(), 'p1', { brick: 7 });
    expect(discardCountFor(state, 'p1')).toBe(0);
  });

  it('verlangt die Haelfte, abgerundet', () => {
    for (const [cards, expected] of [
      [8, 4],
      [9, 4],
      [10, 5],
      [15, 7],
    ] as const) {
      const state = giving(testGame(), 'p1', { brick: cards });
      expect(discardCountFor(state, 'p1')).toBe(expected);
    }
  });
});

describe('playersMustDiscard', () => {
  it('nennt genau die Spieler ueber dem Limit, in Zugreihenfolge', () => {
    let state = testGame();
    state = giving(state, 'p1', { brick: 9 });
    state = giving(state, 'p2', { wool: 3 });
    state = giving(state, 'p3', { ore: 8 });

    expect(playersMustDiscard(state)).toEqual(['p1', 'p3']);
  });

  it('nennt niemanden, wenn alle unter dem Limit sind', () => {
    expect(playersMustDiscard(testGame())).toEqual([]);
  });
});

describe('applyDiscard', () => {
  function discarding(): GameState {
    return giving(
      testGame({
        phase: { kind: 'discardPending', pending: ['p1', 'p3'], counts: {}, resume: 'seven' },
      }),
      'p1',
      {
        brick: 5,
        ore: 5,
      },
    );
  }

  it('nimmt genau die Haelfte ab und gibt sie an die Bank', () => {
    const before = discarding();
    const result = applyDiscard(before, 'p1', hand({ brick: 3, ore: 2 }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(resourcesOf(result.state, 'p1')).toEqual(hand({ brick: 2, ore: 3 }));
      expect(result.state.bank.brick).toBe(before.bank.brick + 3);
      expect(result.state.bank.ore).toBe(before.bank.ore + 2);
    }
  });

  it('lehnt eine falsche Anzahl ab', () => {
    for (const wrong of [hand({ brick: 4 }), hand({ brick: 2, ore: 4 })]) {
      const result = applyDiscard(discarding(), 'p1', wrong);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.WRONG_DISCARD_COUNT);
    }
  });

  it('lehnt Karten ab, die der Spieler nicht hat', () => {
    const result = applyDiscard(discarding(), 'p1', hand({ wool: 5 }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('lehnt einen Spieler ab, der nicht abwerfen muss', () => {
    const result = applyDiscard(discarding(), 'p2', hand());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_DISCARDING);
  });

  it('streicht den Spieler von der Liste und wartet auf den Rest', () => {
    const result = applyDiscard(discarding(), 'p1', hand({ brick: 5 }));

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.state.phase).toEqual({
        kind: 'discardPending',
        pending: ['p3'],
        counts: {},
        resume: 'seven',
      });
  });

  it('geht zum Raeuber ueber, sobald alle abgeworfen haben', () => {
    const state = giving(
      testGame({ phase: { kind: 'discardPending', pending: ['p1'], counts: {}, resume: 'seven' } }),
      'p1',
      {
        brick: 8,
      },
    );

    const result = applyDiscard(state, 'p1', hand({ brick: 4 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'robberPending', resume: 'main' });
  });
});

describe('victimsAt', () => {
  it('nennt Anlieger mit Karten', () => {
    const state = giving(
      testGame({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
        },
      }),
      'p2',
      { wool: 1 },
    );

    expect(victimsAt(state, '1,-1', 'p1')).toEqual(['p2']);
  });

  it('uebergeht Anlieger ohne Karten', () => {
    const state = testGame({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
      },
    });

    expect(victimsAt(state, '1,-1', 'p1')).toEqual([]);
  });

  it('uebergeht den Dieb selbst', () => {
    const state = giving(
      testGame({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
        },
      }),
      'p1',
      { wool: 3 },
    );

    expect(victimsAt(state, '1,-1', 'p1')).toEqual([]);
  });

  it('nennt jeden Anlieger nur einmal, auch bei zwei Siedlungen am Feld', () => {
    const state = giving(
      testGame({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
          [HILLS_VERTEX_B]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
        },
      }),
      'p2',
      { wool: 2 },
    );

    expect(victimsAt(state, '1,-1', 'p1')).toEqual(['p2']);
  });
});

describe('applyMoveRobber', () => {
  function robbing(overrides: Partial<GameState> = {}): GameState {
    return testGame({ phase: { kind: 'robberPending', resume: 'main' }, ...overrides });
  }

  it('versetzt den Raeuber und geht in die Hauptphase', () => {
    const result = applyMoveRobber(robbing(), 'p1', '1,-1', null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.robber).toBe('1,-1');
      expect(result.state.phase).toEqual({ kind: 'main' });
    }
  });

  it('lehnt das Feld ab, auf dem der Raeuber schon steht', () => {
    const result = applyMoveRobber(robbing(), 'p1', '0,0', null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.ROBBER_SAME_HEX);
  });

  it('lehnt ein Feld neben dem Brett ab', () => {
    const result = applyMoveRobber(robbing(), 'p1', '9,9', null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_ON_BOARD);
  });

  it('stiehlt dem benannten Opfer genau eine Karte', () => {
    const state = giving(
      robbing({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
        },
      }),
      'p2',
      { wool: 3 },
    );

    const result = applyMoveRobber(state, 'p1', '1,-1', 'p2');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(countCards(resourcesOf(result.state, 'p1'))).toBe(1);
      expect(countCards(resourcesOf(result.state, 'p2'))).toBe(2);
      // Die Karte wechselt den Besitzer, sie verschwindet nicht.
      expect(result.state.bank).toEqual(state.bank);
    }
  });

  it('waehlt die gestohlene Karte aus dem Zufallszustand', () => {
    const build = (rngSeed: string): GameState =>
      giving(
        robbing({
          buildings: {
            [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
          },
          rng: createRng(rngSeed),
        }),
        'p2',
        { brick: 10, ore: 10 },
      );

    const stolen = (seed: string): string => {
      const result = applyMoveRobber(build(seed), 'p1', '1,-1', 'p2');
      if (!result.ok) throw new Error(result.error.message);
      const hand1 = resourcesOf(result.state, 'p1');
      return hand1.brick > 0 ? 'brick' : 'ore';
    };

    // Gleicher Zufallszustand, gleiche Karte - Regel 2.
    expect(stolen('dieb-a')).toBe(stolen('dieb-a'));
    // Und der Zustand wird weitergefuehrt, nicht wiederverwendet.
    const result = applyMoveRobber(build('dieb-a'), 'p1', '1,-1', 'p2');
    if (result.ok) expect(result.state.rng).not.toEqual(build('dieb-a').rng);
  });

  it('lehnt ein Opfer ab, das am Feld nichts stehen hat', () => {
    const state = giving(robbing(), 'p1', {});
    const result = applyMoveRobber(state, 'p1', '1,-1', 'p2');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.INVALID_VICTIM);
  });

  it('verlangt ein Opfer, wenn es eines gibt', () => {
    const state = giving(
      robbing({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
        },
      }),
      'p2',
      { wool: 1 },
    );

    const result = applyMoveRobber(state, 'p1', '1,-1', null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.VICTIM_REQUIRED);
  });

  it('laesst das Versetzen ohne Opfer zu, wenn niemand dort wohnt', () => {
    expect(applyMoveRobber(robbing(), 'p1', '-1,1', null).ok).toBe(true);
  });
});

describe('der Rueckweg des Raeubers', () => {
  it('geht nach einer Sieben in die Hauptphase', () => {
    const state = testGame({ phase: { kind: 'robberPending', resume: 'main' } });
    const result = applyMoveRobber(state, 'p1', '1,0', null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
  });

  it('geht nach einem Ritter vor dem Wurf zurueck zum Wurf', () => {
    // Der eigentliche Befund: ohne `resume` landete der Spieler in `main`, und
    // der Wurf dieser Runde fiel ersatzlos aus.
    const state = testGame({ phase: { kind: 'robberPending', resume: 'rollPending' } });
    const result = applyMoveRobber(state, 'p1', '1,0', null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'rollPending' });
  });

  it('kennt keine Raeuberphase ohne Rueckweg', () => {
    expect(PhaseSchema.safeParse({ kind: 'robberPending' }).success).toBe(false);
  });
});

/**
 * Die Raeubersperre aus Staedte & Ritter.
 *
 * Der Raeuber steht still, bis die Barbaren einmal gelandet sind. In der Runde
 * des ersten Ueberfalls darf er schon ziehen, und das haengt an der
 * Reihenfolge im Wurf: `resolveEvent` laeuft **vor** dem Sieben-Zweig, also
 * ist der Ueberfall abgehandelt, wenn die Folgephase gewaehlt wird.
 */
describe('Der Raeuber vor dem ersten Ueberfall', () => {
  const LOCKED = { position: 0, attacks: 0 };
  const FREED = { position: 0, attacks: 1 };

  it('laesst sich nicht versetzen, solange die Barbaren nicht da waren', () => {
    const state = gameWithCities({
      barbarians: LOCKED,
      phase: { kind: 'robberPending', resume: 'main' },
    });
    expect(canMoveRobber(state, 'p1', '1,0', null)?.code).toBe(RuleViolationCode.ROBBER_LOCKED);
  });

  it('laesst sich nach dem ersten Ueberfall versetzen', () => {
    const state = gameWithCities({
      barbarians: FREED,
      phase: { kind: 'robberPending', resume: 'main' },
    });
    expect(canMoveRobber(state, 'p1', '1,0', null)).toBeNull();
  });

  it('laesst sich an einem Basistisch immer versetzen', () => {
    const state = testGame({ phase: { kind: 'robberPending', resume: 'main' } });
    expect(state.barbarians).toBeNull();
    expect(canMoveRobber(state, 'p1', '1,0', null)).toBeNull();
  });

  it('geht nach dem Abwerfen direkt in die Hauptphase', () => {
    expect(afterDiscardPhase(gameWithCities({ barbarians: LOCKED }))).toEqual({ kind: 'main' });
  });

  it('oeffnet nach dem Abwerfen robberPending, sobald sie gelandet waren', () => {
    expect(afterDiscardPhase(gameWithCities({ barbarians: FREED }))).toEqual({
      kind: 'robberPending',
      resume: 'main',
    });
  });

  it('laesst den letzten Abwerfenden in die Hauptphase durchgehen', () => {
    const state = giving(
      gameWithCities({
        barbarians: LOCKED,
        phase: { kind: 'discardPending', pending: ['p1'], counts: {}, resume: 'seven' },
      }),
      'p1',
      { brick: 8 },
    );

    const result = applyDiscard(state, 'p1', hand({ brick: 4 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toEqual({ kind: 'main' });
  });

  /*
   * Der Ueberfall kommt vor dem Ertrag - also ist der Raeuber schon frei, wenn
   * in derselben Runde eine Sieben faellt. Gesucht wird ein Seed, bei dem
   * beides zusammentrifft (Wahrscheinlichkeit rund ein Zwoelftel je Wurf).
   */
  it('gibt den Raeuber in der Runde des ersten Ueberfalls schon frei', () => {
    const track = CITIES_RULES.barbarianTrack;
    let found = false;

    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const state = gameWithCities({
        barbarians: { position: track - 1, attacks: 0 },
        buildings: {},
        knights: {},
        phase: { kind: 'rollPending' },
        rng: createRng(`seven-${seed}`),
      });

      const result = reduce(state, { type: 'rollDice', player: 'p1' });
      if (!result.ok) continue;

      const roll = result.state.lastRoll!;
      const total = roll
        .filter((entry) => entry.die !== 'event')
        .reduce((sum, entry) => sum + entry.value, 0);
      const ship = (roll.find((entry) => entry.die === 'event')?.value ?? 6) <= 3;

      if (total !== 7 || !ship) continue;

      found = true;
      expect(result.state.barbarians).toEqual({ position: 0, attacks: 1 });
      expect(result.state.phase).toEqual({ kind: 'robberPending', resume: 'main' });
    }

    expect(found).toBe(true);
  });
});
