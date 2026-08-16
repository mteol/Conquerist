# Ton und Einstellungen — Entwurf

Stand: 2026-08-16, aufsetzend auf `26197d1` (`main`).

## Das Problem

Das Spiel ist vollstaendig stumm. Ein Klick auf „Bauen" fuehlt sich an wie ein
Klick ins Leere, ein Wuerfelwurf ist eine Zahl, die sich austauscht, und wer
online mit dem Tab im Hintergrund sitzt, merkt nicht, dass er dran ist.

Zugleich gibt es keinen Ort fuer Einstellungen. Alles, was einstellbar ist,
haengt heute an dem Bildschirm, auf dem es gebraucht wird (Siegpunktziel im
Wartebereich, „zwischen den Zuegen verdecken" auf dem Startbildschirm). Fuer
Lautstaerke stimmt das nicht: sie gilt ueberall.

## Das Ziel

1. Ein Klangkatalog von 23 Cues, **vollstaendig synthetisiert** — keine
   Audiodatei im Repository, kein Byte im Image.
2. Jeder Cue kann spaeter einzeln durch eine mp3 ersetzt werden, ohne dass
   Aufrufseite oder Engine sich aendern; fehlt oder bricht die Datei, klingt
   die Synthese.
3. Ein Einstellungen-Dialog, erreichbar von jedem Bildschirm, mit drei
   Lautstaerken (Gesamt, Effekte, Musik) und je einem Stummschalter.
4. Spielereignisse klingen in **beiden** Modi gleich — Hotseat und online —
   aus einer Implementierung.
5. Online abgestuft: eigene Zuege voll, fremde gedaempft, was mich angeht
   wieder voll.
6. Im Browser nachgehoert und nachgesehen, bevor es als fertig gilt.

**Nicht dabei:** Musik (nur der Bus und der Regler entstehen), ein
Klangschema-Wechsel, Raumklang/Panning, Sprachausgabe, weitere Abschnitte im
Einstellungen-Dialog (Sprache, Darstellung), das Ausliefern von mp3s.

## Der Fund, der den Entwurf bestimmt

**Online erfaehrt der Client nie, welcher Zug geschehen ist.** `GameEvent`
traegt `version`, `view`, `actions`, `sentAt` und `entry` — einen fertigen
deutschen Satz (`packages/shared/src/protocol/events.ts:59`). Der Hotseat
dagegen hat die `GameAction` in der Hand (`apps/client/src/game/hotseat.ts:47`).
Ohne Eingriff braeuchte der Ton zwei Ableitungen: eine aus der Aktion, eine aus
einem Satz oder aus dem Zustandsunterschied.

Deshalb bekommt das Protokoll ein Feld. Der Server sagt, **was** passiert ist;
was das klingt, entscheidet allein der Client.

## Entscheidungen, die vorab gefallen sind

**Der Server erfaehrt nicht, dass es Ton gibt.** Die Alternative — der Server
rechnet Cues aus und schickt sie, was wegen der Zustellung je Empfaenger
(`apps/server/src/rooms/broadcast.ts:61`) sogar bequem waere — bricht die
Schichtung: das Protokoll beschreibt den Spielverlauf, nicht die Ausgabe. Ein
zweiter Client (oder eine Ansicht ohne Ton) muesste Cues wegwerfen, die er nie
wollte.

**Kein Ableiten aus dem Zustandsunterschied.** Er traegt „Siedlung oder Stadt"
noch, „Ritter gespielt" nur mit Muehe, und jeder neue Klang waere wieder
Archaeologie. `describeTransition` darf das (es vergleicht vorher/nachher und
kann deshalb nicht von der Wahrheit abweichen) — aber es hat die Aktion
zusaetzlich. Der Client hat sie online nicht, und genau das aendert dieser
Entwurf.

**Synthese ist die Voreinstellung, Samples sind die Ausnahme.** Jeder Cue hat
eine Synthesevorschrift, und der Typ erzwingt Vollstaendigkeit
(`Record<Cue, Recipe>`, nicht `Partial`). Eine mp3 gilt nur dort, wo sie
ausdruecklich eingetragen ist. Faellt sie aus, klingt die Synthese — ein
fehlendes Sample darf nie ein stummes Spiel bedeuten.

**Die Reduzierer bleiben rein.** Der Cue landet als Datenfeld im Zustand, genau
wie der Verlaufssatz; abgespielt wird er von einem Effekt an der Kante. Damit
ist „welcher Zug ergibt welchen Klang" ohne DOM und ohne `AudioContext`
pruefbar.

**Im Hotseat ist jeder „ich".** Am selben Geraet gibt es keine Betroffenheit;
alles klingt voll. Der Empfaenger-Parameter ist dort `null`.

## Aufbau

Sechs neue Module unter `apps/client/src/audio/`, geschnitten entlang der
Frage, was eine Entscheidung trifft und was nur verdrahtet:

| Datei         | Aufgabe                                                       | Rein        |
| ------------- | ------------------------------------------------------------- | ----------- |
| `cues.ts`     | Das Vokabular: `type Cue` als String-Union, 23 Werte          | ja          |
| `cueFor.ts`   | `(move, situation) => readonly Sound[]` plus die zwei Erheber | ja          |
| `voices.ts`   | `Record<Cue, Recipe>` — je Cue ein Rezept als Daten           | ja          |
| `samples.ts`  | `Partial<Record<Cue, string>>` — die mp3-Ausnahmen            | ja          |
| `settings.ts` | Die drei Lautstaerken laden, speichern, pruefen               | ja          |
| `engine.ts`   | `AudioContext`, drei Gains, Freischaltung, `play`             | nein        |
| `useAudio.ts` | React-Kontext; verbindet Engine, Einstellungen, Effekte       | Verdrahtung |

Dazu `apps/client/src/dialogs/SettingsDialog.tsx` und ein Zahnrad-Knopf.

`engine.ts` ist die einzige Datei, die WebAudio anfasst, und sie trifft keine
Entscheidung: welcher Cue, welches Rezept, welcher Pegel steht schon fest,
wenn sie gerufen wird.

### Der Cue-Katalog

23 Cues in acht Gruppen:

```
ui.click  ui.confirm  ui.cancel  ui.error
build.road  build.settlement  build.city
dice.roll  dice.land  dice.seven
gain.self
robber.move  robber.steal  discard.required
card.buy  card.knight  card.play
trade.offer  trade.accept  trade.reject  trade.timeout
turn.mine  game.over
```

(Die Gruendungszuege `placeSetupSettlement`/`placeSetupRoad` benutzen
`build.settlement`/`build.road` mit — es ist dieselbe Handlung.)

### Was ein Klang ist

Die Klangwelt in einem Satz: **ein Holztisch, kein Raumschiff.** Trocken, kurz,
gedaempft. Gefiltertes Rauschen fuer alles, was aufgesetzt wird; gestimmte
Toene mit schnellem Abfall fuer alles, was gemeldet wird. Toene kommen aus
einem festen Fuenftonvorrat, damit zwei gleichzeitige Klaenge nie schief
zueinander stehen. Wie beim Brett gilt „Boldness an einer Stelle": laut werden
nur der Wuerfel und das Spielende.

Ein Rezept ist eine Liste Schichten, jede Schicht Daten:

```ts
type Layer =
  | { kind: 'tone'; wave: OscillatorType; from: number; to?: number; ... }
  | { kind: 'noise'; filter: BiquadFilterType; from: number; to?: number; q?: number; ... };
// gemeinsam: attack, decay, gain, at (Versatz in ms)
interface Recipe { readonly layers: readonly Layer[] }
```

Deshalb braucht das Wuerfelpoltern keinen Sonderfall: `dice.roll` sind fuenf
Rauschschichten bei `at: 0, 90, 170, 260, 380`. Und deshalb ist der Katalog im
node-Test pruefbar — geprueft wird die Vorschrift, nicht der Lautsprecher.

**Die Tonhoehe von `dice.land` folgt der Augensumme** (2 tief bis 12 hoch). Das
ist die einzige Stelle, an der Ton Information traegt; er ersetzt nichts (die
Zahl steht sichtbar da), er kommt dazu.

**Zwei Notbremsen**, sonst wird es bei vier Spielern eine Wand: derselbe Cue
innerhalb von 60 ms wird verworfen, und mehr als acht gleichzeitige Stimmen
gibt es nicht — die aelteste wird abgeraeumt.

### Wie ein Sample eine Synthese ersetzt

`samples.ts` fuehrt **alle** Cues als auskommentierte Zeilen, je mit Zweck und
gedachter Laenge:

```ts
export const SAMPLES: Partial<Record<Cue, string>> = {
  // 'dice.roll': '/sounds/dice-roll.mp3',   // Wuerfel poltern, ~600 ms
  // 'build.city': '/sounds/city.mp3',       // schwerer Aufsatz, ~250 ms
};
```

Eine mp3 einbauen heisst: Datei nach `apps/client/public/sounds/` legen (das
Verzeichnis gibt es noch nicht; Vite kopiert es unveraendert nach `dist`, und
das Dockerfile nimmt `dist` ohnehin mit) und eine Zeile entkommentieren.

`engine.play` loest in dieser Reihenfolge auf: **geladenes Sample → Synthese.**
Geladen wird einmalig und nebenlaeufig; bis das Sample da ist — und wenn es nie
kommt — klingt die Synthese. Eine langsame Datei kann den Klang damit auch
nicht verspaeten.

## Datenfluss

### 1. Spielereignisse

Beide Zustandsreduzierer bekommen ein Feld neben `log`:

```ts
readonly sound: { readonly seq: number; readonly cues: readonly Sound[] } | null;
```

`seq` zaehlt mit (`actions.length` im Hotseat, `version` online), damit
derselbe Cue zweimal hintereinander auch zweimal ausgeloest wird. Ein Effekt in
`useAudio` spielt ab, was sich unter `seq` geaendert hat.

`cueFor` liefert `Sound[]`, nicht `Cue[]`: ein `Sound` ist `{ cue, gain, note? }`
— der Daempfungsfaktor und die Wuerfelzahl gehoeren zur Ausloesung, nicht zum
Katalog.

**Beide Modi reichen dasselbe hinein, und das ist nicht ihr Zustand.** Der
Hotseat haelt `GameState`, online liegt nur die `PlayerView` vor. Eine Funktion
mit zwei Zustandswelten waere zwei Funktionen mit einem Namen. Dazwischen steht
deshalb eine kleine Erhebung — genau die Tatsachen, die ein Klang braucht:

```ts
interface Situation {
  readonly foreign: boolean; // fremder Zug (online); im Hotseat nie
  readonly gained: number; // wie viele Karten sind mir zugelaufen
  readonly lost: number; // ... und wie viele weg (Diebstahl)
  readonly becameMyTurn: boolean; // vorher nicht dran, jetzt schon
  readonly mustDiscard: boolean; // die Abwurfaufforderung steht jetzt
  readonly offerToMe: boolean; // ein Angebot wartet auf meine Antwort
  readonly finished: boolean; // die Partie ist mit diesem Zug vorbei
  readonly diceTotal: number | null;
}
```

Zwei Erheber fuellen sie, jeder aus seiner Welt und jeder ein paar Feldzugriffe
lang:

- **Hotseat** (`game/hotseat.ts:56`): `situationFromGame(before, after, action)`.
  `foreign` ist immer `false` — am selben Geraet ist jeder „ich". `gained`
  zaehlt deshalb die Karten **aller** Spieler zusammen: was auf den Tisch
  kommt, kommt zu dir.
- **Online** (`game/onlineState.ts:76`): `situationFromView(before, after, move, myUserId)`.
  `gained`/`lost` aus der eigenen Handkartenzahl — das Einzige, was in der
  eigenen View verlaesslich steht, und genau worum es geht.

`cueFor(move, situation)` kennt danach weder `GameState` noch `PlayerView`. Ein
Test dafuer ist ein Objektliteral und eine Zusicherung.

**Die Betroffenheitsregel** (greift nur bei `foreign`, also nur online):

| Fall                                                | Pegel |
| --------------------------------------------------- | ----- |
| eigener Zug (`move.actor === ich`)                  | voll  |
| `offerToMe`, `lost > 0`, `becameMyTurn`, `finished` | voll  |
| alles andere von fremd                              | 0,4   |

Die zweite Zeile ist der Grund, warum die Erhebung ueberhaupt existiert: „ein
fremder Zug" und „ein fremder Zug, der mich trifft" klingen verschieden, und
den Unterschied kennt nur die eigene Sicht.

### 2. Knopfklicks

**Keine der ~100 Knopf-Stellen wird angefasst.** Ein delegierter
`pointerdown`-Listener am Wurzelknoten:

- `event.target.closest('button, [role="button"]')` — sonst nichts
- `disabled` klingt nicht
- `data-sound="confirm"` am Element schlaegt den Vorgabeklang

Damit ist `data-sound` die einzige Stelle, an der eine Komponente je von Ton
erfaehrt. Dialoge brauchen keinen eigenen Klang: geoeffnet und geschlossen
werden sie durch Knoepfe, die schon klingen.

### 3. Freischaltung

Browser geben Audio erst nach einer Nutzergeste frei. Die erste Geste ist
ohnehin ein Klick — also wird der `AudioContext` beim ersten `pointerdown`
gebaut (und `resume()` gerufen, falls er suspendiert startet). Kein
„Ton aktivieren"-Knopf, kein Klang vor der ersten Geste, keine Konsolenwarnung.

## Einstellungen

### Der Dialog

`dialogs/SettingsDialog.tsx`, gebaut auf demselben `.modal`/`CloseButton`-Muster
wie die bestehenden sechs Dialoge — kein zweites Fenstermodell, Escape
schliesst wie ueberall. Inhalt heute genau ein Abschnitt:

```
Ton
  [Symbol]  Gesamt    [Regler]   70 %
  [Symbol]  Effekte   [Regler]  100 %
  [Symbol]  Musik     [Regler]   70 %
```

Das Symbol ist der Stummschalter (`aria-pressed`, Symbol wechselt), der Regler
ein `<input type="range">` mit `aria-label`. **Stumm nimmt den Wert nicht weg:**
der Regler behaelt seine Stellung, Aufheben stellt sie wieder her.

Alle drei Zeilen sind voll bedienbar, auch Musik — sie regelt eine Spur, auf
der heute nichts laeuft. Das ist bewusst so entschieden: der Musik-Bus entsteht
mit, und wenn die erste Musik kommt, aendert sich am Dialog nichts.

### Der Audiograph

```
Stimme ─→ Effekte ─┐
                   ├─→ Gesamt ─→ Ausgang
Musik   ──────────┘
```

Drei Gain-Knoten, eine Zeile Verdrahtung. **Die Daempfung fremder Zuege ist
kein vierter Bus**, sondern ein Faktor an der einzelnen Stimme — waere sie ein
Bus, muesste sie einstellbar sein, und das will niemand.

### Speicher

Ein Schluessel `conquerist.audio`, ein Objekt
`{ master: { level, muted }, sfx: {...}, music: {...} }`, gelesen durch denselben
duldsamen Wrapper wie `net/session.ts` (gesperrter Speicher wirft dort schon
beim Lesen; kaputter Inhalt oder fehlender Speicher ergibt die
Voreinstellungen, nie einen Absturz). Voreinstellung: Gesamt 70 %,
Effekte 100 %, Musik 70 %, nichts stumm.

### Der Zahnrad-Knopf

**Ein Einbauort fuer alle Bildschirme:** fest verankert (`position: fixed`)
oben rechts, eingehaengt in `App.tsx` neben dem Konto-Dialog (`App.tsx:235`),
`z-index: 2`.

Damit das geht, bekommt `.corner` rechts Platz reserviert. Die Konto-Ecke sitzt
heute buendig an derselben Kante (`index.css:522`, `top: 0; right: 0`); ohne
reservierte Breite laege „Abmelden" unter dem Zahnrad — und im schmalen
Fenster, wo `.corner` umbricht, doppelt (die Ecke hat dafuer schon eine Media
Query bei 26rem).

Der Knopf uebernimmt die Setzung von `.corner__action` (gedaempftes Pergament
auf Tiefsee) und **nicht** `.button--ghost`: das ist laut Browser-Durchlauf vom
2026-08-16 cream auf Pergament, 1,05:1, und an rund zehn Stellen unsichtbar.

## Protokoll und Server

`GameEventSchema` bekommt **ein** optionales Feld:

```ts
move: z.object({ type: GameActionTypeSchema, actor: z.string().min(1) }).optional();
```

Ein Objekt statt zweier paralleler Optionale, die immer gemeinsam auftreten
muessten. Es steht genau dann da, wenn `entry` dasteht: bei einem Stand, der
aus einem Zug entstanden ist, nicht beim ersten Stand und nicht nach einem
Reconnect.

`GameActionTypeSchema` steht in `packages/shared/src/game/actions.ts`, neben der
Union, die es beschreibt. Es ist ein `z.enum` mit einer Typwaechter-Zeile, die die
Uebersetzung scheitern laesst, sobald `GameAction` einen Zweig bekommt, der
dort fehlt. Ein neuer Zugtyp kann damit nicht stillschweigend stumm bleiben.

**Aufraeumarbeit, die zur Sache gehoert:** `broadcastGame` bekommt statt des
fertigen Satzes den Uebergang und rechnet `entry` **und** `move` selbst aus.

```ts
broadcastGame(room, sinks, transition?: { before: GameState; action: GameAction; after: GameState })
```

Heute ruft jede der vier Aufrufstellen `describeTransition` eigenhaendig
(`rooms/clock.ts:74`, `ws/handlers/room.ts:88`, `:323`, `:372`) — vier Kopien
derselben Zeile, und die fuenfte fuer `move` kaeme dazu. Die drei Aufrufe ohne
Uebergang (Join, Start, Reconnect) bleiben unveraendert. Kein Umbau darueber
hinaus.

## Vertraeglichkeit

Ein Client ohne das neue Feld liest es nicht — `move` ist optional, alte
Clients ignorieren es. Ein neuer Client an einem alten Server bekommt kein
`move` und spielt fuer fremde Zuege nichts; sein eigener Ton (Klicks, eigene
Bauzuege ueber die Rueckmeldung) klingt weiter. Kein Migrationsschritt, keine
Datenbankaenderung: `move` wird berechnet, nie gespeichert.

## Barrierefreiheit

Ton ist **nie** der einzige Traeger einer Information (Regel 7). Jeder Cue
begleitet etwas, das sichtbar ist: der Verlaufssatz, die Wuerfelzahl, das
gebaute Teil, der Dialog. Der Stummschalter ist mit Tastatur erreichbar und
traegt `aria-pressed`; die Regler tragen `aria-label` und einen abgelesenen
Wert. Der Zahnrad-Knopf bekommt sichtbaren Fokus.

`prefers-reduced-motion` hat kein Gegenstueck fuer Ton; es gibt keine
Medienabfrage fuer „weniger Klang". Die Antwort darauf ist der Dialog.

## Was geprueft wird

| Prueffall                                                                       | Ort             | Umgebung |
| ------------------------------------------------------------------------------- | --------------- | -------- |
| `cueFor`: Zug → Cue, eigen vs. fremd, gedaempft vs. voll                        | client          | node     |
| Beide Erheber fuellen dieselbe `Situation` fuer denselben Vorgang               | client          | node     |
| `situationFromView`: bestohlen, Ertrag, „ich bin dran", Angebot an mich         | client          | node     |
| `voices`: jeder Cue hat ein Rezept; `dice.land` steigt mit der Augensumme       | client          | node     |
| Beide Reduzierer legen den richtigen Cue mit steigendem `seq` ab                | client          | node     |
| Einstellungen: laden, speichern, kaputter Inhalt, gesperrter Speicher           | client          | node     |
| Dialog: Regler bewegt, Stumm schaltet ohne den Wert zu verlieren                | client          | jsdom    |
| Delegierter Klick: Knopf klingt, `disabled` nicht, `data-sound` schlaegt durch  | client          | jsdom    |
| `move` ueberlebt Schema und Broadcast; drei Aufrufe ohne Uebergang senden keins | shared + server | node     |

**`engine.ts` bekommt keinen Test, und das ist Absicht.** Es gibt keinen
`AudioContext` in node; ein nachgebauter pruefte den Nachbau. Deshalb liegt
oberhalb davon alles, was entscheidet, und in `engine.ts` bleibt nur
Verdrahtung — die Datei ist bewusst dumm, damit ihr Ungeprueftsein billig ist.

## Abnahme

Gruen sind: `typecheck`, alle Tests, `build`, `format:check`.

Dazu — und **nicht** als offener Punkt, sondern als Bedingung — ein
Durchlauf im Browser mit Ohren:

1. Erster Klick auf dem Hauptmenue macht Ton; vorher keine Konsolenwarnung.
2. Eine lokale Partie: bauen, wuerfeln, Raeuber, Handel, Entwicklungskarte —
   jeder Klang sitzt auf seinem Ereignis und nicht daneben.
3. Zwei Fenster online: fremde Zuege sind hoerbar leiser, ein Angebot an mich
   ist es nicht.
4. Der Dialog: alle drei Regler, alle drei Stummschalter, Neuladen behaelt die
   Werte.
5. Das Zahnrad verdeckt in **keinem** Bildschirm etwas, auch nicht bei 396 px.

## Offene Punkte fuer spaeter

- Musik: Spur, Schleife, Uebergang zwischen Bildschirmen. Der Bus steht.
- Weitere Abschnitte im Einstellungen-Dialog (Sprache, Darstellung,
  „zwischen den Zuegen verdecken" koennte dorthin ziehen).
- Ein Klang fuer „Verbindung weg / wieder da" — gehoert eher zu einer
  Ueberarbeitung der Verbindungsanzeige als hierher.
