# UI und UX — der nachgeholte Browser-Durchlauf und die Richtung danach

Stand: 2026-08-16, `main` (`dd3d467`), Chrome gegen `pnpm dev`.

Dies ist die Abnahme, die in Etappe 7, 8, 9 und in beiden Playtest-Runden
liegengeblieben ist: die Oberflaeche im Browser angesehen, mit den Haenden
durchgespielt und nachgemessen. Und weil ohnehin eine Ueberarbeitung ansteht,
steht hinter jedem Befund nicht nur „ist kaputt", sondern was daraus fuer die
Gestaltung folgt.

## Wie gemessen wurde

Client auf `5173`, Server auf `8080`, Fenster `1920x889`. Eine lokale Partie zu
dritt komplett durch die Gruendung gespielt, gewuerfelt, Handel geoeffnet, mit
Escape geschlossen; danach online einen Raum erstellt, Farbe gewechselt,
Siegpunktziel verstellt. Die schmalen Breiten ueber zwei Iframes (`896` und
`396` CSS-Pixel), weil das Fenster maximiert war und `resize` nicht griff —
Media Queries reagieren im Iframe auf dessen Breite, das genuegt.

## Was die offenen Vermutungen jetzt sagen

Vier Punkte standen in `PROGRESS.md` als „begruendet, aber ungesehen". Alle vier
sind jetzt gesehen.

| Vermutung                                   | Ergebnis                                                              |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Heisse Chips sind rot                       | **Stimmt.** 4 Chips tragen `chip__hot`, die Punktreihe faerbt mit     |
| Die Kontur macht Kuestenstrassen sichtbar   | **Stimmt.** Rot und Blau stehen klar gegen die dunkle See             |
| Kreuz und Escape schliessen jeden Dialog    | **Stimmt.** Escape schliesst, der Fokus kehrt auf einen Knopf zurueck |
| `.panel`-Deckel bricht die Ablage als Zeile | **Stimmt, und es ist schlimmer als vermutet** — siehe B1              |

Dazu nebenbei bestaetigt: nach der ersten Siedlung werden **50 von 54** Knoten
gezeichnet — die Abstandsregel greift und zeigt nur, was erlaubt ist. Der freie
Platz im Wartebereich traegt keine Farbe mehr. Farbwahl und Siegpunktziel
funktionieren, und der Hinweis unter der Zahl wechselt von „Zehn wie in der
Schachtel" auf „Zwischen 5 und 20 — zehn sind die Vorgabe", sobald man abweicht.
Das ist genau die Art Detail, die stehenbleiben soll.

## Befunde

Sortiert nach Gewicht, nicht nach Fundort.

### B1 — Der Spielbildschirm hat keine einzige Media Query

Der schwerste Befund, und er war in keiner der beiden Runden auf dem Zettel.

Im ganzen Blatt stehen drei `@media`-Bloecke: `prefers-reduced-motion`, `62rem`
(Startbildschirm einspaltig) und `26rem` (Konto-Ecke). **Fuer den
Spielbildschirm gibt es keine.** Er ist ein absolut positioniertes Layout mit
festen Einzuegen, gebaut fuer ungefaehr die Breite, auf der er entstanden ist.

Gemessen:

| Breite  | Brett-SVG | Ablage     | Kollision                                  |
| ------- | --------- | ---------- | ------------------------------------------ |
| 1920 px | 1424x701  | 1660 breit | keine                                      |
| 896 px  | 400x668   | 636 breit  | knapp keine                                |
| 396 px  | **0x668** | 136 breit  | Status ueber Ablage, x 152–244 / y 766–844 |

Bei 396 px ist das Brett **null Pixel breit** — es steht mit festem `left` und
festem `right`, der Rest ist negativ und wird auf null geklemmt. Das Spiel ist
auf einem Telefon nicht schlecht bedienbar, es ist unsichtbar. Und das
Statusfeld liegt auf der Ablage.

**Was daraus folgt.** Nicht Breakpoints nachruesten, sondern die Traegerschicht
tauschen. Der Spielbildschirm will ein Grid mit benannten Bereichen
(`tisch / brett / verlauf` ueber `ablage / status`), in dem das Brett die
einzige Zelle mit `1fr` ist. Dann ist „schmal" eine andere Zeilenaufteilung
statt einer Rechnung mit Einzuegen, und die Panels koennen sich nicht mehr
ueberlagern, weil sie in Zellen liegen und nicht auf Koordinaten.

### B2 — `.button--ghost` ist auf Pergament unsichtbar

```css
.button--ghost {
  background: transparent;
  border-color: rgb(233 225 207 / 30%);
  color: var(--on-sea); /* #e9e1cf — Tinte fuer die dunkle See */
}
```

