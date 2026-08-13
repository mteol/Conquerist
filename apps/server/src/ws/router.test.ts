import { describe, expect, it, vi } from 'vitest';
import { PING, PONG, ServerMessageSchema } from '@conquerist/shared';
import { MessageRouter, RejectedError } from './router.js';
import type { RequestContext } from './router.js';
import { registerPingHandler } from './handlers/ping.js';

const context: RequestContext = {
  connectionId: 'conn-test',
  receivedAt: 1_700_000_000_000,
  session: { userId: null, roomCode: null, tokenHash: null },
  events: { send: () => undefined },
};

function buildRouter(now: () => number = () => 1_700_000_000_000): MessageRouter {
  const router = new MessageRouter();
  registerPingHandler(router, now);
  return router;
}

function envelope(id: string, type: string, payload: unknown): string {
  return JSON.stringify({ id, type, payload });
}

describe('MessageRouter - Erfolgsfall', () => {
  it('antwortet auf ping mit pong, Server-Zeitstempel und replyTo', async () => {
    const router = buildRouter(() => 1_234_567_890);

    const response = await router.dispatch(envelope('req-1', PING, {}), context);

    expect(response).toEqual({
      replyTo: 'req-1',
      type: PONG,
      ok: true,
      payload: { serverTime: 1_234_567_890 },
    });
    expect(ServerMessageSchema.safeParse(response).success).toBe(true);
  });

  it('strippt Felder, die nicht im Response-Schema stehen', async () => {
    const router = new MessageRouter();
    // Absichtlich mehr zurueckgeben als das Schema erlaubt - der Router darf das
    // Extrafeld nicht nach draussen lassen (Regel 4, verdeckte Information).
    router.register(
      PING,
      () => ({ serverTime: 1, secretHand: ['brick'] }) as { serverTime: number },
    );

    const response = await router.dispatch(envelope('req-1', PING, {}), context);

    expect(response.payload).toEqual({ serverTime: 1 });
  });
});

describe('MessageRouter - Fehlerpfade', () => {
  it('lehnt kaputtes JSON mit BAD_JSON ab, ohne replyTo', async () => {
    const router = buildRouter();

    const response = await router.dispatch('{ das ist kein json', context);

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('BAD_JSON');
    // Ohne parsebares JSON gibt es keine Korrelations-ID.
    expect('replyTo' in response).toBe(false);
  });

  it('lehnt einen kaputten Envelope mit BAD_ENVELOPE ab', async () => {
    const router = buildRouter();

    const response = await router.dispatch(JSON.stringify({ type: PING, payload: {} }), context);

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('BAD_ENVELOPE');
  });

  it('rettet die id aus einem kaputten Envelope, damit der Client nicht ins Timeout laeuft', async () => {
    const router = buildRouter();

    // `type` fehlt, `id` ist aber verwertbar.
    const response = await router.dispatch(JSON.stringify({ id: 'req-7', payload: {} }), context);

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('BAD_ENVELOPE');
    expect(response.replyTo).toBe('req-7');
  });

  it('lehnt einen unbekannten type mit UNKNOWN_TYPE ab', async () => {
    const router = buildRouter();

    const response = await router.dispatch(envelope('req-2', 'buildSettlement', {}), context);

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('UNKNOWN_TYPE');
    expect(response.replyTo).toBe('req-2');
  });

  it('lehnt eine ungueltige Payload mit INVALID_PAYLOAD ab', async () => {
    const router = new MessageRouter();
    const handler = vi.fn(() => ({ serverTime: 1 }));
    router.register(PING, handler);

    // PingRequestSchema ist z.object({}) - ein String ist kein Objekt.
    const response = await router.dispatch(envelope('req-3', PING, 'nope'), context);

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('INVALID_PAYLOAD');
    expect(response.replyTo).toBe('req-3');
  });

  it('ruft den Handler bei ungueltiger Payload gar nicht auf', async () => {
    const router = new MessageRouter();
    const handler = vi.fn(() => ({ serverTime: 1 }));
    router.register(PING, handler);

    await router.dispatch(envelope('req-4', PING, 42), context);

    expect(handler).not.toHaveBeenCalled();
  });

  it('faengt einen werfenden Handler und meldet INTERNAL', async () => {
    const onHandlerError = vi.fn();
    const router = new MessageRouter({ onHandlerError });
    router.register(PING, () => {
      throw new Error('Datenbank weg');
    });

    const response = await router.dispatch(envelope('req-5', PING, {}), context);

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('INTERNAL');
    expect(response.replyTo).toBe('req-5');
    // Der interne Grund bleibt im Log, nicht in der Antwort.
    expect(response.error?.message).not.toContain('Datenbank');
    expect(onHandlerError).toHaveBeenCalledTimes(1);
  });

  it('meldet INTERNAL, wenn die Handler-Antwort das Response-Schema verletzt', async () => {
    const onHandlerError = vi.fn();
    const router = new MessageRouter({ onHandlerError });
    router.register(PING, () => ({ serverTime: 'jetzt' }) as unknown as { serverTime: number });

    const response = await router.dispatch(envelope('req-6', PING, {}), context);

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('INTERNAL');
    expect(onHandlerError).toHaveBeenCalledTimes(1);
  });
});

describe('MessageRouter - Registrierung', () => {
  it('kennt nach dem Setup genau den ping-Typ', () => {
    expect(buildRouter().registeredTypes).toEqual([PING]);
  });

  it('verhindert doppelte Registrierung', () => {
    const router = buildRouter();
    expect(() => registerPingHandler(router)).toThrow(/bereits registriert/);
  });

  it('erlaubt asynchrone Handler', async () => {
    const router = new MessageRouter();
    router.register(PING, async () => {
      await Promise.resolve();
      return { serverTime: 99 };
    });

    const response = await router.dispatch(envelope('req-8', PING, {}), context);

    expect(response.payload).toEqual({ serverTime: 99 });
  });

  it('unterscheidet eine Ablehnung von einem Absturz', async () => {
    const router = new MessageRouter();
    router.register(PING, () => {
      // Der Aufrufer hat etwas falsch gemacht - kein Serverfehler.
      throw new RejectedError('Der Tisch ist voll');
    });

    const answer = await router.dispatch(envelope('r1', PING, {}), context);

    // Der Grund muss den Spieler erreichen: „Interner Serverfehler" waere hier
    // sowohl falsch als auch nutzlos.
    expect(answer.ok).toBe(false);
    expect(answer.error?.code).toBe('REJECTED');
    expect(answer.error?.message).toBe('Der Tisch ist voll');
  });

  it('haelt einen echten Absturz weiterhin zurueck', async () => {
    const router = new MessageRouter();
    router.register(PING, () => {
      throw new Error('Verbindung zur Datenbank verloren, Passwort war hunter2');
    });

    const answer = await router.dispatch(envelope('r2', PING, {}), context);

    expect(answer.ok).toBe(false);
    // Ein unerwarteter Fehler darf nichts ueber das Innere verraten.
    expect(answer.error?.code).toBe('INTERNAL');
    expect(answer.error?.message).not.toContain('hunter2');
  });
});
