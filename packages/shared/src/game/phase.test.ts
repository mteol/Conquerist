import { describe, expect, it } from 'vitest';

import { openingRoller, PhaseSchema, setupPlacementCount, setupPlayerIndex } from './phase.js';

describe('setupPlayerIndex', () => {
  it('laeuft die erste Runde vorwaerts und die zweite rueckwaerts', () => {
    const order = [0, 1, 2, 3, 4, 5].map((placement) => setupPlayerIndex(placement, 3));
    expect(order).toEqual([0, 1, 2, 2, 1, 0]);
  });

  it('gilt genauso fuer vier Spieler', () => {
    const order = [0, 1, 2, 3, 4, 5, 6, 7].map((placement) => setupPlayerIndex(placement, 4));
    expect(order).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
  });

  it('gibt jedem Spieler genau zwei Plaetze', () => {
    for (const players of [2, 3, 4, 5, 6]) {
      const counts = new Array<number>(players).fill(0);
      for (let placement = 0; placement < setupPlacementCount(players); placement += 1) {
        counts[setupPlayerIndex(placement, players)]! += 1;
      }
      expect(counts).toEqual(new Array<number>(players).fill(2));
    }
  });

  it('laesst den letzten Spieler zweimal hintereinander setzen', () => {
    // Der Ausgleich fuer die schlechtere erste Wahl - und der Grund, warum die
    // Reihenfolge eine Schlange ist und keine zweite Runde von vorn.
    expect(setupPlayerIndex(3, 4)).toBe(3);
    expect(setupPlayerIndex(4, 4)).toBe(3);
  });

  it('lehnt Plaetze ausserhalb der Gruendungsphase ab', () => {
    expect(() => setupPlayerIndex(8, 4)).toThrow(RangeError);
    expect(() => setupPlayerIndex(-1, 4)).toThrow(RangeError);
  });
});

describe('setupPlacementCount', () => {
  it('ist zweimal die Spielerzahl', () => {
    expect(setupPlacementCount(3)).toBe(6);
    expect(setupPlacementCount(6)).toBe(12);
  });
});

describe('PhaseSchema', () => {
  it('nimmt jede Phase an', () => {
    const phases = [
      { kind: 'setup', placement: 0, settlement: null },
      { kind: 'rollPending' },
      { kind: 'discardPending', pending: ['p1', 'p2'] },
      { kind: 'robberPending', resume: 'main' },
      { kind: 'main' },
      { kind: 'finished', winner: 'p1' },
    ];

    for (const phase of phases) {
      expect(PhaseSchema.safeParse(phase).success).toBe(true);
    }
  });

  it('lehnt eine unbekannte Phase ab', () => {
    expect(PhaseSchema.safeParse({ kind: 'trading' }).success).toBe(false);
  });

  it('verlangt zu jeder Phase ihre eigenen Angaben', () => {
    expect(PhaseSchema.safeParse({ kind: 'finished' }).success).toBe(false);
    expect(PhaseSchema.safeParse({ kind: 'discardPending' }).success).toBe(false);
    expect(PhaseSchema.safeParse({ kind: 'setup', placement: -1, settlement: null }).success).toBe(
      false,
    );
    expect(PhaseSchema.safeParse({ kind: 'setup', placement: 0 }).success).toBe(false);
  });
});

describe('die Auftaktphase', () => {
  it('nimmt Wuerfe, Warteschlange und Runde auf', () => {
    const phase = {
      kind: 'opening',
      rolls: {
        p1: [
          { die: 'first', value: 5 },
          { die: 'second', value: 4 },
        ],
      },
      pending: ['p2', 'p3'],
      round: 0,
    };

    expect(PhaseSchema.safeParse(phase).success).toBe(true);
  });

  it('lehnt eine negative Stechrunde ab', () => {
    expect(
      PhaseSchema.safeParse({ kind: 'opening', rolls: {}, pending: [], round: -1 }).success,
    ).toBe(false);
  });
});

describe('openingRoller', () => {
  it('nennt den Vordersten der Warteschlange', () => {
    expect(openingRoller({ kind: 'opening', rolls: {}, pending: ['p2', 'p3'], round: 0 })).toBe(
      'p2',
    );
  });

  it('gibt null zurueck, wenn die Runde vollstaendig ist', () => {
    // Der Fall, in dem ausgewertet wird - nicht der Fall, in dem jemand wartet.
    expect(openingRoller({ kind: 'opening', rolls: {}, pending: [], round: 0 })).toBeNull();
  });
});
