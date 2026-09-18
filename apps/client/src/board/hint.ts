import {
  COMMODITY_LABELS,
  KNIGHT_LABELS,
  RESOURCE_LABELS,
  TERRAIN_LABELS,
  boardOf,
  harborLabel,
  hexFromId,
  terrainCommodity,
  terrainYield,
  type HexId,
  type PlayerId,
  type VertexId,
} from '@conquerist/shared';

import type { ActionTargets } from '../game/targets';
import type { Seat } from '../seats';
import type { BoardSource } from './BoardSvg';
import { HARBOR_MARK } from './harbor';
import { harborAnchor, hexCenter, vertexPoint, type Point } from './layout';
import { nearestTarget, targetPoints } from './pick';

/**
 * Was das Brett beim Darueberfahren erklaert.
 *
 * Das Brett spricht in Bildern: Farbe, Zahl, Augenreihe, Hafenmarke. Wer die
 * Bilder noch nicht lesen kann, fragt sich bei jeder Kreuzung, was sie bringt -
 * und rechnet die Augen im Kopf zusammen. Diese Auskunft rechnet dasselbe und
 * sagt es in Worten.
 *
 * Rein und ohne DOM, wie `pick.ts`: die Frage „was liegt unter dem Zeiger"
 * ist damit pruefbar, ohne einen Zeiger zu bewegen.
 */
export interface BoardHint {
  readonly title: string;
  readonly lines: readonly string[];
}

/** Augenwahrscheinlichkeit einer Zahl - in wie vielen von 36 Wuerfen sie faellt. */
export function chancesOf(chip: number): number {
  return 6 - Math.abs(7 - chip);
}

/** Wie nah eine Figur am Zeiger sein muss, in Umkreisradien. */
const PIECE_REACH = 0.28;

/** Ab welchem Abstand vom Mittelpunkt man nicht mehr auf einem Feld steht. */
const HEX_REACH = 0.87;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nameOf(seats: readonly Seat[], player: PlayerId): string {
  return seats.find((seat) => seat.id === player)?.name ?? player;
}

/** Eine Zeile je Nachbarfeld: „Holz auf der 11 - 2 von 36". */
function yieldLine(state: BoardSource, hex: HexId): string | null {
  const placement = state.scenario.hexes.find((entry) => entry.hex === hex);
  if (placement === undefined) return null;

  const resource = terrainYield(placement.terrain);
  if (resource === null || placement.chip === undefined)
    return `${TERRAIN_LABELS[placement.terrain]}: nichts`;

  const blocked = state.robber === hex ? ', Räuber steht darauf' : '';
  return `${RESOURCE_LABELS[resource]} auf der ${placement.chip}${blocked}`;
}

/** Was eine Kreuzung abwirft und ob sie an einem Hafen liegt. */
function vertexLines(state: BoardSource, vertex: VertexId): string[] {
  const board = boardOf(state.scenario);
  const hexes = board.topology.vertexHexes.get(vertex) ?? [];
  const lines = hexes.flatMap((hex) => yieldLine(state, hex) ?? []);

  const chances = hexes.reduce((sum, hex) => {
    const chip = state.scenario.hexes.find((entry) => entry.hex === hex)?.chip;
    return sum + (chip === undefined ? 0 : chancesOf(chip));
  }, 0);
  if (chances > 0) lines.push(`Ertrag in ${chances} von 36 Würfen`);

  const harbor = state.scenario.harbors.find((entry) =>
    (board.topology.edgeVertices.get(entry.edge) ?? []).includes(vertex),
  );
  if (harbor !== undefined) lines.push(`Hafen ${harborLabel(harbor)}`);

  return lines;
}

/**
 * Welche Sonderregeln die Partie kennt. In Staedte & Ritter bekommt eine Stadt
 * an Wald, Weide und Gebirge statt der zweiten Karte eine Handelsware - das
 * steht auf keinem Feld, und genau danach fragt man beim Ausbauen.
 */
export interface HintRules {
  readonly commodities: boolean;
}

const BASE: HintRules = { commodities: false };

