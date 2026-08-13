import type { PlayerId } from './game/player.js';

/**
 * Ein Sitz am Tisch: Id, Name, Farbe.
 *
 * Stand bis Etappe 3 im Client, weil nur er Namen kannte. Ab Etappe 4 vergibt
 * der Server die Farben in der Reihenfolge des Beitritts und schickt sie in
 * jeder `PlayerView` mit - also braucht die Palette einen Ort, den beide
 * Seiten sehen. Eine Kopie im Client waere die zweite Wahrheit, die beim
 * ersten Farbtausch auseinanderlaeuft.
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
 * Rot/Gruen und Blau/Violett trennen sich zusaetzlich in der Helligkeit. Farbe
 * traegt eine Zuordnung nie allein - am Tisch steht immer auch der Name.
 */
export const SEAT_COLORS: readonly string[] = [
  '#c0392b',
  '#2c6fbb',
  '#e08a2e',
  '#3f8f5b',
  '#8e5bb5',
  '#d8d3c7',
];

/** Die Farbe fuer den n-ten Platz am Tisch. */
export function seatColorAt(index: number): string {
  const color = SEAT_COLORS[index];
  if (color === undefined) {
    throw new RangeError(`seatColorAt: Platz ${index} gibt es an diesem Tisch nicht`);
  }
  return color;
}
