# Etappe 10d-1 — Die Fortschrittsstapel und die zwanzig Karten des eigenen Zuges

> **Für agentische Ausführung:** ERFORDERLICHE UNTER-SKILL: `superpowers:executing-plans`
> (oder `superpowers:subagent-driven-development`). Die Schritte tragen Checkboxen.

**Ziel:** Die drei Fortschrittsstapel mit Ziehbedingung am roten Würfel, Handlimit 4 und
den drei Wartephasen `progressDiscardPending`, `defenderPending` und `aqueductPending` —
dazu die zwanzig Karten, die im eigenen Zug fertig werden, und am Bildschirm die Stapel,
die Handkarten und ihre Auswahldialoge.

**Ansatz:** Die 25 Karten sind **eine** Aktion `playProgress` mit einer eigenen
diskriminierten Union (`ProgressPlaySchema`), nicht 25 Einträge in `GameActionSchema` —
sonst verdoppelte sich die Hauptunion. `reduce` bekommt einen Zweig und gibt an
`progress/progressRules.ts` ab, dieselbe Grenze wie `developmentRules.ts`. Die Wirkungen
liegen je Stapel in einer Datei. **Die Kette der Wartephasen in einem Wurf läuft über
benannte Nachfolgerfunktionen**, so wie `rollDice` es mit `afterDiscardPhase` heute schon
tut — kein `rollStage`-Feld im Zustand, weil jedes neue Pflichtfeld ohne Vorgabe jede
gespeicherte Partie am Schema scheitern ließe.

**Technik:** TypeScript strict · Zod 4 · Vitest · React 19 + SVG · pnpm-Monorepo

**Spec:** `docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md` (Abschnitte
1.3, 4, 5.1, 5.2, 5.3, 6, 9 „Der Zuschnitt von 10d" und „Die Kette im Wurf")
**Regelquelle:** `docs/regeln-staedte-und-ritter.md` (Abschnitte 8.1, 11, 11.1–11.3)
**Vorgänger:** Etappe 10c, `PROGRESS.md` ab „Etappe 10c — Stadtausbau und Metropolen"

## Globale Rahmenbedingungen

Diese gelten für **jede** Aufgabe und werden nicht wiederholt:

- **Antworten auf Deutsch, Code und Bezeichner auf Englisch.** Sichtbare Texte deutsch,
  mit Umlauten — das schließt Kartennamen, Verlaufssätze und Ablehnungstexte ein.
  Kommentare deutsch, in `shared` und `server` **ohne** Umlaute (`ue`, `ae`, `oe`, `ss`);
  im Client mit Umlauten. **Testnamen zählen als Kommentar**, also in `shared` und
  `server` ohne Umlaute — genau daran ist 10c viermal hintereinander gescheitert.
- **`shared` hat keine Runtime-Dependency außer `zod`.**
- **Spiellogik ist pur:** `(state, action) => newState`. Kein `Math.random()`, kein
  `Date.now()`, kein I/O. Zufall nur über den `rng` im Zustand.
- **Jede Regel zweimal:** `can…` prüft nur und gibt `RuleViolation | null`, `apply…`
  prüft und wendet an und gibt `ReduceResult`. `legalActions` benutzt dieselben `can…`.
- **Neue Logik in `shared` bekommt Tests.**
- **Jedes neue Zustandsfeld bekommt einen Vorgabewert** (`.default(…)`), und jeder
  `z.record` mit Enum-Schlüssel, der um Schlüssel wachsen kann, ist ein
  `z.partialRecord` mit auffüllendem `.transform`. Grund: seit Etappe 6 liegt der
  **Startzustand** jeder Partie als JSON in der Datenbank, und in Zod 4 ist ein
  `z.record` mit Enum-Schlüssel erschöpfend.
- **Kein Hex-Wert in einer Komponente.** Farben kommen aus `index.css`-Variablen; die
  Bereichsfarben stehen dort schon als `--track-trade`, `--track-politics`,
  `--track-science`. Farben am SVG per `style`, nie als Attribut.
- **Spezifität nachzählen**, wenn eine neue CSS-Regel eine bestehende schlagen soll.
- **Designregel 7:** Farbe ist nie der einzige Träger. Jede Stapelfarbe steht neben
  einem Wort.
- **Trefferflächen mindestens 44 px.**
- **`PROGRESS.md` wird mitgeschrieben**, nicht nachgereicht (Aufgabe 17).
- **Commit-Botschaften ohne `Co-Authored-By`.**
- Branch: `etappe-10d-fortschrittskarten`. Ausgangspunkt: `c4e109f`.
- Abnahme je Aufgabe: `pnpm typecheck` und die betroffenen Tests. Volle Abnahme
  (`pnpm typecheck && pnpm test && pnpm build && pnpm format:check`) in Aufgabe 17.
- **Tests immer mit `pnpm -r test`**, nie mit `npx vitest run` im Wurzelverzeichnis: es
  gibt keine Wurzel-Konfiguration, und vom Wurzelverzeichnis aus greift
  `apps/client/vitest.config.ts` nicht.

## Bewußte Abweichungen von Spec und Regelwerk

Vier Stellen weichen ab, alle mit Grund. Sie gehören **wörtlich** in den
`PROGRESS.md`-Abschnitt der Aufgabe 17.

1. **Auf den Stapeln liegen 43 Karten statt 54.** Das Regelwerk (11.1–11.3) kennt 54; die
   fünf Arten, die auf eine fremde Antwort warten — Großhändler, Spionage, Deserteur,
   Handelshafen, Hochzeit —, stehen in `CITIES_RULES.progressDecks` noch nicht und kommen
   in 10d-2 dazu. Sie fehlen **im Regelwerk** und nicht als Sperre im Regelcode: „was
   fehlt, gibt es an diesem Tisch nicht" ist die Zusage, die `developmentDeck` schon gibt,
   und so kostet 10d-2 an dieser Stelle einen Tabelleneintrag statt einer Fallunterscheidung.
   Bis dahin ist der Kartenmix gegenüber dem Brettspiel verschoben — eine gespielte Partie
   sieht mehr Wissenschaft (18 von 43 statt 18 von 54) als vorgesehen.
2. **Die Kartenmotive fehlen.** Die Spec nennt für 10d „Kartenmotive"; hier tragen die
   Karten Grundton je Stapel und ihren Namen. Grund: fünfundzwanzig gezeichnete Motive
   hängen an keiner Regel und wären der größte Einzelblock der größten Etappe der Reihe.
   Sie kommen als eigene Runde, wie bei den Entwicklungskarten.
3. **`aqueductPending` gehört nicht zu 10d.** Es ist der offene Punkt aus 10c. Es kommt
   trotzdem hierher, weil diese Etappe die Wurfsequenz ohnehin aufmacht und
   `defenderPending` dieselbe Bauform hat.
4. **Der Kartenzug hat keine Frist.** `deadlineOf` kennt `progressDiscardPending`,
   `defenderPending` und `aqueductPending` nicht — dieselbe Lücke wie bei den Ritter- und
   Ausbauzügen aus 10b und 10c. Sie wird gemeinsam mit ihnen gelöst oder gar nicht.

## Dateiplan

| Datei                                                       | Rolle                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/shared/src/game/cities/progress/cards.ts`         | **neu** — 25 Ids, Stapelzugehörigkeit, Stapelzusammensetzung, Handlimit |
| `packages/shared/src/game/cities/progress/draw.ts`          | **neu** — Ziehbedingung, Reihenfolge im Uhrzeigersinn, Nachziehen       |
| `packages/shared/src/game/cities/progress/play.ts`          | **neu** — `ProgressPlaySchema`                                          |
| `packages/shared/src/game/cities/progress/progressRules.ts` | **neu** — `canPlayProgress` / `applyPlayProgress`, der Verteiler        |
| `packages/shared/src/game/cities/progress/science.ts`       | **neu** — die zehn Wissenschaftskarten                                  |
| `packages/shared/src/game/cities/progress/commerce.ts`      | **neu** — Monopole, Handelsflotte, Händler                              |
| `packages/shared/src/game/cities/progress/politics.ts`      | **neu** — Bischof, Diplomat, Heerführer, Verfassung, Sabotage, Intrige  |
| `packages/shared/src/game/cities/merchant.ts`               | **neu** — die Händlerfigur, ihr 2:1 und ihr Siegpunkt                   |
| `packages/shared/src/game/cities/rollFlow.ts`               | **neu** — die Kette der Wartephasen in einem Wurf                       |
| `packages/shared/src/game/player.ts`                        | ändern — `progressCards`                                                |
| `packages/shared/src/game/state.ts`                         | ändern — `progressDecks`, `merchant`                                    |
| `packages/shared/src/game/phase.ts`                         | ändern — drei neue Wartephasen, `actorFor`                              |
| `packages/shared/src/rules/ruleset.ts`                      | ändern — `progressDecks`, `victoryPoints.merchant` und `.progressCard`  |
| `packages/shared/src/rules/cities.ts`                       | ändern — die drei Stapel, die Punktwerte                                |
| `packages/shared/src/game/setup.ts`                         | ändern — drei gemischte Stapel beim Aufbau                              |
| `packages/shared/src/game/cities/turn.ts`                   | ändern — das Stadttor zieht, statt gelesen zu werden und nichts zu tun  |
| `packages/shared/src/game/yield.ts`                         | ändern — `grantAqueduct` wird zur Wahl                                  |
| `packages/shared/src/game/reducer.ts`                       | ändern — Verteiler, Phasentabelle, die Kette                            |
| `packages/shared/src/game/actions.ts`                       | ändern — vier neue Aktionen                                             |
| `packages/shared/src/game/errors.ts`                        | ändern — neue Ablehnungsgründe                                          |
| `packages/shared/src/game/legal.ts`                         | ändern — die spielbaren Karten aufzählen                                |
| `packages/shared/src/game/playerView.ts`                    | ändern — Fortschrittskarten geheim, Siegpunktkarten offen               |
| `packages/shared/src/game/scoring.ts`                       | ändern — Händler und die zwei Siegpunktkarten als Summanden             |
| `packages/shared/src/game/log.ts`                           | ändern — die Verlaufssätze der Karten                                   |
| `packages/shared/src/game/trade.ts`                         | ändern — Händler-2:1 und Handelsflotte im Kurs                          |
| `packages/shared/src/game/roads.ts`                         | ändern — offene Straßen für den Diplomaten                              |
| `packages/shared/src/game/board.ts`                         | ändern — Zahlenchips tauschen für den Erfinder                          |
| `packages/shared/src/game/game.integration.test.ts`         | ändern — eine Partie bis zur ersten gespielten Karte                    |
| `apps/client/src/game/pickMode.ts`                          | **neu** — die gemeinsame „erst was, dann wo"-Abstraktion                |
| `apps/client/src/panels/ProgressPanel.tsx`                  | **neu** — die drei Stapel und die eigene Hand                           |
| `apps/client/src/dialogs/ProgressPlayDialog.tsx`            | **neu** — die Auswahldialoge der Karten                                 |
| `apps/client/src/dialogs/ProgressDiscardDialog.tsx`         | **neu** — die fünfte Karte zurücklegen                                  |
| `apps/client/src/dialogs/PickDeckDialog.tsx`                | **neu** — `defenderPending` und `aqueductPending`                       |
| `apps/client/src/screens/GameScreen.tsx`                    | ändern — Stapel stellen, Dialoge führen, `pickMode` benutzen            |
| `apps/client/src/game/targets.ts`                           | ändern — Brettziele für Händler und Bischof                             |
| `apps/client/src/index.css`                                 | ändern — Stapel, Karten, Dialoge                                        |
| `PROGRESS.md`                                               | ändern — Abschnitt 10d-1                                                |

## Reihenfolge der Aufgaben

1–5 bauen das Fundament (Karten, Stapel, Zug, Kette, Aktion). 6–13 sind die Wirkungen und
lassen sich **untereinander in beliebiger Reihenfolge** erledigen, sobald 5 steht. 14–16
schließen ab.

---

## Aufgabe 1: Die 25 Karten und die drei Stapel

**Warum zuerst:** jede spätere Aufgabe fragt diese Tabelle. Solange sie nicht steht, hätte
jede Wirkung ihre eigene Vorstellung davon, zu welchem Stapel sie gehört.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/cards.ts`
- Test: `packages/shared/src/game/cities/progress/cards.test.ts` (**neu**)

