import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  victoryPointsOf,
  type GameState,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { actingPlayers, gameView } from './view';

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

  it('uebernimmt Namen und Farbe aus den Sitzen und rechnet die Siegpunkte', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: false });

    expect(view.players.map((player) => player.name)).toEqual([
      'Spieler 1',
      'Spieler 2',
      'Spieler 3',
    ]);
    expect(view.players[0]!.color).toBe(seats[0]!.color);
    expect(view.players[1]!.victoryPoints).toBe(victoryPointsOf(state, ids[1]!));
  });

  it('zeigt offen alle Haende', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: false });

    for (const player of view.players) {
      expect(player.resources).not.toBeNull();
    }
  });

  it('verdeckt fremde Haende, die eigene nie', () => {
    const state = afterSetup();
    const view = gameView(state, seats, { viewer: ids[0]!, conceal: true });

    expect(view.players[0]!.resources).not.toBeNull();
    expect(view.players[1]!.resources).toBeNull();
    expect(view.players[2]!.resources).toBeNull();

    // Die Anzahl bleibt sichtbar - sie ist am Tisch ohnehin abzaehlbar.
    for (const player of view.players) {
      expect(player.cardCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('sagt in jeder Phase, was zu tun ist', () => {
    const setup = createGame(scenario, CLASSIC_RULES, ids, 'view-probe');
    expect(gameView(setup, seats, { viewer: null, conceal: false }).phaseText).toContain(
      'Gruendung',
    );

    const rolling = afterSetup();
    expect(gameView(rolling, seats, { viewer: null, conceal: false }).phaseText).toContain(
      'wuerfeln',
    );
  });
});
