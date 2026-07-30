import type { VertexId } from '../geometry/index.js';
import type { ResourceAmounts } from '../rules/index.js';
import { terrainYield, type ResourceId } from '../scenario/index.js';
import { boardOf } from './board.js';
import type { PlayerId } from './player.js';
import { EMPTY_RESOURCES, addResources, subtractResources } from './resources.js';
import type { GameState } from './state.js';

/**
 * Ertragsverteilung.
 *
 * Eine Siedlung bringt eine Karte, eine Stadt zwei - je angrenzendem Feld, das
 * die gewuerfelte Zahl traegt. Das Feld, auf dem der Raeuber steht, liefert
 * nichts.
 *
 * Der unangenehme Teil ist die knappe Bank, und er steht ausdruecklich hier und
 * nicht im Reducer: reicht der Vorrat einer Ressource nicht fuer alle, die
 * Anspruch haben, dann bekommt bei genau einem Anspruchsberechtigten dieser,
 * was noch da ist - bei mehreren bekommt **niemand** etwas. Das ist die
 * Originalregel und keine Vereinfachung; sie verhindert, dass die
 * Reihenfolge der Spieler am Tisch darueber entscheidet, wer den letzten Lehm
 * bekommt.
 */

/** Was ein einzelner Spieler an einem Wurf zu bekommen haette, noch ohne Bank. */
interface Claim {
  readonly player: PlayerId;
  readonly resource: ResourceId;
  readonly amount: number;
}

/** Sammelt alle Ansprueche eines Wurfs - ohne zu pruefen, ob die Bank sie deckt. */
function claimsForRoll(state: GameState, roll: number): Claim[] {
  const board = boardOf(state.scenario);
  const claims: Claim[] = [];

  for (const hexId of board.hexesByChip.get(roll) ?? []) {
    if (hexId === state.robber) continue;

    const placement = board.hexes.get(hexId);
    const resource = placement === undefined ? null : terrainYield(placement.terrain);
    if (resource === null) continue;

    for (const vertex of board.topology.hexVertices.get(hexId) ?? []) {
      const building = state.buildings[vertex];
      if (building === undefined) continue;

      claims.push({
        player: building.owner,
        resource,
        amount: building.kind === 'city' ? 2 : 1,
      });
    }
  }

  return claims;
}

/** Wendet eine Liste bewilligter Ansprueche auf Spieler und Bank an. */
function payOut(state: GameState, granted: readonly Claim[]): GameState {
  if (granted.length === 0) return state;

  const perPlayer = new Map<PlayerId, ResourceAmounts>();
  let fromBank = EMPTY_RESOURCES;

  for (const claim of granted) {
    const current = perPlayer.get(claim.player) ?? EMPTY_RESOURCES;
    perPlayer.set(claim.player, {
      ...current,
      [claim.resource]: current[claim.resource] + claim.amount,
    });
    fromBank = { ...fromBank, [claim.resource]: fromBank[claim.resource] + claim.amount };
  }

  return {
    ...state,
    players: state.players.map((player) => {
      const gain = perPlayer.get(player.id);
      return gain === undefined
        ? player
        : { ...player, resources: addResources(player.resources, gain) };
    }),
    bank: subtractResources(state.bank, fromBank),
  };
}

/**
 * Verteilt den Ertrag eines Wurfs.
 *
 * Erwartet einen Wurf ohne Raeuber (also nicht die Sieben); fuer eine Zahl, die
 * auf keinem Feld liegt, passiert schlicht nichts.
 */
export function distributeYield(state: GameState, roll: number): GameState {
  const claims = claimsForRoll(state, roll);
  if (claims.length === 0) return state;

  const granted: Claim[] = [];

  // Je Ressource getrennt entscheiden - die Knappheit beim Lehm geht die Wolle
  // nichts an.
  const byResource = new Map<ResourceId, Claim[]>();
  for (const claim of claims) {
    const bucket = byResource.get(claim.resource);
    if (bucket === undefined) byResource.set(claim.resource, [claim]);
    else bucket.push(claim);
  }

  for (const [resource, resourceClaims] of byResource) {
    const demanded = resourceClaims.reduce((sum, claim) => sum + claim.amount, 0);
    const available = state.bank[resource];

    if (demanded <= available) {
      granted.push(...resourceClaims);
      continue;
    }

    // Mehrere Anspruchsberechtigte und zu wenig Vorrat: niemand bekommt etwas.
    const players = new Set(resourceClaims.map((claim) => claim.player));
    if (players.size > 1) continue;

    // Genau einer: er bekommt, was noch da ist.
    const only = resourceClaims[0]!;
    if (available > 0) granted.push({ ...only, amount: available });
  }

  return payOut(state, granted);
}

/**
 * Der Sofortertrag der zweiten Siedlung in der Gruendungsphase.
 *
 * Eine Karte je angrenzendem Ertragsfeld, unabhaengig von Zahlenchips. Der
 * Raeuber bleibt aussen vor: er steht zu diesem Zeitpunkt auf der Wueste, die
 * ohnehin nichts abwirft.
 */
export function grantSetupYield(state: GameState, player: PlayerId, vertex: VertexId): GameState {
  const board = boardOf(state.scenario);
  const claims: Claim[] = [];

  for (const hexId of board.topology.vertexHexes.get(vertex) ?? []) {
    const placement = board.hexes.get(hexId);
    const resource = placement === undefined ? null : terrainYield(placement.terrain);
    if (resource === null) continue;

    // Ein einzelner Spieler - es gilt die Regel "bekommt, was noch da ist".
    const available = state.bank[resource];
    const alreadyClaimed = claims
      .filter((claim) => claim.resource === resource)
      .reduce((sum, claim) => sum + claim.amount, 0);

    if (alreadyClaimed < available) claims.push({ player, resource, amount: 1 });
  }

  return payOut(state, claims);
}
