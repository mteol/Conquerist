import type { JSX } from 'react';
import type { PlayerId } from '@conquerist/shared';
import { CloseButton } from './CloseButton';

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
    <div className="modal" role="dialog" aria-label={title}>
      <div className="modal__box">
        <CloseButton onClose={onClose} label={title} />
        <h2>{title}</h2>
        <p className="modal__hint">{hint}</p>

        <div className="pick">
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className="button"
              style={{ borderLeftColor: person.color, borderLeftWidth: '4px' }}
              onClick={() => onChoose(person.id)}
            >
              {person.name} · {person.victoryPoints}{' '}
              {person.victoryPoints === 1 ? 'Siegpunkt' : 'Siegpunkte'}
            </button>
          ))}
        </div>

        <div className="modal__buttons">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
