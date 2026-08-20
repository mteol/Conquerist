import type { CSSProperties, JSX } from 'react';

/**
 * Die Ziffern des Spiels - gezeichnet, nicht gesetzt.
 *
 * **Warum es sie gibt.** `Wordmark.tsx` hat dem Spiel ein eigenes
 * Buchstabensystem gegeben: aus demselben Winkel geschnitten wie das Brett, wo
 * eine Schrift rundet, sitzt eine Fase. Es stand danach genau einmal auf dem
 * Hauptmenue und nie wieder. Ueberall sonst - und vor allem auf dem
 * Zahlenchip, das meistbetrachtete Ding einer Partie - stand die
 * Systemschrift. Gezeichnetes Gelaende mit Tannen und Furchen, und darauf ein
 * Knopf-Serif-los aus 'Segoe UI': der Bruch war der Grund, warum die Flaeche
 * trotz aller Arbeit brav aussah.
 *
 * Die Ziffern schliessen ihn. Sie sind kein zweites System, sondern dasselbe:
 *
 * - Versalhoehe 100 (y = 0 oben, y = 100 Grundlinie)
 * - Stammbreite 17, senkrecht wie waagerecht wie im Bogenersatz
 * - Fase 17 aussen, 10 im engen Innenraum
 *
 * Wer eine Ziffer aendert, haelt diese drei Zahlen ein - eine Fase von 12 an
 * einer Stelle sieht nicht nach Variante aus, sondern nach Versehen.
 *
 * **Alle zehn haben denselben Vorschub.** Bei den Buchstaben ist er je Zeichen
 * verschieden; hier waere das ein Fehler. Regel 3 verlangt Tabellenziffern,
 * und in einem Spiel, in dem staendig Zahlen verglichen werden, darf keine
 * Ziffer springen: die schmale Eins bekommt denselben Platz wie die breite
 * Null, sonst wackelt „11" gegen „10" auf dem Nachbarchip.
 *
 * **Kein `<text>` und keine Metrik.** Das ist nicht nur Geschmack. Die Augen
 * unter der Chipzahl waren einmal ein `text` aus Mittelpunkten und ragten
 * ueber den Chiprand - zweimal, aus zwei Gruenden, und der zweite war, dass
 * die Breite eines Zeichens an den Metriken einer Schrift haengt, die auf
 * einem fremden Rechner fehlen kann. Sie sind deshalb gezeichnete Kreise
 * geworden. Die Zahl darueber blieb Schrift; dieselbe Begruendung galt fuer
 * sie die ganze Zeit mit. Jetzt ist auch sie eine Form, und die hat keine
 * Metrik, die eine fehlende Schrift veraendern koennte.
 */

/** Wie hoch das Raster ist - dasselbe wie bei der Wortmarke. */
const CAP_HEIGHT = 100;

/**
 * Der Vorschub je Ziffer, fuer alle zehn gleich.
 *
 * 81 wie „C", „O" und „U": Zeichenbreite 70 plus 11 Nachbreite. Die Eins ist
 * schmaler gezeichnet und bekommt trotzdem die vollen 81 - genau darin
 * besteht eine Tabellenziffer.
 */
const ADVANCE = 81;

/** Wie breit die breiteste Ziffer wirklich ist. Nur fuer die Zentrierung. */
const BODY = 70;

/**
 * Die zehn Ziffern.
 *
 * Wo eine Rundung waere, steht eine Fase - die Null ist damit das Achteck des
 * Systems in Reinform, dieselbe Kontur wie das „O" der Wortmarke. Ziffern mit
 * Innenraum (0, 4, 6, 8, 9) sind ein Pfad aus mehreren geschlossenen Teilen
 * und werden mit `evenodd` ausgewertet: der zweite Teil stanzt den Innenraum
 * aus. Zwei getrennte Pfade waeren zwei Formen uebereinander und beim Faerben
 * eine Fehlerquelle.
 */
