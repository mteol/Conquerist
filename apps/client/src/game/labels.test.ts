import { describe, expect, it } from 'vitest';
import {
  RESOURCE_IDS,
  TERRAIN_IDS,
  TRACK_IDS,
  terrainYield,
  cardAmounts,
} from '@conquerist/shared';
import {
  RESOURCE_COLORS,
  RESOURCE_LABELS,
  TERRAIN_COLORS,
  TERRAIN_LABELS,
  TRACK_BUILT_WORD_COLORS,
  TRACK_COLORS_ON_SEA,
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

  // Befund B/C (Aufgabe 11): jeder Bereich zeigt neben der Pergament-Farbe
  // (`TRACK_COLORS`) eine zweite für die Tiefsee - dieselbe Zeigertechnik,
  // dasselbe Muster wie `--ok-on-sea`/`--bad-on-sea`.
  it('zeigt für jeden Bereich eine Tiefsee-Variante seiner Farbe', () => {
    for (const track of TRACK_IDS) {
      expect(TRACK_COLORS_ON_SEA[track]).toBe(`var(--track-${track}-on-sea)`);
    }
  });

  // Befund D (Aufgabe 11): die gebaute Handelsstufe steht auf Gold, einem
  // hellen Grund, und braucht dieselbe dunkle Tinte wie die ungebaute Stufe;
  // Politik und Wissenschaft bauen auf dunklen Farben und behalten die helle.
  it('gibt der gebauten Handelsstufe dunkle Tinte, Politik und Wissenschaft die helle', () => {
    expect(TRACK_BUILT_WORD_COLORS.trade).toBe('var(--ink)');
    expect(TRACK_BUILT_WORD_COLORS.politics).toBe('var(--on-sea)');
    expect(TRACK_BUILT_WORD_COLORS.science).toBe('var(--on-sea)');
  });
});
