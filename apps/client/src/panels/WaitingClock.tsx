import type { CSSProperties, JSX } from 'react';
import { deadlineOf, type PlayerView } from '@conquerist/shared';
import { useCountdown } from '../game/useCountdown';

/**
 * Wie lange der Tisch noch wartet - eine Zeile unter dem Status.
 *
 * **Auf wen** gewartet wird, sagt der Satz darüber (`phaseText`); hier steht
 * nur die Zeit. Ist sie um, nimmt der Server die Pflicht ab oder lässt das
 * Geschenk verfallen, und der Verlauf sagt, was geschehen ist.
 *
 * Beim Angebot schweigt die Zeile: dort steht die Uhr im Dialog, unter den
 * Bedingungen, über die entschieden wird.
 */
export function WaitingClock({
  view,
  clockOffset,
  dueAt = null,
}: {
  readonly view: PlayerView;
  readonly clockOffset: number;
  /** Wann der Server die Frist abnimmt (Serverzeit); lokal `null`. */
  readonly dueAt?: number | null;
}): JSX.Element | null {
  const left = useCountdown(view, clockOffset, dueAt);
  if (left === null || view.phase.kind === 'tradePending') return null;

  /*
   * Der Maßstab zeigt, wie viel von der Frist übrig ist: zehn Felder, ein Feld
   * je Zehntel. Eine Frist ohne bekannte Dauer (gespeicherter Zeitpunkt) bleibt
   * beim Satz - die Zahl ist ohnehin die Auskunft, die Leiste der Überblick.
   */
  const found = deadlineOf(view);
  const total = found !== null && found.kind === 'after' ? found.ms / 1000 : 0;
  const on = total > 0 ? Math.min(FIELDS, Math.ceil((left / total) * FIELDS)) : 0;

  return (
    <div className="status__clock" role="timer" data-testid="waiting-clock">
      {total > 0 ? (
        <span
          className="scalebar status__scale"
          style={{ '--of': FIELDS } as CSSProperties}
          aria-hidden="true"
        >
          {Array.from({ length: FIELDS }, (_unused, index) => (
            <i key={index} className={index < on ? 'is-on' : undefined} />
          ))}
        </span>
      ) : null}
      <span>
        Noch <b>{left}</b> Sekunden
      </span>
    </div>
  );
}

const FIELDS = 10;
