import { describe, expect, it } from 'vitest';
import { CLASSIC_34 } from '../scenario/blueprints/classic34.js';
import { generateScenario } from '../scenario/generator.js';
import { CLASSIC_RULES } from '../rules/ruleset.js';
import { seatColorAt, type Seat } from '../seats.js';
import { createGame, setupPlayer } from './setup.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { describeTransition } from './log.js';
import type { GameAction } from './actions.js';
import type { GameState } from './state.js';

const scenario = generateScenario(CLASSIC_34, 'log-probe');
const seats: Seat[] = ['p1', 'p2', 'p3'].map((id, index) => ({
  id,
  name: `Spieler ${index + 1}`,
  color: seatColorAt(index),
}));
const ids = seats.map((seat) => seat.id);

function apply(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('Verlaufssaetze', () => {
  it('nennt die Gruendungssiedlung beim Namen des Spielers', () => {
    const before = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    const action = legalActions(before, setupPlayer(before)!)[0]!;
    const after = apply(before, action);

    expect(describeTransition(before, action, after, seats)).toContain('Spieler 1');
    expect(describeTransition(before, action, after, seats)).toContain('Gruendungssiedlung');
  });

  it('nennt beim Wurf die Augenzahl', () => {
    let state = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    while (state.phase.kind === 'setup') {
      state = apply(state, legalActions(state, setupPlayer(state)!)[0]!);
    }

    const player = state.players[state.currentPlayerIndex]!.id;
    const action: GameAction = { type: 'rollDice', player };
    const after = apply(state, action);
    const sum = after.lastRoll![0] + after.lastRoll![1];

    expect(describeTransition(state, action, after, seats)).toContain(String(sum));
  });

  it('faellt fuer unbekannte Sitze auf die Id zurueck statt zu werfen', () => {
    const before = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    const action = legalActions(before, setupPlayer(before)!)[0]!;
    const after = apply(before, action);

    expect(describeTransition(before, action, after, [])).toContain('p1');
  });
});
