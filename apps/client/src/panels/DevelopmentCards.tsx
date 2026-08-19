import type { JSX } from 'react';
import {
  DEVELOPMENT_CARD_IDS,
  type DevelopmentCard,
  type DevelopmentCardId,
} from '@conquerist/shared';
import { DevelopmentGlyph } from './DevelopmentGlyph';

/**
 * Die eigenen Entwicklungskarten, als zweite Reihe unter der Hand.
 *
 * **Sie sind jetzt Karten.** Bis hierher waren sie das einzige Kartending am
 * Tisch, das keinen Kartenkoerper hatte: ein 0.72rem grosses Textknoepfchen
 * neben Handkarten zu 4.6rem und einem Kaufstapel derselben Groesse. Das ist
 * genau das Missverhaeltnis, das der Kaufstapel schon einmal hatte und aus dem
 * er seine heutige Groesse bekam - „eine Karte ist eine Karte, und 3.1rem neben
 * 4.6rem hat aus der Bank ein Beiwerk gemacht" (`DeckPanel`). Derselbe Satz
 * gilt hier, nur schaerfer: eine Beschriftung neben einer Karte ist nicht
 * einmal mehr ein kleineres Ding, sondern gar keins.
 *
 * **Pergament statt Gelaendefarbe.** Rohstoffe kommen vom Brett,
 * Entwicklungskarten von der Bank - man soll am Material sehen, woher etwas
 * stammt, ohne die Beschriftung zu lesen. Dieselbe Stapelform und dieselbe
 * Plakette wie bei den Rohstoffen, damit die Ecke eine Ablage bleibt und nicht
 * zwei.
 *
 * **Der Name bleibt unter dem Motiv stehen**, obwohl er unter den Handkarten
 * weggefallen ist. Dort tragen Farbe und Motiv dieselbe Aussage doppelt; hier
 * sind alle fuenf dasselbe Pergament, das Motiv waere der einzige Traeger, und
 * Farbe oder Form allein duerfen nie allein tragen (Designregel 7).
 *
 * Eine Karte, die dieser Zug noch nicht hergibt, ist blass und nicht
 * anklickbar - die Regel „nicht in der Kaufrunde" wird dadurch sichtbar, statt
 * erst beim Klick als Absage aufzutauchen.
 */
export const CARD_LABELS: Readonly<Record<DevelopmentCardId, string>> = {
  knight: 'Ritter',
  roadBuilding: 'Straßenbau',
  yearOfPlenty: 'Erfindung',
  monopoly: 'Monopol',
  victoryPoint: 'Siegpunkt',
};

/** Was die Karte tut, in einem Satz - fuer den Titel beim Darueberfahren. */
const CARD_HINTS: Readonly<Record<DevelopmentCardId, string>> = {
  knight: 'Versetzt den Räuber und zählt für die Größte Rittermacht',
  roadBuilding: 'Zwei Straßen umsonst',
  yearOfPlenty: 'Zwei Rohstoffe aus der Bank',
  monopoly: 'Alle geben dir einen Rohstoff ab',
  victoryPoint: 'Zählt einen Siegpunkt — wird nie gespielt',
};

export interface DevelopmentCardsProps {
  readonly cards: readonly DevelopmentCard[];
  /** Was der Server gerade zulaesst. Alles andere liegt blass da. */
  readonly playable: readonly DevelopmentCardId[];
  readonly onPlay: (card: DevelopmentCardId) => void;
}

export function DevelopmentCards({
  cards,
  playable,
  onPlay,
}: DevelopmentCardsProps): JSX.Element | null {
  if (cards.length === 0) return null;

  const stacks = DEVELOPMENT_CARD_IDS.map((id) => ({
    id,
    amount: cards.filter((card) => card.id === id).length,
  })).filter((stack) => stack.amount > 0);

  return (
    <ol className="devcards" aria-label="Entwicklungskarten">
      {stacks.map(({ id, amount }) => (
        <li key={id}>
          {/*
           * Der Siegpunkt ist kein Knopf, und das ist keine Feinheit.
           *
           * Er wird nie gespielt - als Knopf waere er dauerhaft gesperrt, und
           * ein Bedienelement, das in keiner Lage jemals angeht, sagt „gerade
           * nicht" ueber etwas, das nie geht. Blass daliegend saehe der eigene
           * Siegpunkt ausserdem aus wie ein Fehler. Er ist Besitz und keine
           * Handlung, also liegt er einfach da.
           */}
          {id === 'victoryPoint' ? (
            <div
              className="devcard devcard--kept"
              data-testid="devcard-victoryPoint"
              title={CARD_HINTS[id]}
            >
              <Body id={id} amount={amount} />
            </div>
          ) : (
            <button
              type="button"
              className={playable.includes(id) ? 'devcard devcard--ready' : 'devcard'}
              data-testid={`devcard-${id}`}
              disabled={!playable.includes(id)}
              title={CARD_HINTS[id]}
              onClick={() => onPlay(id)}
            >
              <Body id={id} amount={amount} />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Der Kartenkoerper: Tiefe, Gesicht, Plakette - wie bei einem Handkartenstapel.
 *
 * Die Tiefe ist gedeckelt wie dort: ab vier Karten waechst der Stapel nicht
 * weiter, die genaue Zahl steht in der Plakette. Vier Ritter kommen vor, und
 * eine Ecke, die dabei nach oben auswaechst, kostet Brett.
 */
function Body({
  id,
  amount,
}: {
  readonly id: DevelopmentCardId;
  readonly amount: number;
}): JSX.Element {
  const depth = Math.min(amount, 4);

  return (
    <>
      {Array.from({ length: depth - 1 }, (_unused, index) => (
        <span
          key={index}
          className="devcard__behind"
          aria-hidden="true"
          style={{ transform: `translateY(${(index + 1) * -2.5}px)` }}
        />
      ))}

      <span className="devcard__face">
        <DevelopmentGlyph card={id} />
        <span className="devcard__name">{CARD_LABELS[id]}</span>
      </span>

      {/*
       * Die Plakette traegt die Zahl, und der Name steht sichtbar auf der
       * Karte - vorgelesen wird deshalb nur nachgereicht, was das Bild sagt.
       * Ein zweites „Ritter" im `visually-hidden` klaenge als „Ritter Ritter".
       */}
      {amount > 1 ? (
        <>
          <span className="card__count" data-testid={`devcard-count-${id}`} aria-hidden="true">
            {amount}
          </span>
          <span className="visually-hidden">{`${amount} Karten`}</span>
        </>
      ) : null}
    </>
  );
}
