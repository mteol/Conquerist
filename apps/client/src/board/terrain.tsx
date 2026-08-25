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
 * Unterscheidung kommt aus dem **Muster**: Spitzen im Wald, Bueschel auf der
 * Weide, Furchen im Acker, Ziegelverband in der Lehmgrube, Grate im Gebirge,
 * gebrochene Rippel in der Wueste.
 *
 * **Die Weide hat als einziges Gelaende ein Lebewesen darauf** - Schafe in der
 * Streulage. Das ist kein Rueckfall in das Motivband von damals: die Tiere
 * liegen nicht in einem Band am Feldrand, sie stehen ueber das ganze Feld
 * verteilt im Gras, und das Gras traegt die Flaeche weiter allein. Das Schaf
 * ist die Ausnahme darin, so wie der alte Baum im Wald und der Doppelgipfel im
 * Gebirge.
 *
 * **`userSpaceOnUse` und nicht `objectBoundingBox`.** Damit haengt die Textur
 * am Brett und nicht am einzelnen Feld: zwei benachbarte Waldfelder zeigen
 * einen durchlaufenden Wald statt zweier Kacheln, die zufaellig dasselbe
 * Muster tragen. Das ist der Unterschied zwischen Landschaft und Raster - und
 * er kostet ein Attribut.
 *
 * **Sie ist absichtlich sehr leise** (siehe `.terrain-tile--*` in `index.css`).
 * Eine Flaeche vertraegt weit weniger Kontrast als ein Einzelmotiv: was ueber
 * das ganze Feld laeuft, laeuft auch unter jeder Strasse und hinter jedem
 * Bauwerk durch. Die Textur sagt, woraus das Feld ist; was darauf passiert,
 * sagen Chip, Haus und Strasse.
 *
 * ---
 *
 * **Der Befund aus dem Playtest: „alles zu symmetrisch".** Drei Ursachen, alle
 * drei hier behoben.
 *
 * 1. **Eine Kachel wiederholt sich, und zwar exakt.** Das ist keine Schwaeche
 *    der Zeichnung, sondern die Definition von `<pattern>`. Bei 0.4 Breite
 *    passte die Waldkachel gut viermal in eine Feldbreite - das Auge braucht
 *    drei Wiederholungen, um ein Raster zu erkennen, und bekam vier. Die
 *    Kacheln sind deshalb rund verdoppelt **und** es liegt eine zweite Lage
 *    darueber (siehe `TILES`).
 * 2. **Gleiche Marken sind ein Gitter, auch wenn sie unregelmaessig stehen.**
 *    Drei Tannen derselben Hoehe lesen sich als Punktraster mit Jitter. Jede
 *    Kachel traegt jetzt Marken in deutlich verschiedenen **Groessen** - im
 *    Wald von 0.1 bis 0.2, also das Doppelte - und mehr als eine **Art**:
 *    neben den Graten liegt Geroell, neben den Furchen Stoppeln, neben den
 *    Rippeln Kiesel.
 * 3. **Eine gespiegelte Marke ist die symmetrischste Form ueberhaupt.** Die
 *    Gebirgszacken waren gleichschenklige Winkel, also viermal dieselbe Figur.
 *    Ein Grat hat eine Luv- und eine Leeseite; die Flanken sind jetzt
 *    verschieden lang, und welche laenger ist, wechselt.
 *
 * **Und Acker und Wueste waren dieselbe Textur.** Beide waren eine
 * durchlaufende Sinuswelle, nur anders skaliert - der Unterschied lag allein in
 * der Feldfarbe, und damit war die Textur genau dort nutzlos, wo sie es nicht
 * sein darf: Farbe ist nie der einzige Traeger. Die Wueste hat jetzt
 * **gebrochene** Rippel und Kiesel, der Acker **durchlaufende** Furchen mit
 * Stoppeln. Durchlaufend gegen gebrochen liest man auch leise.
 */

