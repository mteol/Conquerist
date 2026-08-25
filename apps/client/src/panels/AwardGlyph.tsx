import type { JSX } from 'react';
import type { AwardId } from '../game/awards';

/**
 * Das Motiv einer Auszeichnung.
 *
 * **Dieselbe Handschrift wie `DevelopmentGlyph` und `ResourceGlyph`**: dasselbe
 * Quadrat (24x24), dieselbe Tinte, einfarbig. Wer die drei Reihen nebeneinander
 * sieht, soll drei Sorten Material erkennen und **einen** Zeichner.
 *
 * **Es muss zweimal lesbar sein, und das entscheidet die Form.** Dasselbe
 * Motiv steht auf einer 4.6rem grossen Karte und als 0.95rem kleine Plakette
 * neben einem Namen am Tisch - also rund vierzehn Pixel. Was dort noch
 * durchkommt, ist eine einzige kraeftige Silhouette; alles mit Innenzeichnung
 * wird zu einem Fleck. Beide Motive sind deshalb so gebaut, dass ihre Aussage
 * in der Umrisslinie steckt: ein Zickzack und ein Kreuz.
 */
export function AwardGlyph({
  award,
  className = 'awardcard__glyph',
}: {
  readonly award: AwardId;
  readonly className?: string;
}): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {SHAPES[award]}
    </svg>
  );
}

const SHAPES: Readonly<Record<AwardId, JSX.Element>> = {
  /**
   * Laengste Handelsstrasse: eine Strecke, die weit kommt.
   *
   * **Gezogen und nicht gefuellt**, als einziges Motiv des Spiels. Der Grund
   * ist der Inhalt: eine Handelsstrasse ist ein *Kantenzug* - ein Weg, der
   * durchgeht, ohne sich zu wiederholen -, und das ist genau das, was eine
   * Linie mit runden Ecken zeigt und eine Ansammlung von Balken nicht. Die
   * Karte „Strassenbau" daneben zeigt **zwei** Balken nebeneinander, weil sie
   * zwei Strassen hergibt; hier ist es eine Strecke, und dass sie eine ist,
   * sieht man am durchlaufenden Knick.
   *
   * Die Strichbreite steht in `index.css` (`.glyph__route`) und nicht hier: ein
   * Praesentationsattribut am Element verloere gegen jede gleichnamige Regel im
   * Blatt - die Falle, die in `CLAUDE.md` steht, seit `.road { stroke:
   * transparent }` einmal jede gebaute Strasse unsichtbar gemacht hat.
   */
  longestRoad: <path className="glyph__route" d="M3.2 20.4 L9 12.6 L15.2 17 L20.8 4.4" />,

  /**
   * Groesste Rittermacht: zwei gekreuzte Klingen.
   *
   * **Kein zweiter Helm.** Der Helm gehoert der Ritterkarte, und er heisst dort
   * „ein Ritter" - ihn hier noch einmal zu setzen, hiesse „ein Ritter" fuer
   * etwas, das „das groesste Heer" bedeutet. Drei kleine Helme
   * nebeneinander waeren die naheliegende Loesung und faellt an der Groesse: in
   * der Plakette am Tisch bekaeme jeder davon vier Pixel.
   *
   * Zwei Klingen ueber einer gemeinsamen Parierstange sind bei vierzehn Pixeln
   * noch ein Kreuz und bei vierzig ein Waffenpaar. Wie viele Ritter jemand
   * wirklich ausgespielt hat, sagt daneben die Helmplakette mit ihrer Zahl -
   * Form und Zahl, nie die Form allein (Designregel 7).
   */
  largestArmy: (
    <g>
      <rect x="10.6" y="2.4" width="2.8" height="19.2" rx="1.4" transform="rotate(45 12 12)" />
      <rect x="10.6" y="2.4" width="2.8" height="19.2" rx="1.4" transform="rotate(-45 12 12)" />
      <rect x="5.4" y="14.9" width="13.2" height="2.4" rx="1.2" />
    </g>
  ),
};
