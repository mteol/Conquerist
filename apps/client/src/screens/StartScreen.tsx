import { useState, type JSX } from 'react';
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
import { ConnectionPanel } from '../diagnostics/ConnectionPanel';

/**
 * Wo eine Partie anfaengt.
 *
 * Der Seed steht sichtbar im Formular und ist ueberschreibbar. Das kostet fast
 * nichts und macht jede Partie exakt wiederholbar: ein Brett, das komisch
 * aussieht, ist damit ein Fehlerbericht statt einer Erinnerung.
 *
 * Der Vorschlag kommt aus `crypto` - echter Zufall, und die einzige Stelle im
 * Projekt, an der das erlaubt ist. Regel 2 gilt fuer die Logik; die Grenze
 * zwischen Welt und Logik ist genau dieses Eingabefeld.
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
  const [blueprintId, setBlueprintId] = useState(CLASSIC_34.id);
  const [problem, setProblem] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const available = blueprintsFor(seats.length);
  const chosen = available.find((entry) => entry.id === blueprintId) ?? available[0];

  const resize = (count: number): void => {
    // Bereits eingetragene Namen ueberleben das Vergroessern.
    setSeats(
      defaultSeats(count).map((seat, index) => ({
        ...seat,
        name: seats[index]?.name ?? seat.name,
      })),
    );

    const fitting = blueprintsFor(count)[0];
    if (fitting !== undefined) setBlueprintId(fitting.id);
  };

  const rename = (index: number, name: string): void => {
    setSeats((current) =>
      current.map((seat, position) => (position === index ? { ...seat, name } : seat)),
    );
  };

  const start = (): void => {
    if (chosen === undefined) {
      setProblem(`Fuer ${seats.length} Spieler gibt es kein passendes Brett`);
      return;
    }

    try {
      const scenario = generateScenario(chosen, seed);
      const game = createGame(
        scenario,
        CLASSIC_RULES,
        seats.map((seat) => seat.id),
        seed,
      );
      setProblem(null);
      onStart(game, seats);
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <main className="page">
      <header className="page__header">
        <h1>Conquerist</h1>
        <p className="page__subtitle">Etappe 3 &middot; Hotseat am selben Geraet</p>
      </header>

      <section className="card">
        <label className="field">
          Spieler
          <select
            aria-label="Spieler"
            value={seats.length}
            onChange={(event) => resize(Number(event.currentTarget.value))}
          >
            {SEAT_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        {seats.map((seat, index) => (
          <label key={seat.id} className="field">
            <span
              className="swatch"
              style={{ background: SEAT_COLORS[index] }}
              aria-hidden="true"
            />
            <input
              aria-label={`Name von Spieler ${index + 1}`}
              value={seat.name}
              onChange={(event) => rename(index, event.currentTarget.value)}
            />
          </label>
        ))}

        <label className="field">
          Brett
          <select
            aria-label="Brett"
            value={chosen?.id ?? ''}
            onChange={(event) => setBlueprintId(event.currentTarget.value)}
          >
            {available.map((blueprint) => (
              <option key={blueprint.id} value={blueprint.id}>
                {blueprint.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Seed
          <input
            aria-label="Seed"
            value={seed}
            onChange={(event) => setSeed(event.currentTarget.value)}
          />
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setSeed(randomSeed())}
          >
            Wuerfeln
          </button>
        </label>

        {problem === null ? null : <p className="error">{problem}</p>}

        <button type="button" className="button button--go" onClick={start}>
          Partie starten
        </button>
      </section>

      {/*
       * Der Inhalt wird erst erzeugt, wenn das Feld offen ist - und nicht bloss
       * ausgeblendet. `details` versteckt seine Kinder nur optisch; sie waeren
       * gerendert, `useConnection` liefe, und eine Hotseat-Partie haette eine
       * WebSocket-Verbindung, die sie nicht braucht. Ein Test haelt das fest.
       */}
      <details
        className="card"
        open={diagnosticsOpen}
        onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}
      >
        <summary>Verbindung und Diagnose (Etappe 0)</summary>
        {diagnosticsOpen ? <ConnectionPanel /> : null}
      </details>
    </main>
  );
}
