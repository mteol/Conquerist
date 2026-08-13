# Etappe 7 — Auth: Registrierung, Login, Gast beanspruchen — Entwurf

Stand: 2026-08-11, Branch `etappe-4-online`, aufsetzend auf `4a3dd3c`.

## Das Problem

Wer heute spielt, ist ein Gast: eine Zeile in `users` mit `is_guest = 1` und
einem Sitzungsgeheimnis, das gehasht daneben liegt. Das traegt genau so weit
wie der `localStorage` eines Browsers. Wer den Speicher leert, das Geraet
wechselt oder im privaten Fenster sitzt, ist eine andere Person — und seine
Partien sind nicht verloren, aber unerreichbar.

Regel 7 hat diesen Tag vorbereitet: „Registrierung ist spaeter ein UPDATE auf
die bestehende Zeile, kein neuer Datentyp." Diese Etappe loest das ein.

## Das Ziel

1. Ein Gast kann sich **selbst beanspruchen**: aus seiner Zeile wird ein Konto,
   und seine laufenden Partien bleiben daran haengen.
2. Wer ein Konto hat, kann sich auf einem **zweiten Geraet** anmelden, ohne das
   erste hinauszuwerfen.
3. Abmelden trifft **dieses** Geraet, nicht alle.
4. Gastspiel bleibt vollwertig. Niemand muss ein Konto anlegen, um zu spielen.

Nicht dabei: Passwort vergessen (es gibt keinen Mailversand), Bestaetigungsmail,
Kontoloeschung, Namenssperre. Was davon kommt, kommt mit einem konkreten Bedarf.

## Entscheidungen, die vorab gefallen sind

**Angemeldet wird mit Benutzername und Passwort.** Eine E-Mail wird beim
Anlegen freiwillig abgefragt, geprueft (Format, eindeutig) und gespeichert —
und sonst passiert heute nichts damit. Im Dialog steht das ausdruecklich dabei:
sie liegt fuer eine spaetere Passwort-Wiederherstellung, die es noch nicht
gibt. Der Einwand, dass eine ungenutzte Spalte Vorbau im Sinne von Regel 5 ist,
wurde vorgebracht und verworfen; die Entscheidung ist bewusst gefallen und
kein offener Punkt.

**Anmelden wechselt die Identitaet, es fuehrt nichts zusammen.** Wer als Gast
offene Partien hat und sich an einem bestehenden Konto anmeldet, bekommt vorher
eine Warnung mit der Anzahl und kann abbrechen. Bestaetigt er, bleibt die
Gastzeile samt Sitzen unberuehrt stehen — nur ueber dieses Geraet kommt niemand
mehr an sie heran. Der Gegenentwurf (Sitze mituebernehmen) braeuchte eine
Antwort darauf, was gilt, wenn beide Identitaeten im selben Raum sitzen; die
gibt es nicht ohne Willkuer.

**Der Anzeigename bleibt, was er ist.** `users.name` ist weiter frei waehlbar,
nicht eindeutig, jederzeit aenderbar. Der Login ist eine zweite, eigene Spalte.
Wer beide zusammenlegt, kann den Anzeigenamen nicht mehr aendern, ohne die
Anmeldung zu brechen.

## Datenbank

### `users` bekommt drei Spalten, und verliert eine

```
users
  id             TEXT PRIMARY KEY
  name           TEXT NOT NULL          -- Anzeigename, unveraendert
  is_guest       INTEGER NOT NULL
  created_at     INTEGER NOT NULL
  login          TEXT UNIQUE            -- NULL bei Gaesten
  password_hash  TEXT                   -- NULL bei Gaesten
  email          TEXT UNIQUE            -- NULL immer erlaubt
```

`secret_hash` **entfaellt hier** und zieht nach `sessions`.

Ein Gast ist eine Zeile mit `login IS NULL`, ein Konto eine mit `login NOT
NULL`. `is_guest` bleibt als ausdrueckliches Feld erhalten, obwohl es aus
`login` folgt: es steht in Regel 7, der Server liest es an mehreren Stellen,
und ein abgeleiteter Wert, den jeder selbst ableitet, wird irgendwo falsch
abgeleitet. Beim Beanspruchen werden beide zusammen gesetzt.

