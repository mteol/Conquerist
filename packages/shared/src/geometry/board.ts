import {
  edgeHexes,
  edgeVertices as geometricEdgeVertices,
  hexEdges as geometricHexEdges,
  type EdgeId,
} from './edge.js';
import { hexToId, type Hex, type HexId } from './hex.js';
import {
  hexVertices as geometricHexVertices,
  vertexEdges as geometricVertexEdges,
  vertexHexes,
  type VertexId,
} from './vertex.js';

/**
 * Die vollstaendige Topologie eines Bretts, abgeleitet aus einer blossen
 * Feldmenge.
 *
 * Nichts davon steht in der `ScenarioDefinition` - ein Szenario beschreibt
 * seine Felder, alles andere folgt daraus. Gespeicherte Knoten- und
 * Kantenlisten waeren eine zweite Wahrheit, die mit der ersten auseinander-
 * laufen kann, und ab Etappe 6 lieber ein Bug im Action-Log als eine Zeile
 * Rechnung.
 *
 * Die Nachschlagetabellen entstehen einmalig beim Bauen. Der Reducer ab
 * Etappe 2 fragt sie im Millisekundentakt ab; sie jedes Mal neu abzuleiten
 * waere Verschwendung, sie im Zustand zu halten waere ein Regelverstoss.
 */
export interface BoardTopology {
  /** Alle Felder des Bretts, in der Reihenfolge der Eingabe. */
  readonly hexes: readonly HexId[];
  /** Alle Siedlungsplaetze. */
  readonly vertices: readonly VertexId[];
  /** Alle Strassenplaetze. */
  readonly edges: readonly EdgeId[];

  /** Feld -> seine sechs Ecken, in Eckenreihenfolge. */
  readonly hexVertices: ReadonlyMap<HexId, readonly VertexId[]>;
  /** Feld -> seine sechs Kanten, in Richtungsreihenfolge. */
  readonly hexEdges: ReadonlyMap<HexId, readonly EdgeId[]>;

  /**
   * Knoten -> die angrenzenden Felder, die zum Brett gehoeren (ein bis drei).
   *
   * Genau die Liste, aus der ab Etappe 2 der Ertrag einer Siedlung folgt: ein
   * Randknoten liegt geometrisch immer an drei Feldern, bringt aber nur von
   * denen etwas ein, die tatsaechlich auf dem Brett liegen.
   */
  readonly vertexHexes: ReadonlyMap<VertexId, readonly HexId[]>;
  /** Knoten -> die angrenzenden Kanten, die zum Brett gehoeren. */
  readonly vertexEdges: ReadonlyMap<VertexId, readonly EdgeId[]>;
  /** Knoten -> die ueber eine Brettkante erreichbaren Knoten. */
  readonly vertexNeighbors: ReadonlyMap<VertexId, readonly VertexId[]>;

  /** Kante -> ihre beiden Endknoten. */
  readonly edgeVertices: ReadonlyMap<EdgeId, readonly VertexId[]>;
  /** Kante -> die anschliessenden Kanten des Bretts. */
  readonly edgeNeighbors: ReadonlyMap<EdgeId, readonly EdgeId[]>;
}

/**
 * Leitet die Topologie aus einer Feldmenge ab.
 *
 * Zugehoerigkeit ist einheitlich definiert: ein Knoten oder eine Kante gehoert
 * zum Brett, sobald mindestens eines der angrenzenden Felder zum Brett gehoert.
 * Das ist genau die Kuestenregel, die Catan braucht - eine Siedlung am
 * Brettrand ist erlaubt, eine Strasse entlang der Kueste auch.
 *
 * Die Nachbarschaftslisten werden anschliessend aus den Brettkanten abgeleitet,
 * nicht aus der Geometrie. Sonst koennte ein Knoten einen Nachbarn nennen, zu
 * dem gar keine baubare Kante fuehrt.
 */
