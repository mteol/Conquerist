import type { EdgeId, VertexId } from '../geometry/index.js';
import { createRng, shuffle, type Rng } from '../random/index.js';
import type { RuleSet } from '../rules/index.js';
import type { ScenarioDefinition } from '../scenario/index.js';
import { boardOf } from './board.js';
import { canPlaceRoadAt, canPlaceSettlementAt } from './build.js';
import { buildDeck, type DevelopmentCardId } from './development.js';
import { RuleViolationCode, violation } from './errors.js';
import { setupPlacementCount, setupPlayerIndex } from './phase.js';
import type { PlayerId } from './player.js';
import { EMPTY_RESOURCES } from './resources.js';
import { ok, rejected, type GameState, type ReduceResult } from './state.js';
import { grantSetupYield } from './yield.js';

/**
 * Spielstart und Gruendungsphase.
 *
 * In der Gruendung setzt jeder Spieler zwei Siedlungen und zwei Strassen, in
 * Schlangenreihenfolge (`phase.ts`). Beides ist kostenlos und die Siedlung
 * braucht keinen Strassenanschluss - die Abstandsregel gilt trotzdem. Die
 * zweite Siedlung wirft sofort Ertrag ab; das ist die Startausstattung.
 */

/**
 * Baut den Startzustand.
 *
 * Wirft statt abzulehnen: eine unmoegliche Tischgroesse ist kein Spielzug,
 * sondern ein Fehler des Aufrufers. `ReduceResult` ist fuer Zuege da.
 */
export function createGame(
  scenario: ScenarioDefinition,
  rules: RuleSet,
  playerIds: readonly PlayerId[],
  seed: string,
): GameState {
  if (playerIds.length < scenario.minPlayers || playerIds.length > scenario.maxPlayers) {
    throw new RangeError(
      `createGame: ${scenario.id} ist fuer ${scenario.minPlayers} bis ${scenario.maxPlayers} Spieler gedacht, es sind ${playerIds.length}`,
    );
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new RangeError('createGame: Jeder Spieler darf nur einmal am Tisch sitzen');
  }

  return {
    scenario,
    rules,
    players: playerIds.map((id) => ({
      id,
      resources: { ...EMPTY_RESOURCES },
      piecesLeft: { ...rules.pieceStock },
      developmentCards: [],
      playedKnights: 0,
    })),
    currentPlayerIndex: 0,
    phase: { kind: 'setup', placement: 0, settlement: null },
    buildings: {},
    roads: {},
    robber: scenario.robberStart,
    bank: { ...rules.resourceBank },
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, size: 0 },
    ...deckAndRng(rules, seed),
    developmentPlayed: false,
    lastRoll: null,
    turn: 0,
  };
}

/**
 * Der gemischte Stapel und der Zufallszustand danach.
 *
 * Beides zusammen, weil das Mischen den PRNG verbraucht: gaebe es zwei
 * Aufrufe, koennte einer den Fortschritt des anderen vergessen, und die Partie
 * wuerfelte je nach Reihenfolge anders. Der Seed bleibt die einzige Quelle.
 */
function deckAndRng(rules: RuleSet, seed: string): { deck: DevelopmentCardId[]; rng: Rng } {
  const [deck, rng] = shuffle(buildDeck(rules.developmentDeck), createRng(seed));
  return { deck, rng };
}

/** Setzt eine Gruendungssiedlung - kostenlos, ohne Anschluss, mit Abstandsregel. */
export function applySetupSettlement(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): ReduceResult {
  const phase = state.phase;
  if (phase.kind !== 'setup' || phase.settlement !== null) {
    return rejected(
      violation(
        RuleViolationCode.WRONG_PHASE,
        'Eine Gründungssiedlung lässt sich hier nicht setzen',
      ),
    );
  }

  const problem = canPlaceSettlementAt(state, vertex);
  if (problem !== null) return rejected(problem);

  const placed: GameState = {
    ...state,
    buildings: { ...state.buildings, [vertex]: { owner: player, kind: 'settlement' } },
    players: state.players.map((entry) =>
      entry.id === player
        ? {
            ...entry,
            piecesLeft: { ...entry.piecesLeft, settlement: entry.piecesLeft.settlement - 1 },
          }
        : entry,
    ),
    phase: { kind: 'setup', placement: phase.placement, settlement: vertex },
  };

  // Nur die zweite Siedlung bringt Startkarten - das ist die zweite Runde der
  // Schlange, also ab Setzung `playerCount`.
  const secondRound = phase.placement >= state.players.length;
  return ok(secondRound ? grantSetupYield(placed, player, vertex) : placed);
}

/** Setzt die zugehoerige Gruendungsstrasse und gibt den Zug weiter. */
export function applySetupRoad(state: GameState, player: PlayerId, edge: EdgeId): ReduceResult {
  const phase = state.phase;
  if (phase.kind !== 'setup' || phase.settlement === null) {
    return rejected(
      violation(
        RuleViolationCode.WRONG_PHASE,
        'Vor der Gründungsstraße fehlt die zugehörige Siedlung',
      ),
    );
  }

  const problem = canPlaceRoadAt(state, edge);
  if (problem !== null) return rejected(problem);

  const board = boardOf(state.scenario);
  const touchesSettlement = (board.topology.edgeVertices.get(edge) ?? []).includes(
    phase.settlement,
  );
  if (!touchesSettlement) {
    return rejected(
      violation(
        RuleViolationCode.NOT_CONNECTED,
        `Die Gründungsstraße muss an ${phase.settlement} anschließen`,
      ),
    );
  }

  const withRoad: GameState = {
    ...state,
    roads: { ...state.roads, [edge]: player },
    players: state.players.map((entry) =>
      entry.id === player
        ? { ...entry, piecesLeft: { ...entry.piecesLeft, road: entry.piecesLeft.road - 1 } }
        : entry,
    ),
  };

  const next = phase.placement + 1;
  if (next >= setupPlacementCount(state.players.length)) {
    return ok({ ...withRoad, phase: { kind: 'rollPending' }, currentPlayerIndex: 0, turn: 1 });
  }

  return ok({
    ...withRoad,
    phase: { kind: 'setup', placement: next, settlement: null },
    currentPlayerIndex: setupPlayerIndex(next, state.players.length),
  });
}

/** Wer in der Gruendungsphase gerade setzen muss. */
export function setupPlayer(state: GameState): PlayerId | null {
  if (state.phase.kind !== 'setup') return null;
  const index = setupPlayerIndex(state.phase.placement, state.players.length);
  return state.players[index]?.id ?? null;
}
