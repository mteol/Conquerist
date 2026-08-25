import { z } from 'zod';

import { GameActionSchema } from '../game/actions.js';
import {
  DEFAULT_VICTORY_POINT_GOAL,
  MAX_VICTORY_POINT_GOAL,
  MIN_VICTORY_POINT_GOAL,
} from '../rules/ruleset.js';
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
export const ABANDON_ROOM = 'room.abandon';
export const ROOM_ABANDONED = 'room.abandoned';
export const DELETE_ROOM = 'room.delete';
export const ROOM_DELETED = 'room.deleted';
export const MY_ROOMS = 'room.mine';
export const MY_ROOMS_OK = 'room.mine.ok';
export const CONFIGURE_ROOM = 'room.configure';
export const ROOM_CONFIGURED = 'room.configured';
export const CHOOSE_COLOR = 'room.color';
export const COLOR_CHOSEN = 'room.colored';
export const RENAME = 'user.rename';
export const RENAMED = 'user.renamed';
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

/**
 * Die Antwort auf `hello` ist dieselbe Form wie die auf `auth.*`.
 *
 * Sie wurde in Etappe 7 um `isGuest` und `login` erweitert - vertraeglich,
 * denn ein aelterer Client liest die neuen Felder einfach nicht.
 */
export const HelloResponseSchema = z.object({
  userId: z.string().min(1),
  /** Nur beim Anlegen gefuellt - danach kennt der Browser es. */
  secret: z.string().min(1).optional(),
  name: DisplayNameSchema,
  isGuest: z.boolean(),
  login: z.string().optional(),
});

/**
 * Nach welchem Regelwerk ein Raum spielt.
 *
 * Eine Kennung und keine Wahrheit ueber die Regeln selbst - was `cities`
 * bedeutet, steht in `rules/cities.ts`. Hier steht nur, was der Tisch
 * ausgesucht hat.
 */
export const ROOM_VARIANTS = ['classic', 'cities'] as const;

export type RoomVariant = (typeof ROOM_VARIANTS)[number];

export const RoomVariantSchema = z.enum(ROOM_VARIANTS);

export const CreateRoomRequestSchema = z.object({
  seatCount: z.number().int().min(MIN_SEATS).max(MAX_SEATS),
  seed: z.string().trim().min(1).max(24),
  /**
   * Mit Vorgabe wie das Siegpunktziel und aus demselben Grund: ausgesucht wird
   * im Wartebereich, und ein aelterer Client, der das Feld nicht kennt,
   * bekommt das Basisspiel statt einer Absage.
   */
  variant: RoomVariantSchema.default('classic'),
  /**
   * Mit Vorgabe, und das ist der Grund: eingestellt wird das Ziel im
   * Wartebereich, nicht beim Erstellen. Ein Pflichtfeld zwaenge den
   * Startbildschirm zu einer Frage, die dort niemand stellen will - und einen
   * aelteren Client, der das Feld nicht kennt, wuerde es aussperren.
   */
  victoryPointGoal: z
    .number()
    .int()
    .min(MIN_VICTORY_POINT_GOAL)
    .max(MAX_VICTORY_POINT_GOAL)
    .default(DEFAULT_VICTORY_POINT_GOAL),
});

/**
 * Die Partie im offenen Wartebereich umstellen.
 *
 * Dieselben Werte wie beim Erstellen, und mit Absicht dasselbe Schema:
 * ein Raum, der sich einstellen laesst, hat keine anderen Angaben als einer,
 * der gerade entsteht. Wer das darf und bis wann, entscheidet der Server -
 * nicht dieses Schema.
 */
export const ConfigureRoomRequestSchema = CreateRoomRequestSchema;

/**
 * Sich eine Farbe aussuchen.
 *
 * Eine eigene Nachricht und kein Feld an `room.configure`: die Tischgroesse
 * stellt der Gastgeber fuer alle ein, die Farbe waehlt jeder fuer sich. Zwei
 * verschiedene Berechtigungen in einer Nachricht waeren eine Nachricht, die
 * man nur zur Haelfte annehmen kann.
 *
 * Geprueft wird der Wert trotzdem erst am Tisch: ob es diese Farbe gibt, weiss
 * `isSeatColor`, ob sie noch frei ist, nur der Raum.
 */
export const ChooseColorRequestSchema = z.object({ color: z.string().min(1).max(16) });

/**
 * Sich umbenennen - auch mitten im Wartebereich.
 *
 * Der Name gehoert der Person und nicht dem Sitz (Regel 7), deshalb `user.` und
 * nicht `room.`. Der Server schreibt ihn in `users` und zieht ihn durch jeden
 * Tisch nach, an dem diese Person sitzt: ein Name, der an zwei Stellen steht,
 * ist sonst nach der ersten Aenderung zweierlei.
 */
