import type { GameAction } from './actions.js';
import { applyBuildCity, applyBuildRoad, applyBuildSettlement } from './build.js';
import { rollAll, yieldTotal, type Roll } from './dice.js';
import { RuleViolationCode, violation } from './errors.js';
import type { PlayerId } from './player.js';
import { applyDiscard, applyMoveRobber, continueAfterSeven } from './robber.js';
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
import { resolveEvent } from './cities/turn.js';
import {
  applyDiscardProgressCard,
  applyPickAqueduct,
  applyPickProgressDeck,
  continueAfterEvent,
} from './cities/rollFlow.js';
import { applyActivateKnight, applyBuildKnight, applyUpgradeKnight } from './cities/knights.js';
import {
  applyChaseRobber,
  applyMoveKnight,
  applyPlaceDisplacedKnight,
} from './cities/knightActions.js';
import { applyBuildWall } from './cities/walls.js';
import { applyImproveCity } from './cities/improvements.js';
import { applyPlayProgress } from './cities/progress/progressRules.js';

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
  /*
   * `playProgress` steht hier **auch** - nicht, weil in dieser Phase jede
   * Fortschrittskarte ginge, sondern weil Alchemie genau hier gespielt wird:
   * sie bestimmt die Wuerfel und muss vor dem Wurf kommen. Welche Karte
   * tatsaechlich durchkommt, entscheidet `canPlayProgress` in
   * `progressRules.ts` - dort darf in dieser Phase nur Alchemie.
   */
  rollPending: [
    'rollDice',
    'playKnight',
    'playRoadBuilding',
    'playYearOfPlenty',
    'playMonopoly',
    'playProgress',
  ],
  discardPending: ['discard'],
  robberPending: ['moveRobber'],
  /*
   * Die drei Wartestationen eines Wurfs. Jede laesst genau eine Aktion zu -
   * der Tisch steht still, bis sie kommt, und das ist Absicht: was danach
   * geschieht, haengt an dieser Wahl.
   */
  progressDiscardPending: ['discardProgressCard'],
  defenderPending: ['pickProgressDeck'],
  aqueductPending: ['pickAqueduct'],
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
    'buildWall',
    'buildKnight',
    'activateKnight',
    'upgradeKnight',
    'moveKnight',
    'chaseRobber',
    'improveCity',
    'playProgress',
    'endTurn',
  ],
  /*
   * Ein vertriebener Ritter sucht seinen Platz, und **nur** das geht jetzt.
   * Der Tisch steht still, weil der Angreifer sonst weiterbaute, waehrend der
   * Getroffene noch ueberlegt.
   */
  displacePending: ['placeDisplacedKnight'],
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
  /*
   * Bei diesen dreien handelt der **erste** Eintrag der Warteschlange und
   * nicht die ganze Liste: sie greifen alle auf einen endlichen Vorrat zu -
   * die oberste Karte eines Stapels, die letzte Karte einer Sorte in der Bank.
   */
  if (
    state.phase.kind === 'progressDiscardPending' ||
    state.phase.kind === 'defenderPending' ||
    state.phase.kind === 'aqueductPending'
  ) {
    return state.phase.pending[0] ?? null;
  }
  // Wie beim Abwerfen handeln mehrere: der Anbieter und seine Mitspieler. Wer
  // genau was darf, prueft `playerTrade.ts`.
  if (state.phase.kind === 'tradePending') return null;
  // Den Vertriebenen setzt sein **Besitzer** um und nicht der Angreifer -
  // deshalb ein ausdruecklicher Zweig und nicht der Spieler am Zug.
  if (state.phase.kind === 'displacePending') return state.phase.owner;
  return state.players[state.currentPlayerIndex]?.id ?? null;
}

/**
 * Wuerfelt und schaltet weiter.
 *
 * Womit gewuerfelt wird und welche Summe den Raeuber ruft, steht im RuleSet und
 * nicht hier - hier steht nur, was danach passiert. Das ist die Grenze, an der
 * eine Erweiterung mit einem dritten Wuerfel keinen Codepfad mehr braucht.
 */
/**
 * Setzt die Augen, die Alchemie festgelegt hat - der Rest des Wurfs bleibt,
 * wie er gefallen ist.
 *
 * Welche Wuerfel "die Augenwuerfel" sind, steht im Regelwerk und nicht hier:
 * es sind die mitzaehlenden aus `rules.dice`, in ihrer Reihenfolge, dieselben,
 * die `yieldTotal` addiert. Der Ereigniswuerfel zaehlt nicht mit und bleibt
 * deshalb unberuehrt.
 */
function withAlchemistFaces(state: GameState, roll: Roll): Roll {
  const set = state.alchemistRoll;
  if (set === null) return roll;

  const counting = state.rules.dice.filter((die) => die.countsTowardYield);
  const faces = new Map<string, number>();
  if (counting[0] !== undefined) faces.set(counting[0].id, set.first);
  if (counting[1] !== undefined) faces.set(counting[1].id, set.second);

  return roll.map((result) => {
    const face = faces.get(result.die);
    return face === undefined ? result : { ...result, value: face };
  });
}

