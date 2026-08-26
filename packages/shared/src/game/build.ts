import type { EdgeId, VertexId } from '../geometry/index.js';
import type { PieceId, CardAmounts, RuleSet } from '../rules/index.js';
import { boardOf } from './board.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { PlayerId } from './player.js';
import { addCards, canAfford, subtractCards } from './cards.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from './state.js';

/**
 * Bauen: Strasse, Siedlung, Stadt.
 *
 * Jede Regel gibt es zweimal - als `can…`, das nur prueft, und als `apply…`,
 * das prueft und anwendet. Das ist keine Doppelung: `apply…` ruft `can…` auf.
 * Der Grund fuer die Trennung ist `legalActions`, das dieselben Fragen stellt,
 * ohne den Zug auszufuehren. Zwei getrennte Regelauslegungen waeren genau der
 * Fehler, den diese Aufteilung verhindert.
 *
 * Die reinen Platzierungsregeln (`canPlaceSettlementAt`, `canPlaceRoadAt`)
 * stehen separat, weil die Gruendungsphase genau sie braucht - ohne Kosten und
 * ohne Anschlusspflicht.
 */

/** Ist der Knoten frei und weit genug von jeder anderen Siedlung entfernt? */
export function canPlaceSettlementAt(state: GameState, vertex: VertexId): RuleViolation | null {
  const board = boardOf(state.scenario);

  if (!board.topology.vertexNeighbors.has(vertex)) {
    return violation(
      RuleViolationCode.NOT_ON_BOARD,
      `Der Knoten ${vertex} gehört nicht zu diesem Brett`,
    );
  }
  if (state.buildings[vertex] !== undefined) {
    return violation(RuleViolationCode.VERTEX_OCCUPIED, `Auf ${vertex} steht bereits etwas`);
  }

  /*
   * Ein Ritter belegt seine Kreuzung wie ein Bauwerk - auch der eigene. Die
   * Regel sagt es ausdruecklich: wer dort bauen will, muss ihn erst versetzen,
   * und geht das nicht, kann er dort nicht bauen. Eine Ausnahme fuer den
   * eigenen Ritter waere ein Ritter, der von seinem eigenen Haus verschluckt
   * wird.
   */
  if (state.knights[vertex] !== undefined) {
    return violation(RuleViolationCode.VERTEX_OCCUPIED, `Auf ${vertex} steht ein Ritter`);
  }

  // Abstandsregel: kein direkter Nachbarknoten darf bebaut sein - auch nicht
  // von einem selbst. Sie fragt nach Nachbar*bauwerken*; ein Ritter ist keines
  // und sperrt den Nachbarknoten deshalb nicht.
  for (const neighbour of board.topology.vertexNeighbors.get(vertex) ?? []) {
    if (state.buildings[neighbour] !== undefined) {
      return violation(
        RuleViolationCode.TOO_CLOSE,
        `Der Nachbarknoten ${neighbour} ist bebaut - zwischen zwei Siedlungen muss ein Knoten frei bleiben`,
      );
    }
  }

  return null;
}

/** Ist die Kante frei und Teil des Bretts? */
export function canPlaceRoadAt(state: GameState, edge: EdgeId): RuleViolation | null {
  const board = boardOf(state.scenario);

  if (!board.topology.edgeVertices.has(edge)) {
    return violation(
      RuleViolationCode.NOT_ON_BOARD,
      `Die Kante ${edge} gehört nicht zu diesem Brett`,
    );
  }
  if (state.roads[edge] !== undefined) {
    return violation(RuleViolationCode.EDGE_OCCUPIED, `Auf ${edge} liegt bereits eine Straße`);
  }

  return null;
}

/**
 * Darf der Spieler diesen Knoten als Anschlusspunkt benutzen?
 *
 * Eine fremde Siedlung oder Stadt unterbricht - man baut nicht durch das Dorf
 * eines anderen hindurch. Ein eigenes Gebaeude oder eine eigene angrenzende
 * Strasse genuegt.
 */
function connectsAt(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
  ignoreEdge: EdgeId | null,
): boolean {
  const building = state.buildings[vertex];
  if (building !== undefined) return building.owner === player;

  const board = boardOf(state.scenario);
  for (const edge of board.topology.vertexEdges.get(vertex) ?? []) {
    if (edge === ignoreEdge) continue;
    if (state.roads[edge] === player) return true;
  }

  return false;
}

/**
 * Reichen Karten und Vorrat?
 *
 * **Exportiert**, weil `cities/knights.ts` und `cities/walls.ts` dieselbe
 * Frage stellen. Eine zweite Pruefung daneben waere eine zweite Auslegung
 * derselben Regel - und die Reihenfolge (erst Vorrat, dann Karten) ist eine
 * Auskunft: wer keine Bauteile mehr hat, soll das hoeren und nicht "zu wenig
 * Karten".
 */
export function canPayFor(
  state: GameState,
  player: PlayerId,
  piece: PieceId,
  cost: CardAmounts,
): RuleViolation | null {
  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }
  if (owner.piecesLeft[piece] <= 0) {
    return violation(
      RuleViolationCode.NO_PIECES_LEFT,
      `${player} hat keine Bauteile der Art ${piece} mehr`,
    );
  }
  if (!canAfford(owner.resources, cost)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `${player} kann ${piece} nicht bezahlen`,
    );
  }

  return null;
}

