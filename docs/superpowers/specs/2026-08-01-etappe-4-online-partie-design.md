# Etappe 4+5 — Online-Partie

Stand: 2026-08-01, Branch `etappe-4-online`.

Aus dem Hotseat wird ein Tisch mit bis zu sechs Geraeten. Der Server haelt die
Partie, jeder Spieler sieht nur seine Haelfte, und ein Reload kostet den Platz
nicht.

Die Etappen 4 und 5 des Plans werden zusammengezogen. Einzeln sind sie nicht
abnehmbar: ein Server ohne angebundenen Client ist nicht spielbar, und
State-Filtering ohne Server hat nichts zu filtern.

## Der tragende Gedanke

Die Oberflaeche kennt nach dieser Etappe nur noch zwei Dinge: **eine Sicht auf
die Partie** und **einen Weg, eine Absicht zu senden**.

```
                  ┌─ lokal     reduce im Browser        (Hotseat, ohne Server)
UI ── PlayerView ─┤
    + sendIntent  └─ entfernt  reduce auf dem Server    (Online-Partie)
```

Damit bleibt der Hotseat erhalten, ohne dass es zwei Oberflaechen gibt: er ist
der Uebungsplatz ohne Server und das Testfahrzeug, mit dem sich die Oberflaeche
ohne Netz pruefen laesst. `gameView`, das Verdecken und die Klickkarten arbeiten
schon heute so, dass ihnen die Quelle gleichgueltig ist.

## Abgrenzung

**Rein:** Gast-Identitaet mit Sitzungsgeheimnis in SQLite, Raeume mit Code und
Einladungslink, Wartebereich, der Server als Autoritaet ueber den Spielzustand,
`PlayerView` statt `GameState` auf der Leitung, Reconnect ohne Platzverlust, der
Server liefert den gebauten Client aus, Bewegung an den Stellen, an denen sich
der Zustand aendert.

**Raus:** Persistenz der Partie — ein Serverneustart wirft sie weg (Action-Log
und Snapshot sind Etappe 6). Konten mit Passwort (Etappe 7). Spielerhandel und
Entwicklungskarten (Etappe 8). Zuschauer, Rauswerfen, Spielabbruch durch
Mehrheit, Chat.

## `PlayerView` — die geheime Haelfte bleibt drin

Neu in `shared/game/playerView.ts`, weil beide Seiten den Typ brauchen.
`playerViewOf(state, viewer, seats, version)` liefert:

- **Oeffentlich, unveraendert:** Szenario, Regelwerk, Belegung von Knoten und
  Kanten, Raeuberfeld, Bankvorrat, Phase, Spieler am Zug, letzter Wurf, Runde,
  Laengste Handelsstrasse, Siegpunkte und Bauteilvorraete aller.
- **Nur fuer den Empfaenger:** die eigenen Handkarten, vollstaendig.
- **Von anderen nur die Anzahl** — sie ist am Tisch ohnehin abzaehlbar.
- **Gar nicht:** der Zustand des Zufallsgenerators. Wer ihn kennt, rechnet jeden
  kuenftigen Wuerfelwurf voraus. Er steht auf derselben Liste wie fremde
  Handkarten und darf den Server nie verlassen (Merkposten aus Etappe 2).

Dazu kommen `you` (wer der Empfaenger ist), `version` und die Sitzdaten (Name,
Farbe) — die kennt bisher nur der Client, ab jetzt der Server.

### Die Regeln bleiben, wo sie sind

`legalActions` braucht den vollen Zustand und laeuft deshalb **auf dem Server**.
Er schickt dem Empfaenger die Liste seiner erlaubten Zuege mit. Das ist kein
Zusatzaufwand, sondern die konsequente Fortsetzung von Regel 3: der Client hat
schon in Etappe 3 keine Regel gekannt, und jetzt kann er auch keine mehr
erraten.

Folge fuer den Client: `actionTargets(state, player)` wird zu
`targetsFrom(actions)` — dieselben drei Klickkarten, nur aus einer fertigen
Liste statt aus einem Aufruf. Der Hotseat ruft `legalActions` weiterhin selbst
und reicht das Ergebnis hinein.

## Protokoll

### Anfragen (Client → Server, mit Antwort)

