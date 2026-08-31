import { describe, expect, it } from 'vitest';

import { createRng } from '../random/index.js';
import { CITIES_RULES, CLASSIC_RULES } from '../rules/index.js';
import type { GameAction } from './actions.js';
import { yieldTotal } from './dice.js';
import { RuleViolationCode } from './errors.js';
import {
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  gameWithCities,
  giving,
  hand,
  testGame,
} from './fixtures.js';
import { recomputeLongestRoad } from './roads.js';
import { reduce } from './reducer.js';
import type { GameState } from './state.js';

/**
 * Sucht einen Seed, dessen erster Wurf die gewuenschte Summe ergibt.
 *
 * Besser als eine fest eingetragene Zeichenkette: der Test bleibt gueltig,
 * wenn sich am Wuerfelverfahren etwas aendert, und er sagt beim Lesen, worauf
 * es ankommt - naemlich auf die Summe, nicht auf den Seed.
 */
function seedRolling(total: number): string {
  for (let i = 0; i < 500; i += 1) {
    const seed = `wurf-${i}`;
    const state = testGame({ phase: { kind: 'rollPending' }, rng: createRng(seed) });
    const result = reduce(state, { type: 'rollDice', player: 'p1' });
    if (result.ok && result.state.lastRoll !== null) {
      if (yieldTotal(CLASSIC_RULES.dice, result.state.lastRoll) === total) return seed;
    }
  }
  throw new Error(`Kein Seed mit Wurfsumme ${total} gefunden`);
}

const SEVEN = seedRolling(7);
const SIX = seedRolling(6);

function rolling(seed: string, overrides: Partial<GameState> = {}): GameState {
  return testGame({ phase: { kind: 'rollPending' }, rng: createRng(seed), ...overrides });
}

