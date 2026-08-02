import { PING, ServerMessageSchema, WS_PATH } from '@conquerist/shared';
import type { MessageType, RequestOf, ResponseOf, ServerMessage } from '@conquerist/shared';
// Der Client wird gebuendelt (moduleResolution "bundler"), daher hier
// extensionlose Imports - anders als in shared und server, die unter NodeNext
// laufen und die .js-Endung brauchen.
import { backoffDelayMs } from './backoff';
import type { BackoffOptions } from './backoff';
import { RttEstimator } from './rtt';
import type { RttEstimatorOptions } from './rtt';
import { SOCKET_OPEN } from './types';
import type {
  ConnectionListener,
  ConnectionState,
  ConnectionStatus,
  ServerEventListener,
  SocketFactory,
  SocketLike,
} from './types';

/**
 * Duenne Abstraktion ueber den rohen WebSocket.
 *
 * Bewusst frei von React: diese Datei importiert nichts aus react und weiss
 * nichts von Komponenten. Der Hook in `useConnection.ts` legt sich darueber.
 *
 * Zugesagtes Verhalten:
 *   - `send()` korreliert Antworten ueber die Message-ID
 *   - `send()` ohne offene Verbindung lehnt SOFORT ab, keine Warteschlange
 *   - bei Verbindungsverlust werden alle offenen Requests abgelehnt,
 *     KEIN automatisches Replay - was der Server nicht bestaetigt hat, gilt als
 *     nicht passiert, und der Aufrufer entscheidet ueber die Wiederholung
 *   - Auto-Reconnect mit Exponential Backoff und Jitter
 *   - Verbindungsstatus per Callback
 */

/** Nach so langer Funkstille schickt der Client selbst einen Anwendungs-Ping. */
export const DEFAULT_KEEPALIVE_IDLE_MS = 20_000;
/** Takt, in dem die Funkstille geprueft wird. */
export const DEFAULT_KEEPALIVE_CHECK_MS = 5_000;
/** So lange darf eine Trennung dauern, ohne dass die UI sie anzeigt. */
export const DEFAULT_GRACE_PERIOD_MS = 500;
/** Bremse gegen Sofort-Retry-Schleifen bei flackernder Sichtbarkeit. */
const INSTANT_RETRY_COOLDOWN_MS = 1_000;

export type TransportErrorCode =
  'NOT_CONNECTED' | 'CONNECTION_LOST' | 'REQUEST_TIMEOUT' | 'SERVER_ERROR' | 'NO_URL';

