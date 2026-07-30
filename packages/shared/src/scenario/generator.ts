import {
  buildBoardTopology,
  coastalEdgeRing,
  hexDistance,
  hexNeighbors,
  hexRowLayout,
  hexSpiral,
  hexToId,
  type BoardTopology,
  type Hex,
  type HexId,
} from '../geometry/index.js';
import { createRng, shuffle, type Rng } from '../random/index.js';
import {
  ScenarioDefinitionSchema,
  type HexPlacement,
  type ScenarioDefinition,
} from './definition.js';
import { checkFairness, type FairnessRules } from './fairness.js';
import type { HarborDefinition } from './harbor.js';
import {
  TERRAIN_IDS,
  chipPips,
  producesResource,
  type ResourceId,
  type TerrainId,
} from './terrain.js';

/**
 * Erzeugt aus einem Blueprint und einem Seed ein fertiges Szenario.
 *
 * Der Blueprint sagt, *woraus* ein Brett besteht (Layout, Gelaendeanzahlen,
 * Chipvorrat, Hafenplaetze, Fairnessschwellen); der Seed sagt, *wie* es diesmal
 * ausfaellt. Beides zusammen bestimmt das Ergebnis vollstaendig - derselbe Seed
 * liefert bis aufs Feld dasselbe Brett, in Node wie im Browser. Genau das
 * braucht Etappe 5: der Server schickt einen Seed, nicht 19 Felder.
 *
 * ## Warum die Chips nicht einfach gemischt werden
 *
 * Nachgemessen an je 2000 rein gemischten Brettern verletzen 98,7 % (19 Felder)
 * beziehungsweise 100,0 % (30 Felder) mindestens eine der vier
 * Fairnessbedingungen - allein "keine zwei gleichen Zahlen nebeneinander"
 * scheitert in 90,3 % beziehungsweise 99,2 % der Faelle. Mischen und Verwerfen
 * kann diese Bedingungen also nicht erfuellen; beim grossen Brett wuerde es nie
 * ein Ergebnis liefern, sondern immer nur die Lockerungsstufen durchlaufen.
 *
 * Die Chips werden deshalb **konstruktiv** vergeben: in Spiralreihenfolge, an
 * jedem Feld nur aus den Chips, die mit den bereits gelegten Nachbarn
 * vertraeglich sind, mit Rueckschritt, wenn eine Vergabe in die Sackgasse
 * fuehrt. Zufaellig bleibt es trotzdem - die Reihenfolge, in der die
 * verbleibenden Chips durchprobiert werden, kommt aus dem gemischten Vorrat und
 * damit aus dem Seed.
 *
 * Rejection Sampling bleibt als aeussere Schleife: es verteilt das Gelaende
 * (dort reicht es - 78 % beziehungsweise 44 % Annahmequote) und faengt den
 * Fall, dass der Rueckschritt sein Schrittbudget aufbraucht. `checkFairness`
 * prueft das fertige Brett am Ende noch einmal unabhaengig; der Solver ist
 * damit nie die einzige Instanz, die ueber Fairness urteilt.
 */

/** Ein Hafenplatz ohne Ort - der Ort kommt aus dem Kuestenring. */
export type HarborType =
  { readonly ratio: 2; readonly resource: ResourceId } | { readonly ratio: 3 };

/**
 * Eine Stufe des Rejection Sampling.
 *
 * Erst wird mit den strengen Regeln gebaut; erst wenn das nach `maxAttempts`
 * Anlaeufen nicht aufgeht, uebernimmt die naechste, lockerere Stufe.
 * Stufenweise lockern statt endlos schleifen oder werfen - und weil jede Stufe
 * im Blueprint steht, steht keine Schwelle im Code.
 */
export interface FairnessStage {
  readonly rules: FairnessRules;
  readonly maxAttempts: number;
}

