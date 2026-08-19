import type { JSX } from 'react';
import type { ActionTargets } from '../game/targets';
import type { GameView } from '../game/view';

/**
 * Die zwei Knoepfe, mit denen ein Zug weitergeht: handeln oder beenden.
 *
 * Sie standen bis hierher am rechten Ende der Bedienleiste, hinter Wuerfeln
 * und Bauteilen. Das war die Reihenfolge eines Zuges - werfen, bauen, handeln,
 * beenden -, aber nicht die Haeufigkeit: „Zug beenden" ist der Knopf, den man
 * in jedem einzelnen Zug drueckt, und er lag am weitesten weg von der Hand, auf
 * die man dabei sieht. Jetzt liegt er unter den Handkarten in der Ecke unten
 * links, wo die Hand ohnehin steht: was man staendig braucht, gehoert dorthin,
 * wo der Blick schon ist.
 *
 * Eigene Komponente und kein Rest von `ActionPanel`: die Leiste dort ist eine
 * Zeile in der Ablage, dieser Block eine Spalte darunter - zwei Orte, und
 * damit zwei Bausteine.
 */
export interface TurnPanelProps {
  readonly view: GameView;
  readonly targets: ActionTargets;
  readonly onOpenTrade: () => void;
  readonly onEndTurn: () => void;
}

export function TurnPanel({ view, targets, onOpenTrade, onEndTurn }: TurnPanelProps): JSX.Element {
  return (
    <div className="panel__buttons tray__turn" role="group" aria-label="Zug">
      <button
        type="button"
        className="button"
        /*
         * Zwei Wege hinter einem Knopf: der Bankkurs steht in der
         * Aktionsliste, das Angebot an die Mitspieler nicht (es braucht
         * Mengen). Wer nur `targets.trades` prueft, sperrt den Spielerhandel
         * genau dann aus, wenn jemand zu wenige Karten fuer die Bank hat -
         * also fast immer dann, wenn er handeln moechte.
         */
        disabled={targets.trades.length === 0 && !view.canOfferTrade}
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
  );
}
