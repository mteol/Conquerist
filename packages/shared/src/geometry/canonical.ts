/**
 * Entscheidung A an einer einzigen Stelle: Knoten und Kanten bekommen ihre
 * Identitaet nicht zugeteilt, sie leiten sie aus den angrenzenden Feldern ab.
 *
 * Ein Siedlungsplatz ist von drei Feldern aus erreichbar, ein Strassenplatz von
 * zwei - und alle Wege muessen zwingend dieselbe Identitaet ergeben, sonst baut
 * ein Spieler zwei Siedlungen auf denselben Punkt. Statt einem Feld die
 * Zustaendigkeit zuzusprechen und jeden Bezug darauf zurueckzurechnen, *ist*
 * die Id hier die sortierte Menge der angrenzenden Felder:
 *
 * ```
 * v:0,0|1,-1|1,0     Knoten zwischen drei Feldern
 * e:0,0|1,0          Kante zwischen zwei Feldern
 * ```
 *
 * Der Rechenaufwand ist derselbe - das Besitzer-Verfahren braucht seine
 * Normalisierung ohnehin - aber die Id traegt ihren eigenen Beweis: man liest
 * die angrenzenden Felder direkt ab. Bei 54 Knoten und einem Adjazenzfehler ist
 * das der Unterschied zwischen einer Minute und einem Abend. Ab Etappe 6 landen
 * diese Ids im Action-Log und in SQLite, wo Lesbarkeit noch mehr zaehlt.
 *
 * Dieses Modul ist paketintern. Nach aussen gehen `vertex.ts` und `edge.ts`.
 */

import { hexDistance, hexFromId, hexToId, type Hex } from './hex.js';

export const VERTEX_PREFIX = 'v:';
export const EDGE_PREFIX = 'e:';
const SEPARATOR = '|';

/**
 * Ordnet Felder nach q, dann nach r - numerisch, nicht als Text.
 *
 * Textsortierung waere hier ein schleichender Fehler: sie liefert dasselbe
 * Ergebnis, solange alle Koordinaten einstellig sind, und faengt bei einem
 * groesseren Szenario an, `10,-1` vor `9,0` einzuordnen.
 */
function compareHexes(a: Hex, b: Hex): number {
  return a.q - b.q || a.r - b.r;
}

function encode(prefix: string, hexes: readonly Hex[]): string {
  return prefix + [...hexes].sort(compareHexes).map(hexToId).join(SEPARATOR);
}

/**
 * Prueft, dass die Felder paarweise verschieden und paarweise benachbart sind.
 *
 * Beides zusammen heisst: sie treffen sich in genau einem Punkt (bei drei
 * Feldern) beziehungsweise an genau einer Kante (bei zweien). Ohne diese
 * Pruefung liesse sich aus zwei beliebigen Feldern eine syntaktisch gueltige,
 * geometrisch unmoegliche Id bauen - und die kaeme ab Etappe 4 ueber das Netz.
 */
function assertMutuallyAdjacent(hexes: readonly Hex[], label: string): void {
  for (let i = 0; i < hexes.length; i += 1) {
    for (let j = i + 1; j < hexes.length; j += 1) {
      if (hexDistance(hexes[i]!, hexes[j]!) !== 1) {
        throw new TypeError(
          `${label}: ${hexToId(hexes[i]!)} und ${hexToId(hexes[j]!)} grenzen nicht aneinander`,
        );
      }
    }
  }
}

function encodeChecked(
  prefix: string,
  hexes: readonly Hex[],
  expectedCount: number,
  label: string,
): string {
  if (hexes.length !== expectedCount) {
    throw new TypeError(`${label}: genau ${expectedCount} Felder erwartet, waren ${hexes.length}`);
  }
  assertMutuallyAdjacent(hexes, label);
  return encode(prefix, hexes);
}

function decodeChecked(
  prefix: string,
  id: string,
  expectedCount: number,
  label: string,
): readonly Hex[] {
  if (!id.startsWith(prefix)) {
    throw new TypeError(`${label}: Praefix "${prefix}" fehlt in ${JSON.stringify(id)}`);
  }

  const parts = id.slice(prefix.length).split(SEPARATOR);
  if (parts.length !== expectedCount) {
    throw new TypeError(
      `${label}: genau ${expectedCount} Felder erwartet, waren ${parts.length} in ${JSON.stringify(id)}`,
    );
  }

  const hexes = parts.map(hexFromId);
  assertMutuallyAdjacent(hexes, label);

  // Die Gegenprobe: eine Id, die sich nicht selbst reproduziert, ist nicht
  // kanonisch (falsche Reihenfolge, fuehrende Nullen, Dubletten). Sie
  // durchzulassen hiesse, denselben Platz unter zwei Namen zu fuehren.
  const canonical = encode(prefix, hexes);
  if (canonical !== id) {
    throw new TypeError(
      `${label}: ${JSON.stringify(id)} ist nicht kanonisch, erwartet ${canonical}`,
    );
  }

  return hexes;
}

/** Baut die Knoten-Id aus drei paarweise benachbarten Feldern. */
export function encodeVertexId(hexes: readonly Hex[]): string {
  return encodeChecked(VERTEX_PREFIX, hexes, 3, 'Knoten');
}

/** Liest die drei Felder aus einer Knoten-Id. Wirft bei jeder Abweichung. */
export function decodeVertexId(id: string): readonly Hex[] {
  return decodeChecked(VERTEX_PREFIX, id, 3, 'Knoten');
}

/** Baut die Kanten-Id aus zwei benachbarten Feldern. */
export function encodeEdgeId(hexes: readonly Hex[]): string {
  return encodeChecked(EDGE_PREFIX, hexes, 2, 'Kante');
}

/** Liest die beiden Felder aus einer Kanten-Id. Wirft bei jeder Abweichung. */
export function decodeEdgeId(id: string): readonly Hex[] {
  return decodeChecked(EDGE_PREFIX, id, 2, 'Kante');
}

/** Prueft, ob ein String eine kanonische Knoten-Id ist - ohne zu werfen. */
export function isVertexId(value: string): boolean {
  try {
    decodeVertexId(value);
    return true;
  } catch {
    return false;
  }
}

/** Prueft, ob ein String eine kanonische Kanten-Id ist - ohne zu werfen. */
export function isEdgeId(value: string): boolean {
  try {
    decodeEdgeId(value);
    return true;
  } catch {
    return false;
  }
}
