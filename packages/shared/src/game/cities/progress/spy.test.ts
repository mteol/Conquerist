import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import type { GameAction } from '../../actions.js';
import { RuleViolationCode } from '../../errors.js';
import { testGame } from '../../fixtures.js';
import { legalActions } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { reduce } from '../../reducer.js';
import type { GameState } from '../../state.js';
import type { ProgressCardId } from './cards.js';
import { canPlayProgress } from './progressRules.js';

/*
 * Lokale Aufbauten. Drei Spieler p1, p2, p3; p1 ist am Zug und in der
 * Hauptphase.
 */

/** Ein Staedte-Tisch, an dem diese Karte liegt - auf die Stapel kommt sie erst in Aufgabe 8. */
function tableWith(card: ProgressCardId, overrides: Partial<GameState> = {}): GameState {
  return testGame({
    rules: { ...CITIES_RULES, progressDecks: { ...CITIES_RULES.progressDecks, [card]: 2 } },
    ...overrides,
  });
}

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

const PLAY: GameAction = { type: 'playProgress', player: 'p1', play: { card: 'spy', victim: 'p2' } };

function take(card: ProgressCardId): GameAction {
  return { type: 'answerProgress', player: 'p1', answer: { card: 'spy', take: card } };
}

/** p1 spielt die Spionage; p2 haelt Bischof und Kran, p3 nichts. */
function spyTable(): GameState {
  const state = patchPlayer(tableWith('spy'), 'p1', { progressCards: ['spy'] });
  return patchPlayer(state, 'p2', { progressCards: ['bishop', 'crane'] });
}

describe('Spionage', () => {
  it('wartet auf den Spielenden selbst und merkt sich das Opfer', () => {
    expect(act(spyTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p1'],
      payload: { card: 'spy', victim: 'p2' },
    });
  });

  it('lehnt ein Opfer ohne Fortschrittskarte ab', () => {
    expect(canPlayProgress(spyTable(), 'p1', { card: 'spy', victim: 'p3' })?.code).toBe(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
    );
  });

  it('lehnt sich selbst als Opfer ab', () => {
    expect(canPlayProgress(spyTable(), 'p1', { card: 'spy', victim: 'p1' })?.code).toBe(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
    );
  });

  it('nimmt die gewaehlte Karte und kehrt in die Hauptphase zurueck', () => {
    const after = act(act(spyTable(), PLAY), take('crane'));

    expect(playerNamed(after, 'p2').progressCards).toEqual(['bishop']);
    expect(playerNamed(after, 'p1').progressCards).toEqual(['crane']);
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('lehnt eine Karte ab, die das Opfer nicht haelt', () => {
    const result = reduce(act(spyTable(), PLAY), take('warlord'));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NO_SUCH_PROGRESS_CARD);
  });

  it('zaehlt dem Spielenden genau die fremden Karten auf', () => {
    const open = act(spyTable(), PLAY);
    expect(legalActions(open, 'p1')).toEqual([take('bishop'), take('crane')]);
    expect(legalActions(open, 'p2')).toEqual([]);
  });

  it('bietet beim Ausspielen nur Opfer mit Fortschrittskarten an', () => {
    const plays = legalActions(spyTable(), 'p1').filter(
      (action) => action.type === 'playProgress' && action.play.card === 'spy',
    );
    expect(plays).toEqual([PLAY]);
  });

  /*
   * Wer am Zug ist, spielt eine fuenfte Karte sofort aus (Regel 11) - die
   * Spionage oeffnet deshalb kein Abgeben, auch wenn sie ueber das Limit hebt.
   */
  it('oeffnet kein Abgeben, wenn die genommene Karte ueber das Handlimit hebt', () => {
    const state = patchPlayer(spyTable(), 'p1', {
      progressCards: ['spy', 'warlord', 'saboteur', 'mining', 'irrigation'],
    });
    const after = act(act(state, PLAY), take('bishop'));

    expect(playerNamed(after, 'p1').progressCards).toHaveLength(5);
    expect(after.phase).toEqual({ kind: 'main' });
  });
});