export interface ScenarioBlueprint {
  /** Stabiler Bezeichner, wandert in die `ScenarioDefinition`. */
  readonly id: string;
  readonly name: string;
  /** Feldzahl je Reihe, etwa `[3, 4, 5, 4, 3]`. */
  readonly rows: readonly number[];
  /** Wie viele Felder je Gelaendeart. Summe muss die Feldzahl treffen. */
  readonly terrainCounts: Readonly<Record<TerrainId, number>>;
  /** Der Chipvorrat. Anzahl muss die Zahl der Ertragsfelder treffen. */
  readonly chips: readonly number[];
  /**
   * Abstaende zwischen aufeinanderfolgenden Haefen entlang des Kuestenrings,
   * ein Eintrag je Hafen. Die Summe muss den Ring genau schliessen.
   */
  readonly harborSpacing: readonly number[];
  /** Wo der erste Hafen auf dem Kuestenring sitzt. */
  readonly harborStart: number;
  /** Die Hafenarten. Werden auf die Plaetze gemischt, die Plaetze bleiben fest. */
  readonly harborTypes: readonly HarborType[];
  /** Von streng nach locker. Die letzte Stufe sollte alles annehmen. */
  readonly fairness: readonly FairnessStage[];
}

/** Chips, die als ertragsstark gelten - dieselbe Festlegung wie in `fairness.ts`. */
const HIGH_CHIPS: readonly number[] = [6, 8];

/**
 * Obergrenze fuer die Rueckschritte eines Anlaufs.
 *
 * Verhindert, dass ein ungluecklich gemischter Vorrat den Solver in eine lange
 * Suche schickt. Ist das Budget aufgebraucht, mischt die aeussere Schleife neu -
 * billiger, als die Sackgasse auszuloten.
 */
const MAX_SOLVER_STEPS = 20_000;

/** Baut aus den Anzahlen den Beutel, aus dem gezogen wird. */
function terrainBag(counts: Readonly<Record<TerrainId, number>>): TerrainId[] {
  const bag: TerrainId[] = [];
  for (const terrain of TERRAIN_IDS) {
    for (let i = 0; i < counts[terrain]; i += 1) bag.push(terrain);
  }
  return bag;
}

/**
 * Die Felder von innen nach aussen.
 *
 * Gelaende und Zahlenchips werden in dieser Reihenfolge aufgelegt - die
 * uebliche Spiralreihenfolge des Brettspiels. Fuer den Solver ist sie mehr als
 * Konvention: sie sorgt dafuer, dass jedes neu belegte Feld seine bereits
 * belegten Nachbarn schon kennt, statt Loecher zu hinterlassen, die erst spaeter
 * auffallen.
 */
function spiralOrder(hexes: readonly Hex[]): Hex[] {
  const origin: Hex = { q: 0, r: 0 };
  const radius = hexes.reduce((max, hex) => Math.max(max, hexDistance(origin, hex)), 0);
  const onBoard = new Set(hexes.map(hexToId));

  return hexSpiral(origin, radius).filter((hex) => onBoard.has(hexToId(hex)));
}

/**
 * Vorberechnete Nachbarschaften in Spiralindizes.
 *
 * `neighbors[k]` sind die Felder vor `k`, die an `k` angrenzen;
 * `verticesClosingAt[k]` sind die Siedlungsplaetze, deren letztes Feld `k` ist -
 * genau dort laesst sich ihre Augensumme zum ersten Mal abschliessend pruefen.
 */
interface SolverIndex {
  readonly earlierNeighbors: readonly (readonly number[])[];
  readonly verticesClosingAt: readonly (readonly (readonly number[])[])[];
}

function buildSolverIndex(order: readonly Hex[], topology: BoardTopology): SolverIndex {
  const indexOf = new Map<HexId, number>();
  order.forEach((hex, index) => indexOf.set(hexToId(hex), index));

  const earlierNeighbors = order.map((hex, index) =>
    hexNeighbors(hex)
      .map((neighbour) => indexOf.get(hexToId(neighbour)))
      .filter((candidate): candidate is number => candidate !== undefined && candidate < index),
  );

  const verticesClosingAt: number[][][] = order.map(() => []);
  for (const vertex of topology.vertices) {
    const around = topology.vertexHexes.get(vertex) ?? [];
    if (around.length < 3) continue;

    const indices = around
      .map((id) => indexOf.get(id))
      .filter((candidate): candidate is number => candidate !== undefined);
    if (indices.length < 3) continue;

    verticesClosingAt[Math.max(...indices)]!.push(indices);
  }

  return { earlierNeighbors, verticesClosingAt };
}

