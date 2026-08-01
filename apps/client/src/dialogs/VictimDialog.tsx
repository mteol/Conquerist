import type { JSX } from 'react';
import type { HexId, PlayerId } from '@conquerist/shared';
import type { PlayerView } from '../game/view';

/**
 * Wen der Raeuber bestiehlt.
 *
 * Erscheint nur, wenn am Zielfeld mehr als ein Anlieger mit Karten wohnt - bei
 * genau einem waehlt der Spielbildschirm ihn ohne Rueckfrage, denn
 * `canMoveRobber` laesst das Auslassen dann ohnehin nicht zu.
 */
export interface VictimDialogProps {
  readonly hex: HexId;
  readonly victims: readonly PlayerView[];
  readonly onChoose: (victim: PlayerId) => void;
  readonly onClose: () => void;
}

export function VictimDialog({ hex, victims, onChoose, onClose }: VictimDialogProps): JSX.Element {
  return (
    <div className="modal" role="dialog" aria-label="Wen bestehlen?">
      <div className="modal__box">
        <h2>Wen bestehlen?</h2>
        <p className="modal__hint">Am Feld {hex} wohnen mehrere mit Karten.</p>

        {victims.map((victim) => (
          <button
            key={victim.id}
            type="button"
            className="button"
            style={{ borderLeftColor: victim.color }}
            onClick={() => onChoose(victim.id)}
          >
            {victim.name} ({victim.cardCount} Karten)
          </button>
        ))}

        <button type="button" className="button button--ghost" onClick={onClose}>
          Doch nicht
        </button>
      </div>
    </div>
  );
}
