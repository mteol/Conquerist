# Etappe 6 — Persistenz und „Deine Partien" — Entwurf

Stand: 2026-08-02. Ausgangslage: Branch `etappe-4-online`, Etappen 0–5 fertig,
640 Tests gruen, Abnahme 21/21.

## Das Problem

Raeume liegen im Speicher. Ein Serverneustart wirft jede laufende Partie weg -
im Betrieb selten, beim Entwickeln staendig, weil `tsx watch` bei jedem
Speichern neu startet. Und wer den Browser schliesst, findet seine Partie nur
wieder, wenn er den Raumcode noch hat.

## Das Ziel

Zwei Saetze:

1. Ein Neustart des Servers kostet keine Partie.
2. Wer zurueckkommt, sieht **seine** Partien und geht mit einem Klick hinein.

Ausdruecklich **nicht** dabei: eine oeffentliche Liste fremder Partien. Beitritt
bleibt ueber Raumcode und Einladungslink. Das ist eine eigene Frage fuer
spaeter, wenn klar ist, dass sie ueberhaupt jemand stellt.

## Der Weg: das Action-Log ist der Zustand

Gespeichert wird der **Startzustand** einer Partie plus die **Folge der
angenommenen Zuege**. Wiederhergestellt wird durch `replay`. Kein Snapshot.

Das ist keine Sparsamkeit, sondern das Einloesen dessen, was Regel 2 seit
Etappe 2 verspricht: die Spiellogik ist rein, der Zufall kommt ausschliesslich
aus dem Seed, und „der Zustand ist aus dem Action-Log rekonstruierbar" steht
woertlich in `CLAUDE.md`. `replay` gibt es seit Etappe 2 und wartet seither auf
diesen Anlass.

**Gemessen statt geschaetzt:** eine kuenstlich verlaengerte Partie mit 4000
Aktionen stellt sich in 19 ms wieder her, ihr Log ist 152 kB gross. Eine echte
Partie bis zehn Siegpunkten liegt bei einigen hundert Zuegen, also rund 3 ms
und 25 kB. Ein Snapshot kauft hier nichts, kostet aber eine zweite Darstellung
desselben Sachverhalts - und die kann von der ersten abweichen, ohne dass es
jemand merkt.

**Warum der Startzustand mitgespeichert wird und nicht nur der Seed:** ein
`GameState` traegt Szenario und RuleSet als Kopie in sich (so entschieden in
Etappe 2, siehe `state.ts`). Damit spielt eine alte Partie nach einer Aenderung
an `CLASSIC_RULES` unter den Regeln weiter, unter denen sie begonnen hat.
Wuerden wir nur den Seed ablegen und den Startzustand neu bauen, waere jede
Regelanpassung ein stiller Bruch aller laufenden Partien.

Was dadurch **nicht** geschuetzt ist: ein Umbau am Reducer selbst. Ein
Snapshot waere davor genauso wenig sicher, weil sich auch seine Form aendern
kann. Es bleibt als offener Punkt notiert.

## Datenbank

Zu `users` (Etappe 4) kommen drei Tabellen:

```sql
CREATE TABLE rooms (
  code         TEXT PRIMARY KEY,
  host_id      TEXT NOT NULL REFERENCES users(id),
  seat_count   INTEGER NOT NULL,
  seed         TEXT NOT NULL,
  version      INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  -- Der Startzustand als JSON. NULL, solange der Wartebereich laeuft.
  start_state  TEXT,
  -- Gesetzt, sobald die Partie entschieden ist.
  finished_at  INTEGER
);

CREATE TABLE room_seats (
  code      TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  user_id   TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (code, position)
);

CREATE TABLE room_actions (
  code     TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  ordinal  INTEGER NOT NULL,
  action   TEXT NOT NULL,
  PRIMARY KEY (code, ordinal)
);
```

Drei Dinge, die dort bewusst **nicht** stehen:

- **Kein `name` und kein `color` je Sitz.** Der Name steht in `users`, die
  Farbe folgt aus der Position (`seatColorAt`). Beides zu speichern waere eine
  zweite Wahrheit, die beim ersten Umbenennen auseinanderlaeuft.
- **Kein `connected`.** Verbunden zu sein ist eine Eigenschaft dieses
  Serverlaufs, nicht der Partie. Nach einem Neustart ist niemand verbunden, und
  genau so wird ein geladener Raum aufgebaut.
- **Kein abgeleiteter Spielzustand.** Weder Siegpunkte noch Rundenzahl noch
  Handkarten - alles davon folgt aus Startzustand plus Log.

`version` dagegen **muss** gespeichert werden. Der Client verwirft Staende mit
kleinerer Version (Etappe 5); wuerde sie nach einem Neustart wieder bei 1
anfangen, ignorierte jeder noch offene Browser den frischen Stand.

## Bausteine

### `RoomStore` — die Schnittstelle

```ts
export interface RoomStore {
  save(room: Room): void;
  appendAction(code: string, ordinal: number, action: GameAction): void;
  remove(code: string): void;
  loadAll(): Room[];
  roomsOf(userId: string): readonly string[];
}
```

Zwei Umsetzungen: `SqliteRoomStore` fuer den Betrieb und `MemoryRoomStore` fuer
Tests, die keine Datei wollen. Die Schnittstelle ist der Grund, warum der Rest
der Tests so bleiben kann, wie er ist.

### `RoomRegistry` bekommt den Store

