import type { JSX } from 'react';
import {
  boardOf,
  hexFromId,
  type GameState,
  type PlayerId,
  type VertexId,
} from '@conquerist/shared';
import { seatsById, type Seat } from '../seats';
import { RESOURCE_COLORS, TERRAIN_COLORS, TRACK_COLORS, harborLabel } from '../game/labels';
import type { ActionTargets } from '../game/targets';
import {
  edgeMidpoint,
  edgeSegment,
  harborAnchor,
  hexCenter,
  hexCorners,
  vertexPoint,
  viewBoxOf,
  type Point,
} from './layout';
import { nearestTarget, targetPoints } from './pick';
import {
  CITY_PATH,
  KNIGHT_HELMET_PATH,
  KNIGHT_MAST_PATH,
  KNIGHT_PATH,
  KNIGHT_PENNANTS,
  METROPOLIS_PATHS,
  SETTLEMENT_PATH,
  WALL_PATH,
} from './shapes';
import { HARBOR_MARK, HarborMark } from './harbor';
import { LAYERS, TerrainPatterns, terrainFill } from './terrain';
import { Numeral } from '../type/Numerals';

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
  /** Wer wo steht. Oeffentlich wie Siedlungen und Staedte. */
  readonly knights: GameState['knights'];
  readonly robber: GameState['robber'];
}

export interface BoardSvgProps {
  readonly state: BoardSource;
  readonly targets: ActionTargets;
  readonly seats: readonly Seat[];
  readonly onPick: (place: Place) => void;
  /** Was angetippt, aber noch nicht ausgefuehrt ist - `null`, wenn nichts. */
  readonly pending?: Place | null;
}

/**
 * Luft um das Aeusserste, was gezeichnet wird - in Umkreisradien.
 *
 * Getrennt von HARBOR_REACH, weil es zwei verschiedene Dinge sind, und das
 * einmal teuer war: als die Haefen in die See wanderten, ist hier einfach eine
 * groessere Zahl (0.95) eingetragen worden, damit sie hineinpassen. Im Browser
 * gemessen kam heraus, dass das Brett damit nur 8.69 von 9.90 viewBox-Einheiten
 * Hoehe nutzte - zwoelf Prozent Bretthoehe an einen geratenen Rand verschenkt.
 */
const PADDING = 0.2;

/**
 * Wie weit die Hafenmarken ueber die aeussersten Feldecken hinausragen.
 *
 * Gemessen und nicht geschaetzt: `getBBox()` der Hafengruppen gegen die
 * Eckenspanne der Felder gerechnet ergibt **0.384** (im Browser, bei
 * `HARBOR_MARK` = 0.27) - eine Marke sitzt HARBOR_OFFSET vor der Kantenmitte
 * und traegt ihren Radius, und die Kantenmitte liegt naeher am Mittelpunkt als
 * eine Ecke. Die viewBox rechnet aus Ecken, also muss dieser Ueberstand dazu;
 * 0.39 laesst dem Ring seine Strichbreite.
 *
 * **Die Zahl haengt an `HARBOR_MARK` und ist mit ihr gewachsen** (0.35 -> 0.39,
 * genau die 0.04, um die der Radius zugelegt hat). Wer die Marke wieder
 * aendert, aendert diese Zahl mit - sonst schneidet die viewBox an neun
 * Stellen einen Rand ab, den niemand sucht, weil er nur ein paar Pixel breit
 * ist.
 */
const HARBOR_REACH = 0.39;

/**
 * Wo ein Steg anfaengt - knapp innerhalb der Marke.
 *
 * Er lief bis hierher von der **Mitte** der Marke los und verschwand unter ihr.
 * Das ging, solange er gerade war; eine gebogene Leine haette darunter einen
 * Knick gezeigt. Knapp innerhalb und nicht genau am Rand, damit zwischen Marke
 * und Leine keine Fuge aufreisst.
 */
const DOCK_START = HARBOR_MARK - 0.03;

/**
 * Wie weit die zwei Leinen nach aussen durchhaengen.
 *
 * Gerade Linien von einem Punkt zu zwei Ecken sind eine Gabel, und eine Gabel
 * zeigt auf zwei Knoten, ohne dass sie deshalb nach Hafen aussieht. Ein
 * gleichmaessiger Bogen nach aussen macht daraus zwei Leinen, die sich vom
 * Poller zum Land spannen - und er unterscheidet sie zugleich von allem anderen
 * auf dem Brett, denn Strassen sind immer gerade.
 */
