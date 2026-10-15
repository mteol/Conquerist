import type { CSSProperties, JSX } from 'react';
import type { BarbarianState } from '@conquerist/shared';
import { NumeralText } from '../type/Numerals';

/**
 * Die Fahrstrecke des Barbarenheers.
 *
 * **Rolle:** die Spannungsanzeige der ganzen Erweiterung - wie nah die Gefahr
 * ist und ob man ihr gewachsen wäre. **Aufbau:** die Stationen als Reihe, das
 * Schiff darauf, daneben die Stärke der Barbaren. **Woran man sich erinnert:**
 * daß das Schiff bei jedem Schiffswurf ein Feld näher kommt.
 *
 * **Bewegung.** Das Schiff *gleitet* von Feld zu Feld - eine `transition` auf
 * `transform`, keine `animation`. Der Grund steht in `CLAUDE.md`: eine
 * Animation läuft beim Einhängen und **nicht** beim Aktualisieren, und hier
 * bleibt derselbe Knoten stehen. Eine Transition läuft dagegen genau bei der
 * Änderung - und die Änderung ist der Zustandswechsel, den sie erklären soll.
 *
 * Sie kommt aus demselben zurückgehaltenen Stand wie alles andere am Tisch
 * (`useSettledRoll`): das Schiff rückt vor, **nachdem** die Würfel liegen. Wäre
 * es früher, erklärte die Bewegung nicht mehr den Wechsel, sondern käme ihm
 * hinterher.
 */
export interface BarbarianTrackProps {
  /** `null` heißt: an diesem Tisch fährt kein Schiff. Dann steht hier nichts. */
  readonly barbarians: BarbarianState | null;
  /** Wie viele Felder die Strecke hat - aus dem Regelwerk. */
  readonly track: number;
  /** Die Stärke des Heeres: jede Stadt auf dem Brett. */
  readonly strength: number;
  /**
   * Die Stärke der Ritter Catans - `null`, wenn es an diesem Tisch keine gibt.
   *
   * Eine Null, die niemals steigen kann, ist dasselbe wie ein Knopf, der nie
   * angeht: sie sagt „gerade nicht" über etwas, das nie geht. Eine Null, die
   * steigen **kann**, ist dagegen die Auskunft, um die es geht - seit 10b
   * steht sie deshalb da, sobald der Tisch Ritter kennt.
   */
  readonly defenders: number | null;
}