/**
 * Zwei Lagen je Gelaende, mit teilerfremden Perioden.
 *
 * **Warum ueberhaupt zwei.** Eine einzelne Kachel wiederholt sich, und je
 * groesser man sie macht, desto mehr Marken muss sie tragen, ohne dass die
 * Wiederholung verschwindet - sie rueckt nur weiter auseinander. Zwei Lagen
 * mit teilerfremden Kantenlaengen wiederholen sich dagegen erst gemeinsam:
 * Wald ist 0.62 breit, seine Streulage 0.97, und dasselbe Bild kommt erst nach
 * 0.62 * 97 = 60 Einheiten wieder. Das Brett misst sieben. Es gibt auf diesem
 * Brett also keine zweite Stelle, die aussieht wie eine erste.
 *
 * Das kostet ein Polygon je Feld - und kein `Math.random()`. Zufall in der
 * Zeichnung waere ein Bild, das bei jedem Rendern anders aussieht; hier ist
 * alles gezeichnet und damit reproduzierbar, so wie das Brett selbst nur aus
 * seinem Seed entsteht.
 */
export type TextureLayer = 'base' | 'scatter';

/** Beide Lagen in Zeichenreihenfolge - die Grundlage zuerst. */
export const LAYERS: readonly TextureLayer[] = ['base', 'scatter'];

interface Tile {
  readonly w: number;
  readonly h: number;
}

/**
 * Die Kachelgroessen, in Umkreisradien eines Feldes.
 *
 * Ein Feld misst 1 im Umkreis, also 1.732 in der Breite und 2 in der Hoehe.
 * Die Zahlen sind bewusst krumm und keine Teiler von 1.5 (dem Zeilenabstand
 * des Sechseckgitters) oder von 1.732: eine Kachel, die sich mit dem Gitter
 * deckt, laesst genau dort ein Raster entstehen, wo die Textur keines haben
 * soll.
 *
 * **Sie sind zweimal gewachsen, und beide Male ist der Grund gemessen.** Zuerst
 * war eine Tanne bei 65 Pixeln je Bretteinheit **6.8 Pixel hoch** - eine
 * Silhouette in dieser Groesse ist kein Baum, sondern ein Fleck. Dann stand die
 * Kachel bei 0.4 und wiederholte sich viermal je Feldbreite - drei
 * Wiederholungen genuegen dem Auge fuer ein Raster. Jetzt passt keine
 * Grundkachel mehr dreimal in eine Feldbreite, und was an Rhythmus uebrig
 * bleibt, loest die Streulage auf.
 *
 * **Die Streulage traegt die groessten Marken.** Sie ist duenn besetzt - ein
 * bis zwei Marken je Kachel - und genau das macht sie zur Ausnahme im Bild:
 * der alte Baum, der Doppelgipfel, der Duenenkamm, der Feldstein, das Schaf.
 * Groesse als
 * Unterschied wirkt nur, wenn das Grosse selten ist.
 */
export const TILES: Readonly<Record<TextureLayer, Readonly<Record<TerrainId, Tile>>>> = {
  base: {
    forest: { w: 0.62, h: 0.53 },
    pasture: { w: 0.53, h: 0.45 },
    fields: { w: 0.66, h: 0.245 },
    hills: { w: 0.64, h: 0.42 },
    mountains: { w: 0.7, h: 0.55 },
    desert: { w: 0.56, h: 0.355 },
  },
  scatter: {
    forest: { w: 0.97, h: 0.83 },
    pasture: { w: 0.79, h: 0.67 },
    fields: { w: 0.71, h: 0.53 },
    hills: { w: 0.93, h: 0.61 },
    mountains: { w: 1.07, h: 0.86 },
    desert: { w: 0.87, h: 0.63 },
  },
};

/** Die Id, unter der ein Gelaende eine seiner Kacheln in `<defs>` ablegt. */
export function patternId(terrain: TerrainId, layer: TextureLayer): string {
  return layer === 'base' ? `terrain-${terrain}` : `terrain-${terrain}-scatter`;
}

/** Womit ein Feld gefuellt wird, nachdem seine Gelaendefarbe liegt. */
export function terrainFill(terrain: TerrainId, layer: TextureLayer): string {
  return `url(#${patternId(terrain, layer)})`;
}

