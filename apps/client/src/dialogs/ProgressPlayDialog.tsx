import { useState, type JSX } from 'react';
import { TRACK_IDS, type TrackId } from '@conquerist/shared';
import { TRACK_COLORS, TRACK_NAMES } from '../game/labels';
import { Modal } from './Modal';
import { Choice } from './Choice';

/**
 * Die zwei Fortschrittskarten, deren Angabe weder eine Sorte (siehe
 * `ResourcePickDialog`) noch das Brett braucht: Alchemie fragt zwei
 * Augenzahlen, Kran fragt einen Bereich.
 *
 * **Eine Datei fuer beide, keine zwei fast gleichen.** Beide sind reine
 * "eine kleine, feste Auswahl im Fenster"-Karten wie Erfindung und Monopol -
 * nur ist die Menge, aus der sie waehlen, weder eine Kartensorte noch dieselbe
 * fuer beide. `props.card` unterscheidet die zwei Koerper; ein zweiter Dialog
 * daneben haette dieselbe Kopfzeile, denselben Rahmen und dieselbe
 * Bestaetigungsleiste noch einmal hinschreiben muessen.
 */
export type ProgressPlayDialogProps =
  | {
      readonly card: 'alchemist';
      readonly onConfirm: (first: number, second: number) => void;
      readonly onClose: () => void;
    }
  | {
      readonly card: 'crane';
      readonly onConfirm: (track: TrackId) => void;
      readonly onClose: () => void;
    };

const DICE_FACES = [1, 2, 3, 4, 5, 6];

export function ProgressPlayDialog(props: ProgressPlayDialogProps): JSX.Element {
  if (props.card === 'alchemist') {
    return <AlchemistPicker onConfirm={props.onConfirm} onClose={props.onClose} />;
  }
  return <CranePicker onConfirm={props.onConfirm} onClose={props.onClose} />;
}

function AlchemistPicker({
  onConfirm,
  onClose,
}: {
  readonly onConfirm: (first: number, second: number) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const [first, setFirst] = useState<number | null>(null);
  const [second, setSecond] = useState<number | null>(null);

  return (
    <Modal
      label="Alchemie"
      title="Alchemie"
      hint="Vor dem Wurf spielen und beide Augenzahlen bestimmen — der Ereigniswürfel fällt trotzdem normal."
      onClose={onClose}
      foot={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="button button--go"
            disabled={first === null || second === null}
            onClick={() => onConfirm(first!, second!)}
          >
            Karte spielen
          </button>
        </>
      }
    >
      {(
        [
          ['Erster Würfel', first, setFirst],
          ['Zweiter Würfel', second, setSecond],
        ] as const
      ).map(([name, value, set]) => (
        <div key={name} className="facepick">
          {/* Sichtbar beschriftet: zwei gleiche Reihen ohne Namen lassen raten, welche welche ist. */}
          <span className="facepick__label" aria-hidden="true">
            {name}
          </span>
          <div className="pick" role="group" aria-label={name}>
            {DICE_FACES.map((face) => (
              <button
                key={face}
                type="button"
                className="button"
                aria-pressed={value === face}
                onClick={() => set(face)}
              >
                {face}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

function CranePicker({
  onConfirm,
  onClose,
}: {
  readonly onConfirm: (track: TrackId) => void;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Modal
      label="Kran"
      title="Kran"
      hint="Welcher Ausbau kostet in diesem Zug eine Handelsware weniger?"
      onClose={onClose}
      foot={
        <button type="button" className="button button--ghost" onClick={onClose}>
          Abbrechen
        </button>
      }
    >
      <div className="choices">
        {TRACK_IDS.map((track) => (
          <Choice
            key={track}
            tone={TRACK_COLORS[track]}
            name={TRACK_NAMES[track]}
            onClick={() => onConfirm(track)}
          />
        ))}
      </div>
    </Modal>
  );
}
