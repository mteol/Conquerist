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
  type GameState,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { actingPlayers, discardCountForView, gameViewOf } from './view';

const scenario = generateScenario(CLASSIC_34, 'view-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const result = reduce(state, legalActions(state, player)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

describe('Anzeigemodell', () => {
  it('nennt in der Gruendung den Spieler aus der Schlange, nicht den Index', () => {
    const state = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
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
    const setup = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
    expect(gameViewOf(playerViewOf(setup, ids[0]!, seats, 0)).phaseText).toContain('Gruendung');

    const rolling = afterSetup();
    expect(gameViewOf(playerViewOf(rolling, ids[0]!, seats, 1)).phaseText).toContain('wuerfeln');
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
