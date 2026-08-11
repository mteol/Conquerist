import {
  ClientMessageSchema,
  ProtocolErrorCode,
  errorMessage,
  formatIssues,
  protocol,
  salvageCorrelationId,
  successMessage,
} from '@conquerist/shared';
import type { MessageType, RequestOf, ResponseOf, ServerMessage } from '@conquerist/shared';
import type { EventSink } from './events.js';

/**
 * Eine Ablehnung, die der Aufrufer lesen darf.
 *
 * Jeder andere Wurf wird zu `INTERNAL` mit einer nichtssagenden Meldung - das
 * ist richtig, solange niemand weiss, was schiefging. Wo der Handler es aber
 * weiss und die Meldung fuer Spieler geschrieben ist, waere „Interner
 * Serverfehler" zweimal falsch: sie stimmt nicht, und sie hilft nicht.
 */
export class RejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RejectedError';
  }
}

/**
 * Was an dieser Verbindung bekannt ist.
 *
 * Absichtlich veraenderbar: `hello` traegt hier die Nutzer-Id ein, `joinRoom`
 * den Raum. Die Alternative waere, bei jeder Nachricht erneut zu ermitteln, wer
 * da schreibt - und genau das soll ein Angreifer nicht beeinflussen koennen.
 */
export interface Session {
  userId: string | null;
  roomCode: string | null;
  /** Womit sich diese Verbindung abmelden kann. `hello` traegt ihn ein. */
  tokenHash: string | null;
}

/**
 * Kontext, den jeder Handler bekommt.
 *
 * Absichtlich frei von ws-Typen: dadurch sind Router und Handler ohne Server,
 * ohne Socket und ohne offenen Port testbar. Die Sitzung ist ab Etappe 4 das
 * Stueck Zustand, das die einzelne Nachricht ueberdauert.
 */
export interface RequestContext {
  readonly connectionId: string;
  readonly receivedAt: number;
  readonly session: Session;
  /**
   * Der Rueckkanal dieser Verbindung. Ein Handler braucht ihn, um die Senke
   * unter der Nutzer-Id einzutragen - vorher weiss niemand, wer da schreibt.
   */
  readonly events: EventSink;
}

export type MessageHandler<K extends MessageType> = (
  payload: RequestOf<K>,
  context: RequestContext,
) => ResponseOf<K> | Promise<ResponseOf<K>>;

interface RegisteredHandler {
  readonly responseType: string;
  readonly parseRequest: (payload: unknown) => ParseResult;
  readonly parseResponse: (payload: unknown) => ParseResult;
  readonly run: (payload: unknown, context: RequestContext) => Promise<unknown>;
}

type ParseResult =
  { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly message: string };

export interface RouterOptions {
  /**
   * Wird bei einem **unerwartet** werfenden Handler aufgerufen; der Client
   * sieht dann nur INTERNAL. Eine `RejectedError` laeuft hier nicht durch -
   * sie ist ein normaler Ausgang und kein Vorfall.
   */
  readonly onHandlerError?: (type: string, error: unknown, context: RequestContext) => void;
}

/**
 * Dispatch nach `type` mit Zod-Validierung VOR dem Handler.
 *
 * Reihenfolge - jeder Schritt kann abbrechen und erzeugt dann eine
 * `ok: false`-Antwort mit passendem Code:
 *
 *   1. JSON parsen                  -> BAD_JSON        (kein replyTo moeglich)
 *   2. Envelope validieren          -> BAD_ENVELOPE    (replyTo nur, wenn `id` zu retten war)
 *   3. Handler suchen               -> UNKNOWN_TYPE
 *   4. Payload gegen Handler-Schema -> INVALID_PAYLOAD (Handler wird nicht aufgerufen)
 *   5. Handler ausfuehren           -> INTERNAL bei Wurf
 *
 * `dispatch` sendet nichts selbst, sondern gibt die Antwort zurueck. Damit sind
 * alle fuenf Pfade ohne Netzwerk pruefbar.
 */
export class MessageRouter {
  private readonly handlers = new Map<string, RegisteredHandler>();

  constructor(private readonly options: RouterOptions = {}) {}

