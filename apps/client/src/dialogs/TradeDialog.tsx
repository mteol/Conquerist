import { useState, type JSX } from 'react';
import {
  EMPTY_RESOURCES,
  RESOURCE_IDS,
  type ResourceAmounts,
  type ResourceId,
} from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { PlayerRow } from '../game/view';
import { ResourceCard } from '../panels/ResourceCard';
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
              Der Kurs ergibt sich aus deinen Häfen — der beste gilt automatisch.
            </p>

            <fieldset className="cards">
              <legend>Du gibst ab</legend>
              {RESOURCE_IDS.map((resource) => (
                <Choice
                  key={resource}
                  resource={resource}
                  group="give"
                  action="abgeben"
                  held={player.resources?.[resource] ?? 0}
                  checked={give === resource}
                  onPick={() => setGive(resource)}
                />
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
                <Choice
                  key={resource}
                  resource={resource}
                  group="receive"
                  action="bekommen"
                  held={null}
                  checked={receive === resource}
                  onPick={() => setReceive(resource)}
                />
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

/**
 * Eine Sorte zur Auswahl - als Karte, nicht als Punkt neben einem Wort.
 *
 * **Der Bankhandel war die einzige Stelle, an der ein Rohstoff keine Farbe
 * hatte.** Auf der Hand ist er eine Karte in der Gelaendefarbe mit seinem
 * Motiv, in „Erfindung" und „Monopol" ebenso (`ResourcePickDialog`) - hier
 * standen fuenf gleiche beigefarbene Pillen mit Text darin, und wer schnell
 * hinsah, unterschied sie nicht. Dieselbe Sache muss ueberall gleich aussehen,
 * sonst ist es nicht mehr dieselbe Sache.
 *
 * **Das Feld bleibt ein `radio`.** Ausgeblendet wird nur seine Zeichnung, nicht
 * das Feld: die Gruppe ist damit weiter mit Pfeiltasten bedienbar und meldet
 * sich als das, was sie ist. Die Karte darum ist das `label` - ein Klick
 * irgendwo darauf waehlt aus.
 *
 * **Die Zeile fuer den Bestand steht immer da, auch leer.** Beim Abgeben zaehlt,
 * was man hat; beim Bekommen sagt die Zahl nichts. Ohne die leere Zeile waeren
 * die zwei Reihen verschieden hoch - derselbe Grund, aus dem die Aufforderung
 * unter den Wuerfeln auch dann dasteht, wenn sie leer ist.
 */
function Choice({
  resource,
  group,
  action,
  held,
  checked,
  onPick,
}: {
  readonly resource: ResourceId;
  readonly group: 'give' | 'receive';
  readonly action: 'abgeben' | 'bekommen';
  /** Wieviele davon auf der Hand liegen - `null`, wo das nichts zur Sache tut. */
  readonly held: number | null;
  readonly checked: boolean;
  readonly onPick: () => void;
}): JSX.Element {
  return (
    // `data-sound`, weil ein `label` kein Knopf ist: der delegierte Klick in
    // `useAudio` hoerte sonst nichts davon, und die Karte bliebe stumm,
    // waehrend jeder Knopf daneben klickt.
    <label className="cards__choice" data-sound="card">
      <input
        type="radio"
        name={group}
        className="visually-hidden"
        aria-label={`${RESOURCE_LABELS[resource]} ${action}`}
        checked={checked}
        onChange={onPick}
      />

      <ResourceCard resource={resource} held={held} />
    </label>
  );
}