Auf Pergament (`#f0e6d2`) ergibt das **1,05:1**. Nicht schwach lesbar —
unlesbar. Betroffen sind unter anderem „Abbrechen" in jedem Dialog und „Karten
ansehen" auf der Hand; von den 20 Verwendungen stehen rund **zehn auf hellem
Grund**, der Rest auf der See und ist in Ordnung.

Das Bittere daran: der Fehler ist bereits diagnostiziert worden. Im Kommentar
ueber `.button--yes` steht woertlich, der dritte Antwortknopf sei „auf Pergament
praktisch unsichtbar" gewesen. Repariert wurden die drei Antwortknoepfe — die
Klasse, die den Fehler traegt, blieb wie sie war. Genauso wurde fuer `--ok`,
`--warn` und `--bad` ein zweites Tripel `--ok-ink`, `--warn-ink`, `--bad-ink`
angelegt, aber fuer das neutrale Paar nie.

**Was daraus folgt.** `--on-parchment` und `--on-parchment-muted` als Gegenstueck
zu `--on-sea` und `--on-sea-muted`, und `.button--ghost` erbt seine Tinte vom
Untergrund statt sie fest zu setzen. Allgemeiner: **jede Farbe im Blatt gehoert
zu einem Untergrund, und wer nur eine Fassung hat, hat eine halbe.** Das ist
dieselbe Lektion wie bei der Spezifitaet der Chips, eine Ebene hoeher.

### B3 — Das Brett existiert fuer Tastatur und Screenreader nicht

- Fokussierbare Elemente im SVG: **0**
- Das SVG traegt `role="img"` mit `aria-label="Spielbrett"`

`role="img"` sagt der Hilfstechnik ausdruecklich, den Inhalt als ein einziges
Bild zu behandeln und nicht hineinzusehen. Damit ist die Hauptbedienflaeche des
Spiels — 54 Knoten, 72 Kanten, 19 Felder — als Dekoration ausgezeichnet. Wer
nicht mit der Maus zielen kann, kann nicht bauen.

