import { useEffect, useState, type JSX } from 'react';
import {
  EMPTY_RESOURCES,
  resourceList,
  type GameAction,
  type PlayerView,
  type ResourceAmounts,
  type TradeResponse,
} from '@conquerist/shared';
import { NO_AMOUNTS, TradeAmounts, isTradeShapeValid } from './TradeAmounts';

/**
 * Das Angebot, das auf dem Tisch liegt.
 *
 * Kein Knopf davor: solange die Phase `tradePending` ist, geht ohnehin nichts
 * anderes - der Dialog **ist** der Zustand und nicht eine Ansicht davon.
 *
 * Zwei Rollen in einer Datei, unterschieden ueber `offer.from === view.you`.
 * Sie teilen sich Angebotstext, Uhr und Rahmen; sie zu trennen hiesse, all das
 * zweimal zu haben.
 *
 * Ein Knopf ist genau dann bedienbar, wenn die zugehoerige Aktion in `actions`
 * steht. Der Client rechnet keine Regel nach - fehlt das Annehmen, weiss er
 * nur, **dass** es fehlt, und sagt den einen Grund, der dafuer in Frage kommt.
 */
export interface TradeOfferDialogProps {
  readonly view: PlayerView;
  readonly actions: readonly GameAction[];
  /**
   * Serveruhr minus eigene Uhr, aus `sentAt` gerechnet.
   *
   * Ohne ihn zeigte eine falsch gehende Rechneruhr eine Frist, die laengst
   * abgelaufen ist - oder eine, die nie endet. Lokal ist er null.
   */
  readonly clockOffset: number;
  readonly onAct: (action: GameAction) => void;
}

/** Verbleibende Sekunden, nie negativ. */
function secondsLeft(expiresAt: number, offset: number): number {
  return Math.max(0, Math.ceil((expiresAt - (Date.now() + offset)) / 1000));
}

/**
 * Was in der Antwortliste steht - Wort und Zeichen, nie nur eine Farbe.
 *
 * Die automatische Ablehnung wird als das benannt, was sie ist. Verraten wird
 * damit nichts: dass jemand weg ist, steht ohnehin in `connected`, und wer
 * zurueckkommt, verliert diese Ablehnung wieder.
 */
function answerText(answer: TradeResponse | undefined): { mark: string; text: string } {
  if (answer === undefined) return { mark: '…', text: 'ueberlegt noch' };
  if (answer.kind === 'accepted') return { mark: '✓', text: 'nimmt an' };
  if (answer.kind === 'declined') {
    return answer.automatic
      ? { mark: '⚠', text: 'ist gerade nicht da' }
      : { mark: '✗', text: 'lehnt ab' };
  }

  return {
    mark: '⇄',
    text: `bietet ${resourceList(answer.give)} fuer ${resourceList(answer.want)}`,
  };
}

export function TradeOfferDialog({
  view,
  actions,
  clockOffset,
  onAct,
}: TradeOfferDialogProps): JSX.Element | null {
  const trade = view.phase.kind === 'tradePending' ? view.phase : null;
  const expiresAt = trade?.expiresAt ?? 0;

  const [left, setLeft] = useState(() => secondsLeft(expiresAt, clockOffset));
  const [counterGive, setCounterGive] = useState<ResourceAmounts>(NO_AMOUNTS);
  const [counterWant, setCounterWant] = useState<ResourceAmounts>(NO_AMOUNTS);
  const [countering, setCountering] = useState(false);

  useEffect(() => {
    setLeft(secondsLeft(expiresAt, clockOffset));
    const handle = setInterval(() => {
      setLeft(secondsLeft(expiresAt, clockOffset));
    }, 1000);

    return () => {
      clearInterval(handle);
    };
  }, [expiresAt, clockOffset]);

  if (trade === null) return null;

  const nameOf = (id: string): string =>
    view.players.find((player) => player.id === id)?.name ?? id;
  const mine = trade.offer.from === view.you;
  const me = view.players.find((player) => player.id === view.you);

  const find = (match: (action: GameAction) => boolean): GameAction | undefined =>
    actions.find(match);

  const accept = find((action) => action.type === 'respondTrade' && action.response === 'accepted');
  const decline = find(
    (action) => action.type === 'respondTrade' && action.response === 'declined',
  );
  const withdraw = find((action) => action.type === 'withdrawTrade');

  return (
    <div className="modal" role="dialog" aria-label="Angebot auf dem Tisch">
      <div className="modal__box modal__box--enter">
        <h2>{mine ? 'Dein Angebot liegt' : `${nameOf(trade.offer.from)} bietet an`}</h2>

        <p className="offer__terms">
          <b>{resourceList(trade.offer.give)}</b> fuer <b>{resourceList(trade.offer.want)}</b>
        </p>

        <p className="offer__clock" data-testid="offer-clock">
          Noch <b>{left}</b> Sekunden
        </p>

        {mine ? (
          <>
            <ul className="offer__answers">
              {view.players
                .filter((player) => player.id !== trade.offer.from)
                .map((player) => {
                  const answer = answerText(trade.responses[player.id]);
                  const deal = find(
                    (action) => action.type === 'acceptTrade' && action.partner === player.id,
                  );

                  return (
                    <li key={player.id} className="offer__answer">
                      <span aria-hidden="true">{answer.mark}</span>
                      <span>
                        {player.name} {answer.text}
                      </span>
                      {deal === undefined ? null : (
                        <button
                          type="button"
                          className="button button--go"
                          onClick={() => onAct(deal)}
                        >
                          Mit {player.name} tauschen
                        </button>
                      )}
                    </li>
                  );
                })}
            </ul>

            <button
              type="button"
              className="button button--ghost"
              disabled={withdraw === undefined}
              onClick={() => {
                if (withdraw !== undefined) onAct(withdraw);
              }}
            >
              Angebot zurueckziehen
            </button>
          </>
        ) : (
          <>
            {countering ? (
              <>
                <p className="modal__hint">
                  Dein Gegenangebot ersetzt deine Antwort — und gibt allen neue Bedenkzeit.
                </p>

                <TradeAmounts
                  owned={me?.resources ?? EMPTY_RESOURCES}
                  give={counterGive}
                  want={counterWant}
                  onGive={setCounterGive}
                  onWant={setCounterWant}
                />

                <button
                  type="button"
                  className="button button--go"
                  disabled={!isTradeShapeValid(counterGive, counterWant)}
                  onClick={() => {
                    onAct({
                      type: 'counterTrade',
                      player: view.you,
                      give: counterGive,
                      want: counterWant,
                      at: Date.now(),
                    });
                  }}
                >
                  Gegenangebot abschicken
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setCountering(false)}
                >
                  Zurueck
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="button button--go"
                  disabled={accept === undefined}
                  onClick={() => {
                    if (accept !== undefined) onAct(accept);
                  }}
                >
                  Annehmen
                </button>
                {accept === undefined && decline !== undefined ? (
                  <p className="modal__problem">Dir fehlt, was dafuer verlangt wird.</p>
                ) : null}

                <button
                  type="button"
                  className="button"
                  disabled={decline === undefined}
                  onClick={() => {
                    if (decline !== undefined) onAct(decline);
                  }}
                >
                  Ablehnen
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={decline === undefined}
                  onClick={() => setCountering(true)}
                >
                  Gegenangebot
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
