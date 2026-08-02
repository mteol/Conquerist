import { nextInt } from '../random/index.js';
import type { GameAction } from './actions.js';
import { applyBuildCity, applyBuildRoad, applyBuildSettlement } from './build.js';
import { RuleViolationCode, violation } from './errors.js';
import type { PlayerId } from './player.js';
import { applyDiscard, applyMoveRobber, playersMustDiscard } from './robber.js';
import { recomputeLongestRoad } from './roads.js';
import { hasWon } from './scoring.js';
import { applySetupRoad, applySetupSettlement, setupPlayer } from './setup.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from './state.js';
import { applyTradeWithBank } from './trade.js';
import {
  applyBuyDevelopmentCard,
  applyPlayKnight,
  applyPlayMonopoly,
  applyPlayRoadBuilding,
  applyPlayYearOfPlenty,
} from './developmentRules.js';
import { distributeYield } from './yield.js';

/**
 * Der Reducer: `(state, action) => newState`, rein und ohne Seiteneffekte.
 *
 * Er selbst kennt keine Baukosten und keine Abstandsregel - er prueft, *wer*
 * *wann* handeln darf, und gibt dann an die Regeldatei ab. Die eigentliche
 * Regelauslegung liegt genau einmal vor, in `build.ts`, `robber.ts`,
 * `trade.ts` und `yield.ts`, und `legalActions` benutzt dieselben Funktionen.
 *
 * Nach jedem angenommenen Zug laeuft dieselbe Nacharbeit: die Laengste
 * Handelsstrasse neu bestimmen und pruefen, ob der Handelnde damit gewonnen
 * hat. Beides an einer Stelle, weil beides sonst irgendwann irgendwo vergessen
 * wird.
 */

/** Welche Aktionsarten in welcher Phase erlaubt sind. */
const PHASE_ACTIONS: Readonly<Record<string, readonly GameAction['type'][]>> = {
  setup: ['placeSetupSettlement', 'placeSetupRoad'],
  rollPending: ['rollDice'],
  discardPending: ['discard'],
  robberPending: ['moveRobber'],
  main: [
    'buildRoad',
    'buildSettlement',
    'buildCity',
    'tradeWithBank',
    'buyDevelopmentCard',
    'playKnight',
    'playRoadBuilding',
    'playYearOfPlenty',
    'playMonopoly',
    'endTurn',
  ],
  finished: [],
};

/** Wer in dieser Phase handeln darf. `null` heisst: mehrere, siehe `discardPending`. */
function actorFor(state: GameState): PlayerId | null {
  if (state.phase.kind === 'setup') return setupPlayer(state);
  if (state.phase.kind === 'discardPending') return null;
  return state.players[state.currentPlayerIndex]?.id ?? null;
}

/**
 * Wuerfelt und schaltet weiter.
 *
 * Zwei Wuerfel einzeln zu ziehen ist kein Zierat: die Summe allein haette eine
 * andere Verteilung, und der Wurf soll in Etappe 3 als zwei Wuerfel auf dem
 * Tisch liegen.
 */
function rollDice(state: GameState): ReduceResult {
  const [first, afterFirst] = nextInt(state.rng, 6);
  const [second, afterSecond] = nextInt(afterFirst, 6);

  const dice: [number, number] = [first + 1, second + 1];
  const total = dice[0] + dice[1];
  const rolled: GameState = { ...state, rng: afterSecond, lastRoll: dice };

  if (total !== 7) {
    return ok({ ...distributeYield(rolled, total), phase: { kind: 'main' } });
  }

  const pending = playersMustDiscard(rolled);
  return ok({
    ...rolled,
    phase: pending.length > 0 ? { kind: 'discardPending', pending } : { kind: 'robberPending' },
  });
}

