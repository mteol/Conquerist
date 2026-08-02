import { z } from 'zod';

import { GameActionSchema } from '../game/actions.js';
import { PlayerViewSchema } from '../game/playerView.js';
import { MAX_SEATS, MIN_SEATS } from '../seats.js';
import { DisplayNameSchema, RoomCodeSchema } from './room.js';

/**
 * Nachrichten, die der Server ohne Anfrage schickt.
 *
 * Der Envelope traegt das seit Etappe 0: `replyTo` ist optional. Neu ist nur
 * die Registry - und sie ist bewusst eine eigene. Die bestehende bildet
 * Anfrage auf Antwort ab; ein Ereignis hat keine Anfrage und damit weder
 * `responseType` noch Request-Schema. Zwei leere Felder mit Erklaerung waeren
 * schlechter als zwei Registries mit klarem Zweck.
 *
 * Auch Ereignisse gehen durch die Validierung, bevor sie den Server verlassen:
 * was nicht im Schema steht, kann nicht hinaus (Regel 4).
 */

export const ROOM_EVENT = 'room.state';
export const GAME_EVENT = 'game.state';
export const OVER_EVENT = 'room.over';

export const SeatInRoomSchema = z.object({
  userId: z.string().min(1),
  name: DisplayNameSchema,
  color: z.string().min(1),
  connected: z.boolean(),
});

export const RoomEventSchema = z.object({
  code: RoomCodeSchema,
  hostId: z.string().min(1),
  seatCount: z.number().int().min(MIN_SEATS).max(MAX_SEATS),
  seed: z.string().min(1),
  started: z.boolean(),
  seats: z.array(SeatInRoomSchema),
});

/**
 * Der Spielstand - **je Empfaenger ein eigener**.
 *
 * `actions` sind die Zuege, die genau dieser Empfaenger gerade machen darf.
 * `legalActions` laeuft auf dem Server, weil es den vollen Zustand braucht;
 * der Client bekommt das Ergebnis und muss keine Regel kennen.
 */
export const GameEventSchema = z.object({
  version: z.number().int().min(0),
  view: PlayerViewSchema,
  actions: z.array(GameActionSchema),
  /** Verlaufssatz zum Zug, der gerade geschehen ist. Fehlt beim ersten Stand. */
  entry: z.string().min(1).optional(),
});

export const OverEventSchema = z.object({
  code: RoomCodeSchema,
  reason: z.string().min(1),
});

export const events = {
  [ROOM_EVENT]: RoomEventSchema,
  [GAME_EVENT]: GameEventSchema,
  [OVER_EVENT]: OverEventSchema,
} as const satisfies Readonly<Record<string, z.ZodType>>;

export type Events = typeof events;
export type EventType = keyof Events & string;
export type EventPayloadOf<K extends EventType> = z.infer<Events[K]>;

export function isEventType(value: string): value is EventType {
  return Object.prototype.hasOwnProperty.call(events, value);
}

export function eventSchema<K extends EventType>(type: K): Events[K] {
  return events[type];
}

export type RoomEvent = z.infer<typeof RoomEventSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type OverEvent = z.infer<typeof OverEventSchema>;
export type SeatInRoom = z.infer<typeof SeatInRoomSchema>;