**Schnittstellen — liefert:**

```ts
// game/cities/progress/cards.ts
export const PROGRESS_CARD_IDS = [
  // Wissenschaft (gruen)
  'alchemist',
  'crane',
  'mining',
  'irrigation',
  'printer',
  'inventor',
  'engineer',
  'medicine',
  'smith',
  'roadBuilding',
  // Handel (gelb)
  'merchant',
  'resourceMonopoly',
  'commodityMonopoly',
  'tradeHarbor',
  'merchantFleet',
  'masterMerchant',
  // Politik (blau)
  'spy',
  'bishop',
  'deserter',
  'diplomat',
  'warlord',
  'wedding',
  'intrigue',
  'saboteur',
  'constitution',
] as const;

export const ProgressCardIdSchema = z.enum(PROGRESS_CARD_IDS);
export type ProgressCardId = z.infer<typeof ProgressCardIdSchema>;

/** Zu welchem Stapel eine Karte gehoert. */
export const PROGRESS_TRACK: Readonly<Record<ProgressCardId, TrackId>>;

/** Der deutsche Name auf der Karte - sichtbarer Text, also mit Umlauten. */
export const PROGRESS_NAMES: Readonly<Record<ProgressCardId, string>>;

/** Die Wirkung als Satz, fuer die Karte am Bildschirm. */
export const PROGRESS_TEXTS: Readonly<Record<ProgressCardId, string>>;

/** Wie viele Karten je Art im vollstaendigen Spiel liegen - 54 zusammen. */
export const FULL_PROGRESS_DECK: Readonly<Record<ProgressCardId, number>>;

/** Hoechstens so viele Fortschrittskarten auf der Hand. Siegpunktkarten zaehlen nicht. */
export const PROGRESS_HAND_LIMIT = 4;

/** Die beiden Karten, die sofort offen liegen und einen Punkt bringen. */
export const PROGRESS_VICTORY_CARDS: readonly ProgressCardId[]; // ['printer', 'constitution']
```

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
// game/cities/progress/cards.test.ts
import { describe, expect, it } from 'vitest';

import {
  FULL_PROGRESS_DECK,
  PROGRESS_CARD_IDS,
  PROGRESS_NAMES,
  PROGRESS_TEXTS,
  PROGRESS_TRACK,
} from './cards.js';

