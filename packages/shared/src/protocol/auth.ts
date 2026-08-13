import { z } from 'zod';

import { DisplayNameSchema } from './room.js';

/**
 * Registrieren, Anmelden, Abmelden.
 *
 * **Die `userId` steht in keiner dieser Anfragen.** Wer schreibt, weiss der
 * Server aus seiner eigenen Verbindungssitzung. Eine mitgeschickte Id waere
 * eine Behauptung des Clients ueber seine Identitaet - genau das schliesst
 * Regel 3 aus.
 */
export const AUTH_REGISTER = 'auth.register';
export const AUTH_LOGIN = 'auth.login';
export const AUTH_LOGOUT = 'auth.logout';
export const AUTH_ME = 'auth.me';
export const AUTH_OK = 'auth.ok';

/**
 * Acht Zeichen, und keine Regeln ueber Ziffern oder Sonderzeichen.
 *
 * Eine Regel „mindestens eine Ziffer" erzeugt `passwort1` und sonst nichts;
 * Laenge ist das Einzige, was zuverlaessig hilft.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Der Login wird kleingeschrieben abgelegt und verglichen.
 *
 * Wer sich als `Anna` registriert, meldet sich auch mit `anna` an - alles
 * andere ist eine Falle, die sich niemand merkt. Der **Anzeigename** bleibt
 * davon unberuehrt, der darf jede Schreibweise haben.
 */
export const LoginNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9._-]+$/, 'Nur Buchstaben, Ziffern, Punkt, Unterstrich und Bindestrich');

export const PasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(200);

export const RegisterRequestSchema = z.object({
  login: LoginNameSchema,
  password: PasswordSchema,
  /**
   * Freiwillig. Sie tut heute nichts - kein Versand, keine Bestaetigung - und
   * liegt fuer eine spaetere Passwort-Wiederherstellung. Bewusst so
   * entschieden; im Dialog steht es ausdruecklich dabei.
   */
  email: z.email().max(200).optional(),
  name: DisplayNameSchema.optional(),
});

export const LoginRequestSchema = z.object({
  login: LoginNameSchema,
  password: PasswordSchema,
  /**
   * „Ja, ich gebe meine Gast-Partien auf." Fehlt sie und der Gast sitzt noch
   * an Tischen, lehnt der Server ab. Der Riegel liegt hier und nicht nur im
   * Dialog, damit er auch fuer den gilt, der am Dialog vorbei sendet.
   */
  confirmAbandonGuest: z.boolean().optional(),
});

export const EmptyAuthRequestSchema = z.object({});

/**
 * Eine Antwortform fuer alle vier - und `hello.ok` traegt dieselben Felder.
 *
 * Vier Formen fuer dieselbe Auskunft waeren vier Stellen, an denen sie
 * auseinanderlaufen kann.
 */
export const AuthResponseSchema = z.object({
  userId: z.string().min(1),
  name: DisplayNameSchema,
  isGuest: z.boolean(),
  /** Fehlt bei Gaesten. */
  login: LoginNameSchema.optional(),
  /** Nur wenn eine neue Sitzung entstanden ist. */
  secret: z.string().min(1).optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
