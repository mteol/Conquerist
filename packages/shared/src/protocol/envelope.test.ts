import { describe, expect, it } from 'vitest';
import {
  ClientMessageSchema,
  PING,
  PONG,
  PingRequestSchema,
  PongResponseSchema,
  ProtocolErrorCode,
  ServerMessageSchema,
  errorMessage,
  formatIssues,
  isMessageType,
  protocol,
  protocolEntry,
  salvageCorrelationId,
  successMessage,
} from '../index.js';

describe('ClientMessageSchema', () => {
  it('akzeptiert einen vollstaendigen Envelope', () => {
    const result = ClientMessageSchema.safeParse({
      id: 'req-1',
      type: PING,
      payload: {},
    });

    expect(result.success).toBe(true);
  });

  it('lehnt eine fehlende id ab', () => {
    const result = ClientMessageSchema.safeParse({ type: PING, payload: {} });
    expect(result.success).toBe(false);
  });

  it('lehnt eine leere id ab', () => {
    const result = ClientMessageSchema.safeParse({ id: '', type: PING, payload: {} });
    expect(result.success).toBe(false);
  });

  it('lehnt einen leeren type ab', () => {
    const result = ClientMessageSchema.safeParse({ id: 'req-1', type: '', payload: {} });
    expect(result.success).toBe(false);
  });

  it('laesst eine beliebige payload passieren - die validiert erst der Handler', () => {
    const result = ClientMessageSchema.safeParse({
      id: 'req-1',
      type: 'whatever',
      payload: { nested: [1, 2, 3] },
    });

    expect(result.success).toBe(true);
  });
});

describe('ServerMessageSchema', () => {
  it('akzeptiert eine Erfolgsantwort mit replyTo', () => {
    const result = ServerMessageSchema.safeParse({
      replyTo: 'req-1',
      type: PONG,
      ok: true,
      payload: { serverTime: 1 },
    });

    expect(result.success).toBe(true);
  });

  it('akzeptiert eine Nachricht ohne replyTo - Broadcasts haben keins', () => {
    const result = ServerMessageSchema.safeParse({ type: 'state', ok: true });
    expect(result.success).toBe(true);
  });

  it('lehnt ein nicht-boolesches ok ab', () => {
    const result = ServerMessageSchema.safeParse({ type: PONG, ok: 'yes' });
    expect(result.success).toBe(false);
  });

  it('lehnt einen error ohne code ab', () => {
    const result = ServerMessageSchema.safeParse({
      type: 'error',
      ok: false,
      error: { message: 'kaputt' },
    });

    expect(result.success).toBe(false);
  });
});

describe('successMessage / errorMessage', () => {
  it('erzeugt eine schema-konforme Erfolgsantwort', () => {
    const message = successMessage(PONG, { serverTime: 42 }, 'req-1');

    expect(ServerMessageSchema.safeParse(message).success).toBe(true);
    expect(message).toEqual({
      replyTo: 'req-1',
      type: PONG,
      ok: true,
      payload: { serverTime: 42 },
    });
  });

  it('setzt replyTo nicht auf undefined, sondern laesst den Schluessel weg', () => {
    const message = successMessage('state', { version: 1 });

    // exactOptionalPropertyTypes: fehlender Schluessel != Schluessel mit undefined.
    // Auf der Leitung darf "replyTo": null/undefined niemals auftauchen.
    expect('replyTo' in message).toBe(false);
  });

  it('erzeugt eine schema-konforme Fehlerantwort', () => {
    const message = errorMessage(ProtocolErrorCode.INVALID_PAYLOAD, 'serverTime: erwartet number');

    expect(ServerMessageSchema.safeParse(message).success).toBe(true);
    expect(message.ok).toBe(false);
    expect(message.error?.code).toBe('INVALID_PAYLOAD');
    expect('replyTo' in message).toBe(false);
  });
});

describe('salvageCorrelationId', () => {
  it('findet eine id in einem kaputten Envelope', () => {
    expect(salvageCorrelationId({ id: 'req-9', type: 42 })).toBe('req-9');
  });

  it('gibt undefined zurueck, wenn keine verwertbare id da ist', () => {
    expect(salvageCorrelationId({ id: 7 })).toBeUndefined();
    expect(salvageCorrelationId({ id: '' })).toBeUndefined();
    expect(salvageCorrelationId(null)).toBeUndefined();
    expect(salvageCorrelationId('nope')).toBeUndefined();
  });
});

describe('formatIssues', () => {
  it('verdichtet Zod-Issues zu einer lesbaren Zeile', () => {
    const result = PongResponseSchema.safeParse({ serverTime: 'jetzt' });

    expect(result.success).toBe(false);
    if (result.success) return;

    const formatted = formatIssues(result.error.issues);
    expect(formatted).toContain('serverTime');
  });

  it('benennt die Wurzel, wenn kein Pfad existiert', () => {
    const result = PongResponseSchema.safeParse('kein objekt');

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatIssues(result.error.issues)).toContain('(root)');
  });
});

describe('Protokoll-Registry', () => {
  it('kennt ping und bildet es auf pong ab', () => {
    expect(isMessageType(PING)).toBe(true);
    expect(protocolEntry(PING).responseType).toBe(PONG);
  });

  it('erkennt unbekannte Typen', () => {
    expect(isMessageType('buildSettlement')).toBe(false);
  });

  it('validiert das ping/pong-Paar mit den Schemas aus der Registry', () => {
    const entry = protocol[PING];

    expect(entry.request.safeParse({}).success).toBe(true);
    expect(entry.response.safeParse({ serverTime: 1_700_000_000_000 }).success).toBe(true);
    expect(entry.response.safeParse({ serverTime: -1 }).success).toBe(false);
    expect(entry.response.safeParse({ serverTime: 1.5 }).success).toBe(false);
    expect(entry.response.safeParse({}).success).toBe(false);
  });

  it('haelt die Ping-Payload leer, aber tolerant gegen Zusatzfelder', () => {
    // z.object strippt unbekannte Schluessel - ein alter Client mit Extra-Feld
    // laeuft dadurch nicht in einen Fehler.
    expect(PingRequestSchema.safeParse({ legacy: true }).success).toBe(true);
  });
});
