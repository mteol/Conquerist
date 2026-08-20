import type { CSSProperties, JSX } from 'react';
import type { DiceSpec, Roll } from '@conquerist/shared';
import { NumeralText } from '../type/Numerals';

/**
 * Die Wuerfel - und zugleich der Zug, mit dem man sie wirft.
 *
 * **Rolle:** die Stelle, an der ein Zug beginnt und an der der Tisch nachsieht,
 * was gefallen ist. **Aufbau:** die Wuerfel der Schale nebeneinander, rechts die
 * Zahl, die den Ertrag ausgeloest hat. **Woran man sich erinnert:** dass sie
 * ueber das Brett fliegen und der Tisch schweigt, solange sie unterwegs sind.
 *
 * Der eigene Knopf „Wuerfeln" ist damit weg, und das ist kein Wegsparen: er
 * stand neben den Wuerfeln und tat, was die Wuerfel darstellen. Zwei Dinge fuer
 * eine Sache sind eine Erklaerung zu viel.
 *
 * Zur Bewegung (Regel 5 in CLAUDE.md): jede der drei Animationen erklaert einen
 * Zustandswechsel. Das Atmen ist an „du musst werfen" gebunden und hoert in dem
 * Augenblick auf, in dem das nicht mehr gilt; der Wurf zeigt, dass gerade
 * gewuerfelt wird; das Fallen zeigt, dass ein neuer Wurf liegt. Bei
 * `prefers-reduced-motion` steht alles sofort still - deshalb traegt die
 * Aufforderung zusaetzlich ein Wort und der Wurf seine Zahl, und deshalb
 * fliegt dann auch nichts (siehe `useSettledRoll`). Bewegung ist hier nie der
 * einzige Traeger.
 *
 * Erweiterbar ohne Vorbau: gezeigt wird, was in `spec` steht. Ein drittes
 * Regelwerk mit einem Ereigniswuerfel braucht hier keine Zeile - nur einen
 * Eintrag mehr in seiner Wuerfelschale.
 */
export interface DiceTrayProps {
  /** Womit an diesem Tisch gewuerfelt wird. Bestimmt Anzahl und Augenzahl der Felder. */
  readonly spec: DiceSpec;
  /** Der letzte Wurf; `null`, solange keiner gefallen ist. */
  readonly roll: Roll | null;
  /** Die Zahl, um die es geht. `null` ohne Wurf. */
  readonly total: number | null;
  /** Ob der Zusehende jetzt werfen darf - kommt aus der Aktionsliste, nicht aus einer Regel. */
  readonly canRoll: boolean;
  /** Ob dieser Stand aus einem Wurf hervorgegangen ist. Dann fallen die Wuerfel einmal. */
  readonly fell: boolean;
  /**
   * Der Wurf, der gerade unterwegs ist - `null`, wenn nichts fliegt.
   *
   * Er kommt aus einem Stand, den der Tisch noch nicht zeigt (`useSettledRoll`),
   * und ist das Einzige daraus, was vor der Landung nach draussen darf: die
   * Wuerfel muessen wissen, worauf sie fallen sollen.
   */
  readonly landing?: Roll | null;
  readonly onRoll: () => void;
}

