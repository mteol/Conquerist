import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ACT,
  CREATE_ROOM,
  GAME_EVENT,
  HELLO,
  JOIN_ROOM,
  LEAVE_ROOM,
  OVER_EVENT,
  ROOM_EVENT,
  eventSchema,
  isEventType,
  START_GAME,
  type GameAction,
} from '@conquerist/shared';
import { loadName, loadSecret, storeName, storeSecret } from '../net/session';
import { useConnection } from '../net/useConnection';
import { emptyOnlineState, onlineReducer } from './onlineState';
import type { OnlineState } from './onlineState';

/**
 * Die Online-Partie: Absicht senden, Stand empfangen.
 *
 * Der Haken haelt nichts vom Spiel selbst. Er schickt Absichten hinaus und
 * legt herein, was ankommt - die Auswertung steckt in `onlineState.ts` und ist
 * ohne React geprueft.
 *
 * **Jedes eintreffende Ereignis wird gegen sein Schema geprueft**, bevor es in
 * den Zustand geht. Der Server tut das beim Senden schon; hier noch einmal,
 * weil ein Client, der einer Nachricht ungeprueft glaubt, bei der ersten
 * Protokolldrift mit undefinierten Feldern rendert statt mit einer Meldung.
 *
 * Beim Verbindungsaufbau laeuft immer dieselbe Folge: `hello` mit dem
 * gespeicherten Geheimnis, danach - falls ein Raumcode bekannt ist - `joinRoom`.
 * Nach einem Abriss wird sie wiederholt. Genau das ist der Reconnect; er
 * braucht keinen eigenen Zweig.
 */
export interface OnlineGame {
  readonly state: OnlineState;
  readonly connection: ReturnType<typeof useConnection>['state'];
  readonly userId: string | null;
  readonly createRoom: (seatCount: number, seed: string, name: string) => Promise<string>;
  readonly joinRoom: (code: string, name: string) => Promise<void>;
  readonly leaveRoom: () => Promise<void>;
  readonly startGame: () => Promise<void>;
  readonly act: (action: GameAction) => Promise<void>;
  readonly dismissError: () => void;
}

export function useOnlineGame(initialCode: string | null = null): OnlineGame {
  const { state: connection, send, onEvent } = useConnection();
  const [state, dispatch] = useReducer(onlineReducer, emptyOnlineState);
  const [userId, setUserId] = useState<string | null>(null);

  /**
   * Raumcode und Name in Refs, nicht im State: sie steuern nur, was beim
   * naechsten Verbindungsaufbau geschickt wird. Als State wuerden sie den
   * Anmelde-Effect neu ausloesen und damit ein zweites `hello` schicken.
   */
  const codeRef = useRef<string | null>(initialCode);
  const nameRef = useRef<string>(loadName() ?? '');

  useEffect(() => {
    return onEvent((type, payload) => {
      if (!isEventType(type)) return;

      // Erst der Typ, dann das Schema: `eventSchema` mit einem Union-Typ
      // liefert auch ein Union-Ergebnis, und daraus laesst sich hinterher
      // nicht mehr herausnarrowen, welches Ereignis es war.
      const rejected = (): void => {
        dispatch({ type: 'error', message: 'Der Server hat etwas Unverstaendliches geschickt' });
      };

      switch (type) {
        case ROOM_EVENT: {
          const parsed = eventSchema(ROOM_EVENT).safeParse(payload);
          if (!parsed.success) return rejected();
          codeRef.current = parsed.data.code;
          dispatch({ type: 'room', payload: parsed.data });
          return;
        }
        case GAME_EVENT: {
          const parsed = eventSchema(GAME_EVENT).safeParse(payload);
          if (!parsed.success) return rejected();
          dispatch({ type: 'game', payload: parsed.data });
          return;
        }
        case OVER_EVENT: {
          const parsed = eventSchema(OVER_EVENT).safeParse(payload);
          if (!parsed.success) return rejected();
          dispatch({ type: 'over', payload: parsed.data });
          return;
        }
      }
    });
  }, [onEvent]);

  // Anmelden, sobald die Verbindung steht - und nach jedem Wiederaufbau erneut.
  useEffect(() => {
    if (connection.status !== 'open') {
      if (connection.status !== 'connecting') dispatch({ type: 'disconnected' });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const secret = loadSecret();
        const name = nameRef.current;

        const hello = await send(HELLO, {
          ...(secret === null ? {} : { secret }),
          ...(name === '' ? {} : { name }),
        });
        if (cancelled) return;

        if (hello.secret !== undefined) storeSecret(hello.secret);
        setUserId(hello.userId);

        // Der Server schickt nach `hello` von sich aus den Stand, wenn er uns
        // an einem Tisch findet. Ein `joinRoom` ist nur noetig, wenn wir einen
        // Code kennen, an dem wir noch nicht sitzen - der Einladungslink.
        const code = codeRef.current;
        if (code !== null && !cancelled) await send(JOIN_ROOM, { code });
      } catch (error) {
        if (!cancelled) dispatch({ type: 'error', message: messageOf(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connection.status, send]);

  const remember = useCallback((name: string): void => {
    nameRef.current = name;
    if (name !== '') storeName(name);
  }, []);

  const createRoom = useCallback(
    async (seatCount: number, seed: string, name: string): Promise<string> => {
      remember(name);
      await send(HELLO, { name });
      const { code } = await send(CREATE_ROOM, { seatCount, seed });
      codeRef.current = code;
      return code;
    },
    [remember, send],
  );

  const joinRoom = useCallback(
    async (code: string, name: string): Promise<void> => {
      remember(name);
      await send(HELLO, { name });
      const joined = await send(JOIN_ROOM, { code });
      codeRef.current = joined.code;
    },
    [remember, send],
  );

  const leaveRoom = useCallback(async (): Promise<void> => {
    await send(LEAVE_ROOM, {});
    codeRef.current = null;
  }, [send]);

  const startGame = useCallback(async (): Promise<void> => {
    await send(START_GAME, {});
  }, [send]);

  const act = useCallback(
    async (action: GameAction): Promise<void> => {
      try {
        await send(ACT, { action });
      } catch (error) {
        // Ein abgelehnter Zug ist ein normaler Ausgang und kein Absturz: die
        // Oberflaeche zeigt den Grund, der Stand bleibt der des Servers.
        dispatch({ type: 'error', message: messageOf(error) });
      }
    },
    [send],
  );

  const dismissError = useCallback((): void => {
    dispatch({ type: 'dismissError' });
  }, []);

  return useMemo(
    () => ({
      state,
      connection,
      userId,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      act,
      dismissError,
    }),
    [state, connection, userId, createRoom, joinRoom, leaveRoom, startGame, act, dismissError],
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Fehler';
}
