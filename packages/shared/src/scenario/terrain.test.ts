import { describe, expect, it } from 'vitest';

import {
  CARD_IDS,
  COMMODITY_IDS,
  RESOURCE_IDS,
  TERRAIN_COMMODITY,
  TERRAIN_IDS,
  terrainCommodity,
} from './terrain.js';

describe('Handelswaren', () => {
  it('sind drei und stehen hinter den Rohstoffen', () => {
    expect(COMMODITY_IDS).toEqual(['paper', 'cloth', 'coin']);
    expect(CARD_IDS).toEqual([...RESOURCE_IDS, ...COMMODITY_IDS]);
  });

  it('kommen von Wald, Weide und Gebirge - und nur von dort', () => {
    expect(terrainCommodity('forest')).toBe('paper');
    expect(terrainCommodity('pasture')).toBe('cloth');
    expect(terrainCommodity('mountains')).toBe('coin');
    expect(terrainCommodity('hills')).toBeNull();
    expect(terrainCommodity('fields')).toBeNull();
    expect(terrainCommodity('desert')).toBeNull();
  });

  it('nennen jede Gelaendeart, damit eine neue auffaellt', () => {
    for (const terrain of TERRAIN_IDS) {
      expect(TERRAIN_COMMODITY).toHaveProperty(terrain);
    }
  });

  /*
   * Die Reihenfolge ist Teil der Zusage und kein Zufall: `cardAt` zaehlt eine
   * fremde Hand in genau dieser Folge durch. Kaemen die Handelswaren nach
   * vorn, zoege derselbe Seed in einer alten Partie eine andere Karte.
   */
  it('haengen hinten an, damit eine Basispartie gleich bleibt', () => {
    expect(CARD_IDS.slice(0, RESOURCE_IDS.length)).toEqual([...RESOURCE_IDS]);
  });
});
