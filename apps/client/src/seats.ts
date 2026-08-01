import type { PlayerId } from '@conquerist/shared';

/**
 * Ein Sitz am Tisch: Id, Name, Farbe.
 *
 * `PlayerState` in `shared` kennt nur `id`, `resources` und `piecesLeft` - wie
 * ein Spieler heisst, ist keine Regelfrage. Deshalb fuehrt der Client diese
 * Liste selbst und uebergibt `createGame` nur die Ids. Ab Etappe 4 wird aus der
 * Id eine `user_id` (Regel 7), ohne dass sich an der Logik etwas aendert.
 */
export interface Seat {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
}

/** Kleinste und groesste Tischgroesse ueber beide Bretter. */
export const MIN_SEATS = 3;
export const MAX_SEATS = 6;

/**
 * Sechs unterscheidbare Farben - so viele, wie `classic56` Spieler traegt.
 *
 * Ausgewaehlt auf Unterscheidbarkeit auch bei Rot-Gruen-Schwaeche: die Paare
 * Rot/Gruen und Blau/Violett trennen sich zusaetzlich in der Helligkeit.
 */
export const SEAT_COLORS: readonly string[] = [
  '#c0392b',
  '#2c6fbb',
  '#e08a2e',
  '#3f8f5b',
  '#8e5bb5',
  '#d8d3c7',
];

/** Standardbesetzung: durchnummerierte Ids, Namen und die Farben der Reihe nach. */
export function defaultSeats(count: number): Seat[] {
  if (!Number.isInteger(count) || count < MIN_SEATS || count > MAX_SEATS) {
    throw new RangeError(
      `defaultSeats: ${MIN_SEATS} bis ${MAX_SEATS} Spieler, angefragt waren ${count}`,
    );
  }

  return Array.from({ length: count }, (_unused, index) => ({
    id: `p${index + 1}`,
    name: `Spieler ${index + 1}`,
    color: SEAT_COLORS[index]!,
  }));
}

/** Nachschlagetabelle Id -> Sitz. */
export function seatsById(seats: readonly Seat[]): ReadonlyMap<PlayerId, Seat> {
  return new Map(seats.map((seat) => [seat.id, seat]));
}