| Typ          | Payload               | Antwort                    |
| ------------ | --------------------- | -------------------------- |
| `hello`      | `{ secret?, name? }`  | `{ userId, secret, name }` |
| `createRoom` | `{ seatCount, seed }` | `{ code }`                 |
| `joinRoom`   | `{ code }`            | `{ code }`                 |
| `leaveRoom`  | `{}`                  | `{}`                       |
| `startGame`  | `{}`                  | `{}`                       |
| `act`        | `{ action }`          | `{}` oder Fehler mit Grund |

`act` antwortet bewusst leer: das Ergebnis eines Zuges ist der neue Stand, und
der kommt als Ereignis — an alle, jeweils anders gefiltert. Eine Antwort mit
Zustand waere eine zweite Zustellung derselben Wahrheit.

### Ereignisse (Server → Client, ohne Anfrage)

Der Envelope traegt das schon: `replyTo` ist optional. Neu ist eine zweite
Registry (`protocol/events.ts`) fuer Nachrichten ohne Anfrage, samt Schema.

| Typ    | Inhalt                                                                      |
| ------ | --------------------------------------------------------------------------- |
| `room` | Code, Host, Sitze mit Name, Farbe und Verbindungszustand, gestartet ja/nein |
| `game` | `{ version, view, actions, entry? }` — **je Empfaenger anders**             |
| `over` | Der Raum wurde aufgeloest, mit Grund                                        |

`entry` ist der Verlaufssatz zu dem Zug, der gerade geschehen ist — fuer den
Empfaenger formuliert. Beim ersten Stand nach dem Beitreten fehlt er, weil es
nichts zu erzaehlen gibt. Das Brett schickt seinen Verlauf also nicht als Liste
mit; wer spaeter dazukommt, sieht die Zuege ab seinem Beitritt. Alles andere
waere Vorbau fuer Etappe 6, wo der Verlauf ohnehin aus dem Action-Log entsteht.

**`game` ist kein Broadcast im ueblichen Sinn.** Jeder Empfaenger bekommt eine
eigene Nachricht mit seiner eigenen Sicht. Das ist der Punkt, an dem Regel 4
wirklich greift, und der Grund, warum die Zustellung je Verbindung und nicht je
Raum gebaut wird.

`version` zaehlt je Raum hoch. Der Client verwirft, was aelter ist als sein
aktueller Stand — bei Reconnect koennen zwei Staende dicht hintereinander
eintreffen.

### Der Router validiert weiterhin, was hinausgeht

Etappe 0 hat das eingebaut, mit genau dieser Etappe als Begruendung: was nicht
im Schema steht, kann den Server nicht verlassen. Fuer Ereignisse gilt dasselbe
— sie gehen durch dieselbe Pruefung. Ein Feld `rng`, das versehentlich in die
`PlayerView` geraet, wird damit zum Serverfehler statt zum Informationsleck.

## Identitaet

SQLite, Tabelle `users` (Regel 7, ab Tag 1):

| Spalte        | Bedeutung                                           |
| ------------- | --------------------------------------------------- |
| `id`          | Text, zufaellig                                     |
| `name`        | Anzeigename                                         |
| `is_guest`    | `1` fuer Gaeste                                     |
| `secret_hash` | SHA-256 des Sitzungsgeheimnisses, nie das Geheimnis |
| `created_at`  | Zeitstempel                                         |

Ablauf: `hello` ohne Geheimnis legt eine Gastzeile an und schickt ein frisches
Geheimnis (32 zufaellige Bytes, base64url). Der Browser legt es in
`localStorage` ab. `hello` mit Geheimnis meldet dieselbe Person wieder an.

Das Geheimnis wird **gehasht** gespeichert, obwohl es „nur" ein Gast ist: es ist
faktisch ein Passwort, und in Etappe 7 wird aus derselben Zeile ein Konto. Ein
Klartextgeheimnis in der Datenbank waere dann bereits das Datenleck.

**Treiber:** `better-sqlite3`, wie in `CLAUDE.md` festgelegt. `node:sqlite` waere
abhaengigkeitsfrei, ist in Node 24 aber noch als experimentell markiert; fuer
etwas, das Spielstaende halten soll, ist die Warnung im Log das falsche Signal.

