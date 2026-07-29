import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PING, PONG } from '@conquerist/shared';
import {
  ConnectionLostError,
  NotConnectedError,
  RequestTimeoutError,
  ServerError,
  Transport,
} from './transport';
import type { TransportOptions } from './transport';
import type { ConnectionState, ConnectionStatus, SocketLike } from './types';

const URL = 'ws://test.invalid/ws';

interface Envelope {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
}

/**
 * Attrappe fuer einen WebSocket.
 *
 * Deshalb programmiert `transport.ts` gegen `SocketLike` und nicht gegen den
 * globalen WebSocket: die Tests brauchen kein jsdom, keinen Port und keinen
 * echten Server, koennen aber jeden Zustandsuebergang exakt ausloesen.
 */
class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];

  readyState = 0;
  readonly sent: string[] = [];
  closedWith: { code: number; reason: string } | null = null;

  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('socket ist nicht offen');
    this.sent.push(data);
  }

  close(code = 1000, reason = ''): void {
    this.readyState = 3;
    this.closedWith = { code, reason };
    this.onclose?.({ code, reason });
  }

  // ------------------------------------------------------------ Teststeuerung

  simulateOpen(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  /** Abbruch ohne Close-Handshake, wie beim gekillten Server (Code 1006). */
  simulateDrop(code = 1006, reason = 'abnormal closure'): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  deliver(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  requests(): Envelope[] {
    return this.sent.map((raw) => JSON.parse(raw) as Envelope);
  }

  lastRequest(): Envelope {
    const requests = this.requests();
    const last = requests[requests.length - 1];
    if (last === undefined) throw new Error('keine Nachricht gesendet');
    return last;
  }

  /** Antwortet auf die letzte Anfrage mit einem Pong. */
  respondPong(serverTime: number): void {
    this.deliver({
      replyTo: this.lastRequest().id,
      type: PONG,
      ok: true,
      payload: { serverTime },
    });
  }
}

interface Harness {
  readonly transport: Transport;
  readonly states: ConnectionState[];
  readonly statuses: ConnectionStatus[];
  socket(index: number): FakeSocket;
  readonly socketCount: () => number;
}

function setup(options: Partial<TransportOptions> = {}): Harness {
  FakeSocket.instances = [];

  const transport = new Transport({
    url: URL,
    socketFactory: (url) => new FakeSocket(url),
    // window/document existieren im node-Environment nicht; die Listener sind
    // ausserdem nicht Gegenstand dieser Tests.
    observeEnvironment: false,
    // Jitter neutralisieren: random() === 0.5 ergibt genau den Nominalwert.
    backoff: { random: () => 0.5 },
    ...options,
  });

  const states: ConnectionState[] = [];
  transport.subscribe((state) => {
    states.push(state);
  });

  return {
    transport,
    states,
    get statuses() {
      return states.map((state) => state.status);
    },
    socket: (index) => {
      const socket = FakeSocket.instances[index];
      if (socket === undefined) throw new Error(`Socket ${index} existiert nicht`);
      return socket;
    },
    socketCount: () => FakeSocket.instances.length,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Transport - send()', () => {
  it('lehnt ohne offene Verbindung sofort ab und legt nichts in eine Warteschlange', async () => {
    const harness = setup();

    await expect(harness.transport.send(PING, {})).rejects.toBeInstanceOf(NotConnectedError);

    // Kein Socket, keine gepufferte Nachricht.
    expect(harness.socketCount()).toBe(0);
  });

  it('lehnt auch waehrend eines Wiederverbindungsversuchs sofort ab', async () => {
    const harness = setup();
    harness.transport.connect();
    harness.socket(0).simulateOpen();
    harness.socket(0).simulateDrop();

    await expect(harness.transport.send(PING, {})).rejects.toBeInstanceOf(NotConnectedError);
  });

  it('loest mit der korrelierten Antwort auf', async () => {
    const harness = setup();
    harness.transport.connect();
    harness.socket(0).simulateOpen();

    const promise = harness.transport.send(PING, {});
    const request = harness.socket(0).lastRequest();

    expect(request.type).toBe(PING);
    expect(request.id).toEqual(expect.any(String));

    harness.socket(0).respondPong(1_700_000_000_000);

    await expect(promise).resolves.toEqual({ serverTime: 1_700_000_000_000 });
  });

  it('ordnet Antworten ueber die id zu, auch wenn sie vertauscht eintreffen', async () => {
    const harness = setup();
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    const first = harness.transport.send(PING, {});
    const second = harness.transport.send(PING, {});

    const requests = socket.requests();
    expect(requests).toHaveLength(2);

    // Zweite Antwort zuerst.
    socket.deliver({ replyTo: requests[1]?.id, type: PONG, ok: true, payload: { serverTime: 2 } });
    socket.deliver({ replyTo: requests[0]?.id, type: PONG, ok: true, payload: { serverTime: 1 } });

    await expect(second).resolves.toEqual({ serverTime: 2 });
    await expect(first).resolves.toEqual({ serverTime: 1 });
  });

  it('lehnt mit ServerError ab, wenn der Server ok:false schickt', async () => {
    const harness = setup();
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    const promise = harness.transport.send(PING, {});
    socket.deliver({
      replyTo: socket.lastRequest().id,
      type: 'error',
      ok: false,
      error: { code: 'INVALID_PAYLOAD', message: 'kaputt' },
    });

    await expect(promise).rejects.toBeInstanceOf(ServerError);
    await expect(promise).rejects.toThrow(/INVALID_PAYLOAD/);
  });

  it('ignoriert Antworten, deren Envelope nicht dem Schema entspricht', async () => {
    const harness = setup();
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    const promise = harness.transport.send(PING, {});
    const id = socket.lastRequest().id;

    // `ok` fehlt -> Envelope ungueltig, darf den Request nicht aufloesen.
    socket.deliver({ replyTo: id, type: PONG, payload: { serverTime: 1 } });
    socket.deliver({ replyTo: id, type: PONG, ok: true, payload: { serverTime: 7 } });

    await expect(promise).resolves.toEqual({ serverTime: 7 });
  });
});

describe('Transport - Timeout', () => {
  it('lehnt nach dem adaptiven Timeout mit RequestTimeoutError ab', async () => {
    const harness = setup({ rtt: { initialTimeoutMs: 5_000 } });
    harness.transport.connect();
    harness.socket(0).simulateOpen();

    const promise = harness.transport.send(PING, {});
    const assertion = expect(promise).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it('laesst die Verbindung nach einem Timeout unangetastet', async () => {
    const harness = setup({ rtt: { initialTimeoutMs: 1_000 } });
    harness.transport.connect();
    harness.socket(0).simulateOpen();

    const promise = harness.transport.send(PING, {});
    promise.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1_000);

    // Ein langsamer Request ist kein Verbindungsverlust.
    expect(harness.transport.state.status).toBe('open');
    expect(harness.socketCount()).toBe(1);
  });

  it('nutzt nach Messungen einen aus dem RTT abgeleiteten Timeout', async () => {
    const harness = setup({
      rtt: { initialTimeoutMs: 5_000, minTimeoutMs: 100, maxTimeoutMs: 15_000 },
    });
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    // Erste Messung: 40 ms.
    const first = harness.transport.send(PING, {});
    await vi.advanceTimersByTimeAsync(40);
    socket.respondPong(Date.now());
    await first;

    expect(harness.transport.state.rttMs).toBe(40);

    // srtt = 40, rttvar = 20 -> Timeout = 40 + 80 = 120 ms, also weit unter den
    // initialen 5000. Nach 200 ms muss der naechste Request abgelaufen sein.
    const second = harness.transport.send(PING, {});
    const assertion = expect(second).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(200);
    await assertion;
  });
});

describe('Transport - Verbindungsverlust', () => {
  it('lehnt alle offenen Requests ab', async () => {
    const harness = setup();
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    const first = harness.transport.send(PING, {});
    const second = harness.transport.send(PING, {});

    socket.simulateDrop();

    await expect(first).rejects.toBeInstanceOf(ConnectionLostError);
    await expect(second).rejects.toBeInstanceOf(ConnectionLostError);
  });

  it('spielt abgebrochene Requests nach dem Reconnect NICHT erneut ab', async () => {
    const harness = setup({ backoff: { baseMs: 1_000, random: () => 0.5 } });
    harness.transport.connect();
    const first = harness.socket(0);
    first.simulateOpen();

    const inFlight = harness.transport.send(PING, {});
    inFlight.catch(() => undefined);
    expect(first.sent).toHaveLength(1);

    first.simulateDrop();
    await vi.advanceTimersByTimeAsync(1_000);

    const second = harness.socket(1);
    second.simulateOpen();

    // Der neue Socket hat nichts gesendet: keine Warteschlange, kein Replay.
    expect(second.sent).toHaveLength(0);
  });

  it('verbindet mit exponentiell steigendem Abstand neu', async () => {
    const harness = setup({ backoff: { baseMs: 1_000, maxMs: 30_000, random: () => 0.5 } });
    harness.transport.connect();
    harness.socket(0).simulateOpen();
    harness.socket(0).simulateDrop();

    // Erster Versuch nach 1000 ms.
    await vi.advanceTimersByTimeAsync(999);
    expect(harness.socketCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.socketCount()).toBe(2);

    // Schlaegt fehl -> zweiter Versuch nach 2000 ms.
    harness.socket(1).simulateDrop();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(harness.socketCount()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.socketCount()).toBe(3);

    // Und danach nach 4000 ms.
    harness.socket(2).simulateDrop();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(harness.socketCount()).toBe(4);
  });

  it('setzt den Versuchszaehler nach einer erfolgreichen Verbindung zurueck', async () => {
    const harness = setup({ backoff: { baseMs: 1_000, random: () => 0.5 } });
    harness.transport.connect();
    harness.socket(0).simulateOpen();
    harness.socket(0).simulateDrop();

    expect(harness.transport.state.attempt).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    harness.socket(1).simulateOpen();

    expect(harness.transport.state.attempt).toBe(0);
    expect(harness.transport.state.status).toBe('open');
  });

  it('meldet den naechsten Versuchszeitpunkt, damit die UI herunterzaehlen kann', () => {
    const harness = setup({ backoff: { baseMs: 1_000, random: () => 0.5 } });
    harness.transport.connect();
    harness.socket(0).simulateOpen();

    const before = Date.now();
    harness.socket(0).simulateDrop();

    expect(harness.transport.state.nextRetryAt).toBe(before + 1_000);
  });
});

describe('Transport - Karenzzeit', () => {
  it('zeigt einen kurzen Aussetzer nicht als Trennung an', async () => {
    const harness = setup({ gracePeriodMs: 500, backoff: { baseMs: 1_000, random: () => 0.5 } });
    harness.transport.connect();
    harness.socket(0).simulateOpen();
    harness.socket(0).simulateDrop();

    // Sofort nach dem Abbruch steht nach aussen weiter "open".
    expect(harness.transport.state.status).toBe('open');

    await vi.advanceTimersByTimeAsync(499);
    expect(harness.transport.state.status).toBe('open');

    await vi.advanceTimersByTimeAsync(1);
    expect(harness.transport.state.status).toBe('reconnecting');
  });

  it('flackert nicht, wenn die Verbindung innerhalb der Karenzzeit zurueckkommt', async () => {
    const harness = setup({ gracePeriodMs: 500, backoff: { baseMs: 100, random: () => 0.5 } });
    harness.transport.connect();
    harness.socket(0).simulateOpen();

    const statusesBefore = harness.statuses.length;
    harness.socket(0).simulateDrop();

    await vi.advanceTimersByTimeAsync(100);
    harness.socket(1).simulateOpen();
    await vi.advanceTimersByTimeAsync(1_000);

    const seen = harness.statuses.slice(statusesBefore);
    expect(seen).not.toContain('reconnecting');
    expect(harness.transport.state.status).toBe('open');
  });

  it('zeigt einen fehlgeschlagenen Erstverbindungsversuch sofort an', async () => {
    const harness = setup({ gracePeriodMs: 500, backoff: { baseMs: 1_000, random: () => 0.5 } });
    harness.transport.connect();

    expect(harness.transport.state.status).toBe('connecting');

    // War die Verbindung noch nie offen, gibt es nichts zu schonen.
    harness.socket(0).simulateDrop(1006, 'connection refused');
    expect(harness.transport.state.status).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(0);
  });
});

describe('Transport - Keepalive', () => {
  it('schickt nach Funkstille von sich aus einen Anwendungs-Ping', async () => {
    const harness = setup({ keepaliveIdleMs: 20_000, keepaliveCheckMs: 5_000 });
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    await vi.advanceTimersByTimeAsync(19_000);
    expect(socket.sent).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(socket.requests().map((request) => request.type)).toEqual([PING]);
  });

  it('haelt eine antwortende Verbindung offen', async () => {
    const harness = setup({ keepaliveIdleMs: 20_000, keepaliveCheckMs: 5_000 });
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    for (let round = 0; round < 3; round += 1) {
      await vi.advanceTimersByTimeAsync(20_000);
      socket.respondPong(Date.now());
      await vi.advanceTimersByTimeAsync(0);
    }

    expect(harness.transport.state.status).toBe('open');
    expect(harness.socketCount()).toBe(1);
  });

  it('erkennt eine halb offene Verbindung und baut sie neu auf', async () => {
    const harness = setup({
      keepaliveIdleMs: 20_000,
      keepaliveCheckMs: 5_000,
      rtt: { initialTimeoutMs: 5_000 },
      backoff: { baseMs: 1_000, random: () => 0.5 },
    });
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    // Keepalive geht raus, es kommt aber nie eine Antwort - genau der Fall, in
    // dem der Browser kein onclose liefert.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(socket.sent).toHaveLength(1);

    // Timeout des Keepalive.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(socket.closedWith?.code).toBe(4000);

    // Danach greift der normale Reconnect.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.socketCount()).toBe(2);
  });
});

describe('Transport - Uhrenversatz', () => {
  it('schaetzt den Versatz aus serverTime und halbem RTT', async () => {
    const harness = setup();
    harness.transport.connect();
    const socket = harness.socket(0);
    socket.simulateOpen();

    const localSentAt = Date.now();
    const promise = harness.transport.send(PING, {});

    await vi.advanceTimersByTimeAsync(100);

    // Server laeuft 5000 ms vor und stempelt in der Mitte des Umlaufs.
    socket.respondPong(localSentAt + 50 + 5_000);
    await promise;

    // offset = serverTime + rtt/2 - receivedAt = (t+50+5000) + 50 - (t+100)
    expect(harness.transport.state.clockOffsetMs).toBe(5_000);
    expect(harness.transport.serverNow()).toBe(Date.now() + 5_000);
  });

  it('liefert null, solange kein Pong angekommen ist', () => {
    const harness = setup();
    expect(harness.transport.serverNow()).toBeNull();
    expect(harness.transport.state.clockOffsetMs).toBeNull();
  });
});

describe('Transport - Aufraeumen', () => {
  it('verbindet nach dispose() nicht mehr neu', async () => {
    const harness = setup({ backoff: { baseMs: 1_000, random: () => 0.5 } });
    harness.transport.connect();
    harness.socket(0).simulateOpen();

    harness.transport.dispose();

    expect(harness.transport.state.status).toBe('closed');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(harness.socketCount()).toBe(1);
  });

  it('lehnt offene Requests bei close() ab', async () => {
    const harness = setup();
    harness.transport.connect();
    harness.socket(0).simulateOpen();

    const promise = harness.transport.send(PING, {});
    harness.transport.close();

    await expect(promise).rejects.toBeInstanceOf(ConnectionLostError);
    expect(harness.transport.state.status).toBe('closed');
  });

  it('stoppt den Keepalive nach close()', async () => {
    const harness = setup({ keepaliveIdleMs: 20_000, keepaliveCheckMs: 5_000 });
    harness.transport.connect();
    harness.socket(0).simulateOpen();
    harness.transport.close();

    await vi.advanceTimersByTimeAsync(120_000);

    expect(harness.socket(0).sent).toHaveLength(0);
    expect(harness.socketCount()).toBe(1);
  });
});
