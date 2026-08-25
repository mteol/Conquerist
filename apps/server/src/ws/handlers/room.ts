import {
  ABANDON_ROOM,
  ACT,
  CHOOSE_COLOR,
  CONFIGURE_ROOM,
  CREATE_ROOM,
  DELETE_ROOM,
  HELLO,
  JOIN_ROOM,
  LEAVE_ROOM,
  MY_ROOMS,
  RENAME,
  START_GAME,
  awaitsResponse,
  hasAutomaticDecline,
  isSystemAction,
  stampAction,
  type GameAction,
} from '@conquerist/shared';
import { broadcastGame, broadcastOver, broadcastRoom } from '../../rooms/broadcast.js';
import { summaryOf } from '../../rooms/summary.js';
import {
  abandonRoom,
  applyAction,
  applySystemAction,
  chooseColor,
  configureRoom,
  deleteRoom,
  isAway,
  joinRoom,
  leaveRoom,
  renameSeat,
  setConnected,
  startGame,
} from '../../rooms/room.js';
import type { Room } from '../../rooms/room.js';
import type { RoomClock } from '../../rooms/clock.js';
import type { RoomRegistry } from '../../rooms/registry.js';
import type { Users } from '../../identity/users.js';
import type { EventSink } from '../events.js';
import { RejectedError } from '../router.js';
import type { MessageRouter, RequestContext, Session } from '../router.js';
import type { SinkHub } from '../sinks.js';

/**
 * Die Handler, in denen Identitaet, Raum und Zustellung zusammenlaufen.
 *
 * Jeder folgt derselben Form: Sitzung pruefen, Raum holen, Uebergang aus
 * `rooms/room.ts` aufrufen, bei Erfolg im Verzeichnis ablegen und verteilen,
 * dann leer antworten. Die Antwort traegt absichtlich nichts: der Stand kommt
 * als Ereignis, und zwar fuer jeden Empfaenger einzeln gefiltert. Eine Antwort
 * mit Zustand waere ein zweiter Weg fuer dieselbe Sache - und der zweite Weg
 * ist der, den man beim naechsten Mal zu filtern vergisst.
 *
 * Ein werfender Handler wird vom Router zu `INTERNAL` - deshalb wird hier
 * geworfen, wo der Aufrufer etwas falsch macht, und nicht still weitergemacht.
 */
export interface RoomHandlerDeps {
  readonly registry: RoomRegistry;
  readonly users: Users;
  readonly sinks: SinkHub;
  /**
   * Der Wecker. Optional, damit Tests ohne ihn auskommen - ohne Wecker laeuft
   * nur keine Frist ab, alles andere bleibt gleich.
   */
  readonly clock?: RoomClock;
}

