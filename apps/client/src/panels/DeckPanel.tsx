import type { JSX } from 'react';

/**
 * Der Entwicklungsstapel - als Stapel, nicht als Knopf mit Beschriftung.
 *
 * **Rolle:** die Bank, soweit sie auf dem Tisch liegt. Man kauft dort eine
 * Karte, und das war bis hierher ein Knopf mit der Aufschrift „Karte kaufen"
 * zwischen zwei anderen Knoepfen - dieselbe Form wie „Handel" und „Zug
 * beenden", obwohl es das einzige Spielmaterial unter ihnen ist.
 *
 * **Aufbau:** drei versetzte Kartenruecken, darauf die Zahl, die noch im
 * Stapel liegt. Dieselbe Stapelform wie bei den Handkarten, damit die Ablage
 * eine Ablage bleibt: was aussieht wie ein Stapel, ist einer.
 *
 * **Woran man sich erinnert:** dass der Stapel duenner wird. Die Zahl steht
 * daneben, weil man sie vergleicht; die Tiefe ist der schnelle Eindruck. Ist er
 * leer, bleibt er stehen und sagt das - ein verschwundener Stapel saehe aus wie
 * ein Anzeigefehler.
 *
 * **Der Ruecken traegt kein Motiv.** Was auf einer Entwicklungskarte steht,
 * weiss beim Kauf niemand, auch der Kaeufer nicht - ein Ritter oder ein
 * Fragezeichen auf dem Ruecken waere ein Versprechen, das der Stapel nicht
 * halten kann.
 */
export interface DeckPanelProps {
  /** Wie viele Karten der Stapel noch hergibt. */
  readonly left: number;
  /**
   * Ob der Kauf jetzt geht - kommt aus der Aktionsliste, nicht aus einer
   * eigenen Rechnung ueber Karten und Kosten.
   */
  readonly canBuy: boolean;
  readonly onBuy: () => void;
}

export function DeckPanel({ left, canBuy, onBuy }: DeckPanelProps): JSX.Element {
  return (
    <section className="deck" aria-label="Entwicklungskarten kaufen">
      <button
        type="button"
        className={canBuy ? 'deck__pile deck__pile--ready' : 'deck__pile'}
        data-testid="deck-buy"
        disabled={!canBuy}
        title={left === 0 ? 'Der Stapel ist leer' : `Noch ${left} Karten im Stapel`}
        onClick={onBuy}
      >
        {/*
         * Die Ruecken darunter sind Beiwerk und tragen nichts: die Zahl sagt,
         * wie viele es sind. Ab drei waechst der Stapel nicht weiter, sonst
         * waere er am Anfang der Partie so hoch wie die Leiste daneben.
         */}
        <span className="deck__backs" aria-hidden="true">
          {Array.from({ length: Math.min(left, 3) }, (_unused, index) => (
            <span key={index} style={{ transform: `translate(${index * 2}px, ${index * -2}px)` }} />
          ))}
        </span>

        <span className="deck__count" data-testid="deck-left">
          {left}
        </span>
      </button>

      <span className="deck__label">{left === 0 ? 'Stapel leer' : 'Karte kaufen'}</span>
    </section>
  );
}
