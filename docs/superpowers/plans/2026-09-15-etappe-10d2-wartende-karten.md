# Etappe 10d-2 — Die fünf Karten, die auf eine fremde Antwort warten

> **Für agentische Ausführung:** ERFORDERLICHE UNTER-SKILL: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`. Die Schritte tragen Checkboxen.

**Ziel:** Großhändler, Spionage, Deserteur, Handelshafen und Hochzeit spielbar machen — mit der
Wartephase `progressPending`, der Antwort-Aktion `answerProgress`, der einen geöffneten
Geheimhaltungsgrenze in `playerViewOf`, Fristen für **alle** Wartephasen und den Dialogen am
Bildschirm.

**Ansatz:** Die fünf Karten teilen sich **eine** Phase und **eine** Aktion. Die Antwort ist eine
eigene diskriminierte Union (`ProgressAnswerSchema`), dieselbe Grenze wie `playProgress` /
`ProgressPlaySchema` aus 10d-1; ein Verteiler (`answerRules.ts`) gibt je Karte an eine eigene
Datei ab. Fristen stehen nicht im Zustand: `deadlineOf` liefert für die Wartephasen eine
**Dauer**, der Wecker rechnet `now + ms`. Beim Ablauf gilt ein Satz — **ein Geschenk verfällt,
eine Pflicht wird abgenommen** —, und jede abgenommene Pflicht geht durch dieselbe `apply…`,
die auch der Mensch auslöst.

**Technik:** TypeScript strict · Zod 4 · Vitest · React 19 + SVG · pnpm-Monorepo

**Spec:** `docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md` — Abschnitt 5.3
(„Korrektur vom 2026-09-02"), Abschnitt 5.5 „Fristen für die Wartephasen", Abschnitt 9 „Der
Zuschnitt von 10d-2, entschieden am 2026-09-02".
**Regelquelle:** `docs/regeln-staedte-und-ritter.md` 11.2 (Handelshafen, Großhändler) und 11.3
(Spionage, Deserteur, Hochzeit).
**Vorgänger:** Etappe 10d-1, `PROGRESS.md` ab „Etappe 10d-1".

## Globale Rahmenbedingungen

Diese gelten für **jede** Aufgabe und werden nicht wiederholt:

- **Antworten auf Deutsch, Code und Bezeichner auf Englisch.** Sichtbare Texte deutsch, mit
  Umlauten — Kartennamen, Verlaufssätze, Ablehnungstexte (`violation(…, '…')`), Dialogtexte.
  Kommentare deutsch, in `shared` und `server` **ohne** Umlaute (`ue`, `ae`, `oe`, `ss`); im
  Client mit Umlauten. **Testnamen zählen als Kommentar**, also in `shared` und `server` ohne
  Umlaute. Diese Regel ist in 10c viermal gerissen.
- **`shared` hat keine Runtime-Dependency außer `zod`.**
- **Spiellogik ist pur:** `(state, action) => newState`. Kein `Math.random()`, kein
  `Date.now()`, kein I/O. Jede automatische Antwort ist deterministisch; Gleichstand entscheidet
  die Reihenfolge in `CARD_IDS` / `COMMODITY_IDS` / `PROGRESS_CARD_IDS` bzw. die Id.
- **Jede Regel zweimal:** `can…` prüft nur und gibt `RuleViolation | null`, `apply…` prüft und
  wendet an. `legalActions` benutzt dieselben `can…`.
- **Neue Logik in `shared` bekommt Tests.** Zusicherungen stehen **nie** hinter einem `if` —
  ein `if (result.ok) expect(…)` läuft bei unerwartetem Verlauf stumm grün (Ruling 14/20 aus
  10d-1). Erst `expect(result.ok).toBe(true)`, dann die Zusicherung.
- **Jedes neue Zustands- oder Regelwerksfeld bekommt `.default(…)`.** Seit Etappe 6 liegt der
  Startzustand jeder Partie samt `RuleSet` als JSON in der Datenbank.
- **Kein Hex-Wert in einer Komponente.** Farben aus `index.css`-Variablen oder aus
  `PlayerInView.color`; am SVG per `style`.
- **Designregel 7:** Farbe ist nie der einzige Träger — jede Spielerfarbe steht neben einem
  Namen.
- **Trefferflächen mindestens 44 px.**
- **Commit-Botschaften ohne `Co-Authored-By`.**
- Branch: `etappe-10d2-wartende-karten`, angelegt ab `main` = `ba3e4c4`.
- Abnahme je Aufgabe: `pnpm typecheck` und `pnpm -r test`. Volle Abnahme in Aufgabe 17.
- **Tests immer mit `pnpm -r test`**, nie mit `npx vitest run` im Wurzelverzeichnis.

## Bewußte Abweichungen von Spec und Regelwerk

Acht Stellen, alle mit Grund. Sie gehören **wörtlich** in den `PROGRESS.md`-Abschnitt der
Aufgabe 17.

1. **Die 25 Kartenmotive entfallen.** Am 2026-09-02 als letzter, abtrennbarer Block
   vorgesehen; am 2026-09-15 vom Menschen gestrichen, weil die Reihe fertig werden soll. Die
   Karten behalten Grundton je Stapel und Namen.
2. **`progressPending` trägt kein Feld `answers`.** Die Skizze in 5.3 führt es als „was schon
   geantwortet wurde". Hier wirkt jede Antwort **sofort** — nichts liest sie später —, und ein
   Datensatz der Antworten stünde in `PlayerView.phase` offen am Tisch: welche zwei Karten p2
   bei der Hochzeit verschenkt hat, während der Verlauf bewusst nur die Anzahl nennt. Wer schon
   geantwortet hat, steht nicht mehr in `pending`.
3. **Die Karte steht nur in `payload.card`, nicht zusätzlich als `card` an der Phase.** Zwei
   Felder für dieselbe Aussage wären zwei Wahrheiten.
4. **Die Antwortfrist ist `rules.pendingAnswerMs` = 60 000 ms.** Die Spec nennt keinen Wert;
   60 s ist die Angebotsfrist. Die Frist gilt **je Stand**: der Wecker stellt sich nach jedem
   Zug neu, und bei Warteschlangen, die der Reihe nach handeln (`defenderPending`,
   `aqueductPending`, `progressDiscardPending`), nimmt der Ablauf **nur dem Vordersten** ab —
   wer hinter einem Abwesenden steht, verliert nichts. Wo gleichzeitig geantwortet wird
   (`discardPending`, Hochzeit, Handelshafen), antwortet der Ablauf für alle Übrigen.
5. **Die lokale Partie vollstreckt dieselben Fristen.** Ein Codepfad; dieselbe Begründung wie
   beim Angebot in Etappe 8 — ein Countdown, der nie auslöst, wäre eine Anzeige, die lügt.
6. **`progressPending` handelt gleichzeitig** (`actorFor` gibt `null`, wie bei
   `discardPending`). Keine der fünf Karten greift auf einen endlichen gemeinsamen Vorrat: der
   Handelshafen ist bei Ausspielen gedeckt, die Hochzeit nimmt aus fremden Händen.
7. **Der Handelshafen ist ohne Tauschpartner nicht spielbar.** Die Spec regelt den Fall nicht;
   dieselbe Haltung wie bei der Hochzeit („spielbar nur, wenn überhaupt jemand mehr Punkte
   hat").
8. **Der Lecktest prüft Werte statt Teilstrings.** Die offene Liste nannte „Schlüsselmengen";
   geprüft wird jetzt, dass kein **Wert** der Sicht außerhalb von `rules` eine Karte aus dem
   Stapel ist. Ein Feldname wie `bishopTargets` ist ein Schlüssel und fällt damit nicht mehr
   falsch an.

**Drei Auslegungen aus dem Entwurf, die dem Menschen genannt, aber nicht bestätigt sind** —
sie stehen so im Plan und dürfen beim Umsetzen nicht stillschweigend gedreht werden:
`activatedOnTurn = state.turn` beim Deserteur; die strenge Deckungsprüfung beim Handelshafen;
`robberPending` und `displacePending` in der Fristenliste.

## Dateiplan

| Datei                                                             | Rolle                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/shared/src/game/cities/progress/answer.ts`              | **neu** — `ProgressAnswerSchema`, `ProgressPendingPayloadSchema`       |
| `packages/shared/src/game/cities/progress/pending.ts`             | **neu** — Phasenhelfer: öffnen, streichen, Karten verschieben, 2-oder-alles |
| `packages/shared/src/game/cities/progress/answerRules.ts`         | **neu** — `canAnswerProgress` / `applyAnswerProgress` / `autoAnswerProgress` |
| `packages/shared/src/game/cities/progress/wedding.ts`             | **neu** — Hochzeit                                                     |
| `packages/shared/src/game/cities/progress/tradeHarbor.ts`         | **neu** — Handelshafen                                                 |
| `packages/shared/src/game/cities/progress/spy.ts`                 | **neu** — Spionage                                                     |
| `packages/shared/src/game/cities/progress/masterMerchant.ts`      | **neu** — Großhändler                                                  |
| `packages/shared/src/game/cities/progress/deserter.ts`            | **neu** — Deserteur (zwei Runden)                                      |
| `packages/shared/src/game/timeout.ts`                             | **neu** — `canTimeout` / `applyTimeout` als Verteiler über die Phasen  |
| `packages/shared/src/game/phase.ts`                               | ändern — `progressPending`                                             |
| `packages/shared/src/game/actions.ts`                             | ändern — `answerProgress`                                              |
| `packages/shared/src/game/reducer.ts`                             | ändern — Phasentabelle, `actorFor`, Verteiler                          |
| `packages/shared/src/game/legal.ts`                               | ändern — spielbare und beantwortbare Züge aufzählen                    |
| `packages/shared/src/game/playerView.ts`                          | ändern — `revealsTo`                                                   |
| `packages/shared/src/game/errors.ts`                              | ändern — drei Ablehnungsgründe                                         |
| `packages/shared/src/game/cards.ts`                               | ändern — `takeMostHeld`                                                |
| `packages/shared/src/game/deadline.ts`                            | ändern — `Deadline` mit `at` oder `after`, `msUntil`                   |
| `packages/shared/src/game/playerTrade.ts`                         | ändern — `canTimeout`/`applyTimeout` ziehen aus                        |
| `packages/shared/src/game/log.ts`                                 | ändern — Kartensätze, Antworten, Fristablauf                           |
| `packages/shared/src/game/cities/progress/play.ts`                | ändern — fünf Varianten                                                |
| `packages/shared/src/game/cities/progress/progressRules.ts`       | ändern — fünf Zweige                                                   |
| `packages/shared/src/game/cities/progress/draw.ts`                | ändern — `inTurnOrder` exportieren                                     |
| `packages/shared/src/game/cities/knights.ts`                      | ändern — `canPlaceKnightAt` herauslösen                                |
| `packages/shared/src/game/cities/index.ts`                        | ändern — `twoCardsOrAll` für den Client                                |
| `packages/shared/src/rules/ruleset.ts`, `rules/cities.ts`         | ändern — `pendingAnswerMs`, die fünf Stapeleinträge                    |
| `apps/server/src/rooms/clock.ts`                                  | ändern — `msUntil`                                                     |
| `apps/client/src/game/useHotseatGame.ts`                          | ändern — `msUntil`                                                     |
| `apps/client/src/game/useCountdown.ts`                            | **neu** — der eine Countdown für Angebot und Wartephasen               |
| `apps/client/src/panels/WaitingClock.tsx`                         | **neu** — die Wartezeile                                               |
| `apps/client/src/dialogs/PersonPickDialog.tsx`                    | **neu** — die Personenwahl                                             |
| `apps/client/src/dialogs/SpyDialog.tsx`                           | **neu** — Aufdeckdialog der Spionage                                   |
| `apps/client/src/dialogs/DiscardDialog.tsx`                       | ändern — Titel, Hinweis, Knopftext einstellbar                         |
| `apps/client/src/dialogs/ResourcePickDialog.tsx`                  | ändern — Knopftext einstellbar                                         |
| `apps/client/src/dialogs/TradeOfferDialog.tsx`                    | ändern — `useCountdown`                                                |
| `apps/client/src/panels/ProgressPanel.tsx`, `StatusPanel.tsx`     | ändern — fünf Karten spielen, Platz für die Uhr                        |
| `apps/client/src/game/view.ts`, `game/targets.ts`                 | ändern — wer handelt, Phasensatz, Brettziele des Deserteurs            |
| `apps/client/src/screens/GameScreen.tsx`, `index.css`             | ändern — Antwortdialoge, Wartezeile                                    |
| `PROGRESS.md`                                                     | ändern — Abschnitt 10d-2                                               |

## Reihenfolge der Aufgaben

1–2 stehen vor jeder Karte (sonst entsteht fünfmal dieselbe Phase). 3–7 sind die Karten und
untereinander unabhängig, **außer** dass 4 die Aufzählung in `legal.ts` umbaut, auf die 5–7
aufsetzen — also in Nummernfolge. 8 legt die Karten auf die Stapel. 9–10 sind die Fristen und
stehen **nach** den Karten, weil jede automatische Antwort ihre Karte kennt. 11 ist der
Verlauf, 12–14 der Bildschirm, 15 die zwei Testlücken, 16 der Browser, 17 die Abnahme.

## Testhelfer für die Kartentests

Die Testdateien der fünf Karten (Aufgaben 3–7) beginnen **wörtlich** mit diesem Block —
Testdateien teilen sich in diesem Repo keine Helfer. Aus dem Import-Block bleibt nur, was die
Datei benutzt; `pnpm typecheck` meldet die übrigen.

```ts
import { describe, expect, it } from 'vitest';

import { CITIES_RULES, type CardAmounts } from '../../../rules/index.js';
import type { CommodityId } from '../../../scenario/index.js';
import type { GameAction } from '../../actions.js';
import { countCards } from '../../cards.js';
import { RuleViolationCode } from '../../errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  HARBOR3_VERTEX,
  hand,
  testGame,
} from '../../fixtures.js';
import { legalActions } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { reduce } from '../../reducer.js';
import { publicVictoryPointsOf, victoryPointsOf } from '../../scoring.js';
import type { Building, GameState, Knight } from '../../state.js';
import type { ProgressCardId } from './cards.js';
import { canPlayProgress } from './progressRules.js';

/*
 * Lokale Aufbauten. Drei Spieler p1, p2, p3; p1 ist am Zug und in der
 * Hauptphase.
 */

/** Ein Staedte-Tisch, an dem diese Karte liegt - auf die Stapel kommt sie erst in Aufgabe 8. */
function tableWith(card: ProgressCardId, overrides: Partial<GameState> = {}): GameState {
  return testGame({
    rules: { ...CITIES_RULES, progressDecks: { ...CITIES_RULES.progressDecks, [card]: 2 } },
    ...overrides,
  });
}

function city(owner: PlayerId): Building {
  return { owner, kind: 'city', wall: false, metropolis: null };
}

function settlement(owner: PlayerId): Building {
  return { owner, kind: 'settlement', wall: false, metropolis: null };
}

function patchPlayer(state: GameState, id: PlayerId, patch: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === id ? { ...player, ...patch } : player)),
  };
}

function playerNamed(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`playerNamed: ${id} sitzt nicht am Tisch`);
  return player;
}

function act(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
```

---

## Aufgabe 1: Die Phase, die Antwort-Union und die Aktion

**Was entsteht:** `progressPending` als Phase, `ProgressAnswerSchema` als Union, die Aktion
`answerProgress`, ihr Platz in `PHASE_ACTIONS`, `actorFor` und `legalActions`, und der Verteiler
`answerRules.ts` — noch **ohne** eine einzige Karte. Jeder Kartenzweig lehnt bis zu seiner
Aufgabe mit „noch nicht verdrahtet" ab; an keinem Tisch liegt eine der fünf Karten (das kommt
erst in Aufgabe 8), der Zweig ist also unerreichbar.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/answer.ts`, `pending.ts`, `answerRules.ts`
- Ändern: `game/phase.ts`, `game/actions.ts`, `game/reducer.ts`, `game/legal.ts`, `game/errors.ts`,
  `game/log.ts`, `cities/progress/draw.ts`, `apps/client/src/game/view.ts`
- Test: `packages/shared/src/game/cities/progress/answerRules.test.ts` (**neu**),
  `cities/progress/draw.test.ts`

**Interfaces:**

- Produces:
  - `ProgressAnswerSchema`, `type ProgressAnswer`, `type WaitingCard = ProgressAnswer['card']`
  - `ProgressPendingPayloadSchema`, `type ProgressPendingPayload`
  - `type ProgressPendingPhase = Extract<Phase, { kind: 'progressPending' }>`
  - `openProgressPending(state, by, pending, payload): GameState`
  - `withPending(state, phase, pending): GameState`
  - `transferCards(state, from, to, amounts): GameState`
  - `twoCardsOrAll(held: number): number`
  - `canAnswerProgress(state, player, answer): RuleViolation | null`
  - `applyAnswerProgress(state, player, answer): ReduceResult`
  - `inTurnOrder(state): PlayerState[]` (jetzt exportiert)
  - `RuleViolationCode.NOT_ANSWERING_PROGRESS`, `.WRONG_PROGRESS_ANSWER`, `.INVALID_PROGRESS_VICTIM`

- [ ] **Schritt 1: Branch anlegen**

```bash
git switch -c etappe-10d2-wartende-karten main
```

- [ ] **Schritt 2: Die fehlschlagenden Tests schreiben**

`packages/shared/src/game/cities/progress/answerRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { RuleViolationCode } from '../../errors.js';
import { hand, testGame } from '../../fixtures.js';
import { GameActionSchema } from '../../actions.js';
import { PhaseSchema } from '../../phase.js';
import { reduce } from '../../reducer.js';
import { CITIES_RULES } from '../../../rules/index.js';
import type { GameState } from '../../state.js';
import { canAnswerProgress } from './answerRules.js';
import { twoCardsOrAll } from './pending.js';

/*
 * Der Verteiler ohne Karten: nur Phase, Absender und die Zuordnung Antwort zu
 * Karte. Die Wirkungen pruefen die Testdateien der fuenf Karten.
 */

/** p1 hat eine Hochzeit gespielt, p2 und p3 muessen noch schenken. */
function weddingPending(overrides: Partial<GameState> = {}): GameState {
  return testGame({
    rules: CITIES_RULES,
    phase: { kind: 'progressPending', by: 'p1', pending: ['p2', 'p3'], payload: { card: 'wedding' } },
    ...overrides,
  });
}

describe('progressPending als Phase', () => {
  it('nimmt jede der fuenf Nutzlasten an', () => {
    const payloads = [
      { card: 'wedding' },
      { card: 'tradeHarbor', resource: 'wool' },
      { card: 'spy', victim: 'p2' },
      { card: 'masterMerchant', victim: 'p2' },
      { card: 'deserter', victim: 'p2', replacement: null },
      { card: 'deserter', victim: 'p2', replacement: { level: 2, active: true } },
    ];

    for (const payload of payloads) {
      const phase = { kind: 'progressPending', by: 'p1', pending: ['p2'], payload };
      expect(PhaseSchema.safeParse(phase).success).toBe(true);
    }
  });

  it('lehnt eine Nutzlast fuer eine Karte ab, die nicht wartet', () => {
    const phase = { kind: 'progressPending', by: 'p1', pending: ['p2'], payload: { card: 'bishop' } };
    expect(PhaseSchema.safeParse(phase).success).toBe(false);
  });
});

