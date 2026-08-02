import {
  setupPlayerIndex,
  type GameState,
  type PlayerId,
  type PlayerView,
  type ResourceAmounts,
  type RuleSet,
} from '@conquerist/shared';

/**
 * Vom Protokoll auf den Bildschirm.
 *
 * Bis Etappe 3 hat diese Datei aus dem vollen Zustand gerechnet: Siegpunkte
 * ermittelt, Namen aus den Sitzen geholt, fremde Haende auf Wunsch verdeckt.
 * All das ist jetzt schon geschehen - auf dem Server, verbindlich. Was bleibt,
 * ist Anordnen. `resources === null` heisst nicht mehr „ausgeblendet", sondern
 * **„darf ich nicht sehen"**; das ist ein Unterschied, den man der Oberflaeche
 * nicht mehr abgewoehnen kann.
 *
 * Damit gibt es einen Weg durch die Oberflaeche, egal woher der Zustand kommt:
 * die lokale Partie baut ihre Sicht mit `playerViewOf` selbst, die Online-Partie
 * bekommt sie geschickt. Beide landen hier.
 */
export interface PlayerRow {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly victoryPoints: number;
  readonly cardCount: number;
  /** `null` heisst: gehoert jemand anderem. Die Anzahl bleibt sichtbar. */
  readonly resources: ResourceAmounts | null;
  readonly piecesLeft: RuleSet['pieceStock'];
  readonly isCurrent: boolean;
  /** Ob dieser Spieler gerade eine offene Verbindung hat. */
  readonly connected: boolean;
  /** Wie viele Karten dieser Spieler gerade abwerfen muss; 0, wenn keine. */
  readonly mustDiscard: number;
}

export interface GameView {
  readonly players: readonly PlayerRow[];
  /** Wer jetzt handeln darf - in der Gruendung aus der Schlange, nach einer Sieben mehrere. */
  readonly actingPlayers: readonly PlayerId[];
  readonly currentPlayerId: PlayerId;
  readonly phaseText: string;
  readonly lastRoll: readonly [number, number] | null;
  readonly turn: number;
  readonly longestRoad: GameState['longestRoad'];
  /** Wer zusieht. Seine Karten sind die einzigen, die offen liegen. */
  readonly you: PlayerId;
}

/**
 * Wer handeln darf.
 *
 * In der Gruendung folgt der Zug der Schlange und nicht `currentPlayerIndex`;
 * nach einer Sieben sind es alle, die noch abwerfen muessen - `applyDiscard`
 * nimmt sie in beliebiger Reihenfolge.
 *
 * Liest ausschliesslich `phase`, `players` und `currentPlayerIndex` - alle drei
 * stehen unveraendert in der Sicht, deshalb genuegt sie hier.
 */
/**
 * Das gemeinsame Stueck von `GameState` und `PlayerView`.
 *
 * Beide tragen Phase, Spielerreihenfolge und den Index des Spielers am Zug -
 * und mehr braucht weder `actingPlayers` noch der Phasensatz. Ein eigener Typ
 * dafuer ist ehrlicher als ein Cast von der Sicht auf den Zustand: die Sicht
 * IST kein Zustand, sie hat nur diese Felder gemeinsam mit ihm.
 */
export interface PhaseSource {
  readonly phase: GameState['phase'];
  readonly players: readonly { readonly id: PlayerId }[];
  readonly currentPlayerIndex: number;
}

/** Wer in der Gruendungsphase gerade setzen muss - dieselbe Schlange wie in `shared`. */
function setupPlayerOf(view: PhaseSource): PlayerId | null {
  if (view.phase.kind !== 'setup') return null;
  const index = setupPlayerIndex(view.phase.placement, view.players.length);
  return view.players[index]?.id ?? null;
}

export function actingPlayers(view: PhaseSource): readonly PlayerId[] {
  switch (view.phase.kind) {
    case 'setup': {
      const player = setupPlayerOf(view);
      return player === null ? [] : [player];
    }
    case 'discardPending':
      return view.phase.pending;
    case 'finished':
      return [];
    default:
      return [view.players[view.currentPlayerIndex]!.id];
  }
}

function phaseTextOf(view: PlayerView): string {
  const names = new Map(view.players.map((player) => [player.id, player.name]));
  const nameOf = (id: PlayerId | null): string => (id === null ? 'niemand' : (names.get(id) ?? id));
  const currentName = (): string => nameOf(view.players[view.currentPlayerIndex]!.id);

  switch (view.phase.kind) {
    case 'setup':
      return view.phase.settlement === null
        ? `Gruendung: ${nameOf(setupPlayerOf(view))} setzt eine Siedlung`
        : `Gruendung: ${nameOf(setupPlayerOf(view))} setzt die zugehoerige Strasse`;
    case 'rollPending':
      return `${currentName()} muss wuerfeln`;
    case 'discardPending':
      return `Sieben: ${view.phase.pending.map((id) => nameOf(id)).join(' und ')} muss abwerfen`;
    case 'robberPending':
      return `${currentName()} versetzt den Raeuber`;
    case 'main':
      return `${currentName()} ist am Zug`;
    case 'finished':
      return `${nameOf(view.phase.winner)} hat gewonnen`;
  }
}

/**
 * Wie viele Karten dieser Spieler abwerfen muss - aus der Sicht gerechnet.
 *
 * `discardCountFor` in `shared` braucht den vollen Zustand; die Sicht hat
 * `cardCount` und `rules`, und das genuegt. Ein Test haelt fest, dass beide
 * dasselbe sagen - hier entsteht zum ersten Mal eine Rechnung im Client, die
 * es auch in `shared` gibt.
 */
export function discardCountForView(view: PlayerView, player: PlayerId): number {
  const held = view.players.find((entry) => entry.id === player)?.cardCount ?? 0;
  return held > view.rules.handLimitBeforeDiscard ? Math.floor(held / 2) : 0;
}

export function gameViewOf(view: PlayerView): GameView {
  const current = view.players[view.currentPlayerIndex];

  return {
    players: view.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      victoryPoints: player.victoryPoints,
      cardCount: player.cardCount,
      resources: player.resources,
      piecesLeft: player.piecesLeft,
      connected: player.connected,
      isCurrent: player.id === current?.id,
      mustDiscard:
        view.phase.kind === 'discardPending' && view.phase.pending.includes(player.id)
          ? discardCountForView(view, player.id)
          : 0,
    })),
    actingPlayers: actingPlayers(view),
    currentPlayerId: current?.id ?? view.you,
    phaseText: phaseTextOf(view),
    lastRoll: view.lastRoll,
    turn: view.turn,
    longestRoad: view.longestRoad,
    you: view.you,
  };
}
