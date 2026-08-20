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
 * eine Kachel von 0.3 wiederholt sich darin rund sechsmal je Richtung. Die
 * Zahlen sind bewusst krumm und keine Teiler von 1.5 (dem Zeilenabstand des
 * Sechseckgitters): eine Kachel, die sich mit dem Gitter deckt, laesst genau
 * dort ein Raster entstehen, wo die Textur keines haben soll.
 */
export const TILES: Readonly<Record<TerrainId, { readonly w: number; readonly h: number }>> = {
  forest: { w: 0.3, h: 0.26 },
  pasture: { w: 0.22, h: 0.19 },
  fields: { w: 0.3, h: 0.075 },
  hills: { w: 0.26, h: 0.16 },
  mountains: { w: 0.31, h: 0.25 },
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
      <path d={fir(0.075, 0.115, 0.1)} />
      <path d={fir(0.16, 0.075, 0.07)} />
      <path d={fir(0.215, 0.245, 0.105)} />
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
      <path d={tuft(0.06, 0.075)} />
      <path d={tuft(0.19, 0.06)} />
      <path d={tuft(0.155, 0.165)} />
    </g>
  ),

  /**
   * Korn: eine durchlaufende Furche je Kachel.
   *
   * Die Kachel ist nur 0.075 hoch, die Furchen liegen also dicht - ein
   * gepfluegter Acker in der Aufsicht. Sie beginnt und endet auf derselben
   * Hoehe, laeuft deshalb ueber jede Kachelgrenze und ueber jede Feldgrenze
   * durch.
   */
  fields: (
    <g className="terrain-line">
      <path d="M 0 0.0375 Q 0.075 0.019 0.15 0.0375 Q 0.225 0.056 0.3 0.0375" />
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
      <path d="M 0 0 L 0.26 0" />
      <path d="M 0 0.08 L 0.26 0.08" />
      <path d="M 0.065 0 L 0.065 0.08" />
      <path d="M 0.195 0.08 L 0.195 0.16" />
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
      <path d="M 0.015 0.085 L 0.065 0.02 L 0.115 0.085" />
      <path d="M 0.145 0.055 L 0.18 0.012 L 0.215 0.055" />
      <path d="M 0.09 0.215 L 0.15 0.14 L 0.21 0.215" />
      <path d="M 0.23 0.175 L 0.265 0.128 L 0.3 0.175" />
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

/** Ein Grasbueschel: drei Halme aus einem Punkt. */
function tuft(x: number, baseY: number): string {
  return [
    `M ${r(x)} ${r(baseY)}`,
    `L ${r(x - 0.014)} ${r(baseY - 0.03)}`,
    `M ${r(x)} ${r(baseY)}`,
    `L ${r(x)} ${r(baseY - 0.038)}`,
    `M ${r(x)} ${r(baseY)}`,
    `L ${r(x + 0.015)} ${r(baseY - 0.029)}`,
  ].join(' ');
}

/** Vier Nachkommastellen - eine Kachel misst rund ein Drittel. */
function r(value: number): string {
  return Number(value.toFixed(4)).toString();
}
