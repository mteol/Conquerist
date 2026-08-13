import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { deadlineOf, stampAction, type GameAction, type GameState } from '@conquerist/shared';
import type { Seat } from '../seats';
import { hotseatReducer, startHotseat, type HotseatEvent, type HotseatState } from './hotseat';

/**
 * Duenner Haken um den reinen Reducer.
 *
 * Alles Rechnende steht in `hotseat.ts` und wird ohne DOM geprueft; hier bleibt
 * nur die Bindung an React - und seit Etappe 8 die Uhr.
 *
 * **Die Uhr steht hier und nicht in der Logik.** Der Reducer ist rein und liest
 * keine Zeit (Regel 2); Fristen entstehen aus einem `at`, das die Aktion
 * mitbringt, und laufen ab, wenn jemand `timeout` einwirft. Online tut das der
 * Wecker im Server, lokal dieser Haken - sonst zeigte die lokale Partie einen
 * Countdown, der nie ausloest, und das waere eine Anzeige, die luegt.
 */
export interface HotseatGame {
  readonly state: HotseatState;
  readonly dispatch: (action: GameAction) => void;
  readonly dismissError: () => void;
}

export function useHotseatGame(game: GameState, seats: readonly Seat[]): HotseatGame {
  const reducer = useMemo(
    () => (state: HotseatState, event: HotseatEvent) => hotseatReducer(state, event, seats),
    [seats],
  );

  const [state, send] = useReducer(reducer, game, startHotseat);

  const dispatch = useCallback((action: GameAction) => {
    // Derselbe Stempel wie im Server, nur ohne Server: hier ist niemand zu
    // betruegen, und die Frist soll trotzdem aus einem echten Zeitpunkt kommen.
    send({ type: 'apply', action: stampAction(action, Date.now()) });
  }, []);

  const dismissError = useCallback(() => {
    send({ type: 'dismissError' });
  }, []);

  useEffect(() => {
    const due = deadlineOf(state.game);
    if (due === null) return;

    const handle = setTimeout(
      () => {
        send({ type: 'apply', action: { type: 'timeout', player: due.owner, at: Date.now() } });
      },
      // Eine bereits abgelaufene Frist ist sofort faellig, nicht negativ.
      Math.max(0, due.at - Date.now()),
    );

    return () => {
      clearTimeout(handle);
    };
  }, [state.game]);

  return { state, dispatch, dismissError };
}
