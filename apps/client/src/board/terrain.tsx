import type { JSX } from 'react';
import { TERRAIN_LABELS, type TerrainId } from '@conquerist/shared';

/**
 * Die Gelaendetextur - das Feld als Material, nicht als bedrucktes Plaettchen.
 *
 * **Warum es sie gibt.** Bis hierher trug die Fuellfarbe die Gelaendeinformation
 * allein, und das verstoesst gegen Regel 7 in CLAUDE.md: Farbe ist nie der
 * einzige Traeger. Wald (`#2f6b3a`) und Weide (`#7fb069`) sind zwei Gruen;
 * Huegel (`#b4623a`) und Wald liegen fuer rotgruenblinde Augen aneinander.
 *
 * **Eine Flaeche und kein Motiv.** Die erste Fassung setzte fuenf gezeichnete
 * Objekte in ein Band am unteren Feldrand - Tannen, Aehren, ein Schaf. Am
 * Bildschirm sah man daran genau das: ein gesetztes Element auf einer leeren
 * Flaeche, nicht ein Gelaende. Jetzt ist das Feld durchgezeichnet, und die
 * Unterscheidung kommt aus dem **Muster**: Spitzen im Wald, Furchen im Acker,
 * Zacken im Gebirge, Ziegelverband in der Lehmgrube, Bueschel auf der Weide,
 * Duenenwellen in der Wueste.
 *
 * **`userSpaceOnUse` und nicht `objectBoundingBox`.** Damit haengt die Textur
 * am Brett und nicht am einzelnen Feld: zwei benachbarte Waldfelder zeigen
 * einen durchlaufenden Wald statt zweier Kacheln, die zufaellig dasselbe
 * Muster tragen. Das ist der Unterschied zwischen Landschaft und Raster - und
 * er kostet ein Attribut.
 *
 * **Sie ist absichtlich sehr leise** (siehe `.terrain` in `index.css`). Eine
 * Flaeche vertraegt weit weniger Kontrast als ein Einzelmotiv: was ueber das
 * ganze Feld laeuft, laeuft auch unter jeder Strasse und hinter jedem Bauwerk
 * durch. Die Textur sagt, woraus das Feld ist; was darauf passiert, sagen Chip,
 * Haus und Strasse.
 */

/**
 * Die Kachelgroessen, in Umkreisradien eines Feldes.
 *
 * Ein Feld misst 1 im Umkreis, also 1.732 in der Breite und 2 in der Hoehe -
 * eine Kachel von 0.4 wiederholt sich darin rund viermal je Richtung. Die
 * Zahlen sind bewusst krumm und keine Teiler von 1.5 (dem Zeilenabstand des
 * Sechseckgitters): eine Kachel, die sich mit dem Gitter deckt, laesst genau
 * dort ein Raster entstehen, wo die Textur keines haben soll.
 *
 * **Sie sind gewachsen, und der Grund ist gemessen.** Bei 65 Pixeln je
 * Bretteinheit - das Brett stand in einem 1184er Fenster auf 644 Pixeln - war
 * eine Tanne aus der alten Kachel **6.8 Pixel hoch**. Eine Silhouette in
 * dieser Groesse ist kein Baum mehr, sondern ein Fleck, und ein Fleck traegt
 * die Gelaendeunterscheidung nicht, um derentwillen die Textur ueberhaupt
 * existiert. Was eine Form zeigen soll, braucht Platz fuer die Form; wo nur
 * eine Richtung zaehlt (Furchen, Duenen), bleibt die Kachel klein.
 */
export const TILES: Readonly<Record<TerrainId, { readonly w: number; readonly h: number }>> = {
  forest: { w: 0.4, h: 0.345 },
  pasture: { w: 0.32, h: 0.28 },
  fields: { w: 0.3, h: 0.115 },
  hills: { w: 0.32, h: 0.21 },
  mountains: { w: 0.39, h: 0.315 },
  desert: { w: 0.34, h: 0.13 },
};

/** Die Id, unter der ein Gelaende seine Kachel in `<defs>` ablegt. */
export function patternId(terrain: TerrainId): string {
  return `terrain-${terrain}`;
}

/** Womit ein Feld gefuellt wird, nachdem seine Gelaendefarbe liegt. */
export function terrainFill(terrain: TerrainId): string {
  return `url(#${patternId(terrain)})`;
}

