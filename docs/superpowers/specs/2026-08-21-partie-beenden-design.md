# Partie verlassen und Partie beenden

Stand: 2026-08-21, `main` (`db4011f`).

Zwei Dinge, die im Einstellungen-Dialog fehlen und beide damit zu tun haben, wie
eine Partie aufhört: **weggehen** und **aufhören**. Sie sehen verwandt aus und
sind es nicht — das eine betrifft nur den, der es tut, das andere alle.

## Was es heute gibt

**Verlassen gibt es schon, es ist nur unsichtbar.** `leaveRoom` in
`apps/server/src/rooms/room.ts:191` unterscheidet bereits die zwei Fälle: im
Wartebereich wird der Platz frei, in einer laufenden Partie nicht — „der
Spielzustand kennt diesen Spieler, und ihn herauszunehmen hieße, die Partie zu
zerstören. Er gilt dann nur als getrennt." Das ist richtig und bleibt. Es fehlt
nur der Knopf und der Satz, der es sagt.

**Aufhören gibt es nicht.** Eine Partie endet heute ausschließlich damit, daß
jemand gewinnt. Wer zu fünft anfängt und nach zwei Stunden merkt, daß es nicht
mehr wird, hat keine Möglichkeit außer wegzugehen — und die Partie bleibt für
alle unter „Deine Partien" stehen.

## Die Entscheidungen

| Frage                     | Antwort                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Wer muß zustimmen         | **Alle** — der Reducer prüft „jeder hat gestimmt", der Server stimmt für Abwesende mit Ja |
| Frist                     | **60 Sekunden**, danach gescheitert                                                       |
| Wer darf auslösen         | **Jeder**, unabhängig vom Zug — aber nur eine zur Zeit                                    |
| Was die Partie danach ist | **Abgebrochen**, ohne Sieger, mit Statistiken                                             |
| Was „verlassen" tut       | **Wie heute** — getrennt, Platz bleibt, Partie läuft weiter                               |

Ein Nein beendet die Abstimmung sofort. Schweigen ist keine Zustimmung: läuft
die Frist ab, ohne daß alle geantwortet haben, ist sie gescheitert.

## Der Entwurf

### 1. Die Abstimmung ist ein Feld und blockiert nicht

`tradePending` ist eine Phase, und `phase.ts:58` begründet das genau:

> Als Phase und nicht als Feld daneben: daß während eines Angebots nicht gebaut
> wird, ist damit dieselbe Regel wie jede andere Phasensperre und keine zweite
> Wahrheit neben `PHASE_ACTIONS`.

Für die Abstimmung gilt diese Begründung **nicht**, denn sie soll nichts
sperren. Wer abstimmen läßt, während ein anderer seinen Zug überlegt, soll ihm
den Zug nicht einfrieren; und scheitert die Abstimmung, ist nichts verloren und
niemand hat gewartet.

Also ein Feld neben der Phase:

```ts
export const EndVoteSchema = z.object({
  /** Wer gefragt hat. Er zählt als Ja, ohne noch einmal zu stimmen. */
  from: PlayerIdSchema,
  /** Wer schon gestimmt hat. Wer fehlt, überlegt noch. */
  votes: z.record(z.string(), z.boolean()),
  /** Unix-ms. Wann die Frage von selbst verfällt. */
  expiresAt: z.number().int().min(0),
});
```

Und weil sie nie etwas sperrt, entsteht auch keine zweite Wahrheit neben
`PHASE_ACTIONS`. Die Regel dort lautet „was in dieser Phase gehen darf"; die
Abstimmung fügt keine Ausnahme hinzu, sondern eine Aktion, die von der Phase
unabhängig ist.

**Der Preis, offen benannt.** `PHASE_ACTIONS` ist eine Whitelist je Phase
(`reducer.ts:47`), und direkt danach prüft `actorFor`, ob der Absender überhaupt
handeln darf. Drei Aktionen müssen an beidem vorbei:

- `proposeEndGame` — in jeder Phase, von jedem Spieler
- `voteEndGame` — dito
- `dropFromEndVote` — nur vom Server

Das kostet am Gate eine Konstante und zwei Zeilen: eine Menge `ALWAYS_ALLOWED`,
die vor der Phasenprüfung greift, und ein Übergehen der Sprecherprüfung für
genau diese drei.

