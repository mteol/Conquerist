import type { CSSProperties, JSX } from 'react';
import { CARD_IDS, isCommodity, type CardAmounts, type CardId } from '@conquerist/shared';
import { CARD_COLORS, CARD_LABELS } from '../game/labels';
import { CardGlyph } from './CardGlyph';

/**
 * Die eigene Hand, unten links.
 *
 * **Ein Stapel je Ressource, nicht eine Karte je Karte.** Bei drei Karten
 * saehe ein Faecher aus Einzelkarten besser aus; bei fuenfzehn muesste man
 * zaehlen, und genau dann ist die Zahl wichtig - vor dem Abwerfen. Die Plakette
 * sagt sie, die Breite bleibt gleich, und die Stapeltiefe darunter macht die
 * Menge trotzdem sichtbar, ohne dass jemand sie ablesen muesste.
 *
 * **Was es nicht gibt: eine Null.** Eine Ressource ohne Karten hat keinen
 * Stapel. Ein leeres Kartenfeld mit einer 0 kostet dieselbe Flaeche wie ein
 * volles und sagt nur, dass da nichts ist - das sagt das Fehlen besser.
 *
 * Farbe und Motiv tragen dieselbe Aussage doppelt: die Kartenfarbe ist die des
 * Gelaendes vom Brett, das Motiv zeigt, was darauf waechst. Wer Farben schlecht
 * unterscheidet, liest das Motiv; wer schnell schaut, die Farbe.
 *
 * **Handelswaren stehen zwischen den Rohstoffen und sehen anders aus.** Sie
 * haben die Farbe ihres Gelaendes - Papier kommt aus dem Wald -, aber einen
 * hellen Koerper mit farbigem Rand. Holz und Papier liegen gleichzeitig auf
 * der Hand, und vor dem Abwerfen zaehlt man sie unter Zeitdruck: zwei Karten
 * in derselben Farbe und derselben Flaeche waeren im Vorbeisehen eine.
 */
export interface HandPanelProps {
  /** `null` heisst: fremde Hand. Dann gibt es hier nichts zu zeigen. */
  readonly resources: CardAmounts | null;
  readonly cardCount: number;
  /** Zugedeckt: die Karten liegen auf dem Ruecken, die Anzahl bleibt lesbar. */
  readonly covered: boolean;
  readonly onReveal: () => void;
  /** Wessen Hand hier liegt - nur noetig, wenn das nicht selbstverstaendlich ist. */
  readonly owner?: string;
}

export function HandPanel({
  resources,
  cardCount,
  covered,
  onReveal,
  owner,
}: HandPanelProps): JSX.Element | null {
  if (resources === null) return null;

  const stacks = CARD_IDS.map((card) => ({
    card,
    amount: resources[card] ?? 0,
  })).filter((stack) => stack.amount > 0);

  return (
    <section
      className="hand"
      aria-label={owner === undefined ? 'Deine Karten' : `${owner}s Karten`}
    >
      <header className="hand__head">
        <span className="panel__title">{owner === undefined ? 'Deine Karten' : owner}</span>
        <span className="hand__total" data-testid="hand-total">
          {cardCount}
        </span>
      </header>

      {covered ? (
        <div className="hand__cover">
          <div className="hand__backs" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <button type="button" className="button button--ghost" onClick={onReveal}>
            Karten ansehen
          </button>
        </div>
      ) : stacks.length === 0 ? (
        <p className="hand__empty">Keine Karten auf der Hand.</p>
      ) : (
        <ol className="hand__stacks">
          {stacks.map(({ card, amount }) => (
            <li key={card}>
              <Stack card={card} amount={amount} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Ein Stapel.
 *
 * Die Tiefe ist gedeckelt: ab vier Karten wird der Stapel nicht mehr hoeher,
 * sonst waechst er bei einem Kornmonopol aus der Ecke heraus. Die Plakette
 * traegt die genaue Zahl - die Tiefe ist nur der schnelle Eindruck.
 *
 * **Der Versatz steht als Zahl da und nicht als fertige Verschiebung.** Er war
 * ein `transform` im `style`-Attribut, und ein Inline-Stil laesst sich aus dem
 * Blatt nicht mehr ueberschreiben - eine Faecherregel beim Darueberfahren waere
 * wirkungslos geblieben und haette wie ein kaputtes `:hover` ausgesehen. Genau
 * die Falle steht in `CLAUDE.md` in der anderen Richtung (eine CSS-Regel
 * schlaegt ein SVG-Attribut); hier gewinnt der Inline-Stil, das Ergebnis ist
 * dasselbe: eine Regel, die dasteht und nie greift. Uebergeben wird deshalb
 * nur `--i`, die Lage im Stapel; **was** damit geschieht, entscheidet
 * `.card__behind` in `index.css`.
 */
function Stack({ card, amount }: { readonly card: CardId; readonly amount: number }): JSX.Element {
  const depth = Math.min(amount, 4);
  const ware = isCommodity(card);

  return (
    <div
      className={ware ? 'card card--ware' : 'card'}
      data-testid={`stack-${card}`}
      title={CARD_LABELS[card]}
    >
      {Array.from({ length: depth - 1 }, (_unused, index) => (
        <span
          key={index}
          className="card__behind"
          aria-hidden="true"
          /*
           * Bei der Handelsware **kein** Hintergrund von hier: sie kommt aus
           * dem Blatt (`.card--ware .card__behind`). Beides zu setzen hiesse,
           * die Regel mit `!important` gegen den Inline-Stil durchzudruecken -
           * und ein Blatt, das gegen sein eigenes Bauteil kaempft, ist die
           * Falle aus `CLAUDE.md` in der zweiten Richtung.
           */
          style={
            ware
              ? ({ '--i': index + 1 } as CSSProperties)
              : ({ background: CARD_COLORS[card], '--i': index + 1 } as CSSProperties)
          }
        />
      ))}

      {/*
       * Bei der Handelsware faerbt die Gelaendefarbe den Rand, bei einem
       * Rohstoff die Flaeche. Beides per `style`: eine Regel im Blatt kann die
       * Farbe nicht kennen.
       */}
      <span
        className="card__face"
        style={
          ware
            ? ({ '--ware-edge': CARD_COLORS[card] } as CSSProperties)
            : { background: CARD_COLORS[card] }
        }
      >
        <CardGlyph card={card} />
      </span>

      <span className="card__count" aria-hidden="true">
        {amount}
      </span>

      {/*
       * Der Name steht nicht mehr unter der Karte - dieselbe Entscheidung wie
       * bei den Bauteilen im Vorrat: er beschriftete ein Bild, das schon
       * spricht (Gelaendefarbe plus Motiv), und kostete unter jeder Karte eine
       * Zeile, die dem Brett an Hoehe abging. Fuer Vorlesewerkzeuge steht er
       * hier weiter, zusammen mit der Menge; sichtbar bleibt er im `title`.
       */}
      <span className="visually-hidden">{`${amount} ${CARD_LABELS[card]}`}</span>
    </div>
  );
}
