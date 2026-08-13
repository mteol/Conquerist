import type { JSX } from 'react';
import type { DiceSpec, Roll } from '@conquerist/shared';

/**
 * Die Wuerfel - und zugleich der Zug, mit dem man sie wirft.
 *
 * **Rolle:** die Stelle, an der ein Zug beginnt und an der der Tisch nachsieht,
 * was gefallen ist. **Aufbau:** die Wuerfel der Schale nebeneinander, rechts die
 * Zahl, die den Ertrag ausgeloest hat. **Woran man sich erinnert:** dass sie
 * atmen, solange man selbst werfen muss, und stillstehen, sobald es getan ist.
 *
 * Der eigene Knopf „Wuerfeln" ist damit weg, und das ist kein Wegsparen: er
 * stand neben den Wuerfeln und tat, was die Wuerfel darstellen. Zwei Dinge fuer
 * eine Sache sind eine Erklaerung zu viel.
 *
 * Zur Bewegung (Regel 5 in CLAUDE.md): beide Animationen erklaeren einen
 * Zustandswechsel. Das Atmen ist an „du musst werfen" gebunden und hoert in dem
 * Augenblick auf, in dem das nicht mehr gilt; das Fallen zeigt, dass ein neuer
 * Wurf liegt. Bei `prefers-reduced-motion` steht beides sofort still - deshalb
 * traegt die Aufforderung zusaetzlich ein Wort und der Wurf seine Zahl. Bewegung
 * ist hier nie der einzige Traeger.
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
  readonly onRoll: () => void;
}

export function DiceTray({ spec, roll, total, canRoll, fell, onRoll }: DiceTrayProps): JSX.Element {
  const shown = spec.map((die) => ({
    die,
    value: roll?.find((result) => result.die === die.id)?.value ?? null,
  }));

  const className = ['dice', canRoll ? 'dice--waiting' : '', fell ? 'dice--fell' : '']
    .filter((part) => part !== '')
    .join(' ');

  return (
    <div className="dice-tray">
      <button
        type="button"
        className={className}
        disabled={!canRoll}
        aria-label={labelFor(canRoll, shown, total)}
        data-testid="dice"
        onClick={onRoll}
      >
        <span className="dice__faces" aria-hidden="true">
          {shown.map(({ die, value }) => (
            <Die key={die.id} faces={die.faces} value={value} />
          ))}
        </span>

        {total === null ? null : (
          <span className="dice__total" aria-hidden="true">
            {total}
          </span>
        )}
      </button>

      {/*
       * Steht immer da, auch leer: sonst waechst die Ablage um eine Zeile, sobald
       * man am Zug ist, und schiebt Hand und Knoepfe darunter weg.
       */}
      <span className="dice__call" aria-hidden="true">
        {canRoll ? 'Würfeln' : ''}
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
