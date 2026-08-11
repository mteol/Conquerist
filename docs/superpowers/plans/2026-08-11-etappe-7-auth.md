# Etappe 7 — Auth: Registrierung, Login, Gast beanspruchen — Umsetzungsplan

> **Fuer agentische Bearbeiter:** ERFORDERLICHES SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe fuer Aufgabe umzusetzen. Die Schritte tragen Checkboxen (`- [ ]`).

**Ziel:** Ein Gast kann sich selbst zu einem Konto machen und behaelt dabei seine Partien; wer ein Konto hat, kann sich auf einem zweiten Geraet anmelden, ohne das erste hinauszuwerfen.

**Architektur:** Das Sitzungsgeheimnis zieht aus `users.secret_hash` in eine eigene Tabelle `sessions` (eine Zeile je Geraet). `users` bekommt `login`, `password_hash` und `email`; ein Konto ist damit dieselbe Zeile wie der Gast, nur mit ausgefuellten Feldern (Regel 7). Weil eine Spalte umzieht, bekommt die Datenbank ihre erste echte Migration ueber `PRAGMA user_version`.

**Tech-Stack:** TypeScript strict, Vitest, `better-sqlite3`, `node:crypto` (`scrypt`, `timingSafeEqual`), Zod, React 19.

**Grundlage:** `docs/superpowers/specs/2026-08-11-etappe-7-auth-design.md`

## Globale Randbedingungen

- **`packages/shared` hat keine Runtime-Abhaengigkeit ausser `zod`.** Kein Node-API dort — `node:crypto` gehoert ausschliesslich in `apps/server`.
- **Keine neuen npm-Abhaengigkeiten.** Passwoerter mit `scrypt` aus `node:crypto`.
- **Der Server ist die Autoritaet.** Jede eingehende Nachricht wird per Zod validiert, bevor sie die Logik erreicht. Die `userId` steht in keiner Auth-Anfrage — wer schreibt, steht in `context.session`.
- **Doku und Kommentare auf Deutsch, Code und Bezeichner auf Englisch.** Umlaute in Kommentaren werden umschrieben (`ae`, `oe`, `ue`, `ss`), so wie im bestehenden Code.
- **Kein Hex-Wert in einer Komponente.** Farben kommen aus den Variablen in `index.css`.
- **Commits ohne `Co-Authored-By`-Trailer.**
- **`pnpm typecheck` niemals durch eine Pipe laufen lassen** — das verschluckt den Exit-Code.
- **Abnahme je Aufgabe:** `pnpm typecheck && pnpm test && pnpm format:check`. Am Ende zusaetzlich `pnpm build`.
- **`PROGRESS.md` wird mitgeschrieben**, nicht nachgereicht (Aufgabe 11).

## Dateien im Ueberblick

| Datei                                       | Verantwortung                                         |
| ------------------------------------------- | ----------------------------------------------------- |
| `apps/server/src/db/database.ts`            | Verbindung, Migrationsliste, `user_version`           |
| `apps/server/src/identity/password.ts`      | **neu** — `hashPassword`, `verifyPassword`            |
| `apps/server/src/identity/sessions.ts`      | **neu** — Sitzungstoken anlegen, aufloesen, loeschen  |
| `apps/server/src/identity/users.ts`         | Nutzerzeilen; `hello` geht ueber `Sessions`           |
| `apps/server/src/identity/accounts.ts`      | **neu** — Registrieren, Anmelden, Abmelden als Ablauf |
| `apps/server/src/ws/handlers/auth.ts`       | **neu** — die vier Handler                            |
| `apps/server/src/ws/router.ts`              | `Session` bekommt `tokenHash`                         |
| `packages/shared/src/protocol/auth.ts`      | **neu** — Schemata der vier Nachrichten               |
| `packages/shared/src/protocol/room.ts`      | `HelloResponseSchema` erweitern                       |
| `apps/client/src/game/useOnlineGame.ts`     | `identity` + `register`/`login`/`logout`              |
| `apps/client/src/screens/AccountCorner.tsx` | **neu** — die Ecke oben rechts                        |
| `apps/client/src/dialogs/AccountDialog.tsx` | **neu** — ein Dialog, zwei Modi                       |
| `apps/client/src/index.css`                 | Ecke, Dialogfelder, Platz fuer die Marke              |

---

### Aufgabe 1: Migrationsgeruest mit `user_version`

Noch **ohne** Schemaaenderung. Erst das Geruest, dann der Umbau darin — sonst sind beim Fehlersuchen zwei Dinge gleichzeitig neu.

**Dateien:**

- Aendern: `apps/server/src/db/database.ts`
- Test: `apps/server/src/db/database.test.ts`

**Schnittstellen:**

- Produziert: `migrate(database: AppDatabase): void` (unveraenderte Signatur), intern eine Liste `MIGRATIONS: readonly ((db: AppDatabase) => void)[]`. `user_version` ist danach gleich `MIGRATIONS.length`.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

An `apps/server/src/db/database.test.ts` anhaengen:

```ts
describe('Migrationen', () => {
  it('setzt user_version auf die Zahl der angewandten Schritte', () => {
    const database = openDatabase(':memory:');
    const [{ user_version: version }] = database.pragma('user_version') as {
      user_version: number;
    }[];

    expect(version).toBeGreaterThan(0);
  });

  it('laeuft zweimal hintereinander ohne Wirkung und ohne Wurf', () => {
    const database = openDatabase(':memory:');
    const before = database.pragma('user_version');

    expect(() => migrate(database)).not.toThrow();
    expect(database.pragma('user_version')).toEqual(before);
  });

  it('holt eine Datenbank ohne user_version von vorne ab', () => {
    // Der Stand vor dieser Etappe: Tabellen da, user_version noch 0.
    const database = openDatabase(':memory:');
    database.pragma('user_version = 0');

    migrate(database);

    const [{ user_version: version }] = database.pragma('user_version') as {
      user_version: number;
    }[];
    expect(version).toBeGreaterThan(0);
  });
});
```

Den Import in derselben Datei auf `import { migrate, openDatabase } from './database.js';` erweitern.

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/db/database.test.ts`
Erwartet: FEHLSCHLAG — `user_version` ist 0, weil es die Liste noch nicht gibt.

- [ ] **Schritt 3: `migrate` auf eine Schrittliste umbauen**

In `apps/server/src/db/database.ts` die Funktion `migrate` ersetzen (der bisherige `database.exec(...)`-Block wandert unveraendert in `stepInitialSchema`):

```ts
/**
 * Die Migrationsliste.
 *
 * `user_version` haelt fest, wie viele Schritte gelaufen sind. Das ist ein
 * SQLite-Bordmittel und kostet keine Tabelle.
 *
 * **Ein einmal veroeffentlichter Schritt wird nie wieder angefasst.** Er
 * beschreibt den Stand, den es einmal gab, nicht den, den wir haben wollen.
 * Wer eine Spalte braucht, haengt hinten einen Schritt an. Wer einen alten
 * Schritt aendert, aendert die Vergangenheit fuer alle, die sie schon
 * durchlaufen haben - deren Datenbanken saehen danach anders aus als die der
 * Neuzugaenge, und niemand koennte sagen, welche der beiden die richtige ist.
 */
const MIGRATIONS: readonly ((database: AppDatabase) => void)[] = [stepInitialSchema];

export function migrate(database: AppDatabase): void {
  const [{ user_version: applied }] = database.pragma('user_version') as {
    user_version: number;
  }[];

  for (let step = applied; step < MIGRATIONS.length; step += 1) {
    /*
     * Jeder Schritt und sein Hochzaehlen in EINER Transaktion. Bricht er ab,
     * bleibt die Datenbank auf dem Stand davor - ein halb gewanderter Schritt
     * waere ein Zustand, den keine Liste mehr beschreibt.
     */
    const run = database.transaction(() => {
      MIGRATIONS[step]?.(database);
      // Kein Platzhalter moeglich: PRAGMA nimmt keine gebundenen Werte.
      database.pragma(`user_version = ${step + 1}`);
    });
    run();
  }
}

/**
 * Der Stand, mit dem das Projekt bis Etappe 6 gelaufen ist.
 *
 * Wortgleich aus dem bisherigen `migrate()` uebernommen, samt Kommentaren.
 * Ab jetzt eingefroren - siehe oben.
 */
function stepInitialSchema(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      is_guest     INTEGER NOT NULL DEFAULT 1,
      secret_hash  TEXT NOT NULL UNIQUE,
      created_at   INTEGER NOT NULL
    );

    /*
     * Ein Raum. Der Spielzustand steht NICHT hier, sondern folgt aus
     * start_state plus room_actions - das ist die Entscheidung aus Etappe 6.
     * version wird mitgespeichert, weil der Client kleinere Versionen verwirft:
     * finge sie nach einem Neustart wieder bei 1 an, ignorierte jeder noch
     * offene Browser den frischen Stand.
     */
    CREATE TABLE IF NOT EXISTS rooms (
      code         TEXT PRIMARY KEY,
      host_id      TEXT NOT NULL REFERENCES users(id),
      seat_count   INTEGER NOT NULL,
      seed         TEXT NOT NULL,
      version      INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      start_state  TEXT,
      finished_at  INTEGER
    );

    /*
     * Kein name und kein color: der Name steht in users, die Farbe folgt aus
     * der Position. Beides hier zu wiederholen waere die zweite Wahrheit.
     */
    CREATE TABLE IF NOT EXISTS room_seats (
      code      TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      position  INTEGER NOT NULL,
      user_id   TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (code, position)
    );

    CREATE TABLE IF NOT EXISTS room_actions (
      code     TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      ordinal  INTEGER NOT NULL,
      action   TEXT NOT NULL,
      PRIMARY KEY (code, ordinal)
    );
  `);
}
```

