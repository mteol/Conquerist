import { describe, expect, it } from 'vitest';
import {
  CITIES_RULES,
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  ScenarioDefinitionSchema,
  boardOf,
  terrainYield,
  type GameAction,
  type GameState,
  type ScenarioDefinition,
} from '@conquerist/shared';
import { actionTargets, bishopTargets, merchantTargets, targetsFrom } from './targets';
import { afterOpening } from '../test/opening';

const scenario = generateScenario(CLASSIC_34, 'targets-probe');
const ids = ['p1', 'p2', 'p3'];

function fresh(): GameState {
  return afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'targets-probe'));
}

/** Spielt die Gruendungsphase mit der jeweils ersten erlaubten Wahl durch. */
function afterSetup(): GameState {
  let state = fresh();

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const action = legalActions(state, player)[0]!;
    const result = reduce(state, action);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

describe('Klickkarten', () => {
  it('legt jede Gruendungssiedlung auf ihren Knoten', () => {
    const state = fresh();
    const player = setupPlayer(state)!;
    const targets = actionTargets(state, player);

    expect(targets.edges.size).toBe(0);
    expect(targets.roll).toBeNull();
    expect(targets.vertices.size).toBeGreaterThan(0);

    for (const [vertex, action] of targets.vertices) {
      expect(action.type).toBe('placeSetupSettlement');
      expect(action).toMatchObject({ player, vertex });
    }
  });

  it('nennt nach der Siedlung nur noch die anschliessenden Kanten', () => {
    let state = fresh();
    const player = setupPlayer(state)!;
    const first = legalActions(state, player)[0]!;
    const result = reduce(state, first);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;

    const targets = actionTargets(state, player);

    expect(targets.vertices.size).toBe(0);
    expect(targets.edges.size).toBeGreaterThan(0);
    for (const action of targets.edges.values()) {
      expect(action.type).toBe('placeSetupRoad');
    }
  });

  it('bietet vor dem Wuerfeln nur das Wuerfeln an', () => {
    const state = afterSetup();
    const player = state.players[state.currentPlayerIndex]!.id;
    const targets = actionTargets(state, player);

    expect(state.phase.kind).toBe('rollPending');
    expect(targets.roll).toEqual({ type: 'rollDice', player });
    expect(targets.endTurn).toBeNull();
    expect(targets.vertices.size).toBe(0);
    expect(targets.edges.size).toBe(0);
    expect(targets.trades).toHaveLength(0);
  });

  it('bietet einem Spieler ohne Zugrecht nichts an', () => {
    const state = afterSetup();
    const other = state.players[1]!.id;
    const targets = actionTargets(state, other);

    expect(targets.roll).toBeNull();
    expect(targets.endTurn).toBeNull();
    expect(targets.vertices.size).toBe(0);
  });

  it('verteilt jede Aktion aus legalActions auf genau eine Stelle', () => {
    const state = afterSetup();
    const player = state.players[state.currentPlayerIndex]!.id;
    const rolled = reduce(state, { type: 'rollDice', player });
    if (!rolled.ok) throw new Error(rolled.error.message);

    const after = rolled.state;
    const actor = after.phase.kind === 'main' ? player : after.players[0]!.id;
    const expected = legalActions(after, actor);
    const targets = actionTargets(after, actor);

    const collected: GameAction[] = [
      ...targets.vertices.values(),
      ...targets.edges.values(),
      ...[...targets.hexes.values()].flat(),
      ...targets.trades,
      ...(targets.roll === null ? [] : [targets.roll]),
      ...(targets.endTurn === null ? [] : [targets.endTurn]),
    ];

    expect(collected).toHaveLength(expected.length);
    expect(new Set(collected.map((action) => JSON.stringify(action)))).toEqual(
      new Set(expected.map((action) => JSON.stringify(action))),
    );
  });

  it('nimmt eine fertige Aktionsliste - so kommt sie ab Etappe 4 vom Server', () => {
    const actions: GameAction[] = [
      { type: 'buildRoad', player: 'p1', edge: 'e:0,0|1,0' },
      { type: 'endTurn', player: 'p1' },
    ];

    const targets = targetsFrom(actions);

    expect(targets.edges.get('e:0,0|1,0')).toEqual(actions[0]);
    expect(targets.endTurn).toEqual(actions[1]);
    expect(targets.vertices.size).toBe(0);
  });
});

/**
 * Die Ritterzuege in der Klickkarte.
 *
 * Sie liegen in **eigenen** Karten und nicht in `vertices`: auf einer freien
 * Kreuzung sind Siedlung und Ritter zugleich moeglich, und die `claim`-Sperre
 * gegen doppelte Belegung ist richtig und soll bleiben.
 */
describe('targetsFrom mit Ritterzuegen', () => {
  const A = 'v:0,0|1,-1|1,0';
  const B = 'v:0,0|0,1|1,0';
  const C = 'v:0,1|1,0|1,1';

  it('legt Siedlung und Ritter auf demselben Knoten nebeneinander, ohne zu werfen', () => {
    const targets = targetsFrom([
      { type: 'buildSettlement', player: 'p1', vertex: A },
      { type: 'buildKnight', player: 'p1', vertex: A },
    ] as GameAction[]);

    expect(targets.vertices.get(A)?.type).toBe('buildSettlement');
    expect(targets.knightBuild.get(A)?.type).toBe('buildKnight');
  });

  it('zaehlt Ritter und Mauer als eigene Bauteile', () => {
    const targets = targetsFrom([
      { type: 'buildKnight', player: 'p1', vertex: A },
      { type: 'buildKnight', player: 'p1', vertex: B },
      { type: 'buildWall', player: 'p1', vertex: C },
    ] as GameAction[]);

    expect(targets.buildable.knight).toBe(2);
    expect(targets.buildable.wall).toBe(1);
  });

  it('sortiert Aktivieren, Aufwerten und Raeuberjagd an ihren Ort', () => {
    const targets = targetsFrom([
      { type: 'activateKnight', player: 'p1', vertex: A },
      { type: 'upgradeKnight', player: 'p1', vertex: A },
      { type: 'chaseRobber', player: 'p1', vertex: A },
    ] as GameAction[]);

    expect(targets.activate.get(A)?.type).toBe('activateKnight');
    expect(targets.upgrade.get(A)?.type).toBe('upgradeKnight');
    expect(targets.chase.get(A)?.type).toBe('chaseRobber');
  });

  it('gruppiert das Versetzen nach Ausgangskreuzung', () => {
    const targets = targetsFrom([
      { type: 'moveKnight', player: 'p1', from: A, to: B },
      { type: 'moveKnight', player: 'p1', from: A, to: C },
      { type: 'moveKnight', player: 'p1', from: B, to: C },
    ] as GameAction[]);

    expect([...targets.moves.keys()].sort()).toEqual([A, B].sort());
    expect([...targets.moves.get(A)!.keys()].sort()).toEqual([B, C].sort());
    expect(targets.moves.get(B)!.get(C)?.type).toBe('moveKnight');
  });

  it('sammelt das Ausweichen', () => {
    const targets = targetsFrom([
      { type: 'placeDisplacedKnight', player: 'p2', vertex: B },
    ] as GameAction[]);

    expect(targets.displace.get(B)?.type).toBe('placeDisplacedKnight');
  });

  it('laesst an einem Basistisch alle neuen Karten leer', () => {
    const targets = actionTargets(afterSetup(), 'p1');

    expect(targets.knightBuild.size).toBe(0);
    expect(targets.wallBuild.size).toBe(0);
    expect(targets.moves.size).toBe(0);
    expect(targets.displace.size).toBe(0);
    expect(targets.buildable.knight).toBe(0);
    expect(targets.buildable.wall).toBe(0);
  });
});

/*
 * Sieben Felder um die Wueste - dasselbe kleine Testbrett wie
 * `packages/shared/src/game/fixtures.ts#TEST_SCENARIO`, hier noch einmal
 * angelegt, weil jene Datei bewusst nicht im Barrel steht (Testmaterial ist
 * keine oeffentliche Oberflaeche des Pakets, siehe `game/index.ts`). Der
 * Mittelknoten `v:0,0|1,-1|1,0` grenzt an die Wueste (0,0), den Huegel
 * (1,-1) und den Wald (1,0) - genau der Fall, an dem sich pruefen laesst,
 * dass der Haendler die Wueste ausschliesst, obwohl sie angrenzt.
 */
const cityScenario: ScenarioDefinition = ScenarioDefinitionSchema.parse({
  id: 'targets-test7',
  name: 'Testbrett fuer Haendler und Bischof',
  minPlayers: 2,
  maxPlayers: 4,
  hexes: [
    { hex: '0,0', terrain: 'desert' },
    { hex: '1,0', terrain: 'forest', chip: 5 },
    { hex: '1,-1', terrain: 'hills', chip: 6 },
    { hex: '0,-1', terrain: 'pasture', chip: 8 },
    { hex: '-1,0', terrain: 'fields', chip: 9 },
    { hex: '-1,1', terrain: 'mountains', chip: 4 },
    { hex: '0,1', terrain: 'forest', chip: 10 },
  ],
  harbors: [],
  robberStart: '0,0',
});
const CENTER_VERTEX = 'v:0,0|1,-1|1,0';
const cityIds = ['p1', 'p2', 'p3'];

/** Gruendet auf dem kleinen Testbrett, die Mitte zuerst - dieselbe Idee wie `afterSetup`. */
function afterCitySetup(): GameState {
  let state = afterOpening(createGame(cityScenario, CITIES_RULES, cityIds, 'targets-cities'));

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const legal = legalActions(state, player);
    // Die erste Setzung faellt auf den Mittelknoten, sofern er noch frei
    // und erlaubt ist - so liegt hinterher sicher eine eigene Stadt an der
    // Wueste UND an zwei Landfeldern, ohne dass der Test raten muss, wohin
    // die Gruendung sonst gefallen waere.
    const onCenter = legal.find(
      (action) => action.type === 'placeSetupSettlement' && action.vertex === CENTER_VERTEX,
    );
    const action = onCenter ?? legal[0]!;
    const result = reduce(state, action);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

describe('merchantTargets', () => {
  it('bietet nur Landfelder neben einer eigenen Siedlung oder Stadt an, nie die Wueste', () => {
    const state = afterCitySetup();
    const owner = state.buildings[CENTER_VERTEX]?.owner;
    expect(owner).toBeDefined();

    const targets = merchantTargets(state, owner!);

    // Die Wueste liegt an, faellt aber heraus - Designentscheidung von
    // `canPlaceMerchant` in shared, hier nachgebaut ueber oeffentliche
    // Brettgeometrie, nicht ueber eine eigene Regel.
    expect(targets.has('0,0')).toBe(false);
    expect(targets.has('1,-1')).toBe(true);
    expect(targets.has('1,0')).toBe(true);

    for (const [hex, actions] of targets) {
      expect(terrainYield(boardOf(cityScenario).hexes.get(hex)!.terrain)).not.toBeNull();
      expect(actions).toEqual([
        { type: 'playProgress', player: owner, play: { card: 'merchant', hex } },
      ]);
    }
  });

  it('bietet nichts an, wo niemand eine eigene Siedlung oder Stadt hat', () => {
    const state = afterCitySetup();
    const targets = merchantTargets(state, 'niemand-hier');

    expect(targets.size).toBe(0);
  });
});

describe('bishopTargets', () => {
  it('bietet jedes Feld ausser dem, auf dem der Raeuber steht', () => {
    const state = afterCitySetup();
    const board = boardOf(cityScenario);
    const targets = bishopTargets(state, 'p1');

    expect(targets.size).toBe(board.hexes.size - 1);
    expect(targets.has(state.robber)).toBe(false);

    for (const [hex, actions] of targets) {
      expect(actions).toEqual([
        { type: 'playProgress', player: 'p1', play: { card: 'bishop', hex } },
      ]);
    }
  });
});
