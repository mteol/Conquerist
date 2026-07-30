import type { ResourceAmounts } from '../rules/index.js';
import type { ResourceId } from '../scenario/index.js';
import { boardOf } from './board.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { PlayerId } from './player.js';
import { EMPTY_RESOURCES, addResources, canAfford, subtractResources } from './resources.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from './state.js';

/**
 * Handel mit der Bank und ueber die Haefen.
 *
 * Handel zwischen Spielern kommt in Etappe 8. Was hier steht, ist der Teil, der
 * das Spiel ueberhaupt am Laufen haelt: ohne ihn koennte ein Spieler mit
 * fuenfzehn Erz und ohne Holz nie wieder bauen.
 *
 * Der Kurs wird **nicht** mitgeschickt, sondern abgeleitet. Ein Client, der
 * sich sein Verhaeltnis selbst aussucht, waere genau die Art von Ergebnis, die
 * Regel 3 ausschliesst - er schickt Absichten, keine Ergebnisse.
 */

/** Der Standardkurs ohne Hafen. */
const DEFAULT_RATE = 4;

/**
 * Der beste Kurs, den dieser Spieler fuer diese Ressource erreicht.
 *
 * Ein Hafen zaehlt, wenn der Spieler auf einem der beiden Knoten seiner Kante
 * gebaut hat - Siedlung wie Stadt. Der 2:1-Hafen gilt nur fuer seine eigene
 * Ressource, der 3:1-Hafen fuer jede.
 */
export function tradeRateFor(state: GameState, player: PlayerId, give: ResourceId): number {
  const board = boardOf(state.scenario);
  let best = DEFAULT_RATE;

  for (const [vertex, building] of Object.entries(state.buildings)) {
    if (building.owner !== player) continue;

    for (const harbor of board.harborsAtVertex.get(vertex) ?? []) {
      if (harbor.ratio === 2 && harbor.resource !== give) continue;
      if (harbor.ratio < best) best = harbor.ratio;
    }
  }

  return best;
}

/** Prueft einen Banktausch vollstaendig. */
export function canTradeWithBank(
  state: GameState,
  player: PlayerId,
  give: ResourceId,
  receive: ResourceId,
): RuleViolation | null {
  if (give === receive) {
    return violation(
      RuleViolationCode.INVALID_TRADE,
      `${give} gegen ${receive} zu tauschen aendert nichts`,
    );
  }

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }

  const rate = tradeRateFor(state, player, give);
  const cost: ResourceAmounts = { ...EMPTY_RESOURCES, [give]: rate };
  if (!canAfford(owner.resources, cost)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `Der Kurs ist ${rate}:1 - ${player} hat nicht ${rate} mal ${give}`,
    );
  }

  if (state.bank[receive] < 1) {
    return violation(RuleViolationCode.BANK_EMPTY, `Die Bank hat kein ${receive} mehr`);
  }

  return null;
}

export function applyTradeWithBank(
  state: GameState,
  player: PlayerId,
  give: ResourceId,
  receive: ResourceId,
): ReduceResult {
  const problem = canTradeWithBank(state, player, give, receive);
  if (problem !== null) return rejected(problem);

  const rate = tradeRateFor(state, player, give);
  const given: ResourceAmounts = { ...EMPTY_RESOURCES, [give]: rate };
  const taken: ResourceAmounts = { ...EMPTY_RESOURCES, [receive]: 1 };

  return ok({
    ...state,
    players: state.players.map((entry) =>
      entry.id === player
        ? {
            ...entry,
            resources: addResources(subtractResources(entry.resources, given), taken),
          }
        : entry,
    ),
    bank: subtractResources(addResources(state.bank, given), taken),
  });
}