In SQLite ist `UNIQUE` bei mehreren `NULL` kein Problem — beliebig viele Zeilen
duerfen `login IS NULL` haben. Genau deshalb funktioniert diese Form fuer
Gaeste ohne Sonderfall.

### `sessions` ist neu

```
sessions
  token_hash  TEXT PRIMARY KEY
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  created_at  INTEGER NOT NULL
```

Eine Zeile je angemeldetem Geraet. Der Hash ist der Primaerschluessel: das ist
zugleich der Index, ueber den `hello` sucht, und die Eindeutigkeit, die heute
an `users.secret_hash` haengt. Der Klartext-Token verlaesst den Server genau
einmal, naemlich in der Antwort, die ihn erzeugt.

`ON DELETE CASCADE` heisst: verschwindet ein Nutzer, verschwinden seine
Sitzungen mit. Andersherum nicht — eine geloeschte Sitzung ist ein Abmelden,
kein Kontoverlust.

### Die erste echte Migration

In `db/database.ts` steht heute:

> Das Schema wandert mit dem Code (`migrate`), nicht in eine Datei daneben.
> Solange es eine Tabelle ist, ist das ehrlicher als ein Migrationswerkzeug.

Der Kommentar hat die Bedingung selbst benannt, unter der das aufhoert zu
gelten, und sie ist erreicht: `CREATE TABLE IF NOT EXISTS` kann keine Spalte
umziehen. Also bekommt die Datenbank `PRAGMA user_version` und eine Liste von
Schritten, die stur der Reihe nach laufen.

Schritt 1 (`user_version` 0 → 1), in **einer** Transaktion:

1. `sessions` anlegen.
2. `INSERT INTO sessions (token_hash, user_id, created_at)
SELECT secret_hash, id, created_at FROM users;`
3. `ALTER TABLE users DROP COLUMN secret_hash;`
4. `ALTER TABLE users ADD COLUMN login TEXT;` (dito `password_hash`, `email`)
5. Je einen `CREATE UNIQUE INDEX` auf `login` und `email` — `ALTER TABLE ADD
COLUMN` kann in SQLite kein `UNIQUE` mitbringen, der Index ist der Weg.

Schritt 0 bleibt das heutige `CREATE TABLE IF NOT EXISTS`-Paket, damit eine
leere Datenbank denselben Weg nimmt wie eine bestehende und nicht einen
zweiten, der nur fuer sie gilt. Eine frische Datenbank legt also `secret_hash`
an, um es einen Schritt spaeter wieder fallen zu lassen — umstaendlich
gelesen, aber es gibt nur einen Weg durchs Schema statt zweier, die
auseinanderlaufen koennen.

**Ab jetzt ist Schritt 0 eingefroren.** Er beschreibt den Stand, den es einmal
gab, nicht den, den wir haben wollen. Wer kuenftig eine Spalte braucht, haengt
einen Schritt hinten an. Wer Schritt 0 aendert, aendert die Vergangenheit fuer
alle, die sie schon durchlaufen haben — und deren Datenbanken sehen dann anders
aus als die der Neuzugaenge. Das gehoert als Kommentar in `database.ts`, nicht
nur hierher.

**Das ist kein Trockenlauf.** In `data/` liegen echte Raeume; der Server hat
beim letzten Start fuenf geladen. Ein Gast, dessen Geheimnis die Migration
verliert, verliert damit den Zugang zu seinen Partien. Schritt 2 der Liste ist
deshalb der wichtigste Test dieser Etappe.

## Passwoerter

`scrypt` aus `node:crypto`, asynchron (`scrypt`, nicht `scryptSync` — die
Synchronvariante haelt den Event-Loop fuer alle Verbindungen an). Keine neue
Abhaengigkeit; bei `better-sqlite3` weiss das Projekt, was ein nativer Build
kostet.

Je Passwort ein eigener Zufalls-Salt. Abgelegt wird **ein** String, der seine
Parameter mitbringt:

```
scrypt$<N>$<r>$<p>$<salt-base64>$<hash-base64>
```

Damit lassen sich die Kosten spaeter anheben, ohne die bestehenden Zeilen
unlesbar zu machen: wer sich anmeldet, wird gegen die Parameter geprueft, die
in seiner eigenen Zeile stehen. Verglichen wird mit `timingSafeEqual`.

Mindestlaenge 8 Zeichen, keine Zeichenklassen-Regeln. Eine Regel, die
„mindestens eine Ziffer" verlangt, erzeugt `passwort1` und sonst nichts.

Das Sitzungsgeheimnis bleibt, was es ist: 32 Zufallsbytes, `sha256` in der
Datenbank. Es ist kein Passwort, das jemand tippt — eine KDF waere hier Aufwand
ohne Gegenwert.

## Protokoll

Vier neue Nachrichten neben `hello`:

| Nachricht       | Antwort   | Wozu                                 |
| --------------- | --------- | ------------------------------------ |
| `auth.register` | `auth.ok` | Konto anlegen bzw. Gast beanspruchen |
| `auth.login`    | `auth.ok` | An bestehendem Konto anmelden        |
| `auth.logout`   | `auth.ok` | Diese eine Sitzung beenden           |
| `auth.me`       | `auth.ok` | Wer bin ich gerade                   |

**Eine Antwortform fuer alle vier**, und `hello.ok` bekommt dieselben Felder:

```
AuthResponse = {
  userId: string
  name: string
  isGuest: boolean
  login?: string        // fehlt bei Gaesten
  secret?: string       // nur wenn eine neue Sitzung entstand
}
```

Vier Formen fuer dieselbe Auskunft waeren vier Stellen, an denen sie
auseinanderlaufen kann. `hello.ok` erweitert sich damit vertraeglich — der
heutige Client liest die neuen Felder einfach nicht.

`auth.logout` gibt ebenfalls diese Form zurueck, dann mit der frisch angelegten
**Gast**-Identitaet: wer sich abmeldet, ist nicht niemand, sondern wieder ein
Gast. Ein Client ohne Identitaet haette sonst einen Zustand, den es sonst nie
gibt.

### Anfragen

```
auth.register = { login, password, email? , name? }
auth.login    = { login, password, confirmAbandonGuest?: boolean }
auth.logout   = {}
auth.me       = {}
```

Die `userId` steht **nicht** in den Anfragen. Wer die Verbindung ist, weiss der
Server aus seiner eigenen Sitzung (`context`), so wie bei jeder anderen
Nachricht auch. Eine mitgeschickte Id waere eine Behauptung des Clients ueber
seine Identitaet — genau das, was Regel 3 ausschliesst.

## Ablaeufe

### Konto anlegen

Der Server sieht an seiner Sitzung, wer fragt:

- **Angemeldet als Gast** → `UPDATE users SET login, password_hash, email,
is_guest = 0 WHERE id = <Gast>`. Die Sitzung bleibt dieselbe, die Sitze
  bleiben dran, es entsteht kein neues Geheimnis. Das ist das Beanspruchen.
- **Keine Sitzung** (frischer Browser) → `INSERT` einer neuen Zeile mit
  `is_guest = 0`, dazu eine neue Sitzung.
