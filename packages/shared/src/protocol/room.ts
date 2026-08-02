import { z } from 'zod';

import { GameActionSchema } from '../game/actions.js';
import { MAX_SEATS, MIN_SEATS } from '../seats.js';

/**
 * Nachrichten fuer Identitaet, Raum und Zug.
 *
 * Alles, was der Client schicken darf, ist eine **Absicht**: „ich moechte
 * beitreten", „ich moechte diesen Zug machen". Ergebnisse kommen ausnahmslos
 * vom Server (Regel 3). Deshalb gibt es hier kein Schema, das einen Zustand
 * entgegennimmt.
 */

export const HELLO = 'hello';
export const HELLO_OK = 'hello.ok';
export const CREATE_ROOM = 'room.create';
export const ROOM_CREATED = 'room.created';
export const JOIN_ROOM = 'room.join';
export const ROOM_JOINED = 'room.joined';
export const LEAVE_ROOM = 'room.leave';
export const ROOM_LEFT = 'room.left';
export const START_GAME = 'room.start';
export const GAME_STARTED = 'room.started';
export const ACT = 'game.act';
export const ACT_OK = 'game.acted';

/**
 * Raumcode: vier Zeichen aus einem Alphabet ohne Verwechslungspaare.
 *
 * Kein O/0, kein I/1 - der Code wird vorgelesen oder in einen Gruppenchat
 * getippt. Kleinbuchstaben werden angehoben, statt sie abzulehnen: wer „k7x2"
 * tippt, meint denselben Raum.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (code) =>
      code.length === ROOM_CODE_LENGTH &&
      [...code].every((char) => ROOM_CODE_ALPHABET.includes(char)),
    { message: `Raumcode besteht aus ${ROOM_CODE_LENGTH} Zeichen ohne O, 0, I und 1` },
  );

/** Anzeigename. Kurz genug fuer die Tischliste, lang genug fuer Namen. */
export const DisplayNameSchema = z.string().trim().min(1).max(16);

export const HelloRequestSchema = z.object({
  /** Fehlt beim ersten Besuch; dann legt der Server einen Gast an. */
  secret: z.string().min(1).optional(),
  name: DisplayNameSchema.optional(),
});

export const HelloResponseSchema = z.object({
  userId: z.string().min(1),
  /** Nur beim Anlegen gefuellt - danach kennt der Browser es. */
  secret: z.string().min(1).optional(),
  name: DisplayNameSchema,
});

export const CreateRoomRequestSchema = z.object({
  seatCount: z.number().int().min(MIN_SEATS).max(MAX_SEATS),
  seed: z.string().trim().min(1).max(24),
});

export const RoomCodeResponseSchema = z.object({ code: RoomCodeSchema });

export const JoinRoomRequestSchema = z.object({ code: RoomCodeSchema });

export const EmptyRequestSchema = z.object({});
export const EmptyResponseSchema = z.object({});

export const ActRequestSchema = z.object({ action: GameActionSchema });

export type HelloRequest = z.infer<typeof HelloRequestSchema>;
export type HelloResponse = z.infer<typeof HelloResponseSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type ActRequest = z.infer<typeof ActRequestSchema>;
export type RoomCode = z.infer<typeof RoomCodeSchema>;
