import type { JSX } from 'react';
import { PIECE_IDS, type PieceId, type RuleSet } from '@conquerist/shared';
import { CITY_PATH, ROAD_PATH, SETTLEMENT_PATH, VIEWBOX } from '../board/shapes';

/**
 * Was noch im eigenen Vorrat liegt - Strassen, Siedlungen, Staedte.
 *
 * **Rolle:** die Antwort auf „kann ich das ueberhaupt noch bauen". Am Tisch aus
 * Holz sieht man den Vorrat vor sich liegen und merkt von selbst, wenn er zur
 * Neige geht; auf dem Bildschirm gab es ihn bisher nirgends, und die letzte
 * Strasse fiel erst auf, wenn der Server sie ablehnte.
 *
 * **Aufbau:** drei Zeilen, je die Silhouette vom Brett und die Zahl daneben.
 * Dieselbe Form wie das gebaute Teil, in derselben Spielerfarbe - wer hier eine
 * Siedlung sieht, erkennt sie dort wieder. Die Zahl steht daneben und nicht
 * darin: sie wird verglichen, und Vergleichen heisst lesen.
 *
 * **Woran man sich erinnert:** dass die Null nicht verschwindet, sondern grau
 * wird. Ein fehlender Eintrag saehe aus wie ein Anzeigefehler; ein durchgestrichen
 * wirkender sagt „aufgebraucht". Das ist der Zustand, um den es geht - eine
 * Ressource ohne Karten hat in der Hand keinen Stapel, aber ein Vorrat ohne
 * Teile ist eine Auskunft.
 *
 * Was hier NICHT steht: die Baukosten. Die stehen im Regelwerk und beim Bauen;
 * eine zweite Kostentabelle in der Ecke waere ein zweiter Ort fuer dieselbe
 * Zahl.
 */
export interface StockPanelProps {
  /** Wie viele Teile je Art noch im Vorrat liegen. Kommt aus der `PlayerView`. */
  readonly piecesLeft: RuleSet['pieceStock'];
  /** Die eigene Farbe - dieselbe wie auf dem Brett. */
  readonly color: string;
}

const PIECE_LABELS: Readonly<Record<PieceId, string>> = {
  road: 'Straßen',
  settlement: 'Siedlungen',
  city: 'Städte',
};

export function StockPanel({ piecesLeft, color }: StockPanelProps): JSX.Element {
  return (
    <ul className="stock" aria-label="Dein Vorrat">
      {PIECE_IDS.map((piece) => {
        const left = piecesLeft[piece] ?? 0;

        return (
          <li
            key={piece}
            className={left === 0 ? 'stock__item stock__item--empty' : 'stock__item'}
            data-testid={`stock-${piece}`}
          >
            <PieceMark piece={piece} color={color} />
            {/*
             * Die Zahl fuer die Augen, der Satz fuers Vorlesen. „13 Straßen"
             * liest sich vor; eine 13 neben einem Pfad nicht.
             */}
            <span aria-hidden="true">{left}</span>
            <span className="visually-hidden">{`${left} ${PIECE_LABELS[piece]}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Die drei Formen vom Brett, klein.
 *
 * Farbe per `style` und nicht als Attribut: eine gleichnamige CSS-Regel schlaegt
 * jedes SVG-Praesentationsattribut - daran sind in Etappe 3 alle gebauten
 * Strassen unsichtbar geworden.
 */
function PieceMark({ piece, color }: { readonly piece: PieceId; readonly color: string }) {
  if (piece === 'road') {
    return (
      <svg className="piece piece--stock" viewBox={VIEWBOX} aria-hidden="true">
        <path
          d={ROAD_PATH}
          style={{ stroke: color }}
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <svg className="piece piece--stock" viewBox={VIEWBOX} aria-hidden="true">
      {/* Dieselben Pfade wie auf dem Brett - siehe `board/shapes.ts`. */}
      <path
        d={piece === 'settlement' ? SETTLEMENT_PATH : CITY_PATH}
        style={{ fill: color, stroke: color }}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}
