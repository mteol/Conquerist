import {
  setupPlayerIndex,
  yieldTotal,
  type DiceSpec,
  type GameState,
  type PlayerId,
  type PlayerView,
  type ResourceAmounts,
  type Roll,
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
  /** Eigene Entwicklungskarten; `null` heisst: gehoert jemand anderem. */
  readonly developmentCards: PlayerView['players'][number]['developmentCards'];
  /** Wie viele Karten jemand haelt - das ist am Tisch abzaehlbar. */
  readonly developmentCount: number;
  /** Ausgespielte Ritter. Oeffentlich, sie liegen offen. */
  readonly playedKnights: number;
  /** Wie viele Karten dieser Spieler gerade abwerfen muss; 0, wenn keine. */
  readonly mustDiscard: number;
}

export interface GameView {
  readonly players: readonly PlayerRow[];
  /** Wer jetzt handeln darf - in der Gruendung aus der Schlange, nach einer Sieben mehrere. */
  readonly actingPlayers: readonly PlayerId[];
  readonly currentPlayerId: PlayerId;
  readonly phaseText: string;
  /** Womit an diesem Tisch gewuerfelt wird - die Schale aus dem RuleSet. */
  readonly dice: DiceSpec;
  /** Was zuletzt gefallen ist; `null`, solange in dieser Partie kein Wurf war. */
  readonly lastRoll: Roll | null;
  /** Die Zahl, die den Ertrag ausgeloest hat. `null` ohne Wurf. */
  readonly rollTotal: number | null;
  /**
   * Ob dieser Stand aus einem Wurf hervorgegangen ist - dann fallen die Wuerfel.
   *
   * Gelesen aus dem Phasenwechsel und nicht aus veraenderten Augenzahlen: aus
   * `rollPending` fuehrt genau ein Zug heraus, und zweimal dieselbe Augenzahl
   * hintereinander ist trotzdem ein zweiter Wurf. Ein Zaehler im Zustand waere
   * die Alternative gewesen - er waere eine zweite Wahrheit neben der Phase.
   */
  readonly rolled: boolean;
  readonly turn: number;
  readonly longestRoad: GameState['longestRoad'];
  readonly largestArmy: PlayerView['largestArmy'];
  /** Wie viele Entwicklungskarten der Stapel noch hergibt. */
  readonly deckLeft: number;
  /**
   * Ob dieser Spieler jetzt ein Angebot an die Mitspieler machen duerfte.
   *
   * Kommt unveraendert aus der `PlayerView` - die Aktionsliste kann es nicht
   * sagen, weil ein Angebot Mengen braucht und jede Kombination ueber fuenf
   * Sorten ein eigener Eintrag waere.
   */
  readonly canOfferTrade: boolean;
  /** Wer zusieht. Seine Karten sind die einzigen, die offen liegen. */
  readonly you: PlayerId;
  /**
   * Wie viele Karten seit dem vorigen Stand dazugekommen sind, je Spieler.
   *
   * Aus dem Unterschied zweier Sichten gelesen und aus nichts sonst: `cardCount`
   * ist oeffentlich, und eine Differenz zweier Zahlen ist keine Regel. Wer statt
   * dessen ausrechnete, welches Feld bei einer Acht liefert, haette die
   * Ertragsregel ein zweites Mal ausgelegt - und genau das darf der Client
   * nicht.
   */
  readonly gains: ReadonlyMap<PlayerId, number>;
  /** Wer gerade keine offene Verbindung hat - fuer den kleinen Hinweis. */
  readonly disconnected: readonly PlayerRow[];
  /**
   * Auf wen die Partie wartet, obwohl er nicht da ist.
   *
   * Das Spiel bleibt in diesem Fall von selbst stehen: Zuege gibt es nur fuer
   * den, der handeln darf, und der kann sie nicht schicken. Das ist kein
   * Zustand, den jemand herstellen muss - er ergibt sich. Was fehlt, ist zu
   * sagen, dass genau das der Grund ist, warum nichts passiert.
   */
  readonly waitingFor: readonly PlayerRow[];
}

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
export function actingPlayers(view: PhaseSource): readonly PlayerId[] {
  switch (view.phase.kind) {
    case 'setup': {
      const player = setupPlayerOf(view);
      return player === null ? [] : [player];
    }
    case 'discardPending':
      return view.phase.pending;
    case 'tradePending': {
      const { offer, responses } = view.phase;
      /*
       * Erst die, die noch nicht geantwortet haben, dann der Anbieter. In der
       * lokalen Partie wandert der Bildschirm damit von selbst durch die Runde
       * und kommt zum Auswaehlen zurueck - dieselbe Mechanik wie beim Abwerfen.
       */
      const waiting = view.players
        .map((player) => player.id)
        .filter((id) => id !== offer.from && responses[id] === undefined);

      return [...waiting, offer.from];
    }
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
    case 'tradePending':
      return `${nameOf(view.phase.offer.from)} bietet einen Tausch an`;
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

export function gameViewOf(view: PlayerView, previous?: PlayerView): GameView {
  const current = view.players[view.currentPlayerIndex];
  const acting = actingPlayers(view);
  const before = new Map((previous ?? view).players.map((player) => [player.id, player.cardCount]));

  const gains = new Map<PlayerId, number>();
  if (previous !== undefined) {
    for (const player of view.players) {
      const grown = player.cardCount - (before.get(player.id) ?? player.cardCount);
      if (grown > 0) gains.set(player.id, grown);
    }
  }

  const players: PlayerRow[] = view.players.map((player) => ({
    id: player.id,
    name: player.name,
    color: player.color,
    victoryPoints: player.victoryPoints,
    cardCount: player.cardCount,
    resources: player.resources,
    piecesLeft: player.piecesLeft,
    connected: player.connected,
    developmentCards: player.developmentCards,
    developmentCount: player.developmentCount,
    playedKnights: player.playedKnights,
    isCurrent: player.id === current?.id,
    mustDiscard:
      view.phase.kind === 'discardPending' && view.phase.pending.includes(player.id)
        ? discardCountForView(view, player.id)
        : 0,
  }));

  return {
    players,
    disconnected: players.filter((player) => !player.connected),
    waitingFor: players.filter((player) => acting.includes(player.id) && !player.connected),
    actingPlayers: acting,
    currentPlayerId: current?.id ?? view.you,
    phaseText: phaseTextOf(view),
    dice: view.rules.dice,
    lastRoll: view.lastRoll,
    rollTotal: view.lastRoll === null ? null : yieldTotal(view.rules.dice, view.lastRoll),
    rolled:
      previous !== undefined &&
      previous.phase.kind === 'rollPending' &&
      view.phase.kind !== 'rollPending',
    turn: view.turn,
    longestRoad: view.longestRoad,
    largestArmy: view.largestArmy,
    deckLeft: view.deckLeft,
    canOfferTrade: view.canOfferTrade,
    you: view.you,
    gains,
  };
}