/** Alle zwoelf Kacheln. Gehoert in die `defs` des Bretts. */
export function TerrainPatterns(): JSX.Element {
  return (
    <>
      {LAYERS.flatMap((layer) =>
        (Object.keys(TERRAIN_LABELS) as TerrainId[]).map((terrain) => (
          <pattern
            key={patternId(terrain, layer)}
            id={patternId(terrain, layer)}
            data-testid={patternId(terrain, layer)}
            /*
             * Die Gelaendeklasse traegt die **Staerke** der Textur, und die ist
             * je Feld eine andere - siehe `.terrain-tile--*` in `index.css`.
             * Sie steht hier und nicht an der Marke, damit eine Kachel genau
             * eine Tinte hat: was in ihr gezeichnet wird, ist dieselbe Farbe,
             * ob gefuellt oder gestrichen.
             *
             * **Die Streulage bekommt dieselbe Tinte, absichtlich.** Ein
             * grosser Baum ist kein blasser Baum; waere die zweite Lage leiser,
             * saehe sie aus wie ein Fehldruck hinter der ersten statt wie der
             * aelteste Baum im Bestand.
             */
            className={`terrain-tile terrain-tile--${terrain}`}
            patternUnits="userSpaceOnUse"
            width={TILES[layer][terrain].w}
            height={TILES[layer][terrain].h}
          >
            {MARKS[layer][terrain]}
          </pattern>
        )),
      )}
    </>
  );
}

/**
 * Was in einer Kachel steht.
 *
 * Drei Regeln gelten fuer alle zwoelf:
 *
 * 1. **Was den Rand beruehrt, beruehrt ihn auf beiden Seiten auf derselben
 *    Hoehe.** Eine Linie, die bei x = 0 auf y anfaengt, muss bei x = Breite auf
 *    demselben y enden - sonst zeigt jede Kachelgrenze einen Knick, und aus
 *    einer Textur wird ein Gitter. `terrain.test.tsx` rechnet das nach.
 * 2. **Nichts ragt aus der Kachel heraus**, denn die Kachel schneidet ab. Ein
 *    Kontrollpunkt darf draussen liegen, die Kurve selbst nicht.
 * 3. **Der Abstand ueber die Kachelgrenze ist so gross wie die Abstaende
 *    darin.** Wer alle Marken brav in die Mitte setzt, bekommt am Rand eine
 *    leere Gasse - und die zeichnet genau das Raster nach, das man loswerden
 *    wollte. Die Marken stehen deshalb bis dicht an den Rand.
 */
