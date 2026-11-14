import { useMemo, type CSSProperties, type JSX } from 'react';
import { rhumbLines, rhumbNode, type ChartPoint } from './rhumb';

/**
 * Die Seekarte - der Grund, auf dem alles liegt.
 *
 * Jeder Bildschirm steht auf derselben Karte: Titel, Wartebereich und Tisch.
 * Sie ist das Windstrahlennetz einer Portolankarte (`rhumb.ts`) mit **einer**
 * Windrose. Das Netz ist kein Muster: es ist die Konstruktion, auf der eine
 * solche Karte gezeichnet wurde, bevor Kuesten darauf kamen - und die Insel
 * des Bretts ist die Kueste.
 *
 * Die Karte traegt keine Information und bleibt deshalb leise (Designregel 4:
 * das Brett ist der Held). Die Striche sind 1 px breit, nie duenner: unter
 * einem Pixel zeichnet der Browser blasser statt feiner (`docs/design.md`).
 *
 * `--d` je Linie ist der Abstand ihrer Mitte vom Kartenmittelpunkt (0..1) -
 * die eine Zahl, an der eine Welle von innen nach aussen haengen kann.
 */

/** Radius des verborgenen Kreises in Karteneinheiten (die `viewBox` reicht bis 100). */
const RADIUS = 78;

/** Halbmesser der Windrose. */
const ROSE = 9.5;

export interface SeaChartProps {
  /**
   * Auf welchem der sechzehn Knoten die Windrose sitzt (0 = Norden, im
   * Uhrzeigersinn). Vorgabe ist der Westen: dort ist auf jedem Bildschirm See.
   */
  readonly roseAt?: number;
  readonly className?: string;
}

/**
 * Ein Strahl der Rose als zwei Haelften: eine gefuellt, eine nur umrissen.
 * So zeichnen die Karten ihre Rosen - der Strahl bekommt eine Licht- und eine
 * Schattenseite, ohne dass irgendwo ein Verlauf steht.
 */
function ray(angle: number, length: number, width: number): { lit: string; shade: string } {
  const tip = polar(angle, length);
  const left = polar(angle - Math.PI / 2, width);
  const right = polar(angle + Math.PI / 2, width);
  const p = (point: ChartPoint): string => `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  return {
    lit: `M0,0 L${p(left)} L${p(tip)} Z`,
    shade: `M0,0 L${p(right)} L${p(tip)} Z`,
  };
}

function polar(angle: number, radius: number): ChartPoint {
  return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius };
}

export function SeaChart({ roseAt = 12, className }: SeaChartProps): JSX.Element {
  const lines = useMemo(() => rhumbLines(RADIUS), []);
  const rose = rhumbNode(roseAt, RADIUS);

  const rays = useMemo(() => {
    const step = Math.PI / 8;
    return Array.from({ length: 16 }, (_, index) => {
      const cardinal = index % 4 === 0;
      const ordinal = index % 2 === 0;
      const length = cardinal ? ROSE : ordinal ? ROSE * 0.66 : ROSE * 0.4;
      const width = cardinal ? ROSE * 0.16 : ordinal ? ROSE * 0.13 : ROSE * 0.08;
      return { index, ...ray(index * step, length, width) };
    }).sort((a, b) => rankOrder(a.index) - rankOrder(b.index));
  }, []);

  return (
    <svg
      className={className === undefined ? 'seachart' : `seachart ${className}`}
      viewBox="-100 -100 200 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g className="seachart__net">
        {lines.map((line, index) => {
          const distance = Math.hypot((line.from.x + line.to.x) / 2, (line.from.y + line.to.y) / 2);
          return (
            <line
              key={index}
              className={`seachart__line seachart__line--${line.rank}`}
              style={{ '--d': (distance / RADIUS).toFixed(3) } as CSSProperties}
              x1={line.from.x.toFixed(3)}
              y1={line.from.y.toFixed(3)}
              x2={line.to.x.toFixed(3)}
              y2={line.to.y.toFixed(3)}
            />
          );
        })}
      </g>
      <g
        className="seachart__rose"
        transform={`translate(${rose.x.toFixed(3)} ${rose.y.toFixed(3)})`}
      >
        <circle className="seachart__ring" r={ROSE * 0.52} />
        <circle className="seachart__ring" r={ROSE * 0.6} />
        {rays.map((item) => (
          <g key={item.index}>
            <path className="seachart__ray seachart__ray--shade" d={item.shade} />
            <path className="seachart__ray seachart__ray--lit" d={item.lit} />
          </g>
        ))}
        {/* Die Nordmarke: ein Dreieck ueber dem Nordstrahl, wie die Lilie der Karten - nur gezeichnet statt verziert. */}
        <path
          className="seachart__north"
          d={`M0,${(-ROSE * 1.32).toFixed(3)} L${(ROSE * 0.11).toFixed(3)},${(-ROSE * 1.08).toFixed(3)} L${(-ROSE * 0.11).toFixed(3)},${(-ROSE * 1.08).toFixed(3)} Z`}
        />
      </g>
    </svg>
  );
}

/** Kurze Strahlen zuerst zeichnen, die Hauptwinde liegen obenauf. */
function rankOrder(index: number): number {
  if (index % 4 === 0) return 2;
  if (index % 2 === 0) return 1;
  return 0;
}
