import { describe, expect, it } from 'vitest';

import { createRng } from '../random/index.js';
import { CLASSIC_RULES } from '../rules/index.js';
import { yieldTotal } from './dice.js';
import { TEST_PLAYERS, testGame } from './fixtures.js';
import { applyOpeningRoll, highestRollers, rotateToFirst } from './opening.js';

/** Ein Streifen fester Saaten - genug, damit der Gleichstand sicher vorkommt. */
const SAATEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];

/** Ein Zustand im Auftakt: alle drei warten, nichts ist gefallen. */
function inOpening() {
  return testGame({
    phase: { kind: 'opening', rolls: {}, pending: [...TEST_PLAYERS], round: 0 },
    turn: 0,
  });
}

describe('highestRollers', () => {
  it('nennt den Hoechsten', () => {
    const rolls = {
      p1: [
        { die: 'first', value: 3 },
        { die: 'second', value: 2 },
      ],
      p2: [
        { die: 'first', value: 6 },
        { die: 'second', value: 4 },
      ],
      p3: [
        { die: 'first', value: 1 },
        { die: 'second', value: 1 },
      ],
    };

    expect(highestRollers(inOpening(), rolls)).toEqual(['p2']);
  });

  it('nennt bei Gleichstand alle Gleichen in Sitzreihenfolge', () => {
    const rolls = {
      p1: [
        { die: 'first', value: 5 },
        { die: 'second', value: 4 },
      ],
      p2: [
        { die: 'first', value: 2 },
        { die: 'second', value: 1 },
      ],
      p3: [
        { die: 'first', value: 6 },
        { die: 'second', value: 3 },
      ],
    };

    expect(highestRollers(inOpening(), rolls)).toEqual(['p1', 'p3']);
  });

  it('uebergeht, wer in dieser Runde nicht geworfen hat', () => {
    // Im Stechen wirft nur, wer gleichauf lag. Die uebrigen duerfen nicht
    // dadurch gewinnen, dass ihr fehlender Wurf als Null zaehlt.
    const rolls = {
      p2: [
        { die: 'first', value: 1 },
        { die: 'second', value: 1 },
      ],
    };

    expect(highestRollers(inOpening(), rolls)).toEqual(['p2']);
  });
});

describe('rotateToFirst', () => {
  it('dreht die Liste, ohne jemanden zu verlieren', () => {
    const state = inOpening();
    const rotated = rotateToFirst(state.players, 'p3');

    expect(rotated.map((player) => player.id)).toEqual(['p3', 'p1', 'p2']);
    expect(rotated).toHaveLength(state.players.length);
  });

  it('laesst die Liste stehen, wenn der Sieger schon vorn sitzt', () => {
    expect(rotateToFirst(inOpening().players, 'p1').map((player) => player.id)).toEqual([
      ...TEST_PLAYERS,
    ]);
  });

  it('wirft, wenn der Sieger nicht am Tisch sitzt', () => {
    expect(() => rotateToFirst(inOpening().players, 'p9')).toThrow(RangeError);
  });
});