## Raeume

Im Speicher, nicht in der Datenbank — Persistenz ist Etappe 6.

```
Room {
  code        4 Zeichen aus ABCDEFGHJKLMNPQRSTUVWXYZ23456789
              (ohne I, O, 0, 1 - der Code wird vorgelesen)
  hostId      wer starten darf
  seats       [{ userId, name, color, connected }]
  blueprint   classic34 | classic56, folgt der Sitzzahl
  seed        vom Ersteller, sichtbar fuer alle
  game        GameState | null   (null = Wartebereich)
  version     zaehlt hoch bei jeder Aenderung
}
```

Regeln, die der Raum durchsetzt: nur der Host startet; gestartet wird erst, wenn
die Sitzzahl zum Brett passt; wer beitritt, waehrend die Partie laeuft, bekommt
seinen Platz zurueck, wenn er ihn schon hatte, und sonst eine Absage. Ein leerer
Raum wird nach fuenf Minuten verworfen.

**Wer weg ist, blockiert nicht.** Verbindungsverlust setzt `connected = false`
und sonst nichts: der Platz bleibt, die Partie wartet. Kein Rauswurf, keine
Uebernahme durch den Computer, keine Zeitstrafe — das sind Spielentscheidungen,
und sie sind hier nicht getroffen.

## Erreichbarkeit

**Der Server liefert den gebauten Client aus.** Eine Adresse, ein Port, kein
Proxy im Betrieb. In der Entwicklung bleibt Vite mit seinem Proxy, damit Hot
Reload erhalten bleibt.

**Origin-Pruefung wird tunnelfest.** Bisher steht eine feste Liste in
`CLIENT_ORIGIN`; eine Tunneladresse wechselt aber bei jedem Start. Neue Regel:

1. **Gleicher Ursprung ist erlaubt** — `Origin` und `Host` des Upgrades stimmen
   ueberein. Weil der Server den Client selbst ausliefert, ist das der
   Normalfall, und er gilt fuer jede Tunneladresse ohne Konfiguration.
2. Zusaetzlich gelten die Eintraege aus `CLIENT_ORIGIN` (der Vite-Dev-Proxy).

Damit bleibt die Ablehnung fremder Origins aus Etappe 0 in Kraft — sie wird nur
nicht mehr von einer wechselnden Adresse ausgehebelt.

## Client

Bildschirme: **Start** (Partie erstellen oder Code eingeben) → **Wartebereich**
(Code gross, Link zum Kopieren, Sitze fuellen sich live, Host startet) →
**Partie**.

Ein Einladungslink ist derselbe Code in der Adresse: `?raum=K7X2` wird beim
Laden gelesen und fuellt das Feld vor. Kein Router, keine neue Abhaengigkeit.

**Der Startbildschirm dreht sich dabei um.** Bisher traegt ein Geraet alle drei
bis sechs Namen ein; online tippt jeder nur **seinen eigenen**. Aus der
Sitzliste im Formular wird die Sitzliste im Wartebereich, die sich fuellt,
waehrend die anderen beitreten. Die Farbe vergibt der Raum in der Reihenfolge
des Beitritts — sonst muesste man sie aushandeln.

