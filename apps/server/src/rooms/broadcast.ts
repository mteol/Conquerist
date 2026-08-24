import {
  GAME_EVENT,
  OVER_EVENT,
  ROOM_EVENT,
  describeTransition,
  legalActions,
  playerViewOf,
  type GameAction,
  type GameState,
  type Seat,
} from '@conquerist/shared';
import type { EventSink } from '../ws/events.js';
import type { Room } from './room.js';

/**
 * Zustellung - je Empfaenger, nicht je Raum.
 *
 * Das ist der Punkt, an dem Regel 4 wirklich greift: ein Broadcast mit einer
 * gemeinsamen Nachricht waere bequemer und wuerde jedem die Handkarten aller
 * schicken. Stattdessen wird fuer jeden Empfaenger eine eigene `PlayerView`
 * gebaut - und die erlaubten Zuege gleich mit, denn `legalActions` braucht den
 * vollen Zustand und laeuft deshalb hier und nicht im Browser.
 *
 * Ein Spieler kann mehrere Verbindungen haben (zweiter Tab, Handy daneben);
 * deshalb eine Liste Senken je Nutzer.
 *
 * **Wer `away` ist, bekommt nichts.** Zugestellt wird, wer am Tisch sitzt - und
 * wer aufgestanden ist, sitzt nicht daran. Das ist keine Sparsamkeit, sondern
 * die Behebung eines Fehlers, den die Tuer im Spielbildschirm sichtbar gemacht
 * hat: der Platz bleibt beim Verlassen stehen, also gingen die Raumstaende
 * weiter hinaus. Beim naechsten Ereignis am Tisch - einer, der sich abmeldet,
 * eine ablaufende Frist - setzte der Client seinen Raum daraufhin wieder, und
 * weil sein Spielstand beim Verlassen weggeraeumt worden war, stand er
 * ploetzlich im Wartebereich statt auf dem Startbildschirm. Man wurde,
 * woertlich, an den Tisch zurueckgezogen, den man gerade verlassen hatte.
 *
 * Zurueck kommt der Stand mit der Rueckkehr: `room.join` nimmt `away` weg und
 * verteilt danach Raum und Partie.
 */
export type Sinks = ReadonlyMap<string, readonly EventSink[]>;

export function broadcastRoom(room: Room, sinks: Sinks): void {
  const payload = {
    code: room.code,
    hostId: room.hostId,
    seatCount: room.seatCount,
    seed: room.seed,
    victoryPointGoal: room.victoryPointGoal,
    started: room.game !== null,
    seats: room.seats.map((seat) => ({
      userId: seat.userId,
      name: seat.name,
      color: seat.color,
      connected: seat.connected,
    })),
  };

  for (const seat of room.seats) {
    if (seat.away) continue;
    for (const sink of sinks.get(seat.userId) ?? []) sink.send(ROOM_EVENT, payload);
  }
}

/**
 * Der Zug, der zu diesem Stand gefuehrt hat - vorher, was, nachher.
 *
 * Bis hierher rechnete jede der vier Aufrufstellen ihren Verlaufssatz selbst
 * aus und reichte ihn fertig herein. Mit dem Zugtyp im Ereignis waere daraus
 * die fuenfte Kopie geworden. Jetzt reicht jede Stelle den Uebergang durch, und
 * was daraus im Ereignis landet, entscheidet diese Datei - Satz und Zug
 * entstehen damit nebeneinander und koennen nicht auseinanderlaufen.
 */
export interface Transition {
  readonly before: GameState;
  readonly action: GameAction;
  readonly after: GameState;
}

export function broadcastGame(room: Room, sinks: Sinks, transition?: Transition): void {
  const game = room.game;
  if (game === null) return;

  const seats: readonly Seat[] = room.seats.map((seat) => ({
    id: seat.userId,
    name: seat.name,
    color: seat.color,
  }));
  const connected = new Map(room.seats.map((seat) => [seat.userId, seat.connected]));
  // Einmal je Broadcast, nicht je Empfaenger: alle sollen denselben Bezugspunkt
  // bekommen, sonst rechnete jeder Client einen leicht anderen Versatz aus.
  const sentAt = Date.now();

  const entry =
    transition === undefined
      ? undefined
      : describeTransition(transition.before, transition.action, transition.after, seats);
  /*
   * Was passiert ist - nicht, was es klingen soll.
   *
   * Der Client bekam bisher nur `entry`, einen fertigen deutschen Satz; welcher
   * Zug dahinterstand, war daraus nicht zu holen. Der Server sagt es deshalb
   * ausdruecklich und ueberlaesst dem Empfaenger, was er damit macht.
   */
  const move =
    transition === undefined
      ? undefined
      : { type: transition.action.type, actor: transition.action.player };

  for (const seat of room.seats) {
    if (seat.away) continue;

    const targets = sinks.get(seat.userId) ?? [];
    if (targets.length === 0) continue;

    const payload = {
      version: room.version,
      view: playerViewOf(game, seat.userId, seats, room.version, connected),
      actions: legalActions(game, seat.userId),
      sentAt,
      ...(entry === undefined ? {} : { entry }),
      ...(move === undefined ? {} : { move }),
    };

    for (const sink of targets) sink.send(GAME_EVENT, payload);
  }
}

export function broadcastOver(room: Room, sinks: Sinks, reason: string): void {
  for (const seat of room.seats) {
    for (const sink of sinks.get(seat.userId) ?? []) {
      sink.send(OVER_EVENT, { code: room.code, reason });
    }
  }
}
