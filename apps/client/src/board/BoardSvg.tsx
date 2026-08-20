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
import { CITY_PATH, SETTLEMENT_PATH } from './shapes';
import { TerrainPatterns, terrainFill } from './terrain';
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
  readonly robber: GameState['robber'];
}

export interface BoardSvgProps {
  readonly state: BoardSource;
  readonly targets: ActionTargets;
  readonly seats: readonly Seat[];
  readonly onPick: (place: Place) => void;
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
 * Gemessen und nicht geschaetzt: `getBBox()` am fertigen Brett gegen die
 * Eckenspanne gerechnet ergibt 0.35 - eine Marke sitzt HARBOR_OFFSET vor der
 * Kantenmitte und traegt ihren Radius, und die Kantenmitte liegt naeher am
 * Mittelpunkt als eine Ecke. Die viewBox rechnet aus Ecken, also muss dieser
 * Ueberstand dazu.
 */
const HARBOR_REACH = 0.35;

/** Der Radius der Hafenmarke. Steht auch in `index.css` als `r` am Kreis. */
const HARBOR_MARK = 0.23;

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
 * Die Untiefen vor der Kueste - Breite je Band, in Umkreisradien.
 *
 * **Warum es sie gibt.** Die Landmasse lag bis hierher mit einem Schlagschatten
 * auf der See, und ein Schlagschatten sagt „liegt darauf". Eine Seekarte sagt
 * etwas anderes: sie sagt, wie tief das Wasser ist, und zeichnet das als
 * gestufte Saeume vor der Kueste. Der Hintergrund traegt schon Rhumbenlinien
 * und eine Kompassrose (`screens/SeaChart`); zwischen ihnen und dem Brett fehlte
 * genau der Uebergang, der aus zwei Bildern eines macht.
 *
 * **Wie sie gebaut sind.** Kein eigener Umriss der Landmasse - es sind
 * dieselben neunzehn Sechsecke noch einmal, nur als Kontur und unter den
 * Feldern. Die Konturen der inneren Felder verschwinden dabei unter ihren
 * Nachbarn; sichtbar bleibt genau das, was nach aussen ragt. Derselbe Gedanke
 * wie beim Schlagschatten an `.hexfields`, nur ohne Filter - und damit
 * skalieren die Saeume **mit** dem Brett, was hier richtig ist: sie gehoeren
 * zur Karte, nicht zum Licht im Raum.
 *
 * **Die Zahlen sind gegen `PADDING` gerechnet.** Das breiteste Band steht auf
 * 0.34; eine Kontur ragt ihre halbe Breite nach aussen, also 0.17, und
 * `PADDING` ist 0.2. Der Saum bleibt damit in der viewBox, ohne dass sie
 * wachsen muesste.
 */
const SHOALS: readonly { readonly band: string; readonly width: number }[] = [
  { band: 'far', width: 0.34 },
  { band: 'mid', width: 0.16 },
  { band: 'near', width: 0.07 },
];

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
  /** Welche Felder auf dem Brett liegen - die Hafenmarken brauchen die Seeseite. */
  const onBoard = new Set(board.topology.hexes);
  /*
   * Die Eckenzuege der Felder - einmal gerechnet, zweimal gebraucht: die
   * Untiefen zeichnen dieselben Sechsecke wie die Felder selbst. Zweimal
   * rechnen hiesse, dass ein spaeterer Eingriff an einer Stelle den Saum
   * gegen das Land verschieben koennte, ohne dass es jemandem auffaellt.
   */
  const outlines = state.scenario.hexes.map((placement) => ({
    hex: placement.hex,
    points: hexCorners(hexFromId(placement.hex))
      .map((corner) => `${corner.x},${corner.y}`)
      .join(' '),
  }));

  return (
    <svg
      className="board"
      viewBox={viewBoxOf(board.topology.hexes, PADDING + HARBOR_REACH)}
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
       * zieht. Die Tiefe kommt jetzt aus der Textur und aus dem Kuestenschatten,
       * nicht aus einer Beleuchtung.
       */}
      <defs>
        <radialGradient id="hex-matte" cx="0.5" cy="0.5" r="0.62">
          <stop offset="0.58" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.13" />
        </radialGradient>
        <TerrainPatterns />
      </defs>

