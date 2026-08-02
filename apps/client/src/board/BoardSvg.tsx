import type { JSX } from 'react';
import {
  boardOf,
  hexFromId,
  type GameState,
  type PlayerId,
  type VertexId,
} from '@conquerist/shared';
import { seatsById, type Seat } from '../seats';
import { RESOURCE_COLORS, TERRAIN_COLORS, harborLabel } from '../game/labels';
import type { ActionTargets } from '../game/targets';
import { edgeMidpoint, edgeSegment, hexCenter, hexCorners, vertexPoint, viewBoxOf } from './layout';

/**
 * Das Brett. Zeichnet den Zustand und meldet, wo geklickt wurde - mehr nicht.
 *
 * Es kennt keine Regel und keine Aktion: ein Feld kann mehrere Raeuberziele
 * tragen (je moeglichem Opfer eines), und diese Auswahl ist eine Dialogfrage.
 * Deshalb `onPick` mit einem Ort statt `onAction` mit einem Zug.
 */
export interface Place {
  readonly kind: 'vertex' | 'edge' | 'hex';
  readonly id: string;
}

/**
 * Was das Brett zum Zeichnen braucht - und nicht mehr.
 *
 * Genau diese vier Felder, keine Handkarten und kein Zufall. Sowohl ein
 * `GameState` als auch eine `PlayerView` erfuellen das, und damit zeichnet
 * dieselbe Komponente die Vorschau auf dem Startbildschirm, die lokale Partie
 * und die Online-Partie.
 */
export interface BoardSource {
  readonly scenario: GameState['scenario'];
  readonly buildings: GameState['buildings'];
  readonly roads: GameState['roads'];
  readonly robber: GameState['robber'];
}

export interface BoardSvgProps {
  readonly state: BoardSource;
  readonly targets: ActionTargets;
  readonly seats: readonly Seat[];
  readonly onPick: (place: Place) => void;
}

/** Wie viel Luft um das Brett bleibt, in Umkreisradien. */
const PADDING = 0.6;

/** Augenwahrscheinlichkeit eines Chips - fuer die Punktreihe unter der Zahl. */
const PIPS: Readonly<Record<number, number>> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

