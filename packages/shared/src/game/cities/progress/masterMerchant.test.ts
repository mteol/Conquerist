import { describe, expect, it } from 'vitest';

import { CITIES_RULES, type CardAmounts } from '../../../rules/index.js';
import type { GameAction } from '../../actions.js';
import { RuleViolationCode } from '../../errors.js';
import { CENTER_VERTEX, FAR_VERTEX, HARBOR3_VERTEX, hand, testGame } from '../../fixtures.js';
import { legalActions } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { reduce } from '../../reducer.js';
import type { Building, GameState } from '../../state.js';
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

function city(owner: PlayerId): Building {
  return { owner, kind: 'city', wall: false, metropolis: null };
}

function settlement(owner: PlayerId): Building {
  return { owner, kind: 'settlement', wall: false, metropolis: null };
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

const PLAY: GameAction = {
  type: 'playProgress',
  player: 'p1',
  play: { card: 'masterMerchant', victim: 'p2' },
};

function take(cards: CardAmounts): GameAction {
  return { type: 'answerProgress', player: 'p1', answer: { card: 'masterMerchant', take: cards } };
}

/** p1 hat eine Siedlung (1), p2 eine Stadt (2) und drei Karten, p3 eine Siedlung (1). */
function merchantTable(): GameState {
  let state = tableWith('masterMerchant', {
    buildings: {
      [FAR_VERTEX]: settlement('p1'),
      [CENTER_VERTEX]: city('p2'),
      [HARBOR3_VERTEX]: settlement('p3'),
    },
  });
  state = patchPlayer(state, 'p1', { progressCards: ['masterMerchant'] });
  state = patchPlayer(state, 'p2', { resources: hand({ ore: 2, wool: 1 }) });
  return patchPlayer(state, 'p3', { resources: hand({ grain: 3 }) });
}

describe('Grosshaendler', () => {
  it('wartet auf den Spielenden selbst und merkt sich das Opfer', () => {
    expect(act(merchantTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p1'],
      payload: { card: 'masterMerchant', victim: 'p2' },
    });
  });

  it('lehnt ein Opfer ohne mehr Siegpunkte ab', () => {
    expect(
      canPlayProgress(merchantTable(), 'p1', { card: 'masterMerchant', victim: 'p3' })?.code,
    ).toBe(RuleViolationCode.INVALID_PROGRESS_VICTIM);
  });

  it('lehnt ein Opfer ohne Handkarten ab', () => {
    const state = patchPlayer(merchantTable(), 'p2', { resources: hand() });
    expect(canPlayProgress(state, 'p1', { card: 'masterMerchant', victim: 'p2' })?.code).toBe(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
    );
  });

  it('nimmt zwei Karten und kehrt in die Hauptphase zurueck', () => {
    const after = act(act(merchantTable(), PLAY), take(hand({ ore: 1, wool: 1 })));

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ ore: 1, wool: 1 }));
    expect(playerNamed(after, 'p2').resources).toEqual(hand({ ore: 1 }));
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('nimmt alles, wenn das Opfer weniger als zwei Karten hat', () => {
    const open = act(patchPlayer(merchantTable(), 'p2', { resources: hand({ ore: 1 }) }), PLAY);

    const two = reduce(open, take(hand({ ore: 2 })));
    expect(two.ok ? null : two.error.code).toBe(RuleViolationCode.WRONG_PROGRESS_ANSWER);
    expect(reduce(open, take(hand({ ore: 1 }))).ok).toBe(true);
  });

  it('lehnt Karten ab, die das Opfer nicht haelt', () => {
    const result = reduce(act(merchantTable(), PLAY), take(hand({ brick: 2 })));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('bietet beim Ausspielen nur Opfer mit mehr Punkten an und zaehlt die Antwort nicht auf', () => {
    const plays = legalActions(merchantTable(), 'p1').filter(
      (action) => action.type === 'playProgress' && action.play.card === 'masterMerchant',
    );
    expect(plays).toEqual([PLAY]);
    expect(legalActions(act(merchantTable(), PLAY), 'p1')).toEqual([]);
  });
});
