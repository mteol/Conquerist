import { describe, expect, it } from 'vitest';

import { RuleViolationCode } from '../errors.js';
import { gameWithCities } from '../fixtures.js';
import type { GameState, Knight, KnightLevel } from '../state.js';
import {
  applyChaseRobber,
  applyMoveKnight,
  applyPlaceDisplacedKnight,
  canChaseRobber,
  canMoveKnight,
  canPlaceDisplacedKnight,
  displacementTargets,
} from './knightActions.js';

/** Vier Strassen ueber fuenf Ecken des mittleren Felds. */
const CHAIN: readonly string[] = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0', 'e:-1,1|0,0'];

const CORNERS: readonly string[] = [
  'v:0,0|1,-1|1,0',
  'v:0,-1|0,0|1,-1',
  'v:-1,0|0,-1|0,0',
  'v:-1,0|-1,1|0,0',
  'v:-1,1|0,0|0,1',
];

const START = CORNERS[0]!;

/** Ein Ritter, der schon handeln darf: aktiviert in Runde 1, gespielt in 2. */
function ready(owner: string, level: KnightLevel = 1): Knight {
  return { owner, level, active: true, activatedOnTurn: 1, upgradedThisTurn: false };
}

function passive(owner: string, level: KnightLevel = 1): Knight {
  return { owner, level, active: false, activatedOnTurn: null, upgradedThisTurn: false };
}

/**
 * p1 haelt die ganze Kette und steht mit einem handlungsbereiten Ritter auf
 * `START`. Die Runde ist 2, seine Aktivierung liegt in Runde 1.
 */
function withChain(overrides: Partial<GameState> = {}, knight: Knight = ready('p1')): GameState {
  return gameWithCities({
    buildings: {},
    roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p1'])),
    knights: { [START]: knight },
    turn: 2,
    ...overrides,
  });
}

function playerOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!;
}

describe('canMoveKnight / applyMoveKnight - versetzen', () => {
  it('zieht auf eine freie erreichbare Kreuzung', () => {
    const result = applyMoveKnight(withChain(), 'p1', START, CORNERS[2]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[START]).toBeUndefined();
    expect(result.state.knights[CORNERS[2]!]?.owner).toBe('p1');
  });

  it('deaktiviert ihn dabei - je aktivem Ritter eine Aktion je Zug', () => {
    const result = applyMoveKnight(withChain(), 'p1', START, CORNERS[2]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[CORNERS[2]!]?.active).toBe(false);
    expect(result.state.knights[CORNERS[2]!]?.activatedOnTurn).toBeNull();
  });

  it('bleibt in der Hauptphase, wenn niemand vertrieben wurde', () => {
    const result = applyMoveKnight(withChain(), 'p1', START, CORNERS[2]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase.kind).toBe('main');
  });

  it('weist einen passiven Ritter ab', () => {
    expect(canMoveKnight(withChain({}, passive('p1')), 'p1', START, CORNERS[2]!)?.code).toBe(
      RuleViolationCode.KNIGHT_NOT_ACTIVE,
    );
  });

  it('weist einen frisch aktivierten Ritter ab', () => {
    const fresh: Knight = { ...ready('p1'), activatedOnTurn: 2 };
    expect(canMoveKnight(withChain({}, fresh), 'p1', START, CORNERS[2]!)?.code).toBe(
      RuleViolationCode.KNIGHT_JUST_ACTIVATED,
    );
  });

  it('weist einen fremden Ritter ab', () => {
    expect(canMoveKnight(withChain({}, ready('p2')), 'p1', START, CORNERS[2]!)?.code).toBe(
      RuleViolationCode.NO_KNIGHT_HERE,
    );
  });

  it('weist ein Ziel ohne eigenen Weg ab', () => {
    const state = withChain({ roads: { [CHAIN[0]!]: 'p1' } });
    expect(canMoveKnight(state, 'p1', START, CORNERS[3]!)?.code).toBe(
      RuleViolationCode.KNIGHT_UNREACHABLE,
    );
  });

  it('weist ein Ziel mit Bauwerk ab', () => {
    const state = withChain({
      buildings: { [CORNERS[2]!]: { owner: 'p1', kind: 'settlement', wall: false } },
    });
    expect(canMoveKnight(state, 'p1', START, CORNERS[2]!)?.code).toBe(
      RuleViolationCode.KNIGHT_TARGET_TAKEN,
    );
  });

  it('weist ein Ziel mit eigenem Ritter ab - eigene vertreibt man nicht', () => {
    const state = withChain({
      knights: { [START]: ready('p1'), [CORNERS[2]!]: passive('p1') },
    });
    expect(canMoveKnight(state, 'p1', START, CORNERS[2]!)?.code).toBe(
      RuleViolationCode.KNIGHT_TARGET_TAKEN,
    );
  });
});

