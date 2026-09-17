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

- `main` = `049546d`: 10d-3 abgeschlossen (Regelfragen aus 10d-2, Regel 11 im
  Browser gesehen, alle drei Auslegungen bestätigt). Details: Archiv 10d.
- **10e auf Branch `etappe-10e-burgen`**, Abschnitt unten.

## Offene Punkte

- **Keine Zugzeit** für `main` und `rollPending`: wer nicht würfelt oder den Zug
  nicht beendet, hält die Partie unbegrenzt an.
- **Befund C:** Stepper 22×22 px im Zählerdialog (Hochzeit, Großhändler, Abwerfen)
  — auf Touch fummelig.
- **Befund D (10d-1):** Auszeichnungskarte „Rittermacht" überlappt bei ~396 px
  das Brett (`.awardcard__name`).
- **Befund E:** `.panel--status` überlappt bei 396 px die Tischliste.
- **Flackernde Tests unter Last:** `GameScreen.test.tsx`, `hotseatClock.test.tsx`.
- Nicht erreicht im Browser: Hochzeit „alle", trennscharfe Leckprüfung der
  Spionage, Spionage-Dialoge bei 900 px.
- Kleinere Review-Punkte (ungetestete Randfälle in `timeout.ts`, `log.ts`,
  `spy.ts`, `deserter.ts`, `tradeHarbor.ts`; `ProgressPanel.tsx` wächst) —
  vollständige Liste im Archiv 10d unter „Offene Punkte".
- **Abgeben nennt die Karte im Verlauf** („gibt Bergbau ab", seit 10d-1, `log.ts`).
  Online sehen alle Mitspieler, welche Karte abgegeben wurde. Ob das geheim
  bleiben soll, ist ungeklärt.
- **Befund F — Statusblock bei niedrigem Fenster verdeckt** (1184×615): Vorrat
  (`.tray__controls`, `.build`) und die offene Auszeichnungskarte liegen über
  `.panel--status`. Schon vor 10e so; bei 10e aufgefallen, weil der Hinweis
  zum Burg-2-Zug dort steht.
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

## Nächste Etappe

Nach dem Merge von 10e ist der Etappenplan aus der Spec für Städte & Ritter
abgearbeitet. Kandidaten: Befunde C–F, Zugzeit für `main`/`rollPending`, die
Frage nach der Geheimhaltung abgegebener Fortschrittskarten.
