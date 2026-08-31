import { describe, expect, it } from 'vitest';

import { edgeFromHexes, hexFromId } from '../../../geometry/index.js';
import { CITIES_RULES } from '../../../rules/index.js';
import { ScenarioDefinitionSchema, type ScenarioDefinition } from '../../../scenario/index.js';
import { boardOf, chipAt } from '../../board.js';
import { yieldTotal } from '../../dice.js';
import { RuleViolationCode } from '../../errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  NEXT_EDGE,
  gameWithCities,
  giving,
  hand,
  testGame,
} from '../../fixtures.js';
import type { PlayerId, PlayerState } from '../../player.js';
import type { Building, GameState, Knight } from '../../state.js';
import { reduce } from '../../reducer.js';
import { distributeYield } from '../../yield.js';
import { applyImproveCity } from '../improvements.js';
import { knightAt } from '../knights.js';
import type { ProgressCardId } from './cards.js';
import { applyPlayProgress } from './progressRules.js';

/*
 * Lokale Aufbauten - `citiesTable`, `withHand`, `playerNamed` sind hier noch
 * einmal lokal wie in `progressRules.test.ts`. Testdateien teilen sich keine
 * Helfer.
 */
function citiesTable(overrides: Partial<GameState> = {}): GameState {
  return testGame({ rules: CITIES_RULES, ...overrides });
}

function withHand(state: GameState, id: PlayerId, cards: ProgressCardId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, progressCards: cards } : player,
    ),
  };
}

function playerNamed(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`playerNamed: ${id} sitzt nicht am Tisch`);
  return player;
}

function settlementOf(owner: string): Building {
  return { owner, kind: 'settlement', wall: false, metropolis: null };
}

function cityOf(owner: string): Building {
  return { owner, kind: 'city', wall: false, metropolis: null };
}

function knightOf(owner: string, level: 1 | 2 | 3): Knight {
  return { owner, level, active: false, activatedOnTurn: null, upgradedThisTurn: false };
}

/**
 * Ein Fuenf-Felder-Streifen mit drei Feldern derselben Gelaendeart, getrennt
 * von je einer Wueste - drei Felder derselben Art gibt es auf `TEST_SCENARIO`
 * nicht, Bergbau und Bewaesserung brauchen aber genau das.
 */
function threeHexScenario(id: string, terrain: 'mountains' | 'fields'): ScenarioDefinition {
  return ScenarioDefinitionSchema.parse({
    id,
    name: id,
    minPlayers: 2,
    maxPlayers: 4,
    hexes: [
      { hex: '0,0', terrain, chip: 4 },
      { hex: '1,0', terrain: 'desert' },
      { hex: '2,0', terrain, chip: 5 },
      { hex: '3,0', terrain: 'desert' },
      { hex: '4,0', terrain, chip: 6 },
    ],
    harbors: [],
    robberStart: '1,0',
  });
}

const MOUNTAIN_SCENARIO = threeHexScenario('three-mountains', 'mountains');
const FIELD_SCENARIO = threeHexScenario('three-fields', 'fields');

/** Die `index`-te Kreuzung an diesem Feld - jedes Feld hat sechs. */
function vertexOf(scenario: ScenarioDefinition, hexId: string, index = 0): string {
  const vertices = boardOf(scenario).topology.hexVertices.get(hexId);
  const vertex = vertices?.[index];
  if (vertex === undefined) throw new Error(`vertexOf: keine Kreuzung ${index} an ${hexId}`);
  return vertex;
}