export function DiceTray({
  spec,
  roll,
  total,
  canRoll,
  fell,
  landing = null,
  onRoll,
}: DiceTrayProps): JSX.Element {
  const shown = spec.map((die) => ({
    die,
    value: roll?.find((result) => result.die === die.id)?.value ?? null,
  }));

  /*
   * Geworfen wird nur, was ein Wuerfel im Wortsinn ist.
   *
   * Ein Kubus hat sechs Flaechen - fuer einen achtseitigen Wuerfel aus einem
   * spaeteren Regelwerk gaebe es keine Zuordnung, und eine erfundene waere
   * schlechter als keine. Dann bleibt es beim Umspringen an Ort und Stelle;
   * gezeigt wird ohnehin, was in `spec` steht.
   */
  const thrown =
    landing === null || !spec.every((die) => die.faces === 6)
      ? null
      : spec.map((die) => landing.find((result) => result.die === die.id)?.value ?? 1);

  const flying = thrown !== null;

  const className = ['dice', canRoll ? 'dice--waiting' : '', fell ? 'dice--fell' : '']
    .filter((part) => part !== '')
    .join(' ');

  return (
    <div className="dice-tray">
      <button
        type="button"
        className={className}
        /*
         * Wer waehrend des Fluges noch einmal drueckt, wuerfelt zweimal. Die
         * Klickkarte weiss davon nichts - sie stammt aus dem Stand von vorhin,
         * und der laesst das Werfen selbstverstaendlich noch zu.
         */
        disabled={!canRoll || flying}
        aria-label={flying ? 'Die Würfel fallen' : labelFor(canRoll, shown, total)}
        data-testid="dice"
        onClick={onRoll}
      >
        <span
          className={flying ? 'dice__faces dice__faces--flying' : 'dice__faces'}
          aria-hidden="true"
        >
          {thrown === null
            ? shown.map(({ die, value }) => <Die key={die.id} faces={die.faces} value={value} />)
            : spec.map((die, index) => <Cube key={die.id} value={thrown[index]!} index={index} />)}
        </span>

        {/* Die Summe erscheint mit dem Wurf, nicht vor ihm. */}
        {total === null || flying ? null : (
          <span className="dice__total">
            {/*
             * Gezeichnet und nicht gesetzt - dieselben Ziffern wie auf dem
             * Zahlenchip (`type/Numerals`). Das ist hier keine Zierde: was
             * hier faellt, steht gleich darauf auf dem Brett, und solange die
             * eine Zahl gezeichnet und die andere gesetzt war, sah man den
             * zwei gleichen Zahlen nicht an, dass sie dieselbe sind.
             *
             * Stumm wie vorher: die Summe steht im `aria-label` der Schale
             * („Wurf: ..., zusammen ...") und waere hier ein zweites Mal zu
             * hoeren.
             */}
            <NumeralText value={total} />
          </span>
        )}
      </button>

      {/*
       * Steht immer da, auch leer: sonst waechst die Ablage um eine Zeile, sobald
       * man am Zug ist, und schiebt Hand und Knoepfe darunter weg.
       */}
      <span className="dice__call" aria-hidden="true">
        {canRoll && !flying ? 'Würfeln' : ''}
      </span>
    </div>
  );
}

/** Was eine Vorleseansage aus dem Becher macht - Bewegung traegt hier nichts. */
function labelFor(
  canRoll: boolean,
  shown: readonly { readonly value: number | null }[],
  total: number | null,
): string {
  if (canRoll) return 'Würfeln';
  if (total === null) return 'Noch kein Wurf';

  const eyes = shown.map(({ value }) => value ?? 0).join(' und ');
  return `Wurf: ${eyes}, zusammen ${total}`;
}

/**
 * Ein geworfener Wuerfel - sechs Flaechen um eine Mitte, in echtem 3D.
 *
 * **Keine Bibliothek und keine Physik.** Beides waere hier nicht nur teuer
 * (`three.js` samt Physik-Engine wiegt mehr als das bisherige Bundle), sondern
 * falsch: **das Ergebnis steht fest, bevor der Wuerfel faellt.** Es kommt aus
 * dem Seed (Architekturregel 2), und keine Simulation darf es bestimmen. Der
 * Wuerfel muss also so oder so auf seine Flaeche *gesteuert* werden - und damit
 * faellt der Hauptgrund fuer echte Physik weg. Ein Wuerfel, der sich mit Physik
 * auf die falsche Zahl legt, waere ein Fehler, den niemand mehr einfinge.
 *
 * Gesteuert wird er ueber zwei Zahlen: `--fx` und `--fy` sind die Drehung, bei
 * der genau die geworfene Flaeche vorn steht. Die Animation dreht von einigen
 * ganzen Umdrehungen davor bis dorthin - das taumelt und landet trotzdem exakt.
 *
 * `--peak-x` und `--peak-y` sind der Scheitel des Wurfs, in `vw`/`vh` und nicht
 * in Pixeln: der Wuerfel soll ueber das Brett fliegen, und wie gross das ist,
 * weiss nur das Fenster. Zwei Wuerfel bekommen verschiedene Scheitel und einen
 * Versatz - zwei gleich fliegende Wuerfel sind ein Wuerfel.
 */
