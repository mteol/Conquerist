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

- **10d-3 abgeschlossen und in `main`** (2026-09-17): die vier Regelfragen aus
  10d-2 (Handelshafen ohne Leck, Deserteur nach FAQ, Regel 11 erzwungen über
  `mustShedProgressCard`, Testnamen in ASCII). Details: Archiv 10d, letzter
  Abschnitt.
- **Entschieden am 2026-09-17:** `robberPending` und `displacePending` behalten
  ihre Frist (`deadline.ts`, `timeout.ts`), obwohl sie dem Spieler am Zug
  gehören. Grund: sonst hängt die Partie an einer offenen Wahl fest; am Ablauf
  wählt der Server. Damit sind alle drei Auslegungen aus 10d-2 bestätigt.
- **Regel 11 im Browser gesehen** (lokale Partie, Städte & Ritter, 1184 px;
  vorübergehend fünf Karten in `setup.ts`, zurückgesetzt): nach dem Wurf steht
  „Spieler 1 muss eine Fortschrittskarte ausspielen oder abgeben"; Handel, Bauen
  und Zugende gesperrt, Karten spielbar, Knopf „Karte abgeben" offen. Der Dialog
  „Welche Karte gibst du ab?" zeigt alle fünf Karten und ein Schließkreuz;
  Schließen lässt die Pflicht stehen, Abgeben hebt sie auf, Verlauf „Spieler 1
  gibt Bergbau ab". Handelshafen nicht erneut im Browser (Logik, per Test belegt).
- Abnahme 2026-09-17: typecheck, build, format:check grün; shared 1276 (67),
  server 222 (22), client 618 (59); Client-Bundle 538,88 kB (156,48 kB gzip).

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
- Aus Etappe 9 weiter offen: Volume bestätigen, HTTPS, Sicherung, Drossel im
  Wartebereich.

## Nächste Etappe

**10e — Burg 1 / Burg 2 zu fünft und sechst.** Fünf und sechs Personen am
Städte-&-Ritter-Tisch nach Abschnitt 7 des Entwurfs
(`docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md`); am Bildschirm
sichtbar, wer den vollen und wer den angepassten Zug hat und was im angepassten
Zug fehlt.
