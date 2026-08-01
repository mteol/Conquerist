import {
  countResources,
  discardCountFor,
  setupPlayer,
  victoryPointsOf,
  type GameState,
  type PlayerId,
  type ResourceAmounts,
  type RuleSet,
} from '@conquerist/shared';
import { seatsById, type Seat } from '../seats';

/**
 * Die Projektion vom Zustand auf das, was am Bildschirm steht.
 *
 * Zwei Gruende, das als reine Funktion zu bauen: es laesst sich ohne DOM in
 * vielen Faellen pruefen, und es ist die ehrliche Vorarbeit fuer Etappe 5 -
 * `PlayerView` wird genau so eine Projektion sein, nur serverseitig und dann
 * nicht mehr abschaltbar.
 */
export interface PlayerView {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly victoryPoints: number;
  readonly cardCount: number;
  /** `null`, wenn verdeckt. Die Anzahl bleibt trotzdem sichtbar. */
  readonly resources: ResourceAmounts | null;
  readonly piecesLeft: RuleSet['pieceStock'];
  readonly isCurrent: boolean;
  /** Wie viele Karten dieser Spieler gerade abwerfen muss; 0, wenn keine. */
  readonly mustDiscard: number;
}

export interface GameView {
  readonly players: readonly PlayerView[];
  /** Wer jetzt handeln darf - in der Gruendung aus der Schlange, nach einer Sieben mehrere. */
  readonly actingPlayers: readonly PlayerId[];
  readonly currentPlayerId: PlayerId;
  readonly phaseText: string;
  readonly lastRoll: readonly [number, number] | null;
  readonly turn: number;
  readonly longestRoad: GameState['longestRoad'];
}

export interface ViewOptions {
  /** Wessen Karten offen bleiben, wenn verdeckt wird. */
  readonly viewer: PlayerId | null;
  readonly conceal: boolean;
}

/**
 * Wer handeln darf.
 *
 * In der Gruendung folgt der Zug der Schlange und nicht `currentPlayerIndex`;
 * nach einer Sieben sind es alle, die noch abwerfen muessen - `applyDiscard`
 * nimmt sie in beliebiger Reihenfolge.
 */
export function actingPlayers(state: GameState): readonly PlayerId[] {
  switch (state.phase.kind) {
    case 'setup': {
      const player = setupPlayer(state);
      return player === null ? [] : [player];
    }
    case 'discardPending':
      return state.phase.pending;
    case 'finished':
      return [];
    default:
      return [state.players[state.currentPlayerIndex]!.id];
  }
}

function phaseText(state: GameState, names: ReadonlyMap<PlayerId, Seat>): string {
  const nameOf = (id: PlayerId | null): string =>
    id === null ? 'niemand' : (names.get(id)?.name ?? id);
  const currentName = (): string => nameOf(state.players[state.currentPlayerIndex]!.id);

  switch (state.phase.kind) {
    case 'setup':
      return state.phase.settlement === null
        ? `Gruendung: ${nameOf(setupPlayer(state))} setzt eine Siedlung`
        : `Gruendung: ${nameOf(setupPlayer(state))} setzt die zugehoerige Strasse`;
    case 'rollPending':
      return `${currentName()} muss wuerfeln`;
    case 'discardPending':
      return `Sieben: ${state.phase.pending.map((id) => nameOf(id)).join(' und ')} muss abwerfen`;
    case 'robberPending':
      return `${currentName()} versetzt den Raeuber`;
    case 'main':
      return `${currentName()} ist am Zug`;
    case 'finished':
      return `${nameOf(state.phase.winner)} hat gewonnen`;
  }
}

export function gameView(state: GameState, seats: readonly Seat[], options: ViewOptions): GameView {
  const byId = seatsById(seats);
  const current = state.players[state.currentPlayerIndex]!.id;

  const players = state.players.map((player): PlayerView => {
    const seat = byId.get(player.id);
    const open = !options.conceal || player.id === options.viewer;

    return {
      id: player.id,
      name: seat?.name ?? player.id,
      color: seat?.color ?? '#8b93a3',
      victoryPoints: victoryPointsOf(state, player.id),
      cardCount: countResources(player.resources),
      resources: open ? player.resources : null,
      piecesLeft: player.piecesLeft,
      isCurrent: player.id === current,
      mustDiscard:
        state.phase.kind === 'discardPending' && state.phase.pending.includes(player.id)
          ? discardCountFor(state, player.id)
          : 0,
    };
  });

  return {
    players,
    actingPlayers: actingPlayers(state),
    currentPlayerId: current,
    phaseText: phaseText(state, byId),
    lastRoll: state.lastRoll,
    turn: state.turn,
    longestRoad: state.longestRoad,
  };
}
