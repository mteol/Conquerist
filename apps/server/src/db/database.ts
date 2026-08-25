import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

/**
 * SQLite-Verbindung samt Schema.
 *
 * `WAL` und `foreign_keys` werden beim Oeffnen gesetzt, nicht irgendwo spaeter:
 * eine Verbindung ohne diese Pragmas verhaelt sich anders, und genau solche
 * Unterschiede zwischen Test und Betrieb sind teuer.
 *
 * Das Schema wandert mit dem Code (`migrate`), nicht in eine Datei daneben.
 * Solange es eine Tabelle ist, ist das ehrlicher als ein Migrationswerkzeug.
 */
export type AppDatabase = Database.Database;

/** Der Sonderwert, bei dem nichts auf der Platte landet. */
const IN_MEMORY = ':memory:';

export function openDatabase(file: string): AppDatabase {
  // better-sqlite3 legt den Ordner nicht an und wirft stattdessen „directory
  // does not exist". Der Default liegt unter `data/`, das gitignored ist und
  // auf einem frischen Clone nicht existiert - ohne diese Zeile startet der
  // Server also genau einmal nicht, naemlich beim allerersten Mal.
  if (file !== IN_MEMORY) {
    mkdirSync(dirname(file), { recursive: true });
  }

  const database = new Database(file);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  migrate(database);
  return database;
}

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
const MIGRATIONS: readonly ((database: AppDatabase) => void)[] = [
  stepInitialSchema,
  stepSessionsAndAccounts,
  stepSessionExpiry,
  stepSeatColorAndGoal,
  stepAbandonedRooms,
  stepSeatAway,
  stepRoomVariant,
];

export function migrate(database: AppDatabase): void {
  const [{ user_version: applied }] = database.pragma('user_version') as [{ user_version: number }];

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
    /*
     * Keine ALTER TABLE users DROP COLUMN secret_hash: die Spalte traegt in
     * stepInitialSchema ein UNIQUE-Constraint, und genau das lehnt SQLite bei
     * DROP COLUMN ab ("cannot drop UNIQUE column"). stepInitialSchema ist
     * eingefroren, also bleibt nur der uebliche Weg fuer Aenderungen, die
     * ALTER TABLE nicht kann: Tabelle neu aufbauen, Daten umziehen.
     *
     * Drei Stolpersteine dabei, alle mit echten Daten in rooms/room_seats
     * durchgespielt, bevor diese Reihenfolge stand:
     *
     * 1. PRAGMA foreign_keys laesst sich mitten in der Migrations-Transaktion
     *    nicht umschalten (SQLite ignoriert das schlicht) - defer_foreign_keys
     *    dagegen schon: die Pruefung wandert ans Transaktionsende.
     * 2. ALTER TABLE ... RENAME TO haelt die verschobene Pruefung nicht bei -
     *    obwohl der Endzustand stimmt, meldet COMMIT trotzdem einen Verstoss.
     *    Deshalb hier: direkt unter dem alten Namen neu anlegen, nicht per
     *    Umbenennung dorthin gelangen.
     * 3. sessions erst NACH der neuen users-Tabelle anlegen: sessions.user_id
     *    hat ON DELETE CASCADE, und das feuert bei DROP TABLE users sofort -
     *    nicht erst am Transaktionsende -, und raeumt sonst genau die Zeilen
     *    wieder ab, die eben erst hinuebergerettet wurden.
     */
    PRAGMA defer_foreign_keys = ON;

    /* Zwischenlager fuer beides, was aus der alten users-Zeile ueberlebt. */
    CREATE TABLE users_staging (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      is_guest    INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL,
      secret_hash TEXT NOT NULL
    );
    INSERT INTO users_staging (id, name, is_guest, created_at, secret_hash)
      SELECT id, name, is_guest, created_at, secret_hash FROM users;

    DROP TABLE users;

    CREATE TABLE users (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      is_guest       INTEGER NOT NULL DEFAULT 1,
      created_at     INTEGER NOT NULL,
      login          TEXT,
      password_hash  TEXT,
      email          TEXT
    );
    INSERT INTO users (id, name, is_guest, created_at)
      SELECT id, name, is_guest, created_at FROM users_staging;

    CREATE TABLE sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  INTEGER NOT NULL
    );
    INSERT INTO sessions (token_hash, user_id, created_at)
      SELECT secret_hash, id, created_at FROM users_staging;

    DROP TABLE users_staging;

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
 * die Konstante aendert - und waere damit nicht mehr der Schritt, der einmal
 * veroeffentlicht wurde.
 */
function stepSessionExpiry(database: AppDatabase): void {
  database.exec(`
    ALTER TABLE sessions ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;

    UPDATE sessions SET expires_at = created_at + 5184000000;

    /* Fuer purgeExpired: der einzige Zugriff, der nicht ueber den Schluessel geht. */
    CREATE INDEX sessions_expires ON sessions(expires_at);
  `);
}

