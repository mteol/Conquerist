import type { JSX } from 'react';
import { HexField } from './HexField';

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
 * **Das eine Element:** der Hintergrund ist das Hexfeld selbst, gezeichnet mit
 * denselben Funktionen wie das Brett im Spiel. Kein Muster, keine Textur - das
 * Menue sitzt auf genau dem Raster, auf dem gleich gespielt wird.
 *
 * Ohne Bewegung, mit Absicht: ein driftendes Raster erklaert keinen
 * Zustandswechsel (Regel 5).
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

export function MenuScreen({ onChoose, openGames = 0 }: MenuScreenProps): JSX.Element {
  return (
    <main className="menu">
      <HexField />

      <div className="menu__inner">
        <header className="menu__brand">
          <h1>Conquerist</h1>
          <p className="menu__lead">Drei bis sechs Spieler. Sechs Geräte oder eins.</p>
        </header>

        <nav className="menu__entries" aria-label="Hauptmenü">
          {openGames > 0 ? (
            <button
              type="button"
              className="menu__entry menu__entry--resume"
              onClick={() => onChoose('resume')}
            >
              Weiterspielen ({openGames})
            </button>
          ) : null}

          {ENTRIES.map((entry) => (
            <button
              key={entry.choice}
              type="button"
              className="menu__entry"
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
