import type { CSSProperties, JSX } from 'react';

/**
 * Die Wortmarke „Conquerist" - gezeichnet, nicht gesetzt.
 *
 * **Warum kein Font.** Regel 3 verbietet den Font-Download, und das aus einem
 * guten Grund: eine geladene Displayschrift ist der Charakter von jemand
 * anderem. Die Systemschrift traegt den Titel zwar, aber sie traegt ihn wie
 * jede Ueberschrift auch. Also bekommt genau das eine Wort, das oben steht,
 * eigene Buchstaben.
 *
 * **Die Idee in einem Satz:** die Schrift ist aus demselben Winkel geschnitten
 * wie das Brett. Wo eine normale Schrift rundet, hat sie eine Fase - C, O, Q, S
 * und U bekommen abgeschraegte Ecken statt Boegen; E, N, I, T sind ohnehin
 * eckig und bleiben, wie sie sind. Damit ist der Titel nicht „eine Schrift, die
 * zum Spiel passt", sondern aus dem Material des Bretts geschnitten - genau wie
 * das Hexfeld dahinter aus den Funktionen des Bretts gezeichnet ist.
 *
 * **Das Raster, auf dem alle zehn sitzen:**
 * - Versalhoehe 100 (y = 0 oben, y = 100 Grundlinie)
 * - Stammbreite 17, ueberall - senkrecht, waagerecht, im Bogenersatz
 * - Fase 17 aussen, 10 im Innenraum (die kleinere wirkt sonst zu weich)
 *
 * Wer einen Buchstaben aendert, haelt diese drei Zahlen ein. Eine Fase von 12
 * an einer Stelle sieht nicht nach Variante aus, sondern nach Versehen.
 *
 * **Kein `<text>`.** Ein SVG-Textelement waere wieder nur die Systemschrift,
 * nur in einem anderen Kasten. Und die Buchstaben muessen einzeln ansprechbar
 * sein: die Eingangsanimation laesst sie versetzt landen, damit das Wort
 * hereinschnellt statt hereinzurutschen.
 */

interface Glyph {
  /** Der Buchstabe selbst - nur zur Lesbarkeit der Tabelle und als React-Key. */
  readonly letter: string;
  /** Pfaddaten im lokalen Raster (0..breite waagerecht, 0..100 senkrecht). */
  readonly path: string;
  /** Wie weit der naechste Buchstabe rueckt. Fast immer die Zeichenbreite. */
  readonly advance: number;
}

/**
 * Die zehn Buchstaben von C bis T.
 *
 * Buchstaben mit Innenraum (O, Q, R) sind ein einziger Pfad aus zwei
 * geschlossenen Teilen, ausgewertet mit `evenodd` - der zweite Teil stanzt den
 * Innenraum aus. Zwei getrennte Pfade waeren zwei Formen uebereinander und
 * beim Faerben eine Fehlerquelle.
 */