const DOCK_BEND = 0.055;

/**
 * Wie stark ein Bauwerkspfad aufs Brett schrumpft - je Bauteil.
 *
 * **Diese Zahl steht hier, weil sie zweimal gebraucht wird.** Die Pfade in
 * `board/shapes.ts` liegen in ihrem eigenen Raum, rund 20 Einheiten breit; ein
 * Feld auf dem Brett misst 1. Wer sie hinstellt, muss also durch rund vierzig
 * teilen - und wer das aus dem Kopf schaetzt, schaetzt um eine Zehnerpotenz
 * daneben. Genau das ist dem Geist passiert: er stand mit `scale(0.42)` da und
 * war damit 5 von 9.76 viewBox-Einheiten breit - ein halbes Brett als Vorschau
 * auf ein Haus, das 0.32 misst.
 *
 * Die Stadt bleibt der kleinere Faktor, weil ihr Pfad breiter ist (18 Einheiten
 * gegen 12): gleiche Faktoren haetten sie auf dem Brett um die Haelfte groesser
 * gemacht als die Siedlung, und der Unterschied soll die Form tragen (Haus mit
 * Anbau), nicht die Groesse - siehe `board/shapes.ts`.
 */
const BUILDING_SCALE: Readonly<Record<'settlement' | 'city' | 'knight', number>> = {
  settlement: 0.027,
  city: 0.0245,
  /*
   * **Der Ritter ist nicht kleiner als eine Siedlung, und das ist in Ordnung.**
   *
   * Hier stand, er sei "etwas kleiner", weil fuer ihn keine Abstandsregel
   * gilt. Im Browser gemessen ist er mit 31,0 x 31,8 px genauso breit wie eine
   * Siedlung (30,5 x 35,6 px): der kleinere Faktor wird davon aufgewogen, dass
   * die Figur samt Fahne im Pfadraum breiter ist als ein Haus.
   *
   * Der Grund fuer "kleiner" traegt ausserdem nicht. Nachgerechnet aus
   * derselben Messung: eine Bretteinheit sind 94,2 px, benachbarte Kreuzungen
   * liegen also 94,2 px auseinander, und zwischen zwei Rittern bleiben 63 px.
   * Nichts ueberlappt. Die Zahl bleibt deshalb stehen - der Satz daneben nicht.
   */
  knight: 0.0225,
};

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

/**
 * Die Klickstelle in viewBox-Koordinaten.
 *
 * Als eigene Funktion, weil jsdom `getScreenCTM` nicht kennt: so laesst sich die
 * Umrechnung im Test durch eine Einheitsmatrix ersetzen, ohne die Komponente
 * dafuer zu verbiegen. Von Hand gerechnet statt ueber `createSVGPoint`, aus
 * demselben Grund - die Matrixmultiplikation ist drei Zeilen und braucht kein
 * DOM.
 */
function viewBoxPointOf(svg: SVGSVGElement, clientX: number, clientY: number): Point | null {
  const ctm = svg.getScreenCTM();
  if (ctm === null || ctm === undefined) return null;

  const inverse = ctm.inverse();

  return {
    x: inverse.a * clientX + inverse.c * clientY + inverse.e,
    y: inverse.b * clientX + inverse.d * clientY + inverse.f,
  };
}

