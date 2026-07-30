import type { ScenarioBlueprint } from '../generator.js';

/**
 * Die Erweiterung: 30 Felder im Layout 3-4-5-6-5-4-3, fuenf bis sechs Spieler.
 *
 * Da 3-4-5-6-5-4-3 kein regelmaessiges Sechseck ist, stehen Knoten- und
 * Kantenzahl nicht vorab fest; sie ergeben sich aus der Topologie (80 Knoten,
 * 109 Kanten, 38 Kuestenkanten) und werden im Test gegen die Eulersche Formel
 * geprueft statt gegen abgeschriebene Zahlen.
 *
 * Zwei Wuesten, 28 Zahlenchips: die 2 und die 12 je zweimal, alle Zahlen von 3
 * bis 11 ausser der 7 je dreimal.
 *
 * **Gegen die Schachtel zu pruefen:** sowohl die Zahl der Haefen als auch ihre
 * Positionen sind hier nicht belastbar bekannt. Angesetzt sind elf Haefen im
 * Abstandsmuster 3-4 (sechs Dreier, fuenf Vierer - die Summe schliesst den
 * 38er-Ring genau) mit derselben Artenmischung wie im Basisspiel plus zwei
 * weiteren 3:1-Haefen.
 */
export const CLASSIC_56: ScenarioBlueprint = {
  id: 'classic56',
  name: 'Erweiterung (5-6 Spieler)',
  rows: [3, 4, 5, 6, 5, 4, 3],
  minPlayers: 5,
  maxPlayers: 6,

  terrainCounts: {
    forest: 6,
    pasture: 6,
    fields: 6,
    hills: 5,
    mountains: 5,
    desert: 2,
  },

  chips: [
    2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12,
  ],

  harborStart: 0,
  harborSpacing: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3],
  harborTypes: [
    { ratio: 2, resource: 'brick' },
    { ratio: 2, resource: 'lumber' },
    { ratio: 2, resource: 'wool' },
    { ratio: 2, resource: 'grain' },
    { ratio: 2, resource: 'ore' },
    { ratio: 3 },
    { ratio: 3 },
    { ratio: 3 },
    { ratio: 3 },
    { ratio: 3 },
    { ratio: 3 },
  ],

  fairness: [
    {
      rules: {
        forbidAdjacentHighChips: true,
        forbidAdjacentEqualChips: true,
        maxTerrainClusterSize: 3,
        minVertexPips: 4,
        maxVertexPips: 14,
      },
      maxAttempts: 200,
    },
    {
      rules: {
        forbidAdjacentHighChips: true,
        forbidAdjacentEqualChips: false,
        maxTerrainClusterSize: 5,
        minVertexPips: 3,
        maxVertexPips: 15,
      },
      maxAttempts: 200,
    },
    {
      rules: {
        forbidAdjacentHighChips: false,
        forbidAdjacentEqualChips: false,
        maxTerrainClusterSize: 30,
        minVertexPips: 0,
        maxVertexPips: 999,
      },
      maxAttempts: 1,
    },
  ],
};
