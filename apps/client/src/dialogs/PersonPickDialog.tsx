import type { JSX } from 'react';
import type { PlayerId } from '@conquerist/shared';
import { Modal } from './Modal';
import { Choice } from './Choice';

/** Eine Person, wie die Wahl sie zeigt. */
export interface PersonOption {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly victoryPoints: number;
}

export interface PersonPickDialogProps {
  readonly title: string;
  readonly hint: string;
  /** Nur die erlaubten Ziele - sie kommen aus der Aktionsliste, nicht aus einer Rechnung hier. */
  readonly people: readonly PersonOption[];
  readonly onChoose: (id: PlayerId) => void;
  readonly onClose: () => void;
}

/**
 * Wen eine Karte trifft - Spionage, Großhändler, Deserteur.
 *
 * Das erste Mal, dass ein Dialog eine **Person** erfragt. Dieselbe Form wie die
 * Opferwahl beim Räuber (`VictimDialog`), aber mit Punktestand statt
 * Kartenzahl: beim Großhändler ist „mehr Siegpunkte" die Bedingung, und wer
 * wählt, soll sehen, warum genau diese Personen dastehen.
 *
 * Die Spielerfarbe steht als Kante und nie allein - Name und Punkte stehen
 * daneben (Designregel 7). Abbrechen geht: gespielt ist noch nichts.
 */
export function PersonPickDialog({
  title,
  hint,
  people,
  onChoose,
  onClose,
}: PersonPickDialogProps): JSX.Element {
  return (
    <Modal
      label={title}
      title={title}
      hint={hint}
      onClose={onClose}
      foot={
        <button type="button" className="button button--ghost" onClick={onClose}>
          Abbrechen
        </button>
      }
    >
      <div className="choices">
        {people.map((person) => {
          const points = `${person.victoryPoints} ${person.victoryPoints === 1 ? 'Siegpunkt' : 'Siegpunkte'}`;

          return (
            <Choice
              key={person.id}
              tone={person.color}
              name={person.name}
              detail={points}
              label={`${person.name} · ${points}`}
              onClick={() => onChoose(person.id)}
            />
          );
        })}
      </div>
    </Modal>
  );
}
