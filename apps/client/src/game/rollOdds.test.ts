import { describe, expect, it } from 'vitest';
import { DICE_TOTALS, expectedCount, isHotTotal, waysOf } from './rollOdds';

describe('Was zwei Wuerfel hergeben', () => {
  it('zaehlt alle 36 Paare genau einmal', () => {
    expect(DICE_TOTALS.reduce((sum, total) => sum + waysOf(total), 0)).toBe(36);
  });

  it('kennt die Glocke von 2 bis 12', () => {
    expect(DICE_TOTALS.map(waysOf)).toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
    expect(waysOf(1)).toBe(0);
    expect(waysOf(13)).toBe(0);
  });

  it('erwartet den Anteil der Wuerfe, ungerundet', () => {
    expect(expectedCount(8, 90)).toBe(12.5);
    expect(expectedCount(7, 36)).toBe(6);
    expect(expectedCount(2, 0)).toBe(0);
  });

  it('nennt nur die Sechs und die Acht heiss, nicht die Sieben', () => {
    expect(DICE_TOTALS.filter(isHotTotal)).toEqual([6, 8]);
  });
});