/**
 * Vergibt die Zahlenchips in Spiralreihenfolge mit Rueckschritt.
 *
 * Liefert je Spiralindex den Chip oder `undefined` fuer ein Feld ohne Ertrag -
 * oder `undefined` als Ganzes, wenn das Schrittbudget aufgebraucht ist.
 */
function solveChips(
  terrains: readonly TerrainId[],
  chips: readonly number[],
  index: SolverIndex,
  rules: FairnessRules,
): (number | undefined)[] | undefined {
  const assigned = new Array<number | undefined>(terrains.length).fill(undefined);
  const used = new Array<boolean>(chips.length).fill(false);
  let steps = 0;

  /** Vertraeglich mit den bereits gelegten Nachbarfeldern? */
  function fitsNeighbors(position: number, chip: number): boolean {
    for (const neighbour of index.earlierNeighbors[position]!) {
      const other = assigned[neighbour];
      if (other === undefined) continue;

      if (rules.forbidAdjacentEqualChips && other === chip) return false;
      if (
        rules.forbidAdjacentHighChips &&
        HIGH_CHIPS.includes(chip) &&
        HIGH_CHIPS.includes(other)
      ) {
        return false;
      }
    }
    return true;
  }

  /** Liegen die Siedlungsplaetze, die hier vollstaendig werden, im Band? */
  function fitsVertices(position: number): boolean {
    for (const vertex of index.verticesClosingAt[position]!) {
      let pips = 0;
      for (const hexIndex of vertex) pips += chipPips(assigned[hexIndex]);
      if (pips < rules.minVertexPips || pips > rules.maxVertexPips) return false;
    }
    return true;
  }

  function solve(position: number): boolean {
    if (position === terrains.length) return true;

    steps += 1;
    if (steps > MAX_SOLVER_STEPS) return false;

    if (!producesResource(terrains[position]!)) {
      return fitsVertices(position) && solve(position + 1);
    }

    // Gleiche Zahlen sind austauschbar: es genuegt, jeden *Wert* einmal zu
    // probieren. Ohne das durchsucht der Rueckschritt Permutationen
    // identischer Chips und laeuft ins Budget statt in eine Loesung.
    const triedValues = new Set<number>();

    for (let i = 0; i < chips.length; i += 1) {
      if (used[i]) continue;

      const chip = chips[i]!;
      if (triedValues.has(chip)) continue;
      triedValues.add(chip);

      if (!fitsNeighbors(position, chip)) continue;

      used[i] = true;
      assigned[position] = chip;

      if (fitsVertices(position) && solve(position + 1)) return true;

      used[i] = false;
      assigned[position] = undefined;
    }

    return false;
  }

  return solve(0) ? assigned : undefined;
}

/** Prueft, dass Blueprint und Layout ueberhaupt zusammenpassen. */
function assertBlueprintFits(
  blueprint: ScenarioBlueprint,
  hexCount: number,
  yieldingCount: number,
  coastLength: number,
): void {
  const terrainTotal = TERRAIN_IDS.reduce(
    (sum, terrain) => sum + blueprint.terrainCounts[terrain],
    0,
  );

  if (terrainTotal !== hexCount) {
    throw new RangeError(
      `${blueprint.id}: ${terrainTotal} Gelaendeplaettchen fuer ${hexCount} Felder`,
    );
  }
  if (blueprint.chips.length !== yieldingCount) {
    throw new RangeError(
      `${blueprint.id}: ${blueprint.chips.length} Zahlenchips fuer ${yieldingCount} Ertragsfelder`,
    );
  }
  if (blueprint.harborSpacing.length !== blueprint.harborTypes.length) {
    throw new RangeError(
      `${blueprint.id}: ${blueprint.harborSpacing.length} Hafenabstaende fuer ${blueprint.harborTypes.length} Haefen`,
    );
  }

  const spacingTotal = blueprint.harborSpacing.reduce((sum, gap) => sum + gap, 0);
  if (spacingTotal !== coastLength) {
    throw new RangeError(
      `${blueprint.id}: Die Hafenabstaende summieren sich auf ${spacingTotal}, die Kueste hat ${coastLength} Kanten`,
    );
  }
  if (blueprint.fairness.length === 0) {
    throw new RangeError(`${blueprint.id}: Mindestens eine Fairnessstufe erforderlich`);
  }
}

