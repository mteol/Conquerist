import type { JSX } from 'react';
import { PIECE_IDS, type PieceId, type RuleSet } from '@conquerist/shared';
import { CITY_PATH, ROAD_PATH, SETTLEMENT_PATH, VIEWBOX } from '../board/shapes';
import type { ActionTargets, BuildableKind } from '../game/targets';
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
 * werfen, bauen - und weiter unten links handeln oder beenden.
 *
 * **„Handel" und „Zug beenden" stehen nicht mehr hier.** Sie sassen am rechten
 * Ende dieser Zeile, also am weitesten weg von der Hand, auf die man beim
 * Handeln und beim Beenden sieht. Sie liegen jetzt als `TurnPanel` unter den
 * Handkarten; hier bleibt, was zum Zug selbst gehoert: die Wuerfel, die
 * Bauteile und die Absage des Servers.
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
  readonly onDismissError: () => void;
}

const BUILD_LABELS: Readonly<Record<PieceId, string>> = {
  road: 'Straße',
  settlement: 'Siedlung',
  city: 'Stadt',
};

/** Fuer Vorlesewerkzeuge: „13 Straßen" liest sich vor, eine 13 neben einem Pfad nicht. */
const STOCK_LABELS: Readonly<Record<PieceId, string>> = {
  road: 'Straßen',
  settlement: 'Siedlungen',
  city: 'Städte',
};

export function ActionPanel({
  view,
  targets,
  error,
  stock,
  buildMode,
  onBuildMode,
  onRoll,
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

      {/*
       * Die Bauleiste. Jedes Bauteil traegt seine Silhouette vom Brett - wer
       * hier „Stadt" drueckt, sieht dieselbe Form gleich am Knoten stehen.
       *
       * **Der Vorrat steht seit dem neuen Layout hier und nicht daneben.** Es
       * gab ihn als eigene Liste ueber der Bauleiste: dreimal dieselbe
       * Silhouette mit einer Zahl, und direkt darunter dieselben drei
       * Silhouetten noch einmal als Knoepfe. Zwei Zeilen fuer ein Bauteil, die
       * eine zum Zaehlen, die andere zum Druecken - und beide beantworten
       * dieselbe Frage: was geht jetzt noch. Jetzt traegt der Knopf seine Zahl.
       *
       * **Und seit dem zweiten Blick auf den Tisch ist der Knopf kein Knopf
       * mehr.** Er war eine Pergamentplatte mit Rahmen, auf der die Silhouette
       * als 1.05rem grosses Zeichen sass: ein Bedienelement mit einem Bildchen
       * darin. Ein Bauteil im Vorrat ist aber kein Bedienelement, sondern
       * Spielmaterial wie der Kaufstapel daneben - es liegt auf dem Tisch, man
       * greift danach, und die Zahl darunter sagt, wie viele noch daliegen.
       * Deshalb faellt der Rahmen weg, die Silhouette wird gross, und was vom
       * Knopf bleibt, ist der Kontaktschatten unter dem Stueck.
       *
       * **Der Name steht nicht mehr dabei.** Er stand neben einer Form, die auf
       * dem Brett dasselbe bedeutet - ein Haus, ein Haus mit Anbau, ein Balken -
       * und war damit die Beschriftung eines Bildes, das schon spricht. Fuer
       * alle, die das Bild nicht lesen, bleibt er: im `title` und als
       * vorgelesener Name des Knopfes.
       *
       * Die Null bleibt stehen und wird grau. Ein fehlender Eintrag saehe aus
       * wie ein Anzeigefehler; „0" ist dagegen die Auskunft, um die es geht -
       * am Tisch aus Holz sieht man den leeren Platz vor sich.
       */}
      <div className="build" role="group" aria-label="Bauen">
        {PIECE_IDS.map((piece) => {
          const spots = targets.buildable[piece];
          const active = buildMode === piece;
          /** `null`, solange es keinen eigenen Sitz gibt - dann gibt es keinen Vorrat. */
          const left = stock === null ? null : (stock.piecesLeft[piece] ?? 0);

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
              {/*
               * Der Traeger der Bewegung, und zwar nur er: das Stueck hebt sich,
               * die Zahl darunter bleibt liegen. Stiege der ganze Knopf, wanderte
               * die Zahl mit - und eine Zahl, die beim Darueberfahren ihre Zeile
               * verlaesst, laesst sich schlechter mit der daneben vergleichen.
               */}
              <span className="build__piece">
                <PieceMark piece={piece} color={stock?.color ?? 'currentColor'} />
              </span>

              <span className="visually-hidden">{BUILD_LABELS[piece]}</span>

              {left === null ? null : (
                <>
                  <span
                    aria-hidden="true"
                    data-testid={`left-${piece}`}
                    className={left === 0 ? 'build__left build__left--empty' : 'build__left'}
                  >
                    {left}
                  </span>
                  <span className="visually-hidden">{`noch ${left} ${STOCK_LABELS[piece]}`}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/*
       * Hier stand `view.phaseText`. Er steht auch in der Statusecke, und zwei
       * Ecken mit demselben Satz sind eine zu viel - siehe StatusPanel.
       */}
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
