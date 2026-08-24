import { useState, type JSX } from 'react';
import type { LogEntry } from '../game/hotseat';

/**
 * Der Verlauf - hinter einem Symbol, nicht als Dauerpanel.
 *
 * **Warum zugeklappt.** Im Blatt steht seit dem ersten Playtest der Grund, aus
 * dem Verlauf und Status die Plaetze getauscht haben: wer am Zug ist, liest man
 * staendig und beilaeufig, den Verlauf liest man selten und dann genau. Ein
 * Panel, das man selten liest, haelt trotzdem staendig seinen Platz - und der
 * Platz ging vom Brett ab. Jetzt hat der Verlauf eine Tuer statt einer Wand.
 *
 * **Was das kostet.** Wer nicht aufklappt, verpasst, was zwischen zwei eigenen
 * Zuegen passiert ist. Das ist der Preis, und er ist bewusst bezahlt: die Dinge,
 * die man nicht verpassen darf, stehen anderswo laut genug - der Wurf in den
 * Wuerfeln, der Raeuber auf seinem Feld, die Bauwerke am Knoten.
 *
 * **Er reicht bis zum Anfang der Partie.** Hier standen die letzten zwanzig
 * Eintraege („mehr als zwanzig braucht niemand im Blick"). Das galt fuer ein
 * Panel, das dauerhaft in der Ecke stand und nebenbei mitlief. Als Blatt, das
 * man aufzieht, gilt das Gegenteil: aufgezogen wird es, weil eine Frage im Raum
 * steht - wer hatte den Raeuber, wann ist das Erz weggekommen -, und die
 * Antwort liegt fast nie in den letzten zwanzig Zeilen. Abgeschnitten hat der
 * Verlauf dabei nicht einmal gesagt, dass er abschneidet.
 *
 * **Und deshalb steht die Runde dabei.** Zwanzig Zeilen liest man am Stueck;
 * zweihundert sind eine Landschaft und brauchen Wegmarken. Die Nummer steht
 * ohnehin an jedem Eintrag, sie wurde bloss nie gezeigt - hier trennt sie die
 * Bloecke, und man scrollt zu einer Runde statt durch eine Liste.
 *
 * **Der Zustand bleibt hier.** Ob der Verlauf offen ist, geht keine andere
 * Komponente etwas an und schon gar nicht den Spielzustand - es ist reine
 * Ansicht. Ihn nach oben zu reichen hiesse, den GameScreen um ein `useState` zu
 * verlaengern, das nur hier gelesen wird.
 */
export function LogPanel({ entries }: { readonly entries: readonly LogEntry[] }): JSX.Element {
  const [open, setOpen] = useState(false);

  /*
   * Juengster Eintrag oben, und zwar alle.
   *
   * Eine Kopie, weil `reverse` an Ort und Stelle dreht - `entries` gehoert dem
   * Aufrufer, und eine Liste, die sich vom Anzeigen umsortieren laesst, ist der
   * Fehler, den man erst drei Bildschirme spaeter sieht.
   */
  const newestFirst = [...entries].reverse();

  return (
    <div className="log-corner">
      <button
        type="button"
        className={open ? 'log-toggle log-toggle--open' : 'log-toggle'}
        data-testid="log-toggle"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <ScrollMark />
        <span className="visually-hidden">Verlauf</span>
      </button>

      {open ? (
        <section className="panel panel--log" aria-label="Verlauf">
          {/*
           * Die Ueberschrift steht ueber dem Rollbereich und nicht darin: sie
           * soll stehenbleiben, waehrend man durch zweihundert Zeilen faehrt.
           * Die Zahl daneben ist die Auskunft, die vorher das Abschneiden
           * verschwiegen hat - jetzt sagt sie schlicht, wie viel da ist.
           */}
          <p className="panel__title log__head">
            Verlauf
            <span className="log__total">{entries.length}</span>
          </p>

          <ol className="log">
            {newestFirst.map((entry, index) => {
              /*
               * Die Wegmarke gehoert **vor** den ersten Eintrag ihrer Runde.
               * Nach unten gelesen geht es rueckwaerts durch die Partie, der
               * Block unter der Marke ist also ihrer. Beim obersten Eintrag
               * gibt es keinen Vorgaenger - dort steht die laufende Runde.
               */
              const previous = newestFirst[index - 1];
              const opensRound = previous === undefined || previous.turn !== entry.turn;

              return (
                <li key={entries.length - index} className="log__entry">
                  {opensRound ? <b className="log__round">Runde {entry.turn}</b> : null}
                  {entry.text}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Eine Schriftrolle: gerollter Rand oben und unten, Zeilen dazwischen.
 *
 * Kein Zahnrad und keine drei Striche - beides heisst auf jedem anderen
 * Bildschirm etwas anderes (Einstellungen, Menue). Eine Rolle heisst
 * „aufgeschrieben", und genau das ist der Verlauf.
 */
function ScrollMark(): JSX.Element {
  return (
    <svg className="log-toggle__mark" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 4 H16 M4 10 H13 M4 16 H16" />
    </svg>
  );
}
