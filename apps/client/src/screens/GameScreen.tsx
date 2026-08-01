import { useCallback, useMemo, useState, type JSX } from 'react';
import {
  canTradeWithBank,
  discardCountFor,
  tradeRateFor,
  victimsAt,
  type GameState,
  type PlayerId,
  type ResourceAmounts,
  type ResourceId,
} from '@conquerist/shared';
import type { Seat } from '../seats';
import { BoardSvg, type Place } from '../board/BoardSvg';
import { EMPTY_TARGETS, actionTargets } from '../game/targets';
import { useHotseatGame } from '../game/useHotseatGame';
import { actingPlayers, gameView, type PlayerView } from '../game/view';
import { ActionPanel } from '../panels/ActionPanel';
import { LogPanel } from '../panels/LogPanel';
import { StatusPanel } from '../panels/StatusPanel';
import { TablePanel } from '../panels/TablePanel';
import { DiscardDialog } from '../dialogs/DiscardDialog';
import { TradeDialog } from '../dialogs/TradeDialog';
import { VictimDialog } from '../dialogs/VictimDialog';

/**
 * Setzt Brett, Panels und Dialoge zusammen - und trifft dabei die wenigen
 * Entscheidungen, die keine Regel sind:
 *
 * - Wessen Sicht gilt: der erste aus `actingPlayers`. In der Gruendung ist das
 *   die Schlange, nach einer Sieben der erste Wartende, sonst der Spieler am
 *   Zug.
 * - Ein Feld mit genau einem Raeuberziel wird sofort ausgefuehrt; bei mehreren
 *   fragt der Dialog nach dem Opfer.
 * - Das Brett liegt in `.board-area`, deren Einzug die Panels aussparen. Damit
 *   liegt kein Feld je unter einem Panel - die Randknoten der Gruendung bleiben
 *   anklickbar.
 */
export interface GameScreenProps {
  readonly game: GameState;
  readonly seats: readonly Seat[];
  readonly onLeave: () => void;
}

export function GameScreen({ game, seats, onLeave }: GameScreenProps): JSX.Element {
  const { state, dispatch, dismissError } = useHotseatGame(game, seats);
  const [conceal, setConceal] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [robberHex, setRobberHex] = useState<string | null>(null);

  const current = state.game;
  const viewer = actingPlayers(current)[0] ?? null;
  const view = useMemo(
    () => gameView(current, seats, { viewer, conceal }),
    [current, seats, viewer, conceal],
  );
  const targets = useMemo(
    () => (viewer === null ? EMPTY_TARGETS : actionTargets(current, viewer)),
    [current, viewer],
  );

  const pick = useCallback(
    (place: Place) => {
      if (place.kind === 'vertex') {
        const action = targets.vertices.get(place.id);
        if (action !== undefined) dispatch(action);
        return;
      }
      if (place.kind === 'edge') {
        const action = targets.edges.get(place.id);
        if (action !== undefined) dispatch(action);
        return;
      }

      const options = targets.hexes.get(place.id) ?? [];
      if (options.length === 1) dispatch(options[0]!);
      else if (options.length > 1) setRobberHex(place.id);
    },
    [targets, dispatch],
  );

  const playerOf = (id: PlayerId): PlayerView | undefined =>
    view.players.find((player) => player.id === id);

  const discarding =
    current.phase.kind === 'discardPending' ? (current.phase.pending[0] ?? null) : null;
  const discardingPlayer = discarding === null ? undefined : playerOf(discarding);
  const tradingPlayer = viewer === null ? undefined : playerOf(viewer);

  return (
    <main className="game">
      <div className="board-area">
        <BoardSvg state={current} targets={targets} seats={seats} onPick={pick} />
      </div>

      <TablePanel view={view} conceal={conceal} onConcealChange={setConceal} />
      <StatusPanel view={view} />
      <LogPanel entries={state.log} />

      <ActionPanel
        view={view}
        targets={targets}
        error={state.lastError}
        onRoll={() => {
          if (targets.roll !== null) dispatch(targets.roll);
        }}
        onEndTurn={() => {
          if (targets.endTurn !== null) dispatch(targets.endTurn);
        }}
        onOpenTrade={() => setTradeOpen(true)}
        onDismissError={dismissError}
      />

      {discarding !== null && discardingPlayer !== undefined ? (
        <DiscardDialog
          player={discardingPlayer}
          required={discardCountFor(current, discarding)}
          onConfirm={(resources: ResourceAmounts) => {
            dispatch({ type: 'discard', player: discarding, resources });
          }}
        />
      ) : null}

      {tradeOpen && viewer !== null && tradingPlayer !== undefined ? (
        <TradeDialog
          player={tradingPlayer}
          rateFor={(give: ResourceId) => tradeRateFor(current, viewer, give)}
          canTrade={(give: ResourceId, receive: ResourceId) =>
            canTradeWithBank(current, viewer, give, receive) === null
          }
          onConfirm={(give, receive) => {
            dispatch({ type: 'tradeWithBank', player: viewer, give, receive });
            setTradeOpen(false);
          }}
          onClose={() => setTradeOpen(false)}
        />
      ) : null}

      {robberHex !== null && viewer !== null ? (
        <VictimDialog
          hex={robberHex}
          victims={victimsAt(current, robberHex, viewer).flatMap((id) => {
            const player = playerOf(id);
            return player === undefined ? [] : [player];
          })}
          onChoose={(victim) => {
            const action = (targets.hexes.get(robberHex) ?? []).find(
              (candidate) => candidate.type === 'moveRobber' && candidate.victim === victim,
            );
            if (action !== undefined) dispatch(action);
            setRobberHex(null);
          }}
          onClose={() => setRobberHex(null)}
        />
      ) : null}

      {current.phase.kind === 'finished' ? (
        <div className="modal" role="dialog" aria-label="Partie beendet">
          <div className="modal__box">
            <h2>{view.phaseText}</h2>
            <ol className="result">
              {view.players.map((player) => (
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