describe('answerProgress als Aktion', () => {
  it('traegt die Antwort als eigene Union', () => {
    const action = {
      type: 'answerProgress',
      player: 'p2',
      answer: { card: 'tradeHarbor', commodity: 'cloth' },
    };
    expect(GameActionSchema.safeParse(action).success).toBe(true);
  });

  it('passt nicht in die Hauptphase', () => {
    const result = reduce(testGame({ rules: CITIES_RULES }), {
      type: 'answerProgress',
      player: 'p1',
      answer: { card: 'tradeHarbor', commodity: 'cloth' },
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('haelt den Tisch an: waehrend eine Karte wartet, wird nichts gespielt', () => {
    const result = reduce(weddingPending(), {
      type: 'playProgress',
      player: 'p1',
      play: { card: 'warlord' },
    });
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  /*
   * `actorFor` gibt fuer diese Phase `null` - gleichzeitig wie beim Abwerfen.
   * Wer nicht wartet, scheitert deshalb an der Regel und nicht an "nicht am Zug".
   */
  it('prueft den Absender in der Regel und nicht ueber den Spieler am Zug', () => {
    const result = reduce(weddingPending(), {
      type: 'answerProgress',
      player: 'p1',
      answer: { card: 'wedding', gift: hand() },
    });
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NOT_ANSWERING_PROGRESS);
  });
});

describe('canAnswerProgress', () => {
  it('lehnt ab, wer nicht in der Warteliste steht', () => {
    const problem = canAnswerProgress(weddingPending({ phase: { kind: 'main' } }), 'p2', {
      card: 'wedding',
      gift: hand(),
    });
    expect(problem?.code).toBe(RuleViolationCode.NOT_ANSWERING_PROGRESS);
  });

  it('lehnt eine Antwort zu einer anderen Karte ab', () => {
    const problem = canAnswerProgress(weddingPending(), 'p2', { card: 'spy', take: 'bishop' });
    expect(problem?.code).toBe(RuleViolationCode.WRONG_PROGRESS_ANSWER);
  });
});

describe('twoCardsOrAll', () => {
  it('verlangt zwei Karten, oder alle, wenn es weniger sind', () => {
    expect(twoCardsOrAll(5)).toBe(2);
    expect(twoCardsOrAll(2)).toBe(2);
    expect(twoCardsOrAll(1)).toBe(1);
    expect(twoCardsOrAll(0)).toBe(0);
  });
});
```

In `draw.test.ts` ergänzen (Import `inTurnOrder` aus `./draw.js` und `testGame` aus
`../../fixtures.js`, falls sie fehlen):

```ts
describe('inTurnOrder', () => {
  it('beginnt beim Spieler am Zug und laeuft im Uhrzeigersinn', () => {
    const state = testGame({ currentPlayerIndex: 1 });
    expect(inTurnOrder(state).map((player) => player.id)).toEqual(['p2', 'p3', 'p1']);
  });
});
```

- [ ] **Schritt 3: Tests laufen lassen** — `pnpm -r test`. Erwartet: FAIL, `answerRules.js`
      und `pending.js` gibt es nicht, `inTurnOrder` ist nicht exportiert.

- [ ] **Schritt 4: `answer.ts` schreiben**

```ts
import { z } from 'zod';

import { CardAmountsSchema } from '../../../rules/index.js';
import { CommodityIdSchema, ResourceIdSchema } from '../../../scenario/index.js';
import { PlayerIdSchema } from '../../player.js';
import { ProgressCardIdSchema } from './cards.js';

/**
 * Was eine wartende Fortschrittskarte als Antwort bekommt, und was zwischen
 * zwei Runden feststeht (Spec 5.3, Korrektur vom 2026-09-02).
 *
 * **Eine Union unter einer Aktion** (`answerProgress`), dieselbe Grenze wie
 * `ProgressPlaySchema` unter `playProgress`. Nur zwei der fuenf Antworten sind
 * ein Kartenbuendel - die Spionage antwortet mit einer Karte, der Deserteur mit
 * einer Kreuzung -, und `tsc` prueft den Verteiler in `answerRules.ts` so
 * erschoepfend wie den der Karten.
 *
 * Geantwortet wird bei Hochzeit und Handelshafen von den anderen, bei
 * Spionage und Grosshaendler vom Spielenden selbst nach dem Blick in die fremde
 * Hand, beim Deserteur erst vom Opfer und dann vom Spielenden.
 */
export const ProgressAnswerSchema = z.discriminatedUnion('card', [
  /** Genau zwei Karten, oder alle, wer weniger hat. */
  z.object({ card: z.literal('wedding'), gift: CardAmountsSchema }),
  z.object({ card: z.literal('tradeHarbor'), commodity: CommodityIdSchema }),
  z.object({ card: z.literal('spy'), take: ProgressCardIdSchema }),
  /** Genau zwei Karten, oder alle, wenn das Opfer weniger hat. */
  z.object({ card: z.literal('masterMerchant'), take: CardAmountsSchema }),
  /** Runde 1: welcher eigene Ritter faellt. Runde 2: wohin der Ueberlaeufer kommt. */
  z.object({ card: z.literal('deserter'), vertex: z.string() }),
]);

export type ProgressAnswer = z.infer<typeof ProgressAnswerSchema>;

/** Die fuenf Karten, die auf eine Antwort warten. */
export type WaitingCard = ProgressAnswer['card'];

/**
 * Was waehrend der Phase feststeht - je Karte.
 *
 * **Die Karte steht nur hier**, nicht zusaetzlich an der Phase: zwei Felder
 * fuer dieselbe Aussage waeren zwei Wahrheiten.
 *
 * Beim Deserteur heisst `replacement === null` Runde 1 (das Opfer waehlt), ein
 * gesetzter Wert Runde 2 (der Spielende setzt). Die Stufe darin ist schon die
 * **erzwungene** Ersatzstufe, nicht die gefallene - siehe `deserter.ts`.
 */
export const ProgressPendingPayloadSchema = z.discriminatedUnion('card', [
  z.object({ card: z.literal('wedding') }),
  z.object({ card: z.literal('tradeHarbor'), resource: ResourceIdSchema }),
  z.object({ card: z.literal('spy'), victim: PlayerIdSchema }),
  z.object({ card: z.literal('masterMerchant'), victim: PlayerIdSchema }),
  z.object({
    card: z.literal('deserter'),
    victim: PlayerIdSchema,
    replacement: z
      .object({
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        active: z.boolean(),
      })
      .nullable(),
  }),
]);

export type ProgressPendingPayload = z.infer<typeof ProgressPendingPayloadSchema>;
```

- [ ] **Schritt 5: Die Phase in `phase.ts` eintragen.** Import
      `import { ProgressPendingPayloadSchema } from './cities/progress/answer.js';` und vor
      `z.object({ kind: z.literal('main') })`:

```ts
  /**
   * Eine Fortschrittskarte wartet auf Antworten - Hochzeit, Handelshafen,
   * Spionage, Grosshaendler, Deserteur (Etappe 10d-2).
   *
   * `by` hat die Karte gespielt, `pending` muss noch antworten, im
   * Uhrzeigersinn ab `by`. Leer heisst: die Karte ist fertig, und die Phase
   * steht schon wieder auf `main`. Geantwortet wird **gleichzeitig** wie beim
   * Abwerfen - keine der fuenf Karten greift auf einen endlichen gemeinsamen
   * Vorrat.
   *
   * **Kein Feld `answers`.** Jede Antwort wirkt sofort und wird nie wieder
   * gelesen; ein Datensatz der Antworten stuende in `PlayerView.phase` offen am
   * Tisch - etwa, welche Karten bei der Hochzeit verschenkt wurden.
   */
  z.object({
    kind: z.literal('progressPending'),
    by: PlayerIdSchema,
    pending: z.array(PlayerIdSchema),
    payload: ProgressPendingPayloadSchema,
  }),
```

- [ ] **Schritt 6: Die Aktion in `actions.ts` eintragen.** Import
      `import { ProgressAnswerSchema } from './cities/progress/answer.js';`, nach `pickAqueduct`:

```ts
  /**
   * Die Antwort auf eine wartende Fortschrittskarte. `answer` traegt Karte und
   * Wahl in einer eigenen Union (`ProgressAnswerSchema`) - dieselbe Grenze wie
   * `play` bei `playProgress`.
   */
  z.object({ ...Base, type: z.literal('answerProgress'), answer: ProgressAnswerSchema }),
```

In `GAME_ACTION_TYPES` nach `'pickAqueduct'` die Zeile `'answerProgress',`.

- [ ] **Schritt 7: Drei Ablehnungsgründe in `errors.ts`**, nach `PROGRESS_HAS_NO_EFFECT`:

```ts
  /** Dieser Spieler muss gerade auf keine Fortschrittskarte antworten. */
  NOT_ANSWERING_PROGRESS: 'NOT_ANSWERING_PROGRESS',
  /** Die Antwort gehoert zu einer anderen Karte oder hat die falsche Menge. */
  WRONG_PROGRESS_ANSWER: 'WRONG_PROGRESS_ANSWER',
  /** Die genannte Person taugt nicht als Ziel dieser Karte. */
  INVALID_PROGRESS_VICTIM: 'INVALID_PROGRESS_VICTIM',
```

- [ ] **Schritt 8: `inTurnOrder` in `draw.ts` exportieren** — nur `function` → `export function`,
      und in den Kommentar darueber: „Exportiert seit 10d-2: die Warteliste der wartenden
      Karten folgt derselben Reihenfolge."

- [ ] **Schritt 9: `pending.ts` schreiben**

```ts
import type { CardAmounts } from '../../../rules/index.js';
import { addCards, subtractCards } from '../../cards.js';
import type { Phase } from '../../phase.js';
import type { PlayerId } from '../../player.js';
import type { GameState } from '../../state.js';
import type { ProgressPendingPayload } from './answer.js';

/**
 * Was die fuenf wartenden Karten gemeinsam brauchen - ohne eine davon zu
 * kennen. Die Kartendateien importieren von hier, der Verteiler
 * `answerRules.ts` importiert die Kartendateien; so gibt es keinen Ladezirkel.
 */

export type ProgressPendingPhase = Extract<Phase, { kind: 'progressPending' }>;

/**
 * Oeffnet die Wartephase - oder laesst den Zustand, wie er ist, wenn niemand
 * zu antworten hat. Eine Phase, die auf niemanden wartet, hielte den Tisch fuer
 * nichts an (dieselbe Haltung wie bei `displacePending`).
 */
export function openProgressPending(
  state: GameState,
  by: PlayerId,
  pending: readonly PlayerId[],
  payload: ProgressPendingPayload,
): GameState {
  if (pending.length === 0) return state;
  return { ...state, phase: { kind: 'progressPending', by, pending: [...pending], payload } };
}

/** Setzt die Warteliste neu - leer heisst zurueck in die Hauptphase. */
export function withPending(
  state: GameState,
  phase: ProgressPendingPhase,
  pending: readonly PlayerId[],
): GameState {
  return pending.length === 0
    ? { ...state, phase: { kind: 'main' } }
    : { ...state, phase: { ...phase, pending: [...pending] } };
}

/** Verschiebt Karten von einer Hand in eine andere. Gedeckt sein muss es vorher. */
export function transferCards(
  state: GameState,
  from: PlayerId,
  to: PlayerId,
  amounts: CardAmounts,
): GameState {
  return {
    ...state,
    players: state.players.map((entry) => {
      if (entry.id === from) return { ...entry, resources: subtractCards(entry.resources, amounts) };
      if (entry.id === to) return { ...entry, resources: addCards(entry.resources, amounts) };
      return entry;
    }),
  };
}

/**
 * Wie viele Karten Hochzeit und Grosshaendler bewegen: zwei, oder alle, wenn es
 * weniger sind. Exportiert bis in den Client, damit der Zaehlerdialog dieselbe
 * Zahl verlangt wie die Regel und keine eigene Rechnung dafuer hat.
 */
export function twoCardsOrAll(held: number): number {
  return Math.min(2, held);
}
```

- [ ] **Schritt 10: `answerRules.ts` schreiben**

```ts
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, WaitingCard } from './answer.js';
import { PROGRESS_NAMES } from './cards.js';

/**
 * Die Aktion `answerProgress` und ihr Verteiler - das Gegenstueck zu
 * `progressRules.ts`.
 *
 * Hier steht das Gemeinsame: wartet die Phase, steht der Absender in der
 * Warteliste, gehoert die Antwort zur wartenden Karte. Was die Antwort bei
 * ihrer Karte verlangt und bewirkt, steht in der Datei der Karte.
 *
 * Jeder Zweig verengt `phase.payload` selbst auf seine Karte, statt sich auf
 * die Pruefung davor zu verlassen: `tsc` sieht die Verbindung zwischen
 * `answer.card` und `payload.card` nicht, und ein Cast waere eine Behauptung.
 */

function wrongCard(waitingFor: WaitingCard): RuleViolation {
  return violation(
    RuleViolationCode.WRONG_PROGRESS_ANSWER,
    `Gewartet wird auf eine Antwort zu ${PROGRESS_NAMES[waitingFor]}`,
  );
}

/** Bis zur Aufgabe der Karte - faellt mit der fuenften Karte (Aufgabe 7) weg. */
function notWiredYet(card: WaitingCard): RuleViolation {
  return violation(
    RuleViolationCode.WRONG_PROGRESS_ANSWER,
    `${PROGRESS_NAMES[card]} ist noch nicht verdrahtet`,
  );
}

export function canAnswerProgress(
  state: GameState,
  player: PlayerId,
  answer: ProgressAnswer,
): RuleViolation | null {
  const phase = state.phase;
  if (phase.kind !== 'progressPending' || !phase.pending.includes(player)) {
    return violation(
      RuleViolationCode.NOT_ANSWERING_PROGRESS,
      `${player} muss gerade auf keine Fortschrittskarte antworten`,
    );
  }

  const payload = phase.payload;
  switch (answer.card) {
    case 'wedding':
      if (payload.card !== 'wedding') return wrongCard(payload.card);
      return notWiredYet(answer.card);
    case 'tradeHarbor':
      if (payload.card !== 'tradeHarbor') return wrongCard(payload.card);
      return notWiredYet(answer.card);
    case 'spy':
      if (payload.card !== 'spy') return wrongCard(payload.card);
      return notWiredYet(answer.card);
    case 'masterMerchant':
      if (payload.card !== 'masterMerchant') return wrongCard(payload.card);
      return notWiredYet(answer.card);
    case 'deserter':
      if (payload.card !== 'deserter') return wrongCard(payload.card);
      return notWiredYet(answer.card);
  }
}

export function applyAnswerProgress(
  state: GameState,
  player: PlayerId,
  answer: ProgressAnswer,
): ReduceResult {
  const problem = canAnswerProgress(state, player, answer);
  if (problem !== null) return rejected(problem);

  const phase = state.phase;
  // Nach `canAnswerProgress` unerreichbar - die Zeile verengt nur den Typ, ohne Cast.
  if (phase.kind !== 'progressPending') return rejected(wrongCard(answer.card));

  switch (answer.card) {
    case 'wedding':
    case 'tradeHarbor':
    case 'spy':
    case 'masterMerchant':
    case 'deserter':
      return rejected(notWiredYet(answer.card));
  }
}
```

- [ ] **Schritt 11: Den Reducer anschließen.** In `reducer.ts`:
  - Import `import { applyAnswerProgress } from './cities/progress/answerRules.js';`
  - In `PHASE_ACTIONS` nach `aqueductPending`:

```ts
  /*
   * Eine Fortschrittskarte wartet auf Antworten. Nur die Antwort geht - der
   * Spielende baut nicht weiter, waehrend andere noch entscheiden.
   */
  progressPending: ['answerProgress'],
```

  - In `actorFor` vor dem `tradePending`-Zweig:

```ts
  // Wie beim Abwerfen antworten mehrere gleichzeitig. Wer genau darf, prueft
  // `canAnswerProgress`.
  if (state.phase.kind === 'progressPending') return null;
```

  - In `applyAction` vor `endTurn`:

```ts
    case 'answerProgress':
      return applyAnswerProgress(state, action.player, action.answer);
```

- [ ] **Schritt 12: `legalActions` anschließen.** In `legal.ts` Import
      `import { canAnswerProgress } from './cities/progress/answerRules.js';` und
      `import type { ProgressAnswer } from './cities/progress/answer.js';`. Nach dem
      `aqueductPending`-Zweig:

```ts
    case 'progressPending':
      return progressAnswerCandidates(state)
        .filter((answer) => canAnswerProgress(state, player, answer) === null)
        .map((answer) => ({ type: 'answerProgress', player, answer }));
```

Und am Dateiende:

```ts
/**
 * Die Antworten, die sich aufzaehlen lassen - Kandidaten, gefiltert wird mit
 * `canAnswerProgress`.
 *
 * Hochzeit und Grosshaendler stehen hier nie: ihre Antwort ist eine Menge,
 * dieselbe Begruendung wie beim Abwerfen. Die uebrigen drei kommen mit ihren
 * Karten (Aufgaben 4, 5, 7).
 */
function progressAnswerCandidates(state: GameState): ProgressAnswer[] {
  if (state.phase.kind !== 'progressPending') return [];

  const payload = state.phase.payload;
  switch (payload.card) {
    case 'wedding':
    case 'masterMerchant':
    case 'tradeHarbor':
    case 'spy':
    case 'deserter':
      return [];
  }
}
```

- [ ] **Schritt 13: Die zwei erschöpfenden `switch` außerhalb des Reducers schließen.**
  - `packages/shared/src/game/log.ts`, `describeAction`, vor `endTurn`:

```ts
    case 'answerProgress':
      // Die Saetze je Karte kommen in Aufgabe 11.
      return `${who} antwortet auf ${PROGRESS_NAMES[action.answer.card]}`;
```

  - `apps/client/src/game/view.ts`, `phaseTextOf`, vor `finished` (Import `PROGRESS_NAMES` aus
    `@conquerist/shared` ergänzen):

```ts
    case 'progressPending':
      // Der Satz je Karte kommt in Aufgabe 12.
      return `${nameOf(view.phase.pending[0] ?? null)} antwortet auf ${PROGRESS_NAMES[view.phase.payload.card]}`;
```

- [ ] **Schritt 14: Typecheck und Tests** — `pnpm typecheck && pnpm -r test`. Erwartet: PASS.
      Meldet `tsc` eine **weitere** erschöpfende Stelle über `phase.kind` oder `action.type`,
      bekommt sie denselben neutralen Zweig, und die Datei wird im Commit genannt.

- [ ] **Schritt 15: Committen**

```bash
git add packages/shared apps/client/src/game/view.ts
git commit -m "Die Phase progressPending und die Aktion answerProgress, noch ohne Karte"
```

---

## Aufgabe 2: Die eine Stelle, an der sich die Geheimhaltung öffnet

**Was entsteht:** `revealsTo(state, viewer, player)` in `playerView.ts`. Heute steht dort zweimal
`player.id === viewer ? … : null`; daraus wird eine benannte Funktion, die **je ein Feld**
öffnet: dem Großhändler die fremden Handkarten, der Spionage die fremden Fortschrittskarten —
für eine Person, eine Hand, eine Phase. Dazu der Lecktest auf Werte statt Teilstrings.

**Dateien:**

- Ändern: `packages/shared/src/game/playerView.ts`
- Test: `packages/shared/src/game/playerView.test.ts`

**Interfaces:**

- Consumes: `progressPending` aus Aufgabe 1
- Produces: `interface Reveal { resources: boolean; progressCards: boolean }`,
  `revealsTo(state: GameState, viewer: PlayerId, player: PlayerId): Reveal`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben.** In `playerView.test.ts` Import
      `revealsTo` aus `./playerView.js` ergänzen und neben `allKeys`:

```ts
/** Sammelt alle Zeichenketten-Werte eines Objektbaums - Schluessel zaehlen nicht. */
function allStrings(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    found.add(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) allStrings(item, found);
    return found;
  }
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) allStrings(inner, found);
  }
  return found;
}
```

Den Test „gibt den Inhalt und die Reihenfolge der Stapel nirgends heraus" **ersetzen**:

```ts
  it('gibt den Inhalt und die Reihenfolge der Stapel nirgends heraus', () => {
    const state = gameWithCities({
      progressDecks: {
        science: ['mining', 'irrigation'],
        trade: ['merchant'],
        politics: ['bishop', 'saboteur'],
      },
    });

    const view = playerViewOf(state, 'p1', seats, 1);

    expect(Object.keys(view)).not.toContain('progressDecks');

    /*
     * Geprueft wird auf **Werte**, nicht auf Teilstrings im JSON. Der alte Test
     * suchte `'bishop'` in der ganzen Zeichenkette und waere am ersten Feld
     * namens `bishopTargets` grundlos umgefallen - ein Schluessel ist kein Leck.
     * `rules` bleibt aussen vor: `rules.progressDecks` nennt die Zusammensetzung
     * aller Stapel, das ist oeffentliches Regelwissen.
     */
    const withoutRules = Object.fromEntries(
      Object.entries(view).filter(([key]) => key !== 'rules'),
    );
    const values = allStrings(withoutRules);
    for (const card of ['mining', 'irrigation', 'merchant', 'bishop', 'saboteur']) {
      expect(values.has(card)).toBe(false);
    }
  });
```

Und ein neuer Block am Dateiende:

```ts
describe('revealsTo - die eine geoeffnete Hand', () => {
  /** p2 haelt Karten beider Arten; p1 hat eine Karte gespielt und schaut. */
  function looking(payload: ProgressPendingPayload): GameState {
    const base = gameWithCities({
      phase: { kind: 'progressPending', by: 'p1', pending: ['p1'], payload },
    });
    return {
      ...base,
      players: base.players.map((player) =>
        player.id === 'p2'
          ? { ...player, resources: { ...player.resources, ore: 2 }, progressCards: ['bishop' as const] }
          : player,
      ),
    };
  }

  it('zeigt dem Grosshaendler die fremden Handkarten und keine Fortschrittskarten', () => {
    const state = looking({ card: 'masterMerchant', victim: 'p2' });
    const p2 = playerViewOf(state, 'p1', seats, 1).players.find((player) => player.id === 'p2')!;

    expect(p2.resources?.ore).toBe(2);
    expect(p2.progressCards).toBeNull();
  });

  it('zeigt der Spionage die fremden Fortschrittskarten und keine Handkarten', () => {
    const state = looking({ card: 'spy', victim: 'p2' });
    const p2 = playerViewOf(state, 'p1', seats, 1).players.find((player) => player.id === 'p2')!;

    expect(p2.progressCards).toEqual(['bishop']);
    expect(p2.resources).toBeNull();
  });

  it('oeffnet nur die Hand des Opfers und nur dem Spielenden', () => {
    const state = looking({ card: 'spy', victim: 'p2' });

    expect(revealsTo(state, 'p1', 'p3')).toEqual({ resources: false, progressCards: false });
    expect(revealsTo(state, 'p3', 'p2')).toEqual({ resources: false, progressCards: false });
  });

  it('schliesst sie wieder, sobald die Phase vorbei ist', () => {
    const state = { ...looking({ card: 'spy', victim: 'p2' }), phase: { kind: 'main' as const } };
    expect(revealsTo(state, 'p1', 'p2')).toEqual({ resources: false, progressCards: false });
  });

  it('oeffnet nichts, solange der Spielende nicht selbst wartet', () => {
    const base = looking({ card: 'spy', victim: 'p2' });
    const state = {
      ...base,
      phase: { kind: 'progressPending' as const, by: 'p1', pending: ['p2'], payload: { card: 'spy' as const, victim: 'p2' } },
    };
    expect(revealsTo(state, 'p1', 'p2')).toEqual({ resources: false, progressCards: false });
  });

  it('oeffnet bei Hochzeit und Deserteur nichts', () => {
    expect(revealsTo(looking({ card: 'wedding' }), 'p1', 'p2')).toEqual({
      resources: false,
      progressCards: false,
    });
    expect(
      revealsTo(looking({ card: 'deserter', victim: 'p2', replacement: null }), 'p1', 'p2'),
    ).toEqual({ resources: false, progressCards: false });
  });

  it('zeigt jedem die eigene Hand ganz', () => {
    expect(revealsTo(gameWithCities(), 'p2', 'p2')).toEqual({ resources: true, progressCards: true });
  });

  it('haelt waehrend der offenen Hand das eigene Schema ein', () => {
    const state = looking({ card: 'masterMerchant', victim: 'p2' });
    expect(() => PlayerViewSchema.parse(playerViewOf(state, 'p1', seats, 1))).not.toThrow();
  });
});
```

Dazu der Import `import type { ProgressPendingPayload } from './cities/progress/answer.js';`.

- [ ] **Schritt 2: Tests laufen lassen** — FAIL, `revealsTo` gibt es nicht.

- [ ] **Schritt 3: `revealsTo` schreiben.** In `playerView.ts` vor `playerViewOf`
      (Import `type PlayerId` aus `./player.js` ergänzen):

```ts
/** Welche verdeckten Felder eines Sitzes der Empfaenger sehen darf. */
export interface Reveal {
  readonly resources: boolean;
  readonly progressCards: boolean;
}

const HIDDEN: Reveal = { resources: false, progressCards: false };

/**
 * Die einzige Stelle der ganzen Erweiterung, an der sich die Grenze aus Regel 4
 * oeffnet - fuer **eine** Person, **eine** Hand, **eine** Phase.
 *
 * Grosshaendler und Spionage lassen den Spielenden in eine fremde Hand sehen,
 * bevor er waehlt. Geoeffnet wird genau dann, wenn die Karte wartet, der
 * Empfaenger sie gespielt hat **und** selbst an der Reihe ist - und je Karte nur
 * das eine Feld, um das es geht: der Grosshaendler sieht keine
 * Fortschrittskarten, die Spionage keine Rohstoffe. Entwicklungskarten bleiben
 * immer beim Besitzer.
 */
export function revealsTo(state: GameState, viewer: PlayerId, player: PlayerId): Reveal {
  if (player === viewer) return { resources: true, progressCards: true };

  const phase = state.phase;
  if (phase.kind !== 'progressPending' || phase.by !== viewer || !phase.pending.includes(viewer)) {
    return HIDDEN;
  }

  const payload = phase.payload;
  if (payload.card === 'masterMerchant' && payload.victim === player) {
    return { resources: true, progressCards: false };
  }
  if (payload.card === 'spy' && payload.victim === player) {
    return { resources: false, progressCards: true };
  }
  return HIDDEN;
}
```

In `playerViewOf` im `players.map` als erste Zeile
`const reveal = revealsTo(state, viewer, player.id);` und die zwei Zeilen ersetzen:

```ts
        resources: reveal.resources ? player.resources : null,
```

```ts
        progressCards: reveal.progressCards ? player.progressCards : null,
```

- [ ] **Schritt 4: Tests laufen lassen** — PASS.
- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src/game/playerView.ts packages/shared/src/game/playerView.test.ts
git commit -m "revealsTo: die eine Hand, die sich fuer eine Phase oeffnet"
```

---

## Aufgabe 3: Hochzeit

**Regel (11.3, vollständig):** „Jede Person mit **mehr** Siegpunkten schenkt 2 Karten ihrer
Wahl." Ausgelegt (Spec, Zuschnitt 10d-2): „mehr Siegpunkte" heißt `victoryPointsOf`; wer weniger
als zwei Karten hat, schenkt, was er hat; wer keine hat, steht gar nicht erst in `pending`;
spielbar nur, wenn überhaupt jemand mehr Punkte hat.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/wedding.ts`
- Ändern: `cities/progress/play.ts`, `cities/progress/progressRules.ts`,
  `cities/progress/answerRules.ts`, `game/legal.ts`, `game/cards.ts`
- Test: `cities/progress/wedding.test.ts` (**neu**), `game/cards.test.ts`

**Interfaces:**

- Consumes: `openProgressPending`, `withPending`, `transferCards`, `twoCardsOrAll`,
  `ProgressPendingPhase` (Aufgabe 1), `inTurnOrder`
- Produces: `canWedding`, `applyWedding`, `canAnswerWedding`, `answerWedding`,
  `weddingGivers(state, player): PlayerId[]`;
  `takeMostHeld(hand: CardAmounts, pool: readonly CardId[], count: number): CardAmounts` in
  `cards.ts` (Aufgaben 4 und 9 benutzen es)

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

In `cards.test.ts` (Imports ergänzen, soweit sie fehlen:
`import { CARD_IDS, COMMODITY_IDS } from '../scenario/index.js';`,
`import { hand } from './fixtures.js';`, `takeMostHeld` aus `./cards.js`):

```ts
describe('takeMostHeld', () => {
  it('nimmt immer von der gerade haeufigsten Sorte', () => {
    // Erz 5, Wolle 3: Erz, Erz, dann Gleichstand 3:3 -> Wolle (steht frueher), dann Erz.
    expect(takeMostHeld(hand({ ore: 5, wool: 3 }), CARD_IDS, 4)).toEqual(hand({ ore: 3, wool: 1 }));
  });

  it('entscheidet Gleichstand nach der Reihenfolge im Vorrat', () => {
    expect(takeMostHeld(hand({ grain: 1, ore: 1 }), CARD_IDS, 1)).toEqual(hand({ grain: 1 }));
  });

  it('nimmt nur aus dem genannten Vorrat', () => {
    expect(takeMostHeld(hand({ ore: 4, cloth: 1 }), COMMODITY_IDS, 1)).toEqual(hand({ cloth: 1 }));
  });

  it('nimmt nicht mehr, als da ist', () => {
    expect(takeMostHeld(hand({ wool: 1 }), CARD_IDS, 3)).toEqual(hand({ wool: 1 }));
  });
});
```

`packages/shared/src/game/cities/progress/wedding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import type { GameAction } from '../../actions.js';
import { countCards } from '../../cards.js';
import { RuleViolationCode } from '../../errors.js';
import { CENTER_VERTEX, FAR_VERTEX, HARBOR3_VERTEX, hand, testGame } from '../../fixtures.js';
import { legalActions } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { reduce } from '../../reducer.js';
import { publicVictoryPointsOf, victoryPointsOf } from '../../scoring.js';
import type { Building, GameState } from '../../state.js';
import type { CardAmounts } from '../../../rules/index.js';
import type { ProgressCardId } from './cards.js';
import { canPlayProgress } from './progressRules.js';

/*
 * Lokale Aufbauten - Testdateien teilen sich keine Helfer. Drei Spieler p1, p2,
 * p3, p1 ist am Zug und in der Hauptphase.
 */

/** Ein Staedte-Tisch, an dem diese Karte liegt - auf die Stapel kommt sie erst in Aufgabe 8. */
function tableWith(card: ProgressCardId, overrides: Partial<GameState> = {}): GameState {
  return testGame({
    rules: { ...CITIES_RULES, progressDecks: { ...CITIES_RULES.progressDecks, [card]: 2 } },
    ...overrides,
  });
}

function city(owner: PlayerId): Building {
  return { owner, kind: 'city', wall: false, metropolis: null };
}

function settlement(owner: PlayerId): Building {
  return { owner, kind: 'settlement', wall: false, metropolis: null };
}

function patchPlayer(state: GameState, id: PlayerId, patch: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === id ? { ...player, ...patch } : player)),
  };
}

function playerNamed(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`playerNamed: ${id} sitzt nicht am Tisch`);
  return player;
}

