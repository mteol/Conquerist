import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import type { GameAction } from '../../actions.js';
import { RuleViolationCode } from '../../errors.js';
import { hand, testGame } from '../../fixtures.js';
import { legalActions, playableDevelopmentCards } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { canOfferAnything } from '../../playerTrade.js';
import { reduce } from '../../reducer.js';
import type { GameState } from '../../state.js';
import type { ProgressCardId } from './cards.js';
import { mustShedProgressCard } from './draw.js';

/*
 * Regel 11: wer am Zug eine fuenfte zaehlende Fortschrittskarte haelt, spielt
 * sofort eine aus oder gibt eine ab. Drei Spieler p1, p2, p3; p1 ist am Zug und
 * in der Hauptphase.
 */

const FIVE: ProgressCardId[] = ['merchantFleet', 'irrigation', 'medicine', 'smith', 'crane'];

function patchPlayer(state: GameState, id: PlayerId, patch: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === id ? { ...player, ...patch } : player)),
  };
}

function playerNamed(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`playerNamed: ${id} sitzt nicht am Tisch`);
  return player;
}

function act(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function overLimit(cards: ProgressCardId[] = FIVE): GameState {
  return patchPlayer(testGame({ rules: CITIES_RULES }), 'p1', {
    progressCards: cards,
    resources: hand({ brick: 5, lumber: 5, wool: 5, grain: 5, ore: 5 }),
  });
}

describe('Regel 11: die fuenfte Karte am Zug', () => {
  it('greift nur beim Spieler am Zug in der Hauptphase mit mehr als vier zaehlenden Karten', () => {
    expect(mustShedProgressCard(overLimit())).toBe(true);
    expect(mustShedProgressCard(overLimit(FIVE.slice(0, 4)))).toBe(false);
    expect(mustShedProgressCard({ ...overLimit(), phase: { kind: 'rollPending' } })).toBe(false);
    expect(
      mustShedProgressCard(patchPlayer(overLimit(FIVE.slice(0, 4)), 'p2', { progressCards: FIVE })),
    ).toBe(false);
  });

  it('sperrt alles andere, auch das Zugende', () => {
    const state = overLimit();
    for (const action of [
      { type: 'endTurn', player: 'p1' },
      { type: 'buyDevelopmentCard', player: 'p1' },
      { type: 'tradeWithBank', player: 'p1', give: 'brick', receive: 'ore' },
    ] as GameAction[]) {
      const result = reduce(state, action);
      expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.PROGRESS_LIMIT_FIRST);
    }
  });

  it('laesst ausspielen und kehrt danach zum normalen Zug zurueck', () => {
    const after = act(overLimit(), {
      type: 'playProgress',
      player: 'p1',
      play: { card: 'merchantFleet', sort: 'wool' },
    });
    expect(mustShedProgressCard(after)).toBe(false);
    expect(reduce(after, { type: 'endTurn', player: 'p1' }).ok).toBe(true);
  });

  it('laesst eine Karte abgeben und bleibt in der Hauptphase', () => {
    const after = act(overLimit(), { type: 'discardProgressCard', player: 'p1', card: 'crane' });
    expect(after.phase).toEqual({ kind: 'main' });
    expect(playerNamed(after, 'p1').progressCards).toEqual(FIVE.slice(0, 4));
    expect(reduce(after, { type: 'endTurn', player: 'p1' }).ok).toBe(true);
  });

  it('laesst ohne Ueberhang in der Hauptphase nichts abgeben', () => {
    const result = reduce(overLimit(FIVE.slice(0, 4)), {
      type: 'discardProgressCard',
      player: 'p1',
      card: 'crane',
    });
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NOT_DISCARDING_PROGRESS);
  });

  it('zaehlt nur Ausspielen und Abgeben als Zuege auf', () => {
    const types = new Set(legalActions(overLimit(), 'p1').map((action) => action.type));
    expect([...types].sort()).toEqual(['discardProgressCard', 'playProgress']);
    expect(
      legalActions(overLimit(), 'p1').filter((action) => action.type === 'discardProgressCard'),
    ).toHaveLength(5);
  });

  it('meldet der Sicht, dass gerade weder Angebot noch Entwicklungskarte geht', () => {
    expect(canOfferAnything(overLimit(), 'p1')).toBe(false);
    expect(canOfferAnything(overLimit(FIVE.slice(0, 4)), 'p1')).toBe(true);

    const withKnight = patchPlayer(overLimit(), 'p1', {
      developmentCards: [{ id: 'knight', boughtOnTurn: 0 }],
    });
    expect(playableDevelopmentCards({ ...withKnight, phase: { kind: 'main' } }, 'p1')).toEqual([]);
    expect(
      playableDevelopmentCards(patchPlayer(withKnight, 'p1', { progressCards: [] }), 'p1'),
    ).toEqual(['knight']);
  });
});
