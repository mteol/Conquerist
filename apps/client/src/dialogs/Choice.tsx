import type { CSSProperties, JSX, ReactNode } from 'react';

/**
 * Eine Antwort auf „wen?" oder „welche?" - eine Zeile, kein Knopf in einer Wolke.
 *
 * Die Auswahl stand als Reihe gleich aussehender Knoepfe da, die Farbe als
 * 1-px-Kante am linken Rand, und daneben „Doch nicht" in derselben Form. Als
 * Liste untereinander hat jede Antwort dieselbe Kante, dieselbe Breite und
 * ihre Zusatzangabe an derselben Stelle rechts - lesbar wie der Tisch, und der
 * Rueckweg steht in der Fussleiste und nicht mehr zwischen den Antworten.
 *
 * Die Farbe (Spieler oder Fortschrittsbereich) ist nie allein: der Name steht
 * immer daneben (Designregel 7).
 */
export interface ChoiceProps {
  /** Spielerfarbe oder Bereichsfarbe - die Marke links. */
  readonly tone: string;
  readonly name: ReactNode;
  /** Zusatz rechts: Karten auf der Hand, Siegpunkte, Stapelgroesse. */
  readonly detail?: ReactNode | undefined;
  readonly onClick: () => void;
  /**
   * Was Vorlesegeraete sagen, wenn Name und Zusatz zusammen keinen Satz ergeben
   * („Ben · 5 Siegpunkte" statt „Ben5 Siegpunkte").
   */
  readonly label?: string | undefined;
  readonly testId?: string | undefined;
}

export function Choice({ tone, name, detail, onClick, label, testId }: ChoiceProps): JSX.Element {
  return (
    <button
      type="button"
      className="choice"
      style={{ '--choice-tone': tone } as CSSProperties}
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
    >
      <span className="choice__mark" aria-hidden="true" />
      <span className="choice__name">{name}</span>
      {detail === undefined ? null : <span className="choice__detail">{detail}</span>}
    </button>
  );
}
