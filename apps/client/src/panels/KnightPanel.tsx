import type { JSX } from 'react';
import type { RuleSet } from '@conquerist/shared';
import type { ActionTargets } from '../game/targets';

/**
 * Was man mit seinen Rittern jetzt tun kann.
 *
 * **Rolle:** vier Fragen, vier Knöpfe, jeder genau dann bedienbar, wenn es
 * dafür eine Stelle gibt. **Aufbau:** eine Reihe neben der Bauleiste, dieselbe
 * Bauform wie dort — Zeichen groß, Wort im `title` und für Vorlesewerkzeuge.
 * **Woran man sich erinnert:** daß ein Klick hier das Brett zum Sprechen
 * bringt, dasselbe Zwei-Schritt-Muster wie beim Bauen.
 *
 * **Warum keine Knöpfe am einzelnen Ritter.** Eine Figur ist auf dem Brett
 * rund zwanzig Pixel groß. Vier Aktionen daran wären vier Trefferflächen unter
 * Fingergröße, und drei davon wären fast immer gesperrt. Die Frage kommt
 * zuerst („was tun"), die Stelle danach — genau wie beim Bauen seit dem
 * Playtest.
 *
 * **Sie erscheint gar nicht, wo es keine Ritter gibt.** Nicht grau, sondern
 * weg: ein leerer Rahmen wäre eine Auskunft über nichts, und vier Knöpfe, die
 * nie angehen, sagen „gerade nicht" über etwas, das an diesem Tisch nie geht.
 * Woran es hängt, ist der Preis im Regelwerk und kein Name — dieselbe Regel,
 * nach der schon der Kaufstapel wegfällt.
 */
export type KnightMode = 'activate' | 'upgrade' | 'move' | 'chase';

export interface KnightPanelProps {
  readonly targets: ActionTargets;
  /** Was die Bauteile kosten - hier nur, um zu wissen, ob es Ritter gibt. */
  readonly costs: RuleSet['buildCosts'];
  /** Welcher Rittermodus läuft. `null` heißt: das Brett ist ruhig. */
  readonly mode: KnightMode | null;
  readonly onMode: (mode: KnightMode | null) => void;
}

const KNIGHT_LABELS: Readonly<Record<KnightMode, string>> = {
  activate: 'Aktivieren',
  upgrade: 'Aufwerten',
  move: 'Versetzen',
  chase: 'Räuber vertreiben',
};

/**
 * Was der Knopf verspricht, wenn nichts geht.
 *
 * Ein gesperrter Knopf sagt sonst nur „nein" und nie, woran es liegt - und
 * genau dort ist die Auskunft am meisten wert (dieselbe Überlegung wie beim
 * Preis an der Bauleiste).
 *
 * **Jeder Satz nennt beide Gründe, und das ist eine Korrektur.** „Aufwerten:
 * kein Ritter kann gerade steigen" stand im Browser vor einem Ritter, der sehr
 * wohl steigen konnte — es fehlten die Karten. Ein gesperrter Knopf, der den
 * falschen Grund nennt, ist schlimmer als einer, der gar keinen nennt: er
 * schickt den Spieler auf die falsche Suche.
 */
const KNIGHT_EMPTY: Readonly<Record<KnightMode, string>> = {
  activate: 'Aktivieren: kein Ritter ohne Helm, oder das Getreide fehlt',
  upgrade: 'Aufwerten: kein Ritter kann steigen, oder Wolle und Erz fehlen',
  move: 'Versetzen: kein Ritter ist handlungsbereit',
  chase: 'Räuber vertreiben: kein Ritter steht am Räuberfeld',
};

export function KnightPanel({
  targets,
  costs,
  mode,
  onMode,
}: KnightPanelProps): JSX.Element | null {
  if (costs.knight === undefined) return null;

  const spots: Readonly<Record<KnightMode, number>> = {
    activate: targets.activate.size,
    upgrade: targets.upgrade.size,
    move: targets.moves.size,
    chase: targets.chase.size,
  };

  const modes: readonly KnightMode[] = ['activate', 'upgrade', 'move', 'chase'];

  return (
    <div className="knights" role="group" aria-label="Ritter">
      {modes.map((entry) => {
        const count = spots[entry];
        const active = mode === entry;

        return (
          <button
            key={entry}
            type="button"
            className={active ? 'knights__pick knights__pick--active' : 'knights__pick'}
            data-testid={`knight-${entry}`}
            aria-pressed={active}
            disabled={count === 0}
            title={
              count === 0
                ? KNIGHT_EMPTY[entry]
                : `${KNIGHT_LABELS[entry]}: ${count} ${count === 1 ? 'Stelle' : 'Stellen'}`
            }
            // Noch einmal derselbe Knopf schaltet den Modus wieder aus - sonst
            // klebt eine Absicht am Brett, die man nur durch Ziehen loswird.
            onClick={() => onMode(active ? null : entry)}
          >
            <span className="knights__mark">
              <ModeMark mode={entry} />
            </span>
            <span className="visually-hidden">{KNIGHT_LABELS[entry]}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Die vier Zeichen, alle im 24er-Raster wie die übrigen dieser Oberfläche.
 *
 * Sie sind gestrichen und nicht gefüllt: ein Modus ist eine Absicht und kein
 * Spielmaterial, und die Bauleiste daneben trägt bereits gefüllte Silhouetten.
 * Zwei Sorten Zeichen nebeneinander sagen von selbst, daß hier zwei
 * verschiedene Fragen stehen.
 */
function ModeMark({ mode }: { readonly mode: KnightMode }): JSX.Element {
  return (
    <svg className="piece piece--mode" viewBox="0 0 24 24" aria-hidden="true">
      {mode === 'activate' ? (
        // Der Helm - dasselbe Stück Material, das den aktivierten Ritter
        // auf dem Brett kennzeichnet.
        <path d="M5 13 L12 3 L19 13 L16 17 H8 Z" />
      ) : mode === 'upgrade' ? (
        // Eine Fahnenspitze, aufwärts: die Stufe steht am Ritter in Spitzen,
        // also steht sie hier auch in einer.
        <path d="M12 3 L19 12 H14 V21 H10 V12 H5 Z" />
      ) : mode === 'move' ? (
        // Zwei Fußspuren, versetzt - eine Bewegung von hier nach dort.
        <path d="M6 4 h4 v7 h-4 Z M6 13 h4 v3 h-4 Z M14 8 h4 v7 h-4 Z M14 17 h4 v3 h-4 Z" />
      ) : (
        // Der Räuberstein mit einem Pfeil, der ihn fortweist.
        <path d="M9 20 L9 12 a3 3 0 0 1 6 0 L15 20 Z M2 6 h8 M2 6 l3 -3 M2 6 l3 3" />
      )}
    </svg>
  );
}
