import { useEffect, useState } from 'react';

/**
 * Ob dieses Geraet mit dem Finger bedient wird - Handy oder Tablet.
 *
 * **Warum diese Abfrage und nicht `ontouchstart`.** Ein Touchscreen sagt nur,
 * dass das Geraet einen hat; ein Laptop mit Touchscreen wird trotzdem mit dem
 * Trackpad bedient. Gefragt ist der *Zeiger, mit dem gearbeitet wird*, und
 * genau darauf antworten diese zwei Merkmale: `pointer: coarse` heisst „der
 * Hauptzeiger ist ungenau" (eine Fingerkuppe misst 44 px, ein Mauszeiger
 * einen), `hover: none` heisst „er kann nicht schweben" - ein Finger liegt auf
 * dem Glas oder nicht, ein Dazwischen gibt es nicht. Beides zusammen trifft
 * Handy und Tablet und laesst jeden Schreibtisch aus, auch den mit Touchscreen.
 *
 * Als Haken und nicht als einmalige Abfrage, weil die Antwort sich waehrend
 * einer Partie aendern kann: ein Tablet, an das eine Maus geht, ist ab diesem
 * Moment ein Schreibtisch.
 *
 * Im Zweifel `false` - dieselbe Vorsicht wie in `useSettledRoll`: wo es kein
 * `matchMedia` gibt (node, jsdom), wird nicht geraten, sondern der Weg ohne
 * Sonderbehandlung genommen.
 */
const COARSE = '(hover: none) and (pointer: coarse)';

export function coarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(COARSE).matches;
}

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(coarsePointer);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(COARSE);
    const onChange = (): void => setCoarse(query.matches);

    // Einmal von Hand: zwischen dem ersten Rendern und diesem Effekt kann sich
    // die Antwort geaendert haben, und ein `change` dafuer gab es nicht.
    onChange();

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return coarse;
}
