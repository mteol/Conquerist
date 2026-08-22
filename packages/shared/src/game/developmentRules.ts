import type { EdgeId } from '../geometry/index.js';
import type { ResourceAmounts } from '../rules/index.js';
import type { ResourceId } from '../scenario/index.js';
import { canPlaceRoadAt } from './build.js';
import { boardOf } from './board.js';
import { countCards, isPlayable, type DevelopmentCardId } from './development.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { PlayerId } from './player.js';
import { EMPTY_RESOURCES, addResources, canAfford, subtractResources } from './resources.js';
import {
  findPlayer,
  ok,
  rejected,
  withPlayer,
  type GameState,
  type ReduceResult,
} from './state.js';

/**
 * Entwicklungskarten: kaufen und ausspielen.
 *
 * Wie jede Regel in diesem Projekt zweigeteilt - `can…` prueft nur, `apply…`
 * prueft und wendet an. `legalActions` benutzt dieselben `can…`, damit es
 * weiterhin genau eine Auslegung gibt.
 *
 * Vier Grenzen ziehen sich durch alle Karten:
 *
 *   1. **Nicht in der Kaufrunde.** Sonst waere ein Ritter die Antwort auf die
 *      eigene Sieben, und der Raeuber verloere seinen Schrecken.
 *   2. **Eine je Zug.** Zwei Monopole hintereinander waeren kein Spiel mehr.
 *   3. **Nur in der Hauptphase**, also nach dem Wurf. In der Schachtel darf der
 *      Ritter auch davor - hier bewusst nicht: die Ausnahme kostet eine
 *      Sonderregel in jeder Phasenpruefung und bringt fuers Basisspiel wenig.
 *      **Entschieden und nicht mehr offen** (2026-08-02); wer sie doch will,
 *      baut sie als Regelwert und nicht als zweiten Zweig.
 *   4. **Siegpunktkarten werden nie gespielt.** Sie zaehlen, und zwar still.
 */

/** Was eine Entwicklungskarte kostet. */
function priceOf(state: GameState): ResourceAmounts {
  return state.rules.buildCosts.developmentCard ?? EMPTY_RESOURCES;
}

/** Die drei Bedingungen, die fuer Kauf und Ausspielen gleich sind. */
function canActNow(state: GameState, player: PlayerId): RuleViolation | null {
  if (state.phase.kind !== 'main') {
    return violation(RuleViolationCode.WRONG_PHASE, 'Das geht erst nach dem Würfeln');
  }
  if (state.players[state.currentPlayerIndex]?.id !== player) {
    return violation(RuleViolationCode.NOT_YOUR_TURN, `${player} ist nicht am Zug`);
  }
  if (findPlayer(state, player) === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }
  return null;
}

/** Ob der Spieler eine Karte kaufen kann: Phase, Zug, Stapel, Preis. */
export function canBuyDevelopmentCard(state: GameState, player: PlayerId): RuleViolation | null {
  const timing = canActNow(state, player);
  if (timing !== null) return timing;

  if (state.deck.length === 0) {
    return violation(RuleViolationCode.BANK_EMPTY, 'Der Entwicklungsstapel ist leer');
  }

  const hand = findPlayer(state, player)!;
  if (!canAfford(hand.resources, priceOf(state))) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `${player} kann keine Entwicklungskarte bezahlen`,
    );
  }

  return null;
}

/**
 * Kauft die oberste Karte.
 *
 * Sie geht **verdeckt** auf die Hand und traegt die laufende Runde mit, damit
 * `isPlayable` spaeter weiss, dass sie noch nicht darf. Der Preis geht an die
 * Bank zurueck - Entwicklungskarten sind der einzige Kauf, bei dem nichts auf
 * dem Brett entsteht.
 */
export function applyBuyDevelopmentCard(state: GameState, player: PlayerId): ReduceResult {
  const problem = canBuyDevelopmentCard(state, player);
  if (problem !== null) return rejected(problem);

  const [drawn, ...rest] = state.deck;
  if (drawn === undefined) {
    return rejected(violation(RuleViolationCode.BANK_EMPTY, 'Der Entwicklungsstapel ist leer'));
  }

  const cost = priceOf(state);

  return ok({
    ...state,
    deck: rest,
    bank: addResources(state.bank, cost),
    players: withPlayer(state, player, (entry) => ({
      ...entry,
      resources: subtractResources(entry.resources, cost),
      developmentCards: [...entry.developmentCards, { id: drawn, boughtOnTurn: state.turn }],
    })),
  });
}

