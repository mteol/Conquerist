import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../rules/cities.js';
import { RuleViolationCode } from '../errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  gameWithCities,
  giving,
  hand,
  testGame,
} from '../fixtures.js';
import type { GameState, Knight, KnightLevel } from '../state.js';
import {
  applyActivateKnight,
  applyBuildKnight,
  applyUpgradeKnight,
  canActivateKnight,
  canBuildKnight,
  canUpgradeKnight,
  catanStrength,
  hasFortress,
  knightMayAct,
  knightPiece,
  knightStrengthOf,
} from './knights.js';

const KNIGHT_COST = CITIES_RULES.buildCosts.knight!;
const ACTIVATION_COST = CITIES_RULES.buildCosts.knightActivation!;

function knightOf(owner: string, level: KnightLevel = 1, extra: Partial<Knight> = {}): Knight {
  return {
    owner,
    level,
    active: false,
    activatedOnTurn: null,
    upgradedThisTurn: false,
    ...extra,
  };
}

function playerOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!;
}

/**
 * p1 hat eine Stadt auf `CENTER_VERTEX` und eine Strasse auf `CENTER_EDGE`.
 * Damit ist `ADJACENT_VERTEX` frei, an eigener Strasse - und direkt neben der
 * eigenen Stadt, was fuer Ritter ausdruecklich erlaubt ist.
 */
function withRoad(resources = hand()): GameState {
  return giving(gameWithCities({ roads: { [CENTER_EDGE]: 'p1' } }), 'p1', resources);
}

/** Setzt einem Spieler einzelne Bauteilvorraete. */
function stocked(state: GameState, id: string, pieces: Partial<Record<string, number>>): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, piecesLeft: { ...player.piecesLeft, ...pieces } } : player,
    ),
  };
}

describe('knightPiece', () => {
  it('nennt zu jeder Stufe ihr Bauteil', () => {
    expect(knightPiece(1)).toBe('knight1');
    expect(knightPiece(2)).toBe('knight2');
    expect(knightPiece(3)).toBe('knight3');
  });
});

