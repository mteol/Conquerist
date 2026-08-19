import { useState, type JSX } from 'react';
import { RESOURCE_IDS, type ResourceId } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import { ResourceCard } from '../panels/ResourceCard';
import { CloseButton } from './CloseButton';

/**
 * Rohstoffe auswaehlen - fuer Erfindung und Monopol.
 *
 * Eine Komponente fuer beide, weil es dieselbe Frage ist: welche Sorte, und
 * wie oft. Erfindung nimmt zwei (auch zweimal dieselbe), Monopol genau eine.
 * Zwei fast gleiche Dialoge waeren zwei Orte, an denen dieselbe Auswahl
 * auseinanderlaufen kann.
 *
 * Wie beim Abwerfen trifft der Spieler die Auswahl selbst, und `legalActions`
 * zaehlt sie deshalb nicht auf. Die Sperre am Knopf ist Bedienkomfort - ob die
 * Wahl zulaessig war, prueft der Reducer.
 */
export interface ResourcePickDialogProps {
  readonly title: string;
  readonly hint: string;
  /** Wie viele Karten gewaehlt werden - 2 bei Erfindung, 1 beim Monopol. */
  readonly count: number;
  readonly onConfirm: (picks: readonly ResourceId[]) => void;
  readonly onClose: () => void;
}

export function ResourcePickDialog({
  title,
  hint,
  count,
  onConfirm,
  onClose,
}: ResourcePickDialogProps): JSX.Element {
  const [picks, setPicks] = useState<readonly ResourceId[]>([]);

  return (
    <div className="modal" role="dialog" aria-label={title}>
      <div className="modal__box">
        <CloseButton onClose={onClose} label={title} />
        <h2>{title}</h2>
        <p className="modal__hint">{hint}</p>

        <div className="pick">
          {RESOURCE_IDS.map((resource) => (
            <button
              key={resource}
              type="button"
              className="pick__card"
              data-testid={`pick-${resource}`}
              data-sound="card"
              disabled={picks.length >= count}
              aria-label={RESOURCE_LABELS[resource]}
              onClick={() => setPicks((current) => [...current, resource])}
            >
              <ResourceCard resource={resource} />
            </button>
          ))}
        </div>

        <p className="pick__chosen" data-testid="pick-chosen">
          {picks.length === 0
            ? 'Noch nichts gewählt.'
            : picks.map((pick) => RESOURCE_LABELS[pick]).join(' + ')}
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
