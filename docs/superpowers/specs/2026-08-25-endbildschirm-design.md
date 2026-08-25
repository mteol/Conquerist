# Endbildschirm mit Würfelstatistik

**Stand:** 2026-08-25 · **Weg:** architektonisch (Zustandsschema + neue Ansicht)

## Warum

Eine gewonnene Partie endet heute mit einer Statuszeile — `"${nameOf(view.phase.winner)} hat gewonnen"`
(`apps/client/src/game/view.ts:208`). Es gibt keinen Abschluss, keinen Endstand, kein
`GameOverPanel`. Wer wissen will, wie knapp es war oder ob das Brett fair gewürfelt hat,
bekommt darauf keine Antwort.

Zusätzlich fehlt dem Zustand die Grundlage für die zweite Hälfte: `state.lastRoll` hält nur
den **letzten** Wurf (`state.ts:98`). Welche Zahl wie oft fiel, weiß niemand.

## Entscheidungen

| Frage         | Entscheidung                                                   | Begründung                                                                                           |
| ------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Auftritt      | Dialog über dem Brett, schließbar                              | Folgt dem vorhandenen Muster (`DiscardDialog`, `VictimDialog`); das Brett bleibt nachschaubar        |
| Würfelzählung | Ganzer Tisch, 2–12                                             | Beantwortet „war das Brett fair"; schlankster Zustand                                                |
| Auftaktwürfe  | **Zählen nicht mit**                                           | Sie bestimmen die Sitzreihenfolge, nicht die Erträge — sie gehören nicht in die Statistik der Partie |
| Inhalt        | Siegpunkte, Bauwerke, Ritter, längste Straße, Würfelverteilung | Der Endstand, den man am Tisch auch laut vorlesen würde                                              |

## Zustand

Neues Feld in `GameState`:

```ts
rollTally: z.record(z.string(), z.number().int().min(0)).default({});
```

**`.default({})` ist nicht Bequemlichkeit, sondern Pflicht.** Gespeichert wird ausschließlich
der Startzustand (`sqliteStore.ts:183`), der Rest entsteht durch Replay der Aktionen. Ein
Pflichtfeld ohne Vorgabe ließe jeden bestehenden Spielstand am Schema scheitern — die Räume
wären weg. Mit Vorgabe bekommen alte Partien ihre Statistik beim nächsten Replay rückwirkend
und vollständig.

Geschrieben wird an genau einer Stelle: `rollDice` in `reducer.ts:99`, wo die Summe ohnehin
schon für den Räuber berechnet wird. **Nicht** in `applyOpeningRoll` (`opening.ts:72`) — siehe
Entscheidung oben.

Der Reducer bleibt rein: die Zählung ist eine Funktion des vorherigen Zustands und des Wurfs,
also reproduziert `replay` sie exakt (Regel 2).

## Sicht

`rollTally` geht unverändert in die `PlayerView` — wie `bank` ist es offenes Material. Es gibt
nichts zu redigieren: die Würfel fielen vor allen Augen.

## Oberfläche

Neue Komponente `apps/client/src/dialogs/GameOverDialog.tsx`:

- Öffnet sich, wenn `view.phase.kind === 'finished'`; schließbar über `CloseButton` wie die
  übrigen Dialoge, danach über einen Knopf wieder aufrufbar.
- **Endstand je Spieler**: Siegpunkte, Siedlungen, Städte, Straßen, gespielte Ritter,
  Kennzeichnung für längste Straße und größtes Heer. Quelle ist `view`, nicht eigene Rechnung.
- **Würfelverteilung 2–12** als liegendes Balkendiagramm mit der Zahl daneben. Die 7 wird
  mitgezählt und mitgezeigt — sie ist die häufigste und ohne sie sähe die Kurve falsch aus.

## Tests

- Reducer: ein Wurf erhöht genau seinen Eintrag; Auftaktwürfe erhöhen nichts
- Replay: dieselbe Aktionsfolge ergibt dieselbe Zählung
- Schema: ein Startzustand **ohne** `rollTally` parst und bekommt `{}`
- Sicht: `rollTally` erreicht die `PlayerView`
- Dialog: erscheint bei `finished`, nennt den Sieger, zeigt 11 Balken; bleibt nach dem Schließen über einen Knopf erreichbar

## Nicht enthalten

Sonderbauphase der 5–6-Erweiterung; Statistik während der Partie; Verteilung je Spieler.