/** Ob diese Kartenart jetzt ausgespielt werden darf. */
export function canPlayDevelopmentCard(
  state: GameState,
  player: PlayerId,
  card: DevelopmentCardId,
): RuleViolation | null {
  const timing = canActNow(state, player);
  if (timing !== null) return timing;

  if (state.developmentPlayed) {
    return violation(
      RuleViolationCode.WRONG_PHASE,
      'In diesem Zug wurde schon eine Karte gespielt',
    );
  }

  const hand = findPlayer(state, player)!;
  if (!hand.developmentCards.some((entry) => entry.id === card && isPlayable(entry, state.turn))) {
    return violation(
      RuleViolationCode.INVALID_TRADE,
      'Diese Karte hast du nicht - oder erst in dieser Runde gekauft',
    );
  }

  return null;
}

/**
 * Nimmt die Karte von der Hand und setzt die Sperre fuer diesen Zug.
 *
 * Genommen wird die **aelteste** spielbare Karte dieser Art. Das ist kein
 * Zufall: haette jemand zwei Ritter und gaebe den frisch gekauften ab, waere
 * der alte danach immer noch gesperrt - obwohl er es nicht sein duerfte.
 */
function spend(state: GameState, player: PlayerId, card: DevelopmentCardId): GameState {
  let removed = false;

  return {
    ...state,
    developmentPlayed: true,
    players: withPlayer(state, player, (entry) => ({
      ...entry,
      developmentCards: entry.developmentCards.filter((held) => {
        if (removed || held.id !== card || !isPlayable(held, state.turn)) return true;
        removed = true;
        return false;
      }),
    })),
  };
}

/**
 * Ritter: der Raeuber zieht weiter, und die Rittermacht waechst.
 *
 * Das Versetzen selbst macht `applyMoveRobber` - hier wird nur die Karte
 * abgegeben und die Phase auf `robberPending` gestellt. Zwei Auslegungen des
 * Raeubers gaebe es sonst, und die zweite ist immer die mit dem Fehler.
 */
export function applyPlayKnight(state: GameState, player: PlayerId): ReduceResult {
  const problem = canPlayDevelopmentCard(state, player, 'knight');
  if (problem !== null) return rejected(problem);

  const spent = spend(state, player, 'knight');
  const players = withPlayer(spent, player, (entry) => ({
    ...entry,
    playedKnights: entry.playedKnights + 1,
  }));
  const knights = players.find((entry) => entry.id === player)?.playedKnights ?? 0;

  return ok({
    ...spent,
    players,
    largestArmy: nextLargestArmy(state, player, knights),
    // Der Ritter darf vor **und** nach dem Wurf. Wohin es nach dem Raeuber
    // zurueckgeht, entscheidet deshalb die Phase, aus der er gespielt wurde.
    phase: {
      kind: 'robberPending',
      resume: state.phase.kind === 'rollPending' ? 'rollPending' : 'main',
    },
  });
}

/**
 * Wer die Groesste Rittermacht haelt.
 *
 * Dieselbe Form wie bei der Laengsten Handelsstrasse: es braucht eine
 * Mindestzahl, und **gleichauf reicht nicht** - der Titel wechselt erst, wenn
 * jemand echt darueberliegt. Sonst wanderte er bei jedem Gleichstand hin und
 * her.
 */
export function nextLargestArmy(
  state: GameState,
  player: PlayerId,
  knights: number,
): GameState['largestArmy'] {
  if (knights < state.rules.largestArmyMinimum) return state.largestArmy;
  if (knights <= state.largestArmy.size) return state.largestArmy;
  return { holder: player, size: knights };
}

/**
 * Strassenbau: zwei Strassen umsonst.
 *
 * Nacheinander gesetzt und nicht auf einmal - die zweite darf an die erste
 * anschliessen, und das geht nur, wenn die erste schon liegt. Jede muss fuer
 * sich regelgerecht sein; nur der Preis entfaellt.
 */
