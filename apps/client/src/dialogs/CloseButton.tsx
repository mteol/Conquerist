import { useEffect, type JSX } from 'react';

/**
 * Das Kreuz in der Ecke - fuer jedes Fenster, das man wieder zumachen darf.
 *
 * **Warum es das gibt:** Jeder dieser Dialoge hatte seinen Ausweg schon, aber
 * unten und ausgeschrieben („Abbrechen", „Doch nicht"). Im ersten Playtest hat
 * jemand versehentlich auf „Handel" gedrueckt und den Weg zurueck nicht
 * gefunden - der Knopf stand unter drei Reitern und zwei Kartenlisten, also
 * genau dort, wo man beim Suchen zuletzt hinsieht. Das Kreuz sitzt, wo man es
 * sucht: oben rechts, immer an derselben Stelle, in jedem Fenster gleich.
 *
 * **Es ersetzt den unteren Knopf nicht.** „Abbrechen" sagt, was passiert; das
 * Kreuz sagt nur, wo man drueckt. Wer den Satz braucht, findet ihn weiterhin -
 * das Kreuz ist der kurze Weg fuer den, der ihn nicht braucht.
 *
 * **Escape gehoert dazu.** Ein Fenster, das sich mit der Maus schliessen laesst,
 * aber nicht mit der Tastatur, ist nur halb bedienbar. Der Griff haengt am
 * Fenster und nicht an einer Stelle weiter oben: solange dieses Kreuz da ist,
 * gibt es einen Ausweg, und wenn es weg ist, hoert auch die Taste auf zu
 * wirken. Zwei Dinge, ein Lebenslauf.
 *
 * Nicht dabei: Klick auf den Hintergrund. Der schliesst hier nichts - beim
 * Abwerfen und beim Angebot gibt es kein Zumachen, und ein Hintergrund, der
 * manchmal schliesst und manchmal nicht, ist schlimmer als einer, der es nie
 * tut.
 */
export interface CloseButtonProps {
  readonly onClose: () => void;
  /** Was zugemacht wird - fuer Vorlesewerkzeuge, die das Kreuz nicht sehen. */
  readonly label: string;
}

export function CloseButton({ onClose, label }: CloseButtonProps): JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <button
      type="button"
      className="modal__close"
      aria-label={`${label} schließen`}
      data-testid="modal-close"
      onClick={onClose}
    >
      {/* Zwei Striche statt eines „x": ein Buchstabe wuerde in jeder Schrift
          anders sitzen, und ein Vorlesegeraet spraeche ihn aus. */}
      <svg viewBox="-6 -6 12 12" aria-hidden="true">
        <path d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5" />
      </svg>
    </button>
  );
}
