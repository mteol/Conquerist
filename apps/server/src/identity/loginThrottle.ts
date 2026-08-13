/**
 * Wie oft ein Anmeldename in einem Fenster danebenliegen darf.
 *
 * Gezaehlt wird je **Name**, nicht je Absender: hinter einem Reverse Proxy
 * haben alle Spieler dieselbe IP, ein Zaehler darauf traefe also entweder alle
 * oder niemanden. Der Preis ist bekannt und steht im Entwurf: wer einen
 * fremden Login kennt, kann ihn fuer die Fensterlaenge aussperren.
 */
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Obergrenze der Tabelle - siehe Kommentar an `recordFailure`. */
export const LOGIN_MAX_ENTRIES = 5_000;

export type ThrottleVerdict =
  { readonly blocked: false } | { readonly blocked: true; readonly retryAfterMs: number };

export interface ThrottleOptions {
  readonly maxFailures?: number | undefined;
  readonly windowMs?: number | undefined;
  readonly maxEntries?: number | undefined;
  readonly now?: (() => number) | undefined;
}

/**
 * Fehlversuche je Anmeldename, im Speicher.
 *
 * Nicht in der Datenbank: ein Neustart vergisst die Zaehler, und das ist
 * vertretbar - wer ihn ausloesen kann, hat ohnehin groessere Moeglichkeiten.
 * Die Uhr kommt von aussen, damit die Tests kein `sleep` brauchen.
 */
export class LoginThrottle {
  private readonly attempts = new Map<string, number[]>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: ThrottleOptions = {}) {
    this.maxFailures = options.maxFailures ?? LOGIN_MAX_FAILURES;
    this.windowMs = options.windowMs ?? LOGIN_WINDOW_MS;
    this.maxEntries = options.maxEntries ?? LOGIN_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  check(login: string): ThrottleVerdict {
    const recent = this.recent(login);
    if (recent.length < this.maxFailures) return { blocked: false };

    /*
     * Frei ist es, sobald der aelteste Versuch aus dem Fenster faellt - das
     * ist die Zeit, die der Spieler wirklich warten muss, nicht die volle
     * Fensterlaenge.
     */
    const oldest = recent[0] ?? this.now();
    return { blocked: true, retryAfterMs: oldest + this.windowMs - this.now() };
  }

  recordFailure(login: string): void {
    const recent = this.recent(login);
    recent.push(this.now());
    this.attempts.set(login, recent);

    /*
     * Gezaehlt wird auch ein Name, den es gar nicht gibt - sonst verriete die
     * Drossel, welche Konten existieren, und machte den DUMMY_HASH in
     * `accounts.ts` zunichte. Damit waehlt aber der Angreifer die Schluessel,
     * also braucht die Tabelle eine Obergrenze: voll ist voll, und der Eintrag
     * mit dem aeltesten letzten Versuch geht.
     */
    if (this.attempts.size > this.maxEntries) this.dropOldest();
  }

  recordSuccess(login: string): void {
    this.attempts.delete(login);
  }

  /** Nur fuer Tests und Diagnose. */
  get size(): number {
    return this.attempts.size;
  }

  /** Nur fuer Tests und Diagnose. */
  knows(login: string): boolean {
    return this.attempts.has(login);
  }

  /** Die Versuche im Fenster; alles Aeltere wird dabei verworfen. */
  private recent(login: string): number[] {
    const since = this.now() - this.windowMs;
    const kept = (this.attempts.get(login) ?? []).filter((at) => at > since);

    if (kept.length === 0) this.attempts.delete(login);
    else this.attempts.set(login, kept);

    return kept;
  }

  private dropOldest(): void {
    let oldestLogin: string | undefined;
    let oldestAt = Number.POSITIVE_INFINITY;

    for (const [login, times] of this.attempts) {
      const last = times[times.length - 1] ?? 0;
      if (last < oldestAt) {
        oldestAt = last;
        oldestLogin = login;
      }
    }

    if (oldestLogin !== undefined) this.attempts.delete(oldestLogin);
  }
}
