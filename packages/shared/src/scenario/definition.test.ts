import { describe, expect, it } from 'vitest';

import { ScenarioDefinitionSchema, type ScenarioDefinition } from './definition.js';
import { HarborSchema } from './harbor.js';
import { TERRAIN_IDS, TERRAIN_YIELD, terrainYield } from './terrain.js';

/**
 * Drei paarweise benachbarte Felder - klein genug zum Lesen, gross genug fuer
 * alle Faelle, die das Schema pruefen soll.
 */
function validScenario(): ScenarioDefinition {
  return {
    id: 'test',
    name: 'Testbrett',
    hexes: [
      { hex: '0,0', terrain: 'desert' },
      { hex: '1,0', terrain: 'forest', chip: 5 },
      { hex: '0,1', terrain: 'hills', chip: 8 },
    ],
    harbors: [{ edge: 'e:-1,0|0,0', ratio: 3 }],
    robberStart: '0,0',
  };
}

describe('terrain', () => {
  it('kennt genau die sechs Gelaendearten', () => {
    expect([...TERRAIN_IDS].sort()).toEqual([
      'desert',
      'fields',
      'forest',
      'hills',
      'mountains',
      'pasture',
    ]);
  });

  it('ordnet jedem Gelaende ausser der Wueste genau eine Ressource zu', () => {
    const yields = TERRAIN_IDS.map(terrainYield).filter((resource) => resource !== null);

    expect(new Set(yields).size).toBe(5);
    expect(terrainYield('desert')).toBeNull();
    expect(terrainYield('forest')).toBe('lumber');
    expect(terrainYield('mountains')).toBe('ore');
  });

  it('haelt Zuordnungstabelle und Funktion deckungsgleich', () => {
    for (const terrain of TERRAIN_IDS) {
      expect(terrainYield(terrain)).toBe(TERRAIN_YIELD[terrain]);
    }
  });
});

describe('HarborSchema', () => {
  it('nimmt einen 3:1-Hafen ohne Ressource an', () => {
    expect(HarborSchema.safeParse({ edge: 'e:0,0|1,0', ratio: 3 }).success).toBe(true);
  });

  it('nimmt einen 2:1-Hafen mit Ressource an', () => {
    expect(HarborSchema.safeParse({ edge: 'e:0,0|1,0', ratio: 2, resource: 'ore' }).success).toBe(
      true,
    );
  });

  it('lehnt einen 2:1-Hafen ohne Ressource ab', () => {
    expect(HarborSchema.safeParse({ edge: 'e:0,0|1,0', ratio: 2 }).success).toBe(false);
  });

  it('lehnt einen 3:1-Hafen mit Ressource ab', () => {
    expect(HarborSchema.safeParse({ edge: 'e:0,0|1,0', ratio: 3, resource: 'ore' }).success).toBe(
      false,
    );
  });

  it('lehnt ein unbekanntes Tauschverhaeltnis ab', () => {
    expect(HarborSchema.safeParse({ edge: 'e:0,0|1,0', ratio: 4, resource: 'ore' }).success).toBe(
      false,
    );
  });

  it('lehnt eine Kanten-Id ab, die nicht kanonisch ist', () => {
    expect(HarborSchema.safeParse({ edge: 'e:1,0|0,0', ratio: 3 }).success).toBe(false);
    expect(HarborSchema.safeParse({ edge: 'v:0,0|1,-1|1,0', ratio: 3 }).success).toBe(false);
    expect(HarborSchema.safeParse({ edge: 'e:0,0|5,0', ratio: 3 }).success).toBe(false);
  });

  it('lehnt eine unbekannte Ressource ab', () => {
    expect(HarborSchema.safeParse({ edge: 'e:0,0|1,0', ratio: 2, resource: 'gold' }).success).toBe(
      false,
    );
  });
});

describe('ScenarioDefinitionSchema', () => {
  it('nimmt ein gueltiges Szenario an', () => {
    const result = ScenarioDefinitionSchema.safeParse(validScenario());
    expect(result.success).toBe(true);
  });

  it('lehnt doppelte Felder ab', () => {
    const scenario = validScenario();
    scenario.hexes = [...scenario.hexes, { hex: '1,0', terrain: 'fields', chip: 9 }];

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt unbekanntes Gelaende ab', () => {
    const scenario = { ...validScenario(), hexes: [{ hex: '0,0', terrain: 'swamp', chip: 5 }] };

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt einen Zahlenchip auf der Wueste ab', () => {
    const scenario = validScenario();
    scenario.hexes = [{ hex: '0,0', terrain: 'desert', chip: 6 }, ...scenario.hexes.slice(1)];

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt ertragreiches Gelaende ohne Zahlenchip ab', () => {
    const scenario = validScenario();
    scenario.hexes = [scenario.hexes[0]!, { hex: '1,0', terrain: 'forest' }, scenario.hexes[2]!];

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt die Sieben als Zahlenchip ab', () => {
    const scenario = validScenario();
    scenario.hexes = [
      scenario.hexes[0]!,
      { hex: '1,0', terrain: 'forest', chip: 7 },
      scenario.hexes[2]!,
    ];

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt Zahlenchips ausserhalb von 2 bis 12 ab', () => {
    for (const chip of [1, 13, 0, -2, 5.5]) {
      const scenario = validScenario();
      scenario.hexes = [
        scenario.hexes[0]!,
        { hex: '1,0', terrain: 'forest', chip },
        scenario.hexes[2]!,
      ];

      expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
    }
  });

  it('lehnt einen Raeuberstart neben dem Brett ab', () => {
    const scenario = { ...validScenario(), robberStart: '9,9' };

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('erlaubt den Raeuberstart auf jedem Feld des Bretts, nicht nur auf der Wueste', () => {
    // Ein Szenario mit zwei Wuesten oder mit Raeuberstart woanders ist damit
    // kein Sonderfall, sondern nur andere Daten.
    const scenario = { ...validScenario(), robberStart: '1,0' };

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true);
  });

  it('lehnt einen Hafen im Inneren des Bretts ab', () => {
    const scenario = validScenario();
    scenario.harbors = [{ edge: 'e:0,0|1,0', ratio: 3 }];

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt einen Hafen ohne Bezug zum Brett ab', () => {
    const scenario = validScenario();
    scenario.harbors = [{ edge: 'e:8,0|9,0', ratio: 3 }];

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt zwei Haefen auf derselben Kante ab', () => {
    const scenario = validScenario();
    scenario.harbors = [
      { edge: 'e:-1,0|0,0', ratio: 3 },
      { edge: 'e:-1,0|0,0', ratio: 2, resource: 'ore' },
    ];

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt ein Brett ab, das in mehrere Teile zerfaellt', () => {
    const scenario = validScenario();
    scenario.hexes = [...scenario.hexes, { hex: '9,0', terrain: 'fields', chip: 4 }];

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('lehnt ein Szenario ohne Felder ab', () => {
    const scenario = { ...validScenario(), hexes: [], robberStart: '0,0' };

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false);
  });

  it('nennt bei jedem Verstoss einen Pfad, damit der Fehler auffindbar bleibt', () => {
    const scenario = validScenario();
    scenario.hexes = [{ hex: '0,0', terrain: 'desert', chip: 6 }, ...scenario.hexes.slice(1)];

    const result = ScenarioDefinitionSchema.safeParse(scenario);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path.length).toBeGreaterThan(0);
    }
  });
});
