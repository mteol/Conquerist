import type { JSX } from 'react';
import type { PlayerView } from '@conquerist/shared';
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
}: {
  readonly view: PlayerView;
  readonly clockOffset: number;
}): JSX.Element | null {
  const left = useCountdown(view, clockOffset);
  if (left === null || view.phase.kind === 'tradePending') return null;

  return (
    <p className="status__clock" role="timer" data-testid="waiting-clock">
      Noch <b>{left}</b> Sekunden
    </p>
  );
}