export function BoardSvg({
  state,
  targets,
  seats,
  onPick,
  pending = null,
}: BoardSvgProps): JSX.Element {
  const board = boardOf(state.scenario);
  const colors = seatsById(seats);
  const colorOf = (player: PlayerId): string => colors.get(player)?.color ?? '#8b93a3';
  const robber = hexCenter(hexFromId(state.robber));
  /** Welche Felder auf dem Brett liegen - die Hafenmarken brauchen die Seeseite. */
  const onBoard = new Set(board.topology.hexes);

  const viewBox = viewBoxOf(board.topology.hexes, PADDING + HARBOR_REACH);
  const [boxX = 0, boxY = 0, boxWidth = 0, boxHeight = 0] = viewBox.split(' ').map(Number);
  const picks = targetPoints(targets);

  return (
    <svg
      className="board"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Spielbrett"
    >
      {/*
       * Matt und nicht glaenzend - und das ist eine Korrektur.
       *
       * Hier standen zwei Verlaeufe: einer ueber der Flaeche, einer als Fase
       * mit einem hellen Grat an der Oberkante. Ein heller Grat ist ein
       * **Glanzlicht**, und Glanz heisst glatt. Ein Plaettchen aus Karton oder
       * ein Holzfeld hat keines; das Brett sah damit aus wie aus Plastik.
       *
       * Uebrig bleibt eine richtungslose Randabdunklung: kein Licht von oben,
       * also auch kein Reflex - nur eine Kante, an der die Farbe in den Karton
       * zieht. Die Tiefe kommt aus der Textur und aus dem Schlagschatten an
       * `.hexfields`, nicht aus einer Beleuchtung.
       */}
      <defs>
        <radialGradient id="hex-matte" cx="0.5" cy="0.5" r="0.62">
          <stop offset="0.58" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.13" />
        </radialGradient>

        {/*
         * Der Kuestenschatten - als **SVG-Filter** und nicht als CSS-Filter.
         *
         * Hier stand `filter: drop-shadow(...)` im Blatt, und das hat einen
         * halbdurchsichtigen schwarzen **Kasten** ueber die ganze Bounding-Box
         * des Bretts gelegt: 943 Pixel breit, rund zehn Prozent dunkler als
         * die Flaeche daneben, mit einer harten Kante an jeder Seite. Gemessen
         * betrug der Sprung an der linken Brettgrenze 3.6 Helligkeitseinheiten
         * mit dem Filter und 0.7 ohne ihn - und 0.7 ist der Hintergrundverlauf
         * allein.
         *
         * **Der Kasten hat obendrein den Verlauf plattgedrueckt.** Ausserhalb
         * seiner Grenze lag die See bei 54.1, innerhalb bei ebenfalls 54.1 -
         * ohne ihn sind es 57.2 zu 54.1. Der Radialverlauf, der dem
         * Spielbildschirm seine Tiefe gibt, war innerhalb des Bretts also gar
         * nicht zu sehen.
         *
         * Ein SVG-`filter` mit ausdruecklicher Region tut dasselbe ohne den
         * Kasten (nachgemessen: Kante 0.7, wie ohne jeden Filter). Der Preis
         * ist, dass die Masse jetzt in **Brettmassen** stehen und damit mit dem
         * Brett wachsen - anders als vorher, wo sie CSS-Pixel waren. Das ist
         * hier zu verschmerzen und sogar stimmiger: der Saum gehoert zur Karte
         * und nicht zum Licht im Raum.
         */}
        <filter
          id="coast-shadow"
          filterUnits="objectBoundingBox"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="0.03"
            stdDeviation="0.03"
            floodColor="#040e15"
            floodOpacity="0.62"
          />
        </filter>

        <TerrainPatterns />
      </defs>

      {/*
       * Alle Felder in **einer** Gruppe, damit der Schlagschatten die Landmasse
       * meint und nicht jedes Feld einzeln.
       *
       * Ein Filter sieht die fertig gezeichnete Gruppe: innen stossen die Felder
       * ohne Luecke aneinander, dort gibt es also keine Kante, an der etwas
       * fallen koennte. Uebrig bleibt genau der Umriss zur See - die Kueste.
       * Neunzehn einzelne Schatten haetten dagegen jedes Feld ueber seinen
       * Nachbarn gehoben, und aus einem Brett waere ein Stapel geworden.
       */}
      <g className="hexfields">
        {state.scenario.hexes.map((placement) => {
          const points = hexCorners(hexFromId(placement.hex))
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
              />

              {/*
               * Die Textur ist dasselbe Sechseck noch einmal, nur mit der
               * Kachel gefuellt. Kein `clipPath` noetig: eine Fuellung endet am
               * Rand ihrer Form, und die Form **ist** das Feld.
               *
               * **Zweimal, und das ist der Grund.** Ein `<pattern>` wiederholt
               * sich exakt; eine Lage allein ist deshalb immer ein Raster, egal
               * wie unregelmaessig die Kachel gezeichnet ist. Die zweite Lage
               * laeuft auf einer Periode, die mit der ersten keinen gemeinsamen
               * Teiler hat - gemeinsam wiederholen sie sich erst nach Dutzenden
               * von Einheiten, und das Brett misst sieben. Warum das noetig
               * war, steht in `board/terrain.tsx`.
               */}
              {LAYERS.map((layer) => (
                <polygon
                  key={layer}
                  className="terrain"
                  data-layer={layer}
                  pointerEvents="none"
                  points={points}
                  fill={terrainFill(placement.terrain, layer)}
                />
              ))}

              <polygon className="hex__matte" pointerEvents="none" points={points} />
            </g>
          );
        })}
      </g>

      {/*
       * Die Zahlenchips liegen **ausserhalb** der Feldgruppe.
       *
       * Sie sind kein Gelaende, sondern etwas, das darauf gelegt wurde - und
       * genau so sollen sie aussehen. Drinnen haetten sie ausserdem den Filter
       * der Gruppe mitbekommen, und der rastert, was er anfasst: die Zahl waere
       * durch den Schlagschatten gegangen, den sie gar nicht wirft.
       */}
      {state.scenario.hexes.map((placement) => {
        if (placement.chip === undefined) return null;
        const center = hexCenter(hexFromId(placement.hex));

        return (
          <g
            className="chip"
            key={placement.hex}
            data-testid={`chip-${placement.hex}`}
            pointerEvents="none"
          >
            <circle cx={center.x} cy={center.y} r={0.34} />
            {/*
             * Die Zahl ist gezeichnet und nicht gesetzt - dieselben Ziffern,
             * aus denen auch die Wortmarke geschnitten ist (`type/Numerals`).
             *
             * Der Chip ist das meistbetrachtete Ding einer Partie. Er lag
             * bisher als 'Segoe UI Bold' auf einem Gelaende, dessen Tannen,
             * Zacken und Furchen von Hand gezeichnet sind; dieser eine Bruch
             * hat das ganze Brett nach Anwendung aussehen lassen.
             *
             * Nebenbei faellt damit die alte Falle weg. Die Augen darunter
             * sind aus genau diesem Grund schon Kreise geworden - eine
             * gezeichnete Form hat keine Metrik, die eine fehlende Schrift
             * veraendern koennte. Fuer die Zahl darueber galt derselbe Satz
             * die ganze Zeit mit, sie war nur nicht drangekommen.
             *
             * Die heisse Sechs und die heisse Acht stehen eine Spur groesser
             * (0.29 gegen 0.26) - so wie vorher 0.36 gegen 0.32. Die Farbe
             * kommt als `style` und nicht aus dem Blatt: `.chip text.chip__hot`
             * hat zwei Etappen lang nicht gegolten, weil `.chip text` darueber
             * stand, und ein `style` kann das nicht passieren.
             */}
            <Numeral
              value={placement.chip}
              cx={center.x}
              cy={center.y - 0.03}
              cap={isHot(placement.chip) ? 0.29 : 0.26}
              fill={isHot(placement.chip) ? 'var(--bad-ink)' : 'var(--ink-base)'}
              className={
                isHot(placement.chip) ? 'chip__numeral chip__numeral--hot' : 'chip__numeral'
              }
            />
            {/*
             * Die Augen als **gezeichnete Punkte** und nicht als eine Reihe
             * Mittelpunkte in einem `text`.
             *
             * Als Text ragten sie ueber den Chiprand hinaus, und der Grund
             * war zweifach. Erstens die alte Falle aus CLAUDE.md: die
             * Schriftgroesse stand in `.chip__pips` (eine Klasse), darueber
             * aber `.chip text` (eine Klasse plus ein Typ) - die 0.19px
             * haben nie gegolten, gerendert wurden 0.32px. Fuenf Punkte in
             * dieser Groesse sind breiter als der Chip, in den sie gehoeren.
             * Zweitens, und schlimmer: die Breite haengt an den Metriken
             * einer Schrift. Wieviel Vorschub ein `·` in Segoe UI
             * bekommt, laesst sich nicht ausrechnen, und auf einem Rechner
             * ohne Segoe UI ist es eine andere Zahl.
             *
             * Gezeichnete Kreise haben keine Metrik. Fuenf Punkte im
             * Abstand 0.055 sind 0.22 breit, der aeusserste sitzt damit
             * 0.272 vom Mittelpunkt - der Chip misst 0.34. Das gilt in
             * jeder Schrift und auf jedem Rechner.
             */}
            <ChipPips
              count={PIPS[placement.chip] ?? 0}
              x={center.x}
              y={center.y + 0.225}
              hot={isHot(placement.chip)}
            />
          </g>
        );
      })}

      {/*
       * Haefen: die Marke liegt in der See, zwei Stege fuehren an Land.
       *
       * Bis hierher sass sie auf der Kuestenkante - derselben Stelle, ueber die
       * eine Strasse laeuft. Wer dort baute, legte seinen Balken mitten durch
       * den Hafen, und weil die Strassen spaeter gezeichnet werden, blieb vom
       * Hafen nichts uebrig. Zwei verschiedene Dinge auf einer Geometrie; die
       * Kante gehoert der Strasse, das Wasser dem Hafen.
       *
       * Die Stege sind dabei kein Schmuck. Bis jetzt stand nirgends, **welche
       * zwei Knoten** einen Hafen bedienen - man las es aus der Lage der Marke,
       * und genau die war verdeckt. Jetzt zeigen zwei Linien darauf.
       *
       * **Was in der Marke steht, steht in `board/harbor.tsx`** - sie ist von
       * einem Kreis mit Aufschrift zu einer kleinen Muenze geworden: das Motiv
       * der Ressource, wie es auch auf der Handkarte liegt, und darunter das
       * Verhaeltnis in den gezeichneten Ziffern. Bis dahin war die Ringfarbe
       * die **einzige** Auskunft darueber, welchen Hafen man vor sich hat, und
       * das verstoesst gegen Regel 7 in `CLAUDE.md`. Der ausgeschriebene Name
       * („2:1 Erz") bleibt im `title`: er passt bei dieser Groesse nicht
       * lesbar aufs Brett und ist fuer Vorlesewerkzeuge da.
       *
       * Die Farbe des allgemeinen Hafens ist die Pergamentkante und nicht mehr
       * die Tiefsee-Tinte. Ein dunkler Ring auf der dunklen See war im Browser
       * schlicht nicht zu sehen - derselbe Befund wie bei den Strassen am
       * Brettrand, nur hat ihn hier niemand gemeldet, weil der cremefarbene
       * Koerper darunter ja dastand.
       */}
      {state.scenario.harbors.map((harbor) => {
        const mark = harborAnchor(harbor.edge, onBoard);
        const tint =
          harbor.resource === undefined
            ? 'var(--parchment-edge)'
            : RESOURCE_COLORS[harbor.resource];

        return (
          <g
            key={harbor.edge}
            className="harbor"
            pointerEvents="none"
            data-testid={`harbor-${harbor.edge}`}
            data-harbor={harbor.resource ?? 'any'}
          >
            <title>{harborLabel(harbor)}</title>
            {edgeSegment(harbor.edge).map((landing, index) => (
              <path
                key={index}
                className="harbor__dock"
                d={dockPath(mark, landing, edgeMidpoint(harbor.edge))}
                style={{ stroke: tint }}
              />
            ))}
            <HarborMark harbor={harbor} at={mark} tint={tint} />
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
        />
      ))}

      {/*
       * Die Fangflaeche: **ein** Ort, an dem aus einem Klick ein Ziel wird.
       *
       * Bis hierher trug jedes Ziel seinen eigenen Trefferkreis. Auf einem
       * Handy im Querformat liegen benachbarte Knoten aber rund 34 px
       * auseinander und eine Fingerkuppe misst 44 px - Trefferkreise in
       * Fingergroesse ueberlappen dort, und dann entschiede die
       * Zeichenreihenfolge, welches Ziel gemeint war. Statt dessen liegt hier
       * eine durchsichtige Flaeche ueber allem, und `nearestTarget` beantwortet
       * die Frage genau einmal und nachrechenbar.
       *
       * Sie liegt als letztes Kind im SVG, also ueber allem anderen - und weil
       * sie durchsichtig ist, sieht man davon nichts.
       */}
      {pending !== null && <PendingMark place={pending} targets={targets} />}

      <rect
        data-testid="board-catcher"
        className="board__catcher"
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        fill="transparent"
        onClick={(event) => {
          const svg = event.currentTarget.ownerSVGElement;
          if (svg === null) return;

          const point = viewBoxPointOf(svg, event.clientX, event.clientY);
          if (point === null) return;

          const place = nearestTarget(point, picks);
          if (place !== null) onPick(place);
        }}
      />
    </svg>
  );
}

