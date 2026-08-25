import { describe, expect, it } from 'vitest';
import { RESOURCE_IDS, TERRAIN_IDS, terrainYield, cardAmounts } from '@conquerist/shared';
import {
  RESOURCE_COLORS,
  RESOURCE_LABELS,
  TERRAIN_COLORS,
  TERRAIN_LABELS,
  harborLabel,
  resourceList,
} from './labels';

describe('Bezeichner', () => {
  it('benennt jede Ressource und jedes Gelaende', () => {
    for (const resource of RESOURCE_IDS) {
      expect(RESOURCE_LABELS[resource]).toBeTruthy();
    }
    for (const terrain of TERRAIN_IDS) {
      expect(TERRAIN_LABELS[terrain]).toBeTruthy();
      expect(TERRAIN_COLORS[terrain]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('faerbt jede Ressource wie das Gelaende, das sie abwirft', () => {
    // Keine zweite Farbwelt: wer Lehm sucht, sucht die Farbe der Huegel.
    for (const terrain of TERRAIN_IDS) {
      const resource = terrainYield(terrain);
      if (resource === null) continue;
      expect(RESOURCE_COLORS[resource]).toBe(TERRAIN_COLORS[terrain]);
    }

    for (const resource of RESOURCE_IDS) {
      expect(RESOURCE_COLORS[resource]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('unterscheidet die Hafenarten', () => {
    expect(harborLabel({ edge: 'e:0,0|1,0', ratio: 3 })).toBe('3:1 beliebig');
    expect(harborLabel({ edge: 'e:0,0|1,0', ratio: 2, resource: 'ore' })).toBe('2:1 Erz');
  });

  it('zaehlt nur auf, was vorhanden ist', () => {
    expect(resourceList(cardAmounts({ brick: 2, lumber: 0, wool: 1, grain: 0, ore: 0 }))).toBe(
      '2 Lehm, 1 Wolle',
    );
    expect(resourceList(cardAmounts({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }))).toBe(
      'nichts',
    );
  });
});