export function buildBoardTopology(hexes: readonly Hex[]): BoardTopology {
  if (hexes.length === 0) {
    throw new RangeError('buildBoardTopology: Ein Brett braucht mindestens ein Feld');
  }

  const hexIds: HexId[] = [];
  const hexSet = new Set<HexId>();
  for (const hex of hexes) {
    const id = hexToId(hex);
    if (hexSet.has(id)) {
      throw new RangeError(`buildBoardTopology: Feld ${id} kommt doppelt vor`);
    }
    hexSet.add(id);
    hexIds.push(id);
  }

  const hexVertices = new Map<HexId, readonly VertexId[]>();
  const hexEdges = new Map<HexId, readonly EdgeId[]>();
  const vertexOrder: VertexId[] = [];
  const edgeOrder: EdgeId[] = [];
  const knownVertices = new Set<VertexId>();
  const knownEdges = new Set<EdgeId>();

  for (const hex of hexes) {
    const id = hexToId(hex);
    const corners = geometricHexVertices(hex);
    const sides = geometricHexEdges(hex);

    hexVertices.set(id, corners);
    hexEdges.set(id, sides);

    for (const corner of corners) {
      if (!knownVertices.has(corner)) {
        knownVertices.add(corner);
        vertexOrder.push(corner);
      }
    }
    for (const side of sides) {
      if (!knownEdges.has(side)) {
        knownEdges.add(side);
        edgeOrder.push(side);
      }
    }
  }

  const edgeVertices = new Map<EdgeId, readonly VertexId[]>();
  for (const edge of edgeOrder) {
    // Beide Endknoten liegen zwangslaeufig auf dem Brett: sie enthalten beide
    // Felder der Kante, und mindestens eines davon gehoert zum Brett.
    edgeVertices.set(edge, geometricEdgeVertices(edge));
  }

  const vertexEdges = new Map<VertexId, readonly EdgeId[]>();
  const vertexNeighbors = new Map<VertexId, readonly VertexId[]>();
  const vertexHexesOnBoard = new Map<VertexId, readonly HexId[]>();

  for (const vertex of vertexOrder) {
    const sides = geometricVertexEdges(vertex).filter((edge) => knownEdges.has(edge));
    vertexEdges.set(vertex, sides);

    vertexNeighbors.set(
      vertex,
      sides.flatMap((edge) => (edgeVertices.get(edge) ?? []).filter((end) => end !== vertex)),
    );

    vertexHexesOnBoard.set(
      vertex,
      vertexHexes(vertex)
        .map(hexToId)
        .filter((id) => hexSet.has(id)),
    );
  }

  const edgeNeighbors = new Map<EdgeId, readonly EdgeId[]>();
  for (const edge of edgeOrder) {
    const neighbours: EdgeId[] = [];
    for (const vertex of edgeVertices.get(edge) ?? []) {
      for (const candidate of vertexEdges.get(vertex) ?? []) {
        if (candidate !== edge) neighbours.push(candidate);
      }
    }
    edgeNeighbors.set(edge, neighbours);
  }

  return {
    hexes: hexIds,
    vertices: vertexOrder,
    edges: edgeOrder,
    hexVertices,
    hexEdges,
    vertexHexes: vertexHexesOnBoard,
    vertexEdges,
    vertexNeighbors,
    edgeVertices,
    edgeNeighbors,
  };
}

/**
 * Die Kuestenkanten in Rundwegreihenfolge - jede Kante trifft die naechste in
 * einem Knoten, die letzte wieder die erste.
 *
 * Kuestenkante heisst: genau eines der beiden angrenzenden Felder liegt auf dem
 * Brett. Genau dort sitzen die Haefen, und nur in dieser Reihenfolge lassen sie
 * sich gleichmaessig ueber den Rand verteilen - eine Liste in beliebiger
 * Reihenfolge wuerde sie verklumpen.
 *
 * An jedem Knoten treffen null oder zwei Kuestenkanten zusammen, nie eine oder
 * drei; die Kueste ist also immer eine Vereinigung geschlossener Ringe. Dass es
 * genau einer ist, gilt nur fuer Bretter ohne Loecher und ohne Felder, die sich
 * nur in einem Punkt beruehren - deshalb die Pruefung am Ende statt einer
 * stillen Teilliste.
 */
export function coastalEdgeRing(topology: BoardTopology): readonly EdgeId[] {
  const hexSet = new Set(topology.hexes);
  const coastal = topology.edges.filter(
    (edge) => edgeHexes(edge).filter((hex) => hexSet.has(hexToId(hex))).length === 1,
  );

  if (coastal.length === 0) {
    throw new RangeError('coastalEdgeRing: Das Brett hat keine Kuestenkanten');
  }

  const atVertex = new Map<VertexId, EdgeId[]>();
  for (const edge of coastal) {
    for (const vertex of topology.edgeVertices.get(edge) ?? []) {
      const list = atVertex.get(vertex);
      if (list === undefined) atVertex.set(vertex, [edge]);
      else list.push(edge);
    }
  }

  for (const [vertex, edges] of atVertex) {
    if (edges.length !== 2) {
      throw new RangeError(
        `coastalEdgeRing: Am Knoten ${vertex} treffen ${edges.length} Kuestenkanten zusammen, erwartet sind zwei`,
      );
    }
  }

  const start = coastal[0]!;
  const ring: EdgeId[] = [start];
  let previous: EdgeId | undefined;
  let current = start;

  for (;;) {
    const next = (topology.edgeVertices.get(current) ?? [])
      .flatMap((vertex) => atVertex.get(vertex) ?? [])
      .find((candidate) => candidate !== current && candidate !== previous);

    if (next === undefined) {
      throw new RangeError('coastalEdgeRing: Die Kueste ist kein Rundweg');
    }
    if (next === start) break;

    ring.push(next);
    previous = current;
    current = next;
  }

  if (ring.length !== coastal.length) {
    throw new RangeError(
      `coastalEdgeRing: Die Kueste zerfaellt in mehrere Ringe (${ring.length} von ${coastal.length} Kanten erreicht)`,
    );
  }

  return ring;
}
