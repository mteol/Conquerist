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
import { afterOpening, CENTER_VERTEX, giving, hand, testGame } from './fixtures.js';
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
    const before = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'log-probe'));
    const actor = setupPlayer(before)!;
    const action = legalActions(before, actor)[0]!;
    const after = apply(before, action);

    // Wer zuerst setzt, hat der Auftakt entschieden - der Name kommt deshalb
    // aus dem Sitz und steht nicht fest im Test.
    const name = seats.find((seat) => seat.id === actor)!.name;
    expect(describeTransition(before, action, after, seats)).toContain(name);
    expect(describeTransition(before, action, after, seats)).toContain('Gründungssiedlung');
  });

  it('nennt beim Wurf die Augenzahl', () => {
    let state = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'log-probe'));
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
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false } },
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
    const before = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'log-probe'));
    const action = legalActions(before, setupPlayer(before)!)[0]!;
    const after = apply(before, action);

    expect(describeTransition(before, action, after, [])).toContain(action.player);
  });
});

describe('Verlaufssaetze zum Spielerhandel', () => {
  const offer: GameAction = {
    type: 'offerTrade',
    player: 'p1',
    give: hand({ lumber: 2 }),
    want: hand({ ore: 1 }),
    at: 0,
  };

  /** p1 bietet, p2 kann zahlen. */
  function table(): GameState {
    return giving(giving(testGame(), 'p1', { lumber: 3 }), 'p2', { ore: 2 });
  }

  function step(state: GameState, action: GameAction): { state: GameState; entry: string } {
    const result = reduce(state, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.error.message}`);
    return {
      state: result.state,
      entry: describeTransition(state, action, result.state, testSeats),
    };
  }

  it('nennt beide Seiten beim Angebot', () => {
    expect(step(table(), offer).entry).toContain('bietet');
  });

  it('nennt den Partner beim Zuschlag', () => {
    const offered = step(table(), offer);
    const answered = step(offered.state, {
      type: 'respondTrade',
      player: 'p2',
      response: 'accepted',
    });
    const done = step(answered.state, { type: 'acceptTrade', player: 'p1', partner: 'p2' });

    expect(answered.entry).toBe('p2 nimmt das Angebot an');
    expect(done.entry).toBe('p1 tauscht mit p2');
  });

  it('nennt den Fristablauf mit dem Anbieter', () => {
    const offered = step(table(), offer);
    const due = offered.state.phase.kind === 'tradePending' ? offered.state.phase.expiresAt : 0;

    expect(step(offered.state, { type: 'timeout', player: 'p1', at: due }).entry).toContain(
      'abgelaufen',
    );
  });

  it('nennt Weggehen und Wiederkommen', () => {
    const offered = step(table(), offer);
    const gone = step(offered.state, { type: 'dropFromTrade', player: 'p2' });
    const back = step(gone.state, { type: 'rejoinTrade', player: 'p2' });

    expect(gone.entry).toContain('nicht mehr da');
    expect(back.entry).toContain('zurück');
  });
});

describe('der Verlaufssatz im Auftakt', () => {
  const auftakt = (pending: string[], rolls = {}) =>
    testGame({
      phase: { kind: 'opening', rolls, pending, round: 0 },
      turn: 0,
    });

  it('nennt den Wurf und nicht den Ertrag', () => {
    const before = auftakt(['p1', 'p2', 'p3']);
    const action: GameAction = { type: 'rollDice', player: 'p1' };
    const after = apply(before, action);

    const text = describeTransition(before, action, after, seats);

    expect(text).toContain('Auftakt');
    expect(text).toContain(String(yieldTotal(after.rules.dice, after.lastRoll!)));
  });

  it('sagt, wer beginnt, sobald es entschieden ist', () => {
    let state = auftakt(['p1', 'p2', 'p3']);
    let text = '';

    for (const player of ['p1', 'p2', 'p3']) {
      const action: GameAction = { type: 'rollDice', player };
      const after = apply(state, action);
      text = describeTransition(state, action, after, seats);
      state = after;
    }

    // Entweder ist entschieden oder es wird gestochen - der Satz muss beides
    // sagen koennen, sonst steht am Ende einer Runde nur eine nackte Zahl.
    expect(text).toMatch(/beginnt|Stechen/);
  });
});
