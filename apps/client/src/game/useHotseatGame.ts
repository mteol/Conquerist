import { useCallback, useMemo, useReducer } from 'react';
import type { GameAction, GameState } from '@conquerist/shared';
import type { Seat } from '../seats';
import { hotseatReducer, startHotseat, type HotseatEvent, type HotseatState } from './hotseat';

/**
 * Duenner Haken um den reinen Reducer.
 *
 * Alles Rechnende steht in `hotseat.ts` und wird ohne DOM geprueft; hier bleibt
 * nur die Bindung an React.
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
    send({ type: 'apply', action });
  }, []);

  const dismissError = useCallback(() => {
    send({ type: 'dismissError' });
  }, []);

  return { state, dispatch, dismissError };
}