describe('Wissenschaft: Ertrag und Bau', () => {
  describe('Bergbau', () => {
    const threeMountains = withHand(
      citiesTable({
        scenario: MOUNTAIN_SCENARIO,
        robber: MOUNTAIN_SCENARIO.robberStart,
        buildings: {
          [vertexOf(MOUNTAIN_SCENARIO, '0,0')]: settlementOf('p1'),
          [vertexOf(MOUNTAIN_SCENARIO, '2,0')]: settlementOf('p1'),
          [vertexOf(MOUNTAIN_SCENARIO, '4,0')]: cityOf('p1'),
        },
      }),
      'p1',
      ['mining'],
    );

    const twoBuildingsOneMountain = withHand(
      citiesTable({
        scenario: MOUNTAIN_SCENARIO,
        robber: MOUNTAIN_SCENARIO.robberStart,
        buildings: {
          [vertexOf(MOUNTAIN_SCENARIO, '0,0', 0)]: settlementOf('p1'),
          [vertexOf(MOUNTAIN_SCENARIO, '0,0', 1)]: cityOf('p1'),
        },
      }),
      'p1',
      ['mining'],
    );

    function oreOf(state: GameState): number {
      return playerNamed(state, 'p1').resources.ore;
    }

    it('gibt zwei Erz je Gebirgsfeld mit eigenem Gebaeude', () => {
      const result = applyPlayProgress(threeMountains, 'p1', { card: 'mining' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(oreOf(result.state)).toBe(6);
    });

    it('zaehlt ein Feld nur einmal, auch bei zwei Gebaeuden daran', () => {
      const result = applyPlayProgress(twoBuildingsOneMountain, 'p1', { card: 'mining' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(oreOf(result.state)).toBe(2);
    });

    it('nimmt nur so viel, wie die Bank noch hat', () => {
      const poor: GameState = { ...threeMountains, bank: hand({ ore: 3 }) };
      const result = applyPlayProgress(poor, 'p1', { card: 'mining' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(oreOf(result.state)).toBe(3);
    });

    it('lehnt die Karte ab, wenn kein Gebirgsfeld eine eigene Siedlung oder Stadt traegt', () => {
      const empty = withHand(
        citiesTable({ scenario: MOUNTAIN_SCENARIO, robber: MOUNTAIN_SCENARIO.robberStart }),
        'p1',
        ['mining'],
      );
      const result = applyPlayProgress(empty, 'p1', { card: 'mining' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
    });
  });

  describe('Bewaesserung', () => {
    const threeFields = withHand(
      citiesTable({
        scenario: FIELD_SCENARIO,
        robber: FIELD_SCENARIO.robberStart,
        buildings: {
          [vertexOf(FIELD_SCENARIO, '0,0')]: settlementOf('p1'),
          [vertexOf(FIELD_SCENARIO, '2,0')]: settlementOf('p1'),
          [vertexOf(FIELD_SCENARIO, '4,0')]: cityOf('p1'),
        },
      }),
      'p1',
      ['irrigation'],
    );

    it('gibt zwei Getreide je Ackerland mit eigenem Gebaeude', () => {
      const result = applyPlayProgress(threeFields, 'p1', { card: 'irrigation' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(playerNamed(result.state, 'p1').resources.grain).toBe(6);
    });

    it('lehnt die Karte ab, wenn kein Ackerland eine eigene Siedlung oder Stadt traegt', () => {
      const empty = withHand(
        citiesTable({ scenario: FIELD_SCENARIO, robber: FIELD_SCENARIO.robberStart }),
        'p1',
        ['irrigation'],
      );
      const result = applyPlayProgress(empty, 'p1', { card: 'irrigation' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
    });
  });

  describe('Strassenbau', () => {
    const state = withHand(
      citiesTable({ buildings: { [CENTER_VERTEX]: settlementOf('p1') } }),
      'p1',
      ['roadBuilding'],
    );

    it('baut zwei Strassen ohne Kosten', () => {
      const before = playerNamed(state, 'p1').resources;
      const result = applyPlayProgress(state, 'p1', {
        card: 'roadBuilding',
        edges: [CENTER_EDGE, NEXT_EDGE],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.roads[CENTER_EDGE]).toBe('p1');
        expect(result.state.roads[NEXT_EDGE]).toBe('p1');
        expect(playerNamed(result.state, 'p1').resources).toEqual(before);
      }
    });

    it('lehnt eine Strasse ab, die ohne die Karte auch nicht ginge', () => {
      // Weder an p1s Siedlung noch an eine seiner Strassen angeschlossen.
      const unreachable = edgeFromHexes([hexFromId('0,-1'), hexFromId('1,-1')]);
      const result = applyPlayProgress(state, 'p1', {
        card: 'roadBuilding',
        edges: [unreachable],
      });

      expect(result.ok).toBe(false);
    });

    it('lehnt die Karte ab, wenn keine Strasse genannt wird', () => {
      const result = applyPlayProgress(state, 'p1', { card: 'roadBuilding', edges: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
    });
  });

  describe('Medizin', () => {
    const hasSettlement = withHand(
      giving(citiesTable({ buildings: { [CENTER_VERTEX]: settlementOf('p1') } }), 'p1', {
        ore: 2,
        grain: 1,
      }),
      'p1',
      ['medicine'],
    );

    it('baut die Stadt fuer zwei Erz und ein Getreide statt drei und zwei', () => {
      const result = applyPlayProgress(hasSettlement, 'p1', {
        card: 'medicine',
        vertex: CENTER_VERTEX,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.buildings[CENTER_VERTEX]?.kind).toBe('city');
        expect(playerNamed(result.state, 'p1').resources).toEqual(hand());
      }
    });

    it('lehnt einen fremden oder fehlenden Siedlungsplatz ab - dieselbe Regel wie beim Bauen', () => {
      const state = withHand(citiesTable(), 'p1', ['medicine']);
      const result = applyPlayProgress(state, 'p1', { card: 'medicine', vertex: CENTER_VERTEX });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.NOT_OWN_SETTLEMENT);
    });
  });

  describe('Ingenieur', () => {
    const state = withHand(citiesTable({ buildings: { [CENTER_VERTEX]: cityOf('p1') } }), 'p1', [
      'engineer',
    ]);

    it('baut eine Stadtmauer gratis', () => {
      const before = playerNamed(state, 'p1').resources;
      const result = applyPlayProgress(state, 'p1', { card: 'engineer', vertex: CENTER_VERTEX });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.buildings[CENTER_VERTEX]?.wall).toBe(true);
        expect(playerNamed(result.state, 'p1').resources).toEqual(before);
      }
    });
  });

  describe('Schmied', () => {
    const twoKnightsNoFortress = withHand(
      citiesTable({
        knights: { [ADJACENT_VERTEX]: knightOf('p1', 1), [FAR_VERTEX]: knightOf('p1', 1) },
      }),
      'p1',
      ['smith'],
    );

    it('wertet zwei Ritter gratis auf und achtet auf die Festung', () => {
      // Ohne Festung (Politik 3) bleibt Stufe 2 die Grenze.
      const result = applyPlayProgress(twoKnightsNoFortress, 'p1', {
        card: 'smith',
        vertices: [ADJACENT_VERTEX, FAR_VERTEX],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(knightAt(result.state, ADJACENT_VERTEX)?.level).toBe(2);
        expect(knightAt(result.state, FAR_VERTEX)?.level).toBe(2);
      }
    });

    it('lehnt das Aufwerten zum Maechtigen Ritter ohne Festung ab', () => {
      const state = withHand(
        citiesTable({ knights: { [ADJACENT_VERTEX]: knightOf('p1', 2) } }),
        'p1',
        ['smith'],
      );
      const result = applyPlayProgress(state, 'p1', { card: 'smith', vertices: [ADJACENT_VERTEX] });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.KNIGHT_NEEDS_FORTRESS);
    });

    it('lehnt die Karte ab, wenn kein Ritter genannt wird', () => {
      const result = applyPlayProgress(twoKnightsNoFortress, 'p1', { card: 'smith', vertices: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
    });
  });
});

/*
 * Buchdruck und Verfassung stehen hier nicht mehr: sie werden nie ausgespielt
 * (Fixrunde 1) - `draw.test.ts` und `rollFlow.test.ts` pruefen, dass beide
 * Ziehpfade sie sofort offen ablegen.
 */
describe('Kran', () => {
  const state = withHand(giving(gameWithCities(), 'p1', { paper: 1 }), 'p1', ['crane']);

  it('zieht dem naechsten Ausbau eine Handelsware ab', () => {
    const played = applyPlayProgress(state, 'p1', { card: 'crane', track: 'science' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const improved = applyImproveCity(played.state, 'p1', 'science', undefined);
    expect(improved.ok).toBe(true);
    if (!improved.ok) return;

    // Stufe 1 der Wissenschaft kostet normalerweise ein Papier - mit dem
    // Kran nichts, das Papier bleibt also stehen.
    expect(playerNamed(improved.state, 'p1').resources.paper).toBe(1);
  });

  it('gilt fuer genau ein Hochruecken', () => {
    const played = applyPlayProgress(state, 'p1', { card: 'crane', track: 'science' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const improved = applyImproveCity(played.state, 'p1', 'science', undefined);
    expect(improved.ok).toBe(true);
    if (!improved.ok) return;

    // Nach dem ersten Ausbau ist der Rabatt weg.
    expect(improved.state.craneDiscount).toEqual([]);
  });
});

/*
 * Die zwei Sonderfaelle des Stapels: Alchemie greift in den Wurf, der
 * Erfinder in die Brettdaten. Dass Alchemie **nur** vor dem Wurf und dort als
 * einzige Karte gespielt werden darf, prueft `progressRules.test.ts` - hier
 * steht die Wirkung.
 */
describe('Alchemie', () => {
  const beforeRoll = withHand(gameWithCities({ phase: { kind: 'rollPending' } }), 'p1', [
    'alchemist',
  ]);

  /** Der Ereigniswuerfel des Regelwerks - der einzige, der nicht mitzaehlt. */
  function eventFaceOf(roll: NonNullable<GameState['lastRoll']>): number | null {
    return roll.find((die) => die.die === 'event')?.value ?? null;
  }

  it('legt einen Vorsatz und wuerfelt nicht selbst', () => {
    const played = applyPlayProgress(beforeRoll, 'p1', {
      card: 'alchemist',
      first: 3,
      second: 4,
    });

    expect(played.ok).toBe(true);
    if (!played.ok) return;

    expect(played.state.alchemistRoll).toEqual({ first: 3, second: 4 });
    // Der Wurf bleibt eine Aktion des Spielers: die Phase steht noch.
    expect(played.state.phase.kind).toBe('rollPending');
    expect(played.state.lastRoll).toBeNull();
  });

  it('setzt die zwei Augen und wuerfelt das Ereignis trotzdem', () => {
    const played = applyPlayProgress(beforeRoll, 'p1', {
      card: 'alchemist',
      first: 3,
      second: 4,
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const rolled = reduce(played.state, { type: 'rollDice', player: 'p1' });
    expect(rolled.ok).toBe(true);
    if (rolled.ok) {
      expect(yieldTotal(rolled.state.rules.dice, rolled.state.lastRoll!)).toBe(7);
      expect(eventFaceOf(rolled.state.lastRoll!)).not.toBeNull();
      expect(rolled.state.alchemistRoll).toBeNull();
    }
  });
});

describe('Erfinder', () => {
  /*
   * Auf dem Testbrett: Wald 5 liegt am Stadtknoten von `gameWithCities`,
   * Ackerland 9 liegt weit davon weg. Nach dem Tausch muss also eine Neun
   * Holz bringen, wo vorher nichts kam. Huegel 6 ist eine der vier gesperrten
   * Zahlen.
   */
  const FOREST_FIVE = '1,0';
  const FIELDS_NINE = '-1,0';
  const HILLS_SIX = '1,-1';

  const state = withHand(gameWithCities(), 'p1', ['inventor']);

  it('vertauscht zwei Zahlenchips', () => {
    const result = applyPlayProgress(state, 'p1', {
      card: 'inventor',
      a: FOREST_FIVE,
      b: FIELDS_NINE,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(chipAt(result.state.scenario, FOREST_FIVE)).toBe(chipAt(state.scenario, FIELDS_NINE));
      expect(chipAt(result.state.scenario, FIELDS_NINE)).toBe(chipAt(state.scenario, FOREST_FIVE));
    }
  });

  it('laesst die Ertraege den neuen Zahlen folgen', () => {
    // Vorher bringt die Neun der Stadt am mittleren Knoten nichts.
    expect(playerNamed(distributeYield(state, 9), 'p1').resources.lumber).toBe(0);

    const result = applyPlayProgress(state, 'p1', {
      card: 'inventor',
      a: FOREST_FIVE,
      b: FIELDS_NINE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const paid = distributeYield(result.state, 9);
    expect(playerNamed(paid, 'p1').resources.lumber).toBeGreaterThan(0);
  });

  it('laesst 2, 12, 6 und 8 nicht vertauschen', () => {
    const result = applyPlayProgress(state, 'p1', {
      card: 'inventor',
      a: HILLS_SIX,
      b: FIELDS_NINE,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
  });

  it('lehnt die gesperrte Zahl auch als zweites Feld ab', () => {
    // Beide Seiten und nicht nur die erste - sonst haenge die Regel daran,
    // in welcher Reihenfolge die Felder genannt werden.
    const result = applyPlayProgress(state, 'p1', {
      card: 'inventor',
      a: FIELDS_NINE,
      b: HILLS_SIX,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
  });

  it('lehnt ein Feld ohne Zahlenchip ab', () => {
    const result = applyPlayProgress(state, 'p1', {
      card: 'inventor',
      a: '0,0',
      b: FIELDS_NINE,
    });

    expect(result.ok).toBe(false);
  });

  it('lehnt zweimal dasselbe Feld ab', () => {
    const result = applyPlayProgress(state, 'p1', {
      card: 'inventor',
      a: FIELDS_NINE,
      b: FIELDS_NINE,
    });

    expect(result.ok).toBe(false);
  });
});
