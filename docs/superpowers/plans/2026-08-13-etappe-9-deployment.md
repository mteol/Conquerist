# Etappe 9 — Docker und Coolify — Umsetzungsplan

> **Fuer agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe fuer Aufgabe umzusetzen. Die Schritte tragen Kaestchen (`- [ ]`) zum Abhaken.

**Ziel:** Conquerist laeuft als ein Container hinter Coolify unter der Domain des Nutzers, die Partien ueberleben ein Redeploy, und die zwei Vormerkungen aus Etappe 7 (Sitzungsablauf, Rate-Limit auf `auth.login`) sind eingeloest.

**Architektur:** Ein mehrstufiges Dockerfile baut das pnpm-Monorepo und legt in der Laufzeitstufe `apps/server/dist` neben `apps/client/dist` — der Server liefert den Client selbst aus, damit jede WebSocket-Verbindung gleichen Ursprungs ist. Die SQLite-Datei liegt auf einem Volume unter `/data`. Sitzungen bekommen ein gleitendes `expires_at` (dritter Migrationsschritt), und eine Drossel im Speicher zaehlt Fehlversuche je Login-Name.

**Technik:** Node 24 (`node:24-bookworm-slim`), pnpm 11, Fastify 5, better-sqlite3 13, Vitest 4, Coolify v4.

**Entwurf:** `docs/superpowers/specs/2026-08-13-etappe-9-deployment-design.md` — dort stehen die Begruendungen. Dieser Plan wiederholt sie nicht, er setzt sie um.

## Global Constraints

- **Branch:** `etappe-9-deployment`, aufsetzend auf `8d96ce4`. Nicht nach `main` mergen, bevor Aufgabe 5 abgenommen ist.
- **Antworten auf Deutsch, Code und Bezeichner auf Englisch** (`CLAUDE.md`).
- **Keine Umlaute in Quelldateien und Dokumenten.** Das ganze Repository schreibt `ae`/`oe`/`ue`/`ss`; die einzigen Umlaute stehen in `CLAUDE.md`. Diese Konvention wird nicht gebrochen.
- **`packages/shared` wird in dieser Etappe nicht angefasst.** Kein Bedarf, und die Regel „keine Runtime-Dependencies ausser `zod`" gilt weiter.
- **Ein veroeffentlichter Migrationsschritt wird nie geaendert.** `stepInitialSchema` und `stepSessionsAndAccounts` bleiben Zeile fuer Zeile, wie sie sind. Neues haengt hinten an.
- **TypeScript strict mit `exactOptionalPropertyTypes`.** Ein optionales Feld ist `?: T | undefined`, nicht `?: T`.
- **Tests sind deutsche Saetze** (`it('weist ein abgelaufenes Token ab', …)`), Vitest, neben der Datei, die sie pruefen.
- **Keine Uhr in der Logik.** `Sessions` und `LoginThrottle` bekommen ihr `now` als Konstruktorargument mit `Date.now` als Default — dieselbe Bewegung wie `stampAction` in Etappe 8.
- **Fehlermeldungen fuer Spieler sind deutsche Saetze ohne Protokollcode.**
- **Vor jedem Commit `pnpm format`**, sonst faellt `pnpm format:check` in der Abnahme.
- **Commit-Messages auf Deutsch, ohne Umlaute, ohne `Co-Authored-By`-Zeile.**
- **`PROGRESS.md` wird mitgeschrieben**, nicht nachgereicht (Aufgabe 5).

## Dateien im Ueberblick

| Datei                                            | Was                                                       | Aufgabe |
| ------------------------------------------------ | --------------------------------------------------------- | ------- |
| `apps/server/src/db/database.ts`                 | dritter Migrationsschritt `stepSessionExpiry`             | 1       |
| `apps/server/src/db/database.test.ts`            | Test des dritten Schritts gegen einen Bestand             | 1       |
| `apps/server/src/identity/sessions.ts`           | Frist, gedrosselte Verlaengerung, `purgeExpired`          | 1       |
| `apps/server/src/identity/sessions.test.ts`      | Tests dazu, mit gestellter Uhr                            | 1       |
| `apps/server/src/server.ts`                      | `purgeExpired()` beim Start; spaeter die Drossel erzeugen | 1, 3    |
| `apps/server/src/identity/loginThrottle.ts`      | **neu** — Zaehler je Login-Name                           | 2       |
| `apps/server/src/identity/loginThrottle.test.ts` | **neu** — Tests dazu                                      | 2       |
| `apps/server/src/identity/accounts.ts`           | Drossel in `login` verdrahten                             | 3       |
| `apps/server/src/identity/accounts.test.ts`      | Tests der Verdrahtung                                     | 3       |
| `Dockerfile`                                     | **neu** — zwei Stufen                                     | 4       |
| `.dockerignore`                                  | **neu**                                                   | 4       |
| `README.md`                                      | Abschnitt „Deployment"                                    | 4       |
| `apps/server/.env.example`                       | die Produktionswerte als Kommentar                        | 4       |
| `apps/server/src/config.test.ts`                 | **neu** — die Produktionswerte festgenagelt               | 4       |
| `PROGRESS.md`                                    | Abschnitt zu Etappe 9                                     | 5       |

---

### Aufgabe 1: Sitzungen bekommen eine gleitende Frist

**Dateien:**

