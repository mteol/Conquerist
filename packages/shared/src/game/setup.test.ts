import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES } from '../rules/index.js';
import { CLASSIC_34, generateScenario } from '../scenario/index.js';
import { RuleViolationCode } from './errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  NEXT_EDGE,
  TEST_PLAYERS,
  TEST_SCENARIO,
  hand,
} from './fixtures.js';
import { applySetupRoad, applySetupSettlement, createGame } from './setup.js';
import type { GameState } from './state.js';

function newGame(players: readonly string[] = TEST_PLAYERS): GameState {
  return createGame(TEST_SCENARIO, CLASSIC_RULES, players, 'setup-test');
}

/** Setzt Siedlung und Strasse und gibt den Folgezustand zurueck. */
function place(state: GameState, player: string, vertex: string, edge: string): GameState {
  const afterSettlement = applySetupSettlement(state, player, vertex);
  expect(afterSettlement.ok).toBe(true);
  if (!afterSettlement.ok) throw new Error(afterSettlement.error.message);

  const afterRoad = applySetupRoad(afterSettlement.state, player, edge);
  expect(afterRoad.ok).toBe(true);
  if (!afterRoad.ok) throw new Error(afterRoad.error.message);

  return afterRoad.state;
}

describe('createGame', () => {
  it('beginnt in der Gruendungsphase beim ersten Spieler', () => {
    const state = newGame();

    expect(state.phase).toEqual({ kind: 'setup', placement: 0, settlement: null });
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.turn).toBe(0);
  });

  it('gibt jedem Spieler leere Haende und den vollen Bauteilvorrat', () => {
    for (const player of newGame().players) {
      expect(player.resources).toEqual(hand());
      expect(player.piecesLeft).toEqual(CLASSIC_RULES.pieceStock);
    }
  });

  it('setzt Raeuber und Bank aus Szenario und Regelwerk', () => {
    const state = newGame();

    expect(state.robber).toBe(TEST_SCENARIO.robberStart);
    expect(state.bank).toEqual(CLASSIC_RULES.resourceBank);
    expect(state.buildings).toEqual({});
    expect(state.roads).toEqual({});
    expect(state.lastRoll).toBeNull();
  });

  it('erzeugt aus demselben Seed denselben Startzustand', () => {
    expect(newGame()).toEqual(newGame());
  });

  it('erzeugt aus verschiedenen Seeds verschiedene Zufallszustaende', () => {
    const a = createGame(TEST_SCENARIO, CLASSIC_RULES, TEST_PLAYERS, 'a');
    const b = createGame(TEST_SCENARIO, CLASSIC_RULES, TEST_PLAYERS, 'b');

    expect(a.rng).not.toEqual(b.rng);
  });

  it('haelt die Reihenfolge der uebergebenen Spieler ein', () => {
    expect(newGame(['c', 'a', 'b']).players.map((player) => player.id)).toEqual(['c', 'a', 'b']);
  });

  it('lehnt eine Tischgroesse ab, die das Szenario nicht vorsieht', () => {
    expect(() => newGame(['p1'])).toThrow(RangeError);
    expect(() => newGame(['p1', 'p2', 'p3', 'p4', 'p5'])).toThrow(RangeError);
  });

  it('lehnt doppelte Spieler ab', () => {
    expect(() => newGame(['p1', 'p1'])).toThrow(RangeError);
  });

  it('nimmt ein erzeugtes Szenario genauso an wie ein handgelegtes', () => {
    const scenario = generateScenario(CLASSIC_34, 'setup-test');
    const state = createGame(scenario, CLASSIC_RULES, ['p1', 'p2', 'p3'], 'seed');

    expect(state.robber).toBe(scenario.robberStart);
  });
});

