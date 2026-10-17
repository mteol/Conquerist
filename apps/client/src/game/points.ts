import type { PointSource } from '@conquerist/shared';
import type { PlayerRow } from './view';

/**
 * Woher die Siegpunkte eines Spielers kommen - als Woerter.
 *
 * Am Tisch (Auskunft am Punktestand, Plaketten) und im Endstand dieselben
 * Namen: wer am Tisch „Handelsstraße" liest, soll in der Abrechnung nicht
 * „Str." lesen (Designregel 8). Deshalb steht die Liste hier und nicht in
 * einer der beiden Komponenten.
 */
export const POINT_LABELS: Readonly<Record<PointSource, string>> = {
  settlement: 'Siedlungen',
  city: 'Städte',
  metropolis: 'Metropolen',
  longestRoad: 'Handelsstraße',
  largestArmy: 'Rittermacht',
  defender: 'Retter gegen Barbaren',
  progressCard: 'Fortschrittskarten',
  merchant: 'Händler',
};

export interface PointPart {
  readonly label: string;
  readonly points: number;
}

/**
 * Die ganze Rechnung eines Spielers, Quelle fuer Quelle.
 *
 * Was `victoryPoints` ueber die offenen Quellen hinaus zaehlt, sind
 * Siegpunktkarten: bei Mitspielern verdeckt (und damit gar nicht in
 * `victoryPoints`), fuer sich selbst und nach dem Sieg aufgedeckt. Gerechnet
 * wird also nichts Neues - nur die Differenz benannt.
 */
export function pointBreakdown(player: PlayerRow): readonly PointPart[] {
  const parts = player.pointParts;
  const open = (Object.keys(POINT_LABELS) as PointSource[])
    .filter((source) => (parts[source] ?? 0) > 0)
    .map((source) => ({ label: POINT_LABELS[source], points: parts[source] ?? 0 }));
  const shown = open.reduce((sum, part) => sum + part.points, 0);
  const hidden = player.victoryPoints - shown;
  return hidden > 0 ? [...open, { label: 'Siegpunktkarten', points: hidden }] : open;
}
