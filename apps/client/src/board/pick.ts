import { hexFromId } from '@conquerist/shared';

import type { ActionTargets } from '../game/targets';
import type { Place } from './BoardSvg';
import { edgeMidpoint, hexCenter, vertexPoint, type Point } from './layout';

/**
 * Aus einem Punkt auf dem Brett wird genau ein Ziel.
 *
 * Warum das eine eigene Funktion ist und keine groesseren Trefferkreise: auf
 * einem Handy im Querformat ist das Brett rund 330 px breit, die `viewBox` misst
 * 9,76 Einheiten - also ~34 px je Umkreisradius. Benachbarte Knoten liegen genau
 * einen Radius auseinander, eine Fingerkuppe misst 44 px. Trefferkreise in
 * Fingergroesse **ueberlappen** damit, und dann entschiede die
 * Zeichenreihenfolge, welches Ziel gemeint war - eine willkuerliche Wahrheit an
 * der Stelle, wo es genau eine geben muss.
 *
 * Und es ist kein Randfall: bei der **ersten** Setzung ist jeder Knoten des
 * Bretts erlaubt (im Browser nachgezaehlt: 54 Stellen). Die Abstandsregel
 * duennt erst danach aus.
 *
 * Rein und ohne DOM: die eigentliche Frage ("was habe ich getroffen") ist damit
 * pruefbar, ohne einen Klick zu simulieren.
 */

/** Wie weit ein Tipp danebenliegen darf, in Umkreisradien. */
export const PICK_REACH = 0.6;

export interface TargetPoint {
  readonly place: Place;
  readonly point: Point;
}

/** Wo die erlaubten Ziele auf dem Brett liegen. */
export function targetPoints(targets: ActionTargets): readonly TargetPoint[] {
  const points: TargetPoint[] = [];

  for (const vertex of targets.vertices.keys()) {
    points.push({ place: { kind: 'vertex', id: vertex }, point: vertexPoint(vertex) });
  }
  for (const edge of targets.edges.keys()) {
    points.push({ place: { kind: 'edge', id: edge }, point: edgeMidpoint(edge) });
  }
  for (const hex of targets.hexes.keys()) {
    points.push({ place: { kind: 'hex', id: hex }, point: hexCenter(hexFromId(hex)) });
  }

  return points;
}

/**
 * Das naechstgelegene Ziel in Reichweite - oder `null`.
 *
 * Bei gleichem Abstand gewinnt das zuerst gefundene. Das ist keine Regel,
 * sondern eine Zusage: gleich weit heisst reproduzierbar und nicht zufaellig.
 */
export function nearestTarget(
  point: Point,
  targets: readonly TargetPoint[],
  reach: number = PICK_REACH,
): Place | null {
  let best: Place | null = null;
  let bestDistance = reach;

  for (const target of targets) {
    const distance = Math.hypot(target.point.x - point.x, target.point.y - point.y);
    if (distance < bestDistance) {
      best = target.place;
      bestDistance = distance;
    }
  }

  return best;
}