      {/*
       * Die Untiefen - drei Saeume, von aussen nach innen immer schmaler und
       * immer deutlicher. Warum, steht bei `SHOALS`.
       *
       * **Die Deckkraft haengt an der Gruppe und nicht am Strich**, und das ist
       * kein Geschmack: neunzehn Konturen ueberlappen sich an jeder Feldecke,
       * und zwei halbdurchsichtige Striche uebereinander sind dunkler als
       * einer. Am Strich gesetzt saeumte die Kueste deshalb nicht gleichmaessig,
       * sondern zeigte an jeder Ecke einen Knoten. An der Gruppe gesetzt wird
       * erst das ganze Band gezeichnet und dann als ein Bild abgeblendet.
       */}
      <g className="coast" pointerEvents="none" aria-hidden="true">
        {SHOALS.map((shoal) => (
          <g key={shoal.band} className={`coast__shoal coast__shoal--${shoal.band}`}>
            {outlines.map((outline) => (
              <polygon key={outline.hex} points={outline.points} strokeWidth={shoal.width} />
            ))}
          </g>
        ))}
      </g>

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
        {state.scenario.hexes.map((placement, index) => {
          const points = outlines[index]!.points;
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

              {/*
               * Die Textur ist dasselbe Sechseck noch einmal, nur mit der
               * Kachel gefuellt. Kein `clipPath` noetig: eine Fuellung endet am
               * Rand ihrer Form, und die Form **ist** das Feld.
               */}
              <polygon
                className="terrain"
                pointerEvents="none"
                points={points}
                fill={terrainFill(placement.terrain)}
              />

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
       * Der Ring traegt die Farbe der Ressource, in der Mitte steht nur das
       * Verhaeltnis. Der ausgeschriebene Name („2:1 Erz") passt bei dieser
       * Groesse nicht lesbar aufs Brett und steht deshalb im `title` - sichtbar
       * beim Zeigen, vorhanden fuer Vorlesewerkzeuge.
       */}
      {state.scenario.harbors.map((harbor) => {
        const mark = harborAnchor(harbor.edge, onBoard);
        const ring = harbor.resource === undefined ? '#16202a' : RESOURCE_COLORS[harbor.resource];

        return (
          <g
            key={harbor.edge}
            className="harbor"
            pointerEvents="none"
            data-testid={`harbor-${harbor.edge}`}
          >
            <title>{harborLabel(harbor)}</title>
            {edgeSegment(harbor.edge).map((landing, index) => (
              <path
                key={index}
                className="harbor__dock"
                d={dockPath(mark, landing, edgeMidpoint(harbor.edge))}
                style={{ stroke: ring }}
              />
            ))}
            <circle cx={mark.x} cy={mark.y} r={HARBOR_MARK} style={{ stroke: ring }} />
            <text x={mark.x} y={mark.y}>
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
           * Die Stadt bleibt dabei der kleinere Faktor, weil ihr Pfad breiter
           * ist (18 Einheiten gegen 12): gleiche Faktoren haetten sie auf dem
           * Brett um die Haelfte groesser gemacht als die Siedlung, und der
           * Unterschied soll die Form tragen (Haus mit Anbau), nicht die
           * Groesse - siehe `board/shapes.ts`.
           */}
          <g
            key={building.kind}
            transform={`translate(${point.x} ${point.y}) scale(${
              building.kind === 'city' ? 0.0245 : 0.027
            })`}
          >
            <path
              className={`vertex__building building building--${building.kind}`}
              d={building.kind === 'city' ? CITY_PATH : SETTLEMENT_PATH}
              // Farbe per `style`: eine gleichnamige CSS-Regel schlaegt jedes
              // SVG-Praesentationsattribut - daran sind in Etappe 3 alle
              // gebauten Strassen unsichtbar geworden.
              style={{ fill: colorOf(building.owner) }}
            />
          </g>
        </>
      )}
    </g>
  );
}