export function registerRoomHandlers(router: MessageRouter, deps: RoomHandlerDeps): void {
  const { registry, users, sinks } = deps;

  /**
   * Einen Zug einwerfen, den der Server selbst ausloest.
   *
   * Immer denselben Weg: anwenden, ablegen samt Log, verteilen. Ohne diese
   * Zusammenfassung stuende die Dreierfolge an drei Stellen, und die vierte
   * vergaesse das Log.
   */
  const system = (room: Room, action: GameAction): boolean => {
    const before = room.game;
    const acted = applySystemAction(room, action);
    if (!acted.ok) return false;

    registry.update(acted.room.code, acted.room, action);

    broadcastGame(
      acted.room,
      sinks.map,
      before === null || acted.room.game === null
        ? undefined
        : { before, action, after: acted.room.game },
    );
    deps.clock?.arm(acted.room.code);
    return true;
  };

  router.register(HELLO, (payload, context) => {
    /*
     * Ein Geheimnis, das der Server nicht kennt, ist kein Serverfehler,
     * sondern eine Auskunft: „damit komme ich hier nicht rein". Genau das
     * passiert nach einem Datenbankwechsel, und der Client kann daraufhin sein
     * totes Geheimnis wegwerfen und es ohne versuchen.
     */
    let result;
    try {
      result = users.hello(payload.secret, payload.name);
    } catch {
      throw new RejectedError('Dieses Sitzungsgeheimnis kennt der Server nicht');
    }

    context.session.userId = result.user.id;
    context.session.tokenHash = result.tokenHash;
    sinks.add(result.user.id, context.events);

    /*
     * Der Reconnect: wer schon sitzt, wird wieder als verbunden gefuehrt und
     * bekommt sofort den Stand - Raum und, falls sie laeuft, die Partie.
     *
     * Sitzt der Nutzer in genau einem Raum, wird der geoeffnet - das ist der
     * haeufige Fall und der Reconnect aus Etappe 5. Sitzt er seit Etappe 6 in
     * mehreren, oeffnet der Server KEINEN: welcher gemeint ist, weiss nur er
     * selbst, und die Liste auf dem Startbildschirm fragt ihn.
     *
     * Wer den Tisch verlassen hat, zaehlt hier nicht mit. Das ist der
     * Unterschied, den `away` traegt: eine abgerissene Verbindung ist ein
     * Unfall, und dorthin gehoert man zurueck; ein Austritt ist eine
     * Entscheidung, und sie beim naechsten Neuladen zu ueberstimmen hiesse, die
     * Tuer wieder zuzumauern, die es seit heute gibt. Zurueck geht es ueber die
     * Karte - `room.join` nimmt `away` dann wieder weg.
     */
    const mine = registry.roomsOf(result.user.id).filter((room) => !isAway(room, result.user.id));
    const existing = mine.length === 1 ? mine[0] : undefined;
    if (existing !== undefined) {
      context.session.roomCode = existing.code;
      const reconnected = setConnected(existing, result.user.id, true);
      registry.update(reconnected.code, reconnected);
      broadcastRoom(reconnected, sinks.map);

      /*
       * Das Angebot steht noch und traegt seine automatische Ablehnung: sie
       * faellt weg, er darf wieder antworten. Gesprochenes bleibt stehen -
       * `applyRejoinTrade` ruehrt eine Ablehnung von Hand nicht an.
       */
      const game = reconnected.game;
      const revived =
        game !== null &&
        hasAutomaticDecline(game, result.user.id) &&
        system(reconnected, { type: 'rejoinTrade', player: result.user.id });

      if (!revived) broadcastGame(reconnected, sinks.map);
    }

    return result.secret === undefined
      ? {
          userId: result.user.id,
          name: result.user.name,
          isGuest: result.user.isGuest,
          login: result.user.login,
        }
      : {
          userId: result.user.id,
          secret: result.secret,
          name: result.user.name,
          isGuest: result.user.isGuest,
          login: result.user.login,
        };
  });

  router.register(CREATE_ROOM, (payload, context) => {
    const user = requireUser(context, users);

    const created = registry.create(
      user.id,
      user.name,
      payload.seatCount,
      payload.seed,
      payload.victoryPointGoal,
      payload.variant,
    );
    if (!created.ok) throw new RejectedError(created.error);

    context.session.roomCode = created.room.code;
    broadcastRoom(created.room, sinks.map);

    return { code: created.room.code };
  });

  router.register(JOIN_ROOM, (payload, context) => {
    const user = requireUser(context, users);
    const room = requireRoom(registry.get(payload.code));

    const joined = joinRoom(room, user.id, user.name);
    if (!joined.ok) throw new RejectedError(joined.error);

    registry.update(joined.room.code, joined.room);
    context.session.roomCode = joined.room.code;

    broadcastRoom(joined.room, sinks.map);
    // Wer einer laufenden Partie wieder beitritt, braucht auch den Spielstand.
    broadcastGame(joined.room, sinks.map);

    return { code: joined.room.code };
  });

  router.register(LEAVE_ROOM, (_payload, context) => {
    const user = requireUser(context, users);
    const room = registry.get(context.session.roomCode ?? '');

    if (room !== undefined) {
      const next = leaveRoom(room, user.id);
      registry.update(next.code, next);
      broadcastRoom(next, sinks.map);

      /*
       * Wer waehrend eines offenen Angebots aufsteht, lehnt vorlaeufig ab -
       * dieselbe Ueberlegung wie bei einer abgerissenen Verbindung
       * (`handleDisconnect`), und aus demselben Grund: sonst wartet der Tisch
       * auf jemanden, der nicht mehr da ist.
       *
       * Erreichbar wurde dieser Fall erst mit der Tuer im Spielbildschirm: bis
       * dahin fuehrte aus einer laufenden Partie kein Weg heraus, und
       * `leaveRoom` traf sie nie.
       */
      if (next.game !== null && awaitsResponse(next.game, user.id)) {
        system(next, { type: 'dropFromTrade', player: user.id });
      }
    }

    context.session.roomCode = null;
    return {};
  });

  /**
   * Aussteigen - aus einem Raum, in dem man gerade nicht sitzt.
   *
   * Der Weg dorthin ist die Liste auf dem Startbildschirm, und deshalb kommt
   * der Code in der Nachricht statt aus der Sitzung. Wer nicht an diesem Tisch
   * sitzt, erreicht nichts: `abandonRoom` gibt dann `none` zurueck, und die
   * Antwort sieht aus wie die auf einen Raum, den es nicht mehr gibt. Das ist
   * Absicht - ein Fremder soll aus der Absage nicht ablesen koennen, ob ein
   * Raumcode vergeben ist.
   *
   * Die laufende Partie wird abgebrochen, und zwar bevor der Raum aus dem
   * Verzeichnis faellt: `broadcastOver` verteilt an die Sitzenden, und nach
   * dem Abbruch gibt es keine Sitzenden mehr, an die zu verteilen waere.
   */
  router.register(ABANDON_ROOM, (payload, context) => {
    const user = requireUser(context, users);
    const room = registry.get(payload.code);

    // Der eigene Bildschirm gehoert nicht mehr an diesen Tisch - unabhaengig
    // davon, was mit dem Raum passiert. Sonst schickte die naechste Nachricht
    // dieser Sitzung ihre Absicht an einen Raum, den es nicht mehr gibt.
    if (context.session.roomCode === payload.code) context.session.roomCode = null;

    const result = room === undefined ? { kind: 'none' as const } : abandonRoom(room, user.id);

    if (result.kind === 'none') return { ended: false };

    if (result.kind === 'left') {
      registry.update(result.room.code, result.room);
      broadcastRoom(result.room, sinks.map);
      return { ended: false };
    }

    deps.clock?.disarm(result.room.code);
    broadcastOver(result.room, sinks.map, `${user.name} hat die Partie abgebrochen`);
    registry.abandon(result.room.code);

    return { ended: true };
  });

  /**
   * Loeschen - der Gastgeber raeumt einen Tisch weg, an dem niemand mehr sitzt.
   *
   * `registry.remove` und nicht `registry.abandon`: das ist der Unterschied
   * zwischen „diese Partie ist zu Ende" und „diese Partie soll es nicht mehr
   * geben". Ein Abbruch bleibt nachlesbar, weil noch jemand daran gespielt hat;
   * ein verwaister Tisch hat niemanden mehr, fuer den er aufzuheben waere - der
   * Fremdschluessel raeumt Sitze und Log gleich mit ab.
   *
   * Eine Absage kommt hier als Absage heraus und nicht still: „nur der
   * Gastgeber" und „es sitzen noch Mitspieler daran" sind beides Saetze, die
   * jemand lesen soll. Beim Aussteigen ist das anders, weil es dort um einen
   * fremden Raumcode geht; hier steht die Karte vor einem, und wer sie sieht,
   * sitzt an diesem Tisch.
   */
  router.register(DELETE_ROOM, (payload, context) => {
    const user = requireUser(context, users);
    const room = requireRoom(registry.get(payload.code));

    const allowed = deleteRoom(room, user.id);
    if (!allowed.ok) throw new RejectedError(allowed.error);

    if (context.session.roomCode === payload.code) context.session.roomCode = null;

    deps.clock?.disarm(room.code);
    // An die eigenen weiteren Tabs: dort steht sonst ein Tisch, den es nicht
    // mehr gibt. Weiter reicht das nicht - es sitzt ja niemand sonst daran.
    broadcastOver(room, sinks.map, `${user.name} hat die Partie gelöscht`);
    registry.remove(room.code);

    return {};
  });

  router.register(MY_ROOMS, (_payload, context) => {
    const user = requireUser(context, users);

    return {
      rooms: registry
        .roomsOf(user.id)
        // Beendete Partien fallen aus der Liste - sie bleiben in der Datenbank,
        // aber niemand kann dort weitermachen.
        .filter((room) => room.game?.phase.kind !== 'finished')
        .map((room) => summaryOf(room, user.id)),
    };
  });

  router.register(CONFIGURE_ROOM, (payload, context) => {
    const user = requireUser(context, users);
    const room = requireRoom(registry.get(context.session.roomCode ?? ''));

    const changed = configureRoom(
      room,
      user.id,
      payload.seatCount,
      payload.seed,
      payload.victoryPointGoal,
      payload.variant,
    );
    if (!changed.ok) throw new RejectedError(changed.error);

    registry.update(changed.room.code, changed.room);
    broadcastRoom(changed.room, sinks.map);

    return {};
  });

  router.register(CHOOSE_COLOR, (payload, context) => {
    const user = requireUser(context, users);
    const room = requireRoom(registry.get(context.session.roomCode ?? ''));

    const changed = chooseColor(room, user.id, payload.color);
    if (!changed.ok) throw new RejectedError(changed.error);

    registry.update(changed.room.code, changed.room);
    broadcastRoom(changed.room, sinks.map);

    return {};
  });

  /**
   * Umbenennen - in `users` und an jedem Tisch, an dem diese Person sitzt.
   *
   * Ueber `roomsOf` und nicht ueber den Raum der Sitzung: seit Etappe 6 kann
   * jemand in mehreren Raeumen sitzen, und ein Name, der nur in einem davon
   * ankommt, ist danach zweierlei. Der Reihe nach und nicht in einem Rutsch,
   * weil jeder Raum seinen eigenen Stand und seine eigene Version hat.
   */
  router.register(RENAME, (payload, context) => {
    const user = requireUser(context, users);
    users.rename(user.id, payload.name);

    for (const room of registry.roomsOf(user.id)) {
      const next = renameSeat(room, user.id, payload.name);
      if (next === room) continue;

      registry.update(next.code, next);
      broadcastRoom(next, sinks.map);
      /*
       * Auch der Spielstand geht hinaus: die Namen stehen in der `PlayerView`,
       * und ohne das hiesse der Umbenannte am Tisch erst nach dem naechsten Zug
       * anders - oder in einer angehaltenen Partie nie.
       */
      if (next.game !== null) broadcastGame(next, sinks.map);
    }

    return {};
  });

  router.register(START_GAME, (_payload, context) => {
    const user = requireUser(context, users);
    const room = requireRoom(registry.get(context.session.roomCode ?? ''));

    const started = startGame(room, user.id);
    if (!started.ok) throw new RejectedError(started.error);

    registry.update(started.room.code, started.room);
    broadcastRoom(started.room, sinks.map);
    broadcastGame(started.room, sinks.map);
    deps.clock?.arm(started.room.code);

    return {};
  });

  router.register(ACT, (payload, context) => {
    const user = requireUser(context, users);
    const room = requireRoom(registry.get(context.session.roomCode ?? ''));
    const before = room.game;

    if (isSystemAction(payload.action)) {
      throw new RejectedError('Diesen Zug loest der Server aus, nicht ein Spieler');
    }

    // Der Zeitpunkt kommt vom Server, nie vom Client - und geht in genau dieser
    // Form ins Log, damit `replay` dieselbe Frist wieder ergibt.
    const action = stampAction(payload.action, Date.now());

    const acted = applyAction(room, user.id, action);
    if (!acted.ok) throw new RejectedError(acted.error);

    // Die Aktion geht mit ins Log - aus ihr und dem Startzustand entsteht die
    // Partie nach einem Neustart wieder.
    registry.update(acted.room.code, acted.room, action);

    // Der Verlaufssatz entsteht aus vorher/nachher und nicht aus der Absicht -
    // er kann damit nicht von dem abweichen, was wirklich geschehen ist. Wo er
    // entsteht, steht seit dem Ton in `broadcast.ts`; hier geht nur noch der
    // Uebergang hinein.
    broadcastGame(
      acted.room,
      sinks.map,
      before === null || acted.room.game === null
        ? undefined
        : { before, action, after: acted.room.game },
    );
    // Der Zug kann eine Frist geoeffnet, verlaengert oder beendet haben.
    deps.clock?.arm(acted.room.code);
    return {};
  });
}

