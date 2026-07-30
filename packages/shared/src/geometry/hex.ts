import { HEX_DIRECTIONS, HEX_DIRECTION_COUNT, normalizeDirection } from './directions.js';

/**
 * Hexfeld in axialen Koordinaten.
 *
 * Gespeichert wird axial (zwei Zahlen), gerechnet wird fuer Distanz und
 * Drehung in Cube-Koordinaten (drei Zahlen mit `x + y + z = 0`). Axial ist
 * kompakt und serialisiert gut, Cube macht die Distanzformel trivial - die
 * Umrechnung ist eine Addition und kostet nichts.
 */
export interface Hex {
  readonly q: number;
  readonly r: number;
}

/** Cube-Koordinate. Es gilt immer `x + y + z === 0`. */
export interface Cube {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Textuelle Id eines Felds, Form `"q,r"` - zum Beispiel `"0,0"` oder `"-1,2"`.
 *
 * Ein reiner String-Alias, kein Branded Type: die kanonischen Knoten- und
 * Kanten-Ids sind an ihrem Praefix (`v:` / `e:`) erkennbar, und ein
 * Nominaltyp-Aufbau ohne konkreten Anlass waere genau der Vorbau, den Regel 5
 * ausschliesst.
 */
export type HexId = string;

const HEX_ID_PATTERN = /^(-?\d+),(-?\d+)$/;

/** Rechnet axial nach Cube um. */
export function hexToCube(hex: Hex): Cube {
  return { x: hex.q, y: -hex.q - hex.r, z: hex.r };
}

/** Rechnet Cube nach axial um. */
export function cubeToHex(cube: Cube): Hex {
  return { q: cube.x, r: cube.z };
}

/** Zwei Felder sind gleich, wenn beide Koordinaten uebereinstimmen. */
export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

/** Komponentenweise Addition. */
export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

/** Komponentenweise Multiplikation mit einem Faktor. */
export function hexScale(hex: Hex, factor: number): Hex {
  return { q: hex.q * factor, r: hex.r * factor };
}

/** Nachbarfeld in der angegebenen Richtung. Der Index wird zyklisch normalisiert. */
export function hexNeighbor(hex: Hex, direction: number): Hex {
  return hexAdd(hex, HEX_DIRECTIONS[normalizeDirection(direction)]!);
}

/** Alle sechs Nachbarfelder, in Richtungsreihenfolge. */
export function hexNeighbors(hex: Hex): readonly Hex[] {
  return HEX_DIRECTIONS.map((direction) => hexAdd(hex, direction));
}

/**
 * Abstand in Feldern.
 *
 * In Cube-Koordinaten ist das die halbe Summe der Betraege der Differenzen -
 * die Manhattan-Distanz eines Gitters, in dem jeder Schritt zwei Achsen
 * veraendert.
 */
export function hexDistance(a: Hex, b: Hex): number {
  const from = hexToCube(a);
  const to = hexToCube(b);
  return (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) + Math.abs(from.z - to.z)) / 2;
}

/**
 * Alle Felder im Abstand `radius` um `center`, einmal im Kreis.
 *
 * Beginnt an einer festen Ecke und laeuft die sechs Seiten ab. Aufeinander-
 * folgende Eintraege sind immer benachbart, der letzte grenzt wieder an den
 * ersten.
 */
export function hexRing(center: Hex, radius: number): Hex[] {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError(`hexRing: radius muss eine ganze Zahl >= 0 sein, war ${radius}`);
  }
  if (radius === 0) return [{ q: center.q, r: center.r }];

  const result: Hex[] = [];
  // Startecke: `radius` Schritte in Richtung 4. Von dort fuehrt Richtung 0
  // genau eine Seite entlang, danach jeweils die naechste Richtung.
  let hex = hexAdd(center, hexScale(HEX_DIRECTIONS[4]!, radius));

  for (let direction = 0; direction < HEX_DIRECTION_COUNT; direction += 1) {
    for (let step = 0; step < radius; step += 1) {
      result.push(hex);
      hex = hexNeighbor(hex, direction);
    }
  }

  return result;
}

/**
 * Alle Felder bis einschliesslich `radius`, von innen nach aussen.
 *
 * Die Reihenfolge ist die entscheidende Eigenschaft: Zahlenchips in
 * Spiralreihenfolge aufs Brett zu legen erzeugt spuerbar bessere Verteilungen
 * als reines Mischen (siehe `scenario/generator.ts`).
 */
export function hexSpiral(center: Hex, radius: number): Hex[] {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError(`hexSpiral: radius muss eine ganze Zahl >= 0 sein, war ${radius}`);
  }

  const result: Hex[] = [];
  for (let current = 0; current <= radius; current += 1) {
    result.push(...hexRing(center, current));
  }
  return result;
}

/**
 * Baut ein zeilenweise beschriebenes Brett, etwa `[3, 4, 5, 4, 3]` fuer das
 * Basisspiel oder `[3, 4, 5, 6, 5, 4, 3]` fuer die 5-6-Erweiterung.
 *
 * Die breiteste Reihe liegt in der Mitte (`r = 0`) und wird um `q = 0`
 * zentriert. Reihen darueber ruecken pro Schritt nach oben um eine Spalte nach
 * rechts - das ist die Versetzung, die axiale Koordinaten verlangen, damit die
 * Reihen tatsaechlich aneinanderliegen.
 *
 * Fuer `[3, 4, 5, 4, 3]` kommt exakt das Sechseck mit Radius 2 heraus; der Test
 * prueft das gegen `hexSpiral` und damit gegen eine unabhaengige Konstruktion.
 */
export function hexRowLayout(rowSizes: readonly number[]): Hex[] {
  if (rowSizes.length === 0) {
    throw new RangeError('hexRowLayout: mindestens eine Reihe erforderlich');
  }
  for (const size of rowSizes) {
    if (!Number.isInteger(size) || size < 1) {
      throw new RangeError(`hexRowLayout: jede Reihe braucht mindestens ein Feld, war ${size}`);
    }
  }

  const widest = Math.max(...rowSizes);
  const middleRow = rowSizes.indexOf(widest);
  const middleStart = -Math.floor(widest / 2);

  const result: Hex[] = [];
  for (let row = 0; row < rowSizes.length; row += 1) {
    const r = row - middleRow;
    const start = middleStart - Math.min(r, 0);
    for (let column = 0; column < rowSizes[row]!; column += 1) {
      result.push({ q: start + column, r });
    }
  }

  return result;
}

/** Textuelle Id eines Felds. */
export function hexToId(hex: Hex): HexId {
  return `${hex.q},${hex.r}`;
}

/** Liest eine Feld-Id zurueck. Wirft, wenn die Form nicht stimmt. */
export function hexFromId(id: HexId): Hex {
  const match = HEX_ID_PATTERN.exec(id);
  if (match === null) {
    throw new TypeError(`Keine gueltige Hex-Id: ${JSON.stringify(id)}`);
  }
  return { q: Number(match[1]), r: Number(match[2]) };
}