describe('applySetupSettlement', () => {
  it('setzt kostenlos und ohne Anschlusspflicht', () => {
    const result = applySetupSettlement(newGame(), 'p1', CENTER_VERTEX);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.buildings[CENTER_VERTEX]).toEqual({ owner: 'p1', kind: 'settlement' });
      expect(result.state.players[0]?.resources).toEqual(hand());
      expect(result.state.players[0]?.piecesLeft.settlement).toBe(
        CLASSIC_RULES.pieceStock.settlement - 1,
      );
      expect(result.state.phase).toEqual({
        kind: 'setup',
        placement: 0,
        settlement: CENTER_VERTEX,
      });
    }
  });

  it('haelt auch hier die Abstandsregel ein', () => {
    const state = place(newGame(), 'p1', CENTER_VERTEX, CENTER_EDGE);
    const result = applySetupSettlement(state, 'p2', ADJACENT_VERTEX);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.TOO_CLOSE);
  });

  it('lehnt eine zweite Siedlung vor der Strasse ab', () => {
    const afterFirst = applySetupSettlement(newGame(), 'p1', CENTER_VERTEX);
    expect(afterFirst.ok).toBe(true);
    if (!afterFirst.ok) return;

    const result = applySetupSettlement(afterFirst.state, 'p1', FAR_VERTEX);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('bringt in der ersten Runde noch keinen Ertrag', () => {
    const result = applySetupSettlement(newGame(), 'p1', CENTER_VERTEX);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.players[0]?.resources).toEqual(hand());
  });

  it('bringt in der zweiten Runde sofort Ertrag', () => {
    // Bei drei Spielern laufen die Setzungen 0 bis 2 in der ersten Runde; die
    // Setzung mit Index 3 ist die erste der zweiten Runde - und p3 ist als
    // letzter Spieler der Schlange zweimal hintereinander dran.
    let state = newGame();
    state = place(state, 'p1', CENTER_VERTEX, CENTER_EDGE);
    state = place(state, 'p2', FAR_VERTEX, NEXT_EDGE);
    state = place(state, 'p3', 'v:-1,0|0,-1|0,0', 'e:-1,0|0,0');

    const result = applySetupSettlement(state, 'p3', 'v:-1,1|0,0|0,1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Berg (4, Erz), Wueste (nichts), Wald (10, Holz).
      expect(result.state.players[2]?.resources).toEqual(hand({ ore: 1, lumber: 1 }));
    }
  });
});

describe('applySetupRoad', () => {
  it('muss an der gerade gesetzten Siedlung anschliessen', () => {
    const afterSettlement = applySetupSettlement(newGame(), 'p1', CENTER_VERTEX);
    expect(afterSettlement.ok).toBe(true);
    if (!afterSettlement.ok) return;

    const wrong = applySetupRoad(afterSettlement.state, 'p1', NEXT_EDGE);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe(RuleViolationCode.NOT_CONNECTED);

    expect(applySetupRoad(afterSettlement.state, 'p1', CENTER_EDGE).ok).toBe(true);
  });

  it('lehnt eine Strasse ohne vorherige Siedlung ab', () => {
    const result = applySetupRoad(newGame(), 'p1', CENTER_EDGE);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('gibt den Zug an den naechsten Spieler der Schlange weiter', () => {
    const state = place(newGame(), 'p1', CENTER_VERTEX, CENTER_EDGE);

    expect(state.phase).toEqual({ kind: 'setup', placement: 1, settlement: null });
    expect(state.currentPlayerIndex).toBe(1);
  });

  it('kostet nichts und verbraucht ein Strassenteil', () => {
    const state = place(newGame(), 'p1', CENTER_VERTEX, CENTER_EDGE);

    expect(state.players[0]?.resources).toEqual(hand());
    expect(state.players[0]?.piecesLeft.road).toBe(CLASSIC_RULES.pieceStock.road - 1);
    expect(state.bank).toEqual(CLASSIC_RULES.resourceBank);
  });
});

describe('Ende der Gruendungsphase', () => {
  it('geht nach der letzten Setzung zum ersten Spieler und laesst wuerfeln', () => {
    // Sechs Setzungen bei drei Spielern, Reihenfolge p1 p2 p3 p3 p2 p1.
    const spots: readonly (readonly [string, string, string])[] = [
      ['p1', CENTER_VERTEX, CENTER_EDGE],
      ['p2', FAR_VERTEX, NEXT_EDGE],
      ['p3', 'v:-1,0|0,-1|0,0', 'e:-1,0|0,0'],
      ['p3', 'v:-1,1|0,0|0,1', 'e:-1,1|0,1'],
      ['p2', 'v:0,-1|1,-2|1,-1', 'e:0,-1|1,-1'],
      ['p1', 'v:-2,1|-2,2|-1,1', 'e:-2,1|-1,1'],
    ];

    let state = newGame();
    for (const [player, vertex, edge] of spots) {
      expect(state.players[state.currentPlayerIndex]?.id).toBe(player);
      state = place(state, player, vertex, edge);
    }

    expect(state.phase).toEqual({ kind: 'rollPending' });
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.turn).toBe(1);
    expect(Object.keys(state.buildings)).toHaveLength(6);
    expect(Object.keys(state.roads)).toHaveLength(6);
  });
});
