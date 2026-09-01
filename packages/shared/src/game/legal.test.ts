import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES } from '../rules/index.js';
import { CARD_IDS } from '../scenario/index.js';
import {
  CENTER_EDGE,
  afterOpening,
  CENTER_VERTEX,
  NEXT_EDGE,
  TEST_PLAYERS,
  TEST_SCENARIO,
  gameWithCities,
  giving,
  hand,
  testGame,
} from './fixtures.js';
import { legalActions, playableDevelopmentCards } from './legal.js';
import { setupPlayer } from './setup.js';
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
    const state = afterOpening(createGame(TEST_SCENARIO, CLASSIC_RULES, TEST_PLAYERS, 'legal'));
    // Wer zuerst setzt, hat der Auftakt entschieden.
    const actor = setupPlayer(state)!;
    const actions = legalActions(state, actor);

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => action.type === 'placeSetupSettlement')).toBe(true);
    expectAllAccepted(state, actor);
  });

  it('nennt nach der Siedlung nur die Kanten an ihr', () => {
    const state = testGame({
      phase: { kind: 'setup', placement: 0, settlement: CENTER_VERTEX },
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
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
      { kind: 'robberPending' as const, resume: 'main' as const },
    ]) {
      expect(legalActions(testGame({ phase }), 'p2')).toEqual([]);
    }
  });

  it('nennt nach Spielende nichts mehr', () => {
    const state = testGame({ phase: { kind: 'finished', winner: 'p1' } });

    for (const player of TEST_PLAYERS) expect(legalActions(state, player)).toEqual([]);
  });

  it('zaehlt das Abwerfen bewusst nicht auf', () => {
    const state = giving(
      testGame({ phase: { kind: 'discardPending', pending: ['p1'], counts: {}, resume: 'seven' } }),
      'p1',
      {
        brick: 8,
      },
    );

    expect(legalActions(state, 'p1')).toEqual([]);
  });

  it('nennt beim Raeuber jedes Feld ausser dem aktuellen', () => {
    const state = testGame({ phase: { kind: 'robberPending', resume: 'main' } });
    const actions = legalActions(state, 'p1');

    expect(actions).toHaveLength(TEST_SCENARIO.hexes.length - 1);
    expect(actions.every((action) => action.type === 'moveRobber')).toBe(true);
    expectAllAccepted(state, 'p1');
  });

  it('nennt beim Raeuber jedes moegliche Opfer einzeln', () => {
    const state = giving(
      testGame({
        phase: { kind: 'robberPending', resume: 'main' },
        buildings: {
          [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
        },
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
        buildings: {
          [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
        },
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

  /*
   * `legalActions` zaehlt ueber die Sorten dieses Tisches, nicht ueber alle,
   * die es gibt. An einem Basistisch waeren es sonst vierundsechzig
   * Bankgeschaefte statt fuenfundzwanzig - drei Viertel davon mit Karten, die
   * dort nicht vorkommen.
   */
  it('nennt nur Bankgeschaefte mit den Sorten dieses Tisches', () => {
    const state = giving(testGame({ phase: { kind: 'main' } }), 'p1', { ore: 4 });

    const sorten = new Set(
      legalActions(state, 'p1')
        .filter((action) => action.type === 'tradeWithBank')
        .flatMap((action) => [action.give, action.receive]),
    );

    expect(sorten.size).toBeGreaterThan(0);
    for (const sorte of sorten) expect(state.rules.cards).toContain(sorte);
  });

  it('bietet an einem Staedte-Tisch auch Handelswaren an', () => {
    const state = giving(
      testGame({
        phase: { kind: 'main' },
        rules: { ...CLASSIC_RULES, cards: [...CARD_IDS] },
        // Ohne Papier im Vorrat waere der Tausch zu Recht kein Zug.
        bank: hand({ brick: 19, lumber: 19, wool: 19, grain: 19, ore: 19, paper: 12 }),
      }),
      'p1',
      { ore: 4 },
    );

    const empfangen = new Set(
      legalActions(state, 'p1')
        .filter((action) => action.type === 'tradeWithBank')
        .map((action) => action.receive),
    );

    expect(empfangen).toContain('paper');
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
        buildings: {
          [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null },
        },
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

describe('legalActions im Auftakt', () => {
  const inOpening = () =>
    testGame({
      phase: { kind: 'opening', rolls: {}, pending: ['p2', 'p3'], round: 0 },
      turn: 0,
    });

  it('bietet dem Vordersten das Wuerfeln an', () => {
    expect(legalActions(inOpening(), 'p2')).toEqual([{ type: 'rollDice', player: 'p2' }]);
  });

  it('bietet den Wartenden nichts an', () => {
    expect(legalActions(inOpening(), 'p3')).toEqual([]);
    expect(legalActions(inOpening(), 'p1')).toEqual([]);
  });
});

describe('Karten vor dem Wurf', () => {
  const withKnight = () => {
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

  it('bietet vor dem Wurf den Ritter an', () => {
    const actions = legalActions(withKnight(), 'p1').map((action) => action.type);

    expect(actions).toContain('rollDice');
    expect(actions).toContain('playKnight');
  });

  it('bietet vor dem Wurf keinen Kauf an', () => {
    expect(legalActions(withKnight(), 'p1').map((action) => action.type)).not.toContain(
      'buyDevelopmentCard',
    );
  });

  it('nennt die spielbaren Karten auch vor dem Wurf', () => {
    expect(playableDevelopmentCards(withKnight(), 'p1')).toContain('knight');
  });

  it('bietet dem Mitspieler vor dem Wurf nichts an', () => {
    expect(legalActions(withKnight(), 'p2')).toEqual([]);
  });
});

/**
 * Staedte & Ritter in der Aktionsliste.
 *
 * Geprueft wird beides: dass die Zuege dastehen, sobald sie gehen, und dass
 * `reduce` jeden davon annimmt - sonst gaebe es wieder zwei Auslegungen.
 */
describe('legalActions an einem Staedte-&-Ritter-Tisch', () => {
  const CHAIN = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0'];
  const CORNERS = ['v:0,0|1,-1|1,0', 'v:0,-1|0,0|1,-1', 'v:-1,0|0,-1|0,0', 'v:-1,0|-1,1|0,0'];

  function typesFor(state: GameState, player: string): Set<string> {
    return new Set(legalActions(state, player).map((action) => action.type));
  }

  it('bietet den Ritterbau an, sobald Strasse und Karten da sind', () => {
    const state = giving(
      gameWithCities({ roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p1'])) }),
      'p1',
      hand({ wool: 1, ore: 1 }),
    );

    expect(typesFor(state, 'p1').has('buildKnight')).toBe(true);
    expectAllAccepted(state, 'p1');
  });

  it('bietet die Stadtmauer an, sobald der Lehm da ist', () => {
    const state = giving(gameWithCities(), 'p1', hand({ brick: 2 }));

    expect(typesFor(state, 'p1').has('buildWall')).toBe(true);
    expectAllAccepted(state, 'p1');
  });

  it('bietet Aktivieren und Aufwerten an einem stehenden Ritter an', () => {
    const passive = {
      owner: 'p1',
      level: 1 as const,
      active: false,
      activatedOnTurn: null,
      upgradedThisTurn: false,
    };
    const state = giving(
      gameWithCities({ knights: { [CORNERS[3]!]: passive } }),
      'p1',
      hand({ grain: 1, wool: 1, ore: 1 }),
    );

    const types = typesFor(state, 'p1');
    expect(types.has('activateKnight')).toBe(true);
    expect(types.has('upgradeKnight')).toBe(true);
    expectAllAccepted(state, 'p1');
  });

  it('bietet Versetzen und Raeuberjagd an einem handlungsbereiten Ritter an', () => {
    const ready = {
      owner: 'p1',
      level: 1 as const,
      active: true,
      activatedOnTurn: 1,
      upgradedThisTurn: false,
    };
    const state = gameWithCities({
      buildings: {},
      roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p1'])),
      knights: { [CORNERS[0]!]: ready },
      barbarians: { position: 0, attacks: 1 },
      robber: '0,0',
      turn: 2,
    });

    const types = typesFor(state, 'p1');
    expect(types.has('moveKnight')).toBe(true);
    expect(types.has('chaseRobber')).toBe(true);
    expectAllAccepted(state, 'p1');
  });

  function withImprovementLevel(
    state: GameState,
    id: string,
    levels: Partial<Record<'trade' | 'politics' | 'science', number>>,
  ): GameState {
    return {
      ...state,
      players: state.players.map((player) =>
        player.id === id ? { ...player, improvements: levels } : player,
      ),
    };
  }

  it('nennt in main hoechstens einen improveCity je Bereich', () => {
    // Nur Tuch ist da - Politik und Wissenschaft bleiben unbezahlbar, Handel
    // bringt bei Stufe 1 noch keinen Aufsatz, also genau ein Zug.
    const state = giving(gameWithCities(), 'p1', hand({ cloth: 1 }));

    const improvements = legalActions(state, 'p1').filter(
      (action) => action.type === 'improveCity',
    );
    expect(improvements).toEqual([{ type: 'improveCity', player: 'p1', track: 'trade' }]);
    expectAllAccepted(state, 'p1');
  });

  it('nennt bei faelligem Aufsatz einen improveCity je freier eigener Stadt', () => {
    const state = giving(
      withImprovementLevel(
        gameWithCities({
          buildings: {
            [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
            [CORNERS[1]!]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
          },
        }),
        'p1',
        { trade: 3 },
      ),
      'p1',
      hand({ cloth: 4 }),
    );

    const improvements = legalActions(state, 'p1').filter(
      (action) => action.type === 'improveCity' && action.track === 'trade',
    );
    expect(improvements).toEqual(
      expect.arrayContaining([
        { type: 'improveCity', player: 'p1', track: 'trade', metropolisAt: CENTER_VERTEX },
        { type: 'improveCity', player: 'p1', track: 'trade', metropolisAt: CORNERS[1] },
      ]),
    );
    expect(improvements).toHaveLength(2);
    expectAllAccepted(state, 'p1');
  });

  it('nennt an einem Basistisch keinen einzigen davon', () => {
    const state = giving(
      testGame({
        buildings: {
          [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        },
        roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p1'])),
      }),
      'p1',
      hand({ brick: 4, lumber: 4, wool: 4, ore: 4, grain: 4 }),
    );

    const types = typesFor(state, 'p1');
    for (const type of [
      'buildKnight',
      'buildWall',
      'activateKnight',
      'upgradeKnight',
      'moveKnight',
      'chaseRobber',
      'improveCity',
    ]) {
      expect(types.has(type)).toBe(false);
    }
  });

  it('nennt in displacePending nur das Ausweichen, und nur fuer den Besitzer', () => {
    const state = gameWithCities({
      buildings: {},
      roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p2'])),
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

    expect(typesFor(state, 'p2')).toEqual(new Set(['placeDisplacedKnight']));
    expect(legalActions(state, 'p1')).toEqual([]);
    expectAllAccepted(state, 'p2');
  });
});