const DIGITS: readonly string[] = [
  // 0 - das Achteck in Reinform, Kontur und Innenraum wie beim „O".
  'M17 0H53L70 17V83L53 100H17L0 83V17ZM27 17L17 27V73L27 83H43L53 73V27L43 17Z',

  // 1 - Stamm und Fahne, und die Fahne ist eine Fase. Kein Fuss: kein anderes
  // Zeichen des Systems hat einen, auch das „T" nicht.
  'M36 0H53V100H36V22H14Z',

  // 2 - Bogen oben, Diagonale, Fussbalken. Die Diagonale ist mit 20 Versatz
  // etwas staerker als der Stamm - so haelt es auch das „N" der Wortmarke,
  // eine Schraege in Stammbreite wirkt sonst duenner als ihre Nachbarn.
  'M17 0H53L70 17V45L30 83H70V100H0V83L53 33V27L43 17H27L17 27V38H0V17Z',

  // 3 - zwei Boegen an einer Taille. Der Mittelbalken laeuft bis 17 nach
  // links: kuerzer gelesen kippt das Zeichen in Richtung einer „8".
  'M17 0H53L70 17V36L60 46V54L70 64V83L53 100H17L0 83V72H17L27 83H43L53 73V66L43 56H17V43H43L53 33V27L43 17H27L17 27V38H0V17Z',

  // 4 - Stamm, Querbalken, Schraege. Der Innenraum ist ein Dreieck und klein;
  // das ist bei dieser Ziffer richtig und kein Versehen.
  'M43 0H60V63H70V80H60V100H43V80H0V72ZM43 34L25 63H43Z',

  // 5 - Kopfbalken, kurzer Stamm, Schale. Die Schale ist links offen.
  'M0 0H68V17H17V38H53L70 55V83L53 100H17L0 83V72H17L27 83H43L53 73V65L43 55H0Z',

  // 6 - Schale unten, und der Aufstrich ist eine Fase von 45 Grad. Damit ist
  // er dieselbe Linie, aus der auch die Ecken geschnitten sind.
  'M34 0H58L20 38H53L70 55V83L53 100H17L0 83V34ZM27 55L17 65V73L27 83H43L53 73V65L43 55Z',

  // 7 - Kopfbalken und Schraege. Der Fuss steht bei 14..34 und nicht weiter
  // links: sonst faellt das Zeichen aus seinem Vorschub heraus.
  'M0 0H70V17L34 100H14L50 17H0Z',

  // 8 - zwei Achtecke uebereinander. Die Taille ist mit 12 duenner als der
  // Stamm; gleich stark gesetzt wirkt sie in der Mitte fett.
  'M17 0H53L70 17V83L53 100H17L0 83V17ZM27 17L17 27V34L27 44H43L53 34V27L43 17ZM27 56L17 66V73L27 83H43L53 73V66L43 56Z',

  // 9 - die Sechs, um 180 Grad gedreht. Nicht neu gezeichnet, sondern am
  // Mittelpunkt (35, 50) gespiegelt: zwei Zeichnungen derselben Form waeren
  // zwei Gelegenheiten, sie verschieden zu machen.
  'M36 100H12L50 62H17L0 45V17L17 0H53L70 17V66ZM43 45L53 35V27L43 17H27L17 27V35L27 45Z',
];

/**
 * Wie breit eine Zahl im Raster ist.
 *
 * Vorschuebe bis zum letzten Zeichen, dann dessen Zeichenbreite - die
 * Nachbreite des letzten faellt weg, damit rechts keine Luft haengt, die links
 * keine Entsprechung hat. Oeffentlich, weil jeder, der eine Zahl selbst setzt
 * oder nachmisst, dieselbe Rechnung braucht; zweimal gerechnet waere sie
 * zweimal zu pflegen.
 */
export function numeralWidth(value: number): number {
  return (Math.trunc(Math.abs(value)).toString().length - 1) * ADVANCE + BODY;
}

/** Die Versalhoehe des Rasters. Alle Masse einer Zahl sind ein Anteil davon. */
export const NUMERAL_CAP = CAP_HEIGHT;

export interface NumeralProps {
  /** Die Zahl. Negative Werte kommen im Spiel nicht vor und sind keine gedacht. */
  readonly value: number;
  /** Mittelpunkt der Zahl in den Koordinaten des umgebenden SVG. */
  readonly cx: number;
  readonly cy: number;
  /** Versalhoehe in denselben Koordinaten. Alles andere rechnet sich daraus. */
  readonly cap: number;
  /**
   * Die Farbe.
   *
   * Sie steht als `style` am Element und nicht im Blatt, und das ist der
   * Falle aus `CLAUDE.md` geschuldet: eine Klasse plus ein Typ schlaegt eine
   * Klasse allein, und genau so hat die rote Sechs zwei Etappen lang nicht
   * gegolten. Ein `style` schlaegt beide, und der Wert ist eine Variable und
   * kein Hexwert - Regel 2 bleibt gewahrt.
   *
   * Ohne Angabe erbt die Zahl die Tinte ihrer Umgebung.
   */
  readonly fill?: string;
  readonly className?: string;
}

/**
 * Eine Zahl aus gezeichneten Ziffern, mittig um (`cx`, `cy`).
 *
 * Zentriert wird ueber die **Vorschuebe** und nicht ueber die Zeichenbreiten:
 * sonst saesse „11" sichtbar anders als „10", und das waere dieselbe
 * springende Ziffer, die der gemeinsame Vorschub gerade verhindert. Die
 * Nachbreite des letzten Zeichens faellt dabei weg, damit rechts keine Luft
 * haengt, die links keine Entsprechung hat.
 */
