import type { JSX } from 'react';
import type { ActionTargets } from '../game/targets';
import type { GameView } from '../game/view';

/**
 * Die Knoepfe, die nicht auf dem Brett liegen.
 *
 * Gesperrt wird nicht nach eigenem Wissen, sondern nach der Klickkarte: was
 * `legalActions` nicht genannt hat, ist grau. Der Handelsknopf oeffnet ein
 * Fenster - der Kurs wird dort abgeleitet und nicht gewaehlt (Regel 3).
 */
export interface ActionPanelProps {
  readonly view: GameView;
  readonly targets: ActionTargets;
  readonly error: string | null;
  readonly onRoll: () => void;
  readonly onEndTurn: () => void;
  readonly onOpenTrade: () => void;
  readonly onDismissError: () => void;
}

export function ActionPanel({
  view,
  targets,
  error,
  onRoll,
  onEndTurn,
  onOpenTrade,
  onDismissError,
}: ActionPanelProps): JSX.Element {
  return (
    <section className="panel panel--actions">
      <div className="panel__buttons">
        <button type="button" className="button" disabled={targets.roll === null} onClick={onRoll}>
          Wuerfeln
        </button>
        <button
          type="button"
          className="button"
          disabled={targets.trades.length === 0}
          onClick={onOpenTrade}
        >
          Handel
        </button>
        <button
          type="button"
          className="button button--go"
          disabled={targets.endTurn === null}
          onClick={onEndTurn}
        >
          Zug beenden
        </button>
      </div>

      <p className="panel__hint">{view.phaseText}</p>

      {error === null ? null : (
        <div role="alert" className="panel__error">
          {error}
          <button type="button" className="button button--ghost" onClick={onDismissError}>
            Verstanden
          </button>
        </div>
      )}
    </section>
  );
}
