import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import type { GameAction } from '../../actions.js';
import { RuleViolationCode } from '../../errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  HARBOR3_VERTEX,
  testGame,
} from '../../fixtures.js';
import { legalActions } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { reduce } from '../../reducer.js';
import type { GameState, Knight } from '../../state.js';
import type { ProgressCardId } from './cards.js';
import { knightMayAct } from '../knights.js';
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

const PLAY: GameAction = {
  type: 'playProgress',
  player: 'p1',
  play: { card: 'deserter', victim: 'p2' },
};

function pick(player: PlayerId, vertex: string): GameAction {
  return { type: 'answerProgress', player, answer: { card: 'deserter', vertex } };
}

const STRONG_READY: Knight = {
  owner: 'p2',
  level: 2,
  active: true,
  activatedOnTurn: 0,
  upgradedThisTurn: false,
};

const SIMPLE_PASSIVE: Knight = {
  owner: 'p2',
  level: 1,
  active: false,
  activatedOnTurn: null,
  upgradedThisTurn: false,
};

/**
 * p1 hat eine Strasse zwischen CENTER_VERTEX und ADJACENT_VERTEX - dort darf
 * der Ueberlaeufer hin. p2 hat einen starken aktiven und einen einfachen
 * passiven Ritter. Die laufende Runde ist 1.
 */
function deserterTable(overrides: Partial<GameState> = {}): GameState {
  const state = tableWith('deserter', {
    roads: { [CENTER_EDGE]: 'p1' },
    knights: { [FAR_VERTEX]: STRONG_READY, [HARBOR3_VERTEX]: SIMPLE_PASSIVE },
    ...overrides,
  });
  return patchPlayer(state, 'p1', { progressCards: ['deserter'] });
}

function withStock(state: GameState, id: PlayerId, stock: Record<string, number>): GameState {
  return patchPlayer(state, id, { piecesLeft: { ...playerNamed(state, id).piecesLeft, ...stock } });
}