function act(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

const PLAY: GameAction = { type: 'playProgress', player: 'p1', play: { card: 'wedding' } };

function gift(player: PlayerId, cards: CardAmounts): GameAction {
  return { type: 'answerProgress', player, answer: { card: 'wedding', gift: cards } };
}

/** p1 hat eine Siedlung (1 Punkt), p2 und p3 je eine Stadt (2 Punkte) und Karten. */
function weddingTable(overrides: Partial<GameState> = {}): GameState {
  let state = tableWith('wedding', {
    buildings: {
      [FAR_VERTEX]: settlement('p1'),
      [CENTER_VERTEX]: city('p2'),
      [HARBOR3_VERTEX]: city('p3'),
    },
    ...overrides,
  });
  state = patchPlayer(state, 'p1', { progressCards: ['wedding'] });
  state = patchPlayer(state, 'p2', { resources: hand({ ore: 2, wool: 1 }) });
  return patchPlayer(state, 'p3', { resources: hand({ grain: 3 }) });
}

describe('Hochzeit', () => {
  it('wartet auf alle mit mehr Punkten und Karten, im Uhrzeigersinn ab dem Spielenden', () => {
    expect(act(weddingTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p2', 'p3'],
      payload: { card: 'wedding' },
    });
  });

  it('laesst aus, wer keine Karten hat', () => {
    const state = patchPlayer(weddingTable(), 'p3', { resources: hand() });
    expect(act(state, PLAY).phase).toMatchObject({ kind: 'progressPending', pending: ['p2'] });
  });

  it('bleibt in der Hauptphase, wenn alle mit mehr Punkten leere Haende haben', () => {
    const empty = patchPlayer(patchPlayer(weddingTable(), 'p2', { resources: hand() }), 'p3', {
      resources: hand(),
    });
    const after = act(empty, PLAY);

    expect(after.phase).toEqual({ kind: 'main' });
    expect(playerNamed(after, 'p1').progressCards).toEqual([]);
  });

  it('ist nicht spielbar, wenn niemand mehr Punkte hat', () => {
    const state = weddingTable({ buildings: { [FAR_VERTEX]: city('p1') } });
    expect(canPlayProgress(state, 'p1', { card: 'wedding' })?.code).toBe(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
    );
  });

  it('gibt das Geschenk dem Spielenden und streicht den Schenkenden', () => {
    const after = act(act(weddingTable(), PLAY), gift('p2', hand({ ore: 1, wool: 1 })));

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ ore: 1, wool: 1 }));
    expect(playerNamed(after, 'p2').resources).toEqual(hand({ ore: 1 }));
    expect(after.phase).toMatchObject({ kind: 'progressPending', pending: ['p3'] });
  });

  it('nimmt die Antworten in beliebiger Reihenfolge und schliesst nach der letzten', () => {
    const open = act(weddingTable(), PLAY);
    const done = act(act(open, gift('p3', hand({ grain: 2 }))), gift('p2', hand({ ore: 2 })));

    expect(done.phase).toEqual({ kind: 'main' });
    expect(countCards(playerNamed(done, 'p1').resources)).toBe(4);
  });

  it('verlangt alles, wer weniger als zwei Karten hat', () => {
    const open = act(patchPlayer(weddingTable(), 'p3', { resources: hand({ grain: 1 }) }), PLAY);

    const two = reduce(open, gift('p3', hand({ grain: 2 })));
    expect(two.ok ? null : two.error.code).toBe(RuleViolationCode.WRONG_PROGRESS_ANSWER);
    expect(reduce(open, gift('p3', hand({ grain: 1 }))).ok).toBe(true);
  });

  it('lehnt ein Geschenk ab, das nicht auf der Hand liegt', () => {
    const result = reduce(act(weddingTable(), PLAY), gift('p2', hand({ brick: 2 })));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('zaehlt die Hochzeit in legalActions als Zug ohne Angabe auf', () => {
    const plays = legalActions(weddingTable(), 'p1').filter((action) => action.type === 'playProgress');
    expect(plays).toContainEqual(PLAY);
  });

  /*
   * Die Regel fragt nach "mehr Siegpunkten", und `victoryPointsOf` ist die
   * Wahrheit ueber den Punktestand. Dass das niemandem verdeckte Punkte
   * verraet, liegt am Tisch: ohne Entwicklungskarten gibt es keine verdeckten.
   * Dieser Test haelt den Satz fest, statt ihn nur zu behaupten.
   */
  it('zaehlt an einem Staedte-Tisch oeffentliche und volle Punkte gleich', () => {
    const state = patchPlayer(
      tableWith('wedding', {
        buildings: { [CENTER_VERTEX]: city('p1') },
        merchant: { hex: '1,0', owner: 'p1' },
      }),
      'p1',
      { openProgressCards: ['printer'], defenderPoints: 1 },
    );
    expect(publicVictoryPointsOf(state, 'p1')).toBe(victoryPointsOf(state, 'p1'));
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL (`takeMostHeld` fehlt, `wedding` ist keine
      `ProgressPlay`).

- [ ] **Schritt 3: `takeMostHeld` in `cards.ts`** (Import `type CardId` steht schon da):

```ts
/**
 * Waehlt `count` Karten aus einer Hand - immer von der gerade haeufigsten Sorte
 * in `pool`, bei Gleichstand von der frueher genannten.
 *
 * Die eine Auslegung von "die haeufigsten Karten" fuer jede automatische
 * Antwort nach einem Fristablauf (Spec 5.5): rein und deterministisch, damit
 * dieselbe Partie aus demselben Seed dieselben Karten verliert.
 */
export function takeMostHeld(
  hand: CardAmounts,
  pool: readonly CardId[],
  count: number,
): CardAmounts {
  const left = { ...hand };
  const taken = { ...EMPTY_CARDS };

  for (let step = 0; step < count; step += 1) {
    let best: CardId | null = null;
    for (const card of pool) {
      if (left[card] > 0 && (best === null || left[card] > left[best])) best = card;
    }
    if (best === null) break;
    left[best] -= 1;
    taken[best] += 1;
  }

  return taken;
}
```

- [ ] **Schritt 4: `wedding.ts` schreiben**

```ts
import { canAfford, countCards } from '../../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { victoryPointsOf } from '../../scoring.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer } from './answer.js';
import { inTurnOrder } from './draw.js';
import {
  openProgressPending,
  transferCards,
  twoCardsOrAll,
  withPending,
  type ProgressPendingPhase,
} from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Hochzeit: jede Person mit mehr Siegpunkten schenkt zwei Karten ihrer Wahl.
 *
 * **"Mehr Siegpunkte" heisst `victoryPointsOf`.** An einem Staedte-&-Ritter-
 * Tisch gibt es keine Entwicklungskarten, und Buchdruck und Verfassung liegen
 * offen - volle und oeffentliche Punkte sind dort gleich. Ein Test in
 * `wedding.test.ts` haelt das fest.
 *
 * Wer weniger als zwei Karten hat, schenkt, was er hat; wer keine hat, steht
 * gar nicht erst in der Warteliste.
 */

type WeddingPlay = Extract<ProgressPlay, { card: 'wedding' }>;
type WeddingAnswer = Extract<ProgressAnswer, { card: 'wedding' }>;

/** Wer bei dieser Hochzeit schenkt - im Uhrzeigersinn ab dem Spieler am Zug. */
export function weddingGivers(state: GameState, player: PlayerId): PlayerId[] {
  const points = victoryPointsOf(state, player);
  return inTurnOrder(state)
    .filter(
      (other) =>
        other.id !== player &&
        victoryPointsOf(state, other.id) > points &&
        countCards(other.resources) > 0,
    )
    .map((other) => other.id);
}

/** Spielbar nur, wenn ueberhaupt jemand mehr Punkte hat - Karten braucht er dafuer nicht. */
export function canWedding(
  state: GameState,
  player: PlayerId,
  _play: WeddingPlay,
): RuleViolation | null {
  const points = victoryPointsOf(state, player);
  const richer = state.players.some(
    (other) => other.id !== player && victoryPointsOf(state, other.id) > points,
  );
  return richer
    ? null
    : violation(
        RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
        'Niemand hat mehr Siegpunkte – die Hochzeit bringt nichts',
      );
}

export function applyWedding(state: GameState, player: PlayerId, play: WeddingPlay): ReduceResult {
  const problem = canWedding(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(openProgressPending(state, player, weddingGivers(state, player), { card: 'wedding' }));
}

export function canAnswerWedding(
  state: GameState,
  _phase: ProgressPendingPhase,
  giver: PlayerId,
  answer: WeddingAnswer,
): RuleViolation | null {
  const held = findPlayer(state, giver)!.resources;
  const required = twoCardsOrAll(countCards(held));

  if (countCards(answer.gift) !== required) {
    return violation(
      RuleViolationCode.WRONG_PROGRESS_ANSWER,
      `Geschenkt werden genau ${required} Karten`,
    );
  }
  if (!canAfford(held, answer.gift)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Geschenkt werden kann nur, was auf der Hand liegt',
    );
  }
  return null;
}

/** Das Geschenk wandert sofort; der Schenkende faellt aus der Warteliste. */
export function answerWedding(
  state: GameState,
  phase: ProgressPendingPhase,
  giver: PlayerId,
  answer: WeddingAnswer,
): GameState {
  const given = transferCards(state, giver, phase.by, answer.gift);
  return withPending(given, phase, phase.pending.filter((id) => id !== giver));
}
```

- [ ] **Schritt 5: Anschließen.**
  - `play.ts`: in die Union `z.object({ card: z.literal('wedding') }),` und im Kopfkommentar
    „Die fünf Karten, die auf eine fremde Antwort warten, fehlen hier" durch „Die fünf Karten,
    die auf eine fremde Antwort warten, kommen in 10d-2 dazu - ihre Antwort steht in
    `answer.ts`." ersetzen (ohne Umlaute im Code: „fuenf").
  - `progressRules.ts`: Import `import { applyWedding, canWedding } from './wedding.js';`. Die
    letzte Zeile von `canPlayProgress` wird
    `return canPolitics(state, player, play) ?? canWaitingCard(state, player, play);`, darunter:

```ts
/**
 * Was eine der fuenf wartenden Karten vor dem Ausspielen verlangt - dieselbe
 * Rolle wie `canPolitics`: `legalActions` und die Oberflaeche stellen die Frage,
 * ohne den Zug probeweise auszufuehren.
 */
function canWaitingCard(
  state: GameState,
  player: PlayerId,
  play: ProgressPlay,
): RuleViolation | null {
  switch (play.card) {
    case 'wedding':
      return canWedding(state, player, play);
    default:
      return null;
  }
}
```

    Und in `applyPlayProgress`: `case 'wedding': return applyWedding(discarded, player, play);`
  - `answerRules.ts`: Import `import { answerWedding, canAnswerWedding } from './wedding.js';`
    und `ok` im Import aus `../../state.js` ergänzen. Im `wedding`-Zweig von `canAnswerProgress`:

```ts
    case 'wedding':
      if (payload.card !== 'wedding') return wrongCard(payload.card);
      return canAnswerWedding(state, phase, player, answer);
```

    In `applyAnswerProgress` den gemeinsamen Zweig aufteilen und `wedding` herausnehmen:

```ts
    case 'wedding':
      return ok(answerWedding(state, phase, player, answer));
```

  - `legal.ts`, `zeroArgumentProgressPlay`: `case 'wedding': return { card };`

- [ ] **Schritt 6: Tests laufen lassen** — `pnpm typecheck && pnpm -r test`. PASS.
- [ ] **Schritt 7: Committen**

```bash
git add packages/shared
git commit -m "Hochzeit"
```

---

## Aufgabe 4: Handelshafen

**Regel (11.2, vollständig):** „Jeder anderen Person **einmal** 1 Rohstoff anbieten; sie gibt
dafür eine **Handelsware ihrer Wahl**, falls sie eine hat." Ausgelegt: der Spielende nennt beim
Ausspielen **eine** Rohstoffsorte für alle. Er muss davon so viele haben, wie es Mitspieler mit
mindestens einer Handelsware gibt — sonst ist die Karte nicht spielbar (Auslegung, dem Menschen
genannt). Ohne Tauschpartner ist sie ebenfalls nicht spielbar (Abweichung 7). Wer keine
Handelsware hat, steht nicht in `pending`.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/tradeHarbor.ts`
- Ändern: `cities/progress/play.ts`, `progressRules.ts`, `answerRules.ts`, `game/legal.ts`
- Test: `cities/progress/tradeHarbor.test.ts` (**neu**)

**Interfaces:**

- Consumes: Aufgabe 1 (`openProgressPending`, `withPending`, `transferCards`), `inTurnOrder`
- Produces: `canTradeHarbor`, `applyTradeHarbor`, `canAnswerTradeHarbor`, `answerTradeHarbor`,
  `tradeHarborPartners(state, player): PlayerId[]`; in `legal.ts`
  `enumerableProgressPlays(card: ProgressCardId): ProgressPlay[]` (ersetzt
  `zeroArgumentProgressPlay`; Aufgabe 5 erweitert die Signatur)

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

`packages/shared/src/game/cities/progress/tradeHarbor.test.ts` — dieselben lokalen Helfer
`tableWith`, `patchPlayer`, `playerNamed`, `act` aus dem Abschnitt „Testhelfer für die Kartentests“ (wörtlich
übernehmen; Testdateien teilen sich keine Helfer), dazu:

```ts
import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import type { GameAction } from '../../actions.js';
import { RuleViolationCode } from '../../errors.js';
import { hand, testGame } from '../../fixtures.js';
import { legalActions } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { reduce } from '../../reducer.js';
import type { GameState } from '../../state.js';
import type { CommodityId } from '../../../scenario/index.js';
import type { ProgressCardId } from './cards.js';
import { canPlayProgress } from './progressRules.js';

// Testhelfer: tableWith, patchPlayer, playerNamed, act - Abschnitt „Testhelfer für die Kartentests“ im Plankopf

const PLAY: GameAction = {
  type: 'playProgress',
  player: 'p1',
  play: { card: 'tradeHarbor', resource: 'wool' },
};

function offer(player: PlayerId, commodity: CommodityId): GameAction {
  return { type: 'answerProgress', player, answer: { card: 'tradeHarbor', commodity } };
}

/** p1 hat zwei Wolle; p2 haelt Papier und Tuch, p3 eine Muenze. */
function harborTable(): GameState {
  let state = tableWith('tradeHarbor');
  state = patchPlayer(state, 'p1', { progressCards: ['tradeHarbor'], resources: hand({ wool: 2 }) });
  state = patchPlayer(state, 'p2', { resources: hand({ paper: 1, cloth: 2 }) });
  return patchPlayer(state, 'p3', { resources: hand({ coin: 1 }) });
}

describe('Handelshafen', () => {
  it('wartet auf alle mit einer Handelsware und merkt sich den Rohstoff', () => {
    expect(act(harborTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p2', 'p3'],
      payload: { card: 'tradeHarbor', resource: 'wool' },
    });
  });

  it('laesst aus, wer keine Handelsware hat', () => {
    const state = patchPlayer(harborTable(), 'p3', { resources: hand({ ore: 3 }) });
    expect(act(state, PLAY).phase).toMatchObject({ pending: ['p2'] });
  });

  it('ist nicht spielbar mit weniger Rohstoffen als Tauschpartnern', () => {
    const state = patchPlayer(harborTable(), 'p1', { resources: hand({ wool: 1 }) });
    expect(canPlayProgress(state, 'p1', { card: 'tradeHarbor', resource: 'wool' })?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('ist nicht spielbar, wenn niemand sonst eine Handelsware hat', () => {
    const state = patchPlayer(
      patchPlayer(harborTable(), 'p2', { resources: hand({ ore: 1 }) }),
      'p3',
      { resources: hand() },
    );
    expect(canPlayProgress(state, 'p1', { card: 'tradeHarbor', resource: 'wool' })?.code).toBe(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
    );
  });

  it('tauscht eine Handelsware gegen einen Rohstoff und streicht den Antwortenden', () => {
    const after = act(act(harborTable(), PLAY), offer('p2', 'cloth'));

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ wool: 1, cloth: 1 }));
    expect(playerNamed(after, 'p2').resources).toEqual(hand({ paper: 1, cloth: 1, wool: 1 }));
    expect(after.phase).toMatchObject({ kind: 'progressPending', pending: ['p3'] });
  });

  it('kehrt nach der letzten Antwort in die Hauptphase zurueck', () => {
    const done = act(act(act(harborTable(), PLAY), offer('p3', 'coin')), offer('p2', 'paper'));
    expect(done.phase).toEqual({ kind: 'main' });
    expect(playerNamed(done, 'p1').resources).toEqual(hand({ coin: 1, paper: 1 }));
  });

  it('lehnt eine Handelsware ab, die nicht auf der Hand liegt', () => {
    const result = reduce(act(harborTable(), PLAY), offer('p3', 'paper'));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('zaehlt dem Antwortenden nur die Handelswaren auf, die er hat', () => {
    const open = act(harborTable(), PLAY);
    expect(legalActions(open, 'p2')).toEqual([offer('p2', 'paper'), offer('p2', 'cloth')]);
    expect(legalActions(open, 'p1')).toEqual([]);
  });

  it('bietet beim Ausspielen nur Rohstoffe an, die alle Tauschpartner decken', () => {
    const plays = legalActions(harborTable(), 'p1').filter(
      (action) => action.type === 'playProgress' && action.play.card === 'tradeHarbor',
    );
    expect(plays).toEqual([PLAY]);
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL.

- [ ] **Schritt 3: `tradeHarbor.ts` schreiben**

```ts
import { COMMODITY_IDS, type CardId } from '../../../scenario/index.js';
import { EMPTY_CARDS } from '../../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import { RESOURCE_LABELS } from '../../labels.js';
import type { PlayerId, PlayerState } from '../../player.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, ProgressPendingPayload } from './answer.js';
import { inTurnOrder } from './draw.js';
import {
  openProgressPending,
  transferCards,
  withPending,
  type ProgressPendingPhase,
} from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Handelshafen: jeder anderen Person einmal einen Rohstoff anbieten, sie gibt
 * dafuer eine Handelsware ihrer Wahl.
 *
 * **Eine Rohstoffsorte fuer alle, gedeckt schon beim Ausspielen.** Wer die Karte
 * spielt, muss so viele davon haben, wie es Tauschpartner gibt. Danach ist jede
 * Antwort gedeckt - kein Teilerfolg, keine Abhaengigkeit von der Reihenfolge der
 * Antworten, und die Antwort braucht kein `null`, weil wer keine Handelsware hat
 * gar nicht erst gefragt wird.
 */

type TradeHarborPlay = Extract<ProgressPlay, { card: 'tradeHarbor' }>;
type TradeHarborAnswer = Extract<ProgressAnswer, { card: 'tradeHarbor' }>;
type TradeHarborPayload = Extract<ProgressPendingPayload, { card: 'tradeHarbor' }>;

function one(card: CardId) {
  return { ...EMPTY_CARDS, [card]: 1 };
}

function holdsCommodity(player: PlayerState): boolean {
  return COMMODITY_IDS.some((commodity) => player.resources[commodity] > 0);
}

/** Wer tauscht - im Uhrzeigersinn ab dem Spieler am Zug. */
export function tradeHarborPartners(state: GameState, player: PlayerId): PlayerId[] {
  return inTurnOrder(state)
    .filter((other) => other.id !== player && holdsCommodity(other))
    .map((other) => other.id);
}

export function canTradeHarbor(
  state: GameState,
  player: PlayerId,
  play: TradeHarborPlay,
): RuleViolation | null {
  const partners = tradeHarborPartners(state, player).length;
  if (partners === 0) {
    return violation(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
      'Niemand sonst hat eine Handelsware',
    );
  }

  const held = findPlayer(state, player)!.resources[play.resource];
  if (held < partners) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `Für ${partners} Tauschpartner braucht es ${partners}-mal ${RESOURCE_LABELS[play.resource]}`,
    );
  }
  return null;
}

export function applyTradeHarbor(
  state: GameState,
  player: PlayerId,
  play: TradeHarborPlay,
): ReduceResult {
  const problem = canTradeHarbor(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(
    openProgressPending(state, player, tradeHarborPartners(state, player), {
      card: 'tradeHarbor',
      resource: play.resource,
    }),
  );
}

/**
 * Die Deckung des Spielenden wird noch einmal geprueft, obwohl sie beim
 * Ausspielen feststand und sich in dieser Phase nichts bewegt: eine Regel, die
 * sich auf eine andere verlaesst, wird beim naechsten Umbau still falsch.
 */
export function canAnswerTradeHarbor(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: TradeHarborPayload,
  partner: PlayerId,
  answer: TradeHarborAnswer,
): RuleViolation | null {
  if (findPlayer(state, partner)!.resources[answer.commodity] < 1) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Hergegeben werden kann nur eine Handelsware, die auf der Hand liegt',
    );
  }
  if (findPlayer(state, phase.by)!.resources[payload.resource] < 1) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Der angebotene Rohstoff ist nicht mehr gedeckt',
    );
  }
  return null;
}

export function answerTradeHarbor(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: TradeHarborPayload,
  partner: PlayerId,
  answer: TradeHarborAnswer,
): GameState {
  const commodityIn = transferCards(state, partner, phase.by, one(answer.commodity));
  const resourceOut = transferCards(commodityIn, phase.by, partner, one(payload.resource));
  return withPending(resourceOut, phase, phase.pending.filter((id) => id !== partner));
}
```

- [ ] **Schritt 4: Anschließen.**
  - `play.ts`: `z.object({ card: z.literal('tradeHarbor'), resource: ResourceIdSchema }),`
  - `progressRules.ts`: Import `applyTradeHarbor, canTradeHarbor` aus `./tradeHarbor.js`; in
    `canWaitingCard` `case 'tradeHarbor': return canTradeHarbor(state, player, play);`; in
    `applyPlayProgress` `case 'tradeHarbor': return applyTradeHarbor(discarded, player, play);`
  - `answerRules.ts`: Import `answerTradeHarbor, canAnswerTradeHarbor`. In `canAnswerProgress`:

```ts
    case 'tradeHarbor':
      if (payload.card !== 'tradeHarbor') return wrongCard(payload.card);
      return canAnswerTradeHarbor(state, phase, payload, player, answer);
```

    In `applyAnswerProgress` `tradeHarbor` aus dem gemeinsamen Zweig herausnehmen:

```ts
    case 'tradeHarbor': {
      const payload = phase.payload;
      if (payload.card !== 'tradeHarbor') return rejected(wrongCard(payload.card));
      return ok(answerTradeHarbor(state, phase, payload, player, answer));
    }
```

  - `legal.ts`, `progressAnswerCandidates`: `tradeHarbor` aus dem gemeinsamen `[]`-Zweig
    herausnehmen (Import `COMMODITY_IDS` aus `../scenario/index.js` ergänzen):

```ts
    case 'tradeHarbor':
      return COMMODITY_IDS.map((commodity): ProgressAnswer => ({ card: 'tradeHarbor', commodity }));
```

  - `legal.ts`, Hauptphase: die Schleife über `progressCards` und `zeroArgumentProgressPlay`
    **ersetzen**. Die Schleife:

```ts
      /*
       * Fortschrittskarten, deren Angabe sich aufzaehlen laesst: ohne Angabe,
       * eine von fuenf Rohstoffsorten (Handelshafen) oder - ab Aufgabe 5 - eine
       * andere Person. Alles andere braeuchte eine Aufzaehlung ueber Kreuzungen,
       * Kanten oder Felder und bleibt der Auswahl im Dialog oder am Brett
       * ueberlassen. Ueber die **Arten** auf der Hand und nicht ueber die Karten:
       * zwei gleiche Karten ergaeben sonst jeden Zug doppelt.
       */
      for (const card of new Set(state.players[state.currentPlayerIndex]?.progressCards ?? [])) {
        for (const play of enumerableProgressPlays(card)) {
          if (canPlayProgress(state, player, play) === null) {
            actions.push({ type: 'playProgress', player, play });
          }
        }
      }
```

    Die Funktion (an die Stelle von `zeroArgumentProgressPlay`):

```ts
/**
 * Die aufzaehlbaren Wahlen einer Fortschrittskarte - leer, wenn die Karte eine
 * Angabe braucht, die sich nicht aufzaehlen laesst.
 *
 * Nur fuer `legalActions`. Jede Karte ohne Angabe steht in einem eigenen Zweig:
 * `{ card }` fuer mehrere Literale zugleich waere fuer `tsc` kein Mitglied der
 * Union.
 */
function enumerableProgressPlays(card: ProgressCardId): ProgressPlay[] {
  switch (card) {
    case 'mining':
      return [{ card }];
    case 'irrigation':
      return [{ card }];
    case 'warlord':
      return [{ card }];
    case 'saboteur':
      return [{ card }];
    case 'wedding':
      return [{ card }];
    case 'tradeHarbor':
      return RESOURCE_IDS.map((resource): ProgressPlay => ({ card: 'tradeHarbor', resource }));
    default:
      return [];
  }
}
```

- [ ] **Schritt 5: Tests laufen lassen** — `pnpm typecheck && pnpm -r test`. PASS. Bleibt ein
      bestehender Test rot, der doppelte Züge für doppelte Karten erwartet hat, ist das die
      Entdopplung aus Schritt 4 — der Test wird angepasst und der Grund im Commit genannt.
- [ ] **Schritt 6: Committen**

```bash
git add packages/shared
git commit -m "Handelshafen"
```

---

## Aufgabe 5: Spionage

**Regel (11.3, vollständig):** „Fortschrittskarten einer Person ansehen und **1 davon nehmen**
(keine Siegpunktkarten)." Ausgelegt: jede Person, kein Punktevergleich; Buchdruck und Verfassung
liegen in `openProgressCards` und sind damit nie wählbar; das Ziel braucht mindestens eine Karte
in `progressCards`. `pending` steht auf dem Spielenden selbst, und `revealsTo` (Aufgabe 2) zeigt
ihm die fremden Fortschrittskarten.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/spy.ts`
- Ändern: `cities/progress/play.ts`, `progressRules.ts`, `answerRules.ts`, `game/legal.ts`
- Test: `cities/progress/spy.test.ts` (**neu**)

**Interfaces:**

- Consumes: Aufgabe 1, `countedHand` und `receiveProgressCard` aus `draw.ts`
- Produces: `canSpy`, `applySpy`, `canAnswerSpy`, `answerSpy`;
  `enumerableProgressPlays(state: GameState, player: PlayerId, card: ProgressCardId)` (neue
  Signatur)

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

`packages/shared/src/game/cities/progress/spy.test.ts` — Helfer `tableWith`, `patchPlayer`,
`playerNamed`, `act` aus dem Abschnitt „Testhelfer für die Kartentests“; Imports von dort, zusätzlich
`legalActions`, ohne `CardAmounts`, `countCards`, `scoring`, `Building`:

```ts
const PLAY: GameAction = { type: 'playProgress', player: 'p1', play: { card: 'spy', victim: 'p2' } };

function take(card: ProgressCardId): GameAction {
  return { type: 'answerProgress', player: 'p1', answer: { card: 'spy', take: card } };
}

/** p1 spielt die Spionage; p2 haelt Bischof und Kran, p3 nichts. */
function spyTable(): GameState {
  const state = patchPlayer(tableWith('spy'), 'p1', { progressCards: ['spy'] });
  return patchPlayer(state, 'p2', { progressCards: ['bishop', 'crane'] });
}

describe('Spionage', () => {
  it('wartet auf den Spielenden selbst und merkt sich das Opfer', () => {
    expect(act(spyTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p1'],
      payload: { card: 'spy', victim: 'p2' },
    });
  });

  it('lehnt ein Opfer ohne Fortschrittskarte ab', () => {
    expect(canPlayProgress(spyTable(), 'p1', { card: 'spy', victim: 'p3' })?.code).toBe(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
    );
  });

  it('lehnt sich selbst als Opfer ab', () => {
    expect(canPlayProgress(spyTable(), 'p1', { card: 'spy', victim: 'p1' })?.code).toBe(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
    );
  });

  it('nimmt die gewaehlte Karte und kehrt in die Hauptphase zurueck', () => {
    const after = act(act(spyTable(), PLAY), take('crane'));

    expect(playerNamed(after, 'p2').progressCards).toEqual(['bishop']);
    expect(playerNamed(after, 'p1').progressCards).toEqual(['crane']);
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('lehnt eine Karte ab, die das Opfer nicht haelt', () => {
    const result = reduce(act(spyTable(), PLAY), take('warlord'));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NO_SUCH_PROGRESS_CARD);
  });

  it('zaehlt dem Spielenden genau die fremden Karten auf', () => {
    const open = act(spyTable(), PLAY);
    expect(legalActions(open, 'p1')).toEqual([take('bishop'), take('crane')]);
    expect(legalActions(open, 'p2')).toEqual([]);
  });

  it('bietet beim Ausspielen nur Opfer mit Fortschrittskarten an', () => {
    const plays = legalActions(spyTable(), 'p1').filter(
      (action) => action.type === 'playProgress' && action.play.card === 'spy',
    );
    expect(plays).toEqual([PLAY]);
  });

  /*
   * Wer am Zug ist, spielt eine fuenfte Karte sofort aus (Regel 11) - die
   * Spionage oeffnet deshalb kein Abgeben, auch wenn sie ueber das Limit hebt.
   */
  it('oeffnet kein Abgeben, wenn die genommene Karte ueber das Handlimit hebt', () => {
    const state = patchPlayer(spyTable(), 'p1', {
      progressCards: ['spy', 'warlord', 'saboteur', 'mining', 'irrigation'],
    });
    const after = act(act(state, PLAY), take('bishop'));

    expect(playerNamed(after, 'p1').progressCards).toHaveLength(5);
    expect(after.phase).toEqual({ kind: 'main' });
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL.

- [ ] **Schritt 3: `spy.ts` schreiben**

```ts
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, ProgressPendingPayload } from './answer.js';
import { PROGRESS_NAMES, PROGRESS_VICTORY_CARDS } from './cards.js';
import { countedHand, receiveProgressCard } from './draw.js';
import { openProgressPending, withPending, type ProgressPendingPhase } from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Spionage: die Fortschrittskarten einer Person ansehen und eine davon nehmen.
 *
 * Jede Person taugt, ohne Vergleich der Punkte. "Keine Siegpunktkarten" faellt
 * aus dem Modell heraus: Buchdruck und Verfassung liegen in
 * `openProgressCards`, gewaehlt wird nur aus `progressCards`.
 *
 * Der Blick in die fremde Hand ist die Phase selbst - `revealsTo` in
 * `playerView.ts` oeffnet sie, solange der Spielende hier wartet.
 */

type SpyPlay = Extract<ProgressPlay, { card: 'spy' }>;
type SpyAnswer = Extract<ProgressAnswer, { card: 'spy' }>;
type SpyPayload = Extract<ProgressPendingPayload, { card: 'spy' }>;

export function canSpy(state: GameState, player: PlayerId, play: SpyPlay): RuleViolation | null {
  if (play.victim === player) {
    return violation(RuleViolationCode.INVALID_PROGRESS_VICTIM, 'Bei sich selbst spioniert man nicht');
  }
  const victim = findPlayer(state, play.victim);
  if (victim === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${play.victim} sitzt nicht an diesem Tisch`);
  }
  if (countedHand(victim) === 0) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      `${play.victim} hat keine Fortschrittskarte, die sich nehmen ließe`,
    );
  }
  return null;
}

export function applySpy(state: GameState, player: PlayerId, play: SpyPlay): ReduceResult {
  const problem = canSpy(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(openProgressPending(state, player, [player], { card: 'spy', victim: play.victim }));
}

export function canAnswerSpy(
  state: GameState,
  _phase: ProgressPendingPhase,
  payload: SpyPayload,
  _player: PlayerId,
  answer: SpyAnswer,
): RuleViolation | null {
  const victim = findPlayer(state, payload.victim)!;
  if (!victim.progressCards.includes(answer.take) || PROGRESS_VICTORY_CARDS.includes(answer.take)) {
    return violation(
      RuleViolationCode.NO_SUCH_PROGRESS_CARD,
      `${payload.victim} hat ${PROGRESS_NAMES[answer.take]} nicht auf der Hand`,
    );
  }
  return null;
}

/**
 * Nimmt **ein** Exemplar und schliesst die Phase.
 *
 * Kein Abgeben, auch ueber vier Karten: der Spielende ist am Zug, und am Zug
 * wird eine fuenfte Karte sofort gespielt (Regel 11) - das kann er in `main`.
 */
export function answerSpy(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: SpyPayload,
  player: PlayerId,
  answer: SpyAnswer,
): GameState {
  const players = state.players.map((entry) => {
    if (entry.id === payload.victim) {
      const cards = [...entry.progressCards];
      cards.splice(cards.indexOf(answer.take), 1);
      return { ...entry, progressCards: cards };
    }
    return entry.id === player ? receiveProgressCard(entry, answer.take) : entry;
  });
  return withPending({ ...state, players }, phase, []);
}
```

- [ ] **Schritt 4: Anschließen.**
  - `play.ts` (Import `PlayerIdSchema` aus `../../player.js`):
    `z.object({ card: z.literal('spy'), victim: PlayerIdSchema }),`
  - `progressRules.ts`: `canWaitingCard` → `case 'spy': return canSpy(state, player, play);`,
    `applyPlayProgress` → `case 'spy': return applySpy(discarded, player, play);`
  - `answerRules.ts`: `canAnswerProgress` → `return canAnswerSpy(state, phase, payload, player, answer);`
    im `spy`-Zweig; `applyAnswerProgress`:

```ts
    case 'spy': {
      const payload = phase.payload;
      if (payload.card !== 'spy') return rejected(wrongCard(payload.card));
      return ok(answerSpy(state, phase, payload, player, answer));
    }
```

  - `legal.ts`, `progressAnswerCandidates`:

```ts
    case 'spy': {
      const victim = state.players.find((entry) => entry.id === payload.victim);
      return [...new Set(victim?.progressCards ?? [])].map(
        (take): ProgressAnswer => ({ card: 'spy', take }),
      );
    }
```

  - `legal.ts`, `enumerableProgressPlays`: Signatur auf
    `(state: GameState, player: PlayerId, card: ProgressCardId)`, den Aufruf auf
    `enumerableProgressPlays(state, player, card)`, als erste Zeile
    `const others = state.players.map((entry) => entry.id).filter((id) => id !== player);`
    und der Zweig

```ts
    case 'spy':
      return others.map((victim): ProgressPlay => ({ card: 'spy', victim }));
```

- [ ] **Schritt 5: Tests laufen lassen** — PASS.
- [ ] **Schritt 6: Committen**

```bash
git add packages/shared
git commit -m "Spionage"
```

---

## Aufgabe 6: Großhändler

**Regel (11.2, vollständig):** „Eine Person mit **mehr Siegpunkten** wählen, ihre Handkarten
ansehen und **2 davon nehmen**." Ausgelegt: das Ziel braucht mehr Punkte (`victoryPointsOf`)
**und** mindestens eine Karte; hat es weniger als zwei, nimmt der Spielende, was da ist.
`pending` steht auf dem Spielenden, `revealsTo` zeigt ihm die fremden Handkarten.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/masterMerchant.ts`
- Ändern: `cities/progress/play.ts`, `progressRules.ts`, `answerRules.ts`, `game/legal.ts`
- Test: `cities/progress/masterMerchant.test.ts` (**neu**)

**Interfaces:**

- Consumes: Aufgabe 1 (`transferCards`, `twoCardsOrAll`, `withPending`), `enumerableProgressPlays`
  aus Aufgabe 5
- Produces: `canMasterMerchant`, `applyMasterMerchant`, `canAnswerMasterMerchant`,
  `answerMasterMerchant`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

`packages/shared/src/game/cities/progress/masterMerchant.test.ts` — Helfer `tableWith`,
`patchPlayer`, `playerNamed`, `act`, `city`, `settlement` aus dem Abschnitt „Testhelfer für die Kartentests“,
Imports von dort (ohne `scoring`, `countCards`):

```ts
const PLAY: GameAction = {
  type: 'playProgress',
  player: 'p1',
  play: { card: 'masterMerchant', victim: 'p2' },
};

function take(cards: CardAmounts): GameAction {
  return { type: 'answerProgress', player: 'p1', answer: { card: 'masterMerchant', take: cards } };
}

/** p1 hat eine Siedlung (1), p2 eine Stadt (2) und drei Karten, p3 eine Siedlung (1). */
function merchantTable(): GameState {
  let state = tableWith('masterMerchant', {
    buildings: {
      [FAR_VERTEX]: settlement('p1'),
      [CENTER_VERTEX]: city('p2'),
      [HARBOR3_VERTEX]: settlement('p3'),
    },
  });
  state = patchPlayer(state, 'p1', { progressCards: ['masterMerchant'] });
  state = patchPlayer(state, 'p2', { resources: hand({ ore: 2, wool: 1 }) });
  return patchPlayer(state, 'p3', { resources: hand({ grain: 3 }) });
}

describe('Grosshaendler', () => {
  it('wartet auf den Spielenden selbst und merkt sich das Opfer', () => {
    expect(act(merchantTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p1'],
      payload: { card: 'masterMerchant', victim: 'p2' },
    });
  });

  it('lehnt ein Opfer ohne mehr Siegpunkte ab', () => {
    expect(
      canPlayProgress(merchantTable(), 'p1', { card: 'masterMerchant', victim: 'p3' })?.code,
    ).toBe(RuleViolationCode.INVALID_PROGRESS_VICTIM);
  });

  it('lehnt ein Opfer ohne Handkarten ab', () => {
    const state = patchPlayer(merchantTable(), 'p2', { resources: hand() });
    expect(canPlayProgress(state, 'p1', { card: 'masterMerchant', victim: 'p2' })?.code).toBe(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
    );
  });

  it('nimmt zwei Karten und kehrt in die Hauptphase zurueck', () => {
    const after = act(act(merchantTable(), PLAY), take(hand({ ore: 1, wool: 1 })));

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ ore: 1, wool: 1 }));
    expect(playerNamed(after, 'p2').resources).toEqual(hand({ ore: 1 }));
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('nimmt alles, wenn das Opfer weniger als zwei Karten hat', () => {
    const open = act(patchPlayer(merchantTable(), 'p2', { resources: hand({ ore: 1 }) }), PLAY);

    const two = reduce(open, take(hand({ ore: 2 })));
    expect(two.ok ? null : two.error.code).toBe(RuleViolationCode.WRONG_PROGRESS_ANSWER);
    expect(reduce(open, take(hand({ ore: 1 }))).ok).toBe(true);
  });

  it('lehnt Karten ab, die das Opfer nicht haelt', () => {
    const result = reduce(act(merchantTable(), PLAY), take(hand({ brick: 2 })));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('bietet beim Ausspielen nur Opfer mit mehr Punkten an und zaehlt die Antwort nicht auf', () => {
    const plays = legalActions(merchantTable(), 'p1').filter(
      (action) => action.type === 'playProgress' && action.play.card === 'masterMerchant',
    );
    expect(plays).toEqual([PLAY]);
    expect(legalActions(act(merchantTable(), PLAY), 'p1')).toEqual([]);
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL.

- [ ] **Schritt 3: `masterMerchant.ts` schreiben**

```ts
import { canAfford, countCards } from '../../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { victoryPointsOf } from '../../scoring.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import type { ProgressAnswer, ProgressPendingPayload } from './answer.js';
import {
  openProgressPending,
  transferCards,
  twoCardsOrAll,
  withPending,
  type ProgressPendingPhase,
} from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Grosshaendler: eine Person mit mehr Siegpunkten waehlen, ihre Handkarten
 * ansehen und zwei davon nehmen.
 *
 * "Mehr Siegpunkte" heisst `victoryPointsOf` - dieselbe Auslegung und derselbe
 * Grund wie bei der Hochzeit (`wedding.ts`). Das Ziel braucht dazu mindestens
 * eine Karte; hat es weniger als zwei, nimmt der Spielende, was da ist.
 */

type MasterMerchantPlay = Extract<ProgressPlay, { card: 'masterMerchant' }>;
type MasterMerchantAnswer = Extract<ProgressAnswer, { card: 'masterMerchant' }>;
type MasterMerchantPayload = Extract<ProgressPendingPayload, { card: 'masterMerchant' }>;

export function canMasterMerchant(
  state: GameState,
  player: PlayerId,
  play: MasterMerchantPlay,
): RuleViolation | null {
  if (play.victim === player) {
    return violation(RuleViolationCode.INVALID_PROGRESS_VICTIM, 'Bei sich selbst nimmt man nichts');
  }
  const victim = findPlayer(state, play.victim);
  if (victim === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${play.victim} sitzt nicht an diesem Tisch`);
  }
  if (victoryPointsOf(state, play.victim) <= victoryPointsOf(state, player)) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      `${play.victim} hat nicht mehr Siegpunkte`,
    );
  }
  if (countCards(victim.resources) === 0) {
    return violation(RuleViolationCode.INVALID_PROGRESS_VICTIM, `${play.victim} hat keine Handkarten`);
  }
  return null;
}

export function applyMasterMerchant(
  state: GameState,
  player: PlayerId,
  play: MasterMerchantPlay,
): ReduceResult {
  const problem = canMasterMerchant(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(
    openProgressPending(state, player, [player], { card: 'masterMerchant', victim: play.victim }),
  );
}

export function canAnswerMasterMerchant(
  state: GameState,
  _phase: ProgressPendingPhase,
  payload: MasterMerchantPayload,
  _player: PlayerId,
  answer: MasterMerchantAnswer,
): RuleViolation | null {
  const held = findPlayer(state, payload.victim)!.resources;
  const required = twoCardsOrAll(countCards(held));

  if (countCards(answer.take) !== required) {
    return violation(
      RuleViolationCode.WRONG_PROGRESS_ANSWER,
      `Genommen werden genau ${required} Karten`,
    );
  }
  if (!canAfford(held, answer.take)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Genommen werden kann nur, was auf der Hand liegt',
    );
  }
  return null;
}

export function answerMasterMerchant(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: MasterMerchantPayload,
  _player: PlayerId,
  answer: MasterMerchantAnswer,
): GameState {
  return withPending(transferCards(state, payload.victim, phase.by, answer.take), phase, []);
}
```

- [ ] **Schritt 4: Anschließen** — nach demselben Muster wie in Aufgabe 5:
  - `play.ts`: `z.object({ card: z.literal('masterMerchant'), victim: PlayerIdSchema }),`
  - `progressRules.ts`: `case 'masterMerchant': return canMasterMerchant(state, player, play);`
    in `canWaitingCard`, `case 'masterMerchant': return applyMasterMerchant(discarded, player, play);`
    in `applyPlayProgress`
  - `answerRules.ts`, `canAnswerProgress`:
    `return canAnswerMasterMerchant(state, phase, payload, player, answer);`;
    `applyAnswerProgress`:

```ts
    case 'masterMerchant': {
      const payload = phase.payload;
      if (payload.card !== 'masterMerchant') return rejected(wrongCard(payload.card));
      return ok(answerMasterMerchant(state, phase, payload, player, answer));
    }
```

  - `legal.ts`, `enumerableProgressPlays`:

```ts
    case 'masterMerchant':
      return others.map((victim): ProgressPlay => ({ card: 'masterMerchant', victim }));
```

    `progressAnswerCandidates` bleibt für `masterMerchant` bei `[]` — die Antwort ist eine Menge.

- [ ] **Schritt 5: Tests laufen lassen** — PASS.
- [ ] **Schritt 6: Committen**

```bash
git add packages/shared
git commit -m "Grosshaendler"
```

---

## Aufgabe 7: Deserteur

**Regel (11.3, vollständig):** „Eine Person entfernt einen Ritter ihrer Wahl; man stellt selbst
einen Ritter **derselben Stufe und desselben Zustands** auf (ersatzweise eine niedrigere Stufe)."
Ausgelegt (Spec, Zuschnitt 10d-2): das Ziel braucht mindestens einen Ritter. Die Ersatzstufe ist
**erzwungen**: dieselbe, falls der eigene Vorrat sie hergibt, sonst die höchste freie darunter.
Die Kreuzung wählt der Spielende. `active` reist mit, `activatedOnTurn` wird `state.turn`
(Auslegung, dem Menschen genannt): übernommen heißt angekommen, nicht sofort handlungsfähig. Ist
kein Vorrat frei oder keine Kreuzung legal, öffnet die zweite Runde gar nicht — der Ritter ist
einfach weg. Es ist die einzige Karte mit **zwei Runden**.

**Dateien:**

- Neu: `packages/shared/src/game/cities/progress/deserter.ts`
- Ändern: `cities/knights.ts` (`canPlaceKnightAt`), `cities/progress/play.ts`,
  `progressRules.ts`, `answerRules.ts`, `game/legal.ts`
- Test: `cities/progress/deserter.test.ts` (**neu**), `cities/knights.test.ts`

**Interfaces:**

- Consumes: Aufgabe 1 (`openProgressPending`, `ProgressPendingPhase`)
- Produces: `canPlaceKnightAt(state, player, vertex): RuleViolation | null` in `knights.ts`;
  `canDeserter`, `applyDeserter`, `canAnswerDeserter`, `answerDeserter`,
  `replacementLevel(state, player, fallen: KnightLevel): KnightLevel | null`,
  `deserterPlacements(state, player): VertexId[]`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben**

In `knights.test.ts` (Imports `CENTER_EDGE`, `CENTER_VERTEX`, `testGame`, `CITIES_RULES`,
`RuleViolationCode`, `canPlaceKnightAt` ergänzen, soweit sie fehlen):

```ts
describe('canPlaceKnightAt', () => {
  it('fragt nur nach dem Platz, nicht nach Preis und Vorrat', () => {
    const state = testGame({ rules: CITIES_RULES, roads: { [CENTER_EDGE]: 'p1' } });
    expect(canPlaceKnightAt(state, 'p1', CENTER_VERTEX)).toBeNull();
  });

  it('verlangt eine eigene Strasse an der Kreuzung', () => {
    expect(canPlaceKnightAt(testGame({ rules: CITIES_RULES }), 'p1', CENTER_VERTEX)?.code).toBe(
      RuleViolationCode.NOT_CONNECTED,
    );
  });
});
```

`packages/shared/src/game/cities/progress/deserter.test.ts` — Helfer `tableWith`, `patchPlayer`,
`playerNamed`, `act` aus dem Abschnitt „Testhelfer für die Kartentests“; Imports dazu:
`ADJACENT_VERTEX, CENTER_EDGE, CENTER_VERTEX, FAR_VERTEX, HARBOR3_VERTEX, testGame` aus
`../../fixtures.js`, `type Knight` aus `../../state.js`, `legalActions`, `reduce`,
`RuleViolationCode`, `canPlayProgress`:

```ts
const PLAY: GameAction = {
  type: 'playProgress',
  player: 'p1',
  play: { card: 'deserter', victim: 'p2' },
};

function pick(player: PlayerId, vertex: string): GameAction {
  return { type: 'answerProgress', player, answer: { card: 'deserter', vertex } };
}

const STRONG_READY: Knight = {
  owner: 'p2',
  level: 2,
  active: true,
  activatedOnTurn: 0,
  upgradedThisTurn: false,
};

const SIMPLE_PASSIVE: Knight = {
  owner: 'p2',
  level: 1,
  active: false,
  activatedOnTurn: null,
  upgradedThisTurn: false,
};

/**
 * p1 hat eine Strasse zwischen CENTER_VERTEX und ADJACENT_VERTEX - dort darf
 * der Ueberlaeufer hin. p2 hat einen starken aktiven und einen einfachen
 * passiven Ritter. Die laufende Runde ist 1.
 */
function deserterTable(overrides: Partial<GameState> = {}): GameState {
  const state = tableWith('deserter', {
    roads: { [CENTER_EDGE]: 'p1' },
    knights: { [FAR_VERTEX]: STRONG_READY, [HARBOR3_VERTEX]: SIMPLE_PASSIVE },
    ...overrides,
  });
  return patchPlayer(state, 'p1', { progressCards: ['deserter'] });
}

function withStock(state: GameState, id: PlayerId, stock: Record<string, number>): GameState {
  return patchPlayer(state, id, { piecesLeft: { ...playerNamed(state, id).piecesLeft, ...stock } });
}

describe('Deserteur', () => {
  it('wartet zuerst auf das Opfer', () => {
    expect(act(deserterTable(), PLAY).phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p2'],
      payload: { card: 'deserter', victim: 'p2', replacement: null },
    });
  });

  it('lehnt ein Opfer ohne Ritter ab', () => {
    expect(canPlayProgress(deserterTable(), 'p1', { card: 'deserter', victim: 'p3' })?.code).toBe(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
    );
  });

  it('nimmt in Runde 1 den gewaehlten Ritter vom Brett und oeffnet Runde 2 beim Spielenden', () => {
    const before = act(deserterTable(), PLAY);
    const after = act(before, pick('p2', FAR_VERTEX));

    expect(after.knights[FAR_VERTEX]).toBeUndefined();
    expect(playerNamed(after, 'p2').piecesLeft.knight2).toBe(
      playerNamed(before, 'p2').piecesLeft.knight2 + 1,
    );
    expect(after.phase).toEqual({
      kind: 'progressPending',
      by: 'p1',
      pending: ['p1'],
      payload: { card: 'deserter', victim: 'p2', replacement: { level: 2, active: true } },
    });
  });

  it('weicht auf die hoechste freie Stufe darunter aus', () => {
    const state = withStock(deserterTable(), 'p1', { knight2: 0 });
    const after = act(act(state, PLAY), pick('p2', FAR_VERTEX));

    expect(after.phase).toMatchObject({ payload: { replacement: { level: 1, active: true } } });
  });

  it('oeffnet keine zweite Runde ohne passenden Vorrat', () => {
    const state = withStock(deserterTable(), 'p1', { knight1: 0, knight2: 0 });
    const after = act(act(state, PLAY), pick('p2', FAR_VERTEX));

    expect(after.knights[FAR_VERTEX]).toBeUndefined();
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('oeffnet keine zweite Runde ohne legale Kreuzung', () => {
    const after = act(act(deserterTable({ roads: {} }), PLAY), pick('p2', FAR_VERTEX));
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('stellt in Runde 2 den Ueberlaeufer mit Stufe und Helm auf', () => {
    const round2 = act(act(deserterTable(), PLAY), pick('p2', FAR_VERTEX));
    const after = act(round2, pick('p1', CENTER_VERTEX));

    expect(after.knights[CENTER_VERTEX]).toEqual({
      owner: 'p1',
      level: 2,
      active: true,
      activatedOnTurn: after.turn,
      upgradedThisTurn: false,
    });
    expect(playerNamed(after, 'p1').piecesLeft.knight2).toBe(
      playerNamed(round2, 'p1').piecesLeft.knight2 - 1,
    );
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('stellt einen passiven Ritter passiv und ohne Aktivierungsrunde auf', () => {
    const round2 = act(act(deserterTable(), PLAY), pick('p2', HARBOR3_VERTEX));
    const after = act(round2, pick('p1', ADJACENT_VERTEX));

    expect(after.knights[ADJACENT_VERTEX]).toMatchObject({
      level: 1,
      active: false,
      activatedOnTurn: null,
    });
  });

  it('lehnt in Runde 1 eine Kreuzung ohne eigenen Ritter ab', () => {
    const result = reduce(act(deserterTable(), PLAY), pick('p2', CENTER_VERTEX));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NO_KNIGHT_HERE);
  });

  it('lehnt in Runde 2 eine Kreuzung ohne eigene Strasse ab', () => {
    const round2 = act(act(deserterTable(), PLAY), pick('p2', FAR_VERTEX));
    const result = reduce(round2, pick('p1', FAR_VERTEX));
    expect(result.ok ? null : result.error.code).toBe(RuleViolationCode.NOT_CONNECTED);
  });

  it('zaehlt in beiden Runden genau die moeglichen Kreuzungen auf', () => {
    const round1 = act(deserterTable(), PLAY);
    const victimMoves = legalActions(round1, 'p2').map((action) =>
      action.type === 'answerProgress' && action.answer.card === 'deserter' ? action.answer.vertex : null,
    );
    expect(victimMoves.sort()).toEqual([FAR_VERTEX, HARBOR3_VERTEX].sort());

    const round2 = act(round1, pick('p2', FAR_VERTEX));
    const placements = legalActions(round2, 'p1').map((action) =>
      action.type === 'answerProgress' && action.answer.card === 'deserter' ? action.answer.vertex : null,
    );
    expect(placements.sort()).toEqual([ADJACENT_VERTEX, CENTER_VERTEX].sort());
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL.

- [ ] **Schritt 3: `canPlaceKnightAt` aus `canBuildKnight` herauslösen.** In `knights.ts` vor
      `canBuildKnight`:

```ts
/**
 * Ob hier eine Ritterfigur stehen darf - Brett, freier Platz, eigene Strasse.
 *
 * Ohne Preis und ohne Vorrat, herausgeloest aus `canBuildKnight` (Etappe
 * 10d-2): der Deserteur stellt einen Ritter auf, den niemand bezahlt und der
 * nicht immer ein Einfacher ist. Die Frage nach dem Platz ist trotzdem
 * dieselbe, und zwei Auslegungen davon liefen auseinander.
 */
export function canPlaceKnightAt(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
): RuleViolation | null {
  const board = boardOf(state.scenario);

  if (!board.topology.vertexNeighbors.has(vertex)) {
    return violation(
      RuleViolationCode.NOT_ON_BOARD,
      `Der Knoten ${vertex} gehört nicht zu diesem Brett`,
    );
  }
  if (state.buildings[vertex] !== undefined) {
    return violation(RuleViolationCode.VERTEX_OCCUPIED, `Auf ${vertex} steht bereits etwas`);
  }
  if (state.knights[vertex] !== undefined) {
    return violation(RuleViolationCode.VERTEX_OCCUPIED, `Auf ${vertex} steht ein Ritter`);
  }

  /*
   * Eine angrenzende eigene **Strasse** - ein eigenes Dorf allein genuegt
   * nicht. Deshalb eine eigene Schleife und nicht `connectsAt` aus `build.ts`.
   */
  const roads = board.topology.vertexEdges.get(vertex) ?? [];
  if (!roads.some((edge) => state.roads[edge] === player)) {
    return violation(RuleViolationCode.NOT_CONNECTED, `An ${vertex} endet keine eigene Straße`);
  }

  return null;
}
```

`canBuildKnight` behält Kopfkommentar und Signatur; sein Rumpf wird:

```ts
  const place = canPlaceKnightAt(state, player, vertex);
  if (place !== null) return place;

  const price = priceOf(state, 'knight');
  if (price === null) return noSuchTable('Ritter');

  return canPayFor(state, player, knightPiece(1), price);
```

- [ ] **Schritt 4: `deserter.ts` schreiben**

```ts
import type { VertexId } from '../../../geometry/index.js';
import { boardOf } from '../../board.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import {
  findPlayer,
  ok,
  rejected,
  withPlayer,
  type GameState,
  type KnightLevel,
  type ReduceResult,
} from '../../state.js';
import { canPlaceKnightAt, knightPiece } from '../knights.js';
import type { ProgressAnswer, ProgressPendingPayload } from './answer.js';
import { openProgressPending, type ProgressPendingPhase } from './pending.js';
import type { ProgressPlay } from './play.js';

/**
 * Deserteur: eine Person gibt einen Ritter ihrer Wahl auf, der Spielende stellt
 * einen gleichwertigen auf. Die einzige wartende Karte mit **zwei Runden**.
 *
 * Runde 1 wartet auf das Opfer (`replacement === null`), Runde 2 auf den
 * Spielenden. Was zwischen den Runden feststeht - die Ersatzstufe und der Helm
 * -, traegt `payload.replacement`.
 *
 * **Die Ersatzstufe ist keine Wahl.** Dieselbe wie die gefallene, falls der
 * eigene Vorrat sie hergibt, sonst die hoechste freie darunter; "ersatzweise"
 * ist im Wortlaut keine Wahl. Gewaehlt wird nur die Kreuzung.
 */

type DeserterPlay = Extract<ProgressPlay, { card: 'deserter' }>;
type DeserterAnswer = Extract<ProgressAnswer, { card: 'deserter' }>;
type DeserterPayload = Extract<ProgressPendingPayload, { card: 'deserter' }>;

export function canDeserter(
  state: GameState,
  player: PlayerId,
  play: DeserterPlay,
): RuleViolation | null {
  if (play.victim === player) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      'Die eigenen Ritter wirbt man nicht ab',
    );
  }
  if (findPlayer(state, play.victim) === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${play.victim} sitzt nicht an diesem Tisch`);
  }
  if (!Object.values(state.knights).some((knight) => knight.owner === play.victim)) {
    return violation(
      RuleViolationCode.INVALID_PROGRESS_VICTIM,
      `${play.victim} hat keinen Ritter auf dem Brett`,
    );
  }
  return null;
}

export function applyDeserter(state: GameState, player: PlayerId, play: DeserterPlay): ReduceResult {
  const problem = canDeserter(state, player, play);
  if (problem !== null) return rejected(problem);

  return ok(
    openProgressPending(state, player, [play.victim], {
      card: 'deserter',
      victim: play.victim,
      replacement: null,
    }),
  );
}

/** Die erzwungene Ersatzstufe - `null`, wenn der Vorrat keine hergibt. */
export function replacementLevel(
  state: GameState,
  player: PlayerId,
  fallen: KnightLevel,
): KnightLevel | null {
  const stock = findPlayer(state, player)!.piecesLeft;
  for (let level: number = fallen; level >= 1; level -= 1) {
    const candidate = level as KnightLevel;
    if ((stock[knightPiece(candidate)] ?? 0) > 0) return candidate;
  }
  return null;
}

/** Wohin der Spielende den Ueberlaeufer stellen darf. */
export function deserterPlacements(state: GameState, player: PlayerId): VertexId[] {
  return boardOf(state.scenario).topology.vertices.filter(
    (vertex) => canPlaceKnightAt(state, player, vertex) === null,
  );
}

export function canAnswerDeserter(
  state: GameState,
  _phase: ProgressPendingPhase,
  payload: DeserterPayload,
  player: PlayerId,
  answer: DeserterAnswer,
): RuleViolation | null {
  if (payload.replacement === null) {
    const knight = state.knights[answer.vertex];
    if (knight === undefined || knight.owner !== player) {
      return violation(
        RuleViolationCode.NO_KNIGHT_HERE,
        `Auf ${answer.vertex} steht kein eigener Ritter`,
      );
    }
    return null;
  }

  const place = canPlaceKnightAt(state, player, answer.vertex);
  if (place !== null) return place;

  const piece = knightPiece(payload.replacement.level);
  if ((findPlayer(state, player)!.piecesLeft[piece] ?? 0) <= 0) {
    return violation(RuleViolationCode.NO_PIECES_LEFT, 'Im Vorrat liegt kein Ritter dieser Stufe mehr');
  }
  return null;
}

/**
 * Runde 1: der Ritter geht in den Vorrat seines Besitzers, und Runde 2 oeffnet
 * nur, wenn es eine Ersatzstufe **und** eine legale Kreuzung gibt - eine
 * Phase, die auf eine Wahl ohne Moeglichkeiten wartet, haelt den Tisch fuer
 * nichts an.
 *
 * Runde 2: der Ueberlaeufer steht mit der Ersatzstufe und dem Helm des
 * Gefallenen. `activatedOnTurn` ist die laufende Runde: uebernommen heisst
 * angekommen, nicht sofort handlungsfaehig.
 */
export function answerDeserter(
  state: GameState,
  phase: ProgressPendingPhase,
  payload: DeserterPayload,
  player: PlayerId,
  answer: DeserterAnswer,
): GameState {
  if (payload.replacement === null) {
    const fallen = state.knights[answer.vertex]!;
    const knights = { ...state.knights };
    delete knights[answer.vertex];

    const piece = knightPiece(fallen.level);
    const removed: GameState = {
      ...state,
      knights,
      players: withPlayer(state, player, (owner) => ({
        ...owner,
        piecesLeft: { ...owner.piecesLeft, [piece]: owner.piecesLeft[piece] + 1 },
      })),
    };

    const level = replacementLevel(removed, phase.by, fallen.level);
    if (level === null || deserterPlacements(removed, phase.by).length === 0) {
      return { ...removed, phase: { kind: 'main' } };
    }

    return {
      ...removed,
      phase: {
        ...phase,
        pending: [phase.by],
        payload: { ...payload, replacement: { level, active: fallen.active } },
      },
    };
  }

  const { level, active } = payload.replacement;
  const piece = knightPiece(level);

  return {
    ...state,
    knights: {
      ...state.knights,
      [answer.vertex]: {
        owner: player,
        level,
        active,
        activatedOnTurn: active ? state.turn : null,
        upgradedThisTurn: false,
      },
    },
    players: withPlayer(state, player, (owner) => ({
      ...owner,
      piecesLeft: { ...owner.piecesLeft, [piece]: owner.piecesLeft[piece] - 1 },
    })),
    phase: { kind: 'main' },
  };
}
```

- [ ] **Schritt 5: Anschließen und den Platzhalter entfernen.**
  - `play.ts`: `z.object({ card: z.literal('deserter'), victim: PlayerIdSchema }),`
  - `progressRules.ts`: `case 'deserter': return canDeserter(state, player, play);` in
    `canWaitingCard`, `case 'deserter': return applyDeserter(discarded, player, play);` in
    `applyPlayProgress`
  - `answerRules.ts`, `canAnswerProgress`:
    `return canAnswerDeserter(state, phase, payload, player, answer);`; `applyAnswerProgress`:

```ts
    case 'deserter': {
      const payload = phase.payload;
      if (payload.card !== 'deserter') return rejected(wrongCard(payload.card));
      return ok(answerDeserter(state, phase, payload, player, answer));
    }
```

    Danach steht in keinem Zweig mehr `notWiredYet`: die Funktion samt Kommentar löschen.
    `pnpm typecheck` bestätigt, dass kein Aufrufer übrig ist.
  - `legal.ts`, `enumerableProgressPlays`:

```ts
    case 'deserter':
      return others.map((victim): ProgressPlay => ({ card: 'deserter', victim }));
```

  - `legal.ts`, `progressAnswerCandidates`: Signatur `(state: GameState, player: PlayerId)`,
    Aufruf `progressAnswerCandidates(state, player)`, Import `deserterPlacements` aus
    `./cities/progress/deserter.js`, und der Zweig:

```ts
    case 'deserter': {
      const vertices =
        payload.replacement === null
          ? Object.entries(state.knights)
              .filter(([, knight]) => knight.owner === player)
              .map(([vertex]) => vertex)
          : deserterPlacements(state, player);
      return vertices.map((vertex): ProgressAnswer => ({ card: 'deserter', vertex }));
    }
```

- [ ] **Schritt 6: Tests laufen lassen** — `pnpm typecheck && pnpm -r test`. PASS, auch die
      bestehenden Ritterbau-Tests in `knights.test.ts` (sie sichern die Umstellung von
      `canBuildKnight`).
- [ ] **Schritt 7: Committen**

```bash
git add packages/shared
git commit -m "Deserteur in zwei Runden, canPlaceKnightAt aus canBuildKnight geloest"
```

---

## Aufgabe 8: Die fünf Karten kommen auf die Stapel

**Was entsteht:** `CITIES_RULES.progressDecks` bekommt die fünf fehlenden Zeilen — 54 Karten
statt 43, die Zusammensetzung des Brettspiels. Genau diese Aufgabe hat 10d-1 vorbereitet: „was
fehlt, gibt es an diesem Tisch nicht", und so kostet sie einen Tabelleneintrag statt einer
Fallunterscheidung. Dazu ein Test, der zwei Karten mit dem echten Regelwerk von der Hand bis
zurück in die Hauptphase spielt, und die Kommentare, die „kommen erst in 10d-2" sagen.

**Laufende Partien** behalten ihr gespeichertes Regelwerk mit 43 Karten: gespeichert wird der
Startzustand samt `RuleSet`. Das ist gewollt — eine Regeländerung mitten in einer Partie wäre
ein Eingriff in sie — und gehört in `PROGRESS.md`.

**Dateien:**

- Ändern: `packages/shared/src/rules/cities.ts`, `rules/ruleset.ts` (Kommentar),
  `game/cities/progress/commerce.ts`, `politics.ts`, `play.ts` (Kommentare)
- Test: `packages/shared/src/rules/cities.test.ts`,
  `game/cities/progress/answerRules.test.ts`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben.** In `cities.test.ts` die zwei Tests
      „legt in 10d-1 dreiundvierzig Fortschrittskarten aus" und „laesst die fuenf Karten weg,
      die auf eine fremde Antwort warten" **ersetzen** durch (Import
      `FULL_PROGRESS_DECK` aus `../game/cities/progress/cards.js`):

```ts
  /*
   * Die Summe 54 und achtzehn je Stapel prueft `cards.test.ts` an
   * `FULL_PROGRESS_DECK` - hier genuegt, dass der Tisch genau diese Tabelle legt.
   */
  it('legt die vollstaendigen Fortschrittsstapel des Brettspiels aus', () => {
    expect(CITIES_RULES.progressDecks).toEqual(FULL_PROGRESS_DECK);
  });
```

In `answerRules.test.ts` am Ende (Imports `CENTER_VERTEX` aus `../../fixtures.js`,
`playerViewOf` aus `../../playerView.js`, `type GameAction` aus `../../actions.js`,
`type PlayerState` aus `../../player.js`):

```ts
describe('Die wartenden Karten am echten Staedte-Tisch', () => {
  const seats = ['p1', 'p2', 'p3'].map((id) => ({ id, name: id, color: '#808080' }));

  function patch(state: GameState, id: string, change: Partial<PlayerState>): GameState {
    return {
      ...state,
      players: state.players.map((player) => (player.id === id ? { ...player, ...change } : player)),
    };
  }

  function act(state: GameState, action: GameAction): GameState {
    const result = reduce(state, action);
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  }

  it('spielt eine Hochzeit mit dem Regelwerk der Partie bis zurueck in die Hauptphase', () => {
    let state = testGame({
      rules: CITIES_RULES,
      buildings: { [CENTER_VERTEX]: { owner: 'p2', kind: 'city', wall: false, metropolis: null } },
    });
    state = patch(patch(state, 'p1', { progressCards: ['wedding'] }), 'p2', {
      resources: hand({ ore: 2 }),
    });

    const open = act(state, { type: 'playProgress', player: 'p1', play: { card: 'wedding' } });
    const done = act(open, {
      type: 'answerProgress',
      player: 'p2',
      answer: { card: 'wedding', gift: hand({ ore: 2 }) },
    });

    expect(done.phase).toEqual({ kind: 'main' });
    expect(done.players.find((player) => player.id === 'p1')!.resources).toEqual(hand({ ore: 2 }));
  });

  it('oeffnet der Spionage die fremde Hand und schliesst sie nach der Antwort wieder', () => {
    let state = testGame({ rules: CITIES_RULES });
    state = patch(patch(state, 'p1', { progressCards: ['spy'] }), 'p2', {
      progressCards: ['bishop'],
    });

    const open = act(state, { type: 'playProgress', player: 'p1', play: { card: 'spy', victim: 'p2' } });
    const seen = playerViewOf(open, 'p1', seats, 1).players.find((player) => player.id === 'p2')!;
    expect(seen.progressCards).toEqual(['bishop']);

    const done = act(open, { type: 'answerProgress', player: 'p1', answer: { card: 'spy', take: 'bishop' } });
    const after = playerViewOf(done, 'p1', seats, 2).players.find((player) => player.id === 'p2')!;
    expect(after.progressCards).toBeNull();
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL (die Karten fehlen in `CITIES_RULES`).

- [ ] **Schritt 3: Die fünf Zeilen eintragen.** In `rules/cities.ts` die Tabelle
      `progressDecks` in derselben Reihenfolge wie `FULL_PROGRESS_DECK` ergänzen:
      `tradeHarbor: 2` und `masterMerchant: 2` nach `commodityMonopoly` bzw. `merchantFleet`,
      `spy: 3` vor `bishop`, `deserter: 2` nach `bishop`, `wedding: 2` nach `warlord`. Der
      Kommentar darüber wird:

```ts
  /*
   * Die Fortschrittsstapel - achtzehn je Bereich, 54 zusammen, wie in der
   * Schachtel (`docs/regeln-staedte-und-ritter.md` 11.1-11.3). Die fuenf Karten,
   * die auf eine fremde Antwort warten, kamen in 10d-2 dazu; bis dahin fehlten
   * sie hier und nicht als Sperre im Regelcode.
   */
```

- [ ] **Schritt 4: Die veralteten Kommentare nachziehen.** In `rules/ruleset.ts` (Kommentar an
      `progressDecks`), `commerce.ts` und `politics.ts` (Kopfkommentare), `play.ts`
      (Kopfkommentar) steht, dass die fünf Karten „erst in 10d-2" kommen oder „an diesem Tisch
      nicht liegen". Jeweils ersetzen durch einen Satz, der sagt, wo sie jetzt stehen: „Die
      fuenf Karten, die auf eine fremde Antwort warten, stehen je in einer eigenen Datei
      (`wedding.ts`, `tradeHarbor.ts`, `spy.ts`, `masterMerchant.ts`, `deserter.ts`) - ihre
      Gemeinsamkeit ist die Phase, nicht der Stapel." Den Stub-Absatz in `commerce.ts`
      („Stub-Stand (Aufgabe 5)") gleich mit entfernen — er beschreibt einen Stand, den es seit
      10d-1 nicht mehr gibt. Kontrolle:

```bash
grep -rn "10d-2" packages/shared/src
```

Erwartet: nur noch Stellen, die 10d-2 als **Herkunft** nennen, keine als Zukunft.

- [ ] **Schritt 5: Tests laufen lassen** — `pnpm -r test`. PASS, auch
      `__fixtures__/saved-10c.json` (die gespeicherte Partie liest weiter mit ihrem eigenen
      Regelwerk).
- [ ] **Schritt 6: Committen**

```bash
git add packages/shared
git commit -m "Die fuenf wartenden Karten liegen auf den Stapeln: 54 statt 43"
```

---

## Aufgabe 9: Fristen für alle Wartephasen — die Regel

**Was entsteht (Spec 5.5):** `deadlineOf` kennt jede Wartephase und liefert dort eine **Dauer**;
`applyTimeout` zieht aus `playerTrade.ts` in ein eigenes `game/timeout.ts` und wird Verteiler
über die Phasen. Die zwölf Zeilen aus 5.5, abgeleitet aus einem Satz: **ein Geschenk verfällt,
eine Pflicht wird abgenommen.**

| Phase                                  | beim Ablauf                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `aqueductPending`                      | verfällt für den Vordersten — kein Rohstoff                                  |
| `defenderPending`                      | verfällt für den Vordersten — keine Karte                                    |
| `progressPending` / `spy`              | verfällt — nichts genommen                                                   |
| `progressPending` / `masterMerchant`   | verfällt — nichts genommen                                                   |
| `progressPending` / `deserter` Runde 2 | verfällt — kein Ersatzritter                                                 |
| `discardPending`                       | für alle Übrigen abgeworfen, je vom größten Stapel abwärts (`takeMostHeld`)  |
| `progressDiscardPending`               | der Vorderste gibt die erste zählende Karte in `PROGRESS_CARD_IDS`-Ordnung ab |
| `progressPending` / `wedding`          | alle Übrigen schenken ihre zwei häufigsten Karten                            |
| `progressPending` / `tradeHarbor`      | alle Übrigen geben ihre häufigste Handelsware                                |
| `progressPending` / `deserter` Runde 1 | der schwächste Ritter fällt, bei Gleichstand die kleinste Kreuzungs-Id       |
| `robberPending`                        | Wüste, sonst das erste Feld ohne fremdes Bauwerk, sonst das erste legale     |
| `displacePending`                      | erste legale Kreuzung, sonst vom Brett                                       |

Jede abgenommene Pflicht geht durch **dieselbe** `apply…`, die der Mensch auslöst — kein
zweiter Weg, der die Regel nachbaut.

**Dateien:**

- Neu: `packages/shared/src/game/timeout.ts`
- Ändern: `game/deadline.ts`, `game/playerTrade.ts`, `game/reducer.ts`, `game/index.ts`,
  `rules/ruleset.ts`, `rules/cities.ts`, `cities/progress/answerRules.ts`,
  `cities/progress/wedding.ts`, `tradeHarbor.ts`, `deserter.ts`
- Test: `packages/shared/src/game/timeout.test.ts` (**neu**), `game/playerTrade.test.ts`,
  `rules/ruleset.test.ts`

**Interfaces:**

- Produces:
  - `type Deadline = { kind: 'at'; at: number; owner: PlayerId } | { kind: 'after'; ms: number; owner: PlayerId }`
  - `interface DeadlineSource { phase; players: readonly { id }[]; currentPlayerIndex; rules: { pendingAnswerMs } }`
    — `GameState` und `PlayerView` erfüllen es beide (Aufgabe 12 braucht das)
  - `deadlineOf(source: DeadlineSource): Deadline | null`
  - `msUntil(due: Deadline, now: number): number`
  - `canTimeout(state, at)`, `applyTimeout(state, at)` jetzt aus `timeout.ts`
  - `autoAnswerProgress(state): ReduceResult` in `answerRules.ts`
  - `RuleSet.pendingAnswerMs: number` (Vorgabe 60 000)

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben.**

In `rules/ruleset.test.ts` (Imports ergänzen, soweit sie fehlen):

```ts
  it('ergaenzt pendingAnswerMs in einem gespeicherten Regelwerk ohne dieses Feld', () => {
    const stored = { ...CLASSIC_RULES } as Record<string, unknown>;
    delete stored.pendingAnswerMs;

    expect(RuleSetSchema.parse(stored).pendingAnswerMs).toBe(60_000);
  });
```

In `playerTrade.test.ts`: den ganzen `describe('timeout', …)`-Block und die Imports
`applyTimeout`, `canTimeout` **entfernen** (sie ziehen nach `timeout.test.ts`), und im
`deadlineOf`-Block die Erwartung auf die neue Form bringen:

```ts
    expect(deadlineOf(state)).toEqual({ kind: 'at', at: expected, owner: 'p1' });
```

`packages/shared/src/game/timeout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { CITIES_RULES, CLASSIC_RULES } from '../rules/index.js';
import type { GameAction } from './actions.js';
import { deadlineOf, msUntil } from './deadline.js';
import { RuleViolationCode } from './errors.js';
import {
  ADJACENT_VERTEX,
  CENTER_EDGE,
  CENTER_VERTEX,
  FAR_VERTEX,
  HARBOR3_VERTEX,
  NEXT_EDGE,
  giving,
  hand,
  testGame,
} from './fixtures.js';
import type { PlayerId, PlayerState } from './player.js';
import { applyOfferTrade } from './playerTrade.js';
import { reduce } from './reducer.js';
import type { GameState, Knight } from './state.js';
import { applyTimeout, canTimeout } from './timeout.js';

/*
 * Ein Geschenk verfaellt, eine Pflicht wird abgenommen (Spec 5.5). Jeder Test
 * geht durch `reduce` mit dem Besitzer der Frist als `player` - so, wie der
 * Wecker im Server die Aktion einwirft.
 */

function patchPlayer(state: GameState, id: PlayerId, change: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === id ? { ...player, ...change } : player)),
  };
}

function playerNamed(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`playerNamed: ${id} sitzt nicht am Tisch`);
  return player;
}

function expire(state: GameState, owner: PlayerId): GameState {
  const action: GameAction = { type: 'timeout', player: owner, at: 0 };
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function tableWithOffer(): GameState {
  const result = applyOfferTrade(
    giving(testGame(), 'p1', { lumber: 3 }),
    'p1',
    hand({ lumber: 2 }),
    hand({ ore: 1 }),
    1_000,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('deadlineOf', () => {
  it('nennt fuer jede Wartephase die Antwortfrist und wem sie gehoert', () => {
    const cases: Array<[GameState['phase'], PlayerId]> = [
      [{ kind: 'discardPending', pending: ['p2', 'p3'], counts: {}, resume: 'seven' }, 'p2'],
      [{ kind: 'robberPending', resume: 'main' }, 'p1'],
      [
        {
          kind: 'displacePending',
          owner: 'p3',
          level: 1,
          active: false,
          activatedOnTurn: null,
          from: FAR_VERTEX,
        },
        'p3',
      ],
      [{ kind: 'progressDiscardPending', pending: ['p2'] }, 'p2'],
      [{ kind: 'defenderPending', pending: ['p3', 'p2'] }, 'p3'],
      [{ kind: 'aqueductPending', pending: ['p2'] }, 'p2'],
      [{ kind: 'progressPending', by: 'p1', pending: ['p3'], payload: { card: 'wedding' } }, 'p3'],
    ];

    for (const [phase, owner] of cases) {
      expect(deadlineOf(testGame({ phase }))).toEqual({
        kind: 'after',
        ms: CLASSIC_RULES.pendingAnswerMs,
        owner,
      });
    }
  });

  it('nennt nichts, wo niemand auf eine Antwort wartet', () => {
    expect(deadlineOf(testGame())).toBeNull();
    expect(deadlineOf(testGame({ phase: { kind: 'rollPending' } }))).toBeNull();
  });
});

describe('msUntil', () => {
  it('rechnet einen Zeitpunkt in die Restzeit um, nie negativ', () => {
    expect(msUntil({ kind: 'at', at: 5_000, owner: 'p1' }, 2_000)).toBe(3_000);
    expect(msUntil({ kind: 'at', at: 5_000, owner: 'p1' }, 9_000)).toBe(0);
  });

  it('nimmt eine Dauer, wie sie ist', () => {
    expect(msUntil({ kind: 'after', ms: 60_000, owner: 'p1' }, 9_000)).toBe(60_000);
  });
});

describe('timeout beim Angebot', () => {
  it('wird abgelehnt, solange die Frist laeuft', () => {
    expect(canTimeout(tableWithOffer(), 1_000)?.code).toBe(RuleViolationCode.DEADLINE_NOT_REACHED);
  });

  it('raeumt das Angebot ab, sobald die Frist um ist, und bewegt dabei nichts', () => {
    const state = tableWithOffer();
    const due = state.phase.kind === 'tradePending' ? state.phase.expiresAt : 0;

    const result = applyTimeout(state, due);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
    expect(playerNamed(result.state, 'p1').resources).toEqual(playerNamed(state, 'p1').resources);
  });

  it('wird ohne laufende Frist abgelehnt', () => {
    expect(canTimeout(testGame(), 0)?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });
});

describe('ein Geschenk verfaellt', () => {
  it('nimmt dem Vordersten am Aquaedukt die Wahl und laesst den Naechsten waehlen', () => {
    const state = testGame({ rules: CITIES_RULES, phase: { kind: 'aqueductPending', pending: ['p2', 'p3'] } });
    const after = expire(state, 'p2');

    expect(after.phase).toEqual({ kind: 'aqueductPending', pending: ['p3'] });
    expect(playerNamed(after, 'p2').resources).toEqual(hand());
  });

  it('schliesst das Aquaedukt, wenn der Letzte schweigt', () => {
    const state = testGame({ rules: CITIES_RULES, phase: { kind: 'aqueductPending', pending: ['p2'] } });
    expect(expire(state, 'p2').phase).toEqual({ kind: 'main' });
  });

  it('laesst den Vordersten der Stapelwahl ohne Karte und den Naechsten waehlen', () => {
    const state = testGame({
      rules: CITIES_RULES,
      phase: { kind: 'defenderPending', pending: ['p2', 'p3'] },
      progressDecks: { science: ['mining'], trade: ['merchant'], politics: ['bishop'] },
    });
    const after = expire(state, 'p2');

    expect(after.phase).toEqual({ kind: 'defenderPending', pending: ['p3'] });
    expect(playerNamed(after, 'p2').progressCards).toEqual([]);
  });

  it('laesst Spionage und Grosshaendler ohne Beute enden', () => {
    const spy = patchPlayer(
      testGame({
        rules: CITIES_RULES,
        phase: { kind: 'progressPending', by: 'p1', pending: ['p1'], payload: { card: 'spy', victim: 'p2' } },
      }),
      'p2',
      { progressCards: ['bishop'] },
    );
    const afterSpy = expire(spy, 'p1');
    expect(afterSpy.phase).toEqual({ kind: 'main' });
    expect(playerNamed(afterSpy, 'p2').progressCards).toEqual(['bishop']);

    const merchant = patchPlayer(
      testGame({
        rules: CITIES_RULES,
        phase: {
          kind: 'progressPending',
          by: 'p1',
          pending: ['p1'],
          payload: { card: 'masterMerchant', victim: 'p2' },
        },
      }),
      'p2',
      { resources: hand({ ore: 2 }) },
    );
    const afterMerchant = expire(merchant, 'p1');
    expect(afterMerchant.phase).toEqual({ kind: 'main' });
    expect(playerNamed(afterMerchant, 'p2').resources).toEqual(hand({ ore: 2 }));
  });

  it('laesst die zweite Runde des Deserteurs ohne Ersatzritter enden', () => {
    const state = testGame({
      rules: CITIES_RULES,
      roads: { [CENTER_EDGE]: 'p1' },
      phase: {
        kind: 'progressPending',
        by: 'p1',
        pending: ['p1'],
        payload: { card: 'deserter', victim: 'p2', replacement: { level: 1, active: false } },
      },
    });
    const after = expire(state, 'p1');

    expect(after.phase).toEqual({ kind: 'main' });
    expect(after.knights).toEqual({});
  });
});

describe('eine Pflicht wird abgenommen', () => {
  it('wirft fuer alle Uebrigen vom groessten Stapel abwaerts ab', () => {
    let state = testGame({
      phase: { kind: 'discardPending', pending: ['p2', 'p3'], counts: {}, resume: 'seven' },
    });
    state = patchPlayer(state, 'p2', { resources: hand({ ore: 5, wool: 3 }) });
    state = patchPlayer(state, 'p3', { resources: hand({ grain: 8 }) });

    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p2').resources).toEqual(hand({ ore: 2, wool: 2 }));
    expect(playerNamed(after, 'p3').resources).toEqual(hand({ grain: 4 }));
    expect(after.phase.kind).not.toBe('discardPending');
  });

  it('gibt die erste zaehlende Fortschrittskarte in fester Ordnung ab', () => {
    const state = patchPlayer(
      testGame({ rules: CITIES_RULES, phase: { kind: 'progressDiscardPending', pending: ['p2'] } }),
      'p2',
      { progressCards: ['warlord', 'crane', 'bishop', 'spy', 'mining'] },
    );
    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p2').progressCards).toEqual(['warlord', 'bishop', 'spy', 'mining']);
  });

  it('schickt den Raeuber auf die Wueste, wenn er dort nicht schon steht', () => {
    const state = testGame({ robber: '1,0', phase: { kind: 'robberPending', resume: 'main' } });
    const after = expire(state, 'p1');

    expect(after.robber).toBe('0,0');
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('schickt den Raeuber sonst auf das erste Feld ohne fremdes Bauwerk', () => {
    const state = testGame({
      phase: { kind: 'robberPending', resume: 'main' },
      buildings: { [CENTER_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false, metropolis: null } },
    });
    const after = expire(state, 'p1');

    // Die Wueste '0,0' ist besetzt; '1,-1' und '1,0' tragen p2s Siedlung.
    expect(after.robber).toBe('-1,0');
  });

  it('setzt den Vertriebenen auf die erste legale Kreuzung', () => {
    const state = testGame({
      rules: CITIES_RULES,
      roads: { [NEXT_EDGE]: 'p2' },
      phase: {
        kind: 'displacePending',
        owner: 'p2',
        level: 1,
        active: false,
        activatedOnTurn: null,
        from: FAR_VERTEX,
      },
    });
    const after = expire(state, 'p2');

    expect(after.knights[ADJACENT_VERTEX]?.owner).toBe('p2');
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('nimmt den Vertriebenen vom Brett, wenn es keine Kreuzung gibt', () => {
    const state = testGame({
      rules: CITIES_RULES,
      phase: {
        kind: 'displacePending',
        owner: 'p2',
        level: 1,
        active: false,
        activatedOnTurn: null,
        from: FAR_VERTEX,
      },
    });
    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p2').piecesLeft.knight1).toBe(
      playerNamed(state, 'p2').piecesLeft.knight1 + 1,
    );
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('laesst bei der Hochzeit alle Uebrigen ihre zwei haeufigsten Karten schenken', () => {
    let state = testGame({
      rules: CITIES_RULES,
      phase: { kind: 'progressPending', by: 'p1', pending: ['p2', 'p3'], payload: { card: 'wedding' } },
    });
    state = patchPlayer(state, 'p2', { resources: hand({ ore: 5, wool: 3 }) });
    state = patchPlayer(state, 'p3', { resources: hand({ grain: 1 }) });

    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ ore: 2, grain: 1 }));
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('laesst beim Handelshafen alle Uebrigen ihre haeufigste Handelsware geben', () => {
    let state = testGame({
      rules: CITIES_RULES,
      phase: {
        kind: 'progressPending',
        by: 'p1',
        pending: ['p2', 'p3'],
        payload: { card: 'tradeHarbor', resource: 'wool' },
      },
    });
    state = patchPlayer(state, 'p1', { resources: hand({ wool: 2 }) });
    state = patchPlayer(state, 'p2', { resources: hand({ paper: 1, cloth: 2 }) });
    state = patchPlayer(state, 'p3', { resources: hand({ coin: 1 }) });

    const after = expire(state, 'p2');

    expect(playerNamed(after, 'p1').resources).toEqual(hand({ cloth: 1, coin: 1 }));
    expect(after.phase).toEqual({ kind: 'main' });
  });

  it('laesst beim Deserteur den schwaechsten Ritter fallen und oeffnet Runde 2', () => {
    const strong: Knight = { owner: 'p2', level: 2, active: true, activatedOnTurn: 0, upgradedThisTurn: false };
    const simple: Knight = { owner: 'p2', level: 1, active: false, activatedOnTurn: null, upgradedThisTurn: false };
    const state = testGame({
      rules: CITIES_RULES,
      roads: { [CENTER_EDGE]: 'p1' },
      knights: { [FAR_VERTEX]: strong, [HARBOR3_VERTEX]: simple },
      phase: {
        kind: 'progressPending',
        by: 'p1',
        pending: ['p2'],
        payload: { card: 'deserter', victim: 'p2', replacement: null },
      },
    });
    const after = expire(state, 'p2');

    expect(after.knights[HARBOR3_VERTEX]).toBeUndefined();
    expect(after.knights[FAR_VERTEX]).toEqual(strong);
    // Runde 2 gehoert dem Spielenden und bekommt ihre eigene Frist.
    expect(after.phase).toMatchObject({ pending: ['p1'], payload: { replacement: { level: 1 } } });
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL (`timeout.js` fehlt, `deadlineOf` hat die alte
      Form, `pendingAnswerMs` fehlt).

- [ ] **Schritt 3: `pendingAnswerMs` ins Regelwerk.** In `rules/ruleset.ts` direkt unter
      `tradeOfferMs`:

```ts
  /**
   * Wie lange eine Wartephase auf eine Antwort wartet, in Millisekunden -
   * Abwerfen, Raeuber, Ausweichen, Stapelwahl, Aquaedukt, Abgeben und die
   * wartenden Fortschrittskarten (Spec 5.5).
   *
   * Eine Dauer und kein Zeitpunkt im Zustand: der Wecker rechnet `now + ms`
   * selbst, und keine gespeicherte Phase bekommt ein Pflichtfeld. Mit Vorgabe
   * aus demselben Grund wie `tradeOfferMs`.
   */
  pendingAnswerMs: z.number().int().min(1_000).default(60_000),
```

In `CLASSIC_RULES` (ebenda) und `CITIES_RULES` (`rules/cities.ts`) je unter `tradeOfferMs`:
`pendingAnswerMs: 60_000,`

- [ ] **Schritt 4: `deadline.ts` ersetzen**

```ts
import type { PlayerId } from './player.js';
import type { GameState } from './state.js';

/**
 * Die laufende Frist, wem sie gehoert und wie sie gemessen wird.
 *
 * Die eine Stelle, an der ausserhalb der Logik nachgesehen wird, ob gerade eine
 * Uhr laeuft. Der Wecker im Server und die lokale Uhr lesen nur diese Funktion.
 *
 * **Zwei Arten, und das ist Absicht (Spec 5.5).** Das Angebot hat einen
 * gespeicherten Zeitpunkt (`at`), weil ein Neustart seine Frist nicht
 * verlaengern darf. Jede andere Wartephase hat eine Dauer (`after`): der
 * Zeitpunkt steht nicht im Zustand, sonst braeuchte ein Dutzend Aktionen ein
 * `at` und jede gespeicherte Phase ein Pflichtfeld. Der Wecker stellt sich
 * nach jedem Zug neu - die Frist gilt also je Stand.
 *
 * `owner` ist, wem die Frist gehoert - er steht als `player` in der
 * `timeout`-Aktion und im Verlaufssatz. Wo der Reihe nach gehandelt wird, ist
 * es der Vorderste der Warteschlange; `actorFor` im Reducer verlangt genau ihn.
 */
export type Deadline =
  | { readonly kind: 'at'; readonly at: number; readonly owner: PlayerId }
  | { readonly kind: 'after'; readonly ms: number; readonly owner: PlayerId };

/**
 * Was `deadlineOf` liest. `GameState` und `PlayerView` haben es beide - der
 * Client zeigt damit denselben Countdown, den der Server vollstreckt.
 */
export interface DeadlineSource {
  readonly phase: GameState['phase'];
  readonly players: readonly { readonly id: PlayerId }[];
  readonly currentPlayerIndex: number;
  readonly rules: { readonly pendingAnswerMs: number };
}

export function deadlineOf(source: DeadlineSource): Deadline | null {
  const phase = source.phase;
  const after = (owner: PlayerId | undefined): Deadline | null =>
    owner === undefined ? null : { kind: 'after', ms: source.rules.pendingAnswerMs, owner };

  switch (phase.kind) {
    case 'tradePending':
      return { kind: 'at', at: phase.expiresAt, owner: phase.offer.from };
    case 'discardPending':
    case 'progressDiscardPending':
    case 'defenderPending':
    case 'aqueductPending':
    case 'progressPending':
      return after(phase.pending[0]);
    case 'robberPending':
      return after(source.players[source.currentPlayerIndex]?.id);
    case 'displacePending':
      return after(phase.owner);
    /*
     * Keine Frist fuer `main` und `rollPending`: eine Zugzeit betraefe jeden
     * Zug statt einer Wartephase und bleibt offener Punkt (Spec 5.5).
     */
    case 'opening':
    case 'setup':
    case 'rollPending':
    case 'main':
    case 'finished':
      return null;
  }
}

/** Wie lange der Wecker schlafen soll - eine abgelaufene Frist ist sofort faellig. */
export function msUntil(due: Deadline, now: number): number {
  return due.kind === 'at' ? Math.max(0, due.at - now) : due.ms;
}
```

- [ ] **Schritt 5: Die fünf automatischen Antworten der Karten.**

In `wedding.ts` (Imports `CARD_IDS` aus `../../../scenario/index.js`, `takeMostHeld` aus
`../../cards.js`):

```ts
/** Nach Fristablauf: die zwei haeufigsten Karten, bei Gleichstand in `CARD_IDS`-Ordnung. */
export function autoAnswerWedding(state: GameState, giver: PlayerId): WeddingAnswer {
  const held = findPlayer(state, giver)!.resources;
  return { card: 'wedding', gift: takeMostHeld(held, CARD_IDS, twoCardsOrAll(countCards(held))) };
}
```

In `tradeHarbor.ts` (Import `takeMostHeld` aus `../../cards.js`):

```ts
/** Nach Fristablauf: die haeufigste Handelsware, bei Gleichstand in `COMMODITY_IDS`-Ordnung. */
export function autoAnswerTradeHarbor(state: GameState, partner: PlayerId): TradeHarborAnswer {
  const taken = takeMostHeld(findPlayer(state, partner)!.resources, COMMODITY_IDS, 1);
  const commodity = COMMODITY_IDS.find((id) => taken[id] > 0) ?? COMMODITY_IDS[0];
  return { card: 'tradeHarbor', commodity };
}
```

In `deserter.ts`:

```ts
/**
 * Nach Fristablauf in Runde 1: der schwaechste Ritter faellt, bei Gleichstand
 * der auf der kleinsten Kreuzungs-Id. `null`, wenn keiner mehr steht.
 */
export function autoAnswerDeserter(state: GameState, victim: PlayerId): DeserterAnswer | null {
  const own = Object.entries(state.knights)
    .filter(([, knight]) => knight.owner === victim)
    .sort(([va, a], [vb, b]) => a.level - b.level || (va < vb ? -1 : va > vb ? 1 : 0));
  const weakest = own[0];
  return weakest === undefined ? null : { card: 'deserter', vertex: weakest[0] };
}
```

In `answerRules.ts` (Imports `autoAnswerWedding`, `autoAnswerTradeHarbor`,
`autoAnswerDeserter`, `type ProgressPendingPhase` aus `./pending.js`, `ok`):

```ts
/**
 * Die automatische Antwort fuer eine Person - `null` heisst: das Geschenk
 * verfaellt, die Karte endet ohne Wirkung.
 */
function autoAnswerFor(
  state: GameState,
  phase: ProgressPendingPhase,
  player: PlayerId,
): ProgressAnswer | null {
  const payload = phase.payload;
  switch (payload.card) {
    case 'wedding':
      return autoAnswerWedding(state, player);
    case 'tradeHarbor':
      return autoAnswerTradeHarbor(state, player);
    case 'spy':
    case 'masterMerchant':
      return null;
    case 'deserter':
      return payload.replacement === null ? autoAnswerDeserter(state, player) : null;
  }
}

/**
 * Der Fristablauf einer wartenden Karte.
 *
 * Beantwortet wird fuer **die, die beim Ablauf warteten** - nicht fuer die, die
 * dadurch erst an die Reihe kommen. Beim Deserteur oeffnet die Antwort des
 * Opfers Runde 2 beim Spielenden; der ist anwesend und bekommt seine eigene
 * Frist. Jede Antwort geht durch `applyAnswerProgress`, denselben Weg wie die
 * eines Menschen.
 */
export function autoAnswerProgress(state: GameState): ReduceResult {
  const phase = state.phase;
  if (phase.kind !== 'progressPending') {
    return rejected(
      violation(RuleViolationCode.NOT_ANSWERING_PROGRESS, 'Gerade wartet keine Fortschrittskarte'),
    );
  }

  let current = state;
  for (const player of phase.pending) {
    if (current.phase.kind !== 'progressPending' || !current.phase.pending.includes(player)) break;

    const answer = autoAnswerFor(current, current.phase, player);
    if (answer === null) return ok({ ...current, phase: { kind: 'main' } });

    const result = applyAnswerProgress(current, player, answer);
    if (!result.ok) return result;
    current = result.state;
  }
  return ok(current);
}
```

**Achtung Schleife:** beim Deserteur steht in `phase.pending` nur das Opfer. Nach seiner Antwort
wartet `current` auf den Spielenden, der nicht in `phase.pending` stand — die Schleife endet.

- [ ] **Schritt 6: `timeout.ts` schreiben**

```ts
import { CARD_IDS } from '../scenario/index.js';
import { boardOf } from './board.js';
import { takeMostHeld } from './cards.js';
import { deadlineOf } from './deadline.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { Phase } from './phase.js';
import type { PlayerId } from './player.js';
import { applyDiscard, applyMoveRobber, canPlaceRobberAt, discardCountFor, victimsAt } from './robber.js';
import {
  findPlayer,
  ok,
  rejected,
  withPlayer,
  type GameState,
  type KnightLevel,
  type ReduceResult,
} from './state.js';
import { applyPlaceDisplacedKnight, displacementTargets } from './cities/knightActions.js';
import { knightPiece } from './cities/knights.js';
import {
  applyDiscardProgressCard,
  continueAfterAqueduct,
  continueAfterDefender,
} from './cities/rollFlow.js';
import { autoAnswerProgress } from './cities/progress/answerRules.js';
import { PROGRESS_CARD_IDS, PROGRESS_VICTORY_CARDS } from './cities/progress/cards.js';
import { anyProgressCardsLeft } from './cities/progress/draw.js';
import { bankHasResource } from './yield.js';

/**
 * Der Fristablauf - ein Verteiler ueber die Phasen (Spec 5.5).
 *
 * Bis 10d-2 stand `applyTimeout` in `playerTrade.ts` und endete fest mit
 * `main`. Seit jede Wartephase eine Frist hat, ist es ein Verteiler: der Handel
 * behaelt seinen Zweig, jede andere Phase bekommt ihren.
 *
 * **Ein Geschenk verfaellt, eine Pflicht wird abgenommen.** Wer auf eine Gabe
 * wartet und schweigt, verzichtet; wer etwas schuldet, bekommt es
 * deterministisch abgenommen. Sonst waere Abwesenheit ein Zug. Jede
 * abgenommene Pflicht geht durch dieselbe `apply…` wie die eines Menschen.
 *
 * Wo der Reihe nach gehandelt wird, trifft der Ablauf **nur den Vordersten**:
 * wer hinter einem Abwesenden steht, hat seine Frist noch vor sich.
 */

export function canTimeout(state: GameState, at: number): RuleViolation | null {
  const due = deadlineOf(state);
  if (due === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Gerade läuft keine Frist');
  }

  /*
   * Pruefen laesst sich nur die gespeicherte Frist. Fuer eine Dauer steht der
   * Zeitpunkt nicht im Zustand - und das ist hier kein Loch: `timeout` kommt
   * ausschliesslich vom Server (`SYSTEM_ACTION_TYPES`), kein Client kann sie
   * schicken.
   */
  if (due.kind === 'at' && at < due.at) {
    return violation(RuleViolationCode.DEADLINE_NOT_REACHED, 'Die Frist läuft noch');
  }
  return null;
}

export function applyTimeout(state: GameState, at: number): ReduceResult {
  const problem = canTimeout(state, at);
  if (problem !== null) return rejected(problem);

  const phase = state.phase;
  switch (phase.kind) {
    case 'tradePending':
      return ok({ ...state, phase: { kind: 'main' } });

    case 'aqueductPending': {
      const rest = phase.pending.slice(1);
      return ok(
        rest.length > 0 && bankHasResource(state)
          ? { ...state, phase: { kind: 'aqueductPending', pending: rest } }
          : continueAfterAqueduct(state),
      );
    }

    case 'defenderPending': {
      const rest = phase.pending.slice(1);
      return ok(
        rest.length > 0 && anyProgressCardsLeft(state)
          ? { ...state, phase: { kind: 'defenderPending', pending: rest } }
          : continueAfterDefender(state),
      );
    }

    case 'discardPending':
      return discardForAll(state, phase.pending);

    case 'progressDiscardPending':
      return discardFirstCountingCard(state, phase.pending[0]!);

    case 'robberPending':
      return moveRobberForCurrent(state);

    case 'displacePending':
      return placeDisplaced(state, phase);

    case 'progressPending':
      return autoAnswerProgress(state);

    // `canTimeout` hat diese Phasen schon abgewiesen - der Zweig haelt `tsc` erschoepfend.
    case 'opening':
    case 'setup':
    case 'rollPending':
    case 'main':
    case 'finished':
      return rejected(violation(RuleViolationCode.WRONG_PHASE, 'Gerade läuft keine Frist'));
  }
}

/** Jeder, der noch abwerfen muss, wirft vom groessten Stapel abwaerts ab. */
function discardForAll(state: GameState, pending: readonly PlayerId[]): ReduceResult {
  let current = state;
  for (const player of pending) {
    const held = findPlayer(current, player)!.resources;
    const cards = takeMostHeld(held, CARD_IDS, discardCountFor(current, player));
    const result = applyDiscard(current, player, cards);
    if (!result.ok) return result;
    current = result.state;
  }
  return ok(current);
}

/** Die erste zaehlende Karte in `PROGRESS_CARD_IDS`-Ordnung geht zurueck. */
function discardFirstCountingCard(state: GameState, player: PlayerId): ReduceResult {
  const held = findPlayer(state, player)!.progressCards;
  const card = PROGRESS_CARD_IDS.find(
    (id) => held.includes(id) && !PROGRESS_VICTORY_CARDS.includes(id),
  );
  if (card === undefined) {
    return rejected(
      violation(RuleViolationCode.NOT_DISCARDING_PROGRESS, `${player} hat keine Karte zum Abgeben`),
    );
  }
  return applyDiscardProgressCard(state, player, card);
}

/**
 * Wueste, sonst das erste Feld ohne fremdes Bauwerk, sonst das erste legale -
 * je nach Feld-Id sortiert. Wer dort Karten hat, wird bestohlen wie sonst auch.
 */
function moveRobberForCurrent(state: GameState): ReduceResult {
  const player = state.players[state.currentPlayerIndex]!.id;
  const board = boardOf(state.scenario);

  const legal = [...board.hexes.keys()].filter((hex) => canPlaceRobberAt(state, hex) === null).sort();
  const desert = legal.filter((hex) => board.hexes.get(hex)?.terrain === 'desert');
  const harmless = legal.filter(
    (hex) =>
      !(board.topology.hexVertices.get(hex) ?? []).some((vertex) => {
        const building = state.buildings[vertex];
        return building !== undefined && building.owner !== player;
      }),
  );

  const hex = desert[0] ?? harmless[0] ?? legal[0];
  if (hex === undefined) {
    return rejected(violation(RuleViolationCode.ROBBER_LOCKED, 'Der Räuber findet kein Feld'));
  }
  return applyMoveRobber(state, player, hex, victimsAt(state, hex, player)[0] ?? null);
}

/** Die erste legale Kreuzung nach Id, sonst vom Brett in den Vorrat. */
function placeDisplaced(
  state: GameState,
  phase: Extract<Phase, { kind: 'displacePending' }>,
): ReduceResult {
  const [first] = displacementTargets(state, phase.owner, phase.from).sort();
  if (first !== undefined) return applyPlaceDisplacedKnight(state, phase.owner, first);

  const piece = knightPiece(phase.level as KnightLevel);
  return ok({
    ...state,
    players: withPlayer(state, phase.owner, (owner) => ({
      ...owner,
      piecesLeft: { ...owner.piecesLeft, [piece]: owner.piecesLeft[piece] + 1 },
    })),
    phase: { kind: 'main' },
  });
}
```

- [ ] **Schritt 7: Umhängen.**
  - `playerTrade.ts`: `canTimeout`, `applyTimeout` und den Import von `deadlineOf` löschen.
  - `reducer.ts`: `applyTimeout` aus dem `playerTrade.js`-Import nehmen, neu
    `import { applyTimeout } from './timeout.js';`. In `PHASE_ACTIONS` `'timeout'` ergänzen bei
    `discardPending`, `robberPending`, `progressDiscardPending`, `defenderPending`,
    `aqueductPending`, `progressPending` und `displacePending`, mit einem Kommentar über der
    Tabelle: „`timeout` steht bei jeder Wartephase (Spec 5.5) - der Wecker wirft es ein, und
    `actorFor` verlangt als `player` den Besitzer der Frist, den `deadlineOf` nennt."
  - `game/index.ts`: `export * from './timeout.js';`
  - Prüfen, dass `canTimeout` und `applyTimeout` sonst nirgends importiert werden:

```bash
grep -rn "applyTimeout\|canTimeout" packages apps --include=*.ts --include=*.tsx
```

Erwartet: nur `timeout.ts`, `timeout.test.ts`, `reducer.ts`.

- [ ] **Schritt 8: Tests laufen lassen** — `pnpm typecheck && pnpm -r test`. `tsc` meldet
      `apps/server/src/rooms/clock.ts` und `apps/client/src/game/useHotseatGame.ts` (sie lesen
      `due.at`) — beide kommen in Aufgabe 10. **Deshalb diese zwei Stellen hier schon minimal
      umstellen**: `Math.max(0, due.at - now())` → `msUntil(due, now())` bzw.
      `Math.max(0, due.at - Date.now())` → `msUntil(due, Date.now())`, `msUntil` importieren.
      Aufgabe 10 bringt die Tests dazu. Danach PASS.
- [ ] **Schritt 9: Committen**

```bash
git add packages/shared apps/server/src/rooms/clock.ts apps/client/src/game/useHotseatGame.ts
git commit -m "Fristen fuer alle Wartephasen: timeout.ts als Verteiler, deadlineOf mit Dauer"
```

---

## Aufgabe 10: Fristen für alle Wartephasen — die zwei Uhren

**Was entsteht:** Belege, dass der Wecker im Server und die lokale Uhr eine **Dauer** richtig
stellen und vollstrecken. Der Code ist seit Aufgabe 9 Schritt 8 umgestellt (`msUntil`); diese
Aufgabe bringt die Tests, die das absichern, und die Kommentare, die noch „Abwurffrist, Zugzeit
später" versprechen.

**Dateien:**

- Ändern: `apps/server/src/rooms/clock.ts` (Kommentar), `apps/client/src/game/useHotseatGame.ts`
  (Kommentar)
- Test: `apps/server/src/rooms/clock.test.ts`, `apps/client/src/game/hotseatClock.test.tsx`

**Interfaces:**

- Consumes: `deadlineOf`, `msUntil` (Aufgabe 9)

- [ ] **Schritt 1: Die Tests schreiben.** In `clock.test.ts` (Import `type GameState` steht
      schon da):

```ts
/** Registry mit einem Raum, in dem u2 nach einer Sieben acht Karten abwerfen muss. */
function registryWithDiscard(): RoomRegistry {
  const registry = new RoomRegistry({ randomCode: () => 'K7X2' });
  registry.create('u1', 'Anna', 3, 'wecker-probe', 10);

  const base = inMainPhase();
  const game = base.game!;
  const discarding: GameState = {
    ...game,
    phase: { kind: 'discardPending', pending: ['u2'], counts: {}, resume: 'seven' },
    players: game.players.map((player) =>
      player.id === 'u2' ? { ...player, resources: cardAmounts({ lumber: 8 }) } : player,
    ),
  };
  registry.update('K7X2', { ...base, game: discarding });
  return registry;
}

describe('createRoomClock in einer Wartephase', () => {
  it('stellt den Wecker auf die volle Antwortfrist', () => {
    const registry = registryWithDiscard();
    const { clock, schedule } = clockFor(registry, 123_456);

    clock.arm('K7X2');

    const total = registry.get('K7X2')!.game!.rules.pendingAnswerMs;
    expect(schedule.mock.calls[0]![1]).toBe(total);
  });

  it('nimmt beim Klingeln die Pflicht ab und stellt fuer die naechste Phase neu', () => {
    const registry = registryWithDiscard();
    const runs: (() => void)[] = [];
    const clock = createRoomClock({
      registry,
      sinks: new SinkHub(),
      now: () => 0,
      schedule: (run) => {
        runs.push(run);
        return 1 as unknown as NodeJS.Timeout;
      },
      cancel: () => undefined,
    });

    clock.arm('K7X2');
    runs[0]!();

    const game = registry.get('K7X2')!.game!;
    expect(game.players.find((player) => player.id === 'u2')!.resources.lumber).toBe(4);
    // Nach der Sieben kommt der Raeuber - mit eigener Frist, also ein zweiter Wecker.
    expect(game.phase.kind).toBe('robberPending');
    expect(runs).toHaveLength(2);
  });
});
```

In `hotseatClock.test.tsx`:

```tsx
function withDiscard(): GameState {
  const state = createGame(generateScenario(CLASSIC_34, 'uhr'), CLASSIC_RULES, ids, 'uhr');
  return {
    ...state,
    phase: { kind: 'discardPending', pending: [ids[1]!], counts: {}, resume: 'seven' },
    currentPlayerIndex: 0,
    players: state.players.map((player) =>
      player.id === ids[1]
        ? { ...player, resources: cardAmounts({ brick: 0, lumber: 8, wool: 0, grain: 0, ore: 0 }) }
        : player,
    ),
  };
}

describe('die lokale Uhr in einer Wartephase', () => {
  it('nimmt nach der Antwortfrist das Abwerfen ab', () => {
    vi.useFakeTimers();
    try {
      render(<Probe game={withDiscard()} />);
      expect(screen.getByTestId('phase').textContent).toBe('discardPending');

      act(() => {
        vi.advanceTimersByTime(CLASSIC_RULES.pendingAnswerMs + 1_000);
      });

      expect(screen.getByTestId('phase').textContent).toBe('robberPending');
    } finally {
      vi.useRealTimers();
    }
  });

  it('wartet vor Ablauf', () => {
    vi.useFakeTimers();
    try {
      render(<Probe game={withDiscard()} />);

      act(() => {
        vi.advanceTimersByTime(CLASSIC_RULES.pendingAnswerMs - 5_000);
      });

      expect(screen.getByTestId('phase').textContent).toBe('discardPending');
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — `pnpm -r test`. Erwartet: PASS, weil der Code seit
      Aufgabe 9 steht. **Gegenprobe**, damit die Tests nicht nur zufällig grün sind: in
      `clock.ts` `msUntil(due, now())` vorübergehend durch `0` ersetzen — „stellt den Wecker
      auf die volle Antwortfrist" muss rot werden. Zurückbauen, `git diff` auf `clock.ts` leer.
- [ ] **Schritt 3: Die Kommentare nachziehen.** In `clock.ts` steht im Kopf „Ein zweites
      Zeitlimit spaeter (Abwurffrist, Zugzeit) braucht hier keine Zeile" — ersetzen durch:
      „Seit 10d-2 hat jede Wartephase eine Frist, und hier hat sich dafuer genau eine Zeile
      geaendert (`msUntil`): `deadlineOf` ist die einzige Quelle. Eine Dauer beginnt mit jedem
      `arm` neu - die Frist gilt je Stand, nach jedem Zug." Den Kommentar an
      `Math.max(0, …)` („Eine beim Laden laengst abgelaufene Frist …") an `msUntil` anpassen:
      „Ein gespeicherter Zeitpunkt, der beim Laden laengst vorbei ist, ist sofort faellig -
      das rechnet `msUntil`." In `useHotseatGame.ts` den Satz „Fristen entstehen aus einem `at`"
      um „- oder sind eine Dauer, die mit jedem Stand neu beginnt (10d-2)" ergänzen.
- [ ] **Schritt 4: Committen**

```bash
git add apps/server/src/rooms apps/client/src/game
git commit -m "Beide Uhren vollstrecken die Antwortfrist der Wartephasen"
```

---

## Aufgabe 11: Der Verlauf

**Was entsteht:** Sätze für die fünf gespielten Karten, für jede Antwort und für den Ablauf
jeder Frist.

**Redaktionsgrenze** (derselbe Grundsatz wie beim Kauf einer Entwicklungskarte): der Verlauf ist
öffentlich. Genannt wird, **wer** wem **wie viele** Karten gibt; **welche**, nur wo es am Tisch
ohnehin offen liegt — beim Handelshafen ist es ein Tausch, dessen Rohstoff schon beim Ausspielen
genannt wurde. Das Opfer einer Karte ist öffentlich: es muss antworten oder wird aufgedeckt.

| Zug                                  | Satz                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| Spionage / Großhändler spielen       | `p1 spielt Spionage bei p2`                                      |
| Deserteur spielen                    | `p1 spielt Deserteur gegen p2`                                   |
| Handelshafen spielen                 | `p1 spielt Handelshafen und bietet Wolle`                        |
| Hochzeit spielen                     | `p1 spielt Hochzeit` (wie bisher)                                |
| Hochzeit beantworten                 | `p2 schenkt p1 zwei Karten`                                      |
| Handelshafen beantworten             | `p2 gibt p1 Tuch für Wolle`                                      |
| Spionage beantworten                 | `p1 nimmt p2 eine Fortschrittskarte`                             |
| Großhändler beantworten              | `p1 nimmt p2 zwei Karten`                                        |
| Deserteur Runde 1 / 2                | `p2 gibt einen Ritter auf` / `p1 stellt einen Überläufer auf`    |
| Frist beim Angebot                   | `Die Zeit für p1s Angebot ist abgelaufen` (wie bisher)           |
| Frist beim Abwerfen                  | `Die Zeit ist abgelaufen - p2 und p3 werfen von selbst ab`       |
| Frist beim Räuber                    | `Die Zeit ist abgelaufen - der Räuber zieht von selbst weiter`   |
| Frist beim Ausweichen                | `Die Zeit ist abgelaufen - p2s Ritter weicht von selbst aus`     |
| Frist beim Abgeben                   | `Die Zeit ist abgelaufen - p2 gibt von selbst eine Fortschrittskarte ab` |
| Frist bei der Stapelwahl             | `Die Zeit ist abgelaufen - p2 zieht keine Karte`                 |
| Frist am Aquädukt                    | `Die Zeit ist abgelaufen - p2 nimmt nichts aus dem Aquädukt`     |
| Frist bei einer wartenden Karte      | `Die Zeit für Hochzeit ist abgelaufen`                           |

**Dateien:**

- Ändern: `packages/shared/src/game/log.ts`
- Test: `packages/shared/src/game/log.test.ts`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben.** In `log.test.ts` (Import
      `type PlayerId`, `type PlayerState` aus `./player.js` ergänzen):

```ts
describe('Verlaufssaetze der wartenden Karten', () => {
  function patch(state: GameState, id: PlayerId, change: Partial<PlayerState>): GameState {
    return {
      ...state,
      players: state.players.map((player) => (player.id === id ? { ...player, ...change } : player)),
    };
  }

  function sentence(before: GameState, action: GameAction): string {
    return describeTransition(before, action, apply(before, action), testSeats);
  }

  const cities = (overrides: Partial<GameState> = {}): GameState =>
    testGame({ rules: CITIES_RULES, ...overrides });

  it('nennt das Opfer von Spionage und Deserteur', () => {
    const spy = patch(patch(cities(), 'p1', { progressCards: ['spy'] }), 'p2', {
      progressCards: ['bishop'],
    });
    expect(
      sentence(spy, { type: 'playProgress', player: 'p1', play: { card: 'spy', victim: 'p2' } }),
    ).toBe('p1 spielt Spionage bei p2');
  });

  it('nennt beim Handelshafen den angebotenen Rohstoff', () => {
    let state = patch(cities(), 'p1', { progressCards: ['tradeHarbor'], resources: hand({ wool: 1 }) });
    state = patch(state, 'p2', { resources: hand({ cloth: 1 }) });
    expect(
      sentence(state, {
        type: 'playProgress',
        player: 'p1',
        play: { card: 'tradeHarbor', resource: 'wool' },
      }),
    ).toBe('p1 spielt Handelshafen und bietet Wolle');
  });

  it('nennt beim Schenken die Anzahl und nicht die Karten', () => {
    const state = patch(
      cities({
        phase: { kind: 'progressPending', by: 'p1', pending: ['p2'], payload: { card: 'wedding' } },
      }),
      'p2',
      { resources: hand({ ore: 2 }) },
    );
    const text = sentence(state, {
      type: 'answerProgress',
      player: 'p2',
      answer: { card: 'wedding', gift: hand({ ore: 2 }) },
    });
    expect(text).toBe('p2 schenkt p1 zwei Karten');
    expect(text).not.toContain('Erz');
  });

  it('nennt beim Handelshafen den Tausch', () => {
    let state = cities({
      phase: {
        kind: 'progressPending',
        by: 'p1',
        pending: ['p2'],
        payload: { card: 'tradeHarbor', resource: 'wool' },
      },
    });
    state = patch(patch(state, 'p1', { resources: hand({ wool: 1 }) }), 'p2', {
      resources: hand({ cloth: 1 }),
    });
    expect(
      sentence(state, {
        type: 'answerProgress',
        player: 'p2',
        answer: { card: 'tradeHarbor', commodity: 'cloth' },
      }),
    ).toBe('p2 gibt p1 Tuch für Wolle');
  });

  it('verraet bei der Spionage nicht, welche Karte genommen wurde', () => {
    const state = patch(
      cities({
        phase: { kind: 'progressPending', by: 'p1', pending: ['p1'], payload: { card: 'spy', victim: 'p2' } },
      }),
      'p2',
      { progressCards: ['bishop'] },
    );
    expect(
      sentence(state, { type: 'answerProgress', player: 'p1', answer: { card: 'spy', take: 'bishop' } }),
    ).toBe('p1 nimmt p2 eine Fortschrittskarte');
  });

  it('sagt beim Abwerfen nach Fristablauf, wen es getroffen hat', () => {
    let state = testGame({
      phase: { kind: 'discardPending', pending: ['p2', 'p3'], counts: {}, resume: 'seven' },
    });
    state = patch(patch(state, 'p2', { resources: hand({ ore: 8 }) }), 'p3', {
      resources: hand({ grain: 8 }),
    });
    expect(sentence(state, { type: 'timeout', player: 'p2', at: 0 })).toBe(
      'Die Zeit ist abgelaufen - p2 und p3 werfen von selbst ab',
    );
  });

  it('nennt beim Fristablauf einer wartenden Karte die Karte', () => {
    const state = patch(
      cities({
        phase: { kind: 'progressPending', by: 'p1', pending: ['p2'], payload: { card: 'wedding' } },
      }),
      'p2',
      { resources: hand({ ore: 1 }) },
    );
    expect(sentence(state, { type: 'timeout', player: 'p2', at: 0 })).toBe(
      'Die Zeit für Hochzeit ist abgelaufen',
    );
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL.

- [ ] **Schritt 3: Die Sätze schreiben.** In `log.ts` (Import `type ProgressPlay` aus
      `./cities/progress/play.js`):
  - `case 'playProgress':` wird `return describeProgressPlay(action.play, who, nameOf);` und der
    Kommentar darüber: „Welche Wahl die Karte getroffen hat, steht nur, wo sie am Tisch ohnehin
    offen liegt: das Opfer einer Karte muss antworten oder wird aufgedeckt, der Rohstoff des
    Handelshafens wird allen angeboten. Feld, Ritter und Sorte der uebrigen Karten bleiben
    ungenannt."
  - `case 'answerProgress':` wird `return describeProgressAnswer(action, before, nameOf);`
  - `case 'timeout':` wird `return describeTimeout(before, nameOf);`
  - Am Dateiende:

```ts
/** "eine Karte", "zwei Karten", "3 Karten". */
function cardCount(count: number): string {
  if (count === 1) return 'eine Karte';
  if (count === 2) return 'zwei Karten';
  return `${count} Karten`;
}

function describeProgressPlay(
  play: ProgressPlay,
  who: string,
  nameOf: (id: PlayerId) => string,
): string {
  const card = PROGRESS_NAMES[play.card];
  switch (play.card) {
    case 'spy':
    case 'masterMerchant':
      return `${who} spielt ${card} bei ${nameOf(play.victim)}`;
    case 'deserter':
      return `${who} spielt ${card} gegen ${nameOf(play.victim)}`;
    case 'tradeHarbor':
      return `${who} spielt ${card} und bietet ${RESOURCE_LABELS[play.resource]}`;
    default:
      return `${who} spielt ${card}`;
  }
}

/**
 * Die Antwort auf eine wartende Karte - aus dem Zustand **vor** dem Zug, denn
 * danach ist die Phase oft schon zu.
 */
function describeProgressAnswer(
  action: Extract<GameAction, { type: 'answerProgress' }>,
  before: GameState,
  nameOf: (id: PlayerId) => string,
): string {
  const who = nameOf(action.player);
  if (before.phase.kind !== 'progressPending') return `${who} antwortet`;

  const by = nameOf(before.phase.by);
  const payload = before.phase.payload;
  const answer = action.answer;

  switch (answer.card) {
    case 'wedding':
      return `${who} schenkt ${by} ${cardCount(countCards(answer.gift))}`;
    case 'tradeHarbor':
      return payload.card === 'tradeHarbor'
        ? `${who} gibt ${by} ${CARD_LABELS[answer.commodity]} für ${RESOURCE_LABELS[payload.resource]}`
        : `${who} gibt ${by} ${CARD_LABELS[answer.commodity]}`;
    case 'spy':
      return payload.card === 'spy'
        ? `${who} nimmt ${nameOf(payload.victim)} eine Fortschrittskarte`
        : `${who} nimmt eine Fortschrittskarte`;
    case 'masterMerchant':
      return payload.card === 'masterMerchant'
        ? `${who} nimmt ${nameOf(payload.victim)} ${cardCount(countCards(answer.take))}`
        : `${who} nimmt ${cardCount(countCards(answer.take))}`;
    case 'deserter':
      return payload.card === 'deserter' && payload.replacement !== null
        ? `${who} stellt einen Überläufer auf`
        : `${who} gibt einen Ritter auf`;
  }
}

/**
 * Wessen Frist abgelaufen ist und was das bewirkt hat - aus der Phase **vor**
 * dem Ablauf. Die automatische Wahl selbst bleibt ungenannt, aus demselben
 * Grund wie bei jeder Antwort von Hand.
 */
function describeTimeout(before: GameState, nameOf: (id: PlayerId) => string): string {
  const phase = before.phase;
  switch (phase.kind) {
    case 'tradePending':
      return `Die Zeit für ${nameOf(phase.offer.from)}s Angebot ist abgelaufen`;
    case 'discardPending': {
      const names = phase.pending.map(nameOf);
      const verb = names.length === 1 ? 'wirft' : 'werfen';
      return `Die Zeit ist abgelaufen - ${nameList(names)} ${verb} von selbst ab`;
    }
    case 'robberPending':
      return 'Die Zeit ist abgelaufen - der Räuber zieht von selbst weiter';
    case 'displacePending':
      return `Die Zeit ist abgelaufen - ${nameOf(phase.owner)}s Ritter weicht von selbst aus`;
    case 'progressDiscardPending':
      return `Die Zeit ist abgelaufen - ${nameOf(phase.pending[0] ?? '')} gibt von selbst eine Fortschrittskarte ab`;
    case 'defenderPending':
      return `Die Zeit ist abgelaufen - ${nameOf(phase.pending[0] ?? '')} zieht keine Karte`;
    case 'aqueductPending':
      return `Die Zeit ist abgelaufen - ${nameOf(phase.pending[0] ?? '')} nimmt nichts aus dem Aquädukt`;
    case 'progressPending':
      return `Die Zeit für ${PROGRESS_NAMES[phase.payload.card]} ist abgelaufen`;
    case 'opening':
    case 'setup':
    case 'rollPending':
    case 'main':
    case 'finished':
      return 'Die Zeit ist abgelaufen';
  }
}
```

- [ ] **Schritt 4: Tests laufen lassen** — PASS, auch der bestehende Satz zum abgelaufenen
      Angebot.
- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src/game/log.ts packages/shared/src/game/log.test.ts
git commit -m "Verlauf: die wartenden Karten, ihre Antworten und jeder Fristablauf"
```

---

## Aufgabe 12: Bildschirm I — wer handelt, was dasteht, wie lange noch

**Was entsteht:** `actingPlayers` und der Phasensatz kennen `progressPending`; der Countdown aus
dem Angebotsdialog wird **ein** Haken (`useCountdown`), den jetzt zwei Stellen lesen — der
Angebotsdialog und eine neue **Wartezeile** unter dem Status. Spec: „den Countdown gibt es beim
Angebot schon, er bekommt eine zweite Fundstelle und keine zweite Umsetzung."

**Entwurf in drei Sätzen (Designregel 1):** Die Wartezeile ist Auskunft und kein Bedienelement —
Schrift auf dem Tisch, unter dem Satz, der sagt, **auf wen** gewartet wird. Sie steht in derselben
gedämpften Tinte wie „Runde N" darüber, mit Tabellenziffern, damit die Zahl beim Herunterzählen
nicht springt. Das eine Element, das man sich merkt, ist die Zahl — nicht ein Balken, nicht eine
Farbe.

**Dateien:**

- Neu: `apps/client/src/game/useCountdown.ts`, `apps/client/src/panels/WaitingClock.tsx`
- Ändern: `game/view.ts`, `panels/StatusPanel.tsx`, `dialogs/TradeOfferDialog.tsx`,
  `screens/GameScreen.tsx`, `index.css`
- Test: `game/useCountdown.test.tsx` (**neu**), `panels/WaitingClock.test.tsx` (**neu**),
  `game/view.test.ts`

**Interfaces:**

- Consumes: `deadlineOf`, `type Deadline` (Aufgabe 9), `progressPending` (Aufgabe 1)
- Produces: `secondsLeft(due: Deadline, arrivedAt: number, now: number, clockOffset: number): number`,
  `useCountdown(view: PlayerView, clockOffset: number): number | null`,
  `WaitingClock({ view, clockOffset })`, `StatusPanel` mit optionalem `children`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben.**

In `view.test.ts` (Import `playerViewOf` aus `@conquerist/shared` ergänzen, falls er fehlt):

```ts
describe('Eine wartende Fortschrittskarte im Anzeigemodell', () => {
  const source = (phase: unknown) => ({
    phase,
    players: ids.map((id) => ({ id })),
    currentPlayerIndex: 0,
  });

  it('laesst alle Wartenden gleichzeitig handeln', () => {
    const state = source({
      kind: 'progressPending',
      by: ids[0],
      pending: [ids[1], ids[2]],
      payload: { card: 'wedding' },
    });
    expect(actingPlayers(state as never)).toEqual([ids[1], ids[2]]);
  });

  it('sagt bei der Spionage, wer bei wem hinsieht', () => {
    const state = afterSetup();
    const phase = {
      kind: 'progressPending' as const,
      by: ids[0]!,
      pending: [ids[0]!],
      payload: { card: 'spy' as const, victim: ids[1]! },
    };
    const view = gameViewOf(playerViewOf({ ...state, phase }, ids[0]!, seats, 1));

    expect(view.phaseText).toBe('Spionage: Spieler 1 sieht sich Spieler 2s Fortschrittskarten an');
  });

  it('unterscheidet beim Deserteur die beiden Runden', () => {
    const state = afterSetup();
    const round = (replacement: { level: 1; active: boolean } | null) => ({
      kind: 'progressPending' as const,
      by: ids[0]!,
      pending: [replacement === null ? ids[1]! : ids[0]!],
      payload: { card: 'deserter' as const, victim: ids[1]!, replacement },
    });

    expect(gameViewOf(playerViewOf({ ...state, phase: round(null) }, ids[1]!, seats, 1)).phaseText).toBe(
      'Deserteur: Spieler 2 gibt einen Ritter auf',
    );
    expect(
      gameViewOf(playerViewOf({ ...state, phase: round({ level: 1, active: false }) }, ids[0]!, seats, 1))
        .phaseText,
    ).toBe('Deserteur: Spieler 1 stellt den Überläufer auf');
  });
});
```

`apps/client/src/game/useCountdown.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import type { PlayerView } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { secondsLeft, useCountdown } from './useCountdown';

/** So viel Sicht, wie `deadlineOf` liest. */
function waitingView(version: number): PlayerView {
  return {
    version,
    phase: { kind: 'discardPending', pending: ['p2'], counts: {}, resume: 'seven' },
    players: [{ id: 'p1' }, { id: 'p2' }],
    currentPlayerIndex: 0,
    rules: { pendingAnswerMs: 60_000 },
  } as never;
}

function Probe({ view }: { readonly view: PlayerView }) {
  return <span data-testid="left">{String(useCountdown(view, 0))}</span>;
}

describe('secondsLeft', () => {
  it('rechnet einen Zeitpunkt gegen die Serveruhr', () => {
    expect(secondsLeft({ kind: 'at', at: 10_000, owner: 'p1' }, 0, 4_000, 1_000)).toBe(5);
  });

  it('rechnet eine Dauer ab der Ankunft des Standes und nie negativ', () => {
    expect(secondsLeft({ kind: 'after', ms: 60_000, owner: 'p1' }, 1_000, 31_000, 0)).toBe(30);
    expect(secondsLeft({ kind: 'after', ms: 60_000, owner: 'p1' }, 0, 90_000, 0)).toBe(0);
  });
});

describe('useCountdown', () => {
  it('zählt die Antwortfrist herunter und beginnt mit jedem neuen Stand von vorn', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Probe view={waitingView(1)} />);
      expect(screen.getByTestId('left').textContent).toBe('60');

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.getByTestId('left').textContent).toBe('50');

      act(() => {
        rerender(<Probe view={waitingView(2)} />);
      });
      expect(screen.getByTestId('left').textContent).toBe('60');
    } finally {
      vi.useRealTimers();
    }
  });

  it('meldet null, wenn keine Frist läuft', () => {
    render(<Probe view={{ ...waitingView(1), phase: { kind: 'main' } } as never} />);
    expect(screen.getByTestId('left').textContent).toBe('null');
  });
});
```

`apps/client/src/panels/WaitingClock.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { WaitingClock } from './WaitingClock';

function viewIn(phase: unknown): PlayerView {
  return {
    version: 1,
    phase,
    players: [{ id: 'p1' }, { id: 'p2' }],
    currentPlayerIndex: 0,
    rules: { pendingAnswerMs: 60_000 },
  } as never;
}

describe('WaitingClock', () => {
  it('zeigt in einer Wartephase die Restzeit', () => {
    render(
      <WaitingClock
        view={viewIn({ kind: 'aqueductPending', pending: ['p2'] })}
        clockOffset={0}
      />,
    );
    expect(screen.getByTestId('waiting-clock').textContent).toBe('Noch 60 Sekunden');
  });

  it('schweigt in der Hauptphase', () => {
    render(<WaitingClock view={viewIn({ kind: 'main' })} clockOffset={0} />);
    expect(screen.queryByTestId('waiting-clock')).toBeNull();
  });

  /* Beim Angebot steht die Uhr im Dialog - zweimal dieselbe Zahl wäre eine Verdopplung. */
  it('schweigt beim Angebot', () => {
    const offer = {
      kind: 'tradePending',
      offer: { from: 'p1', give: {}, want: {} },
      responses: {},
      expiresAt: Date.now() + 30_000,
    };
    render(<WaitingClock view={viewIn(offer)} clockOffset={0} />);
    expect(screen.queryByTestId('waiting-clock')).toBeNull();
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL.

- [ ] **Schritt 3: `view.ts`.** In `actingPlayers` vor `tradePending`:

```ts
    /*
     * Eine wartende Fortschrittskarte: alle, die noch antworten müssen, und
     * gleichzeitig wie beim Abwerfen. Lokal wandert der Bildschirm damit von
     * selbst durch die Warteliste.
     */
    case 'progressPending':
      return view.phase.pending;
```

Den vorläufigen `progressPending`-Zweig in `phaseTextOf` (Aufgabe 1) **ersetzen** und den dort
ergänzten Import `PROGRESS_NAMES` wieder entfernen:

```ts
    case 'progressPending': {
      const phase = view.phase;
      const by = nameOf(phase.by);
      const waiting = phase.pending.map((id) => nameOf(id));
      const payload = phase.payload;

      switch (payload.card) {
        case 'wedding':
          return `Hochzeit: ${nameList(waiting)} ${waiting.length === 1 ? 'schenkt' : 'schenken'} ${by} Karten`;
        case 'tradeHarbor':
          return `Handelshafen: ${nameList(waiting)} ${waiting.length === 1 ? 'wählt' : 'wählen'} eine Handelsware`;
        case 'spy':
          return `Spionage: ${by} sieht sich ${nameOf(payload.victim)}s Fortschrittskarten an`;
        case 'masterMerchant':
          return `Großhändler: ${by} sieht sich ${nameOf(payload.victim)}s Handkarten an`;
        case 'deserter':
          return payload.replacement === null
            ? `Deserteur: ${nameOf(payload.victim)} gibt einen Ritter auf`
            : `Deserteur: ${by} stellt den Überläufer auf`;
      }
    }
```

- [ ] **Schritt 4: `useCountdown.ts` schreiben**

```ts
import { useEffect, useState } from 'react';
import { deadlineOf, type Deadline, type PlayerView } from '@conquerist/shared';

/**
 * Wie viele Sekunden eine Frist noch hat - nie negativ.
 *
 * Ein gespeicherter Zeitpunkt (das Angebot) wird gegen die Serveruhr gerechnet,
 * also mit Versatz. Eine Dauer (jede andere Wartephase) wird gegen den Moment
 * gerechnet, in dem dieser Stand ankam: der Wecker im Server stellt sich nach
 * jedem Zug neu, und derselbe Zug bringt den neuen Stand. Beide Uhren sind
 * dabei die eigene - der Versatz spielt keine Rolle.
 */
export function secondsLeft(
  due: Deadline,
  arrivedAt: number,
  now: number,
  clockOffset: number,
): number {
  const ms = due.kind === 'at' ? due.at - (now + clockOffset) : arrivedAt + due.ms - now;
  return Math.max(0, Math.ceil(ms / 1000));
}

/**
 * Der eine Countdown für jede Frist - `null`, wenn keine läuft.
 *
 * Er stand bis 10d-2 im Angebotsdialog. Seit jede Wartephase eine Frist hat,
 * liest ihn auch die Wartezeile - eine zweite Fundstelle, keine zweite
 * Umsetzung. Welche Frist läuft, sagt `deadlineOf` aus `shared`, dieselbe
 * Funktion, die der Server vollstreckt.
 */
export function useCountdown(view: PlayerView, clockOffset: number): number | null {
  const [arrival, setArrival] = useState(() => ({ version: view.version, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());

  /*
   * Ein neuer Stand setzt die Dauer zurück - während des Renderns und nicht
   * in einem Effekt: sonst zeigte das erste Bild nach dem Zug noch die alte
   * Restzeit. Dieselbe Mechanik wie `answeredOffer` im Angebotsdialog.
   */
  if (arrival.version !== view.version) {
    setArrival({ version: view.version, at: Date.now() });
  }

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  const due = deadlineOf(view);
  if (due === null) return null;
  return secondsLeft(due, arrival.at, Math.max(now, arrival.at), clockOffset);
}
```

- [ ] **Schritt 5: `WaitingClock.tsx` schreiben**

```tsx
import type { JSX } from 'react';
import type { PlayerView } from '@conquerist/shared';
import { useCountdown } from '../game/useCountdown';

/**
 * Wie lange der Tisch noch wartet - eine Zeile unter dem Status.
 *
 * **Auf wen** gewartet wird, sagt der Satz darüber (`phaseText`); hier steht
 * nur die Zeit. Ist sie um, nimmt der Server die Pflicht ab oder lässt das
 * Geschenk verfallen, und der Verlauf sagt, was geschehen ist.
 *
 * Beim Angebot schweigt die Zeile: dort steht die Uhr im Dialog, unter den
 * Bedingungen, über die entschieden wird.
 */
export function WaitingClock({
  view,
  clockOffset,
}: {
  readonly view: PlayerView;
  readonly clockOffset: number;
}): JSX.Element | null {
  const left = useCountdown(view, clockOffset);
  if (left === null || view.phase.kind === 'tradePending') return null;

  return (
    <p className="status__clock" role="timer" data-testid="waiting-clock">
      Noch <b>{left}</b> Sekunden
    </p>
  );
}
```

- [ ] **Schritt 6: Einhängen.**
  - `StatusPanel.tsx`: Signatur
    `export function StatusPanel({ view, children }: { readonly view: GameView; readonly children?: ReactNode }): JSX.Element`
    (Import `type ReactNode` aus `react`), `{children}` direkt nach `status__turn`.
  - `GameScreen.tsx`, `.topline`: `<StatusPanel view={display} />` wird

```tsx
        <StatusPanel view={display}>
          <WaitingClock view={view} clockOffset={clockOffset} />
        </StatusPanel>
```

  - `TradeOfferDialog.tsx`: die Funktion `secondsLeft`, `const [left, setLeft] = useState(…)`
    und den `useEffect` mit `setInterval` **löschen**; an ihre Stelle (vor dem ersten `return`)
    `const left = useCountdown(view, clockOffset) ?? 0;` mit Import aus `../game/useCountdown`.
    `useEffect` aus dem React-Import nehmen, falls unbenutzt.
  - `index.css`, direkt nach `.status__turn`:

```css
/*
 * Die Restzeit einer Wartephase, unter dem Status. Derselbe Grund und dieselbe
 * gedämpfte Tinte wie „Runde N“ darüber - ein zweiter Grund hieße ein zweiter
 * Kontrastwert, und der wird im Browser-Durchgang gemessen (Aufgabe 16).
 * Tabellenziffern, weil die Zahl jede Sekunde wechselt.
 */
.status__clock {
  margin: 0;
  color: var(--ink-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Schritt 7: Tests laufen lassen** — `pnpm typecheck && pnpm -r test`. PASS, **auch
      `tradeOffer.test.tsx`** mit seinen Tests auf `offer-clock`: der Dialog zeigt dieselbe Zahl
      aus dem neuen Haken.
- [ ] **Schritt 8: Committen**

```bash
git add apps/client/src
git commit -m "Ein Countdown fuer jede Frist: Wartezeile unter dem Status, Angebot auf demselben Haken"
```

---

## Aufgabe 13: Bildschirm II — die fünf Karten ausspielen

**Was entsteht:** Die Hochzeit spielt mit einem Klick, der Handelshafen fragt nach dem Rohstoff,
Spionage, Großhändler und Deserteur fragen nach einer **Person**. Die Personenwahl ist das erste
Mal in diesem Spiel, dass ein Dialog eine Person erfragt statt eines Felds, einer Kreuzung oder
einer Karte; sie trägt Name, Farbe und Punktestand, weil beim Großhändler „mehr Punkte" die
Bedingung ist. **Welche** Personen und Rohstoffe angeboten werden, steht in der Aktionsliste
(`legalActions`, Aufgaben 4–7) — der Client rechnet keine Regel nach.

**Entwurf in drei Sätzen:** Die Personenwahl ist ein Pergamentdialog wie die Opferwahl beim
Räuber, eine Zeile je Person. Jede Zeile trägt die Spielerfarbe als Kante **und** den Namen **und**
den Punktestand (Designregel 7). Das eine Element ist der Punktestand neben dem Namen: er ist die
Auskunft, nach der beim Großhändler entschieden wird.

**Dateien:**

- Neu: `apps/client/src/dialogs/PersonPickDialog.tsx`
- Ändern: `panels/ProgressPanel.tsx`, `screens/GameScreen.tsx`
- Test: `dialogs/PersonPickDialog.test.tsx` (**neu**), `panels/ProgressPanel.test.tsx`

**Interfaces:**

- Consumes: `playProgress`-Aktionen mit `victim` bzw. `resource` aus `legalActions`
- Produces: `interface PersonOption { id: PlayerId; name: string; color: string; victoryPoints: number }`,
  `PersonPickDialog({ title, hint, people, onChoose, onClose })`,
  `ProgressPanel` mit neuem optionalem Prop `actions?: readonly GameAction[]`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben.**

`apps/client/src/dialogs/PersonPickDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { PersonPickDialog } from './PersonPickDialog';

const people = [
  { id: 'p2', name: 'Ben', color: 'rgb(0, 0, 255)', victoryPoints: 5 },
  { id: 'p3', name: 'Cem', color: 'rgb(0, 128, 0)', victoryPoints: 1 },
];

describe('PersonPickDialog', () => {
  it('nennt jede Person mit Namen und Punktestand', () => {
    render(
      <PersonPickDialog title="Spionage: bei wem?" hint="" people={people} onChoose={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Ben · 5 Siegpunkte' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cem · 1 Siegpunkt' })).toBeDefined();
  });

  it('meldet die gewählte Person', async () => {
    const onChoose = vi.fn();
    render(
      <PersonPickDialog title="Spionage: bei wem?" hint="" people={people} onChoose={onChoose} onClose={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Ben/ }));

    expect(onChoose).toHaveBeenCalledWith('p2');
  });

  it('lässt sich abbrechen', async () => {
    const onClose = vi.fn();
    render(
      <PersonPickDialog title="Spionage: bei wem?" hint="" people={people} onChoose={vi.fn()} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).toHaveBeenCalled();
  });
});
```

In `ProgressPanel.test.tsx` (Imports `within` aus `../test/dom`, `type GameAction` aus
`@conquerist/shared` ergänzen):

```tsx
/** Wie `baseView`, aber mit dem, was die Personenwahl liest: Farbe und Punkte. */
function personView(hand: readonly ProgressCardId[]): PlayerView {
  return baseView({
    players: [
      { id: 'p1', name: 'Spieler 1', color: 'red', victoryPoints: 3, progressCards: hand } as never,
      { id: 'p2', name: 'Spieler 2', color: 'blue', victoryPoints: 5, progressCards: null } as never,
      { id: 'p3', name: 'Spieler 3', color: 'green', victoryPoints: 2, progressCards: null } as never,
    ],
  });
}

describe('Die fünf wartenden Karten am Panel', () => {
  it('spielt die Hochzeit mit einem Klick', async () => {
    const onAction = vi.fn();
    render(<ProgressPanel view={withHandView(['wedding'])} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: /Hochzeit/ }));

    expect(onAction).toHaveBeenCalledWith({
      type: 'playProgress',
      player: 'p1',
      play: { card: 'wedding' },
    });
  });

  it('bietet beim Handelshafen nur die Rohstoffe aus der Aktionsliste an', async () => {
    const onAction = vi.fn();
    const actions: GameAction[] = [
      { type: 'playProgress', player: 'p1', play: { card: 'tradeHarbor', resource: 'wool' } },
    ];
    render(
      <ProgressPanel view={withHandView(['tradeHarbor'])} actions={actions} onAction={onAction} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Handelshafen/ }));
    expect(screen.queryByTestId('pick-ore')).toBeNull();
    await userEvent.click(screen.getByTestId('pick-wool'));
    await userEvent.click(screen.getByRole('button', { name: 'Karte spielen' }));

    expect(onAction).toHaveBeenCalledWith(actions[0]);
  });

  it('fragt bei der Spionage nach der Person, nur unter den erlaubten Zielen', async () => {
    const onAction = vi.fn();
    const actions: GameAction[] = [
      { type: 'playProgress', player: 'p1', play: { card: 'spy', victim: 'p2' } },
    ];
    render(<ProgressPanel view={personView(['spy'])} actions={actions} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: /Spionage/ }));
    const dialog = screen.getByRole('dialog', { name: /Spionage/ });
    expect(within(dialog).queryByRole('button', { name: /Spieler 3/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: /Spieler 2/ }));

    expect(onAction).toHaveBeenCalledWith(actions[0]);
  });

  /*
   * Ein Knopf, der eine leere Wahl öffnet, verspricht eine Wirkung, die es
   * nicht gibt (CLAUDE.md, „Ein Bedienelement lügt in beide Richtungen").
   */
  it('sperrt eine Personenkarte, zu der es kein erlaubtes Ziel gibt', () => {
    render(<ProgressPanel view={personView(['masterMerchant'])} actions={[]} />);

    expect(
      (screen.getByRole('button', { name: /Großhändler/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL.

- [ ] **Schritt 3: `PersonPickDialog.tsx` schreiben**

```tsx
import type { JSX } from 'react';
import type { PlayerId } from '@conquerist/shared';
import { CloseButton } from './CloseButton';

/** Eine Person, wie die Wahl sie zeigt. */
export interface PersonOption {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly victoryPoints: number;
}

export interface PersonPickDialogProps {
  readonly title: string;
  readonly hint: string;
  /** Nur die erlaubten Ziele - sie kommen aus der Aktionsliste, nicht aus einer Rechnung hier. */
  readonly people: readonly PersonOption[];
  readonly onChoose: (id: PlayerId) => void;
  readonly onClose: () => void;
}

/**
 * Wen eine Karte trifft - Spionage, Großhändler, Deserteur.
 *
 * Das erste Mal, dass ein Dialog eine **Person** erfragt. Dieselbe Form wie die
 * Opferwahl beim Räuber (`VictimDialog`), aber mit Punktestand statt
 * Kartenzahl: beim Großhändler ist „mehr Siegpunkte" die Bedingung, und wer
 * wählt, soll sehen, warum genau diese Personen dastehen.
 *
 * Die Spielerfarbe steht als Kante und nie allein - Name und Punkte stehen
 * daneben (Designregel 7). Abbrechen geht: gespielt ist noch nichts.
 */
export function PersonPickDialog({
  title,
  hint,
  people,
  onChoose,
  onClose,
}: PersonPickDialogProps): JSX.Element {
  return (
    <div className="modal" role="dialog" aria-label={title}>
      <div className="modal__box">
        <CloseButton onClose={onClose} label={title} />
        <h2>{title}</h2>
        <p className="modal__hint">{hint}</p>

        <div className="pick">
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className="button"
              style={{ borderLeftColor: person.color, borderLeftWidth: '4px' }}
              onClick={() => onChoose(person.id)}
            >
              {person.name} · {person.victoryPoints}{' '}
              {person.victoryPoints === 1 ? 'Siegpunkt' : 'Siegpunkte'}
            </button>
          ))}
        </div>

        <div className="modal__buttons">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Schritt 4: `ProgressPanel.tsx` erweitern.**
  - Typen:

```ts
type DialogCard =
  'alchemist' | 'crane' | 'resourceMonopoly' | 'commodityMonopoly' | 'merchantFleet' | 'tradeHarbor';

/** Die drei Karten, die eine Person als Ziel brauchen. */
type PersonCard = 'spy' | 'masterMerchant' | 'deserter';

type CardCategory =
  | { readonly kind: 'direct' }
  | { readonly kind: 'dialog'; readonly card: DialogCard }
  | { readonly kind: 'board'; readonly card: BoardCard }
  | { readonly kind: 'person'; readonly card: PersonCard }
  | { readonly kind: 'inert' };

const PERSON_TEXTS: Readonly<Record<PersonCard, { readonly title: string; readonly hint: string }>> = {
  spy: {
    title: 'Spionage: bei wem?',
    hint: 'Du siehst die Fortschrittskarten dieser Person und nimmst eine davon.',
  },
  masterMerchant: {
    title: 'Großhändler: bei wem?',
    hint: 'Nur wer mehr Siegpunkte hat. Du siehst die Handkarten und nimmst zwei.',
  },
  deserter: {
    title: 'Deserteur: gegen wen?',
    hint: 'Die Person gibt einen Ritter auf, und du stellst einen gleichwertigen auf.',
  },
};
```

  - `categoryOf`: `'wedding'` zu den `direct`-Fällen, `'tradeHarbor'` zu den `dialog`-Fällen,
    ein neuer Block `case 'spy': case 'masterMerchant': case 'deserter': return { kind: 'person', card };`,
    `inert` nur noch `'printer'` und `'constitution'`. Den Kommentar über `categoryOf` so
    anpassen, dass `inert` nur noch Buchdruck und Verfassung meint (die liegen nie auf der Hand).
  - Props: `readonly actions?: readonly GameAction[];` mit Kommentar „Die erlaubten Züge - aus
    ihnen liest das Panel, welche Personen und Rohstoffe es anbietet.", Destrukturierung
    `actions = []`.
  - Neben den bestehenden `useState`:
    `const [personFor, setPersonFor] = useState<PersonCard | null>(null);`
  - Nach dem frühen `return null`:

```ts
  /** Die erlaubten Ausspielzüge einer Karte - aus der Aktionsliste, nie aus einer eigenen Rechnung. */
  const playsOf = (card: ProgressCardId) =>
    actions.flatMap((action) =>
      action.type === 'playProgress' && action.play.card === card ? [action.play] : [],
    );

  const peopleFor = (card: PersonCard): PersonOption[] =>
    playsOf(card).flatMap((payload) => {
      if (!('victim' in payload)) return [];
      const person = view.players.find((player) => player.id === payload.victim);
      return person === undefined
        ? []
        : [{ id: person.id, name: person.name, color: person.color, victoryPoints: person.victoryPoints }];
    });

  const tradeHarborPool = RESOURCE_IDS.filter((resource) =>
    playsOf('tradeHarbor').some((payload) => 'resource' in payload && payload.resource === resource),
  );

  /** Eine Karte mit Person spielen - je Karte ein Zweig, damit `tsc` die Union trifft. */
  const playOn = (card: PersonCard, victim: string): ProgressPlay => {
    switch (card) {
      case 'spy':
        return { card, victim };
      case 'masterMerchant':
        return { card, victim };
      case 'deserter':
        return { card, victim };
    }
  };
```

    (Import `PersonOption`, `PersonPickDialog` aus `../dialogs/PersonPickDialog`.)
  - `onCardClick`: `case 'person': setPersonFor(category.card); return;`
  - `isClickable`:

```ts
  const isClickable = (card: ProgressCardId): boolean => {
    const category = categoryOf(card);
    if (category.kind === 'inert') return false;
    /*
     * Personenwahl und Handelshafen bieten an, was die Aktionsliste nennt. Ohne
     * einen einzigen erlaubten Zug öffnete der Klick eine leere Wahl - der Knopf
     * ist dann gesperrt, und der Satz zur Karte steht trotzdem darüber.
     */
    if (category.kind === 'person' || card === 'tradeHarbor') return playsOf(card).length > 0;
    return true;
  };
```

    Da `isClickable` jetzt `playsOf` braucht, steht es **nach** `playsOf`.
  - Im Dialogbereich vor `) : null}` der `merchantFleet`-Kette:

```tsx
      ) : dialog === 'tradeHarbor' ? (
        <ResourcePickDialog
          title="Handelshafen: Rohstoff wählen"
          hint="Jede Person mit einer Handelsware bekommt davon einen und gibt dir eine Handelsware ihrer Wahl."
          pool={tradeHarborPool}
          count={1}
          onClose={() => setDialog(null)}
          onConfirm={(picks) => {
            play({ card: 'tradeHarbor', resource: picks[0]! });
            setDialog(null);
          }}
        />
```

    und danach, außerhalb der Kette:

```tsx
      {personFor === null ? null : (
        <PersonPickDialog
          title={PERSON_TEXTS[personFor].title}
          hint={PERSON_TEXTS[personFor].hint}
          people={peopleFor(personFor)}
          onClose={() => setPersonFor(null)}
          onChoose={(victim) => {
            play(playOn(personFor, victim));
            setPersonFor(null);
          }}
        />
      )}
```

  - `GameScreen.tsx`: `<ProgressPanel view={view} actions={actions} onAction={onAct} … />`

- [ ] **Schritt 5: Tests laufen lassen** — `pnpm typecheck && pnpm -r test`. PASS.
- [ ] **Schritt 6: Committen**

```bash
git add apps/client/src
git commit -m "Die fuenf wartenden Karten spielen: Personenwahl und Handelshafen"
```

---

## Aufgabe 14: Bildschirm III — die fünf Antworten

**Was entsteht:** Jeder, der in `progressPending` wartet, sieht seinen Dialog — gleichzeitig wie
beim Abwerfen. Hochzeit und Großhändler benutzen den Zählerdialog aus `DiscardDialog` (Titel,
Hinweis und Knopftext werden einstellbar); der Handelshafen den `ResourcePickDialog`; die
Spionage einen kleinen Aufdeckdialog; der Deserteur das Brett. Die zwei **Aufdeckdialoge**
(Großhändler, Spionage) sagen, dass das Gezeigte nur jetzt und nur hier zu sehen ist.

**Keine Rechnung im Client:** was aufzählbar ist (Handelswaren, fremde Fortschrittskarten,
Kreuzungen), kommt aus der Aktionsliste; die verlangte Kartenzahl bei Hochzeit und Großhändler
aus `twoCardsOrAll` in `shared` — dieselbe Funktion, die die Regel prüft.

**Dateien:**

- Neu: `apps/client/src/dialogs/SpyDialog.tsx`
- Ändern: `dialogs/DiscardDialog.tsx`, `dialogs/ResourcePickDialog.tsx`, `game/targets.ts`,
  `screens/GameScreen.tsx`, `packages/shared/src/game/cities/index.ts`
- Test: `dialogs/SpyDialog.test.tsx` (**neu**), `screens/progressAnswers.test.tsx` (**neu**)

**Interfaces:**

- Consumes: `answerProgress`-Aktionen aus `legalActions` (Aufgaben 4, 5, 7), `revealsTo`
  (Aufgabe 2), `twoCardsOrAll` (Aufgabe 1)
- Produces: `ActionTargets.desert: ReadonlyMap<VertexId, GameAction>`,
  `SpyDialog({ victimName, cards, onTake })`, `DiscardDialog` mit optionalem
  `title`/`hint`/`confirmLabel`, `ResourcePickDialog` mit optionalem `confirmLabel`

- [ ] **Schritt 1: Die fehlschlagenden Tests schreiben.**

`apps/client/src/dialogs/SpyDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { SpyDialog } from './SpyDialog';

describe('SpyDialog', () => {
  it('zeigt die fremden Karten und sagt, dass sie nur jetzt zu sehen sind', () => {
    render(<SpyDialog victimName="Ben" cards={['bishop', 'crane']} onTake={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Bischof' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Kran' })).toBeDefined();
    expect(screen.getByText(/nur jetzt/)).toBeDefined();
  });

  it('meldet die genommene Karte', async () => {
    const onTake = vi.fn();
    render(<SpyDialog victimName="Ben" cards={['bishop', 'crane']} onTake={onTake} />);

    await userEvent.click(screen.getByRole('button', { name: 'Kran' }));

    expect(onTake).toHaveBeenCalledWith('crane');
  });
});
```

`apps/client/src/screens/progressAnswers.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CITIES_RULES,
  CLASSIC_34,
  boardOf,
  cardAmounts,
  createGame,
  generateScenario,
  legalActions,
  playerViewOf,
  reduce,
  setupPlayer,
  type GameState,
} from '@conquerist/shared';
import { render, screen, userEvent, within } from '../test/dom';
import { placeVertex } from '../test/board';
import { afterOpening } from '../test/opening';
import { defaultSeats } from '../seats';
import { GameScreen } from './GameScreen';

/*
 * Die fünf Antworten am echten Bildschirm - mit einer Sicht aus `playerViewOf`
 * und einer Aktionsliste aus `legalActions`, genau das, was der Server schickt.
 */
const scenario = generateScenario(CLASSIC_34, 'antworten');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = afterOpening(createGame(scenario, CITIES_RULES, ids, 'antworten'));
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

/** Wer am Zug ist, und ein anderer. */
function roles(state: GameState): { by: string; other: string } {
  const by = state.players[state.currentPlayerIndex]!.id;
  return { by, other: state.players.find((player) => player.id !== by)!.id };
}

function screenFor(state: GameState, viewer: string, onAct = vi.fn()) {
  return render(
    <GameScreen
      view={playerViewOf(state, viewer, seats, 1)}
      actions={legalActions(state, viewer)}
      log={[]}
      error={null}
      onAct={onAct}
      onDismissError={vi.fn()}
      onLeave={vi.fn()}
    />,
  );
}

function withResources(state: GameState, id: string, part: Parameters<typeof cardAmounts>[0]): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, resources: cardAmounts(part) } : player,
    ),
  };
}

describe('Antworten auf wartende Karten', () => {
  it('lässt bei der Hochzeit zwei Karten wählen und schickt sie als Geschenk', async () => {
    const base = afterSetup();
    const { by, other } = roles(base);
    const state: GameState = {
      ...withResources(base, other, { ore: 3 }),
      phase: { kind: 'progressPending', by, pending: [other], payload: { card: 'wedding' } },
    };
    const onAct = vi.fn();
    screenFor(state, other, onAct);

    const dialog = screen.getByRole('dialog', { name: /Hochzeit/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Erz mehr' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Erz mehr' }));
    await userEvent.click(within(dialog).getByRole('button', { name: /Schenken/ }));

    expect(onAct).toHaveBeenCalledWith({
      type: 'answerProgress',
      player: other,
      answer: { card: 'wedding', gift: expect.objectContaining({ ore: 2 }) },
    });
  });

  it('deckt beim Großhändler die fremde Hand auf und nimmt daraus', async () => {
    const base = afterSetup();
    const { by, other } = roles(base);
    const state: GameState = {
      ...withResources(base, other, { ore: 2, wool: 1 }),
      phase: {
        kind: 'progressPending',
        by,
        pending: [by],
        payload: { card: 'masterMerchant', victim: other },
      },
    };
    const onAct = vi.fn();
    screenFor(state, by, onAct);

    const dialog = screen.getByRole('dialog', { name: /Großhändler/ });
    expect(within(dialog).getByText(/nur jetzt/)).toBeDefined();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Erz mehr' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Erz mehr' }));
    await userEvent.click(within(dialog).getByRole('button', { name: /Nehmen/ }));

    expect(onAct).toHaveBeenCalledWith({
      type: 'answerProgress',
      player: by,
      answer: { card: 'masterMerchant', take: expect.objectContaining({ ore: 2 }) },
    });
  });

  it('bietet bei der Spionage genau die fremden Karten an', async () => {
    const base = afterSetup();
    const { by, other } = roles(base);
    const state: GameState = {
      ...base,
      players: base.players.map((player) =>
        player.id === other ? { ...player, progressCards: ['bishop', 'crane'] } : player,
      ),
      phase: { kind: 'progressPending', by, pending: [by], payload: { card: 'spy', victim: other } },
    };
    const onAct = vi.fn();
    screenFor(state, by, onAct);

    const dialog = screen.getByRole('dialog', { name: 'Spionage' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kran' }));

    expect(onAct).toHaveBeenCalledWith({
      type: 'answerProgress',
      player: by,
      answer: { card: 'spy', take: 'crane' },
    });
  });

  it('lässt beim Handelshafen nur gehaltene Handelswaren wählen', async () => {
    const base = afterSetup();
    const { by, other } = roles(base);
    const state: GameState = {
      ...withResources(withResources(base, by, { wool: 1 }), other, { cloth: 1 }),
      phase: {
        kind: 'progressPending',
        by,
        pending: [other],
        payload: { card: 'tradeHarbor', resource: 'wool' },
      },
    };
    const onAct = vi.fn();
    screenFor(state, other, onAct);

    expect(screen.queryByTestId('pick-paper')).toBeNull();
    await userEvent.click(screen.getByTestId('pick-cloth'));
    await userEvent.click(screen.getByRole('button', { name: 'Tauschen' }));

    expect(onAct).toHaveBeenCalledWith({
      type: 'answerProgress',
      player: other,
      answer: { card: 'tradeHarbor', commodity: 'cloth' },
    });
  });

  it('lässt beim Deserteur den aufgegebenen Ritter auf dem Brett wählen', () => {
    const base = afterSetup();
    const { by, other } = roles(base);
    const vertex = boardOf(scenario).topology.vertices.find(
      (candidate) => base.buildings[candidate] === undefined,
    )!;
    const state: GameState = {
      ...base,
      knights: {
        [vertex]: { owner: other, level: 1, active: false, activatedOnTurn: null, upgradedThisTurn: false },
      },
      phase: {
        kind: 'progressPending',
        by,
        pending: [other],
        payload: { card: 'deserter', victim: other, replacement: null },
      },
    };
    const onAct = vi.fn();
    const { container } = screenFor(state, other, onAct);

    expect(screen.getByTestId('deserter-mode').textContent).toContain('Welchen Ritter');
    placeVertex(container, vertex);

    expect(onAct).toHaveBeenCalledWith({
      type: 'answerProgress',
      player: other,
      answer: { card: 'deserter', vertex },
    });
  });
});
```

- [ ] **Schritt 2: Tests laufen lassen** — FAIL.

- [ ] **Schritt 3: `twoCardsOrAll` für den Client freigeben.** In
      `packages/shared/src/game/cities/index.ts` nach `export * from './progress/cards.js';`:

```ts
/*
 * Nur `twoCardsOrAll` aus `progress/pending.js`, benannt: der Zaehlerdialog von
 * Hochzeit und Grosshaendler verlangt damit dieselbe Zahl wie die Regel. Der
 * Rest der Datei baut Zustaende und bleibt Sache des Reducers.
 */
export { twoCardsOrAll } from './progress/pending.js';
```

- [ ] **Schritt 4: Die zwei Dialoge einstellbar machen.**

`DiscardDialog.tsx`, in `DiscardDialogProps`:

```ts
  /**
   * Überschrift, Hinweis und Knopftext - fehlen sie, gelten die der Sieben.
   * Hochzeit und Großhändler setzen eigene: dieselbe Frage („welche Karten,
   * wie viele"), ein anderer Anlass. Beim Großhändler ist `player` das Opfer,
   * dessen Hand für diese Phase aufgedeckt ist.
   */
  readonly title?: string;
  readonly hint?: string;
  readonly confirmLabel?: string;
```

In der Destrukturierung `title, hint, confirmLabel` ergänzen; im Markup:

```tsx
    <div className="modal" role="dialog" aria-label={title ?? `${player.name} wirft ab`}>
      <div className="modal__box">
        <h2>{title ?? `${player.name}, wirf ${required} Karten ab`}</h2>
        <p className="modal__hint">
          {hint ?? `Nur du siehst dieses Fenster. ${player.cardCount} Karten auf der Hand.`}
        </p>
```

und der Knopftext `{confirmLabel ?? 'Abwerfen'} ({total}/{required})`.

`ResourcePickDialog.tsx`: in den Props
`/** Text am Bestätigungsknopf - fehlt er, heißt er „Karte spielen". */ readonly confirmLabel?: string;`,
Destrukturierung `confirmLabel = 'Karte spielen'`, am Knopf `{confirmLabel}`.

- [ ] **Schritt 5: `SpyDialog.tsx` schreiben**

```tsx
import type { JSX } from 'react';
import { PROGRESS_NAMES, PROGRESS_TRACK, type ProgressCardId } from '@conquerist/shared';
import { TRACK_COLORS } from '../game/labels';

export interface SpyDialogProps {
  readonly victimName: string;
  /** Die wählbaren Karten - aus der Aktionsliste, je Art einmal. */
  readonly cards: readonly ProgressCardId[];
  readonly onTake: (card: ProgressCardId) => void;
}

/**
 * Spionage: welche der fremden Fortschrittskarten genommen wird.
 *
 * Ein **Aufdeckdialog** - er sagt, dass das Gezeigte nur jetzt und nur hier zu
 * sehen ist. `revealsTo` in `shared` öffnet die Hand genau für diese Phase;
 * ist sie vorbei, steht in der Sicht wieder `null`.
 *
 * Ohne Abbruch: gespielt ist die Karte schon. Wer nicht wählt, dem lässt die
 * Frist die Beute verfallen.
 */
export function SpyDialog({ victimName, cards, onTake }: SpyDialogProps): JSX.Element {
  return (
    <div className="modal" role="dialog" aria-label="Spionage">
      <div className="modal__box">
        <h2>{victimName}s Fortschrittskarten</h2>
        <p className="modal__hint">Nur du siehst diese Karten, und nur jetzt. Eine davon nimmst du.</p>

        <div className="pick">
          {cards.map((card) => (
            <button
              key={card}
              type="button"
              className="button"
              style={{
                borderLeftColor: TRACK_COLORS[PROGRESS_TRACK[card]],
                borderLeftWidth: '4px',
              }}
              onClick={() => onTake(card)}
            >
              {PROGRESS_NAMES[card]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Schritt 6: Die Brettziele des Deserteurs in `targets.ts`.**
  - `ActionTargets`, nach `displace`:

```ts
  /** Beim Deserteur: welcher eigene Ritter fällt, bzw. wohin der Überläufer kommt. */
  readonly desert: ReadonlyMap<VertexId, GameAction>;
```

  - `EMPTY_TARGETS`: `desert: new Map(),`
  - `targetsFrom`: `const desert = new Map<VertexId, GameAction>();`, im `switch`:

```ts
      case 'answerProgress':
        // Nur der Deserteur antwortet mit einem Ort. Die übrigen Antworten
        // liest der Dialog der Karte selbst aus der Liste.
        if (action.answer.card === 'deserter') {
          claim(desert, action.answer.vertex, action, 'Deserteurziel');
        }
        break;
```

    und `desert` im zurückgegebenen Objekt.
  - `pnpm typecheck`: jede Stelle, die ein `ActionTargets` ohne Spread aus `EMPTY_TARGETS` von
    Hand baut, bekommt `desert: new Map()`.

- [ ] **Schritt 7: `GameScreen.tsx`.**
  - Imports: `SpyDialog` aus `../dialogs/SpyDialog`; `twoCardsOrAll` und `CARD_LABELS` aus
    `@conquerist/shared`. Lokaler Typ neben den anderen:
    `type ProgressAnswer = Extract<GameAction, { type: 'answerProgress' }>['answer'];`
  - `boardTargets`, direkt nach dem `targets.displace`-Zweig:

```ts
    /*
     * Der Deserteur fragt eine Kreuzung - ebenfalls ohne Modus: das Opfer muss
     * einen Ritter aufgeben, der Spielende den Überläufer setzen. Beides ist
     * Pflicht und keine Absicht, die man fassen oder fallen lassen könnte.
     */
    if (targets.desert.size > 0) {
      return { ...EMPTY_TARGETS, vertices: new Map(targets.desert) };
    }
```

  - `commit`, im `vertex`-Zweig direkt nach dem `dodge`-Block:

```ts
        const desert = targets.desert.get(place.id);
        if (desert !== undefined) {
          onAct(desert);
          return;
        }
```

  - Nach `isFrontOfQueue`:

```ts
  /**
   * Worauf eine wartende Fortschrittskarte bei **diesem** Empfänger wartet -
   * `null`, wenn er gerade nicht antworten muss. Gleichzeitig wie beim
   * Abwerfen: jeder Wartende sieht seinen Dialog.
   */
  const answering =
    view.phase.kind === 'progressPending' && view.phase.pending.includes(view.you)
      ? view.phase
      : null;

  /** Die aufzählbaren Antworten stehen in der Aktionsliste - wie die Opfer beim Räuber. */
  const listedAnswers = actions.flatMap((action) =>
    action.type === 'answerProgress' ? [action.answer] : [],
  );

  const answer = (reply: ProgressAnswer): void => {
    onAct({ type: 'answerProgress', player: view.you, answer: reply });
  };

  const nameOfPlayer = (id: PlayerId): string => playerOf(id)?.name ?? id;

  const merchantVictim =
    answering?.payload.card === 'masterMerchant' ? playerOf(answering.payload.victim) : undefined;
  const spyVictim =
    answering?.payload.card === 'spy' ? playerOf(answering.payload.victim) : undefined;
  const harborResource =
    answering?.payload.card === 'tradeHarbor' ? answering.payload.resource : null;

  /** „eine Karte" oder „zwei Karten" - die Zahl kommt aus der Regel, nicht von hier. */
  const cardsWord = (count: number): string => (count === 1 ? 'eine Karte' : 'zwei Karten');
```

  - Im Markup nach dem `aqueductPending`-Dialog:

```tsx
      {/*
       * Die fünf wartenden Karten - je ein Dialog, sichtbar für jeden, der in
       * der Warteliste steht. Kein Schließkreuz: gespielt ist die Karte, und
       * wer nicht antwortet, dem nimmt die Frist die Antwort ab oder lässt sie
       * verfallen (Spec 5.5). `key` je Anlass, damit eine halbe Auswahl nicht
       * in den nächsten Dialog wandert.
       */}
      {answering?.payload.card === 'wedding' && you !== undefined ? (
        <DiscardDialog
          key={`wedding-${view.you}`}
          player={you}
          cards={view.rules.cards}
          required={twoCardsOrAll(you.cardCount)}
          title={`Hochzeit: schenke ${nameOfPlayer(answering.by)} ${cardsWord(twoCardsOrAll(you.cardCount))}`}
          hint="Du hast mehr Siegpunkte – die Karten wählst du selbst."
          confirmLabel="Schenken"
          onConfirm={(gift) => answer({ card: 'wedding', gift })}
        />
      ) : null}

      {merchantVictim !== undefined && merchantVictim.resources !== null ? (
        <DiscardDialog
          key={`merchant-${merchantVictim.id}`}
          player={merchantVictim}
          cards={view.rules.cards}
          required={twoCardsOrAll(merchantVictim.cardCount)}
          title={`Großhändler: nimm ${merchantVictim.name} ${cardsWord(twoCardsOrAll(merchantVictim.cardCount))}`}
          hint="Nur du siehst diese Hand, und nur jetzt."
          confirmLabel="Nehmen"
          onConfirm={(take) => answer({ card: 'masterMerchant', take })}
        />
      ) : null}

      {spyVictim !== undefined ? (
        <SpyDialog
          key={`spy-${spyVictim.id}`}
          victimName={spyVictim.name}
          cards={listedAnswers.flatMap((reply) => (reply.card === 'spy' ? [reply.take] : []))}
          onTake={(take) => answer({ card: 'spy', take })}
        />
      ) : null}

      {harborResource !== null && answering !== null ? (
        <ResourcePickDialog
          key={`harbor-${view.you}`}
          title="Handelshafen"
          hint={`${nameOfPlayer(answering.by)} gibt dir ${CARD_LABELS[harborResource]} – welche Handelsware gibst du dafür?`}
          pool={listedAnswers.flatMap((reply) =>
            reply.card === 'tradeHarbor' ? [reply.commodity] : [],
          )}
          count={1}
          confirmLabel="Tauschen"
          onConfirm={(picks) => answer({ card: 'tradeHarbor', commodity: picks[0]! })}
        />
      ) : null}
```

  - Vor dem `targets.displace`-Modus:

```tsx
      {targets.desert.size > 0 ? (
        <div className="mode" role="status" data-testid="deserter-mode">
          <span>
            {answering?.payload.card === 'deserter' && answering.payload.replacement !== null
              ? 'Deserteur: Wo stellst du den Überläufer auf?'
              : 'Deserteur: Welchen Ritter gibst du auf?'}
          </span>
        </div>
      ) : null}
```

- [ ] **Schritt 8: Tests laufen lassen** — `pnpm typecheck && pnpm -r test`. PASS.
- [ ] **Schritt 9: Committen**

```bash
git add packages/shared/src/game/cities/index.ts apps/client/src
git commit -m "Die fuenf Antworten am Bildschirm: Zaehlerdialog, Aufdeckdialoge, Deserteur am Brett"
```

---

## Aufgabe 15: Die zwei Testlücken aus 10d-1

**Was entsteht:** zwei Tests, die `PROGRESS.md` unter 10d-1 als fehlend führt. Straßenbau (die
Fortschrittskarte) hat keinen Test „nennt die einzige Kante mit leerer zweiter Wahl, wenn keine
zweite geht" — Schmied und Diplomat haben ihn. Medizin fehlt „ist leer ohne die Karte auf der
Hand".

**Dateien:**

- Test: `packages/shared/src/game/cities/progress/targets.test.ts`

- [ ] **Schritt 1: Die Tests schreiben.** Im Block `Strassenbau (Fortschritt): Ziele`:

```ts
  it('nennt die einzige Kante mit leerer zweiter Wahl, wenn keine zweite geht', () => {
    const base = withHand(
      citiesTable({ buildings: { [CENTER_VERTEX]: settlementOf('p1') } }),
      'p1',
      ['roadBuilding'],
    );
    // Die letzte Strasse im Vorrat: nach ihr geht keine zweite mehr.
    const state: GameState = {
      ...base,
      players: base.players.map((player) =>
        player.id === 'p1'
          ? { ...player, piecesLeft: { ...player.piecesLeft, road: 1 } }
          : player,
      ),
    };

    expect(progressRoadBuildingTargets(state, 'p1')[CENTER_EDGE]).toEqual([]);
  });
```

Im Block `Medizin: Ziele`:

```ts
  it('ist leer ohne die Karte auf der Hand', () => {
    const state = giving(
      citiesTable({ buildings: { [CENTER_VERTEX]: settlementOf('p1') } }),
      'p1',
      { ore: 2, grain: 1 },
    );
    expect(medicineTargets(state, 'p1')).toEqual([]);
  });
```

- [ ] **Schritt 2: Tests laufen lassen** — `pnpm -r test`. Erwartet: PASS, denn beide Fälle
      beschreiben vorhandenes Verhalten. **Wird der Straßenbau-Test rot**, ist das ein echter
      Befund (die Karte wäre mit der letzten Straße unspielbar, dieselbe Sackgasse, die
      `development.test.tsx` für die Entwicklungskarte schon einmal gefunden hat): dann
      `superpowers:systematic-debugging`, Ursache in `science.ts#applyProgressRoadBuilding`
      beheben, und der Befund gehört in `PROGRESS.md`.
- [ ] **Schritt 3: Gegenprobe für den Medizin-Test**, damit er nicht bloß leer-grün ist: im Test
      vorübergehend `withHand(…, 'p1', ['medicine'])` um den Zustand legen — er muss rot werden.
      Zurückbauen.
- [ ] **Schritt 4: Committen**

```bash
git add packages/shared/src/game/cities/progress/targets.test.ts
git commit -m "Die zwei Testluecken aus 10d-1: Strassenbau mit einer Kante, Medizin ohne Karte"
```

---

## Aufgabe 16: Der Durchgang im Browser

**Warum als eigene Aufgabe:** nach 10b hat der Durchgang elf Befunde geliefert, nach 10d-1 vier,
und keiner davon wäre durch einen Test gefallen.

**Vorbereitung.** Die fünf Karten in einer gespielten Partie zufällig zu ziehen dauert Dutzende
Runden, und das Aquädukt kam in 10d-1 in über sechzig Runden nicht zustande. Deshalb zwei
**vorübergehende, nie committete** Eingriffe, nur für den Durchgang:

1. In `packages/shared/src/game/setup.ts`, wo `createGame` die drei Fortschrittsstapel mischt,
   die gemischten Stapel so umordnen, dass `wedding`, `tradeHarbor`, `spy`, `masterMerchant` und
   `deserter` oben auf ihrem Stapel liegen.
2. Ebenda dem ersten Spieler `improvements: { science: 3 }` geben, damit das Aquädukt
   (Messpunkt 7) beim ersten leeren Wurf fragt.

Am Ende des Durchgangs: `git diff packages/shared/src/game/setup.ts` muss leer sein.

Das Chrome-Fenster **vor** dem Durchgang aus der Maximierung lösen — `resize_window` ändert die
Breite eines maximierten Fensters nicht.

- [ ] **Schritt 1: `pnpm dev` starten, die zwei Eingriffe setzen, lokale Partie mit
      Städte-&-Ritter-Regeln beginnen**
- [ ] **Schritt 2: Zehn Punkte messen, jeden mit einer Zahl oder einem Beleg**

1. **Hochzeit:** der Dialog erscheint beim Reicheren, verlangt zwei Karten (bzw. alle), und der
   Verlauf sagt „schenkt … zwei Karten" **ohne** Sorte.
2. **Handelshafen:** die Rohstoffwahl bietet nur deckbare Sorten; der Antwortdialog nur gehaltene
   Handelswaren; der Knopf heißt „Tauschen".
3. **Spionage:** die Personenwahl zeigt Name, Farbe **und** Punktestand; der Aufdeckdialog zeigt
   die fremden Karten; danach steht kein fremder Kartenname mehr im DOM
   (`document.body.innerText`), sofern er nicht auf der eigenen Hand liegt.
4. **Großhändler:** in der Personenwahl stehen genau die Personen mit mehr Punkten — Zahl der
   Knöpfe gegen die Punktestände am Tisch.
5. **Deserteur:** Runde 1 leuchten beim Opfer nur seine Ritter, Runde 2 beim Spielenden nur
   Kreuzungen an seinen Straßen; der Überläufer steht mit der erwarteten Stufe.
6. **Wartezeile:** die Zahl zählt herunter und springt nicht — Breite des `<b>` über drei
   Sekunden gemessen (`getBoundingClientRect().width` gleich).
7. **Fristablauf:** in einer Abwurfphase 60 s nichts tun — die Karten werden abgenommen, der
   Verlauf sagt „Die Zeit ist abgelaufen - … wirft von selbst ab".
8. **Aquädukt (Messpunkt 7 aus 10c/10d-1):** fragt wirklich, die Wahl kommt an.
9. **Kontrast** von `.status__clock` auf seinem Grund, gemessen, nicht geschätzt (≥ 4,5:1).
10. **Trefferflächen** der Knöpfe in Personenwahl und Spionagedialog ≥ 44 px.

- [ ] **Schritt 3: Die zwei Viewport-Breakpoints prüfen** (396 px und der mittlere), über ein
      `iframe` fester Größe auf derselben Origin — root-`zoom` taugt dafür nicht. Die drei neuen
      Dialoge dürfen dort nicht über den Rand laufen.
- [ ] **Schritt 4: Befunde beheben, jeden mit eigenem Commit und Test**
- [ ] **Schritt 5: Die zwei Eingriffe zurückbauen**, `git status` zeigt `setup.ts` nicht.

**Beim Klicken beachten** (alles schon bezahlt gelernt):

- Brettklicks gehen **nur über die Fangfläche**: Mittelpunkt rechnen,
  `document.elementFromPoint(x, y)` nehmen (das ist `rect.board__catcher`), dort
  `pointerdown → mousedown → pointerup → mouseup → click` mit `clientX/clientY`.
- Die Screenshots der Erweiterung sind **nicht maßstabsgetreu**. Klicken über `find` und
  Element-Referenz, messen über `getBoundingClientRect`.
- Zwischen zwei Klicks auf dasselbe Bedienelement gehört ein `await`.
- Lokal wandert der Bildschirm zu dem, der handeln muss — bei der Hochzeit nacheinander durch
  alle Schenkenden.

---

## Aufgabe 17: Abnahme und `PROGRESS.md`

- [ ] **Schritt 1: Die volle Abnahme laufen lassen**

```bash
pnpm typecheck && pnpm -r test && pnpm build && pnpm format:check
```

Erwartet: alles grün. **`pnpm -r test`, nicht `npx vitest run`.** Die Testzahlen je Paket
notieren — sie kommen gemessen in die Tabelle.

- [ ] **Schritt 2: Der Umlaut-Suchlauf.** In `packages/shared` und `apps/server` dürfen
      Kommentare **und Testnamen** keine Umlaute tragen; sichtbare Texte müssen welche tragen.
      Sichtbarer Text ist Literal **und** JSX-Kinderknoten.

```bash
grep -rn '[äöüßÄÖÜ]' packages/shared/src apps/server/src | grep -v "'" | grep -v '`' | head -40
```

Erwartet: keine Kommentar- oder Testnamenzeile. Jede Fundstelle wird angesehen, nicht nur
gezählt.

- [ ] **Schritt 3: `PROGRESS.md` schreiben.** Ein Abschnitt „Etappe 10d-2 — die fünf Karten, die
      auf eine fremde Antwort warten" in der Form der vorhandenen Abschnitte:
  - **Stand:** Datum, Branch `etappe-10d2-wartende-karten`, Commits.
  - **Abnahme** als Tabelle mit **gemessenen** Zahlen (Tests je Paket, Bundlegröße).
  - **Getroffene Entscheidungen**, je Absatz eine, fett angeführt: die eine Phase mit eigener
    Antwort-Union; `revealsTo` als einzige geöffnete Stelle; Fristen als Dauer statt Zeitpunkt;
    „ein Geschenk verfällt, eine Pflicht wird abgenommen" und dass jede abgenommene Pflicht
    durch dieselbe `apply…` geht; `canPlaceKnightAt` aus `canBuildKnight` gelöst; ein Countdown
    mit zwei Fundstellen; laufende Partien behalten ihr Regelwerk mit 43 Karten.
  - **Bewußte Abweichungen** — die acht aus dem Kopf dieses Plans **wörtlich**, dazu die drei
    unbestätigten Auslegungen.
  - **Der Durchgang im Browser** mit den zehn Messpunkten und ihren Zahlen.
  - **Offene Punkte**, mindestens: die 25 Kartenmotive (gestrichen, nicht verschoben); keine
    Zugzeit für `main` und `rollPending`; Befund D (Auszeichnungskarte bei ~396 px) aus 10d-1,
    falls nicht behoben; `GameScreen.test.tsx` flackert unter Last; die offenen Punkte aus
    Etappe 9; was der Durchgang nicht erreicht hat.
  - **Nächste Etappe:** 10e — Burg 1 / Burg 2 zu fünft und sechst.
- [ ] **Schritt 4: Committen**

```bash
git add PROGRESS.md
git commit -m "Was in 10d-2 entschieden wurde"
```

- [ ] **Schritt 5: Den Branch anbieten.** Nicht selbst nach `main` mergen und nicht pushen — das
      entscheidet der Mensch (`superpowers:finishing-a-development-branch`).

---

## Selbstprüfung gegen die Spec

| Anforderung der Spec (5.3, 5.5, Zuschnitt 10d-2)                                  | Aufgabe |
| --------------------------------------------------------------------------------- | ------- |
| `progressPending` als eine Phase, `payload` für das, was zwischen Runden feststeht | 1       |
| `ProgressAnswerSchema` als eigene Union unter einer Aktion `answerProgress`        | 1       |
| `actorFor` / `PHASE_ACTIONS` / `legalActions`                                      | 1, 4–7  |
| `revealsTo` öffnet je ein Feld, für eine Person, eine Hand, eine Phase             | 2       |
| Lecktest ohne Teilstrings                                                          | 2       |
| Hochzeit: `victoryPointsOf`, weniger als zwei → alles, ohne Karten nicht in `pending` | 3    |
| „Öffentliche und volle Punkte sind hier gleich" als Satz im Code                   | 3       |
| Handelshafen: eine Sorte für alle, Deckung in `canPlayProgress`                    | 4       |
| Spionage: jede Person, nur `progressCards` wählbar                                 | 5       |
| Großhändler: mehr Punkte **und** mindestens eine Karte                             | 6       |
| Deserteur: zwei Runden, Ersatzstufe erzwungen, `active` reist mit, `activatedOnTurn = turn` | 7 |
| Reihenfolge in `pending` im Uhrzeigersinn, `inTurnOrder` herausgezogen             | 1, 3, 4 |
| Die fünf Karten in `CITIES_RULES.progressDecks`                                    | 8       |
| `deadlineOf` liefert eine Dauer, der Wecker rechnet `now + ms`                     | 9, 10   |
| `applyTimeout` zieht nach `game/timeout.ts` und wird Verteiler                     | 9       |
| Die zwölf Zeilen aus 5.5, rein und deterministisch                                 | 9       |
| Personenwahl mit Name, Farbe, Punktestand                                          | 13      |
| Zwei Aufdeckdialoge                                                                | 14      |
| Wartezeile mit Countdown, zweite Fundstelle ohne zweite Umsetzung                  | 12      |
| Verlauf: fünf Kartensätze und der Fristablauf                                      | 11      |
| Die zwei Testlücken aus 10d-1 (Straßenbau, Medizin)                                | 15      |
| Browser-Durchgang inklusive Messpunkt 7, dann Abnahme und `PROGRESS.md`            | 16, 17  |

**Nicht in dieser Etappe, mit Absicht:** die 25 Kartenmotive (Abweichung 1, vom Menschen am
2026-09-15 gestrichen); eine Zugzeit für `main` und `rollPending` (Spec 5.5: eine andere Sache
als eine Antwortfrist).