- Aendern: `apps/server/src/db/database.ts` (Liste `MIGRATIONS` bei Zeile 49, neuer Schritt am Dateiende)
- Aendern: `apps/server/src/identity/sessions.ts` (ganz)
- Aendern: `apps/server/src/server.ts` (nach dem Erzeugen von `sessions`)
- Test: `apps/server/src/db/database.test.ts` (neuer `describe`-Block am Ende)
- Test: `apps/server/src/identity/sessions.test.ts` (neue Tests am Ende)

**Schnittstellen:**

- Konsumiert: `openDatabase(file)`, `migrate(database)`, `AppDatabase` aus `db/database.js`.
- Produziert:
  - `SESSION_TTL_MS = 5_184_000_000` (60 Tage) und `REFRESH_AFTER_MS = 86_400_000` (1 Tag), beide exportiert aus `identity/sessions.js`
  - `new Sessions(database, options?: { ttlMs?: number; now?: () => number })`
  - `sessions.purgeExpired(): number`
  - `sessions.userIdOf(token): string | undefined` (Signatur unveraendert)

- [ ] **Schritt 1: Den Test fuer den Migrationsschritt schreiben**

Ans Ende von `apps/server/src/db/database.test.ts` anhaengen. Der Aufbau folgt dem bestehenden Block „Migration auf sessions": eine Datenbank auf dem Stand **vor** dem neuen Schritt, `user_version` auf 2, dann `migrate`.

```ts
describe('Migration auf ablaufende Sitzungen', () => {
  /** Eine Datenbank auf dem Stand von Etappe 7: sessions ohne expires_at. */
  function withoutExpiry(): AppDatabase {
    const database = new Database(':memory:');
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_guest INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL, login TEXT, password_hash TEXT, email TEXT
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL
      );
    `);
    database.pragma('user_version = 2'); // Schritte 0 und 1 gelten als gelaufen
    return database;
  }

  it('gibt bestehenden Sitzungen eine Frist aus ihrem created_at', () => {
    const database = withoutExpiry();
    database
      .prepare('INSERT INTO users (id, name, created_at) VALUES (?,?,?)')
      .run('u1', 'Anna', 1000);
    database
      .prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?,?,?)')
      .run('hash-von-anna', 'u1', 1000);

    migrate(database);

    const row = database
      .prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
      .get('hash-von-anna') as { expires_at: number } | undefined;

    // 60 Tage in Millisekunden, aus created_at heraus - nicht aus der Uhr.
    expect(row?.expires_at).toBe(1000 + 5_184_000_000);
  });

  it('zaehlt user_version auf drei hoch', () => {
    const database = withoutExpiry();

    migrate(database);

    const [{ user_version: version }] = database.pragma('user_version') as [
      { user_version: number },
    ];
    expect(version).toBe(3);
  });
});
```

Falls `Database` oder `AppDatabase` in dieser Datei noch nicht importiert sind: sie sind es bereits (siehe Kopf der Datei, `import Database from 'better-sqlite3'` und `import { migrate, openDatabase, type AppDatabase } …`). Nicht doppelt importieren.

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag pruefen**

```
pnpm --filter @conquerist/server exec vitest run src/db/database.test.ts
```

Erwartet: FAIL — `no such column: expires_at` beim `SELECT`, und `user_version` ist 2 statt 3.

- [ ] **Schritt 3: Den Migrationsschritt schreiben**

In `apps/server/src/db/database.ts` die Liste erweitern:

```ts
const MIGRATIONS: readonly ((database: AppDatabase) => void)[] = [
  stepInitialSchema,
  stepSessionsAndAccounts,
  stepSessionExpiry,
];
```

Und ans Ende der Datei:

```ts
/**
 * Etappe 9: Sitzungen laufen ab.
 *
 * Bestehende Zeilen bekommen ihre Frist aus `created_at` und nicht aus der
 * Uhr: ein Migrationsschritt ohne Uhr liefert auf jedem Bestand dasselbe
 * Ergebnis, auch wenn er Jahre spaeter auf einer Sicherungskopie laeuft. Die
 * Folge ist gewollt - eine Sitzung, die aelter als 60 Tage ist und seither
 * nicht benutzt wurde, ist nach diesem Schritt abgelaufen.
 *
 * Die 60 Tage stehen hier als Zahl und nicht als Import von SESSION_TTL_MS.
 * Ein Schritt, der eine Konstante liest, aendert sein Ergebnis, sobald jemand
 * die Konstante aendert - und damit waere er nicht mehr der Schritt, der
 * einmal veroeffentlicht wurde.
 */
function stepSessionExpiry(database: AppDatabase): void {
  database.exec(`
    ALTER TABLE sessions ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;

    UPDATE sessions SET expires_at = created_at + 5184000000;

    /* Fuer purgeExpired: der einzige Zugriff, der nicht ueber den Primaeschluessel geht. */
    CREATE INDEX sessions_expires ON sessions(expires_at);
  `);
}
```

Der Indexname folgt der Konvention im Haus (`sessions_user`, `users_login`), also ohne `idx_`-Praefix.

- [ ] **Schritt 4: Test laufen lassen, Erfolg pruefen**

```
pnpm --filter @conquerist/server exec vitest run src/db/database.test.ts
```

Erwartet: PASS, alle Tests der Datei — auch die bestehenden zu Schritt 1 und 2.

- [ ] **Schritt 5: Die Tests fuer `Sessions` schreiben**

Ans Ende von `apps/server/src/identity/sessions.test.ts`. Die gestellte Uhr macht Wartezeiten ueberfluessig.

```ts
/** Eine Uhr, die stillsteht, bis man sie weiterdreht. */
function clockAt(start: number) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function fixtureWithClock(start: number) {
  const database = openDatabase(':memory:');
  database
    .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,?)')
    .run('u1', 'Anna', start);
  const clock = clockAt(start);
  const sessions = new Sessions(database, { now: clock.now });
  return { database, sessions, clock, userId: 'u1' };
}

