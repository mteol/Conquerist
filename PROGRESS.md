# Fortschritt

Diese Datei ist **kurz**: aktueller Stand, offene Punkte, nächste Etappe und
der Abschnitt zur Etappe, die gerade läuft. Abgeschlossene Etappen wandern
vollständig ins Archiv — dort stehen alle Entscheidungen samt Begründung.

| Archiv                                         | Inhalt                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `docs/archiv/progress-etappen-0-9.md`          | Etappen 0–9: Grundgerüst bis Docker/Coolify                                                        |
| `docs/archiv/progress-playtest-und-politur.md` | August 2026: Playtest-Runden, Ton, Tisch, Würfel, Texturen, Auftakt, schmale Geräte, Endbildschirm |
| `docs/archiv/progress-etappe-10a-10c.md`       | Städte & Ritter: Handelswaren, Ritter/Barbaren, Stadtausbau/Metropolen                             |
| `docs/archiv/progress-etappe-10d.md`           | Fortschrittskarten 10d-1, 10d-2 und die Regelfragen danach                                         |

Im Archiv nur gezielt suchen (`grep` nach Stichwort), nie ganz lesen.

## Aktueller Stand (2026-09-18)

- Politur nach 10e in `main`: Bauleiste neben den Würfeln, Sieben im Auftakt,
  Auskunft beim Darüberfahren und langes Drücken (Abschnitte unten).
- **10e abgeschlossen** (Burg 1 / Burg 2, Abschnitt unten).
  Davor 10d-3 (Regelfragen aus 10d-2), Details im Archiv 10d.

## Offene Punkte

- **Keine Zugzeit** für `main` und `rollPending`: wer nicht würfelt oder den Zug
  nicht beendet, hält die Partie unbegrenzt an.
- **Flackernde Tests unter Last:** `GameScreen.test.tsx`, `hotseatClock.test.tsx`.
- Nicht erreicht im Browser: Hochzeit „alle", trennscharfe Leckprüfung der
  Spionage, Spionage-Dialoge bei 900 px.
- Kleinere Review-Punkte (ungetestete Randfälle in `timeout.ts`, `log.ts`,
  `spy.ts`, `deserter.ts`, `tradeHarbor.ts`; `ProgressPanel.tsx` wächst) —
  vollständige Liste im Archiv 10d unter „Offene Punkte".
