import type { JSX } from 'react';
import { PROGRESS_NAMES, PROGRESS_TRACK, type ProgressCardId } from '@conquerist/shared';
import { TRACK_COLORS } from '../game/labels';
import { Modal } from './Modal';
import { Choice } from './Choice';

export interface SpyDialogProps {
  readonly victimName: string;
  /** Die wählbaren Karten - aus der Aktionsliste, je Art einmal. */
  readonly cards: readonly ProgressCardId[];
  readonly onTake: (card: ProgressCardId) => void;
}

/**
 * Spionage: welche der fremden Fortschrittskarten genommen wird.
 *
 * Ein **Aufdeckdialog** - er sagt, dass das Gezeigte nur jetzt und nur hier zu
 * sehen ist. `revealsTo` in `shared` öffnet die Hand genau für diese Phase;
 * ist sie vorbei, steht in der Sicht wieder `null`.
 *
 * Ohne Abbruch: gespielt ist die Karte schon. Wer nicht wählt, dem lässt die
 * Frist die Beute verfallen.
 */
export function SpyDialog({ victimName, cards, onTake }: SpyDialogProps): JSX.Element {
  return (
    <Modal
      label="Spionage"
      title={`${victimName}s Fortschrittskarten`}
      hint="Nur du siehst diese Karten, und nur jetzt. Eine davon nimmst du."
    >
      <div className="choices">
        {cards.map((card) => (
          <Choice
            key={card}
            tone={TRACK_COLORS[PROGRESS_TRACK[card]]}
            name={PROGRESS_NAMES[card]}
            onClick={() => onTake(card)}
          />
        ))}
      </div>
    </Modal>
  );
}
