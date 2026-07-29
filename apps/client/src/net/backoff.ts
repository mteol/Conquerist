/**
 * Exponential Backoff mit Jitter - reine Funktion, damit die Kurve testbar ist.
 *
 * `Math.random()` steckt nicht drin, sondern kommt als Parameter herein. Das
 * verstoesst nicht gegen die Purity-Regel aus CLAUDE.md (die gilt fuer die
 * Spiellogik in `shared`), macht aber die Tests deterministisch.
 */

export interface BackoffOptions {
  /** Verzoegerung des ersten Wiederverbindungsversuchs. */
  readonly baseMs?: number;
  /** Obergrenze, auch nach Jitter. */
  readonly maxMs?: number;
  /** Relative Streuung um den Nominalwert, 0.25 = plus/minus 25 Prozent. */
  readonly jitterRatio?: number;
  readonly random?: () => number;
}

export const DEFAULT_BACKOFF_BASE_MS = 1_000;
export const DEFAULT_BACKOFF_MAX_MS = 30_000;
export const DEFAULT_JITTER_RATIO = 0.25;

/** Verhindert Overflow bei absurd hohen Versuchszaehlern. */
const MAX_EXPONENT = 30;

/**
 * Verzoegerung fuer den `attempt`-ten Wiederverbindungsversuch (0-basiert).
 *
 * Nominal: 1s, 2s, 4s, 8s, 16s, dann 30s Deckel.
 * Darum plus/minus 25 Prozent Jitter, damit nach einem Serverneustart nicht
 * alle Clients im gleichen Millisekundenfenster gleichzeitig anklopfen.
 *
 * Der Jitter streut um den Nominalwert und schneidet ihn nicht nach unten weg
 * (wie es "Full Jitter" tun wuerde) - der erste Versuch soll bei ungefaehr
 * einer Sekunde liegen, nicht irgendwo zwischen 0 und 1.
 */
export function backoffDelayMs(attempt: number, options: BackoffOptions = {}): number {
  const baseMs = options.baseMs ?? DEFAULT_BACKOFF_BASE_MS;
  const maxMs = options.maxMs ?? DEFAULT_BACKOFF_MAX_MS;
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO;
  const random = options.random ?? Math.random;

  const exponent = Math.min(Math.max(Math.floor(attempt), 0), MAX_EXPONENT);
  const nominal = Math.min(baseMs * 2 ** exponent, maxMs);
  const factor = 1 + jitterRatio * (2 * random() - 1);

  return Math.round(Math.min(maxMs, Math.max(0, nominal * factor)));
}
