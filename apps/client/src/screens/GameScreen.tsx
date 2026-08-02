import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  tradeRateFor,
  type GameAction,
  type PlayerId,
  type PlayerView,
  type ResourceAmounts,
  type ResourceId,
} from '@conquerist/shared';
import { BoardSvg, type Place } from '../board/BoardSvg';
import { targetsFrom } from '../game/targets';
import { discardCountForView, gameViewOf, type PlayerRow } from '../game/view';
import { ActionPanel } from '../panels/ActionPanel';
import { HandPanel } from '../panels/HandPanel';
import { LogPanel } from '../panels/LogPanel';
import { StatusPanel } from '../panels/StatusPanel';
import { TablePanel } from '../panels/TablePanel';
import { DiscardDialog } from '../dialogs/DiscardDialog';
import { TradeDialog } from '../dialogs/TradeDialog';
import { VictimDialog } from '../dialogs/VictimDialog';
import type { LogEntry } from '../game/hotseat';

/**
 * Setzt Brett, Panels und Dialoge zusammen.
 *
 * Seit Etappe 4 bekommt er **eine Sicht und eine Aktionsliste** - und weiter
 * nichts. Wer sie gebaut hat, ist ihm gleich: die lokale Partie erzeugt beides
 * selbst, die Online-Partie bekommt beides vom Server. Ein Satz Bildschirme
 * fuer beide Quellen, und keine Stelle, an der eine Regel ein zweites Mal
 * ausgelegt wird.
 *
 * Was daraus folgt, ist der eigentliche Gewinn: **die Dialoge lesen ihre
 * Auswahl aus der Aktionsliste.** Wer als Opfer eines Raeuberzugs in Frage
 * kommt, steht nicht mehr in einer Client-Rechnung ueber fremde Handkarten -
 * die sieht der Client gar nicht mehr -, sondern in den Zuegen, die erlaubt
 * sind.
 *
 * Das Brett liegt in `.board-area`, deren Einzug die Panels aussparen. Damit
 * liegt kein Feld je unter einem Panel - die Randknoten der Gruendung bleiben
 * anklickbar.
 */
export interface GameScreenProps {
  readonly view: PlayerView;
  /** Was der Empfaenger dieser Sicht gerade tun darf. */
  readonly actions: readonly GameAction[];
  readonly log: readonly LogEntry[];
  readonly error: string | null;
  readonly onAct: (action: GameAction) => void;
  readonly onDismissError: () => void;
  readonly onLeave: () => void;
  /** Verbindung weg. Die lokale Partie laesst das aus - sie hat keine. */
  readonly offline?: boolean;
  /**
   * Handkarten beim Zugwechsel zudecken.
   *
   * Online sinnlos: jeder sitzt vor seinem eigenen Bildschirm, und dort ist
   * die eigene Hand nie ein Geheimnis. Lokal ist es eine echte Frage - der
   * Bildschirm wandert weiter, und wer als Naechstes hinsieht, soll nicht die
   * Hand seines Vorgaengers vorfinden. Deshalb einstellbar und nicht gesetzt.
   */
  readonly concealBetweenTurns?: boolean;
}

