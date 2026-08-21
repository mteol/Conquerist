// @vitest-environment jsdom
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';
import { TERRAIN_LABELS, type TerrainId } from '@conquerist/shared';
import { render } from '../test/dom';
import { LAYERS, TILES, TerrainPatterns, patternId, terrainFill } from './terrain';

/**
 * Die Textur wird **nachgerechnet**, nicht angesehen.
 *
 * Bei einer gekachelten Flaeche ist das Wichtigste unsichtbar, solange es
 * stimmt, und springt sofort ins Auge, sobald es nicht stimmt: die Naht. Eine
 * Linie, die bei x = 0 auf einer anderen Hoehe anfaengt als sie bei x = Breite
 * endet, macht aus jeder Kachelgrenze einen Knick - und aus einer Textur ein
 * Gitter. Am Bildschirm sieht man das erst, wenn man weiss, wonach man sucht;
 * ausgerechnet ist es eindeutig.
 *
 * **Dazu kommen jetzt drei Pruefungen, die der Playtest verlangt hat.** Der
 * Befund lautete „alles zu symmetrisch, und Acker und Sand tragen dieselbe
 * Textur", und alle drei Teile davon sind rechenbar:
 *
 * - dass die zwei Lagen eines Gelaendes sich erst weit ausserhalb des Bretts
 *   gemeinsam wiederholen (sonst ist die zweite Lage nur eine zweite Kachel),
 * - dass die Marken einer Kachel verschieden **gross** sind,
 * - dass die groesste Marke eines Gelaendes in **keinem anderen** noch einmal
 *   vorkommt, und zwar formgleich geprueft, nicht zeichengleich. Genau daran
 *   waere der alte Stand gescheitert: Acker und Wueste trugen dieselbe
 *   Sinuswelle in zwei Groessen, und zwei verschiedene `d`-Zeichenketten haetten
 *   das nie verraten.
 */

const TERRAINS = Object.keys(TERRAIN_LABELS) as TerrainId[];