const MARKS: Readonly<Record<TextureLayer, Readonly<Record<TerrainId, JSX.Element>>>> = {
  base: {
    /**
     * Wald: sechs Tannen je Kachel, von 0.1 bis 0.2 hoch.
     *
     * Die Silhouette ist die von der Holzkarte (`ResourceGlyph.lumber`), auf
     * einen Absatz heruntergebracht. **Es aendert sich nicht nur die Hoehe,
     * sondern auch die Breite je Hoehe** (`spread`): eine junge Tanne ist
     * schmal, eine alte sperrig. Dieselbe Form in zwei Groessen liest sich als
     * eine Form; zwei Formen in sechs Groessen liest sich als Bestand.
     */
    forest: (
      <g className="terrain-fill">
        <path d={fir(0.115, 0.215, 0.2, 0.3)} />
        <path d={fir(0.33, 0.145, 0.125, 0.36)} />
        <path d={fir(0.5, 0.255, 0.165, 0.27)} />
        <path d={fir(0.225, 0.42, 0.145, 0.34)} />
        <path d={fir(0.435, 0.5, 0.1, 0.3)} />
        <path d={fir(0.045, 0.475, 0.115, 0.32)} />
      </g>
    ),

    /**
     * Weide: sieben Grasbueschel je Kachel, von 0.048 bis 0.085 hoch.
     *
     * Rundungen gegen die Spitzen des Waldes - das ist die Unterscheidung, die
     * auch ohne Farbe traegt, und sie war der eigentliche Grund fuer die ganze
     * Textur: Wald und Weide sind zwei Gruen.
     */
    pasture: (
      <g className="terrain-line">
        <path d={tuft(0.075, 0.115, 0.085)} />
        <path d={tuft(0.245, 0.085, 0.055)} />
        <path d={tuft(0.415, 0.14, 0.07)} />
        <path d={tuft(0.155, 0.275, 0.048)} />
        <path d={tuft(0.335, 0.315, 0.078)} />
        <path d={tuft(0.055, 0.4, 0.062)} />
        <path d={tuft(0.46, 0.43, 0.052)} />
      </g>
    ),

    /**
     * Korn: zwei durchlaufende Furchen je Kachel - und sie sind ungleich.
     *
     * **Das ist der Unterschied zur Wueste.** Eine Furche laeuft durch, ueber
     * jede Kachelgrenze und ueber jede Feldgrenze; ein Rippel ist gebrochen.
     * Damit tragen die beiden Felder verschiedene Texturen und nicht mehr
     * dieselbe in zwei Farben.
     *
     * Die zwei Furchen haben verschiedene Auslenkung, andere Phase und
     * ungleich lange Boegen. Zwei gleiche Wellen untereinander sind ein
     * Streifenmuster; zwei ungleiche sind ein gepfluegter Acker.
     *
     * Dazwischen liegen **Stoppeln**: kurze Striche quer zur Furche. Sie sind
     * die zweite Art im Feld - eine Richtung allein ist noch kein Material.
     */
    fields: (
      <g className="terrain-line">
        <path d="M 0 0.058 Q 0.09 0.033 0.19 0.052 Q 0.3 0.073 0.41 0.05 Q 0.53 0.028 0.66 0.058" />
        <path d="M 0 0.176 Q 0.13 0.203 0.25 0.182 Q 0.36 0.163 0.47 0.19 Q 0.57 0.212 0.66 0.176" />
        <path d="M 0.095 0.121 L 0.128 0.116" />
        <path d="M 0.385 0.115 L 0.415 0.121" />
        <path d="M 0.245 0.238 L 0.277 0.233" />
        <path d="M 0.545 0.236 L 0.575 0.241" />
      </g>
    ),

    /**
     * Huegel: Ziegel im Verband - die Lehmgrube als Material.
     *
     * Gezeichnet wird die Fuge, nicht der Stein. **Der Verband ist jetzt wild
     * und nicht mehr regelmaessig:** vier Lagen von 0.09 bis 0.115 Hoehe, zwei
     * bis drei Steine je Lage, jeder anders lang. Der alte halbe Versatz war
     * ein Laeuferverband, und ein Laeuferverband ist gerade **das** Gitter -
     * regelmaessiger geht es nicht.
     *
     * **Keine Fuge liegt auf der Kachelkante.** Eine Linie genau bei y = 0
     * wird von der Kachel halbiert und kommt schmaler heraus als ihre
     * Nachbarinnen - im Verband faellt eine halb so breite Lagerfuge sofort
     * auf. Die unterste Lage laeuft deshalb ueber die Grenze, und ihre
     * Stossfugen sind in zwei Stuecke geteilt: oben 0.35 bis 0.42, unten 0 bis
     * 0.045. Zusammengesetzt ist es eine Lage von 0.115 wie die anderen.
     */
    hills: (
      <g className="terrain-line">
        <path d="M 0 0.045 L 0.64 0.045" />
        <path d="M 0 0.135 L 0.64 0.135" />
        <path d="M 0 0.25 L 0.64 0.25" />
        <path d="M 0 0.35 L 0.64 0.35" />
        <path d="M 0.155 0.045 L 0.155 0.135" />
        <path d="M 0.44 0.045 L 0.44 0.135" />
        <path d="M 0.065 0.135 L 0.065 0.25" />
        <path d="M 0.3 0.135 L 0.3 0.25" />
        <path d="M 0.545 0.135 L 0.545 0.25" />
        <path d="M 0.215 0.25 L 0.215 0.35" />
        <path d="M 0.475 0.25 L 0.475 0.35" />
        <path d="M 0.115 0.35 L 0.115 0.42" />
        <path d="M 0.115 0 L 0.115 0.045" />
        <path d="M 0.375 0.35 L 0.375 0.42" />
        <path d="M 0.375 0 L 0.375 0.045" />
        <path d="M 0.585 0.35 L 0.585 0.42" />
        <path d="M 0.585 0 L 0.585 0.045" />
      </g>
    ),

    /**
     * Gebirge: sechs Grate und vier Geroellstriche.
     *
     * **Kein Grat ist gleichschenklig.** Vorher waren es vier symmetrische
     * Winkel - und eine gespiegelte Figur ist die symmetrischste, die es gibt;
     * viermal gesetzt wird daraus eine Steppdecke. Jetzt hat jeder Grat eine
     * laengere und eine kuerzere Flanke, und welche laenger ist, wechselt.
     *
     * Sie unterscheiden sich von den Tannen dadurch, dass sie offen stehen:
     * der Grat hat keinen Fuss, die Tanne ist geschlossen.
     *
     * Das **Geroell** ist die zweite Art - kurze, fast waagerechte Striche da,
     * wo ein Hang auslaeuft, und damit das genaue Gegenteil der Flanke
     * darueber.
     */
    mountains: (
      <g className="terrain-line">
        <path d={peak(0.1, 0.035, 0.115, 0.085, 0.062)} />
        <path d={peak(0.285, 0.07, 0.08, 0.048, 0.072)} />
        <path d={peak(0.545, 0.02, 0.145, 0.105, 0.078)} />
        <path d={peak(0.19, 0.29, 0.1, 0.058, 0.09)} />
        <path d={peak(0.44, 0.325, 0.062, 0.05, 0.038)} />
        <path d={peak(0.625, 0.3, 0.115, 0.07, 0.068)} />
        <path d="M 0.215 0.215 L 0.255 0.208" />
        <path d="M 0.055 0.475 L 0.1 0.482" />
        <path d="M 0.33 0.5 L 0.372 0.494" />
        <path d="M 0.5 0.465 L 0.545 0.472" />
      </g>
    ),

    /**
     * Wueste: gebrochene Rippel und zwei Kiesel.
     *
     * **Die alte Wueste war der Acker.** Beide trugen eine durchlaufende
     * Sinuswelle; welches Feld man vor sich hatte, sagte allein die Farbe -
     * und Farbe ist nie der einzige Traeger (Designregel 7). Sand liegt auch
     * gar nicht in Furchen: der Wind legt ihn in kurze, versetzte Rippel, die
     * anfangen und aufhoeren. Genau das steht jetzt da, in fuenf deutlich
     * verschiedenen Laengen von 0.12 bis 0.25.
     *
     * Die zwei Kiesel sind Striche von rund einer Strichbreite Laenge - mit
     * runder Kappe ist das ein Punkt. Sie sind die Ausnahme, die zeigt, dass
     * der Rest Sand ist.
     */
    desert: (
      <g className="terrain-line">
        <path d="M 0.03 0.075 Q 0.135 0.02 0.24 0.075" />
        <path d="M 0.315 0.115 Q 0.39 0.075 0.465 0.115" />
        <path d="M 0.12 0.215 Q 0.245 0.155 0.37 0.215" />
        <path d="M 0.415 0.3 Q 0.475 0.265 0.535 0.3" />
        <path d="M 0.045 0.325 Q 0.155 0.275 0.265 0.325" />
        <path d="M 0.2 0.125 L 0.208 0.13" />
        <path d="M 0.485 0.185 L 0.495 0.19" />
      </g>
    ),
  },

  scatter: {
    /** Zwei alte Tannen - 0.26 und 0.185 gegen hoechstens 0.2 in der Grundlage. */
    forest: (
      <g className="terrain-fill">
        <path d={fir(0.63, 0.6, 0.26, 0.31)} />
        <path d={fir(0.22, 0.3, 0.185, 0.26)} />
      </g>
    ),

    /**
     * Ein Mutterschaf, ein Lamm und ein Stein.
     *
     * **Warum das Schaf in die Streulage gehoert und nicht in die Grundlage.**
     * Eine Grundkachel misst 0.53 x 0.45; ein Feld traegt rund vierzehn davon.
     * Ein Schaf je Grundkachel waeren vierzehn Schafe auf einem Feld, und das
     * ist keine Weide mehr, sondern eine Tapete mit Schafen. Die Streukachel
     * ist gut doppelt so gross: rund sechseinhalb je Feld, also ein knappes
     * Dutzend Tiere in sechs Gruppen. Damit bleibt das Gras das Material
     * (Grundlage) und das Schaf die **Ausnahme** darauf - genau die Rolle, die
     * die Streulage hier schon fuer den alten Baum und den Doppelgipfel
     * spielt.
     *
     * **Zwei Groessen und keine zwei gleichen.** Mutterschaf (0.2) und Lamm
     * (0.14) stehen beieinander wie auf der Koppel; zwei gleich grosse Tiere
     * nebeneinander waeren wieder das Punktraster, das die ganze Textur
     * loswerden will.
     *
     * **Gefuellt und nicht gestrichen** - als einzige Marke der Weide. Ein
     * Umriss in Strichbreite 0.02 um einen Koerper von 0.13 Hoehe waere zu
     * einem Sechstel Kontur; die Silhouette ist das, was ein Schaf auf diese
     * Entfernung ausmacht. Es ist damit dieselbe Zeichnung wie auf der
     * Wollkarte (`panels/ResourceGlyph.tsx`): dunkler Koerper, runder Kopf,
     * zwei Beine. Wer die Karte kennt, erkennt das Feld, das sie abwirft.
     */
    pasture: (
      <>
        <g className="terrain-fill">
          <path d={sheep(0.07, 0.3, 0.2)} />
          <path d={sheep(0.45, 0.55, 0.14)} />
        </g>
        <g className="terrain-line">
          <path d="M 0.655 0.185 Q 0.71 0.117 0.765 0.185" />
        </g>
      </>
    ),

    /**
     * Feldsteine: zwei liegende Boegen quer ueber die Furchen.
     *
     * Sie brechen die Zeile, ohne die Richtung zu bestreiten - genau das, was
     * ein Stein im Acker tut, und der Grund, warum ein gepfluegtes Feld aus der
     * Luft nie wie Streifenpapier aussieht.
     */
    fields: (
      <g className="terrain-line">
        <path d="M 0.185 0.185 Q 0.235 0.13 0.29 0.185" />
        <path d="M 0.5 0.395 Q 0.535 0.355 0.575 0.395" />
      </g>
    ),

    /**
     * Ein Riss ueber mehrere Lagen und ein Abplatzer.
     *
     * Der Riss laeuft schraeg durch den Verband und ist damit die einzige
     * Linie im Feld, die weder waagerecht noch senkrecht steht. Eine Lehmwand
     * ohne Riss ist eine Zeichnung von einer Lehmwand.
     */
    hills: (
      <g className="terrain-line">
        <path d="M 0.34 0.13 L 0.4 0.235 L 0.365 0.335 L 0.425 0.44" />
        <path d="M 0.71 0.29 Q 0.75 0.245 0.79 0.29" />
      </g>
    ),

    /** Ein Doppelgipfel, gut doppelt so hoch wie der hoechste Grat der Grundlage. */
    mountains: (
      <g className="terrain-line">
        <path d="M 0.3 0.62 L 0.45 0.33 L 0.545 0.45 L 0.66 0.24 L 0.82 0.62" />
        <path d={peak(0.16, 0.15, 0.13, 0.09, 0.075)} />
      </g>
    ),

    /** Ein Duenenkamm - ein langer flacher Bogen - und eine Steingruppe. */
    desert: (
      <g className="terrain-line">
        <path d="M 0.14 0.42 Q 0.36 0.28 0.6 0.4" />
        <path d="M 0.66 0.16 Q 0.7 0.115 0.745 0.16" />
      </g>
    ),
  },
};

