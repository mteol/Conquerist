import { useState, type JSX } from 'react';
import { RESOURCE_IDS, type ResourceId } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { PlayerView } from '../game/view';

/**
 * Bankhandel.
 *
 * Der Kurs wird **abgeleitet, nicht gewaehlt**: `rateFor` kommt aus
 * `tradeRateFor`, der beste erreichbare Hafen gilt automatisch. Ein Client, der
 * sein Verhaeltnis selbst aussucht, waere genau das Ergebnis statt der Absicht,
 * die Regel 3 ausschliesst - deshalb gehen nur `give` und `receive` hinaus.
 *
 * Spielerhandel bekommt in Etappe 8 einen zweiten Reiter in genau diesem
 * Fenster.
 */
export interface TradeDialogProps {
  readonly player: PlayerView;
  readonly rateFor: (give: ResourceId) => number;
  readonly canTrade: (give: ResourceId, receive: ResourceId) => boolean;
  readonly onConfirm: (give: ResourceId, receive: ResourceId) => void;
  readonly onClose: () => void;
}

export function TradeDialog({
  player,
  rateFor,
  canTrade,
  onConfirm,
  onClose,
}: TradeDialogProps): JSX.Element {
  const [give, setGive] = useState<ResourceId | null>(null);
  const [receive, setReceive] = useState<ResourceId | null>(null);
  const ready = give !== null && receive !== null && canTrade(give, receive);

  return (
    <div className="modal" role="dialog" aria-label="Handel mit der Bank">
      <div className="modal__box">
        <h2>Handel mit der Bank</h2>
        <p className="modal__hint">
          Der Kurs ergibt sich aus deinen Haefen — der beste gilt automatisch.
        </p>

        <fieldset className="cards">
          <legend>Du gibst ab</legend>
          {RESOURCE_IDS.map((resource) => (
            <label key={resource} className="cards__choice">
              <input
                type="radio"
                name="give"
                aria-label={`${RESOURCE_LABELS[resource]} abgeben`}
                checked={give === resource}
                onChange={() => setGive(resource)}
              />
              {RESOURCE_LABELS[resource]} ({player.resources?.[resource] ?? 0})
            </label>
          ))}
        </fieldset>

        <p className="modal__rate" data-testid="rate">
          {give === null ? 'Kurs: —' : `Kurs: ${rateFor(give)}:1`}
        </p>

        <fieldset className="cards">
          <legend>Du bekommst</legend>
          {RESOURCE_IDS.map((resource) => (
            <label key={resource} className="cards__choice">
              <input
                type="radio"
                name="receive"
                aria-label={`${RESOURCE_LABELS[resource]} bekommen`}
                checked={receive === resource}
                onChange={() => setReceive(resource)}
              />
              {RESOURCE_LABELS[resource]}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className="button button--go"
          disabled={!ready}
          onClick={() => {
            if (give !== null && receive !== null) onConfirm(give, receive);
          }}
        >
          Tauschen
        </button>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