describe('TerrainPatterns', () => {
  it('legt fuer jedes Gelaende beide Lagen an', () => {
    const { container } = render(<Probe />);

    for (const layer of LAYERS) {
      for (const terrain of TERRAINS) {
        const tile = container.querySelector(`#${patternId(terrain, layer)}`);

        expect(tile, `${terrain}/${layer} hat keine Kachel`).not.toBeNull();
        expect(tile!.querySelectorAll('path').length).toBeGreaterThan(0);
        expect(terrainFill(terrain, layer)).toBe(`url(#${patternId(terrain, layer)})`);
      }
    }
  });

  /**
   * Die Textur haengt am Brett, nicht am Feld.
   *
   * `objectBoundingBox` waere die Voreinstellung und genau falsch: dann rechnet
   * jedes Feld die Kachel auf seine eigene Flaeche, und zwei benachbarte
   * Waldfelder zeigen zwei Kacheln statt eines Waldes. Mit `userSpaceOnUse`
   * laeuft die Textur ueber die Feldgrenze durch.
   */
  it('verankert jede Kachel am Brett und nicht am einzelnen Feld', () => {
    const { container } = render(<Probe />);

    for (const layer of LAYERS) {
      for (const terrain of TERRAINS) {
        const tile = container.querySelector(`#${patternId(terrain, layer)}`)!;

        expect(tile.getAttribute('patternUnits'), terrain).toBe('userSpaceOnUse');
        expect(Number(tile.getAttribute('width'))).toBe(TILES[layer][terrain].w);
        expect(Number(tile.getAttribute('height'))).toBe(TILES[layer][terrain].h);
      }
    }
  });

  /**
   * Die Kachel traegt ihre Gelaendeklasse - und daran haengt ihre Farbe.
   *
   * Die Staerke der Textur steht **je Gelaende** im Blatt
   * (`.terrain-tile--forest` und die fuenf anderen in `index.css`), weil eine
   * Tinte auf sechs verschiedenen Gruenden nicht sechsmal dieselbe Textur ist.
   * Die Kopplung zwischen hier und dort ist eine Zeichenkette, und eine
   * Zeichenkette bricht still: wer die Klasse umbenennt, bekommt keinen
   * Fehler, sondern eine Kachel, die auf `--terrain-ink` aus dem Nichts
   * zurueckfaellt - also unsichtbar wird.
   *
   * **Beide Lagen tragen dieselbe Klasse, und das ist Absicht.** Ein grosser
   * Baum ist kein blasser Baum.
   *
   * Was hier **nicht** geprueft werden kann, ist die Farbe selbst: jsdom
   * rechnet keine Kaskade aus. Geprueft wird die Klasse; dass sie ankommt,
   * ist im Browser gemessen und steht in `PROGRESS.md`.
   */
  it('gibt jeder Kachel ihre Gelaendeklasse', () => {
    const { container } = render(<Probe />);

    for (const layer of LAYERS) {
      for (const terrain of TERRAINS) {
        const tile = container.querySelector(`#${patternId(terrain, layer)}`)!;
        const classes = (tile.getAttribute('class') ?? '').split(/\s+/);

        expect(classes, `${terrain}/${layer} traegt keine Gelaendeklasse`).toContain(
          `terrain-tile--${terrain}`,
        );
      }
    }
  });

  /**
   * Nichts wird so klein, dass die Form verschwindet.
   *
   * Eine Tanne war einmal **6.8 Pixel** hoch (65 Pixel je Bretteinheit, im
   * Browser gemessen) - in dieser Groesse ist eine Silhouette kein Baum mehr,
   * sondern ein Fleck, und ein Fleck traegt die Gelaendeunterscheidung nicht,
   * um derentwillen die Textur ueberhaupt existiert.
   *
   * **Die Ausnahme fuer Acker und Wueste ist weggefallen.** Sie stand hier,
   * solange beide eine flache Welle trugen, bei der nur die Richtung zaehlte.
   * Beide tragen jetzt zwei Marken uebereinander und sind hoch genug fuer die
   * Regel, die fuer alle anderen auch gilt.
   */
  it('haelt jede Kachel gross genug, dass ihre Form eine Form bleibt', () => {
    for (const layer of LAYERS) {
      for (const terrain of TERRAINS) {
        const { w, h } = TILES[layer][terrain];

        expect(w, `${terrain}/${layer}: die Kachel ist zu schmal`).toBeGreaterThanOrEqual(0.28);
        expect(h, `${terrain}/${layer}: die Kachel ist zu flach`).toBeGreaterThanOrEqual(0.13);
      }
    }
  });

  /**
   * Die zwei Lagen duerfen sich auf dem Brett nie gemeinsam wiederholen.
   *
   * **Das ist der ganze Grund fuer die zweite Lage.** Ein `<pattern>` ist per
   * Definition periodisch; eine Lage allein zeigt darum immer ein Raster, egal
   * wie unregelmaessig die Kachel gezeichnet ist. Erst zwei Lagen mit
   * teilerfremden Kantenlaengen ergeben ein Bild, das sich erst nach dem
   * kleinsten gemeinsamen Vielfachen beider Perioden wiederholt.
   *
   * Sobald jemand eine Kachel auf eine glatte Zahl zurechtruckt - 0.6 und 0.9
   * sieht harmlos aus - faellt das Vielfache auf 1.8, und die zweite Lage ist
   * ihr Geld nicht mehr wert. Zwoelf Einheiten sind knapp das Doppelte der
   * Brettbreite; darunter faellt es hier auf und nicht erst im Playtest.
   */
  it('laesst die zwei Lagen erst weit ausserhalb des Bretts zusammenfallen', () => {
    const BRETT = 12;

    for (const terrain of TERRAINS) {
      const base = TILES.base[terrain];
      const scatter = TILES.scatter[terrain];

      expect(
        commonPeriod(base.w, scatter.w),
        `${terrain}: die zwei Lagen wiederholen sich waagerecht schon nach kurzer Strecke`,
      ).toBeGreaterThan(BRETT);
      expect(
        commonPeriod(base.h, scatter.h),
        `${terrain}: die zwei Lagen wiederholen sich senkrecht schon nach kurzer Strecke`,
      ).toBeGreaterThan(BRETT);
    }
  });

  /**
   * In einer Kachel steht nicht sechsmal dieselbe Groesse.
   *
   * Der Playtest-Befund „zu symmetrisch" hatte drei Ursachen, und das hier ist
   * die zweite: gleich grosse Marken lesen sich als Punktraster mit Jitter,
   * auch wenn sie unregelmaessig stehen. Erst ein deutlicher Groessensprung -
   * anderthalbfach ist die Untergrenze, im Wald ist es das Doppelte - macht aus
   * einer Streuung einen Bestand.
   */
  it('setzt in jede Grundkachel Marken deutlich verschiedener Groesse', () => {
    const { container } = render(<Probe />);

    for (const terrain of TERRAINS) {
      const sizes = pathsOf(container, terrain, 'base').map((d) => sizeOf(d));

      expect(sizes.length, `${terrain}: keine Marken gefunden`).toBeGreaterThan(1);
      expect(
        Math.max(...sizes) / Math.min(...sizes),
        `${terrain}: alle Marken sind ungefaehr gleich gross`,
      ).toBeGreaterThanOrEqual(1.5);
    }
  });

  /**
   * Kein Gelaende traegt die Leitmarke eines anderen.
   *
   * **Der Befund, an dem diese Pruefung haengt:** Acker und Wueste waren
   * dieselbe Textur. Beide zeichneten eine durchlaufende Sinuswelle, einmal
   * 0.3 breit und einmal 0.34 - zwei verschiedene `d`-Zeichenketten, dieselbe
   * Form. Was die beiden Felder unterschied, war allein die Fuellfarbe, und
   * damit war die Textur genau dort wirkungslos, wo sie gebraucht wird: Farbe
   * ist nie der einzige Traeger (Designregel 7).
   *
   * Geprueft wird deshalb die **Form** und nicht der Text: jede Marke wird auf
   * ihren eigenen Rahmen normiert, sodass Groesse und Ort herausfallen und nur
   * der Umriss uebrig bleibt. Verglichen wird die groesste Marke je Kachel -
   * die, an der man das Gelaende erkennt. Kleines Beiwerk (ein Kiesel, ein
   * Stoppel, ein Geroellstrich) darf sich wiederholen; ein kurzer Strich sieht
   * normiert ohnehin ueberall gleich aus.
   */
  it('gibt jedem Gelaende eine Leitmarke, die es nur dort gibt', () => {
    const { container } = render(<Probe />);
    const seen = new Map<string, TerrainId>();

    for (const terrain of TERRAINS) {
      const leading = pathsOf(container, terrain, 'base').reduce((a, b) =>
        sizeOf(a) >= sizeOf(b) ? a : b,
      );
      const shape = signatureOf(leading);
      const other = seen.get(shape);

      expect(
        other,
        `${terrain} und ${other} tragen dieselbe Leitmarke - der Unterschied haengt dann allein an der Farbe`,
      ).toBeUndefined();
      seen.set(shape, terrain);
    }

    expect(seen.size).toBe(TERRAINS.length);
  });

  /**
   * Die Naht: was den einen Rand beruehrt, beruehrt den anderen genauso.
   *
   * Geprueft werden nur die Pfade, die die Kachel wirklich durchqueren - wer
   * bei x = 0 anfaengt, muss bei x = Breite auf derselben Hoehe herauskommen.
   * Ein Bueschel oder eine Tanne mitten in der Kachel geht das nichts an.
   */
  it('schliesst jede Kachel waagerecht ohne Knick', () => {
    const { container } = render(<Probe />);
    let geprueft = 0;

    for (const layer of LAYERS) {
      for (const terrain of TERRAINS) {
        const width = TILES[layer][terrain].w;

        for (const d of pathsOf(container, terrain, layer)) {
          const points = anchorsOf(d);
          const first = points[0]!;
          const last = points[points.length - 1]!;

          if (!near(first.x, 0) || !near(last.x, width)) continue;

          expect(
            last.y,
            `${terrain}/${layer}: die Linie faengt bei y ${first.y} an und endet bei y ${last.y} - das gibt an jeder Kachelgrenze einen Knick`,
          ).toBeCloseTo(first.y, 5);
          geprueft += 1;
        }
      }
    }

    // Ein Test, der nichts gezaehlt hat, hat nichts geprueft.
    expect(geprueft).toBeGreaterThan(0);
  });

  /**
   * Was aus der Kachel ragt, wird abgeschnitten - und ein abgeschnittener Baum
   * sieht aus wie ein Zeichenfehler.
   *
   * Kontrollpunkte duerfen draussen liegen (die Furche braucht das, sonst
   * bekaeme sie ihren Ausschlag nicht), gezeichnete Punkte nicht. Geprueft
   * werden deshalb die **Stuetzpunkte** der Pfade, nicht jede Zahl im `d`.
   */
  it('haelt jede Marke innerhalb ihrer Kachel', () => {
    const { container } = render(<Probe />);

    for (const layer of LAYERS) {
      for (const terrain of TERRAINS) {
        const { w, h } = TILES[layer][terrain];

        for (const d of pathsOf(container, terrain, layer)) {
          for (const { x, y } of anchorsOf(d)) {
            const drin = x >= -1e-9 && x <= w + 1e-9 && y >= -1e-9 && y <= h + 1e-9;

            expect(
              drin,
              `${terrain}/${layer}: (${x}, ${y}) liegt ausserhalb der Kachel ${w} x ${h}`,
            ).toBe(true);
          }
        }
      }
    }
  });
});

