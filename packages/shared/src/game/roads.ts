import type { EdgeId, VertexId } from '../geometry/index.js';
import { boardOf } from './board.js';
import type { PlayerId } from './player.js';
import type { GameState } from './state.js';

/**
 * Die Laengste Handelsstrasse.
 *
 * Gesucht ist der laengste **Kantenzug** im eigenen Strassennetz: keine Strasse
 * darf zweimal benutzt werden, ein Knoten schon. Das ist etwas anderes als der
 * laengste Pfad, und der Unterschied ist im Spiel sichtbar - eine Schleife
 * zaehlt ihre ganze Laenge, eine Kreuzung mit drei Armen nur zwei davon.
 *
 * Ueber einen Knoten mit fremder Siedlung oder Stadt fuehrt die Strasse nicht
 * hindurch; enden darf sie dort. **Ritter unterbrechen wie Gebaeude** - ein
 * fremder Ritter auf einer Kreuzung teilt die Strecke genauso. Genau dafuer ist es wichtig, dass die Suche
 * beim Startknoten *nicht* auf Blockade prueft: die Strecke endet dort ja, und
 * jede Strecke wird von beiden Enden aus durchsucht.
 *
 * Verfahren: erschoepfende Tiefensuche mit Rueckschritt, von jedem Knoten des
 * eigenen Netzes aus. Bei hoechstens fuenfzehn Strassen je Spieler ist das
 * schnell genug und offensichtlich richtig. Eine Heuristik waere hier die
 * schlechtere Wahl - ihr Fehler faellt erst im Spiel auf, und zwar als falscher
 * Sieger.
 */

/** Das eigene Strassennetz als Nachbarschaftsliste ueber die Knoten. */
function ownNetwork(
  state: GameState,
  player: PlayerId,
): ReadonlyMap<VertexId, readonly { readonly edge: EdgeId; readonly to: VertexId }[]> {
  const board = boardOf(state.scenario);
  const network = new Map<VertexId, { edge: EdgeId; to: VertexId }[]>();

  for (const [edge, owner] of Object.entries(state.roads)) {
    if (owner !== player) continue;

    const ends = board.topology.edgeVertices.get(edge);
    if (ends === undefined || ends.length !== 2) continue;
    const [a, b] = ends as readonly [VertexId, VertexId];

    (network.get(a) ?? network.set(a, []).get(a)!).push({ edge, to: b });
    (network.get(b) ?? network.set(b, []).get(b)!).push({ edge, to: a });
  }

  return network;
}

/** Steht hier etwas Fremdes, das die Strecke unterbricht? */
function isBlocked(state: GameState, player: PlayerId, vertex: VertexId): boolean {
  const building = state.buildings[vertex];
  if (building !== undefined && building.owner !== player) return true;

  /*
   * Ein fremder Ritter unterbricht wie ein fremdes Dorf - so steht es in der
   * Anleitung, und es ist der Grund, warum ein Ritter ueberhaupt ein Zug gegen
   * eine fremde Laengste Handelsstrasse ist. Der eigene unterbricht nicht: man
   * geht durch die eigene Stellung hindurch.
   */
  const knight = state.knights[vertex];
  return knight !== undefined && knight.owner !== player;
}

/** Die Laenge der laengsten zusammenhaengenden Strasse dieses Spielers. */
export function longestRoadLength(state: GameState, player: PlayerId): number {
  const network = ownNetwork(state, player);
  if (network.size === 0) return 0;

  const used = new Set<EdgeId>();

  function walk(vertex: VertexId, isStart: boolean): number {
    // Ein fremdes Gebaeude oder ein fremder Ritter beendet die Strecke - ausser
    // man startet dort, denn dann endet sie eben an dieser Stelle.
    if (!isStart && isBlocked(state, player, vertex)) return 0;

    let best = 0;
    for (const step of network.get(vertex) ?? []) {
      if (used.has(step.edge)) continue;

      used.add(step.edge);
      const length = 1 + walk(step.to, false);
      used.delete(step.edge);

      if (length > best) best = length;
    }

    return best;
  }

  let longest = 0;
  for (const vertex of network.keys()) {
    const length = walk(vertex, true);
    if (length > longest) longest = length;
  }

  return longest;
}

/**
 * Vergibt die Laengste Handelsstrasse neu.
 *
 * Ab der Mindestlaenge aus dem RuleSet, und der Wechsel verlangt echtes
 * Uebertreffen: bei Gleichstand behaelt der bisherige Inhaber. Gibt es keinen
 * Inhaber und mehrere Gleichauf, bekommt sie niemand - bis einer von ihnen
 * anbaut.
 */
export function recomputeLongestRoad(state: GameState): GameState {
  const lengths = state.players.map((player) => ({
    id: player.id,
    length: longestRoadLength(state, player.id),
  }));

  const best = lengths.reduce((max, entry) => Math.max(max, entry.length), 0);

  if (best < state.rules.longestRoadMinimum) {
    return state.longestRoad.holder === null && state.longestRoad.length === 0
      ? state
      : { ...state, longestRoad: { holder: null, length: 0 } };
  }

  const leaders = lengths.filter((entry) => entry.length === best).map((entry) => entry.id);
  const holder = state.longestRoad.holder;

  const next =
    holder !== null && leaders.includes(holder)
      ? holder
      : leaders.length === 1
        ? leaders[0]!
        : null;

  if (state.longestRoad.holder === next && state.longestRoad.length === best) return state;
  return { ...state, longestRoad: { holder: next, length: best } };
}
