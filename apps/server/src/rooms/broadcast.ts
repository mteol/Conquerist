import {
  GAME_EVENT,
  OVER_EVENT,
  ROOM_EVENT,
  legalActions,
  playerViewOf,
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
 */
export type Sinks = ReadonlyMap<string, readonly EventSink[]>;

export function broadcastRoom(room: Room, sinks: Sinks): void {
  const payload = {
    code: room.code,
    hostId: room.hostId,
    seatCount: room.seatCount,
    seed: room.seed,
    started: room.game !== null,
    seats: room.seats.map((seat) => ({
      userId: seat.userId,
      name: seat.name,
      color: seat.color,
      connected: seat.connected,
    })),
  };

  for (const seat of room.seats) {
    for (const sink of sinks.get(seat.userId) ?? []) sink.send(ROOM_EVENT, payload);
  }
}

export function broadcastGame(room: Room, sinks: Sinks, entry?: string): void {
  const game = room.game;
  if (game === null) return;

  const seats: readonly Seat[] = room.seats.map((seat) => ({
    id: seat.userId,
    name: seat.name,
    color: seat.color,
  }));
  const connected = new Map(room.seats.map((seat) => [seat.userId, seat.connected]));

  for (const seat of room.seats) {
    const targets = sinks.get(seat.userId) ?? [];
    if (targets.length === 0) continue;

    const payload = {
      version: room.version,
      view: playerViewOf(game, seat.userId, seats, room.version, connected),
      actions: legalActions(game, seat.userId),
      ...(entry === undefined ? {} : { entry }),
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