- **Abgeben nennt die Karte im Verlauf** („gibt Bergbau ab", seit 10d-1, `log.ts`).
  Online sehen alle Mitspieler, welche Karte abgegeben wurde. Ob das geheim
  bleiben soll, ist ungeklärt.
- **Hochformat unter ~40rem bleibt eng:** die beiden Ecken der Ablage sind je
  mindestens 14,75rem breit und berühren sich bei 396 px mit dem Tisch (33 px)
  und der Leiste oben (14 px). Dafür gibt es den Hinweis zum Drehen; ein
  eigenes Hochformat-Layout wäre eine eigene Etappe.
- Aus Etappe 9 weiter offen: Volume bestätigen, HTTPS, Sicherung, Drossel im
  Wartebereich.

## Etappe 10e — Burg 1 / Burg 2 zu fünft und sechst (2026-09-17, `etappe-10e-burgen`)

Regel 13 (Ausgabe 2025) nach Spec 7: zwei Marken, drei Plätze auseinander.
Burg 1 spielt den vollen Zug, danach Burg 2 den angepassten Zug (kein Wurf,
Handel nur mit der Bank, keine Alchemie), dann wandern beide eins weiter.

### Abnahme

| Prüfung             | Ergebnis                                           |
| ------------------- | -------------------------------------------------- |
| `pnpm typecheck`    | grün                                               |
| `pnpm -r test`      | shared 1282 (68), server 222 (22), client 619 (59) |
| `pnpm build`        | Client 540,49 kB (157,00 kB gzip), CSS 60,42 kB    |
| `pnpm format:check` | grün                                               |

Im Browser gesehen (lokal, 5 Personen, Städte & Ritter, 1184 px): nach dem
Zug mit Burg 1 von Spieler 4 folgt Spieler 2 (drei Plätze weiter) ohne Wurf;
Tisch zeigt „Burg 1"/„Burg 2" an den Plätzen, Status „Spieler 2 spielt mit
Burg 2" mit Zeile „Kein Wurf, Handel nur mit der Bank". Nicht gesehen: das
Weiterwandern über eine volle Runde, der Handeldialog mit Bankhandel im
Burg-2-Zug (Hand reichte nicht für die Bank), sechs Personen.

### Getroffene Entscheidungen

**Keine eigene Phase `mainRestricted`, sondern `castles` im Zustand plus eine
Sperre.** Der Burg-2-Zug beginnt direkt in `main`; Wurf und Alchemie gehören zu
`rollPending` und fallen damit von selbst weg. Übrig bleibt nur das Angebot an
Mitspieler: `canOfferTrade` lehnt mit `ADAPTED_TURN_BANK_ONLY` ab,
`canOfferAnything` sagt `false` — dieselbe Stelle, die `legalActions` und der
Handeldialog fragen (der Tab „Spieler" verschwindet). Alles in
`game/cities/castles.ts`.

**Neuer Zugzähler `turnsPlayed` für die Ritter.** `activatedOnTurn < turn`
zählte Runden und setzte voraus, dass jeder je Runde einmal handelt. Mit Burgen
hat jede Person zwei Züge je Runde: ein im Burg-1-Zug aktivierter Ritter wäre
im Burg-2-Zug derselben Runde gesperrt gewesen — je nach Sitzplatz, weil die
Runde an Burg 1 hängt. Ritter (Aktivieren, Heerführer, Deserteur) zählen jetzt
in Zügen; ohne Burgen ist das gleichwertig. Entwicklungskarten (`boughtOnTurn`,
Basisspiel ohne Burgen) bleiben bei `turn`. Beide Felder haben Vorgaben;
gespeicherte Partien bekommen sie beim Replay.

**Eine Runde endet, wenn Burg 1 wieder beim ersten Platz ankommt** — wie ohne
Marken, wenn der Zug dorthin zurückkehrt.

**Der Hinweis steht als eigene Zeile unter dem Statussatz**, nicht im Satz: der
lange Satz passte nicht in die Ecke. Die Marke am Platz ist ein Kleinlabel mit
Text („Burg 1"), nicht nur Farbe; ihr `title` erklärt den Zug.

### Offene Punkte

- Spielstände 5–6 mit Städte & Ritter, die vor 10e begonnen wurden, laufen mit
  der alten Zugfolge weiter, bis sie neu gestartet werden (`castles` wird nur
  am Ende der Gründung gesetzt). Ein Replay setzt sie neu — also nur laufende
  Partien im Speicher betroffen.
- Kein eigener Verlaufssatz zur Weitergabe der Marken.

## Anzeige-Befunde C–F (2026-09-17, `anzeige-befunde`)

Gemessen in zwei Iframes (1184×615 mit 5 Personen, 396×800 mit 4), Städte &
Ritter, lokal.

- **F — rechte Ecke höher als das Fenster** (vorher Oberkante −42 px, unter
  Status und Verlauf). Die freien Auszeichnungen liegen jetzt links am Tisch
  unter der Fahrstrecke, der Vorrat oben in der Leiste zwischen Status und
  Verlauf (sein Blatt klappt nach unten). Unter 44rem Höhe rücken Ecke und
  Leitern enger zusammen; die nächste Stufe behält 44 px. Nachher: Ecke ab
  79 px, Leiste endet bei 69 px, keine Überlappung.
- **D — Auszeichnungskarte über dem Brett:** mit dem Umzug nach links erledigt;
  bei 1184 px liegt sie neben dem Brett. Im schmalen Hochformat liegt alles auf
  dem Brett (siehe Offene Punkte).
- **E — Status über der Tischliste bei 396 px:** unter 40rem beginnt die linke
  Spalte bei 4,75rem, unter der Leiste (Tisch ab 76 px, Leiste bis 70 px).
- **C — Zählerknöpfe 22 px:** auf groben Zeigern 44 px; `.cards` bricht um.
  Nicht im Browser gesehen (braucht einen Touch-Zeiger).

Tests halten den neuen Ort fest (`awards.test.tsx`, `GameScreen.test.tsx`).
Aufgeräumt: gemergte lokale Branches gelöscht (die Commits stehen in `main`),
alte SDD-Arbeitsordner unter `.superpowers/sdd` entfernt.

## Roter Würfel und die Bauleiste bei den Würfeln (2026-09-17, `rotwuerfel-und-bauleiste`)

Aus dem ersten Blick auf den Testserver.

**Kartenmengen zu fünft und sechst geprüft** (`CITIES_RULES_56` gegen Regeltext
Abschnitt 2 und 13): 24 je Rohstoff (19 + 5 aus der Ergänzung), 18 je
Handelsware (12 + 6), keine zusätzlichen Fortschrittskarten (54 bleiben 54),
je Person 15 Straßen, 5 Siedlungen, 4 Städte, 3 Mauern, 6 Ritter. Stimmt alles.

**Der zweite Augenwürfel ist rot** — aber nur an einem Tisch mit
Ereigniswürfel. Er entscheidet über die Fortschrittskarten, und die Regel nennt
ihn beim Namen; ohne Farbe musste man wissen, dass es der zweite ist. Im
Basisspiel heißt derselbe Würfel ebenfalls `second` und bleibt weiß. Die
Vorleseansage sagt jetzt „5 und 3 (rot)". Farbe allein trägt nichts: die Ansage
und die Stellung neben dem Ereigniswürfel sagen dasselbe.

**Bauleiste und Ritterleiste stehen unten, direkt über den Würfeln** — wie am
Basistisch. Vorher standen sie ganz oben in der Ecke, mit Tableau und
Fortschrittsstapeln dazwischen: gemessen 500 px zwischen dem Wurf und dem, was
man danach baut. Tableau und Stapel werden seltener angefasst und rücken nach
oben. Gemessen bei 1500x820: Bauleiste endet bei 731, Würfel beginnen bei 739.

Im Browser gesehen (lokal, 5 Personen): roter Würfel mit hellen Augen neben
dem Ereigniswürfel, Bauteile über der Schale.

## Bauleiste neben die Würfel, Dialoge erreichbar (2026-09-17, `bauleiste-neben-wuerfel`)

Zwei Befunde vom Spielen, beide im Iframe gemessen (Städte & Ritter, lokal).

**Die Bauleiste steht jetzt neben den Würfeln, nicht darüber** — wie am Tisch
aus Holz, wo die Baukostenkarte neben der Schale liegt. Übereinander schiebt
jedes Bauteil, das dazukommt, die Würfel eine Zeile tiefer. Eigene Hülle
`.tray__throw` in `GameScreen.tsx`, damit Leiste und Schale ein Paar sind und
nicht zwei Umbruchkandidaten.

**Nebeneinander allein genügte nicht, und das war der eigentliche Befund.** Die
Ecke ist nur so breit wie der Streifen neben dem Brett: gemessen 266 px bei
1366×768, 311 bei 1600×900, 372 bei 1920×1080 — fünf Bauteile in einer Reihe
sind schon 341, mit der Schale daneben 509. Eine Zwischenfassung ließ die
Leiste dafür schrumpfen und ihre Bauteile in zwei bis drei Reihen stellen; das
ist verworfen. **Entschieden: eine Reihe, und sie darf über den Brettrand
ragen.** `nowrap` an der Zeile und an der Leiste, dazu `width: max-content` und
`margin-left: auto` — die Zeile nimmt sich ihre Inhaltsbreite und wächst nach
links, die Würfel bleiben in der Ecke.

**Die Überlappung ist gemessen und gewollt.** Wurfzeile überall 509 px breit,
Bauteile in einer Reihe, Würfel direkt daneben — geprüft bei 1920×1080,
1600×900, 1366×768, 1280×800 (6 Personen), 1184×615 und 844×390. Wie weit sie
über ein Feld ragt: 0 px bei 1920×1080 und 1600×900, 48 bei 1366×768, 46 bei
1280×800 zu sechst, 96 bei 1184×615, 200 bei 844×390. Sie bleibt überall
vollständig im Fenster.

**Handeln ging auf dem Handy nicht: der Dialog war unten abgeschnitten.** Der
Handeldialog ist mit acht Kartensorten 630 px hoch; bei 844×390 lagen
„Tauschen" und „Abbrechen" bei y 584–628, also bis zu 238 px unter dem Rand,
und gerollt hat nichts (`.game` schneidet ab, der Dialog stand in einem Raster
ohne Überlauf). Betroffen war **jeder** Dialog, auch bei 1184×615. Die Hülle
`.modal` rollt jetzt, und der Kasten wird mit `margin: auto` zentriert statt
über die Ausrichtung: eine automatische Außenlinie verteilt nur freien Platz
und fällt sonst auf 0 zurück — zentriert, solange er passt, vollständig
erreichbar, sobald er nicht mehr passt. Zentrierung über `align-items` hätte
statt dessen die obere Hälfte unerreichbar gemacht. Nachgemessen bei 844×390,
390×844, 1184×615 und 360×640: der letzte Knopf ist überall im Bild.

### Abnahme

| Prüfung             | Ergebnis                                           |
| ------------------- | -------------------------------------------------- |
| `pnpm typecheck`    | grün                                               |
| `pnpm -r test`      | shared 1282 (68), server 222 (22), client 621 (59) |
| `pnpm build`        | Client 540,78 kB (157,09 kB gzip), CSS 61,07 kB    |
| `pnpm format:check` | grün                                               |

`GameScreen.test.tsx` hält die neue Ordnung fest: die Wurfzeile ist das
äußerste Stück der Ecke, darin die Bauteile vor den Würfeln.

### Offene Punkte

- Der Handeldialog **rollt** auf dem Handy, er passt nicht. Acht Kartensorten
  in zwei Feldern sind bei 390 px Höhe zwei Züge mit dem Finger. Ein breiterer
  Kasten auf niedrigen Fenstern (die Karten stünden dann in einer Reihe statt
  zwei) wäre die nächste Stufe.
- Nicht im Browser gesehen: die Wurfzeile mit einem laufenden Spiel über eine
  volle Runde; gemessen wurde in der Gründung.

## Die Sieben im Auftakt klingt nicht nach Räuber (2026-09-17)

Beim Auswürfeln, wer anfängt, spielte eine Sieben `dice.seven` — den Klang, der
im Spiel den Räuber ankündigt. Im Auftakt gibt es keinen Räuber, kein Abwerfen
und keinen Ertrag: die Sieben ist dort eine Zahl wie jede andere.

**Ein Feld `opening` in der Lage, keine Abfrage der Phase in `cueFor`.** Die
Klangzuordnung ist rein und kennt weder `GameState` noch `PlayerView` — das ist
der Grund, warum `Situation` überhaupt dazwischensteht. Wer dort die Phase
nachschlüge, machte aus einer Tabelle wieder eine Spielstandsabfrage. Gelesen
wird der Stand **vor** dem Zug (`situation.ts`): der letzte Auftaktwurf
entscheidet und steht danach schon in der Gründungsphase. Online zusätzlich der
Stand danach, weil beim Beitritt kein Vorher vorliegt.

### Abnahme

| Prüfung             | Ergebnis                                           |
| ------------------- | -------------------------------------------------- |
| `pnpm typecheck`    | grün                                               |
| `pnpm -r test`      | shared 1282 (68), server 222 (22), client 623 (59) |
| `pnpm build`        | Client 540,89 kB (157,12 kB gzip), CSS 61,07 kB    |
| `pnpm format:check` | grün                                               |

## Simulation „alles auf dem Tisch" — zwei Anzeigebefunde (2026-09-17)

Im Browser gesehen mit einem eigens gebauten Stand (Städte & Ritter, vier
Personen, alle drei Bereiche auf Stufe 5, volle Hand aus fünf Rohstoffen und
drei Handelswaren, vier Fortschrittskarten plus zwei offene). Das Gerüst dafür
war temporär und ist wieder entfernt.

### Offene Punkte

- **Die voll ausgebaute Ausbauleiter überlagert die Kopfzeile.** Bei Stufe 5
  in allen drei Bereichen ist sie 131 px hoch; die rechte Ecke hängt unten und
  wächst nach oben. Gemessen bei 1024×560: Leiter beginnt bei y 2, die
  Kopfzeile endet bei y 51 — 49 px Überlappung, „Vorrat", Verlauf und Zahnrad
  stehen auf den Stufenkärtchen. Klickbar bleiben sie (die Kopfzeile liegt
  oben), lesbar nicht. Die Grenze liegt bei rund 609 px Fensterhöhe; bei
  1184×615 bleiben 6 px Luft. Der Befund aus „rechte Ecke passt ins niedrige
  Fenster" gilt also nur bis zu einem halb ausgebauten Tisch.
- **Die aufgedeckte Hand ragt weit über das Brett.** Mit allen acht
  Kartensorten ist sie 633 px breit, ihre Ecke nur 258 — gemessen bei 1184×615
  ragt sie 375 px in die Brettfläche und verdeckt die unteren linken Felder.
  Anders als bei der Wurfzeile ist diese Überlappung nicht entschieden worden.
- Die Namen der Aufsätze („Gilde", „Festung", „Aquädukt") stehen bei 8 px in
  37 px breiten Spalten; „Aquädukt" ragt 1 px über die Leiter hinaus.

## Auskunft beim Darüberfahren, Gründung ohne Vorklick (2026-09-18)

Aus einem Durchgang im Browser (Städte & Ritter, 4 Personen, lokal, 1184 px):
vieles sprach nur in Bildern, und `title` kam — wenn überhaupt — nach einer
Sekunde in Systemschrift.

**Ein Kärtchen für alle Auskünfte (`panels/HintCard.tsx`).** Eine Ebene in
`App.tsx` hört auf `pointerover`/`focusin` und zeigt `data-hint-title` +
`data-hint` (Zeilen per `\n`) — oder, als Rückfall, jedes vorhandene `title`.
Solange das Kärtchen steht, ruht das `title` (`data-title`), sonst käme der
Browser mit derselben Auskunft noch einmal. Nur Maus und Tastatur: auf
Touch ist ein Tipp ein Klick. **Anzeigen mit `pointer-events: none`**
(`.leftrail`, `.barbarians`) bekommen den Zeiger für Elemente mit Auskunft
zurück (`[data-hint-title] { pointer-events: auto }`).

**Das Brett erklärt sich (`board/hint.ts`, rein und getestet).** Bauplatz:
Nachbarfelder mit Zahl, Ertrag in n von 36 Würfen, Hafen. Feld: Rohstoff,
Zahl, Wahrscheinlichkeit, Räuber, wer dort baut — in Städte & Ritter auch,
was eine Stadt dort bekommt (z. B. „1 Holz und 1 Papier“). Hafen: Tauschkurs.
Bauwerk/Ritter: Besitzer, Stufe, aktiv/passiv. Über dieselbe Fangfläche wie
die Klicks (`pointermove` auf `.board__catcher`).

**Auskünfte an Städte-&-Ritter-Elementen:** Bauteil (Preis, „Dir fehlt …“ nur
bei aufgedeckter Hand, Vorrat), Ritterknöpfe (was sie tun, Kosten), jede
Sprosse der Ausbauleiter (Preis, Schwelle des roten Würfels, Gilde/Festung/
Aquädukt, Metropole), Barbarenleiste (Vorrücken, Stärken, Folgen),
Fortschrittsstapel, Siegpunkte und Kartenzahl am Tisch („1 Karte“ statt
„1 Karten“).

**Gründung: das einzige Bauteil ist vorgewählt, das Brett leuchtet sofort.**
Das kehrt die Entscheidung aus dem Playtest-Archiv um („die Gründung ist der
Moment, in dem man die Bedienung lernt“): über einem ruhigen Brett stand
„setzt eine Siedlung“, und nichts sagte, dass erst unten das Haus gedrückt
werden muss. Das Haus steht jetzt gedrückt da; ein zweiter Klick lässt die
Pflichtwahl stehen, „Abbrechen“ entfällt in der Gründung. „Knoten“ heißt im
Hinweis jetzt „Kreuzung“ (wie bei den Rittern).

### Abnahme

| Prüfung             | Ergebnis                                           |
| ------------------- | -------------------------------------------------- |
| `pnpm typecheck`    | grün                                               |
| `pnpm -r test`      | shared 1282 (68), server 222 (22), client 644 (61) |
| `pnpm build`        | Client 552,55 kB (161,21 kB gzip), CSS 61,66 kB    |
| `pnpm format:check` | grün                                               |

Im Browser gesehen: Kärtchen an Bauplatz, Feld, Hafen, Stadt, Barbaren,
Leitersprosse, Ritterknopf, Fortschrittsstapel.

**Nachgezogen am selben Tag — beide offenen Punkte behoben:**

- **Der Modusbalken steht unter dem Statussatz, rechtsbündig.** Mittig oben
  überlappte er bei 1184 px mit drei Personen den Status. Eine feste Höhe
  reichte nicht: bei 396 px bricht der Status zweizeilig um (bis y 70), und
  darunter beginnt die linke Spalte. `GameScreen` misst deshalb nach jedem
  Bild Unterkante der Leiste und Höhe des Balkens (`--topline-bottom`,
  `--mode-space`); unter 40rem rückt die linke Spalte um den Balken nach
  unten. Gemessen: 1184×615 Status bis 51, Balken 57–96 (x ab 869, Spalte bis
  194); 396×800 Status bis 70, Balken 76–115, Spalte ab 120.
- **Auf Touch per langem Drücken (480 ms).** Ein kurzer Tipp bleibt ein Klick;
  nach langem Drücken kommt das Kärtchen, und der Klick beim Loslassen wird
  geschluckt — sonst baute, wer nur fragen wollte, gleich mit. Wischen über
  10 px bricht ab, das Kontextmenü wird solange unterdrückt. Für das Brett in
  `BoardSvg` (eigene Fangfläche), sonst in `HintLayer`. Tests für beide Wege.

## Nächste Etappe

Mit 10e ist der Etappenplan aus der Spec für Städte & Ritter
abgearbeitet. Kandidaten: Zugzeit für `main`/`rollPending`, die
Frage nach der Geheimhaltung abgegebener Fortschrittskarten.