describe('Sitzungen laufen ab', () => {
  it('kennt ein Token nach Ablauf der Frist nicht mehr', () => {
    const { sessions, clock, userId } = fixtureWithClock(1_000_000);
    const { token } = sessions.issue(userId);

    clock.advance(SESSION_TTL_MS + 1);

    expect(sessions.userIdOf(token)).toBeUndefined();
  });

  it('raeumt die abgelaufene Zeile beim Nachsehen gleich weg', () => {
    const { database, sessions, clock, userId } = fixtureWithClock(1_000_000);
    const { token } = sessions.issue(userId);

    clock.advance(SESSION_TTL_MS + 1);
    sessions.userIdOf(token);

    const row = database.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    expect(row.n).toBe(0);
  });

  it('schreibt bei einer frischen Sitzung nicht bei jeder Verwendung', () => {
    const { database, sessions, clock, userId } = fixtureWithClock(1_000_000);
    const { token, tokenHash } = sessions.issue(userId);
    const before = expiryOf(database, tokenHash);

    clock.advance(60_000); // eine Minute spaeter
    sessions.userIdOf(token);

    expect(expiryOf(database, tokenHash)).toBe(before);
  });

  it('verlaengert die Frist, wenn die letzte Verwendung mehr als einen Tag her ist', () => {
    const { database, sessions, clock, userId } = fixtureWithClock(1_000_000);
    const { token, tokenHash } = sessions.issue(userId);

    clock.advance(REFRESH_AFTER_MS + 1);
    sessions.userIdOf(token);

    expect(expiryOf(database, tokenHash)).toBe(1_000_000 + REFRESH_AFTER_MS + 1 + SESSION_TTL_MS);
  });

  it('raeumt beim Aufraeumen nur die abgelaufenen Zeilen weg', () => {
    const { database, sessions, clock, userId } = fixtureWithClock(1_000_000);
    sessions.issue(userId); // laeuft ab
    clock.advance(SESSION_TTL_MS - 1_000);
    sessions.issue(userId); // bleibt
    clock.advance(2_000);

    expect(sessions.purgeExpired()).toBe(1);

    const row = database.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    expect(row.n).toBe(1);
  });
});

function expiryOf(database: AppDatabase, tokenHash: string): number {
  const row = database
    .prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash) as { expires_at: number };
  return row.expires_at;
}
```

Den Kopf der Datei um die neuen Namen ergaenzen:

```ts
import { REFRESH_AFTER_MS, SESSION_TTL_MS, Sessions } from './sessions.js';
import type { AppDatabase } from '../db/database.js';
```

(Die bestehende Zeile `import { Sessions } from './sessions.js';` geht darin auf — nicht danebenstellen.)

- [ ] **Schritt 6: Tests laufen lassen, Fehlschlag pruefen**

```
pnpm --filter @conquerist/server exec vitest run src/identity/sessions.test.ts
```

Erwartet: FAIL — `SESSION_TTL_MS` und `REFRESH_AFTER_MS` gibt es nicht, und `new Sessions(db, {…})` nimmt kein zweites Argument.

- [ ] **Schritt 7: `Sessions` umbauen**

`apps/server/src/identity/sessions.ts` — der Kopfkommentar der Klasse bleibt, darunter kommt die Frist dazu:

```ts
/**
 * Wie lange eine Sitzung ohne Verwendung gilt: 60 Tage.
 *
 * Die Frist ist gleitend, weil diese Tabelle nicht nur Anmeldungen traegt,
 * sondern auch Gast-Identitaeten (`users.hello`). Eine absolute Frist naehme
 * einem Gast mitten im Betrieb seine Partien; gleitend trifft sie nur den,
 * der zwei Monate nicht da war.
 */
export const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Ab wann eine Verwendung die Frist neu setzt: nach einem Tag.
 *
 * Die Drossel braucht kein `last_used_at` daneben - wie lange die letzte
 * Verwendung her ist, steht bereits in `expires_at`. So wird hoechstens einmal
 * am Tag je Sitzung geschrieben statt einmal je Nachricht.
 */
export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface SessionOptions {
  readonly ttlMs?: number | undefined;
  readonly now?: (() => number) | undefined;
}

