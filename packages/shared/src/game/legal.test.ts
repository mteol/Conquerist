import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES } from '../rules/index.js';
import {
  CENTER_EDGE,
  CENTER_VERTEX,
  NEXT_EDGE,
  TEST_PLAYERS,
  TEST_SCENARIO,
  giving,
  hand,
  testGame,
} from './fixtures.js';
import { legalActions } from './legal.js';
import { applyOfferTrade, applyRespondTrade } from './playerTrade.js';
import { reduce } from './reducer.js';
import { createGame } from './setup.js';
import type { GameState } from './state.js';

/**
 * Die entscheidende Eigenschaft: was `legalActions` nennt, muss `reduce`
 * annehmen. Faellt das auseinander, gibt es zwei Regelauslegungen - genau der
 * Fehler, den die Aufteilung in `can…` und `apply…` verhindern soll.
 */
function expectAllAccepted(state: GameState, player: string): number {
  const actions = legalActions(state, player);

  for (const action of actions) {
    const result = reduce(state, action);
    if (!result.ok) {
      throw new Error(
        `legalActions nennt ${action.type}, reduce lehnt ab: ${result.error.code} - ${result.error.message}`,
      );
    }
  }

  return actions.length;
}

describe('legalActions', () => {
  it('nennt in der Gruendungsphase lauter setzbare Knoten', () => {
    const state = createGame(TEST_SCENARIO, CLASSIC_RULES, TEST_PLAYERS, 'legal');
    const actions = legalActions(state, 'p1');

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => action.type === 'placeSetupSettlement')).toBe(true);
    expectAllAccepted(state, 'p1');
  });

  it('nennt nach der Siedlung nur die Kanten an ihr', () => {
    const state = testGame({
      phase: { kind: 'setup', placement: 0, settlement: CENTER_VERTEX },
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
    });

    const actions = legalActions(state, 'p1');
    expect(actions.every((action) => action.type === 'placeSetupRoad')).toBe(true);
    expect(actions).toHaveLength(3);
    expectAllAccepted(state, 'p1');
  });

  it('nennt beim Wuerfeln genau den Wurf', () => {
    const state = testGame({ phase: { kind: 'rollPending' } });

    expect(legalActions(state, 'p1')).toEqual([{ type: 'rollDice', player: 'p1' }]);
    expectAllAccepted(state, 'p1');
  });

  it('nennt einem Spieler ohne Zugrecht nichts', () => {
    for (const phase of [
      { kind: 'rollPending' as const },
      { kind: 'main' as const },
      { kind: 'robberPending' as const },
    ]) {
      expect(legalActions(testGame({ phase }), 'p2')).toEqual([]);
    }
  });

  it('nennt nach Spielende nichts mehr', () => {
    const state = testGame({ phase: { kind: 'finished', winner: 'p1' } });

    for (const player of TEST_PLAYERS) expect(legalActions(state, player)).toEqual([]);
  });

  it('zaehlt das Abwerfen bewusst nicht auf', () => {
    const state = giving(testGame({ phase: { kind: 'discardPending', pending: ['p1'] } }), 'p1', {
      brick: 8,
    });

    expect(legalActions(state, 'p1')).toEqual([]);
  });

  it('nennt beim Raeuber jedes Feld ausser dem aktuellen', () => {
    const state = testGame({ phase: { kind: 'robberPending' } });
    const actions = legalActions(state, 'p1');

    expect(actions).toHaveLength(TEST_SCENARIO.hexes.length - 1);
    expect(actions.every((action) => action.type === 'moveRobber')).toBe(true);
    expectAllAccepted(state, 'p1');
  });

  it('nennt beim Raeuber jedes moegliche Opfer einzeln', () => {
    const state = giving(
      testGame({
        phase: { kind: 'robberPending' },
        buildings: { [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement' } },
      }),
      'p2',
      { wool: 2 },
    );

    const atHills = legalActions(state, 'p1').filter(
      (action) => action.type === 'moveRobber' && action.hex === '1,-1',
    );

    expect(atHills).toEqual([{ type: 'moveRobber', player: 'p1', hex: '1,-1', victim: 'p2' }]);
    expectAllAccepted(state, 'p1');
  });

  it('nennt in der Hauptphase immer wenigstens das Zugende', () => {
    const state = testGame({ phase: { kind: 'main' } });

    expect(legalActions(state, 'p1')).toEqual([{ type: 'endTurn', player: 'p1' }]);
    expectAllAccepted(state, 'p1');
  });

  it('nennt mit Karten in der Hand auch Bauen und Handeln - und reduce nimmt alles an', () => {
    const state = giving(
      testGame({
        phase: { kind: 'main' },
        // Zwei Strassen weit: der naechste freie Knoten liegt damit zwei
        // Schritte entfernt und verletzt die Abstandsregel nicht.
        buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
        roads: { [CENTER_EDGE]: 'p1', [NEXT_EDGE]: 'p1' },
      }),
      'p1',
      { brick: 4, lumber: 4, wool: 4, grain: 4, ore: 4 },
    );

    const actions = legalActions(state, 'p1');
    const types = new Set(actions.map((action) => action.type));

    expect(types).toContain('buildRoad');
    expect(types).toContain('buildSettlement');
    expect(types).toContain('buildCity');
    expect(types).toContain('tradeWithBank');
    expect(types).toContain('endTurn');
    expect(expectAllAccepted(state, 'p1')).toBe(actions.length);
  });

  it('nennt keinen Tausch, den der Kurs nicht hergibt', () => {
    const state = giving(testGame({ phase: { kind: 'main' } }), 'p1', { ore: 3 });

    const trades = legalActions(state, 'p1').filter((action) => action.type === 'tradeWithBank');
    expect(trades).toEqual([]);
  });

  it('nennt keine Stadt ohne eigene Siedlung', () => {
    const state = giving(
      testGame({
        phase: { kind: 'main' },
        buildings: { [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement' } },
      }),
      'p1',
      hand(CLASSIC_RULES.buildCosts.city),
    );

    const cities = legalActions(state, 'p1').filter((action) => action.type === 'buildCity');
    expect(cities).toEqual([]);
  });
});

describe('legalActions in tradePending', () => {
  function offered(): GameState {
    const rich = giving(giving(testGame(), 'p1', { lumber: 3 }), 'p2', { ore: 2 });
    const result = applyOfferTrade(rich, 'p1', hand({ lumber: 2 }), hand({ ore: 1 }), 0);
    if (!result.ok) throw new Error('Angebot wurde abgelehnt');
    return result.state;
  }

  it('bietet dem Mitspieler mit Karten beide Antworten an', () => {
    const types = legalActions(offered(), 'p2').map((action) => action.type);

    expect(types).toEqual(['respondTrade', 'respondTrade']);
  });

  it('bietet dem Mitspieler ohne die verlangten Karten nur die Ablehnung an', () => {
    const poor = giving(offered(), 'p2', {});

    expect(legalActions(poor, 'p2')).toEqual([
      { type: 'respondTrade', player: 'p2', response: 'declined' },
    ]);
  });

  it('gibt dem Anbieter das Zuruecknehmen und keinen Zuschlag ohne Zusage', () => {
    expect(legalActions(offered(), 'p1')).toEqual([{ type: 'withdrawTrade', player: 'p1' }]);
  });

  it('gibt dem Anbieter je Zusage einen Zuschlag', () => {
    const answered = applyRespondTrade(offered(), 'p2', 'accepted');
    if (!answered.ok) throw new Error('Antwort wurde abgelehnt');

    expect(legalActions(answered.state, 'p1')).toEqual([
      { type: 'acceptTrade', player: 'p1', partner: 'p2' },
      { type: 'withdrawTrade', player: 'p1' },
    ]);
  });

  it('nennt jedem nur, was reduce von ihm auch annimmt', () => {
    expectAllAccepted(offered(), 'p2');
    expectAllAccepted(offered(), 'p1');
  });
});
