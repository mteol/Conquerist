import { Fragment, type CSSProperties, type JSX } from 'react';
import type { PlayerView } from '@conquerist/shared';
import { awardsOf } from '../game/awards';
import { pointBreakdown } from '../game/points';
import { DICE_TOTALS, expectedCount, isHotTotal } from '../game/rollOdds';
import { gameViewOf } from '../game/view';
import { NumeralText } from '../type/Numerals';
import { Modal } from './Modal';

/**
 * Der Endstand, wenn die Partie herum ist.
 *
 * **Rolle:** der Abschluss - wer hat gewonnen, wie knapp war es, und woran lag
 * es. **Aufbau:** oben der Sieger mit seinem Punktestand in der gezeichneten
 * Ziffer, darunter links die Rangliste, rechts die Wuerfel. **Das eine
 * Element** ist der Sieger: Name gross, Band in seiner Farbe, Zahl gezeichnet.
 *
 * **Warum ein Dialog und kein Vollbild:** die Partie soll nachschaubar
 * bleiben. Wer wissen will, wem die lange Strasse gehoerte, will sie auch auf
 * dem Brett sehen; „Brett ansehen" schliesst den Endstand, und die Tuer zurueck
 * steht in `GameScreen`.
 *
 * **Rangliste statt Tabelle.** Die Tabelle hatte Spalten „Sied.", „Str.",
 * „Ritter" - Abkuerzungen, die am Tisch nirgends so heissen (Designregel 8),
 * und eine Ritterspalte, die bei Staedte & Rittern das Falsche zaehlte. Jetzt
 * steht unter jedem Namen die Rechnung aus `pointBreakdown`: dieselben Woerter
 * wie in der Auskunft am Punktestand, und sie stimmt fuer jedes Regelwerk.
 *
 * **Die Wuerfel stehen als Saeulen,** damit die Glocke als Glocke zu sehen ist
 * - waagrechte Balken untereinander zeigen eine Rangfolge, keine Verteilung.
 * An jeder Saeule sitzt eine Marke fuer das, was bei so vielen Wuerfen zu
 * erwarten war. Erst damit sagt die Verteilung etwas: „die Acht kam zu
 * selten" ist der Satz, der nach einer Partie am Tisch faellt.
 */
export interface GameOverDialogProps {
  readonly view: PlayerView;
  readonly onClose: () => void;
  /** Zurueck zum Start - der Ausgang, den vorher ein eigener Kasten trug. */
  readonly onLeave: () => void;
}

