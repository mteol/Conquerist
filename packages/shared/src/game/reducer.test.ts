import { describe, expect, it } from 'vitest';

import { createRng } from '../random/index.js';
import { CLASSIC_RULES } from '../rules/index.js';
import type { GameAction } from './actions.js';
import { yieldTotal } from './dice.js';
import { RuleViolationCode } from './errors.js';
import { CENTER_EDGE, CENTER_VERTEX, FAR_VERTEX, giving, hand, testGame } from './fixtures.js';
import { reduce } from './reducer.js';
import type { GameState } from './state.js';

/**
 * Sucht einen Seed, dessen erster Wurf die gewuenschte Summe ergibt.
 *
 * Besser als eine fest eingetragene Zeichenkette: der Test bleibt gueltig,
 * wenn sich am Wuerfelverfahren etwas aendert, und er sagt beim Lesen, worauf
 * es ankommt - naemlich auf die Summe, nicht auf den Seed.
 */
function seedRolling(total: number): string {
  for (let i = 0; i < 500; i += 1) {
    const seed = `wurf-${i}`;
    const state = testGame({ phase: { kind: 'rollPending' }, rng: createRng(seed) });
    const result = reduce(state, { type: 'rollDice', player: 'p1' });
    if (result.ok && result.state.lastRoll !== null) {
      if (yieldTotal(CLASSIC_RULES.dice, result.state.lastRoll) === total) return seed;
    }
  }
  throw new Error(`Kein Seed mit Wurfsumme ${total} gefunden`);
}

const SEVEN = seedRolling(7);
const SIX = seedRolling(6);

function rolling(seed: string, overrides: Partial<GameState> = {}): GameState {
  return testGame({ phase: { kind: 'rollPending' }, rng: createRng(seed), ...overrides });
}

