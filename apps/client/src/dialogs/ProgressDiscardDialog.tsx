import type { JSX } from 'react';
import { PROGRESS_NAMES, PROGRESS_TRACK, type ProgressCardId } from '@conquerist/shared';
import { TRACK_COLORS } from '../game/labels';

/**
 * Mehr als vier zaehlende Fortschrittskarten: welche geht zurueck.
 *
 * `progressDiscardPending` traegt eine Warteschlange (`pending`), aber die
 * Abgabe selbst ist eine Wahl der Person, die vorn steht - `legalActions`
 * zaehlt sie zwar auf (`discardProgressCard`), aber welche der eigenen
 * Handkarten es sein soll, ist ihre Entscheidung. Ohne `onClose`, aus
 * demselben Grund wie bei `DiscardDialog` und `PickDeckDialog`: die Abgabe
 * ist Pflicht.
 */
export interface ProgressDiscardDialogProps {
  /** Die eigene Hand - `view.progressCards`, nie `null` fuer den Betroffenen selbst. */
  readonly cards: readonly ProgressCardId[];
  readonly onDiscard: (card: ProgressCardId) => void;
}

export function ProgressDiscardDialog({
  cards,
  onDiscard,
}: ProgressDiscardDialogProps): JSX.Element {
  return (
    <div className="modal" role="dialog" aria-label="Fortschrittskarte abgeben">
      <div className="modal__box">
        <h2>Welche Karte gibst du ab?</h2>
        <p className="modal__hint">
          Mehr als vier zählende Fortschrittskarten — eine davon geht zurück.
        </p>

        <div className="pick">
          {cards.map((card) => (
            <button
              key={card}
              type="button"
              className="button"
              style={{
                borderLeftColor: TRACK_COLORS[PROGRESS_TRACK[card]],
                borderLeftWidth: '4px',
              }}
              onClick={() => onDiscard(card)}
            >
              {PROGRESS_NAMES[card]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