- [ ] **Schritt 4: Test laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/db/database.test.ts`
Erwartet: BESTANDEN.

- [ ] **Schritt 5: Volle Abnahme und Commit**

```bash
pnpm typecheck
pnpm test
pnpm format:check
git add apps/server/src/db/database.ts apps/server/src/db/database.test.ts
git commit -m "Die Datenbank zaehlt ihre Schritte: user_version statt IF NOT EXISTS allein"
```

---

### Aufgabe 2: `sessions` anlegen, `secret_hash` umziehen

**Dateien:**

- Aendern: `apps/server/src/db/database.ts`
- Test: `apps/server/src/db/database.test.ts`

**Schnittstellen:**

- Produziert: Tabelle `sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL)`; `users` ohne `secret_hash`, dafuer mit `login`, `password_hash`, `email`.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Der wichtigste Test dieser Etappe: eine Datenbank im **alten** Stand von Hand bauen, migrieren, und pruefen, dass nichts verloren geht.

```ts
describe('Migration auf sessions', () => {
  /** Eine Datenbank so, wie sie vor dieser Etappe aussah. */
  function legacyDatabase(): AppDatabase {
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, is_guest INTEGER NOT NULL DEFAULT 1,
        secret_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
      );
      CREATE TABLE rooms (
        code TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES users(id),
        seat_count INTEGER NOT NULL, seed TEXT NOT NULL, version INTEGER NOT NULL,
        created_at INTEGER NOT NULL, start_state TEXT, finished_at INTEGER
      );
      CREATE TABLE room_seats (
        code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        position INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
        PRIMARY KEY (code, position)
      );
      CREATE TABLE room_actions (
        code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL, action TEXT NOT NULL, PRIMARY KEY (code, ordinal)
      );
    `);
    database.pragma('user_version = 1'); // Schritt 0 gilt als gelaufen
    return database;
  }

  it('rettet das Geheimnis eines Gastes in die neue Tabelle', () => {
    const database = legacyDatabase();
    database
      .prepare('INSERT INTO users (id, name, is_guest, secret_hash, created_at) VALUES (?,?,1,?,?)')
      .run('u1', 'Anna', 'hash-von-anna', 1000);

    migrate(database);

    const row = database
      .prepare('SELECT user_id, created_at FROM sessions WHERE token_hash = ?')
      .get('hash-von-anna') as { user_id: string; created_at: number } | undefined;

    expect(row?.user_id).toBe('u1');
    expect(row?.created_at).toBe(1000);
  });

  it('laesst den Sitz bei derselben Person', () => {
    const database = legacyDatabase();
    database
      .prepare('INSERT INTO users (id, name, is_guest, secret_hash, created_at) VALUES (?,?,1,?,?)')
      .run('u1', 'Anna', 'hash-von-anna', 1000);
    database
      .prepare(
        'INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('AB12', 'u1', 3, 'saat', 1, 1000);
    database
      .prepare('INSERT INTO room_seats (code, position, user_id) VALUES (?,?,?)')
      .run('AB12', 0, 'u1');

    migrate(database);

    const seat = database
      .prepare('SELECT user_id FROM room_seats WHERE code = ? AND position = 0')
      .get('AB12') as { user_id: string };
    expect(seat.user_id).toBe('u1');
  });

  it('nimmt secret_hash aus users heraus und haengt die Kontospalten an', () => {
    const database = legacyDatabase();
    migrate(database);

    const columns = (database.pragma('table_info(users)') as { name: string }[]).map((c) => c.name);

    expect(columns).not.toContain('secret_hash');
    expect(columns).toEqual(expect.arrayContaining(['login', 'password_hash', 'email']));
  });

  it('laesst mehrere Gaeste ohne login nebeneinander bestehen', () => {
    const database = openDatabase(':memory:');
    const insert = database.prepare(
      'INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,?)',
    );

    expect(() => {
      insert.run('u1', 'Anna', 1);
      insert.run('u2', 'Bea', 2);
    }).not.toThrow();
  });

  it('laesst denselben login kein zweites Mal zu', () => {
    const database = openDatabase(':memory:');
    const insert = database.prepare(
      'INSERT INTO users (id, name, is_guest, login, created_at) VALUES (?,?,0,?,?)',
    );
    insert.run('u1', 'Anna', 'anna', 1);

    expect(() => insert.run('u2', 'Andere', 'anna', 2)).toThrow();
  });
});
```

Kopf der Testdatei um `import Database from 'better-sqlite3';` und `import type { AppDatabase } from './database.js';` erweitern.

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/db/database.test.ts`
Erwartet: FEHLSCHLAG — `no such table: sessions`.

- [ ] **Schritt 3: Schritt 1 an die Liste haengen**

In `database.ts`:

```ts
const MIGRATIONS: readonly ((database: AppDatabase) => void)[] = [
  stepInitialSchema,
  stepSessionsAndAccounts,
];

/**
 * Das Sitzungsgeheimnis zieht aus `users` in eine eigene Tabelle, und `users`
 * bekommt, was ein Konto ausmacht.
 *
 * Der Grund fuer den Umzug: `users.secret_hash` ist EINE Spalte pro Person.
 * Der Server kennt nur den Hash und kann beim Anmelden kein bestehendes
 * Geheimnis herausgeben - er muesste eins ersetzen und damit das andere Geraet
 * aussperren. Ausgerechnet das zweite Geraet ist aber der Grund, sich
 * ueberhaupt zu registrieren.
 */
function stepSessionsAndAccounts(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  INTEGER NOT NULL
    );

    INSERT INTO sessions (token_hash, user_id, created_at)
      SELECT secret_hash, id, created_at FROM users;

    ALTER TABLE users DROP COLUMN secret_hash;

    ALTER TABLE users ADD COLUMN login TEXT;
    ALTER TABLE users ADD COLUMN password_hash TEXT;
    ALTER TABLE users ADD COLUMN email TEXT;

    /*
     * UNIQUE als Index, nicht als Spaltenzusatz: ALTER TABLE ADD COLUMN kann
     * in SQLite kein UNIQUE mitbringen. Mehrere NULL stoeren einen UNIQUE-Index
     * nicht - genau deshalb duerfen beliebig viele Gaeste ohne login bestehen.
     */
    CREATE UNIQUE INDEX users_login ON users(login);
    CREATE UNIQUE INDEX users_email ON users(email);
    CREATE INDEX sessions_user ON sessions(user_id);
  `);
}
```

- [ ] **Schritt 4: Test laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/db/database.test.ts`
Erwartet: BESTANDEN.

`pnpm --filter @conquerist/server test` schlaegt jetzt in `users.test.ts` fehl (der Test liest `secret_hash` aus `users`). Das ist erwartet und wird in Aufgabe 5 behoben — **hier noch nicht anfassen**.

- [ ] **Schritt 5: Commit**

```bash
git add apps/server/src/db/database.ts apps/server/src/db/database.test.ts
git commit -m "Sitzungen als eigene Tabelle, users bekommt Login und Passwort"
```

---

### Aufgabe 3: Passwoerter hashen und pruefen

**Dateien:**

- Anlegen: `apps/server/src/identity/password.ts`
- Test: `apps/server/src/identity/password.test.ts`

**Schnittstellen:**

- Produziert: `hashPassword(plain: string): Promise<string>` und `verifyPassword(plain: string, stored: string): Promise<boolean>`. Das Format ist `scrypt$<N>$<r>$<p>$<salt-b64>$<hash-b64>`.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('Passwoerter', () => {
  it('erkennt das richtige Passwort wieder', async () => {
    const stored = await hashPassword('richtig-und-lang');
    expect(await verifyPassword('richtig-und-lang', stored)).toBe(true);
  });

  it('weist ein falsches Passwort ab', async () => {
    const stored = await hashPassword('richtig-und-lang');
    expect(await verifyPassword('falsch-und-lang', stored)).toBe(false);
  });

  it('legt dasselbe Passwort nie zweimal gleich ab', async () => {
    // Sonst verriete die Datenbank, wer dasselbe Passwort benutzt.
    const a = await hashPassword('dasselbe-passwort');
    const b = await hashPassword('dasselbe-passwort');
    expect(a).not.toBe(b);
  });

  it('traegt seine Parameter mit sich', async () => {
    const stored = await hashPassword('irgendein-passwort');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored.split('$')).toHaveLength(6);
  });

  it('speichert das Passwort nirgends im Klartext', async () => {
    const stored = await hashPassword('geheimes-wort');
    expect(stored).not.toContain('geheimes-wort');
  });

  it('haelt einen unleserlichen Eintrag aus, statt zu werfen', async () => {
    // So etwas darf es nicht geben - aber ein Wurf beim Anmelden waere ein
    // INTERNAL, und der Nutzer saehe einen Serverfehler statt einer Absage.
    expect(await verifyPassword('egal', 'kaputt')).toBe(false);
    expect(await verifyPassword('egal', '')).toBe(false);
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/identity/password.test.ts`
Erwartet: FEHLSCHLAG — Modul nicht gefunden.

- [ ] **Schritt 3: `password.ts` schreiben**

```ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/**
 * Passwoerter mit `scrypt` aus `node:crypto`.
 *
 * **Warum scrypt und nicht Argon2id.** Argon2id waere die heute uebliche
 * Empfehlung, gibt es in Node aber nicht eingebaut - es waere ein nativer Build
 * wie `better-sqlite3`. scrypt gilt weiterhin als taugliche KDF, kostet keine
 * Abhaengigkeit, und die Parameter wandern im Hash mit: wer sie spaeter
 * anhebt, macht damit keine bestehende Zeile unlesbar.
 *
 * **Asynchron, nicht `scryptSync`.** Die Synchronvariante haelt den Event-Loop
 * an, und zwar fuer alle Verbindungen gleichzeitig - bei diesen Kosten sind das
 * ueber hundert Millisekunden, in denen kein anderer Spieler einen Zug los
 * wird. Der Router erlaubt Handlern ausdruecklich ein `Promise`.
 */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(plain, salt, KEY_LENGTH, PARAMS);

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(rawSalt ?? '', 'base64');
  const expected = Buffer.from(rawKey ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = await derive(plain, salt, expected.length, { N, r, p });

  // Gleich lang sind sie hier immer - `timingSafeEqual` wirft sonst.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Schritt 4: Test laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/identity/password.test.ts`
Erwartet: BESTANDEN.

- [ ] **Schritt 5: Commit**

```bash
git add apps/server/src/identity/password.ts apps/server/src/identity/password.test.ts
git commit -m "Passwoerter mit scrypt, Parameter wandern im Hash mit"
```

---

### Aufgabe 4: Sitzungen anlegen, aufloesen, loeschen

**Dateien:**

- Anlegen: `apps/server/src/identity/sessions.ts`
- Test: `apps/server/src/identity/sessions.test.ts`

**Schnittstellen:**

- Produziert: `class Sessions` mit `issue(userId: string): { token: string; tokenHash: string }`, `userIdOf(token: string): string | undefined`, `hashOf(token: string): string`, `revoke(tokenHash: string): void`, `countFor(userId: string): number`.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import { Sessions } from './sessions.js';

function fixture(): { sessions: Sessions; userId: string } {
  const database = openDatabase(':memory:');
  database
    .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,?)')
    .run('u1', 'Anna', 1000);
  return { sessions: new Sessions(database), userId: 'u1' };
}

describe('Sitzungen', () => {
  it('loest ein ausgegebenes Token zu seinem Nutzer auf', () => {
    const { sessions, userId } = fixture();
    const { token } = sessions.issue(userId);

    expect(sessions.userIdOf(token)).toBe(userId);
  });

  it('kennt ein erfundenes Token nicht', () => {
    const { sessions } = fixture();
    expect(sessions.userIdOf('voellig-erfunden')).toBeUndefined();
  });

  it('legt das Token niemals im Klartext ab', () => {
    const database = openDatabase(':memory:');
    database
      .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?,?,1,?)')
      .run('u1', 'Anna', 1000);
    const sessions = new Sessions(database);
    const { token } = sessions.issue('u1');

    const rows = database.prepare('SELECT token_hash FROM sessions').all() as {
      token_hash: string;
    }[];

    expect(rows[0]?.token_hash).not.toBe(token);
    expect(rows[0]?.token_hash).toHaveLength(64); // SHA-256 in hex
  });

  it('traegt zwei Geraete nebeneinander', () => {
    const { sessions, userId } = fixture();
    const laptop = sessions.issue(userId);
    const handy = sessions.issue(userId);

    expect(sessions.userIdOf(laptop.token)).toBe(userId);
    expect(sessions.userIdOf(handy.token)).toBe(userId);
    expect(sessions.countFor(userId)).toBe(2);
  });

  it('beendet beim Abmelden nur die eine Sitzung', () => {
    const { sessions, userId } = fixture();
    const laptop = sessions.issue(userId);
    const handy = sessions.issue(userId);

    sessions.revoke(laptop.tokenHash);

    expect(sessions.userIdOf(laptop.token)).toBeUndefined();
    expect(sessions.userIdOf(handy.token)).toBe(userId);
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/identity/sessions.test.ts`
Erwartet: FEHLSCHLAG — Modul nicht gefunden.

- [ ] **Schritt 3: `sessions.ts` schreiben**

```ts
import { createHash, randomBytes } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';

/**
 * Sitzungen: eine Zeile je angemeldetem Geraet.
 *
 * Das Token ist kein getipptes Passwort, sondern 32 Zufallsbytes - deshalb
 * genuegt `sha256` und es braucht keine KDF. Der Klartext verlaesst den Server
 * genau einmal, naemlich in der Antwort, die ihn erzeugt.
 *
 * Getrennt von `Users`, weil es zwei Fragen sind: „wer bin ich" beantwortet
 * `users`, „ist dieser Browser angemeldet" beantwortet `sessions`. Solange
 * beides in einer Spalte stand, konnte es nur eine Antwort gleichzeitig geben.
 */
export interface IssuedSession {
  /** Geht an den Browser und wird dort abgelegt. */
  readonly token: string;
  /** Steht in der Datenbank und in der Verbindungssitzung. */
  readonly tokenHash: string;
}

export class Sessions {
  constructor(private readonly database: AppDatabase) {}

  issue(userId: string): IssuedSession {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hash(token);

    this.database
      .prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)')
      .run(tokenHash, userId, Date.now());

    return { token, tokenHash };
  }

  userIdOf(token: string): string | undefined {
    const row = this.database
      .prepare('SELECT user_id FROM sessions WHERE token_hash = ?')
      .get(hash(token)) as { user_id: string } | undefined;

    return row?.user_id;
  }

  hashOf(token: string): string {
    return hash(token);
  }

  revoke(tokenHash: string): void {
    this.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  countFor(userId: string): number {
    const row = this.database
      .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?')
      .get(userId) as { n: number };

    return row.n;
  }
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Schritt 4: Test laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/identity/sessions.test.ts`
Erwartet: BESTANDEN.

- [ ] **Schritt 5: Commit**

```bash
git add apps/server/src/identity/sessions.ts apps/server/src/identity/sessions.test.ts
git commit -m "Sitzungen als eigener Baustein: ausgeben, aufloesen, einzeln beenden"
```

---

### Aufgabe 5: `Users` auf `Sessions` umstellen

`users.test.ts` ist seit Aufgabe 2 rot. Diese Aufgabe macht es wieder gruen.

**Dateien:**

- Aendern: `apps/server/src/identity/users.ts`, `apps/server/src/identity/users.test.ts`

**Schnittstellen:**

- Konsumiert: `Sessions` aus Aufgabe 4.
- Produziert: `User` bekommt `login?: string`. `HelloResult` bekommt `tokenHash: string`. `Users` bekommt `byLogin(login: string): AccountRow | undefined` und `findId(id: string): User | undefined` (bisher `byId`, Name bleibt).

- [ ] **Schritt 1: Die Tests anpassen und erweitern**

In `users.test.ts` den Test „speichert das Geheimnis niemals im Klartext" ersetzen — er liest `users.secret_hash`, das es nicht mehr gibt:

```ts
it('speichert das Geheimnis niemals im Klartext', () => {
  const database = openDatabase(':memory:');
  const store = new Users(database, new Sessions(database));
  const created = store.hello(undefined, 'Anna');

  const row = database.prepare('SELECT token_hash FROM sessions').get() as {
    token_hash: string;
  };

  expect(row.token_hash).not.toBe(created.secret);
  expect(row.token_hash).toHaveLength(64); // SHA-256 in hex
});
```

Die Hilfsfunktion oben in der Datei anpassen:

```ts
function users(): Users {
  const database = openDatabase(':memory:');
  return new Users(database, new Sessions(database));
}
```

Und zwei Tests anhaengen:

```ts
it('gibt den Hash der Sitzung mit heraus, damit die Verbindung ihn merkt', () => {
  const store = users();
  const created = store.hello(undefined, 'Anna');

  expect(created.tokenHash).toHaveLength(64);
});

it('findet ein Konto an seinem Login, aber nicht an fremder Schreibweise', () => {
  const database = openDatabase(':memory:');
  const store = new Users(database, new Sessions(database));
  database
    .prepare(
      'INSERT INTO users (id, name, is_guest, login, password_hash, created_at) VALUES (?,?,0,?,?,?)',
    )
    .run('u1', 'Anna', 'anna', 'scrypt$1$1$1$a$b', 1);

  expect(store.byLogin('anna')?.id).toBe('u1');
  expect(store.byLogin('gibtsnicht')).toBeUndefined();
});
```

Import ergaenzen: `import { Sessions } from './sessions.js';`

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/identity/users.test.ts`
Erwartet: FEHLSCHLAG — `Users` nimmt noch kein zweites Argument, `tokenHash` fehlt.

- [ ] **Schritt 3: `users.ts` umbauen**

```ts
import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';
import type { Sessions } from './sessions.js';

/**
 * Nutzerzeilen (Regel 7: Identitaet ab Tag 1).
 *
 * Ein Gast ist eine Zeile mit `login IS NULL`, ein Konto eine mit gefuelltem
 * `login` - kein zweiter Datentyp, sondern dieselbe Zeile mit mehr darin.
 * Genau deshalb ueberlebt beim Beanspruchen jeder Sitz: es wird nichts
 * umgehaengt, es wird nur ergaenzt.
 *
 * Das Sitzungsgeheimnis liegt seit Etappe 7 nicht mehr hier, sondern in
 * `sessions` - eine Person kann an mehreren Geraeten angemeldet sein.
 */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly isGuest: boolean;
  /** Fehlt bei Gaesten. */
  readonly login?: string;
}

export interface HelloResult {
  readonly user: User;
  /** Nur beim Anlegen gefuellt - danach kennt der Browser es. */
  readonly secret?: string;
  /** Womit die Verbindung ihre Sitzung wiederfindet (fuers Abmelden). */
  readonly tokenHash: string;
}

/** Was zum Anmelden gebraucht wird - inklusive des Hashes. */
export interface AccountRow {
  readonly id: string;
  readonly name: string;
  readonly login: string;
  readonly passwordHash: string;
}

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly is_guest: number;
  readonly login: string | null;
}

export class Users {
  constructor(
    private readonly database: AppDatabase,
    private readonly sessions: Sessions,
  ) {}

  /**
   * Anmelden oder anlegen.
   *
   * Ein unbekanntes Geheimnis wirft, statt still einen neuen Gast anzulegen:
   * sonst waere ein Tippfehler im `localStorage` nicht von einem Angriff zu
   * unterscheiden, und der Tisch fuellte sich mit Karteileichen.
   */
  hello(secret: string | undefined, name: string | undefined): HelloResult {
    if (secret === undefined) return this.createGuest(name ?? 'Gast');

    const userId = this.sessions.userIdOf(secret);
    if (userId === undefined) throw new Error('Unbekanntes Sitzungsgeheimnis');

    const user = this.byId(userId);
    if (user === undefined) throw new Error('Sitzung ohne Nutzer');

    const tokenHash = this.sessions.hashOf(secret);

    if (name !== undefined && name !== user.name) {
      this.database.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
      return { user: { ...user, name }, tokenHash };
    }

    return { user, tokenHash };
  }

  createGuest(name: string): HelloResult {
    const id = randomUUID();
    this.database
      .prepare('INSERT INTO users (id, name, is_guest, created_at) VALUES (?, ?, 1, ?)')
      .run(id, name, Date.now());

    const { token, tokenHash } = this.sessions.issue(id);
    return { user: { id, name, isGuest: true }, secret: token, tokenHash };
  }

  byId(id: string): User | undefined {
    const row = this.database
      .prepare('SELECT id, name, is_guest, login FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;

    return row === undefined ? undefined : toUser(row);
  }

  byLogin(login: string): AccountRow | undefined {
    const row = this.database
      .prepare('SELECT id, name, login, password_hash FROM users WHERE login = ?')
      .get(login) as { id: string; name: string; login: string; password_hash: string } | undefined;

    return row === undefined
      ? undefined
      : { id: row.id, name: row.name, login: row.login, passwordHash: row.password_hash };
  }

  count(): number {
    const row = this.database.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return row.n;
  }
}

function toUser(row: UserRow): User {
  return row.login === null
    ? { id: row.id, name: row.name, isGuest: row.is_guest === 1 }
    : { id: row.id, name: row.name, isGuest: row.is_guest === 1, login: row.login };
}
```

- [ ] **Schritt 4: Die Verdrahtung nachziehen und alles gruen sehen**

`apps/server/src/app.ts` legt `Users` an — dort `new Sessions(database)` erzeugen und durchreichen. Der genaue Ort ergibt sich aus `grep -n "new Users" apps/server/src`.

Ausfuehren: `pnpm --filter @conquerist/server test`
Erwartet: BESTANDEN (alle 74 plus die neuen).

- [ ] **Schritt 5: Commit**

```bash
pnpm typecheck
git add apps/server/src/identity apps/server/src/app.ts
git commit -m "hello geht ueber sessions, users kennt jetzt Konten"
```

---

### Aufgabe 6: Das Protokoll der vier Nachrichten

**Dateien:**

- Anlegen: `packages/shared/src/protocol/auth.ts`, `packages/shared/src/protocol/auth.test.ts`
- Aendern: `packages/shared/src/protocol/room.ts`, `packages/shared/src/protocol/registry.ts`, `packages/shared/src/protocol/index.ts`

**Schnittstellen:**

- Produziert: `AUTH_REGISTER`, `AUTH_LOGIN`, `AUTH_LOGOUT`, `AUTH_ME`, `AUTH_OK`; `AuthResponseSchema`; `RegisterRequestSchema`, `LoginRequestSchema`. `HelloResponseSchema` bekommt `isGuest` und optional `login`.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/protocol/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AuthResponseSchema,
  LoginRequestSchema,
  MIN_PASSWORD_LENGTH,
  RegisterRequestSchema,
} from './auth.js';

describe('Auth-Schemata', () => {
  it('nimmt eine Registrierung ohne E-Mail an - sie ist freiwillig', () => {
    const parsed = RegisterRequestSchema.safeParse({ login: 'anna', password: 'langgenug1' });
    expect(parsed.success).toBe(true);
  });

  it('weist ein zu kurzes Passwort ab', () => {
    const parsed = RegisterRequestSchema.safeParse({ login: 'anna', password: 'kurz' });
    expect(parsed.success).toBe(false);
  });

  it('weist eine kaputte E-Mail ab, wenn sie denn angegeben wird', () => {
    const parsed = RegisterRequestSchema.safeParse({
      login: 'anna',
      password: 'langgenug1',
      email: 'kein-at-zeichen',
    });
    expect(parsed.success).toBe(false);
  });

  it('nimmt den Login unabhaengig von Gross- und Kleinschreibung entgegen', () => {
    const parsed = RegisterRequestSchema.parse({ login: '  AnnA ', password: 'langgenug1' });
    expect(parsed.login).toBe('anna');
  });

  it('laesst eine Antwort ohne login gelten - das ist ein Gast', () => {
    const parsed = AuthResponseSchema.safeParse({ userId: 'u1', name: 'Gast', isGuest: true });
    expect(parsed.success).toBe(true);
  });

  it('traegt die Bestaetigung, mit der man seine Gast-Partien aufgibt', () => {
    const parsed = LoginRequestSchema.parse({
      login: 'anna',
      password: 'langgenug1',
      confirmAbandonGuest: true,
    });
    expect(parsed.confirmAbandonGuest).toBe(true);
  });

  it('haelt die Mindestlaenge an einer Stelle fest', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/shared exec vitest run src/protocol/auth.test.ts`
Erwartet: FEHLSCHLAG — Modul nicht gefunden.

- [ ] **Schritt 3: `auth.ts` schreiben**

```ts
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
```

- [ ] **Schritt 4: `hello.ok` angleichen und registrieren**

In `packages/shared/src/protocol/room.ts` `HelloResponseSchema` ersetzen:

```ts
/**
 * Die Antwort auf `hello` ist dieselbe Form wie die auf `auth.*`.
 *
 * Sie wurde in Etappe 7 um `isGuest` und `login` erweitert - vertraeglich,
 * denn ein aelterer Client liest die neuen Felder einfach nicht.
 */
export const HelloResponseSchema = z.object({
  userId: z.string().min(1),
  /** Nur beim Anlegen gefuellt - danach kennt der Browser es. */
  secret: z.string().min(1).optional(),
  name: DisplayNameSchema,
  isGuest: z.boolean(),
  login: z.string().optional(),
});
```

In `registry.ts` die vier Eintraege ergaenzen (Import aus `./auth.js`):

```ts
  [AUTH_REGISTER]: {
    responseType: AUTH_OK,
    request: RegisterRequestSchema,
    response: AuthResponseSchema,
  },
  [AUTH_LOGIN]: {
    responseType: AUTH_OK,
    request: LoginRequestSchema,
    response: AuthResponseSchema,
  },
  [AUTH_LOGOUT]: {
    responseType: AUTH_OK,
    request: EmptyAuthRequestSchema,
    response: AuthResponseSchema,
  },
  [AUTH_ME]: {
    responseType: AUTH_OK,
    request: EmptyAuthRequestSchema,
    response: AuthResponseSchema,
  },
```

In `packages/shared/src/protocol/index.ts`: `export * from './auth.js';`

- [ ] **Schritt 5: Tests laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/shared test`
Erwartet: BESTANDEN. `room.test.ts` kann fehlschlagen, weil `hello.ok` jetzt `isGuest` verlangt — dort die Testdaten um `isGuest: true` ergaenzen.

- [ ] **Schritt 6: Commit**

```bash
pnpm typecheck
git add packages/shared/src/protocol
git commit -m "Protokoll fuer Registrieren, Anmelden, Abmelden - eine Antwortform fuer alle"
```

---

### Aufgabe 7: Die Ablaeufe im Server und die vier Handler

**Dateien:**

- Anlegen: `apps/server/src/identity/accounts.ts`, `apps/server/src/identity/accounts.test.ts`, `apps/server/src/ws/handlers/auth.ts`
- Aendern: `apps/server/src/ws/router.ts` (`Session` bekommt `tokenHash`), `apps/server/src/ws/handlers/room.ts` (`hello` fuellt `tokenHash` und antwortet mit `isGuest`), `apps/server/src/app.ts`

**Schnittstellen:**

- Konsumiert: `Users`, `Sessions`, `hashPassword`, `verifyPassword`, `RoomRegistry.roomsOf`.
- Produziert: `class Accounts` mit `register(...)`, `login(...)`, `logout(...)` — jede gibt `{ user: User; secret?: string; tokenHash: string }` zurueck. Fehler als `AccountError` (Nachricht ist fuer den Spieler bestimmt).

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`apps/server/src/identity/accounts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import { Accounts, AccountError } from './accounts.js';
import { Sessions } from './sessions.js';
import { Users } from './users.js';

function fixture() {
  const database = openDatabase(':memory:');
  const sessions = new Sessions(database);
  const users = new Users(database, sessions);
  return { database, sessions, users, accounts: new Accounts(users, sessions) };
}

describe('Konten', () => {
  it('macht aus dem Gast ein Konto - dieselbe Zeile, dieselbe Id', async () => {
    const { users, accounts } = fixture();
    const guest = users.hello(undefined, 'Anna');

    const claimed = await accounts.register(
      { login: 'anna', password: 'langgenug1' },
      guest.user.id,
      guest.tokenHash,
    );

    expect(claimed.user.id).toBe(guest.user.id);
    expect(claimed.user.isGuest).toBe(false);
    expect(claimed.user.login).toBe('anna');
    // Kein neues Geheimnis: das Geraet war schon angemeldet.
    expect(claimed.secret).toBeUndefined();
  });

  it('laesst die Sitze beim Beanspruchen unberuehrt', async () => {
    const { database, users, accounts } = fixture();
    const guest = users.hello(undefined, 'Anna');
    database
      .prepare(
        'INSERT INTO rooms (code, host_id, seat_count, seed, version, created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('AB12', guest.user.id, 3, 'saat', 1, 1);
    database
      .prepare('INSERT INTO room_seats (code, position, user_id) VALUES (?,?,?)')
      .run('AB12', 0, guest.user.id);

    await accounts.register(
      { login: 'anna', password: 'langgenug1' },
      guest.user.id,
      guest.tokenHash,
    );

    const seat = database.prepare('SELECT user_id FROM room_seats WHERE code = ?').get('AB12') as {
      user_id: string;
    };
    expect(seat.user_id).toBe(guest.user.id);
  });

  it('legt ohne Sitzung ein frisches Konto samt Geheimnis an', async () => {
    const { accounts } = fixture();

    const created = await accounts.register(
      { login: 'anna', password: 'langgenug1', name: 'Anna' },
      null,
      null,
    );

    expect(created.user.isGuest).toBe(false);
    expect(created.secret).toBeTruthy();
  });

  it('vergibt denselben Login kein zweites Mal', async () => {
    const { accounts } = fixture();
    await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);

    await expect(
      accounts.register({ login: 'anna', password: 'anderes123' }, null, null),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it('meldet an zwei Geraeten gleichzeitig an', async () => {
    const { sessions, accounts, users } = fixture();
    const account = await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);

    const laptop = await accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0);
    const handy = await accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0);

    expect(sessions.userIdOf(laptop.secret ?? '')).toBe(account.user.id);
    expect(sessions.userIdOf(handy.secret ?? '')).toBe(account.user.id);
    expect(users.byId(account.user.id)?.isGuest).toBe(false);
  });

  it('weist falsches Passwort und unbekannten Login mit derselben Meldung ab', async () => {
    const { accounts } = fixture();
    await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);

    const falsch = await accounts
      .login({ login: 'anna', password: 'ganzfalsch1' }, null, null, 0)
      .catch((error: AccountError) => error.message);
    const unbekannt = await accounts
      .login({ login: 'niemand', password: 'ganzfalsch1' }, null, null, 0)
      .catch((error: AccountError) => error.message);

    expect(falsch).toBe(unbekannt);
  });

  it('verlangt eine Bestaetigung, solange der Gast noch an Tischen sitzt', async () => {
    const { users, accounts } = fixture();
    await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);
    const guest = users.hello(undefined, 'Gast');

    await expect(
      accounts.login({ login: 'anna', password: 'langgenug1' }, guest.user.id, guest.tokenHash, 2),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it('laesst die Gastzeile nach dem Wechsel stehen - dort sitzen noch andere mit', async () => {
    const { users, accounts } = fixture();
    await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);
    const guest = users.hello(undefined, 'Gast');

    await accounts.login(
      { login: 'anna', password: 'langgenug1', confirmAbandonGuest: true },
      guest.user.id,
      guest.tokenHash,
      2,
    );

    expect(users.byId(guest.user.id)).toBeDefined();
  });

  it('beendet beim Abmelden nur dieses Geraet und gibt einen frischen Gast zurueck', async () => {
    const { sessions, accounts } = fixture();
    const laptop = await accounts.register({ login: 'anna', password: 'langgenug1' }, null, null);
    const handy = await accounts.login({ login: 'anna', password: 'langgenug1' }, null, null, 0);

    const after = accounts.logout(laptop.tokenHash);

    expect(after.user.isGuest).toBe(true);
    expect(after.secret).toBeTruthy();
    expect(sessions.userIdOf(handy.secret ?? '')).toBeTruthy();
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/identity/accounts.test.ts`
Erwartet: FEHLSCHLAG — Modul nicht gefunden.

- [ ] **Schritt 3: `accounts.ts` schreiben**

```ts
import type { Sessions } from './sessions.js';
import type { User, Users } from './users.js';
import { hashPassword, verifyPassword } from './password.js';

/**
 * Was ein Spieler lesen darf. Der Handler macht daraus eine `RejectedError`.
 */
export class AccountError extends Error {}

export interface AccountResult {
  readonly user: User;
  /** Nur wenn eine neue Sitzung entstanden ist. */
  readonly secret?: string;
  readonly tokenHash: string;
}

interface RegisterInput {
  readonly login: string;
  readonly password: string;
  readonly email?: string;
  readonly name?: string;
}

interface LoginInput {
  readonly login: string;
  readonly password: string;
  readonly confirmAbandonGuest?: boolean;
}

/**
 * Ein Hash, gegen den geprueft wird, wenn es den Login gar nicht gibt.
 *
 * Ohne ihn antwortet der Server bei unbekanntem Login sofort und bei falschem
 * Passwort erst nach der KDF - die Zeit verriete dann genau das, was die
 * gemeinsame Fehlermeldung verschweigen soll.
 */
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const WRONG_CREDENTIALS = 'Benutzername oder Passwort stimmt nicht.';

export class Accounts {
  constructor(
    private readonly users: Users,
    private readonly sessions: Sessions,
  ) {}

  /**
   * Konto anlegen - und das ist zugleich das Beanspruchen.
   *
   * Ein Gast bekommt seine eigene Zeile ergaenzt (Regel 7: „ein UPDATE auf die
   * bestehende Zeile, kein neuer Datentyp"), und weil nichts umgehaengt wird,
   * bleibt jeder Sitz, wo er ist. Ohne Sitzung entsteht eine neue Zeile.
   */
  async register(
    input: RegisterInput,
    currentUserId: string | null,
    currentTokenHash: string | null,
  ): Promise<AccountResult> {
    if (this.users.byLogin(input.login) !== undefined) {
      throw new AccountError('Dieser Benutzername ist vergeben.');
    }

    const current = currentUserId === null ? undefined : this.users.byId(currentUserId);
    if (current !== undefined && !current.isGuest) {
      throw new AccountError('Du bist schon angemeldet.');
    }

    const passwordHash = await hashPassword(input.password);

    if (current !== undefined && currentTokenHash !== null) {
      const claimed = this.users.claim(current.id, {
        login: input.login,
        passwordHash,
        email: input.email,
        name: input.name,
      });
      return { user: claimed, tokenHash: currentTokenHash };
    }

    const created = this.users.createAccount({
      login: input.login,
      passwordHash,
      email: input.email,
      name: input.name ?? input.login,
    });
    const { token, tokenHash } = this.sessions.issue(created.id);
    return { user: created, secret: token, tokenHash };
  }

  /**
   * An einem bestehenden Konto anmelden.
   *
   * `openGuestGames` kommt vom Aufrufer, weil nur der das Raumverzeichnis
   * kennt. Die Warnung selbst zeigt der Client - er hat die Liste ohnehin.
   * Dieser Riegel gilt fuer den, der am Dialog vorbei sendet.
   */
  async login(
    input: LoginInput,
    currentUserId: string | null,
    currentTokenHash: string | null,
    openGuestGames: number,
  ): Promise<AccountResult> {
    const account = this.users.byLogin(input.login);
    const stored = account?.passwordHash ?? DUMMY_HASH;
    const matches = await verifyPassword(input.password, stored);

    if (account === undefined || !matches) throw new AccountError(WRONG_CREDENTIALS);

    const current = currentUserId === null ? undefined : this.users.byId(currentUserId);
    if (
      current !== undefined &&
      current.isGuest &&
      openGuestGames > 0 &&
      input.confirmAbandonGuest !== true
    ) {
      throw new AccountError('Du hast offene Partien als Gast. Bestaetige, dass du sie aufgibst.');
    }

    // Dieses Geraet ist ab jetzt jemand anderes. Die Gast**zeile** bleibt: an
    // ihr haengen Sitze in Raeumen, in denen andere weiterspielen.
    if (currentTokenHash !== null) this.sessions.revoke(currentTokenHash);

    const { token, tokenHash } = this.sessions.issue(account.id);
    const user = this.users.byId(account.id);
    if (user === undefined) throw new AccountError(WRONG_CREDENTIALS);

    return { user, secret: token, tokenHash };
  }

  /**
   * Abmelden - und danach ist man ein Gast, nicht niemand.
   *
   * Ein Client ohne Identitaet haette einen Zustand, den es sonst nie gibt.
   */
  logout(currentTokenHash: string | null): AccountResult {
    if (currentTokenHash === null) throw new AccountError('Du bist nicht angemeldet.');

    this.sessions.revoke(currentTokenHash);

    const guest = this.users.createGuest('Gast');
    return { user: guest.user, secret: guest.secret, tokenHash: guest.tokenHash };
  }
}
```

- [ ] **Schritt 4: `Users` um `claim` und `createAccount` ergaenzen**

In `users.ts` anhaengen:

```ts
  /**
   * Aus dem Gast wird ein Konto - dieselbe Zeile, nur voller.
   *
   * `is_guest` und `login` werden zusammen gesetzt. Sie sagen dasselbe, und
   * getrennt gesetzt liefe genau das auseinander.
   */
  claim(
    id: string,
    fields: {
      readonly login: string;
      readonly passwordHash: string;
      readonly email?: string;
      readonly name?: string;
    },
  ): User {
    this.database
      .prepare(
        `UPDATE users
            SET login = ?, password_hash = ?, email = ?, is_guest = 0,
                name = COALESCE(?, name)
          WHERE id = ?`,
      )
      .run(fields.login, fields.passwordHash, fields.email ?? null, fields.name ?? null, id);

    const user = this.byId(id);
    if (user === undefined) throw new Error('Beanspruchte Zeile ist verschwunden');
    return user;
  }

  createAccount(fields: {
    readonly login: string;
    readonly passwordHash: string;
    readonly email?: string;
    readonly name: string;
  }): User {
    const id = randomUUID();
    this.database
      .prepare(
        `INSERT INTO users (id, name, is_guest, login, password_hash, email, created_at)
         VALUES (?, ?, 0, ?, ?, ?, ?)`,
      )
      .run(id, fields.name, fields.login, fields.passwordHash, fields.email ?? null, Date.now());

    return { id, name: fields.name, isGuest: false, login: fields.login };
  }
```

- [ ] **Schritt 5: Test laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/server exec vitest run src/identity/accounts.test.ts`
Erwartet: BESTANDEN.

- [ ] **Schritt 6: `Session` um `tokenHash` erweitern und die Handler schreiben**

In `apps/server/src/ws/router.ts`:

```ts
export interface Session {
  userId: string | null;
  roomCode: string | null;
  /** Womit sich diese Verbindung abmelden kann. `hello` traegt ihn ein. */
  tokenHash: string | null;
}
```

Alle Stellen, die ein `Session`-Objekt bauen (`connection.ts`, Tests in `router.test.ts`), um `tokenHash: null` ergaenzen — `grep -rn "roomCode: null" apps/server/src` findet sie.

In `handlers/room.ts` den `HELLO`-Handler am Ende anpassen:

```ts
context.session.userId = result.user.id;
context.session.tokenHash = result.tokenHash;
sinks.add(result.user.id, context.events);
```

und die Rueckgabe:

```ts
const identity = {
  userId: result.user.id,
  name: result.user.name,
  isGuest: result.user.isGuest,
  ...(result.user.login === undefined ? {} : { login: result.user.login }),
};
return result.secret === undefined ? identity : { ...identity, secret: result.secret };
```

Neu `apps/server/src/ws/handlers/auth.ts`:

```ts
import { AUTH_LOGIN, AUTH_LOGOUT, AUTH_ME, AUTH_REGISTER } from '@conquerist/shared';
import { AccountError } from '../../identity/accounts.js';
import type { Accounts } from '../../identity/accounts.js';
import type { Users, User } from '../../identity/users.js';
import type { RoomRegistry } from '../../rooms/registry.js';
import { RejectedError } from '../router.js';
import type { MessageRouter, RequestContext } from '../router.js';
import type { SinkHub } from '../sinks.js';

/**
 * Die vier Auth-Handler.
 *
 * Jeder folgt derselben Form: Ablauf in `Accounts` aufrufen, die Sitzung der
 * Verbindung nachziehen, die eine Antwortform zurueckgeben. Eine `AccountError`
 * ist ein normaler Ausgang und wird zur `RejectedError`; alles andere bleibt
 * ein nichtssagendes INTERNAL.
 */
export interface AuthHandlerDeps {
  readonly accounts: Accounts;
  readonly users: Users;
  readonly registry: RoomRegistry;
  readonly sinks: SinkHub;
}

export function registerAuthHandlers(router: MessageRouter, deps: AuthHandlerDeps): void {
  const { accounts, users, registry, sinks } = deps;

  router.register(AUTH_REGISTER, async (payload, context) => {
    const result = await run(() =>
      accounts.register(payload, context.session.userId, context.session.tokenHash),
    );
    return adopt(result, context, sinks);
  });

  router.register(AUTH_LOGIN, async (payload, context) => {
    const open =
      context.session.userId === null ? 0 : registry.roomsOf(context.session.userId).length;

    const result = await run(() =>
      accounts.login(payload, context.session.userId, context.session.tokenHash, open),
    );
    return adopt(result, context, sinks);
  });

  router.register(AUTH_LOGOUT, async (_payload, context) => {
    const result = await run(async () => accounts.logout(context.session.tokenHash));
    return adopt(result, context, sinks);
  });

  router.register(AUTH_ME, (_payload, context) => {
    const user = context.session.userId === null ? undefined : users.byId(context.session.userId);
    if (user === undefined) throw new RejectedError('Erst anmelden - hello fehlt');
    return identityOf(user);
  });
}

async function run<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof AccountError) throw new RejectedError(error.message);
    throw error;
  }
}

/**
 * Die Verbindung uebernimmt die neue Identitaet.
 *
 * Ohne das schriebe die naechste Nachricht noch unter dem alten Nutzer - und
 * genau darin bestand der Wechsel.
 */
function adopt(
  result: { user: User; secret?: string; tokenHash: string },
  context: RequestContext,
  sinks: SinkHub,
): Record<string, unknown> {
  context.session.userId = result.user.id;
  context.session.tokenHash = result.tokenHash;
  sinks.add(result.user.id, context.events);

  const identity = identityOf(result.user);
  return result.secret === undefined ? identity : { ...identity, secret: result.secret };
}

function identityOf(user: User): Record<string, unknown> {
  return {
    userId: user.id,
    name: user.name,
    isGuest: user.isGuest,
    ...(user.login === undefined ? {} : { login: user.login }),
  };
}
```

In `apps/server/src/app.ts` `registerAuthHandlers` neben `registerRoomHandlers` aufrufen und `new Accounts(users, sessions)` durchreichen.

- [ ] **Schritt 7: Alles laufen lassen und gruen sehen**

```bash
pnpm typecheck
pnpm test
```

Erwartet: BESTANDEN.

- [ ] **Schritt 8: Commit**

```bash
git add apps/server/src packages/shared/src
git commit -m "Registrieren, Anmelden, Abmelden im Server - der Gast beansprucht sich selbst"
```

---

### Aufgabe 8: Die Identitaet im Client

**Dateien:**

- Aendern: `apps/client/src/game/useOnlineGame.ts`
- Test: `apps/client/src/game/useOnlineGame.test.ts` (falls nicht vorhanden: anlegen)

**Schnittstellen:**

- Produziert: `useOnlineGame(...)` gibt zusaetzlich `identity: { userId: string; name: string; isGuest: boolean; login?: string } | null` und `register(input)`, `login(input)`, `logout()` heraus.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Am Muster der bestehenden Client-Tests (`apps/client/src/game/*.test.ts`) einen Test anlegen, der einen Transport-Doppelgaenger benutzt:

```ts
it('merkt sich die Identitaet aus hello und gibt sie heraus', async () => {
  // Transport-Attrappe antwortet auf HELLO mit einem Gast.
  const { result } = renderOnlineGame({
    [HELLO]: { userId: 'u1', name: 'Gast', isGuest: true },
  });

  await waitFor(() => expect(result.current.identity?.isGuest).toBe(true));
});

it('legt das neue Geheimnis nach dem Anmelden ab', async () => {
  const { result, sent } = renderOnlineGame({
    [HELLO]: { userId: 'u1', name: 'Gast', isGuest: true },
    [AUTH_LOGIN]: { userId: 'u2', name: 'Anna', isGuest: false, login: 'anna', secret: 'neu' },
  });

  await act(async () => {
    await result.current.login({ login: 'anna', password: 'langgenug1' });
  });

  expect(loadSecret()).toBe('neu');
  expect(result.current.identity?.login).toBe('anna');
  expect(sent).toContainEqual([AUTH_LOGIN, { login: 'anna', password: 'langgenug1' }]);
});
```

`renderOnlineGame` ist der bereits vorhandene Aufbau der Nachbardateien; wenn es ihn nicht gibt, dem Muster von `useOnlineGame`s bestehenden Tests folgen (`grep -rn "useOnlineGame" apps/client/src --include=*.test.*`).

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/client exec vitest run src/game/useOnlineGame.test.ts`
Erwartet: FEHLSCHLAG — `identity` gibt es nicht.

- [ ] **Schritt 3: `useOnlineGame` erweitern**

Neben `userId` einen Zustand `identity` fuehren und beim `hello` mitsetzen:

```ts
const [identity, setIdentity] = useState<Identity | null>(null);

// ... im hello-Effect, direkt nach `setUserId(hello.userId)`:
setIdentity({
  userId: hello.userId,
  name: hello.name,
  isGuest: hello.isGuest,
  ...(hello.login === undefined ? {} : { login: hello.login }),
});
```

Und die drei Aktionen:

```ts
/**
 * Konto anlegen, anmelden, abmelden.
 *
 * Alle drei enden gleich: kommt ein Geheimnis zurueck, ist es ein neues Geraet
 * bzw. eine neue Person - dann ablegen. Die Identitaet kommt in jedem Fall vom
 * Server; der Client leitet sie sich nirgends selbst ab.
 */
const adopt = useCallback((answer: AuthResponse): void => {
  if (answer.secret !== undefined) storeSecret(answer.secret);
  setUserId(answer.userId);
  setIdentity({
    userId: answer.userId,
    name: answer.name,
    isGuest: answer.isGuest,
    ...(answer.login === undefined ? {} : { login: answer.login }),
  });
}, []);

const register = useCallback(
  async (input: RegisterInput): Promise<void> => {
    adopt(await send(AUTH_REGISTER, input));
    await refreshMyRooms();
  },
  [adopt, send, refreshMyRooms],
);

const login = useCallback(
  async (input: LoginInput): Promise<void> => {
    adopt(await send(AUTH_LOGIN, input));
    // Die Liste gehoert jetzt jemand anderem.
    await refreshMyRooms();
  },
  [adopt, send, refreshMyRooms],
);

const logout = useCallback(async (): Promise<void> => {
  adopt(await send(AUTH_LOGOUT, {}));
  await refreshMyRooms();
}, [adopt, send, refreshMyRooms]);
```

`identity`, `register`, `login`, `logout` in das Rueckgabeobjekt aufnehmen.

- [ ] **Schritt 4: Test laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/client exec vitest run src/game/useOnlineGame.test.ts`
Erwartet: BESTANDEN.

- [ ] **Schritt 5: Commit**

```bash
pnpm typecheck
git add apps/client/src/game
git commit -m "Der Client fuehrt seine Identitaet mit und kann sie wechseln"
```

---

### Aufgabe 9: Die Ecke oben rechts

**Dateien:**

- Anlegen: `apps/client/src/screens/AccountCorner.tsx`, `apps/client/src/screens/AccountCorner.test.tsx`
- Aendern: `apps/client/src/index.css`

**Schnittstellen:**

- Produziert: `AccountCorner({ identity, onRegister, onLogin, onLogout })` — `identity: Identity | null`, die drei Rueckrufe ohne Argumente.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test/dom';
import { AccountCorner } from './AccountCorner';

const gast = { userId: 'u1', name: 'Gast', isGuest: true };
const konto = { userId: 'u2', name: 'Anna', isGuest: false, login: 'anna' };

describe('Konto-Ecke', () => {
  it('bietet dem Gast beide Wege an', () => {
    render(
      <AccountCorner identity={gast} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Konto anlegen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
  });

  it('zeigt dem Angemeldeten seinen Namen und nur das Abmelden', () => {
    render(
      <AccountCorner identity={konto} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByText('Anna')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Anmelden' })).toBeNull();
  });

  it('haelt sich zurueck, solange niemand feststeht', () => {
    // Vor dem ersten `hello` waere jede Aussage geraten - und ein „Gast", der
    // eine Sekunde spaeter zu „Anna" wird, ist ein Flackern.
    const { container } = render(
      <AccountCorner identity={null} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(container.querySelector('.corner')).toBeNull();
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/client exec vitest run src/screens/AccountCorner.test.tsx`
Erwartet: FEHLSCHLAG — Modul nicht gefunden.

- [ ] **Schritt 3: `AccountCorner.tsx` schreiben**

```tsx
import type { CSSProperties, JSX } from 'react';
import type { Identity } from '../game/useOnlineGame';

/**
 * Wer gerade spielt - oben rechts auf dem Menue.
 *
 * **Rolle:** eine Zustandsanzeige, kein vierter Weg in eine Partie. Deshalb
 * die Sprache der Kleinlabels (klein, gesperrt, gedaempft) und nicht die der
 * drei Eintraege darunter. Boldness wird an einer Stelle ausgegeben, und das
 * ist die Wortmarke (Regel 4).
 *
 * **Solange niemand feststeht, steht hier nichts.** Ein „Gast", der eine
 * Sekunde spaeter zu „Anna" wird, ist ein Flackern - und ein Layout, das
 * dabei springt, faellt unter Regel 7.
 */
export interface AccountCornerProps {
  readonly identity: Identity | null;
  readonly onRegister: () => void;
  readonly onLogin: () => void;
  readonly onLogout: () => void;
  /** Der Platz in der Eingangsreihe. Die Ecke faellt zuletzt ein. */
  readonly order?: number;
}

export function AccountCorner({
  identity,
  onRegister,
  onLogin,
  onLogout,
  order = 4,
}: AccountCornerProps): JSX.Element | null {
  if (identity === null) return null;

  return (
    <div className="corner" style={{ '--i': order } as CSSProperties}>
      <span className="corner__who">{identity.isGuest ? 'Gast' : identity.name}</span>

      {identity.isGuest ? (
        <>
          <button type="button" className="corner__action" onClick={onRegister}>
            Konto anlegen
          </button>
          <button type="button" className="corner__action" onClick={onLogin}>
            Anmelden
          </button>
        </>
      ) : (
        <button type="button" className="corner__action" onClick={onLogout}>
          Abmelden
        </button>
      )}
    </div>
  );
}
```

- [ ] **Schritt 4: Das CSS ergaenzen**

In `apps/client/src/index.css` nach dem `.menu__entry`-Block:

```css
/*
 * Die Konto-Ecke.
 *
 * Der Menuebildschirm hatte bisher keine Randzone - alles sass mittig auf dem
 * Hexfeld. Diese fuehrt eine ein, und zwar so leise wie moeglich: Kleinlabel-
 * Setzung, gedaempfte Farbe, keine Flaeche.
 *
 * `.menu__inner` bekommt dafuer oben so viel Luft, wie die Ecke hoch ist. Ohne
 * das laeuft die Wortmarke im schmalen Fenster darunter hindurch - und ein
 * Layout, in dem sich zwei Dinge ueberlagern, ist keins (Regel 7).
 */
.corner {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  display: flex;
  gap: 0.9rem;
  align-items: baseline;
  padding: 1.1rem 1.4rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  animation: menu-drop 300ms cubic-bezier(0.2, 0.8, 0.25, 1) backwards;
  animation-delay: calc(320ms + var(--i, 4) * 65ms);
}

.corner__who {
  color: var(--on-sea-muted);
}

.corner__action {
  padding: 0;
  border: 0;
  border-bottom: 1px solid rgb(233 225 207 / 30%);
  background: none;
  color: var(--on-sea);
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  transition: border-color 140ms ease;
}

.corner__action:hover {
  border-bottom-color: var(--on-sea);
}

.menu__inner {
  padding-top: 4rem;
}
```

Den bestehenden `.menu__inner`-Block um `padding-top` ergaenzen, statt einen zweiten Block anzulegen.

- [ ] **Schritt 5: Test laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/client exec vitest run src/screens/AccountCorner.test.tsx`
Erwartet: BESTANDEN.

- [ ] **Schritt 6: Commit**

```bash
pnpm typecheck
git add apps/client/src/screens/AccountCorner.tsx apps/client/src/screens/AccountCorner.test.tsx apps/client/src/index.css
git commit -m "Die Konto-Ecke: wer spielt, steht oben rechts"
```

---

### Aufgabe 10: Der Dialog

**Dateien:**

- Anlegen: `apps/client/src/dialogs/AccountDialog.tsx`
- Test: `apps/client/src/dialogs/dialogs.test.tsx` (erweitern)

**Schnittstellen:**

- Produziert: `AccountDialog({ mode, openGuestGames, problem, onSubmit, onClose })` mit `mode: 'register' | 'login'`, `onSubmit: (input: { login: string; password: string; email?: string; confirmAbandonGuest?: boolean }) => void`.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

An `dialogs.test.tsx` anhaengen:

```tsx
describe('Konto-Dialog', () => {
  it('fragt beim Anlegen zusaetzlich nach der freiwilligen E-Mail', () => {
    render(
      <AccountDialog
        mode="register"
        openGuestGames={0}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/E-Mail/)).toBeTruthy();
  });

  it('fragt beim Anmelden nicht nach der E-Mail', () => {
    render(
      <AccountDialog
        mode="login"
        openGuestGames={0}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/E-Mail/)).toBeNull();
  });

  it('warnt vor dem Anmelden, wenn als Gast noch Partien offen sind', () => {
    render(
      <AccountDialog
        mode="login"
        openGuestGames={2}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 offene Partien/)).toBeTruthy();
  });

  it('schickt die Bestaetigung mit, wenn gewarnt wurde', () => {
    const onSubmit = vi.fn();
    render(
      <AccountDialog
        mode="login"
        openGuestGames={2}
        problem={null}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Benutzername/), { target: { value: 'anna' } });
    fireEvent.change(screen.getByLabelText(/Passwort/), { target: { value: 'langgenug1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem anmelden' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ login: 'anna', confirmAbandonGuest: true }),
    );
  });

  it('zeigt die Absage des Servers, statt sie zu verschlucken', () => {
    render(
      <AccountDialog
        mode="register"
        openGuestGames={0}
        problem="Dieser Benutzername ist vergeben."
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Dieser Benutzername ist vergeben.')).toBeTruthy();
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/client exec vitest run src/dialogs/dialogs.test.tsx`
Erwartet: FEHLSCHLAG — Modul nicht gefunden.

- [ ] **Schritt 3: `AccountDialog.tsx` schreiben**

```tsx
import { useState, type FormEvent, type JSX } from 'react';
import { MIN_PASSWORD_LENGTH } from '@conquerist/shared';

/**
 * Konto anlegen oder anmelden - ein Dialog, zwei Modi.
 *
 * Zwei getrennte Dialoge waeren derselbe Aufbau zweimal, und wer im falschen
 * landet, muesste zurueck. Der Unterschied sind genau zwei Dinge: die
 * freiwillige E-Mail und die Beschriftung.
 */
export interface AccountDialogProps {
  readonly mode: 'register' | 'login';
  /** Wie viele Partien der Gast verliert. 0 heisst: keine Warnung. */
  readonly openGuestGames: number;
  /** Die Absage des Servers, falls es eine gab. */
  readonly problem: string | null;
  readonly onSubmit: (input: {
    login: string;
    password: string;
    email?: string;
    confirmAbandonGuest?: boolean;
  }) => void;
  readonly onClose: () => void;
}

export function AccountDialog({
  mode,
  openGuestGames,
  problem,
  onSubmit,
  onClose,
}: AccountDialogProps): JSX.Element {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const registering = mode === 'register';
  const warned = !registering && openGuestGames > 0;
  const title = registering ? 'Konto anlegen' : 'Anmelden';

  function submit(event: FormEvent): void {
    event.preventDefault();
    onSubmit({
      login,
      password,
      ...(registering && email !== '' ? { email } : {}),
      ...(warned ? { confirmAbandonGuest: true } : {}),
    });
  }

  return (
    <div className="modal" role="dialog" aria-label={title}>
      <form className="modal__box" onSubmit={submit}>
        <h2>{title}</h2>

        {warned ? (
          <p className="modal__hint modal__hint--warn">
            Du hast {openGuestGames} offene Partien als Gast. Wenn du dich anmeldest, kommst du
            ueber dieses Geraet nicht mehr an sie heran.
          </p>
        ) : null}

        <label className="field">
          <span>Benutzername</span>
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span>Passwort</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </label>

        {registering ? (
          <label className="field">
            <span>E-Mail (freiwillig)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
            {/*
             * Ehrlich beschriftet: die Adresse tut heute nichts. Ein Feld, das
             * so aussieht, als schicke es Post, waere ein Versprechen.
             */}
            <small className="field__note">
              Tut heute noch nichts. Sie liegt fuer eine spaetere Passwort-Wiederherstellung.
            </small>
          </label>
        ) : null}

        {problem === null ? null : <p className="modal__problem">{problem}</p>}

        <button type="submit" className="button">
          {warned ? 'Trotzdem anmelden' : title}
        </button>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Abbrechen
        </button>
      </form>
    </div>
  );
}
```

Falls `.field`, `.field__note`, `.modal__hint--warn` oder `.modal__problem` in `index.css` fehlen, dort nach dem Muster der bestehenden `.modal`-Regeln ergaenzen — **keine Hex-Werte**, nur die vorhandenen Variablen.

- [ ] **Schritt 4: Test laufen lassen und gruen sehen**

Ausfuehren: `pnpm --filter @conquerist/client exec vitest run src/dialogs/dialogs.test.tsx`
Erwartet: BESTANDEN.

- [ ] **Schritt 5: Commit**

```bash
pnpm typecheck
git add apps/client/src/dialogs apps/client/src/index.css
git commit -m "Ein Dialog fuer beide Wege ins Konto, mit ehrlicher E-Mail-Beschriftung"
```

---

### Aufgabe 11: Verdrahten, im Browser ansehen, Standsdatei

**Dateien:**

- Aendern: `apps/client/src/App.tsx`, `apps/client/src/screens/MenuScreen.tsx`, `apps/client/src/screens/StartScreen.tsx`, `apps/client/src/screens/MenuScreen.test.tsx`, `PROGRESS.md`, `CLAUDE.md`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

In `MenuScreen.test.tsx`:

```tsx
it('zeigt die Konto-Ecke ueber den drei Wegen', () => {
  render(
    <MenuScreen
      openGames={0}
      onChoose={vi.fn()}
      identity={{ userId: 'u1', name: 'Gast', isGuest: true }}
      onRegister={vi.fn()}
      onLogin={vi.fn()}
      onLogout={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
});

it('laesst die Ecke zuletzt einfallen - nach den drei Wegen', () => {
  const { container } = render(
    <MenuScreen
      openGames={0}
      onChoose={vi.fn()}
      identity={{ userId: 'u1', name: 'Gast', isGuest: true }}
      onRegister={vi.fn()}
      onLogin={vi.fn()}
      onLogout={vi.fn()}
    />,
  );

  const corner = container.querySelector('.corner') as HTMLElement;
  const last = [...container.querySelectorAll('.menu__entry')].at(-1) as HTMLElement;

  expect(Number(corner.style.getPropertyValue('--i'))).toBeGreaterThan(
    Number(last.style.getPropertyValue('--i')),
  );
});
```

- [ ] **Schritt 2: Den Test laufen lassen und scheitern sehen**

Ausfuehren: `pnpm --filter @conquerist/client exec vitest run src/screens/MenuScreen.test.tsx`
Erwartet: FEHLSCHLAG — `MenuScreen` kennt die neuen Eigenschaften nicht.

- [ ] **Schritt 3: Verdrahten**

`MenuScreen` bekommt `identity`, `onRegister`, `onLogin`, `onLogout` und rendert `<AccountCorner … order={resumeShown ? 4 : 3} />` innerhalb von `.menu`, **vor** `.menu__inner`.

`App.tsx` haelt den Dialogzustand:

```tsx
const [account, setAccount] = useState<'register' | 'login' | null>(null);
const [accountProblem, setAccountProblem] = useState<string | null>(null);
```

und reicht `online.identity`, `online.register`, `online.login`, `online.logout` durch. Beim Absenden die Absage auffangen und in `accountProblem` legen — der Dialog bleibt dabei offen, sonst ist die Meldung weg, bevor man sie liest.

`StartScreen` bekommt dieselbe Ecke, ohne Eingangsanimation (`order` entfaellt dort; das CSS greift nur unter `.menu`).

- [ ] **Schritt 4: Alles laufen lassen und gruen sehen**

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

- [ ] **Schritt 5: Im Browser ansehen**

`pnpm dev`, dann `http://localhost:5173/` (**nicht** `127.0.0.1` — Vite bindet auf `localhost`/IPv6).

Durchspielen und wirklich hinsehen:

1. Als Gast eine Partie erstellen, dann **Konto anlegen** — die Partie muss unter „Weiterspielen" stehen bleiben.
2. Abmelden, dann **Anmelden** — die Partie ist wieder da.
3. Ein zweites Fenster (privates Fenster) mit demselben Konto anmelden; **beide** Fenster muessen angemeldet bleiben.
4. Im schmalen Fenster (Handy-Breite) pruefen, dass die Ecke die Wortmarke nicht beruehrt.
5. Einmal neu laden und die Eingangschoreografie ansehen: faellt die Ecke zuletzt?

- [ ] **Schritt 6: `PROGRESS.md` und `CLAUDE.md` fortschreiben**

`PROGRESS.md` in der ueblichen Form: Ueberschrift und Stand, Abnahme als Tabelle mit **gemessenen** Zahlen, getroffene Entscheidungen je Absatz mit Grund, Abweichungen, offene Punkte, naechste Etappe. Die offenen Punkte aus der Spec uebernehmen (kein Passwort-vergessen, kein Rate-Limit, Sitzungen laufen nicht ab, keine Kontoloeschung, E-Mail tut nichts).

`CLAUDE.md`: Etappe 7 im Etappenplan auf ✅, den Abschnitt „Aktueller Stand" um `sessions` und die Migrationsliste ergaenzen, und in die Fallenliste aufnehmen:

- **Ein einmal veroeffentlichter Migrationsschritt wird nie wieder angefasst.** Er beschreibt den Stand, den es einmal gab. Wer ihn aendert, gibt Bestands- und Neudatenbanken verschiedene Schemata.

- [ ] **Schritt 7: Commit**

```bash
git add -A
git commit -m "Etappe 7 abgenommen: Konten, Sitzungen, der Gast beansprucht sich selbst"
```

---

## Selbstpruefung des Plans

**Abdeckung der Spec** — jede Anforderung hat eine Aufgabe:

| Spec                                                         | Aufgabe                  |
| ------------------------------------------------------------ | ------------------------ |
| `sessions`-Tabelle, `users`-Spalten                          | 2                        |
| `PRAGMA user_version`, Schritt 0 eingefroren                 | 1, 2, 11                 |
| Migration rettet Geheimnisse und Sitze                       | 2                        |
| scrypt mit Parametern im Hash                                | 3                        |
| Zweites Geraet, Abmelden trifft eins                         | 4, 7                     |
| Vier Nachrichten, eine Antwortform                           | 6                        |
| `hello.ok` erweitert                                         | 6                        |
| Gast beansprucht sich selbst                                 | 7                        |
| Warnung bei offenen Gast-Partien                             | 7 (Riegel), 10 (Anzeige) |
| Gleiche Meldung fuer falsches Passwort und unbekannten Login | 7                        |
| Dummy-Hash gegen Zeitverrat                                  | 7                        |
| Ecke oben rechts, faellt zuletzt ein                         | 9, 11                    |
| Ein Dialog, zwei Modi                                        | 10                       |
| E-Mail ehrlich beschriftet                                   | 10                       |
| Ecke nicht waehrend einer Partie                             | 11 (nur Menue und Start) |

**Namen, die ueber Aufgaben hinweg gelten:** `Sessions.issue/userIdOf/hashOf/revoke/countFor` (4) — benutzt in 5, 7. `Users.claim/createAccount/byLogin/byId` (5, 7) — benutzt in 7. `hashPassword/verifyPassword` (3) — benutzt in 7. `AccountError` (7) — benutzt in `handlers/auth.ts`. `Identity` (8) — benutzt in 9, 11. `MIN_PASSWORD_LENGTH` (6) — benutzt in 10.

**Bekannt roter Zwischenstand:** Nach Aufgabe 2 ist `users.test.ts` rot, bis Aufgabe 5 es aufraeumt. Das steht in beiden Aufgaben ausdruecklich dabei, damit niemand daran vorbeirepariert.
