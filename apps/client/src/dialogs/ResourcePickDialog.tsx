import { useState, type JSX } from 'react';
import { CARD_LABELS, type CardId } from '@conquerist/shared';
import { ResourceCard } from '../panels/ResourceCard';
import { CloseButton } from './CloseButton';

/**
 * Sorten auswaehlen - fuer Erfindung, Monopol, und seit Staedte & Ritter auch
 * fuer Rohstoffmonopol, Handelsmonopol, Handelsflotte und das Aquaedukt.
 *
 * Eine Komponente fuer alle, weil es immer dieselbe Frage ist: welche Sorte,
 * und wie oft. Erfindung nimmt zwei (auch zweimal dieselbe), Monopol genau
 * eine. Zwei fast gleiche Dialoge waeren zwei Orte, an denen dieselbe Auswahl
 * auseinanderlaufen kann.
 *
 * **Die Auswahlmenge ist eine Eigenschaft, keine Konstante mehr (Ruling 28).**
 * `resourceMonopoly` fragt ueber fuenf Rohstoffe, `commodityMonopoly` ueber
 * drei Handelswaren, `merchantFleet` ueber alle acht Sorten - drei
 * verschiedene Wertemengen fuer dieselbe Frage. Statt drei fast gleicher
 * Dialoge bekommt dieser hier seine Menge als `pool` herein; `T extends
 * CardId` haelt dabei den genauen Typ der Aufrufer fest (`ResourceId[]` bei
 * Erfindung und Monopol, `CommodityId[]` beim Handelsmonopol, `CardId[]` bei
 * der Handelsflotte).
 *
 * Wie beim Abwerfen trifft der Spieler die Auswahl selbst, und `legalActions`
 * zaehlt sie deshalb nicht auf. Die Sperre am Knopf ist Bedienkomfort - ob die
 * Wahl zulaessig war, prueft der Reducer.
 */
export interface ResourcePickDialogProps<T extends CardId = CardId> {
  readonly title: string;
  readonly hint: string;
  /** Aus welcher Menge gewaehlt wird - siehe Kopfkommentar. */
  readonly pool: readonly T[];
  /** Wie viele Karten gewaehlt werden - 2 bei Erfindung, sonst 1. */
  readonly count: number;
  readonly onConfirm: (picks: readonly T[]) => void;
  readonly onClose: () => void;
}

export function ResourcePickDialog<T extends CardId = CardId>({
  title,
  hint,
  pool,
  count,
  onConfirm,
  onClose,
}: ResourcePickDialogProps<T>): JSX.Element {
  const [picks, setPicks] = useState<readonly T[]>([]);

  return (
    <div className="modal" role="dialog" aria-label={title}>
      <div className="modal__box">
        <CloseButton onClose={onClose} label={title} />
        <h2>{title}</h2>
        <p className="modal__hint">{hint}</p>

        <div className="pick">
          {pool.map((card) => (
            <button
              key={card}
              type="button"
              className="pick__card"
              data-testid={`pick-${card}`}
              data-sound="card"
              disabled={picks.length >= count}
              aria-label={CARD_LABELS[card]}
              onClick={() => setPicks((current) => [...current, card])}
            >
              <ResourceCard card={card} />
            </button>
          ))}
        </div>

        <p className="pick__chosen" data-testid="pick-chosen">
          {picks.length === 0
            ? 'Noch nichts gewählt.'
            : picks.map((pick) => CARD_LABELS[pick]).join(' + ')}
        </p>

        <div className="modal__buttons">
          <button
            type="button"
            className="button button--ghost"
            disabled={picks.length === 0}
            onClick={() => setPicks([])}
          >
            Auswahl zurücksetzen
          </button>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="button button--go"
            disabled={picks.length !== count}
            onClick={() => onConfirm(picks)}
          >
            Karte spielen
          </button>
        </div>
      </div>
    </div>
  );
}
