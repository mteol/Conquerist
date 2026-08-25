import type { GameAction } from './actions.js';
import { applyBuildCity, applyBuildRoad, applyBuildSettlement } from './build.js';
import { rollAll, yieldTotal } from './dice.js';
import { RuleViolationCode, violation } from './errors.js';
import type { PlayerId } from './player.js';
import { applyDiscard, applyMoveRobber, playersMustDiscard } from './robber.js';
import { recomputeLongestRoad } from './roads.js';
import { hasWon } from './scoring.js';
import { applyOpeningRoll } from './opening.js';
import { openingRoller } from './phase.js';
import { applySetupRoad, applySetupSettlement, setupPlayer } from './setup.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from './state.js';
import {
  applyAcceptTrade,
  applyCounterTrade,
  applyDropFromTrade,
  applyOfferTrade,
  applyRejectCounter,
  applyRejoinTrade,
  applyRespondTrade,
  applyTimeout,
  applyWithdrawTrade,
} from './playerTrade.js';
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
  opening: ['rollDice'],
  setup: ['placeSetupSettlement', 'placeSetupRoad'],
  rollPending: ['rollDice', 'playKnight', 'playRoadBuilding', 'playYearOfPlenty', 'playMonopoly'],
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
    'offerTrade',
    'endTurn',
  ],
  tradePending: [
    'respondTrade',
    'counterTrade',
    'acceptTrade',
    'rejectCounter',
    'withdrawTrade',
    'timeout',
    'dropFromTrade',
    'rejoinTrade',
  ],
  finished: [],
};

/** Wer in dieser Phase handeln darf. `null` heisst: mehrere, siehe `discardPending`. */
function actorFor(state: GameState): PlayerId | null {
  if (state.phase.kind === 'opening') return openingRoller(state.phase);
  if (state.phase.kind === 'setup') return setupPlayer(state);
  if (state.phase.kind === 'discardPending') return null;
  // Wie beim Abwerfen handeln mehrere: der Anbieter und seine Mitspieler. Wer
  // genau was darf, prueft `playerTrade.ts`.
  if (state.phase.kind === 'tradePending') return null;
  return state.players[state.currentPlayerIndex]?.id ?? null;
}

/**
 * Wuerfelt und schaltet weiter.
 *
 * Womit gewuerfelt wird und welche Summe den Raeuber ruft, steht im RuleSet und
 * nicht hier - hier steht nur, was danach passiert. Das ist die Grenze, an der
 * eine Erweiterung mit einem dritten Wuerfel keinen Codepfad mehr braucht.
 */
function rollDice(state: GameState): ReduceResult {
  const [roll, rng] = rollAll(state.rules.dice, state.rng);

  const total = yieldTotal(state.rules.dice, roll);

  /*
   * Die einzige Stelle, an der gezaehlt wird. `applyOpeningRoll` zaehlt
   * bewusst nicht mit: der Auftakt verteilt Plaetze, keine Ertraege.
   */
  const rolled: GameState = {
    ...state,
    rng,
    lastRoll: roll,
    rollTally: { ...state.rollTally, [total]: (state.rollTally[total] ?? 0) + 1 },
  };

  if (total !== state.rules.robberRoll) {
    return ok({ ...distributeYield(rolled, total), phase: { kind: 'main' } });
  }

  const pending = playersMustDiscard(rolled);
  return ok({
    ...rolled,
    phase:
      pending.length > 0
        ? { kind: 'discardPending', pending }
        : { kind: 'robberPending', resume: 'main' },
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
  if (
    scored.phase.kind === 'opening' ||
    scored.phase.kind === 'setup' ||
    scored.phase.kind === 'finished'
  ) {
    return scored;
  }
  if (scored.players[scored.currentPlayerIndex]?.id !== actor) return scored;

  return hasWon(scored, actor) ? { ...scored, phase: { kind: 'finished', winner: actor } } : scored;
}

/** Fuehrt die Aktion aus, sofern sie erlaubt ist. */
export function reduce(state: GameState, action: GameAction): ReduceResult {
  if (state.phase.kind === 'finished') {
    return rejected(
      violation(
        RuleViolationCode.GAME_OVER,
        `${state.phase.winner} hat gewonnen - die Partie nimmt keine Züge mehr an`,
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
      // Die Aktion heisst "ich werfe die Wuerfel". Was ein Wurf bedeutet,
      // entscheidet die Phase - deshalb hier ein Zweig und keine zweite Aktion,
      // die durch Protokoll, Server und Oberflaeche mitgeschleppt werden muss.
      return state.phase.kind === 'opening' ? applyOpeningRoll(state) : rollDice(state);
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
    case 'offerTrade':
      return applyOfferTrade(state, action.player, action.give, action.want, action.at);
    case 'respondTrade':
      return applyRespondTrade(state, action.player, action.response);
    case 'counterTrade':
      return applyCounterTrade(state, action.player, action.give, action.want, action.at);
    case 'acceptTrade':
      return applyAcceptTrade(state, action.player, action.partner);
    case 'rejectCounter':
      return applyRejectCounter(state, action.player, action.partner);
    case 'withdrawTrade':
      return applyWithdrawTrade(state, action.player);
    case 'timeout':
      return applyTimeout(state, action.at);
    case 'dropFromTrade':
      return applyDropFromTrade(state, action.player);
    case 'rejoinTrade':
      return applyRejoinTrade(state, action.player);
    case 'endTurn':
      return endTurn(state);
  }
}
