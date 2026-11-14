import type { CSSProperties, JSX } from 'react';
import {
  MAX_TRACK_LEVEL,
  TRACK_IDS,
  levelOf,
  type PlayerId,
  type TrackId,
} from '@conquerist/shared';
import { TRACK_COLORS_ON_SEA, TRACK_NAMES } from '../game/labels';

/**
 * Die kompakte Leiste: derselbe Stand, aber für die anderen am Tisch.
 *
 * **Rolle:** dieselbe Auskunft wie das Tableau, nur über die *anderen*, in
 * einer Zeile. **Aufbau:** drei Maßstäbe (`.scalebar`) mit fünf Feldern,
 * je Bereich in Bereichsfarbe. **Woran man sich erinnert:** wer nah an der Vier ist - also
 * kurz vor der Metropole steht.
 *
 * Sie steht je Sitz in `TablePanel`, unter dem Namen - dort, wo schon steht,
 * was öffentlich ist (Karten, Punkte, Auszeichnungen).
 *
 * **Farbe ist hier nie der einzige Träger (Designregel 7).** Der ausgeschriebene
 * Name steht in der Auskunft beim Darüberfahren (`data-hint-title`) und für
 * Vorlesegeräte im Knoten selbst; die Reihenfolge Handel, Politik, Wissenschaft
 * ist an jedem Sitz dieselbe, ein Kürzel in 9 px trug sie nicht.
 */
export interface TrackStripProps {
  /** Wessen Zeile das ist - die Felder tragen ihn in ihrer Testkennung. */
  readonly player: PlayerId;
  /** Der Stand dieses Spielers - `levelOf` liest daraus. */
  readonly levels: { readonly improvements: Partial<Record<TrackId, number>> };
}

export function TrackStrip({ player, levels }: TrackStripProps): JSX.Element {
  const steps = Array.from({ length: MAX_TRACK_LEVEL }, (_unused, index) => index + 1);

  return (
    <span className="trackstrip" data-testid={`trackstrip-${player}`}>
      {TRACK_IDS.map((track) => {
        const level = levelOf(levels, track);

        return (
          <span
            key={track}
            className="scalebar trackstrip__row"
            style={
              {
                '--scale-ink': TRACK_COLORS_ON_SEA[track],
                '--of': MAX_TRACK_LEVEL,
              } as CSSProperties
            }
            data-hint-title={TRACK_NAMES[track]}
            data-hint={`Stufe ${level} von ${MAX_TRACK_LEVEL}`}
          >
            {steps.map((step) => (
              <i
                key={step}
                className={step <= level ? 'is-on' : undefined}
                aria-hidden="true"
                data-testid={`trackstrip-${player}-${track}-${step}`}
              />
            ))}
            <span className="visually-hidden">{`${TRACK_NAMES[track]}: Stufe ${level}`}</span>
          </span>
        );
      })}
    </span>
  );
}
