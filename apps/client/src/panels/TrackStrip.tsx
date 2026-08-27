import type { CSSProperties, JSX } from 'react';
import {
  MAX_TRACK_LEVEL,
  TRACK_IDS,
  levelOf,
  type PlayerId,
  type TrackId,
} from '@conquerist/shared';
import { TRACK_ABBR, TRACK_COLORS_ON_SEA, TRACK_NAMES } from '../game/labels';

/**
 * Die kompakte Leiste: derselbe Stand, aber für die anderen am Tisch.
 *
 * **Rolle:** dieselbe Auskunft wie das Tableau, nur über die *anderen*, in
 * einer Zeile. **Aufbau:** drei Punktreihen null bis fünf, je Bereich, in
 * Bereichsfarbe. **Woran man sich erinnert:** wer nah an der Vier ist - also
 * kurz vor der Metropole steht.
 *
 * Sie steht je Sitz in `TablePanel`, unter dem Namen - dort, wo schon steht,
 * was öffentlich ist (Karten, Punkte, Auszeichnungen).
 *
 * **Farbe ist hier nie der einzige Träger (Designregel 7).** Drei Punktreihen
 * allein in Bereichsfarbe wären für Rot-Grün-Blinde dieselbe Reihe dreimal.
 * Deshalb trägt jede Reihe zusätzlich ein Kürzel aus `labels.ts` - dieselbe
 * Tabelle wie im Tableau (`TrackPanel.tsx`), damit beide Anzeigen nicht
 * auseinanderlaufen können.
 */
export interface TrackStripProps {
  /** Wessen Zeile das ist - die Punktreihen tragen ihn in ihrer Testkennung. */
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
            className="trackstrip__row"
            style={{ '--track-color-on-sea': TRACK_COLORS_ON_SEA[track] } as CSSProperties}
            title={`${TRACK_NAMES[track]}: Stufe ${level}`}
          >
            <span className="trackstrip__abbr" aria-hidden="true">
              {TRACK_ABBR[track]}
            </span>
            <span className="trackstrip__dots" aria-hidden="true">
              {steps.map((step) => (
                <span
                  key={step}
                  className={
                    step <= level ? 'trackstrip__dot trackstrip__dot--filled' : 'trackstrip__dot'
                  }
                  data-testid={`trackstrip-${player}-${track}-${step}`}
                />
              ))}
            </span>
            <span className="visually-hidden">{`${TRACK_NAMES[track]}: Stufe ${level}`}</span>
          </span>
        );
      })}
    </span>
  );
}
