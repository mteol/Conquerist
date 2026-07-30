import { decodeEdgeId, encodeEdgeId, isEdgeId } from './canonical.js';
import { HEX_DIRECTIONS, normalizeDirection } from './directions.js';
import { hexAdd, hexToId, type Hex } from './hex.js';
import { vertexEdges, vertexFromHexes, type VertexId } from './vertex.js';

/**
 * Kante = Strassenplatz. Id-Form `e:0,0|1,0` - die beiden angrenzenden Felder,
 * sortiert. Siehe `canonical.ts` fuer das Warum.
 */
export type EdgeId = string;

export { isEdgeId };

/** Die Kante zwischen `hex` und seinem Nachbarn in Richtung `direction`. */
export function edgeId(hex: Hex, direction: number): EdgeId {
  const delta = HEX_DIRECTIONS[normalizeDirection(direction)]!;
  return encodeEdgeId([hex, hexAdd(hex, delta)]);
}

/** Baut die Kanten-Id aus zwei Feldern - in beliebiger Reihenfolge. */
export function edgeFromHexes(hexes: readonly Hex[]): EdgeId {
  return encodeEdgeId(hexes);
}

/** Die beiden Felder beiderseits einer Kante, sortiert. */
export function edgeHexes(id: EdgeId): readonly Hex[] {
  return decodeEdgeId(id);
}

/** Die sechs Kanten eines Felds, in Richtungsreihenfolge 0-5. */
export function hexEdges(hex: Hex): readonly EdgeId[] {
  return HEX_DIRECTIONS.map((_, direction) => edgeId(hex, direction));
}

/**
 * Die beiden Endknoten einer Kante.
 *
 * Zwei benachbarte Felder haben in der Ebene genau zwei gemeinsame Nachbarn -
 * je einer an jedem Ende der gemeinsamen Kante. Zusammen mit den beiden Feldern
 * der Kante ergeben sie die beiden Knoten.
 */
export function edgeVertices(id: EdgeId): readonly VertexId[] {
  const [a, b] = edgeHexes(id);
  const aroundB = new Set(HEX_DIRECTIONS.map((direction) => hexToId(hexAdd(b!, direction))));

  const shared = HEX_DIRECTIONS.map((direction) => hexAdd(a!, direction)).filter((candidate) =>
    aroundB.has(hexToId(candidate)),
  );

  return shared.map((corner) => vertexFromHexes([a!, b!, corner]));
}

/**
 * Die vier anschliessenden Kanten - je zwei an jedem Ende.
 *
 * Genau die Menge, an die ab Etappe 2 eine Strasse angebaut werden darf.
 */
export function edgeNeighbors(id: EdgeId): readonly EdgeId[] {
  const result: EdgeId[] = [];
  for (const vertex of edgeVertices(id)) {
    for (const candidate of vertexEdges(vertex)) {
      if (candidate !== id) result.push(candidate);
    }
  }
  return result;
}