**Die Alternative wäre teurer.** Eine blockierende Phase `endVotePending` müßte
sich merken, wohin sie zurückkehrt, wenn die Abstimmung scheitert — also
`resume: Phase` innerhalb von `PhaseSchema`. Ein Zod-Schema, das sich selbst
enthält, braucht `z.lazy` und verliert dabei die Typinferenz, die überall sonst
in `shared` trägt. Zwei Zeilen am Gate sind der kleinere Preis.

**Die Regeln, in Sätzen** — damit sie nicht auf jedem Bildschirm neu ausgelegt
werden. Jede bekommt ihr `canProposeEndGame` / `applyProposeEndGame`-Paar, wie
jede andere Regel in `shared`:

| Lage                                                       | Was gilt                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `endVote === null`, Phase ist nicht `finished`/`abandoned` | jeder Spieler darf fragen                                               |
| `endVote !== null`                                         | eine zweite Frage wird abgewiesen — eine zur Zeit                       |
| jemand stimmt mit Nein                                     | `endVote` fällt sofort auf `null`, die Partie läuft weiter              |
| alle haben mit Ja gestimmt                                 | Phase wird `abandoned`                                                  |
| `timeout` auf die Frist                                    | `endVote` fällt auf `null`, gescheitert                                 |
| jemand stimmt zweimal                                      | abgewiesen, wie `respondTrade` es hält                                  |
| Phase wird `finished`                                      | `endVote` fällt auf `null` — jemand hat gewonnen, das schlägt die Frage |

Der letzte Fall ist der, den man übersieht: eine Abstimmung läuft, und während
sie läuft, erreicht jemand die Siegpunkte. Ein Sieg beendet die Partie ohne
Frage, und die offene Abstimmung wäre danach ein Zettel auf einem geräumten
Tisch. Sie fällt an derselben Stelle weg, an der `finished` gesetzt wird — nicht
in einem eigenen Zweig, sonst wird es beim nächsten Siegweg vergessen.

### 2. Wer verbunden ist, weiß der Reducer nicht — und soll es nicht wissen

„Einstimmig unter den Verbundenen" klingt nach einer Regel und ist eine Falle:
Verbindung ist Raumwissen, kein Spielwissen, und der Reducer ist rein (Regel 2).
Er darf niemanden fragen, wer gerade online ist.

Das Vorbild steht schon da. Drei Aktionen kommen **nur** vom Server —
`timeout`, `dropFromTrade`, `rejoinTrade` —, laufen über `applySystemAction`
ohne Absenderprüfung, und der ACT-Handler weist sie ab, wenn ein Client sie
schickt. `dropFromEndVote` reiht sich dort ein: geht jemand während einer
laufenden Abstimmung, wirft der Server die Aktion ein, und der Reducer trägt
sie als **Ja** ein.

Als Ja und nicht als Enthaltung, weil es das ehrlichere Bild ist: wer die Partie
verlassen hat, spielt sichtbar nicht mehr mit, und ihn als offenen Posten zu
führen hieße, eine Abstimmung an jemandem scheitern zu lassen, der gar nicht
mehr da ist.

**Die Regel im Reducer ist damit einfacher, als die Überschrift klingt.** Er
prüft nicht, wer verbunden ist — er prüft, ob **alle** gestimmt haben. Genau so
macht es der Handel: `playerTrade.ts:234` liest

```ts
const complete = others.every((entry) => responses[entry.id] !== undefined);
```

und weiß nichts von Verbindungen. Das Wort „unter den Verbundenen" beschreibt,
was der Server dazutut, nicht was der Reducer prüft.

**Und hier steckt eine Falle, die der Handel nicht hat.** Der Server wirft
`dropFromTrade` **nur im Augenblick des Trennens** ein
(`ws/handlers/room.ts:363`). Wer schon vorher weg war, als das Angebot aufkam,
wird nicht erfaßt — beim Handel fängt das die Frist ab, es gibt ja noch andere
Ausgänge. Bei Einstimmigkeit nicht: **ein einziger schon abwesender Spieler
läßt jede Abstimmung in die Frist laufen**, jedesmal, und niemand sieht warum.

Deshalb braucht `proposeEndGame` serverseitig einen **Durchgang beim Öffnen**:
für jeden Sitz, der gerade nicht verbunden ist, wird sofort ein
`dropFromEndVote` nachgeschoben. Nicht im Reducer — der weiß es nicht — sondern
an derselben Stelle, an der der Server die Abstimmung entgegennimmt.