function hexHint(
  state: BoardSource,
  seats: readonly Seat[],
  hex: HexId,
  rules: HintRules,
): BoardHint | null {
  const placement = state.scenario.hexes.find((entry) => entry.hex === hex);
  if (placement === undefined) return null;

  const resource = terrainYield(placement.terrain);
  const terrain = TERRAIN_LABELS[placement.terrain];
  const lines: string[] = [];

  if (resource === null || placement.chip === undefined) {
    lines.push('Wirft nichts ab.');
  } else {
    const chances = chancesOf(placement.chip);
    lines.push(
      `Bei einer ${placement.chip} gibt es ${RESOURCE_LABELS[resource]} - in ${chances} von 36 Würfen.`,
    );
  }

  if (rules.commodities && resource !== null) {
    const commodity = terrainCommodity(placement.terrain);
    lines.push(
      commodity === null
        ? `Eine Stadt bekommt 2 ${RESOURCE_LABELS[resource]}.`
        : `Eine Stadt bekommt 1 ${RESOURCE_LABELS[resource]} und 1 ${COMMODITY_LABELS[commodity]}.`,
    );
  }

  if (state.robber === hex) lines.push('Der Räuber steht hier: das Feld wirft nichts ab.');

  const board = boardOf(state.scenario);
  const owners = new Set<string>();
  for (const [vertex, hexes] of board.topology.vertexHexes) {
    if (!hexes.includes(hex)) continue;
    const building = state.buildings[vertex];
    if (building !== undefined) owners.add(nameOf(seats, building.owner));
  }
  if (owners.size > 0) lines.push(`Bauwerke hier: ${[...owners].join(', ')}`);

  return {
    title: resource === null ? terrain : `${terrain} - ${RESOURCE_LABELS[resource]}`,
    lines,
  };
}

/**
 * Die Auskunft zu einem Punkt auf dem Brett, in viewBox-Koordinaten.
 *
 * Die Reihenfolge ist die der Aufmerksamkeit: ein erlaubtes Ziel zuerst (dort
 * wird gerade entschieden), dann Hafen, Figur und zuletzt das Feld darunter.
 */
export function boardHintAt(
  point: Point,
  state: BoardSource,
  targets: ActionTargets,
  seats: readonly Seat[],
  rules: HintRules = BASE,
): BoardHint | null {
  const target = nearestTarget(point, targetPoints(targets));
  if (target?.kind === 'vertex') {
    return { title: 'Hier bauen', lines: vertexLines(state, target.id) };
  }
  if (target?.kind === 'hex') {
    const hint = hexHint(state, seats, target.id, rules);
    if (hint !== null) return { ...hint, lines: [...hint.lines, 'Klicken: Räuber hierhin'] };
  }

  const board = boardOf(state.scenario);
  const onBoard = new Set(board.topology.hexes);
  for (const harbor of state.scenario.harbors) {
    if (distance(point, harborAnchor(harbor.edge, onBoard)) > HARBOR_MARK) continue;

    return {
      title: `Hafen ${harborLabel(harbor)}`,
      lines: [
        harbor.resource === undefined
          ? `Tausche ${harbor.ratio} gleiche Karten gegen 1 beliebige.`
          : `Tausche ${harbor.ratio} ${RESOURCE_LABELS[harbor.resource]} gegen 1 beliebige Karte.`,
        'Gilt für dich, sobald du an einem der beiden Stege baust.',
      ],
    };
  }

  for (const vertex of board.topology.vertices) {
    if (distance(point, vertexPoint(vertex)) > PIECE_REACH) continue;

    const building = state.buildings[vertex];
    const knight = state.knights[vertex];
    if (building === undefined && knight === undefined) continue;

    if (building !== undefined) {
      const kind = building.kind === 'city' ? 'Stadt' : 'Siedlung';
      const extras = [
        building.wall ? 'mit Stadtmauer' : null,
        building.metropolis !== null ? 'Metropole' : null,
      ].filter((extra) => extra !== null);
      return {
        title: `${kind} von ${nameOf(seats, building.owner)}`,
        lines: [
          building.kind === 'city' ? '2 Karten je passendem Wurf' : '1 Karte je passendem Wurf',
          ...extras,
          ...vertexLines(state, vertex),
        ],
      };
    }

    if (knight !== undefined) {
      return {
        title: `${KNIGHT_LABELS[knight.level]} von ${nameOf(seats, knight.owner)}`,
        lines: [
          `Stärke ${knight.level}`,
          knight.active
            ? 'Aktiviert: zählt gegen die Barbaren und kann handeln'
            : 'Passiv: zählt erst nach dem Aktivieren (1 Korn)',
        ],
      };
    }
  }

  let closest: { hex: HexId; away: number } | null = null;
  for (const hex of board.topology.hexes) {
    const away = distance(point, hexCenter(hexFromId(hex)));
    if (away <= HEX_REACH && (closest === null || away < closest.away)) closest = { hex, away };
  }

  return closest === null ? null : hexHint(state, seats, closest.hex, rules);
}
