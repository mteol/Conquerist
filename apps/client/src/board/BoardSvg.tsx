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
import { CITY_PATH, SETTLEMENT_PATH } from './shapes';

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

/**
 * Die zwei Zahlen, die am haeufigsten fallen - und deshalb rot stehen.
 *
 * Abgeleitet aus `PIPS` und nicht als `chip === 6 || chip === 8` geschrieben:
 * heiss ist, was die hoechste Augenwahrscheinlichkeit hat, und das folgt aus
 * der Wuerfelschale. Ein Regelwerk mit anderen Wuerfeln faerbt damit von selbst
 * die richtigen Chips, ohne dass hier eine Zahl nachgezogen werden muss.
 */
const HOTTEST = Math.max(...Object.values(PIPS));

function isHot(chip: number): boolean {
  return (PIPS[chip] ?? 0) === HOTTEST;
}

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
                  data-hot={isHot(placement.chip) ? 'true' : 'false'}
                  className={isHot(placement.chip) ? 'chip__hot' : undefined}
                >
                  {placement.chip}
                </text>
                <text
                  x={center.x}
                  y={center.y + 0.24}
                  className={isHot(placement.chip) ? 'chip__pips chip__pips--hot' : 'chip__pips'}
                >
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

      {/*
       * Der Raeuber wird verschoben statt neu gesetzt: `transform` laesst sich
       * weich uebergehen, `cx`/`cy` nicht zuverlaessig. Sein Feld steht als
       * `data-hex` daneben - die Endlage ist die Information, der Weg dorthin
       * ist Beiwerk und faellt bei abgeschalteter Bewegung ersatzlos weg.
       */}
      {/*
       * Der Ring am Zielfeld.
       *
       * Eigenes Element mit `key={state.robber}`: React haengt es bei jedem
       * Versetzen neu ein, und nur dadurch laeuft die Animation ueberhaupt ein
       * zweites Mal. Ohne ihn ist das Versetzen im Playtest niemandem
       * aufgefallen - eine Figur, die 300 ms lang leise von einem Feld zum
       * naechsten gleitet, sieht nur, wer schon hinschaut.
       *
       * Er traegt nichts, was nicht auch ohne ihn dastuende: wo der Raeuber
       * steht, sagt die Figur selbst und `data-hex` daneben.
       */}
      <circle
        key={state.robber}
        className="robber__flash"
        pointerEvents="none"
        cx={robber.x}
        cy={robber.y}
        r={0.5}
      />

      <g
        className="robber"
        pointerEvents="none"
        data-testid="robber"
        data-hex={state.robber}
        style={{ transform: `translate(${robber.x}px, ${robber.y}px)` }}
      >
        <circle cx={0} cy={0} r={0.2} />
        <circle cx={0} cy={-0.16} r={0.1} />
      </g>

      {/*
       * Die Konturen unter den Strassen - **alle** zuerst, dann alle Strassen.
       *
       * Im Playtest waren die Strassen am Brettrand „unsichtbar". Am Element
       * lag es nicht: gemessen liegen die Kuestenkanten in der viewBox und
       * tragen ihre Klasse und ihre Farbe. Es lag am Untergrund. Eine Strasse
       * im Inneren hat auf beiden Seiten helles Gelaende; eine an der Kueste
       * hat auf einer Seite die dunkle See, und ein dunkelblauer oder
       * violetter Streifen darauf verschwindet schlicht. Die Kontur loest das
       * unabhaengig davon, worauf die Strasse liegt - dasselbe, was eine
       * Landkarte mit ihren Strassen macht.
       *
       * **Zwei Durchgaenge und nicht einer je Kante.** Sonst liegt an einer
       * Kreuzung die Kontur der zweiten Strasse ueber der Farbe der ersten und
       * beisst ihr die Spitze ab. So liegen erst alle Konturen, dann alle
       * Farben - und keine Kontur kann eine fremde Strasse ueberdecken.
       */}
      {board.topology.edges
        .filter((edge) => state.roads[edge] !== undefined)
        .map((edge) => {
          const [from, to] = edgeSegment(edge);

          return (
            <line
              key={`casing-${edge}`}
              className="road__casing"
              pointerEvents="none"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
          );
        })}

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
        <>
          {/*
           * Der Ring beim Bauen - und `key` ist hier die ganze Mechanik.
           *
           * Beim Ausbau zur Stadt bleibt der Knoten derselbe; React aktualisiert
           * das Element, statt es neu einzuhaengen, und eine Animation, die beim
           * Einhaengen laeuft, laeuft dann gar nicht. Genau deshalb ist im
           * Playtest niemandem aufgefallen, wenn eine Stadt entstand: aus einem
           * Punkt wurde ein etwas groesserer Punkt, lautlos.
           */}
          <circle
            key={`ring-${building.kind}`}
            className="build-flash"
            cx={point.x}
            cy={point.y}
            r={0.34}
            style={{ stroke: colorOf(building.owner) }}
          />

          <path
            key={building.kind}
            className={`vertex__building building building--${building.kind}`}
            d={building.kind === 'city' ? CITY_PATH : SETTLEMENT_PATH}
            transform={`translate(${point.x} ${point.y}) scale(${
              building.kind === 'city' ? 0.021 : 0.023
            })`}
            // Farbe per `style`: eine gleichnamige CSS-Regel schlaegt jedes
            // SVG-Praesentationsattribut - daran sind in Etappe 3 alle
            // gebauten Strassen unsichtbar geworden.
            style={{ fill: colorOf(building.owner) }}
          />
        </>
      )}
    </g>
  );
}