/**
 * Eine Tanne, auf einen Absatz gebracht.
 *
 * `cx` ist die Mitte, `baseY` der Fuss, `h` die Hoehe, `spread` die halbe
 * Breite im Verhaeltnis zur Hoehe. Die Breite haengt an der Hoehe, damit eine
 * kleinere Tanne wie eine juengere aussieht und nicht wie eine gestauchte -
 * und `spread` variiert dazu die Art: 0.26 ist eine schmale junge, 0.36 eine
 * sperrige alte. Ohne den zweiten Freiheitsgrad ist jede Tanne dieselbe Tanne
 * in einem anderen Zoom, und das sieht man einer Flaeche an.
 */
function fir(cx: number, baseY: number, h: number, spread: number): string {
  const w = spread * h;
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

/**
 * Ein Schaf, von der Seite - Koerper, Kopf, zwei Beine.
 *
 * `x` ist die linke Kante, `y` die Standlinie, `w` die Groesse. Gezeichnet
 * wird in Anteilen von `w`, damit Mutterschaf und Lamm dieselbe Figur in zwei
 * Groessen sind und nicht zwei Zeichnungen desselben Tiers.
 *
 * **Der Ruecken ist eine Folge von Boegen und keine Linie.** Drei Q-Segmente
 * mit verschieden hohen Kontrollpunkten geben dem Vlies seine Beulen; ein
 * glatter Ruecken sieht aus wie ein Schwein.
 *
 * **Das Tier grast, und das ist eine Entscheidung ueber Lesbarkeit und nicht
 * ueber Stimmung.** In der ersten Fassung stand der Kopf waagerecht neben dem
 * Widerrist - im Browser nachgesehen verschwand er darin, und uebrig blieb ein
 * Klumpen mit vier Beinen. Ein gesenkter Kopf haengt schraeg unter der
 * Rueckenlinie und ist damit die einzige Kante der Figur, die weder
 * waagerecht noch senkrecht laeuft. Genau daran erkennt man auf achtzehn Pixel
 * ein Tier und nicht bloss einen Fleck.
 *
 * **Die Beine sind kurz und breit** (0.12 w gegen 0.28 w Laenge). Ein
 * anatomisch richtiges Bein waere bei dieser Groesse ein Strich von einem
 * Pixel Breite, und ein Pixel Breite ist die Grenze, unterhalb derer der
 * Browser nicht mehr duenner, sondern blasser zeichnet - dieselbe Falle, an
 * der die ganze Textur schon einmal fast verschwunden waere.
 *
 * Nur `M`, `L`, `Q` und `Z`, alles absolut: `board/terrain.test.tsx` nimmt
 * jeden Kachelpfad auseinander und kennt keine anderen Befehle.
 */
function sheep(x: number, y: number, w: number): string {
  const px = (unit: number): string => r(x + unit * w);
  const py = (unit: number): string => r(y - unit * w);

  return [
    `M ${px(0.02)} ${py(0.34)}`,
    // Ruecken: drei Vliesbeulen von der Kruppe bis zum Widerrist.
    `Q ${px(0)} ${py(0.58)} ${px(0.14)} ${py(0.62)}`,
    `Q ${px(0.24)} ${py(0.76)} ${px(0.36)} ${py(0.66)}`,
    `Q ${px(0.48)} ${py(0.78)} ${px(0.6)} ${py(0.66)}`,
    `Q ${px(0.7)} ${py(0.7)} ${px(0.74)} ${py(0.58)}`,
    // Kurzer Hals, klobiger Kopf - beides schraeg nach unten ins Gras.
    `L ${px(0.83)} ${py(0.52)}`,
    `Q ${px(0.99)} ${py(0.46)} ${px(0.97)} ${py(0.3)}`,
    `Q ${px(0.95)} ${py(0.19)} ${px(0.83)} ${py(0.22)}`,
    `L ${px(0.75)} ${py(0.32)}`,
    // Vorderbein, Bauch, Hinterbein - und zurueck zum Schwanz.
    `L ${px(0.7)} ${py(0.3)}`,
    `L ${px(0.7)} ${py(0)}`,
    `L ${px(0.58)} ${py(0)}`,
    `L ${px(0.58)} ${py(0.28)}`,
    `L ${px(0.26)} ${py(0.28)}`,
    `L ${px(0.26)} ${py(0)}`,
    `L ${px(0.14)} ${py(0)}`,
    `L ${px(0.14)} ${py(0.3)}`,
    'Z',
  ].join(' ');
}

/**
 * Ein Bergruecken: zwei Flanken, die sich an der Spitze treffen.
 *
 * `left` und `right` sind die **waagerechten** Laufweiten der beiden Flanken
 * und absichtlich getrennte Werte. Wer nur eine Breite uebergibt, zeichnet
 * einen gleichschenkligen Winkel - und genau die vier gleichschenkligen Winkel
 * waren der Grund, warum das Gebirge wie eine Steppdecke aussah.
 */
function peak(apexX: number, apexY: number, rise: number, left: number, right: number): string {
  return [
    `M ${r(apexX - left)} ${r(apexY + rise)}`,
    `L ${r(apexX)} ${r(apexY)}`,
    `L ${r(apexX + right)} ${r(apexY + rise)}`,
  ].join(' ');
}

/** Vier Nachkommastellen - eine Kachel misst rund ein Drittel. */
function r(value: number): string {
  return Number(value.toFixed(4)).toString();
}
