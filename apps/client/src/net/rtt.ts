/**
 * RTT-Schaetzer und Uhrenversatz.
 *
 * Statt eines festen Request-Timeouts wird der Timeout aus den gemessenen
 * Umlaufzeiten abgeleitet - dasselbe Verfahren, mit dem TCP sein
 * Retransmission Timeout bestimmt (Jacobson/Karels):
 *
 *   srtt   = geglaetteter Mittelwert der Umlaufzeit
 *   rttvar = geglaettete mittlere Abweichung
 *   timeout = srtt + 4 * rttvar, geklemmt auf [min, max]
 *
 * Ein fester Wert ist im LAN zu traege und im Mobilfunk zu aggressiv. Der
 * Schaetzer passt sich an und toleriert Ausschlaege, ohne bei einer stabilen
 * Verbindung unnoetig lang zu warten.
 *
 * Nebenprodukt: aus `serverTime` im Pong und dem gemessenen RTT faellt der
 * Uhrenversatz zwischen Client und Server ab (NTP-Prinzip). Ab Etappe 5 haengen
 * daran Zug-Timer und synchrone Animationen.
 */

export interface RttEstimatorOptions {
  /** Timeout, solange keine Messung vorliegt. */
  readonly initialTimeoutMs?: number;
  readonly minTimeoutMs?: number;
  readonly maxTimeoutMs?: number;
  /** Glaettungsfaktor fuer srtt. TCP verwendet 1/8. */
  readonly alpha?: number;
  /** Glaettungsfaktor fuer rttvar. TCP verwendet 1/4. */
  readonly beta?: number;
}

export interface RoundTripSample {
  readonly sentAt: number;
  readonly receivedAt: number;
  /** Server-Uhr in ms, falls die Antwort sie mitgebracht hat. */
  readonly serverTimeMs?: number | undefined;
}

export const DEFAULT_INITIAL_TIMEOUT_MS = 5_000;
export const DEFAULT_MIN_TIMEOUT_MS = 2_000;
export const DEFAULT_MAX_TIMEOUT_MS = 15_000;

/** Glaettung des Uhrenversatzes. Traeger als der RTT, weil Uhren nicht springen. */
const OFFSET_ALPHA = 0.25;

export class RttEstimator {
  private srtt: number | null = null;
  private rttvar = 0;
  private lastRtt: number | null = null;
  private offset: number | null = null;

  private readonly initialTimeoutMs: number;
  private readonly minTimeoutMs: number;
  private readonly maxTimeoutMs: number;
  private readonly alpha: number;
  private readonly beta: number;

  constructor(options: RttEstimatorOptions = {}) {
    this.initialTimeoutMs = options.initialTimeoutMs ?? DEFAULT_INITIAL_TIMEOUT_MS;
    this.minTimeoutMs = options.minTimeoutMs ?? DEFAULT_MIN_TIMEOUT_MS;
    this.maxTimeoutMs = options.maxTimeoutMs ?? DEFAULT_MAX_TIMEOUT_MS;
    this.alpha = options.alpha ?? 1 / 8;
    this.beta = options.beta ?? 1 / 4;
  }

  /** Letzte gemessene Umlaufzeit, `null` vor der ersten Messung. */
  get lastRttMs(): number | null {
    return this.lastRtt;
  }

  /** Geglaetteter Mittelwert, `null` vor der ersten Messung. */
  get smoothedRttMs(): number | null {
    return this.srtt === null ? null : Math.round(this.srtt);
  }

  /** Geschaetzter Versatz: `Date.now() + offset` ist die Server-Uhr. */
  get clockOffsetMs(): number | null {
    return this.offset === null ? null : Math.round(this.offset);
  }

  /** Adaptiver Request-Timeout. */
  get timeoutMs(): number {
    if (this.srtt === null) return this.initialTimeoutMs;

    const estimate = this.srtt + 4 * this.rttvar;
    return Math.round(Math.min(this.maxTimeoutMs, Math.max(this.minTimeoutMs, estimate)));
  }

  /**
   * Verarbeitet eine erfolgreiche Antwort. Reihenfolge ist bewusst so:
   * erst den Ausreisser-Test gegen den ALTEN srtt fuer den Uhrenversatz,
   * dann srtt aktualisieren.
   */
  observe(sample: RoundTripSample): void {
    const rtt = Math.max(0, sample.receivedAt - sample.sentAt);

    if (sample.serverTimeMs !== undefined) {
      this.observeServerTime(sample.serverTimeMs, rtt, sample.receivedAt);
    }

    this.lastRtt = rtt;

    if (this.srtt === null) {
      this.srtt = rtt;
      this.rttvar = rtt / 2;
      return;
    }

    this.rttvar = (1 - this.beta) * this.rttvar + this.beta * Math.abs(this.srtt - rtt);
    this.srtt = (1 - this.alpha) * this.srtt + this.alpha * rtt;
  }

  /** Setzt die Schaetzung zurueck. Nach einem Reconnect ist der alte RTT wertlos. */
  reset(): void {
    this.srtt = null;
    this.rttvar = 0;
    this.lastRtt = null;
    // Der Uhrenversatz bleibt: die Server-Uhr hat sich durch einen Reconnect
    // nicht veraendert, und ein alter Schaetzwert ist besser als keiner.
  }

  private observeServerTime(serverTimeMs: number, rtt: number, receivedAt: number): void {
    /**
     * Annahme: der Server hat mitten im Umlauf gestempelt, also liegt seine Uhr
     * beim Empfang bei `serverTime + rtt/2`. Der Versatz ist die Differenz zur
     * lokalen Uhr.
     */
    const sample = serverTimeMs + rtt / 2 - receivedAt;

    // Ausreisser verwerfen: bei einer Antwort, die deutlich langsamer war als
    // der Mittelwert, traegt die Annahme "halbe Zeit hin, halbe zurueck" nicht.
    if (this.offset !== null && this.srtt !== null && rtt > 2 * this.srtt + 20) {
      return;
    }

    this.offset =
      this.offset === null ? sample : this.offset * (1 - OFFSET_ALPHA) + sample * OFFSET_ALPHA;
  }
}
