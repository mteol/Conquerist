import { describeTransition, reduce, type GameAction, type GameState } from '@conquerist/shared';
import type { Seat } from '../seats';

/**
 * Der Zustand einer Hotseat-Partie: das Spiel, die Folge, der Verlauf.
 *
 * Die **Aktionsfolge** ist kein Zierrat. Sie ist genau die Eingabe fuer
 * `replay` und damit die Bruecke zu Etappe 6 (Action-Log und Snapshot). Ein
 * Test haelt fest, dass sie den Endzustand reproduziert.
 *
 * Rueckgaengig gibt es bewusst nicht: mit verdeckter Information ab Etappe 5
 * waere es nicht haltbar, und ein halber Rueckweg ist schlimmer als keiner.
 */
export interface LogEntry {
  readonly turn: number;
  readonly text: string;
}

export interface HotseatState {
  readonly game: GameState;
  readonly actions: readonly GameAction[];
  readonly log: readonly LogEntry[];
  /** Der letzte Ablehnungsgrund - sichtbar, bis er weggeraeumt wird. */
  readonly lastError: string | null;
}

export type HotseatEvent =
  { readonly type: 'apply'; readonly action: GameAction } | { readonly type: 'dismissError' };

export function startHotseat(game: GameState): HotseatState {
  return { game, actions: [], log: [], lastError: null };
}

/**
 * Rein, damit er ohne React pruefbar ist - der Haken darueber ist nur noch
 * Verdrahtung.
 */
export function hotseatReducer(
  state: HotseatState,
  event: HotseatEvent,
  seats: readonly Seat[],
): HotseatState {
  if (event.type === 'dismissError') {
    return state.lastError === null ? state : { ...state, lastError: null };
  }

  const result = reduce(state.game, event.action);
  if (!result.ok) {
    // Ueber das Brett ist nur klickbar, was legalActions genannt hat. Greifen
    // kann dieser Zweig nur dort, wo der Spieler frei zusammenstellt - beim
    // Abwerfen und beim Handel. Deshalb eine sichtbare Meldung statt eines
    // stillen Abbruchs.
    return { ...state, lastError: result.error.message };
  }

  return {
    game: result.state,
    actions: [...state.actions, event.action],
    log: [
      ...state.log,
      {
        turn: result.state.turn,
        text: describeTransition(state.game, event.action, result.state, seats),
      },
    ],
    lastError: null,
  };
}
