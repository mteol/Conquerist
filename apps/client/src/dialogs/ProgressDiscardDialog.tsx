import type { JSX } from 'react';
import { PROGRESS_NAMES, PROGRESS_TRACK, type ProgressCardId } from '@conquerist/shared';
import { TRACK_COLORS } from '../game/labels';
import { Modal } from './Modal';
import { Choice } from './Choice';

/**
 * Mehr als vier zaehlende Fortschrittskarten: welche geht zurueck.
 *
 * `progressDiscardPending` traegt eine Warteschlange (`pending`), aber die
 * Abgabe selbst ist eine Wahl der Person, die vorn steht - `legalActions`
 * zaehlt sie zwar auf (`discardProgressCard`), aber welche der eigenen
 * Handkarten es sein soll, ist ihre Entscheidung. Ohne `onClose`, aus
 * demselben Grund wie bei `DiscardDialog` und `PickDeckDialog`: die Abgabe
 * ist Pflicht.
 *
 * **Die eine Ausnahme ist Regel 11** - die fuenfte Karte am Zug. Dort darf man
 * statt abzugeben auch eine Karte ausspielen, also muss der Dialog wieder zu
 * gehen (`onClose`), und der Hinweis sagt das.
 */
export interface ProgressDiscardDialogProps {
  /** Die eigene Hand - `view.progressCards`, nie `null` fuer den Betroffenen selbst. */
  readonly cards: readonly ProgressCardId[];
  readonly onDiscard: (card: ProgressCardId) => void;
  /** Nur am eigenen Zug (Regel 11): wer lieber ausspielt, macht wieder zu. */
  readonly onClose?: () => void;
}

export function ProgressDiscardDialog({
  cards,
  onDiscard,
  onClose,
}: ProgressDiscardDialogProps): JSX.Element {
  return (
    <Modal
      label="Fortschrittskarte abgeben"
      title="Welche Karte gibst du ab?"
      hint={
        onClose !== undefined
          ? 'Fünf Fortschrittskarten am Zug — spiel eine aus oder gib eine davon zurück.'
          : 'Mehr als vier zählende Fortschrittskarten — eine davon geht zurück.'
      }
      onClose={onClose}
    >
      <div className="choices">
        {cards.map((card) => (
          <Choice
            key={card}
            tone={TRACK_COLORS[PROGRESS_TRACK[card]]}
            name={PROGRESS_NAMES[card]}
            onClick={() => onDiscard(card)}
          />
        ))}
      </div>
    </Modal>
  );
}
