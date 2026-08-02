import { useMemo, type JSX } from 'react';
import type { Hex } from '@conquerist/shared';
import { hexCenter, hexCorners } from '../board/layout';

/**
 * Der Hintergrund des Hauptmenues: das Hexfeld selbst.
 *
 * **Kein Muster und keine Textur** - gezeichnet mit `hexCenter` und
 * `hexCorners`, also denselben Funktionen, die im Spiel das Brett setzen. Das
 * Menue sitzt damit auf genau dem Raster, auf dem gleich gespielt wird, und
 * nicht auf einer Grafik, die so aehnlich aussieht. Wer die Geometrie aendert,
 * aendert beides mit.
 *
 * Nur Umrisse, keine Flaechen: der Hintergrund traegt keine Information und
 * darf deshalb nichts behaupten. Was leuchtet, sind die drei Eintraege davor.
 *
 * **Ohne Bewegung.** Ein driftendes Raster erklaert keinen Zustandswechsel und
 * faellt damit unter Regel 5 - es waere genau die Dekoration, die der
 * Design-Abschnitt ausschliesst.
 */

/** Wie weit das Feld reicht, in Ringen um die Mitte. Sechs fuellen jeden Bildschirm. */
const RINGS = 6;

/** Alle Hexe bis zu diesem Abstand von der Mitte - die uebliche Ringformel. */
function fieldOf(rings: number): Hex[] {
  const hexes: Hex[] = [];

  for (let q = -rings; q <= rings; q += 1) {
    const from = Math.max(-rings, -q - rings);
    const to = Math.min(rings, -q + rings);
    for (let r = from; r <= to; r += 1) hexes.push({ q, r });
  }

  return hexes;
}

export function HexField(): JSX.Element {
  const paths = useMemo(
    () =>
      fieldOf(RINGS).map((hex) => {
        const center = hexCenter(hex);
        const points = hexCorners(hex)
          .map((corner) => `${corner.x.toFixed(4)},${corner.y.toFixed(4)}`)
          .join(' ');

        // Die Entfernung zur Mitte steuert, wie deutlich ein Hex noch ist:
        // aussen verliert sich das Feld, statt an einer Kante aufzuhoeren.
        const distance = Math.hypot(center.x, center.y);
        return { key: `${hex.q},${hex.r}`, points, distance };
      }),
    [],
  );

  const reach = Math.max(...paths.map((entry) => entry.distance), 1);

  return (
    <svg
      className="hexfield"
      viewBox={`${-RINGS * 1.9} ${-RINGS * 1.9} ${RINGS * 3.8} ${RINGS * 3.8}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {paths.map((entry) => (
        <polygon
          key={entry.key}
          points={entry.points}
          style={{ opacity: Math.max(0.06, 0.4 - (entry.distance / reach) * 0.36) }}
        />
      ))}
    </svg>
  );
}
