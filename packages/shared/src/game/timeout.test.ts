import { describe, expect, it } from 'vitest';

import { CITIES_RULES, CLASSIC_RULES } from '../rules/index.js';
import type { GameAction } from './actions.js';
import { deadlineOf, msUntil } from './deadline.js';
import { RuleViolationCode } from './errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  HARBOR3_VERTEX,
  NEXT_EDGE,
  giving,
  hand,
  testGame,
} from './fixtures.js';
import type { PlayerId, PlayerState } from './player.js';
import { applyOfferTrade } from './playerTrade.js';
import { reduce } from './reducer.js';
import type { GameState, Knight } from './state.js';
import { applyTimeout, canTimeout } from './timeout.js';

/*
 * Ein Geschenk verfaellt, eine Pflicht wird abgenommen (Spec 5.5). Jeder Test
 * geht durch `reduce` mit dem Besitzer der Frist als `player` - so, wie der
 * Wecker im Server die Aktion einwirft.
 */

function patchPlayer(state: GameState, id: PlayerId, change: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === id ? { ...player, ...change } : player)),
  };
}

function playerNamed(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`playerNamed: ${id} sitzt nicht am Tisch`);
  return player;
}

function expire(state: GameState, owner: PlayerId): GameState {
  const action: GameAction = { type: 'timeout', player: owner, at: 0 };
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function tableWithOffer(): GameState {
  const result = applyOfferTrade(
    giving(testGame(), 'p1', { lumber: 3 }),
    'p1',
    hand({ lumber: 2 }),
    hand({ ore: 1 }),
    1_000,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('deadlineOf', () => {
  it('nennt fuer jede Wartephase die Antwortfrist und wem sie gehoert', () => {
    const cases: Array<[GameState['phase'], PlayerId]> = [
      [{ kind: 'discardPending', pending: ['p2', 'p3'], counts: {}, resume: 'seven' }, 'p2'],
      [{ kind: 'robberPending', resume: 'main' }, 'p1'],
      [
        {
          kind: 'displacePending',
          owner: 'p3',
          level: 1,
          active: false,
          activatedOnTurn: null,
          from: FAR_VERTEX,
        },
        'p3',
      ],
      [{ kind: 'progressDiscardPending', pending: ['p2'] }, 'p2'],
      [{ kind: 'defenderPending', pending: ['p3', 'p2'] }, 'p3'],
      [{ kind: 'aqueductPending', pending: ['p2'] }, 'p2'],
      [{ kind: 'progressPending', by: 'p1', pending: ['p3'], payload: { card: 'wedding' } }, 'p3'],
    ];

    for (const [phase, owner] of cases) {
      expect(deadlineOf(testGame({ phase }))).toEqual({
        kind: 'after',
        ms: CLASSIC_RULES.pendingAnswerMs,
        owner,
      });
    }
  });

  it('nennt nichts, wo niemand auf eine Antwort wartet', () => {
    expect(deadlineOf(testGame())).toBeNull();
    expect(deadlineOf(testGame({ phase: { kind: 'rollPending' } }))).toBeNull();
  });
});

describe('msUntil', () => {
  it('rechnet einen Zeitpunkt in die Restzeit um, nie negativ', () => {
    expect(msUntil({ kind: 'at', at: 5_000, owner: 'p1' }, 2_000)).toBe(3_000);
    expect(msUntil({ kind: 'at', at: 5_000, owner: 'p1' }, 9_000)).toBe(0);
  });

  it('nimmt eine Dauer, wie sie ist', () => {
    expect(msUntil({ kind: 'after', ms: 60_000, owner: 'p1' }, 9_000)).toBe(60_000);
  });
});

describe('timeout beim Angebot', () => {
  it('wird abgelehnt, solange die Frist laeuft', () => {
    expect(canTimeout(tableWithOffer(), 1_000)?.code).toBe(RuleViolationCode.DEADLINE_NOT_REACHED);
  });

  it('raeumt das Angebot ab, sobald die Frist um ist, und bewegt dabei nichts', () => {
    const state = tableWithOffer();
    const due = state.phase.kind === 'tradePending' ? state.phase.expiresAt : 0;

    const result = applyTimeout(state, due);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
    expect(playerNamed(result.state, 'p1').resources).toEqual(playerNamed(state, 'p1').resources);
  });

  it('wird ohne laufende Frist abgelehnt', () => {
    expect(canTimeout(testGame(), 0)?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });
});

describe('ein Geschenk verfaellt', () => {
  it('nimmt dem Vordersten am Aquaedukt die Wahl und laesst den Naechsten waehlen', () => {
    const state = testGame({
      rules: CITIES_RULES,
      phase: { kind: 'aqueductPending', pending: ['p2', 'p3'] },
    });
    const after = expire(state, 'p2');

    expect(after.phase).toEqual({ kind: 'aqueductPending', pending: ['p3'] });
    expect(playerNamed(after, 'p2').resources).toEqual(hand());
  });

  it('schliesst das Aquaedukt, wenn der Letzte schweigt', () => {
    const state = testGame({
      rules: CITIES_RULES,
      phase: { kind: 'aqueductPending', pending: ['p2'] },
    });
    expect(expire(state, 'p2').phase).toEqual({ kind: 'main' });
  });

  it('laesst den Vordersten der Stapelwahl ohne Karte und den Naechsten waehlen', () => {
    const state = testGame({
      rules: CITIES_RULES,
      phase: { kind: 'defenderPending', pending: ['p2', 'p3'] },
      progressDecks: { science: ['mining'], trade: ['merchant'], politics: ['bishop'] },
    });
    const after = expire(state, 'p2');

    expect(after.phase).toEqual({ kind: 'defenderPending', pending: ['p3'] });
    expect(playerNamed(after, 'p2').progressCards).toEqual([]);
  });

  it('laesst Spionage und Grosshaendler ohne Beute enden', () => {
    const spy = patchPlayer(
      testGame({
        rules: CITIES_RULES,
        phase: {
          kind: 'progressPending',
          by: 'p1',
          pending: ['p1'],
          payload: { card: 'spy', victim: 'p2' },
        },
      }),
      'p2',
      { progressCards: ['bishop'] },
    );
    const afterSpy = expire(spy, 'p1');
    expect(afterSpy.phase).toEqual({ kind: 'main' });
    expect(playerNamed(afterSpy, 'p2').progressCards).toEqual(['bishop']);

    const merchant = patchPlayer(
      testGame({
        rules: CITIES_RULES,
        phase: {
          kind: 'progressPending',
          by: 'p1',
          pending: ['p1'],
          payload: { card: 'masterMerchant', victim: 'p2' },
        },
      }),
      'p2',
      { resources: hand({ ore: 2 }) },
    );
    const afterMerchant = expire(merchant, 'p1');
    expect(afterMerchant.phase).toEqual({ kind: 'main' });
    expect(playerNamed(afterMerchant, 'p2').resources).toEqual(hand({ ore: 2 }));
  });

  it('laesst die zweite Runde des Deserteurs ohne Ersatzritter enden', () => {
    const state = testGame({
      rules: CITIES_RULES,
      roads: { [CENTER_EDGE]: 'p1' },
      phase: {
        kind: 'progressPending',
        by: 'p1',
        pending: ['p1'],
        payload: { card: 'deserter', victim: 'p2', replacement: { level: 1, active: false } },
      },
    });
    const after = expire(state, 'p1');

    expect(after.phase).toEqual({ kind: 'main' });
    expect(after.knights).toEqual({});
  });
});

describe('eine Pflicht wird abgenommen', () => {
  it('wirft fuer alle Uebrigen vom groessten Stapel abwaerts ab', () => {
    let state = testGame({
      phase: { kind: 'discardPending', pending: ['p2', 'p3'], counts: {}, resume: 'seven' },
    });
    state = patchPlayer(state, 'p2', { resources: hand({ ore: 5, wool: 3 }) });
    state = patchPlayer(state, 'p3', { resources: hand({ grain: 8 }) });

    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p2').resources).toEqual(hand({ ore: 2, wool: 2 }));
    expect(playerNamed(after, 'p3').resources).toEqual(hand({ grain: 4 }));
    expect(after.phase.kind).not.toBe('discardPending');
  });

  it('gibt die erste zaehlende Fortschrittskarte in fester Ordnung ab', () => {
    const state = patchPlayer(
      testGame({ rules: CITIES_RULES, phase: { kind: 'progressDiscardPending', pending: ['p2'] } }),
      'p2',
      { progressCards: ['warlord', 'crane', 'bishop', 'spy', 'mining'] },
    );
    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p2').progressCards).toEqual(['warlord', 'bishop', 'spy', 'mining']);
  });

  it('schickt den Raeuber auf die Wueste, wenn er dort nicht schon steht', () => {
    const state = testGame({ robber: '1,0', phase: { kind: 'robberPending', resume: 'main' } });
    const after = expire(state, 'p1');

    expect(after.robber).toBe('0,0');
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('schickt den Raeuber sonst auf das erste Feld ohne fremdes Bauwerk', () => {
    const state = testGame({
      phase: { kind: 'robberPending', resume: 'main' },
      buildings: {
        [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
      },
    });
    const after = expire(state, 'p1');

    // Die Wueste '0,0' ist besetzt; '1,-1' und '1,0' tragen p2s Siedlung.
    expect(after.robber).toBe('-1,0');
  });

  it('setzt den Vertriebenen auf die erste legale Kreuzung', () => {
    const state = testGame({
      rules: CITIES_RULES,
      roads: { [NEXT_EDGE]: 'p2' },
      phase: {
        kind: 'displacePending',
        owner: 'p2',
        level: 1,
        active: false,
        activatedOnTurn: null,
        from: FAR_VERTEX,
      },
    });
    const after = expire(state, 'p2');

    expect(after.knights[ADJACENT_VERTEX]?.owner).toBe('p2');
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('nimmt den Vertriebenen vom Brett, wenn es keine Kreuzung gibt', () => {
    const state = testGame({
      rules: CITIES_RULES,
      phase: {
        kind: 'displacePending',
        owner: 'p2',
        level: 1,
        active: false,
        activatedOnTurn: null,
        from: FAR_VERTEX,
      },
    });
    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p2').piecesLeft.knight1).toBe(
      playerNamed(state, 'p2').piecesLeft.knight1 + 1,
    );
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('laesst bei der Hochzeit alle Uebrigen ihre zwei haeufigsten Karten schenken', () => {
    let state = testGame({
      rules: CITIES_RULES,
      phase: {
        kind: 'progressPending',
        by: 'p1',
        pending: ['p2', 'p3'],
        payload: { card: 'wedding' },
      },
    });
    state = patchPlayer(state, 'p2', { resources: hand({ ore: 5, wool: 3 }) });
    state = patchPlayer(state, 'p3', { resources: hand({ grain: 1 }) });

    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ ore: 2, grain: 1 }));
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('laesst beim Handelshafen alle Uebrigen ihre haeufigste Handelsware geben', () => {
    let state = testGame({
      rules: CITIES_RULES,
      phase: {
        kind: 'progressPending',
        by: 'p1',
        pending: ['p2', 'p3'],
        payload: { card: 'tradeHarbor', resource: 'wool' },
      },
    });
    state = patchPlayer(state, 'p1', { resources: hand({ wool: 2 }) });
    state = patchPlayer(state, 'p2', { resources: hand({ paper: 1, cloth: 2 }) });
    state = patchPlayer(state, 'p3', { resources: hand({ coin: 1 }) });

    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ cloth: 1, coin: 1 }));
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('laesst beim Deserteur den schwaechsten Ritter fallen und oeffnet Runde 2', () => {
    const strong: Knight = {
      owner: 'p2',
      level: 2,
      active: true,
      activatedOnTurn: 0,
      upgradedThisTurn: false,
    };
    const simple: Knight = {
      owner: 'p2',
      level: 1,
      active: false,
      activatedOnTurn: null,
      upgradedThisTurn: false,
    };
    const state = testGame({
      rules: CITIES_RULES,
      roads: { [CENTER_EDGE]: 'p1' },
      knights: { [FAR_VERTEX]: strong, [HARBOR3_VERTEX]: simple },
      phase: {
        kind: 'progressPending',
        by: 'p1',
        pending: ['p2'],
        payload: { card: 'deserter', victim: 'p2', replacement: null },
      },
    });
    const after = expire(state, 'p2');

    expect(after.knights[HARBOR3_VERTEX]).toBeUndefined();
    expect(after.knights[FAR_VERTEX]).toEqual(strong);
    // Runde 2 gehoert dem Spielenden und bekommt ihre eigene Frist.
    expect(after.phase).toMatchObject({ pending: ['p1'], payload: { replacement: { level: 1 } } });
  });
});
