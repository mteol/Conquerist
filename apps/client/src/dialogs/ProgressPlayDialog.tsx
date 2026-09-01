import { useState, type JSX } from 'react';
import { TRACK_IDS, type TrackId } from '@conquerist/shared';
import { TRACK_COLORS, TRACK_NAMES } from '../game/labels';
import { CloseButton } from './CloseButton';

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
    <div className="modal" role="dialog" aria-label="Alchemie">
      <div className="modal__box">
        <CloseButton onClose={onClose} label="Alchemie" />
        <h2>Alchemie</h2>
        <p className="modal__hint">
          Vor dem Wurf spielen und beide Augenzahlen bestimmen — der Ereigniswürfel fällt trotzdem
          normal.
        </p>

        <div className="pick" role="group" aria-label="Erster Würfel">
          {DICE_FACES.map((face) => (
            <button
              key={face}
              type="button"
              className="button"
              aria-pressed={first === face}
              onClick={() => setFirst(face)}
            >
              {face}
            </button>
          ))}
        </div>

        <div className="pick" role="group" aria-label="Zweiter Würfel">
          {DICE_FACES.map((face) => (
            <button
              key={face}
              type="button"
              className="button"
              aria-pressed={second === face}
              onClick={() => setSecond(face)}
            >
              {face}
            </button>
          ))}
        </div>

        <div className="modal__buttons">
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
        </div>
      </div>
    </div>
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
    <div className="modal" role="dialog" aria-label="Kran">
      <div className="modal__box">
        <CloseButton onClose={onClose} label="Kran" />
        <h2>Kran</h2>
        <p className="modal__hint">Welcher Ausbau kostet in diesem Zug eine Handelsware weniger?</p>

        <div className="pick">
          {TRACK_IDS.map((track) => (
            <button
              key={track}
              type="button"
              className="button"
              style={{ borderLeftColor: TRACK_COLORS[track], borderLeftWidth: '4px' }}
              onClick={() => onConfirm(track)}
            >
              {TRACK_NAMES[track]}
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