const GLYPHS: readonly Glyph[] = [
  // C - offener Ring: Fase links oben und links unten, rechts flach beschnitten.
  { letter: 'C', path: 'M17 0H70V17H34L17 34V66L34 83H70V100H17L0 83V17Z', advance: 81 },

  // O - das Achteck des Systems in Reinform: vier Fasen aussen, vier innen.
  {
    letter: 'O',
    path: 'M17 0H53L70 17V83L53 100H17L0 83V17ZM27 17L17 27V73L27 83H43L53 73V27L43 17Z',
    advance: 81,
  },

  // N - keine Fase noetig, der Buchstabe ist von Haus aus geschnitten.
  { letter: 'N', path: 'M0 0H17L55 62V0H72V100H55L17 38V100H0Z', advance: 83 },

  // Q - das O, dessen rechte untere Fase in die Schwanzspitze weiterlaeuft.
  // Kein angesetzter Strich: der Schwanz ist dieselbe Kontur, nur weitergefuehrt.
  {
    letter: 'Q',
    path: 'M17 0H53L70 17V72L84 100H64L57 86L45 100H17L0 83V17ZM27 17L17 27V73L27 83H43L53 73V27L43 17Z',
    advance: 89,
  },

  // U - Fase aussen unten (17), Fase innen unten (10). Oben offen, also gerade.
  { letter: 'U', path: 'M0 0H17V73L27 83H43L53 73V0H70V83L53 100H17L0 83Z', advance: 81 },

  // E - der Mittelarm ist kuerzer als die beiden aeusseren, sonst kippt das Bild.
  { letter: 'E', path: 'M0 0H64V17H17V41H56V58H17V83H64V100H0Z', advance: 75 },

  // R - Bogen als Fase, und ein Bein, das ausschlaegt statt gerade zu fallen.
  {
    letter: 'R',
    path: 'M0 0H51L68 17V41L54 55L70 100H52L38 58H17V100H0ZM17 17V41H41L51 31V27L41 17Z',
    advance: 79,
  },

  // I - nur der Stamm. Bekommt spaeter mehr Luft als die anderen (siehe unten).
  { letter: 'I', path: 'M0 0H17V100H0Z', advance: 30 },

  // S - die beiden Kehren sind Fasen, der Mittelbalken etwas duenner als 17.
  // Das ist Absicht: ein S mit ueberall gleicher Staerke wirkt in der Mitte fett.
  {
    letter: 'S',
    path: 'M66 0V17H27L17 27V33L27 43H49L66 60V83L49 100H0V83H39L49 73V67L39 57H17L0 40V17L17 0Z',
    advance: 79,
  },

  // T - der Stamm sitzt mittig (24..41 bei 66 Breite).
  { letter: 'T', path: 'M0 0H66V17H41V100H24V17H0Z', advance: 66 },
];

/** Wie hoch das Raster ist. Die Breite ergibt sich aus den Vorschueben. */
const CAP_HEIGHT = 100;

/**
 * Wo jeder Buchstabe steht, und wie breit das Ganze wird.
 *
 * Die Vorschuebe stehen schon in der Tabelle, hier werden sie nur aufaddiert.
 * Der letzte Buchstabe zaehlt mit seiner Zeichenbreite und nicht mit seinem
 * Vorschub, sonst haengt rechts Luft in der Zeichenflaeche.
 */
function layout(): { readonly placed: readonly (Glyph & { x: number })[]; readonly width: number } {
  let x = 0;
  const placed = GLYPHS.map((glyph) => {
    const at = { ...glyph, x };
    x += glyph.advance;
    return at;
  });

  // „T" ist 66 breit und hat 66 Vorschub - der letzte Vorschub ist die Breite.
  return { placed, width: x };
}

const { placed: PLACED, width: WIDTH } = layout();

export interface WordmarkProps {
  /**
   * Ob die Buchstaben ihre Eingangsanimation spielen.
   *
   * Nur das Hauptmenue setzt das. Wo die Marke sonst noch stehen koennte, steht
   * sie einfach da - eine Animation, die bei jedem Aufruf wieder losgeht, waere
   * genau die Dekoration, die Regel 5 ausschliesst.
   */
  readonly animated?: boolean;
}

export function Wordmark({ animated = false }: WordmarkProps): JSX.Element {
  return (
    <svg
      className={animated ? 'wordmark wordmark--enter' : 'wordmark'}
      viewBox={`0 0 ${WIDTH} ${CAP_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {PLACED.map((glyph, index) => (
        <g
          key={`${glyph.letter}-${index}`}
          className="wordmark__letter"
          transform={`translate(${glyph.x} 0)`}
          // Die Reihenfolge steuert den Versatz beim Landen - der erste
          // Buchstabe kommt zuerst zur Ruhe, der letzte peitscht nach.
          style={{ '--i': index } as CSSProperties}
        >
          <path d={glyph.path} fillRule="evenodd" />
        </g>
      ))}
    </svg>
  );
}