**Ein Gegenstück gibt es bewußt nicht.** `rejoinTrade` nimmt eine automatische
Ablehnung zurück, wenn jemand wiederkommt — bei der Abstimmung wäre das falsch
herum: eine Zustimmung zurückzunehmen, die zur Beendigung geführt haben könnte,
ginge nicht mehr, weil die Partie dann schon abgebrochen ist. Wer während seiner
Abwesenheit „mitgestimmt" hat, findet die Partie beendet vor. Das ist die Folge
davon, gegangen zu sein.

### 3. Die Frist kostet einen Zweig **und einen Vergleich**

`deadline.ts` sagt, ein zweites Zeitlimit „ergänzt hier einen Zweig und sonst
nichts". Das stimmt fast. Weil die Abstimmung nicht blockiert, können ein
Handelsangebot und eine Abstimmung **gleichzeitig** laufen — und `deadlineOf`
gibt genau eine Frist zurück, weil der Wecker im Server genau eine kennt.

Sie muß deshalb die **frühere** von beiden liefern. Ein Zweig plus ein
Vergleich, und der Kommentar dort wird richtiggestellt: der Satz stimmte,
solange sich Fristen gegenseitig ausschlossen.

Der Ablauf selbst ist eine gewöhnliche Aktion (`timeout`), wie beim Handel. Wem
die Frist gehört, sagt `owner` — hier der, der gefragt hat.

### 4. `abandoned` neben `finished`

```ts
z.object({ kind: z.literal('abandoned') }),
```

Eine eigene Phase ohne Sieger, statt `winner` optional zu machen. Der
Unterschied ist der Aufwand an den bestehenden Stellen: ein optionales `winner`
zwingt **jede** Stelle, die es heute liest, den leeren Fall zu lernen; eine neue
Phase zwingt nur die Stellen, die alle Phasen aufzählen, die neue zu kennen —
und die sind gezählt.

**Eine Stelle, die sonst still kaputtginge.** `MY_ROOMS` in
`apps/server/src/ws/handlers/room.ts` filtert heute:

```ts
.filter((room) => room.game?.phase.kind !== 'finished')
```

mit dem Kommentar „Beendete Partien fallen aus der Liste — sie bleiben in der
Datenbank, aber niemand kann dort weitermachen." Genau das gilt für abgebrochene
auch. Ohne Nachziehen stünde jede abgebrochene Partie für immer unter „Deine
Partien" — und der Eintrag führte in ein Spiel, das keine Aktion mehr annimmt.

`PHASE_ACTIONS` bekommt `abandoned: []`, wie `finished`.

### 5. Die Statistik ist eine reine Funktion aus dem Endstand

```ts
export function statisticsOf(state: GameState): readonly PlayerStatistic[];
```

Was der Zustand hergibt, ohne eine einzige neue Buchführung: Siegpunkte,
Siedlungen, Städte, Straßen, längste Handelsstraße, gespielte Ritter, Karten auf
der Hand — dazu die Rundenzahl für die Partie als Ganzes.

**Warum nicht mehr.** Würfelverteilung, geerntete Rohstoffe und Handelsbilanz
stehen nicht im Zustand; sie ließen sich aus der Aktionsliste rechnen, und die
liegt in beiden Modi vollständig vor (`hotseat.ts:73` sammelt sie lokal, online
hält sie der Server als Action-Log). Das ist ausdrücklich **später** und nicht
jetzt — die Funktion nimmt heute nur den Zustand, und ein zweiter Parameter ist
dann eine Erweiterung und kein Umbau.

Sie steht in `shared`, weil sie eine Auswertung des Spielzustands ist und keine
Anzeige: dieselbe Zahl soll im Browser und in einem Test dasselbe sein.

### 6. Der Abschlußbildschirm trägt beide Ausgänge

`GameScreen` zeigt heute bei `finished` eine Liste „Name: n Siegpunkte". Sie
wird eine Tabelle und trägt beide Fälle:

- **Gewonnen** — der Sieger steht oben und ist als solcher benannt.
- **Abgebrochen** — kein Sieger, und das steht auch da. Wer die meisten Punkte
  hat, steht oben, aber ohne das Wort „gewonnen"; die Partie ist nicht zu Ende
  gespielt worden, und die Tabelle soll nicht so tun als ob.

Die Zahlen darin sind Tabellenziffern (Regel 3) — es ist der eine Bildschirm im
Spiel, auf dem ausschließlich Zahlen verglichen werden.