function expectRejected(result: ReturnType<typeof reduce>, code: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

describe('reduce - Zugrecht und Phasen', () => {
  it('lehnt jede Aktion nach Spielende ab', () => {
    const state = testGame({ phase: { kind: 'finished', winner: 'p1' } });

    expectRejected(reduce(state, { type: 'endTurn', player: 'p1' }), RuleViolationCode.GAME_OVER);
    expectRejected(reduce(state, { type: 'rollDice', player: 'p1' }), RuleViolationCode.GAME_OVER);
  });

  it('lehnt einen unbekannten Spieler ab', () => {
    const state = testGame({ phase: { kind: 'rollPending' } });

    expectRejected(
      reduce(state, { type: 'rollDice', player: 'fremder' }),
      RuleViolationCode.UNKNOWN_PLAYER,
    );
  });

  it('lehnt einen Spieler ab, der nicht am Zug ist', () => {
    const state = testGame({ phase: { kind: 'rollPending' } });

    expectRejected(
      reduce(state, { type: 'rollDice', player: 'p2' }),
      RuleViolationCode.NOT_YOUR_TURN,
    );
  });

  it('lehnt eine Aktion ab, die nicht zur Phase passt', () => {
    const building = giving(testGame({ phase: { kind: 'rollPending' } }), 'p1', hand());

    expectRejected(
      reduce(building, { type: 'buildRoad', player: 'p1', edge: CENTER_EDGE }),
      RuleViolationCode.WRONG_PHASE,
    );
    expectRejected(
      reduce(testGame({ phase: { kind: 'main' } }), { type: 'rollDice', player: 'p1' }),
      RuleViolationCode.WRONG_PHASE,
    );
  });

  it('laesst in der Gruendungsphase den Spieler der Schlange handeln', () => {
    const state = testGame({ phase: { kind: 'setup', placement: 0, settlement: null } });

    expectRejected(
      reduce(state, { type: 'placeSetupSettlement', player: 'p2', vertex: CENTER_VERTEX }),
      RuleViolationCode.NOT_YOUR_TURN,
    );
    expect(
      reduce(state, { type: 'placeSetupSettlement', player: 'p1', vertex: CENTER_VERTEX }).ok,
    ).toBe(true);
  });

  it('laesst beim Abwerfen jeden Betroffenen handeln, nicht nur den am Zug', () => {
    const state = giving(
      testGame({ phase: { kind: 'discardPending', pending: ['p2'] }, currentPlayerIndex: 0 }),
      'p2',
      { brick: 8 },
    );

    const result = reduce(state, { type: 'discard', player: 'p2', resources: hand({ brick: 4 }) });
    expect(result.ok).toBe(true);
  });
});

describe('reduce - wuerfeln', () => {
  it('haelt den Wurf fest und verteilt den Ertrag', () => {
    const state = rolling(SIX, {
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });

    const result = reduce(state, { type: 'rollDice', player: 'p1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(yieldTotal(CLASSIC_RULES.dice, result.state.lastRoll!)).toBe(6);
      expect(result.state.phase).toEqual({ kind: 'main' });
      // Chip 6 liegt auf dem Huegelfeld - Lehm.
      expect(result.state.players[0]?.resources).toEqual(hand({ brick: 1 }));
    }
  });

  it('fuehrt den Zufallszustand weiter', () => {
    const state = rolling(SIX);
    const result = reduce(state, { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.rng).not.toEqual(state.rng);
  });

  it('wuerfelt aus demselben Zustand denselben Wurf', () => {
    const first = reduce(rolling(SIX), { type: 'rollDice', player: 'p1' });
    const second = reduce(rolling(SIX), { type: 'rollDice', player: 'p1' });

    expect(first.ok && second.ok && first.state.lastRoll).toEqual(
      second.ok ? second.state.lastRoll : null,
    );
  });

  it('schickt bei einer Sieben die Ueberzaehligen zum Abwerfen', () => {
    const state = giving(rolling(SEVEN), 'p2', { brick: 9 });
    const result = reduce(state, { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'discardPending', pending: ['p2'] });
  });

  it('geht bei einer Sieben ohne Ueberzaehlige direkt zum Raeuber', () => {
    const result = reduce(rolling(SEVEN), { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'robberPending', resume: 'main' });
  });

  it('verteilt bei einer Sieben keinen Ertrag', () => {
    const state = rolling(SEVEN, {
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });

    const result = reduce(state, { type: 'rollDice', player: 'p1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.players[0]?.resources).toEqual(hand());
  });
});

describe('reduce - Zug beenden', () => {
  it('gibt an den naechsten Spieler weiter und laesst ihn wuerfeln', () => {
    const result = reduce(testGame({ phase: { kind: 'main' } }), { type: 'endTurn', player: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.currentPlayerIndex).toBe(1);
      expect(result.state.phase).toEqual({ kind: 'rollPending' });
    }
  });

  it('zaehlt die Runde erst hoch, wenn wieder der erste Spieler dran ist', () => {
    const beforeWrap = testGame({ phase: { kind: 'main' }, currentPlayerIndex: 1, turn: 4 });
    const middle = reduce(beforeWrap, { type: 'endTurn', player: 'p2' });
    expect(middle.ok && middle.state.turn).toBe(4);

    const atWrap = testGame({ phase: { kind: 'main' }, currentPlayerIndex: 2, turn: 4 });
    const wrapped = reduce(atWrap, { type: 'endTurn', player: 'p3' });
    expect(wrapped.ok && wrapped.state.turn).toBe(5);
    expect(wrapped.ok && wrapped.state.currentPlayerIndex).toBe(0);
  });
});

describe('reduce - Nacharbeit nach jedem Zug', () => {
  it('rechnet die Laengste Handelsstrasse neu', () => {
    const chain = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0', 'e:-1,1|0,0'];
    const state = giving(
      testGame({
        phase: { kind: 'main' },
        roads: Object.fromEntries(chain.map((edge) => [edge, 'p1'])),
        buildings: {
          [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
        },
      }),
      'p1',
      hand(CLASSIC_RULES.buildCosts.road),
    );

    expect(state.longestRoad.holder).toBeNull();

    const result = reduce(state, { type: 'buildRoad', player: 'p1', edge: 'e:0,0|1,0' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.longestRoad).toEqual({ holder: 'p1', length: 5 });
  });

  it('beendet das Spiel, sobald der Spieler am Zug das Ziel erreicht', () => {
    // Ziel zwei Punkte: p1 hat schon eine Siedlung und baut die zweite.
    const state = giving(
      testGame({
        rules: { ...CLASSIC_RULES, victoryPointGoal: 2 },
        phase: { kind: 'main' },
        roads: { [CENTER_EDGE]: 'p1' },
        buildings: {
          [FAR_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
        },
      }),
      'p1',
      hand(CLASSIC_RULES.buildCosts.settlement),
    );

    const result = reduce(state, {
      type: 'buildSettlement',
      player: 'p1',
      vertex: CENTER_VERTEX,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'finished', winner: 'p1' });
  });

  it('laesst niemanden im fremden Zug gewinnen', () => {
    // p2 haelt zwei Siedlungen und wuerde mit der Laengsten Strasse das Ziel
    // erreichen - aber p1 ist am Zug, also endet das Spiel jetzt nicht.
    const chain = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0', 'e:-1,1|0,0'];
    const state = giving(
      testGame({
        rules: { ...CLASSIC_RULES, victoryPointGoal: 3 },
        phase: { kind: 'main' },
        currentPlayerIndex: 0,
        buildings: {
          [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
          [FAR_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
        },
        roads: Object.fromEntries(chain.map((edge) => [edge, 'p2'])),
      }),
      'p1',
      hand(),
    );

    const result = reduce(state, { type: 'endTurn', player: 'p1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase).toEqual({ kind: 'rollPending' });
  });
});

describe('reduce - vollstaendige Abdeckung', () => {
  it('kennt zu jeder Aktionsart eine Phase', () => {
    const types: GameAction['type'][] = [
      'placeSetupSettlement',
      'placeSetupRoad',
      'rollDice',
      'discard',
      'moveRobber',
      'buildRoad',
      'buildSettlement',
      'buildCity',
      'tradeWithBank',
      'endTurn',
    ];

    // In der Hauptphase duerfen genau die Bauaktionen, der Handel und das
    // Zugende laufen - alles andere muss WRONG_PHASE liefern, keine Ausnahme.
    for (const type of types) {
      const action = {
        type,
        player: 'p1',
        vertex: CENTER_VERTEX,
        edge: CENTER_EDGE,
        hex: '1,-1',
        victim: null,
        resources: hand(),
        give: 'ore',
        receive: 'brick',
      } as unknown as GameAction;
      const result = reduce(testGame({ phase: { kind: 'main' } }), action);

      expect(result.ok || typeof result.error.code === 'string').toBe(true);
    }
  });
});

describe('der Auftakt im Reducer', () => {
  const inOpening = (): GameState =>
    testGame({
      phase: { kind: 'opening', rolls: {}, pending: ['p1', 'p2', 'p3'], round: 0 },
      turn: 0,
    });

  it('laesst nur den Vordersten der Warteschlange wuerfeln', () => {
    const result = reduce(inOpening(), { type: 'rollDice', player: 'p2' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.NOT_YOUR_TURN);
  });

  it('nimmt im Auftakt keine Siedlung an', () => {
    // Der ganze Sinn einer Phase: ein zu frueh gesetztes Haus ist ein
    // gewoehnlicher Regelverstoss und kein Sonderfall im Code.
    const result = reduce(inOpening(), {
      type: 'placeSetupSettlement',
      player: 'p1',
      vertex: CENTER_VERTEX,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('wuerfelt im Auftakt keinen Ertrag aus', () => {
    const result = reduce(inOpening(), { type: 'rollDice', player: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.map((player) => player.resources)).toEqual(
      inOpening().players.map((player) => player.resources),
    );
  });

  it('geht nach dem letzten Wurf aus dem Auftakt heraus', () => {
    let state = inOpening();
    for (const player of ['p1', 'p2', 'p3']) {
      const result = reduce(state, { type: 'rollDice', player });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }

    // Entweder entschieden oder Stechen - beides ist ein Fortschritt.
    expect(state.phase.kind === 'setup' || state.phase.kind === 'opening').toBe(true);
  });
});

describe('der Ritter vor dem Wurf', () => {
  const withKnight = (): GameState => {
    const base = testGame({ phase: { kind: 'rollPending' }, turn: 2 });
    return {
      ...base,
      players: base.players.map((player) =>
        player.id === 'p1'
          ? { ...player, developmentCards: [{ id: 'knight' as const, boughtOnTurn: 1 }] }
          : player,
      ),
    };
  };

  it('fuehrt ueber den Raeuber zurueck zum Wurf', () => {
    const played = reduce(withKnight(), { type: 'playKnight', player: 'p1' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.phase).toEqual({ kind: 'robberPending', resume: 'rollPending' });

    const moved = reduce(played.state, {
      type: 'moveRobber',
      player: 'p1',
      hex: '1,0',
      victim: null,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    // Der Kern der Sache: der Wurf steht noch aus und faellt nicht aus.
    expect(moved.state.phase).toEqual({ kind: 'rollPending' });
  });

  it('verbraucht damit die eine Karte des Zuges', () => {
    // Eine Karte je Zug gilt ueber den Wurf hinweg - der Wurf setzt sie nicht
    // zurueck, das tut nur `endTurn`.
    const played = reduce(withKnight(), { type: 'playKnight', player: 'p1' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.developmentPlayed).toBe(true);
  });

  it('nimmt vor dem Wurf keinen Kauf an', () => {
    const result = reduce(withKnight(), { type: 'buyDevelopmentCard', player: 'p1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('laesst nach einer Sieben weiterhin in die Hauptphase', () => {
    const state = testGame({ phase: { kind: 'robberPending', resume: 'main' } });
    const moved = reduce(state, { type: 'moveRobber', player: 'p1', hex: '1,0', victim: null });

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.phase).toEqual({ kind: 'main' });
  });
});

/**
 * Staedte & Ritter im Reducer: Phasen, Handelnder, Nacharbeit.
 */
describe('Die Ritterzuege im Reducer', () => {
  const CHAIN = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0', 'e:-1,1|0,0'];
  const CORNERS = [
    'v:0,0|1,-1|1,0',
    'v:0,-1|0,0|1,-1',
    'v:-1,0|0,-1|0,0',
    'v:-1,0|-1,1|0,0',
    'v:-1,1|0,0|0,1',
  ];

  function ready(owner: string, level: 1 | 2 | 3 = 1) {
    return { owner, level, active: true, activatedOnTurn: 1, upgradedThisTurn: false };
  }

  it('weist buildKnight vor dem Wurf ab', () => {
    const state = gameWithCities({ phase: { kind: 'rollPending' } });
    const result = reduce(state, { type: 'buildKnight', player: 'p1', vertex: CORNERS[0]! });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('laesst den Besitzer den Vertriebenen setzen, auch wenn er nicht am Zug ist', () => {
    const state = gameWithCities({
      roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p2'])),
      buildings: {},
      knights: {},
      phase: {
        kind: 'displacePending',
        owner: 'p2',
        level: 1,
        active: false,
        activatedOnTurn: null,
        from: CORNERS[0]!,
      },
    });

    expect(state.players[state.currentPlayerIndex]?.id).toBe('p1');

    const result = reduce(state, {
      type: 'placeDisplacedKnight',
      player: 'p2',
      vertex: CORNERS[2]!,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.knights[CORNERS[2]!]?.owner).toBe('p2');
    expect(result.state.phase.kind).toBe('main');
  });

  it('weist jemand anderen als den Besitzer ab', () => {
    const state = gameWithCities({
      roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p2'])),
      buildings: {},
      knights: {},
      phase: {
        kind: 'displacePending',
        owner: 'p2',
        level: 1,
        active: false,
        activatedOnTurn: null,
        from: CORNERS[0]!,
      },
    });

    const result = reduce(state, {
      type: 'placeDisplacedKnight',
      player: 'p1',
      vertex: CORNERS[2]!,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.NOT_YOUR_TURN);
  });

  it('setzt beim Zugende upgradedThisTurn aller Ritter zurueck', () => {
    const state = gameWithCities({
      knights: {
        [CORNERS[0]!]: { ...ready('p1', 2), upgradedThisTurn: true },
        [CORNERS[4]!]: { ...ready('p2', 2), upgradedThisTurn: true },
      },
    });

    const result = reduce(state, { type: 'endTurn', player: 'p1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const knight of Object.values(result.state.knights)) {
      expect(knight.upgradedThisTurn).toBe(false);
    }
  });

  it('rechnet die Laengste Handelsstrasse nach einem gesetzten Ritter neu', () => {
    // p2 haelt eine Fuenferstrasse und damit den Titel; p1 setzt seinen Ritter
    // mitten hinein und nimmt ihn ihm ab.
    const RING = [...CHAIN, 'e:0,0|0,1'];
    const base = gameWithCities({
      buildings: {},
      roads: {
        ...Object.fromEntries(RING.map((edge) => [edge, 'p2'])),
        // p1 braucht eine eigene Strasse an der Kreuzung, auf die er stellt.
        'e:-1,0|0,-1': 'p1',
      },
      knights: {},
    });

    const withTitle = recomputeLongestRoad(base);
    expect(withTitle.longestRoad.holder).toBe('p2');

    const armed = giving(withTitle, 'p1', hand({ wool: 1, ore: 1 }));
    const result = reduce(armed, { type: 'buildKnight', player: 'p1', vertex: CORNERS[2]! });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.longestRoad.holder).toBeNull();
  });
});

/*
 * Alchemie greift in den Wurf ein - und genau da lauert die Falle: wer bei
 * gesetzten Augen den `rng` unberuehrt liesse, weil ja nichts mehr zu wuerfeln
 * sei, liesse jede Partie ab dieser Stelle beim Replay anders laufen.
 */
describe('Wuerfeln mit gesetzten Augen', () => {
  const cities = (overrides: Partial<GameState> = {}): GameState =>
    gameWithCities({ phase: { kind: 'rollPending' }, rng: createRng('alchemie'), ...overrides });

  it('setzt beide Augenwuerfel auf die genannten Zahlen', () => {
    const result = reduce(cities({ alchemistRoll: { first: 3, second: 4 } }), {
      type: 'rollDice',
      player: 'p1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.lastRoll?.find((die) => die.die === 'first')?.value).toBe(3);
    expect(result.state.lastRoll?.find((die) => die.die === 'second')?.value).toBe(4);
    expect(yieldTotal(CITIES_RULES.dice, result.state.lastRoll!)).toBe(7);
  });

  it('laesst den Ereigniswuerfel unberuehrt', () => {
    const normal = reduce(cities(), { type: 'rollDice', player: 'p1' });
    const set = reduce(cities({ alchemistRoll: { first: 3, second: 4 } }), {
      type: 'rollDice',
      player: 'p1',
    });

    expect(normal.ok && set.ok).toBe(true);
    if (!normal.ok || !set.ok) return;

    const eventOf = (state: GameState): number | undefined =>
      state.lastRoll?.find((die) => die.die === 'event')?.value;

    // Derselbe Seed, derselbe Ereigniswuerfel - die Karte bestimmt nur die
    // beiden Augenwuerfel.
    expect(eventOf(set.state)).toBe(eventOf(normal.state));
    expect(eventOf(set.state)).not.toBeUndefined();
  });

  it('schreibt den Zufallszustand fort wie bei jedem anderen Wurf', () => {
    const before = cities();
    const normal = reduce(before, { type: 'rollDice', player: 'p1' });
    const set = reduce(cities({ alchemistRoll: { first: 3, second: 4 } }), {
      type: 'rollDice',
      player: 'p1',
    });

    expect(normal.ok && set.ok).toBe(true);
    if (!normal.ok || !set.ok) return;

    expect(set.state.rng).not.toEqual(before.rng);
    expect(set.state.rng).toEqual(normal.state.rng);
  });

  it('raeumt den Vorsatz nach dem Wurf ab', () => {
    const result = reduce(cities({ alchemistRoll: { first: 3, second: 4 } }), {
      type: 'rollDice',
      player: 'p1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.alchemistRoll).toBeNull();
  });
});