export class TransportError extends Error {
  constructor(
    readonly code: TransportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

/** `send()` wurde ohne offene Verbindung aufgerufen. */
export class NotConnectedError extends TransportError {
  constructor() {
    super('NOT_CONNECTED', 'Keine Verbindung zum Server');
  }
}

/** Die Verbindung ist weggebrochen, waehrend der Request unterwegs war. */
export class ConnectionLostError extends TransportError {
  constructor(reason: string) {
    super('CONNECTION_LOST', `Verbindung verloren: ${reason}`);
  }
}

/** Der Server hat innerhalb des adaptiven Timeouts nicht geantwortet. */
export class RequestTimeoutError extends TransportError {
  constructor(
    readonly timeoutMs: number,
    messageType: string,
  ) {
    super('REQUEST_TIMEOUT', `Keine Antwort auf "${messageType}" nach ${timeoutMs} ms`);
  }
}

/** Der Server hat mit `ok: false` geantwortet. */
export class ServerError extends TransportError {
  constructor(
    readonly protocolCode: string,
    detail: string,
  ) {
    super('SERVER_ERROR', `${protocolCode}: ${detail}`);
  }
}

export interface TransportOptions {
  /** Voller WebSocket-URL. Ohne Angabe aus `location` abgeleitet. */
  readonly url?: string;
  readonly socketFactory?: SocketFactory;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly backoff?: BackoffOptions;
  readonly rtt?: RttEstimatorOptions;
  readonly keepaliveIdleMs?: number;
  readonly keepaliveCheckMs?: number;
  readonly gracePeriodMs?: number;
  /** Bindet `online` und `visibilitychange`. In Tests aus. */
  readonly observeEnvironment?: boolean;
  readonly logger?: (message: string, data?: unknown) => void;
}

interface PendingRequest {
  readonly type: string;
  readonly sentAt: number;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly resolve: (payload: unknown) => void;
  readonly reject: (error: Error) => void;
}

export class Transport {
  private readonly url: string;
  private readonly createSocket: SocketFactory;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly backoffOptions: BackoffOptions;
  private readonly keepaliveIdleMs: number;
  private readonly keepaliveCheckMs: number;
  private readonly gracePeriodMs: number;
  private readonly observeEnvironment: boolean;
  private readonly log: (message: string, data?: unknown) => void;

  private readonly rtt: RttEstimator;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Set<ConnectionListener>();
  private readonly eventListeners = new Set<ServerEventListener>();

  private socket: SocketLike | null = null;
  private disposed = false;

  /** Tatsaechlicher Zustand. */
  private status: ConnectionStatus = 'closed';
  /** Nach aussen gemeldeter Zustand - haengt bei kurzen Aussetzern hinterher. */
  private visibleStatus: ConnectionStatus = 'closed';

  private attempt = 0;
  private nextRetryAt: number | null = null;
  private lastError: string | null = null;

  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  private lastMessageAt = 0;
  private lastInstantRetryAt = 0;
  private keepaliveInFlight = false;
  private requestCounter = 0;

  /**
   * Zwischengespeicherter Zustand.
   *
   * Wird nur in `publish()` erneuert. Notwendig, damit `state` bei
   * unveraendertem Zustand identisch bleibt - React vergleicht Snapshots per
   * `Object.is`, und ein bei jedem Zugriff neu gebautes Objekt wuerde zu einer
   * Render-Schleife fuehren.
   */
  private snapshot: ConnectionState;

  constructor(options: TransportOptions = {}) {
    this.url = options.url ?? defaultWebSocketUrl();
    this.createSocket = options.socketFactory ?? browserSocketFactory;
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? Math.random;
    this.backoffOptions = { ...options.backoff, random: options.backoff?.random ?? this.random };
    this.keepaliveIdleMs = options.keepaliveIdleMs ?? DEFAULT_KEEPALIVE_IDLE_MS;
    this.keepaliveCheckMs = options.keepaliveCheckMs ?? DEFAULT_KEEPALIVE_CHECK_MS;
    this.gracePeriodMs = options.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS;
    this.observeEnvironment = options.observeEnvironment ?? true;
    this.log = options.logger ?? (() => undefined);
    this.rtt = new RttEstimator(options.rtt);
    this.snapshot = this.buildState();
  }

  // ---------------------------------------------------------------- oeffentlich

  get state(): ConnectionState {
    return this.snapshot;
  }

  /** Beste Schaetzung der Server-Uhr, `null` bevor ein Pong angekommen ist. */
  serverNow(): number | null {
    const offset = this.rtt.clockOffsetMs;
    return offset === null ? null : this.now() + offset;
  }

  /** Meldet einen Zustands-Listener an und ruft ihn sofort mit dem aktuellen Zustand. */
  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Meldet einen Listener fuer Nachrichten ohne Anfrage an.
   *
   * Seit Etappe 4 kommt der Spielstand so herein: der Server schickt ihn, wenn
   * sich etwas geaendert hat, und nicht, weil jemand gefragt hat. Anders als
   * `subscribe` gibt es hier nichts, womit sofort gerufen werden koennte - ein
   * Ereignis ist ein Zeitpunkt und kein Zustand.
   */
  subscribeEvents(listener: ServerEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  connect(): void {
    if (this.disposed || this.socket !== null) return;

    this.clearRetryTimer();
    this.nextRetryAt = null;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    this.log('verbinde', { url: this.url, attempt: this.attempt });

    let socket: SocketLike;
    try {
      socket = this.createSocket(this.url);
    } catch (error) {
      this.scheduleReconnect(errorText(error));
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      this.handleOpen();
    };
    socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    socket.onerror = () => {
      // `error` liefert im Browser keinen verwertbaren Grund und wird immer von
      // einem `close` begleitet. Nur notieren, das Aufraeumen macht `onclose`.
      this.lastError = 'Socket-Fehler';
    };
    socket.onclose = (event) => {
      this.handleClose(`${event.code}${event.reason ? ` ${event.reason}` : ''}`);
    };
  }

  /**
   * Schickt einen Request und wartet auf die korrelierte Antwort.
   *
   * Lehnt sofort ab, wenn keine Verbindung steht. Absichtlich keine
   * Warteschlange: eine Absicht, die der Spieler vor 20 Sekunden geaeussert hat,
   * darf nicht ueberraschend nach dem Reconnect ausgefuehrt werden.
   */
  async send<K extends MessageType>(type: K, payload: RequestOf<K>): Promise<ResponseOf<K>> {
    const socket = this.socket;

    if (socket === null || socket.readyState !== SOCKET_OPEN) {
      throw new NotConnectedError();
    }

    const id = this.nextRequestId();
    const timeoutMs = this.rtt.timeoutMs;
    const sentAt = this.now();

    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RequestTimeoutError(timeoutMs, type));
      }, timeoutMs);

      this.pending.set(id, { type, sentAt, timer, resolve, reject });
    });

    try {
      socket.send(JSON.stringify({ id, type, payload }));
    } catch (error) {
      this.settle(id, 'reject', new ConnectionLostError(errorText(error)));
    }

    // Die Response-Schemas stehen in der Registry in `shared`; der Server
    // validiert dagegen, bevor er sendet. Hier bleibt genau ein Cast - der
    // Preis dafuer, dass Aufrufer und Handler cast-frei sind.
    return promise as Promise<ResponseOf<K>>;
  }

  /** Schliesst bewusst. Kein Auto-Reconnect danach. */
  close(reason = 'vom Client geschlossen'): void {
    this.clearRetryTimer();
    this.clearGraceTimer();
    this.stopKeepalive();
    this.attempt = 0;
    this.nextRetryAt = null;

    const socket = this.detachSocket();
    socket?.close(1000, 'client closing');

    this.rejectAllPending(reason);
    this.setStatus('closed');
  }

  /** Endgueltiges Aufraeumen. Nach `dispose()` ist die Instanz unbrauchbar. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detachEnvironmentListeners();
    this.close('Transport verworfen');
    this.listeners.clear();
    this.eventListeners.clear();
  }

  // ------------------------------------------------------------------- intern

  private handleOpen(): void {
    this.log('verbunden', { url: this.url });

    this.attempt = 0;
    this.nextRetryAt = null;
    this.lastError = null;
    this.lastMessageAt = this.now();

    // Der alte RTT-Schaetzwert gehoert zur alten Verbindung - eventuell laeuft
    // sie jetzt ueber eine andere Route.
    this.rtt.reset();

    this.startKeepalive();
    this.attachEnvironmentListeners();
    this.setStatus('open');
  }

  private handleClose(reason: string): void {
    if (this.socket === null && this.status === 'closed') return;

    this.detachSocket();
    this.stopKeepalive();
    this.rejectAllPending(reason);

    if (this.disposed) {
      this.setStatus('closed');
      return;
    }

    this.scheduleReconnect(reason);
  }

  private scheduleReconnect(reason: string): void {
    this.lastError = reason;
    const delay = backoffDelayMs(this.attempt, this.backoffOptions);
    this.attempt += 1;
    this.nextRetryAt = this.now() + delay;

    this.log('neuer Versuch geplant', { reason, delay, attempt: this.attempt });

    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);

    this.setStatus('reconnecting');
  }

  private handleMessage(raw: unknown): void {
    this.lastMessageAt = this.now();

    if (typeof raw !== 'string') {
      this.log('Binaerframe ignoriert');
      return;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      this.log('Antwort war kein gueltiges JSON', { raw });
      return;
    }

    const parsed = ServerMessageSchema.safeParse(decoded);
    if (!parsed.success) {
      this.log('Antwort entsprach nicht dem Envelope-Schema', { decoded });
      return;
    }

    const message = parsed.data;

    if (message.replyTo === undefined) {
      // Nachricht ohne Anfrage - seit Etappe 4 der Weg, auf dem Raum- und
      // Spielstand hereinkommen. Die Payload wird hier NICHT gedeutet: welches
      // Schema gilt, weiss die Ereignis-Registry, und der Transport soll vom
      // Spiel nichts wissen.
      if (message.ok) {
        for (const listener of [...this.eventListeners]) listener(message.type, message.payload);
      } else {
        this.log('Fehler ohne Anfrage', { type: message.type });
      }
      return;
    }

    const request = this.pending.get(message.replyTo);
    if (request === undefined) {
      // Antwort auf einen Request, der bereits ins Timeout gelaufen ist.
      this.log('Antwort ohne offenen Request', { replyTo: message.replyTo });
      return;
    }

    this.pending.delete(message.replyTo);
    clearTimeout(request.timer);

    this.rtt.observe({
      sentAt: request.sentAt,
      receivedAt: this.now(),
      serverTimeMs: extractServerTime(message.payload),
    });
    this.publish();

    if (message.ok) {
      request.resolve(message.payload);
      return;
    }

    request.reject(
      new ServerError(message.error?.code ?? 'UNKNOWN', message.error?.message ?? 'ohne Detail'),
    );
  }

  // --------------------------------------------------------------- Keepalive

  /**
   * CLIENT-SEITIGER KEEPALIVE - die Gegenseite zum Heartbeat des Servers.
   *
   * Notwendig, weil der Protokoll-Ping des Servers (RFC 6455) im Browser
   * ueberhaupt nicht sichtbar ist: das Fenster erfaehrt nichts davon, ein
   * "seit 45 Sekunden kam nichts"-Waechter wuerde also gesunde, ruhige
   * Verbindungen abschiessen.
   *
   * Also fragt der Client aktiv nach - mit der ANWENDUNGSNACHRICHT "ping".
   * Bleibt die Antwort aus, ist die Verbindung halb offen (WLAN-Wechsel,
   * Mobilfunk-Handover, zugeklappter Laptop) und wird sofort neu aufgebaut,
   * statt minutenlang auf ein `onclose` zu warten, das nie kommt.
   *
   * Nebeneffekt, den wir sowieso brauchen: laufende RTT- und Uhren-Messungen.
   */
  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      this.checkKeepalive();
    }, this.keepaliveCheckMs);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer === null) return;
    clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = null;
    this.keepaliveInFlight = false;
  }

  private checkKeepalive(): void {
    if (this.socket === null || this.socket.readyState !== SOCKET_OPEN) return;
    if (this.keepaliveInFlight) return;
    if (this.now() - this.lastMessageAt < this.keepaliveIdleMs) return;

    this.keepaliveInFlight = true;

    this.send(PING, {})
      .catch((error: unknown) => {
        // Nur ein Timeout beweist eine tote Verbindung. Ein Serverfehler heisst,
        // dass der Server geantwortet hat, also lebt die Verbindung.
        if (error instanceof RequestTimeoutError) {
          this.log('Keepalive ohne Antwort, Verbindung gilt als tot');
          this.forceReconnect('Keepalive ohne Antwort');
        }
      })
      .finally(() => {
        this.keepaliveInFlight = false;
      });
  }

  /**
   * Verwirft die aktuelle Verbindung, ohne auf ein `close`-Event zu warten.
   *
   * Bei einer halb offenen Verbindung kann `close()` sehr lange brauchen, bis
   * `onclose` feuert. Handler abziehen und selbst in den Reconnect-Pfad gehen.
   */
  private forceReconnect(reason: string): void {
    const socket = this.detachSocket();

    try {
      socket?.close(4000, 'stale connection');
    } catch {
      // Ein toter Socket darf beim Schliessen werfen.
    }

    this.stopKeepalive();
    this.rejectAllPending(reason);

    if (this.disposed) {
      this.setStatus('closed');
      return;
    }

    this.scheduleReconnect(reason);
  }

  // ------------------------------------------------------------- Umgebungshooks

  /**
   * Sofort-Retry statt Backoff abwarten.
   *
   * Kommt der Tab zurueck in den Vordergrund oder meldet das Betriebssystem das
   * Netz zurueck, ist ein laufender 30-Sekunden-Timer die falsche Antwort.
   * Ohne das sitzt man nach dem Aufklappen des Laptops vor einem toten Brett,
   * obwohl das Netz laengst wieder da ist.
   */
  private environmentAttached = false;

  private readonly onNetworkOnline = (): void => {
    this.retryNow('Netz wieder verfuegbar');
  };

  private readonly onVisibilityChange = (): void => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;

    if (this.socket !== null && this.socket.readyState === SOCKET_OPEN) {
      // Verbindung sieht offen aus - nach einem Suspend kann sie trotzdem tot
      // sein. Sofort pruefen statt bis zum naechsten Takt zu warten.
      this.lastMessageAt = Math.min(this.lastMessageAt, this.now() - this.keepaliveIdleMs);
      this.checkKeepalive();
      return;
    }

    this.retryNow('Tab wieder sichtbar');
  };

  private attachEnvironmentListeners(): void {
    if (this.environmentAttached || !this.observeEnvironment) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    window.addEventListener('online', this.onNetworkOnline);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.environmentAttached = true;
  }

  private detachEnvironmentListeners(): void {
    if (!this.environmentAttached) return;

    window.removeEventListener('online', this.onNetworkOnline);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.environmentAttached = false;
  }

  private retryNow(reason: string): void {
    if (this.disposed || this.retryTimer === null) return;

    const now = this.now();
    if (now - this.lastInstantRetryAt < INSTANT_RETRY_COOLDOWN_MS) return;
    this.lastInstantRetryAt = now;

    this.log('Sofort-Retry', { reason });

    this.clearRetryTimer();
    // Die Ursache ist weg, also auch die Backoff-Kurve. Der Cooldown oben
    // verhindert, dass flackernde Sichtbarkeit daraus eine Schleife macht.
    this.attempt = 0;
    this.nextRetryAt = null;
    this.connect();
  }

  // ------------------------------------------------------------------ Zustand

  /**
   * Zustandswechsel mit Karenzzeit.
   *
   * Ein 200-Millisekunden-Aussetzer darf nicht "Getrennt" auf den Bildschirm
   * werfen. Intern wechselt der Zustand sofort; nach aussen wird der Wechsel von
   * `open` nach `reconnecting` um `gracePeriodMs` verzoegert. Steht die
   * Verbindung vorher wieder, hat nie etwas geflackert.
   */
  private setStatus(next: ConnectionStatus): void {
    this.status = next;

    if (next === 'reconnecting' && this.visibleStatus === 'open') {
      if (this.graceTimer === null) {
        this.graceTimer = setTimeout(() => {
          this.graceTimer = null;
          if (this.status === 'reconnecting' || this.status === 'connecting') {
            this.visibleStatus = 'reconnecting';
            this.publish();
          }
        }, this.gracePeriodMs);
      }

      // Trotzdem melden: attempt und nextRetryAt haben sich geaendert.
      this.publish();
      return;
    }

    this.clearGraceTimer();
    this.visibleStatus = next;
    this.publish();
  }

  private buildState(): ConnectionState {
    return {
      status: this.visibleStatus,
      attempt: this.attempt,
      nextRetryAt: this.nextRetryAt,
      rttMs: this.rtt.lastRttMs,
      clockOffsetMs: this.rtt.clockOffsetMs,
      lastError: this.lastError,
    };
  }

  private publish(): void {
    this.snapshot = this.buildState();
    for (const listener of [...this.listeners]) {
      listener(this.snapshot);
    }
  }

  // ----------------------------------------------------------------- Hilfsteil

  private detachSocket(): SocketLike | null {
    const socket = this.socket;
    if (socket === null) return null;

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    this.socket = null;

    return socket;
  }

  /**
   * Lehnt alle offenen Requests ab. Kein Replay: der Aufrufer erfaehrt den
   * Fehlschlag und entscheidet selbst, ob er es erneut versucht.
   */
  private rejectAllPending(reason: string): void {
    if (this.pending.size === 0) return;

    const error = new ConnectionLostError(reason);
    for (const [id, request] of [...this.pending]) {
      this.pending.delete(id);
      clearTimeout(request.timer);
      request.reject(error);
    }
  }

  private settle(id: string, mode: 'reject', error: Error): void {
    const request = this.pending.get(id);
    if (request === undefined) return;

    this.pending.delete(id);
    clearTimeout(request.timer);
    if (mode === 'reject') request.reject(error);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer === null) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private clearGraceTimer(): void {
    if (this.graceTimer === null) return;
    clearTimeout(this.graceTimer);
    this.graceTimer = null;
  }

  private nextRequestId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid !== undefined) return uuid;

    this.requestCounter += 1;
    return `req-${this.now().toString(36)}-${this.requestCounter}`;
  }
}

/**
 * Leitet den WebSocket-URL aus der aktuellen Seite ab.
 *
 * Keine Portnummer im Code: in der Entwicklung nimmt der Vite-Proxy den
 * Upgrade auf 5173 an, in Produktion liefert derselbe Origin Seite und Socket.
 */
export function defaultWebSocketUrl(): string {
  if (typeof location === 'undefined') {
    throw new TransportError(
      'NO_URL',
      'Kein location-Objekt vorhanden - url muss explizit uebergeben werden',
    );
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}${WS_PATH}`;
}

const browserSocketFactory: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike;

/**
 * Liest `serverTime` aus einer beliebigen Antwort-Payload.
 *
 * Absichtlich nach Feldname und nicht nach Nachrichtentyp: jede kuenftige
 * Nachricht, die einen Server-Zeitstempel mitbringt, verbessert damit
 * automatisch die Uhrenschaetzung.
 */
function extractServerTime(payload: ServerMessage['payload']): number | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const value = (payload as Record<string, unknown>)['serverTime'];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
