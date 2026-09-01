import { useCallback, useMemo, useState } from 'react';

/**
 * Ein Zug, der erst fragt „was" und dann „wo".
 *
 * Bis 10c stand diese Form dreimal als eigenes `useState`-Feld im
 * `GameScreen`. Sie ist jedes Mal dieselbe: eine Absicht wird gemerkt, das
 * Brett zeigt Ziele, ein Klick schließt ab, Escape bricht ab.
 *
 * **Eine Absicht, nicht drei.** Der Grund, warum hier ein Haken steht und
 * nicht drei, ist keine Sparsamkeit: Bauwahl, Rittermodus und
 * Metropolenwahl schließen einander aus, und bis 10c trugen drei
 * handgeschriebene Setzer diesen Ausschluß, von denen jeder die beiden
 * anderen Felder leerte. Drei Haken wüßten nichts voneinander und hätten
 * dieselben sechs Zeilen zurückgebracht. Deshalb ist `TIntent` eine
 * unterschiedene Vereinigung über *alle* Absichten: ein Feld, ein Wert, und
 * der Ausschluß ist eine Sache des Typs statt eine der Sorgfalt. Die vierte
 * und fünfte Absicht kosten damit nichts.
 *
 * `TTargets` bleibt offen, weil die Ziele des Bretts keine Liste von Namen
 * sind, sondern Karten von Ort zu Aktion (siehe `targets.ts`) - und der Haken
 * hat keinen Grund, davon etwas zu wissen. Er reicht durch, was `targetsFor`
 * hergibt.
 */
export interface PickMode<TIntent, TTargets> {
  /** Was gerade gewählt ist - `null` heißt: das Brett ist ruhig. */
  readonly intent: TIntent | null;
  /** Eine Absicht fassen. Ersetzt die laufende, es gibt immer nur eine. */
  begin(intent: TIntent): void;
  /** Die Absicht fallenlassen. */
  cancel(): void;
  /** Die Ziele, die das Brett gerade hervorhebt. Leer, solange nichts gewählt ist. */
  readonly targets: TTargets;
}

/**
 * Die leeren Ziele, wenn der Aufrufer keine eigenen nennt.
 *
 * Was „leer" heißt, weiß nur er: eine leere Liste, eine leere Karte oder ein
 * ganzes `EMPTY_TARGETS`. Wer es nicht sagt, meint die leere Liste - das ist
 * der Fall, in dem `TTargets` schlicht `string[]` ist. Der Cast ist genau
 * diese Annahme und steht deshalb an einer einzigen Stelle.
 */
const NO_TARGETS: readonly never[] = [];

/**
 * Der Haken zu {@link PickMode}.
 *
 * @param targetsFor Was zu einer Absicht leuchtet.
 * @param nothing Was leuchtet, solange nichts gewählt ist.
 */
export function usePickMode<TIntent, TTargets>(
  targetsFor: (intent: TIntent) => TTargets,
  nothing: TTargets = NO_TARGETS as TTargets,
): PickMode<TIntent, TTargets> {
  const [intent, setIntent] = useState<TIntent | null>(null);

  /*
   * Die Setzerform (`() => next`) und nicht `setIntent(next)`: eine Absicht
   * darf alles sein, auch eine Funktion - und die hielte React für einen
   * Fortschreiber statt für den neuen Wert.
   */
  const begin = useCallback((next: TIntent) => setIntent(() => next), []);
  const cancel = useCallback(() => setIntent(null), []);

  const targets = useMemo(
    () => (intent === null ? nothing : targetsFor(intent)),
    [intent, targetsFor, nothing],
  );

  return useMemo(() => ({ intent, begin, cancel, targets }), [intent, begin, cancel, targets]);
}
