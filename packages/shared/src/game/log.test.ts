import { describe, expect, it } from 'vitest';
import { CLASSIC_34 } from '../scenario/blueprints/classic34.js';
import { generateScenario } from '../scenario/generator.js';
import { CLASSIC_RULES } from '../rules/ruleset.js';
import { seatColorAt, type Seat } from '../seats.js';
import { createGame, setupPlayer } from './setup.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { describeTransition } from './log.js';
import { yieldTotal } from './dice.js';
import { CENTER_VERTEX, giving, testGame } from './fixtures.js';
import type { GameAction } from './actions.js';
import type { GameState } from './state.js';

const scenario = generateScenario(CLASSIC_34, 'log-probe');
const seats: Seat[] = ['p1', 'p2', 'p3'].map((id, index) => ({
  id,
  name: `Spieler ${index + 1}`,
  color: seatColorAt(index),
}));
const ids = seats.map((seat) => seat.id);

/** Das handgelegte Brett aus `fixtures.ts` benutzt eigene Spieler-Ids. */
const testSeats: Seat[] = ['p1', 'p2', 'p3'].map((id, index) => ({
  id,
  name: id,
  color: seatColorAt(index),
}));

function apply(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('Verlaufssaetze', () => {
  it('nennt die Gruendungssiedlung beim Namen des Spielers', () => {
    const before = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    const action = legalActions(before, setupPlayer(before)!)[0]!;
    const after = apply(before, action);

    expect(describeTransition(before, action, after, seats)).toContain('Spieler 1');
    expect(describeTransition(before, action, after, seats)).toContain('Gruendungssiedlung');
  });

  it('nennt beim Wurf die Augenzahl', () => {
    let state = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    while (state.phase.kind === 'setup') {
      state = apply(state, legalActions(state, setupPlayer(state)!)[0]!);
    }

    const player = state.players[state.currentPlayerIndex]!.id;
    const action: GameAction = { type: 'rollDice', player };
    const after = apply(state, action);
    const sum = yieldTotal(after.rules.dice, after.lastRoll!);

    expect(describeTransition(state, action, after, seats)).toContain(String(sum));
  });

  it('meldet den Sieg an dem Zug, mit dem er faellt', () => {
    /*
     * Der Sieg stand einmal nur beim Zugende - und konnte dort gar nicht
     * auftreten, weil `reduce` ihn nur fuer den Spieler am Zug prueft und das
     * beim Zugende schon der naechste ist. Gewonnen wird mit einer Stadt, einer
     * Karte, einem Ritter; der Verlauf meldete davon nur den Zug.
     */
    const base = testGame({
      rules: { ...CLASSIC_RULES, victoryPointGoal: 2 },
      phase: { kind: 'main' },
      currentPlayerIndex: 0,
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
    });
    const before = giving(base, 'p1', { grain: 2, ore: 3 });
    const action: GameAction = { type: 'buildCity', player: 'p1', vertex: CENTER_VERTEX };
    const after = apply(before, action);

    expect(after.phase.kind).toBe('finished');
    expect(describeTransition(before, action, after, testSeats)).toBe(
      'p1 baut eine Stadt - und gewinnt die Partie',
    );
  });

  it('faellt fuer unbekannte Sitze auf die Id zurueck statt zu werfen', () => {
    const before = createGame(scenario, CLASSIC_RULES, ids, 'log-probe');
    const action = legalActions(before, setupPlayer(before)!)[0]!;
    const after = apply(before, action);

    expect(describeTransition(before, action, after, [])).toContain('p1');
  });
});