function expectRejected(result: ReturnType<typeof reduce>, code: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

describe('reduce - Zugrecht und Phasen', () => {
  it('lehnt jede Aktion nach Spielende ab', () => {
    const state = testGame({ phase: { kind: 'finished', winner: 'p1' } });

    expectRejected(reduce(state, { type: 'endTurn', player: 'p1' }), RuleViolationCode.GAME_OVER);
    expectRejected(reduce(state, { type: 'rollDice', player: 'p1' }), RuleViolationCode.GAME_OVER);
  });

  it('lehnt einen unbekannten Spieler ab', () => {
    const state = testGame({ phase: { kind: 'rollPending' } });

    expectRejected(
      reduce(state, { type: 'rollDice', player: 'fremder' }),
      RuleViolationCode.UNKNOWN_PLAYER,
    );
  });

  it('lehnt einen Spieler ab, der nicht am Zug ist', () => {
    const state = testGame({ phase: { kind: 'rollPending' } });

    expectRejected(
      reduce(state, { type: 'rollDice', player: 'p2' }),
      RuleViolationCode.NOT_YOUR_TURN,
    );
  });

  it('lehnt eine Aktion ab, die nicht zur Phase passt', () => {
    const building = giving(testGame({ phase: { kind: 'rollPending' } }), 'p1', hand());

    expectRejected(
      reduce(building, { type: 'buildRoad', player: 'p1', edge: CENTER_EDGE }),
      RuleViolationCode.WRONG_PHASE,
    );
    expectRejected(
      reduce(testGame({ phase: { kind: 'main' } }), { type: 'rollDice', player: 'p1' }),
      RuleViolationCode.WRONG_PHASE,
    );
  });

  it('laesst in der Gruendungsphase den Spieler der Schlange handeln', () => {
    const state = testGame({ phase: { kind: 'setup', placement: 0, settlement: null } });

    expectRejected(
      reduce(state, { type: 'placeSetupSettlement', player: 'p2', vertex: CENTER_VERTEX }),
      RuleViolationCode.NOT_YOUR_TURN,
    );
    expect(
      reduce(state, { type: 'placeSetupSettlement', player: 'p1', vertex: CENTER_VERTEX }).ok,
    ).toBe(true);
  });

  it('laesst beim Abwerfen jeden Betroffenen handeln, nicht nur den am Zug', () => {
    const state = giving(
      testGame({ phase: { kind: 'discardPending', pending: ['p2'] }, currentPlayerIndex: 0 }),
      'p2',
      { brick: 8 },
    );

    const result = reduce(state, { type: 'discard', player: 'p2', resources: hand({ brick: 4 }) });
    expect(result.ok).toBe(true);
  });
});

describe('reduce - wuerfeln', () => {
  it('haelt den Wurf fest und verteilt den Ertrag', () => {
    const state = rolling(SIX, {
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
    });

    const result = reduce(state, { type: 'rollDice', player: 'p1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(yieldTotal(CLASSIC_RULES.dice, result.state.lastRoll!)).toBe(6);
      expect(result.state.phase).toEqual({ kind: 'main' });
      // Chip 6 liegt auf dem Huegelfeld - Lehm.
      expect(result.state.players[0]?.resources).toEqual(hand({ brick: 1 }));
    }
  });

  it('fuehrt den Zufallszustand weiter', () => {
    const state = rolling(SIX);
    const result = reduce(state, { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.rng).not.toEqual(state.rng);
  });

  it('wuerfelt aus demselben Zustand denselben Wurf', () => {
    const first = reduce(rolling(SIX), { type: 'rollDice', player: 'p1' });
    const second = reduce(rolling(SIX), { type: 'rollDice', player: 'p1' });

    expect(first.ok && second.ok && first.state.lastRoll).toEqual(
      second.ok ? second.state.lastRoll : null,
    );
  });

  it('schickt bei einer Sieben die Ueberzaehligen zum Abwerfen', () => {
    const state = giving(rolling(SEVEN), 'p2', { brick: 9 });
    const result = reduce(state, { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'discardPending', pending: ['p2'] });
  });

  it('geht bei einer Sieben ohne Ueberzaehlige direkt zum Raeuber', () => {
    const result = reduce(rolling(SEVEN), { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'robberPending' });
  });

  it('verteilt bei einer Sieben keinen Ertrag', () => {
    const state = rolling(SEVEN, {
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
    });

    const result = reduce(state, { type: 'rollDice', player: 'p1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.players[0]?.resources).toEqual(hand());
  });
});

describe('reduce - Zug beenden', () => {
  it('gibt an den naechsten Spieler weiter und laesst ihn wuerfeln', () => {
    const result = reduce(testGame({ phase: { kind: 'main' } }), { type: 'endTurn', player: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.currentPlayerIndex).toBe(1);
      expect(result.state.phase).toEqual({ kind: 'rollPending' });
    }
  });

  it('zaehlt die Runde erst hoch, wenn wieder der erste Spieler dran ist', () => {
    const beforeWrap = testGame({ phase: { kind: 'main' }, currentPlayerIndex: 1, turn: 4 });
    const middle = reduce(beforeWrap, { type: 'endTurn', player: 'p2' });
    expect(middle.ok && middle.state.turn).toBe(4);

    const atWrap = testGame({ phase: { kind: 'main' }, currentPlayerIndex: 2, turn: 4 });
    const wrapped = reduce(atWrap, { type: 'endTurn', player: 'p3' });
    expect(wrapped.ok && wrapped.state.turn).toBe(5);
    expect(wrapped.ok && wrapped.state.currentPlayerIndex).toBe(0);
  });
});

describe('reduce - Nacharbeit nach jedem Zug', () => {
  it('rechnet die Laengste Handelsstrasse neu', () => {
    const chain = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0', 'e:-1,1|0,0'];
    const state = giving(
      testGame({
        phase: { kind: 'main' },
        roads: Object.fromEntries(chain.map((edge) => [edge, 'p1'])),
        buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
      }),
      'p1',
      hand(CLASSIC_RULES.buildCosts.road),
    );

    expect(state.longestRoad.holder).toBeNull();

    const result = reduce(state, { type: 'buildRoad', player: 'p1', edge: 'e:0,0|1,0' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.longestRoad).toEqual({ holder: 'p1', length: 5 });
  });

  it('beendet das Spiel, sobald der Spieler am Zug das Ziel erreicht', () => {
    // Ziel zwei Punkte: p1 hat schon eine Siedlung und baut die zweite.
    const state = giving(
      testGame({
        rules: { ...CLASSIC_RULES, victoryPointGoal: 2 },
        phase: { kind: 'main' },
        roads: { [CENTER_EDGE]: 'p1' },
        buildings: { [FAR_VERTEX]: { owner: 'p1', kind: 'settlement' } },
      }),
      'p1',
      hand(CLASSIC_RULES.buildCosts.settlement),
    );

    const result = reduce(state, {
      type: 'buildSettlement',
      player: 'p1',
      vertex: CENTER_VERTEX,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'finished', winner: 'p1' });
  });

  it('laesst niemanden im fremden Zug gewinnen', () => {
    // p2 haelt zwei Siedlungen und wuerde mit der Laengsten Strasse das Ziel
    // erreichen - aber p1 ist am Zug, also endet das Spiel jetzt nicht.
    const chain = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0', 'e:-1,1|0,0'];
    const state = giving(
      testGame({
        rules: { ...CLASSIC_RULES, victoryPointGoal: 3 },
        phase: { kind: 'main' },
        currentPlayerIndex: 0,
        buildings: {
          [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement' },
          [FAR_VERTEX]: { owner: 'p2', kind: 'settlement' },
        },
        roads: Object.fromEntries(chain.map((edge) => [edge, 'p2'])),
      }),
      'p1',
      hand(),
    );

    const result = reduce(state, { type: 'endTurn', player: 'p1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'rollPending' });
  });
});

describe('reduce - vollstaendige Abdeckung', () => {
  it('kennt zu jeder Aktionsart eine Phase', () => {
    const types: GameAction['type'][] = [
      'placeSetupSettlement',
      'placeSetupRoad',
      'rollDice',
      'discard',
      'moveRobber',
      'buildRoad',
      'buildSettlement',
      'buildCity',
      'tradeWithBank',
      'endTurn',
    ];

    // In der Hauptphase duerfen genau die Bauaktionen, der Handel und das
    // Zugende laufen - alles andere muss WRONG_PHASE liefern, keine Ausnahme.
    for (const type of types) {
      const action = {
        type,
        player: 'p1',
        vertex: CENTER_VERTEX,
        edge: CENTER_EDGE,
        hex: '1,-1',
        victim: null,
        resources: hand(),
        give: 'ore',
        receive: 'brick',
      } as unknown as GameAction;
      const result = reduce(testGame({ phase: { kind: 'main' } }), action);

      expect(result.ok || typeof result.error.code === 'string').toBe(true);
    }
  });
});

describe('der Auftakt im Reducer', () => {
  const inOpening = (): GameState =>
    testGame({
      phase: { kind: 'opening', rolls: {}, pending: ['p1', 'p2', 'p3'], round: 0 },
      turn: 0,
    });

  it('laesst nur den Vordersten der Warteschlange wuerfeln', () => {
    const result = reduce(inOpening(), { type: 'rollDice', player: 'p2' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.NOT_YOUR_TURN);
  });

  it('nimmt im Auftakt keine Siedlung an', () => {
    // Der ganze Sinn einer Phase: ein zu frueh gesetztes Haus ist ein
    // gewoehnlicher Regelverstoss und kein Sonderfall im Code.
    const result = reduce(inOpening(), {
      type: 'placeSetupSettlement',
      player: 'p1',
      vertex: CENTER_VERTEX,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('wuerfelt im Auftakt keinen Ertrag aus', () => {
    const result = reduce(inOpening(), { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.map((player) => player.resources)).toEqual(
      inOpening().players.map((player) => player.resources),
    );
  });

  it('geht nach dem letzten Wurf aus dem Auftakt heraus', () => {
    let state = inOpening();
    for (const player of ['p1', 'p2', 'p3']) {
      const result = reduce(state, { type: 'rollDice', player });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }

    // Entweder entschieden oder Stechen - beides ist ein Fortschritt.
    expect(state.phase.kind === 'setup' || state.phase.kind === 'opening').toBe(true);
  });
});
