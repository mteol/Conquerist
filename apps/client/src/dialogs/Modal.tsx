import type { CSSProperties, FormEvent, JSX, ReactNode } from 'react';
import { CloseButton } from './CloseButton';

/**
 * Die Huelle aller Dialoge: Kopf, Inhalt, Fussleiste.
 *
 * **Rolle:** eine Frage, die das Spiel stellt und die vor dem naechsten Zug
 * beantwortet sein will. **Aufbau:** links oben die Frage (und darunter, warum
 * sie gestellt wird), darunter die Antworten, ganz unten auf einer eigenen
 * Leiste das, was den Dialog beendet. **Das eine Element** ist die Frage - sie
 * steht deshalb gross und links, wo das Lesen anfaengt.
 *
 * **Warum es diese Huelle gibt.** Bis hierher hat jeder Dialog sein Markup
 * selbst geschrieben, und alle sahen deshalb gleich aus wie eine Vorlage: Titel
 * mittig, graue Zeile, Knoepfe mittig darunter, „Abbrechen" irgendwo zwischen
 * den Antworten. Mittig gesetzt hat nichts einen Anfang; und ein Abbrechen, das
 * neben „Spieler 2" steht, liest sich wie eine vierte Antwort. Die Huelle legt
 * die Anatomie einmal fest:
 *
 * - **Kopf** linksbuendig, mit einem Band in `tone` (Vorgabe: Tinte). Der
 *   Endstand faerbt es in der Farbe des Siegers - sonst bleibt es ruhig, denn
 *   der Held ist das Brett (Designregel 4).
 * - **Fussleiste** abgesetzt: Rueckweg links (Geisterknopf), Hauptaktion
 *   rechts. Die Reihenfolge im Markup ist die Lesereihenfolge; die Leiste
 *   schiebt nur das erste Kind nach links.
 * - Das Kreuz und `Escape` gibt es nur, wenn `onClose` da ist. Manche Fragen
 *   (Abwerfen bei der Sieben, Spionage) muessen beantwortet werden.
 *
 * Kein Fokusfang und keine Portale: die Dialoge haengen heute im Spielfeld, und
 * diese Etappe aendert ihr Aussehen, nicht ihr Verhalten.
 */
export interface ModalProps {
  /** Wie der Dialog fuer Vorlesegeraete heisst - bleibt stabil, Tests fragen danach. */
  readonly label: string;
  readonly title: ReactNode;
  /** `data-testid` an der Ueberschrift, wo ein Test ihren Text prueft. */
  readonly titleTestId?: string | undefined;
  /** Warum die Frage gestellt wird - eine Zeile unter dem Titel. */
  readonly hint?: ReactNode | undefined;
  /** Was rechts im Kopf neben dem Titel steht (der Punktestand im Endstand). */
  readonly aside?: ReactNode | undefined;
  readonly onClose?: (() => void) | undefined;
  /** Farbe des Kopfbands - eine Spielerfarbe oder eine Variable. */
  readonly tone?: string | undefined;
  /** Die Knoepfe, die den Dialog beenden; Rueckweg zuerst. */
  readonly foot?: ReactNode | undefined;
  /** Zusatzklasse am Kasten (`modal__box--over`, `modal__box--enter`). */
  readonly className?: string | undefined;
  /** Macht den Kasten zum Formular - fuer Anmelden mit Eingabetaste. */
  readonly onSubmit?: ((event: FormEvent<HTMLFormElement>) => void) | undefined;
  readonly children?: ReactNode | undefined;
}

export function Modal({
  label,
  title,
  titleTestId,
  hint,
  aside,
  onClose,
  tone,
  foot,
  className,
  onSubmit,
  children,
}: ModalProps): JSX.Element {
  const boxClass = className === undefined ? 'modal__box' : `modal__box ${className}`;
  const style = tone === undefined ? undefined : ({ '--modal-tone': tone } as CSSProperties);

  const inner = (
    <>
      <header className="modal__head">
        <div className="modal__heading">
          <h2 data-testid={titleTestId}>{title}</h2>
          {hint === undefined ? null : <p className="modal__hint">{hint}</p>}
        </div>
        {aside === undefined ? null : <div className="modal__aside">{aside}</div>}
        {onClose === undefined ? null : <CloseButton onClose={onClose} label={label} />}
      </header>

      {children === undefined ? null : <div className="modal__body">{children}</div>}

      {foot === undefined ? null : <div className="modal__foot">{foot}</div>}
    </>
  );

  return (
    <div className="modal" role="dialog" aria-label={label}>
      {onSubmit === undefined ? (
        <div className={boxClass} style={style}>
          {inner}
        </div>
      ) : (
        <form className={boxClass} style={style} onSubmit={onSubmit}>
          {inner}
        </form>
      )}
    </div>
  );
}