### 7. Der Einstellungen-Dialog bekommt einen zweiten Abschnitt

Heute steht dort nur „Ton". Der Dialog ist der richtige Ort — sein eigener
Kommentar sagt es: „Weitere Abschnitte kommen hier dazu, nicht daneben."

Der Abschnitt „Partie" erscheint **nur in einer laufenden Partie** und enthält:

- **Partie verlassen** — mit dem Satz, der bisher fehlte: die anderen spielen
  weiter, dein Platz bleibt, du kannst zurückkommen.
- **Abstimmen: Partie beenden** — gesperrt, solange schon eine Abstimmung läuft,
  und der gesperrte Zustand sagt warum. (Falle aus `CLAUDE.md`: `disabled`
  allein sieht man an einem Knopf mit eigenem Hintergrund nicht — es braucht
  eine Regel für den Zustand, und danach wird nachgemessen, daß man sie sieht.)

**Lokal gibt es keine Abstimmung.** Sechs Leute an einem Bildschirm einstimmig
abstimmen zu lassen ist Theater. Dort steht „Partie beenden" und tut es sofort;
`abandoned` ist derselbe Ausgang, nur ohne den Umweg.

### 8. Die Abstimmung ist zu sehen, während sie läuft

Ein Dialog, der nur im Einstellungen-Fenster steht, wird von niemandem
beantwortet — man hat es zu. Die laufende Abstimmung braucht deshalb eine
Anzeige auf dem Spielbildschirm selbst: wer gefragt hat, wie viele noch fehlen,
die zwei Antworten, und die ablaufende Frist.

Die Form dafür gibt es schon: `TradeOfferDialog` ist genau das — eine Frage an
alle mit Frist und Antwortknöpfen. Die Abstimmung benutzt dieselbe Sprache, aber
**nicht denselben Dialog**: der Handel blockiert, die Abstimmung nicht, und ein
modaler Kasten über dem Brett würde sie zu einer Sperre machen, die sie nicht
ist. Sie gehört als Leiste dorthin, wo auch der Bauhinweis steht.

## Was daran neu ist und was nicht

| Teil                                   | Vorbild im Code              |
| -------------------------------------- | ---------------------------- |
| Antworten je Spieler sammeln           | `tradePending.responses`     |
| Frist im Zustand, Server stempelt      | `expiresAt` + `stampAction`  |
| Ablauf als gewöhnliche Aktion          | `timeout` + `rooms/clock.ts` |
| Verbindungsverlust in die Logik tragen | `dropFromTrade`              |
| Phase ohne weitere Aktionen            | `finished`                   |
| Auswertung als reine Funktion          | `playerView.ts`, `log.ts`    |

**Wirklich neu sind zwei Dinge:** eine Aktion, die in jeder Phase gilt, und eine
Frist, die neben einer anderen laufen kann. Alles übrige ist eine zweite
Anwendung von etwas, das schon steht.

## Reihenfolge

1. **`shared`** — `EndVote`, die drei Aktionen, `abandoned`, die Regeln, die
   Statistik. Mit Tests, wie jede neue Logik in `shared`.
2. **`deadlineOf`** — der Zweig und der Vergleich.
3. **Server** — `dropFromEndVote` beim Trennen, `MY_ROOMS`-Filter, der Wecker.
4. **Client** — der Abschnitt im Dialog, die Leiste auf dem Bildschirm, der
   Abschlußbildschirm.
5. **Lokal** — „Partie beenden" ohne Abstimmung.

Schritt 1 trägt alles Weitere: solange die Regeln nicht stehen, hätte jeder
Bildschirm darüber eine eigene Auslegung, und der Client kennt keine Regel.

## Was dieser Entwurf offenläßt

- **Was eine abgebrochene Partie in der Datenbank ist.** Sie bleibt liegen wie
  eine beendete; ob es je ein Aufräumen gibt, ist keine Frage dieses Entwurfs.
- **Ob man eine abgebrochene Partie ansehen kann.** Der Abschlußbildschirm
  erscheint für die, die dabei sind. Wer später zurückkommt, findet sie nicht
  mehr in „Deine Partien" — die Statistik ist dann weg, obwohl der Zustand in
  der Datenbank steht. Das ist bewußt vertagt und kein Versehen.
- **Der Verlauf über die ganze Partie.** Würfelverteilung, Ernte, Handelsbilanz
  — die Aktionsliste trägt sie, `statisticsOf` fragt heute nicht danach.
