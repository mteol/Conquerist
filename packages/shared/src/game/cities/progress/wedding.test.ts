import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import type { GameAction } from '../../actions.js';
import { countCards } from '../../cards.js';
import { RuleViolationCode } from '../../errors.js';
import { CENTER_VERTEX, FAR_VERTEX, HARBOR3_VERTEX, hand, testGame } from '../../fixtures.js';
import { legalActions } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { reduce } from '../../reducer.js';
import { publicVictoryPointsOf, victoryPointsOf } from '../../scoring.js';
import type { Building, GameState } from '../../state.js';
import type { CardAmounts } from '../../../rules/index.js';
import type { ProgressCardId } from './cards.js';
import { canPlayProgress } from './progressRules.js';

/*
 * Lokale Aufbauten - Testdateien teilen sich keine Helfer. Drei Spieler p1, p2,
 * p3, p1 ist am Zug und in der Hauptphase.
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

const PLAY: GameAction = { type: 'playProgress', player: 'p1', play: { card: 'wedding' } };

function gift(player: PlayerId, cards: CardAmounts): GameAction {
  return { type: 'answerProgress', player, answer: { card: 'wedding', gift: cards } };
}

/** p1 hat eine Siedlung (1 Punkt), p2 und p3 je eine Stadt (2 Punkte) und Karten. */
function weddingTable(overrides: Partial<GameState> = {}): GameState {
  let state = tableWith('wedding', {
    buildings: {
      [FAR_VERTEX]: settlement('p1'),
      [CENTER_VERTEX]: city('p2'),
      [HARBOR3_VERTEX]: city('p3'),
    },
    ...overrides,
  });
  state = patchPlayer(state, 'p1', { progressCards: ['wedding'] });
  state = patchPlayer(state, 'p2', { resources: hand({ ore: 2, wool: 1 }) });
  return patchPlayer(state, 'p3', { resources: hand({ grain: 3 }) });
}

describe('Hochzeit', () => {
  it('wartet auf alle mit mehr Punkten und Karten, im Uhrzeigersinn ab dem Spielenden', () => {
    expect(act(weddingTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p2', 'p3'],
      payload: { card: 'wedding' },
    });
  });

  it('laesst aus, wer keine Karten hat', () => {
    const state = patchPlayer(weddingTable(), 'p3', { resources: hand() });
    expect(act(state, PLAY).phase).toMatchObject({ kind: 'progressPending', pending: ['p2'] });
  });

  it('bleibt in der Hauptphase, wenn alle mit mehr Punkten leere Haende haben', () => {
    const empty = patchPlayer(patchPlayer(weddingTable(), 'p2', { resources: hand() }), 'p3', {
      resources: hand(),
    });
    const after = act(empty, PLAY);

    expect(after.phase).toEqual({ kind: 'main' });
    expect(playerNamed(after, 'p1').progressCards).toEqual([]);
  });

  it('ist nicht spielbar, wenn niemand mehr Punkte hat', () => {
    const state = weddingTable({ buildings: { [FAR_VERTEX]: city('p1') } });
    expect(canPlayProgress(state, 'p1', { card: 'wedding' })?.code).toBe(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
    );
  });

  it('gibt das Geschenk dem Spielenden und streicht den Schenkenden', () => {
    const after = act(act(weddingTable(), PLAY), gift('p2', hand({ ore: 1, wool: 1 })));

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ ore: 1, wool: 1 }));
    expect(playerNamed(after, 'p2').resources).toEqual(hand({ ore: 1 }));
    expect(after.phase).toMatchObject({ kind: 'progressPending', pending: ['p3'] });
  });

  it('nimmt die Antworten in beliebiger Reihenfolge und schliesst nach der letzten', () => {
    const open = act(weddingTable(), PLAY);
    const done = act(act(open, gift('p3', hand({ grain: 2 }))), gift('p2', hand({ ore: 2 })));

    expect(done.phase).toEqual({ kind: 'main' });
    expect(countCards(playerNamed(done, 'p1').resources)).toBe(4);
  });

  it('verlangt alles, wer weniger als zwei Karten hat', () => {
    const open = act(patchPlayer(weddingTable(), 'p3', { resources: hand({ grain: 1 }) }), PLAY);

    const two = reduce(open, gift('p3', hand({ grain: 2 })));
    expect(two.ok ? null : two.error.code).toBe(RuleViolationCode.WRONG_PROGRESS_ANSWER);
    expect(reduce(open, gift('p3', hand({ grain: 1 }))).ok).toBe(true);
  });

  it('lehnt ein Geschenk ab, das nicht auf der Hand liegt', () => {
    const result = reduce(act(weddingTable(), PLAY), gift('p2', hand({ brick: 2 })));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('zaehlt die Hochzeit in legalActions als Zug ohne Angabe auf', () => {
    const plays = legalActions(weddingTable(), 'p1').filter((action) => action.type === 'playProgress');
    expect(plays).toContainEqual(PLAY);
  });

  /*
   * Die Regel fragt nach "mehr Siegpunkten", und `victoryPointsOf` ist die
   * Wahrheit ueber den Punktestand. Dass das niemandem verdeckte Punkte
   * verraet, liegt am Tisch: ohne Entwicklungskarten gibt es keine verdeckten.
   * Dieser Test haelt den Satz fest, statt ihn nur zu behaupten.
   */
  it('zaehlt an einem Staedte-Tisch oeffentliche und volle Punkte gleich', () => {
    const state = patchPlayer(
      tableWith('wedding', {
        buildings: { [CENTER_VERTEX]: city('p1') },
        merchant: { hex: '1,0', owner: 'p1' },
      }),
      'p1',
      { openProgressCards: ['printer'], defenderPoints: 1 },
    );
    expect(publicVictoryPointsOf(state, 'p1')).toBe(victoryPointsOf(state, 'p1'));
  });
});
