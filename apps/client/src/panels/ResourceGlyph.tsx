import type { JSX } from 'react';
import type { ResourceId } from '@conquerist/shared';

/**
 * Das Motiv einer Ressource.
 *
 * Gezeichnet und nicht aus einem Icon-Satz geholt: die fuenf Motive kommen aus
 * dem Gelaende, das sie abwirft, und sollen wie eine Familie aussehen - gleiche
 * Strichstaerke, gleiche Kantenrundung, alle in dasselbe Quadrat gesetzt. Ein
 * Satz fremder Piktogramme haette fuenf Handschriften.
 *
 * Alle Formen sind einfarbig und dunkel: die Ressource erkennt man an der Farbe
 * der Karte darunter (das ist die Gelaendefarbe vom Brett), das Motiv sagt nur,
 * *was* es ist. Zwei Traeger fuer dieselbe Information, damit keiner allein
 * genuegen muss.
 */
export function ResourceGlyph({ resource }: { readonly resource: ResourceId }): JSX.Element {
  return (
    <svg className="card__glyph" viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`} aria-hidden="true">
      {RESOURCE_SHAPES[resource]}
    </svg>
  );
}

/**
 * Die Kantenlaenge des Rasters, in dem alle fuenf Motive liegen.
 *
 * Sie steht als Zahl da, weil sie ausserhalb dieser Datei gebraucht wird: der
 * Hafen setzt dasselbe Motiv aufs Brett und muss es dafuer auf Brettmasse
 * herunterrechnen (`board/harbor.tsx`). Wer den Wert dort abschreibt, hat ihn
 * beim naechsten Mal an einer Stelle geaendert.
 */
export const GLYPH_BOX = 24;

/**
 * Die fuenf Motive als blosse Formen, ohne ihr SVG darum.
 *
 * **Warum sie exportiert sind.** Ein Hafen fuer Erz zeigt dasselbe Motiv wie
 * die Erzkarte - das ist die ganze Auskunft, die er zu geben hat, und sie darf
 * nicht als zweite Zeichnung danebenstehen. Auf der Karte sitzt das Motiv in
 * einem eigenen `<svg>`, auf dem Brett in einer `<g>` mit Transformation;
 * gemeinsam ist ihnen nur der Inhalt, und genau der steht deshalb hier.
 */
export const RESOURCE_SHAPES: Readonly<Record<ResourceId, JSX.Element>> = {
  /** Lehm: drei Ziegel im Verband. */
  brick: (
    <g>
      <rect x="3" y="8" width="8" height="4.5" rx="0.8" />
      <rect x="13" y="8" width="8" height="4.5" rx="0.8" />
      <rect x="8" y="14" width="8" height="4.5" rx="0.8" />
    </g>
  ),

  /** Holz: ein Nadelbaum, weil der Wald auf dem Brett einer ist. */
  lumber: (
    <g>
      <path d="M12 3 L17 11 H7 Z" />
      <path d="M12 8 L18.5 17 H5.5 Z" />
      <rect x="10.8" y="16.5" width="2.4" height="4.5" rx="0.6" />
    </g>
  ),

  /** Wolle: ein Schaf, auf Koerper und Kopf reduziert. */
  wool: (
    <g>
      <path d="M7.5 15.5 a4 4 0 0 1 0.6 -7.6 a3.4 3.4 0 0 1 5.6 -1.4 a3.6 3.6 0 0 1 3.4 6.2 a3.4 3.4 0 0 1 -3.2 2.8 Z" />
      <circle cx="17.4" cy="9.6" r="2.4" />
      <rect x="8.4" y="15" width="1.7" height="4" rx="0.6" />
      <rect x="13" y="15" width="1.7" height="4" rx="0.6" />
    </g>
  ),

  /** Korn: eine Aehre mit Halm. */
  grain: (
    <g>
      <rect x="11.2" y="9" width="1.6" height="12" rx="0.7" />
      <path d="M12 3 C 14.4 5 14.4 7.4 12 9.4 C 9.6 7.4 9.6 5 12 3 Z" />
      <path d="M11.4 8.4 C 9 8.2 7.4 9.6 6.8 12 C 9.2 12.4 11 11 11.4 8.4 Z" />
      <path d="M12.6 8.4 C 15 8.2 16.6 9.6 17.2 12 C 14.8 12.4 13 11 12.6 8.4 Z" />
      <path d="M11.4 12.6 C 9 12.4 7.4 13.8 6.8 16.2 C 9.2 16.6 11 15.2 11.4 12.6 Z" />
      <path d="M12.6 12.6 C 15 12.4 16.6 13.8 17.2 16.2 C 14.8 16.6 13 15.2 12.6 12.6 Z" />
    </g>
  ),

  /** Erz: ein Brocken mit Bruchkante, wie das Gebirge. */
  ore: (
    <g>
      <path d="M12 3 L20 9.5 L17 20 H7 L4 9.5 Z" />
      <path d="M12 3 L12 20" className="card__glyph-cut" />
      <path d="M4 9.5 L12 12.5 L20 9.5" className="card__glyph-cut" />
    </g>
  ),
};