/** Gibt den Zug weiter und zaehlt die Runde, sobald sie herum ist. */
function endTurn(state: GameState): ReduceResult {
  const next = (state.currentPlayerIndex + 1) % state.players.length;

  return ok({
    ...state,
    currentPlayerIndex: next,
    phase: { kind: 'rollPending' },
    turn: next === 0 ? state.turn + 1 : state.turn,
    // Die Sperre gilt je Zug, nicht je Runde: der Naechste darf wieder eine
    // Karte spielen.
    developmentPlayed: false,
  });
}

/** Die Nacharbeit nach jedem angenommenen Zug. */
function finalize(state: GameState, actor: PlayerId): GameState {
  const scored = recomputeLongestRoad(state);

  // In der Gruendungsphase gibt es nichts zu gewinnen, und wer nicht am Zug
  // ist, gewinnt auch nicht: die Laengste Handelsstrasse kann im fremden Zug
  // den Besitzer wechseln, aber gewonnen wird nur im eigenen.
  if (scored.phase.kind === 'setup' || scored.phase.kind === 'finished') return scored;
  if (scored.players[scored.currentPlayerIndex]?.id !== actor) return scored;

  return hasWon(scored, actor) ? { ...scored, phase: { kind: 'finished', winner: actor } } : scored;
}

/** Fuehrt die Aktion aus, sofern sie erlaubt ist. */
export function reduce(state: GameState, action: GameAction): ReduceResult {
  if (state.phase.kind === 'finished') {
    return rejected(
      violation(
        RuleViolationCode.GAME_OVER,
        `${state.phase.winner} hat gewonnen - das Spiel nimmt keine Zuege mehr an`,
      ),
    );
  }

  if (findPlayer(state, action.player) === undefined) {
    return rejected(
      violation(RuleViolationCode.UNKNOWN_PLAYER, `${action.player} sitzt nicht an diesem Tisch`),
    );
  }

  const allowed = PHASE_ACTIONS[state.phase.kind] ?? [];
  if (!allowed.includes(action.type)) {
    return rejected(
      violation(
        RuleViolationCode.WRONG_PHASE,
        `${action.type} passt nicht in die Phase ${state.phase.kind}`,
      ),
    );
  }

  const actor = actorFor(state);
  if (actor !== null && actor !== action.player) {
    return rejected(
      violation(
        RuleViolationCode.NOT_YOUR_TURN,
        `${action.player} ist nicht am Zug (${actor} ist es)`,
      ),
    );
  }

  const result = applyAction(state, action);
  return result.ok ? ok(finalize(result.state, action.player)) : result;
}

function applyAction(state: GameState, action: GameAction): ReduceResult {
  switch (action.type) {
    case 'placeSetupSettlement':
      return applySetupSettlement(state, action.player, action.vertex);
    case 'placeSetupRoad':
      return applySetupRoad(state, action.player, action.edge);
    case 'rollDice':
      return rollDice(state);
    case 'discard':
      return applyDiscard(state, action.player, action.resources);
    case 'moveRobber':
      return applyMoveRobber(state, action.player, action.hex, action.victim);
    case 'buildRoad':
      return applyBuildRoad(state, action.player, action.edge);
    case 'buildSettlement':
      return applyBuildSettlement(state, action.player, action.vertex);
    case 'buildCity':
      return applyBuildCity(state, action.player, action.vertex);
    case 'tradeWithBank':
      return applyTradeWithBank(state, action.player, action.give, action.receive);
    case 'buyDevelopmentCard':
      return applyBuyDevelopmentCard(state, action.player);
    case 'playKnight':
      return applyPlayKnight(state, action.player);
    case 'playRoadBuilding':
      return applyPlayRoadBuilding(state, action.player, action.edges);
    case 'playYearOfPlenty':
      return applyPlayYearOfPlenty(state, action.player, action.picks);
    case 'playMonopoly':
      return applyPlayMonopoly(state, action.player, action.resource);
    case 'endTurn':
      return endTurn(state);
  }
}
