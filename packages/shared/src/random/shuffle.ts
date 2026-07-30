import type { Rng } from './prng.js';
import { nextInt } from './prng.js';

/**
 * Mischt eine Liste deterministisch (Fisher-Yates) und gibt den
 * weitergefuehrten Zufallszustand mit zurueck.
 *
 * Die Eingabe wird nicht veraendert - Regel 2 gilt auch fuer Hilfsfunktionen.
 * Der Aufrufer muss den zurueckgegebenen Zustand weiterfuehren, sonst mischt
 * der naechste Aufruf dieselbe Reihenfolge.
 *
 * Rueckwaerts durchlaufen und `nextInt` mit Rejection Sampling sind kein
 * Detail: das klassische `Math.floor(random() * (i + 1))` erzeugt eine leicht
 * verzerrte Verteilung, und bei 19 Gelaendeplaettchen ist das genau die Art
 * Fehler, die man im Spiel spuert und im Code nie sucht.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): readonly [shuffled: T[], next: Rng] {
  const result = [...items];

  // Nichts zu entscheiden - und damit auch kein Zufall zu verbrauchen.
  if (result.length < 2) return [result, rng];

  let current = rng;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const [j, next] = nextInt(current, i + 1);
    current = next;

    // `i` laeuft ueber die Liste, `j` liegt per Konstruktion in [0, i].
    // Die Ausrufezeichen betreffen die Indizes, nicht die Werte: eine Pruefung
    // auf `undefined` wuerde bei `T = string | undefined` den Tausch
    // stillschweigend ueberspringen und die Liste falsch mischen.
    const a = result[i]!;
    result[i] = result[j]!;
    result[j] = a;
  }

  return [result, current];
}
