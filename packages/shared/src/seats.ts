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

/**
 * Wie die sechs Farben heissen.
 *
 * Seit Etappe 10 sucht man sich seine Farbe im Wartebereich aus, und eine
 * Auswahl aus sechs Flecken laesst sich weder vorlesen noch benennen. Der Name
 * steht deshalb neben dem Fleck - Farbe traegt nie allein, was jemand sonst
 * nicht mitbekommt.
 *
 * Gleiche Reihenfolge wie `SEAT_COLORS`, und das ist die einzige Verbindung
 * zwischen beiden: eine Tabelle von Farbwert auf Namen waere ein zweiter Ort,
 * an dem jemand eine Farbe aendern koennte, ohne den Namen mitzuaendern.
 */
export const SEAT_COLOR_NAMES: readonly string[] = [
  'Rot',
  'Blau',
  'Orange',
  'Grün',
  'Violett',
  'Sand',
];

/** Die Farbe fuer den n-ten Platz am Tisch. */
export function seatColorAt(index: number): string {
  const color = SEAT_COLORS[index];
  if (color === undefined) {
    throw new RangeError(`seatColorAt: Platz ${index} gibt es an diesem Tisch nicht`);
  }
  return color;
}

/** Wie die Farbe an diesem Platz heisst - fuer Anzeige und Vorlesewerkzeuge. */
export function seatColorName(color: string): string {
  const index = SEAT_COLORS.indexOf(color);
  return SEAT_COLOR_NAMES[index] ?? color;
}

/**
 * Ob diese Farbe ueberhaupt eine Sitzfarbe ist.
 *
 * Der Server prueft damit, was ein Client als Wunschfarbe schickt. Ohne diese
 * Pruefung stuende in `room_seats.color` irgendwann eine Zeichenkette, die im
 * SVG nichts faerbt - und ein Spieler waere unsichtbar statt bunt.
 */
export function isSeatColor(color: string): boolean {
  return SEAT_COLORS.includes(color);
}
