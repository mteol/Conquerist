import type { JSX } from 'react';
import { isCommodity, type CardId, type CommodityId } from '@conquerist/shared';
import { GLYPH_BOX, RESOURCE_SHAPES } from './ResourceGlyph';

/**
 * Die Motive der drei Handelswaren - und der eine Griff, der zu jeder
 * Kartensorte das richtige holt.
 *
 * **Dieselbe Handschrift wie `ResourceGlyph`**: dasselbe Raster (`GLYPH_BOX`),
 * einfarbige Silhouetten, Binnenlinien nur als `card__glyph-cut`. Ein zweiter
 * Zeichenstil neben den fuenf Rohstoffen waere sofort zu sehen, und zwar als
 * Fehler.
 *
 * **Warum jedes Motiv eine kraeftige Silhouette ist.** Dasselbe Zeichen steht
 * auf einer 4.6rem breiten Handkarte und als 1.8rem kleine Auswahlkarte im
 * Dialog. Was dort noch durchkommt, ist eine Form, keine Zeichnung - dieselbe
 * Grenze, an der schon die Auszeichnungsmotive entworfen wurden.
 */
export function CardGlyph({ card }: { readonly card: CardId }): JSX.Element {
  return (
    <svg className="card__glyph" viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`} aria-hidden="true">
      {isCommodity(card) ? COMMODITY_SHAPES[card] : RESOURCE_SHAPES[card]}
    </svg>
  );
}

/**
 * Die drei Motive als blosse Formen, ohne ihr SVG darum.
 *
 * Exportiert aus demselben Grund wie `RESOURCE_SHAPES`: wer dasselbe Zeichen
 * an einer anderen Stelle braucht, nimmt den Inhalt und zeichnet ihn nicht neu.
 */
export const COMMODITY_SHAPES: Readonly<Record<CommodityId, JSX.Element>> = {
  /**
   * Papier: ein Bogen mit umgeschlagener Ecke.
   *
   * Die Ecke ist der ganze Unterschied zu einem Rechteck - ohne sie waere es
   * eine Flaeche, mit ihr ist es ein Blatt. Zeilen darauf waeren huebsch und
   * bei vierzehn Pixeln weg.
   */
  paper: (
    <g>
      <path d="M5 3 H14.5 L19 7.5 V21 H5 Z" />
      <path d="M14.5 3 L14.5 7.5 L19 7.5" className="card__glyph-cut" />
    </g>
  ),

  /**
   * Tuch: drei gefaltete Lagen mit gerundetem Bruch.
   *
   * Ein Ballen Stoff hat keine gerade Kante - der Bruch rechts macht aus drei
   * Balken einen Stapel Bahnen. Die mittlere Lage ragt weiter heraus, damit
   * die drei nicht wie ein Gitter aussehen.
   */
  cloth: (
    <g>
      <path d="M4 5.5 H16 A2.25 2.25 0 0 1 16 10 H4 Z" />
      <path d="M4 10 H19 A2.25 2.25 0 0 1 19 14.5 H4 Z" />
      <path d="M4 14.5 H14 A2.25 2.25 0 0 1 14 19 H4 Z" />
    </g>
  ),

  /**
   * Muenzen: drei gestapelte Scheiben.
   *
   * In Aufsicht gekippt (Ellipsen), weil ein Stapel Kreise von vorn ein Turm
   * waere und nichts mit Geld zu tun haette. Die Schnittlinien trennen die
   * Scheiben - ohne sie liefen die drei Fuellungen zu einem Klumpen zusammen.
   */
  coin: (
    <g>
      <path d="M4.5 8 a7.5 4 0 0 1 15 0 v8 a7.5 4 0 0 1 -15 0 Z" />
      <ellipse cx="12" cy="8" rx="7.5" ry="4" className="card__glyph-cut" />
      <path d="M4.5 12 a7.5 4 0 0 0 15 0" className="card__glyph-cut" />
    </g>
  ),
};