- **Bereits angemeldetes Konto** → abgelehnt („Du bist schon angemeldet").

Ein Aufruf, drei Ausgaenge, alle drei vom Server entschieden.

### Anmelden

`login` nachschlagen, Passwort pruefen. Passt es:

- Hat die aktuelle Sitzung einen **Gast mit offenen Partien** und fehlt
  `confirmAbandonGuest`, lehnt der Server ab: „Du hast offene Partien als Gast.
  Bestaetige, dass du sie aufgibst."

  **Die Zahl fuer die Warnung holt der Client nicht vom Server** — er hat sie
  schon. `myRooms` ist dieselbe Liste, aus der „Weiterspielen (n)" gespeist
  wird. Der Dialog zeigt die Warnung also, bevor er ueberhaupt sendet. Die
  Ablehnung ist trotzdem noetig und keine Doppelung: sie ist der Riegel fuer
  den Fall, dass jemand am Client vorbei sendet. Ein `RejectedError` traegt nur
  eine Meldung und keine Nutzlast — eine Zahl im Fehler haette das Protokoll
  um eine Form erweitert, die es sonst nirgends gibt.

- Sonst: neue Zeile in `sessions` fuer das Konto, neues Geheimnis zurueck. Die
  alte Gastsitzung wird geloescht — dieses Geraet ist jetzt jemand anderes.
  Die Gast**zeile** bleibt.

Die Gastzeile aufzuraeumen waere falsch: an ihr haengen Sitze in Raeumen, in
denen andere weiterspielen.

### Abmelden

`DELETE FROM sessions WHERE token_hash = ?` — genau die eine. Danach legt der
Server einen frischen Gast an und gibt dessen Geheimnis zurueck, damit der
Browser weiterspielen kann.

### Zweites Geraet

Faellt aus dem Entwurf heraus, ohne dass etwas dafuer gebaut werden muss: zwei
Anmeldungen sind zwei Zeilen in `sessions`, die auf dieselbe `user_id` zeigen.
Genau dafuer gibt es die Tabelle.

## Oberflaeche

### Die Ecke oben rechts

Alles zum Anmelden sitzt oben rechts auf der Menueflaeche, `position:
absolute`. Es ist eine **Zustandsanzeige**, kein vierter Weg in eine Partie,
und wird entsprechend leise gesetzt: Kleinlabel-Sprache aus Regel 3 (klein,
gesperrt, `--on-sea-muted`). Boldness bleibt bei der Wortmarke (Regel 4).

- Gast: `Gast` · **Konto anlegen** · **Anmelden**
- Angemeldet: `Matteo` · **Abmelden**

Der Bildschirm hatte bisher keine Randzone; diese fuehrt eine ein. Damit sie im
schmalen Fenster nicht in die Wortmarke laeuft (Regel 7), bekommt
`.menu__inner` so viel oberen Innenabstand, wie die Ecke hoch ist — die Marke
rutscht dann nach unten, statt dass sich etwas ueberlagert.

In der Eingangschoreografie faellt die Ecke **zuletzt** ein, nach den drei
Wegen. Sie ist das Unwichtigste auf der Flaeche, und die Reihenfolge sagt das.
Sie benutzt dieselbe `menu-rise`-Animation mit dem naechsten `--i`.

Die Ecke steht auf **Hauptmenue und Startbildschirm**, nicht waehrend einer
Partie: dort ist oben rechts Spielflaeche, und ein „Abmelden" neben dem Brett
ist eine Falltuer.

### `AccountDialog`

Ein Dialog neben den vier bestehenden, umschaltbar zwischen „Konto anlegen" und
„Anmelden". Dieselben zwei Felder, beim Anlegen zusaetzlich die freiwillige
E-Mail mit dem Hinweis, dass sie heute nichts tut. Zwei getrennte Dialoge waeren
derselbe Aufbau zweimal, und wer im falschen landet, muesste zurueck.

Die Warnung bei offenen Gast-Partien erscheint im selben Dialog, nicht als
zweiter: „Du hast 2 offene Partien als Gast. Wenn du dich anmeldest, kommst du
ueber dieses Geraet nicht mehr an sie heran." — mit **Abbrechen** und
**Trotzdem anmelden**.

### Datenfluss im Client

`useOnlineGame` gibt eine `identity` heraus (`userId`, `name`, `isGuest`,
`login`) und die drei Aktionen `register`, `login`, `logout` — dasselbe Muster
wie `myRooms`. Der Haken sitzt ohnehin schon ueber dem Hauptmenue, es entsteht
also keine neue Leitung.

Der Client rechnet nichts aus. Ob jemand ein Konto anlegen kann, ob eine
Warnung faellig ist, ob der Login vergeben ist — das steht in der Antwort.

Nach `register` und `login` mit neuem Geheimnis: `storeSecret`, und die
Verbindung meldet sich neu an.

## Fehlerfaelle

Alles, was der Spieler lesen darf, ist ein `RejectedError` (Code `REJECTED`),
alles andere bleibt ein nichtssagendes `INTERNAL` — die Trennung aus Etappe 6
gilt unveraendert.

| Fall                                        | Antwort                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Login schon vergeben                        | „Dieser Benutzername ist vergeben."                                  |
| E-Mail schon vergeben                       | „Diese E-Mail ist schon hinterlegt."                                 |
| Passwort zu kurz                            | „Das Passwort braucht mindestens 8 Zeichen."                         |
| Anmeldedaten falsch                         | „Benutzername oder Passwort stimmt nicht."                           |
| Registrieren, obwohl angemeldet             | „Du bist schon angemeldet."                                          |
| Abmelden ohne Sitzung                       | „Du bist nicht angemeldet."                                          |
| Gast hat offene Partien (ohne Bestaetigung) | „Du hast offene Partien als Gast. Bestaetige, dass du sie aufgibst." |

Die vierte Zeile ist Absicht: **falsche Anmeldedaten sagen nie, ob es den
Benutzernamen gibt.** Sonst ist die Anmeldemaske ein Verzeichnis aller Konten.
Aus demselben Grund wird auch bei unbekanntem Login das Passwort gegen einen
Dummy-Hash geprueft — sonst verraet die Antwortzeit, was die Meldung verschweigt.

## Was die Tests belegen sollen

**`shared`** — die vier neuen Schemata: Pflichtfelder, Laengen, dass die
E-Mail wirklich optional ist, dass `AuthResponse` ohne `login` gueltig ist.

**`server`**

- `scrypt`-Rundlauf: hashen, pruefen, falsches Passwort faellt durch.
- Zwei gleiche Passwoerter ergeben verschiedene Hashes (Salt wirkt).
- Login vergeben → Ablehnung, keine zweite Zeile.
- Gast beansprucht sich selbst: dieselbe `user_id` vorher und nachher, Sitze
  noch dran, `is_guest` jetzt 0.
- Frischer Browser legt Konto an: neue Zeile, `is_guest` 0.
- **Zwei Geraete gleichzeitig angemeldet**: zweimal `auth.login`, beide
  Geheimnisse tragen anschliessend ein `hello`.
- **Abmelden trifft nur eine Sitzung**: das andere Geheimnis traegt noch.
- Anmelden als Gast mit offenen Partien: ohne Bestaetigung Ablehnung mit
  Anzahl, mit Bestaetigung Wechsel — und die Gastzeile steht danach noch.
- Unbekannter Login und falsches Passwort geben **dieselbe** Meldung.
- **Migrationstest**: eine Datenbank im alten Stand von Hand anlegen (Tabelle
  `users` mit `secret_hash`, ein Gast, ein Raum mit Sitz), `migrate` laufen
  lassen, danach traegt dasselbe Geheimnis ein `hello` und der Sitz gehoert
  noch derselben Person. Dazu: `migrate` zweimal hintereinander aendert nichts.

**`client`** — Ecke in beiden Zustaenden, Umschaltung im Dialog, Warnung bei
offenen Partien samt Abbrechen, und dass die Ecke waehrend einer Partie nicht
erscheint.

## Offene Punkte, die bleiben

- **Passwort vergessen gibt es nicht.** Wer sein Passwort verliert, verliert
  das Konto. Die E-Mail liegt fuer den Tag, an dem es einen Mailversand gibt.
- **Kein Rate-Limit auf `auth.login`.** Gehoert zur selben Familie wie die
  Origin-Regel und wird gebraucht, sobald der Server oeffentlich steht — also
  spaetestens in Etappe 9.
- **Sitzungen laufen nicht ab.** Kein `expires_at`, kein Aufraeumen. Bei einem
  Spiel unter Freunden ist das vertretbar; die Spalte kaeme mit dem ersten
  Grund, sie zu brauchen.
- **Kontoloeschung fehlt.** Was mit Sitzen in laufenden Partien passieren
  soll, ist dieselbe unbeantwortete Frage wie beim Zusammenfuehren.
- **Die freiwillige E-Mail tut heute nichts.** Bewusst so entschieden, siehe
  oben — kein Versehen.
