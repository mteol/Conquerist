# Etappe 9 — Docker und Coolify — Entwurf

Stand: 2026-08-13, Branch `etappe-9-deployment`, aufsetzend auf `8d96ce4`
(`etappe-4-online`).

## Das Problem

Das Spiel ist fertig genug, um gespielt zu werden, und laeuft ausschliesslich
auf einem Entwicklerrechner. Wer mitspielen will, braucht einen Tunnel und
jemanden, der `pnpm dev` nicht schliesst.

Mit der oeffentlichen Erreichbarkeit werden zugleich zwei Punkte faellig, die
Etappe 7 ausdruecklich fuer diese Etappe vorgemerkt hat (`PROGRESS.md`,
„Offene Punkte" zu Etappe 7): **kein Rate-Limit auf `auth.login`** und
**Sitzungen laufen nie ab**. Beides war risikolos, solange nur das eigene LAN
den Server sah. Ab dem ersten Deployment ist es das nicht mehr.

## Das Ziel

1. Ein Image, gebaut von Coolify aus dem GitHub-Repository, das Server und
   Client zusammen traegt.
2. Die Partien ueberleben ein Redeploy — die SQLite-Datei liegt auf einem
   Volume, nicht im Container.
3. Sitzungen laufen ab, gleitend: jede Verwendung verlaengert die Frist.
4. `auth.login` bekommt ein Rate-Limit je Login-Name.
5. Am Ende laeuft das Spiel unter der Domain des Nutzers, per HTTPS und WSS,
   und ist dort im Browser durchgespielt.

**Nicht dabei:** Registry und CI-Build (das waere der Schritt danach), mehrere
Instanzen, Backups der Datenbank, Kontoloeschung, Passwort-vergessen, ein
IP-basiertes Limit, eine Zugzeit, die Uebernahme der lokalen `data/`-Datenbank
auf den Server.

## Was der Bestand schon mitbringt

Vier Dinge, die nicht gebaut werden muessen — der Grund, warum diese Etappe
klein ist:

- **`GET /health`** steht bereits (`apps/server/src/app.ts`) und antwortet mit
  Status und Laufzeit.
- **Der Server liefert den Client mit aus** (`apps/server/src/static.ts`),
  samt Rueckfall auf `index.html` fuer Reloads auf `/?raum=K7X2`.
- **Die Konfiguration kommt vollstaendig aus Umgebungsvariablen** und wird
  beim Start per Zod geprueft (`apps/server/src/config.ts`); ein falscher Wert
  beendet den Prozess mit einer lesbaren Meldung statt spaeter als `NaN`.
- **Ein `SIGTERM` faehrt sauber herunter** (`server.ts`): Wecker abraeumen,
  Verbindungen schliessen, App schliessen.

## Entscheidungen, die vorab gefallen sind

**Ein Container, kein zweiter fuer den Client.** Die verbreitete Aufteilung
(nginx fuer die statischen Dateien, Node fuer die API) zerlegt genau das, was
dieses Projekt zusammenhaelt: `isAllowedOrigin` erlaubt den WebSocket-Upgrade,
wenn Seite und Server denselben Ursprung haben — und deshalb funktioniert jede
Adresse ohne gepflegte Liste (`apps/server/src/ws/origin.ts`). Zwei Container
heissen zwei Urspruenge, also wieder eine `CLIENT_ORIGIN`-Liste mit der Domain
darin, die vor jeder Aenderung angefasst werden muss.

**In Produktion wird `CLIENT_ORIGIN` nicht gesetzt.** `isAllowedOrigin`
vergleicht `new URL(origin).host === host` (`ws/origin.ts:26`), also **Host und
Port, nicht das Schema**. Hinter der TLS-Terminierung sendet der Browser
`https://…`, der Server sieht intern `http` — und der Vergleich stimmt
trotzdem, solange der Proxy den urspruenglichen `Host` durchreicht (Traefik
tut das per Default). Die Domain taucht damit nirgends im Code und in keiner
Variablen auf. Nachgeprueft, nicht vermutet.

**Debian-slim als Basis, nicht Alpine.** `better-sqlite3` ist ein natives
Modul und wird gegen glibc vorgebaut ausgeliefert. Auf musl gaebe es keine
passende Binary; jeder Build uebersetzte sie neu oder scheiterte an einer
fehlenden Toolchain.

**Node 24.** Dieselbe Hauptversion wie auf dem Entwicklungsrechner (v24.15.0).
Ein Container, der eine andere faehrt als die Entwicklung, ist eine
Fehlerquelle ohne Gegenwert; `engines` verlangt ohnehin nur `>=22`.

**Gebaut wird auf dem Server, nicht in einer CI.** Coolify zieht aus GitHub und
baut selbst; der Host hat 16 GB, das reicht fuer `pnpm install` samt nativem
Modul und Vite-Build. Der Weg ueber eine Registry (GitHub Actions baut, Coolify
zieht) waere schneller im Deployment und traeger im Aufbau — er kommt in Frage,
wenn der Build auf dem Server stoert, nicht vorher.

**Ein Docker-Volume, kein Bind Mount.** Das Image legt `/data` an und
uebereignet es dem Benutzer `node`. Ein frisch angelegtes Volume erbt diese
Rechte beim ersten Einhaengen; ein Bind Mount auf ein Host-Verzeichnis nicht —
dort gehoert der Ordner root, und der Server stirbt mit
`unable to open database file`, waehrend im Image alles richtig aussieht.

**Die Sitzungsfrist ist gleitend, nicht absolut.** `sessions` traegt seit
Etappe 7 nicht nur Anmeldungen, sondern auch **Gast-Identitaeten**:
`users.hello(secret)` schlaegt das Geheimnis dort nach (`identity/users.ts:64`).
Eine absolute Frist wuerde deshalb nicht „bitte neu anmelden" bedeuten, sondern
einem Gast mitten im Betrieb seine Identitaet und damit seine Partien nehmen.
Gleitend heisst: 60 Tage Untaetigkeit, jede Verwendung setzt neu an. Wer
regelmaessig spielt, merkt nie etwas.

**Die Drossel braucht kein zweites Feld.** Ein `last_used_at` neben
`expires_at` waere die naheliegende Loesung und ist ueberfluessig: aus
`expires_at` selbst folgt, wie lange die letzte Verwendung her ist. Verlaengert
wird nur, wenn `expires_at` mehr als einen Tag von seinem Hoechstwert entfernt
ist — also hoechstens ein `UPDATE` je Sitzung und Tag, statt eines je
Nachricht.

**Der Client muss dafuer nicht angefasst werden.** Ein abgelaufenes Geheimnis
laesst `hello` werfen (`users.ts:65`), und genau diesen Fall behandelt
`useOnlineGame.ts:212-219` bereits: Geheimnis vergessen, ohne Geheimnis neu
gruessen. Ein abgelaufener Gast wird also wieder ein neuer Gast, statt vor
einer Fehlermeldung zu stehen. Der Kommentar in `net/session.ts` nennt als
Anlass „nach einem Datenbankwechsel etwa" — der Ablauf ist derselbe Fall.

**Die Migration wird angehaengt, nicht geaendert.** Hausregel aus `CLAUDE.md`:
ein veroeffentlichter Schritt beschreibt den Stand, den es einmal gab. Also ein
dritter Eintrag in `MIGRATIONS`, waehrend `stepInitialSchema` und
`stepSessionsAndAccounts` unberuehrt bleiben.

**Das Rate-Limit zaehlt jeden versuchten Login-Namen, auch unbekannte.** Die
sparsamere Variante waere, nur bestehende Konten zu zaehlen — dann ist die
Tabelle durch die Zahl der Konten begrenzt. Sie faellt trotzdem aus:
`Accounts.login` prueft heute bewusst gegen einen `DUMMY_HASH`, wenn es das
Konto nicht gibt, damit die Antwortzeit nicht verraet, welcher Name existiert.
Ein Zaehler nur fuer bekannte Namen brauechte diesen Aufwand wieder auf, weil
ab dem elften Versuch zwei verschiedene Antworten kaemen. Stattdessen zaehlt
jeder Name, und die Tabelle bekommt eine Obergrenze (siehe unten).

**Die Uhr wird hineingereicht, nicht gelesen.** Sowohl `Sessions` als auch die
Drossel bekommen ihr `now` als Konstruktorargument mit `Date.now` als Default.
Das ist dieselbe Bewegung wie bei der Handelsfrist in Etappe 8 (`stampAction`)
und der Grund, warum die Tests keine Wartezeit brauchen.

**Der Ablehnungssatz ist fuer Menschen.** „Zu viele Fehlversuche. Bitte in 12
Minuten erneut versuchen." — kein Code, keine englische Konstante. Die Lehre
aus dem Etappe-8-Nachtrag (`ServerError` klebte `REJECTED:` vor die Meldung)
gilt fuer jeden neuen Text.

## Die Teile

### 1. `Dockerfile` (Repository-Wurzel) und `.dockerignore`

Zwei Stufen.

**Bau-Stufe** auf `node:24-bookworm-slim`: Corepack aktivieren, **zuerst nur
Manifeste und Lockfile** kopieren (`package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, `.npmrc` und die drei Paket-Manifeste), dann
`pnpm install --frozen-lockfile`, dann die Quellen, dann `pnpm build`. Die
Reihenfolge ist der Cache: eine Codeaenderung wirft den Abhaengigkeits-Layer
nicht weg. `pnpm build` laeuft per Topologie in der richtigen Folge
(shared → Client → Server); `.npmrc` muss mit, sonst fehlt die Freigabe fuer
die Build-Skripte von `better-sqlite3` und `esbuild`.

**Laufzeit-Stufe** auf demselben Image: nur Produktionsabhaengigkeiten und die
fertigen `dist`-Ordner.

- **Die Anordnung bleibt erhalten.** `static.ts` sucht den Client ueber
  `resolve(here, '../../client/dist')`, relativ zum Server-`dist`. Im Image
  muss `apps/server/dist` also neben `apps/client/dist` liegen. Wer flach
  kopiert, bekommt keinen Fehler, sondern einen Server, der still „nur die
  API" ausliefert und es einmal ins Log schreibt.
- **Das Ausduennen ist der unsichere Schritt.** Geplant ist
  `pnpm deploy --filter @conquerist/server --prod`, was `@conquerist/shared`
  mitsamt `dist` mitnimmt. Bei pnpm 11 hat der Befehl Bedingungen (`--legacy`
  bzw. `inject-workspace-packages`), und die native Binary von
  `better-sqlite3` muss den Umzug ueberstehen. Der Plan prueft das durch einen
  echten Lauf; der Rueckfall ist ein schlichter Produktions-Install im
  Laufzeit-Layer, mit den ohnehin kopierten Manifesten.
- `HEALTHCHECK` gegen `/health` per `node -e` mit `fetch` — das slim-Image hat
  weder `curl` noch `wget`.
- Start in **Exec-Form**, damit Node PID 1 ist und `SIGTERM` beim vorhandenen
  Shutdown-Handler ankommt. Kein `tini`: der Prozess startet keine Kinder, es
  gibt nichts einzusammeln.
- `USER node`, und `/data` gehoert ihm.
- **`.dockerignore`** mit `node_modules`, `dist`, `data`, `.git`,
  `.superpowers`. Ohne die Zeile `data` wandert die lokale Datenbank samt
  ihrer Raeume in den Build-Kontext.

### 2. Coolify

Anwendung: Build Pack **Dockerfile**, Branch **`main`** (nach dem Merge; zum
Entwickeln zeigt sie voruebergehend auf `etappe-9-deployment`), Base Directory
`/`, Port **8080**, „Is it a static site?" aus.

| Variable        | Wert                  | Warum                                        |
| --------------- | --------------------- | -------------------------------------------- |
| `NODE_ENV`      | `production`          | Log-Level `info` statt `debug`               |
| `HOST`          | `0.0.0.0`             | Default ist `127.0.0.1` — sonst unerreichbar |
| `PORT`          | `8080`                | derselbe Wert wie im Port-Feld               |
| `DATABASE_FILE` | `/data/conquerist.db` | zeigt auf das Volume                         |

`CLIENT_ORIGIN` bleibt ungesetzt (siehe Entscheidungen). Persistent Storage:
ein **Volume** auf `/data`.

Dazu eine kurze Anleitung in `README.md` — die Einstellungen sind sonst nur in
einer Weboberflaeche vorhanden, die niemand versioniert.

### 3. `sessions` bekommt eine Frist

**Migrationsschritt 3, `stepSessionExpiry`:**

```sql
ALTER TABLE sessions ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;
UPDATE sessions SET expires_at = created_at + 5184000000;   -- 60 Tage
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
```

Bestehende Zeilen bekommen ihre Frist aus `created_at`, nicht aus „jetzt": der
Schritt bleibt damit ohne Uhr und liefert auf jedem Bestand dasselbe Ergebnis.
Die Folge ist beabsichtigt — eine Sitzung, die vor mehr als 60 Tagen angelegt
und seither nicht benutzt wurde, ist nach der Migration abgelaufen.

**`Sessions` (`identity/sessions.ts`):**

- Konstruktor nimmt `{ ttlMs = SESSION_TTL_MS, now = Date.now }`.
  `SESSION_TTL_MS` = 60 Tage, `REFRESH_AFTER_MS` = 1 Tag.
- `issue` setzt `expires_at = now + ttlMs`.
- `userIdOf(token)` liest `user_id` **und** `expires_at`:
  - keine Zeile → `undefined` (wie bisher),
  - `expires_at <= now` → Zeile loeschen, `undefined`,
  - sonst: wenn `expires_at - now < ttlMs - REFRESH_AFTER_MS`, auf
    `now + ttlMs` setzen; `user_id` zurueckgeben.
- Neu: `purgeExpired(): number`, in `server.ts` einmal beim Start aufgerufen
  und mit der Anzahl geloggt.

Die Signatur von `userIdOf` bleibt unveraendert, weil die Uhr im Konstruktor
steckt — kein Aufrufer in `users.ts` muss angefasst werden.

### 4. `identity/loginThrottle.ts`

Eine Klasse, kein Fastify-Plugin: gezaehlt wird eine Anmeldung, nicht ein
HTTP-Request, und `auth.login` kommt als WebSocket-Nachricht.

- Konstruktor: `{ maxFailures = 10, windowMs = 15 min, maxEntries = 5000,
now = Date.now }`.
- `check(login): { blocked: false } | { blocked: true, retryAfterMs: number }`
  — abgelaufene Zeitstempel werden beim Nachsehen verworfen.
- `recordFailure(login)`, `recordSuccess(login)` (loescht den Eintrag).
- Speicher: `Map<string, number[]>` mit den Zeitpunkten der Fehlversuche.
  Beim Schreiben werden leere Eintraege entfernt; ueberschreitet die Tabelle
  `maxEntries`, faellt der Eintrag mit dem aeltesten letzten Versuch heraus.
  Das ist die Obergrenze, die das Zaehlen unbekannter Namen bezahlbar macht.
- Im Speicher, nicht in der Datenbank: ein Neustart vergisst die Zaehler. Bei
  einer Instanz ist das vertretbar, und ein Redeploy als Angriffsweg setzt
  voraus, dass der Angreifer ihn ausloesen kann.

**Verdrahtung in `Accounts.login`,** vor dem Passwortvergleich — eine
gesperrte Anmeldung soll nicht erst `scrypt` bezahlen. Ist sie gesperrt, wirft
sie `AccountError` mit dem Wartesatz; der Router macht daraus wie gewohnt eine
`RejectedError`. Fehlversuch (unbekanntes Konto oder falsches Passwort) zaehlt,
Erfolg raeumt den Zaehler ab. `Accounts` bekommt die Drossel als vierte
Abhaengigkeit; `server.ts` erzeugt sie einmal.

## Tests

Neu, alle mit hineingereichter Uhr und ohne Wartezeit:

- **`sessions`**: abgelaufenes Token wird abgewiesen und die Zeile geloescht;
  eine frische Sitzung wird nicht bei jeder Verwendung geschrieben (Drossel);
  nach mehr als einem Tag wird verlaengert; `purgeExpired` zaehlt richtig.
- **Migration**: gegen eine Datenbank mit bestehenden `sessions`-Zeilen —
  `expires_at` ist gefuellt und nicht 0, `user_version` steht auf 3, die
  Schritte 1 und 2 sind unveraendert.
- **`loginThrottle`**: zehn Fehlversuche gehen durch, der elfte wird gesperrt;
  das Fenster wandert; Erfolg setzt zurueck; die Obergrenze wirft den
  aeltesten Eintrag heraus.
- **`Accounts.login`**: gesperrt wirft mit dem Wartesatz **ohne**
  Passwortpruefung; ein erfolgreicher Login danach ist wieder moeglich.
- **`config`**: die Produktionswerte (`HOST=0.0.0.0`,
  `DATABASE_FILE=/data/conquerist.db`) werden angenommen.

Das Dockerfile hat keine Unit-Tests. Es wird gebaut und gestartet — das ist
seine Pruefung.

## Abnahme

Die vier Schritte wie immer, mit gemessenen Zahlen (`pnpm typecheck`,
`pnpm test`, `pnpm build`, `pnpm format:check`).

Dazu der Deployment-Durchlauf. **Auf dem Entwicklungsrechner ist kein Docker
installiert** (geprueft: `docker` ist in keiner Shell im PATH), gebaut wird
also dort, wo es hingehoert: Coolify zeigt zum Entwickeln voruebergehend auf
`etappe-9-deployment`, und jeder Anlauf ist ein Deployment mit Build-Log.

1. Build laeuft durch, Container startet, `/health` antwortet.
2. Die Seite kommt unter der Domain, per HTTPS.
3. **Der WebSocket steht** — das ist der Schritt, an dem sich die
   Origin-Ueberlegung beweist oder widerlegt.
4. Konto anlegen, Partie anlegen, zweiter Browser als Gast, ein Handel ueber
   den Tisch.
5. **Redeploy** — die Partie steht danach noch unter „Weiterspielen". Das ist
   der Beleg fuer das Volume und zugleich fuer den `replay` aus Etappe 6 im
   Betrieb.
6. Zehn falsche Passwoerter hintereinander: der elfte Versuch nennt eine
   Wartezeit, in verstaendlichem Deutsch.

Danach Merge der Kette nach `main` und Umstellen des Branches in Coolify.

## Offene Punkte

- **Eine einzige Instanz.** Raumverzeichnis, Wecker und Drossel liegen im
  Speicher, die Datenbank ist eine Datei. Waagerecht skalieren geht nicht, und
  das ist fuer ein Brettspiel unter Freunden kein Mangel — es sollte nur
  niemand versehentlich zwei Replicas einstellen.
- **Keine Sicherung der Datenbank.** Das Volume ueberlebt Redeploys, nicht den
  Verlust des Servers. Ein `VACUUM INTO` auf einen zweiten Pfad plus
  Abholung waere die kleine Loesung; sie ist nicht Teil dieser Etappe.
- **Ein Angreifer kann ein bekanntes Konto 15 Minuten aussperren**, indem er
  zehnmal falsch raet. Das ist der bewusste Preis des Zaehlens je Name; ein
  IP-Zaehler haette den anderen (hinter dem Proxy trifft er entweder alle oder
  niemanden).
- **Die Zaehler sind nach einem Neustart weg** (siehe oben).
- **Abgelaufene Zeilen werden nur beim Start und beim Anfassen geraeumt.** Ein
  Server, der Monate durchlaeuft, sammelt tote Zeilen; bei dieser Groessen-
  ordnung ist das eine Zeile in einer Tabelle, kein Problem.
- **Die Sourcemaps des Clients werden mit ausgeliefert** (`vite.config.ts`,
  `sourcemap: true`, 1,8 MB). Sie werden nur geladen, wenn jemand die
  Entwicklerwerkzeuge oeffnet. Bleibt so, bewusst.
- **Der `at`-Stempel der Handelsfrist haengt an der Serveruhr.** Laeuft der
  Container mit einer anderen Zeitzone, aendert das nichts (alles ist
  Millisekunden seit Epoche), aber eine springende Uhr auf dem Host wuerde
  Fristen verschieben.
- **Die lokale `data/`-Datenbank bleibt lokal.** Der Server faengt leer an.

## Naechste Etappe

**Etappe 10 — Erweiterungen.** Was aus Etappe 8 offen blieb (Zugzeit, Handel
ausserhalb des Zuges, Gegenangebot auf ein Gegenangebot) und die beiden
Viewport-Breakpoints, die weiterhin ungesehen sind.
