import { useEffect, useState, type JSX } from 'react';
import {
  EMPTY_CARDS,
  resourceList,
  type GameAction,
  type PlayerView,
  type CardAmounts,
  type TradeResponse,
} from '@conquerist/shared';
import { ResourceRow } from '../panels/ResourceCard';
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
  if (answer === undefined) return { mark: '…', text: 'überlegt noch' };
  if (answer.kind === 'accepted') return { mark: '✓', text: 'nimmt an' };
  if (answer.kind === 'declined') {
    return answer.automatic
      ? { mark: '⚠', text: 'ist gerade nicht da' }
      : { mark: '✗', text: 'lehnt ab' };
  }
  if (answer.kind === 'rejected') {
    return { mark: '✗', text: 'hat dagegengehalten — ausgeschlagen' };
  }

  // Ein offenes Gegenangebot steht nicht in dieser Zeile, sondern in einem
  // eigenen Kasten: es ist eine Frage und keine Auskunft.
  return { mark: '⇄', text: 'hält dagegen' };
}

/** Dieselbe Antwort, aber an den gerichtet, der sie gegeben hat. */
function myAnswerText(answer: TradeResponse): string {
  switch (answer.kind) {
    case 'accepted':
      return 'Du hast zugesagt.';
    case 'rejected':
      return 'Dein Gegenangebot wurde ausgeschlagen.';
    case 'declined':
      return answer.automatic ? 'Du warst nicht erreichbar.' : 'Du hast abgelehnt.';
    case 'countered':
      // Kommt hier nicht an: ein offenes Gegenangebot gilt nicht als fertige
      // Antwort. Der Zweig steht fuer die Vollstaendigkeit der Union.
      return 'Dein Gegenangebot liegt beim Anbieter.';
  }
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
  const [counterGive, setCounterGive] = useState<CardAmounts>(NO_AMOUNTS);
  const [counterWant, setCounterWant] = useState<CardAmounts>(NO_AMOUNTS);
  const [countering, setCountering] = useState(false);
  /** Das Angebot, zu dem die drei Werte darueber gehoeren. Siehe unten. */
  const [answeredOffer, setAnsweredOffer] = useState<string | null>(null);

  useEffect(() => {
    setLeft(secondsLeft(expiresAt, clockOffset));
    const handle = setInterval(() => {
      setLeft(secondsLeft(expiresAt, clockOffset));
    }, 1000);

    return () => {
      clearInterval(handle);
    };
  }, [expiresAt, clockOffset]);

  /*
   * Ein angefangenes Gegenangebot gehoert dem Angebot, auf das es antwortet -
   * **und dem, der es angefangen hat.**
   *
   * Der Dialog wird nicht ausgehaengt, wenn die Runde endet - er gibt nur
   * `null` zurueck. Ohne dieses Zuruecksetzen stuenden beim naechsten Angebot
   * noch die alten Mengen im Formular, moeglicherweise aus einer Hand, die es
   * inzwischen nicht mehr hergibt. Der Server weist das ab; angeboten haette es
   * der Client trotzdem, und ein Knopf fuer eine Handlung, die es nicht gibt,
   * ist eine Luege.
   *
   * `view.you` steht seit dem zweiten Playtest mit drin, und das war ein echter
   * Fehler: am selben Geraet wandert der Bildschirm nach einer Antwort zum
   * naechsten Mitspieler, **ohne dass sich das Angebot aendert**. Der Schluessel
   * blieb also gleich, nichts wurde zurueckgesetzt, und Spieler 3 fand das
   * halbfertige Gegenangebot von Spieler 2 vor - samt „Erz von 0" bei
   * gewaehlter Eins. Online aendert sich `view.you` nie; dort kostet das Feld
   * nichts.
   */
  const answersTo =
    trade === null
      ? null
      : [
          view.you,
          trade.offer.from,
          resourceList(trade.offer.give),
          resourceList(trade.offer.want),
        ].join('|');

  if (answeredOffer !== answersTo) {
    setAnsweredOffer(answersTo);
    setCountering(false);
    setCounterGive(NO_AMOUNTS);
    setCounterWant(NO_AMOUNTS);
  }

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

  /*
   * Die eigene Antwort - `undefined`, solange man noch ueberlegt.
   *
   * Ein offenes Gegenangebot zaehlt hier NICHT als fertige Antwort: der
   * Anbieter kann es ausschlagen, und danach ist man wieder dran. Ein
   * ausgeschlagenes zaehlt dagegen sehr wohl.
   */
  const own = trade.responses[view.you];
  const answered = own === undefined || own.kind === 'countered' ? undefined : own;

  /** Wie viele Mitspieler noch nicht geantwortet haben - der Anbieter zaehlt nicht mit. */
  const waitingCount = view.players.filter(
    (player) => player.id !== trade.offer.from && trade.responses[player.id] === undefined,
  ).length;

  return (
    <div className="modal" role="dialog" aria-label="Angebot auf dem Tisch">
      <div className="modal__box modal__box--enter">
        <h2>{mine ? 'Dein Angebot liegt' : `${nameOf(trade.offer.from)} bietet an`}</h2>

        {/*
         * **Die Bedingungen als Karten und nicht als Satz.**
         *
         * Hier wird unter einer laufenden Frist entschieden, und „2 Holz, 1 Erz
         * für 1 Erz" ist ein Satz, den man liest. Dieselben Karten wie ueberall
         * sonst sind ein Blick - und die Namen stehen weiter darauf, also
         * verliert weder das Vorlesewerkzeug noch jemand, der Farben schlecht
         * unterscheidet.
         *
         * **Und sie stehen beschriftet da, nicht in einer Reihenfolge.** Hier
         * standen die zwei Reihen mit einem „für" dazwischen - in der Richtung
         * dessen, der anbietet. Wer angeboten bekommt, liest sie damit
         * zwangslaeufig falsch herum: was dort links stand, war das, was man
         * *bekommt*, und rechts, was man *hergibt*. Unter einer ablaufenden
         * Frist ist das die denkbar schlechteste Stelle zum Umdrehen im Kopf.
         *
         * Genau dieser Befund hat schon den Kasten fuer Gegenangebote weiter
         * unten geformt; er gilt hier genauso, und deshalb ist es jetzt
         * dieselbe Form. Die Beschriftung ist beide Male dieselbe, nur die
         * Zuordnung dreht sich: wer anbietet, gibt sein `give`, wer angeboten
         * bekommt, gibt das `want` des anderen.
         */}
        <dl className="terms offer__terms" data-testid="offer-terms">
          <div>
            <dt>Du gibst</dt>
            <dd>
              <ResourceRow amounts={mine ? trade.offer.give : trade.offer.want} />
            </dd>
          </div>
          <div>
            <dt>Du bekommst</dt>
            <dd>
              <ResourceRow amounts={mine ? trade.offer.want : trade.offer.give} />
            </dd>
          </div>
        </dl>

        <p className="offer__clock" data-testid="offer-clock">
          Noch <b>{left}</b> Sekunden
        </p>

        {mine ? (
          <>
            <ul className="offer__answers">
              {view.players
                .filter((player) => player.id !== trade.offer.from)
                .map((player) => {
                  const response = trade.responses[player.id];
                  const answer = answerText(response);
                  const deal = find(
                    (action) => action.type === 'acceptTrade' && action.partner === player.id,
                  );
                  const refuse = find(
                    (action) => action.type === 'rejectCounter' && action.partner === player.id,
                  );

                  /*
                   * Ein offenes Gegenangebot bekommt einen eigenen Kasten.
                   *
                   * Es stand bis hierher als eine Zeile zwischen den anderen
                   * Antworten - „Ben bietet 1 Erz für 3 Holz" -, und daran war
                   * zweierlei falsch. Es ist keine Auskunft, sondern eine
                   * **Frage an den Anbieter**, also gehoert es nicht in dieselbe
                   * Zeilenform wie „lehnt ab". Und die Richtung stand aus der
                   * Sicht des Konternden da: wer sein eigenes Angebot vor Augen
                   * hat, liest „bietet 1 Erz für 3 Holz" zwangslaeufig falsch
                   * herum. Hier steht jetzt, was **dieser** Spieler gibt und
                   * bekommt - beschriftet, nicht aus der Reihenfolge zu raten.
                   */
                  if (response?.kind === 'countered') {
                    return (
                      <li key={player.id}>
                        <div className="counter" data-testid={`counter-${player.id}`}>
                          <span className="counter__who">{player.name} hält dagegen</span>

                          <dl className="terms counter__terms">
                            <div>
                              <dt>Du gibst</dt>
                              <dd>
                                <ResourceRow amounts={response.want} />
                              </dd>
                            </div>
                            <div>
                              <dt>Du bekommst</dt>
                              <dd>
                                <ResourceRow amounts={response.give} />
                              </dd>
                            </div>
                          </dl>

                          <div className="counter__buttons">
                            {deal === undefined ? (
                              <p
                                className="modal__problem"
                                data-testid={`counter-short-${player.id}`}
                              >
                                Nicht genügend Ressourcen
                              </p>
                            ) : (
                              <button
                                type="button"
                                className="button button--yes"
                                data-testid={`counter-accept-${player.id}`}
                                onClick={() => onAct(deal)}
                              >
                                Annehmen
                              </button>
                            )}
                            <button
                              type="button"
                              className="button button--no"
                              data-testid={`counter-reject-${player.id}`}
                              disabled={refuse === undefined}
                              onClick={() => {
                                if (refuse !== undefined) onAct(refuse);
                              }}
                            >
                              Ablehnen
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={player.id} className="offer__answer">
                      <span aria-hidden="true">{answer.mark}</span>
                      <span>
                        {player.name} {answer.text}
                      </span>
                      {deal === undefined ? null : (
                        <button
                          type="button"
                          className="button button--yes"
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
              Angebot zurückziehen
            </button>
          </>
        ) : (
          <>
            {countering ? (
              <>
                <p className="modal__hint">
                  Dein angepasstes Angebot ersetzt deine Antwort — und gibt allen neue Bedenkzeit.
                </p>

                <TradeAmounts
                  owned={me?.resources ?? EMPTY_CARDS}
                  cards={view.rules.cards}
                  give={counterGive}
                  want={counterWant}
                  onGive={setCounterGive}
                  onWant={setCounterWant}
                />

                <button
                  type="button"
                  className="button button--adjust"
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
                  Angepasstes Angebot abschicken
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setCountering(false)}
                >
                  Zurück
                </button>
              </>
            ) : answered !== undefined ? (
              /*
               * Geantwortet ist geantwortet - dann verschwinden die Knoepfe.
               *
               * Bis hierher standen sie gesperrt da: drei graue Schaltflaechen,
               * von denen keine mehr etwas tat, und kein Wort darueber, worauf
               * man eigentlich wartet. Ein gesperrter Knopf ist ein Angebot,
               * das man zurueckzieht, ohne es zu sagen. Jetzt steht da, was
               * man getan hat und was jetzt passiert.
               *
               * Ein Gegenangebot faellt nicht hierunter: es ist zwar auch eine
               * Antwort, aber der Anbieter kann es ausschlagen, und dann geht
               * es fuer diesen Spieler weiter.
               */
              <div className="offer__done" data-testid="offer-answered">
                <p className="offer__mine">{myAnswerText(answered)}</p>
                <p className="modal__hint">
                  {waitingCount === 0
                    ? `${nameOf(trade.offer.from)} ist am Zug.`
                    : waitingCount === 1
                      ? 'Es fehlt noch die Antwort eines Mitspielers.'
                      : `Es fehlen noch ${waitingCount} Antworten.`}
                </p>
              </div>
            ) : (
              <>
                {/*
                 * Fehlt das Annehmen, tritt der Satz an seine Stelle - und
                 * nicht darunter.
                 *
                 * Ein gesperrter Knopf mit einer Erklaerung daneben laesst
                 * einen erst hindruecken und dann lesen. Das ist die Reihenfolge
                 * verkehrt herum: was nicht geht, muss nicht als Knopf
                 * dastehen. Der Grund steht dafuer da, wo der Knopf war.
                 *
                 * **Ablehnen bleibt trotzdem stehen.** Es waere naheliegend, mit
                 * dem Annehmen auch das Ablehnen wegzunehmen - beides ist ja
                 * dieselbe Antwort auf ein Angebot, das man nicht bedienen kann.
                 * Aber der Anbieter wartet auf eine Antwort, und ohne Ablehnen
                 * bekaeme er sie erst, wenn die Frist ablaeuft. Ein Fenster, das
                 * einem den kurzen Weg nimmt, haelt den ganzen Tisch auf.
                 */}
                {accept === undefined ? (
                  <p className="modal__problem" data-testid="offer-unaffordable">
                    Nicht genügend Ressourcen
                  </p>
                ) : (
                  <button
                    type="button"
                    className="button button--yes"
                    data-testid="offer-accept"
                    onClick={() => onAct(accept)}
                  >
                    Annehmen
                  </button>
                )}

                <button
                  type="button"
                  className="button button--no"
                  data-testid="offer-decline"
                  disabled={decline === undefined}
                  onClick={() => {
                    if (decline !== undefined) onAct(decline);
                  }}
                >
                  Ablehnen
                </button>
                <button
                  type="button"
                  className="button button--adjust"
                  data-testid="offer-counter"
                  disabled={decline === undefined}
                  onClick={() => setCountering(true)}
                >
                  Angebot anpassen
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
