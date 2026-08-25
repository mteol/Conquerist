import type { VertexId } from '../geometry/index.js';
import type { CardAmounts } from '../rules/index.js';
import {
  terrainCommodity,
  terrainYield,
  type CardId,
  type ResourceId,
  type TerrainId,
} from '../scenario/index.js';
import { boardOf } from './board.js';
import type { PlayerId } from './player.js';
import { EMPTY_CARDS, addCards, subtractCards } from './cards.js';
import type { BuildingKind, GameState } from './state.js';

/**
 * Ertragsverteilung.
 *
 * Eine Siedlung bringt eine Karte, eine Stadt zwei - je angrenzendem Feld, das
 * die gewuerfelte Zahl traegt. Das Feld, auf dem der Raeuber steht, liefert
 * nichts.
 *
 * **Mit Staedte & Ritter sind die zwei Karten einer Stadt nicht mehr
 * zwangslaeufig zweimal dasselbe.** An Wald, Weideland und Gebirge bringt sie
 * einen Rohstoff und eine Handelsware; an Huegelland und Ackerland weiterhin
 * zwei Rohstoffe. Ein Verzicht zugunsten von zwei gleichen Karten ist nicht
 * erlaubt - deshalb steht hier eine Ableitung und keine Wahl.
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
  /**
   * `CardId` und nicht `ResourceId`: eine Stadt am Wald bringt Holz **und**
   * Papier, und beides geht durch dieselbe Bankpruefung.
   */
  readonly card: CardId;
  readonly amount: number;
}

/**
 * Was ein Bauwerk an einem Feld einbringt.
 *
 * Ob Handelswaren ueberhaupt fallen, entscheidet das Regelwerk und nicht das
 * Gelaende: `TERRAIN_COMMODITY` gilt immer, aber an einem Basistisch steht die
 * Handelsware nicht in `rules.cards`, und dann bleibt es bei zwei Rohstoffen.
 * So braucht das Basisspiel keinen Sonderfall und die Erweiterung keinen
 * Schalter.
 */
function claimsAt(
  state: GameState,
  player: PlayerId,
  terrain: TerrainId,
  resource: ResourceId,
  kind: BuildingKind,
): Claim[] {
  if (kind !== 'city') return [{ player, card: resource, amount: 1 }];

  const commodity = terrainCommodity(terrain);
  const inPlay = commodity !== null && state.rules.cards.includes(commodity);

  return inPlay
    ? [
        { player, card: resource, amount: 1 },
        { player, card: commodity, amount: 1 },
      ]
    : [{ player, card: resource, amount: 2 }];
}

/** Sammelt alle Ansprueche eines Wurfs - ohne zu pruefen, ob die Bank sie deckt. */
function claimsForRoll(state: GameState, roll: number): Claim[] {
  const board = boardOf(state.scenario);
  const claims: Claim[] = [];

  for (const hexId of board.hexesByChip.get(roll) ?? []) {
    if (hexId === state.robber) continue;

    const placement = board.hexes.get(hexId);
    if (placement === undefined) continue;

    const resource = terrainYield(placement.terrain);
    if (resource === null) continue;

    for (const vertex of board.topology.hexVertices.get(hexId) ?? []) {
      const building = state.buildings[vertex];
      if (building === undefined) continue;

      claims.push(...claimsAt(state, building.owner, placement.terrain, resource, building.kind));
    }
  }

  return claims;
}

/** Wendet eine Liste bewilligter Ansprueche auf Spieler und Bank an. */
function payOut(state: GameState, granted: readonly Claim[]): GameState {
  if (granted.length === 0) return state;

  const perPlayer = new Map<PlayerId, CardAmounts>();
  let fromBank = EMPTY_CARDS;

  for (const claim of granted) {
    const current = perPlayer.get(claim.player) ?? EMPTY_CARDS;
    perPlayer.set(claim.player, {
      ...current,
      [claim.card]: current[claim.card] + claim.amount,
    });
    fromBank = { ...fromBank, [claim.card]: fromBank[claim.card] + claim.amount };
  }

  return {
    ...state,
    players: state.players.map((player) => {
      const gain = perPlayer.get(player.id);
      return gain === undefined
        ? player
        : { ...player, resources: addCards(player.resources, gain) };
    }),
    bank: subtractCards(state.bank, fromBank),
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

  /*
   * Je Kartensorte getrennt entscheiden - die Knappheit beim Lehm geht die
   * Wolle nichts an. Und Holz und Papier sind zwei Sorten: geht das Papier
   * aus, faellt das Holz nicht mit aus, obwohl beide vom Wald kommen.
   */
  const byCard = new Map<CardId, Claim[]>();
  for (const claim of claims) {
    const bucket = byCard.get(claim.card);
    if (bucket === undefined) byCard.set(claim.card, [claim]);
    else bucket.push(claim);
  }

  for (const [card, cardClaims] of byCard) {
    const demanded = cardClaims.reduce((sum, claim) => sum + claim.amount, 0);
    const available = state.bank[card];

    if (demanded <= available) {
      granted.push(...cardClaims);
      continue;
    }

    // Mehrere Anspruchsberechtigte und zu wenig Vorrat: niemand bekommt etwas.
    const players = new Set(cardClaims.map((claim) => claim.player));
    if (players.size > 1) continue;

    // Genau einer: er bekommt, was noch da ist.
    const only = cardClaims[0]!;
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
      .filter((claim) => claim.card === resource)
      .reduce((sum, claim) => sum + claim.amount, 0);

    if (alreadyClaimed < available) claims.push({ player, card: resource, amount: 1 });
  }

  return payOut(state, claims);
}
