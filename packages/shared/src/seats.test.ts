import { describe, expect, it } from 'vitest';
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, seatColorAt } from './seats.js';

describe('Sitzfarben', () => {
  it('haelt fuer jede erlaubte Tischgroesse eine eigene Farbe bereit', () => {
    expect(SEAT_COLORS).toHaveLength(MAX_SEATS);
    expect(new Set(SEAT_COLORS).size).toBe(MAX_SEATS);
    expect(MIN_SEATS).toBeLessThan(MAX_SEATS);
  });

  it('vergibt die Farben der Reihe nach', () => {
    expect(seatColorAt(0)).toBe(SEAT_COLORS[0]);
    expect(seatColorAt(MAX_SEATS - 1)).toBe(SEAT_COLORS[MAX_SEATS - 1]);
  });

  it('weist einen Platz ausserhalb des Tisches zurueck', () => {
    expect(() => seatColorAt(-1)).toThrow(RangeError);
    expect(() => seatColorAt(MAX_SEATS)).toThrow(RangeError);
  });
});
