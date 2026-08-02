import type { JSX } from 'react';
import type { ActionTargets } from '../game/targets';
import type { GameView } from '../game/view';
import { DiceTray } from './DiceTray';

/**
 * Die Bedienung, die nicht auf dem Brett liegt.
 *
 * Gesperrt wird nicht nach eigenem Wissen, sondern nach der Klickkarte: was
 * `legalActions` nicht genannt hat, ist grau. Der Handelsknopf oeffnet ein
 * Fenster - der Kurs wird dort abgeleitet und nicht gewaehlt (Regel 3).
 *
 * Oben stehen die Wuerfel, und sie sind kein Beiwerk: sie haben den Knopf
 * „Wuerfeln" ersetzt. Er stand daneben und tat, was sie darstellen - jetzt
 * wirft man sie. Damit liest sich die Leiste in der Reihenfolge eines Zuges:
 * werfen, handeln und kaufen, beenden.
 */
export interface ActionPanelProps {
  readonly view: GameView;
  readonly targets: ActionTargets;
  readonly error: string | null;
  readonly onRoll: () => void;
  readonly onEndTurn: () => void;
  readonly onOpenTrade: () => void;
  readonly onBuyCard: () => void;
  readonly onDismissError: () => void;
}

export function ActionPanel({
  view,
  targets,
  error,
  onRoll,
  onEndTurn,
  onOpenTrade,
  onBuyCard,
  onDismissError,
}: ActionPanelProps): JSX.Element {
  return (
    <section className="panel panel--actions">
      <DiceTray
        spec={view.dice}
        roll={view.lastRoll}
        total={view.rollTotal}
        canRoll={targets.roll !== null}
        fell={view.rolled}
        onRoll={onRoll}
      />

      <div className="panel__buttons">
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
          className="button"
          disabled={targets.buyCard === null}
          title={`Noch ${view.deckLeft} Karten im Stapel`}
          onClick={onBuyCard}
        >
          Karte kaufen
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
