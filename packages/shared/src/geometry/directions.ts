/**
 * Die sechs Nachbarrichtungen eines Hexfelds - als Index 0-5, nicht als
 * Himmelsrichtung.
 *
 * Bewusst ohne Namen wie `NORTH_EAST`: ob die Felder spitz oder flach oben
 * stehen, ist eine reine Darstellungsfrage und entscheidet sich in Etappe 3 am
 * SVG. Die Mathematik ist davon unberuehrt - Nachbarschaft, Distanz, Ringe und
 * die kanonischen Knoten- und Kanten-Ids sind in beiden Ausrichtungen
 * identisch, nur die Umrechnung in Pixel unterscheidet sich. Namen wuerden die
 * Entscheidung jetzt einbetonieren, in `shared` sichtbar machen und beim ersten
 * Blick aufs gerenderte Brett eine Umbenennung durch alle Dateien ausloesen.
 *
 * Die Reihenfolge ist nicht beliebig: Richtung `i` und `i + 1` sind selbst
 * benachbart, laufen also einmal im Kreis. Genau darauf beruht die Definition
 * der Ecken - Ecke `i` eines Felds ist der Punkt zwischen den Nachbarn `i` und
 * `i + 1`. Richtung `i + 3` ist die Gegenrichtung von `i`.
 *
 * ```
 *          ___
 *      2  /   \  1
 *        /     \
 *    3  (   H   )  0
 *        \     /
 *      4  \___/  5
 * ```
 * (Die Skizze zeigt die Anordnung, nicht die Ausrichtung des gerenderten
 * Felds - siehe oben.)
 */

import type { Hex } from './hex.js';

/** Axiale Verschiebung je Richtung. Reihenfolge = einmal im Kreis. */
export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

/** Anzahl der Richtungen - und damit auch der Ecken und Kanten je Feld. */
export const HEX_DIRECTION_COUNT = 6;

/**
 * Normalisiert einen Richtungsindex auf 0-5.
 *
 * Rechnet zyklisch, damit `direction + 1` beim Ableiten einer Ecke nicht
 * ueberlaeuft und `direction - 1` nicht negativ wird. `%` allein reicht dafuer
 * nicht: in JavaScript ist `-1 % 6` gleich `-1`.
 */
export function normalizeDirection(direction: number): number {
  if (!Number.isInteger(direction)) {
    throw new RangeError(`Richtung muss eine ganze Zahl sein, war ${direction}`);
  }
  return ((direction % HEX_DIRECTION_COUNT) + HEX_DIRECTION_COUNT) % HEX_DIRECTION_COUNT;
}