/**
 * Zieht die Kosten ab und verbucht Bauteile.
 *
 * Die bezahlten Karten gehen zurueck an die Bank - der Kartenvorrat ist
 * endlich, und ohne Ruecklauf waere er nach wenigen Runden leer.
 *
 * **Exportiert** aus demselben Grund wie `canPayFor`: zwei Stellen, die Karten
 * an die Bank zurueckgeben, waeren zwei Gelegenheiten, es zu vergessen.
 */
export function payFor(
  state: GameState,
  player: PlayerId,
  cost: CardAmounts,
  pieces: Partial<Record<PieceId, number>>,
): GameState {
  return {
    ...state,
    players: state.players.map((entry) => {
      if (entry.id !== player) return entry;

      const piecesLeft = { ...entry.piecesLeft };
      for (const [piece, delta] of Object.entries(pieces)) {
        piecesLeft[piece as PieceId] += delta;
      }

      return { ...entry, resources: subtractCards(entry.resources, cost), piecesLeft };
    }),
    bank: addCards(state.bank, cost),
  };
}

/**
 * Was ein Bauteil an diesem Tisch kostet.
 *
 * `buildCosts` ist seit der Erweiterung ein teilweiser Record: was fehlt, gibt
 * es an diesem Tisch nicht (Staedte & Ritter kennt keine Entwicklungskarte).
 * Strasse, Siedlung und Stadt nennt jedes Regelwerk - fehlten sie, waere das
 * kein Spielzug, sondern ein Fehler in den Daten, und der soll laut sein.
 *
 * Deshalb hier ein `throw` und kein `ReduceResult`: dieselbe Grenze, die
 * `createGame` fuer eine unmoegliche Tischgroesse zieht.
 */
function costOf(rules: RuleSet, piece: 'road' | 'settlement' | 'city'): CardAmounts {
  const cost = rules.buildCosts[piece];
  if (cost === undefined) {
    throw new RangeError(`costOf: Das Regelwerk ${rules.id} nennt keinen Preis fuer ${piece}`);
  }
  return cost;
}

/** Prueft eine Strasse vollstaendig: Platz, Anschluss, Kosten, Vorrat. */
export function canBuildRoad(
  state: GameState,
  player: PlayerId,
  edge: EdgeId,
): RuleViolation | null {
  const placement = canPlaceRoadAt(state, edge);
  if (placement !== null) return placement;

  const board = boardOf(state.scenario);
  const connected = (board.topology.edgeVertices.get(edge) ?? []).some((vertex) =>
    connectsAt(state, player, vertex, edge),
  );
  if (!connected) {
    return violation(
      RuleViolationCode.NOT_CONNECTED,
      `${edge} schließt an keine eigene Straße und keine eigene Siedlung an`,
    );
  }

  return canPayFor(state, player, 'road', costOf(state.rules, 'road'));
}

export function applyBuildRoad(state: GameState, player: PlayerId, edge: EdgeId): ReduceResult {
  const problem = canBuildRoad(state, player, edge);
  if (problem !== null) return rejected(problem);

  const paid = payFor(state, player, costOf(state.rules, 'road'), { road: -1 });
  return ok({ ...paid, roads: { ...paid.roads, [edge]: player } });
}

/** Prueft eine Siedlung vollstaendig: Platz, Abstand, Anschluss, Kosten, Vorrat. */
export function canBuildSettlement(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  const placement = canPlaceSettlementAt(state, vertex);
  if (placement !== null) return placement;

  if (!connectsAt(state, player, vertex, null)) {
    return violation(RuleViolationCode.NOT_CONNECTED, `An ${vertex} endet keine eigene Straße`);
  }

  return canPayFor(state, player, 'settlement', costOf(state.rules, 'settlement'));
}

export function applyBuildSettlement(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): ReduceResult {
  const problem = canBuildSettlement(state, player, vertex);
  if (problem !== null) return rejected(problem);

  const paid = payFor(state, player, costOf(state.rules, 'settlement'), { settlement: -1 });
  return ok({
    ...paid,
    buildings: {
      ...paid.buildings,
      [vertex]: { owner: player, kind: 'settlement', wall: false, metropolis: null },
    },
  });
}

/** Prueft eine Stadt: eigene Siedlung an dieser Stelle, Kosten, Vorrat. */
export function canBuildCity(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  const building = state.buildings[vertex];
  if (building === undefined || building.owner !== player || building.kind !== 'settlement') {
    return violation(
      RuleViolationCode.NOT_OWN_SETTLEMENT,
      `Auf ${vertex} steht keine eigene Siedlung, die sich ausbauen ließe`,
    );
  }

  return canPayFor(state, player, 'city', costOf(state.rules, 'city'));
}

export function applyBuildCity(state: GameState, player: PlayerId, vertex: VertexId): ReduceResult {
  const problem = canBuildCity(state, player, vertex);
  if (problem !== null) return rejected(problem);

  // Die Siedlung kommt in den Vorrat zurueck: sie steht nicht mehr auf dem
  // Brett und laesst sich woanders wieder aufbauen.
  const paid = payFor(state, player, costOf(state.rules, 'city'), { city: -1, settlement: +1 });
  return ok({
    ...paid,
    buildings: {
      ...paid.buildings,
      [vertex]: { owner: player, kind: 'city', wall: false, metropolis: null },
    },
  });
}