Die Registry ist heute schon der Ort, an dem ein Raum entsteht, sich aendert
und verschwindet. Sie bekommt den Store als Abhaengigkeit - dadurch gilt
weiterhin: **was im Speicher liegt, liegt auch auf der Platte.**

`update` bekommt ein drittes, optionales Argument:

```ts
update(code: string, next: Room, appended?: GameAction): void
```

„Der Raum hat sich geaendert, und das hier war der Zug, der es ausgeloest hat."
Ohne `appended` wird nur der Raum geschrieben (Beitritt, Umstellen, Verlassen),
mit `appended` zusaetzlich eine Zeile ins Log.

**`rooms/room.ts` bleibt unangetastet.** Der Raum ist ein Wert und rechnet
nicht mit Datenbanken - das war die Entscheidung aus Etappe 4, und sie zahlt
sich hier aus: alle vierzehn Raumtests laufen unveraendert weiter.

### Laden beim Start

`server.ts` baut die Registry aus dem Store: fuer jeden gespeicherten Raum
Sitze aus `room_seats` und `users`, Farbe aus der Position, `connected: false`,
und - falls `start_state` gesetzt ist - `replay(startzustand, aktionen)`.

Scheitert ein `replay`, wird der Raum **uebersprungen und laut protokolliert**,
nicht der Serverstart abgebrochen. Eine kaputte Partie darf nicht alle anderen
mitnehmen. Sie bleibt in der Datenbank, damit man sie ansehen kann.

### „Deine Partien"

Eine neue Anfrage im Protokoll:

- `room.mine` → `{ rooms: RoomSummary[] }`

`RoomSummary` traegt genau das, was die Karte auf dem Startbildschirm zeigt:
`code`, `seatCount`, `started`, die Sitznamen mit Farbe und Verbindungsstand,
und bei laufenden Partien `turn` sowie `yourTurn`. Beendete Partien fehlen in
der Liste.

**Kein neuer Weg zum Wiedereinsteigen.** `room.join` erkennt einen bekannten
Sitz seit Etappe 4 wieder - der Klick auf eine Karte schickt also schlicht
`room.join` mit ihrem Code. Ein zweiter Einstiegspunkt waere ein zweiter Weg
fuer dieselbe Sache.

### Beim Anmelden

`hello` oeffnet weiterhin von sich aus einen Raum, wenn der Nutzer in genau
einem sitzt - das ist der haeufige Fall und der bestehende Reconnect. Sitzt er
in mehreren, oeffnet der Server **keinen**; dann entscheidet die Liste. Der
Client fragt nach `hello` immer `room.mine` und zeigt sie auf dem
Startbildschirm.

## Aufraeumen

- **Leerer Raum:** wie bisher nach fuenf Minuten weg, jetzt auch aus der
  Datenbank.
- **Beendete Partie:** bleibt liegen, faellt aber aus der Liste. Das Log ist
  billig, und ohne es waere die Entscheidung fuer das Log halb.
- **Verwaiste Partie:** eine, an die seit Wochen niemand zurueckkommt. Bewusst
  noch ohne Frist - erst messen, ob es das Problem gibt.

## Fehlerfaelle

| Fall                                     | Verhalten                                               |
| ---------------------------------------- | ------------------------------------------------------- |
| `replay` scheitert beim Laden            | Raum ueberspringen, laut loggen, Server startet         |
| `start_state` ist kein gueltiger Zustand | dito - beim Lesen gegen `GameStateSchema` validiert     |
| Aktion im Log passt nicht zum Schema     | dito                                                    |
| Datenbankdatei fehlt oder ist leer       | leere Registry, Server startet normal                   |
| Schreiben scheitert mitten im Zug        | Zug ist bereits angenommen; Fehler loggen, nicht werfen |

Die letzte Zeile ist eine Entscheidung: ein Schreibfehler darf einen bereits
regelgerecht angenommenen Zug nicht nachtraeglich ungueltig machen. Der
Speicher bleibt die Wahrheit des laufenden Betriebs, die Platte ist die
Absicherung. Umgekehrt waere ein Zug je nach Plattenzustand mal gueltig und mal
nicht.

## Was die Tests belegen sollen

- **Ein Raum ueberlebt den Weg durch die Datenbank.** Anlegen, beitreten,
  starten, ein paar Zuege - Registry wegwerfen, aus derselben Datei neu bauen,
  und der Zustand ist **gleich, einschliesslich `rng`**. Das ist die Etappe in
  einem Test.
- **Der Wartebereich ueberlebt genauso** - eine Partie, die noch nicht begonnen
  hat, ist auch eine.
- **Die Version faellt nicht zurueck.** Nach dem Neuladen ist sie mindestens so
  gross wie vorher.
- **Ein kaputter Raum nimmt die anderen nicht mit.** Log von Hand verbiegen,
  laden, und die uebrigen Raeume stehen.
- **`room.mine` zeigt nur meine und nur unbeendete.**
- **Abnahme:** Server neu starten, waehrend eine Partie laeuft, und ein Client
  kommt mit seinem Geheimnis in dieselbe Partie zurueck.

## Offene Punkte, die bleiben

- Ein Umbau am Reducer kann alte Logs unbrauchbar machen. Keine Vorkehrung -
  bewusst, weil jede (Versionsnummern, Migrationen) mehr kostet als sie in
  einem Projekt dieser Groesse bringt.
- Keine Frist fuer verwaiste Partien.
- Kein Rauswerfen und keine Hostuebergabe in laufenden Partien.
