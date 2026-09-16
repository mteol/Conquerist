import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import type { CommodityId } from '../../../scenario/index.js';
import type { GameAction } from '../../actions.js';
import { RuleViolationCode } from '../../errors.js';
import { hand, testGame } from '../../fixtures.js';
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

// Testhelfer: tableWith, patchPlayer, playerNamed, act - Abschnitt "Testhelfer fuer die Kartentests" im Plankopf

const PLAY: GameAction = {
  type: 'playProgress',
  player: 'p1',
  play: { card: 'tradeHarbor', resource: 'wool' },
};

function offer(player: PlayerId, commodity: CommodityId): GameAction {
  return { type: 'answerProgress', player, answer: { card: 'tradeHarbor', commodity } };
}

/** p1 hat zwei Wolle; p2 haelt Papier und Tuch, p3 eine Muenze. */
function harborTable(): GameState {
  let state = tableWith('tradeHarbor');
  state = patchPlayer(state, 'p1', {
    progressCards: ['tradeHarbor'],
    resources: hand({ wool: 2 }),
  });
  state = patchPlayer(state, 'p2', { resources: hand({ paper: 1, cloth: 2 }) });
  return patchPlayer(state, 'p3', { resources: hand({ coin: 1 }) });
}

describe('Handelshafen', () => {
  it('wartet auf alle mit einer Handelsware und merkt sich den Rohstoff', () => {
    expect(act(harborTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p2', 'p3'],
      payload: { card: 'tradeHarbor', resource: 'wool' },
    });
  });

  it('laesst aus, wer keine Handelsware hat', () => {
    const state = patchPlayer(harborTable(), 'p3', { resources: hand({ ore: 3 }) });
    expect(act(state, PLAY).phase).toMatchObject({ pending: ['p2'] });
  });

  it('ist nicht spielbar mit weniger Rohstoffen als Mitspielern mit Handkarten', () => {
    const state = patchPlayer(harborTable(), 'p1', { resources: hand({ wool: 1 }) });
    expect(canPlayProgress(state, 'p1', { card: 'tradeHarbor', resource: 'wool' })?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('verlangt Deckung auch fuer Mitspieler ohne Handelsware', () => {
    const state = patchPlayer(
      patchPlayer(harborTable(), 'p1', { resources: hand({ wool: 1 }) }),
      'p3',
      { resources: hand({ ore: 3 }) },
    );
    expect(canPlayProgress(state, 'p1', { card: 'tradeHarbor', resource: 'wool' })?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('verraet nicht, ob Mitspieler Handelswaren halten', () => {
    const withCommodities = harborTable();
    const withoutCommodities = patchPlayer(
      patchPlayer(harborTable(), 'p2', { resources: hand({ ore: 3 }) }),
      'p3',
      { resources: hand({ grain: 1 }) },
    );
    for (const resource of ['wool', 'ore'] as const) {
      const play = { card: 'tradeHarbor', resource } as const;
      expect(canPlayProgress(withoutCommodities, 'p1', play)).toEqual(
        canPlayProgress(withCommodities, 'p1', play),
      );
    }
    expect(legalActions(withoutCommodities, 'p1')).toEqual(legalActions(withCommodities, 'p1'));
  });

  it('ist ohne Wirkung gespielt, wenn niemand eine Handelsware hat', () => {
    const state = patchPlayer(
      patchPlayer(harborTable(), 'p2', { resources: hand({ ore: 1 }) }),
      'p3',
      { resources: hand({ grain: 2 }) },
    );
    const after = act(state, PLAY);
    expect(after.phase).toEqual({ kind: 'main' });
    expect(playerNamed(after, 'p1').progressCards).toEqual([]);
    expect(playerNamed(after, 'p1').resources).toEqual(hand({ wool: 2 }));
  });

  it('ist nicht spielbar, wenn niemand sonst Handkarten hat', () => {
    const state = patchPlayer(
      patchPlayer(harborTable(), 'p2', { resources: hand() }),
      'p3',
      { resources: hand() },
    );
    expect(canPlayProgress(state, 'p1', { card: 'tradeHarbor', resource: 'wool' })?.code).toBe(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
    );
  });

  it('tauscht eine Handelsware gegen einen Rohstoff und streicht den Antwortenden', () => {
    const after = act(act(harborTable(), PLAY), offer('p2', 'cloth'));

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ wool: 1, cloth: 1 }));
    expect(playerNamed(after, 'p2').resources).toEqual(hand({ paper: 1, cloth: 1, wool: 1 }));
    expect(after.phase).toMatchObject({ kind: 'progressPending', pending: ['p3'] });
  });

  it('kehrt nach der letzten Antwort in die Hauptphase zurueck', () => {
    const done = act(act(act(harborTable(), PLAY), offer('p3', 'coin')), offer('p2', 'paper'));
    expect(done.phase).toEqual({ kind: 'main' });
    expect(playerNamed(done, 'p1').resources).toEqual(hand({ coin: 1, paper: 1 }));
  });

  it('lehnt eine Handelsware ab, die nicht auf der Hand liegt', () => {
    const result = reduce(act(harborTable(), PLAY), offer('p3', 'paper'));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('zaehlt dem Antwortenden nur die Handelswaren auf, die er hat', () => {
    const open = act(harborTable(), PLAY);
    expect(legalActions(open, 'p2')).toEqual([offer('p2', 'paper'), offer('p2', 'cloth')]);
    expect(legalActions(open, 'p1')).toEqual([]);
  });

  it('bietet beim Ausspielen nur Rohstoffe an, die alle Mitspieler mit Handkarten decken', () => {
    const plays = legalActions(harborTable(), 'p1').filter(
      (action) => action.type === 'playProgress' && action.play.card === 'tradeHarbor',
    );
    expect(plays).toEqual([PLAY]);
  });
});
