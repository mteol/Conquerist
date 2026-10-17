/**
 * Was zwei Wuerfel hergeben - fuer die Augen unter den Zahlenchips und die
 * Verteilung im Endstand.
 *
 * **Eine Stelle statt zwei.** Die Punktreihe auf dem Chip stand bis hierher als
 * Tabelle in `BoardSvg`; der Endstand braucht dieselbe Zahl fuer seine
 * Erwartung. Zwei Tabellen derselben Wahrscheinlichkeit laufen beim ersten
 * Tippfehler auseinander, und dann sagt das Brett etwas anderes als die
 * Abrechnung. Das ist keine Spielregel, sondern Abzaehlen: wie viele der 36
 * Paare ergeben diese Summe.
 */

/** Alle Summen, die zwei Wuerfel hergeben. */
export const DICE_TOTALS: readonly number[] = Array.from({ length: 11 }, (_, index) => index + 2);

/** Wie viele der 36 Wuerfelpaare diese Summe ergeben (die Sieben: sechs). */
export function waysOf(total: number): number {
  if (!Number.isInteger(total) || total < 2 || total > 12) return 0;
  return 6 - Math.abs(7 - total);
}

/**
 * Wie oft eine Summe bei so vielen Wuerfen zu erwarten war: n * Wege / 36.
 *
 * Kein Rundungsschritt - die Marke im Endstand sitzt auf dem echten Wert, und
 * 12,5 Erwartete sind etwas anderes als 12 oder 13.
 */
export function expectedCount(total: number, rolls: number): number {
  return (rolls * waysOf(total)) / 36;
}

/**
 * Die Summen, die am haeufigsten Ertrag bringen - und deshalb rot stehen.
 *
 * Die Sieben faellt oefter, bringt aber nie Ertrag: auf ihr liegt kein Chip.
 * Heiss ist deshalb die hoechste Wahrscheinlichkeit **ohne** sie, und das ist
 * aus der Wuerfelschale abgeleitet statt als `6 || 8` geschrieben.
 */
const HOTTEST = Math.max(...DICE_TOTALS.filter((total) => total !== 7).map(waysOf));

export function isHotTotal(total: number): boolean {
  return total !== 7 && waysOf(total) === HOTTEST;
}
