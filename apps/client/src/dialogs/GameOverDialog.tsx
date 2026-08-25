import type { JSX } from 'react';
import type { PieceId, PlayerInView, PlayerView } from '@conquerist/shared';
import { CloseButton } from './CloseButton';

/**
 * Der Endstand, wenn die Partie herum ist.
 *
 * **Rolle:** der Abschluss, den es bis hierher nicht gab. Ein Sieg war eine
 * Statuszeile - „Anna hat gewonnen" - und danach stand das Brett da, ohne dass
 * jemand nachsehen konnte, wie knapp es war.
 *
 * **Warum ein Dialog und kein Vollbild:** die Partie soll nachschaubar
 * bleiben. Wer wissen will, wem die lange Strasse gehoerte, will sie auch auf
 * dem Brett sehen; ein Endbildschirm, der das Brett wegnimmt, beendet das
 * Gespraech am Tisch statt es zu tragen.
 *
 * **Die Wuerfelverteilung** ist die zweite Haelfte und der Grund, aus dem es
 * diesen Dialog gibt. Sie zeigt alle elf Summen, auch die ungewuerfelten - eine
 * Verteilung mit Luecken waere eine Liste. Die Sieben steht mit drin: sie ist
 * die haeufigste, und ohne sie saehe die Glocke schief aus.
 *
 * Gerechnet wird hier nichts, was der Zustand schon weiss. Siegpunkte, Ritter
 * und die beiden Auszeichnungen kommen aus der Sicht; gebaute Teile sind die
 * einzige Ableitung, und auch die nur als Vorrat minus Rest.
 */
export interface GameOverDialogProps {
  readonly view: PlayerView;
  readonly onClose: () => void;
}

/** Alle Summen, die zwei Wuerfel hergeben. */
const TOTALS = Array.from({ length: 11 }, (_, index) => index + 2);

export function GameOverDialog({ view, onClose }: GameOverDialogProps): JSX.Element {
  const winner = view.phase.kind === 'finished' ? view.phase.winner : null;
  const nameOf = (id: string): string =>
    view.players.find((player) => player.id === id)?.name ?? id;

  /** Gebaut ist, was der Vorrat hergab und nicht mehr daliegt. */
  const built = (player: PlayerInView, piece: PieceId): number =>
    (view.rules.pieceStock[piece] ?? 0) - (player.piecesLeft[piece] ?? 0);

  const countOf = (total: number): number => view.rollTally[String(total)] ?? 0;

  /*
   * Der laengste Balken fuellt die Breite, alle anderen stehen im Verhaeltnis
   * dazu. Nicht an der Gesamtzahl gemessen: bei zweihundert Wuerfen waere jeder
   * Balken ein Strich, und die Verteilung waere nicht mehr zu sehen. Die Eins
   * als Untergrenze haelt die Division heil, bevor der erste Wurf gefallen ist.
   */
  const peak = Math.max(1, ...TOTALS.map(countOf));

  // Der Sieger oben, danach nach Punkten - der Endstand liest sich wie eine Tabelle.
  const ranked = [...view.players].sort((a, b) => b.victoryPoints - a.victoryPoints);

  return (
    <div className="modal" role="dialog" aria-label="Endstand">
      <div className="modal__box modal__box--over">
        <CloseButton onClose={onClose} label="Endstand" />

        <h2 data-testid="over-winner">
          {winner === null ? 'Partie beendet' : `${nameOf(winner)} hat gewonnen`}
        </h2>

        <table className="over__table">
          <thead>
            <tr>
              <th scope="col">Spieler</th>
              <th scope="col" title="Siegpunkte">
                SP
              </th>
              <th scope="col" title="Siedlungen">
                Sied.
              </th>
              <th scope="col" title="Städte">
                Städte
              </th>
              <th scope="col" title="Straßen">
                Str.
              </th>
              <th scope="col" title="Ausgespielte Ritter">
                Ritter
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((player) => (
              <tr key={player.id} data-testid={`over-player-${player.id}`}>
                <th scope="row" style={{ borderLeftColor: player.color }}>
                  {player.name}
                  {view.longestRoad.holder === player.id ? (
                    <span
                      className="over__badge"
                      title={`Längste Straße (${view.longestRoad.length})`}
                    >
                      Straße
                    </span>
                  ) : null}
                  {view.largestArmy.holder === player.id ? (
                    <span className="over__badge" title={`Größtes Heer (${view.largestArmy.size})`}>
                      Heer
                    </span>
                  ) : null}
                </th>
                <td>
                  <strong>{player.victoryPoints}</strong>
                </td>
                <td>{built(player, 'settlement')}</td>
                <td>{built(player, 'city')}</td>
                <td>{built(player, 'road')}</td>
                <td>{player.playedKnights}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="over__head">Gewürfelt</h3>
        <ul className="over__rolls">
          {TOTALS.map((total) => {
            const count = countOf(total);

            return (
              <li className="over__roll" key={total} data-testid={`over-roll-${total}`}>
                <span className="over__total">{total}</span>
                <span className="over__bar" aria-hidden="true">
                  <span className="over__fill" style={{ width: `${(count / peak) * 100}%` }} />
                </span>
                <span className="over__count">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