export function GameScreen({
  view,
  actions,
  log,
  error,
  onAct,
  onDismissError,
  onLeave,
  offline = false,
  concealBetweenTurns = false,
}: GameScreenProps): JSX.Element {
  const [tradeOpen, setTradeOpen] = useState(false);
  const [robberHex, setRobberHex] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!concealBetweenTurns);

  /*
   * Beim Wechsel wieder zudecken.
   *
   * Der Schluessel ist `view.you` und nicht der Spieler am Zug: lokal baut
   * `useLocalGame` die Sicht fuer den, der handeln darf - wechselt der, wechselt
   * `you`. Online aendert sich `you` nie, und dann deckt hier auch nie etwas zu.
   */
  useEffect(() => {
    setRevealed(!concealBetweenTurns);
  }, [view.you, concealBetweenTurns]);

  /*
   * Der vorige Stand, nur um die Differenz zu bilden.
   *
   * In einem Ref und nicht im State: er soll kein Rendern ausloesen, sondern
   * beim naechsten begleiten. Beim ersten Bild gibt es keinen Vorgaenger, und
   * dann gibt es auch keinen Zuwachs zu zeigen - eine Partie faengt nicht mit
   * „+3" an.
   */
  const previous = useRef<PlayerView | null>(null);

  const display = useMemo(() => gameViewOf(view, previous.current ?? undefined), [view]);
  useEffect(() => {
    previous.current = view;
  }, [view]);

  const targets = useMemo(() => targetsFrom(actions), [actions]);

  const pick = useCallback(
    (place: Place) => {
      if (place.kind === 'vertex') {
        const action = targets.vertices.get(place.id);
        if (action !== undefined) onAct(action);
        return;
      }
      if (place.kind === 'edge') {
        const action = targets.edges.get(place.id);
        if (action !== undefined) onAct(action);
        return;
      }

      const options = targets.hexes.get(place.id) ?? [];
      if (options.length === 1) onAct(options[0]!);
      else if (options.length > 1) setRobberHex(place.id);
    },
    [targets, onAct],
  );

  const playerOf = (id: PlayerId): PlayerRow | undefined =>
    display.players.find((player) => player.id === id);

  const you = playerOf(view.you);

  /*
   * Abwerfen betrifft immer nur den Empfaenger dieser Sicht: die Karten eines
   * anderen kennt er nicht und koennte sie gar nicht auswaehlen. Online steht
   * am selben Bildschirm ohnehin nur einer.
   */
  const mustDiscard =
    view.phase.kind === 'discardPending' && view.phase.pending.includes(view.you)
      ? discardCountForView(view, view.you)
      : 0;

  /** Die moeglichen Opfer stehen in den Zuegen, nicht in einer eigenen Rechnung. */
  const victims: readonly PlayerRow[] =
    robberHex === null
      ? []
      : (targets.hexes.get(robberHex) ?? []).flatMap((action) => {
          if (action.type !== 'moveRobber' || action.victim === null) return [];
          const player = playerOf(action.victim);
          return player === undefined ? [] : [player];
        });

  return (
    <main className="game">
      <div className="board-area">
        <BoardSvg
          state={view}
          targets={targets}
          seats={display.players.map((player) => ({
            id: player.id,
            name: player.name,
            color: player.color,
          }))}
          onPick={pick}
        />

        {offline ? (
          <div className="offline" role="status">
            <p className="offline__text">Verbindung weg — es wird weiter versucht.</p>
          </div>
        ) : null}
      </div>

      <TablePanel view={display} />
      <StatusPanel view={display} />
      <LogPanel entries={log} />

      <div className="tray">
        <HandPanel
          resources={you?.resources ?? null}
          cardCount={you?.cardCount ?? 0}
          covered={!revealed}
          onReveal={() => setRevealed(true)}
          {...(concealBetweenTurns && you !== undefined ? { owner: you.name } : {})}
        />

        <ActionPanel
          view={display}
          targets={targets}
          error={error}
          onRoll={() => {
            if (targets.roll !== null) onAct(targets.roll);
          }}
          onEndTurn={() => {
            if (targets.endTurn !== null) onAct(targets.endTurn);
          }}
          onOpenTrade={() => setTradeOpen(true)}
          onDismissError={onDismissError}
        />
      </div>

      {mustDiscard > 0 && you !== undefined ? (
        <DiscardDialog
          player={you}
          required={mustDiscard}
          onConfirm={(resources: ResourceAmounts) => {
            onAct({ type: 'discard', player: view.you, resources });
          }}
        />
      ) : null}

      {tradeOpen && you !== undefined ? (
        <TradeDialog
          player={you}
          rateFor={(give: ResourceId) => tradeRateFor(view, view.you, give)}
          canTrade={(give: ResourceId, receive: ResourceId) =>
            targets.trades.some(
              (action) =>
                action.type === 'tradeWithBank' &&
                action.give === give &&
                action.receive === receive,
            )
          }
          onConfirm={(give, receive) => {
            const action = targets.trades.find(
              (candidate) =>
                candidate.type === 'tradeWithBank' &&
                candidate.give === give &&
                candidate.receive === receive,
            );
            if (action !== undefined) onAct(action);
            setTradeOpen(false);
          }}
          onClose={() => setTradeOpen(false)}
        />
      ) : null}

      {robberHex !== null ? (
        <VictimDialog
          hex={robberHex}
          victims={victims}
          onChoose={(victim) => {
            const action = (targets.hexes.get(robberHex) ?? []).find(
              (candidate) => candidate.type === 'moveRobber' && candidate.victim === victim,
            );
            if (action !== undefined) onAct(action);
            setRobberHex(null);
          }}
          onClose={() => setRobberHex(null)}
        />
      ) : null}

      {view.phase.kind === 'finished' ? (
        <div className="modal" role="dialog" aria-label="Partie beendet">
          <div className="modal__box">
            <h2>{display.phaseText}</h2>
            <ol className="result">
              {display.players.map((player) => (
                <li key={player.id}>
                  {player.name}: {player.victoryPoints} Siegpunkte
                </li>
              ))}
            </ol>
            <button type="button" className="button button--go" onClick={onLeave}>
              Zurueck zum Start
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