describe('Deserteur', () => {
  it('wartet zuerst auf das Opfer', () => {
    expect(act(deserterTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p2'],
      payload: { card: 'deserter', victim: 'p2', replacement: null },
    });
  });

  it('lehnt ein Opfer ohne Ritter ab', () => {
    expect(canPlayProgress(deserterTable(), 'p1', { card: 'deserter', victim: 'p3' })?.code).toBe(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
    );
  });

  it('nimmt in Runde 1 den gewaehlten Ritter vom Brett und oeffnet Runde 2 beim Spielenden', () => {
    const before = act(deserterTable(), PLAY);
    const after = act(before, pick('p2', FAR_VERTEX));

    expect(after.knights[FAR_VERTEX]).toBeUndefined();
    expect(playerNamed(after, 'p2').piecesLeft.knight2).toBe(
      playerNamed(before, 'p2').piecesLeft.knight2 + 1,
    );
    expect(after.phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p1'],
      payload: { card: 'deserter', victim: 'p2', replacement: { level: 2, active: true } },
    });
  });

  it('weicht auf die hoechste freie Stufe darunter aus', () => {
    const state = withStock(deserterTable(), 'p1', { knight2: 0 });
    const after = act(act(state, PLAY), pick('p2', FAR_VERTEX));

    expect(after.phase).toMatchObject({ payload: { replacement: { level: 1, active: true } } });
  });

  it('oeffnet keine zweite Runde ohne passenden Vorrat', () => {
    const state = withStock(deserterTable(), 'p1', { knight1: 0, knight2: 0 });
    const after = act(act(state, PLAY), pick('p2', FAR_VERTEX));

    expect(after.knights[FAR_VERTEX]).toBeUndefined();
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('oeffnet keine zweite Runde ohne legale Kreuzung', () => {
    const after = act(act(deserterTable({ roads: {} }), PLAY), pick('p2', FAR_VERTEX));
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('stellt in Runde 2 den Ueberlaeufer mit Stufe und Helm auf', () => {
    const round2 = act(act(deserterTable(), PLAY), pick('p2', FAR_VERTEX));
    const after = act(round2, pick('p1', CENTER_VERTEX));

    expect(after.knights[CENTER_VERTEX]).toEqual({
      owner: 'p1',
      level: 2,
      active: true,
      activatedOnTurn: after.turn - 1,
      upgradedThisTurn: false,
    });
    expect(playerNamed(after, 'p1').piecesLeft.knight2).toBe(
      playerNamed(round2, 'p1').piecesLeft.knight2 - 1,
    );
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('laesst einen aktiven Ueberlaeufer sofort handeln (FAQ 83)', () => {
    const round2 = act(act(deserterTable(), PLAY), pick('p2', FAR_VERTEX));
    const after = act(round2, pick('p1', CENTER_VERTEX));
    expect(knightMayAct(after, CENTER_VERTEX, 'p1')).toBe(true);
  });

  it('stellt einen maechtigen Ueberlaeufer auch ohne Festung auf (FAQ 84)', () => {
    const mighty: Knight = { ...STRONG_READY, level: 3 };
    const state = deserterTable({ knights: { [FAR_VERTEX]: mighty } });
    const round2 = act(act(state, PLAY), pick('p2', FAR_VERTEX));
    const after = act(round2, pick('p1', CENTER_VERTEX));
    expect(after.knights[CENTER_VERTEX]).toMatchObject({ owner: 'p1', level: 3 });
  });

  it('stellt keinen Ritter, wenn fuer einen einfachen keiner mehr im Vorrat liegt (FAQ 82)', () => {
    const state = withStock(
      deserterTable({ knights: { [HARBOR3_VERTEX]: SIMPLE_PASSIVE } }),
      'p1',
      { knight1: 0 },
    );
    const after = act(act(state, PLAY), pick('p2', HARBOR3_VERTEX));
    expect(after.phase).toEqual({ kind: 'main' });
    expect(Object.values(after.knights).some((knight) => knight.owner === 'p1')).toBe(false);
  });

  it('stellt einen passiven Ritter passiv und ohne Aktivierungsrunde auf', () => {
    const round2 = act(act(deserterTable(), PLAY), pick('p2', HARBOR3_VERTEX));
    const after = act(round2, pick('p1', ADJACENT_VERTEX));

    expect(after.knights[ADJACENT_VERTEX]).toMatchObject({
      level: 1,
      active: false,
      activatedOnTurn: null,
    });
  });

  it('lehnt in Runde 1 eine Kreuzung ohne eigenen Ritter ab', () => {
    const result = reduce(act(deserterTable(), PLAY), pick('p2', CENTER_VERTEX));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NO_KNIGHT_HERE);
  });

  it('lehnt in Runde 2 eine Kreuzung ohne eigene Strasse ab', () => {
    const round2 = act(act(deserterTable(), PLAY), pick('p2', FAR_VERTEX));
    const result = reduce(round2, pick('p1', FAR_VERTEX));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NOT_CONNECTED);
  });

  it('zaehlt in beiden Runden genau die moeglichen Kreuzungen auf', () => {
    const round1 = act(deserterTable(), PLAY);
    const victimMoves = legalActions(round1, 'p2').map((action) =>
      action.type === 'answerProgress' && action.answer.card === 'deserter'
        ? action.answer.vertex
        : null,
    );
    expect(victimMoves.sort()).toEqual([FAR_VERTEX, HARBOR3_VERTEX].sort());

    const round2 = act(round1, pick('p2', FAR_VERTEX));
    const placements = legalActions(round2, 'p1').map((action) =>
      action.type === 'answerProgress' && action.answer.card === 'deserter'
        ? action.answer.vertex
        : null,
    );
    expect(placements.sort()).toEqual([ADJACENT_VERTEX, CENTER_VERTEX].sort());
  });
});
