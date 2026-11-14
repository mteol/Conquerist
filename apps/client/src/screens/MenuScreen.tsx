import type { CSSProperties, JSX } from 'react';
import type { Identity } from '../game/useOnlineGame';
import { AccountCorner } from './AccountCorner';
import { SeaChart } from '../chart/SeaChart';
import { useRoseAt } from './useRoseAt';
import { Wordmark } from './Wordmark';

/**
 * Der Titelbildschirm.
 *
 * **Er war einmal gestrichen und ist zurueck - aus einem anderen Grund, als er
 * ging.** Gestrichen wurde er, weil er genau eine Frage stellte (welcher Weg)
 * und der Bildschirm dahinter sie als Ueberschrift noch einmal vortrug: zwei
 * Flaechen fuer eine Entscheidung. Seither hat der Wartebereich sein Brett
 * bekommen, und damit sahen Einrichtung und Wartebereich gleich aus - links ein
 * Panel, rechts das Brett, zweimal derselbe Bau. **Ein Eingang, der aussieht
 * wie die Flaeche dahinter, ist kein Eingang.**
 *
 * Die alte Doppelung kommt dabei nicht mit zurueck: `StartScreen` traegt keine
 * Wortmarke mehr. Die steht jetzt hier, einmal, und ist der Inhalt statt der
 * Kopfzeile eines Formulars. Was dort bleibt, ist die Reiterreihe - und die ist
 * kein Vortrag der Antwort, sondern das Bedienelement, mit dem man sie aendert,
 * ohne zurueckzugehen. Dazu ein „Zurueck" hierher.
 *
 * **Rolle:** Die erste Flaeche, die jemand sieht. Sie hat genau eine Aufgabe -
 * den Weg in eine Partie zeigen. Name, Seed und Tischgroesse gehoeren auf den
 * Bildschirm dahinter; hier waeren sie drei Fragen vor der ersten Entscheidung.
 *
 * **Aufbau:** Titel oben, drei Eintraege zentriert darunter, untereinander.
 * Keine Spalten, keine Kacheln - drei Zeilen liest man von oben nach unten,
 * und mehr Struktur haette dieser Bildschirm nicht zu codieren (Regel 6).
 *
 * **Das eine Element:** die Seekarte (`chart/SeaChart.tsx`), auf der auch alle
 * Bildschirme danach liegen. Die Wortmarke ist aus demselben Winkel geschnitten
 * wie das Brett (`Wordmark.tsx`) und steht auf dem Netz der Karte.
 *
 * **Zur Bewegung.** Der Eingang ist ein Zustandswechsel - vorher war nichts da,
 * jetzt ist die Anwendung da - und bekommt deshalb **eine** Bewegung: die Marke
 * schnellt herein und rastet ein, und einmal laeuft eine Welle von innen nach
 * aussen ueber das Netz der Karte (`--d` je Linie, siehe `start.css`). Die
 * Untertitelzeile kommt als Schrift (`ink-in`), die drei Wege als Pergament
 * (`sheet-in`). Danach steht alles still: kein Schweben, keine Parallaxe.
 *
 * Alle Animationen sind Eingaenge und enden in ihrer Ruhelage (die Falle aus
 * `CLAUDE.md`: eine abgeschaltete Ausgangsanimation stuende sofort an ihrem
 * Ende). Bei `prefers-reduced-motion` kuerzt `base.css` auch die Verzoegerung.
 */
export type MenuChoice = 'online' | 'local' | 'join' | 'resume';

export interface MenuScreenProps {
  readonly onChoose: (choice: MenuChoice) => void;
  /**
   * Wie viele eigene Partien offen sind.
   *
   * Null heisst: der Eintrag fehlt ganz. Ein „Weiterspielen (0)" waere eine
   * Auskunft ueber nichts und stuende trotzdem vor den drei Wegen.
   */
  readonly openGames?: number;
  /**
   * Wer angemeldet ist - fuer die Konto-Ecke oben rechts.
   *
   * Optional, damit bestehende Aufrufe ohne Identitaet weiter gelten: ohne
   * Angabe bleibt die Ecke leer (`AccountCorner` rendert dann `null`).
   */
  readonly identity?: Identity | null;
  readonly onRegister?: () => void;
  readonly onLogin?: () => void;
  readonly onLogout?: () => void;
}

