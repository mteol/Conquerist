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
   * Papier: eine Schriftrolle mit zwei Zeilen.
   *
   * Der Bogen mit Eselsohr sah aus wie ein Dokument-Symbol aus einer
   * Buerosoftware. Die Rolle oben und unten macht daraus Pergament, und zwei
   * kraeftige Zeilen ueberstehen auch die kleine Auswahlkarte.
   */
  paper: (
    <g>
      <path d="M6 5.5 H18 V18.5 H6 Z" />
      <rect x="4" y="3" width="16" height="4" rx="2" />
      <rect x="4" y="17" width="16" height="4" rx="2" />
      <path d="M8.5 10.5 H15.5 M8.5 14 H13.5" className="card__glyph-cut" />
    </g>
  ),

  /**
   * Tuch: ein Stoffballen von der Stirnseite, dessen Bahn sich abwickelt.
   *
   * Die Wicklung (zwei Ringe) sagt „Ballen", der gewellte Saum der Bahn sagt
   * „Stoff". Drei Balken - der alte Stapel - lasen sich als Liste.
   */
  cloth: (
    <g>
      <path d="M9 5 H19 L21 8 L19 11 L21 14 L19 17 L21 20 H9 Z" />
      <circle cx="9" cy="12.5" r="7" />
      <circle cx="9" cy="12.5" r="4.4" className="card__glyph-cut" />
      <circle cx="9" cy="12.5" r="1.8" className="card__glyph-cut" />
    </g>
  ),

  /**
   * Muenzen: ein Stapel und eine Muenze davor.
   *
   * Der gekippte Stapel allein sah aus wie eine Dose. Die Rollen links sagen
   * „Geldstapel", die Muenze mit Praegerand rechts sagt „Geld" - und keine
   * Wicklung wie beim Tuch, damit die beiden Waren sich nicht gleichen.
   */
  coin: (
    <g>
      <rect x="2.5" y="16.4" width="10" height="3.4" rx="1.5" />
      <rect x="2.5" y="12.6" width="10" height="3.4" rx="1.5" />
      <rect x="2.5" y="8.8" width="10" height="3.4" rx="1.5" />
      <circle cx="15.5" cy="13" r="6.5" />
      <circle cx="15.5" cy="13" r="6.5" className="card__glyph-cut" />
      <circle cx="15.5" cy="13" r="4" className="card__glyph-cut" />
    </g>
  ),
};
