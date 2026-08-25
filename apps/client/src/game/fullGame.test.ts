import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_56,
  CLASSIC_RULES,
  EMPTY_CARDS,
  RESOURCE_IDS,
  createGame,
  discardCountFor,
  generateScenario,
  replay,
  type GameAction,
  type PlayerId,
  type CardAmounts,
  type ScenarioBlueprint,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { hotseatReducer, startHotseat, type HotseatState } from './hotseat';
import { actionTargets } from './targets';
import { actingPlayers } from './view';

/**
 * Eine vollstaendige Partie, gespielt ueber genau die Wege, die auch die
 * Oberflaeche benutzt: `actingPlayers` sagt, wer dran ist, `actionTargets`
 * sagt, was anklickbar ist, `hotseatReducer` fuehrt es aus.
 *
 * `shared` hat diesen Beweis schon fuer die Regeln (`game.integration.test.ts`).
 * Hier geht es um die Verdrahtung darueber: dass die Klickkarten in jeder Phase
 * etwas anbieten, dass eine Sieben ueber den Abwerf- und Raeuberweg
 * durchlaeuft, und dass am Ende jemand gewinnt. Ohne diesen Test faende man
 * eine Sackgasse erst beim Spielen - und dann in der Brettmitte einer halben
 * Partie.
 */

/**
 * Schrittbudget je Partie.
 *
 * Grosszuegig: sechs Spieler auf dem grossen Brett mit dieser stumpfen
 * Strategie brauchen ein Vielfaches der Zuege einer Dreierpartie. Das Budget
 * ist keine Erwartung an die Laenge, sondern eine Bremse gegen eine Endlos-
 * schleife - ein aufgebrauchtes Budget faellt als roter Test auf.
 */
const STEP_BUDGET = 40_000;

/**
 * Frist je Partie.
 *
 * Eine ganze Partie kostet ein paar Sekunden - `actionTargets` fragt in jedem
 * Schritt `legalActions`, und das laeuft ueber alle Knoten, Kanten und Kurse.
 * Im Spiel geschieht das einmal je Bild und faellt nicht auf; hier tausendfach.
 * Die Voreinstellung von 5 s reicht dafuer im Gesamtlauf nicht, deshalb steht
 * die Frist hier ausgeschrieben statt als stille Verkuerzung der Partie.
 */
const GAME_TIMEOUT_MS = 30_000;

interface Outcome {
  readonly state: HotseatState;
  readonly discards: number;
  readonly robberMoves: number;
  readonly trades: number;
}

/** Legt die geforderte Zahl Karten aus der Hand zusammen - wie der Dialog. */
function discardChoice(resources: CardAmounts, count: number): CardAmounts {
  const chosen: CardAmounts = { ...EMPTY_CARDS };
  let left = count;

  for (const resource of RESOURCE_IDS) {
    const take = Math.min(left, resources[resource] ?? 0);
    chosen[resource] = take;
    left -= take;
  }

  if (left > 0) throw new Error(`discardChoice: ${left} Karten zu wenig auf der Hand`);
  return chosen;
}

/**
 * Eine stumpfe, aber vollstaendige Strategie: Stadt vor Siedlung vor Strasse,
 * sonst tauschen, sonst Zug beenden. Sie soll nicht gut spielen, sondern jeden
 * Weg mindestens einmal gehen.
 */
function chooseAction(targets: ReturnType<typeof actionTargets>): GameAction | null {
  if (targets.roll !== null) return targets.roll;

  const byType = (type: GameAction['type']): GameAction | undefined =>
    [...targets.vertices.values(), ...targets.edges.values()].find(
      (action) => action.type === type,
    );

  const city = byType('buildCity');
  if (city !== undefined) return city;

  const settlement = byType('buildSettlement') ?? byType('placeSetupSettlement');
  if (settlement !== undefined) return settlement;

  const road = byType('buildRoad') ?? byType('placeSetupRoad');
  if (road !== undefined) return road;

  const robber = [...targets.hexes.values()][0]?.[0];
  if (robber !== undefined) return robber;

  const trade = targets.trades[0];
  if (trade !== undefined) return trade;

  return targets.endTurn;
}

function play(blueprint: ScenarioBlueprint, playerCount: number, seed: string): Outcome {
  const scenario = generateScenario(blueprint, seed);
  const seats = defaultSeats(playerCount);
  const start = createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    seed,
  );

  let state = startHotseat(start);
  let discards = 0;
  let robberMoves = 0;
  let trades = 0;

  for (let step = 0; step < STEP_BUDGET && state.game.phase.kind !== 'finished'; step += 1) {
    const acting: readonly PlayerId[] = actingPlayers(state.game);
    const player = acting[0];
    if (player === undefined) break;

    let action: GameAction | null;

    if (state.game.phase.kind === 'discardPending') {
      // Genau der Weg, den der Dialog geht: die Zahl kommt aus shared, die
      // Auswahl trifft der Spieler.
      const hand = state.game.players.find((entry) => entry.id === player)!.resources;
      action = {
        type: 'discard',
        player,
        resources: discardChoice(hand, discardCountFor(state.game, player)),
      };
      discards += 1;
    } else {
      action = chooseAction(actionTargets(state.game, player));
    }

    if (action === null) throw new Error(`Sackgasse in Phase ${state.game.phase.kind}`);
    if (action.type === 'moveRobber') robberMoves += 1;
    if (action.type === 'tradeWithBank') trades += 1;

    const next = hotseatReducer(state, { type: 'apply', action }, seats);
    if (next.lastError !== null) {
      throw new Error(`${action.type} abgelehnt: ${next.lastError}`);
    }
    state = next;
  }

  return { state, discards, robberMoves, trades };
}

describe('Eine ganze Partie ueber die Klickkarten', () => {
  it(
    'endet auf dem Basisbrett mit einem Sieger',
    () => {
      const { state, discards, robberMoves, trades } = play(CLASSIC_34, 3, 'partie-34');

      expect(state.game.phase.kind).toBe('finished');
      expect(state.log.length).toBe(state.actions.length);

      // Alle drei Sonderwege sind wirklich vorgekommen, nicht nur moeglich
      // gewesen.
      expect(robberMoves).toBeGreaterThan(0);
      expect(discards).toBeGreaterThan(0);
      expect(trades).toBeGreaterThan(0);
    },
    GAME_TIMEOUT_MS,
  );

  it(
    'endet auch auf dem grossen Brett mit sechs Spielern',
    () => {
      const { state } = play(CLASSIC_56, 6, 'partie-56');

      expect(state.game.phase.kind).toBe('finished');
      expect(state.game.players).toHaveLength(6);
    },
    GAME_TIMEOUT_MS,
  );

  it(
    'baut aus der gesammelten Folge denselben Endzustand',
    () => {
      const seed = 'partie-34';
      const scenario = generateScenario(CLASSIC_34, seed);
      const seats = defaultSeats(3);
      const start = createGame(
        scenario,
        CLASSIC_RULES,
        seats.map((seat) => seat.id),
        seed,
      );

      const { state } = play(CLASSIC_34, 3, seed);
      const replayed = replay(start, state.actions);

      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(state.game);
    },
    GAME_TIMEOUT_MS,
  );
});
