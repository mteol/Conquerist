import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  discardCountFor,
  generateScenario,
  legalActions,
  playerViewOf,
  reduce,
  setupPlayer,
  victoryPointsOf,
  yieldTotal,
  type GameState,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { afterOpening } from '../test/opening';
import { actingPlayers, cameFromRoll, discardCountForView, gameViewOf } from './view';

const scenario = generateScenario(CLASSIC_34, 'view-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'view-probe'));

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const result = reduce(state, legalActions(state, player)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

describe('Anzeigemodell', () => {
  it('nennt im Auftakt den Vordersten der Warteschlange', () => {
    const state = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
    if (state.phase.kind !== 'opening') throw new Error('Die Partie beginnt im Auftakt');

    expect(actingPlayers(state)).toEqual([state.phase.pending[0]]);
  });

  it('laesst im Auftakt niemanden handeln, wenn die Runde vollstaendig ist', () => {
    const state = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
    const leer = {
      ...state,
      phase: { kind: 'opening' as const, rolls: {}, pending: [], round: 0 },
    };

    expect(actingPlayers(leer)).toEqual([]);
  });

  it('nennt in der Gruendung den Spieler aus der Schlange, nicht den Index', () => {
    const state = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'view-probe'));
    expect(actingPlayers(state)).toEqual([setupPlayer(state)]);
  });

  it('nennt sonst den Spieler am Zug', () => {
    const state = afterSetup();
    expect(actingPlayers(state)).toEqual([state.players[state.currentPlayerIndex]!.id]);
  });

  it('uebernimmt Namen und Farbe aus den Sitzen und reicht die Siegpunkte durch', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

    expect(view.players.map((player) => player.name)).toEqual([
      'Spieler 1',
      'Spieler 2',
      'Spieler 3',
    ]);
    expect(view.players[0]!.color).toBe(seats[0]!.color);
    expect(view.players[1]!.victoryPoints).toBe(victoryPointsOf(state, ids[1]!));
  });

  it('zeigt genau das an, was in der Sicht steht - und erfindet nichts dazu', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, 'p2', seats, 3));

    expect(view.players.find((player) => player.id === 'p1')!.resources).toBeNull();
    expect(view.players.find((player) => player.id === 'p2')!.resources).not.toBeNull();
  });

  it('behaelt die Kartenzahl, auch wo die Karten verdeckt sind', () => {
    const view = gameViewOf(playerViewOf(afterSetup(), ids[0]!, seats, 1));

    // Die Anzahl bleibt sichtbar - sie ist am Tisch ohnehin abzaehlbar.
    for (const player of view.players) {
      expect(player.cardCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('rechnet das Abwerfen genauso wie shared', () => {
    const state = afterSetup();
    const view = playerViewOf(state, ids[0]!, seats, 1);

    for (const player of state.players) {
      expect(discardCountForView(view, player.id)).toBe(discardCountFor(state, player.id));
    }
  });

  it('sagt in jeder Phase, was zu tun ist', () => {
    const auftakt = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
    expect(gameViewOf(playerViewOf(auftakt, ids[0]!, seats, 0)).phaseText).toContain('Auftakt');

    const stechen = {
      ...auftakt,
      phase: { kind: 'opening' as const, rolls: {}, pending: [ids[0]!], round: 1 },
    };
    expect(gameViewOf(playerViewOf(stechen, ids[0]!, seats, 0)).phaseText).toContain('Stechen');

    const setup = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'view-probe'));
    expect(gameViewOf(playerViewOf(setup, ids[0]!, seats, 0)).phaseText).toContain('Gründung');

    const rolling = afterSetup();
    expect(gameViewOf(playerViewOf(rolling, ids[0]!, seats, 1)).phaseText).toContain('würfeln');
  });
});

describe('actingPlayers in tradePending', () => {
  const offerPhase = (responses: Record<string, unknown>) => ({
    phase: {
      kind: 'tradePending' as const,
      offer: {
        from: ids[0]!,
        give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
        want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
      },
      responses,
      expiresAt: 1_000,
    },
    players: ids.map((id) => ({ id })),
    currentPlayerIndex: 0,
  });

  it('nennt erst die Wartenden, dann den Anbieter', () => {
    expect(actingPlayers(offerPhase({}) as never)).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('laesst weg, wer schon geantwortet hat', () => {
    const responses = { [ids[1]!]: { kind: 'accepted' } };

    expect(actingPlayers(offerPhase(responses) as never)).toEqual([ids[2], ids[0]]);
  });
});

describe('der Auftakt im Anzeigemodell', () => {
  const start = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
  const viewOf = (state: GameState) => playerViewOf(state, ids[0]!, seats, 1);

  it('laesst die Wuerfel auch im Auftakt fliegen', () => {
    // Ohne diesen Fall haette der Auftakt lautlos gewuerfelt: `cameFromRoll`
    // kannte nur den Weg aus `rollPending` heraus, und im Auftakt bleibt die
    // Phase dieselbe.
    if (start.phase.kind !== 'opening') throw new Error('Die Partie beginnt im Auftakt');
    const result = reduce(start, { type: 'rollDice', player: start.phase.pending[0]! });
    if (!result.ok) throw new Error(result.error.message);

    expect(cameFromRoll(viewOf(start), viewOf(result.state))).toBe(true);
  });

  it('laesst sie nicht fliegen, wenn sich am Auftakt nichts geaendert hat', () => {
    expect(cameFromRoll(viewOf(start), viewOf(start))).toBe(false);
  });

  it('zeigt die Summen der schon Gefallenen', () => {
    if (start.phase.kind !== 'opening') throw new Error('Die Partie beginnt im Auftakt');
    const werfer = start.phase.pending[0]!;
    const result = reduce(start, { type: 'rollDice', player: werfer });
    if (!result.ok) throw new Error(result.error.message);

    const view = gameViewOf(viewOf(result.state));

    expect(view.opening).not.toBeNull();
    expect(view.opening!.round).toBe(0);
    expect(view.opening!.totals.get(werfer)).toBe(
      yieldTotal(result.state.rules.dice, result.state.lastRoll!),
    );
  });

  it('meldet ausserhalb des Auftakts keinen Auftakt', () => {
    expect(gameViewOf(viewOf(afterSetup())).opening).toBeNull();
  });
});
