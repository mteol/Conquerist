import type { z } from 'zod';
import {
  AUTH_LOGIN,
  AUTH_LOGOUT,
  AUTH_ME,
  AUTH_OK,
  AUTH_REGISTER,
  AuthResponseSchema,
  EmptyAuthRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
} from './auth.js';
import { PING, PONG, PingRequestSchema, PongResponseSchema } from './ping.js';
import {
  ACT,
  ACT_OK,
  ActRequestSchema,
  CONFIGURE_ROOM,
  CREATE_ROOM,
  ConfigureRoomRequestSchema,
  CreateRoomRequestSchema,
  ROOM_CONFIGURED,
  EmptyRequestSchema,
  EmptyResponseSchema,
  GAME_STARTED,
  HELLO,
  HELLO_OK,
  HelloRequestSchema,
  HelloResponseSchema,
  JOIN_ROOM,
  JoinRoomRequestSchema,
  LEAVE_ROOM,
  MY_ROOMS,
  MY_ROOMS_OK,
  MyRoomsResponseSchema,
  ROOM_CREATED,
  ROOM_JOINED,
  ROOM_LEFT,
  RoomCodeResponseSchema,
  START_GAME,
} from './room.js';

/**
 * Protokoll-Registry: die einzige Quelle fuer Request- und Response-Typen.
 *
 * Client und Server leiten ihre Signaturen hieraus ab, statt beide Seiten von
 * Hand zu typisieren und die Payload per Cast durchzureichen. Auf der Leitung
 * aendert sich dadurch nichts - der Envelope bleibt `{ id, type, payload }` mit
 * `type: string` und `payload: unknown`. Die Registry existiert ausschliesslich
 * zur Compile-Zeit.
 */

export interface ProtocolEntry {
  /** `type` der Antwortnachricht. Der Router setzt ihn automatisch. */
  readonly responseType: string;
  readonly request: z.ZodType;
  readonly response: z.ZodType;
}

export type ProtocolMap = Readonly<Record<string, ProtocolEntry>>;

export const protocol = {
  [PING]: {
    responseType: PONG,
    request: PingRequestSchema,
    response: PongResponseSchema,
  },
  [HELLO]: {
    responseType: HELLO_OK,
    request: HelloRequestSchema,
    response: HelloResponseSchema,
  },
  [CREATE_ROOM]: {
    responseType: ROOM_CREATED,
    request: CreateRoomRequestSchema,
    response: RoomCodeResponseSchema,
  },
  [JOIN_ROOM]: {
    responseType: ROOM_JOINED,
    request: JoinRoomRequestSchema,
    response: RoomCodeResponseSchema,
  },
  [LEAVE_ROOM]: {
    responseType: ROOM_LEFT,
    request: EmptyRequestSchema,
    response: EmptyResponseSchema,
  },
  [MY_ROOMS]: {
    responseType: MY_ROOMS_OK,
    request: EmptyRequestSchema,
    response: MyRoomsResponseSchema,
  },
  [CONFIGURE_ROOM]: {
    responseType: ROOM_CONFIGURED,
    request: ConfigureRoomRequestSchema,
    response: EmptyResponseSchema,
  },
  [START_GAME]: {
    responseType: GAME_STARTED,
    request: EmptyRequestSchema,
    response: EmptyResponseSchema,
  },
  [ACT]: {
    responseType: ACT_OK,
    request: ActRequestSchema,
    response: EmptyResponseSchema,
  },
  [AUTH_REGISTER]: {
    responseType: AUTH_OK,
    request: RegisterRequestSchema,
    response: AuthResponseSchema,
  },
  [AUTH_LOGIN]: {
    responseType: AUTH_OK,
    request: LoginRequestSchema,
    response: AuthResponseSchema,
  },
  [AUTH_LOGOUT]: {
    responseType: AUTH_OK,
    request: EmptyAuthRequestSchema,
    response: AuthResponseSchema,
  },
  [AUTH_ME]: {
    responseType: AUTH_OK,
    request: EmptyAuthRequestSchema,
    response: AuthResponseSchema,
  },
} as const satisfies ProtocolMap;

export type Protocol = typeof protocol;

/** Alle registrierten Request-Typen. Ab Etappe 2 wachsen hier die Spielzuege hinein. */
export type MessageType = keyof Protocol & string;

export type RequestOf<K extends MessageType> = z.infer<Protocol[K]['request']>;
export type ResponseOf<K extends MessageType> = z.infer<Protocol[K]['response']>;

export function isMessageType(value: string): value is MessageType {
  return Object.prototype.hasOwnProperty.call(protocol, value);
}

export function protocolEntry<K extends MessageType>(type: K): Protocol[K] {
  return protocol[type];
}