Der Hotseat bleibt daneben erreichbar („Lokale Partie") und behaelt die
Mehrfach-Namenseingabe. Das ist der einzige Punkt, an dem die beiden Betriebs-
arten sich in der Bedienung unterscheiden; ab dem Brett sind sie gleich.

`useOnlineGame` tritt an die Stelle von `useHotseatGame`: es haelt die letzte
`PlayerView`, die letzte Aktionsliste und den Verbindungszustand, schickt
Absichten und verwirft veraltete Versionen. Der Transport aus Etappe 0 bringt
Reconnect, Backoff und Keepalive schon mit; neu ist nur, dass nach einem
Neuaufbau `hello` und `joinRoom` automatisch wiederholt werden.

**Der Verlauf wird zum Ereignisprotokoll.** Bisher leitet der Client seine
Saetze aus dem Zustandsunterschied ab — das geht nicht mehr, weil er fremde
Haende nicht sieht. Der Server schickt deshalb je Zug einen fertigen Satz mit,
und zwar denselben fuer alle: „Ben wirft 4 Karten ab", nicht welche. Wo ein
Ereignis fuer die Beteiligten anders lautet als fuer den Rest des Tisches —
Diebstahl —, schickt er zwei Fassungen. Genau der Anlass, den Etappe 2 abgewartet
hat.

## Bewegung

Dort, wo sich der Zustand aendert, und nirgends sonst:

- Der Raeuber **gleitet** auf sein neues Feld (SVG-Transition auf der Position).
- Neue Bauwerke **poppen** kurz auf (Skalierung, 180 ms).
- Der Wurf **zaehlt sich ein**, statt einfach dazustehen.
- Ertraege steigen als **„+1 Erz"** ueber dem liefernden Feld auf und verblassen.
- Der Zugwechsel **wandert** sichtbar durch die Tischliste.
- Ein Verbindungsverlust legt sich als ruhige Schicht ueber das Brett, statt die
  Oberflaeche einfrieren zu lassen.

Alles CSS und SVG, keine Bibliothek. `prefers-reduced-motion` schaltet jede
Bewegung ab — die Anzeige bleibt vollstaendig, sie springt nur.

## Tests

Ohne Netz, wie bisher:

- `playerViewOf` gibt den RNG-Zustand **nicht** heraus — geprueft ueber alle
  Schluessel rekursiv, nicht durch Hinsehen; und fremde Handkarten erscheinen
  nur als Anzahl, waehrend die eigene vollstaendig bleibt.
- Die Summe „eigene Karten + fremde Anzahlen" stimmt mit dem echten Zustand
  ueberein: die Sicht luegt nicht, sie schweigt nur.
- Raumlogik: Beitreten, doppeltes Beitreten, Beitreten in eine laufende Partie,
  Start durch Nicht-Host, Start mit falscher Sitzzahl, Verbindungsverlust und
  Rueckkehr.
- Identitaet: `hello` ohne Geheimnis legt genau eine Zeile an; `hello` mit
  Geheimnis findet dieselbe; ein falsches Geheimnis legt **keine** neue an,
  sondern wird abgelehnt.
- Ein Zug von jemandem, der nicht am Zug ist, wird abgelehnt — und zwar mit dem
  Grund aus `errors.ts`, nicht mit einer eigenen Formulierung.

Mit jsdom: Wartebereich zeigt beitretende Sitze, der Startknopf gehoert dem
Host, eine veraltete `version` wird verworfen.

Ende zu Ende: die bestehende `acceptance.mjs` waechst um einen Durchlauf, der
zwei Verbindungen oeffnet, einen Raum erstellt, beitritt, startet und einen Zug
macht — und dabei prueft, dass die zweite Verbindung die Handkarten der ersten
**nicht** sieht.

## Abnahme

| Pruefung                                      | Erwartung                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                              | gruen                                                                                         |
| `pnpm test`                                   | die 553 bestehenden gruen, neue dazu                                                          |
| `pnpm build`                                  | gruen                                                                                         |
| `pnpm format:check`                           | gruen                                                                                         |
| `pnpm --filter @conquerist/server acceptance` | alte Pruefungen plus die neuen Raum-Pruefungen                                                |
| Von Hand                                      | zwei Browserfenster, Partie zu zweit, ein Reload mittendrin — Platz und Karten kommen zurueck |

## Offene Punkte, bewusst

- **Ein Serverneustart wirft die Partie weg.** In der Entwicklung passiert das
  bei jedem Speichern (`tsx watch`). Etappe 6 loest es mit Action-Log und
  Snapshot; bis dahin ist es beim Entwickeln laestig und im Betrieb selten.
- **Keine Zeitbegrenzung je Zug.** Wer weggeht, blockiert den Tisch.
- **Kein Schutz gegen viele Anfragen.** Ein boeswilliger Client kann den Server
  mit Zuegen bewerfen. Fuer eine Runde unter Freunden hinter einem Tunnel
  vertretbar, vor einer oeffentlichen Adresse nicht.
- **Der Raumcode ist kurz.** 4 Zeichen aus 32 sind rund eine Million
  Kombinationen; wer raet, findet irgendwann einen offenen Wartebereich. Bewusst
  in Kauf genommen, solange Raeume nur Minuten leben.
