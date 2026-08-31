import {
  buildBoardTopology,
  edgeVertices,
  hexFromId,
  type BoardTopology,
  type HexId,
  type VertexId,
} from '../geometry/index.js';
import type { HarborDefinition, HexPlacement, ScenarioDefinition } from '../scenario/index.js';

/**
 * Alles, was sich aus einem Szenario ableiten laesst und beim Spielen staendig
 * gebraucht wird.
 *
 * Der Reducer fragt bei jeder Aktion nach der Topologie. Sie jedes Mal neu
 * abzuleiten waere Verschwendung; sie in den `GameState` zu legen waere eine
 * zweite Wahrheit, die von den Feldern abweichen kann. Deshalb: gemerkt, nicht
 * gespeichert. `boardOf` ist von aussen eine reine Funktion - gleiches Szenario,
 * gleiches Ergebnis -, innen liegt ein Zwischenspeicher.
 */
export interface GameBoard {
  readonly topology: BoardTopology;
  /** Feld-Id -> Gelaende und Zahlenchip. */
  readonly hexes: ReadonlyMap<HexId, HexPlacement>;
  /** Zahlenchip -> die Felder, die bei diesem Wurf liefern. */
  readonly hexesByChip: ReadonlyMap<number, readonly HexId[]>;
  /** Knoten-Id -> die Haefen, die von diesem Siedlungsplatz aus nutzbar sind. */
  readonly harborsAtVertex: ReadonlyMap<VertexId, readonly HarborDefinition[]>;
}

/**
 * Zwischenspeicher ueber die Identitaet des Szenarios.
 *
 * `WeakMap`, damit ein beendetes Spiel sein Brett nicht am Leben haelt. Wird
 * ein Zustand aus JSON gelesen, entsteht ein neues Szenario-Objekt und damit
 * ein neuer Eintrag - richtig so, denn es koennte ein anderes Brett sein.
 */
const cache = new WeakMap<ScenarioDefinition, GameBoard>();

function derive(scenario: ScenarioDefinition): GameBoard {
  const topology = buildBoardTopology(scenario.hexes.map((placement) => hexFromId(placement.hex)));

  const hexes = new Map<HexId, HexPlacement>();
  const hexesByChip = new Map<number, HexId[]>();

  for (const placement of scenario.hexes) {
    hexes.set(placement.hex, placement);

    if (placement.chip === undefined) continue;
    const bucket = hexesByChip.get(placement.chip);
    if (bucket === undefined) hexesByChip.set(placement.chip, [placement.hex]);
    else bucket.push(placement.hex);
  }

  const harborsAtVertex = new Map<VertexId, HarborDefinition[]>();
  for (const harbor of scenario.harbors) {
    // Beide Endknoten der Hafenkante duerfen den Hafen nutzen - wer dort
    // siedelt, hat Zugang. Das ist ableitbar und steht deshalb nicht im
    // Szenario.
    for (const vertex of edgeVertices(harbor.edge)) {
      const bucket = harborsAtVertex.get(vertex);
      if (bucket === undefined) harborsAtVertex.set(vertex, [harbor]);
      else bucket.push(harbor);
    }
  }

  return { topology, hexes, hexesByChip, harborsAtVertex };
}

/** Das abgeleitete Brett zu einem Szenario. */
export function boardOf(scenario: ScenarioDefinition): GameBoard {
  const known = cache.get(scenario);
  if (known !== undefined) return known;

  const board = derive(scenario);
  cache.set(scenario, board);
  return board;
}

/**
 * Die vier Zahlen, die festliegen - der Erfinder fasst sie nicht an.
 *
 * 2 und 12 sind die seltensten, 6 und 8 die haeufigsten Zahlen des Bretts. Sie
 * zu verschieben veraenderte nicht einen einzelnen Ertrag, sondern die
 * Verteilung, auf der die ganze Brettbewertung steht - die Anleitung
 * (Abschnitt 11.1) nennt sie deshalb ausdruecklich.
 */
export const FIXED_CHIPS: readonly number[] = [2, 12, 6, 8];

/** Der Zahlenchip eines Felds. `undefined` heisst: keiner - die Wueste traegt keinen. */
export function chipAt(scenario: ScenarioDefinition, hex: HexId): number | undefined {
  return scenario.hexes.find((placement) => placement.hex === hex)?.chip;
}

/**
 * Ob dieses Feld einen Zahlenchip traegt, den der Erfinder tauschen darf.
 *
 * Ein Feld ohne Chip faellt hier ebenso durch wie eines der vier festen
 * Zahlen: beides ergaebe keinen Tausch.
 */
export function chipIsSwappable(scenario: ScenarioDefinition, hex: HexId): boolean {
  const chip = chipAt(scenario, hex);
  return chip !== undefined && !FIXED_CHIPS.includes(chip);
}

/**
 * Vertauscht die Zahlenchips zweier Felder und gibt das neue Szenario zurueck.
 *
 * Ein **neues** Szenario und keine Aenderung am alten: `boardOf` merkt sich
 * das abgeleitete Brett an der Identitaet des Szenario-Objekts. Wer die Felder
 * an Ort und Stelle veraenderte, behielte `hexesByChip` von vorher - und die
 * Ertraege folgten weiter den alten Zahlen, waehrend das Brett neue zeigte.
 *
 * Geprueft wird hier nichts; das tut `chipIsSwappable` beim Aufrufer.
 */
export function swapChips(scenario: ScenarioDefinition, a: HexId, b: HexId): ScenarioDefinition {
  const first = chipAt(scenario, a);
  const second = chipAt(scenario, b);

  return {
    ...scenario,
    hexes: scenario.hexes.map((placement) => {
      if (placement.hex === a) return { ...placement, chip: second };
      if (placement.hex === b) return { ...placement, chip: first };
      return placement;
    }),
  };
}
