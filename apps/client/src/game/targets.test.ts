import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  type GameAction,
  type GameState,
} from '@conquerist/shared';
import { actionTargets, targetsFrom } from './targets';

const scenario = generateScenario(CLASSIC_34, 'targets-probe');
const ids = ['p1', 'p2', 'p3'];

function fresh(): GameState {
  return createGame(scenario, CLASSIC_RULES, ids, 'targets-probe');
}

/** Spielt die Gruendungsphase mit der jeweils ersten erlaubten Wahl durch. */
function afterSetup(): GameState {
  let state = fresh();

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const action = legalActions(state, player)[0]!;
    const result = reduce(state, action);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

describe('Klickkarten', () => {
  it('legt jede Gruendungssiedlung auf ihren Knoten', () => {
    const state = fresh();
    const player = setupPlayer(state)!;
    const targets = actionTargets(state, player);

    expect(targets.edges.size).toBe(0);
    expect(targets.roll).toBeNull();
    expect(targets.vertices.size).toBeGreaterThan(0);

    for (const [vertex, action] of targets.vertices) {
      expect(action.type).toBe('placeSetupSettlement');
      expect(action).toMatchObject({ player, vertex });
    }
  });

  it('nennt nach der Siedlung nur noch die anschliessenden Kanten', () => {
    let state = fresh();
    const player = setupPlayer(state)!;
    const first = legalActions(state, player)[0]!;
    const result = reduce(state, first);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;

    const targets = actionTargets(state, player);

    expect(targets.vertices.size).toBe(0);
    expect(targets.edges.size).toBeGreaterThan(0);
    for (const action of targets.edges.values()) {
      expect(action.type).toBe('placeSetupRoad');
    }
  });

  it('bietet vor dem Wuerfeln nur das Wuerfeln an', () => {
    const state = afterSetup();
    const player = state.players[state.currentPlayerIndex]!.id;
    const targets = actionTargets(state, player);

    expect(state.phase.kind).toBe('rollPending');
    expect(targets.roll).toEqual({ type: 'rollDice', player });
    expect(targets.endTurn).toBeNull();
    expect(targets.vertices.size).toBe(0);
    expect(targets.edges.size).toBe(0);
    expect(targets.trades).toHaveLength(0);
  });

  it('bietet einem Spieler ohne Zugrecht nichts an', () => {
    const state = afterSetup();
    const other = state.players[1]!.id;
    const targets = actionTargets(state, other);

    expect(targets.roll).toBeNull();
    expect(targets.endTurn).toBeNull();
    expect(targets.vertices.size).toBe(0);
  });

  it('verteilt jede Aktion aus legalActions auf genau eine Stelle', () => {
    const state = afterSetup();
    const player = state.players[state.currentPlayerIndex]!.id;
    const rolled = reduce(state, { type: 'rollDice', player });
    if (!rolled.ok) throw new Error(rolled.error.message);

    const after = rolled.state;
    const actor = after.phase.kind === 'main' ? player : after.players[0]!.id;
    const expected = legalActions(after, actor);
    const targets = actionTargets(after, actor);

    const collected: GameAction[] = [
      ...targets.vertices.values(),
      ...targets.edges.values(),
      ...[...targets.hexes.values()].flat(),
      ...targets.trades,
      ...(targets.roll === null ? [] : [targets.roll]),
      ...(targets.endTurn === null ? [] : [targets.endTurn]),
    ];

    expect(collected).toHaveLength(expected.length);
    expect(new Set(collected.map((action) => JSON.stringify(action)))).toEqual(
      new Set(expected.map((action) => JSON.stringify(action))),
    );
  });

  it('nimmt eine fertige Aktionsliste - so kommt sie ab Etappe 4 vom Server', () => {
    const actions: GameAction[] = [
      { type: 'buildRoad', player: 'p1', edge: 'e:0,0|1,0' },
      { type: 'endTurn', player: 'p1' },
    ];

    const targets = targetsFrom(actions);

    expect(targets.edges.get('e:0,0|1,0')).toEqual(actions[0]);
    expect(targets.endTurn).toEqual(actions[1]);
    expect(targets.vertices.size).toBe(0);
  });
});
