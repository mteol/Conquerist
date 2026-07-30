import { decodeVertexId, encodeEdgeId, encodeVertexId, isVertexId } from './canonical.js';
import { HEX_DIRECTIONS, HEX_DIRECTION_COUNT, normalizeDirection } from './directions.js';
import { hexAdd, hexToId, type Hex } from './hex.js';
import type { EdgeId } from './edge.js';

/**
 * Knoten = Siedlungsplatz. Id-Form `v:0,0|1,-1|1,0` - die drei angrenzenden
 * Felder, sortiert. Siehe `canonical.ts` fuer das Warum.
 */
export type VertexId = string;

export { isVertexId };

/**
 * Ecke `corner` des Felds `hex`.
 *
 * Ecke `i` liegt zwischen den Nachbarn in Richtung `i` und `i + 1`; diese drei
 * Felder treffen sich dort in einem Punkt. Gerechnet wird gegen die unendliche
 * Ebene, nicht gegen ein Brett: ein Randknoten grenzt auf dem Brett nur an ein
 * oder zwei Felder, geometrisch aber immer an drei. Rechnete man gegen das
 * Brett, aenderte sich die Id jedes Randknotens, sobald ein Szenario groesser
 * wird - und die Erweiterbarkeit aus Regel 5 waere dahin.
 */
export function vertexId(hex: Hex, corner: number): VertexId {
  const first = normalizeDirection(corner);
  const second = (first + 1) % HEX_DIRECTION_COUNT;

  return encodeVertexId([
    hex,
    hexAdd(hex, HEX_DIRECTIONS[first]!),
    hexAdd(hex, HEX_DIRECTIONS[second]!),
  ]);
}

/** Baut die Knoten-Id aus drei Feldern - in beliebiger Reihenfolge. */
export function vertexFromHexes(hexes: readonly Hex[]): VertexId {
  return encodeVertexId(hexes);
}

/** Die drei Felder um einen Knoten, sortiert. Auch die, die kein Brett bedeckt. */
export function vertexHexes(id: VertexId): readonly Hex[] {
  return decodeVertexId(id);
}

/** Die sechs Ecken eines Felds, in Eckenreihenfolge 0-5. */
export function hexVertices(hex: Hex): readonly VertexId[] {
  return HEX_DIRECTIONS.map((_, corner) => vertexId(hex, corner));
}

/**
 * Die drei Kanten, die an einem Knoten zusammenlaufen.
 *
 * Die drei Felder des Knotens sind paarweise benachbart; jedes Paar ist eine
 * Kante. Damit sind es genau `C(3, 2) = 3`.
 */
export function vertexEdges(id: VertexId): readonly EdgeId[] {
  const [a, b, c] = vertexHexes(id);
  return [encodeEdgeId([a!, b!]), encodeEdgeId([a!, c!]), encodeEdgeId([b!, c!])];
}

/**
 * Die drei benachbarten Knoten.
 *
 * Jeder Nachbar entsteht, indem eines der drei Felder gegen das gegenueber-
 * liegende getauscht wird: die beiden verbleibenden Felder haben genau zwei
 * gemeinsame Nachbarn - das weggelassene und den gesuchten. Bewusst ueber
 * reine Feldarithmetik statt ueber die Kanten, damit dieses Modul nicht auf
 * `edge.ts` angewiesen ist.
 */
export function vertexNeighbors(id: VertexId): readonly VertexId[] {
  const hexes = vertexHexes(id);
  const own = new Set(hexes.map(hexToId));

  const result: VertexId[] = [];
  for (let skipped = 0; skipped < hexes.length; skipped += 1) {
    const kept = hexes.filter((_, index) => index !== skipped);
    const [first, second] = kept;

    const shared = HEX_DIRECTIONS.map((direction) => hexAdd(first!, direction)).filter(
      (candidate) =>
        HEX_DIRECTIONS.some(
          (direction) => hexToId(hexAdd(second!, direction)) === hexToId(candidate),
        ),
    );

    const other = shared.find((candidate) => !own.has(hexToId(candidate)));
    // Zwei benachbarte Felder haben in der Ebene immer genau zwei gemeinsame
    // Nachbarn, einer davon ist das weggelassene Feld. `other` existiert also.
    result.push(vertexFromHexes([first!, second!, other!]));
  }

  return result;
}