describe('applyOpeningRoll', () => {
  it('schreibt den Wurf und nimmt den Werfer aus der Warteschlange', () => {
    const result = applyOpeningRoll(inOpening());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toMatchObject({ kind: 'opening', pending: ['p2', 'p3'], round: 0 });
    if (result.state.phase.kind !== 'opening') return;
    expect(result.state.phase.rolls['p1']).toBeDefined();
  });

  it('legt den Wurf auf lastRoll, damit die Wuerfel fliegen koennen', () => {
    const result = applyOpeningRoll(inOpening());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRoll).toHaveLength(CLASSIC_RULES.dice.length);
  });

  it('verbraucht den Zufall, statt zweimal dasselbe zu wuerfeln', () => {
    const result = applyOpeningRoll(inOpening());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.rng).not.toEqual(inOpening().rng);
  });

  it('verteilt im Auftakt keinen Ertrag', () => {
    const result = applyOpeningRoll(inOpening());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.map((player) => player.resources)).toEqual(
      inOpening().players.map((player) => player.resources),
    );
  });

  it('entscheidet, sobald die Runde vollstaendig ist', () => {
    // Deterministisch ohne Seed-Raterei: wir wuerfeln die Runde durch und
    // rechnen aus den gefallenen Wuerfeln nach, was herauskommen musste.
    let state = inOpening();
    const totals = new Map<string, number>();

    for (const player of TEST_PLAYERS) {
      const result = applyOpeningRoll(state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      totals.set(player, yieldTotal(state.rules.dice, state.lastRoll ?? []));
    }

    const best = Math.max(...totals.values());
    const winners = TEST_PLAYERS.filter((id) => totals.get(id) === best);

    if (winners.length === 1) {
      expect(state.phase).toEqual({ kind: 'setup', placement: 0, settlement: null });
      expect(state.players[0]?.id).toBe(winners[0]);
      expect(state.currentPlayerIndex).toBe(0);
    } else {
      expect(state.phase).toEqual({ kind: 'opening', rolls: {}, pending: winners, round: 1 });
    }
  });

  it('behaelt alle Spieler, wenn es entschieden ist', () => {
    let state = inOpening();
    for (const _player of TEST_PLAYERS) {
      const result = applyOpeningRoll(state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }

    expect([...state.players].map((player) => player.id).sort()).toEqual([...TEST_PLAYERS].sort());
  });

  it('laesst bei Gleichstand nur die Gleichen noch einmal werfen', () => {
    // Ueber echte Wuerfel ist der Gleichstand nur mit Glueck zu treffen, und
    // ein Zweig, den die Pruefung nur manchmal betritt, ist ungeprueft. Also
    // eine zweiseitige Schale (weniger als zwei Seiten laesst das RuleSet nicht
    // zu) und ein Streifen fester Saaten: bestimmt, und die letzte Zeile haelt
    // fest, dass wirklich mindestens einmal gestochen wurde.
    const zweiseitig = {
      ...CLASSIC_RULES,
      dice: [{ id: 'first', faces: 2, countsTowardYield: true }],
    };
    let stechen = 0;

    for (const saat of SAATEN) {
      let state = testGame({
        rules: zweiseitig,
        rng: createRng(saat),
        phase: { kind: 'opening', rolls: {}, pending: [...TEST_PLAYERS], round: 0 },
        turn: 0,
      });
      const totals = new Map<string, number>();

      for (const player of TEST_PLAYERS) {
        const result = applyOpeningRoll(state);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        state = result.state;
        totals.set(player, yieldTotal(state.rules.dice, state.lastRoll ?? []));
      }

      const best = Math.max(...totals.values());
      const gleiche = TEST_PLAYERS.filter((id) => totals.get(id) === best);

      if (gleiche.length > 1) {
        stechen += 1;
        expect(state.phase).toEqual({ kind: 'opening', rolls: {}, pending: gleiche, round: 1 });
      } else {
        expect(state.phase).toEqual({ kind: 'setup', placement: 0, settlement: null });
      }
    }

    expect(stechen).toBeGreaterThan(0);
  });

  it('stichst so lange, bis einer vorn liegt', () => {
    // Dass das Stechen ein Ende hat, ist keine Selbstverstaendlichkeit: es
    // wiederholt sich, solange die Gleichen gleich bleiben.
    const zweiseitig = {
      ...CLASSIC_RULES,
      dice: [{ id: 'first', faces: 2, countsTowardYield: true }],
    };

    for (const saat of SAATEN) {
      let state = testGame({
        rules: zweiseitig,
        rng: createRng(saat),
        phase: { kind: 'opening', rolls: {}, pending: [...TEST_PLAYERS], round: 0 },
        turn: 0,
      });

      for (let wurf = 0; wurf < 200 && state.phase.kind === 'opening'; wurf += 1) {
        const result = applyOpeningRoll(state);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        state = result.state;
      }

      expect(state.phase).toEqual({ kind: 'setup', placement: 0, settlement: null });
    }
  });

  it('wirft, wenn der Zustand gar nicht im Auftakt steht', () => {
    // Ein Programmierfehler und kein Spielzug - deshalb eine Ausnahme und kein
    // `rejected`, wie bei `playerAt`.
    expect(() => applyOpeningRoll(testGame())).toThrow(RangeError);
  });

  it('wirft, wenn im Auftakt niemand mehr wartet', () => {
    const state = testGame({
      phase: { kind: 'opening', rolls: {}, pending: [], round: 0 },
      turn: 0,
    });

    expect(() => applyOpeningRoll(state)).toThrow(RangeError);
  });
});
