import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ABANDON_ROOM,
  ACT,
  AUTH_LOGIN,
  AUTH_LOGOUT,
  AUTH_REGISTER,
  CHOOSE_COLOR,
  CONFIGURE_ROOM,
  CREATE_ROOM,
  DELETE_ROOM,
  GAME_EVENT,
  HELLO,
  JOIN_ROOM,
  LEAVE_ROOM,
  MY_ROOMS,
  OVER_EVENT,
  RENAME,
  ROOM_EVENT,
  eventSchema,
  isEventType,
  START_GAME,
  DEFAULT_VICTORY_POINT_GOAL,
  type RoomVariant,
  type AuthResponse,
  type GameAction,
  type LoginRequest,
  type RegisterRequest,
  type RoomSummary,
} from '@conquerist/shared';
import { forgetSecret, loadName, loadSecret, storeName, storeSecret } from '../net/session';
import type { TransportOptions } from '../net/transport';
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

/**
 * Wer gerade verbunden ist - Gast oder Konto, `null` bis das erste `hello`
 * durch ist.
 *
 * Der Client rechnet hier nichts aus: jedes Feld kommt unveraendert von einer
 * Server-Antwort (`hello.ok` oder `auth.ok`).
 */
export interface Identity {
  readonly userId: string;
  readonly name: string;
  readonly isGuest: boolean;
  /** Fehlt bei Gaesten. */
  readonly login?: string;
}

export interface OnlineGame {
  readonly state: OnlineState;
  readonly connection: ReturnType<typeof useConnection>['state'];
  readonly userId: string | null;
  readonly identity: Identity | null;
  /** Partien, an denen dieser Spieler sitzt. */
  readonly myRooms: readonly RoomSummary[];
  readonly refreshMyRooms: () => Promise<void>;
  readonly createRoom: (seatCount: number, seed: string, name: string) => Promise<string>;
  readonly joinRoom: (code: string, name: string) => Promise<void>;
  /** Zurueck ins Menue - der Tisch bleibt stehen, man kann wiederkommen. */
  readonly leaveRoom: () => Promise<void>;
  /**
   * Endgueltig aussteigen. Eine laufende Partie ist danach abgebrochen -
   * `true` sagt genau das.
   */
  readonly abandonRoom: (code: string) => Promise<boolean>;
  /**
   * Wegraeumen, was niemand mehr braucht - nur der Gastgeber, nur an einem
   * Tisch, an dem sonst keiner mehr sitzt. Ob das hier gilt, sagt
   * `RoomSummary.deletable`; durchgesetzt wird es auf dem Server.
   */
  readonly deleteRoom: (code: string) => Promise<void>;
  readonly configureRoom: (
    seatCount: number,
    seed: string,
    victoryPointGoal: number,
    variant: RoomVariant,
  ) => Promise<void>;
  /** Sich eine Sitzfarbe aussuchen. Belegte lehnt der Server ab. */
  readonly chooseColor: (color: string) => Promise<void>;
  /** Sich umbenennen - der Name gehoert der Person, nicht dem Sitz. */
  readonly rename: (name: string) => Promise<void>;
  readonly startGame: () => Promise<void>;
  readonly act: (action: GameAction) => Promise<void>;
  /** Konto anlegen. Ablehnung (etwa: Login vergeben) kommt als Fehler vom Server. */
  readonly register: (input: RegisterRequest) => Promise<void>;
  readonly login: (input: LoginRequest) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly dismissError: () => void;
}