export function applyPlayRoadBuilding(
  state: GameState,
  player: PlayerId,
  edges: readonly EdgeId[],
): ReduceResult {
  const problem = canPlayDevelopmentCard(state, player, 'roadBuilding');
  if (problem !== null) return rejected(problem);

  if (edges.length < 1 || edges.length > 2) {
    return rejected(violation(RuleViolationCode.NOT_ON_BOARD, 'Eine oder zwei Straßen'));
  }

  let current: GameState = spend(state, player, 'roadBuilding');

  for (const edge of edges) {
    const placed = placeFreeRoad(current, player, edge);
    if (!placed.ok) return placed;
    current = placed.state;
  }

  return ok(current);
}

/** Eine Strasse ohne Kosten, aber mit allen uebrigen Bedingungen. */
function placeFreeRoad(state: GameState, player: PlayerId, edge: EdgeId): ReduceResult {
  const placement = canPlaceRoadAt(state, edge);
  if (placement !== null) return rejected(placement);

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return rejected(violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht am Tisch`));
  }
  if ((owner.piecesLeft.road ?? 0) <= 0) {
    return rejected(violation(RuleViolationCode.NO_PIECES_LEFT, 'Keine Straßen mehr im Vorrat'));
  }

  const board = boardOf(state.scenario);
  const connected = (board.topology.edgeVertices.get(edge) ?? []).some((vertex) => {
    const building = state.buildings[vertex];
    if (building?.owner === player) return true;
    return (board.topology.vertexEdges.get(vertex) ?? []).some(
      (other) => other !== edge && state.roads[other] === player,
    );
  });

  if (!connected) {
    return rejected(
      violation(RuleViolationCode.NOT_CONNECTED, `${edge} schließt an nichts Eigenes an`),
    );
  }

  return ok({
    ...state,
    roads: { ...state.roads, [edge]: player },
    players: withPlayer(state, player, (entry) => ({
      ...entry,
      piecesLeft: { ...entry.piecesLeft, road: (entry.piecesLeft.road ?? 0) - 1 },
    })),
  });
}

/** Erfindung: zwei Rohstoffe aus der Bank, frei gewaehlt. */
export function applyPlayYearOfPlenty(
  state: GameState,
  player: PlayerId,
  picks: readonly ResourceId[],
): ReduceResult {
  const problem = canPlayDevelopmentCard(state, player, 'yearOfPlenty');
  if (problem !== null) return rejected(problem);

  if (picks.length !== 2) {
    return rejected(violation(RuleViolationCode.INVALID_TRADE, 'Genau zwei Rohstoffe'));
  }

  const wanted = { ...EMPTY_RESOURCES };
  for (const pick of picks) wanted[pick] = (wanted[pick] ?? 0) + 1;

  if (!canAfford(state.bank, wanted)) {
    return rejected(violation(RuleViolationCode.BANK_EMPTY, 'Die Bank hat das nicht mehr'));
  }

  const spent = spend(state, player, 'yearOfPlenty');

  return ok({
    ...spent,
    bank: subtractResources(spent.bank, wanted),
    players: withPlayer(spent, player, (entry) => ({
      ...entry,
      resources: addResources(entry.resources, wanted),
    })),
  });
}

/**
 * Monopol: alle geben, was sie von dieser Sorte haben.
 *
 * Die haerteste Karte im Spiel und die einzige, die fremde Handkarten anfasst.
 * Genau deshalb laeuft sie ueber den Server - ein Client koennte gar nicht
 * ausrechnen, was er bekommt, weil er fremde Haende seit Etappe 5 nicht sieht.
 */
export function applyPlayMonopoly(
  state: GameState,
  player: PlayerId,
  resource: ResourceId,
): ReduceResult {
  const problem = canPlayDevelopmentCard(state, player, 'monopoly');
  if (problem !== null) return rejected(problem);

  const spent = spend(state, player, 'monopoly');
  let taken = 0;

  const emptied = spent.players.map((entry) => {
    if (entry.id === player) return entry;
    taken += entry.resources[resource] ?? 0;
    return { ...entry, resources: { ...entry.resources, [resource]: 0 } };
  });

  return ok({
    ...spent,
    players: emptied.map((entry) =>
      entry.id === player
        ? {
            ...entry,
            resources: {
              ...entry.resources,
              [resource]: (entry.resources[resource] ?? 0) + taken,
            },
          }
        : entry,
    ),
  });
}

/** Siegpunktkarten auf der Hand. Sie zaehlen, ohne je gespielt zu werden. */
export function victoryPointCardsOf(state: GameState, player: PlayerId): number {
  const hand = findPlayer(state, player);
  return hand === undefined ? 0 : countCards(hand.developmentCards, 'victoryPoint');
}