/** Alle sechs Kacheln. Gehoert in die `defs` des Bretts. */
export function TerrainPatterns(): JSX.Element {
  return (
    <>
      {(Object.keys(TERRAIN_LABELS) as TerrainId[]).map((terrain) => (
        <pattern
          key={terrain}
          id={patternId(terrain)}
          data-testid={patternId(terrain)}
          /*
           * Die Gelaendeklasse traegt die **Staerke** der Textur, und die ist
           * je Feld eine andere - siehe `.terrain-tile--*` in `index.css`.
           * Sie steht hier und nicht an der Marke, damit eine Kachel genau
           * eine Tinte hat: was in ihr gezeichnet wird, ist dieselbe Farbe,
           * ob gefuellt oder gestrichen.
           */
          className={`terrain-tile terrain-tile--${terrain}`}
          patternUnits="userSpaceOnUse"
          width={TILES[terrain].w}
          height={TILES[terrain].h}
        >
          {MARKS[terrain]}
        </pattern>
      ))}
    </>
  );
}

/**
 * Was in einer Kachel steht.
 *
 * Zwei Regeln gelten fuer alle sechs:
 *
 * 1. **Was den Rand beruehrt, beruehrt ihn auf beiden Seiten auf derselben
 *    Hoehe.** Eine Linie, die bei x = 0 auf y anfaengt, muss bei x = Breite auf
 *    demselben y enden - sonst zeigt jede Kachelgrenze einen Knick, und aus
 *    einer Textur wird ein Gitter. `terrain.test.tsx` rechnet das nach.
 * 2. **Nichts ragt aus der Kachel heraus**, denn die Kachel schneidet ab. Ein
 *    Kontrollpunkt darf draussen liegen, die Kurve selbst nicht.
 */
const MARKS: Readonly<Record<TerrainId, JSX.Element>> = {
  /**
   * Wald: drei kleine Tannen je Kachel, in drei Groessen.
   *
   * Die Silhouette ist die von der Holzkarte (`ResourceGlyph.lumber`), auf
   * einen Absatz heruntergebracht. Bei rund neun Pixeln Hoehe ist ein Absatz
   * alles, was von einem Nadelbaum uebrig bleibt - und er genuegt, weil daneben
   * sechzig weitere stehen.
   */
  forest: (
    <g className="terrain-fill">
      <path d={fir(0.1, 0.153, 0.133)} />
      <path d={fir(0.213, 0.1, 0.093)} />
      <path d={fir(0.287, 0.327, 0.14)} />
    </g>
  ),

  /**
   * Weide: drei Grasbueschel je Kachel, drei Halme je Bueschel.
   *
   * Rundungen gegen die Spitzen des Waldes - das ist die Unterscheidung, die
   * auch ohne Farbe traegt, und sie war der eigentliche Grund fuer die ganze
   * Textur: Wald und Weide sind zwei Gruen.
   */
  pasture: (
    <g className="terrain-line">
      <path d={tuft(0.087, 0.11, 0.065)} />
      <path d={tuft(0.275, 0.087, 0.065)} />
      <path d={tuft(0.225, 0.245, 0.065)} />
    </g>
  ),

  /**
   * Korn: eine durchlaufende Furche je Kachel.
   *
   * Die Kachel ist flach, die Furchen liegen also dicht - ein gepfluegter
   * Acker in der Aufsicht. Sie beginnt und endet auf derselben Hoehe, laeuft
   * deshalb ueber jede Kachelgrenze und ueber jede Feldgrenze durch.
   *
   * **0.115 hoch und nicht 0.09, nach dem Blick aus der Naehe.** Bei 0.09 lag
   * zwischen zwei Furchen weniger als das Vierfache der Strichbreite, und aus
   * einem Acker wurde ein Streifenmuster - dicht genug, dass das Auge es als
   * Flimmern liest statt als Furche. Mit der Kachel ist die Auslenkung
   * mitgewachsen (0.024 statt 0.0185): eine flachere Welle in einer hoeheren
   * Kachel waere eine gerade Linie geworden.
   */
  fields: (
    <g className="terrain-line">
      <path d="M 0 0.0575 Q 0.075 0.0335 0.15 0.0575 Q 0.225 0.0815 0.3 0.0575" />
    </g>
  ),

  /**
   * Huegel: Ziegel im Verband - die Lehmgrube als Material.
   *
   * Gezeichnet wird die Fuge, nicht der Stein: zwei durchlaufende Lagerfugen
   * und je Lage eine Stossfuge, um eine halbe Steinlaenge versetzt. Genau der
   * Verband der drei Ziegel auf der Lehmkarte, nur ueber das ganze Feld.
   */
  hills: (
    <g className="terrain-line">
      <path d="M 0 0 L 0.32 0" />
      <path d="M 0 0.105 L 0.32 0.105" />
      <path d="M 0.08 0 L 0.08 0.105" />
      <path d="M 0.24 0.105 L 0.24 0.21" />
    </g>
  ),

  /**
   * Gebirge: Zacken, wie die Schraffur einer Karte.
   *
   * **Vier Winkel in vier Groessen, unregelmaessig gestellt.** Die erste Fassung
   * hatte zwei gleiche je Kachel, um eine halbe Kachel versetzt - am Bildschirm
   * ergab das ein sauberes Rautengitter, also eine Steppdecke und kein Gebirge.
   * Zwei gleiche Marken in regelmaessigem Versatz sind immer ein Raster; erst
   * ungleiche Groessen und ungleiche Abstaende loesen es auf.
   *
   * Sie sind die Bruchkante von der Erzkarte, vervielfacht - und sie
   * unterscheiden sich von den Tannen dadurch, dass sie offen stehen: der
   * Winkel hat keinen Fuss, die Tanne ist geschlossen.
   */
  mountains: (
    <g className="terrain-line">
      <path d="M 0.019 0.107 L 0.082 0.025 L 0.145 0.107" />
      <path d="M 0.182 0.069 L 0.226 0.015 L 0.27 0.069" />
      <path d="M 0.113 0.27 L 0.189 0.176 L 0.264 0.27" />
      <path d="M 0.289 0.22 L 0.333 0.161 L 0.377 0.22" />
    </g>
  ),

  /**
   * Wueste: Duenenwellen.
   *
   * Eine Welle je Kachel, symmetrisch gebaut, damit Anfang und Ende dieselbe
   * Hoehe **und** dieselbe Steigung haben - sonst saehe man an jeder
   * Kachelgrenze einen Knick. Die Kontrollpunkte liegen dabei ausserhalb der
   * Kachel; die Kurve selbst nicht, und nur die wird gezeichnet.
   */
  desert: (
    <g className="terrain-line">
      <path d="M 0 0.065 Q 0.085 0.028 0.17 0.065 Q 0.255 0.102 0.34 0.065" />
    </g>
  ),
};