export function useOnlineGame(
  /** Nur fuer Tests: eine Socket-Attrappe statt eines echten WebSockets. */
  options: TransportOptions = {},
): OnlineGame {
  const { state: connection, send, onEvent } = useConnection(options);
  const [state, dispatch] = useReducer(onlineReducer, emptyOnlineState);
  const [userId, setUserId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [myRooms, setMyRooms] = useState<readonly RoomSummary[]>([]);

  /**
   * Raumcode und Name in Refs, nicht im State: sie steuern nur, was beim
   * naechsten Verbindungsaufbau geschickt wird. Als State wuerden sie den
   * Anmelde-Effect neu ausloesen und damit ein zweites `hello` schicken.
   *
   * **Der Code aus dem Einladungslink steht hier bewusst NICHT drin.** Bis
   * Etappe 9 tat er das, und die Folge war das, was im ersten Playtest auffiel:
   * wer einem Link folgte, sass am Tisch, bevor er einen Namen eingeben konnte
   * - der Server legte einen Gast namens „Gast" an, und der stand dann so in
   * der Runde. Der Link fuellt jetzt nur das Feld auf dem Startbildschirm; in
   * den Raum geht es erst, wenn jemand „Beitreten" drueckt. Ab da traegt
   * `codeRef` den Code, und der Reconnect nach einem Abriss laeuft wie vorher.
   */
  const codeRef = useRef<string | null>(null);
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
          /*
           * Nur, wenn es der Tisch ist, an dem dieser Bildschirm gerade sitzt.
           *
           * Wer in mehreren Raeumen sitzt, bekommt das Ende jedes einzelnen
           * gemeldet - `broadcastOver` geht an alle Sitze, nicht an den offenen
           * Bildschirm. Ohne diese Zeile legte der Abbruch einer nebenher
           * laufenden Partie eine Meldung ueber die, die man gerade spielt.
           */
          if (parsed.data.code !== codeRef.current) return;
          dispatch({ type: 'over', payload: parsed.data });
          return;
        }
      }
    });
  }, [onEvent]);

  const refreshMyRooms = useCallback(async (): Promise<void> => {
    try {
      const { rooms } = await send(MY_ROOMS, {});
      setMyRooms(rooms);
    } catch {
      // Ohne Liste faellt der Bereich weg. Das ist eine Einbusse, kein Fehler -
      // erstellen und beitreten gehen weiterhin.
      setMyRooms([]);
    }
  }, [send]);

  /**
   * Konto anlegen, anmelden, abmelden.
   *
   * Alle drei enden gleich: kommt ein Geheimnis zurueck, ist es ein neues
   * Geraet bzw. eine neue Person - dann ablegen. Die Identitaet kommt in
   * jedem Fall vom Server; der Client leitet sie sich nirgends selbst ab.
   */
  const adopt = useCallback((answer: AuthResponse): void => {
    if (answer.secret !== undefined) storeSecret(answer.secret);
    setUserId(answer.userId);
    setIdentity({
      userId: answer.userId,
      name: answer.name,
      isGuest: answer.isGuest,
      ...(answer.login === undefined ? {} : { login: answer.login }),
    });
  }, []);

  const register = useCallback(
    async (input: RegisterRequest): Promise<void> => {
      adopt(await send(AUTH_REGISTER, input));
      await refreshMyRooms();
    },
    [adopt, send, refreshMyRooms],
  );

  const login = useCallback(
    async (input: LoginRequest): Promise<void> => {
      adopt(await send(AUTH_LOGIN, input));
      // Die Liste gehoert jetzt jemand anderem.
      await refreshMyRooms();
    },
    [adopt, send, refreshMyRooms],
  );

  const logout = useCallback(async (): Promise<void> => {
    adopt(await send(AUTH_LOGOUT, {}));
    await refreshMyRooms();
  }, [adopt, send, refreshMyRooms]);

  // Anmelden, sobald die Verbindung steht - und nach jedem Wiederaufbau erneut.
  useEffect(() => {
    if (connection.status !== 'open') {
      if (connection.status !== 'connecting') dispatch({ type: 'disconnected' });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const name = nameRef.current;
        const named = name === '' ? {} : { name };
        const secret = loadSecret();

        /*
         * Kennt der Server das Geheimnis nicht, ist es wertlos - dann weg damit
         * und einmal ohne versuchen. Ohne diesen Zweig sperrt ein
         * Datenbankwechsel jeden Browser dauerhaft aus, der noch ein altes
         * Geheimnis haelt: er schickt es bei jedem Verbindungsaufbau wieder mit
         * und bekommt jedes Mal dieselbe Absage.
         */
        let hello;
        try {
          hello = await send(HELLO, { ...(secret === null ? {} : { secret }), ...named });
        } catch (error) {
          if (secret === null || cancelled) throw error;
          forgetSecret();
          hello = await send(HELLO, named);
        }
        if (cancelled) return;

        if (hello.secret !== undefined) storeSecret(hello.secret);
        setUserId(hello.userId);
        setIdentity({
          userId: hello.userId,
          name: hello.name,
          isGuest: hello.isGuest,
          ...(hello.login === undefined ? {} : { login: hello.login }),
        });

        // Der Server schickt nach `hello` von sich aus den Stand, wenn er uns
        // an einem Tisch findet. Ein `joinRoom` ist nur noetig, wenn wir einen
        // Code kennen, an dem wir noch nicht sitzen - der Einladungslink.
        const code = codeRef.current;
        if (code !== null && !cancelled) await send(JOIN_ROOM, { code });
        if (!cancelled) await refreshMyRooms();
      } catch (error) {
        if (!cancelled) dispatch({ type: 'error', message: messageOf(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connection.status, send, refreshMyRooms]);

  const remember = useCallback((name: string): void => {
    nameRef.current = name;
    if (name !== '') storeName(name);
  }, []);

  /**
   * Den Anzeigenamen setzen, **ohne die Identitaet zu wechseln**.
   *
   * Das Geheimnis muss mit. Ohne es legt der Server einen neuen Gast an und
   * schaltet die Sitzung auf ihn um - der Raum gehoerte dann jemandem, dessen
   * Geheimnis nie jemand behalten hat. Sichtbar wurde das gleich dreifach: der
   * Gastgeber sah seinen eigenen Startknopf nicht (`hostId` passte zu keiner
   * bekannten Id), sein Sitz stand als „verbunden" statt „du" da, und nach
   * einem Neuladen war die Partie unerreichbar, weil `room.mine` fuer das
   * gespeicherte Geheimnis nichts mehr fand.
   *
   * Die Antwort geht durch `adopt` - schickt der Server doch ein neues
   * Geheimnis, wird es behalten statt weggeworfen.
   */
  const identify = useCallback(
    async (name: string): Promise<void> => {
      const secret = loadSecret();
      /*
       * Ein leerer Name geht gar nicht erst hinaus: `DisplayNameSchema`
       * verlangt mindestens ein Zeichen, und der Server wiese damit die ganze
       * Anmeldung ab statt nur den Namen. Getroffen haette das „Zurueck in die
       * Partie" bei geleertem Speicher - man kaeme in keine der eigenen
       * Partien mehr hinein, mit einer Meldung ueber ein Feld, das man nirgends
       * sieht. Ohne Namen bleibt der stehen, den der Server schon kennt.
       */
      const named = name.trim() === '' ? {} : { name };
      adopt(await send(HELLO, { ...(secret === null ? {} : { secret }), ...named }));
    },
    [adopt, send],
  );

  const createRoom = useCallback(
    async (seatCount: number, seed: string, name: string): Promise<string> => {
      remember(name);
      await identify(name);
      // Das Siegpunktziel wird im Wartebereich eingestellt, nicht hier - der
      // Server setzt beim Erstellen seine Vorgabe ein.
      const { code } = await send(CREATE_ROOM, {
        seatCount,
        seed,
        victoryPointGoal: DEFAULT_VICTORY_POINT_GOAL,
        // Wie das Siegpunktziel: ausgesucht wird im Wartebereich.
        variant: 'classic',
      });
      codeRef.current = code;
      return code;
    },
    [remember, identify, send],
  );

  const joinRoom = useCallback(
    async (code: string, name: string): Promise<void> => {
      remember(name);
      await identify(name);
      const joined = await send(JOIN_ROOM, { code });
      codeRef.current = joined.code;
    },
    [remember, identify, send],
  );

  const leaveRoom = useCallback(async (): Promise<void> => {
    await send(LEAVE_ROOM, {});
    codeRef.current = null;
    // Erst nach der Bestaetigung, und selbst: ein Raumstand kommt hier nicht
    // mehr an, weil zugestellt wird, wer am Tisch sitzt.
    dispatch({ type: 'left' });
    // Der Startbildschirm zeigt gleich „Deine Partien" - und die Partie, aus
    // der man eben gekommen ist, gehoert dort hin. Ohne dieses Nachladen
    // stuende dort der Stand von vor dem Beitritt.
    await refreshMyRooms();
  }, [send, refreshMyRooms]);

  /**
   * Aussteigen, von der Liste aus.
   *
   * Der Code kommt als Argument und nicht aus `codeRef`: gemeint ist eine
   * Karte auf dem Startbildschirm, und dort sitzt man an keinem Tisch. Ist es
   * zufaellig doch der offene, faellt er hier gleich mit weg - der Server hat
   * ihn dann ohnehin verlassen.
   */
  const abandonRoom = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        const { ended } = await send(ABANDON_ROOM, { code });
        if (codeRef.current === code) {
          codeRef.current = null;
          dispatch({ type: 'left' });
        }
        await refreshMyRooms();
        return ended;
      } catch (error) {
        dispatch({ type: 'error', message: messageOf(error) });
        return false;
      }
    },
    [send, refreshMyRooms],
  );

  const deleteRoom = useCallback(
    async (code: string): Promise<void> => {
      try {
        await send(DELETE_ROOM, { code });
        if (codeRef.current === code) {
          codeRef.current = null;
          dispatch({ type: 'left' });
        }
        await refreshMyRooms();
      } catch (error) {
        // „Es sitzen noch Mitspieler daran" ist ein gewoehnlicher Ausgang und
        // kein Absturz - der Grund bleibt lesbar, die Liste bleibt stehen.
        dispatch({ type: 'error', message: messageOf(error) });
      }
    },
    [send, refreshMyRooms],
  );

  const configureRoom = useCallback(
    async (
      seatCount: number,
      seed: string,
      victoryPointGoal: number,
      variant: RoomVariant,
    ): Promise<void> => {
      try {
        await send(CONFIGURE_ROOM, { seatCount, seed, victoryPointGoal, variant });
      } catch (error) {
        // Der Server prueft die Grenzen noch einmal. Wird es abgelehnt, bleibt
        // der alte Stand stehen und der Grund sichtbar - der Wartebereich darf
        // daran nicht zerbrechen.
        dispatch({ type: 'error', message: messageOf(error) });
      }
    },
    [send],
  );

  /*
   * Farbe und Name gehen denselben Weg wie das Umstellen: die Absage bleibt
   * lesbar, der Stand bleibt der des Servers. „Blau hat schon Ben" ist ein
   * gewoehnlicher Ausgang und kein Absturz.
   */
  const chooseColor = useCallback(
    async (color: string): Promise<void> => {
      try {
        await send(CHOOSE_COLOR, { color });
      } catch (error) {
        dispatch({ type: 'error', message: messageOf(error) });
      }
    },
    [send],
  );

  const rename = useCallback(
    async (name: string): Promise<void> => {
      try {
        await send(RENAME, { name });
        // Erst wenn der Server ihn angenommen hat: sonst stuende im Browser
        // ein Name, unter dem am Tisch niemand sitzt.
        remember(name);
        setIdentity((current) => (current === null ? current : { ...current, name }));
      } catch (error) {
        dispatch({ type: 'error', message: messageOf(error) });
      }
    },
    [send, remember],
  );

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
      identity,
      myRooms,
      refreshMyRooms,
      createRoom,
      joinRoom,
      leaveRoom,
      abandonRoom,
      deleteRoom,
      configureRoom,
      chooseColor,
      rename,
      startGame,
      act,
      register,
      login,
      logout,
      dismissError,
    }),
    [
      state,
      connection,
      userId,
      identity,
      myRooms,
      refreshMyRooms,
      createRoom,
      joinRoom,
      leaveRoom,
      abandonRoom,
      deleteRoom,
      configureRoom,
      chooseColor,
      rename,
      startGame,
      act,
      register,
      login,
      logout,
      dismissError,
    ],
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Fehler';
}