function Probe(): JSX.Element {
  return (
    <svg viewBox="0 0 1 1">
      <defs>
        <TerrainPatterns />
      </defs>
    </svg>
  );
}

/** Die `d`-Zeichenketten einer Kachel, in Zeichenreihenfolge. */
function pathsOf(container: Element, terrain: TerrainId, layer: 'base' | 'scatter'): string[] {
  return [...container.querySelectorAll(`#${patternId(terrain, layer)} path`)].map(
    (path) => path.getAttribute('d') ?? '',
  );
}

interface Sample {
  readonly x: number;
  readonly y: number;
}

interface Trace {
  /** Die Befehlsfolge, `Q` eingeschlossen - sie gehoert zur Form. */
  readonly commands: readonly string[];
  /** Jede Koordinate im Pfad, Kontrollpunkte eingeschlossen. */
  readonly all: readonly Sample[];
  /** Nur die Punkte, die wirklich auf der Kurve liegen. */
  readonly anchors: readonly Sample[];
}

/**
 * Ein Pfad, auseinandergenommen.
 *
 * `M` und `L` tragen je einen Punkt, `Q` deren zwei, von denen nur der zweite
 * auf der Kurve liegt. Die Pfade hier benutzen nur diese drei Befehle plus `Z`,
 * alle mit absoluten Koordinaten; alles andere waere ein stiller Fehler und
 * faellt deshalb auf.
 *
 * **Der Unterschied zwischen `anchors` und `all` ist der Grund, warum es zwei
 * Listen gibt.** Fuer die Kachelgrenze zaehlt nur, was gezeichnet wird - ein
 * Kontrollpunkt darf draussen liegen. Fuer die **Form** zaehlt er mit: die alte
 * Ackerwelle hatte drei Stuetzpunkte auf einer Geraden, ihre ganze Welle steckte
 * in den Kontrollpunkten. Wer die weglaesst, vergleicht bei jeder Welle
 * dieselbe waagerechte Linie und findet nie einen Unterschied.
 */
