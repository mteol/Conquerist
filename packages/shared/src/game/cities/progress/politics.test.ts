import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import { countCards } from '../../cards.js';
import { RuleViolationCode } from '../../errors.js';
import { giving, hand, testGame } from '../../fixtures.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { applyDiscard, discardCountFor } from '../../robber.js';
import type { Building, GameState, Knight } from '../../state.js';
import { knightAt } from '../knights.js';
import type { ProgressCardId } from './cards.js';
import { applyPlayProgress, canPlayProgress } from './progressRules.js';

/*
 * Die fuenf Politikkarten an diesem Tisch. Die Helfer hier sind lokale
 * Aufbauten aus `testGame`: der Tisch hat drei Spieler in der Reihenfolge p1,
 * p2, p3, p1 ist am Zug und steht in der Hauptphase.
 */

/** Die sechs Ecken des mittleren Felds, im Ring. */
const CORNERS: readonly string[] = [
  'v:0,0|1,-1|1,0',
  'v:0,-1|0,0|1,-1',
  'v:-1,0|0,-1|0,0',
  'v:-1,0|-1,1|0,0',
  'v:-1,1|0,0|0,1',
  'v:0,0|0,1|1,0',
];

/** Eine Ecke ausserhalb des Rings, ueber `e:1,-1|1,0` an `CORNERS[0]` gehaengt. */
const OUTER = 'v:1,-1|1,0|2,-1';

/** Ein Staedte-&-Ritter-Tisch in der Hauptphase - p1 ist am Zug. */
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

function handSize(state: GameState, id: PlayerId): number {
  return countCards(playerNamed(state, id).resources);
}

/** Wie viele Ritter dieses Spielers einen Helm tragen. */
function activeKnightsOf(state: GameState, player: PlayerId): number {
  return Object.values(state.knights).filter((knight) => knight.owner === player && knight.active)
    .length;
}

function passive(owner: PlayerId): Knight {
  return { owner, level: 1, active: false, activatedOnTurn: null, upgradedThisTurn: false };
}

function ready(owner: PlayerId, activatedOnTurn: number): Knight {
  return { owner, level: 1, active: true, activatedOnTurn, upgradedThisTurn: false };
}

function settlement(owner: PlayerId): Building {
  return { owner, kind: 'settlement', wall: false, metropolis: null };
}

function city(owner: PlayerId): Building {
  return { owner, kind: 'city', wall: false, metropolis: null };
}

