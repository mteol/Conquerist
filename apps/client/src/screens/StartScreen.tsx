import { useMemo, useState, type JSX } from 'react';
import {
  CLASSIC_34,
  CLASSIC_56,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  type GameState,
  type ScenarioBlueprint,
} from '@conquerist/shared';
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, defaultSeats, type Seat } from '../seats';
import { BoardSvg } from '../board/BoardSvg';
import { EMPTY_TARGETS } from '../game/targets';
import { ConnectionPanel } from '../diagnostics/ConnectionPanel';

/**
 * Wo eine Partie anfaengt.
 *
 * Der Bildschirm zeigt **das Brett, das gleich gespielt wird** - erzeugt aus
 * dem Seed im Formular, neu bei jedem Tastendruck. Das ist keine Zierde: der
 * Seed ist sonst eine kryptische Zeichenkette, und so wird er zu etwas
 * Sichtbarem. Der Generator aus Etappe 1 braucht dafuer rund drei Millisekunden
 * je Brett; das traegt eine Vorschau, die am Tippen haengt.
 *
 * Der Vorschlag fuer den Seed kommt aus `crypto` - echter Zufall, und die
 * einzige Stelle im Projekt, an der das erlaubt ist. Regel 2 gilt fuer die
 * Logik; die Grenze zwischen Welt und Logik ist genau dieses Eingabefeld.
 */
export interface StartScreenProps {
  readonly onStart: (game: GameState, seats: readonly Seat[]) => void;
}

const BLUEPRINTS: readonly ScenarioBlueprint[] = [CLASSIC_34, CLASSIC_56];

/**
 * Welche Bretter eine Tischgroesse tragen.
 *
 * Die Grenzen stehen im Blueprint (`minPlayers` / `maxPlayers`) und werden hier
 * gelesen, nicht wiederholt - sonst gaebe es zwei Wahrheiten, und `createGame`
 * wuerde mit Recht werfen.
 */
export function blueprintsFor(playerCount: number): readonly ScenarioBlueprint[] {
  return BLUEPRINTS.filter(
    (blueprint) => playerCount >= blueprint.minPlayers && playerCount <= blueprint.maxPlayers,
  );
}

/** Ein kurzer Vorschlag, den man abtippen und weitersagen kann. */
export function randomSeed(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(36).padStart(2, '0')).join('');
}

const SEAT_COUNTS = Array.from(
  { length: MAX_SEATS - MIN_SEATS + 1 },
  (_unused, index) => MIN_SEATS + index,
);

