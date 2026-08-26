import { describe, expect, it } from 'vitest';

import { KNIGHT_LABELS, KNIGHT_LABELS_DATIVE, nameList } from './labels.js';

describe('nameList', () => {
  it('nennt einen Namen allein', () => {
    expect(nameList(['Anna'])).toBe('Anna');
  });

  it('verbindet zwei mit und', () => {
    expect(nameList(['Anna', 'Ben'])).toBe('Anna und Ben');
  });

  it('trennt drei mit Komma und haengt das und hinten an', () => {
    expect(nameList(['Anna', 'Ben', 'Cem'])).toBe('Anna, Ben und Cem');
  });

  it('nennt bei keinem Namen niemanden', () => {
    expect(nameList([])).toBe('niemand');
  });
});

describe('Ritterwoerter', () => {
  it('nennt die drei Stufen im Nominativ', () => {
    expect(KNIGHT_LABELS[2]).toBe('Starker Ritter');
  });

  it('nennt dieselben drei im Dativ', () => {
    expect(KNIGHT_LABELS_DATIVE[2]).toBe('Starken Ritter');
  });
});
