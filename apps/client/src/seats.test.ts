import { describe, expect, it } from 'vitest';
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, defaultSeats, seatsById } from './seats';

describe('Sitze', () => {
  it('haelt fuer jede erlaubte Tischgroesse eine eigene Farbe bereit', () => {
    expect(SEAT_COLORS).toHaveLength(MAX_SEATS);
    expect(new Set(SEAT_COLORS).size).toBe(MAX_SEATS);
  });

  it('vergibt eindeutige Ids und Farben', () => {
    const seats = defaultSeats(6);

    expect(seats).toHaveLength(6);
    expect(new Set(seats.map((seat) => seat.id)).size).toBe(6);
    expect(new Set(seats.map((seat) => seat.color)).size).toBe(6);
    expect(seats.map((seat) => seat.name)).toEqual([
      'Spieler 1',
      'Spieler 2',
      'Spieler 3',
      'Spieler 4',
      'Spieler 5',
      'Spieler 6',
    ]);
  });

  it('weist Tischgroessen ausserhalb der Grenzen zurueck', () => {
    expect(() => defaultSeats(MIN_SEATS - 1)).toThrow(RangeError);
    expect(() => defaultSeats(MAX_SEATS + 1)).toThrow(RangeError);
  });

  it('schlaegt Sitze ueber ihre Id nach', () => {
    const seats = defaultSeats(3);
    const map = seatsById(seats);

    expect(map.get(seats[1]!.id)?.name).toBe('Spieler 2');
    expect(map.get('unbekannt')).toBeUndefined();
  });
});