export function BarbarianTrack({
  barbarians,
  track,
  strength,
  defenders,
}: BarbarianTrackProps): JSX.Element | null {
  if (barbarians === null || track <= 0) return null;

  // Start (0) bis Kueste (`track`): gelandet wird erst auf `track` - so zaehlt
  // auch `hasLanded` in shared. Mit nur `track` Stationen stand die Kueste
  // eine Station zu frueh, und „noch 0" kam einen Wurf vor dem Angriff.
  const stations = Array.from({ length: track + 1 }, (_unused, index) => index);
  const left = Math.max(0, track - barbarians.position);

  /*
   * Wie weit das Schiff auf der Strecke steht, als Anteil. Die Umrechnung in
   * Pixel macht das Blatt - es kennt die Breite, die Komponente nicht.
   */
  const progress = Math.min(1, barbarians.position / track);

  return (
    <section
      className="barbarians"
      aria-label={`Die Barbaren sind ${barbarians.position} von ${track} Feldern nah`}
      data-hint-title="Barbaren"
      data-hint={barbarianHint(left, strength, defenders).join('\n')}
    >
      <div className="barbarians__lane">
        <ol className="barbarians__stations">
          {stations.map((index) => (
            <li
              key={index}
              className={
                index === track
                  ? 'barbarians__station barbarians__station--coast'
                  : 'barbarians__station'
              }
              data-testid="barbarian-station"
              aria-hidden="true"
            />
          ))}
        </ol>

        <span
          className="barbarians__ship"
          data-testid="barbarian-ship"
          data-position={barbarians.position}
          style={{ '--progress': progress } as CSSProperties}
          aria-hidden="true"
        >
          <ShipMark />
        </span>
      </div>

      <p className="barbarians__eta" data-testid="barbarian-eta">
        {left <= 0
          ? 'Angriff jetzt'
          : left === 1
            ? 'Angriff beim nächsten Schiff'
            : `Angriff in ${left} Schiffen`}
      </p>

      {/*
       * Die beiden Zahlen stehen **gegeneinander**, und die Leiste sagt, wer
       * vorn liegt. Das ist die Gewichtung, die 10a bewußt vertagt hat: sie
       * entsteht erst mit dem Vergleich, und vorher gab es nur eine Zahl.
       *
       * Gleichstand zählt als „hält" — so entscheidet die Regel, und eine
       * Anzeige, die dabei „unterlegen" sagte, wäre schlicht falsch.
       *
       * **Farbe trägt nicht allein** (Designregel 7): unter der Ritterzahl
       * steht das Wort, das dasselbe sagt.
       */}
      <p className="barbarians__strength">
        <span className="barbarians__side" aria-label={`Barbaren: ${strength}`}>
          <span className="barbarians__word">Barbaren</span>
          <NumeralText value={strength} className="barbarians__figure" />
        </span>

        {defenders === null ? null : (
          <span
            className={
              defenders >= strength
                ? 'barbarians__side barbarians__side--holding'
                : 'barbarians__side barbarians__side--losing'
            }
            data-testid="barbarian-defenders"
            data-standing={defenders >= strength ? 'holding' : 'losing'}
            aria-label={`Ritter: ${defenders}, ${defenders >= strength ? 'hält' : 'unterlegen'}`}
          >
            <span className="barbarians__word">Ritter</span>
            <NumeralText value={defenders} className="barbarians__figure" />
            <span className="barbarians__standing" aria-hidden="true">
              {defenders >= strength ? 'hält' : 'unterlegen'}
            </span>
          </span>
        )}
      </p>
    </section>
  );
}

/**
 * Die Regel hinter der Leiste, in Sätzen. Zwei Zahlen und ein Schiff sagen,
 * *wie* es steht - aber nicht, was beim Ankommen passiert, und genau das
 * entscheidet, ob man jetzt einen Ritter braucht.
 */
export function barbarianHint(left: number, strength: number, defenders: number | null): string[] {
  return [
    left <= 0
      ? 'Das Schiff ist an der Küste.'
      : `Rückt bei jedem Schiff auf dem Ereigniswürfel ein Feld vor - noch ${left} bis zur Küste.`,
    `Angriffsstärke ${strength}: eine je Stadt auf dem Brett.`,
    defenders === null
      ? 'Dagegen zählen alle aktivierten Ritter.'
      : `Dagegen zählen alle aktivierten Ritter: zusammen ${defenders}.`,
    'Halten sie: wer am meisten beiträgt, bekommt einen Siegpunkt (bei Gleichstand je eine Fortschrittskarte).',
    'Unterliegen sie: wer am wenigsten beiträgt, verliert eine Stadt.',
    'Danach sind alle Ritter wieder passiv.',
  ];
}

/**
 * Das Schiff auf der Strecke - dieselbe Silhouette wie auf dem Ereigniswürfel.
 *
 * Sie steht hier ein zweites Mal und nicht als Import aus `EventDie`, weil sie
 * dort in einem 24er-Raster mit Mast als Linie sitzt und hier als reine
 * Flächenform bei rund zwölf Pixeln bestehen muß. Zwei Größen, zwei
 * Zeichnungen - dieselbe Entscheidung wie zwischen Handkarte und Auswahlkarte.
 */
function ShipMark(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 L12 14 M12 4.5 L20 8 L12 11 Z" className="barbarians__mast" />
      <path d="M1.5 14.5 H22.5 L18.5 22 H5.5 Z" />
    </svg>
  );
}
