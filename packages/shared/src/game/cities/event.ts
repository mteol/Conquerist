import type { Roll } from '../dice.js';

/**
 * Der Ereigniswuerfel und der rote Augenwuerfel.
 *
 * Hier steht, was ein Wuerfel **bedeutet** - `rules/dice.ts` schliesst im
 * Kopfkommentar ausdruecklich aus, dass es dort steht. Die Wuerfelschale
 * beschreibt, was faellt; diese Datei, was daraus folgt.
 */

/** Die Id des Ereigniswuerfels in `CITIES_DICE`. */
export const EVENT_DIE = 'event';

/**
 * Die Id des roten Augenwuerfels.
 *
 * Kein eigener Wuerfel und keine Umbenennung: gespeicherte Wuerfe tragen
 * `first` und `second`, und eine dritte Id machte jeden davon unlesbar. Rot
 * ist eine Farbe auf dem Tisch, keine Eigenschaft der Zufallsziehung.
 */
export const PROGRESS_DIE = 'second';

/** Was eine Seite des Ereigniswuerfels zeigt. */
export type EventFace = 'ship' | 'trade' | 'politics' | 'science';

/**
 * Seite 1 bis 6: drei Schiffe, drei Stadttore.
 *
 * Die Reihenfolge ist Teil der Zusage - derselbe Seed muss dieselbe Partie
 * ergeben, und die Seite folgt aus der gezogenen Augenzahl. Wer sie umstellt,
 * spielt jede gespeicherte Partie anders nach.
 */
export const EVENT_FACES: readonly EventFace[] = [
  'ship',
  'ship',
  'ship',
  'trade',
  'politics',
  'science',
];

/**
 * Was der Ereigniswuerfel in diesem Wurf zeigte.
 *
 * `null`, wenn keiner dabei war - ein Wurf aus einer Basispartie soll lesbar
 * bleiben und nicht in eine erfundene Seite gedeutet werden. Dieselbe Haltung
 * wie `yieldTotal`, das ueberliest, was die Schale nicht kennt.
 */
export function eventFaceOf(roll: Roll): EventFace | null {
  const result = roll.find((entry) => entry.die === EVENT_DIE);
  if (result === undefined) return null;
  return EVENT_FACES[result.value - 1] ?? null;
}

/** Die Augenzahl des roten Wuerfels - `null`, wenn er fehlte. */
export function progressValueOf(roll: Roll): number | null {
  return roll.find((entry) => entry.die === PROGRESS_DIE)?.value ?? null;
}
