import type { JSX } from 'react';
import { PIECE_IDS, type PieceId, type RuleSet } from '@conquerist/shared';
import { CITY_PATH, ROAD_PATH, SETTLEMENT_PATH, VIEWBOX } from '../board/shapes';
import type { ActionTargets, BuildableKind } from '../game/targets';
import type { GameView } from '../game/view';
import { DiceTray } from './DiceTray';
import { StockPanel } from './StockPanel';

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
 * werfen, bauen, handeln, beenden.
 *
 * **Gebaut wird seit dem Playtest in zwei Schritten.** Vorher leuchtete das
 * Brett an jeder Stelle, an der irgendetwas moeglich war - Strassen, Siedlungen
 * und Staedte gleichzeitig, und was man mit einem Klick bekam, ergab sich aus
 * dem Ort. Jetzt sagt man erst, **was** man bauen will, und dann zeigt das
 * Brett **wo**. Der Knopf ist dabei die Auskunft, auf die es ankommt: er ist
 * genau dann bedienbar, wenn es dafuer Karten **und** eine Stelle gibt.
 */
export interface ActionPanelProps {
  readonly view: GameView;
  readonly targets: ActionTargets;
  readonly error: string | null;
  /**
   * Der eigene Bauvorrat - `null`, solange es keinen eigenen Sitz gibt.
   *
   * Steht neben den Wuerfeln und nicht bei den Karten: er beantwortet dieselbe
   * Frage wie die Knoepfe darunter, naemlich was jetzt ueberhaupt geht.
   */
  readonly stock: { readonly piecesLeft: RuleSet['pieceStock']; readonly color: string } | null;
  /** Welches Bauteil gerade gewaehlt ist. `null` heisst: das Brett ist ruhig. */
  readonly buildMode: BuildableKind | null;
  readonly onBuildMode: (kind: BuildableKind | null) => void;
  readonly onRoll: () => void;
  readonly onEndTurn: () => void;
  readonly onOpenTrade: () => void;
  readonly onDismissError: () => void;
}

const BUILD_LABELS: Readonly<Record<PieceId, string>> = {
  road: 'Straße',
  settlement: 'Siedlung',
  city: 'Stadt',
};

export function ActionPanel({
  view,
  targets,
  error,
  stock,
  buildMode,
  onBuildMode,
  onRoll,
  onEndTurn,
  onOpenTrade,
  onDismissError,
}: ActionPanelProps): JSX.Element {
  return (
    <section className="panel panel--actions">
      <div className="panel__top">
        <DiceTray
          spec={view.dice}
          roll={view.lastRoll}
          total={view.rollTotal}
          canRoll={targets.roll !== null}
          fell={view.rolled}
          onRoll={onRoll}
        />

        {stock === null ? null : <StockPanel piecesLeft={stock.piecesLeft} color={stock.color} />}
      </div>

      {/*
       * Die Bauleiste. Jedes Bauteil traegt seine Silhouette vom Brett - wer
       * hier „Stadt" drueckt, sieht dieselbe Form gleich am Knoten stehen.
       */}
      <div className="build" role="group" aria-label="Bauen">
        {PIECE_IDS.map((piece) => {
          const spots = targets.buildable[piece];
          const active = buildMode === piece;

          return (
            <button
              key={piece}
              type="button"
              className={active ? 'build__pick build__pick--active' : 'build__pick'}
              data-testid={`build-${piece}`}
              aria-pressed={active}
              disabled={spots === 0}
              title={
                spots === 0
                  ? `${BUILD_LABELS[piece]}: gerade nicht möglich`
                  : `${BUILD_LABELS[piece]}: ${spots} ${spots === 1 ? 'Stelle' : 'Stellen'}`
              }
              // Noch einmal derselbe Knopf schaltet den Modus wieder aus - sonst
              // klebt eine Auswahl am Brett, die man nur durch Bauen loswird.
              onClick={() => onBuildMode(active ? null : piece)}
            >
              <PieceMark piece={piece} color={stock?.color ?? 'currentColor'} />
              <span className="build__name">{BUILD_LABELS[piece]}</span>
            </button>
          );
        })}
      </div>

      <div className="panel__buttons">
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

/** Dieselbe Silhouette wie auf dem Brett - siehe `board/shapes.ts`. */
function PieceMark({ piece, color }: { readonly piece: PieceId; readonly color: string }) {
  return (
    <svg className="piece piece--build" viewBox={VIEWBOX} aria-hidden="true">
      {piece === 'road' ? (
        <path d={ROAD_PATH} style={{ stroke: color }} strokeWidth={4.5} strokeLinecap="round" />
      ) : (
        <path
          d={piece === 'settlement' ? SETTLEMENT_PATH : CITY_PATH}
          style={{ fill: color, stroke: color }}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