/**
 * Was beim Wegfallen einer Verbindung zu tun ist.
 *
 * Nicht im Router, weil kein Client danach fragt. Der Platz bleibt belegt -
 * ihn zu raeumen hiesse, eine laufende Partie zu zerstoeren, nur weil jemandem
 * das WLAN ausgeht.
 */
export function handleDisconnect(deps: RoomHandlerDeps, session: Session, sink: EventSink): void {
  const { registry, sinks } = deps;
  const userId = session.userId;
  if (userId === null) return;

  sinks.remove(userId, sink);
  if (sinks.has(userId)) return; // Noch ein Tab offen: nichts zu melden.

  // Seit Etappe 6 kann jemand in mehreren Raeumen sitzen - einem Wartebereich
  // und einer laufenden Partie etwa. Eine Verbindung gehoert der Person, nicht
  // einem Raum: faellt sie weg, ist er ueberall getrennt.
  for (const room of registry.roomsOf(userId)) {
    const next = setConnected(room, userId, false);
    registry.update(next.code, next);
    broadcastRoom(next, sinks.map);

    /*
     * Wer waehrend eines offenen Angebots wegbricht, lehnt vorlaeufig ab -
     * sonst wartet der Tisch auf jemanden, der nicht mehr da ist. Vorlaeufig,
     * weil die Rueckkehr diese Ablehnung wieder wegnimmt.
     */
    const game = next.game;
    if (game === null || !awaitsResponse(game, userId)) continue;

    const action: GameAction = { type: 'dropFromTrade', player: userId };
    const acted = applySystemAction(next, action);
    if (!acted.ok) continue;

    registry.update(acted.room.code, acted.room, action);

    broadcastGame(
      acted.room,
      sinks.map,
      acted.room.game === null ? undefined : { before: game, action, after: acted.room.game },
    );
    deps.clock?.arm(acted.room.code);
  }
}

function requireUser(context: RequestContext, users: Users): { id: string; name: string } {
  const userId = context.session.userId;
  if (userId === null) throw new RejectedError('Erst anmelden - hello fehlt');

  const user = users.byId(userId);
  if (user === undefined) throw new RejectedError('Angemeldete Person gibt es nicht mehr');

  return { id: user.id, name: user.name };
}

function requireRoom(room: Room | undefined): Room {
  if (room === undefined) throw new RejectedError('Diesen Raum gibt es nicht');
  return room;
}