describe('Fortschrittskarten', () => {
  it('kennt fuenfundzwanzig Arten', () => {
    expect(PROGRESS_CARD_IDS).toHaveLength(25);
    expect(new Set(PROGRESS_CARD_IDS).size).toBe(25);
  });

  it('legt achtzehn Karten auf jeden der drei Stapel', () => {
    const perTrack = { science: 0, trade: 0, politics: 0 };
    for (const id of PROGRESS_CARD_IDS) perTrack[PROGRESS_TRACK[id]] += FULL_PROGRESS_DECK[id];
    expect(perTrack).toEqual({ science: 18, trade: 18, politics: 18 });
  });

  it('gibt jeder Karte einen Namen und einen Wirkungssatz', () => {
    for (const id of PROGRESS_CARD_IDS) {
      expect(PROGRESS_NAMES[id]).not.toBe('');
      expect(PROGRESS_TEXTS[id]).not.toBe('');
    }
  });

  /*
   * Die Namen stehen auf der Karte und damit vor dem Spieler - die Grenze aus
   * dem Playtest verlangt dort echte Umlaute. Ein Test dafuer, weil genau
   * diese Regel in 10c viermal gerissen ist.
   */
  it('schreibt die sichtbaren Namen mit Umlauten', () => {
    expect(PROGRESS_NAMES.irrigation).toBe('Bewässerung');
    expect(PROGRESS_NAMES.masterMerchant).toBe('Großhändler');
    expect(PROGRESS_NAMES.warlord).toBe('Heerführer');
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und den Fehlschlag sehen**

Ausführen: `pnpm --filter @conquerist/shared test cards.test`
Erwartet: FAIL, `Cannot find module './cards.js'`

- [ ] **Schritt 3: `cards.ts` schreiben**

Die Anzahlen stammen aus `docs/regeln-staedte-und-ritter.md` 11.1–11.3. Sie ergeben je
Stapel 18 — das prüft der Test aus Schritt 1, und die Zahl ist der einzige Schutz gegen
einen Tippfehler in einer Tabelle mit 25 Zeilen.

```ts
export const FULL_PROGRESS_DECK: Readonly<Record<ProgressCardId, number>> = {
  // Wissenschaft: 2+2+2+2+1+2+1+2+2+2 = 18
  alchemist: 2,
  crane: 2,
  mining: 2,
  irrigation: 2,
  printer: 1,
  inventor: 2,
  engineer: 1,
  medicine: 2,
  smith: 2,
  roadBuilding: 2,
  // Handel: 6+4+2+2+2+2 = 18
  merchant: 6,
  resourceMonopoly: 4,
  commodityMonopoly: 2,
  tradeHarbor: 2,
  merchantFleet: 2,
  masterMerchant: 2,
  // Politik: 3+2+2+2+2+2+2+2+1 = 18
  spy: 3,
  bishop: 2,
  deserter: 2,
  diplomat: 2,
  warlord: 2,
  wedding: 2,
  intrigue: 2,
  saboteur: 2,
  constitution: 1,
};
```

**Ein Name kollidiert absichtlich:** `roadBuilding` heißt auch eine Entwicklungskarte
(`DevelopmentCardId`). Beide Unionen sind getrennt, und an einem Tisch gibt es nie beide
Systeme — die Spec hält in 1.3 fest, daß `developmentDeck` gesetzt gegen `progressDecks`
gesetzt entscheidet, welches läuft. Ein Kommentar an der Stelle nennt den Grund, damit
niemand später „aufräumt".

- [ ] **Schritt 4: Den Test laufen lassen und grün sehen**

Ausführen: `pnpm --filter @conquerist/shared test cards.test`
Erwartet: PASS, 4 Tests

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src/game/cities/progress/
git commit -m "Fuenfundzwanzig Karten auf drei Stapeln"
```

---

## Aufgabe 2: Die Stapel im Regelwerk, im Zustand und beim Aufbau

**Warum hier:** die Karten aus Aufgabe 1 sind eine Liste; erst das Regelwerk entscheidet,
welche davon an **diesem** Tisch liegen, und erst der Aufbau mischt sie.

**Dateien:**

- Ändern: `packages/shared/src/rules/ruleset.ts` (`progressDecks`, zwei Punktwerte)
- Ändern: `packages/shared/src/rules/cities.ts` (die drei Stapel, `merchant: 1`, `progressCard: 1`)
- Ändern: `packages/shared/src/game/state.ts` (`progressDecks`, `merchant`)
- Ändern: `packages/shared/src/game/player.ts` (`progressCards`)
- Ändern: `packages/shared/src/game/setup.ts` (drei gemischte Stapel)
- Ändern: `packages/shared/src/game/fixtures.ts` (`progressCards: []` im Testspieler)
- Test: `packages/shared/src/rules/cities.test.ts`, `packages/shared/src/game/setup.test.ts`

**Schnittstellen — liefert:**

```ts
// rules/ruleset.ts
/**
 * Wie viele Fortschrittskarten je Art auf den Stapeln liegen.
 *
 * Leer heisst: keine Fortschrittsstapel. Dieselbe Bauform wie
 * `developmentDeck` - und dieselbe Zusage: was fehlt, gibt es an diesem Tisch
 * nicht. Genau daran haengt der Zuschnitt von 10d: die fuenf Karten, die auf
 * eine fremde Antwort warten, stehen hier in 10d-1 noch nicht drin und kommen
 * in 10d-2 dazu, ohne dass eine Regel sich aendert.
 */
progressDecks: z.partialRecord(ProgressCardIdSchema, z.number().int().min(0)).default({}),

// game/state.ts
/** Die drei Fortschrittsstapel, von oben nach unten. **Geheim** wie `deck`. */
progressDecks: z.partialRecord(TrackIdSchema, z.array(ProgressCardIdSchema)).default({}),
/** Die Haendlerfigur. `null`, solange keine Karte "Haendler" gespielt wurde. */
merchant: z.object({ hex: z.string(), owner: PlayerIdSchema }).nullable().default(null),

// game/player.ts
/** Fortschrittskarten auf der Hand. Geheim - ausser den Siegpunktkarten. */
progressCards: z.array(ProgressCardIdSchema).default([]),

// game/setup.ts
/** Die drei gemischten Stapel aus den Anzahlen im Regelwerk. */
function progressDecksAndRng(
  rules: RuleSet,
  rng: Rng,
): { decks: Partial<Record<TrackId, ProgressCardId[]>>; rng: Rng };
```

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

```ts
// rules/cities.test.ts — ergaenzen
it('legt in 10d-1 dreiundvierzig Fortschrittskarten aus', () => {
  const total = Object.values(CITIES_RULES.progressDecks).reduce((sum, n) => sum + n, 0);
  expect(total).toBe(43);
});

it('laesst die fuenf Karten weg, die auf eine fremde Antwort warten', () => {
  for (const id of ['masterMerchant', 'spy', 'deserter', 'tradeHarbor', 'wedding'] as const) {
    expect(CITIES_RULES.progressDecks[id]).toBeUndefined();
  }
});

it('gibt dem Basistisch keine Fortschrittsstapel', () => {
  expect(CLASSIC_RULES.progressDecks).toEqual({});
});
```

```ts
// game/setup.test.ts — ergaenzen
it('mischt drei Fortschrittsstapel und laesst sie beim Basisspiel leer', () => {
  const cities = createGame({ seed: 'abc', players: ['p1', 'p2'], rules: CITIES_RULES });
  expect(cities.progressDecks.science).toHaveLength(18);
  expect(cities.progressDecks.trade).toHaveLength(14);
  expect(cities.progressDecks.politics).toHaveLength(11);

  const classic = createGame({ seed: 'abc', players: ['p1', 'p2'], rules: CLASSIC_RULES });
  expect(classic.progressDecks).toEqual({});
});

/*
 * Derselbe Seed muss dieselbe Partie ergeben - sonst spielt jede gespeicherte
 * Partie sich beim Replay anders nach.
 */
it('mischt aus demselben Seed dieselben Stapel', () => {
  const options = { seed: 'gleich', players: ['p1', 'p2'], rules: CITIES_RULES };
  expect(createGame(options).progressDecks).toEqual(createGame(options).progressDecks);
});
```

- [ ] **Schritt 2: Die Tests laufen lassen und den Fehlschlag sehen**

Ausführen: `pnpm --filter @conquerist/shared test cities.test setup.test`
Erwartet: FAIL, `progressDecks` ist `undefined`

- [ ] **Schritt 3: Die sechs Dateien ändern**

In `rules/cities.ts` treten die drei Stapel an die Stelle des Kommentars „Kein Stapel.
Die Fortschrittskarten kommen in Etappe 10d." — **die 20 Arten dieser Etappe**, jede mit
der Anzahl aus `FULL_PROGRESS_DECK`:

```ts
  /*
   * Die Fortschrittsstapel. Es fehlen fuenf Arten - masterMerchant, spy,
   * deserter, tradeHarbor, wedding -, weil sie auf die Antwort einer anderen
   * Person warten und ihre Phase erst in 10d-2 entsteht. Sie fehlen hier und
   * nicht als Sperre im Regelcode: "was fehlt, gibt es an diesem Tisch nicht"
   * ist die Zusage, die `developmentDeck` schon gibt.
   */
  progressDecks: {
    alchemist: 2, crane: 2, mining: 2, irrigation: 2, printer: 1,
    inventor: 2, engineer: 1, medicine: 2, smith: 2, roadBuilding: 2,
    merchant: 6, resourceMonopoly: 4, commodityMonopoly: 2, merchantFleet: 2,
    bishop: 2, diplomat: 2, warlord: 2, intrigue: 2, saboteur: 2, constitution: 1,
  },
```

In `rules/ruleset.ts` kommen zwei Punktwerte dazu, beide **mit Vorgabe**, weil das
RuleSet jeder laufenden Partie als JSON in der Datenbank liegt:

```ts
    /** Was die Haendlerfigur zaehlt, solange sie bei einem steht. */
    merchant: z.number().int().min(0).default(0),
    /** Was eine offene Siegpunkt-Fortschrittskarte zaehlt (Buchdruck, Verfassung). */
    progressCard: z.number().int().min(0).default(0),
```

In `game/setup.ts` mischt `progressDecksAndRng` **nacheinander mit demselben `rng`** —
drei Aufrufe von `shuffle`, jeder gibt den nächsten Zufallszustand zurück, genau wie
`deckAndRng` es für den Entwicklungsstapel tut. Ein leeres `rules.progressDecks` gibt
`{}` zurück und läßt den `rng` unberührt: ein Basistisch darf sich durch die Erweiterung
nicht anders nachspielen.

- [ ] **Schritt 4: Die Tests laufen lassen und grün sehen**

Ausführen: `pnpm --filter @conquerist/shared test cities.test setup.test`
Erwartet: PASS

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src/
git commit -m "Drei Stapel liegen auf dem Tisch"
```

---

## Aufgabe 3: Das Stadttor zieht

**Warum hier:** ab jetzt kommen Karten überhaupt auf Hände. Bis hierher lagen die Stapel
da und `resolveEvent` las die drei Stadttore, ohne etwas zu tun.

**Regel (8.1):** Zeigt der Ereigniswürfel ein Fortschrittssymbol, prüft **jede Person**,
ob die Augenzahl des roten Würfels **kleiner oder gleich ihrer Stufe + 1** in dem
gewürfelten Bereich ist. Wer besteht, zieht die oberste Karte dieses Stapels. Reihenfolge
im Uhrzeigersinn, beginnend beim Spieler am Zug.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/draw.ts`
- Ändern: `packages/shared/src/game/cities/turn.ts`
- Test: `packages/shared/src/game/cities/progress/draw.test.ts` (**neu**)

**Schnittstellen — verbraucht:** `PROGRESS_HAND_LIMIT`, `PROGRESS_VICTORY_CARDS`,
`PROGRESS_TRACK` (Aufgabe 1); `progressThreshold`, `levelOf` (`cities/tracks.ts`, stehen
schon seit 10c).
**Schnittstellen — liefert:**

```ts
// game/cities/progress/draw.ts
/** Wer bei diesem Wurf zieht - im Uhrzeigersinn ab dem Spieler am Zug. */
export function drawersFor(state: GameState, track: TrackId, red: number): PlayerId[];

/** Zieht fuer alle Berechtigten. Ein leerer Stapel gibt still nichts - er waechst nie nach. */
export function drawProgressCards(state: GameState, track: TrackId, red: number): GameState;

/** Wie viele zaehlende Karten einer auf der Hand hat - Siegpunktkarten zaehlen nicht. */
export function countedHand(player: PlayerState): number;

/**
 * Wer mehr als vier zaehlende Karten haelt und **nicht** am Zug ist.
 *
 * Abgeleitet und nicht mitgeschleppt: die Stapelwahl der Verteidiger verteilt
 * selbst Karten, und eine vor ihr gebildete Liste waere danach falsch. Wer am
 * Zug ist, steht nie drin - er spielt sofort aus, und das kann er in `main`.
 */
export function playersOverProgressLimit(state: GameState): PlayerId[];
```

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
// game/cities/progress/draw.test.ts
describe('Ziehen am Stadttor', () => {
  it('laesst ziehen, wer die Schwelle Stufe+1 erreicht', () => {
    // p1 auf Wissenschaft 2 -> Schwelle 3, roter Wuerfel 3: zieht.
    // p2 auf Wissenschaft 0 -> Schwelle 1, roter Wuerfel 3: zieht nicht.
    const state = withImprovements(citiesTable(), { p1: { science: 2 } });
    expect(drawersFor(state, 'science', 3)).toEqual(['p1']);
  });

  it('faengt beim Spieler am Zug an und geht im Uhrzeigersinn', () => {
    // Alle drei berechtigt, am Zug ist der zweite Sitz.
    const state = withCurrentPlayer(allEligible(), 1);
    expect(drawersFor(state, 'science', 1)).toEqual(['p2', 'p3', 'p1']);
  });

  it('zieht die oberste Karte und nimmt sie vom Stapel', () => {
    const before = eligibleForScience();
    const after = drawProgressCards(before, 'science', 1);
    expect(after.progressDecks.science).toHaveLength(before.progressDecks.science.length - 1);
    expect(playerNamed(after, 'p1').progressCards).toEqual([before.progressDecks.science[0]]);
  });

  it('gibt still nichts aus einem leeren Stapel', () => {
    const empty = { ...eligibleForScience(), progressDecks: { science: [] } };
    const after = drawProgressCards(empty, 'science', 1);
    expect(playerNamed(after, 'p1').progressCards).toHaveLength(0);
    expect(playersOverProgressLimit(after)).toEqual([]);
  });

  /* Siegpunktkarten liegen offen und zaehlen nicht gegen das Limit von vier. */
  it('zaehlt Siegpunktkarten nicht gegen das Handlimit', () => {
    const hand = { ...testPlayer(), progressCards: ['printer', 'constitution', 'crane'] };
    expect(countedHand(hand)).toBe(1);
  });

  it('meldet, wer nicht am Zug ist und mit der fuenften Karte ueber dem Limit liegt', () => {
    // Am Zug ist p1, also faellt p2 in die Liste und p1 nie.
    const full = withHand(eligibleForScience(), 'p2', ['crane', 'mining', 'smith', 'medicine']);
    expect(playersOverProgressLimit(drawProgressCards(full, 'science', 1))).toEqual(['p2']);
  });

  it('nimmt den Spieler am Zug aus der Abgabeliste heraus', () => {
    const full = withHand(eligibleForScience(), 'p1', ['crane', 'mining', 'smith', 'medicine']);
    expect(playersOverProgressLimit(drawProgressCards(full, 'science', 1))).toEqual([]);
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und den Fehlschlag sehen**

Ausführen: `pnpm --filter @conquerist/shared test draw.test`
Erwartet: FAIL, `Cannot find module './draw.js'`

- [ ] **Schritt 3: `draw.ts` schreiben und in `turn.ts` einhängen**

`resolveEvent` gibt heute bei `face !== 'ship'` denselben Zustand zurück. Diese Zeile
wird der Einhängepunkt: Stadttor heißt jetzt ziehen. Der Kopfkommentar der Datei sagt
noch „Die drei Stadttore werden weiterhin gelesen und tun nichts — die Fortschrittskarten
kommen in 10d"; **er wird mitgeändert**, sonst beschreibt er eine Absicht, die nicht mehr
gilt (`CLAUDE.md`: ein Kommentar, der eine Absicht beschreibt, ist kein Nachweis).

**Die Signatur von `resolveEvent` bleibt `(state, roll) => GameState`.** Wer abgeben muß,
wird nicht von hier gemeldet, sondern in Aufgabe 4 aus dem Zustand abgeleitet — sonst
wäre die Liste falsch, sobald die Stapelwahl der Verteidiger noch Karten nachlegt.

Die Zuordnung Würfelseite → Bereich ist die Identität: `EventFace` kennt bereits
`'trade' | 'politics' | 'science'`, und das sind genau die `TrackId`s. Kein
Übersetzungstisch — wer einen bauen will, hat zwei Namen für dieselbe Sache.

- [ ] **Schritt 4: Die Tests laufen lassen und grün sehen**

Ausführen: `pnpm --filter @conquerist/shared test draw.test turn.test`
Erwartet: PASS. `turn.test.ts` bleibt unverändert — die Signatur von `resolveEvent` ändert
sich nicht, nur ihr Verhalten am Stadttor.

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src/game/cities/
git commit -m "Am Stadttor wird gezogen"
```

---

## Aufgabe 4: Die Kette der Wartephasen in einem Wurf

**Warum hier:** ab Aufgabe 3 kommen Karten auf Hände, und damit kann **ein** Wurf
mehrfach hintereinander auf fremde Eingaben warten. `PhaseSchema` hält immer nur eine
Phase; ohne diese Aufgabe fiele jede zweite Wartestation lautlos aus.

**Die Kette, in dieser Reihenfolge** (Nicht-Sieben-Pfad):

```
resolveEvent  ──┬─ Schiff → Barbaren → bei Gleichstand: defenderPending
                └─ Stadttor → wer rot ≤ Stufe+1 hat, zieht
                ↓
        wer nicht am Zug ist und mehr als vier zaehlende Karten haelt:
                progressDiscardPending
                ↓
        distributeYield
                ↓
        wer das Aquaedukt hat und leer ausging: aqueductPending
                ↓
        main
```

**Der Merker liegt nicht im Zustand, sondern in der Reihenfolge der Funktionen.** Jede
Wartephase hat genau **einen** Nachfolger; ihre Abschlußfunktion ruft ihn. Ein
`rollStage`-Feld wäre allgemeiner, aber ein neues Pflichtfeld im gespeicherten Zustand
ist die wiederkehrende Falle dieses Repos.

**Wer noch offen ist, wird aus dem Zustand abgeleitet und nicht mitgeschleppt.**
`defenderPending` verteilt selbst Karten und kann jemanden über das Limit heben — eine
Liste, die vor dieser Phase entstünde, wäre danach falsch.

**Dateien:**

- Neu: `packages/shared/src/game/cities/rollFlow.ts`
- Ändern: `packages/shared/src/game/phase.ts` (drei Phasen, `actorFor`)
- Ändern: `packages/shared/src/game/reducer.ts` (`rollDice` gibt an die Kette ab)
- Ändern: `packages/shared/src/game/yield.ts` (`grantAqueduct` wird zur Wahl)
- Ändern: `packages/shared/src/game/actions.ts` (`pickProgressDeck`, `discardProgressCard`, `pickAqueduct`)
- Ändern: `packages/shared/src/game/errors.ts`
- Test: `packages/shared/src/game/cities/rollFlow.test.ts` (**neu**), `phase.test.ts`

**Schnittstellen — verbraucht:** `drawProgressCards`, `playersOverProgressLimit`,
`countedHand` (Aufgabe 3).
**Schnittstellen — liefert:**

```ts
// game/phase.ts — drei neue Zweige der Union, alle mit derselben Bauform
z.object({ kind: z.literal('progressDiscardPending'), pending: z.array(PlayerIdSchema) }),
z.object({ kind: z.literal('defenderPending'), pending: z.array(PlayerIdSchema) }),
z.object({ kind: z.literal('aqueductPending'), pending: z.array(PlayerIdSchema) }),

// game/cities/rollFlow.ts
/**
 * Die naechste Station nach dem Ereignis: erst wer abgeben muss, dann die
 * Ertraege, dann das Aquaedukt, dann `main`.
 *
 * Eine Funktion und keine Kette von Feldern: die Reihenfolge steht damit
 * genau einmal im Code, und jede Wartephase findet ihren Nachfolger, indem
 * sie sie erneut ruft.
 */
export function continueAfterEvent(state: GameState, total: number): GameState;

/** Nach dem Abgeben der fuenften Karte: weiter mit den Ertraegen. */
export function continueAfterProgressDiscard(state: GameState): GameState;

/** Nach der Stapelwahl der Verteidiger: zurueck in dieselbe Kette. */
export function continueAfterDefender(state: GameState): GameState;

/** Nach der Rohstoffwahl am Aquaedukt: `main`. */
export function continueAfterAqueduct(state: GameState): GameState;

// game/yield.ts — aus der festen Regel wird eine Wahl
/** Wer das Aquaedukt hat und bei diesem Wurf leer ausging. */
export function aqueductClaimants(state: GameState, before: GameState): PlayerId[];
```

**Was aus `grantAqueduct` wird:** die Funktion wählte den Rohstoff bisher selbst („der,
von dem die Bank am meisten hat"). Sie wird zu `aqueductClaimants`, die nur noch **wer**
beantwortet; das **was** beantwortet der Spieler mit `pickAqueduct`. Die alte Auswahlregel
verschwindet ersatzlos — sie war eine Notlösung und steht als solche in `PROGRESS.md`.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
// game/cities/rollFlow.test.ts
describe('Die Kette in einem Wurf', () => {
  it('geht ohne offene Wahl vom Ereignis bis in die Hauptphase', () => {
    const after = continueAfterEvent(plainCitiesRoll(), 8);
    expect(after.phase.kind).toBe('main');
  });

  it('haelt beim Abgeben der fuenften Karte an, bevor die Ertraege fallen', () => {
    // p2 ist nicht am Zug und haelt nach dem Zug fuenf zaehlende Karten.
    const before = withHand(gateRolled(), 'p2', [
      'crane',
      'mining',
      'smith',
      'medicine',
      'warlord',
    ]);
    const after = continueAfterEvent(before, 8);
    expect(after.phase).toEqual({ kind: 'progressDiscardPending', pending: ['p2'] });
    // Die Ertraege sind noch nicht verteilt.
    expect(playerNamed(after, 'p1').resources).toEqual(playerNamed(before, 'p1').resources);
  });

  it('verteilt die Ertraege erst, wenn abgegeben wurde', () => {
    const after = continueAfterProgressDiscard(afterDiscarding);
    expect(playerNamed(after, 'p1').resources.brick).toBe(1);
  });

  it('haelt am Aquaedukt an, wenn jemand leer ausging', () => {
    const after = continueAfterEvent(aqueductHolderGetsNothing(), 8);
    expect(after.phase).toEqual({ kind: 'aqueductPending', pending: ['p1'] });
  });

  it('geht vom Aquaedukt in die Hauptphase', () => {
    expect(continueAfterAqueduct(aqueductAnswered).phase.kind).toBe('main');
  });

  /*
   * Der schwierige Fall, und der Grund fuer diese Aufgabe: die Stapelwahl der
   * Verteidiger verteilt selbst Karten und kann damit erst das Handlimit
   * reissen. Eine vor der Phase gebildete Liste waere hier falsch.
   */
  it('schickt vom Stapelwahl-Ende in das Abgeben, wenn die Karte das Limit reisst', () => {
    const after = continueAfterDefender(defenderDrewFifthCard);
    expect(after.phase).toEqual({ kind: 'progressDiscardPending', pending: ['p2'] });
  });

  /* Wer am Zug ist, gibt nicht ab - er spielt sofort, und das kann er in `main`. */
  it('nimmt den Spieler am Zug aus der Abgabeliste heraus', () => {
    const after = continueAfterEvent(withHand(gateRolled(), 'p1', fiveCards), 8);
    expect(after.phase.kind).toBe('main');
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und den Fehlschlag sehen**

Ausführen: `pnpm --filter @conquerist/shared test rollFlow.test`
Erwartet: FAIL, `Cannot find module './rollFlow.js'`

- [ ] **Schritt 3: `rollFlow.ts` schreiben und `rollDice` umhängen**

`rollDice` im Reducer verliert seinen Nicht-Sieben-Zweig an `continueAfterEvent`. Der
Sieben-Pfad bleibt, wie er ist — eine Sieben verteilt keinen Ertrag, an dem „leer
ausgegangen" etwas bedeuten würde, und der Kommentar dort sagt das schon.

`phase.ts` bekommt die drei Zweige und `actorFor` je einen Eintrag: bei allen dreien
handelt **der erste Eintrag in `pending`**, dieselbe Bauform wie `discardPending`.

`PHASE_ACTIONS` in `reducer.ts` bekommt drei Zeilen:

```ts
  progressDiscardPending: ['discardProgressCard'],
  defenderPending: ['pickProgressDeck'],
  aqueductPending: ['pickAqueduct'],
```

- [ ] **Schritt 4: Die Tests laufen lassen und grün sehen**

Ausführen: `pnpm --filter @conquerist/shared test rollFlow.test phase.test reducer.test yield.test`
Erwartet: PASS. Die Tests zu `grantAqueduct` in `yield.test.ts` werden auf
`aqueductClaimants` umgeschrieben — die feste Rohstoffwahl gibt es nicht mehr.

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src/game/
git commit -m "Ein Wurf kann mehrfach warten"
```

---

## Aufgabe 5: Die Aktion `playProgress` und ihr Verteiler

**Warum hier:** ab hier ist jede weitere Aufgabe **nur noch eine Wirkung**. Die Aktion,
ihre Union und der Verteiler entstehen einmal; Aufgaben 6 bis 13 hängen sich ein.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/play.ts`
- Neu: `packages/shared/src/game/cities/progress/progressRules.ts`
- Ändern: `packages/shared/src/game/actions.ts`, `errors.ts`, `reducer.ts`, `legal.ts`
- Test: `packages/shared/src/game/cities/progress/progressRules.test.ts` (**neu**)

**Schnittstellen — liefert:**

```ts
// game/cities/progress/play.ts
/**
 * Was eine Karte zum Spielen braucht.
 *
 * Fuenfundzwanzig Eintraege in `GameActionSchema` wuerden die Hauptunion
 * verdoppeln und die Erweiterung ueber die Datei verteilen. Deshalb eine
 * eigene Union unter **einer** Aktion - dieselbe Grenze wie bei den
 * Entwicklungskarten.
 *
 * Die fuenf Karten, die auf eine fremde Antwort warten, fehlen hier: sie
 * kommen mit ihrer Phase in 10d-2.
 */
export const ProgressPlaySchema = z.discriminatedUnion('card', [
  z.object({ card: z.literal('alchemist'), first: DieValueSchema, second: DieValueSchema }),
  z.object({ card: z.literal('crane'), track: TrackIdSchema }),
  z.object({ card: z.literal('mining') }),
  z.object({ card: z.literal('irrigation') }),
  z.object({ card: z.literal('printer') }),
  z.object({ card: z.literal('inventor'), a: z.string(), b: z.string() }),
  z.object({ card: z.literal('engineer'), vertex: z.string() }),
  z.object({ card: z.literal('medicine'), vertex: z.string() }),
  z.object({ card: z.literal('smith'), vertices: z.array(z.string()).max(2) }),
  z.object({ card: z.literal('roadBuilding'), edges: z.array(z.string()).max(2) }),
  z.object({ card: z.literal('merchant'), hex: z.string() }),
  z.object({ card: z.literal('resourceMonopoly'), resource: ResourceIdSchema }),
  z.object({ card: z.literal('commodityMonopoly'), commodity: CommodityIdSchema }),
  z.object({ card: z.literal('merchantFleet'), sort: CardIdSchema }),
  z.object({ card: z.literal('bishop'), hex: z.string() }),
  z.object({ card: z.literal('diplomat'), edge: z.string(), rebuildAt: z.string().optional() }),
  z.object({ card: z.literal('warlord') }),
  z.object({ card: z.literal('intrigue'), vertex: z.string() }),
  z.object({ card: z.literal('saboteur') }),
  z.object({ card: z.literal('constitution') }),
]);

export type ProgressPlay = z.infer<typeof ProgressPlaySchema>;

// game/actions.ts — vier neue Aktionen
z.object({ ...Base, type: z.literal('playProgress'), play: ProgressPlaySchema }),
z.object({ ...Base, type: z.literal('discardProgressCard'), card: ProgressCardIdSchema }),
z.object({ ...Base, type: z.literal('pickProgressDeck'), track: TrackIdSchema }),
z.object({ ...Base, type: z.literal('pickAqueduct'), resource: ResourceIdSchema }),

// game/cities/progress/progressRules.ts
export function canPlayProgress(state: GameState, player: PlayerId, play: ProgressPlay): RuleViolation | null;
export function applyPlayProgress(state: GameState, player: PlayerId, play: ProgressPlay): ReduceResult;
```

**Neue Ablehnungsgründe in `errors.ts`:**

```ts
  /** Diese Fortschrittskarte liegt nicht auf der Hand. */
  NO_SUCH_PROGRESS_CARD: 'NO_SUCH_PROGRESS_CARD',
  /** Diese Karte gibt es an diesem Tisch nicht. */
  PROGRESS_CARD_NOT_IN_PLAY: 'PROGRESS_CARD_NOT_IN_PLAY',
  /** Die Karte laesst sich gerade nicht sinnvoll spielen. */
  PROGRESS_HAS_NO_EFFECT: 'PROGRESS_HAS_NO_EFFECT',
  /** Es ist keine Stapelwahl offen. */
  NOT_PICKING_DECK: 'NOT_PICKING_DECK',
  /** Dieser Stapel ist leer. */
  PROGRESS_DECK_EMPTY: 'PROGRESS_DECK_EMPTY',
```

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
// game/cities/progress/progressRules.test.ts
describe('Fortschrittskarten spielen', () => {
  it('lehnt eine Karte ab, die nicht auf der Hand liegt', () => {
    const problem = canPlayProgress(citiesTable(), 'p1', { card: 'warlord' });
    expect(problem?.code).toBe(RuleViolationCode.NO_SUCH_PROGRESS_CARD);
  });

  it('nimmt die gespielte Karte von der Hand', () => {
    const state = withHand(citiesTable(), 'p1', ['warlord']);
    const result = applyPlayProgress(state, 'p1', { card: 'warlord' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(playerNamed(result.state, 'p1').progressCards).toEqual([]);
  });

  /*
   * Anders als bei den Entwicklungskarten gibt es keine Grenze "eine je Zug" -
   * die Regel erlaubt beliebig viele. `developmentPlayed` wird hier bewusst
   * nicht gelesen.
   */
  it('erlaubt zwei Karten im selben Zug', () => {
    const state = withHand(citiesTable(), 'p1', ['warlord', 'constitution']);
    const first = applyPlayProgress(state, 'p1', { card: 'warlord' });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(applyPlayProgress(first.state, 'p1', { card: 'constitution' }).ok).toBe(true);
    }
  });

  it('zaehlt jede spielbare Handkarte in legalActions auf', () => {
    const state = withHand(citiesTable(), 'p1', ['warlord', 'constitution']);
    const kinds = legalActions(state, 'p1')
      .filter((a) => a.type === 'playProgress')
      .map((a) => a.play.card);
    expect(kinds).toEqual(expect.arrayContaining(['warlord', 'constitution']));
  });
});
```

- [ ] **Schritt 2: Den Test laufen lassen und den Fehlschlag sehen**

Ausführen: `pnpm --filter @conquerist/shared test progressRules.test`
Erwartet: FAIL, `Cannot find module './progressRules.js'`

- [ ] **Schritt 3: Union, Verteiler und Anschluß schreiben**

`progressRules.ts` prüft das Gemeinsame — liegt die Karte auf der Hand, gibt es sie an
diesem Tisch, paßt die Phase — und gibt dann an die Datei des Stapels ab. Die Wirkungen
selbst kommen in den Aufgaben 6 bis 13; hier bekommen sie zunächst je einen Zweig, der
nur die Karte abwirft und den Zustand sonst unverändert läßt, damit der Verteiler
vollständig ist und `tsc` die Union erschöpfend prüfen kann.

`reduce` bekommt **einen** Zweig:

```ts
    case 'playProgress':
      return applyPlayProgress(state, action.player, action.play);
```

`main` in `PHASE_ACTIONS` bekommt `'playProgress'`; `rollPending` bekommt es **auch**,
weil Alchemie vor dem Wurf gespielt wird (Aufgabe 7 prüft, daß dort nur Alchemie
durchkommt).

- [ ] **Schritt 4: Die Tests laufen lassen und grün sehen**

Ausführen: `pnpm --filter @conquerist/shared test progressRules.test legal.test actions.test`
Erwartet: PASS

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src/game/
git commit -m "Eine Aktion fuer fuenfundzwanzig Karten"
```

---

> **Aufgaben 6 bis 12 sind untereinander unabhängig.** Jede hängt nur an Aufgabe 5 und
> füllt in `science.ts`, `commerce.ts` oder `politics.ts` die Zweige, die dort seit
> Aufgabe 5 als Abwurf ohne Wirkung stehen. Sie lassen sich in beliebiger Reihenfolge
> oder parallel erledigen.

## Aufgabe 6: Wissenschaft I — Ertrag und Bau

**Sechs Karten:** Bergbau (2 Erz je Gebirgsfeld mit eigener Siedlung/Stadt), Bewässerung
(2 Getreide je Ackerland, ebenso), Straßenbau (2 Straßen gratis), Medizin (Siedlung →
Stadt für 2 Erz + 1 Getreide), Ingenieur (1 Stadtmauer gratis), Schmied (2 Ritter je eine
Stufe gratis aufwerten, Bedingung für Stufe 3 gilt).

**Dateien:**

- Ändern: `packages/shared/src/game/cities/progress/science.ts`
- Test: `packages/shared/src/game/cities/progress/science.test.ts` (**neu**)

**Schnittstellen — verbraucht:** `applyBuildRoad` (`build.ts`), `applyBuildWall`
(`cities/walls.ts`), `canUpgradeKnight`/`applyUpgradeKnight` (`cities/knights.ts`) — alle
stehen seit 10b. **Die Wirkungen rufen die vorhandenen Regeln und schreiben nichts selbst
ins Brett**; sonst gäbe es zwei Auslegungen davon, wo eine Straße liegen darf.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
describe('Wissenschaft: Ertrag und Bau', () => {
  it('gibt zwei Erz je Gebirgsfeld mit eigenem Gebaeude', () => {
    // p1 hat Siedlungen an zwei Gebirgsfeldern und eine Stadt am dritten.
    const result = applyPlayProgress(threeMountains, 'p1', { card: 'mining' });
    expect(oreOf(result)).toBe(6);
  });

  it('zaehlt ein Feld nur einmal, auch bei zwei Gebaeuden daran', () => {
    const result = applyPlayProgress(twoBuildingsOneMountain, 'p1', { card: 'mining' });
    expect(oreOf(result)).toBe(2);
  });

  it('nimmt nur so viel, wie die Bank noch hat', () => {
    const poor = withBank(threeMountains, { ore: 3 });
    const result = applyPlayProgress(poor, 'p1', { card: 'mining' });
    expect(oreOf(result)).toBe(3);
  });

  it('baut zwei Strassen ohne Kosten', () => {
    const result = applyPlayProgress(state, 'p1', { card: 'roadBuilding', edges: [e1, e2] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.roads[e1]?.owner).toBe('p1');
      expect(playerNamed(result.state, 'p1').resources).toEqual(before.resources);
    }
  });

  it('lehnt eine Strasse ab, die ohne die Karte auch nicht ginge', () => {
    const result = applyPlayProgress(state, 'p1', { card: 'roadBuilding', edges: [unreachable] });
    expect(result.ok).toBe(false);
  });

  it('baut die Stadt fuer zwei Erz und ein Getreide statt drei und zwei', () => {
    const result = applyPlayProgress(hasSettlement, 'p1', { card: 'medicine', vertex: v });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.buildings[v]?.kind).toBe('city');
  });

  it('wertet zwei Ritter gratis auf und achtet auf die Festung', () => {
    // Ohne Festung (Politik 3) bleibt Stufe 2 die Grenze.
    const result = applyPlayProgress(twoKnightsNoFortress, 'p1', {
      card: 'smith',
      vertices: [a, b],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(knightAt(result.state, a).level).toBe(2);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen** — `pnpm --filter @conquerist/shared test science.test`, FAIL
- [ ] **Schritt 3: Die sechs Wirkungen in `science.ts` schreiben.** Bergbau und
      Bewässerung rechnen über die Felder des Bretts und `payOut` aus `yield.ts`, damit die
      Bank mitgeführt wird — dieselbe Begründung wie beim Aquädukt. Straßenbau, Medizin,
      Ingenieur und Schmied rufen die vorhandenen `apply…` mit einem Preis von null.
- [ ] **Schritt 4: Test laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Sechs Karten aus der Wissenschaft"`

---

## Aufgabe 7: Kran, Buchdruck, Verfassung

**Drei Karten:** Kran (ein Stadtausbau kostet in diesem Zug 1 Handelsware weniger, gilt
für genau ein Hochrücken), Buchdruck und Verfassung (je 1 Siegpunkt, sofort offen).

**Warum zusammen:** alle drei fassen etwas an, das nicht auf dem Brett steht — der Kran
den Preis des nächsten Ausbaus, die zwei anderen die Punkterechnung.

**Dateien:**

- Ändern: `packages/shared/src/game/cities/progress/science.ts`,
  `packages/shared/src/game/cities/progress/politics.ts` (Verfassung),
  `packages/shared/src/game/scoring.ts`, `packages/shared/src/game/playerView.ts`
- Ändern: `packages/shared/src/game/cities/improvements.ts` (der Rabatt)
- Test: `science.test.ts`, `scoring.test.ts`, `playerView.test.ts`

**Der Kran braucht einen Vermerk, der einen Zug lang hält.** Er kommt als Feld an den
Zustand, mit Vorgabe wie jedes neue Feld, und `endTurn` räumt ihn ab:

```ts
// game/state.ts
/**
 * Fuer welche Bereiche der naechste Ausbau in diesem Zug eine Handelsware
 * weniger kostet. Leer heisst: kein Rabatt.
 *
 * Am Zustand und nicht beim Spieler, aus demselben Grund wie
 * `developmentPlayed`: es ist immer nur einer am Zug, und `endTurn` raeumt ab.
 */
craneDiscount: z.array(TrackIdSchema).default([]),
```

**Die zwei Siegpunktkarten liegen offen.** Sie zählen deshalb in
`publicVictoryPointsOf` und nicht erst in `victoryPointsOf` — anders als die
Siegpunkt-Entwicklungskarte, die verdeckt bleibt. Wer sie in die geheime Hälfte legte,
machte den Punktestand am Tisch unnachrechenbar.

Die `PlayerView` bekommt dafür ein Feld bei den **Mitspielern**:

```ts
// game/playerView.ts — in der oeffentlichen Haelfte je Mitspieler
/**
 * Die offen liegenden Siegpunkt-Fortschrittskarten (Buchdruck, Verfassung).
 *
 * Nur diese beiden. Die uebrigen Fortschrittskarten liegen verdeckt und
 * stehen bei Mitspielern nur als Anzahl - dieselbe Grenze wie bei den
 * Handkarten.
 */
openProgressCards: z.array(ProgressCardIdSchema).default([]),
/** Wie viele verdeckte Fortschrittskarten dieser Mitspieler haelt. */
progressCardCount: z.number().int().min(0).default(0),
```

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('zieht dem naechsten Ausbau eine Handelsware ab', () => {
  const played = applyPlayProgress(state, 'p1', { card: 'crane', track: 'science' });
  expect(played.ok).toBe(true);
  if (!played.ok) return;
  const improved = applyImproveCity(played.state, 'p1', 'science', undefined);
  expect(paperSpent(state, improved)).toBe(normalPrice - 1);
});

it('gilt fuer genau ein Hochruecken', () => {
  // Nach dem ersten Ausbau ist der Rabatt weg.
  expect(afterTwoImprovements.craneDiscount).toEqual([]);
});

it('zaehlt Buchdruck und Verfassung oeffentlich', () => {
  const state = withHand(citiesTable(), 'p1', ['printer', 'constitution']);
  expect(publicVictoryPointsOf(state, 'p1')).toBe(baseline + 2);
});

it('zeigt die zwei Siegpunktkarten auch den Mitspielern', () => {
  const view = playerViewOf(withHand(citiesTable(), 'p1', ['printer', 'crane']), 'p2');
  const p1 = view.players.find((entry) => entry.id === 'p1');
  expect(p1?.openProgressCards).toEqual(['printer']);
});
```

- [ ] **Schritt 2: Test laufen lassen** — FAIL
- [ ] **Schritt 3: Rabatt, Punkte und Sicht schreiben.** `canImproveCity` liest
      `craneDiscount` beim Preis; `applyImproveCity` streicht den Bereich aus der Liste.
      `endTurn` setzt `craneDiscount: []`.
- [ ] **Schritt 4: Test laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Ein Rabatt und zwei offene Punkte"`

---

## Aufgabe 8: Alchemie und Erfinder

**Zwei Karten, beide Sonderfälle.** Alchemie wird **vor** dem Wurf gespielt und bestimmt
beide Augenwürfel; der Ereigniswürfel fällt normal und wird **zuerst** ausgeführt.
Erfinder vertauscht zwei Zahlenchips — nicht 2, 12, 6, 8.

**Dateien:**

- Ändern: `packages/shared/src/game/cities/progress/science.ts`
- Ändern: `packages/shared/src/game/board.ts` (Chips tauschen)
- Ändern: `packages/shared/src/game/reducer.ts` (`rollDice` liest den Vorsatz)
- Test: `science.test.ts`, `board.test.ts`, `reducer.test.ts`

**Alchemie legt keine Würfel, sie legt einen Vorsatz.** Der Wurf bleibt eine Aktion des
Spielers; sonst hätte `rollDice` zwei Bedeutungen.

```ts
// game/state.ts
/**
 * Die beiden Augen, die Alchemie fuer den naechsten Wurf festlegt. `null`
 * heisst: normal wuerfeln.
 *
 * Der Ereigniswuerfel steht bewusst nicht drin - die Regel wuerfelt ihn
 * normal und fuehrt ihn zuerst aus.
 */
alchemistRoll: z.object({ first: z.number(), second: z.number() }).nullable().default(null),
```

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('laesst Alchemie nur vor dem Wurf spielen', () => {
  const inMain = { ...withHand(citiesTable(), 'p1', ['alchemist']), phase: { kind: 'main' } };
  expect(canPlayProgress(inMain, 'p1', { card: 'alchemist', first: 3, second: 4 })?.code).toBe(
    RuleViolationCode.WRONG_PHASE,
  );
});

it('laesst in rollPending nur Alchemie durch', () => {
  const waiting = { ...withHand(citiesTable(), 'p1', ['warlord']), phase: { kind: 'rollPending' } };
  expect(canPlayProgress(waiting, 'p1', { card: 'warlord' })?.code).toBe(
    RuleViolationCode.WRONG_PHASE,
  );
});

it('setzt die zwei Augen und wuerfelt das Ereignis trotzdem', () => {
  const played = applyPlayProgress(beforeRoll, 'p1', { card: 'alchemist', first: 3, second: 4 });
  expect(played.ok).toBe(true);
  if (!played.ok) return;
  const rolled = reduce(played.state, { type: 'rollDice', player: 'p1' });
  expect(rolled.ok).toBe(true);
  if (rolled.ok) {
    expect(yieldTotal(rolled.state.rules.dice, rolled.state.lastRoll!)).toBe(7);
    expect(eventFaceOf(rolled.state.lastRoll!)).not.toBeNull();
    expect(rolled.state.alchemistRoll).toBeNull();
  }
});

it('vertauscht zwei Zahlenchips', () => {
  const result = applyPlayProgress(state, 'p1', { card: 'inventor', a: hexA, b: hexB });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.state.board.hexes[hexA]?.number).toBe(numberAt(state, hexB));
  }
});

it('laesst 2, 12, 6 und 8 nicht vertauschen', () => {
  const result = applyPlayProgress(state, 'p1', { card: 'inventor', a: hexWithSix, b: hexB });
  expect(result.ok).toBe(false);
});
```

- [ ] **Schritt 2: Test laufen lassen** — FAIL
- [ ] **Schritt 3: Beide Wirkungen schreiben.** In `rollDice` liest der Wurf
      `alchemistRoll`, setzt die zwei Augen und würfelt den Ereigniswürfel normal über den
      `rng`; danach `alchemistRoll: null`. **Der Zufallszustand wird auch bei Alchemie
      fortgeschrieben**, sonst liefe die Partie ab dort anders nach als beim Replay.
- [ ] **Schritt 4: Test laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Gesetzte Wuerfel und getauschte Chips"`

---

## Aufgabe 9: Die Monopole und die Handelsflotte

**Drei Karten:** Rohstoffmonopol (eine Sorte bestimmen, alle anderen geben 2 Karten davon
bzw. was sie haben), Handelsmonopol (eine Handelsware, alle anderen geben 1), Handelsflotte
(bis Zugende eine Sorte beliebig oft 2:1 tauschen).

**Warum ohne fremde Antwort:** bei beiden Monopolen gibt es **nichts zu entscheiden** —
die Sorte steht fest, die Menge auch. Deshalb gehören sie in diese Etappe und nicht zu den
fünf aus 10d-2.

**Dateien:**

- Ändern: `packages/shared/src/game/cities/progress/commerce.ts`
- Ändern: `packages/shared/src/game/trade.ts` (die Flotte im Kurs)
- Ändern: `packages/shared/src/game/state.ts` (`fleetSort`, mit Vorgabe, `endTurn` räumt ab)
- Test: `commerce.test.ts` (**neu**), `trade.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('nimmt jedem anderen zwei Karten der genannten Sorte', () => {
  const result = applyPlayProgress(state, 'p1', { card: 'resourceMonopoly', resource: 'wool' });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(woolOf(result.state, 'p1')).toBe(before1 + 4); // zwei Mitspieler
    expect(woolOf(result.state, 'p2')).toBe(0);
  }
});

it('nimmt nur, was einer hat', () => {
  const thin = withResources(state, 'p2', { wool: 1 });
  const result = applyPlayProgress(thin, 'p1', { card: 'resourceMonopoly', resource: 'wool' });
  if (result.ok) expect(woolOf(result.state, 'p1')).toBe(before1 + 1 + 2);
});

it('nimmt beim Handelsmonopol nur eine Karte je Person', () => {
  const result = applyPlayProgress(state, 'p1', { card: 'commodityMonopoly', commodity: 'cloth' });
  if (result.ok) expect(clothOf(result.state, 'p1')).toBe(before + 2);
});

it('tauscht mit der Flotte zwei zu eins bis Zugende', () => {
  const played = applyPlayProgress(state, 'p1', { card: 'merchantFleet', sort: 'wool' });
  if (!played.ok) return;
  expect(rateFor(played.state, 'p1', 'wool')).toBe(2);
  expect(rateFor(endTurnOf(played.state), 'p1', 'wool')).toBe(4);
});
```

- [ ] **Schritt 2: Test laufen lassen** — FAIL
- [ ] **Schritt 3: Die drei Wirkungen schreiben.** Der Kurs der Flotte gehört in
      `trade.ts` neben Hafen und Gilde, damit es **eine** Stelle gibt, die einen Kurs
      bestimmt.
- [ ] **Schritt 4: Test laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Zwei Monopole und eine Flotte"`

---

## Aufgabe 10: Der Händler

**Eine Karte, aber die aufwendigste des Stapels.** Die Händlerfigur kommt auf ein
Landschaftsfeld neben einer **eigenen** Siedlung oder Stadt; ihr Besitzer tauscht den
Rohstoff dieses Feldes 2:1, solange sie dort steht, und zählt **1 Siegpunkt**.

**Dateien:**

- Neu: `packages/shared/src/game/cities/merchant.ts`
- Ändern: `progress/commerce.ts`, `game/trade.ts`, `game/scoring.ts`, `game/playerView.ts`
- Test: `packages/shared/src/game/cities/merchant.test.ts` (**neu**)

**Die Figur steht am Zustand, nicht beim Spieler** — dieselbe Entscheidung wie bei
`robber` und bei den Rittern: die Belegung des Bretts steht einmal, und sie wechselt den
Besitzer, ohne daß der alte Besitzer etwas tut.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('stellt die Figur nur neben ein eigenes Gebaeude', () => {
  const far = applyPlayProgress(state, 'p1', { card: 'merchant', hex: hexWithoutOwnBuilding });
  expect(far.ok).toBe(false);
});

it('stellt sie nicht auf die See', () => {
  expect(applyPlayProgress(state, 'p1', { card: 'merchant', hex: seaHex }).ok).toBe(false);
});

it('gibt ihrem Besitzer zwei zu eins auf dem Rohstoff des Feldes', () => {
  const played = applyPlayProgress(state, 'p1', { card: 'merchant', hex: forestHex });
  if (played.ok) expect(rateFor(played.state, 'p1', 'lumber')).toBe(2);
});

it('zaehlt einen Punkt, und nur beim aktuellen Besitzer', () => {
  const played = applyPlayProgress(state, 'p1', { card: 'merchant', hex: forestHex });
  if (!played.ok) return;
  expect(publicVictoryPointsOf(played.state, 'p1')).toBe(baseline1 + 1);
  const taken = applyPlayProgress(played.state, 'p2', { card: 'merchant', hex: p2Hex });
  if (taken.ok) {
    expect(publicVictoryPointsOf(taken.state, 'p1')).toBe(baseline1);
    expect(publicVictoryPointsOf(taken.state, 'p2')).toBe(baseline2 + 1);
  }
});
```

- [ ] **Schritt 2: Test laufen lassen** — FAIL
- [ ] **Schritt 3: `merchant.ts`, den Kurs und den Summanden schreiben.** Der Punkt ist
      **öffentlich** (die Figur steht auf dem Brett), also `publicVictoryPointsOf`.
- [ ] **Schritt 4: Test laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Die Haendlerfigur steht auf dem Brett"`

---

## Aufgabe 11: Heerführer, Sabotage, Intrige

**Drei Karten, zwei davon ohne neue Bauform.** Heerführer aktiviert alle eigenen Ritter
gratis. Sabotage läßt alle mit **gleich vielen oder mehr** Siegpunkten die Hälfte ihrer
Handkarten abwerfen (abgerundet) — das ist `discardPending` aus Etappe 5. Intrige
vertreibt einen fremden Ritter von einer Kreuzung, die man mit eigener Straße erreicht —
das ist `displacePending` aus 10b.

**Warum das der Kern des Zuschnitts ist:** genau weil diese beiden vorhandene Phasen
benutzen, gehören sie in 10d-1 und nicht zu den fünf aus 10d-2.

**Dateien:**

- Ändern: `packages/shared/src/game/cities/progress/politics.ts`
- Test: `packages/shared/src/game/cities/progress/politics.test.ts` (**neu**)

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('aktiviert alle eigenen Ritter ohne Kosten', () => {
  const result = applyPlayProgress(threePassiveKnights, 'p1', { card: 'warlord' });
  if (result.ok) {
    expect(activeKnightsOf(result.state, 'p1')).toBe(3);
    expect(playerNamed(result.state, 'p1').resources).toEqual(before.resources);
  }
});

/*
 * Ein frisch aktivierter Ritter darf in derselben Runde nicht handeln - die
 * Regel aus 10b gilt auch hier, und `activatedOnTurn` traegt sie.
 */
it('setzt bei den aktivierten Rittern die laufende Runde', () => {
  const result = applyPlayProgress(threePassiveKnights, 'p1', { card: 'warlord' });
  if (result.ok) expect(knightAt(result.state, a).activatedOnTurn).toBe(result.state.turn);
});

it('schickt bei Sabotage alle mit gleich vielen oder mehr Punkten ins Abwerfen', () => {
  // p1 spielt und hat 4 Punkte, p2 hat 5, p3 hat 3.
  const result = applyPlayProgress(state, 'p1', { card: 'saboteur' });
  if (result.ok) expect(result.state.phase).toEqual({ kind: 'discardPending', pending: ['p2'] });
});

it('laesst bei Sabotage die Haelfte abgerundet abwerfen', () => {
  // p2 haelt sieben Karten -> drei.
  const result = applyPlayProgress(state, 'p1', { card: 'saboteur' });
  if (result.ok) expect(discardCountFor(result.state, 'p2')).toBe(3);
});

it('vertreibt bei Intrige einen fremden Ritter ohne eigenen Ritter', () => {
  const result = applyPlayProgress(reachableFoe, 'p1', { card: 'intrigue', vertex: v });
  if (result.ok) expect(result.state.phase.kind).toBe('displacePending');
});

it('lehnt Intrige auf einer Kreuzung ohne eigene Strasse ab', () => {
  expect(applyPlayProgress(state, 'p1', { card: 'intrigue', vertex: unreachable }).ok).toBe(false);
});
```

- [ ] **Schritt 2: Test laufen lassen** — FAIL
- [ ] **Schritt 3: Die drei Wirkungen schreiben.** Sabotage ruft dieselbe Rechnung, die
      `playersMustDiscard` für die Sieben benutzt — mit einer anderen Auswahlregel, aber
      derselben Phase. Intrige ruft `displacementTargets` aus `cities/knightActions.ts`.
- [ ] **Schritt 4: Test laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Drei Karten aus der Politik"`

---

## Aufgabe 12: Bischof und Diplomat

**Zwei Karten, beide mit einem Brettziel.** Bischof versetzt den Räuber und zieht von
**jeder** Person am neuen Feld eine Handkarte (je Person nur eine). Diplomat entfernt eine
beliebige **offene** Straße; eine eigene darf man sofort neu setzen.

**Was „offen" heißt:** eine Straße, an deren einem Ende **kein Gebäude** steht und von
deren Ende keine weitere Straße desselben Besitzers ausgeht. Die Bestimmung gehört zu den
Straßen und nicht zur Karte — `roads.ts` rechnet die Längste Handelsroute und weiß bereits,
wie Straßen zusammenhängen.

**Dateien:**

- Ändern: `packages/shared/src/game/cities/progress/politics.ts`
- Ändern: `packages/shared/src/game/roads.ts` (`openRoads`)
- Test: `politics.test.ts`, `roads.test.ts`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('zieht beim Bischof von jeder Person am Feld genau eine Karte', () => {
  // p2 und p3 haben Gebaeude am Zielfeld, p3 zweimal.
  const result = applyPlayProgress(state, 'p1', { card: 'bishop', hex: target });
  if (result.ok) {
    expect(handSize(result.state, 'p1')).toBe(before1 + 2);
    expect(handSize(result.state, 'p3')).toBe(before3 - 1);
  }
});

it('setzt beim Bischof den Raeuber um und braucht kein Opfer', () => {
  const result = applyPlayProgress(state, 'p1', { card: 'bishop', hex: target });
  if (result.ok) {
    expect(result.state.robber).toBe(target);
    expect(result.state.phase.kind).toBe('main'); // keine robberPending-Nachfrage
  }
});

it('findet die offenen Strassen', () => {
  expect(openRoads(state)).toContain(danglingEdge);
  expect(openRoads(state)).not.toContain(edgeBetweenTwoSettlements);
});

it('entfernt beim Diplomaten eine offene Strasse und gibt sie in den Vorrat', () => {
  const result = applyPlayProgress(state, 'p1', { card: 'diplomat', edge: foreignOpen });
  if (result.ok) {
    expect(result.state.roads[foreignOpen]).toBeUndefined();
    expect(piecesLeftOf(result.state, 'p2').road).toBe(beforeStock + 1);
  }
});

it('rechnet die Laengste Handelsroute nach dem Diplomaten neu', () => {
  const result = applyPlayProgress(longestRoadRunsThroughIt, 'p1', {
    card: 'diplomat',
    edge: middleOfChain,
  });
  if (result.ok) expect(result.state.longestRoad.holder).not.toBe('p2');
});

it('laesst eine eigene entfernte Strasse sofort neu setzen', () => {
  const result = applyPlayProgress(state, 'p1', {
    card: 'diplomat',
    edge: ownOpen,
    rebuildAt: elsewhere,
  });
  if (result.ok) expect(result.state.roads[elsewhere]?.owner).toBe('p1');
});
```

- [ ] **Schritt 2: Test laufen lassen** — FAIL
- [ ] **Schritt 3: Beide Wirkungen und `openRoads` schreiben.** Der Bischof zieht **nicht**
      über `robberPending` — er hat kein Opfer zu wählen, er nimmt von allen. Die Neubau-
      Erlaubnis des Diplomaten steht als optionales `rebuildAt` in derselben Aktion und
      nicht als zweite Phase: sie läßt sich nicht aufschieben, und ein Feld, das mal erlaubt
      und mal verboten ist, gehört in `canPlayProgress` — dieselbe Begründung wie bei
      `metropolisAt` in 10c.
- [ ] **Schritt 4: Test laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Der Bischof und der Diplomat"`

---

## Aufgabe 13: Ein Integrationstest bis zur ersten gespielten Karte

**Warum:** die Spec verlangt ihn je Etappe (Abschnitt 10). Er ist der einzige Test, der die
ganze Kette aus Aufgabe 4 an einer echten Partie durchläuft, statt sie zu stellen.

**Dateien:**

- Ändern: `packages/shared/src/game/game.integration.test.ts`

- [ ] **Schritt 1: Den Test schreiben**

```ts
it('spielt eine Staedte-Partie bis zur ersten gespielten Fortschrittskarte', () => {
  // Gruendung, dann so lange wuerfeln, bis ein Stadttor faellt und jemand
  // ueber die Schwelle kommt. Der Seed ist fest, also ist der Lauf reproduzierbar.
  let state = afterOpening(
    createGame({ seed: 'fortschritt', players: ['p1', 'p2'], rules: CITIES_RULES }),
  );

  // Wissenschaft auf Stufe 1 bringen, damit die Schwelle 2 statt 1 ist.
  state = improveTo(state, 'p1', 'science', 1);

  const played = playUntil(state, (s) => playerNamed(s, 'p1').progressCards.length > 0);
  expect(playerNamed(played, 'p1').progressCards.length).toBeGreaterThan(0);

  const card = playerNamed(played, 'p1').progressCards[0]!;
  const result = reduce(inMainPhase(played, 'p1'), {
    type: 'playProgress',
    player: 'p1',
    play: playFor(card),
  });
  expect(result.ok).toBe(true);
  if (result.ok) expect(playerNamed(result.state, 'p1').progressCards).not.toContain(card);
});

/*
 * Der Regressionstest aus der Spec (Abschnitt 10): eine gespeicherte Partie
 * ohne die neuen Felder muss weiter einlesen. Das ist die Falle, die in diesem
 * Repo schon zweimal jede laufende Partie gekostet haette.
 */
it('liest eine gespeicherte Partie ohne progressDecks weiter ein', () => {
  const old = JSON.parse(readFileSync('src/game/__fixtures__/saved-10c.json', 'utf8'));
  const parsed = GameStateSchema.safeParse(old);
  expect(parsed.success).toBe(true);
  if (parsed.success) {
    expect(parsed.data.progressDecks).toEqual({});
    expect(parsed.data.merchant).toBeNull();
    expect(parsed.data.players[0]!.progressCards).toEqual([]);
  }
});
```

- [ ] **Schritt 2: Test laufen lassen** — der Regressionstest schlägt fehl, solange die
      Fixture-Datei fehlt
- [ ] **Schritt 3: `saved-10c.json` anlegen** — ein `createGame` mit `CITIES_RULES` auf dem
      Stand vor dieser Etappe, als JSON abgelegt. **Nicht neu erzeugen, sondern aus
      `git show c4e109f` heraus bauen**, sonst prüft der Test die neue Fassung gegen sich
      selbst und beweist nichts.
- [ ] **Schritt 4: Test laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Eine Partie bis zur ersten Karte"`

---

## Aufgabe 14: „Erst was, dann wo" bekommt eine gemeinsame Form

**Warum jetzt:** `buildMode`, `knightMode` und `metropolisFor` in `GameScreen.tsx` sind
seit 10c drei strukturgleiche Felder, und `PROGRESS.md` hält fest, daß bei der **vierten**
Gelegenheit die Abstraktion fällig ist. Händler und Bischof sind die vierte und fünfte.
Ohne diese Aufgabe entstünden in Aufgabe 15 zwei weitere Kopien.

**Dateien:**

- Neu: `apps/client/src/game/pickMode.ts`
- Ändern: `apps/client/src/screens/GameScreen.tsx`
- Test: `apps/client/src/game/pickMode.test.ts` (**neu**), `GameScreen.test.tsx`

**Schnittstellen — liefert:**

```ts
// apps/client/src/game/pickMode.ts
/**
 * Ein Zug, der erst fragt „was" und dann „wo".
 *
 * Bis 10c stand diese Form dreimal als eigenes useState-Feld im GameScreen.
 * Sie ist jedes Mal dieselbe: eine Absicht wird gemerkt, das Brett zeigt
 * Ziele, ein Klick schließt ab, Escape bricht ab.
 */
export interface PickMode<TIntent> {
  readonly intent: TIntent | null;
  begin(intent: TIntent): void;
  cancel(): void;
  /** Die Ziele, die das Brett gerade hervorhebt. Leer, solange nichts gewählt ist. */
  readonly targets: readonly string[];
}

export function usePickMode<TIntent>(
  targetsFor: (intent: TIntent) => readonly string[],
): PickMode<TIntent>;
```

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('zeigt vor der Wahl keine Ziele', () => {
  const { result } = renderHook(() => usePickMode(() => ['a', 'b']));
  expect(result.current.targets).toEqual([]);
});

it('zeigt nach der Wahl die Ziele der Absicht', () => {
  const { result } = renderHook(() => usePickMode((k: string) => (k === 'road' ? ['e1'] : [])));
  act(() => result.current.begin('road'));
  expect(result.current.targets).toEqual(['e1']);
});

it('vergisst die Absicht beim Abbrechen', () => {
  const { result } = renderHook(() => usePickMode(() => ['a']));
  act(() => result.current.begin('x'));
  act(() => result.current.cancel());
  expect(result.current.intent).toBeNull();
  expect(result.current.targets).toEqual([]);
});
```

- [ ] **Schritt 2: Test laufen lassen** — FAIL
- [ ] **Schritt 3: `pickMode.ts` schreiben und die drei vorhandenen Felder darauf
      umstellen.** `buildMode`, `knightMode` und `metropolisFor` verschwinden als eigene
      `useState`; ihre Tests in `GameScreen.test.tsx` bleiben **unverändert** — sie prüfen
      Verhalten am Bildschirm, nicht die Innerei. Bleibt einer rot, ist das ein Befund und
      keine Testanpassung.
- [ ] **Schritt 4: Tests laufen lassen** — `pnpm --filter @conquerist/client test pickMode GameScreen`, PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Erst was, dann wo - jetzt einmal"`

---

## Aufgabe 15: Die Stapel, die Hand und die Dialoge

**Was am Bildschirm entsteht:** die drei Stapel als Material, die eigenen
Fortschrittskarten im Kartenkörper der Entwicklungskarten mit Grundton je Stapel und
Namen, die Auswahldialoge der Karten, die eine Angabe brauchen, und ein Bedienelement für
jede der drei neuen Wartephasen.

**Dateien:**

- Neu: `apps/client/src/panels/ProgressPanel.tsx`, `dialogs/ProgressPlayDialog.tsx`,
  `dialogs/ProgressDiscardDialog.tsx`, `dialogs/PickDeckDialog.tsx`
- Ändern: `screens/GameScreen.tsx`, `game/targets.ts`, `index.css`
- Test: je eine `.test.tsx` neben jeder neuen Datei

**Welche Karte welchen Dialog braucht:**

| Karte                                                             | Angabe                 | Weg                  |
| ----------------------------------------------------------------- | ---------------------- | -------------------- |
| Bergbau, Bewässerung, Buchdruck, Verfassung, Heerführer, Sabotage | keine                  | direkt spielen       |
| Alchemie                                                          | zwei Augenzahlen       | Dialog               |
| Kran                                                              | welcher Bereich        | Dialog               |
| Rohstoffmonopol, Handelsmonopol, Handelsflotte                    | welche Sorte           | Dialog               |
| Erfinder                                                          | zwei Zahlenchips       | Brett, zwei Klicks   |
| Händler, Bischof                                                  | welches Feld           | Brett, `usePickMode` |
| Ingenieur, Medizin, Intrige                                       | welche Kreuzung        | Brett, `usePickMode` |
| Straßenbau, Schmied, Diplomat                                     | Kanten bzw. Kreuzungen | Brett, `usePickMode` |

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

```tsx
it('zeigt an einem Basistisch keine Fortschrittsstapel', () => {
  render(<GameScreen view={classicView} />);
  expect(screen.queryByText('Fortschritt')).toBeNull();
});

it('zeigt die drei Stapel mit ihrer Resthöhe', () => {
  render(<ProgressPanel view={citiesView} />);
  expect(screen.getByRole('group', { name: /Wissenschaft/ })).toHaveTextContent('18');
});

/* Designregel 7: die Stapelfarbe steht nie allein. */
it('nennt zu jeder Karte ihren Namen', () => {
  render(<ProgressPanel view={withHandView(['warlord'])} />);
  expect(screen.getByText('Heerführer')).toBeInTheDocument();
});

it('spielt eine Karte ohne Angabe mit einem Klick', async () => {
  const onAction = vi.fn();
  render(<ProgressPanel view={withHandView(['warlord'])} onAction={onAction} />);
  await user.click(screen.getByRole('button', { name: /Heerführer/ }));
  expect(onAction).toHaveBeenCalledWith({ type: 'playProgress', play: { card: 'warlord' } });
});

it('fragt beim Monopol nach der Sorte', async () => {
  render(<ProgressPanel view={withHandView(['resourceMonopoly'])} onAction={onAction} />);
  await user.click(screen.getByRole('button', { name: /Rohstoffmonopol/ }));
  expect(screen.getByRole('dialog', { name: /Sorte/ })).toBeInTheDocument();
});

it('laesst in progressDiscardPending genau eine Karte zurueckgeben', async () => {
  render(<GameScreen view={discardPendingView} onAction={onAction} />);
  await user.click(screen.getByRole('button', { name: /Kran/ }));
  expect(onAction).toHaveBeenCalledWith({ type: 'discardProgressCard', card: 'crane' });
});

it('laesst bei defenderPending einen Stapel waehlen', async () => {
  render(<GameScreen view={defenderPendingView} onAction={onAction} />);
  await user.click(screen.getByRole('button', { name: /Politik/ }));
  expect(onAction).toHaveBeenCalledWith({ type: 'pickProgressDeck', track: 'politics' });
});

it('laesst am Aquaedukt den Rohstoff waehlen', async () => {
  render(<GameScreen view={aqueductPendingView} onAction={onAction} />);
  await user.click(screen.getByRole('button', { name: /Erz/ }));
  expect(onAction).toHaveBeenCalledWith({ type: 'pickAqueduct', resource: 'ore' });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL
- [ ] **Schritt 3: Die vier Bauteile schreiben.** Der Kartenkörper kommt aus derselben
      CSS-Klasse wie die Entwicklungskarten; neu sind nur drei Grundtöne, und die stehen
      als `--track-science`, `--track-trade`, `--track-politics` schon in `index.css`.
      **Kein Hex-Wert in der Komponente.** Brettziele gehen über `usePickMode` aus Aufgabe 14.
- [ ] **Schritt 4: Tests laufen lassen** — PASS
- [ ] **Schritt 5: Committen** — `git commit -m "Drei Stapel am Bildschirm"`

---

## Aufgabe 16: Der Durchgang im Browser

**Warum als eigene Aufgabe:** nach 10b hat der Durchgang **elf Befunde** geliefert, von
denen keiner durch einen Test gefallen wäre. Er gehört in die Abnahme und nicht in die
offenen Punkte.

**Vorbereitung, die 10c gefehlt hat:** das Chrome-Fenster **vor** dem Durchgang aus der
Maximierung lösen. `resize_window` ändert die Breite eines maximierten Fensters nicht —
nach `resize_window(400, 800)` blieb `outerWidth` bei 1920. Ohne diesen Schritt bleiben die
zwei Viewport-Breakpoints wieder ungeprüft.

- [ ] **Schritt 1: `pnpm dev` starten, Fenster entmaximieren, lokale Partie mit
      `CITIES_RULES` beginnen**
- [ ] **Schritt 2: Zehn Punkte messen und jeden mit einer Zahl belegen**

1. Die drei Stapel stehen und zeigen ihre Resthöhe.
2. Ein Stadttor fällt, jemand zieht, der Verlauf sagt es.
3. Eine Karte ohne Angabe läßt sich mit einem Klick spielen.
4. Ein Monopol fragt nach der Sorte und nimmt allen anderen.
5. Der Händler landet auf dem Brett und trägt seinen Punkt.
6. Die fünfte Karte öffnet das Zurücklegen — und **nur** bei dem, der nicht am Zug ist.
7. Das Aquädukt fragt jetzt wirklich (der offene Punkt aus 10c).
8. Alchemie vor dem Wurf: der Ereigniswürfel fällt trotzdem.
9. Kontrast jedes Kartennamens auf seinem Grundton, gemessen, nicht geschätzt.
10. Trefferflächen der Kartenknöpfe ≥ 44 px.

- [ ] **Schritt 3: Die zwei Viewport-Breakpoints prüfen** (396 px und der mittlere), über
      ein `iframe` fester Größe auf derselben Origin — root-`zoom` taugt dafür nicht.
- [ ] **Schritt 4: Befunde beheben, jeden mit einem eigenen Commit**
- [ ] **Schritt 5: Committen** — `git commit -m "Was der Browser zu den Fortschrittskarten gesagt hat"`

**Beim Klicken beachten** (alles schon bezahlt gelernt):

- Brettklicks gehen **nur über die Fangfläche**: Mittelpunkt rechnen,
  `document.elementFromPoint(x, y)` nehmen (das ist `rect.board__catcher`), dort
  `pointerdown → mousedown → pointerup → mouseup → click` mit `clientX/clientY`.
- Die Screenshots der Erweiterung sind **nicht maßstabsgetreu** (1568 px Bild gegen 1920 px
  Viewport). Nach Bildkoordinaten geklickt landet man 24 % daneben.
- Zwischen zwei Klicks auf dasselbe Bedienelement gehört ein `await`, sonst umgeht der
  Treiber jede React-Sperre, die ihren Zustand aus dem Render-Scope liest.
- Im Opfer-Dialog ist der erste Knopf das Schließkreuz.

---

## Aufgabe 17: Abnahme und `PROGRESS.md`

- [ ] **Schritt 1: Die volle Abnahme laufen lassen**

```bash
pnpm typecheck && pnpm -r test && pnpm build && pnpm format:check
```

Erwartet: alles grün. **`pnpm -r test`, nicht `npx vitest run`** — vom Wurzelverzeichnis
aus greift `apps/client/vitest.config.ts` nicht, und der Lauf sammelt Dateien ein, die die
Paket-Konfigurationen ausschließen.

- [ ] **Schritt 2: Den Umlaut-Suchlauf machen.** In `packages/shared` und `apps/server`
      dürfen Kommentare **und Testnamen** keine Umlaute tragen; sichtbare Texte müssen
      welche tragen. Ein Suchlauf nur über Zeichenketten findet keinen JSX-Text — sichtbarer
      Text ist Literal **und** Kinderknoten.

```bash
grep -rn '[äöüßÄÖÜ]' packages/shared/src apps/server/src | grep -v "'" | head -40
```

- [ ] **Schritt 3: `PROGRESS.md` schreiben.** Ein Abschnitt „Etappe 10d-1", mit
      **gemessenen** Zahlen (Testzahlen je Paket, Zahlen aus dem Browser-Durchgang), den
      drei bewußten Abweichungen aus dem Kopf dieses Plans **wörtlich**, und einer Liste der
      offenen Punkte — darunter mindestens: die fünf Karten und `progressPending` (10d-2),
      die 25 Kartenmotive, `deadlineOf` für die drei neuen Wartephasen, und was der
      Browser-Durchgang nicht erreicht hat.
- [ ] **Schritt 4: Committen**

```bash
git add PROGRESS.md
git commit -m "Was in 10d-1 entschieden wurde"
```

- [ ] **Schritt 5: Den Branch anbieten.** Nicht selbst nach `main` mergen und nicht pushen —
      das entscheidet der Mensch.

---

## Selbstprüfung gegen die Spec

| Anforderung der Spec                                           | Aufgabe       |
| -------------------------------------------------------------- | ------------- |
| Drei Stapel, Zusammensetzung 18/18/18                          | 1, 2          |
| Ziehbedingung am roten Würfel, Reihenfolge im Uhrzeigersinn    | 3             |
| Handlimit 4 samt `progressDiscardPending`                      | 3, 4          |
| `defenderPending` (Gleichstand nach gewonnenem Kampf)          | 4             |
| `aqueductPending` (Abweichung 2, aus 10c)                      | 4             |
| Siegpunktkarten liegen offen                                   | 7             |
| Die Händlerfigur                                               | 10            |
| `ProgressPlaySchema` als eigene Union, ein Zweig in `reduce`   | 5             |
| Dateilayout `game/cities/progress/`                            | 1, 3, 5, 6–12 |
| Sabotage über `discardPending`, Intrige über `displacePending` | 11            |
| Integrationstest bis zur ersten gespielten Karte               | 13            |
| Regressionstest auf gespeicherte Partien                       | 13            |
| Im Browser nachgesehen, je Etappe                              | 16            |
| Jede neue Regeldatei bekommt Tests                             | 1, 3, 5, 6–12 |

**Nicht in dieser Etappe, mit Absicht:** `progressPending` und die fünf wartenden Karten
(10d-2), die Sichtöffnung in `playerViewOf` (10d-2), die 25 Kartenmotive (Abweichung 1),
eine Frist für die drei neuen Wartephasen (Abweichung 3).
