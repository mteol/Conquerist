import { useState, type CSSProperties, type JSX } from 'react';
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

/**
 * Was die Karte tut, in einem Satz.
 *
 * **Er stand im `title` und war damit praktisch nicht da.** Ein
 * Browser-Kurzhinweis kommt nach rund einer Sekunde Stillstand, in der Schrift
 * des Betriebssystems, an der Mausspitze - und auf einer gesperrten Karte in
 * den meisten Browsern gar nicht. Ausgerechnet die gesperrte Karte ist die,
 * bei der man nachliest, was sie kann: die spielbare drueckt man einfach.
 * Der Satz steht deshalb jetzt als Zeile ueber der Reihe (`Hint`).
 */
const CARD_HINTS: Readonly<Record<DevelopmentCardId, string>> = {
  knight: 'Versetzt den Räuber und zählt für die Größte Rittermacht',
  roadBuilding: 'Zwei Straßen umsonst',
  yearOfPlenty: 'Zwei Rohstoffe aus der Bank',
  monopoly: 'Alle geben dir einen Rohstoff ab',
  victoryPoint: 'Zählt einen Siegpunkt — wird nie gespielt',
};

/** Die Id, unter der eine Karte ihren Satz fuer Vorlesewerkzeuge ablegt. */
function hintId(card: DevelopmentCardId): string {
  return `devcard-hint-${card}`;
}

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
  /**
   * Welche Karte gerade erklaert wird.
   *
   * Der Zustand haengt an der Reihe und nicht an der Karte, weil die Zeile
   * **eine** ist: fuenf eigene Zettel nebeneinander waeren fuenf Dinge, die um
   * dieselbe Stelle streiten, und der letzte haette den vorletzten verdeckt.
   */
  const [described, setDescribed] = useState<DevelopmentCardId | null>(null);

  if (cards.length === 0) return null;

  const stacks = DEVELOPMENT_CARD_IDS.map((id) => ({
    id,
    amount: cards.filter((card) => card.id === id).length,
  })).filter((stack) => stack.amount > 0);

  const show = (id: DevelopmentCardId) => () => setDescribed(id);
  const hide = (id: DevelopmentCardId) => () =>
    setDescribed((current) => (current === id ? null : current));

  return (
    <div className="devcards">
      {described === null ? null : <Hint card={described} />}

      <ol className="devcards__row" aria-label="Entwicklungskarten">
        {stacks.map(({ id, amount }) => (
          /*
           * Zeigen und Verbergen haengen am Listeneintrag, nicht am Knopf.
           *
           * Ein gesperrter Knopf feuert keine Mausereignisse - und die
           * gesperrte Karte ist genau die, deren Satz man lesen will. Die
           * Huelle darum ist nie gesperrt und bekommt sie alle.
           *
           * `onFocus` und `onBlur` stehen daneben, weil eine Erklaerung, die
           * nur die Maus findet, fuer die Tastatur nicht existiert. Sie steigen
           * in React auf (`focusin`/`focusout`) und fangen den Knopf darin mit.
           */
          <li
            key={id}
            onPointerEnter={show(id)}
            onPointerLeave={hide(id)}
            onFocus={show(id)}
            onBlur={hide(id)}
          >
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
                aria-describedby={hintId(id)}
              >
                <Body id={id} amount={amount} />
              </div>
            ) : (
              <button
                type="button"
                className={playable.includes(id) ? 'devcard devcard--ready' : 'devcard'}
                data-testid={`devcard-${id}`}
                disabled={!playable.includes(id)}
                aria-describedby={hintId(id)}
                onClick={() => onPlay(id)}
              >
                <Body id={id} amount={amount} />
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Die Erklaerzeile ueber der Reihe.
 *
 * **Sie steht ueber den Karten und nicht an ihnen.** Ein Zettel an der Karte
 * waere 4.6rem breit - „Versetzt den Räuber und zählt für die Größte
 * Rittermacht" braucht dort fuenf Zeilen und deckt dabei die Nachbarkarten zu.
 * Ueber der Reihe hat der Satz die ganze Breite der Ecke und verdeckt nichts,
 * was man gerade vergleicht.
 *
 * **Sie kostet keine Zeile im Layout.** Absolut gesetzt, ueber der Reihe: die
 * Karten ruecken nicht, wenn sie kommt und geht. Eine Erklaerung, die den
 * Stapel verschiebt, den man gerade anfassen will, ist ein Schuss ins eigene
 * Knie - man faehrt hin, die Reihe rutscht weg, und der Zeiger steht ueber
 * einer anderen Karte.
 *
 * Der Name steht davor, weil der Satz sonst nicht sagt, worueber er redet:
 * fuenf Karten liegen nebeneinander, und der Zeiger ist eine Handbreit von der
 * Zeile entfernt.
 */
function Hint({ card }: { readonly card: DevelopmentCardId }): JSX.Element {
  return (
    <p className="devcards__hint" data-testid="devcard-hint" aria-hidden="true">
      <span className="devcards__hint-name">{CARD_LABELS[card]}</span>
      <span className="devcards__hint-text">{CARD_HINTS[card]}</span>
    </p>
  );
}

/**
 * Der Kartenkoerper: Tiefe, Gesicht, Plakette - wie bei einem Handkartenstapel.
 *
 * Die Tiefe ist gedeckelt wie dort: ab vier Karten waechst der Stapel nicht
 * weiter, die genaue Zahl steht in der Plakette. Vier Ritter kommen vor, und
 * eine Ecke, die dabei nach oben auswaechst, kostet Brett.
 *
 * **Der Versatz kommt als Zahl und nicht als fertige Verschiebung** - derselbe
 * Grund wie beim Handkartenstapel: ein `transform` im `style` schlaegt jede
 * Regel im Blatt, und die Faecherung beim Darueberfahren waere eine Regel
 * gewesen, die dasteht und nie greift.
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
          style={{ '--i': index + 1 } as CSSProperties}
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

      {/*
       * Derselbe Satz wie in der Erklaerzeile, hier fuer Vorlesewerkzeuge.
       *
       * Er haengt an der Karte und nicht am Zeiger: was nur beim
       * Darueberfahren erscheint, gibt es fuer eine Tastatur nicht, und fuer
       * eine gesperrte Karte gibt es nicht einmal das Darueberfahren.
       */}
      <span id={hintId(id)} className="visually-hidden">
        {CARD_HINTS[id]}
      </span>
    </>
  );
}
