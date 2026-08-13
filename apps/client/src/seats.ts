import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, seatColorAt, type Seat } from '@conquerist/shared';
import type { PlayerId } from '@conquerist/shared';

/**
 * Sitze im Client.
 *
 * Typ und Palette stehen seit Etappe 4 in `shared`, weil der Server die Farben
 * vergibt. Hier bleibt nur, was ausschliesslich die lokale Partie braucht: eine
 * Standardbesetzung und eine Nachschlagetabelle.
 */
export { MAX_SEATS, MIN_SEATS, SEAT_COLORS, seatColorAt };
export type { Seat };

/** Standardbesetzung fuer die lokale Partie: durchnummerierte Ids und Namen. */
export function defaultSeats(count: number): Seat[] {
  if (!Number.isInteger(count) || count < MIN_SEATS || count > MAX_SEATS) {
    throw new RangeError(
      `defaultSeats: ${MIN_SEATS} bis ${MAX_SEATS} Spieler, angefragt waren ${count}`,
    );
  }

  return Array.from({ length: count }, (_unused, index) => ({
    id: `p${index + 1}`,
    name: `Spieler ${index + 1}`,
    color: seatColorAt(index),
  }));
}

/** Nachschlagetabelle Id -> Sitz. */
export function seatsById(seats: readonly Seat[]): ReadonlyMap<PlayerId, Seat> {
  return new Map(seats.map((seat) => [seat.id, seat]));
}
