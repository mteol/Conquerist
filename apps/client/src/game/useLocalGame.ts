import { useMemo } from 'react';
import {
  legalActions,
  playerViewOf,
  type GameAction,
  type GameState,
  type PlayerView,
} from '@conquerist/shared';
import type { SoundEvent } from '../audio/cues';
import type { Seat } from '../seats';
import { actingPlayers } from './view';
import { useHotseatGame } from './useHotseatGame';
import type { LogEntry } from './hotseat';

/**
 * Die lokale Partie in der Form, die der Spielbildschirm liest.
 *
 * Sie baut ihre `PlayerView` mit **derselben Funktion**, die der Server
 * benutzt, und holt ihre erlaubten Zuege mit **derselben** `legalActions`. Das
 * ist der ganze Trick hinter „ein Satz Bildschirme": nicht zwei Wege, die
 * zufaellig gleich aussehen, sondern ein Weg mit zwei Quellen.
 *
 * Wessen Sicht gilt, ist am selben Geraet eine echte Frage - hier gibt es
 * niemanden, der „ich" waere. Es gilt die Sicht dessen, der handeln darf: in
 * der Gruendung die Schlange, nach einer Sieben der erste Wartende, sonst der
 * Spieler am Zug. Fremde Haende sind damit auch lokal verdeckt, und der
 * Schalter dafuer ist verschwunden - der Bildschirm wandert weiter, die
 * Handkarten sollen es nicht.
 */
export interface LocalGame {
  readonly view: PlayerView;
  readonly actions: readonly GameAction[];
  readonly log: readonly LogEntry[];
  readonly error: string | null;
  /** Der Klang zum letzten Zug - abgespielt wird er vom Aufrufer. */
  readonly sound: SoundEvent | null;
  readonly act: (action: GameAction) => void;
  readonly dismissError: () => void;
}

export function useLocalGame(game: GameState, seats: readonly Seat[]): LocalGame {
  const { state, dispatch, dismissError } = useHotseatGame(game, seats);

  const viewer = actingPlayers(state.game)[0] ?? state.game.players[0]!.id;

  const view = useMemo(
    // Die Version zaehlt die Zuege: dieselbe Bedeutung wie online, nur ohne
    // Netz - jeder Zug ein Stand.
    () => playerViewOf(state.game, viewer, seats, state.actions.length),
    [state.game, state.actions.length, viewer, seats],
  );

  const actions = useMemo(() => legalActions(state.game, viewer), [state.game, viewer]);

  return {
    view,
    actions,
    log: state.log,
    error: state.lastError,
    sound: state.sound,
    act: dispatch,
    dismissError,
  };
}