export function StartScreen({ onStart }: StartScreenProps): JSX.Element {
  const [seats, setSeats] = useState<Seat[]>(() => defaultSeats(MIN_SEATS));
  const [seed, setSeed] = useState(randomSeed);
  const [problem, setProblem] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  /*
   * Bei drei bis vier Spielern passt nur `classic34`, bei fuenf bis sechs nur
   * `classic56` - die Auswahl haette also immer genau einen Eintrag. Deshalb
   * ist das Brett hier keine Wahl, sondern eine Angabe. `blueprintsFor` bleibt,
   * weil ein drittes Szenario daraus wieder eine Wahl macht.
   */
  const blueprint = blueprintsFor(seats.length)[0];

  /** Das Brett zum eingestellten Seed - dasselbe, das die Partie bekommt. */
  const preview = useMemo(() => {
    if (blueprint === undefined) return null;
    try {
      const scenario = generateScenario(blueprint, seed);
      return createGame(
        scenario,
        CLASSIC_RULES,
        seats.map((entry) => entry.id),
        seed,
      );
    } catch {
      // Eine Vorschau, die nicht entsteht, darf den Bildschirm nicht mitnehmen.
      // Was schiefging, sagt beim Starten die Meldung aus `createGame`.
      return null;
    }
  }, [blueprint, seed, seats]);

  const resize = (count: number): void => {
    // Bereits eingetragene Namen ueberleben das Vergroessern.
    setSeats(
      defaultSeats(count).map((seat, index) => ({
        ...seat,
        name: seats[index]?.name ?? seat.name,
      })),
    );
  };

  const rename = (index: number, name: string): void => {
    setSeats((current) =>
      current.map((seat, position) => (position === index ? { ...seat, name } : seat)),
    );
  };

  const start = (): void => {
    if (blueprint === undefined) {
      setProblem(`Fuer ${seats.length} Spieler gibt es kein passendes Brett`);
      return;
    }
    if (preview === null) {
      setProblem('Das Brett zu diesem Seed laesst sich nicht bauen');
      return;
    }

    setProblem(null);
    onStart(preview, seats);
  };

  return (
    <main className="start">
      <section className="start__panel">
        <header className="start__brand">
          <span className="eyebrow">Etappe 3 · Hotseat</span>
          <h1>Conquerist</h1>
          <p className="start__lead">Ein Tisch, ein Gerät, drei bis sechs Spieler.</p>
        </header>

        <fieldset className="field-group">
          <legend>Spieler</legend>
          <div className="seatcount">
            {SEAT_COUNTS.map((count) => (
              <span key={count}>
                <input
                  id={`seatcount-${count}`}
                  type="radio"
                  name="seatcount"
                  aria-label={`${count} Spieler`}
                  checked={seats.length === count}
                  onChange={() => resize(count)}
                />
                <label htmlFor={`seatcount-${count}`}>{count}</label>
              </span>
            ))}
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend>Am Tisch</legend>
          <ol className="seats">
            {seats.map((seat, index) => (
              <li key={seat.id}>
                <PieceMark color={SEAT_COLORS[index] ?? seat.color} />
                <input
                  aria-label={`Name von Spieler ${index + 1}`}
                  value={seat.name}
                  maxLength={16}
                  onChange={(event) => rename(index, event.currentTarget.value)}
                />
              </li>
            ))}
          </ol>
        </fieldset>

        <div className="boardfact">
          <span className="boardfact__name">{blueprint?.name ?? 'Kein passendes Brett'}</span>
          <span className="boardfact__detail">
            {blueprint === undefined
              ? `${seats.length} Spieler`
              : `${blueprint.rows.reduce((sum, row) => sum + row, 0)} Felder`}
          </span>
        </div>

        <fieldset className="field-group">
          <legend>Seed</legend>
          <div className="seedrow">
            <input
              aria-label="Seed"
              value={seed}
              maxLength={24}
              onChange={(event) => setSeed(event.currentTarget.value)}
            />
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setSeed(randomSeed())}
            >
              Neu würfeln
            </button>
          </div>
          <p className="start__note">
            Gleicher Seed, gleiches Brett — bei euch und bei allen anderen.
          </p>
        </fieldset>

        {problem === null ? null : <p className="error">{problem}</p>}

        <button type="button" className="button button--go start__start" onClick={start}>
          Partie starten
        </button>

        {/*
         * Der Inhalt wird erst erzeugt, wenn das Feld offen ist - und nicht
         * bloss ausgeblendet. `details` versteckt seine Kinder nur optisch; sie
         * waeren gerendert, `useConnection` liefe, und eine Hotseat-Partie
         * haette eine WebSocket-Verbindung, die sie nicht braucht. Ein Test
         * haelt das fest.
         */}
        <details
          className="start__diagnostics"
          open={diagnosticsOpen}
          onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}
        >
          <summary>Verbindung und Diagnose (Etappe 0)</summary>
          {diagnosticsOpen ? <ConnectionPanel /> : null}
        </details>
      </section>

      <div className="start__preview">
        {preview === null ? null : (
          <BoardSvg
            state={preview}
            targets={EMPTY_TARGETS}
            seats={seats}
            onPick={() => {
              /* Die Vorschau ist zum Ansehen da, nicht zum Spielen. */
            }}
          />
        )}
        <p className="start__caption">
          Euer Brett zum Seed
          <b>{seed === '' ? '—' : seed}</b>
        </p>
      </div>
    </main>
  );
}

/**
 * Die Siedlung aus dem Brett, klein - damit die Spielerfarbe hier dieselbe
 * Form hat wie spaeter auf dem Feld.
 */
function PieceMark({ color }: { readonly color: string }): JSX.Element {
  return (
    <svg className="piece" viewBox="-10 -12 20 22" aria-hidden="true">
      <path
        d="M -8 8 L -8 -2 L 0 -10 L 8 -2 L 8 8 Z"
        fill={color}
        stroke="#16202a"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