function traceOf(d: string): Trace {
  const commands: string[] = [];
  const all: Sample[] = [];
  const anchors: Sample[] = [];
  const tokens = d.trim().split(/[\s,]+/);
  let index = 0;

  while (index < tokens.length) {
    const command = tokens[index++]!;

    if (command === 'Z' || command === 'z') {
      commands.push('Z');
      continue;
    }

    expect(['M', 'L', 'Q'], `unerwarteter Pfadbefehl "${command}" in "${d}"`).toContain(command);
    commands.push(command);

    const count = command === 'Q' ? 2 : 1;

    for (let taken = 0; taken < count; taken += 1) {
      const x = Number(tokens[index++]);
      const y = Number(tokens[index++]);

      expect(Number.isFinite(x) && Number.isFinite(y), `kaputte Koordinate in "${d}"`).toBe(true);
      all.push({ x, y });
      if (taken === count - 1) anchors.push({ x, y });
    }
  }

  return { commands, all, anchors };
}

function anchorsOf(d: string): readonly Sample[] {
  return traceOf(d).anchors;
}

/** Die laengere Kante des Rahmens, in den eine Marke passt. */
function sizeOf(d: string): number {
  const { all } = traceOf(d);
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);

  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/**
 * Die Form einer Marke ohne ihre Groesse und ihren Ort.
 *
 * Jede Koordinate wird auf den eigenen Rahmen der Marke normiert und auf zwei
 * Stellen gerundet; uebrig bleibt der Umriss. Zwei Wellen, die sich nur in der
 * Skalierung unterscheiden, ergeben damit dieselbe Zeichenkette - und genau
 * das soll auffallen.
 *
 * Eine Kante ohne Ausdehnung (eine waagerechte Linie hat keine Hoehe) wird zu
 * null, statt durch null zu teilen.
 */
function signatureOf(d: string): string {
  const { commands, all } = traceOf(d);
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const span = {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
  const unit = (value: number, low: number, high: number): number =>
    high === low ? 0 : Number(((value - low) / (high - low)).toFixed(2));

  let index = 0;

  return commands
    .map((command) => {
      if (command === 'Z') return 'Z';

      const count = command === 'Q' ? 2 : 1;
      const points = all.slice(index, index + count);
      index += count;

      return `${command} ${points
        .map((point) => `${unit(point.x, span.x0, span.x1)},${unit(point.y, span.y0, span.y1)}`)
        .join(' ')}`;
    })
    .join(' ');
}

/**
 * Nach welcher Strecke zwei Perioden wieder gemeinsam anfangen.
 *
 * Ueber ganze Tausendstel gerechnet, weil ein `ggT` auf Gleitkommazahlen keine
 * verlaessliche Antwort gibt - und Tausendstel sind vier Stellen feiner als
 * jede Kachelkante hier.
 */
function commonPeriod(a: number, b: number): number {
  const x = Math.round(a * 1000);
  const y = Math.round(b * 1000);

  return (x * y) / gcd(x, y) / 1000;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < 1e-9;
}
