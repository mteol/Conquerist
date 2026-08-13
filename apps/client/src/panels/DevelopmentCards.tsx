import type { JSX } from 'react';
import {
  DEVELOPMENT_CARD_IDS,
  type DevelopmentCard,
  type DevelopmentCardId,
} from '@conquerist/shared';

/**
 * Die eigenen Entwicklungskarten, als zweite Reihe in der Ablage.
 *
 * **Sie tragen Pergament statt Gelaendefarbe.** Rohstoffe kommen vom Brett,
 * Entwicklungskarten von der Bank - man soll am Material sehen, woher etwas
 * stammt, ohne die Beschriftung zu lesen. Dieselbe Stapelform wie bei den
 * Rohstoffen, damit die Ablage eine Ablage bleibt und nicht zwei.
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
      {stacks.map(({ id, amount }) => {
        const canPlay = playable.includes(id);

        return (
          <li key={id}>
            <button
              type="button"
              className={canPlay ? 'devcard devcard--ready' : 'devcard'}
              data-testid={`devcard-${id}`}
              disabled={!canPlay}
              title={CARD_HINTS[id]}
              onClick={() => onPlay(id)}
            >
              <span className="devcard__name">{CARD_LABELS[id]}</span>
              {amount > 1 ? <span className="devcard__count">{amount}</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