**Was daraus folgt.** Das ist keine Kleinigkeit am Rand, das ist ein zweiter Weg
durch das Spiel, und er will vor der Ueberarbeitung entworfen und nicht danach
angeflickt werden. Der billigste ehrliche Weg: die Ziele sind `<g role="button"
tabindex="0">` mit einer Beschriftung, die den Ort nennt („Siedlung bei Wald 11
und Weide 6"), und die Bauleiste bekommt einen Fokusring, der beim Wechsel in
den Bau-Modus auf das erste Ziel springt. Der Bau-Modus aus Runde zwei macht das
erst moeglich: es gibt jetzt einen Schritt, in dem feststeht, wonach gesucht
wird.

### B4 — Das Brett zeigt nirgends, dass es anfassbar ist

`cursor` ist auf `.vertex__hit`, `.hex` und `.chip` durchgehend `auto`. Nur die
`<button>`-Elemente in den Panels tragen `pointer`. Die Trefferflaeche eines
Knotens ist **19,8 px** im Durchmesser — unter den 24 px, ab denen ein Ziel als
zuverlaessig gilt, und weit unter den 44 px fuer Finger.

**Was daraus folgt.** `cursor: pointer` ist die Ein-Zeilen-Haelfte. Die andere:
der Hitbereich darf groesser sein als die Marke. Ein Knoten, der als 8-px-Punkt
gezeichnet wird, darf 28 px fangen — das ist bereits jetzt so getrennt
(`vertex__hit` neben `vertex__target`), die Trennung wird nur nicht genutzt.

### B5 — Der Kaufstapel dimmt seine Auskunft mit

Die Zahl auf dem Stapel (`.deck__count`) steht in Tinte, erbt aber die
`opacity: 0.45` des gesperrten Knopfes. Wieviele Entwicklungskarten noch im
Stapel liegen, ist eine **Auskunft ueber den Spielstand** und haengt nicht daran,
ob man sich gerade eine leisten kann.

Dieselbe Verwechslung tragen die drei Bauknoepfe: `opacity: 0.4` im gesperrten
Zustand, und mit ihnen verblasst die Stueckzahl, die danebensteht.

**Was daraus folgt.** Es ist genau die Einsicht aus Runde zwei („ein gesperrter
Knopf ist ein Angebot, das man zurueckzieht, ohne es zu sagen") — nur eine
Ebene tiefer: **gesperrt wird die Handlung, nicht die Zahl.** Praktisch heisst
das, `opacity` nie auf einen Container zu legen, der beides enthaelt. Der Rahmen
und die Beschriftung duerfen zuruecktreten, der Wert nicht.

### B6 — Die Statuszeile steht zweimal, wortgleich

`.panel--actions` endet mit „Gruendung: Spieler 1 setzt eine Siedlung", und
`.status__phase` unten rechts sagt denselben Satz, Zeichen fuer Zeichen. Zwei
Stellen, ein Inhalt, ungefaehr 700 px auseinander.

**Was daraus folgt.** Eine davon muss gehen, und es sollte die in der Ablage
sein. Das Statusfeld hat in Runde zwei bewusst die Ecke bekommen, die man
beilaeufig liest; ein zweites Vorkommen macht die Entscheidung wieder
rueckgaengig. Die freiwerdende Zeile in der Ablage ist der natuerliche Platz
fuer das, was sonst fehlt: **gegen welche Punktzahl gespielt wird.**

### B7 — Kleinkram mit Namen

- **„Haefen" statt „Häfen"** in `TradeDialog.tsx:89`, sichtbar fuer den Spieler.
  Der einzige Ausrutscher der Umlaut-Runde, den der Durchlauf gefunden hat.
- **Die Ressourcen-Punkte im Handelsdialog tragen keine Ressourcenfarbe** — Lehm,
  Holz, Wolle, Korn und Erz haben alle denselben dunklen Punkt. Auf dem Brett
  hat jede Ressource ihre Farbe; der Dialog wirft sie weg und laesst nur das
  Wort. Wer schnell tauschen will, liest fuenfmal.
- **„SIEGPUNKTE ZUM SIEG"** sagt dasselbe zweimal. „Spielziel" reicht.
- **Die zwei leeren Quadrate vor dem ersten Wurf** lesen sich als leere
  Kartenplaetze, nicht als Wuerfel. Die Beschriftung „WUERFELN" steht darunter,
  also nach dem Bild.
- **Der lokale Startbildschirm scrollt** (1081 px Inhalt auf 889 px Fenster):
  „Lokale Partie starten" liegt unter der Kante. Der wichtigste Knopf der Seite
  ist der einzige, den man suchen muss.

## Die Richtung

Was aus den Befunden als Gestaltung folgt, in der Reihenfolge, in der es gebaut
werden sollte.

### 1. Das Brett ist der Held, und es ist gerade ein Briefmarkenbild

Die Zahl, die alles sagt: das Brett-SVG bekommt bei 1920 px eine Box von
**1424x701** — Seitenverhaeltnis 2,03. Der Inhalt hat ein Verhaeltnis von
**1,07**. Mit `xMidYMid meet` wird auf die Hoehe gepasst, und **die halbe Box
bleibt leer.** Das Brett ist rund 700 px breit auf einem Bildschirm, der 1920
hat.

Alles Uebrige auf dem Bildschirm ist klein, gedraengt und randstaendig, waehrend
in der Mitte Platz ungenutzt liegt. Das ist keine Frage des Geschmacks: die
Zahlenchips sind 40 px, die Bauwerke kleiner, und im Playtest hat genau das zu
„am Brettrand sieht man nichts" gefuehrt.

**Der Zug:** die Panels wandern in eine Spalte an _eine_ Seite statt an alle
vier Ecken, und das Brett bekommt eine Zelle, deren Verhaeltnis zu seinem passt.
Die Ecken sind billig zu belegen und teuer zu lesen — der Blick springt bei
jedem Zug ueber die ganze Diagonale. Runde zwei hat Verlauf und Status schon
einmal getauscht, weil der Weg zu weit war; die Antwort darauf ist nicht ein
besserer Tausch, sondern weniger Ecken.

### 2. Eine Ablage, die eine Zeile ist

Heute: `.tray` ist `display: flex` ueber 1660 px, und die drei Kinder darin sind
232 + 95 + 232 px breit. **Zwei Drittel der Zeile sind leer**, weil
`.panel--actions` weiterhin den `max-width: 14,5rem` aus seiner Zeit als Spalte
traegt. Die Umstellung auf eine Zeile ist gedanklich passiert und im Blatt nur
halb angekommen.

**Der Zug:** der Deckel faellt, und die Ablage bekommt eine echte Ordnung von
links nach rechts — Hand, Kaufstapel, Bauleiste, Zug beenden. Was man hat, was
man kaufen kann, was man baut, wann man fertig ist. Das war die erklaerte
Absicht; es fehlt nur die Breite, sie zu zeigen.

### 3. Zwei Grundflaechen, zwei vollstaendige Paletten

Aus B2 folgt mehr als ein Farbwert. Das Spiel hat **zwei Untergruende** — die
dunkle See und das helle Pergament — und im Blatt hat nur einer eine
vollstaendige Tinte. Jedes Mal, wenn etwas von der See auf Pergament wandert,
entsteht derselbe Fehler neu.

**Der Zug:** die Paletten werden paarweise gefuehrt und ueber eine Klasse am
Container gewaehlt (`.on-sea` / `.on-parchment` setzen `--fg`, `--fg-muted`,
`--line`), nicht ueber die Klasse am einzelnen Knopf. Dann kann ein Knopf
umziehen, ohne umgefaerbt zu werden — und niemand muss beim Verschieben daran
denken.

### 4. Animation: was da ist, und was fehlt

Vorhanden sind bereits `hex-impact` (das Brett faellt ein), `wordmark-zap` und
`-whip`, `menu-rise` und `-drop`, `rise`, `dice-breathe` (der Wuerfel atmet, bis
man wuerfelt), `dice-fall`, `flash-ring` (Bau und Raeuber), `settle` und
`offer-enter`. Das ist eine ordentliche Grundlage, und sie hat einen klaren
Charakter: kurz, federnd, ohne Zierrat.

Auffaellig ist, **wo** sie liegen. Fast alles Bewegte gehoert zum
Startbildschirm oder zu einem einzelnen Klick. Die Ereignisse, bei denen ein
Spieler tatsaechlich fragt „was ist gerade passiert?", tragen nichts:

- **Der Ertrag nach dem Wurf.** Der wichtigste Moment jeder Runde. Es faellt
  eine Zahl, und irgendwo aendert sich still ein Zaehler. Der Weg vom Feld zur
  Hand ist die Animation, die dem Spiel am meisten fehlt — sie erklaert die
  Regel nebenbei, jede Runde neu, ohne ein Wort.
- **Der Zugwechsel.** Der Wechsel ist heute eine Textaenderung an zwei Stellen.
  Er ist der einzige Takt, den das Spiel hat.
- **Der Verlauf.** Neue Saetze erscheinen ohne Eingang; wer wegsieht, sieht
  nicht, dass etwas dazugekommen ist.
- **Der Raub.** Eine Karte wechselt den Besitzer, und nichts bewegt sich.

**Die Regel, die dabei gilt und schon einmal teuer war:** eine Animation, die
etwas _ausblendet_, ist bei `prefers-reduced-motion` von Anfang an unsichtbar —
der abgeschaltete Ablauf steht sofort an seinem Ende. Fuer Information deshalb
nur Eingangsanimationen. Und zweitens: wer einen _Wechsel_ zeigen will, gibt dem
Element ein `key`, das sich mit dem Wechsel aendert — sonst aktualisiert React
den Knoten, statt ihn neu einzuhaengen, und die Animation laeuft gar nicht.
Beides steht in `CLAUDE.md` und beides wurde je einmal auf die harte Tour
gelernt.

**Was Bewegung hier nicht sein darf:** Zierde. Das Brett ist eine Karte, kein
Spielautomat. Jede Bewegung soll eine Frage beantworten, die ein Spieler gerade
hat — wohin ging die Karte, wer ist dran, was hat sich geaendert — und danach
aufhoeren.

## Reihenfolge

1. **B2** (Tinte auf Pergament) und **B7** („Haefen"). Beides klein, beides
   sofort, beides unabhaengig vom Umbau.
2. **B1** — das Grid fuer den Spielbildschirm. Es traegt alles Weitere und
   sollte vor jeder kosmetischen Aenderung stehen, sonst wird zweimal gemacht.
3. **Richtung 1 und 2** — Brettgroesse und Ablage. Das ist derselbe Umbau; die
   Panels und das Brett teilen sich denselben Platz.
4. **B5, B6, B4** — gesperrte Zahlen, doppelte Statuszeile, Zeiger und
   Trefferflaechen. Alles klein, alles besser nach dem Grid.
5. **B3** — der Weg ueber die Tastatur. Eigener Entwurf, nicht nebenbei.
6. **Richtung 4** — die vier fehlenden Animationen, angefangen beim Ertrag.

## Was dieser Durchlauf nicht gesehen hat

- **Zwei Geraete am selben Raum.** Alles Online-seitige ist aus einem Browser
  geprueft: Raum erstellen, Farbe waehlen, Ziel verstellen. Beitreten, das
  Umbenennen quer durch mehrere Raeume und der Handel ueber das Netz stehen
  weiter aus.
- **Der Handel mit Karten in der Hand.** Der Dialog wurde mit zwei Karten
  geoeffnet und angesehen, nicht durchgespielt. Das Gegenangebot, `rejectCounter`
  und die vier Antwortarten aus Runde zwei sind damit **weiterhin ungesehen** —
  sie brauchen drei Spieler mit vollen Haenden.
- **Raeuber, Abwerfen und Entwicklungskarten.** In einer Gruendungspartie ohne
  Rohstoffe nicht erreichbar.
- **Beruehrung.** Alle Aussagen zu Trefferflaechen sind gerechnet, nicht mit
  einem Finger geprueft.
