import { z } from 'zod';

/**
 * Die Wuerfel eines Regelwerks - als Daten, nicht als Zahl im Code.
 *
 * Bis hierher stand "zwei Sechsseitige" an drei Stellen gleichzeitig: als Tupel
 * im Zustand, als zwei Ziehungen im Reducer, als zwei Kaestchen im Browser. Eine
 * Erweiterung, die einen dritten Wuerfel mitbringt (das Ereignis in Staedte &
 * Ritter ist der naheliegende Fall), muesste alle drei finden. Steht die
 * Wuerfelschale dagegen im RuleSet, ist so eine Variante ein zweites RuleSet und
 * kein zweiter Codepfad - genau die Form, die Regel 5 fuer Baukosten und
 * Vorraete schon vorgibt.
 *
 * Bewusst NICHT hier: was ein Wuerfel *ausloest*. Ein Ereigniswuerfel bringt
 * eigene Regeln mit, und die gehoeren in die Erweiterung, die ihn einfuehrt -
 * nicht als leeres Fach in ein Schema, das heute niemand fuellt.
 */

export const DieSpecSchema = z.object({
  /** Stabiler Bezeichner, etwa `"first"`. Steht spaeter im Wurf. */
  id: z.string().min(1),
  /** Wie viele Seiten. Sechs im Basisspiel; die Oberflaeche zeigt bis sechs Augen. */
  faces: z.number().int().min(2),
  /**
   * Ob dieser Wuerfel in die Ertragszahl eingeht.
   *
   * Die Unterscheidung ist der eigentliche Grund fuer diese Datei: ein
   * Ereigniswuerfel faellt mit, zaehlt aber nicht mit. Ohne das Feld muesste
   * `yieldTotal` wissen, welche Wuerfel es gibt - und waere damit wieder die
   * Stelle, die jede Erweiterung anfassen muss.
   */
  countsTowardYield: z.boolean(),
});

export type DieSpec = z.infer<typeof DieSpecSchema>;

export const DiceSpecSchema = z.array(DieSpecSchema).min(1);

export type DiceSpec = z.infer<typeof DiceSpecSchema>;

/**
 * Die zwei Sechsseitigen des Basisspiels.
 *
 * Zwei einzelne Wuerfel und nicht eine Zahl von 2 bis 12: die Summe zweier
 * Wuerfel ist nicht gleichverteilt, und auf genau dieser Glockenkurve steht die
 * Zahlenverteilung des Bretts.
 */
export const CLASSIC_DICE: DiceSpec = [
  { id: 'first', faces: 6, countsTowardYield: true },
  { id: 'second', faces: 6, countsTowardYield: true },
];