function rollDice(state: GameState): ReduceResult {
  const [thrown, rng] = rollAll(state.rules.dice, state.rng);

  /*
   * Alchemie bestimmt die Augen, sie erspart aber keinen Wurf: geworfen wird
   * die ganze Schale, der Ereigniswuerfel faellt normal, und der
   * Zufallszustand geht denselben Schritt weiter wie bei jedem anderen Wurf.
   * Wer ihn hier stehen liesse, weil die Augen ja schon feststehen, liesse
   * jede Partie ab dieser Stelle beim Replay anders laufen.
   */
  const roll = withAlchemistFaces(state, thrown);

  const total = yieldTotal(state.rules.dice, roll);

  /*
   * Die einzige Stelle, an der gezaehlt wird. `applyOpeningRoll` zaehlt
   * bewusst nicht mit: der Auftakt verteilt Plaetze, keine Ertraege.
   */
  const rolled: GameState = {
    ...state,
    rng,
    // Der Vorsatz gilt fuer genau einen Wurf und ist damit verbraucht.
    alchemistRoll: null,
    lastRoll: roll,
    rollTally: { ...state.rollTally, [total]: (state.rollTally[total] ?? 0) + 1 },
  };

  /*
   * Erst das Ereignis, dann der Ertrag - so steht es in der Anleitung, und so
   * muss es stehen: ab 10b kann der Barbarenangriff eine Stadt kosten, und die
   * soll im selben Wurf nichts mehr ausschuetten. An einem Tisch ohne
   * Erweiterung faellt kein Ereigniswuerfel, und `resolveEvent` gibt denselben
   * Zustand zurueck.
   */
  const afterEvent = resolveEvent(rolled, roll);

  /*
   * Das Ereignis kann selbst schon auf eine Wahl warten: bei Gleichstand in
   * der Verteidigung waehlt jeder Beteiligte seinen Fortschrittsstapel. Dann
   * steht der Wurf hier still, und `continueAfterDefender` nimmt ihn danach
   * wieder auf - auf beiden Pfaden, dem Ertrag wie der Sieben.
   */
  if (afterEvent.phase.kind === 'defenderPending') return ok(afterEvent);

  /*
   * Was nach dem Ereignis kommt - Abgeben, Ertraege, Aquaedukt -, steht in
   * `cities/rollFlow.ts` und nicht hier: es sind drei Stationen, von denen
   * jede den Wurf anhalten kann, und ihre Reihenfolge soll an genau einer
   * Stelle stehen. Der Sieben-Pfad bleibt daneben, wie er war: eine Sieben
   * verteilt keinen Ertrag, an dem "leer ausgegangen" etwas bedeuten wuerde.
   */
  if (total !== state.rules.robberRoll) return ok(continueAfterEvent(afterEvent, total));

  return ok(continueAfterSeven(afterEvent));
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
    // Der Kran gilt nur fuer den Zug, in dem er gespielt wurde.
    craneDiscount: [],
    /*
     * Ein Ritter steigt je Zug nur einmal. Zurueckgesetzt wird ueber **alle**
     * Ritter und nicht nur die des Spielers am Zug: aufwerten kann ohnehin nur
     * er, und eine Schleife ueber alle ist eine Bedingung weniger, die falsch
     * sein kann.
     */
    knights: Object.fromEntries(
      Object.entries(state.knights).map(([vertex, knight]) => [
        vertex,
        knight.upgradedThisTurn ? { ...knight, upgradedThisTurn: false } : knight,
      ]),
    ),
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
    case 'buildWall':
      return applyBuildWall(state, action.player, action.vertex);
    case 'buildKnight':
      return applyBuildKnight(state, action.player, action.vertex);
    case 'activateKnight':
      return applyActivateKnight(state, action.player, action.vertex);
    case 'upgradeKnight':
      return applyUpgradeKnight(state, action.player, action.vertex);
    case 'moveKnight':
      return applyMoveKnight(state, action.player, action.from, action.to);
    case 'chaseRobber':
      return applyChaseRobber(state, action.player, action.vertex);
    case 'placeDisplacedKnight':
      return applyPlaceDisplacedKnight(state, action.player, action.vertex);
    case 'improveCity':
      return applyImproveCity(state, action.player, action.track, action.metropolisAt);
    case 'playProgress':
      return applyPlayProgress(state, action.player, action.play);
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
    case 'pickProgressDeck':
      return applyPickProgressDeck(state, action.player, action.track);
    case 'discardProgressCard':
      return applyDiscardProgressCard(state, action.player, action.card);
    case 'pickAqueduct':
      return applyPickAqueduct(state, action.player, action.resource);
    case 'endTurn':
      return endTurn(state);
  }
}
