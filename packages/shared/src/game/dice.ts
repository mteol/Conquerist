import { z } from 'zod';

import { nextInt, type Rng } from '../random/index.js';
import type { DiceSpec } from '../rules/index.js';

/**
 * Der Wurf: was die Wuerfelschale aus `rules.dice` gerade zeigt.
 *
 * Ein Wurf ist eine Liste und kein Zahlenpaar. Das ist der ganze Unterschied
 * zwischen "zwei Wuerfel" und "die Wuerfel dieses Regelwerks": eine Erweiterung
 * mit einem dritten Wuerfel bringt ihn in ihrem RuleSet mit, und Reducer,
 * Protokoll und Oberflaeche zaehlen weiter einfach ab, was da ist.
 *
 * Jedes Ergebnis nennt seinen Wuerfel. Ohne den Bezeichner waere die Reihenfolge
 * die einzige Zuordnung - und die erste Erweiterung, die einen Wuerfel
 * dazwischenschiebt, verschoebe stillschweigend die Bedeutung aller
 * gespeicherten Wuerfe.
 *
 * Wie ueberall gilt Regel 2: gewuerfelt wird aus dem uebergebenen
 * Zufallszustand, nie aus `Math.random()`. Derselbe Zustand, derselbe Wurf.
 */

export const DieResultSchema = z.object({
  /** Welcher Wuerfel - der `id` aus dem `DieSpec`. */
  die: z.string().min(1),
  /** Was oben liegt, ab 1 gezaehlt. */
  value: z.number().int().min(1),
});

export type DieResult = z.infer<typeof DieResultSchema>;

/** Ein vollstaendiger Wurf: je Wuerfel der Schale ein Ergebnis, in ihrer Reihenfolge. */
export const RollSchema = z.array(DieResultSchema);

export type Roll = z.infer<typeof RollSchema>;

/**
 * Wuerfelt die ganze Schale und gibt den verbrauchten Zufall zurueck.
 *
 * Jeder Wuerfel wird einzeln gezogen. Das ist kein Zierat: die Summe direkt zu
 * ziehen haette eine andere Verteilung, und auf der Glockenkurve zweier Wuerfel
 * steht die Zahlenverteilung des Bretts.
 */
export function rollAll(spec: DiceSpec, rng: Rng): readonly [roll: Roll, next: Rng] {
  const roll: DieResult[] = [];
  let current = rng;

  for (const die of spec) {
    const [index, next] = nextInt(current, die.faces);
    roll.push({ die: die.id, value: index + 1 });
    current = next;
  }

  return [roll, current];
}

/**
 * Die Zahl, die den Ertrag ausloest: die Summe der mitzaehlenden Wuerfel.
 *
 * Ein Ergebnis, dessen Wuerfel die Schale gar nicht kennt, zaehlt nicht mit -
 * so bleibt ein aelterer Wurf im Verlauf lesbar, auch wenn das Regelwerk
 * inzwischen anders wuerfelt.
 */
export function yieldTotal(spec: DiceSpec, roll: Roll): number {
  const counting = new Set(spec.filter((die) => die.countsTowardYield).map((die) => die.id));

  return roll.reduce((sum, result) => (counting.has(result.die) ? sum + result.value : sum), 0);
}