export class Sessions {
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(
    private readonly database: AppDatabase,
    options: SessionOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? SESSION_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  issue(userId: string): IssuedSession {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hash(token);
    const now = this.now();

    this.database
      .prepare(
        'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .run(tokenHash, userId, now, now + this.ttlMs);

    return { token, tokenHash };
  }

  /**
   * Wer gehoert zu diesem Token - und lebt es noch?
   *
   * Die abgelaufene Zeile wird beim Nachsehen gleich geloescht: sie ist ab
   * jetzt nur noch Ballast, und der einzige, der sie garantiert anfasst, ist
   * der, der sie gerade vorgelegt hat.
   */
  userIdOf(token: string): string | undefined {
    const tokenHash = hash(token);
    const row = this.database
      .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
      .get(tokenHash) as { user_id: string; expires_at: number } | undefined;

    if (row === undefined) return undefined;

    const now = this.now();
    if (row.expires_at <= now) {
      this.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return undefined;
    }

    if (row.expires_at - now < this.ttlMs - REFRESH_AFTER_MS) {
      this.database
        .prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
        .run(now + this.ttlMs, tokenHash);
    }

    return row.user_id;
  }

  /** Abgelaufene Zeilen wegraeumen; gibt zurueck, wie viele es waren. */
  purgeExpired(): number {
    return this.database
      .prepare('DELETE FROM sessions WHERE expires_at <= ?')
      .run(this.now()).changes;
  }
```

`hashOf`, `revoke` und `countFor` bleiben unveraendert, ebenso die Hilfsfunktion `hash` am Dateiende.

- [ ] **Schritt 8: Tests laufen lassen, Erfolg pruefen**

```
pnpm --filter @conquerist/server exec vitest run src/identity/
```

Erwartet: PASS, auch `users.test.ts` und `accounts.test.ts` — sie erzeugen `new Sessions(database)` ohne zweites Argument, und das bleibt gueltig.

- [ ] **Schritt 9: Beim Start aufraeumen**

In `apps/server/src/server.ts`, direkt nach der Zeile `const users = new Users(database, sessions);`:

```ts
// Abgelaufene Sitzungen einmal beim Start wegraeumen. Im Betrieb faellt
// jede abgelaufene Zeile ohnehin beim naechsten Nachsehen weg - das hier
// erwischt die, deren Besitzer nie wiederkommt.
const purged = sessions.purgeExpired();
if (purged > 0) app.log.info({ purged }, 'Abgelaufene Sitzungen weggeraeumt');
```

- [ ] **Schritt 10: Ganzes Paket pruefen und committen**

```
pnpm typecheck
pnpm --filter @conquerist/server test
pnpm format
```

Erwartet: typecheck sauber, alle Server-Tests gruen (121 + 7 neue = 128).

```bash
git add apps/server/src/db/database.ts apps/server/src/db/database.test.ts \
        apps/server/src/identity/sessions.ts apps/server/src/identity/sessions.test.ts \
        apps/server/src/server.ts
git commit -m "Eine Sitzung, die zwei Monate niemand benutzt, gilt nicht mehr"
```

---

### Aufgabe 2: Die Drossel fuer Anmeldeversuche

**Dateien:**

- Anlegen: `apps/server/src/identity/loginThrottle.ts`
- Test: `apps/server/src/identity/loginThrottle.test.ts`

**Schnittstellen:**

- Konsumiert: nichts aus Aufgabe 1. Das Modul steht fuer sich, kennt weder Datenbank noch Fastify.
- Produziert:
  - `type ThrottleVerdict = { readonly blocked: false } | { readonly blocked: true; readonly retryAfterMs: number }`
  - `new LoginThrottle(options?: { maxFailures?: number; windowMs?: number; maxEntries?: number; now?: () => number })`
  - `throttle.check(login: string): ThrottleVerdict`
  - `throttle.recordFailure(login: string): void`
  - `throttle.recordSuccess(login: string): void`
  - `LOGIN_MAX_FAILURES = 10`, `LOGIN_WINDOW_MS = 900_000`

- [ ] **Schritt 1: Den Test schreiben**

Neue Datei `apps/server/src/identity/loginThrottle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, LoginThrottle } from './loginThrottle.js';

/** Eine Uhr, die stillsteht, bis man sie weiterdreht. */
function clockAt(start: number) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('Drossel fuer Anmeldeversuche', () => {
  it('laesst die ersten zehn Fehlversuche durch', () => {
    const throttle = new LoginThrottle();

    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      expect(throttle.check('anna').blocked).toBe(false);
      throttle.recordFailure('anna');
    }

    expect(throttle.check('anna').blocked).toBe(true);
  });

  it('nennt, wie lange noch zu warten ist', () => {
    const clock = clockAt(1_000_000);
    const throttle = new LoginThrottle({ now: clock.now });
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('anna');

    clock.advance(60_000);
    const verdict = throttle.check('anna');

    expect(verdict.blocked).toBe(true);
    // Der aelteste Versuch faellt nach LOGIN_WINDOW_MS aus dem Fenster.
    expect(verdict.blocked && verdict.retryAfterMs).toBe(LOGIN_WINDOW_MS - 60_000);
  });

  it('vergisst Versuche, sobald das Fenster weitergewandert ist', () => {
    const clock = clockAt(1_000_000);
    const throttle = new LoginThrottle({ now: clock.now });
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('anna');

    clock.advance(LOGIN_WINDOW_MS + 1);

    expect(throttle.check('anna').blocked).toBe(false);
  });

  it('raeumt den Zaehler bei einer gelungenen Anmeldung ab', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('anna');

    throttle.recordSuccess('anna');

    expect(throttle.check('anna').blocked).toBe(false);
  });

  it('zaehlt zwei Namen getrennt', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('anna');

    expect(throttle.check('bert').blocked).toBe(false);
  });