function Cube({ value, index }: { readonly value: number; readonly index: number }): JSX.Element {
  const face = FACE_TURN[value] ?? FACE_TURN[1]!;

  return (
    <span
      className="cube"
      data-testid={`cube-${value}`}
      style={
        {
          '--fx': `${face.x}deg`,
          '--fy': `${face.y}deg`,
          '--peak-x': index === 0 ? '-24vw' : '-33vw',
          '--peak-y': index === 0 ? '-33vh' : '-26vh',
          animationDelay: `${index * 70}ms`,
        } as CSSProperties
      }
    >
      {CUBE_FACES.map((side) => (
        <span key={side.name} className={`cube__face cube__face--${side.name}`}>
          <Die faces={6} value={side.value} />
        </span>
      ))}
    </span>
  );
}

/**
 * Das Netz des Wuerfels: welche Augenzahl auf welcher Seite sitzt.
 *
 * Gegenueberliegende Flaechen ergeben sieben - das ist bei einem echten Wuerfel
 * so, und wer beim Taumeln zwei Kanten zugleich sieht, soll nichts Falsches
 * sehen.
 */
const CUBE_FACES: readonly { readonly name: string; readonly value: number }[] = [
  { name: 'front', value: 1 },
  { name: 'back', value: 6 },
  { name: 'right', value: 3 },
  { name: 'left', value: 4 },
  { name: 'top', value: 5 },
  { name: 'bottom', value: 2 },
];

/**
 * Wie der Wuerfel stehen muss, damit diese Augenzahl vorn liegt.
 *
 * Die Umkehrung des Netzes darueber: die Vier sitzt links, also dreht man den
 * Wuerfel um 90 Grad, damit sie nach vorn kommt. Als Tabelle und nicht als
 * Rechnung - sechs gesetzte Lagen, und keine Formel saegte das kuerzer.
 */
const FACE_TURN: Readonly<Record<number, { readonly x: number; readonly y: number }>> = {
  1: { x: 0, y: 0 },
  2: { x: 90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 0, y: 180 },
};

/**
 * Ein Wuerfel.
 *
 * Augen statt Ziffer, solange es welche gibt: eine Ziffer im Kaestchen ist eine
 * Zahlenanzeige, ein Muster ist ein Wuerfel. Ueber sechs Seiten hinaus gibt es
 * kein gewohntes Muster mehr - dann steht die Zahl da, und eine Erweiterung mit
 * achtseitigen Wuerfeln bleibt lesbar, ohne dass jemand Punkte erfinden muss.
 */
function Die({
  faces,
  value,
}: {
  readonly faces: number;
  readonly value: number | null;
}): JSX.Element {
  if (value === null) return <span className="die die--blank" />;
  if (faces > PIPS.length) return <span className="die die--numeral">{value}</span>;

  const pattern = PIPS[value - 1];
  if (pattern === undefined) return <span className="die die--numeral">{value}</span>;

  return (
    <span className="die">
      {pattern.map((filled, index) => (
        <span key={index} className={filled ? 'die__pip' : 'die__pip die__pip--empty'} />
      ))}
    </span>
  );
}

/**
 * Die Augenbilder, je als 3x3-Raster von links oben nach rechts unten.
 *
 * Als Tabelle und nicht als Rechnung: die Muster sind gesetzt und nicht
 * hergeleitet - die Vier steht in den Ecken, die Sechs in zwei Dreierreihen, und
 * keine Formel wuerde das kuerzer sagen.
 */
const PIPS: readonly (readonly boolean[])[] = [
  [false, false, false, false, true, false, false, false, false],
  [true, false, false, false, false, false, false, false, true],
  [true, false, false, false, true, false, false, false, true],
  [true, false, true, false, false, false, true, false, true],
  [true, false, true, false, true, false, true, false, true],
  [true, false, true, true, false, true, true, false, true],
];
