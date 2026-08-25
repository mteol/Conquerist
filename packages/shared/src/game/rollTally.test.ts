import { describe, expect, it } from 'vitest';

import { createRng } from '../random/index.js';
import { CLASSIC_RULES } from '../rules/index.js';
import { yieldTotal } from './dice.js';
import { testGame } from './fixtures.js';
import { reduce } from './reducer.js';
import { playerViewOf } from './playerView.js';
import { GameStateSchema, type GameState } from './state.js';

/**
 * Welche Zahl wie oft fiel.
 *
 * Die Zaehlung ist kein Protokoll, sondern eine Summe: sie beantwortet genau
 * eine Frage ("war das Brett fair") und traegt keine Reihenfolge. Ein
 * vollstaendiges Wurfprotokoll waere ein zweites Log und muesste bei jeder
 * Partie mitwachsen.
 *
 * Sie entsteht im Reducer und nirgends sonst - damit reproduziert `replay`
 * dieselbe Zaehlung aus derselben Aktionsfolge (Regel 2).
 */

/** Ein Zustand, dessen naechster Wurf diese Summe ergibt. */
function about(total: number): GameState {
  for (let i = 0; i < 500; i += 1) {
    const state = testGame({ phase: { kind: 'rollPending' }, rng: createRng(`zaehl-${i}`) });
    const result = reduce(state, { type: 'rollDice', player: 'p1' });
    if (result.ok && result.state.lastRoll !== null) {
      if (yieldTotal(CLASSIC_RULES.dice, result.state.lastRoll) === total) return state;
    }
  }
  throw new Error(`Kein Zustand mit Wurfsumme ${total} gefunden`);
}

describe('Wurfzaehlung', () => {
  it('faengt bei nichts an', () => {
    expect(testGame().rollTally).toEqual({});
  });

  it('erhoeht genau die gewuerfelte Zahl', () => {
    const result = reduce(about(6), { type: 'rollDice', player: 'p1' });
    if (!result.ok) throw new Error(result.error.message);

    expect(result.state.rollTally['6']).toBe(1);
    expect(result.state.rollTally['5']).toBeUndefined();
  });

  it('zaehlt denselben Wurf zweimal auf zwei', () => {
    const start = about(8);
    const first = reduce(start, { type: 'rollDice', player: 'p1' });
    if (!first.ok) throw new Error(first.error.message);

    // Denselben Zufallszustand noch einmal einsetzen: derselbe Wurf faellt wieder.
    const again = reduce(
      { ...first.state, phase: { kind: 'rollPending' }, rng: start.rng },
      { type: 'rollDice', player: 'p1' },
    );
    if (!again.ok) throw new Error(again.error.message);

    expect(again.state.rollTally['8']).toBe(2);
  });

  /*
   * Der Auftakt bestimmt die Sitzreihenfolge, nicht die Ertraege. Seine Wuerfe
   * gehoeren nicht in eine Statistik ueber die Partie - sonst begaenne jede
   * Auswertung mit drei bis sechs Zahlen, die nie ein Feld bedient haben.
   */
  it('zaehlt Auftaktwuerfe nicht mit', () => {
    const opening = testGame({
      phase: { kind: 'opening', rolls: {}, pending: ['p1', 'p2', 'p3'], round: 1 },
    });

    const result = reduce(opening, { type: 'rollDice', player: 'p1' });
    if (!result.ok) throw new Error(result.error.message);

    expect(result.state.lastRoll).not.toBeNull();
    expect(result.state.rollTally).toEqual({});
  });

  /*
   * Gespeichert wird nur der Startzustand; alles andere entsteht beim Replay.
   * Ein Pflichtfeld ohne Vorgabe liesse jede bestehende Partie am Schema
   * scheitern - und ein Raum, der nicht parst, ist ein verlorener Raum.
   */
  it('laesst einen gespeicherten Stand ohne Zaehlung durch', () => {
    const { rollTally: _weg, ...ohne } = testGame();

    const parsed = GameStateSchema.safeParse(JSON.parse(JSON.stringify(ohne)));

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.rollTally).toEqual({});
  });
});

/*
 * Die Zaehlung ist offenes Material - die Wuerfel fielen vor allen Augen. Es
 * gibt daran nichts zu redigieren, und ohne sie in der Sicht koennte der
 * Endbildschirm sie nicht zeigen.
 */
describe('Wurfzaehlung in der Spielersicht', () => {
  it('erreicht jeden Spieler unveraendert', () => {
    const rolled = reduce(about(9), { type: 'rollDice', player: 'p1' });
    if (!rolled.ok) throw new Error(rolled.error.message);

    const seats = rolled.state.players.map((player) => ({
      id: player.id,
      name: player.id,
      color: 'rot',
    }));

    for (const seat of seats) {
      const view = playerViewOf(rolled.state, seat.id, seats, 1);
      expect(view.rollTally).toEqual(rolled.state.rollTally);
    }
  });
});
