import { useMemo, type CSSProperties, type JSX } from 'react';
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
 * **Die eine Bewegung.** Wenn die Wortmarke einrastet, laeuft einmal eine Welle
 * vom Zentrum nach aussen - jedes Hex hellt kurz auf und faellt zurueck. Das
 * ist der Aufprall und sonst nichts: das Feld driftet nicht, atmet nicht und
 * folgt keinem Mauszeiger. Ein driftendes Raster erklaert keinen
 * Zustandswechsel und faellt unter Regel 5; ein Aufprall, den man sieht, ist
 * der Zustandswechsel.
 *
 * Der Abstand zur Mitte steuert alles drei - wie deutlich ein Hex in Ruhe ist,
 * wann die Welle es erreicht, und wie weit sie es hebt. Alles aus derselben
 * Zahl, damit es nicht zwei Vorstellungen davon gibt, wo die Mitte liegt.
 *
 * Das Heben rechnet sich `index.css` selbst aus der Ruhelage aus (ein Anteil
 * davon, kein fester Betrag - sonst wuerde die Welle nach aussen lauter statt
 * leiser). Hier steht deshalb nur `--rest`; eine zweite Zahl dafuer waere
 * dieselbe Auskunft ein zweites Mal.
 */

/** Wie weit das Feld reicht, in Ringen um die Mitte. Sechs fuellen jeden Bildschirm. */
const RINGS = 6;

/**
 * Wann die Welle losgeht - genau dann, wenn die Wortmarke einrastet.
 *
 * Die Zahl steht auch in `index.css` am Einrasten der Marke. Sie hier zu
 * verdoppeln ist der Preis dafuer, dass die Verzoegerung je Hex gerechnet
 * werden muss; eine CSS-Variable koennte `animation-delay` nicht pro Element
 * aus dem Abstand ableiten.
 */
const IMPACT_MS = 200;

/** Wie lange die Welle vom Zentrum bis zum Rand braucht. */
const TRAVEL_MS = 280;

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
  const paths = useMemo(() => {
    const hexes = fieldOf(RINGS).map((hex) => {
      const center = hexCenter(hex);
      const points = hexCorners(hex)
        .map((corner) => `${corner.x.toFixed(4)},${corner.y.toFixed(4)}`)
        .join(' ');

      return { key: `${hex.q},${hex.r}`, points, distance: Math.hypot(center.x, center.y) };
    });

    const reach = Math.max(...hexes.map((entry) => entry.distance), 1);

    return hexes.map((entry) => {
      const share = entry.distance / reach;

      return {
        key: entry.key,
        points: entry.points,
        // Die Entfernung zur Mitte steuert, wie deutlich ein Hex noch ist:
        // aussen verliert sich das Feld, statt an einer Kante aufzuhoeren.
        // Die Ruhelage steht als Variable am Element, weil die Welle sie
        // braucht - sie beginnt und endet dort, wo das Hex ohnehin liegt.
        rest: Math.max(0.06, 0.4 - share * 0.36),
        delay: IMPACT_MS + share * TRAVEL_MS,
      };
    });
  }, []);

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
          style={
            {
              '--rest': entry.rest.toFixed(3),
              animationDelay: `${entry.delay.toFixed(0)}ms`,
            } as CSSProperties
          }
        />
      ))}
    </svg>
  );
}