  /**
   * Registriert einen Handler. Request- und Response-Schema kommen aus der
   * Protokoll-Registry in `shared`, nicht aus dem Aufruf - dadurch koennen
   * Server und Client nicht auseinanderlaufen.
   */
  register<K extends MessageType>(type: K, handler: MessageHandler<K>): this {
    if (this.handlers.has(type)) {
      throw new Error(`Handler fuer "${type}" ist bereits registriert`);
    }

    const entry = protocol[type];

    this.handlers.set(type, {
      responseType: entry.responseType,
      parseRequest: (payload) => toParseResult(entry.request.safeParse(payload)),
      parseResponse: (payload) => toParseResult(entry.response.safeParse(payload)),
      // Der einzige Cast im gesamten Nachrichtenpfad, und er steht direkt hinter
      // der Validierung. Handler und Aufrufer bleiben cast-frei.
      run: async (payload, context) => handler(payload as RequestOf<K>, context),
    });

    return this;
  }

  get registeredTypes(): readonly string[] {
    return [...this.handlers.keys()];
  }

  async dispatch(raw: string, context: RequestContext): Promise<ServerMessage> {
    // 1. JSON
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return errorMessage(ProtocolErrorCode.BAD_JSON, 'Nachricht war kein gueltiges JSON');
    }

    // 2. Envelope
    const envelope = ClientMessageSchema.safeParse(decoded);
    if (!envelope.success) {
      return errorMessage(
        ProtocolErrorCode.BAD_ENVELOPE,
        `Envelope ungueltig - ${formatIssues(envelope.error.issues)}`,
        salvageCorrelationId(decoded),
      );
    }

    const message = envelope.data;

    // 3. Handler
    const handler = this.handlers.get(message.type);
    if (handler === undefined) {
      return errorMessage(
        ProtocolErrorCode.UNKNOWN_TYPE,
        `Unbekannter Nachrichtentyp "${message.type}"`,
        message.id,
      );
    }

    // 4. Payload - VOR dem Handler
    const request = handler.parseRequest(message.payload);
    if (!request.ok) {
      return errorMessage(
        ProtocolErrorCode.INVALID_PAYLOAD,
        `Payload ungueltig - ${request.message}`,
        message.id,
      );
    }

    // 5. Handler
    let result: unknown;
    try {
      // Bewusst die GEPARSTE Payload, nicht die rohe: z.object strippt
      // unbekannte Schluessel, der Handler sieht also nie Felder, die im
      // Schema nicht stehen.
      result = await handler.run(request.data, context);
    } catch (error) {
      // Eine Ablehnung ist kein Absturz: ihr Text ist fuer den Spieler
      // geschrieben und geht deshalb mit hinaus.
      if (error instanceof RejectedError) {
        return errorMessage(ProtocolErrorCode.REJECTED, error.message, message.id);
      }

      this.options.onHandlerError?.(message.type, error, context);
      return errorMessage(
        ProtocolErrorCode.INTERNAL,
        'Interner Serverfehler bei der Verarbeitung der Nachricht',
        message.id,
      );
    }

    // Auch die Antwort geht durchs Schema. Zwei Gruende: Drift zwischen Handler
    // und Registry fliegt sofort auf, und - ab Etappe 4 wichtiger - was nicht im
    // Response-Schema steht, kann den Server nicht verlassen (Regel 4,
    // verdeckte Information).
    const response = handler.parseResponse(result);
    if (!response.ok) {
      this.options.onHandlerError?.(
        message.type,
        new Error(`Antwort verletzt Response-Schema - ${response.message}`),
        context,
      );
      return errorMessage(
        ProtocolErrorCode.INTERNAL,
        'Interner Serverfehler bei der Verarbeitung der Nachricht',
        message.id,
      );
    }

    return successMessage(handler.responseType, response.data, message.id);
  }
}

function toParseResult(result: {
  success: boolean;
  data?: unknown;
  error?: {
    issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[];
  };
}): ParseResult {
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    message:
      result.error === undefined
        ? 'unbekannter Validierungsfehler'
        : formatIssues(result.error.issues),
  };
}
