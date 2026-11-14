import { describe, expect, it } from 'vitest';
import { RHUMB_NODES, rankOf, rhumbLines, rhumbNode, windOf } from './rhumb';

describe('rhumb', () => {
  it('verbindet jeden Knoten mit jedem: 120 Sehnen', () => {
    expect(rhumbLines(100)).toHaveLength((RHUMB_NODES * (RHUMB_NODES - 1)) / 2);
  });

  it('legt Knoten 0 in den Norden und Knoten 4 in den Osten', () => {
    const north = rhumbNode(0, 100);
    const east = rhumbNode(4, 100);
    expect(north.x).toBeCloseTo(0);
    expect(north.y).toBeCloseTo(-100);
    expect(east.x).toBeCloseTo(100);
    expect(east.y).toBeCloseTo(0);
  });

  it('nennt den Durchmesser Nord-Sued einen Hauptwind in Richtung 0', () => {
    expect(windOf(0, 8)).toBe(0);
    expect(rankOf(windOf(0, 8))).toBe('wind');
  });

  it('gibt jeder Sehne die Richtung, in der sie tatsaechlich laeuft', () => {
    for (const line of rhumbLines(100)) {
      const dx = line.to.x - line.from.x;
      const dy = line.to.y - line.from.y;
      // Kompasskurs der Linie in 11,25-Grad-Schritten, als Richtung ohne Sinn (mod 16).
      const bearing = (Math.atan2(dx, -dy) / (Math.PI * 2)) * 32;
      const steps = ((Math.round(bearing) % 16) + 16) % 16;
      expect(steps).toBe(line.wind % 16);
    }
  });

  it('teilt die 32 Richtungen in 8 Haupt-, 8 Halb- und 16 Viertelwinde', () => {
    const ranks = Array.from({ length: 32 }, (_, wind) => rankOf(wind));
    expect(ranks.filter((rank) => rank === 'wind')).toHaveLength(8);
    expect(ranks.filter((rank) => rank === 'half')).toHaveLength(8);
    expect(ranks.filter((rank) => rank === 'quarter')).toHaveLength(16);
  });
});
