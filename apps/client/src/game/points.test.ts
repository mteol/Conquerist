import { describe, expect, it } from 'vitest';
import { pointBreakdown } from './points';
import type { PlayerRow } from './view';

function row(victoryPoints: number, pointParts: PlayerRow['pointParts']): PlayerRow {
  return { victoryPoints, pointParts } as PlayerRow;
}

describe('Die Rechnung eines Spielers', () => {
  it('nennt jede Quelle mit den Woertern vom Tisch', () => {
    expect(pointBreakdown(row(6, { settlement: 2, city: 2, longestRoad: 2 }))).toEqual([
      { label: 'Siedlungen', points: 2 },
      { label: 'Städte', points: 2 },
      { label: 'Handelsstraße', points: 2 },
    ]);
  });

  it('benennt den Rest als Siegpunktkarten', () => {
    expect(pointBreakdown(row(4, { settlement: 3 }))).toEqual([
      { label: 'Siedlungen', points: 3 },
      { label: 'Siegpunktkarten', points: 1 },
    ]);
  });

  it('bleibt leer ohne Punkte', () => {
    expect(pointBreakdown(row(0, {}))).toEqual([]);
  });
});
