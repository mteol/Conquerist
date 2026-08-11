import type { CSSProperties, JSX } from 'react';
import { HexField } from './HexField';
import { Wordmark } from './Wordmark';

/**
 * Das Hauptmenue.
 *
 * **Rolle:** Die erste Flaeche, die jemand sieht. Sie hat genau eine Aufgabe -
 * den Weg in eine Partie zeigen. Name, Seed und Tischgroesse gehoeren auf den
 * Bildschirm dahinter; hier waeren sie drei Fragen vor der ersten Entscheidung.
 *
 * **Aufbau:** Titel oben, drei Eintraege zentriert darunter, untereinander.
 * Keine Spalten, keine Kacheln - drei Zeilen liest man von oben nach unten,
 * und mehr Struktur haette dieser Bildschirm nicht zu codieren (Regel 6).
 *
 * **Das eine Element:** die Wortmarke ist aus demselben Winkel geschnitten wie
 * das Brett (`Wordmark.tsx`), und sie sitzt auf dem Hexfeld, das mit den
 * Funktionen des Bretts gezeichnet ist (`HexField.tsx`). Beides ist kein Bild,
 * das so aehnlich aussieht - es ist dasselbe Material.
 *
 * **Zur Bewegung.** Dieser Bildschirm hatte bewusst keine, und Regel 5 ist der
 * Grund: Bewegung erklaert einen Zustandswechsel oder entfaellt. Der Eingang
 * ist ein Zustandswechsel - vorher war nichts da, jetzt ist die Anwendung da -
 * und deshalb bekommt er eine Choreografie: die Marke schnellt herein und
 * rastet ein, der Aufprall laeuft einmal als Welle durchs Feld, die drei Wege
 * fallen von oben nach. Danach steht alles still. Was es ausdruecklich nicht
 * gibt: Dauerbewegung, Schweben, Parallaxe am Mauszeiger. Das waere Dekoration
 * und faellt unter denselben Satz.
 *
 * Alle Animationen sind Eingaenge und enden in ihrer Ruhelage. Bei
 * `prefers-reduced-motion` steht die Flaeche damit sofort fertig da - der Fall,
 * der in `CLAUDE.md` als Falle notiert ist (eine abgeschaltete
 * Ausgangsanimation stuende sofort an ihrem Ende und waere unsichtbar).
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
  { choice: 'online', label: 'Partie starten — online' },
  { choice: 'local', label: 'Partie starten — lokal' },
  { choice: 'join', label: 'Partie beitreten' },
];

/**
 * Der Platz in der Reihe wird als Zahl mitgegeben, nicht als eigene Klasse.
 *
 * Das CSS rechnet daraus die Verzoegerung (`calc(var(--i) * 65ms)`). Vier
 * Klassen fuer vier Verzoegerungen waeren dieselbe Information, nur haendisch
 * gepflegt - und beim fuenften Eintrag vergessen.
 */
function order(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

export function MenuScreen({ onChoose, openGames = 0 }: MenuScreenProps): JSX.Element {
  // „Weiterspielen" steht vor den drei Wegen und faellt deshalb auch zuerst.
  const resumeShown = openGames > 0;

  return (
    <main className="menu">
      <HexField />

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
          <p className="menu__lead">Drei bis sechs Spieler. Sechs Geräte oder eins.</p>
        </header>

        <nav className="menu__entries" aria-label="Hauptmenü">
          {resumeShown ? (
            <button
              type="button"
              className="menu__entry menu__entry--resume"
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
              className="menu__entry"
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
