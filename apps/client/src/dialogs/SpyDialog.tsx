import type { JSX } from 'react';
import { PROGRESS_NAMES, PROGRESS_TRACK, type ProgressCardId } from '@conquerist/shared';
import { TRACK_COLORS } from '../game/labels';

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
    <div className="modal" role="dialog" aria-label="Spionage">
      <div className="modal__box">
        <h2>{victimName}s Fortschrittskarten</h2>
        <p className="modal__hint">
          Nur du siehst diese Karten, und nur jetzt. Eine davon nimmst du.
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
              onClick={() => onTake(card)}
            >
              {PROGRESS_NAMES[card]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
