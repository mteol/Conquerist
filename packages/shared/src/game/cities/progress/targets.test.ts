import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  NEXT_EDGE,
  gameWithCities,
  giving,
  testGame,
} from '../../fixtures.js';
import type { PlayerId } from '../../player.js';
import type { Building, GameState, Knight } from '../../state.js';
import type { ProgressCardId } from './cards.js';
import {
  diplomatTargets,
  engineerTargets,
  intrigueTargets,
  inventorTargets,
  medicineTargets,
  progressRoadBuildingTargets,
  smithTargets,
} from './targets.js';

/*
 * Lokale Aufbauten - dieselbe Regel wie in `science.test.ts` und
 * `politics.test.ts`: Testdateien teilen sich keine Helfer.
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

function settlementOf(owner: string): Building {
  return { owner, kind: 'settlement', wall: false, metropolis: null };
}

function cityOf(owner: string): Building {
  return { owner, kind: 'city', wall: false, metropolis: null };
}

function knightOf(owner: string, level: 1 | 2 | 3): Knight {
  return { owner, level, active: false, activatedOnTurn: null, upgradedThisTurn: false };
}

describe('Erfinder: Ziele', () => {
  // Dieselben Felder wie in science.test.ts: Wald 5 und Ackerland 9 gehen,
  // Huegel 6 ist eine der vier gesperrten Zahlen.
  const FOREST_FIVE = '1,0';
  const FIELDS_NINE = '-1,0';
  const HILLS_SIX = '1,-1';

  it('nennt beide Seiten eines tauschbaren Zahlenchip-Paars', () => {
    const state = withHand(gameWithCities(), 'p1', ['inventor']);
    const targets = inventorTargets(state, 'p1');

    expect(targets[FOREST_FIVE]).toContain(FIELDS_NINE);
    expect(targets[FIELDS_NINE]).toContain(FOREST_FIVE);
  });

  it('nennt eine gesperrte Zahl nicht als Ziel', () => {
    const state = withHand(gameWithCities(), 'p1', ['inventor']);
    const targets = inventorTargets(state, 'p1');

    expect(targets[HILLS_SIX]).toBeUndefined();
    for (const seconds of Object.values(targets)) {
      expect(seconds).not.toContain(HILLS_SIX);
    }
  });

  it('ist leer ohne die Karte auf der Hand', () => {
    const state = gameWithCities();
    expect(inventorTargets(state, 'p1')).toEqual({});
  });
});

describe('Ingenieur: Ziele', () => {
  it('nennt die eigene Stadt als Ziel fuer die gratis Stadtmauer', () => {
    const state = withHand(citiesTable({ buildings: { [CENTER_VERTEX]: cityOf('p1') } }), 'p1', [
      'engineer',
    ]);

    expect(engineerTargets(state, 'p1')).toContain(CENTER_VERTEX);
  });

  it('ist leer ohne die Karte auf der Hand', () => {
    const state = citiesTable({ buildings: { [CENTER_VERTEX]: cityOf('p1') } });
    expect(engineerTargets(state, 'p1')).toEqual([]);
  });
});

describe('Medizin: Ziele', () => {
  it('nennt die eigene Siedlung als Ziel, wenn die Karten fuer den Preis reichen', () => {
    const state = withHand(
      giving(citiesTable({ buildings: { [CENTER_VERTEX]: settlementOf('p1') } }), 'p1', {
        ore: 2,
        grain: 1,
      }),
      'p1',
      ['medicine'],
    );

    expect(medicineTargets(state, 'p1')).toContain(CENTER_VERTEX);
  });

  it('ist leer ohne eigene Siedlung', () => {
    const state = withHand(giving(citiesTable(), 'p1', { ore: 2, grain: 1 }), 'p1', ['medicine']);
    expect(medicineTargets(state, 'p1')).toEqual([]);
  });
});

describe('Schmied: Ziele', () => {
  it('nennt den zweiten Ritter gegen den Zustand nach dem ersten', () => {
    const state = withHand(
      citiesTable({
        knights: { [ADJACENT_VERTEX]: knightOf('p1', 1), [FAR_VERTEX]: knightOf('p1', 1) },
      }),
      'p1',
      ['smith'],
    );

    const targets = smithTargets(state, 'p1');
    expect(targets[ADJACENT_VERTEX]).toContain(FAR_VERTEX);
  });

  it('nennt den einzigen Ritter mit leerer zweiter Wahl, wenn es keinen zweiten gibt', () => {
    const state = withHand(
      citiesTable({ knights: { [ADJACENT_VERTEX]: knightOf('p1', 1) } }),
      'p1',
      ['smith'],
    );

    expect(smithTargets(state, 'p1')).toEqual({ [ADJACENT_VERTEX]: [] });
  });

  it('ist leer ohne eigenen Ritter', () => {
    const state = withHand(citiesTable(), 'p1', ['smith']);
    expect(smithTargets(state, 'p1')).toEqual({});
  });
});

describe('Strassenbau (Fortschritt): Ziele', () => {
  it('nennt die anschliessende Kante gegen den Zustand nach der ersten', () => {
    const state = withHand(
      citiesTable({ buildings: { [CENTER_VERTEX]: settlementOf('p1') } }),
      'p1',
      ['roadBuilding'],
    );

    const targets = progressRoadBuildingTargets(state, 'p1');
    expect(targets[CENTER_EDGE]).toContain(NEXT_EDGE);
  });

  it('ist leer ohne die Karte auf der Hand', () => {
    const state = citiesTable({ buildings: { [CENTER_VERTEX]: settlementOf('p1') } });
    expect(progressRoadBuildingTargets(state, 'p1')).toEqual({});
  });
});

describe('Diplomat: Ziele', () => {
  const RIVAL_CHAIN: readonly string[] = [
    'e:0,-1|1,-2',
    'e:1,-2|1,-1',
    'e:1,-1|2,-2',
    'e:1,-1|2,-1',
    'e:1,0|2,-1',
  ];
  const foreignOpen = RIVAL_CHAIN[0]!;
  const foreignClosed = RIVAL_CHAIN[2]!;
  const ownOpen = 'e:0,-1|0,0';
  const elsewhere = 'e:0,0|1,0';
  const CORNER0 = 'v:0,0|1,-1|1,0';

  function diplomatTable(overrides: Partial<GameState> = {}): GameState {
    return withHand(
      citiesTable({
        roads: {
          'e:0,0|1,-1': 'p1',
          [ownOpen]: 'p1',
          ...Object.fromEntries(RIVAL_CHAIN.map((edge) => [edge, 'p2'])),
        },
        buildings: { [CORNER0]: settlementOf('p1') },
        longestRoad: { holder: 'p2', length: 5 },
        ...overrides,
      }),
      'p1',
      ['diplomat'],
    );
  }

  it('nennt eine fremde offene Strasse als entfernbar, ohne Neubau-Ziel', () => {
    const targets = diplomatTargets(diplomatTable(), 'p1');
    expect(targets[foreignOpen]).toEqual([]);
  });

  it('nennt bei der eigenen Strasse ein Neubau-Ziel', () => {
    const targets = diplomatTargets(diplomatTable(), 'p1');
    expect(targets[ownOpen]).toContain(elsewhere);
  });

  it('nennt eine geschlossene Strasse mitten in der Kette nicht als entfernbar', () => {
    const targets = diplomatTargets(diplomatTable(), 'p1');
    expect(targets[foreignClosed]).toBeUndefined();
  });

  it('ist leer ohne die Karte auf der Hand', () => {
    const state = diplomatTable();
    const withoutCard = withHand(state, 'p1', []);
    expect(diplomatTargets(withoutCard, 'p1')).toEqual({});
  });
});

describe('Intrige: Ziele', () => {
  const CORNER0 = 'v:0,0|1,-1|1,0';
  const CORNER3 = 'v:-1,0|-1,1|0,0';

  function passive(owner: PlayerId): Knight {
    return { owner, level: 1, active: false, activatedOnTurn: null, upgradedThisTurn: false };
  }

  function reachableFoe(overrides: Partial<GameState> = {}): GameState {
    return withHand(
      citiesTable({
        roads: { 'e:0,0|1,-1': 'p1' },
        knights: { [CORNER0]: passive('p2'), [CORNER3]: passive('p2') },
        ...overrides,
      }),
      'p1',
      ['intrigue'],
    );
  }

  it('nennt einen erreichbaren fremden Ritter als Ziel', () => {
    expect(intrigueTargets(reachableFoe(), 'p1')).toContain(CORNER0);
  });

  it('nennt einen fremden Ritter ohne eigene Strasse dorthin nicht als Ziel', () => {
    expect(intrigueTargets(reachableFoe(), 'p1')).not.toContain(CORNER3);
  });

  it('ist leer ohne die Karte auf der Hand', () => {
    const state = withHand(reachableFoe(), 'p1', []);
    expect(intrigueTargets(state, 'p1')).toEqual([]);
  });
});