/**
 * Etappe 10: die Farbe wird gewaehlt, das Siegpunktziel eingestellt.
 *
 * Beides waren bisher Ableitungen und deshalb keine Spalte: die Farbe folgte
 * aus der Sitzposition, das Ziel stand fest in `CLASSIC_RULES`. Wer sie
 * einstellen kann, muss sie speichern - sonst sitzt nach jedem Serverneustart
 * jeder wieder in der Farbe seines Platzes, und ein Wartebereich mit Ziel 15
 * startet mit 10.
 *
 * Der Bestand bekommt genau das, was vorher galt, und keine Fantasiewerte:
 * `position` ist die Farbe, die diese Zeile bisher bekommen haette, und 10 ist
 * das Ziel, mit dem jede bisherige Partie begonnen hat. Die sechs Farbwerte
 * stehen deshalb als Zeichenkette hier und nicht als Import aus `SEAT_COLORS` -
 * ein Schritt, der eine Konstante liest, aendert sein Ergebnis, sobald jemand
 * die Konstante aendert, und waere dann nicht mehr der Schritt, der einmal
 * veroeffentlicht wurde.
 *
 * Laufende Partien bleiben unberuehrt: ihr Ziel steht im RuleSet des
 * gespeicherten Startzustands, und der wird nie ueberschrieben.
 */
function stepSeatColorAndGoal(database: AppDatabase): void {
  database.exec(`
    ALTER TABLE room_seats ADD COLUMN color TEXT;
    ALTER TABLE rooms ADD COLUMN victory_point_goal INTEGER NOT NULL DEFAULT 10;

    UPDATE room_seats SET color = CASE position
      WHEN 0 THEN '#c0392b'
      WHEN 1 THEN '#2c6fbb'
      WHEN 2 THEN '#e08a2e'
      WHEN 3 THEN '#3f8f5b'
      WHEN 4 THEN '#8e5bb5'
      WHEN 5 THEN '#d8d3c7'
    END;
  `);
}

/**
 * Eine Partie kann abgebrochen werden.
 *
 * Neben `finished_at` und aus demselben Grund eine eigene Spalte: die beiden
 * sind nicht dasselbe Ende. Eine beendete Partie hat einen Sieger, eine
 * abgebrochene keinen - wer sie spaeter zaehlt, will das auseinanderhalten
 * koennen, und ein gemeinsames `ended_at` mit einem Flag daneben waere
 * dieselbe Auskunft in zwei Spalten statt in einer.
 *
 * `NULL` heisst „laeuft noch" und ist damit der Stand jeder bestehenden Zeile -
 * genau das, was vor diesem Schritt galt. Keine Nachbesserung noetig.
 *
 * Die Zeile bleibt nach dem Abbruch stehen, samt Startzustand und Log. Sie
 * wird nur nicht mehr geladen (`loadAll`): abgebrochen heisst, dass dort
 * niemand mehr weiterspielt - nicht, dass es die Partie nie gab.
 */
function stepAbandonedRooms(database: AppDatabase): void {
  database.exec(`
    ALTER TABLE rooms ADD COLUMN abandoned_at INTEGER;

    /* Fuer loadAll: der Filter laeuft ueber jede Zeile beim Serverstart. */
    CREATE INDEX rooms_abandoned ON rooms(abandoned_at);
  `);
}

/**
 * Ein Sitz weiss, ob sein Spieler gegangen ist.
 *
 * `connected` steht nicht in der Datenbank, weil es zu einem Serverlauf gehoert
 * und mit ihm endet - nach einem Neustart ist niemand verbunden, bis er sich
 * meldet. `away` ist das Gegenteil: es ist eine Entscheidung, und eine
 * Entscheidung ueberlebt den Prozess, in dem sie gefallen ist. Stuende sie
 * nicht hier, saesse nach jedem Serverneustart jeder wieder an dem Tisch, den
 * er verlassen hat.
 *
 * `DEFAULT 0` ist genau das, was vorher galt: bis zu diesem Schritt konnte
 * niemand einen Tisch verlassen, ohne den Platz aufzugeben - es gab die Tuer
 * schlicht nicht. Der Bestand bekommt also keinen Fantasiewert, sondern seinen
 * eigenen.
 */
function stepSeatAway(database: AppDatabase): void {
  database.exec(`
    ALTER TABLE room_seats ADD COLUMN away INTEGER NOT NULL DEFAULT 0;
  `);
}

/**
 * Etappe 10a: nach welchem Regelwerk ein Raum spielt.
 *
 * `DEFAULT 'classic'` ist genau das, was vorher galt - bis zu diesem Schritt
 * gab es nur das Basisspiel. Der Bestand bekommt also keinen Fantasiewert,
 * sondern seinen eigenen.
 */
function stepRoomVariant(database: AppDatabase): void {
  database.exec(`
    ALTER TABLE rooms ADD COLUMN variant TEXT NOT NULL DEFAULT 'classic';
  `);
}
