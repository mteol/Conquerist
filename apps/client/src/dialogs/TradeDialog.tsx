import { useState, type JSX } from 'react';
import {
  EMPTY_RESOURCES,
  RESOURCE_IDS,
  type ResourceAmounts,
  type ResourceId,
} from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { PlayerRow } from '../game/view';
import { CloseButton } from './CloseButton';
import { NO_AMOUNTS, TradeAmounts, isTradeShapeValid } from './TradeAmounts';

/**
 * Handel - zwei Reiter, zwei Gegenueber.
 *
 * **Bank:** Der Kurs wird abgeleitet, nicht gewaehlt: `rateFor` kommt aus
 * `tradeRateFor`, der beste erreichbare Hafen gilt automatisch. Ein Client, der
 * sein Verhaeltnis selbst aussucht, waere genau das Ergebnis statt der Absicht,
 * die Regel 3 ausschliesst - deshalb gehen nur `give` und `receive` hinaus.
 *
 * **Spieler:** Mengen auf beiden Seiten, frei gewaehlt. Aufgezaehlt werden kann
 * das nicht (jede Kombination ueber fuenf Sorten waeren Tausende Eintraege),
 * deshalb sagt `canOffer` nur, ob ueberhaupt angeboten werden darf - geprueft
 * wird die Form am Ende im Reducer.
 */
export interface TradeDialogProps {
  readonly player: PlayerRow;
  readonly rateFor: (give: ResourceId) => number;
  readonly canTrade: (give: ResourceId, receive: ResourceId) => boolean;
  /** Ob der Spieler jetzt ueberhaupt ein Angebot machen duerfte. */
  readonly canOffer: boolean;
  readonly onOffer: (give: ResourceAmounts, want: ResourceAmounts) => void;
  readonly onConfirm: (give: ResourceId, receive: ResourceId) => void;
  readonly onClose: () => void;
}

type Tab = 'bank' | 'player';

export function TradeDialog({
  player,
  rateFor,
  canTrade,
  canOffer,
  onOffer,
  onConfirm,
  onClose,
}: TradeDialogProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('bank');
  const [give, setGive] = useState<ResourceId | null>(null);
  const [receive, setReceive] = useState<ResourceId | null>(null);
  const [offerGive, setOfferGive] = useState<ResourceAmounts>(NO_AMOUNTS);
  const [offerWant, setOfferWant] = useState<ResourceAmounts>(NO_AMOUNTS);

  const ready = give !== null && receive !== null && canTrade(give, receive);
  const offerReady = isTradeShapeValid(offerGive, offerWant);

  return (
    <div className="modal" role="dialog" aria-label="Handel">
      <div className="modal__box">
        <CloseButton onClose={onClose} label="Handel" />
        <h2>Handel</h2>

        {canOffer ? (
          <div className="tabs" role="tablist" aria-label="Mit wem">
            <button
              type="button"
              role="tab"
              className="tabs__tab"
              aria-selected={tab === 'bank'}
              onClick={() => setTab('bank')}
            >
              Bank
            </button>
            <button
              type="button"
              role="tab"
              className="tabs__tab"
              aria-selected={tab === 'player'}
              onClick={() => setTab('player')}
            >
              Spieler
            </button>
          </div>
        ) : null}

        {tab === 'bank' ? (
          <>
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
              {give === null ? (
                'Kurs: —'
              ) : (
                <>
                  Kurs: <b>{rateFor(give)}:1</b>
                </>
              )}
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
          </>
        ) : (
          <>
            <p className="modal__hint">
              Solange dein Angebot liegt, wartet dein Zug. Antworten kann jeder am Tisch.
            </p>

            <TradeAmounts
              owned={player.resources ?? EMPTY_RESOURCES}
              give={offerGive}
              want={offerWant}
              onGive={setOfferGive}
              onWant={setOfferWant}
            />

            <button
              type="button"
              className="button button--go"
              disabled={!offerReady}
              onClick={() => onOffer(offerGive, offerWant)}
            >
              Angebot auf den Tisch legen
            </button>
          </>
        )}

        <button type="button" className="button button--ghost" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