/**
 * Eine Leine von der Hafenmarke an Land.
 *
 * Sie faengt innerhalb der Marke an und laeuft in einem Bogen zum Knoten. Der
 * Kontrollpunkt liegt in der Mitte der Strecke, um `DOCK_BEND` von der
 * Kantenmitte weggeschoben - dadurch biegen sich beide Leinen **nach aussen**
 * und spiegelbildlich, ohne dass irgendwo ein Vorzeichen von der Lage des
 * Hafens auf dem Brett abhinge.
 */
function dockPath(mark: Point, landing: Point, middle: Point): string {
  const start = toward(mark, landing, DOCK_START);
  const center = { x: (start.x + landing.x) / 2, y: (start.y + landing.y) / 2 };
  const bend = pushedFrom(center, middle, DOCK_BEND);

  return `M ${round(start.x)} ${round(start.y)} Q ${round(bend.x)} ${round(bend.y)} ${round(landing.x)} ${round(landing.y)}`;
}

/** Der Punkt in `distance` Abstand von `from` in Richtung `to`. */
function toward(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

/** `point`, um `distance` von `origin` weggeschoben. */
function pushedFrom(point: Point, origin: Point, distance: number): Point {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;

  return { x: point.x + (dx / length) * distance, y: point.y + (dy / length) * distance };
}

/** Drei Nachkommastellen reichen auf einem Brett, das rund zehn Einheiten misst. */
function round(value: number): string {
  return value.toFixed(3);
}

function roadClass(built: boolean, isTarget: boolean): string {
  if (built) return 'road road--built';
  return isTarget ? 'road road--target' : 'road';
}

/**
 * Die Augen unter der Zahl - gezeichnet, nicht gesetzt.
 *
 * Der Abstand 0.055 und der Radius 0.022 sind gegen den Chip gerechnet: fuenf
 * Punkte spannen 0.22, der aeusserste sitzt damit samt Radius 0.272 vom
 * Mittelpunkt, und der Chip misst 0.34. Die Zahl darueber steht mit 0.36px
 * Schrift in der Mitte und reicht rund 0.13 nach unten - dazwischen bleibt Luft.
 */
function ChipPips({
  count,
  x,
  y,
  hot,
}: {
  readonly count: number;
  readonly x: number;
  readonly y: number;
  readonly hot: boolean;
}): JSX.Element {
  return (
    <g className={hot ? 'chip__pips chip__pips--hot' : 'chip__pips'}>
      {Array.from({ length: count }, (_unused, index) => (
        <circle key={index} cx={x + (index - (count - 1) / 2) * 0.055} cy={y} r={0.022} />
      ))}
    </g>
  );
}

function VertexMark({
  vertex,
  state,
  isTarget,
  colorOf,
}: {
  readonly vertex: VertexId;
  readonly state: BoardSource;
  readonly isTarget: boolean;
  readonly colorOf: (player: PlayerId) => string;
}): JSX.Element {
  const point = vertexPoint(vertex);
  const building = state.buildings[vertex];
  const knight = state.knights[vertex];

  /*
   * Ein Ritter steht **statt** eines Bauwerks: beides zugleich gibt es nicht,
   * weil `canBuildKnight` eine belegte Kreuzung abweist und `canPlaceSettlementAt`
   * eine mit Ritter. Deshalb ein Zweig davor und kein zweites Gebilde daneben.
   */
  if (knight !== undefined) {
    return (
      <g
        data-testid={`vertex-${vertex}`}
        data-target={isTarget ? 'true' : 'false'}
        className="vertex vertex--knight"
      >
        {isTarget ? (
          <circle
            className="vertex__target vertex__target--yard"
            cx={point.x}
            cy={point.y}
            r={0.235}
          />
        ) : null}

        {/*
         * `key` traegt Stufe **und** Helm: React haengt sonst nur neu ein, wenn
         * die Figur entsteht, und eine Einblendung, die beim Einhaengen laeuft,
         * laeuft beim Aktualisieren nicht (die Falle steht in `CLAUDE.md`).
         * Aufwerten und Aufsetzen des Helms sollen beide sichtbar sein.
         */}
        <g
          key={`knight-${knight.level}-${knight.active}`}
          data-testid={`knight-${vertex}`}
          data-level={knight.level}
          data-active={knight.active ? 'true' : 'false'}
          className="knight"
          transform={`translate(${point.x} ${point.y}) scale(${BUILDING_SCALE.knight})`}
        >
          {/* Farbe per `style` - eine gleichnamige CSS-Regel schlaegt jedes
              SVG-Praesentationsattribut. */}
          <path className="knight__body" d={KNIGHT_PATH} style={{ fill: colorOf(knight.owner) }} />
          <path
            className="knight__mast"
            d={KNIGHT_MAST_PATH}
            style={{ stroke: colorOf(knight.owner) }}
          />
          {KNIGHT_PENNANTS.slice(0, knight.level).map((pennant, index) => (
            <path
              key={index}
              className="knight__pennant"
              d={pennant}
              style={{ fill: colorOf(knight.owner) }}
            />
          ))}
          {knight.active ? <path className="knight__helmet" d={KNIGHT_HELMET_PATH} /> : null}
        </g>
      </g>
    );
  }

  return (
    <g
      data-testid={`vertex-${vertex}`}
      data-target={isTarget ? 'true' : 'false'}
      className={building === undefined ? 'vertex' : `vertex vertex--${building.kind}`}
    >
      {building === undefined ? (
        isTarget ? (
          <circle className="vertex__target" cx={point.x} cy={point.y} r={0.13} />
        ) : null
      ) : (
        <>
          {/*
           * **Ein Knoten, auf dem schon etwas steht, war als Ziel unsichtbar.**
           *
           * Die Zielmarke hing bis hierher am leeren Knoten - `building ===
           * undefined ? Marke : Bauwerk`. Beim Ausbau zur Stadt sind aber
           * *alle* Ziele bebaut: man drueckt „Stadt", und das Brett bleibt
           * vollkommen ruhig. Anklickbar war es die ganze Zeit (der Klick haengt
           * an der Gruppe, nicht an der Marke), nur sah man nicht, welches Haus
           * gemeint ist - im Playtest hat das genau so gewirkt, wie es aussah:
           * als ginge es nicht.
           *
           * Der Hof ist deshalb dieselbe Marke wie am leeren Knoten, nur
           * groesser und **unter** dem Bauwerk: gleiches Material, gleiche
           * Aussage („hier kannst du"), und das Haus steht darauf statt
           * darunter. Ein zweiter Ring waere ein zweites Zeichen fuer dieselbe
           * Sache gewesen - und haette sich ausserdem mit der Aufbau-Welle
           * (`build-flash`, r 0.34) gestapelt.
           */}
          {isTarget ? (
            <circle
              className="vertex__target vertex__target--yard"
              cx={point.x}
              cy={point.y}
              r={0.235}
            />
          ) : null}

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

          {/*
           * Lage aussen, Bewegung innen - und das ist kein Geschmack.
           *
           * Die Einblendung `settle` animiert `transform`. Eine CSS-Animation
           * schlaegt das gleichnamige Praesentationsattribut, also war das
           * `translate(...) scale(0.023)` fuer die Dauer der Animation weg:
           * der Pfad stand in seinem eigenen Mass da - rund 20 Einheiten
           * breit, wo ein Feld eine misst - und am Nullpunkt statt am Knoten.
           * Ein riesiges Haus quer ueber dem Brett, 180 ms lang, dann der
           * Sprung an seinen Platz. Dasselbe Muster wie bei den unsichtbaren
           * Strassen in Etappe 3, nur andersherum: dort schlug eine Regel ein
           * Attribut, hier eine Animation.
           *
           * Die Gruppe stellt das Bauwerk hin und wird nie animiert; der Pfad
           * darin bewegt sich in seinem eigenen Raum. `key` an der Gruppe,
           * damit React beim Ausbau zur Stadt neu einhaengt - nur dann laeuft
           * die Einblendung ein zweites Mal.
           */}
          {/*
           * **Groesser seit dem zweiten Blick aufs Brett.** Die Siedlung stand
           * mit 0.023 auf einem Feld, dessen Umkreis 1 misst - ein Haus von
           * 0.28 Brettbreite, kleiner als der Zahlenchip in der Feldmitte
           * (0.34 Radius) und kleiner als die Trefferflaeche, auf die man
           * klickt (0.22 Radius). Jetzt 0.027 und 0.0245: 0.32 und 0.44 breit,
           * also groesser als der Chip und immer noch mit Luft zum Nachbarn -
           * zwei Bauwerke stehen nie naeher als eine Kantenlaenge beieinander.
           *
           * Die beiden Faktoren stehen als `BUILDING_SCALE` oben, weil der
           * Geist dieselben braucht - und ohne sie um eine Zehnerpotenz
           * danebengriff.
           */}
          <g
            key={building.kind}
            transform={`translate(${point.x} ${point.y}) scale(${BUILDING_SCALE[building.kind]})`}
          >
            <path
              className={`vertex__building building building--${building.kind}`}
              d={building.kind === 'city' ? CITY_PATH : SETTLEMENT_PATH}
              // Farbe per `style`: eine gleichnamige CSS-Regel schlaegt jedes
              // SVG-Praesentationsattribut - daran sind in Etappe 3 alle
              // gebauten Strassen unsichtbar geworden.
              style={{ fill: colorOf(building.owner) }}
            />
            {/*
             * Die Mauer **nach** der Stadt und damit darueber: sie nimmt ihr
             * das untere Drittel und laesst Dach und Giebel stehen. Unter der
             * Stadt gezeichnet waere sie unsichtbar - der Stadtpfad deckt
             * genau diesen Bereich.
             */}
            {building.wall ? (
              <path
                key="wall"
                data-testid={`wall-${vertex}`}
                className="wall"
                d={WALL_PATH}
                style={{ fill: colorOf(building.owner) }}
              />
            ) : null}
            {/*
             * Der Metropolenaufsatz - **nach** dem Bauwerkspfad und aus
             * demselben Grund wie die Mauer: davor gezeichnet waere er vom
             * Stadtpfad verdeckt. Er sitzt ueber dem Dach (`METROPOLIS_PATHS`
             * bleibt bei y kleiner -8), die Mauer bleibt darunter am Sockel -
             * eine ummauerte Metropole zeigt beides, und keins verdeckt das
             * andere.
             *
             * `key` traegt den Bereich, nicht nur "metropolis": eine
             * Metropole, die den Bereich wechselt (Stufe 5 nimmt einem
             * anderen den Aufsatz ab), soll neu einhaengen, damit die
             * Einblendung `settle` (ueber die Klasse `building`) noch einmal
             * laeuft - dieselbe Falle wie beim Ausbau zur Stadt, siehe
             * `CLAUDE.md`.
             *
             * Die Bereichsfarbe kommt aus `TRACK_COLORS` und damit aus den
             * CSS-Variablen in `index.css`, nicht aus einem Hex-Wert hier -
             * und per `style`, nicht als Attribut, aus demselben Grund wie
             * ueberall sonst auf dem Brett.
             */}
            {building.metropolis !== null ? (
              <path
                key={`metropolis-${building.metropolis}`}
                data-testid={`metropolis-${vertex}`}
                data-track={building.metropolis}
                className="metropolis building"
                d={METROPOLIS_PATHS[building.metropolis]}
                style={{ fill: TRACK_COLORS[building.metropolis] }}
              />
            ) : null}
          </g>
        </>
      )}
    </g>
  );
}

/**
 * Der Geist: was gesetzt wuerde, halbdurchsichtig an seiner Stelle.
 *
 * Welches Bauteil es ist, sagt die Klickkarte und nicht die Komponente - dort
 * steht der Zug, der ausgeloest wuerde. Ein zweites Mal aus der Phase zu raten
 * waere eine zweite Auslegung derselben Regel.
 *
 * Ohne Fuellung fuer den Raeuber: dort verschiebt sich ein Stein, der schon da
 * ist, und ein zweiter Stein daneben laese sich als zwei Raeuber.
 */
function PendingMark({
  place,
  targets,
}: {
  readonly place: Place;
  readonly targets: ActionTargets;
}): JSX.Element | null {
  if (place.kind === 'vertex') {
    const action = targets.vertices.get(place.id);
    if (action === undefined) return null;

    const point = vertexPoint(place.id);
    const kind = action.type === 'buildCity' ? 'city' : 'settlement';

    return (
      <g className="pending" data-testid={`pending-${place.id}`}>
        <path
          d={kind === 'city' ? CITY_PATH : SETTLEMENT_PATH}
          transform={`translate(${point.x} ${point.y}) scale(${BUILDING_SCALE[kind]})`}
        />
      </g>
    );
  }

  if (place.kind === 'edge') {
    const [from, to] = edgeSegment(place.id);

    return (
      <g className="pending" data-testid={`pending-${place.id}`}>
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      </g>
    );
  }

  const center = hexCenter(hexFromId(place.id));

  return (
    <g className="pending pending--hex" data-testid={`pending-${place.id}`}>
      <circle cx={center.x} cy={center.y} r={0.5} />
    </g>
  );
}
