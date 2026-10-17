import type { JSX } from 'react';
import type { HexId, PlayerId } from '@conquerist/shared';
import type { PlayerRow } from '../game/view';
import { Modal } from './Modal';
import { Choice } from './Choice';

/**
 * Wen der Raeuber bestiehlt.
 *
 * Erscheint nur, wenn am Zielfeld mehr als ein Anlieger mit Karten wohnt - bei
 * genau einem waehlt der Spielbildschirm ihn ohne Rueckfrage, denn
 * `canMoveRobber` laesst das Auslassen dann ohnehin nicht zu.
 */
export interface VictimDialogProps {
  readonly hex: HexId;
  readonly victims: readonly PlayerRow[];
  readonly onChoose: (victim: PlayerId) => void;
  readonly onClose: () => void;
}

export function VictimDialog({ hex, victims, onChoose, onClose }: VictimDialogProps): JSX.Element {
  return (
    <Modal
      label="Wen bestehlen?"
      title="Wen bestehlen?"
      hint={`Am Feld ${hex} wohnen mehrere mit Karten.`}
      onClose={onClose}
      foot={
        <button type="button" className="button button--ghost" onClick={onClose}>
          Doch nicht
        </button>
      }
    >
      <div className="choices">
        {victims.map((victim) => (
          <Choice
            key={victim.id}
            tone={victim.color}
            name={victim.name}
            detail={`${victim.cardCount} ${victim.cardCount === 1 ? 'Karte' : 'Karten'}`}
            label={`${victim.name} (${victim.cardCount} ${victim.cardCount === 1 ? 'Karte' : 'Karten'})`}
            onClick={() => onChoose(victim.id)}
          />
        ))}
      </div>
    </Modal>
  );
}