export function GameOverDialog({ view, onClose, onLeave }: GameOverDialogProps): JSX.Element {
  const winnerId = view.phase.kind === 'finished' ? view.phase.winner : null;

  /*
   * Dasselbe Anzeigemodell wie am Tisch: Namen, Farben und Punktquellen kommen
   * aus `gameViewOf`, die Auszeichnungen aus `awardsOf`. Gerechnet wird hier
   * nur, was zur Darstellung gehoert - Rang und Erwartung.
   */
  const players = gameViewOf(view).players;
  const awards = awardsOf(view);
  const ranked = [...players].sort((a, b) => b.victoryPoints - a.victoryPoints);
  const winner = players.find((player) => player.id === winnerId) ?? null;

  /*
   * Gleichstand teilt sich den Platz: zwei mit acht Punkten sind beide Zweite,
   * und der naechste ist Vierter. Der Sieger steht trotzdem oben - `sort` ist
   * stabil, und bei Gleichstand am Ende entscheidet der Zug, nicht die Zahl.
   */
  const placeOf = (points: number): number =>
    1 + ranked.filter((player) => player.victoryPoints > points).length;

  const countOf = (total: number): number => view.rollTally[String(total)] ?? 0;
  const rolls = DICE_TOTALS.reduce((sum, total) => sum + countOf(total), 0);

  /*
   * Die hoechste Saeule und die hoechste Marke teilen sich die Hoehe. Nur an den
   * Wuerfen gemessen, stuende eine Erwartung, die nie erreicht wurde, ueber dem
   * Rand. Die Eins als Untergrenze haelt die Division heil, bevor der erste Wurf
   * gefallen ist.
   */
  const top = Math.max(1, ...DICE_TOTALS.map(countOf), expectedCount(7, rolls));
  const share = (value: number): string => `${(value / top) * 100}%`;

  return (
    <Modal
      label="Endstand"
      className="modal__box--over"
      title={winner === null ? 'Partie beendet' : `${winner.name} hat gewonnen`}
      titleTestId="over-winner"
      tone={winner?.color}
      aside={
        winner === null ? undefined : (
          <p className="over__score">
            <NumeralText value={winner.victoryPoints} className="over__numeral" />
            <span>Siegpunkte</span>
          </p>
        )
      }
      onClose={onClose}
      foot={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Brett ansehen
          </button>
          <button type="button" className="button button--go" onClick={onLeave}>
            Zurück zum Start
          </button>
        </>
      }
    >
      <div className="over">
        <section className="over__section" aria-labelledby="over-ranking">
          <h3 id="over-ranking" className="over__head">
            Rangliste
          </h3>
          <ol className="over__ranks">
            {ranked.map((player) => {
              const parts = pointBreakdown(player);

              return (
                <li
                  key={player.id}
                  className={player.id === winnerId ? 'over__rank over__rank--won' : 'over__rank'}
                  data-testid={`over-player-${player.id}`}
                  style={{ '--seat': player.color } as CSSProperties}
                >
                  <span className="over__place">{placeOf(player.victoryPoints)}.</span>
                  <span className="over__name">
                    {player.name}
                    {awards
                      .filter((award) => award.holder === player.id)
                      .map((award) => (
                        <span
                          key={award.id}
                          className="over__badge"
                          title={`${award.label} (${award.value})`}
                        >
                          {award.short}
                        </span>
                      ))}
                  </span>
                  <span className="over__points">
                    <strong>{player.victoryPoints}</strong> SP
                  </span>
                  <span className="over__parts">
                    {parts.length === 0
                      ? 'Keine Siegpunkte'
                      : parts.map((part, index) => (
                          // Eine Quelle bricht nicht zwischen Wort und Zahl um.
                          <Fragment key={part.label}>
                            {index === 0 ? null : ' · '}
                            <span className="over__part">
                              {part.label}&nbsp;{part.points}
                            </span>
                          </Fragment>
                        ))}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="over__section" aria-labelledby="over-dice">
          <h3 id="over-dice" className="over__head">
            Gewürfelt
          </h3>
          <ol className="over__hist">
            {DICE_TOTALS.map((total) => {
              const count = countOf(total);
              const expected = expectedCount(total, rolls);
              const kind =
                total === 7 ? ' over__bin--seven' : isHotTotal(total) ? ' over__bin--hot' : '';

              return (
                <li
                  key={total}
                  className={`over__bin${kind}`}
                  data-testid={`over-roll-${total}`}
                  aria-label={`${total}: ${count}-mal, erwartet ${expected.toLocaleString('de-DE', { maximumFractionDigits: 1 })}`}
                >
                  <span className="over__count" aria-hidden="true">
                    {count}
                  </span>
                  <span className="over__col" aria-hidden="true">
                    <span className="over__fill" style={{ height: share(count) }} />
                    {rolls === 0 ? null : (
                      <span className="over__expect" style={{ bottom: share(expected) }} />
                    )}
                  </span>
                  <span className="over__total" aria-hidden="true">
                    {total}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="over__legend">
            {rolls === 0 ? (
              'Es wurde nicht gewürfelt.'
            ) : (
              <>
                <span className="over__key" aria-hidden="true" /> erwartet bei {rolls}{' '}
                {rolls === 1 ? 'Wurf' : 'Würfen'}
              </>
            )}
          </p>
        </section>
      </div>
    </Modal>
  );
}