describe('applyMoveKnight - vertreiben', () => {
  /** p2 steht mit einem Ritter der Stufe `level` auf Ecke 2. */
  function withRival(level: KnightLevel, own: KnightLevel = 2): GameState {
    return withChain(
      { knights: { [START]: ready('p1', own), [CORNERS[2]!]: passive('p2', level) } },
      ready('p1', own),
    );
  }

  it('uebernimmt die Kreuzung eines schwaecheren fremden Ritters', () => {
    const result = applyMoveKnight(withRival(1), 'p1', START, CORNERS[2]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[CORNERS[2]!]?.owner).toBe('p1');
    expect(result.state.knights[CORNERS[2]!]?.level).toBe(2);
  });

  it('oeffnet displacePending mit dem Zustand des Vertriebenen', () => {
    const displaced: Knight = { ...passive('p2', 1), active: true, activatedOnTurn: 1 };
    // p1 haelt den Weg bis Ecke 2, p2 die Strasse dahinter - dorthin weicht
    // der Vertriebene aus.
    const state = withChain({
      knights: { [START]: ready('p1', 2), [CORNERS[2]!]: displaced },
      roads: { [CHAIN[0]!]: 'p1', [CHAIN[1]!]: 'p1', [CHAIN[2]!]: 'p2' },
    });

    const result = applyMoveKnight(state, 'p1', START, CORNERS[2]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toEqual({
      kind: 'displacePending',
      owner: 'p2',
      level: 1,
      active: true,
      activatedOnTurn: 1,
      from: CORNERS[2]!,
    });
  });

  it('weist einen gleich starken fremden Ritter ab', () => {
    expect(canMoveKnight(withRival(2, 2), 'p1', START, CORNERS[2]!)?.code).toBe(
      RuleViolationCode.KNIGHT_TOO_WEAK,
    );
  });

  it('weist einen staerkeren fremden Ritter ab', () => {
    expect(canMoveKnight(withRival(3, 2), 'p1', START, CORNERS[2]!)?.code).toBe(
      RuleViolationCode.KNIGHT_TOO_WEAK,
    );
  });

  it('gibt den Vertriebenen vom Brett, wenn er nirgends ausweichen kann', () => {
    // p2 hat keine eigene Strasse - also keinen Weg, auf dem er ausweichen koennte.
    const before = withRival(1);
    const result = applyMoveKnight(before, 'p1', START, CORNERS[2]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase.kind).toBe('main');
    expect(playerOf(result.state, 'p2').piecesLeft.knight1).toBe(
      playerOf(before, 'p2').piecesLeft.knight1 + 1,
    );
  });
});

describe('displacementTargets', () => {
  it('nennt nur freie Kreuzungen im eigenen Netz', () => {
    const state = gameWithCities({
      buildings: { [CORNERS[2]!]: { owner: 'p1', kind: 'city', wall: false } },
      roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p2'])),
      knights: {},
    });

    expect(displacementTargets(state, 'p2', START).sort()).toEqual(
      [CORNERS[1]!, CORNERS[3]!, CORNERS[4]!].sort(),
    );
  });

  it('bleibt leer ohne eigene Strassen', () => {
    expect(displacementTargets(withChain(), 'p2', START)).toEqual([]);
  });
});

describe('canPlaceDisplacedKnight / applyPlaceDisplacedKnight', () => {
  /** p2 haelt die Kette und wurde von `START` vertrieben. */
  function displacing(overrides: Partial<GameState> = {}): GameState {
    return gameWithCities({
      buildings: {},
      roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p2'])),
      knights: {},
      phase: {
        kind: 'displacePending',
        owner: 'p2',
        level: 2,
        active: true,
        activatedOnTurn: 1,
        from: START,
      },
      turn: 2,
      ...overrides,
    });
  }

  it('setzt ihn unveraendert auf eine freie erreichbare Kreuzung', () => {
    const result = applyPlaceDisplacedKnight(displacing(), 'p2', CORNERS[2]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[CORNERS[2]!]).toEqual({
      owner: 'p2',
      level: 2,
      active: true,
      activatedOnTurn: 1,
      upgradedThisTurn: false,
    });
  });

  it('geht danach zurueck in die Hauptphase', () => {
    const result = applyPlaceDisplacedKnight(displacing(), 'p2', CORNERS[2]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase.kind).toBe('main');
  });

  it('weist eine Kreuzung ausserhalb seines Netzes ab', () => {
    const state = displacing({ roads: { [CHAIN[0]!]: 'p2' } });
    expect(canPlaceDisplacedKnight(state, 'p2', CORNERS[3]!)?.code).toBe(
      RuleViolationCode.KNIGHT_UNREACHABLE,
    );
  });

  it('weist eine belegte Kreuzung ab', () => {
    const state = displacing({
      buildings: { [CORNERS[2]!]: { owner: 'p1', kind: 'city', wall: false } },
    });
    expect(canPlaceDisplacedKnight(state, 'p2', CORNERS[2]!)?.code).toBe(
      RuleViolationCode.KNIGHT_TARGET_TAKEN,
    );
  });

  it('weist jemanden ab, der nicht der Besitzer ist', () => {
    expect(canPlaceDisplacedKnight(displacing(), 'p1', CORNERS[2]!)?.code).toBe(
      RuleViolationCode.NOT_DISPLACING,
    );
  });

  it('weist ab, wenn gerade niemand vertrieben wurde', () => {
    expect(canPlaceDisplacedKnight(withChain(), 'p2', CORNERS[2]!)?.code).toBe(
      RuleViolationCode.NOT_DISPLACING,
    );
  });
});

describe('canChaseRobber / applyChaseRobber', () => {
  /** Der Raeuber steht auf der Wueste, an der `START` liegt. */
  function chasing(overrides: Partial<GameState> = {}): GameState {
    return withChain({ robber: '0,0', barbarians: { position: 0, attacks: 1 }, ...overrides });
  }

  it('oeffnet robberPending mit Rueckweg in die Hauptphase', () => {
    const result = applyChaseRobber(chasing(), 'p1', START);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toEqual({ kind: 'robberPending', resume: 'main' });
  });

  it('deaktiviert den Ritter', () => {
    const result = applyChaseRobber(chasing(), 'p1', START);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.knights[START]?.active).toBe(false);
    expect(result.state.knights[START]?.activatedOnTurn).toBeNull();
  });

  it('weist ab, wenn der Raeuber woanders steht', () => {
    expect(canChaseRobber(chasing({ robber: '-1,1' }), 'p1', START)?.code).toBe(
      RuleViolationCode.ROBBER_NOT_ADJACENT,
    );
  });

  it('weist ab, solange der Raeuber gesperrt ist', () => {
    const locked = chasing({ barbarians: { position: 0, attacks: 0 } });
    expect(canChaseRobber(locked, 'p1', START)?.code).toBe(RuleViolationCode.ROBBER_LOCKED);
  });

  it('weist einen passiven Ritter ab', () => {
    const state = chasing({ knights: { [START]: passive('p1') } });
    expect(canChaseRobber(state, 'p1', START)?.code).toBe(RuleViolationCode.KNIGHT_NOT_ACTIVE);
  });
});
