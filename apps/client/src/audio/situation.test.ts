import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  type GameAction,
  type GameState,
  type PlayerView,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { situationFromGame, situationFromView } from './situation';

const scenario = generateScenario(CLASSIC_34, 'ton-probe');
const ids = defaultSeats(3).map((seat) => seat.id);

/** Eine Partie, die die Gruendung hinter sich hat und am Wuerfeln ist. */
function afterSetup(): GameState {
  let state = createGame(scenario, CLASSIC_RULES, ids, 'ton-probe');

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const result = reduce(state, legalActions(state, player)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

function apply(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

const cardsOf = (state: GameState): number =>
  state.players.reduce(
    (sum, player) => sum + Object.values(player.resources).reduce((a, b) => a + b, 0),
    0,
  );

/**
 * Eine Sicht mit genau den Feldern, die die Erhebung liest.
 *
 * Derselbe Kniff wie in `onlineState.test.ts`: eine vollstaendige `PlayerView`
 * aufzubauen kostet mehr, als der Test aussagt.
 */
function viewOf(options: {
  you?: string;
  cards?: number;
  currentIs?: string;
  phase?: PlayerView['phase'];
}): PlayerView {
  const you = options.you ?? 'u1';
  const players = ['u1', 'u2', 'u3'].map((id) => ({
    id,
    cardCount: id === you ? (options.cards ?? 0) : 0,
  }));

  return {
    you,
    players,
    currentPlayerIndex: players.findIndex((player) => player.id === (options.currentIs ?? 'u1')),
    phase: options.phase ?? { kind: 'main' },
    lastRoll: null,
    turn: 1,
  } as unknown as PlayerView;
}

describe('situationFromGame (Hotseat)', () => {
  it('haelt nichts fuer fremd - am selben Geraet ist jeder „ich"', () => {
    const before = afterSetup();
    const action: GameAction = { type: 'rollDice', player: before.players[0]!.id };
    const after = apply(before, action);

    const situation = situationFromGame(before, after, action);

    expect(situation.foreign).toBe(false);
    expect(situation.becameMyTurn).toBe(false);
  });

  it('zaehlt den Ertrag ueber alle Spieler zusammen', () => {
    const before = afterSetup();
    const action: GameAction = { type: 'rollDice', player: before.players[0]!.id };
    const after = apply(before, action);

    expect(situationFromGame(before, after, action).gained).toBe(
      Math.max(0, cardsOf(after) - cardsOf(before)),
    );
  });

  it('liest die Augensumme aus dem Wurf', () => {
    const before = afterSetup();
    const action: GameAction = { type: 'rollDice', player: before.players[0]!.id };
    const after = apply(before, action);

    const total = after.lastRoll!.reduce((sum, die) => sum + die.value, 0);

    expect(situationFromGame(before, after, action).diceTotal).toBe(total);
  });

  it('meldet die Abwurfaufforderung nur beim Uebergang', () => {
    const rolled = afterSetup();
    const pending: GameState = {
      ...rolled,
      phase: { kind: 'discardPending', pending: [ids[0]!], counts: {}, resume: 'seven' },
    };
    const action: GameAction = { type: 'rollDice', player: ids[0]! };

    expect(situationFromGame(rolled, pending, action).mustDiscard).toBe(true);
    expect(situationFromGame(pending, pending, action).mustDiscard).toBe(false);
  });

  it('meldet das Ende genau beim Uebergang', () => {
    const running = afterSetup();
    const over: GameState = { ...running, phase: { kind: 'finished', winner: ids[0]! } };
    const action: GameAction = { type: 'buildCity', player: ids[0]!, vertex: 'v:0,0|1,-1|1,0' };

    expect(situationFromGame(running, over, action).finished).toBe(true);
    expect(situationFromGame(over, over, action).finished).toBe(false);
  });
});

describe('situationFromView (online)', () => {
  it('erkennt den fremden Zug an seinem Urheber', () => {
    const view = viewOf({});

    expect(situationFromView(view, view, { type: 'buildCity', actor: 'u2' }).foreign).toBe(true);
    expect(situationFromView(view, view, { type: 'buildCity', actor: 'u1' }).foreign).toBe(false);
  });

  it('liest Gewinn und Verlust aus der eigenen Handkartenzahl', () => {
    const few = viewOf({ cards: 3 });
    const many = viewOf({ cards: 5 });

    expect(situationFromView(few, many, { type: 'rollDice', actor: 'u1' }).gained).toBe(2);
    expect(situationFromView(many, few, { type: 'moveRobber', actor: 'u2' }).lost).toBe(2);
  });

  it('meldet „du bist dran" nur beim Wechsel', () => {
    const theirs = viewOf({ currentIs: 'u2' });
    const mine = viewOf({ currentIs: 'u1' });

    expect(situationFromView(theirs, mine, { type: 'endTurn', actor: 'u2' }).becameMyTurn).toBe(
      true,
    );
    expect(situationFromView(mine, mine, { type: 'buildRoad', actor: 'u1' }).becameMyTurn).toBe(
      false,
    );
  });

  it('haelt ein fremdes Angebot fuer meins, ein eigenes nicht', () => {
    const before = viewOf({});
    const pending = viewOf({
      phase: { kind: 'tradePending' } as unknown as PlayerView['phase'],
    });

    expect(situationFromView(before, pending, { type: 'offerTrade', actor: 'u2' }).offerToMe).toBe(
      true,
    );
    expect(situationFromView(before, pending, { type: 'offerTrade', actor: 'u1' }).offerToMe).toBe(
      false,
    );
  });

  it('meldet die Abwurfaufforderung nur, wenn ich selbst abwerfen muss', () => {
    const before = viewOf({});
    const mine = viewOf({
      phase: { kind: 'discardPending', pending: ['u1'] } as unknown as PlayerView['phase'],
    });
    const theirs = viewOf({
      phase: { kind: 'discardPending', pending: ['u2'] } as unknown as PlayerView['phase'],
    });

    expect(situationFromView(before, mine, { type: 'rollDice', actor: 'u2' }).mustDiscard).toBe(
      true,
    );
    expect(situationFromView(before, theirs, { type: 'rollDice', actor: 'u2' }).mustDiscard).toBe(
      false,
    );
  });

  it('vertraegt den ersten Stand ohne Vorgaenger', () => {
    const after = viewOf({ cards: 4 });

    const situation = situationFromView(null, after, { type: 'rollDice', actor: 'u1' });

    // Ohne Vorgaenger gibt es keinen Unterschied, nur einen Anfang - und der
    // klingt nicht.
    expect(situation.gained).toBe(0);
    expect(situation.lost).toBe(0);
    expect(situation.becameMyTurn).toBe(false);
  });
});
