# Etappe 8 — Handel zwischen Spielern — Entwurf

Stand: 2026-08-12, Branch `etappe-4-online`, aufsetzend auf `903b327`.

## Das Problem

Handel gibt es in dieser Partie nur mit der Bank. `trade.ts` leitet den Kurs aus
den erreichbaren Haefen ab und haelt das Spiel damit am Laufen — wer fuenfzehn
Erz und kein Holz hat, verhungert nicht. Was fehlt, ist der Teil, der das
Brettspiel ueberhaupt zu einem Spiel zwischen Menschen macht: das Angebot ueber
den Tisch, das Feilschen, das Nein.

Entwicklungskarten waren der andere Teil von Etappe 8 und sind bereits gebaut
(siehe `PROGRESS.md`, Abschnitt „Entwicklungskarten — vorgezogen aus Etappe 8").
Diese Etappe traegt den Rest nach.

## Das Ziel

1. Der Spieler am Zug legt ein Angebot auf den Tisch: **ich gebe das, ich will
   das**.
2. Jeder Mitspieler antwortet — zusagen, ablehnen, oder ein **Gegenangebot**
   danebenlegen.
3. Der Anbieter waehlt aus, mit wem er tauscht, oder zieht zurueck.
4. Ein Angebot laeuft nach einer **Frist** ab, damit niemand den Zug blockieren
   kann, indem er nicht antwortet.
5. Wer die Verbindung verliert, blockiert nichts — sein Platz lehnt automatisch
   ab, und **kommt er zurueck, gilt diese Ablehnung nicht mehr**.
6. Das alles gilt lokal wie online. Ein Satz Bildschirme, zwei Quellen.

Nicht dabei: gerichtete Angebote an genau einen Spieler, Angebote ausserhalb des
eigenen Zugs, Entwicklungskarten im Tausch, Chat, Handelsstatistik,
Gegenangebot auf ein Gegenangebot.

## Entscheidungen, die vorab gefallen sind

**Das Angebot ist eine Phase, kein Feld daneben.** `phase.ts` beschreibt den
Zugablauf als Zustandsautomaten; ein offenes Angebot blockiert Bauen, Bankhandel,
Kartenkauf und Zugende. Stuende das Angebot als Feld neben `phase: 'main'`,
waere diese Sperre eine zweite Regel neben `PHASE_ACTIONS` — zwei Wahrheiten
ueber denselben Sachverhalt. Als Phase ist es ein Knoten mehr und keine
Ausnahme.

**Das Angebot lebt im `GameState`, nicht im Raum.** Der Gegenentwurf waere,
das Verhandeln im Server zu halten und nur den fertigen Tausch als Aktion zu
fuehren. Er scheitert dreifach: lokal gibt es keinen Raum (also keinen Handel),
ein Serverneustart verloere jedes offene Angebot, und der Server muesste die
Angebotsregeln ein zweites Mal auslegen — genau der Bruch, den die Aufteilung in
`can…`/`apply…` verhindert. Im Zustand stellt `replay` ein laufendes Angebot
nach einem Neustart wieder her, ohne dass Etappe 6 etwas dazulernen muss.

**Nur Rohstoffe, beide Seiten gefuellt.** Kein Verschenken (eine leere Seite),
keine Entwicklungskarten. Das ist die Brettspielregel; das Verschenken oeffnet
Absprachen zweier Spieler gegen den Rest, und eine getauschte Entwicklungskarte
muesste der Empfaenger vor dem Annehmen sehen — dann kennt er sie auch, wenn er
ablehnt.

**Wer nicht kann, sieht das allein.** Ein Mitspieler ohne die verlangten
Rohstoffe bekommt einen gesperrten Annehmen-Knopf mit Begruendung; der Tisch
sieht eine gewoehnliche Ablehnung. Ein sichtbares „kann nicht" waere eine
Aussage ueber eine verdeckte Hand und damit ein Bruch von Regel 4.

**Eine manuelle Antwort ist endgueltig.** Wer zugesagt, abgelehnt oder gekontert
hat, bleibt dabei. Sonst koennte ein Mitspieler seine Zusage im letzten Moment
zurueckziehen, und der Anbieter haelt einen Zuschlag auf etwas, das nicht mehr
gilt. Zurueckgenommen wird nur, was der Spieler nie gesagt hat — die
automatische Ablehnung bei Verbindungsverlust.

**Gegenangebote sammeln sich, sie ersetzen nicht.** Ein Gegenangebot ist die
Antwort dieses Spielers; das Originalangebot bleibt stehen, und der Anbieter
waehlt am Ende zwischen Zusagen und Gegenangeboten. Der Gegenentwurf
(Rollentausch: das Gegenangebot ersetzt das Original, der Anbieter wird zum
Antwortenden) laesst die uebrigen Spieler aus der Runde fallen und kann beliebig
hin- und hergehen.

**Zeit kommt als Daten herein, nie aus einer Uhr im Reducer.** Regel 2 verbietet
`Date.now()` in der Logik. Die Frist steht als `expiresAt` im Zustand, gespeist
aus einem `at`, das die Aktion mitbringt und **der Server stempelt**. Der Ablauf
selbst ist eine Aktion (`timeout`), gueltig nur, wenn die Frist wirklich um ist.
Damit bleibt der Reducer rein und `replay` deterministisch: der gestempelte Wert
steht im Aktionslog.

## Zustand

### Neue Phase in `packages/shared/src/game/phase.ts`

```ts
z.object({
  kind: z.literal('tradePending'),
  offer: TradeOfferSchema,
  /** Wer schon geantwortet hat. Wer fehlt, ueberlegt noch. */
  responses: z.record(PlayerIdSchema, TradeResponseSchema),
  /** Unix-ms. Wann das Angebot von selbst verfaellt. */
  expiresAt: z.number().int().min(0),
});
```

mit

```ts
TradeOfferSchema = z.object({
  from: PlayerIdSchema,
  give: ResourceAmountsSchema, // was der Anbieter hergibt
  want: ResourceAmountsSchema, // was er dafuer will
});

TradeResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('accepted') }),
  /** `automatic`: nicht gesagt, sondern durch Verbindungsverlust entstanden. */
  z.object({ kind: z.literal('declined'), automatic: z.boolean() }),
  /** Gegenangebot — die Mengen aus Sicht des Konternden. */
  z.object({
    kind: z.literal('countered'),
    give: ResourceAmountsSchema,
    want: ResourceAmountsSchema,
  }),
]);
```

Eine Antwort je Spieler und nicht zwei Listen nebeneinander: ein Gegenangebot
**ist** die Antwort dieses Spielers, und niemand kann gleichzeitig zusagen und
kontern.

Der Automat aus `phase.ts` bekommt genau einen Knoten dazu:

```
main ──(offerTrade)──► tradePending ──┬──(acceptTrade)────────► main
                                      ├──(withdrawTrade)──────► main
                                      ├──(timeout)────────────► main
                                      └──(alle lehnten ab)────► main
```

### `RuleSet` bekommt ein Feld

```ts
/** Wie lange ein Angebot auf dem Tisch liegt, in Millisekunden. */
tradeOfferMs: z.number().int().min(1_000).default(60_000),
```

**Der `.default` ist Pflicht, nicht Bequemlichkeit.** Seit Etappe 6 liegt das
RuleSet jeder laufenden Partie als JSON in der Datenbank. Ein Pflichtfeld ohne
Vorgabe liesse `GameStateSchema.safeParse` an jedem gespeicherten Spielstand
scheitern, und jede laufende Partie waere beim naechsten Serverstart weg — die
Datei sagt das bei `dice` und `robberRoll` selbst.

## Aktionen

Neun Stueck in `actions.ts`, drei davon nur vom Server:

| Aktion                            | Wer            | Phase          | Wirkung                                                |
| --------------------------------- | -------------- | -------------- | ------------------------------------------------------ |
| `offerTrade { give, want, at }`   | Spieler am Zug | `main`         | → `tradePending`, `expiresAt = at + tradeOfferMs`      |
| `respondTrade { response }`       | Mitspieler     | `tradePending` | zusagen oder ablehnen, endgueltig                      |
| `counterTrade { give, want, at }` | Mitspieler     | `tradePending` | Gegenangebot **und** neue Frist                        |
| `acceptTrade { partner }`         | Anbieter       | `tradePending` | Zuschlag, Mengen aus der Antwort des Partners → `main` |
| `withdrawTrade`                   | Anbieter       | `tradePending` | zurueckziehen → `main`                                 |
| `timeout { at }`                  | **Server**     | `tradePending` | nur gueltig bei `at >= expiresAt` → `main`             |
| `dropFromTrade { player }`        | **Server**     | `tradePending` | Verbindung weg → `declined, automatic: true`           |
| `rejoinTrade { player }`          | **Server**     | `tradePending` | zurueck → automatische Ablehnung faellt weg            |

`acceptTrade` schickt **keine Mengen** mit: bei einer Zusage gelten die des
Originalangebots (der Partner gibt `offer.want` und bekommt `offer.give`), bei
einem Gegenangebot dessen eigene (der Partner gibt `counter.give` und bekommt
`counter.want`). Der Zuschlag ist eine Absicht, kein Ergebnis — Regel 3,
dieselbe Begruendung wie beim abgeleiteten Bankkurs.

`timeout` traegt wie jede Aktion ein `player`-Feld: **wem die Frist gehoerte**,
hier also der Anbieter. Damit hat der Verlaufssatz ein Subjekt, und ein zweites
Zeitlimit spaeter benennt eben seinen eigenen Eigentuemer.

## Regeln

Neue Datei `packages/shared/src/game/playerTrade.ts`, nach dem Muster aller
Regeldateien: je `can…` (nur pruefen) und `apply…` (pruefen und anwenden),
und `legalActions` benutzt dieselben `can…`. **Nicht** in `trade.ts` hinein —
das ist Bank und Haefen, und eine Datei mit beidem waere die groesste
Regeldatei im Paket.

`canOfferTrade(state, player, give, want)`:

- Phase `main`, `player` ist am Zug, mindestens ein Mitspieler am Tisch.
- `give` und `want` je mindestens eine Karte (`INVALID_TRADE`).
- Keine Sorte auf beiden Seiten — sonst waere ein Teil des Tauschs ein
  Nichttausch (`INVALID_TRADE`).
- Der Anbieter besitzt `give` (`INSUFFICIENT_RESOURCES`).

`canRespondTrade(state, player, response)`:

- Phase `tradePending`, `player` ist nicht der Anbieter, hat noch nicht
  geantwortet (`ALREADY_RESPONDED`).
- Bei `'accepted'` zusaetzlich: `player` besitzt `offer.want`
  (`INSUFFICIENT_RESOURCES`). **Diese Pruefung entscheidet in `legalActions`
  nur ueber die eigene Liste des Spielers** — dadurch sieht niemand sonst, dass
  ihm etwas fehlt.

`canCounterTrade(state, player, give, want)`: wie `canRespondTrade`, dazu
dieselben Formregeln wie beim Angebot, gegen die Mengen des Konternden.

`canAcceptTrade(state, player, partner)`:

- `player` ist der Anbieter (`NOT_THE_OFFERER`).
- Die Antwort des Partners ist `accepted` oder `countered`
  (`PARTNER_DID_NOT_ACCEPT`).
- Beide Seiten koennen die faelligen Mengen aufbringen
  (`INSUFFICIENT_RESOURCES`). Waehrend `tradePending` kann sich daran nichts
  aendern; geprueft wird trotzdem, weil eine Regel, die sich auf eine andere
  verlaesst, beim naechsten Umbau still falsch wird.

`canWithdrawTrade(state, player)`: `player` ist der Anbieter.

`canTimeout(state, at)`: Phase hat eine Frist und `at >= expiresAt`.

### Zwei Automatismen

**Ein Angebot verfaellt von selbst**, wenn alle Mitspieler geantwortet haben,
keiner zugesagt oder gekontert hat, **und keine der Ablehnungen automatisch
war**. Steht auch nur eine automatische darunter, bleibt es bis zur Frist offen
— sonst toetet ein Verbindungsabbruch von zwei Sekunden genau das Angebot, das
gerade wiederkommen sollte.

**`rejoinTrade` nimmt nur automatische Ablehnungen zurueck.** Eine von Hand
gesprochene Ablehnung ueberlebt jedes Weg und Wieder-da.

### Reducer

`PHASE_ACTIONS` bekommt eine Zeile fuer `tradePending`; `main` bekommt
`offerTrade` dazu. `actorFor` gibt fuer `tradePending` `null` zurueck — dieselbe
Ausnahme, die `discardPending` seit Etappe 2 hat: es handeln mehrere, und wer
genau darf, prueft die Regeldatei.

`finalize` bleibt unveraendert. Ein Tausch kann keine Siegpunkte bringen, aber
die Nacharbeit an einer Stelle zu lassen ist billiger als eine Ausnahme.

### Neue Ablehnungsgruende in `errors.ts`

| Code                     | Fall                                               |
| ------------------------ | -------------------------------------------------- |
| `NOT_THE_OFFERER`        | jemand anderes will zuschlagen oder zurueckziehen  |
| `ALREADY_RESPONDED`      | zweite Antwort desselben Spielers                  |
| `PARTNER_DID_NOT_ACCEPT` | Zuschlag an jemanden ohne Zusage oder Gegenangebot |
| `DEADLINE_NOT_REACHED`   | `timeout`, obwohl die Frist noch laeuft            |

Wiederverwendet werden `INVALID_TRADE` (leere Seite, Sorte auf beiden Seiten,
Angebot an sich selbst), `INSUFFICIENT_RESOURCES` und `WRONG_PHASE`.

## Zeit als Infrastruktur

Nicht als Trade-Sonderfall gebaut, sondern so, dass ein zweites Zeitlimit
(Abwurffrist, Zugzeit) ein Feld und eine Zeile kostet.

**In `shared`:**

```ts
/** Die laufende Frist und wem sie gehoert. `null`, wenn gerade keine laeuft. */
export function deadlineOf(state: GameState): { at: number; owner: PlayerId } | null;
```

Liest heute genau eine Phase. Eine weitere Frist ergaenzt hier einen Zweig.

**Im Server** — neue Datei `apps/server/src/rooms/clock.ts`:

- Nach jedem Zustandswechsel und beim Laden eines Raums aus der Datenbank:
  `deadlineOf` lesen, laufenden `setTimeout` verwerfen, neuen stellen.
- Beim Faelligwerden: `timeout` ueber `applySystemAction` einwerfen, Zug ins
  Log, `broadcastGame`.
- Eine beim Laden **laengst abgelaufene** Frist ist sofort faellig — nach einem
  Neustart raeumt der erste Weckerlauf das Angebot ab.
- Beim Schliessen eines Raums wird der Wecker abgeraeumt; ein Timer auf einen
  verschwundenen Raum ist ein Speicherleck.

**Der Zeitstempel kommt vom Server, immer.** `applyAction` ueberschreibt `at`
mit der eigenen Uhr, bevor `reduce` laeuft und bevor der Zug im Aktionslog
landet. Ein Client, der sich eine Frist von zehn Minuten stempelt, hat keine
Wirkung. Weil der ueberschriebene Wert geloggt wird, gibt `replay` exakt
dieselbe Frist zurueck. In der lokalen Partie stempelt `useHotseatGame` selbst —
dort ist niemand zu betruegen.

**Die drei Serveraktionen sind fuer Clients gesperrt.** `applyAction` prueft
heute schon „der Absender ist der, fuer den er sich ausgibt"; `dropFromTrade`
und `rejoinTrade` sprechen aber _ueber_ einen anderen Spieler, und `timeout` ist
niemandes Absicht. Sie laufen ueber einen zweiten Eingang
`applySystemAction(room, action)` ohne Absenderpruefung, und der Handler in
`ws/handlers/room.ts` weist sie ab, wenn sie von aussen kommen.

**Verbindungsverlust und Rueckkehr** haengen dort, wo `connected` heute
umgeschaltet wird: faellt ein Sitz waehrend `tradePending` weg, wirft der Server
`dropFromTrade` ein; kommt er zurueck und das Angebot steht noch, `rejoinTrade`.

## Protokoll

`GameEventSchema` bekommt ein Feld:

```ts
/** Serveruhr beim Senden. Der Client rechnet daraus seinen Versatz. */
sentAt: z.number().int().min(0),
```

Ohne das zeigte eine um zwei Minuten falsch gehende Rechneruhr eine Frist, die
laengst abgelaufen ist — oder eine, die nie endet. Der Client rechnet den
Versatz je Ereignis neu und stellt `expiresAt` in seiner eigenen Zeit dar.

Sonst aendert sich am Protokoll nichts: Zuege gehen als `GameAction` hinaus,
`broadcastGame` baut ohnehin je Empfaenger `PlayerView` und `legalActions`.

## Sicht und Oberflaeche

### `PlayerView`

Ein Feld dazu: `canOfferTrade: boolean`. Es beantwortet die Frage ohne Mengen
(„duerfte dieser Spieler jetzt ueberhaupt anbieten?") und ist damit eine eigene,
schlankere Pruefung neben `canOfferTrade(state, player, give, want)`: Phase
`main`, am Zug, mindestens ein Mitspieler, mindestens eine eigene Karte. Die
Formregeln bleiben bei der Mengenpruefung — hier gibt es noch keine Mengen.

`legalActions` zaehlt `offerTrade`
**nicht** auf — jede Mengenkombination ueber fuenf Sorten waeren Tausende
Eintraege, dieselbe Begruendung wie beim Abwerfen und beim Strassenbau. Der
Client bekommt „du duerftest jetzt anbieten", die Mengen waehlt der Spieler, und
ob sie zulaessig waren, prueft der Reducer.

Alles Uebrige steht schon in der Sicht: `phase` traegt Angebot, Antworten und
Frist. Beides ist oeffentlich — was jemand am Tisch laut zusagt, ablehnt oder
danebenlegt, ist keine verdeckte Information.

In `tradePending` ist `legalActions` klein und vollstaendig aufzaehlbar: je
noch nicht Geantwortetem zwei `respondTrade`, fuer den Anbieter je moeglichem
Partner ein `acceptTrade` plus `withdrawTrade`. `counterTrade` wird wie
`offerTrade` nicht aufgezaehlt.

### Client

**`TradeDialog` bekommt zwei Reiter**, „Bank" und „Spieler" — so, wie es der
Kommentar in der Datei seit Etappe 3 ankuendigt. Der Spieler-Reiter ist
zweispaltig: links „Ich gebe" (Menge je Sorte, nach oben durch den eigenen
Besitz begrenzt), rechts „Ich moechte". Die Sperre am Knopf sagt, was fehlt.

**Neu: `TradeOfferDialog`**, sichtbar, sobald die Phase `tradePending` ist —
nicht hinter einem Knopf, denn die Phase blockiert ohnehin alles andere. Zwei
Rollen in einer Datei:

- **Mitspieler**: das Angebot, dazu _Annehmen_ (ggf. gesperrt mit „dir fehlt 1
  Erz", und **nur er sieht das**), _Ablehnen_, _Gegenangebot_ (klappt dieselbe
  Mengenauswahl auf wie der Spieler-Reiter).
- **Anbieter**: die Antwortliste seiner Mitspieler mit den Mengen jedes
  Gegenangebots, je Zusage und Gegenangebot ein Zuschlagknopf, dazu
  _Zurueckziehen_.

Beide sehen den Countdown bis `expiresAt`.

**Hotseat**: `actingPlayers` (`game/view.ts`) liefert bei `tradePending` erst
die, die noch nicht geantwortet haben, danach den Anbieter. Der Bildschirm
wandert damit von selbst durch die Runde und kommt zum Auswaehlen zurueck —
dieselbe Mechanik wie beim Abwerfen nach einer Sieben, kein neuer Weg.
`useHotseatGame` bekommt denselben Wecker wie der Server und stempelt `at`
selbst; sonst zeigte die lokale Partie einen Countdown, der nie ausloest.

**Verlauf** (`log.ts`), ein Satz je neuer Aktion — der `switch` in
`describeAction` ist erschoepfend, es sind also alle neun: anbieten, zusagen,
ablehnen, kontern, zuschlagen, zurueckziehen, Frist abgelaufen, weggebrochen,
zurueck am Tisch. Das Verfallen eines Angebots, das niemand wollte, haengt
dagegen am letzten Ablehnungssatz — abgelesen am Phasenwechsel
`tradePending → main`, derselbe Kniff wie beim Siegsatz, statt eines eigenen
Zweigs.

**Design**: keine neuen Hex-Werte, Mengen und Countdown in Tabellenziffern, als
einzige Bewegung ein Eingang fuer den Angebotsdialog. Keine Ausgangsanimation —
die waere bei `prefers-reduced-motion` von Anfang an unsichtbar.

**Nebenwirkung, die richtig ist:** `summary.ts` liest `yourTurn` aus
`legalActions().length > 0`. Ein offenes Angebot macht die Partie damit in
„Deine Partien" fuer alle Mitspieler zu einer, die auf sie wartet — genau das
stimmt ja auch.

## Tests

**`shared`** — neue Logik bekommt Tests (Arbeitsweise):

- `playerTrade.test.ts` (neu): jede Angebotsform, die abgelehnt gehoert (leere
  Seite, Sorte auf beiden Seiten, nicht besessen, an sich selbst); doppelte
  Antwort; Zuschlag ohne Zusage; Verfallen, wenn alle von Hand ablehnen; **kein**
  Verfallen, wenn eine Ablehnung automatisch war; beim Zuschlag wechseln genau
  die richtigen Mengen und **die Bank bleibt unberuehrt**; Zuschlag auf ein
  Gegenangebot bewegt dessen Mengen und nicht die des Originals.
- Frist: `timeout` vor Ablauf wird abgelehnt (`DEADLINE_NOT_REACHED`), nach
  Ablauf angenommen; `counterTrade` setzt `expiresAt` neu; `deadlineOf` liefert
  Frist und Eigentuemer.
- `dropFromTrade` + `rejoinTrade` heben sich auf; eine manuelle Ablehnung
  ueberlebt beides.
- `reducer.test.ts`: `tradePending` sperrt Bauen, Bankhandel, Kartenkauf und
  Zugende.
- `legal.test.ts`: was in `tradePending` aufgezaehlt wird — und dass
  `respondTrade` mit `'accepted'` nur bei dem auftaucht, der es leisten kann
  (die Geheimhaltungsgrenze als Test, nicht als Zusage).
- `playerView.test.ts`: `canOfferTrade`; Angebot, Antworten und Frist sind
  oeffentlich, Handkarten weiterhin nicht.
- `log.test.ts`: die sieben Saetze plus den Verfallssatz.
- `game.integration.test.ts`: eine durchgespielte Partie mit einem
  Spielerhandel darin.

**`server`**:

- `roundtrip.test.ts`: ein offenes Angebot uebersteht `replay` — der Test, der
  „Angebot im Zustand" gegen „Angebot im Raum" begruendet hat.
- Neustart mit abgelaufener Frist: der erste Weckerlauf beendet das Angebot.
- `clock.ts`: Wecker wird gestellt, umgestellt (Gegenangebot) und beim
  Raumschluss abgeraeumt.
- Ein Client, der `timeout`, `dropFromTrade` oder `rejoinTrade` selbst schickt,
  wird abgewiesen.
- `applyAction` ueberschreibt ein mitgeschicktes `at`.

**`client`**:

- `dialogs.test.tsx`: zweiter Reiter, gesperrtes Annehmen mit Begruendung,
  Gegenangebot-Formular, Zuschlagknopf je Antwort.
- `view.test.ts`: `actingPlayers` in `tradePending`.
- Hotseat: der Bildschirm wandert durch die Antwortenden und zurueck zum
  Anbieter.
- Der Countdown rechnet mit dem Versatz aus `sentAt`.

## Abnahme

Wie in `PROGRESS.md` vorgeschrieben, mit **gemessenen** Zahlen: `pnpm
typecheck`, `pnpm test` (Zahlen je Paket), `pnpm build` (Bundlegroesse), `pnpm
format:check`. Dazu ein Durchlauf im Browser mit zwei Fenstern: Angebot,
Gegenangebot, Zuschlag, Frist ablaufen lassen, und ein Fenster mitten im
Angebot schliessen und wieder oeffnen.

## Offene Punkte, die bleiben

- **Verliert der Anbieter die Verbindung, steht die Partie**, bis er
  wiederkommt. Das ist heute schon so, wenn jemand mitten in `main`
  verschwindet, und wird hier nicht geloest — die Frist raeumt zwar das Angebot
  ab, aber der Zug bleibt bei ihm.
- **Kein Gegenangebot auf ein Gegenangebot.** Der Anbieter entscheidet, oder es
  verfaellt.
- **Kein Handel ausserhalb des eigenen Zugs.** Wer nicht am Zug ist, kann nichts
  anbieten, nur antworten.
- **Die Frist gilt fuer das Angebot, nicht fuer den Zug.** Wer gar nichts tut,
  blockiert die Partie weiterhin unbegrenzt — das braeuchte eine Zugzeit, und
  die Infrastruktur dafuer steht mit dieser Etappe bereit.
- **`tradeOfferMs` ist je RuleSet fest**, nicht je Raum einstellbar. Ein
  Schalter in der Lobby waere die naechste Stufe.

## Naechste Etappe

**Etappe 9 — Docker und Coolify.** Damit wird der Server oeffentlich
erreichbar; die beiden Punkte, die in Etappe 7 dafuer vorgemerkt wurden
(Rate-Limit auf `auth.login`, Sitzungsablauf), gehoeren dann dazu.
