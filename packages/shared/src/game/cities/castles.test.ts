import { describe, expect, it } from 'vitest';

import { CITIES_RULES, CITIES_RULES_56 } from '../../rules/cities.js';
import { RuleViolationCode } from '../errors.js';
import { CENTER_VERTEX, gameWithCities, hand } from '../fixtures.js';
import { canOfferAnything } from '../playerTrade.js';
import { reduce } from '../reducer.js';
import type { GameState } from '../state.js';
import { initialCastles, isAdaptedTurn } from './castles.js';
import { knightMayAct } from './knights.js';

const SIX = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

/** Ein Tisch zu sechst mit Burg 1 / Burg 2, in der Hauptphase. */
function sixAtTable(overrides: Partial<GameState> = {}): GameState {
  const base = gameWithCities({ rules: CITIES_RULES_56 });
  const template = base.players[0]!;
  return gameWithCities({
    rules: CITIES_RULES_56,
    players: SIX.map((id) => ({ ...template, id, resources: hand({ brick: 2, wool: 1 }) })),
    castles: { first: 0, second: 3 },
    ...overrides,
  });
}

function endTurn(state: GameState): GameState {
  const player = state.players[state.currentPlayerIndex]!.id;
  const result = reduce(state, { type: 'endTurn', player });
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('Burg 1 / Burg 2', () => {
  it('legt die Marken nur bei castleTurns aus, drei Plaetze auseinander', () => {
    expect(initialCastles(sixAtTable())).toEqual({ first: 0, second: 3 });
    expect(initialCastles(sixAtTable({ rules: CITIES_RULES }))).toBeNull();
  });

  it('nach Burg 1 spielt Burg 2 ohne Wurf, die Marken bleiben liegen', () => {
    const state = sixAtTable({ turn: 4, turnsPlayed: 20 });
    const after = endTurn(state);

    expect(after.currentPlayerIndex).toBe(3);
    expect(after.phase.kind).toBe('main');
    expect(after.castles).toEqual({ first: 0, second: 3 });
    expect(isAdaptedTurn(after)).toBe(true);
    expect(after.turn).toBe(4);
    expect(after.turnsPlayed).toBe(21);
  });

  it('nach Burg 2 wandern beide Marken eins weiter, und der Naechste wuerfelt', () => {
    const after = endTurn(endTurn(sixAtTable()));

    expect(after.castles).toEqual({ first: 1, second: 4 });
    expect(after.currentPlayerIndex).toBe(1);
    expect(after.phase.kind).toBe('rollPending');
    expect(isAdaptedTurn(after)).toBe(false);
  });

  it('eine Runde ist um, wenn Burg 1 wieder beim ersten Platz ankommt', () => {
    const state = sixAtTable({ castles: { first: 5, second: 2 }, currentPlayerIndex: 2, turn: 3 });
    const after = endTurn(state);

    expect(after.castles).toEqual({ first: 0, second: 3 });
    expect(after.currentPlayerIndex).toBe(0);
    expect(after.turn).toBe(4);
  });

  it('der angepasste Zug handelt nicht mit Mitspielern', () => {
    const adapted = sixAtTable({ currentPlayerIndex: 3 });

    expect(canOfferAnything(adapted, 'p4')).toBe(false);
    const result = reduce(adapted, {
      type: 'offerTrade',
      player: 'p4',
      give: hand({ brick: 1 }),
      want: hand({ ore: 1 }),
      at: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.ADAPTED_TURN_BANK_ONLY);

    expect(canOfferAnything(sixAtTable(), 'p1')).toBe(true);
  });

  it('ein Ritter handelt im naechsten Zug, auch wenn er in dieselbe Runde faellt', () => {
    const knight = {
      owner: 'p1',
      level: 1 as const,
      active: true,
      activatedOnTurn: 7,
      upgradedThisTurn: false,
    };
    const sameTurn = sixAtTable({ turn: 2, turnsPlayed: 7, knights: { [CENTER_VERTEX]: knight } });
    const nextTurn = { ...sameTurn, turnsPlayed: 8 };

    expect(knightMayAct(sameTurn, CENTER_VERTEX, 'p1')).toBe(false);
    expect(knightMayAct(nextTurn, CENTER_VERTEX, 'p1')).toBe(true);
  });
});