describe('Heerfuehrer', () => {
  /*
   * Drei passive Ritter von p1 und einer von p2. Die laufende Runde ist 2, und
   * p1 haelt Getreide - die Aktivierung kostet sonst eines je Ritter.
   */
  const threePassiveKnights = giving(
    withHand(
      citiesTable({
        knights: {
          [CORNERS[0]!]: passive('p1'),
          [CORNERS[1]!]: passive('p1'),
          [CORNERS[2]!]: passive('p1'),
          [CORNERS[3]!]: passive('p2'),
        },
        turn: 2,
      }),
      'p1',
      ['warlord'],
    ),
    'p1',
    { grain: 3 },
  );

  it('aktiviert alle eigenen Ritter ohne Kosten', () => {
    const before = playerNamed(threePassiveKnights, 'p1');
    const result = applyPlayProgress(threePassiveKnights, 'p1', { card: 'warlord' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(activeKnightsOf(result.state, 'p1')).toBe(3);
      expect(playerNamed(result.state, 'p1').resources).toEqual(before.resources);
    }
  });

  it('laesst die fremden Ritter passiv', () => {
    const result = applyPlayProgress(threePassiveKnights, 'p1', { card: 'warlord' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(activeKnightsOf(result.state, 'p2')).toBe(0);
  });

  /*
   * Ein frisch aktivierter Ritter darf in derselben Runde nicht handeln - die
   * Regel aus 10b gilt auch hier, und `activatedOnTurn` traegt sie.
   */
  it('setzt bei den aktivierten Rittern die laufende Runde', () => {
    const result = applyPlayProgress(threePassiveKnights, 'p1', { card: 'warlord' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(knightAt(result.state, CORNERS[0]!)?.activatedOnTurn).toBe(result.state.turn);
    }
  });

  /*
   * Wer den Helm schon traegt, behaelt seine Aktivierungsrunde - sonst naehme
   * die eigene Karte ihm die Handlungsfaehigkeit fuer diesen Zug.
   */
  it('laesst einen laengst aktivierten Ritter unberuehrt', () => {
    const veteran: GameState = {
      ...threePassiveKnights,
      knights: { ...threePassiveKnights.knights, [CORNERS[4]!]: ready('p1', 1) },
    };

    const result = applyPlayProgress(veteran, 'p1', { card: 'warlord' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(knightAt(result.state, CORNERS[4]!)?.activatedOnTurn).toBe(1);
  });
});

describe('Sabotage', () => {
  /*
   * p1 spielt und hat 4 Punkte (zwei Staedte), p2 hat 5 (zwei Staedte und eine
   * Siedlung), p3 hat 3 (eine Stadt und eine Siedlung). p2 haelt sieben
   * Karten, p3 vier.
   */
  function sabotageTable(overrides: Partial<GameState> = {}): GameState {
    const base = citiesTable({
      buildings: {
        [CORNERS[0]!]: city('p1'),
        [CORNERS[1]!]: city('p1'),
        [CORNERS[2]!]: city('p2'),
        [CORNERS[3]!]: city('p2'),
        [CORNERS[4]!]: settlement('p2'),
        [CORNERS[5]!]: city('p3'),
        [OUTER]: settlement('p3'),
      },
      ...overrides,
    });

    return withHand(
      {
        ...base,
        players: base.players.map((player) => {
          if (player.id === 'p2') {
            return { ...player, resources: { ...player.resources, grain: 4, ore: 3 } };
          }
          if (player.id === 'p3') return { ...player, resources: { ...player.resources, wool: 4 } };
          return player;
        }),
      },
      'p1',
      ['saboteur'],
    );
  }

  it('schickt bei Sabotage alle mit gleich vielen oder mehr Punkten ins Abwerfen', () => {
    const result = applyPlayProgress(sabotageTable(), 'p1', { card: 'saboteur' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toEqual({
        kind: 'discardPending',
        pending: ['p2'],
        counts: { p2: 3 },
        resume: 'main',
      });
    }
  });

  it('laesst bei Sabotage die Haelfte abgerundet abwerfen', () => {
    const result = applyPlayProgress(sabotageTable(), 'p1', { card: 'saboteur' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(discardCountFor(result.state, 'p2')).toBe(3);
  });

  /*
   * Sieben Karten liegen genau auf dem Handlimit - nach einer Sieben muesste
   * niemand abwerfen. Genau deshalb traegt die Phase ihre eigene Menge.
   */
  it('greift auch unterhalb des Handlimits', () => {
    expect(handSize(sabotageTable(), 'p2')).toBe(CITIES_RULES.handLimitBeforeDiscard);
  });

  it('nimmt auch den mit gleich vielen Punkten', () => {
    // Aus der Siedlung von p3 wird eine Stadt - damit steht p3 bei 4 wie p1.
    const table = sabotageTable();
    const equal: GameState = {
      ...table,
      buildings: { ...table.buildings, [OUTER]: city('p3') },
    };
    const withMore: GameState = {
      ...equal,
      players: equal.players.map((player) =>
        player.id === 'p3' ? { ...player, resources: { ...player.resources, wool: 5 } } : player,
      ),
    };

    const result = applyPlayProgress(withMore, 'p1', { card: 'saboteur' });
    expect(result.ok).toBe(true);
    if (result.ok && result.state.phase.kind === 'discardPending') {
      expect(result.state.phase.pending).toEqual(['p2', 'p3']);
      expect(result.state.phase.counts).toEqual({ p2: 3, p3: 2 });
    } else {
      expect(result.ok && result.state.phase.kind).toBe('discardPending');
    }
  });

  /*
   * Der Rueckweg: nach Sabotage geht es ohne Raeuber in die Hauptphase, und
   * das entscheidet `resume` in der Phase.
   */
  it('geht nach dem Abwerfen ohne Raeuber in die Hauptphase zurueck', () => {
    const played = applyPlayProgress(sabotageTable(), 'p1', { card: 'saboteur' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const discarded = applyDiscard(played.state, 'p2', hand({ grain: 3 }));
    expect(discarded.ok).toBe(true);
    if (discarded.ok) {
      expect(discarded.state.phase.kind).toBe('main');
      expect(handSize(discarded.state, 'p2')).toBe(4);
    }
  });

  it('laesst den Ausspieler selbst in Ruhe', () => {
    const table = sabotageTable();
    const rich: GameState = {
      ...table,
      players: table.players.map((player) =>
        player.id === 'p1' ? { ...player, resources: { ...player.resources, brick: 9 } } : player,
      ),
    };

    const result = applyPlayProgress(rich, 'p1', { card: 'saboteur' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(handSize(result.state, 'p1')).toBe(9);
      if (result.state.phase.kind === 'discardPending') {
        expect(result.state.phase.pending).not.toContain('p1');
      }
    }
  });

  /*
   * Niemand vor sich und niemand mit Karten: dann oeffnet keine Phase. Eine
   * Wartephase ohne Wartende hielte den Tisch fuer nichts an.
   */
  it('bleibt in der Hauptphase, wenn niemand abzuwerfen hat', () => {
    const table = sabotageTable();
    const poor: GameState = {
      ...table,
      players: table.players.map((player) => ({
        ...player,
        resources: { ...player.resources, grain: 0, ore: 0, wool: 0 },
      })),
    };

    const result = applyPlayProgress(poor, 'p1', { card: 'saboteur' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.phase.kind).toBe('main');
  });
});

describe('Intrige', () => {
  /*
   * p1 haelt `e:0,0|1,-1` und erreicht damit `CORNERS[0]`, wo ein Ritter von
   * p2 steht. p2 haelt `e:1,-1|1,0` und hat mit `OUTER` einen Platz zum
   * Ausweichen. Auf `CORNERS[3]` steht ein zweiter Ritter von p2 - dorthin
   * fuehrt keine eigene Strasse.
   */
  function reachableFoe(overrides: Partial<GameState> = {}): GameState {
    return withHand(
      citiesTable({
        roads: { 'e:0,0|1,-1': 'p1', 'e:1,-1|1,0': 'p2' },
        knights: { [CORNERS[0]!]: passive('p2'), [CORNERS[3]!]: passive('p2') },
        ...overrides,
      }),
      'p1',
      ['intrigue'],
    );
  }

  it('vertreibt bei Intrige einen fremden Ritter ohne eigenen Ritter', () => {
    const result = applyPlayProgress(reachableFoe(), 'p1', {
      card: 'intrigue',
      vertex: CORNERS[0]!,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase.kind).toBe('displacePending');
      expect(result.state.knights[CORNERS[0]!]).toBeUndefined();
    }
  });

  it('reicht den Ritter unveraendert in die Ausweichphase', () => {
    const result = applyPlayProgress(reachableFoe(), 'p1', {
      card: 'intrigue',
      vertex: CORNERS[0]!,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.state.phase.kind === 'displacePending') {
      expect(result.state.phase.owner).toBe('p2');
      expect(result.state.phase.from).toBe(CORNERS[0]!);
      expect(result.state.phase.active).toBe(false);
    }
  });

  /*
   * Ohne Ausweichkreuzung kommt die Figur in den Vorrat und der Tisch bleibt in
   * der Hauptphase - dieselbe Regel wie beim Vertreiben durch einen Ritter.
   */
  it('nimmt den Ritter vom Brett, wenn er nirgends hinkann', () => {
    const state = reachableFoe({ roads: { 'e:0,0|1,-1': 'p1' } });
    const before = playerNamed(state, 'p2').piecesLeft.knight1;

    const result = applyPlayProgress(state, 'p1', { card: 'intrigue', vertex: CORNERS[0]! });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase.kind).toBe('main');
      expect(playerNamed(result.state, 'p2').piecesLeft.knight1).toBe(before + 1);
    }
  });

  it('lehnt Intrige auf einer Kreuzung ohne eigene Strasse ab', () => {
    const state = reachableFoe();
    const play = { card: 'intrigue', vertex: CORNERS[3]! } as const;

    // Dort steht wirklich ein fremder Ritter - abgelehnt wird die Strasse.
    expect(state.knights[CORNERS[3]!]?.owner).toBe('p2');
    expect(canPlayProgress(state, 'p1', play)?.code).toBe(RuleViolationCode.NOT_CONNECTED);
    expect(applyPlayProgress(state, 'p1', play).ok).toBe(false);
  });

  it('lehnt eine Kreuzung ohne Ritter ab', () => {
    const state = reachableFoe();
    expect(canPlayProgress(state, 'p1', { card: 'intrigue', vertex: CORNERS[1]! })?.code).toBe(
      RuleViolationCode.NO_KNIGHT_HERE,
    );
  });

  it('lehnt den eigenen Ritter ab', () => {
    const state = reachableFoe({
      knights: { [CORNERS[0]!]: passive('p1'), [CORNERS[3]!]: passive('p2') },
    });
    expect(canPlayProgress(state, 'p1', { card: 'intrigue', vertex: CORNERS[0]! })?.code).toBe(
      RuleViolationCode.KNIGHT_TARGET_TAKEN,
    );
  });
});

describe('Bischof', () => {
  /** Das Zielfeld: Huegel mit der 6, sechs Ecken, nicht das Raeuberfeld. */
  const TARGET = '1,-1';

  /** Eine Ecke des Zielfelds ausserhalb des Rings. */
  const OWN_CORNER = 'v:1,-2|1,-1|2,-2';

  /*
   * p2 steht mit einem Dorf am Zielfeld und haelt nur Wolle, p3 mit zwei
   * Bauwerken und haelt nur Erz. p1 steht selbst mit einem Dorf da - vom
   * eigenen Dorf zieht der Bischof nicht.
   */
  function bishopTable(overrides: Partial<GameState> = {}): GameState {
    const base = citiesTable({
      buildings: {
        [CORNERS[1]!]: settlement('p2'),
        [CORNERS[0]!]: settlement('p3'),
        [OUTER]: city('p3'),
        [OWN_CORNER]: settlement('p1'),
      },
      ...overrides,
    });

    return withHand(
      {
        ...base,
        players: base.players.map((player) => {
          if (player.id === 'p2') return { ...player, resources: { ...player.resources, wool: 3 } };
          if (player.id === 'p3') return { ...player, resources: { ...player.resources, ore: 4 } };
          return player;
        }),
      },
      'p1',
      ['bishop'],
    );
  }

  it('zieht beim Bischof von jeder Person am Feld genau eine Karte', () => {
    const state = bishopTable();
    const before1 = handSize(state, 'p1');
    const before3 = handSize(state, 'p3');

    const result = applyPlayProgress(state, 'p1', { card: 'bishop', hex: TARGET });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(handSize(result.state, 'p1')).toBe(before1 + 2);
      expect(handSize(result.state, 'p3')).toBe(before3 - 1);
      expect(handSize(result.state, 'p2')).toBe(2);
    }
  });

  /** Je Person eine - p3 steht zweimal am Feld und verliert trotzdem nur eine. */
  it('nimmt jeder Person genau eine, auch bei zwei Bauwerken', () => {
    const result = applyPlayProgress(bishopTable(), 'p1', { card: 'bishop', hex: TARGET });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(playerNamed(result.state, 'p1').resources.wool).toBe(1);
      expect(playerNamed(result.state, 'p1').resources.ore).toBe(1);
    }
  });

  it('setzt beim Bischof den Raeuber um und braucht kein Opfer', () => {
    const result = applyPlayProgress(bishopTable(), 'p1', { card: 'bishop', hex: TARGET });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.robber).toBe(TARGET);
      expect(result.state.phase.kind).toBe('main'); // keine robberPending-Nachfrage
    }
  });

  it('geht an einer leeren Hand vorbei', () => {
    const state = bishopTable();
    const empty: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'p2' ? { ...player, resources: { ...player.resources, wool: 0 } } : player,
      ),
    };

    const before1 = handSize(empty, 'p1');
    const result = applyPlayProgress(empty, 'p1', { card: 'bishop', hex: TARGET });
    expect(result.ok).toBe(true);
    if (result.ok) expect(handSize(result.state, 'p1')).toBe(before1 + 1);
  });

  it('lehnt das Feld ab, auf dem der Raeuber schon steht', () => {
    const state = bishopTable();
    expect(canPlayProgress(state, 'p1', { card: 'bishop', hex: state.robber })?.code).toBe(
      RuleViolationCode.ROBBER_SAME_HEX,
    );
  });

  it('lehnt ein Feld ausserhalb des Bretts ab', () => {
    expect(canPlayProgress(bishopTable(), 'p1', { card: 'bishop', hex: '9,9' })?.code).toBe(
      RuleViolationCode.NOT_ON_BOARD,
    );
  });

  /*
   * Bis zum ersten Barbarenueberfall ruehrt sich der Raeuber nicht - auch
   * nicht auf einer Karte.
   */
  it('laesst den Raeuber vor dem ersten Ueberfall stehen', () => {
    const locked = bishopTable({ barbarians: { position: 0, attacks: 0 } });
    expect(canPlayProgress(locked, 'p1', { card: 'bishop', hex: TARGET })?.code).toBe(
      RuleViolationCode.ROBBER_LOCKED,
    );
  });
});

describe('Diplomat', () => {
  /** Fuenf Strassen von p2, eine Kette ohne Beruehrung mit dem Ring. */
  const RIVAL_CHAIN: readonly string[] = [
    'e:0,-1|1,-2',
    'e:1,-2|1,-1',
    'e:1,-1|2,-2',
    'e:1,-1|2,-1',
    'e:1,0|2,-1',
  ];

  /** Das freie Ende der fremden Kette - offen, weil dort nichts weitergeht. */
  const foreignOpen = RIVAL_CHAIN[0]!;

  /** Mitten in der fremden Kette - an beiden Enden geht es weiter. */
  const foreignClosed = RIVAL_CHAIN[2]!;

  /** Die zweite Strasse von p1, deren Ende auf `CORNERS[2]` frei liegt. */
  const ownOpen = 'e:0,-1|0,0';

  /** Eine freie Kante an `CORNERS[0]`, wo p1 sein Dorf hat. */
  const elsewhere = 'e:0,0|1,0';

  /** Eine freie Kante weit weg vom eigenen Netz. */
  const unconnected = 'e:-2,1|-1,1';

  /*
   * p1 haelt zwei Strassen mit einem Dorf auf `CORNERS[0]`, p2 die Kette von
   * fuenf - und damit die Laengste Handelsstrasse.
   */
  function diplomatTable(overrides: Partial<GameState> = {}): GameState {
    return withHand(
      citiesTable({
        roads: {
          'e:0,0|1,-1': 'p1',
          [ownOpen]: 'p1',
          ...Object.fromEntries(RIVAL_CHAIN.map((edge) => [edge, 'p2'])),
        },
        buildings: { [CORNERS[0]!]: settlement('p1') },
        longestRoad: { holder: 'p2', length: 5 },
        ...overrides,
      }),
      'p1',
      ['diplomat'],
    );
  }

  it('entfernt beim Diplomaten eine offene Strasse und gibt sie in den Vorrat', () => {
    const state = diplomatTable();
    const beforeStock = playerNamed(state, 'p2').piecesLeft.road;

    const result = applyPlayProgress(state, 'p1', { card: 'diplomat', edge: foreignOpen });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.roads[foreignOpen]).toBeUndefined();
      expect(playerNamed(result.state, 'p2').piecesLeft.road).toBe(beforeStock + 1);
    }
  });

  it('rechnet die Laengste Handelsroute nach dem Diplomaten neu', () => {
    const result = applyPlayProgress(diplomatTable(), 'p1', {
      card: 'diplomat',
      edge: foreignOpen,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.longestRoad.holder).not.toBe('p2');
      expect(result.state.longestRoad).toEqual({ holder: null, length: 0 });
    }
  });

  it('laesst eine eigene entfernte Strasse sofort neu setzen', () => {
    const state = diplomatTable();
    const beforeStock = playerNamed(state, 'p1').piecesLeft.road;

    const result = applyPlayProgress(state, 'p1', {
      card: 'diplomat',
      edge: ownOpen,
      rebuildAt: elsewhere,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.roads[elsewhere]).toBe('p1');
      expect(result.state.roads[ownOpen]).toBeUndefined();
      expect(playerNamed(result.state, 'p1').piecesLeft.road).toBe(beforeStock);
    }
  });

  /** Der Neubau ist gratis - die Karte bezahlt ihn, nicht die Hand. */
  it('laesst den Neubau nichts kosten', () => {
    const state = diplomatTable();
    const before = playerNamed(state, 'p1').resources;

    const result = applyPlayProgress(state, 'p1', {
      card: 'diplomat',
      edge: ownOpen,
      rebuildAt: elsewhere,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(playerNamed(result.state, 'p1').resources).toEqual(before);
  });

  it('lehnt den Neubau nach einer fremden Strasse ab', () => {
    const problem = canPlayProgress(diplomatTable(), 'p1', {
      card: 'diplomat',
      edge: foreignOpen,
      rebuildAt: elsewhere,
    });

    expect(problem?.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
    expect(problem?.message).toContain('eigene');
  });

  it('lehnt den Neubau auf derselben Kante ab', () => {
    const result = applyPlayProgress(diplomatTable(), 'p1', {
      card: 'diplomat',
      edge: ownOpen,
      rebuildAt: ownOpen,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
  });

  it('lehnt einen Neubau ohne Anschluss ab', () => {
    expect(
      canPlayProgress(diplomatTable(), 'p1', {
        card: 'diplomat',
        edge: ownOpen,
        rebuildAt: unconnected,
      })?.code,
    ).toBe(RuleViolationCode.NOT_CONNECTED);
  });

  it('lehnt eine Strasse ab, die nicht offen ist', () => {
    const state = diplomatTable();

    // Dort liegt wirklich eine Strasse - abgelehnt wird, dass sie nicht offen ist.
    expect(state.roads[foreignClosed]).toBe('p2');

    const problem = canPlayProgress(state, 'p1', { card: 'diplomat', edge: foreignClosed });
    expect(problem?.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
    expect(problem?.message).toContain('nicht offen');
  });

  it('lehnt eine Kante ohne Strasse ab', () => {
    const problem = canPlayProgress(diplomatTable(), 'p1', {
      card: 'diplomat',
      edge: unconnected,
    });

    expect(problem?.code).toBe(RuleViolationCode.PROGRESS_HAS_NO_EFFECT);
    expect(problem?.message).toContain('liegt keine');
  });
});