describe('canBuildKnight', () => {
  it('erlaubt eine freie Kreuzung an eigener Strasse', () => {
    expect(canBuildKnight(withRoad(KNIGHT_COST), 'p1', ADJACENT_VERTEX)).toBeNull();
  });

  it('kennt keine Abstandsregel - direkt neben der eigenen Stadt geht es', () => {
    const state = withRoad(KNIGHT_COST);
    expect(state.buildings[CENTER_VERTEX]?.owner).toBe('p1');
    expect(canBuildKnight(state, 'p1', ADJACENT_VERTEX)).toBeNull();
  });

  it('weist eine Kreuzung ohne eigene Strasse ab', () => {
    expect(canBuildKnight(withRoad(KNIGHT_COST), 'p1', FAR_VERTEX)?.code).toBe(
      RuleViolationCode.NOT_CONNECTED,
    );
  });

  it('weist einen Knoten neben dem Brett ab', () => {
    expect(canBuildKnight(withRoad(KNIGHT_COST), 'p1', 'v:9,9|10,8|10,9')?.code).toBe(
      RuleViolationCode.NOT_ON_BOARD,
    );
  });

  it('weist eine bebaute Kreuzung ab', () => {
    expect(canBuildKnight(withRoad(KNIGHT_COST), 'p1', CENTER_VERTEX)?.code).toBe(
      RuleViolationCode.VERTEX_OCCUPIED,
    );
  });

  it('weist eine Kreuzung mit eigenem Ritter ab', () => {
    const state = { ...withRoad(KNIGHT_COST), knights: { [ADJACENT_VERTEX]: knightOf('p1') } };
    expect(canBuildKnight(state, 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.VERTEX_OCCUPIED,
    );
  });

  it('weist ab, wenn die Karten fehlen', () => {
    expect(canBuildKnight(withRoad(), 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('weist den dritten Einfachen Ritter ab, obwohl Karten da waeren', () => {
    const state = stocked(withRoad(KNIGHT_COST), 'p1', { knight1: 0 });
    expect(canBuildKnight(state, 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.NO_PIECES_LEFT,
    );
  });

  it('weist an einem Basistisch ab, weil das Regelwerk keinen Preis nennt', () => {
    const basis = giving(testGame({ roads: { [CENTER_EDGE]: 'p1' } }), 'p1', KNIGHT_COST);
    expect(canBuildKnight(basis, 'p1', ADJACENT_VERTEX)?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });
});

describe('applyBuildKnight', () => {
  it('stellt einen passiven Ritter hin und zieht Wolle und Erz ab', () => {
    const result = applyBuildKnight(withRoad(KNIGHT_COST), 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[ADJACENT_VERTEX]).toEqual({
      owner: 'p1',
      level: 1,
      active: false,
      activatedOnTurn: null,
      upgradedThisTurn: false,
    });
    expect(playerOf(result.state, 'p1').resources).toEqual(hand());
    expect(playerOf(result.state, 'p1').piecesLeft.knight1).toBe(
      CITIES_RULES.pieceStock.knight1 - 1,
    );
  });

  it('gibt die bezahlten Karten an die Bank zurueck', () => {
    const before = withRoad(KNIGHT_COST);
    const result = applyBuildKnight(before, 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.bank.wool).toBe(before.bank.wool + 1);
    expect(result.state.bank.ore).toBe(before.bank.ore + 1);
  });

  it('lehnt ab, statt zu bauen, wenn die Regel nein sagt', () => {
    const result = applyBuildKnight(withRoad(), 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(false);
  });
});

describe('canActivateKnight / applyActivateKnight', () => {
  function withKnight(resources = hand(), knight: Knight = knightOf('p1')): GameState {
    return giving(gameWithCities({ knights: { [ADJACENT_VERTEX]: knight } }), 'p1', resources);
  }

  it('setzt den Helm auf und zieht ein Getreide ab', () => {
    const result = applyActivateKnight(withKnight(ACTIVATION_COST), 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[ADJACENT_VERTEX]?.active).toBe(true);
    expect(playerOf(result.state, 'p1').resources.grain).toBe(0);
  });

  it('merkt sich die Runde der Aktivierung', () => {
    const state = { ...withKnight(ACTIVATION_COST), turn: 5 };
    const result = applyActivateKnight(state, 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[ADJACENT_VERTEX]?.activatedOnTurn).toBe(5);
  });

  it('geht im selben Zug, in dem der Ritter gebaut wurde', () => {
    const built = applyBuildKnight(withRoad({ ...KNIGHT_COST, grain: 1 }), 'p1', ADJACENT_VERTEX);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(canActivateKnight(built.state, 'p1', ADJACENT_VERTEX)).toBeNull();
  });

  it('weist einen schon aktiven Ritter ab', () => {
    const active = knightOf('p1', 1, { active: true, activatedOnTurn: 1 });
    expect(
      canActivateKnight(withKnight(ACTIVATION_COST, active), 'p1', ADJACENT_VERTEX)?.code,
    ).toBe(RuleViolationCode.KNIGHT_ALREADY_ACTIVE);
  });

  it('weist einen fremden Ritter ab', () => {
    const foreign = knightOf('p2');
    expect(
      canActivateKnight(withKnight(ACTIVATION_COST, foreign), 'p1', ADJACENT_VERTEX)?.code,
    ).toBe(RuleViolationCode.NO_KNIGHT_HERE);
  });

  it('weist eine leere Kreuzung ab', () => {
    expect(canActivateKnight(withKnight(ACTIVATION_COST), 'p1', FAR_VERTEX)?.code).toBe(
      RuleViolationCode.NO_KNIGHT_HERE,
    );
  });

  it('weist ab, wenn das Getreide fehlt', () => {
    expect(canActivateKnight(withKnight(), 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });
});

describe('canUpgradeKnight / applyUpgradeKnight', () => {
  function withKnight(knight: Knight, resources = KNIGHT_COST): GameState {
    return giving(gameWithCities({ knights: { [ADJACENT_VERTEX]: knight } }), 'p1', resources);
  }

  /** Gibt p1 die Festung - Politik auf Stufe 3. */
  function withFortress(state: GameState): GameState {
    return {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p1' ? { ...player, improvements: { politics: 3 } } : player,
      ),
    };
  }

  it('macht aus Einfach Stark und verschiebt den Vorrat', () => {
    const before = withKnight(knightOf('p1'));
    const result = applyUpgradeKnight(before, 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[ADJACENT_VERTEX]?.level).toBe(2);
    expect(playerOf(result.state, 'p1').piecesLeft.knight1).toBe(
      playerOf(before, 'p1').piecesLeft.knight1 + 1,
    );
    expect(playerOf(result.state, 'p1').piecesLeft.knight2).toBe(
      playerOf(before, 'p1').piecesLeft.knight2 - 1,
    );
    expect(playerOf(result.state, 'p1').resources).toEqual(hand());
  });

  it('laesst nicht aufwerten, wenn kein Starker Ritter mehr im Vorrat liegt', () => {
    const state = stocked(withKnight(knightOf('p1')), 'p1', { knight2: 0 });
    expect(canUpgradeKnight(state, 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.NO_PIECES_LEFT,
    );
  });

  it('laesst Stark zu Maechtig nicht ohne Festung zu', () => {
    expect(canUpgradeKnight(withKnight(knightOf('p1', 2)), 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.KNIGHT_NEEDS_FORTRESS,
    );
  });

  it('laesst Stark zu Maechtig mit Festung zu', () => {
    const state = withFortress(withKnight(knightOf('p1', 2)));
    expect(canUpgradeKnight(state, 'p1', ADJACENT_VERTEX)).toBeNull();
  });

  it('weist einen Maechtigen Ritter ab', () => {
    const state = withFortress(withKnight(knightOf('p1', 3)));
    expect(canUpgradeKnight(state, 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.KNIGHT_MAX_LEVEL,
    );
  });

  it('laesst denselben Ritter im selben Zug kein zweites Mal steigen', () => {
    const result = applyUpgradeKnight(withKnight(knightOf('p1')), 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const again = withFortress(giving(result.state, 'p1', KNIGHT_COST));
    expect(canUpgradeKnight(again, 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.KNIGHT_ALREADY_UPGRADED,
    );
  });

  it('laesst einen aktiven Ritter aktiv und seine Runde stehen', () => {
    const active = knightOf('p1', 1, { active: true, activatedOnTurn: 2 });
    const result = applyUpgradeKnight(withKnight(active), 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[ADJACENT_VERTEX]?.active).toBe(true);
    expect(result.state.knights[ADJACENT_VERTEX]?.activatedOnTurn).toBe(2);
  });

  it('laesst einen passiven Ritter passiv', () => {
    const result = applyUpgradeKnight(withKnight(knightOf('p1')), 'p1', ADJACENT_VERTEX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[ADJACENT_VERTEX]?.active).toBe(false);
    expect(result.state.knights[ADJACENT_VERTEX]?.activatedOnTurn).toBeNull();
  });

  it('weist einen fremden Ritter ab', () => {
    expect(canUpgradeKnight(withKnight(knightOf('p2')), 'p1', ADJACENT_VERTEX)?.code).toBe(
      RuleViolationCode.NO_KNIGHT_HERE,
    );
  });
});

describe('hasFortress', () => {
  it('verneint ohne Politik', () => {
    expect(hasFortress(playerOf(gameWithCities(), 'p1'))).toBe(false);
  });

  it('bejaht ab Politik 3', () => {
    const player = { ...playerOf(gameWithCities(), 'p1'), improvements: { politics: 3 } };
    expect(hasFortress(player)).toBe(true);
  });

  it('verneint bei Politik 2', () => {
    const player = { ...playerOf(gameWithCities(), 'p1'), improvements: { politics: 2 } };
    expect(hasFortress(player)).toBe(false);
  });
});

describe('knightMayAct', () => {
  function withKnight(knight: Knight, turn: number): GameState {
    return gameWithCities({ knights: { [ADJACENT_VERTEX]: knight }, turn });
  }

  it('verneint fuer einen passiven Ritter', () => {
    expect(knightMayAct(withKnight(knightOf('p1'), 3), ADJACENT_VERTEX, 'p1')).toBe(false);
  });

  it('verneint fuer einen frisch aktivierten Ritter', () => {
    const fresh = knightOf('p1', 1, { active: true, activatedOnTurn: 3 });
    expect(knightMayAct(withKnight(fresh, 3), ADJACENT_VERTEX, 'p1')).toBe(false);
  });

  it('bejaht ab dem naechsten Zug', () => {
    const ready = knightOf('p1', 1, { active: true, activatedOnTurn: 3 });
    expect(knightMayAct(withKnight(ready, 4), ADJACENT_VERTEX, 'p1')).toBe(true);
  });

  it('verneint fuer einen fremden Ritter', () => {
    const foreign = knightOf('p2', 1, { active: true, activatedOnTurn: 1 });
    expect(knightMayAct(withKnight(foreign, 4), ADJACENT_VERTEX, 'p1')).toBe(false);
  });

  it('verneint auf einer leeren Kreuzung', () => {
    expect(knightMayAct(gameWithCities(), ADJACENT_VERTEX, 'p1')).toBe(false);
  });
});

describe('Ritterstaerke', () => {
  const board = {
    knights: {
      [CENTER_VERTEX]: knightOf('p1', 3, { active: true, activatedOnTurn: 1 }),
      [ADJACENT_VERTEX]: knightOf('p1', 2),
      [FAR_VERTEX]: knightOf('p2', 1, { active: true, activatedOnTurn: 1 }),
    },
  };

  it('zaehlt nur aktivierte Ritter und summiert ihre Stufen', () => {
    expect(knightStrengthOf(board, 'p1')).toBe(3);
    expect(knightStrengthOf(board, 'p2')).toBe(1);
  });

  it('summiert die Ritter Catans ueber alle Spieler', () => {
    expect(catanStrength(board)).toBe(4);
  });

  it('zaehlt an einem leeren Brett null', () => {
    expect(catanStrength({ knights: {} })).toBe(0);
  });
});
