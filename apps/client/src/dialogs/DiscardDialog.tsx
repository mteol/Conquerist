import { useState, type JSX } from 'react';
import { EMPTY_CARDS, RESOURCE_IDS, type CardAmounts, type ResourceId } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import { ResourceCard } from '../panels/ResourceCard';
import type { PlayerRow } from '../game/view';

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
  readonly player: PlayerRow;
  readonly required: number;
  readonly onConfirm: (resources: CardAmounts) => void;
}

export function DiscardDialog({ player, required, onConfirm }: DiscardDialogProps): JSX.Element {
  const [chosen, setChosen] = useState<CardAmounts>({ ...EMPTY_CARDS });
  const held = player.resources ?? EMPTY_CARDS;
  const total = RESOURCE_IDS.reduce((sum, resource) => sum + (chosen[resource] ?? 0), 0);

  /**
   * Ob dieser Schritt ueberhaupt etwas taete.
   *
   * **Eine Regel und nicht zwei.** Sie stand bis hierher nur im Handler: der
   * Knopf sah in jeder Lage bedienbar aus, klemmte aber lautlos, sobald nichts
   * mehr ging - bei einer Sorte, von der man nichts hat („von 0"), tat das `+`
   * ueberhaupt nie etwas. Ein Bedienelement, das nichts bewirkt, muss das
   * zeigen; dieselbe Ueberlegung wie beim Siegpunkt, der kein Knopf mehr ist.
   * Damit Knopfzustand und Wirkung nicht auseinanderlaufen koennen, fragen
   * beide dieselbe Funktion.
   */
  const canStep = (resource: ResourceId, delta: number): boolean => {
    const next = (chosen[resource] ?? 0) + delta;
    if (next < 0 || next > (held[resource] ?? 0)) return false;
    // Nach oben ist auch die geforderte Zahl eine Grenze: wer vier von vier
    // gewaehlt hat, ist fertig, und das sagen die toten Knoepfe mit.
    return !(delta > 0 && total >= required);
  };

  const change = (resource: ResourceId, delta: number): void => {
    if (!canStep(resource, delta)) return;
    setChosen((current) => ({ ...current, [resource]: (current[resource] ?? 0) + delta }));
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
              <ResourceCard resource={resource} held={held[resource] ?? 0} />
              <div className="cards__stepper">
                <button
                  type="button"
                  aria-label={`${RESOURCE_LABELS[resource]} weniger`}
                  data-sound="card"
                  disabled={!canStep(resource, -1)}
                  onClick={() => change(resource, -1)}
                >
                  −
                </button>
                <span data-testid={`chosen-${resource}`}>{chosen[resource] ?? 0}</span>
                <button
                  type="button"
                  aria-label={`${RESOURCE_LABELS[resource]} mehr`}
                  data-sound="card"
                  disabled={!canStep(resource, 1)}
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
