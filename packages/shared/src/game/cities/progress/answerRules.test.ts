import { describe, expect, it } from 'vitest';

import { RuleViolationCode } from '../../errors.js';
import { CENTER_VERTEX, hand, testGame } from '../../fixtures.js';
import { GameActionSchema, type GameAction } from '../../actions.js';
import { PhaseSchema } from '../../phase.js';
import { playerViewOf } from '../../playerView.js';
import type { PlayerState } from '../../player.js';
import { reduce } from '../../reducer.js';
import { CITIES_RULES } from '../../../rules/index.js';
import type { GameState } from '../../state.js';
import { canAnswerProgress } from './answerRules.js';
import { twoCardsOrAll } from './pending.js';

/*
 * Der Verteiler ohne Karten: nur Phase, Absender und die Zuordnung Antwort zu
 * Karte. Die Wirkungen pruefen die Testdateien der fuenf Karten.
 */

/** p1 hat eine Hochzeit gespielt, p2 und p3 muessen noch schenken. */
function weddingPending(overrides: Partial<GameState> = {}): GameState {
  return testGame({
    rules: CITIES_RULES,
    phase: { kind: 'progressPending', by: 'p1', pending: ['p2', 'p3'], payload: { card: 'wedding' } },
    ...overrides,
  });
}

describe('progressPending als Phase', () => {
  it('nimmt jede der fuenf Nutzlasten an', () => {
    const payloads = [
      { card: 'wedding' },
      { card: 'tradeHarbor', resource: 'wool' },
      { card: 'spy', victim: 'p2' },
      { card: 'masterMerchant', victim: 'p2' },
      { card: 'deserter', victim: 'p2', replacement: null },
      { card: 'deserter', victim: 'p2', replacement: { level: 2, active: true } },
    ];

    for (const payload of payloads) {
      const phase = { kind: 'progressPending', by: 'p1', pending: ['p2'], payload };
      expect(PhaseSchema.safeParse(phase).success).toBe(true);
    }
  });

  it('lehnt eine Nutzlast fuer eine Karte ab, die nicht wartet', () => {
    const phase = { kind: 'progressPending', by: 'p1', pending: ['p2'], payload: { card: 'bishop' } };
    expect(PhaseSchema.safeParse(phase).success).toBe(false);
  });
});

describe('answerProgress als Aktion', () => {
  it('traegt die Antwort als eigene Union', () => {
    const action = {
      type: 'answerProgress',
      player: 'p2',
      answer: { card: 'tradeHarbor', commodity: 'cloth' },
    };
    expect(GameActionSchema.safeParse(action).success).toBe(true);
  });

  it('passt nicht in die Hauptphase', () => {
    const result = reduce(testGame({ rules: CITIES_RULES }), {
      type: 'answerProgress',
      player: 'p1',
      answer: { card: 'tradeHarbor', commodity: 'cloth' },
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('haelt den Tisch an: waehrend eine Karte wartet, wird nichts gespielt', () => {
    const result = reduce(weddingPending(), {
      type: 'playProgress',
      player: 'p1',
      play: { card: 'warlord' },
    });
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  /*
   * `actorFor` gibt fuer diese Phase `null` - gleichzeitig wie beim Abwerfen.
   * Wer nicht wartet, scheitert deshalb an der Regel und nicht an "nicht am Zug".
   */
  it('prueft den Absender in der Regel und nicht ueber den Spieler am Zug', () => {
    const result = reduce(weddingPending(), {
      type: 'answerProgress',
      player: 'p1',
      answer: { card: 'wedding', gift: hand() },
    });
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NOT_ANSWERING_PROGRESS);
  });
});

describe('canAnswerProgress', () => {
  it('lehnt ab, wer nicht in der Warteliste steht', () => {
    const problem = canAnswerProgress(weddingPending({ phase: { kind: 'main' } }), 'p2', {
      card: 'wedding',
      gift: hand(),
    });
    expect(problem?.code).toBe(RuleViolationCode.NOT_ANSWERING_PROGRESS);
  });

  it('lehnt eine Antwort zu einer anderen Karte ab', () => {
    const problem = canAnswerProgress(weddingPending(), 'p2', { card: 'spy', take: 'bishop' });
    expect(problem?.code).toBe(RuleViolationCode.WRONG_PROGRESS_ANSWER);
  });
});

describe('twoCardsOrAll', () => {
  it('verlangt zwei Karten, oder alle, wenn es weniger sind', () => {
    expect(twoCardsOrAll(5)).toBe(2);
    expect(twoCardsOrAll(2)).toBe(2);
    expect(twoCardsOrAll(1)).toBe(1);
    expect(twoCardsOrAll(0)).toBe(0);
  });
});

describe('Die wartenden Karten am echten Staedte-Tisch', () => {
  const seats = ['p1', 'p2', 'p3'].map((id) => ({ id, name: id, color: '#808080' }));

  function patch(state: GameState, id: string, change: Partial<PlayerState>): GameState {
    return {
      ...state,
      players: state.players.map((player) => (player.id === id ? { ...player, ...change } : player)),
    };
  }

  function act(state: GameState, action: GameAction): GameState {
    const result = reduce(state, action);
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  }

  it('spielt eine Hochzeit mit dem Regelwerk der Partie bis zurueck in die Hauptphase', () => {
    let state = testGame({
      rules: CITIES_RULES,
      buildings: { [CENTER_VERTEX]: { owner: 'p2', kind: 'city', wall: false, metropolis: null } },
    });
    state = patch(patch(state, 'p1', { progressCards: ['wedding'] }), 'p2', {
      resources: hand({ ore: 2 }),
    });

    const open = act(state, { type: 'playProgress', player: 'p1', play: { card: 'wedding' } });
    const done = act(open, {
      type: 'answerProgress',
      player: 'p2',
      answer: { card: 'wedding', gift: hand({ ore: 2 }) },
    });

    expect(done.phase).toEqual({ kind: 'main' });
    expect(done.players.find((player) => player.id === 'p1')!.resources).toEqual(hand({ ore: 2 }));
  });

  it('oeffnet der Spionage die fremde Hand und schliesst sie nach der Antwort wieder', () => {
    let state = testGame({ rules: CITIES_RULES });
    state = patch(patch(state, 'p1', { progressCards: ['spy'] }), 'p2', {
      progressCards: ['bishop'],
    });

    const open = act(state, { type: 'playProgress', player: 'p1', play: { card: 'spy', victim: 'p2' } });
    const seen = playerViewOf(open, 'p1', seats, 1).players.find((player) => player.id === 'p2')!;
    expect(seen.progressCards).toEqual(['bishop']);

    const done = act(open, { type: 'answerProgress', player: 'p1', answer: { card: 'spy', take: 'bishop' } });
    const after = playerViewOf(done, 'p1', seats, 2).players.find((player) => player.id === 'p2')!;
    expect(after.progressCards).toBeNull();
  });
});
