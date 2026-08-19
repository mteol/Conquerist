import {
  edgeHexes,
  edgeVertices,
  hexFromId,
  hexToId,
  hexVertices,
  vertexHexes,
  type EdgeId,
  type Hex,
  type HexId,
  type VertexId,
} from '@conquerist/shared';

/**
 * Vom Sechseckgitter auf die Zeichenflaeche - und nur das.
 *
 * Masseinheit ist der Umkreisradius eines Feldes (= 1). Wie gross das Brett am
 * Bildschirm erscheint, entscheidet allein der `viewBox` des SVG; hier steht
 * keine Pixelzahl.
 *
 * Ausrichtung: **Spitze oben**. Damit liegen die Reihen 3-4-5-4-3 waagerecht,
 * wie im Blueprint und wie auf dem Tisch. Die Entscheidung faellt hier und
 * nirgends sonst - die Geometrie in `shared` ist bewusst orientierungsagnostisch
 * geblieben.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Abstand zweier benachbarter Feldmittelpunkte bei Spitze oben. */
const ROW_STEP = Math.sqrt(3);

/** Mittelpunkt eines Feldes. */
export function hexCenter(hex: Hex): Point {
  return { x: ROW_STEP * (hex.q + hex.r / 2), y: 1.5 * hex.r };
}

/**
 * Die Stelle eines Knotens.
 *
 * Die Id *ist* die sortierte Menge der drei angrenzenden Felder (Etappe 1), und
 * der Schwerpunkt dreier Feldmittelpunkte, die sich paarweise beruehren, ist
 * genau die gemeinsame Ecke. Die Zeichnung kann damit gar nicht von der
 * Geometrie abweichen - eine zweite Rechnung aus Winkeln koennte es.
 */
export function vertexPoint(vertex: VertexId): Point {
  const hexes = vertexHexes(vertex);
  let x = 0;
  let y = 0;

  for (const hex of hexes) {
    const center = hexCenter(hex);
    x += center.x;
    y += center.y;
  }

  return { x: x / hexes.length, y: y / hexes.length };
}

/** Die sechs Ecken eines Feldes, in Eckenreihenfolge - abgeleitet aus den Knoten-Ids. */
export function hexCorners(hex: Hex): readonly Point[] {
  return hexVertices(hex).map(vertexPoint);
}

/** Die Strecke einer Kante: ihre beiden Endknoten. */
export function edgeSegment(edge: EdgeId): readonly [Point, Point] {
  const [from, to] = edgeVertices(edge);
  if (from === undefined || to === undefined) {
    throw new TypeError(`edgeSegment: ${edge} hat keine zwei Endknoten`);
  }
  return [vertexPoint(from), vertexPoint(to)];
}

/** Die Mitte einer Kante. */
export function edgeMidpoint(edge: EdgeId): Point {
  const [from, to] = edgeSegment(edge);
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/**
 * Wie weit die Hafenmarke von ihrer Kante in die See rueckt.
 *
 * Genug, dass zwischen Marke (Radius 0.23) und Strassenkontur (0.24 breit)
 * Luft bleibt - ein knapperer Wert haette den Fehler verkleinert statt behoben.
 */
export const HARBOR_OFFSET = 0.42;

/**
 * Wo die Hafenmarke liegt - auf der See, nicht auf der Kante.
 *
 * Vorher sass sie auf `edgeMidpoint`, und das ist genau die Stelle, ueber die
 * eine Strasse laeuft: wer auf einer Hafenkante baute, legte seinen Balken
 * mitten durch die Marke. Zwei verschiedene Dinge auf derselben Geometrie -
 * eines von beiden muss weg, und der Hafen ist das, was am Wasser liegt.
 *
 * Die Richtung wird aus dem **angrenzenden Feld** gerechnet und nicht aus dem
 * Brettschwerpunkt. Beim runden `classic34` liefe beides aufs selbe hinaus; bei
 * einem laenglichen oder gebuchteten Szenario zeigt der Schwerpunkt an manchen
 * Kanten schraeg und schoebe die Marke aufs Land. Bei einem regelmaessigen
 * Sechseck steht die Strecke Mittelpunkt -> Kantenmitte senkrecht auf der
 * Kante; die Marke tritt damit im rechten Winkel weg und haelt ueberall
 * denselben Abstand zur Strasse.
 */
export function harborAnchor(edge: EdgeId, onBoard: ReadonlySet<HexId>): Point {
  const land = edgeHexes(edge).filter((hex) => onBoard.has(hexToId(hex)));

  if (land.length !== 1) {
    throw new RangeError(
      `harborAnchor: ${edge} ist keine Kuestenkante - ${land.length} der beiden Felder liegen auf dem Brett, erwartet ist genau eines`,
    );
  }

  const middle = edgeMidpoint(edge);
  const center = hexCenter(land[0]!);
  const outX = middle.x - center.x;
  const outY = middle.y - center.y;
  const length = Math.hypot(outX, outY);

  return {
    x: middle.x + (outX / length) * HARBOR_OFFSET,
    y: middle.y + (outY / length) * HARBOR_OFFSET,
  };
}

/**
 * Der `viewBox`, der alle Felder umschliesst.
 *
 * Aus den tatsaechlichen Ausmassen gerechnet, nicht aus der Brettgroesse
 * geraten: `classic56` mit 3-4-5-6-5-4-3 faellt damit ohne Sonderfall an.
 */
export function viewBoxOf(hexIds: readonly HexId[], padding: number): string {
  if (hexIds.length === 0) {
    throw new RangeError('viewBoxOf: Ein Brett braucht mindestens ein Feld');
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const hexId of hexIds) {
    for (const corner of hexCorners(hexFromId(hexId))) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
  }

  return [
    minX - padding,
    minY - padding,
    maxX - minX + 2 * padding,
    maxY - minY + 2 * padding,
  ].join(' ');
}