export function Numeral({ value, cx, cy, cap, fill, className }: NumeralProps): JSX.Element {
  const digits = Math.trunc(Math.abs(value)).toString().split('');
  const unit = cap / CAP_HEIGHT;

  const width = numeralWidth(value);

  return (
    <g
      className={className ? `numeral ${className}` : 'numeral'}
      transform={`translate(${cx - (width * unit) / 2} ${cy - cap / 2}) scale(${unit})`}
      style={fill ? ({ fill } as CSSProperties) : undefined}
      pointerEvents="none"
      aria-hidden="true"
    >
      {digits.map((digit, index) => (
        <path
          key={index}
          /*
           * Welche Ziffer hier steht, ist sonst nirgends mehr abzulesen: eine
           * gezeichnete Form traegt keinen Text. Das Attribut macht sie im
           * Entwicklerwerkzeug wieder lesbar - und den Tests wieder pruefbar,
           * ohne dass es dafuer einen zweiten, nur fuer sie gebauten Weg ins
           * Modul braeuchte.
           */
          data-digit={digit}
          d={DIGITS[Number(digit)]}
          fillRule="evenodd"
          transform={index === 0 ? undefined : `translate(${index * ADVANCE} 0)`}
        />
      ))}
    </g>
  );
}

/**
 * Wie hoch die Versalie im Fliesstext steht - als Anteil der Schriftgroesse.
 *
 * 0.72 em ist die uebliche Versalhoehe einer Grotesk und damit genau die
 * Hoehe, die ein `<span>` mit derselben `font-size` daneben haette. Die Zahl
 * waechst und schrumpft dadurch mit jeder Regel im Blatt mit, ohne dass dort
 * eine zweite Groesse gepflegt werden muesste.
 */
const CAP_EM = 0.72;

export interface NumeralTextProps {
  readonly value: number;
  readonly className?: string;
  /**
   * Was Vorlesegeraete sagen sollen.
   *
   * Eine gezeichnete Zahl hat keinen Text - aus Pfaddaten laesst sich nichts
   * vorlesen. Wo die Zahl schon in einem `aria-label` der Umgebung steht,
   * bleibt das hier leer und das Bild stumm; wo sie es nicht tut, gehoert sie
   * hierher. Stumm **und** nirgends benannt waere die Zahl fuer einen Teil der
   * Spieler schlicht nicht da.
   */
  readonly label?: string;
}

/**
 * Dieselben Ziffern, aber im Satz statt im Brett.
 *
 * **Wofuer.** Die Wuerfelsumme und die Zahl auf dem Chip sind dieselbe Zahl -
 * die eine sagt, was gefallen ist, die andere, wo es etwas bringt. Solange die
 * eine gezeichnet und die andere gesetzt war, sah man ihnen das nicht an. Das
 * ist der Grund, warum es diesen zweiten Weg gibt, und zugleich die Grenze:
 * eine laufende Zeile („0 Karten", „wirft 3 ab") bleibt Fliesstext. Eine
 * Anzeigeschrift mitten im Satz ist keine Persoenlichkeit, sondern ein
 * Setzfehler.
 *
 * Das Bild sitzt mit seiner Unterkante auf der Grundlinie: die Zeichenflaeche
 * endet bei y = 100, und das ist im Raster die Grundlinie. `vertical-align`
 * braucht es deshalb nicht - der Standardwert ist bereits `baseline`.
 */
export function NumeralText({ value, className, label }: NumeralTextProps): JSX.Element {
  const digits = Math.trunc(Math.abs(value)).toString().split('');
  const width = numeralWidth(value);

  return (
    <svg
      className={className ? `numeral ${className}` : 'numeral'}
      viewBox={`0 0 ${width} ${CAP_HEIGHT}`}
      style={{ height: `${CAP_EM}em`, width: `${(width / CAP_HEIGHT) * CAP_EM}em` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {digits.map((digit, index) => (
        <path
          key={index}
          /*
           * Welche Ziffer hier steht, ist sonst nirgends mehr abzulesen: eine
           * gezeichnete Form traegt keinen Text. Das Attribut macht sie im
           * Entwicklerwerkzeug wieder lesbar - und den Tests wieder pruefbar,
           * ohne dass es dafuer einen zweiten, nur fuer sie gebauten Weg ins
           * Modul braeuchte.
           */
          data-digit={digit}
          d={DIGITS[Number(digit)]}
          fillRule="evenodd"
          transform={index === 0 ? undefined : `translate(${index * ADVANCE} 0)`}
        />
      ))}
    </svg>
  );
}
