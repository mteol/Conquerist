import { useState, type JSX } from 'react';
import {
  EMPTY_RESOURCES,
  RESOURCE_IDS,
  type ResourceAmounts,
  type ResourceId,
} from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { PlayerView } from '../game/view';

/**
 * Abwerfen nach einer Sieben.
 *
 * `legalActions` zaehlt diese Aktion bewusst nicht auf - bei acht Handkarten
 * gaebe es dutzende gueltige Kombinationen. Der Dialog stellt eine davon
 * zusammen und gibt genau die gewaehlten Karten zurueck; ob die Zahl stimmt,
 * prueft am Ende trotzdem `applyDiscard`. Die Sperre am Knopf ist Bedienkomfort,
 * nicht die Regel.
 *
 * Sichtbar ist der Dialog nur fuer den Betroffenen. Was noch fehlt, damit es
 * weitergeht, steht fuer alle im Status- und Aktionspanel.
 */
export interface DiscardDialogProps {
  readonly player: PlayerView;
  readonly required: number;
  readonly onConfirm: (resources: ResourceAmounts) => void;
}

export function DiscardDialog({ player, required, onConfirm }: DiscardDialogProps): JSX.Element {
  const [chosen, setChosen] = useState<ResourceAmounts>({ ...EMPTY_RESOURCES });
  const held = player.resources ?? EMPTY_RESOURCES;
  const total = RESOURCE_IDS.reduce((sum, resource) => sum + (chosen[resource] ?? 0), 0);

  const change = (resource: ResourceId, delta: number): void => {
    setChosen((current) => {
      const next = (current[resource] ?? 0) + delta;
      if (next < 0 || next > (held[resource] ?? 0)) return current;

      const sum = RESOURCE_IDS.reduce((count, id) => count + (current[id] ?? 0), 0);
      if (delta > 0 && sum >= required) return current;

      return { ...current, [resource]: next };
    });
  };

  return (
    <div className="modal" role="dialog" aria-label={`${player.name} wirft ab`}>
      <div className="modal__box">
        <h2>
          {player.name}, wirf {required} Karten ab
        </h2>
        <p className="modal__hint">
          Nur du siehst dieses Fenster. {player.cardCount} Karten auf der Hand.
        </p>

        <div className="cards">
          {RESOURCE_IDS.map((resource) => (
            <div key={resource} className="cards__item">
              <span className="cards__label">{RESOURCE_LABELS[resource]}</span>
              <span className="cards__held">von {held[resource] ?? 0}</span>
              <div className="cards__stepper">
                <button
                  type="button"
                  aria-label={`${RESOURCE_LABELS[resource]} weniger`}
                  onClick={() => change(resource, -1)}
                >
                  −
                </button>
                <span data-testid={`chosen-${resource}`}>{chosen[resource] ?? 0}</span>
                <button
                  type="button"
                  aria-label={`${RESOURCE_LABELS[resource]} mehr`}
                  onClick={() => change(resource, 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="button button--go"
          disabled={total !== required}
          onClick={() => onConfirm(chosen)}
        >
          Abwerfen ({total}/{required})
        </button>
      </div>
    </div>
  );
}
