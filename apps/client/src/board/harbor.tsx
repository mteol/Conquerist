import type { JSX } from 'react';
import type { HarborDefinition } from '@conquerist/shared';
import { GLYPH_BOX, RESOURCE_SHAPES } from '../panels/ResourceGlyph';
import { Ratio } from '../type/Numerals';
import type { Point } from './layout';

/**
 * Die Hafenmarke - eine Muenze auf dem Wasser.
 *
 * **Was vorher dastand und warum es zu wenig war.** Ein cremefarbener Kreis
 * mit einem farbigen Ring und der Aufschrift „2:1". Welchen Hafen man vor sich
 * hatte, sagte allein die **Ringfarbe** - und Farbe ist nie der einzige
 * Traeger (Regel 7 in `CLAUDE.md`). Wer Gruen und Gelb schlecht unterscheidet,
 * sah neun gleiche Kreise; der ausgeschriebene Name stand nur im `title`, also
 * erst nach einer Sekunde Zeigen und nie auf einem Tastbildschirm. Dazu war
 * die Aufschrift ein `<text>` in 'Segoe UI Bold' - derselbe Bruch, den die
 * Chipzahl schon einmal war: ringsherum gezeichnetes Gelaende, gezeichnete
 * Ziffern, gezeichnete Bauwerke, und mittendrin ein Stueck Systemschrift.
 *
 * **Was jetzt dasteht.** Dieselben zwei Traeger wie auf der Handkarte: die
 * Farbe der Ressource **und** ihr Motiv. Das Motiv ist buchstaeblich dasselbe
 * (`RESOURCE_SHAPES` aus `panels/ResourceGlyph.tsx`) - wer unten in seiner Hand
 * eine Wollkarte liegen hat, findet oben auf dem Brett den Hafen dazu, ohne
 * eine Farbe zuordnen zu muessen. Darunter das Verhaeltnis, gezeichnet
 * (`Ratio` in `type/Numerals.tsx`).
 *
 * **Der Koerper bleibt Pergament und wird nicht zur Gelaendefarbe.** Eine
 * Muenze in Waldgruen mit dunklem Motiv darauf waere die Karte selbst - und
 * damit ein zweites Stueck Spielmaterial an einer Stelle, an der keines liegt.
 * Auf dem Brett heisst heller Koerper mit dunkler Tinte „hier steht eine
 * Auskunft"; das ist die Sprache, die der Zahlenchip schon spricht. Die
 * Ressourcenfarbe traegt der Ring und die zwei Leinen.
 *
 * **Der 3:1-Hafen zeigt einen Anker.** Er nimmt jede Ware, hat also kein
 * Motiv, das ihm gehoerte - und ein leerer Kreis waere genau die Auskunft
 * „hier fehlt etwas". Was ihn auszeichnet, ist der Hafen selbst, also traegt
 * er dessen Zeichen. Seine Ringfarbe ist die Pergamentkante und keine
 * Gelaendefarbe: er gehoert zu keinem Feld.
 */

/** Der Radius der Marke, in Umkreisradien eines Feldes. */
export const HARBOR_MARK = 0.27;

/**
 * Wie hoch das Motiv in der Marke steht - und wie hoch die Ziffern darunter.
 *
 * Beides gegen den Radius gerechnet und nicht nach Augenmass: das Motiv sitzt
 * mit seiner Mitte bei -0.09 und misst 0.23, reicht also von -0.205 bis 0.025.
 * Das Verhaeltnis steht mit Versalhoehe 0.115 um 0.145 herum, also von 0.088
 * bis 0.203, und ist bei „12:1" hoechstens 0.27 breit. Die aeusserste Ecke
 * liegt damit 0.235 vom Mittelpunkt - der Ring sitzt bei 0.27 und ist 0.055
 * breit, seine Innenkante also bei 0.243. Es bleibt Luft, und zwar gerechnete.
 */
const GLYPH_HEIGHT = 0.23;
const GLYPH_CENTER = -0.09;
const RATIO_CAP = 0.115;
const RATIO_CENTER = 0.145;

/**
 * Der Anker des allgemeinen Hafens.
 *
 * Im selben 24er-Raster gezeichnet wie die fuenf Ressourcenmotive, mit
 * derselben Handschrift: eine geschlossene Flaeche, keine Haarlinien, alles
 * auf einen Absatz gebracht. Das Auge oben ist mit `evenodd` ausgestanzt und
 * kein zweiter Pfad darueber - zwei Formen uebereinander waeren beim Faerben
 * eine Fehlerquelle, und genau die hat dieses Projekt schon einmal bezahlt.
 */
const ANCHOR: JSX.Element = (
  <g>
    <path
      fillRule="evenodd"
      d="M9.2 4.6 A2.8 2.8 0 1 1 14.8 4.6 A2.8 2.8 0 1 1 9.2 4.6 Z M11.1 4.6 A0.9 0.9 0 1 0 12.9 4.6 A0.9 0.9 0 1 0 11.1 4.6 Z"
    />
    <rect x="10.9" y="6.6" width="2.2" height="13.6" rx="0.7" />
    <rect x="6.4" y="8.4" width="11.2" height="2" rx="0.9" />
    <path d="M4.6 12.6 L4.6 14.4 C4.6 18.8 7.8 21.4 12 22.4 C16.2 21.4 19.4 18.8 19.4 14.4 L19.4 12.6 L17.4 12.6 L17.4 14.4 C17.4 17.6 15.1 19.5 12 20.3 C8.9 19.5 6.6 17.6 6.6 14.4 L6.6 12.6 Z" />
    <path d="M2.6 11.4 L7.4 11.4 L5 14.2 Z" />
    <path d="M16.6 11.4 L21.4 11.4 L19 14.2 Z" />
  </g>
);

export interface HarborMarkProps {
  readonly harbor: HarborDefinition;
  /** Wo die Marke liegt - `harborAnchor` hat das schon ausgerechnet. */
  readonly at: Point;
  /** Die Farbe des Rings und der Leinen. */
  readonly tint: string;
}

/**
 * Was in der Marke steht: Muenze, Motiv, Verhaeltnis.
 *
 * Die Muenze steht zuerst im Markup und liegt damit unter ihrem Inhalt. Sie
 * deckt zugleich die zwei Leinen zu, die knapp innerhalb ihres Randes
 * anfangen - deshalb wird sie im Brett **nach** ihnen gezeichnet.
 */
export function HarborMark({ harbor, at, tint }: HarborMarkProps): JSX.Element {
  const scale = GLYPH_HEIGHT / GLYPH_BOX;

  return (
    <>
      <circle
        className="harbor__coin"
        cx={at.x}
        cy={at.y}
        r={HARBOR_MARK}
        style={{ stroke: tint }}
      />
      <g
        className="harbor__glyph"
        transform={`translate(${at.x - GLYPH_HEIGHT / 2} ${at.y + GLYPH_CENTER - GLYPH_HEIGHT / 2}) scale(${scale})`}
      >
        {harbor.resource === undefined ? ANCHOR : RESOURCE_SHAPES[harbor.resource]}
      </g>
      <Ratio
        left={harbor.ratio}
        right={1}
        cx={at.x}
        cy={at.y + RATIO_CENTER}
        cap={RATIO_CAP}
        className="harbor__ratio"
      />
    </>
  );
}
