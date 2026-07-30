import type { ScenarioBlueprint } from '../generator.js';

/**
 * Das Basisspiel: 19 Felder im Layout 3-4-5-4-3, drei bis vier Spieler.
 *
 * Alles hier sind Daten. Wer eine Variante will, kopiert die Datei und aendert
 * Zahlen - im Generator ist dafuer nichts anzufassen.
 *
 * Haefen: neun Stueck, gleichmaessig ueber die 30 Kuestenkanten verteilt
 * (Abstandsmuster 3-3-4, dreimal - das schliesst den Ring genau).
 * **Gegen die Schachtel zu pruefen:** die genauen Hafenpositionen des
 * Originalbretts liegen hier nicht belastbar vor. Die Anordnung ist bewusst
 * symmetrisch gewaehlt und spielbar; eine Korrektur ist ein Zahlentausch in
 * dieser Datei und kein Umbau.
 */
export const CLASSIC_34: ScenarioBlueprint = {
  id: 'classic34',
  name: 'Basisspiel (3-4 Spieler)',
  rows: [3, 4, 5, 4, 3],

  terrainCounts: {
    forest: 4,
    pasture: 4,
    fields: 4,
    hills: 3,
    mountains: 3,
    desert: 1,
  },

  chips: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],

  harborStart: 0,
  harborSpacing: [3, 3, 4, 3, 3, 4, 3, 3, 4],
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
  ],

  fairness: [
    {
      // Die Stufe, die praktisch immer greift.
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
      // Erste Lockerung: gleiche Zahlen duerfen sich beruehren, das Pip-Band
      // wird breiter. Die 6/8-Regel bleibt - sie ist die spielentscheidende.
      rules: {
        forbidAdjacentHighChips: true,
        forbidAdjacentEqualChips: false,
        maxTerrainClusterSize: 4,
        minVertexPips: 3,
        maxVertexPips: 15,
      },
      maxAttempts: 200,
    },
    {
      // Auffangstufe: nimmt jedes Brett an. Damit endet `generateScenario`
      // garantiert mit einem Ergebnis statt mit einer Ausnahme.
      rules: {
        forbidAdjacentHighChips: false,
        forbidAdjacentEqualChips: false,
        maxTerrainClusterSize: 19,
        minVertexPips: 0,
        maxVertexPips: 999,
      },
      maxAttempts: 1,
    },
  ],
};