/**
 * Eine Tanne, auf einen Absatz gebracht.
 *
 * `cx` ist die Mitte, `baseY` der Fuss, `h` die Hoehe. Die Breite haengt an der
 * Hoehe, damit eine kleinere Tanne wie eine juengere aussieht und nicht wie
 * eine gestauchte.
 */
function fir(cx: number, baseY: number, h: number): string {
  const w = 0.3 * h;
  const shoulder = baseY - h * 0.44;

  return [
    `M ${r(cx)} ${r(baseY - h)}`,
    `L ${r(cx + w * 0.66)} ${r(shoulder)}`,
    `L ${r(cx + w * 0.4)} ${r(shoulder)}`,
    `L ${r(cx + w)} ${r(baseY)}`,
    `L ${r(cx - w)} ${r(baseY)}`,
    `L ${r(cx - w * 0.4)} ${r(shoulder)}`,
    `L ${r(cx - w * 0.66)} ${r(shoulder)}`,
    'Z',
  ].join(' ');
}

/**
 * Ein Grasbueschel: drei Halme aus einem Punkt, `h` hoch.
 *
 * Die drei Halme standen als feste Zahlen da, und mit der groesseren Kachel
 * waeren sie zu einem Punkt zusammengeschnurrt gewesen - dieselbe Falle wie
 * bei einer Tanne, die man staucht statt sie zu verkleinern.
 *
 * **Die aeusseren Halme sind Boegen, und das war der Blick aus der Naehe.**
 * Als drei gerade Striche aus einem Punkt, symmetrisch und gleich lang, ist
 * ein Bueschel kein Bueschel, sondern ein **Ypsilon** - vergroessert sah die
 * Weide aus, als sei sie mit kleinen Voegeln bestreut. Ein Grashalm steht
 * nicht gerade; er geht aus dem Boden steil los und legt sich oben. Genau das
 * macht die Kruemmung, und sie kostet zwei Kontrollpunkte.
 *
 * Der mittlere Halm bleibt gerade. Drei Boegen waeren eine Palme.
 */
function tuft(x: number, baseY: number, h: number): string {
  return [
    `M ${r(x)} ${r(baseY)}`,
    `Q ${r(x - h * 0.1)} ${r(baseY - h * 0.55)} ${r(x - h * 0.44)} ${r(baseY - h * 0.74)}`,
    `M ${r(x)} ${r(baseY)}`,
    `L ${r(x)} ${r(baseY - h)}`,
    `M ${r(x)} ${r(baseY)}`,
    `Q ${r(x + h * 0.11)} ${r(baseY - h * 0.53)} ${r(x + h * 0.46)} ${r(baseY - h * 0.71)}`,
  ].join(' ');
}

/** Vier Nachkommastellen - eine Kachel misst rund ein Drittel. */
function r(value: number): string {
  return Number(value.toFixed(4)).toString();
}