/** Verteilt die gemischten Hafenarten auf die festen Plaetze des Kuestenrings. */
function placeHarbors(
  blueprint: ScenarioBlueprint,
  ring: readonly string[],
  rng: Rng,
): readonly [harbors: HarborDefinition[], next: Rng] {
  const [types, next] = shuffle(blueprint.harborTypes, rng);

  const harbors: HarborDefinition[] = [];
  let position = blueprint.harborStart % ring.length;

  for (let i = 0; i < types.length; i += 1) {
    harbors.push({ edge: ring[position]!, ...types[i]! });
    position = (position + blueprint.harborSpacing[i]!) % ring.length;
  }

  return [harbors, next];
}

/** Das erste Wuestenfeld in Spiralreihenfolge - dort steht der Raeuber. */
function findRobberStart(placements: readonly HexPlacement[]): HexId {
  const desert = placements.find((placement) => placement.terrain === 'desert');
  // Ohne Wueste beginnt der Raeuber auf dem innersten Feld. Ein Szenario ohne
  // Wueste ist erlaubt - Regel 5 - und soll deshalb nicht daran scheitern.
  return desert?.hex ?? placements[0]!.hex;
}

export function generateScenario(blueprint: ScenarioBlueprint, seed: string): ScenarioDefinition {
  const hexes = hexRowLayout([...blueprint.rows]);
  const topology = buildBoardTopology(hexes);
  const ring = coastalEdgeRing(topology);

  const bag = terrainBag(blueprint.terrainCounts);
  const yieldingCount = bag.filter(producesResource).length;
  assertBlueprintFits(blueprint, hexes.length, yieldingCount, ring.length);

  const order = spiralOrder(hexes);
  const solverIndex = buildSolverIndex(order, topology);
  const hexIds = order.map(hexToId);

  let rng = createRng(seed);
  const [harbors, afterHarbors] = placeHarbors(blueprint, ring, rng);
  rng = afterHarbors;

  for (const stage of blueprint.fairness) {
    for (let attempt = 0; attempt < stage.maxAttempts; attempt += 1) {
      const [terrains, afterTerrain] = shuffle(bag, rng);
      const [chipSupply, afterChips] = shuffle(blueprint.chips, afterTerrain);
      rng = afterChips;

      const assigned = solveChips(terrains, chipSupply, solverIndex, stage.rules);
      if (assigned === undefined) continue;

      const placements: HexPlacement[] = hexIds.map((hex, position) => {
        const terrain = terrains[position]!;
        const chip = assigned[position];
        return chip === undefined ? { hex, terrain } : { hex, terrain, chip };
      });

      // Der Solver kennt nur die Bedingungen, die sich beim Legen pruefen
      // lassen. Die Gelaendecluster entstehen aus dem gemischten Beutel und
      // werden erst hier geprueft - und alles andere gleich mit, unabhaengig
      // vom Solver.
      if (checkFairness(placements, topology, stage.rules).length > 0) continue;

      // Das Ergebnis geht durch das eigene Schema. Ein Generatorfehler faellt
      // damit hier auf und nicht erst, wenn das Brett ueber das Netz geht.
      return ScenarioDefinitionSchema.parse({
        id: blueprint.id,
        name: blueprint.name,
        hexes: placements,
        harbors,
        robberStart: findRobberStart(placements),
      });
    }
  }

  throw new Error(
    `${blueprint.id}: Kein faires Brett zum Seed ${JSON.stringify(seed)} gefunden - die letzte Fairnessstufe ist zu streng`,
  );
}
