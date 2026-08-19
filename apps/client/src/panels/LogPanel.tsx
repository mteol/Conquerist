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
 * **Der Zustand bleibt hier.** Ob der Verlauf offen ist, geht keine andere
 * Komponente etwas an und schon gar nicht den Spielzustand - es ist reine
 * Ansicht. Ihn nach oben zu reichen hiesse, den GameScreen um ein `useState` zu
 * verlaengern, das nur hier gelesen wird.
 */
export function LogPanel({ entries }: { readonly entries: readonly LogEntry[] }): JSX.Element {
  const [open, setOpen] = useState(false);

  /** Juengster Eintrag oben. Mehr als zwanzig braucht niemand im Blick. */
  const recent = entries.slice(-20).reverse();

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
          <ol className="log">
            {recent.map((entry, index) => (
              <li key={entries.length - index} className="log__entry">
                {entry.text}
              </li>
            ))}
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