export function BoardSvg({ state, targets, seats, onPick }: BoardSvgProps): JSX.Element {
  const board = boardOf(state.scenario);
  const colors = seatsById(seats);
  const colorOf = (player: PlayerId): string => colors.get(player)?.color ?? '#8b93a3';
  const robber = hexCenter(hexFromId(state.robber));

  return (
    <svg
      className="board"
      viewBox={viewBoxOf(board.topology.hexes, PADDING)}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Spielbrett"
    >
      {state.scenario.hexes.map((placement) => {
        const hex = hexFromId(placement.hex);
        const center = hexCenter(hex);
        const points = hexCorners(hex)
          .map((corner) => `${corner.x},${corner.y}`)
          .join(' ');
        const isTarget = targets.hexes.has(placement.hex);

        return (
          <g key={placement.hex}>
            <polygon
              data-testid={`hex-${placement.hex}`}
              data-target={isTarget ? 'true' : 'false'}
              className={isTarget ? 'hex hex--target' : 'hex'}
              points={points}
              fill={TERRAIN_COLORS[placement.terrain]}
              onClick={isTarget ? () => onPick({ kind: 'hex', id: placement.hex }) : undefined}
            />
            {placement.chip === undefined ? null : (
              <g className="chip" pointerEvents="none">
                <circle cx={center.x} cy={center.y} r={0.34} />
                <text
                  x={center.x}
                  y={center.y}
                  className={placement.chip === 6 || placement.chip === 8 ? 'chip__hot' : undefined}
                >
                  {placement.chip}
                </text>
                <text x={center.x} y={center.y + 0.24} className="chip__pips">
                  {'·'.repeat(PIPS[placement.chip] ?? 0)}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/*
       * Haefen als Marke auf der Kuestenkante: der Ring traegt die Farbe der
       * Ressource, in der Mitte steht nur das Verhaeltnis. Der ausgeschriebene
       * Name („2:1 Erz") passt bei dieser Groesse nicht lesbar aufs Brett und
       * steht deshalb im `title` - sichtbar beim Zeigen, vorhanden fuer
       * Vorlesewerkzeuge.
       */}
      {state.scenario.harbors.map((harbor) => {
        const middle = edgeMidpoint(harbor.edge);
        const ring = harbor.resource === undefined ? '#16202a' : RESOURCE_COLORS[harbor.resource];

        return (
          <g
            key={harbor.edge}
            className="harbor"
            pointerEvents="none"
            data-testid={`harbor-${harbor.edge}`}
          >
            <title>{harborLabel(harbor)}</title>
            <circle cx={middle.x} cy={middle.y} r={0.23} style={{ stroke: ring }} />
            <text x={middle.x} y={middle.y}>
              {harbor.ratio}:1
            </text>
          </g>
        );
      })}

      <g className="robber" pointerEvents="none" data-testid="robber">
        <circle cx={robber.x} cy={robber.y} r={0.2} />
        <circle cx={robber.x} cy={robber.y - 0.16} r={0.1} />
      </g>

      {board.topology.edges.map((edge) => {
        const [from, to] = edgeSegment(edge);
        const owner = state.roads[edge];
        const isTarget = targets.edges.has(edge);

        return (
          <line
            key={edge}
            data-testid={`edge-${edge}`}
            data-target={isTarget ? 'true' : 'false'}
            className={roadClass(owner !== undefined, isTarget)}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            /*
             * Die Farbe steht im `style` und nicht als `stroke`-Attribut. Eine
             * CSS-Regel schlaegt immer das gleichnamige Praesentationsattribut,
             * und `.road` setzt `stroke: transparent`, damit freie Kanten
             * unsichtbare Trefferflaechen sind. Als Attribut waere jede gebaute
             * Strasse durchsichtig - genau der Fehler, den `roads.test.tsx`
             * festhaelt.
             */
            style={owner === undefined ? undefined : { stroke: colorOf(owner) }}
            onClick={isTarget ? () => onPick({ kind: 'edge', id: edge }) : undefined}
          />
        );
      })}

      {board.topology.vertices.map((vertex) => (
        <VertexMark
          key={vertex}
          vertex={vertex}
          state={state}
          isTarget={targets.vertices.has(vertex)}
          colorOf={colorOf}
          onPick={onPick}
        />
      ))}
    </svg>
  );
}

function roadClass(built: boolean, isTarget: boolean): string {
  if (built) return 'road road--built';
  return isTarget ? 'road road--target' : 'road';
}

function VertexMark({
  vertex,
  state,
  isTarget,
  colorOf,
  onPick,
}: {
  readonly vertex: VertexId;
  readonly state: BoardSource;
  readonly isTarget: boolean;
  readonly colorOf: (player: PlayerId) => string;
  readonly onPick: (place: Place) => void;
}): JSX.Element {
  const point = vertexPoint(vertex);
  const building = state.buildings[vertex];

  return (
    <g
      data-testid={`vertex-${vertex}`}
      data-target={isTarget ? 'true' : 'false'}
      className={building === undefined ? 'vertex' : `vertex vertex--${building.kind}`}
      onClick={isTarget ? () => onPick({ kind: 'vertex', id: vertex }) : undefined}
    >
      {/* Unsichtbare Trefferflaeche: der Browser trifft, nicht eine eigene
          Abstandsrechnung. */}
      <circle className="vertex__hit" cx={point.x} cy={point.y} r={0.22} />
      {building === undefined ? (
        isTarget ? (
          <circle className="vertex__target" cx={point.x} cy={point.y} r={0.13} />
        ) : null
      ) : (
        <circle
          className="vertex__building"
          cx={point.x}
          cy={point.y}
          r={building.kind === 'city' ? 0.2 : 0.14}
          fill={colorOf(building.owner)}
        />
      )}
    </g>
  );
}
