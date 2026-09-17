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

## Aktueller Stand (2026-09-17)

- `main` = `373e14d`: **10e abgeschlossen** (Burg 1 / Burg 2, Abschnitt unten).
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

## Nächste Etappe

Mit 10e ist der Etappenplan aus der Spec für Städte & Ritter
abgearbeitet. Kandidaten: Zugzeit für `main`/`rollPending`, die
Frage nach der Geheimhaltung abgegebener Fortschrittskarten.
