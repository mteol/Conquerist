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
import { EMPTY_CARDS } from './cards.js';
import { ok, rejected, type BuildingKind, type GameState, type ReduceResult } from './state.js';
import { grantSetupYield } from './yield.js';

/**
 * Spielstart und Gruendungsphase.
 *
 * In der Gruendung setzt jeder Spieler zwei Bauwerke und zwei Strassen, in
 * Schlangenreihenfolge (`phase.ts`). Beides ist kostenlos und das Bauwerk
 * braucht keinen Strassenanschluss - die Abstandsregel gilt trotzdem. Die
 * zweite Setzung wirft sofort Ertrag ab; das ist die Startausstattung.
 *
 * **Was in der zweiten Runde gesetzt wird, haengt am Regelwerk.** Im
 * Basisspiel eine zweite Siedlung, in Staedte & Ritter eine **Stadt** - dort
 * beginnt jeder mit einer Siedlung und einer Stadt, weil erst eine Stadt
 * Handelswaren abwirft.
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
      resources: { ...EMPTY_CARDS },
      piecesLeft: { ...rules.pieceStock },
      developmentCards: [],
      playedKnights: 0,
    })),
    currentPlayerIndex: 0,
    // Vor der Gruendung wird ausgewuerfelt, wer beginnt. Erst danach steht fest,
    // wer auf Index 0 sitzt - siehe `opening.ts`.
    phase: { kind: 'opening', rolls: {}, pending: [...playerIds], round: 0 },
    buildings: {},
    roads: {},
    robber: scenario.robberStart,
    /*
     * Ob Barbaren kommen, sagt das Regelwerk und nicht der Aufrufer. Damit ist
     * die Erweiterung eine Zahl in `rules` und kein zweiter Startpfad - und
     * eine Basispartie bekommt kein Schiff, das nie faehrt.
     */
    barbarians: rules.barbarianTrack > 0 ? { position: 0, attacks: 0 } : null,
    bank: { ...rules.resourceBank },
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, size: 0 },
    ...deckAndRng(rules, seed),
    developmentPlayed: false,
    lastRoll: null,
    rollTally: {},
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

/**
 * Was in dieser Setzung auf den Knoten kommt.
 *
 * Erste Runde immer eine Siedlung. In der zweiten entscheidet das Regelwerk:
 * `barbarianTrack > 0` heisst, dass dieser Tisch Staedte & Ritter spielt, und
 * dort ist die zweite Setzung eine Stadt.
 *
 * **Ein Merkmal und kein Name.** `rules.id === 'cities'` waere kuerzer und
 * falsch: wer eine Variante baut, die Handelswaren kennt und anders heisst,
 * bekaeme die falsche Gruendung. Gefragt wird nach dem, was die Regel
 * ausmacht.
 */
export function setupBuildingKind(state: GameState, placement: number): BuildingKind {
  const secondRound = placement >= state.players.length;
  return secondRound && state.rules.barbarianTrack > 0 ? 'city' : 'settlement';
}

/** Setzt ein Gruendungsbauwerk - kostenlos, ohne Anschluss, mit Abstandsregel. */
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

  /*
   * Die Abstandsregel gilt fuer die Stadt genauso - `canPlaceSettlementAt`
   * fragt nach dem Platz und nicht nach der Bauform, und genau deshalb passt
   * sie hier unveraendert.
   */
  const kind = setupBuildingKind(state, phase.placement);

  const placed: GameState = {
    ...state,
    buildings: { ...state.buildings, [vertex]: { owner: player, kind } },
    players: state.players.map((entry) =>
      entry.id === player
        ? {
            ...entry,
            piecesLeft: { ...entry.piecesLeft, [kind]: entry.piecesLeft[kind] - 1 },
          }
        : entry,
    ),
    phase: { kind: 'setup', placement: phase.placement, settlement: vertex },
  };

  // Nur die zweite Setzung bringt Startkarten - das ist die zweite Runde der
  // Schlange, also ab Setzung `playerCount`. Eine Karte je angrenzendem Feld,
  // auch bei einer Stadt: so steht es in beiden Anleitungen.
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
