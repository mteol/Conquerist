import type { PlayerId } from '../player.js';
import { ok, rejected, type GameState, type ReduceResult } from '../state.js';
import { RuleViolationCode, violation, type RuleViolation } from '../errors.js';
import { boardOf } from '../board.js';
import { terrainYield } from '../../scenario/index.js';
import type { ProgressPlay } from './progress/play.js';

/**
 * Der Haendler sitzt auf einem Landschaftsfeld neben einer eigenen Siedlung oder
 * Stadt und gibt seinem Besitzer 2:1 Tausch auf dem Rohstoff des Feldes. Eine
 * Figur pro Spiel, die wandert, wenn jemand anders die Karte spielt.
 */

export function canPlaceMerchant(
  state: GameState,
  player: PlayerId,
  hex: string,
): RuleViolation | null {
  const board = boardOf(state.scenario);
  const placement = board.hexes.get(hex as any);

  // Das Hex existiert
  if (placement === undefined) {
    return violation(RuleViolationCode.NOT_ON_BOARD, `${hex} existiert nicht auf diesem Brett`);
  }

  // Das Hex ist nicht die Wueste und nicht die See
  const resource = terrainYield(placement.terrain);
  if (resource === null) {
    return violation(
      RuleViolationCode.NOT_ON_BOARD,
      `Der Händler darf nicht auf der Wüste oder der See stehen`,
    );
  }

  // Der Spieler hat eine Siedlung oder Stadt neben dem Hex
  const vertices = board.topology.hexVertices.get(hex as any) ?? [];
  const hasBuilding = vertices.some((vertex) => {
    const building = state.buildings[vertex];
    return building !== undefined && building.owner === player;
  });

  if (!hasBuilding) {
    return violation(
      RuleViolationCode.NOT_OWN_SETTLEMENT,
      `${player} hat keine Siedlung oder Stadt neben ${hex}`,
    );
  }

  return null;
}

export function applyMerchant(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'merchant' }>,
): ReduceResult {
  const problem = canPlaceMerchant(state, player, play.hex);
  if (problem !== null) return rejected(problem);

  return ok({
    ...state,
    merchant: {
      hex: play.hex,
      owner: player,
    },
  });
}