/** Tut nichts - Vorgabewert fuer die drei Konto-Aktionen ohne Identitaet. */
function noop(): void {
  // Bewusst leer: ohne `identity` rendert `AccountCorner` ohnehin `null`, und
  // diese Griffe werden nie aufgerufen.
}

/*
 * Dreimal dasselbe Wort, dreimal derselbe Bau.
 *
 * „Partie" und nicht „Spiel": im Rest der Anwendung heisst es durchgaengig so -
 * „Deine Partien", „Die Partie laeuft bereits", „Lokale Partie starten". Zwei
 * Woerter fuer dieselbe Sache liest man als zwei Sachen (Regel 8). Und weil die
 * drei Zeilen untereinander stehen, sind sie auch gleich gebaut: Was zuerst,
 * das Wie danach.
 */
const ENTRIES: readonly { readonly choice: MenuChoice; readonly label: string }[] = [
  { choice: 'online', label: 'Online spielen' },
  { choice: 'local', label: 'An einem Gerät spielen' },
  { choice: 'join', label: 'Partie beitreten' },
];

/**
 * Der Platz in der Reihe wird als Zahl mitgegeben, nicht als eigene Klasse.
 *
 * Das CSS rechnet daraus die Verzoegerung (`calc(var(--i) * var(--stagger))`). Vier
 * Klassen fuer vier Verzoegerungen waeren dieselbe Information, nur haendisch
 * gepflegt - und beim fuenften Eintrag vergessen.
 */
function order(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

/**
 * Wo die Windrose sitzt: im Querformat im Westen, links der Mitte, im
 * Hochformat oben links (NNW) - dort ist freie See; Titel und Wege stehen
 * mittig, die Konto-Ecke oben rechts.
 */
const ROSE_LANDSCAPE = 12;
const ROSE_PORTRAIT = 15;

export function MenuScreen({
  onChoose,
  openGames = 0,
  identity = null,
  onRegister = noop,
  onLogin = noop,
  onLogout = noop,
}: MenuScreenProps): JSX.Element {
  const roseAt = useRoseAt(ROSE_LANDSCAPE, ROSE_PORTRAIT);
  // „Weiterspielen" steht vor den drei Wegen und faellt deshalb auch zuerst.
  const resumeShown = openGames > 0;

  return (
    <main className="menu">
      <SeaChart className="menu__chart" roseAt={roseAt} />

      {/*
       * Die Konto-Ecke faellt zuletzt in die Choreografie ein - ihr `order`
       * muss deshalb hinter dem hoechsten `--i` der Eintraege liegen.
       * „Weiterspielen" schiebt die drei Wege um eine Stufe, und genau darum
       * verschiebt es auch die Ecke.
       */}
      <AccountCorner
        identity={identity}
        onRegister={onRegister}
        onLogin={onLogin}
        onLogout={onLogout}
        order={resumeShown ? 4 : 3}
      />

      <div className="menu__inner">
        {/* Ohne Klasse: das `header` gruppiert, gestaltet wird an Titel und
            Untertitel selbst. Eine Klasse, an der keine Regel haengt, ist ein
            Haken, der beim naechsten Lesen nach Absicht aussieht. */}
        <header>
          <h1 className="menu__title">
            <Wordmark animated />
            {/*
             * Der Titel als Text, nur unsichtbar: die Ueberschrift braucht
             * einen zugaenglichen Namen, und der darf nicht aus Pfaddaten
             * erraten werden muessen.
             */}
            <span className="visually-hidden">Conquerist</span>
          </h1>
          <p className="chartlabel ink-in menu__lead">
            Drei bis sechs Spieler. Sechs Geräte oder eins.
          </p>
        </header>

        <nav className="menu__entries" aria-label="Hauptmenü">
          {resumeShown ? (
            <button
              type="button"
              className="button menu__entry menu__entry--resume"
              style={order(0)}
              onClick={() => onChoose('resume')}
            >
              Weiterspielen ({openGames})
            </button>
          ) : null}

          {ENTRIES.map((entry, index) => (
            <button
              key={entry.choice}
              type="button"
              className="button menu__entry"
              style={order(resumeShown ? index + 1 : index)}
              onClick={() => onChoose(entry.choice)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