export const RenameRequestSchema = z.object({ name: DisplayNameSchema });

/**
 * Eine Partie, wie sie auf einer Karte am Startbildschirm steht.
 *
 * Bewusst kein Spielzustand: die Liste soll zeigen, wo man weitermachen kann,
 * nicht die Partie vorwegnehmen. Wer hineingeht, bekommt seine `PlayerView`
 * wie immer - gefiltert, und nicht aus dieser Zusammenfassung. Regel 4 gilt
 * auch fuer eine Uebersicht.
 */
export const RoomSummarySchema = z.object({
  code: RoomCodeSchema,
  seatCount: z.number().int().min(MIN_SEATS).max(MAX_SEATS),
  started: z.boolean(),
  seats: z.array(
    z.object({
      name: DisplayNameSchema,
      color: z.string().min(1),
      connected: z.boolean(),
    }),
  ),
  /** Nur bei laufenden Partien. */
  turn: z.number().int().min(0).optional(),
  yourTurn: z.boolean().optional(),
  /**
   * Ob dieser Betrachter diese Partie loeschen darf.
   *
   * Eine fertige Antwort und keine Angaben zum Selberrechnen (etwa `hostId`
   * plus „wer ist noch da"). Die Regel steht auf dem Server, weil er sie
   * durchsetzt; stuende sie zusaetzlich im Client, gaebe es zwei Fassungen
   * davon, und die zweite waere die, die man beim naechsten Mal zu aendern
   * vergisst. Die Karte liest hier bloss ab, ob es den Knopf gibt.
   */
  deletable: z.boolean(),
});

export const MyRoomsResponseSchema = z.object({ rooms: z.array(RoomSummarySchema) });

export const RoomCodeResponseSchema = z.object({ code: RoomCodeSchema });

export const JoinRoomRequestSchema = z.object({ code: RoomCodeSchema });

/**
 * Endgueltig aussteigen - und zwar aus einem Raum, in dem man gerade nicht ist.
 *
 * Deshalb traegt diese Nachricht einen Code, `room.leave` dagegen nicht:
 * `room.leave` heisst „ich gehe von diesem Tisch weg, an dem ich sitze", und
 * welcher das ist, weiss die Sitzung. Ausgestiegen wird aber von der Liste auf
 * dem Startbildschirm aus, und dort sitzt man an keinem - man sieht vier
 * Karten und meint eine davon.
 *
 * Was daraus folgt, haengt am Zustand des Raums und steht in `abandonRoom`:
 * im Wartebereich wird ein Platz frei, in einer laufenden Partie ist sie
 * danach abgebrochen. Der Client entscheidet das nicht mit; er bekommt in
 * `ended` gesagt, was geschehen ist.
 */
export const AbandonRoomRequestSchema = z.object({ code: RoomCodeSchema });

export const AbandonRoomResponseSchema = z.object({
  /** `true`, wenn damit eine laufende Partie abgebrochen wurde. */
  ended: z.boolean(),
});

/**
 * Wegraeumen, was niemand mehr braucht.
 *
 * Der Unterschied zum Abbruch ist nicht die Hoeflichkeit, sondern der Bestand:
 * eine abgebrochene Partie bleibt in der Datenbank stehen, eine geloeschte ist
 * fort - samt Startzustand und Log. Deshalb darf das nur der Gastgeber, und
 * nur, wenn ausser ihm niemand mehr am Tisch sitzt. Wer noch da ist, hat an
 * dieser Partie etwas, das ihm gehoert.
 */
export const DeleteRoomRequestSchema = z.object({ code: RoomCodeSchema });

export const EmptyRequestSchema = z.object({});
export const EmptyResponseSchema = z.object({});

export const ActRequestSchema = z.object({ action: GameActionSchema });

export type HelloRequest = z.infer<typeof HelloRequestSchema>;
export type HelloResponse = z.infer<typeof HelloResponseSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type ConfigureRoomRequest = z.infer<typeof ConfigureRoomRequestSchema>;
export type ChooseColorRequest = z.infer<typeof ChooseColorRequestSchema>;
export type RenameRequest = z.infer<typeof RenameRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type AbandonRoomRequest = z.infer<typeof AbandonRoomRequestSchema>;
export type DeleteRoomRequest = z.infer<typeof DeleteRoomRequestSchema>;
export type AbandonRoomResponse = z.infer<typeof AbandonRoomResponseSchema>;
export type ActRequest = z.infer<typeof ActRequestSchema>;
export type RoomCode = z.infer<typeof RoomCodeSchema>;
export type RoomSummary = z.infer<typeof RoomSummarySchema>;