  it('wirft den aeltesten Namen heraus, wenn die Tabelle voll ist', () => {
    const clock = clockAt(1_000_000);
    const throttle = new LoginThrottle({ maxEntries: 2, now: clock.now });

    throttle.recordFailure('erster');
    clock.advance(1_000);
    throttle.recordFailure('zweiter');
    clock.advance(1_000);
    throttle.recordFailure('dritter');

    // "erster" ist gefallen, seine Zaehlung faengt wieder bei null an.
    expect(throttle.size).toBe(2);
    expect(throttle.knows('erster')).toBe(false);
    expect(throttle.knows('dritter')).toBe(true);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag pruefen**

```
pnpm --filter @conquerist/server exec vitest run src/identity/loginThrottle.test.ts
```

Erwartet: FAIL — `Cannot find module './loginThrottle.js'`.

- [ ] **Schritt 3: Das Modul schreiben**

Neue Datei `apps/server/src/identity/loginThrottle.ts`:

```ts
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
```

- [ ] **Schritt 4: Test laufen lassen, Erfolg pruefen**

```
pnpm --filter @conquerist/server exec vitest run src/identity/loginThrottle.test.ts
```

Erwartet: PASS, 6 Tests.

- [ ] **Schritt 5: Committen**

```
pnpm format
```

```bash
git add apps/server/src/identity/loginThrottle.ts apps/server/src/identity/loginThrottle.test.ts
git commit -m "Ein Zaehler je Anmeldename, mit Obergrenze und ohne Uhr im Inneren"
```

---

### Aufgabe 3: Die Drossel an `auth.login` haengen

**Dateien:**

- Aendern: `apps/server/src/identity/accounts.ts` (Konstruktor bei Zeile 47, `login` ab Zeile 106)
- Aendern: `apps/server/src/server.ts` (dort, wo `accounts` erzeugt wird)
- Test: `apps/server/src/identity/accounts.test.ts` (Fixture und neue Tests)

**Schnittstellen:**

- Konsumiert: `LoginThrottle`, `ThrottleVerdict` aus Aufgabe 2.
- Produziert: `new Accounts(users, sessions, throttle)` — drittes Argument, **erforderlich**. Alle Aufrufer (`server.ts`, `accounts.test.ts`) werden mitgezogen.

- [ ] **Schritt 1: Die Tests schreiben**

In `apps/server/src/identity/accounts.test.ts` die Fixture erweitern und Tests anhaengen:

```ts
function fixture() {
  const database = openDatabase(':memory:');
  const sessions = new Sessions(database);
  const users = new Users(database, sessions);
  const throttle = new LoginThrottle();
  return { database, sessions, users, throttle, accounts: new Accounts(users, sessions, throttle) };
}
```

Import ergaenzen: `import { LOGIN_MAX_FAILURES, LoginThrottle } from './loginThrottle.js';`

Neuer Block am Dateiende:

```ts
describe('Anmelden mit Drossel', () => {
  async function withAccount() {
    const parts = fixture();
    await parts.accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);
    return parts;
  }

  it('sperrt nach zehn Fehlversuchen und nennt eine Wartezeit', async () => {
    const { accounts } = await withAccount();

    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      await expect(
        accounts.login({ login: 'anna', password: 'falsch' }, null, null, 0),
      ).rejects.toThrow(AccountError);
    }

    await expect(
      accounts.login({ login: 'anna', password: 'falsch' }, null, null, 0),
    ).rejects.toThrow(/Minute/);
  });

  it('sperrt auch das richtige Passwort, solange die Frist laeuft', async () => {
    const { accounts } = await withAccount();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      await accounts
        .login({ login: 'anna', password: 'falsch' }, null, null, 0)
        .catch(() => undefined);
    }

    await expect(
      accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0),
    ).rejects.toThrow(/Fehlversuche/);
  });

  it('raeumt den Zaehler ab, wenn die Anmeldung gelingt', async () => {
    const { accounts, throttle } = await withAccount();
    await accounts
      .login({ login: 'anna', password: 'falsch' }, null, null, 0)
      .catch(() => undefined);

    await accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0);

    expect(throttle.knows('anna')).toBe(false);
  });

  it('zaehlt auch einen Namen, den es gar nicht gibt', async () => {
    const { accounts, throttle } = await withAccount();

    await accounts
      .login({ login: 'gibtesnicht', password: 'falsch' }, null, null, 0)
      .catch(() => undefined);

    expect(throttle.knows('gibtesnicht')).toBe(true);
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag pruefen**

```
pnpm --filter @conquerist/server exec vitest run src/identity/accounts.test.ts
```

Erwartet: FAIL — `Accounts` nimmt nur zwei Argumente, und nach zehn Fehlversuchen kommt weiter `WRONG_CREDENTIALS` statt eines Wartesatzes.

- [ ] **Schritt 3: `Accounts` umbauen**

Import ergaenzen:

```ts
import type { LoginThrottle } from './loginThrottle.js';
```

Konstruktor:

```ts
  constructor(
    private readonly users: Users,
    private readonly sessions: Sessions,
    private readonly throttle: LoginThrottle,
  ) {}
```

In `login`, **vor** `const account = this.users.byLogin(input.login);`:

```ts
/*
 * Zuerst die Drossel, dann erst die KDF: eine gesperrte Anmeldung soll
 * nicht auch noch scrypt bezahlen. Der Satz ist fuer den Spieler
 * geschrieben - kein Code, keine Sekundenzahl mit acht Stellen.
 */
const verdict = this.throttle.check(input.login);
if (verdict.blocked) {
  const minutes = Math.max(1, Math.ceil(verdict.retryAfterMs / 60_000));
  throw new AccountError(`Zu viele Fehlversuche. Bitte in ${minutes} Minuten erneut versuchen.`);
}
```

Und die Stelle, an der heute `WRONG_CREDENTIALS` geworfen wird, zaehlt jetzt mit:

```ts
if (account === undefined || !matches) {
  this.throttle.recordFailure(input.login);
  throw new AccountError(WRONG_CREDENTIALS);
}
```

Direkt nach dem erfolgreichen Vergleich, vor der Gast-Warnung:

```ts
this.throttle.recordSuccess(input.login);
```

Beachte: `recordSuccess` steht **vor** dem Wurf wegen offener Gastpartien. Das Passwort stimmte; dass der Spieler die Bestaetigung noch nicht gegeben hat, ist kein Fehlversuch.

- [ ] **Schritt 4: `server.ts` nachziehen**

Import ergaenzen:

```ts
import { LoginThrottle } from './identity/loginThrottle.js';
```

Und die Zeile, die `accounts` erzeugt:

```ts
// Eine Drossel fuer den ganzen Prozess: zwei Instanzen hiessen zwei
// getrennte Zaehlungen und damit die doppelte Zahl an Versuchen.
const accounts = new Accounts(users, sessions, new LoginThrottle());
```

- [ ] **Schritt 5: Tests laufen lassen, Erfolg pruefen**

```
pnpm --filter @conquerist/server test
pnpm typecheck
```

Erwartet: PASS in allen Server-Tests (128 + 4 neue = 132), typecheck sauber.

- [ ] **Schritt 6: Committen**

```
pnpm format
```

```bash
git add apps/server/src/identity/accounts.ts apps/server/src/identity/accounts.test.ts apps/server/src/server.ts
git commit -m "Der elfte Fehlversuch bekommt eine Wartezeit statt eines Passwortvergleichs"
```

---

### Aufgabe 4: Das Image und die Anleitung

**Dateien:**

- Anlegen: `Dockerfile` (Repository-Wurzel)
- Anlegen: `.dockerignore` (Repository-Wurzel)
- Aendern: `README.md` (neuer Abschnitt „Deployment" am Ende)
- Aendern: `apps/server/.env.example` (Produktionswerte als Kommentar)

**Schnittstellen:**

- Konsumiert: `pnpm build` aus der Wurzel, `apps/server/dist/server.js` als Einstieg, `GET /health` aus `app.ts`.
- Produziert: ein Image, dessen Laufzeitstufe `/app/apps/server/dist` und `/app/apps/client/dist` traegt und auf `PORT` lauscht.

**Wichtig:** Auf dem Entwicklungsrechner ist **kein Docker installiert**. Diese Aufgabe wird also geschrieben und in Aufgabe 5 auf dem Server zum ersten Mal gebaut. Wer sie schreibt, prueft dafuer besonders sorgfaeltig die Pfade — der haeufigste Fehler ist eine Laufzeitstufe, in der `apps/client/dist` an der falschen Stelle liegt.

- [ ] **Schritt 1: `.dockerignore` anlegen**

```
node_modules
**/node_modules
dist
**/dist
data
.git
.github
.superpowers
coverage
*.tsbuildinfo
docs
```

`data` ist die wichtigste Zeile: ohne sie wandert die lokale SQLite-Datei samt ihrer Raeume in den Build-Kontext.

- [ ] **Schritt 2: Das `Dockerfile` schreiben**

```dockerfile
# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Bau-Stufe
#
# Debian statt Alpine: better-sqlite3 ist ein natives Modul und wird gegen
# glibc vorgebaut ausgeliefert. Auf musl gaebe es keine passende Binary.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Zuerst nur die Manifeste: so ueberlebt der Abhaengigkeits-Layer jede
# Codeaenderung im Cache. .npmrc muss mit - darin steht die Freigabe fuer die
# Build-Skripte von better-sqlite3 und esbuild.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/

RUN pnpm install --frozen-lockfile

COPY . .

# Laeuft per Topologie in der richtigen Folge: shared, dann Client und Server.
RUN pnpm build

# Die Produktionsabhaengigkeiten fuer den Server allein, samt @conquerist/shared.
RUN pnpm --filter @conquerist/server --prod deploy --legacy /deploy

# ---------------------------------------------------------------------------
# Laufzeit-Stufe
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Die Anordnung ist Pflicht, nicht Geschmack: static.ts sucht den Client ueber
# resolve(<server>/dist, '../../client/dist'). Liegt er woanders, liefert der
# Server still nur die API aus.
COPY --from=build /deploy/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/client/dist ./apps/client/dist

# Das Volume kommt spaeter hierher. Der Ordner gehoert `node`, damit ein frisch
# angelegtes Volume diese Rechte beim ersten Einhaengen erbt.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATABASE_FILE=/data/conquerist.db
EXPOSE 8080

# Das slim-Image hat weder curl noch wget - also mit Bordmitteln.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec-Form: node ist PID 1 und bekommt SIGTERM, also greift das Herunterfahren
# aus server.ts (Wecker abraeumen, Verbindungen schliessen). Kein tini noetig,
# der Prozess startet keine Kinder.
CMD ["node", "apps/server/dist/server.js"]
```

- [ ] **Schritt 3: Den Rueckfall daneben schreiben, falls `pnpm deploy` nicht traegt**

`pnpm deploy` ist der eine Schritt, der beim ersten Bauen auf dem Server scheitern kann (Bedingungen bei pnpm 11, plus die native Binary). Falls der Build in Aufgabe 5 daran haengenbleibt, wird die eine `RUN`-Zeile ersetzt durch:

```dockerfile
# Rueckfall statt `pnpm deploy`: ein Produktions-Install im Zielbaum.
RUN mkdir -p /deploy && cd /deploy \
 && cp /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./ \
 && mkdir -p packages/shared apps/server \
 && cp /app/packages/shared/package.json packages/shared/ \
 && cp -r /app/packages/shared/dist packages/shared/dist \
 && cp /app/apps/server/package.json apps/server/ \
 && pnpm install --frozen-lockfile --prod
```

Die Laufzeit-Stufe kopiert dann `/deploy/node_modules`, `/deploy/apps/server/node_modules` und `/deploy/packages/shared`. **Diese Variante nur einbauen, wenn die erste fehlschlaegt** — und wenn, dann mit einer Zeile im PROGRESS-Abschnitt, warum.

- [ ] **Schritt 4: `apps/server/.env.example` ergaenzen**

Ans Ende anhaengen:

```
# --- In Produktion (Coolify) abweichend: -----------------------------------
# NODE_ENV=production
# HOST=0.0.0.0            <- der Default 127.0.0.1 waere im Container unerreichbar
# DATABASE_FILE=/data/conquerist.db   <- das Volume, nicht das Containerdateisystem
#
# CLIENT_ORIGIN bleibt dort UNGESETZT: der Server liefert den Client selbst
# aus, gleicher Ursprung ist immer erlaubt, und isAllowedOrigin vergleicht nur
# Host und Port - die TLS-Terminierung des Proxys stoert es also nicht.
```

- [ ] **Schritt 5: Den Deployment-Abschnitt in `README.md` schreiben**

Ans Ende der Datei, als eigener `##`-Abschnitt „Deployment (Coolify)". Inhalt:

- Build Pack **Dockerfile**, Branch `main`, Base Directory `/`, Port **8080**, „Is it a static site?" aus.
- Die vier Umgebungsvariablen als Tabelle (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, `DATABASE_FILE=/data/conquerist.db`) und der Satz, dass `CLIENT_ORIGIN` leer bleibt.
- Persistent Storage: **Volume** auf `/data`, ausdruecklich kein Bind Mount, mit der Begruendung (Rechte).
- Der Satz zum Health-Check: `/health` antwortet ohne Datenbankzugriff.
- Ein Hinweis, dass ein Redeploy die Partien nicht kostet, weil Startzustand und Action-Log auf dem Volume liegen.

- [ ] **Schritt 6: Die Produktionswerte in einem Test festnageln**

`loadConfig` hat heute **keinen einzigen Test** (geprueft: kein Vorkommen von `loadConfig` in einer `*.test.ts`). Die Werte, die im Container stehen, sind genau die, die von den Defaults abweichen — also bekommen sie einen. Neue Datei `apps/server/src/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

describe('Konfiguration', () => {
  it('nimmt die Werte, mit denen der Container laeuft', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: '8080',
      DATABASE_FILE: '/data/conquerist.db',
    });

    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8080);
    expect(config.databaseFile).toBe('/data/conquerist.db');
    expect(config.isProduction).toBe(true);
  });

  it('haelt am Loopback fest, solange niemand HOST setzt', () => {
    // Der Default ist Absicht (kein Dev-Server im LAN) und im Container die
    // haeufigste Ursache fuer „laeuft, ist aber nicht erreichbar".
    expect(loadConfig({}).host).toBe('127.0.0.1');
  });

  it('erlaubt ohne CLIENT_ORIGIN weiterhin den Vite-Ursprung', () => {
    expect(loadConfig({}).clientOrigins).toContain('http://localhost:5173');
  });

  it('beendet sich bei einem unbrauchbaren PORT mit einer lesbaren Meldung', () => {
    expect(() => loadConfig({ PORT: 'achtzig' })).toThrow(ConfigError);
  });
});
```

Laufen lassen:

```
pnpm --filter @conquerist/server exec vitest run src/config.test.ts
```

Erwartet: PASS, 4 Tests — `loadConfig` nimmt bereits ein `env`-Argument (Default `process.env`), es ist also nichts zu implementieren.

- [ ] **Schritt 7: Pruefen, was ohne Docker pruefbar ist, und committen**

```
pnpm typecheck
pnpm test
pnpm build
pnpm format
```

Erwartet: unveraendert gruen — diese Aufgabe fasst keinen TypeScript-Code an. Der Build muss trotzdem laufen: er ist der Beleg, dass die Pfade im Dockerfile (`apps/client/dist`, `apps/server/dist`) die sind, die `pnpm build` wirklich erzeugt. Nachsehen:

```
ls apps/server/dist/server.js apps/client/dist/index.html
```

```bash
git add Dockerfile .dockerignore README.md apps/server/.env.example apps/server/src/config.test.ts
git commit -m "Ein Image, in dem der Client neben dem Server liegt - und ein Volume fuer die Partien"
```

---

### Aufgabe 5: Der Durchlauf auf Coolify und die Standsdatei

**Dateien:**

- Aendern: `PROGRESS.md` (neuer Abschnitt am Ende)
- Moeglicherweise: `Dockerfile` (Nachbesserungen aus den Build-Fehlschlaegen)

**Schnittstellen:**

- Konsumiert: alles aus den Aufgaben 1 bis 4.
- Produziert: einen laufenden Dienst und einen Abschnitt in `PROGRESS.md` mit **gemessenen** Zahlen.

Diese Aufgabe ist zum Teil Handarbeit am Browser und in der Coolify-Oberflaeche. Sie wird **gemeinsam mit dem Nutzer** durchgefuehrt, nicht von einem Agenten allein: nur er hat Zugang zu Coolify und zur Domain.

- [ ] **Schritt 1: Branch hochladen und Coolify darauf zeigen lassen**

```bash
git push -u origin etappe-9-deployment
```

In Coolify: Branch der Anwendung voruebergehend auf `etappe-9-deployment` stellen, damit vor dem Merge gebaut werden kann. Port 8080, die vier Variablen, das Volume auf `/data` — wie in `README.md` beschrieben.

- [ ] **Schritt 2: Bauen lassen und das Log lesen**

Deploy ausloesen. Erwartet: die Stufen laufen durch, der Container startet, im Log stehen nacheinander „Client wird mit ausgeliefert", „Raeume von der Platte geladen" (0 beim ersten Mal), „Server listening at http://0.0.0.0:8080" und „WebSocket bereit".

Scheitert `pnpm deploy --legacy`, kommt der Rueckfall aus Aufgabe 4 Schritt 3 zum Einsatz. Steht im Log **kein** „Client wird mit ausgeliefert", liegt `apps/client/dist` falsch — dann die Pfade der `COPY`-Zeilen pruefen, nicht die Konfiguration.

- [ ] **Schritt 3: Die Seite und den WebSocket pruefen**

Unter der Domain aufrufen. Zu sehen: der Startbildschirm mit dem Brett zum Seed. Ist die Verbindung offen, zeigt die Oberflaeche keinen Verbindungshinweis; im Zweifel die Netzwerkanzeige der Entwicklerwerkzeuge auf den `/ws`-Upgrade ansehen (Status 101).

**Das ist der Schritt, an dem sich die Origin-Ueberlegung beweist.** Wird der Upgrade mit 403 abgewiesen, reicht der Proxy den `Host` nicht durch — dann und nur dann bekommt `CLIENT_ORIGIN` die Domain, und der Grund gehoert in `PROGRESS.md`.

- [ ] **Schritt 4: Eine Partie zu zweit, mit einem Handel**

Konto anlegen, Partie eroeffnen, zweites Fenster (privat) als Gast ueber den Einladungslink beitreten, starten, und einen Tausch ueber den Tisch abwickeln — anbieten, antworten, zuschlagen.

- [ ] **Schritt 5: Redeploy, und die Partie muss stehenbleiben**

In Coolify erneut deployen. Danach beide Fenster neu laden: die Partie steht unter „Weiterspielen", mit demselben Stand. Das belegt das Volume **und** den `replay` aus Etappe 6 im Betrieb.

- [ ] **Schritt 6: Die Drossel im Betrieb**

Abmelden, zehnmal mit falschem Passwort anmelden. Der elfte Versuch nennt eine Wartezeit in verstaendlichem Deutsch, ohne Protokollcode davor.

- [ ] **Schritt 7: Die Zahlen messen**

```
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Die Testzahlen je Paket und die Bundlegroesse aus der Ausgabe **abschreiben, nicht schaetzen** — eine erfundene Zahl macht die ganze Tabelle wertlos.

- [ ] **Schritt 8: `PROGRESS.md` schreiben**

Neuer Abschnitt `## Etappe 9 — Docker und Coolify ✅` in der Form, die die Datei schon hat: Ueberschrift und Stand (Branch, Commits), Abnahmetabelle mit den gemessenen Zahlen, „Getroffene Entscheidungen" (je Absatz eine, fett angefuehrt, mit dem Grund), Abweichungen vom Plan, offene Punkte, naechste Etappe.

Die offenen Punkte aus dem Entwurf werden uebernommen und um das ergaenzt, was der Durchlauf gezeigt hat. Was beim ersten Bauen schiefging, gehoert dazu — der Wert dieser Datei liegt genau in den Stellen, an denen der Plan nicht aufging.

- [ ] **Schritt 9: Committen**

```
pnpm format
```

```bash
git add PROGRESS.md Dockerfile
git commit -m "Etappe 9 abgenommen: das Spiel laeuft unter seiner eigenen Adresse"
```

- [ ] **Schritt 10: Die Kette nach `main` bringen**

Erst jetzt, und nur mit ausdruecklicher Zustimmung des Nutzers:

```bash
git checkout main
git merge --no-ff etappe-9-deployment
git push origin main
```

Danach in Coolify den Branch zurueck auf `main` stellen und einmal deployen, damit die laufende Fassung wieder die ist, die in `main` steht.

---

## Was diese Etappe absichtlich nicht tut

Zum Nachlesen im Entwurf, damit niemand sie „nebenbei mitmacht": keine Registry und kein CI-Build, keine Sicherung der Datenbank, keine Kontoloeschung, kein Passwort-vergessen, kein IP-basiertes Limit, keine Zugzeit, keine Uebernahme der lokalen `data/`-Datenbank auf den Server, und **keine zweite Instanz** — Raumverzeichnis, Wecker und Drossel liegen im Speicher.
