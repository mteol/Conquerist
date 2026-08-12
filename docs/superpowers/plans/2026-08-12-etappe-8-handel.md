# Etappe 8 — Handel zwischen Spielern — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Spieler am Zug legt ein Rohstoffangebot auf den Tisch; Mitspieler
sagen zu, lehnen ab oder kontern; der Anbieter waehlt den Partner — begrenzt
durch eine Frist, die im Zustand steht und vom Server gestempelt wird.

**Architecture:** Das Angebot ist eine neue Phase `tradePending` im
Zustandsautomaten aus `phase.ts` — kein Feld daneben, damit die Sperre gegen
Bauen und Zugende nicht zu einer zweiten Regel neben `PHASE_ACTIONS` wird. Alle
Regeln liegen in einer neuen reinen Datei `packages/shared/src/game/playerTrade.ts`
nach dem bestehenden Muster `can…`/`apply…`. Zeit kommt ausschliesslich als
Daten herein (`at` an der Aktion, `expiresAt` im Zustand, `timeout` als Aktion),
damit der Reducer rein bleibt und `replay` deterministisch.

**Tech Stack:** TypeScript strict, Zod 4, Vitest 4, React 19, Fastify 5 + `ws`,
better-sqlite3, pnpm-Monorepo.

**Spec:** `docs/superpowers/specs/2026-08-12-etappe-8-handel-design.md`

## Global Constraints

- **`shared` hat keine Runtime-Dependencies ausser `zod`.** Kein React, kein
  Node-API. Muss im Browser und in Node laufen.
- **Spiellogik ist pur:** `(state, action) => newState`. Kein `Math.random()`,
  **kein `Date.now()`**, kein I/O. Zeit kommt als `at` in der Aktion herein.
- **Der Server ist die Autoritaet.** Der Client schickt Absichten, keine
  Ergebnisse. `at` wird serverseitig ueberschrieben.
- **Verdeckte Information:** Handkarten fremder Spieler erscheinen nie in einer
  `PlayerView`, und keine Ablehnung verraet, ob jemand _nicht konnte_.
- **Antworten auf Deutsch, Code und Bezeichner auf Englisch.** Kommentare und
  Verlaufssaetze deutsch, **ohne Umlaute** (`ae/oe/ue/ss`) — so wie der
  Bestand.
- **Kein Hex-Wert in einer Komponente.** Farben kommen aus `index.css`.
- **Tabellenziffern ueberall**, wo Zahlen verglichen werden.
- **Kein `Co-Authored-By` in Commit-Messages.**
- Commit-Messages deutsch, im Stil des Bestands: was und warum, kein
  `feat:`-Praefix.
- Nach jeder Aufgabe muss `pnpm typecheck` und `pnpm test` gruen sein.
- Einzelne Testdatei laufen lassen:
  `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`

---

## Dateien im Ueberblick

**Neu:**

| Datei                                          | Verantwortung                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/shared/src/game/tradeOffer.ts`       | Nur die Datentypen des Angebots (Schemas), damit `phase.ts` sie ohne Zirkel importieren kann |
| `packages/shared/src/game/tradeOffer.test.ts`  | Schema-Tests                                                                                 |
| `packages/shared/src/game/playerTrade.ts`      | Alle Regeln des Spielerhandels (`can…`/`apply…`)                                             |
| `packages/shared/src/game/playerTrade.test.ts` | Regeltests                                                                                   |
| `packages/shared/src/game/deadline.ts`         | `deadlineOf` — die laufende Frist und wem sie gehoert                                        |
| `apps/server/src/rooms/clock.ts`               | Der Wecker je Raum: liest `deadlineOf`, wirft `timeout` ein                                  |
| `apps/server/src/rooms/clock.test.ts`          | Weckertests mit gestellter Uhr                                                               |
| `apps/client/src/dialogs/TradeOfferDialog.tsx` | Antworten, kontern, zuschlagen, Countdown                                                    |

**Geaendert:**

| Datei                                     | Aenderung                                           |
| ----------------------------------------- | --------------------------------------------------- |
| `packages/shared/src/game/phase.ts`       | Phase `tradePending`                                |
| `packages/shared/src/rules/ruleset.ts`    | `tradeOfferMs` mit `.default(60_000)`               |
| `packages/shared/src/game/actions.ts`     | acht neue Aktionen, `stampAction`, `isSystemAction` |
| `packages/shared/src/game/errors.ts`      | vier neue Codes                                     |
| `packages/shared/src/game/reducer.ts`     | `PHASE_ACTIONS`, `actorFor`, `applyAction`          |
| `packages/shared/src/game/legal.ts`       | Zuege in `tradePending`                             |
| `packages/shared/src/game/playerView.ts`  | `canOfferTrade`                                     |
| `packages/shared/src/game/log.ts`         | acht Verlaufssaetze                                 |
| `packages/shared/src/game/index.ts`       | Barrel                                              |
| `packages/shared/src/protocol/events.ts`  | `sentAt` im Spielstand-Ereignis                     |
| `apps/server/src/rooms/room.ts`           | `applySystemAction`                                 |
| `apps/server/src/rooms/broadcast.ts`      | `sentAt`                                            |
| `apps/server/src/ws/handlers/room.ts`     | Stempel, Sperre, Wecker, Drop/Rejoin                |
| `apps/client/src/game/view.ts`            | `actingPlayers`, Phasensatz                         |
| `apps/client/src/game/useHotseatGame.ts`  | Stempel und lokaler Wecker                          |
| `apps/client/src/dialogs/TradeDialog.tsx` | zweiter Reiter „Spieler"                            |
| `apps/client/src/screens/GameScreen.tsx`  | Angebotsdialog einhaengen                           |
| `apps/client/src/index.css`               | Klassen fuer Reiter, Antwortliste, Countdown        |
| `PROGRESS.md`                             | Abschnitt zur Etappe                                |

**Reihenfolge ist erzwungen, nicht gewaehlt:** `applyAction` in `reducer.ts` und
`describeAction` in `log.ts` sind erschoepfende `switch` ueber die
Aktions-Union. Eine neue Aktion in `actions.ts` bricht den Build, bis beide sie
behandeln. Jede Aufgabe, die eine Aktion einfuehrt, liefert deshalb Schema,
Regel, Reducer-Zweig, Verlaufssatz und Tests **zusammen**.

---

### Task 1: Fundament — Angebotstypen, Phase, Regelwert

Keine neue Aktion, nur Daten. Danach kennt der Zustand die Phase, niemand kann
sie aber betreten.

**Files:**

- Create: `packages/shared/src/game/tradeOffer.ts`
- Create: `packages/shared/src/game/tradeOffer.test.ts`
- Modify: `packages/shared/src/game/phase.ts`
- Modify: `packages/shared/src/rules/ruleset.ts`
- Modify: `packages/shared/src/game/index.ts`
- Modify: `packages/shared/src/game/legal.ts` (Zweig `tradePending`)
- Modify: `apps/client/src/game/view.ts` (`actingPlayers`, `phaseTextOf`)
- Modify: `apps/client/src/game/view.test.ts`

**Interfaces:**

- Produces: `TradeOfferSchema`, `TradeOffer` (`{ from, give, want }`),
  `TradeResponseSchema`, `TradeResponse`
  (`{ kind: 'accepted' } | { kind: 'declined'; automatic: boolean } | { kind: 'countered'; give; want }`),
  Phase `{ kind: 'tradePending'; offer: TradeOffer; responses: Record<string, TradeResponse>; expiresAt: number }`,
  `RuleSet.tradeOfferMs: number`.

- [ ] **Step 1: Testdatei fuer die Schemas schreiben**

`packages/shared/src/game/tradeOffer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES, RuleSetSchema } from '../rules/index.js';
import { PhaseSchema } from './phase.js';
import { TradeResponseSchema } from './tradeOffer.js';

const offer = {
  from: 'p1',
  give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
  want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
};

describe('TradeResponseSchema', () => {
  it('nimmt Zusage, Ablehnung und Gegenangebot an', () => {
    expect(TradeResponseSchema.parse({ kind: 'accepted' })).toEqual({ kind: 'accepted' });
    expect(TradeResponseSchema.parse({ kind: 'declined', automatic: true })).toEqual({
      kind: 'declined',
      automatic: true,
    });
    expect(
      TradeResponseSchema.parse({ kind: 'countered', give: offer.want, want: offer.give }),
    ).toMatchObject({ kind: 'countered' });
  });

  it('verlangt bei einer Ablehnung die Herkunft', () => {
    expect(TradeResponseSchema.safeParse({ kind: 'declined' }).success).toBe(false);
  });
});

describe('PhaseSchema', () => {
  it('kennt tradePending mit Angebot, Antworten und Frist', () => {
    const phase = {
      kind: 'tradePending',
      offer,
      responses: { p2: { kind: 'declined', automatic: false } },
      expiresAt: 1_700_000_000_000,
    };

    expect(PhaseSchema.parse(phase)).toEqual(phase);
  });
});

describe('RuleSetSchema', () => {
  /*
   * Seit Etappe 6 liegt das RuleSet jeder laufenden Partie als JSON in der
   * Datenbank. Ohne Vorgabe scheiterte jeder gespeicherte Spielstand am neuen
   * Pflichtfeld - und jede laufende Partie waere beim naechsten Start weg.
   */
  it('ergaenzt tradeOfferMs in einem gespeicherten Regelwerk ohne dieses Feld', () => {
    const stored = { ...CLASSIC_RULES } as Record<string, unknown>;
    delete stored.tradeOfferMs;

    expect(RuleSetSchema.parse(stored).tradeOfferMs).toBe(60_000);
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/tradeOffer.test.ts`
Expected: FAIL — `Cannot find module './tradeOffer.js'`

- [ ] **Step 3: `tradeOffer.ts` anlegen**

```ts
import { z } from 'zod';

import { ResourceAmountsSchema } from '../rules/index.js';
import { PlayerIdSchema } from './player.js';

/**
 * Die Datentypen des Spielerhandels - nur Form, keine Regel.
 *
 * Eigene Datei und nicht in `playerTrade.ts`: `phase.ts` braucht die Schemas,
 * und die Regeln brauchen `state.ts`, das wiederum `phase.ts` braucht. Ohne
 * diese Trennung stuenden zur Ladezeit drei Module im Kreis.
 */

export const TradeOfferSchema = z.object({
  from: PlayerIdSchema,
  /** Was der Anbieter hergibt. */
  give: ResourceAmountsSchema,
  /** Was er dafuer will. */
  want: ResourceAmountsSchema,
});

export type TradeOffer = z.infer<typeof TradeOfferSchema>;

/**
 * Die Antwort eines Mitspielers. Genau eine je Spieler.
 *
 * `automatic` unterscheidet die Ablehnung, die jemand ausgesprochen hat, von
 * der, die aus einem Verbindungsverlust entstanden ist. Nur die zweite wird bei
 * der Rueckkehr wieder zurueckgenommen.
 */
export const TradeResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('accepted') }),
  z.object({ kind: z.literal('declined'), automatic: z.boolean() }),
  z.object({
    kind: z.literal('countered'),
    /** Aus Sicht des Konternden: was **er** hergibt. */
    give: ResourceAmountsSchema,
    want: ResourceAmountsSchema,
  }),
]);

export type TradeResponse = z.infer<typeof TradeResponseSchema>;
```

- [ ] **Step 4: Phase ergaenzen**

In `packages/shared/src/game/phase.ts` den Import ergaenzen und den Knoten
hinter `main` einfuegen:

```ts
import { TradeOfferSchema, TradeResponseSchema } from './tradeOffer.js';
```

```ts
  /**
   * Ein Angebot liegt auf dem Tisch und blockiert den Zug.
   *
   * Als Phase und nicht als Feld daneben: dass waehrend eines Angebots nicht
   * gebaut wird, ist damit dieselbe Regel wie jede andere Phasensperre und
   * keine zweite Wahrheit neben `PHASE_ACTIONS`.
   */
  z.object({
    kind: z.literal('tradePending'),
    offer: TradeOfferSchema,
    /** Wer schon geantwortet hat. Wer fehlt, ueberlegt noch. */
    responses: z.record(z.string(), TradeResponseSchema),
    /** Unix-ms. Wann das Angebot von selbst verfaellt. */
    expiresAt: z.number().int().min(0),
  }),
```

Den Automaten im Kopfkommentar der Datei mitzeichnen:

```
 * main ──► tradePending ──► main
```

- [ ] **Step 5: Regelwert ergaenzen**

In `packages/shared/src/rules/ruleset.ts`, direkt hinter
`handLimitBeforeDiscard` — **im selben Block wie `dice` und `robberRoll`**,
weil die Begruendung dieselbe ist:

```ts
  /**
   * Wie lange ein Angebot auf dem Tisch liegt, in Millisekunden.
   *
   * Mit Vorgabe, aus demselben Grund wie `dice` und `robberRoll` darunter: das
   * RuleSet jeder laufenden Partie liegt seit Etappe 6 als JSON in der
   * Datenbank, und ein Pflichtfeld ohne Vorgabe faende dort kein Gegenstueck.
   */
  tradeOfferMs: z.number().int().min(1_000).default(60_000),
```

und in `CLASSIC_RULES` hinter `handLimitBeforeDiscard: 7,`:

```ts
  tradeOfferMs: 60_000,
```

- [ ] **Step 6: Barrel ergaenzen**

In `packages/shared/src/game/index.ts` alphabetisch einsortieren:

```ts
export * from './tradeOffer.js';
```

- [ ] **Step 7: `legalActions` um den Zweig ergaenzen**

In `packages/shared/src/game/legal.ts`, im `switch (state.phase.kind)`:

```ts
    case 'tradePending':
      // Solange es keine Aktionen fuer diese Phase gibt, ist die leere Liste
      // die richtige Antwort. Sie fuellt sich in Aufgabe 8.
      return [];
```

- [ ] **Step 8: Client-Sicht ergaenzen**

In `apps/client/src/game/view.ts`, in `actingPlayers` **vor** dem `default`:

```ts
    case 'tradePending': {
      const { offer, responses } = view.phase;
      /*
       * Erst die, die noch nicht geantwortet haben, dann der Anbieter. In der
       * lokalen Partie wandert der Bildschirm damit von selbst durch die Runde
       * und kommt zum Auswaehlen zurueck - dieselbe Mechanik wie beim Abwerfen.
       */
      const waiting = view.players
        .map((player) => player.id)
        .filter((id) => id !== offer.from && responses[id] === undefined);

      return [...waiting, offer.from];
    }
```

und in `phaseTextOf`:

```ts
    case 'tradePending':
      return `${nameOf(view.phase.offer.from)} bietet einen Tausch an`;
```

- [ ] **Step 9: Client-Test ergaenzen**

An `apps/client/src/game/view.test.ts` anhaengen:

```ts
describe('actingPlayers in tradePending', () => {
  const offerPhase = (responses: Record<string, { kind: string }>) => ({
    phase: {
      kind: 'tradePending' as const,
      offer: {
        from: ids[0]!,
        give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
        want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
      },
      responses,
      expiresAt: 1_000,
    },
    players: ids.map((id) => ({ id })),
    currentPlayerIndex: 0,
  });

  it('nennt erst die Wartenden, dann den Anbieter', () => {
    expect(actingPlayers(offerPhase({}) as never)).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('laesst weg, wer schon geantwortet hat', () => {
    const responses = { [ids[1]!]: { kind: 'accepted' } };

    expect(actingPlayers(offerPhase(responses) as never)).toEqual([ids[2], ids[0]]);
  });
});
```

- [ ] **Step 10: Alles laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen, die neuen Tests laufen mit.

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/game/tradeOffer.ts packages/shared/src/game/tradeOffer.test.ts \
        packages/shared/src/game/phase.ts packages/shared/src/game/index.ts \
        packages/shared/src/game/legal.ts packages/shared/src/rules/ruleset.ts \
        apps/client/src/game/view.ts apps/client/src/game/view.test.ts
git commit -m "Die Phase fuer ein offenes Angebot - samt Frist im Regelwerk mit Vorgabe"
```

---

### Task 2: `offerTrade` — das Angebot auf den Tisch legen

**Files:**

- Create: `packages/shared/src/game/playerTrade.ts`
- Create: `packages/shared/src/game/playerTrade.test.ts`
- Modify: `packages/shared/src/game/actions.ts`
- Modify: `packages/shared/src/game/reducer.ts`
- Modify: `packages/shared/src/game/log.ts`
- Modify: `packages/shared/src/game/index.ts`

**Interfaces:**

- Consumes: `TradeOffer`, Phase `tradePending`, `RuleSet.tradeOfferMs` (Task 1).
- Produces:
  - `canOfferTrade(state: GameState, player: PlayerId, give: ResourceAmounts, want: ResourceAmounts): RuleViolation | null`
  - `canOfferAnything(state: GameState, player: PlayerId): boolean`
  - `applyOfferTrade(state, player, give, want, at: number): ReduceResult`
  - Aktion `{ type: 'offerTrade', player, give, want, at }`

- [ ] **Step 1: Failing test schreiben**

`packages/shared/src/game/playerTrade.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { RuleViolationCode } from './errors.js';
import { giving, hand, testGame } from './fixtures.js';
import { applyOfferTrade, canOfferAnything, canOfferTrade } from './playerTrade.js';
import { reduce } from './reducer.js';
import type { GameState } from './state.js';

/** p1 ist am Zug und hat die genannten Karten. */
export function offerer(resources: Record<string, number>): GameState {
  return giving(testGame(), 'p1', resources);
}

const TWO_LUMBER = hand({ lumber: 2 });
const ONE_ORE = hand({ ore: 1 });

describe('canOfferTrade', () => {
  it('nimmt ein Angebot an, das der Anbieter decken kann', () => {
    expect(canOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE)).toBeNull();
  });

  it('lehnt eine leere Seite ab', () => {
    const state = offerer({ lumber: 3 });

    expect(canOfferTrade(state, 'p1', TWO_LUMBER, hand())?.code).toBe(
      RuleViolationCode.INVALID_TRADE,
    );
    expect(canOfferTrade(state, 'p1', hand(), ONE_ORE)?.code).toBe(RuleViolationCode.INVALID_TRADE);
  });

  it('lehnt dieselbe Sorte auf beiden Seiten ab', () => {
    const state = offerer({ lumber: 3 });

    expect(canOfferTrade(state, 'p1', TWO_LUMBER, hand({ lumber: 1, ore: 1 }))?.code).toBe(
      RuleViolationCode.INVALID_TRADE,
    );
  });

  it('lehnt ab, was der Anbieter nicht hat', () => {
    expect(canOfferTrade(offerer({ lumber: 1 }), 'p1', TWO_LUMBER, ONE_ORE)?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('lehnt ab, wer nicht am Zug ist', () => {
    expect(canOfferTrade(offerer({ lumber: 3 }), 'p2', TWO_LUMBER, ONE_ORE)?.code).toBe(
      RuleViolationCode.NOT_YOUR_TURN,
    );
  });
});

describe('canOfferAnything', () => {
  it('stimmt zu, solange der Spieler am Zug ueberhaupt eine Karte hat', () => {
    expect(canOfferAnything(offerer({ lumber: 1 }), 'p1')).toBe(true);
  });

  it('verneint bei leerer Hand und bei fremdem Zug', () => {
    expect(canOfferAnything(offerer({}), 'p1')).toBe(false);
    expect(canOfferAnything(offerer({ lumber: 3 }), 'p2')).toBe(false);
  });
});

describe('applyOfferTrade', () => {
  it('oeffnet die Phase mit leeren Antworten und einer Frist aus dem Regelwerk', () => {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({
      kind: 'tradePending',
      offer: { from: 'p1', give: TWO_LUMBER, want: ONE_ORE },
      responses: {},
      expiresAt: 1_000 + result.state.rules.tradeOfferMs,
    });
  });

  it('nimmt dem Anbieter nichts weg - getauscht wird erst beim Zuschlag', () => {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.resources.lumber).toBe(3);
  });
});

describe('das offene Angebot sperrt den Zug', () => {
  function withOffer(): GameState {
    const result = applyOfferTrade(offerer({ lumber: 3 }), 'p1', TWO_LUMBER, ONE_ORE, 0);
    if (!result.ok) throw new Error('Angebot wurde abgelehnt');
    return result.state;
  }

  it('nimmt keinen Zugwechsel an, solange das Angebot liegt', () => {
    const result = reduce(withOffer(), { type: 'endTurn', player: 'p1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('nimmt kein zweites Angebot an', () => {
    const result = reduce(withOffer(), {
      type: 'offerTrade',
      player: 'p1',
      give: TWO_LUMBER,
      want: ONE_ORE,
      at: 0,
    });

    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`
Expected: FAIL — `Cannot find module './playerTrade.js'`

- [ ] **Step 3: `playerTrade.ts` anlegen**

```ts
import type { ResourceAmounts } from '../rules/index.js';
import { RESOURCE_IDS } from '../scenario/index.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { PlayerId } from './player.js';
import { canAfford, countResources } from './resources.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from './state.js';

/**
 * Handel zwischen Spielern.
 *
 * Getrennt von `trade.ts`, das Bank und Haefen traegt: das sind zwei Regeln mit
 * nichts Gemeinsamem ausser dem Wort Handel, und zusammen waeren sie die
 * groesste Regeldatei im Paket.
 *
 * Der Ablauf ist ein Angebot, das offen liegt (`phase.tradePending`), Antworten
 * der Mitspieler, und ein Zuschlag des Anbieters. Rohstoffe wechseln
 * **ausschliesslich** beim Zuschlag - ein Angebot nimmt niemandem etwas weg.
 */

/** Ob eine Seite des Tauschs ueberhaupt etwas enthaelt. */
function isEmpty(amounts: ResourceAmounts): boolean {
  return countResources(amounts) === 0;
}

/** Ob dieselbe Sorte auf beiden Seiten steht - dann waere ein Teil kein Tausch. */
function overlaps(give: ResourceAmounts, want: ResourceAmounts): boolean {
  return RESOURCE_IDS.some((resource) => give[resource] > 0 && want[resource] > 0);
}

/**
 * Die Form eines Angebots, unabhaengig davon, wer es macht.
 *
 * Dieselbe Pruefung gilt fuer das Angebot und fuer jedes Gegenangebot - deshalb
 * einmal hier und nicht zweimal weiter unten.
 */
function checkShape(
  owner: { readonly resources: ResourceAmounts },
  give: ResourceAmounts,
  want: ResourceAmounts,
): RuleViolation | null {
  if (isEmpty(give) || isEmpty(want)) {
    return violation(
      RuleViolationCode.INVALID_TRADE,
      'Ein Tausch braucht auf beiden Seiten mindestens eine Karte',
    );
  }

  if (overlaps(give, want)) {
    return violation(
      RuleViolationCode.INVALID_TRADE,
      'Dieselbe Sorte auf beiden Seiten waere zum Teil kein Tausch',
    );
  }

  if (!canAfford(owner.resources, give)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Angeboten werden kann nur, was auf der Hand liegt',
    );
  }

  return null;
}

/** Prueft ein Angebot vollstaendig. */
export function canOfferTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceAmounts,
  want: ResourceAmounts,
): RuleViolation | null {
  if (state.phase.kind !== 'main') {
    return violation(RuleViolationCode.WRONG_PHASE, 'Angeboten wird in der Hauptphase');
  }

  if (state.players[state.currentPlayerIndex]?.id !== player) {
    return violation(RuleViolationCode.NOT_YOUR_TURN, `${player} ist nicht am Zug`);
  }

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }

  return checkShape(owner, give, want);
}

/**
 * Ob dieser Spieler jetzt ueberhaupt anbieten duerfte - ohne konkrete Mengen.
 *
 * Die Oberflaeche braucht diese Antwort, bevor der Spieler Mengen gewaehlt hat;
 * `legalActions` kann sie nicht liefern, weil jede Mengenkombination ueber
 * fuenf Sorten Tausende Eintraege waeren (dieselbe Begruendung wie beim
 * Abwerfen).
 */
export function canOfferAnything(state: GameState, player: PlayerId): boolean {
  if (state.phase.kind !== 'main') return false;
  if (state.players[state.currentPlayerIndex]?.id !== player) return false;
  if (state.players.length < 2) return false;

  const owner = findPlayer(state, player);
  return owner !== undefined && countResources(owner.resources) > 0;
}

export function applyOfferTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceAmounts,
  want: ResourceAmounts,
  at: number,
): ReduceResult {
  const problem = canOfferTrade(state, player, give, want);
  if (problem !== null) return rejected(problem);

  return ok({
    ...state,
    phase: {
      kind: 'tradePending',
      offer: { from: player, give, want },
      responses: {},
      // Die Frist entsteht aus dem uebergebenen Zeitpunkt, nie aus einer Uhr:
      // der Reducer ist rein, und `replay` muss dieselbe Frist wieder ergeben.
      expiresAt: at + state.rules.tradeOfferMs,
    },
  });
}
```

- [ ] **Step 4: Aktion ergaenzen**

In `packages/shared/src/game/actions.ts` vor `endTurn` einfuegen:

```ts
  /**
   * Ein Angebot an den Tisch: diese Mengen gegen jene.
   *
   * `at` ist der Zeitpunkt, aus dem die Frist entsteht. Der **Server**
   * ueberschreibt ihn mit seiner eigenen Uhr, bevor der Zug die Logik erreicht -
   * ein Client, der sich zehn Minuten stempelt, hat keine Wirkung.
   */
  z.object({
    ...Base,
    type: z.literal('offerTrade'),
    give: ResourceAmountsSchema,
    want: ResourceAmountsSchema,
    at: z.number().int().min(0),
  }),
```

Den Kopfkommentar der Datei berichtigen — dort steht noch, Handel zwischen
Spielern fehle mit Absicht:

```ts
 * Handel zwischen Spielern kam mit Etappe 8 dazu: `offerTrade` und was danach
 * folgt. Wuerfelergebnisse stehen weiterhin nicht drin - der Client schickt
 * Absichten, keine Ergebnisse (Regel 3).
```

- [ ] **Step 5: Reducer verdrahten**

In `packages/shared/src/game/reducer.ts`:

```ts
import { applyOfferTrade } from './playerTrade.js';
```

`PHASE_ACTIONS`: `'offerTrade'` in `main` aufnehmen (hinter `tradeWithBank`) und
den neuen Eintrag ergaenzen:

```ts
  tradePending: [],
```

In `actorFor`, direkt hinter der Zeile fuer `discardPending`:

```ts
// Wie beim Abwerfen handeln mehrere: der Anbieter und seine Mitspieler. Wer
// genau was darf, prueft `playerTrade.ts`.
if (state.phase.kind === 'tradePending') return null;
```

In `applyAction`:

```ts
    case 'offerTrade':
      return applyOfferTrade(state, action.player, action.give, action.want, action.at);
```

- [ ] **Step 6: Verlaufssatz ergaenzen**

In `packages/shared/src/game/log.ts`, in `describeAction`:

```ts
    case 'offerTrade':
      return `${who} bietet ${resourceList(action.give)} fuer ${resourceList(action.want)}`;
```

- [ ] **Step 7: Barrel ergaenzen**

```ts
export * from './playerTrade.js';
```

- [ ] **Step 8: Tests laufen lassen**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`
Expected: PASS

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/game/playerTrade.ts packages/shared/src/game/playerTrade.test.ts \
        packages/shared/src/game/actions.ts packages/shared/src/game/reducer.ts \
        packages/shared/src/game/log.ts packages/shared/src/game/index.ts
git commit -m "Ein Angebot an den Tisch legen - und der Zug steht still, solange es liegt"
```

---

### Task 3: `respondTrade` — zusagen, ablehnen, und das Verfallen

**Files:**

- Modify: `packages/shared/src/game/playerTrade.ts`
- Modify: `packages/shared/src/game/playerTrade.test.ts`
- Modify: `packages/shared/src/game/actions.ts`
- Modify: `packages/shared/src/game/errors.ts`
- Modify: `packages/shared/src/game/reducer.ts`
- Modify: `packages/shared/src/game/log.ts`

**Interfaces:**

- Consumes: alles aus Task 2.
- Produces:
  - `canRespondTrade(state, player, response: 'accepted' | 'declined'): RuleViolation | null`
  - `applyRespondTrade(state, player, response): ReduceResult`
  - `awaitsResponse(state, player): boolean` (der Server braucht sie in Task 10)
  - `RuleViolationCode.ALREADY_RESPONDED`
  - Aktion `{ type: 'respondTrade', player, response }`

- [ ] **Step 1: Failing tests anhaengen**

An `playerTrade.test.ts` anhaengen (die Hilfsfunktion `offerer` steht oben in
der Datei):

```ts
import { applyRespondTrade, awaitsResponse, canRespondTrade } from './playerTrade.js';

/** Ein offenes Angebot: p1 bietet 2 Holz fuer 1 Erz, p2 und p3 koennen zahlen. */
function tableWithOffer(): GameState {
  const rich = giving(giving(offerer({ lumber: 3 }), 'p2', { ore: 2 }), 'p3', { ore: 2 });
  const result = applyOfferTrade(rich, 'p1', TWO_LUMBER, ONE_ORE, 0);
  if (!result.ok) throw new Error('Angebot wurde abgelehnt');
  return result.state;
}

describe('canRespondTrade', () => {
  it('laesst einen Mitspieler zusagen, der zahlen kann', () => {
    expect(canRespondTrade(tableWithOffer(), 'p2', 'accepted')).toBeNull();
  });

  it('laesst jeden ablehnen, auch ohne die verlangten Karten', () => {
    const poor = giving(tableWithOffer(), 'p2', {});

    expect(canRespondTrade(poor, 'p2', 'declined')).toBeNull();
  });

  it('sperrt die Zusage dessen, der nicht zahlen kann', () => {
    const poor = giving(tableWithOffer(), 'p2', {});

    expect(canRespondTrade(poor, 'p2', 'accepted')?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });

  it('laesst den Anbieter nicht auf sein eigenes Angebot antworten', () => {
    expect(canRespondTrade(tableWithOffer(), 'p1', 'accepted')?.code).toBe(
      RuleViolationCode.NOT_THE_OFFERER,
    );
  });

  it('nimmt keine zweite Antwort an', () => {
    const once = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!once.ok) throw new Error('erste Antwort wurde abgelehnt');

    expect(canRespondTrade(once.state, 'p2', 'accepted')?.code).toBe(
      RuleViolationCode.ALREADY_RESPONDED,
    );
  });
});

describe('das Angebot verfaellt, wenn alle von Hand ablehnen', () => {
  it('bleibt offen, solange noch jemand ueberlegt', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');

    expect(first.state.phase.kind).toBe('tradePending');
  });

  it('geht zurueck in die Hauptphase, sobald der letzte ablehnt', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');
    const second = applyRespondTrade(first.state, 'p3', 'declined');
    if (!second.ok) throw new Error('Antwort wurde abgelehnt');

    expect(second.state.phase).toEqual({ kind: 'main' });
  });

  it('bleibt offen, wenn jemand zugesagt hat', () => {
    const first = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!first.ok) throw new Error('Antwort wurde abgelehnt');
    const second = applyRespondTrade(first.state, 'p3', 'declined');
    if (!second.ok) throw new Error('Antwort wurde abgelehnt');

    expect(second.state.phase.kind).toBe('tradePending');
  });
});

describe('awaitsResponse', () => {
  it('gilt fuer Mitspieler ohne Antwort und fuer den Anbieter nie', () => {
    const state = tableWithOffer();

    expect(awaitsResponse(state, 'p2')).toBe(true);
    expect(awaitsResponse(state, 'p1')).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`
Expected: FAIL — `canRespondTrade is not exported`

- [ ] **Step 3: Fehlercodes ergaenzen**

In `packages/shared/src/game/errors.ts`, hinter `BANK_EMPTY`:

```ts
  /** Nur der Anbieter darf zuschlagen oder zurueckziehen. */
  NOT_THE_OFFERER: 'NOT_THE_OFFERER',
  /** Dieser Spieler hat auf das Angebot schon geantwortet. */
  ALREADY_RESPONDED: 'ALREADY_RESPONDED',
```

- [ ] **Step 4: Regeln ergaenzen**

An `playerTrade.ts` anhaengen:

```ts
import type { Phase } from './phase.js';
import type { TradeResponse } from './tradeOffer.js';

/** Die offene Verhandlung, oder `null`, wenn gerade keine laeuft. */
type TradePhase = Extract<Phase, { kind: 'tradePending' }>;

function openTrade(state: GameState): TradePhase | null {
  return state.phase.kind === 'tradePending' ? state.phase : null;
}

/** Ob dieser Spieler auf ein laufendes Angebot noch antworten muss. */
export function awaitsResponse(state: GameState, player: PlayerId): boolean {
  const trade = openTrade(state);
  if (trade === null) return false;

  return player !== trade.offer.from && trade.responses[player] === undefined;
}

/**
 * Wer antworten darf und ob er es schon getan hat.
 *
 * Gemeinsam fuer Antwort und Gegenangebot: beide sind dieselbe Handlung an
 * derselben Stelle, nur mit anderem Inhalt.
 */
function checkResponder(state: GameState, player: PlayerId): RuleViolation | null {
  const trade = openTrade(state);
  if (trade === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch');
  }

  if (player === trade.offer.from) {
    return violation(
      RuleViolationCode.NOT_THE_OFFERER,
      'Auf das eigene Angebot antwortet man nicht',
    );
  }

  if (findPlayer(state, player) === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }

  if (trade.responses[player] !== undefined) {
    return violation(
      RuleViolationCode.ALREADY_RESPONDED,
      `${player} hat auf dieses Angebot schon geantwortet`,
    );
  }

  return null;
}

export function canRespondTrade(
  state: GameState,
  player: PlayerId,
  response: 'accepted' | 'declined',
): RuleViolation | null {
  const problem = checkResponder(state, player);
  if (problem !== null) return problem;

  if (response === 'declined') return null;

  /*
   * Nur die Zusage verlangt die Karten. Dass diese Pruefung fehlschlaegt, sieht
   * ausschliesslich der Spieler selbst - `legalActions` baut je Empfaenger eine
   * eigene Liste. Ein sichtbares "kann nicht" waere eine Aussage ueber eine
   * verdeckte Hand.
   */
  const trade = openTrade(state)!;
  const owner = findPlayer(state, player)!;
  if (!canAfford(owner.resources, trade.offer.want)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Zusagen kann nur, wer das Verlangte auf der Hand hat',
    );
  }

  return null;
}

/**
 * Traegt eine Antwort ein - und raeumt das Angebot ab, wenn es tot ist.
 *
 * Tot heisst: alle haben geantwortet, niemand hat zugesagt oder gekontert,
 * **und keine der Ablehnungen war automatisch**. Die letzte Bedingung ist der
 * Unterschied zwischen "niemand will" und "gerade ist niemand da" - eine
 * abgerissene Verbindung soll ein Angebot nicht toeten, das gleich wieder
 * jemanden findet.
 */
function withResponse(state: GameState, player: PlayerId, response: TradeResponse): ReduceResult {
  const trade = openTrade(state);
  if (trade === null) {
    return rejected(
      violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch'),
    );
  }

  const responses = { ...trade.responses, [player]: response };
  const others = state.players.filter((entry) => entry.id !== trade.offer.from);

  const complete = others.every((entry) => responses[entry.id] !== undefined);
  const alive = others.some((entry) => {
    const answer = responses[entry.id];
    return answer?.kind === 'accepted' || answer?.kind === 'countered';
  });
  const absent = others.some((entry) => {
    const answer = responses[entry.id];
    return answer?.kind === 'declined' && answer.automatic;
  });

  return ok(
    complete && !alive && !absent
      ? { ...state, phase: { kind: 'main' } }
      : { ...state, phase: { ...trade, responses } },
  );
}

export function applyRespondTrade(
  state: GameState,
  player: PlayerId,
  response: 'accepted' | 'declined',
): ReduceResult {
  const problem = canRespondTrade(state, player, response);
  if (problem !== null) return rejected(problem);

  return withResponse(
    state,
    player,
    response === 'accepted' ? { kind: 'accepted' } : { kind: 'declined', automatic: false },
  );
}
```

- [ ] **Step 5: Aktion, Reducer, Verlauf**

`actions.ts`, hinter `offerTrade`:

```ts
  /** Antwort eines Mitspielers auf ein offenes Angebot. */
  z.object({
    ...Base,
    type: z.literal('respondTrade'),
    response: z.enum(['accepted', 'declined']),
  }),
```

`reducer.ts`: `PHASE_ACTIONS.tradePending = ['respondTrade']`, dazu

```ts
    case 'respondTrade':
      return applyRespondTrade(state, action.player, action.response);
```

`log.ts`:

```ts
    case 'respondTrade':
      return action.response === 'accepted'
        ? `${who} nimmt das Angebot an`
        : `${who} lehnt das Angebot ab`;
```

- [ ] **Step 6: Tests laufen lassen**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`
Expected: PASS

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/game/
git commit -m "Zusagen und Ablehnen - ein Angebot stirbt nur an lauter Neins von Hand"
```

---

### Task 4: `counterTrade` — das Gegenangebot setzt die Frist neu

**Files:**

- Modify: `packages/shared/src/game/playerTrade.ts`
- Modify: `packages/shared/src/game/playerTrade.test.ts`
- Modify: `packages/shared/src/game/actions.ts`
- Modify: `packages/shared/src/game/reducer.ts`
- Modify: `packages/shared/src/game/log.ts`

**Interfaces:**

- Produces:
  - `canCounterTrade(state, player, give, want): RuleViolation | null`
  - `applyCounterTrade(state, player, give, want, at: number): ReduceResult`
  - Aktion `{ type: 'counterTrade', player, give, want, at }`

- [ ] **Step 1: Failing tests anhaengen**

```ts
import { applyCounterTrade, canCounterTrade } from './playerTrade.js';

describe('canCounterTrade', () => {
  it('nimmt ein Gegenangebot an, das der Konternde decken kann', () => {
    expect(
      canCounterTrade(tableWithOffer(), 'p2', hand({ ore: 1 }), hand({ lumber: 3 })),
    ).toBeNull();
  });

  it('lehnt ein Gegenangebot ab, das der Konternde nicht decken kann', () => {
    expect(
      canCounterTrade(tableWithOffer(), 'p2', hand({ ore: 5 }), hand({ lumber: 3 }))?.code,
    ).toBe(RuleViolationCode.INSUFFICIENT_RESOURCES);
  });

  it('prueft dieselbe Form wie beim Angebot', () => {
    expect(canCounterTrade(tableWithOffer(), 'p2', hand({ ore: 1 }), hand())?.code).toBe(
      RuleViolationCode.INVALID_TRADE,
    );
  });

  /*
   * Ob der Anbieter das Gegenangebot bezahlen koennte, wird hier NICHT geprueft:
   * eine Ablehnung aus diesem Grund verriete dem Konternden etwas ueber die
   * verdeckte Hand des Anbieters. Geprueft wird es beim Zuschlag (Aufgabe 5).
   */
  it('fragt nicht, ob der Anbieter zahlen koennte', () => {
    const brokeOfferer = giving(tableWithOffer(), 'p1', { lumber: 2 });

    expect(canCounterTrade(brokeOfferer, 'p2', hand({ ore: 1 }), hand({ lumber: 9 }))).toBeNull();
  });
});

describe('applyCounterTrade', () => {
  it('traegt das Gegenangebot als Antwort ein und setzt die Frist neu', () => {
    const state = tableWithOffer();
    const before = state.phase.kind === 'tradePending' ? state.phase.expiresAt : 0;

    const result = applyCounterTrade(state, 'p2', hand({ ore: 1 }), hand({ lumber: 3 }), 30_000);

    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'tradePending') return;
    expect(result.state.phase.responses.p2).toEqual({
      kind: 'countered',
      give: hand({ ore: 1 }),
      want: hand({ lumber: 3 }),
    });
    expect(result.state.phase.expiresAt).toBe(30_000 + result.state.rules.tradeOfferMs);
    expect(result.state.phase.expiresAt).toBeGreaterThan(before);
  });

  it('haelt das Angebot offen, auch wenn alle anderen abgelehnt haben', () => {
    const declined = applyRespondTrade(tableWithOffer(), 'p3', 'declined');
    if (!declined.ok) throw new Error('Antwort wurde abgelehnt');

    const result = applyCounterTrade(
      declined.state,
      'p2',
      hand({ ore: 1 }),
      hand({ lumber: 3 }),
      0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase.kind).toBe('tradePending');
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`
Expected: FAIL — `canCounterTrade is not exported`

- [ ] **Step 3: Regeln ergaenzen**

An `playerTrade.ts` anhaengen:

```ts
/**
 * Ein Gegenangebot ist die Antwort dieses Spielers - nicht ein zweites Angebot.
 *
 * Geprueft wird nur, was der Konternde selbst aufbringen muss. Ob der Anbieter
 * zahlen koennte, bleibt offen bis zum Zuschlag: eine Ablehnung aus diesem
 * Grund verriete etwas ueber seine verdeckte Hand.
 */
export function canCounterTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceAmounts,
  want: ResourceAmounts,
): RuleViolation | null {
  const problem = checkResponder(state, player);
  if (problem !== null) return problem;

  return checkShape(findPlayer(state, player)!, give, want);
}

export function applyCounterTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceAmounts,
  want: ResourceAmounts,
  at: number,
): ReduceResult {
  const problem = canCounterTrade(state, player, give, want);
  if (problem !== null) return rejected(problem);

  const answered = withResponse(state, player, { kind: 'countered', give, want });
  if (!answered.ok) return answered;

  /*
   * Die Frist laeuft neu. Ein Gegenangebot ist eine neue Frage an den Anbieter,
   * und er soll dieselbe Bedenkzeit haben wie der Tisch vorher.
   */
  const trade = openTrade(answered.state);
  if (trade === null) return answered;

  return ok({
    ...answered.state,
    phase: { ...trade, expiresAt: at + state.rules.tradeOfferMs },
  });
}
```

- [ ] **Step 4: Aktion, Reducer, Verlauf**

`actions.ts`:

```ts
  /** Gegenangebot: die Antwort dieses Spielers mit eigenen Mengen. */
  z.object({
    ...Base,
    type: z.literal('counterTrade'),
    give: ResourceAmountsSchema,
    want: ResourceAmountsSchema,
    at: z.number().int().min(0),
  }),
```

`reducer.ts`: `'counterTrade'` in `PHASE_ACTIONS.tradePending`, dazu

```ts
    case 'counterTrade':
      return applyCounterTrade(state, action.player, action.give, action.want, action.at);
```

`log.ts`:

```ts
    case 'counterTrade':
      return `${who} haelt dagegen: ${resourceList(action.give)} fuer ${resourceList(action.want)}`;
```

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/game/
git commit -m "Gegenangebote: die Antwort mit eigenen Mengen, und die Frist laeuft neu"
```

---

### Task 5: `acceptTrade` und `withdrawTrade` — der Zuschlag

**Files:**

- Modify: `packages/shared/src/game/playerTrade.ts`
- Modify: `packages/shared/src/game/playerTrade.test.ts`
- Modify: `packages/shared/src/game/actions.ts`
- Modify: `packages/shared/src/game/errors.ts`
- Modify: `packages/shared/src/game/reducer.ts`
- Modify: `packages/shared/src/game/log.ts`

**Interfaces:**

- Produces:
  - `termsFor(state, partner): { partnerGives: ResourceAmounts; partnerGets: ResourceAmounts } | null`
  - `canAcceptTrade(state, player, partner): RuleViolation | null`
  - `applyAcceptTrade(state, player, partner): ReduceResult`
  - `canWithdrawTrade(state, player): RuleViolation | null`
  - `applyWithdrawTrade(state, player): ReduceResult`
  - `RuleViolationCode.PARTNER_DID_NOT_ACCEPT`
  - Aktionen `{ type: 'acceptTrade', player, partner }`, `{ type: 'withdrawTrade', player }`

- [ ] **Step 1: Failing tests anhaengen**

```ts
import { applyAcceptTrade, applyWithdrawTrade, canAcceptTrade, termsFor } from './playerTrade.js';

function resourcesOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!.resources;
}

describe('acceptTrade auf eine Zusage', () => {
  function accepted(): GameState {
    const answered = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!answered.ok) throw new Error('Antwort wurde abgelehnt');
    return answered.state;
  }

  it('bewegt genau die Mengen des Angebots', () => {
    const result = applyAcceptTrade(accepted(), 'p1', 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resourcesOf(result.state, 'p1')).toEqual(hand({ lumber: 1, ore: 1 }));
    expect(resourcesOf(result.state, 'p2')).toEqual(hand({ lumber: 2, ore: 1 }));
  });

  it('laesst die Bank unberuehrt - das ist kein Bankgeschaeft', () => {
    const before = accepted();
    const result = applyAcceptTrade(before, 'p1', 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bank).toEqual(before.bank);
  });

  it('gibt den Zug zurueck in die Hauptphase', () => {
    const result = applyAcceptTrade(accepted(), 'p1', 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
  });

  it('nimmt nur vom Anbieter einen Zuschlag an', () => {
    expect(canAcceptTrade(accepted(), 'p3', 'p2')?.code).toBe(RuleViolationCode.NOT_THE_OFFERER);
  });

  it('lehnt einen Zuschlag an jemanden ohne Zusage ab', () => {
    expect(canAcceptTrade(accepted(), 'p1', 'p3')?.code).toBe(
      RuleViolationCode.PARTNER_DID_NOT_ACCEPT,
    );
  });
});

describe('acceptTrade auf ein Gegenangebot', () => {
  function countered(): GameState {
    const answered = applyCounterTrade(
      tableWithOffer(),
      'p2',
      hand({ ore: 2 }),
      hand({ lumber: 3 }),
      0,
    );
    if (!answered.ok) throw new Error('Gegenangebot wurde abgelehnt');
    return answered.state;
  }

  it('bewegt die Mengen des Gegenangebots, nicht die des Originals', () => {
    const result = applyAcceptTrade(countered(), 'p1', 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resourcesOf(result.state, 'p1')).toEqual(hand({ ore: 2 }));
    expect(resourcesOf(result.state, 'p2')).toEqual(hand({ lumber: 3 }));
  });

  it('lehnt ab, wenn der Anbieter das Gegenangebot nicht decken kann', () => {
    const greedy = applyCounterTrade(
      tableWithOffer(),
      'p2',
      hand({ ore: 1 }),
      hand({ lumber: 9 }),
      0,
    );
    if (!greedy.ok) throw new Error('Gegenangebot wurde abgelehnt');

    expect(canAcceptTrade(greedy.state, 'p1', 'p2')?.code).toBe(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
    );
  });
});

describe('termsFor', () => {
  it('kennt bei einer Zusage die Seiten des Originalangebots', () => {
    const answered = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!answered.ok) throw new Error('Antwort wurde abgelehnt');

    expect(termsFor(answered.state, 'p2')).toEqual({
      partnerGives: ONE_ORE,
      partnerGets: TWO_LUMBER,
    });
  });
});

describe('withdrawTrade', () => {
  it('raeumt das Angebot ab, ohne etwas zu bewegen', () => {
    const before = tableWithOffer();
    const result = applyWithdrawTrade(before, 'p1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
    expect(resourcesOf(result.state, 'p1')).toEqual(resourcesOf(before, 'p1'));
  });

  it('nimmt das nur vom Anbieter an', () => {
    const result = applyWithdrawTrade(tableWithOffer(), 'p2');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.NOT_THE_OFFERER);
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`
Expected: FAIL — `canAcceptTrade is not exported`

- [ ] **Step 3: Fehlercode ergaenzen**

In `errors.ts`:

```ts
  /** Der genannte Partner hat weder zugesagt noch gekontert. */
  PARTNER_DID_NOT_ACCEPT: 'PARTNER_DID_NOT_ACCEPT',
```

- [ ] **Step 4: Regeln ergaenzen**

An `playerTrade.ts` anhaengen (`addResources`/`subtractResources` in den Import
aus `resources.js` aufnehmen, `withPlayer` aus `state.js`):

```ts
/**
 * Was beim Zuschlag mit diesem Partner in welche Richtung geht.
 *
 * Bei einer Zusage gelten die Seiten des Angebots, bei einem Gegenangebot
 * dessen eigene. Deshalb traegt `acceptTrade` keine Mengen: sie stehen bereits
 * im Zustand, und ein Client, der sie mitschickte, koennte sie erfinden.
 */
export function termsFor(
  state: GameState,
  partner: PlayerId,
): { readonly partnerGives: ResourceAmounts; readonly partnerGets: ResourceAmounts } | null {
  const trade = openTrade(state);
  if (trade === null) return null;

  const answer = trade.responses[partner];
  if (answer === undefined) return null;

  if (answer.kind === 'accepted') {
    return { partnerGives: trade.offer.want, partnerGets: trade.offer.give };
  }
  if (answer.kind === 'countered') {
    return { partnerGives: answer.give, partnerGets: answer.want };
  }

  return null;
}

export function canAcceptTrade(
  state: GameState,
  player: PlayerId,
  partner: PlayerId,
): RuleViolation | null {
  const trade = openTrade(state);
  if (trade === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch');
  }

  if (player !== trade.offer.from) {
    return violation(RuleViolationCode.NOT_THE_OFFERER, 'Nur der Anbieter schlaegt zu');
  }

  const terms = termsFor(state, partner);
  if (terms === null) {
    return violation(
      RuleViolationCode.PARTNER_DID_NOT_ACCEPT,
      `${partner} hat weder zugesagt noch gekontert`,
    );
  }

  const owner = findPlayer(state, player);
  const other = findPlayer(state, partner);
  if (owner === undefined || other === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, 'Einer der beiden sitzt nicht am Tisch');
  }

  /*
   * Waehrend `tradePending` kann sich an keiner Hand etwas aendern - trotzdem
   * geprueft. Eine Regel, die sich auf eine andere verlaesst, wird beim
   * naechsten Umbau still falsch.
   */
  if (!canAfford(owner.resources, terms.partnerGets)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Der Anbieter kann diesen Tausch nicht mehr decken',
    );
  }
  if (!canAfford(other.resources, terms.partnerGives)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `${partner} kann diesen Tausch nicht mehr decken`,
    );
  }

  return null;
}

export function applyAcceptTrade(
  state: GameState,
  player: PlayerId,
  partner: PlayerId,
): ReduceResult {
  const problem = canAcceptTrade(state, player, partner);
  if (problem !== null) return rejected(problem);

  const terms = termsFor(state, partner)!;

  const afterOfferer = withPlayer(state, player, (entry) => ({
    ...entry,
    resources: addResources(
      subtractResources(entry.resources, terms.partnerGets),
      terms.partnerGives,
    ),
  }));

  return ok({
    ...state,
    players: afterOfferer.map((entry) =>
      entry.id === partner
        ? {
            ...entry,
            resources: addResources(
              subtractResources(entry.resources, terms.partnerGives),
              terms.partnerGets,
            ),
          }
        : entry,
    ),
    phase: { kind: 'main' },
  });
}

export function canWithdrawTrade(state: GameState, player: PlayerId): RuleViolation | null {
  const trade = openTrade(state);
  if (trade === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch');
  }

  return player === trade.offer.from
    ? null
    : violation(RuleViolationCode.NOT_THE_OFFERER, 'Nur der Anbieter nimmt sein Angebot zurueck');
}

export function applyWithdrawTrade(state: GameState, player: PlayerId): ReduceResult {
  const problem = canWithdrawTrade(state, player);
  if (problem !== null) return rejected(problem);

  return ok({ ...state, phase: { kind: 'main' } });
}
```

**Achtung:** `withPlayer` gibt die Spielerliste zurueck, nicht den Zustand —
siehe `state.ts`. Der Code oben nutzt das so.

- [ ] **Step 5: Aktionen, Reducer, Verlauf**

`actions.ts`:

```ts
  /**
   * Zuschlag an einen Partner. **Ohne Mengen** - die stehen in seiner Antwort.
   */
  z.object({ ...Base, type: z.literal('acceptTrade'), partner: PlayerIdSchema }),

  /** Der Anbieter nimmt sein Angebot zurueck. */
  z.object({ ...Base, type: z.literal('withdrawTrade') }),
```

`reducer.ts`: `'acceptTrade'`, `'withdrawTrade'` in `PHASE_ACTIONS.tradePending`,
dazu

```ts
    case 'acceptTrade':
      return applyAcceptTrade(state, action.player, action.partner);
    case 'withdrawTrade':
      return applyWithdrawTrade(state, action.player);
```

`log.ts` (`nameOf` steht dort schon zur Verfuegung):

```ts
    case 'acceptTrade':
      return `${who} tauscht mit ${nameOf(action.partner)}`;
    case 'withdrawTrade':
      return `${who} nimmt das Angebot zurueck`;
```

- [ ] **Step 6: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/game/
git commit -m "Der Zuschlag holt die Mengen aus der Antwort - und die Bank bleibt aussen vor"
```

---

### Task 6: Frist — `deadlineOf` und `timeout`

**Files:**

- Create: `packages/shared/src/game/deadline.ts`
- Modify: `packages/shared/src/game/playerTrade.ts`
- Modify: `packages/shared/src/game/playerTrade.test.ts`
- Modify: `packages/shared/src/game/actions.ts`
- Modify: `packages/shared/src/game/errors.ts`
- Modify: `packages/shared/src/game/reducer.ts`
- Modify: `packages/shared/src/game/log.ts`
- Modify: `packages/shared/src/game/index.ts`

**Interfaces:**

- Produces:
  - `deadlineOf(state): { at: number; owner: PlayerId } | null`
  - `canTimeout(state, at): RuleViolation | null`
  - `applyTimeout(state, at): ReduceResult`
  - `RuleViolationCode.DEADLINE_NOT_REACHED`
  - Aktion `{ type: 'timeout', player, at }`

- [ ] **Step 1: Failing tests anhaengen**

```ts
import { deadlineOf } from './deadline.js';
import { applyTimeout, canTimeout } from './playerTrade.js';

describe('deadlineOf', () => {
  it('nennt Frist und Eigentuemer, solange ein Angebot laeuft', () => {
    const state = tableWithOffer();
    const expected = state.phase.kind === 'tradePending' ? state.phase.expiresAt : -1;

    expect(deadlineOf(state)).toEqual({ at: expected, owner: 'p1' });
  });

  it('nennt nichts in der Hauptphase', () => {
    expect(deadlineOf(testGame())).toBeNull();
  });
});

describe('timeout', () => {
  it('wird abgelehnt, solange die Frist laeuft', () => {
    expect(canTimeout(tableWithOffer(), 1_000)?.code).toBe(RuleViolationCode.DEADLINE_NOT_REACHED);
  });

  it('raeumt das Angebot ab, sobald die Frist um ist', () => {
    const state = tableWithOffer();
    const due = state.phase.kind === 'tradePending' ? state.phase.expiresAt : 0;

    const result = applyTimeout(state, due);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
  });

  it('bewegt dabei nichts', () => {
    const state = tableWithOffer();
    const due = state.phase.kind === 'tradePending' ? state.phase.expiresAt : 0;

    const result = applyTimeout(state, due);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resourcesOf(result.state, 'p1')).toEqual(resourcesOf(state, 'p1'));
    expect(resourcesOf(result.state, 'p2')).toEqual(resourcesOf(state, 'p2'));
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`
Expected: FAIL — `Cannot find module './deadline.js'`

- [ ] **Step 3: `deadline.ts` anlegen**

```ts
import type { PlayerId } from './player.js';
import type { GameState } from './state.js';

/**
 * Die laufende Frist und wem sie gehoert - oder `null`.
 *
 * Die eine Stelle, an der ausserhalb der Logik nachgesehen wird, ob gerade eine
 * Uhr laeuft. Der Wecker im Server liest nur diese Funktion; ein zweites
 * Zeitlimit (Abwurffrist, Zugzeit) ergaenzt hier einen Zweig und sonst nichts.
 *
 * `owner` ist der, dessen Frist es ist - er steht spaeter im Verlaufssatz.
 */
export function deadlineOf(state: GameState): { at: number; owner: PlayerId } | null {
  if (state.phase.kind === 'tradePending') {
    return { at: state.phase.expiresAt, owner: state.phase.offer.from };
  }

  return null;
}
```

- [ ] **Step 4: Fehlercode und Regeln ergaenzen**

`errors.ts`:

```ts
  /** Die Frist laeuft noch - es gibt nichts abzulaeuten. */
  DEADLINE_NOT_REACHED: 'DEADLINE_NOT_REACHED',
```

An `playerTrade.ts` anhaengen:

```ts
/**
 * Der Fristablauf.
 *
 * Keine Absicht eines Spielers, sondern das Ende einer Uhr - deshalb wirft nur
 * der Server diese Aktion ein. Geprueft wird trotzdem gegen den Zustand: eine
 * Frist, die noch laeuft, laesst sich nicht abkuerzen, auch nicht vom Server.
 */
export function canTimeout(state: GameState, at: number): RuleViolation | null {
  const due = deadlineOf(state);
  if (due === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Gerade laeuft keine Frist');
  }

  return at >= due.at
    ? null
    : violation(RuleViolationCode.DEADLINE_NOT_REACHED, 'Die Frist laeuft noch');
}

export function applyTimeout(state: GameState, at: number): ReduceResult {
  const problem = canTimeout(state, at);
  if (problem !== null) return rejected(problem);

  return ok({ ...state, phase: { kind: 'main' } });
}
```

mit `import { deadlineOf } from './deadline.js';` am Kopf.

- [ ] **Step 5: Aktion, Reducer, Verlauf, Barrel**

`actions.ts`:

```ts
  /**
   * Eine Frist ist abgelaufen. **Nur der Server wirft das ein** - der Handler
   * weist die Aktion ab, wenn sie von einem Client kommt.
   *
   * `player` ist, wem die Frist gehoerte: beim Angebot der Anbieter.
   */
  z.object({ ...Base, type: z.literal('timeout'), at: z.number().int().min(0) }),
```

`reducer.ts`: `'timeout'` in `PHASE_ACTIONS.tradePending`, dazu

```ts
    case 'timeout':
      return applyTimeout(state, action.at);
```

`log.ts`:

```ts
    case 'timeout':
      return `Die Zeit fuer ${who}s Angebot ist abgelaufen`;
```

`index.ts`:

```ts
export * from './deadline.js';
```

- [ ] **Step 6: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/game/
git commit -m "Die Frist als Zustand, ihr Ablauf als Aktion - der Reducer liest keine Uhr"
```

---

### Task 7: Verbindungsverlust — `dropFromTrade` und `rejoinTrade`

**Files:**

- Modify: `packages/shared/src/game/playerTrade.ts`
- Modify: `packages/shared/src/game/playerTrade.test.ts`
- Modify: `packages/shared/src/game/actions.ts`
- Modify: `packages/shared/src/game/reducer.ts`
- Modify: `packages/shared/src/game/log.ts`

**Interfaces:**

- Produces:
  - `hasAutomaticDecline(state, player): boolean`
  - `applyDropFromTrade(state, player): ReduceResult`
  - `applyRejoinTrade(state, player): ReduceResult`
  - Aktionen `{ type: 'dropFromTrade', player }`, `{ type: 'rejoinTrade', player }`

- [ ] **Step 1: Failing tests anhaengen**

```ts
import { applyDropFromTrade, applyRejoinTrade, hasAutomaticDecline } from './playerTrade.js';

describe('dropFromTrade', () => {
  it('traegt eine automatische Ablehnung ein', () => {
    const result = applyDropFromTrade(tableWithOffer(), 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'tradePending') return;
    expect(result.state.phase.responses.p2).toEqual({ kind: 'declined', automatic: true });
  });

  it('haelt das Angebot offen, auch wenn damit alle abgelehnt haben', () => {
    const first = applyDropFromTrade(tableWithOffer(), 'p2');
    if (!first.ok) throw new Error('Abmeldung wurde abgelehnt');
    const second = applyRespondTrade(first.state, 'p3', 'declined');

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // Eine automatische Ablehnung ist kein Nein - der Weggebrochene kann
    // zurueckkommen und noch antworten.
    expect(second.state.phase.kind).toBe('tradePending');
  });

  it('ruehrt eine Antwort von Hand nicht an', () => {
    const said = applyRespondTrade(tableWithOffer(), 'p2', 'accepted');
    if (!said.ok) throw new Error('Antwort wurde abgelehnt');

    const result = applyDropFromTrade(said.state, 'p2');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.ALREADY_RESPONDED);
  });
});

describe('rejoinTrade', () => {
  it('nimmt die automatische Ablehnung zurueck', () => {
    const gone = applyDropFromTrade(tableWithOffer(), 'p2');
    if (!gone.ok) throw new Error('Abmeldung wurde abgelehnt');

    const result = applyRejoinTrade(gone.state, 'p2');

    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'tradePending') return;
    expect(result.state.phase.responses.p2).toBeUndefined();
  });

  it('laesst eine Ablehnung von Hand stehen', () => {
    const said = applyRespondTrade(tableWithOffer(), 'p2', 'declined');
    if (!said.ok) throw new Error('Antwort wurde abgelehnt');

    const result = applyRejoinTrade(said.state, 'p2');

    expect(result.ok).toBe(false);
  });
});

describe('hasAutomaticDecline', () => {
  it('erkennt genau die automatische Ablehnung', () => {
    const gone = applyDropFromTrade(tableWithOffer(), 'p2');
    if (!gone.ok) throw new Error('Abmeldung wurde abgelehnt');

    expect(hasAutomaticDecline(gone.state, 'p2')).toBe(true);
    expect(hasAutomaticDecline(gone.state, 'p3')).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/playerTrade.test.ts`
Expected: FAIL — `applyDropFromTrade is not exported`

- [ ] **Step 3: Regeln ergaenzen**

An `playerTrade.ts` anhaengen:

```ts
/** Ob dieser Spieler eine Ablehnung traegt, die er nie ausgesprochen hat. */
export function hasAutomaticDecline(state: GameState, player: PlayerId): boolean {
  const trade = openTrade(state);
  const answer = trade?.responses[player];

  return answer?.kind === 'declined' && answer.automatic;
}

/**
 * Wer die Verbindung verliert, lehnt ab - vorlaeufig.
 *
 * Der Spielzustand kennt keine Verbindungen; der Raum kennt sie. Deshalb kommt
 * der Abbruch als Aktion vom Server herein und nicht als heimliches Wissen in
 * der Regel. Wer schon von Hand geantwortet hat, bleibt unangetastet - er hat
 * gesprochen, und Gesprochenes wird nicht ueberschrieben.
 */
export function applyDropFromTrade(state: GameState, player: PlayerId): ReduceResult {
  const problem = checkResponder(state, player);
  if (problem !== null) return rejected(problem);

  return withResponse(state, player, { kind: 'declined', automatic: true });
}

/**
 * Wer zurueckkommt, darf wieder antworten.
 *
 * Nimmt ausschliesslich die automatische Ablehnung zurueck - eine von Hand
 * gesprochene ueberlebt jedes Weg und Wieder-da.
 */
export function applyRejoinTrade(state: GameState, player: PlayerId): ReduceResult {
  const trade = openTrade(state);
  if (trade === null) {
    return rejected(
      violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch'),
    );
  }

  if (!hasAutomaticDecline(state, player)) {
    return rejected(
      violation(
        RuleViolationCode.ALREADY_RESPONDED,
        `${player} traegt keine automatische Ablehnung`,
      ),
    );
  }

  const responses = { ...trade.responses };
  delete responses[player];

  return ok({ ...state, phase: { ...trade, responses } });
}
```

- [ ] **Step 4: Aktionen, Reducer, Verlauf**

`actions.ts`:

```ts
  /**
   * Verbindungsverlust waehrend eines Angebots. **Nur vom Server.**
   *
   * `player` ist der Weggebrochene, nicht der Absender - genau deshalb kann
   * diese Aktion nicht ueber den gewoehnlichen Eingang kommen, der prueft, dass
   * beide dieselbe Person sind.
   */
  z.object({ ...Base, type: z.literal('dropFromTrade') }),

  /** Rueckkehr waehrend desselben Angebots. **Nur vom Server.** */
  z.object({ ...Base, type: z.literal('rejoinTrade') }),
```

`reducer.ts`: beide in `PHASE_ACTIONS.tradePending`, dazu

```ts
    case 'dropFromTrade':
      return applyDropFromTrade(state, action.player);
    case 'rejoinTrade':
      return applyRejoinTrade(state, action.player);
```

`log.ts`:

```ts
    case 'dropFromTrade':
      return `${who} ist nicht mehr da und antwortet nicht`;
    case 'rejoinTrade':
      return `${who} ist zurueck und kann noch antworten`;
```

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/game/
git commit -m "Verbindungsverlust lehnt vorlaeufig ab - die Rueckkehr nimmt es zurueck"
```

---

### Task 8: `legalActions` und `canOfferTrade` in der Sicht

**Files:**

- Modify: `packages/shared/src/game/legal.ts`
- Modify: `packages/shared/src/game/legal.test.ts`
- Modify: `packages/shared/src/game/playerView.ts`
- Modify: `packages/shared/src/game/playerView.test.ts`

**Interfaces:**

- Consumes: alle `can…` aus Tasks 2–7.
- Produces: `PlayerView.canOfferTrade: boolean`; Zuege in `tradePending`.

- [ ] **Step 1: Failing tests anhaengen**

An `packages/shared/src/game/legal.test.ts`:

```ts
import { applyOfferTrade, applyRespondTrade } from './playerTrade.js';
import { giving, hand } from './fixtures.js';

describe('legalActions in tradePending', () => {
  function offered() {
    const rich = giving(giving(testGame(), 'p1', { lumber: 3 }), 'p2', { ore: 2 });
    const result = applyOfferTrade(rich, 'p1', hand({ lumber: 2 }), hand({ ore: 1 }), 0);
    if (!result.ok) throw new Error('Angebot wurde abgelehnt');
    return result.state;
  }

  it('bietet dem Mitspieler mit Karten beide Antworten an', () => {
    const types = legalActions(offered(), 'p2').map((action) => action.type);

    expect(types).toEqual(['respondTrade', 'respondTrade']);
  });

  it('bietet dem Mitspieler ohne die verlangten Karten nur die Ablehnung an', () => {
    const poor = giving(offered(), 'p2', {});
    const actions = legalActions(poor, 'p2');

    expect(actions).toEqual([{ type: 'respondTrade', player: 'p2', response: 'declined' }]);
  });

  it('gibt dem Anbieter das Zuruecknehmen und keinen Zuschlag ohne Zusage', () => {
    const actions = legalActions(offered(), 'p1');

    expect(actions).toEqual([{ type: 'withdrawTrade', player: 'p1' }]);
  });

  it('gibt dem Anbieter je Zusage einen Zuschlag', () => {
    const answered = applyRespondTrade(offered(), 'p2', 'accepted');
    if (!answered.ok) throw new Error('Antwort wurde abgelehnt');

    expect(legalActions(answered.state, 'p1')).toEqual([
      { type: 'acceptTrade', player: 'p1', partner: 'p2' },
      { type: 'withdrawTrade', player: 'p1' },
    ]);
  });
});
```

An `packages/shared/src/game/playerView.test.ts`:

```ts
describe('canOfferTrade in der Sicht', () => {
  it('steht beim Spieler am Zug mit Karten', () => {
    const state = giving(testGame(), 'p1', { lumber: 1 });

    expect(playerViewOf(state, 'p1', seats, 0).canOfferTrade).toBe(true);
    expect(playerViewOf(state, 'p2', seats, 0).canOfferTrade).toBe(false);
  });
});
```

(`seats` und `giving` sind in dieser Datei bereits im Gebrauch — den
vorhandenen Aufbau der Datei weiterverwenden, nicht neu erfinden.)

- [ ] **Step 2: Tests laufen lassen — sie muessen scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/legal.test.ts src/game/playerView.test.ts`
Expected: FAIL

- [ ] **Step 3: `legalActions` fuellen**

In `legal.ts` den Zweig aus Task 1 ersetzen:

```ts
    case 'tradePending': {
      const trade = state.phase;

      if (player === trade.offer.from) {
        for (const other of state.players) {
          if (other.id === trade.offer.from) continue;
          if (canAcceptTrade(state, player, other.id) === null) {
            actions.push({ type: 'acceptTrade', player, partner: other.id });
          }
        }
        actions.push({ type: 'withdrawTrade', player });
        return actions;
      }

      for (const response of ['accepted', 'declined'] as const) {
        if (canRespondTrade(state, player, response) === null) {
          actions.push({ type: 'respondTrade', player, response });
        }
      }
      return actions;

      /*
       * Nicht aufgezaehlt: `counterTrade` (jede Mengenkombination waere ein
       * eigener Eintrag - wie `offerTrade`), und `timeout`, `dropFromTrade`,
       * `rejoinTrade`, weil sie niemandes Absicht sind, sondern vom Server
       * kommen.
       */
    }
```

mit den Importen:

```ts
import { canAcceptTrade, canRespondTrade } from './playerTrade.js';
```

- [ ] **Step 4: `canOfferTrade` in die Sicht**

In `playerView.ts` das Schemafeld hinter `playableCards` ergaenzen:

```ts
  /**
   * Ob der Empfaenger jetzt ein Angebot machen duerfte.
   *
   * Steht hier und nicht in der Aktionsliste, weil ein Angebot Mengen braucht -
   * jede Kombination ueber fuenf Sorten aufzuzaehlen waeren Tausende Eintraege,
   * dieselbe Begruendung wie beim Abwerfen.
   */
  canOfferTrade: z.boolean(),
```

und im Aufbau:

```ts
    canOfferTrade: canOfferAnything(state, viewer),
```

mit `import { canOfferAnything } from './playerTrade.js';`

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen — **Achtung:** bestehende Client-Tests, die eine `PlayerView`
von Hand bauen, brauchen jetzt `canOfferTrade`. Der Compiler nennt sie alle.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/game/ apps/client/src/
git commit -m "Die Zuege der Verhandlung aufzaehlen - und ein Ja/Nein fuer den Angebotsknopf"
```

---

### Task 9: Integrationstest und Replay in `shared`

**Files:**

- Modify: `packages/shared/src/game/game.integration.test.ts`
- Modify: `packages/shared/src/game/log.test.ts`

- [ ] **Step 1: Verlaufstests anhaengen**

An `log.test.ts`:

```ts
describe('Verlaufssaetze zum Spielerhandel', () => {
  it('nennt beide Seiten beim Angebot und den Partner beim Zuschlag', () => {
    const rich = giving(giving(testGame(), 'p1', { lumber: 3 }), 'p2', { ore: 2 });

    const offered = reduce(rich, {
      type: 'offerTrade',
      player: 'p1',
      give: hand({ lumber: 2 }),
      want: hand({ ore: 1 }),
      at: 0,
    });
    if (!offered.ok) throw new Error('Angebot wurde abgelehnt');

    expect(
      describeTransition(
        rich,
        {
          type: 'offerTrade',
          player: 'p1',
          give: hand({ lumber: 2 }),
          want: hand({ ore: 1 }),
          at: 0,
        },
        offered.state,
        seats,
      ),
    ).toContain('bietet');

    const answered = reduce(offered.state, {
      type: 'respondTrade',
      player: 'p2',
      response: 'accepted',
    });
    if (!answered.ok) throw new Error('Antwort wurde abgelehnt');

    const done = reduce(answered.state, { type: 'acceptTrade', player: 'p1', partner: 'p2' });
    if (!done.ok) throw new Error('Zuschlag wurde abgelehnt');

    expect(
      describeTransition(
        answered.state,
        { type: 'acceptTrade', player: 'p1', partner: 'p2' },
        done.state,
        seats,
      ),
    ).toBe('Spieler 1 tauscht mit Spieler 2');
  });
});
```

(Namen und `seats` aus dem bestehenden Aufbau der Datei uebernehmen.)

- [ ] **Step 2: Integrationstest anhaengen**

An `game.integration.test.ts` einen Durchlauf mit Handel ergaenzen: Angebot,
eine Ablehnung, eine Zusage, Zuschlag — und danach die Feststellung, dass
`replay` aus Startzustand und Aktionsfolge exakt denselben Zustand ergibt:

```ts
it('spielt einen Spielerhandel und stellt ihn per replay wieder her', () => {
  const start = giving(giving(testGame(), 'p1', { lumber: 3 }), 'p2', { ore: 2 });

  const actions: GameAction[] = [
    { type: 'offerTrade', player: 'p1', give: hand({ lumber: 2 }), want: hand({ ore: 1 }), at: 5 },
    { type: 'respondTrade', player: 'p3', response: 'declined' },
    { type: 'respondTrade', player: 'p2', response: 'accepted' },
    { type: 'acceptTrade', player: 'p1', partner: 'p2' },
  ];

  const played = actions.reduce<GameState>((state, action) => {
    const result = reduce(state, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.error.message}`);
    return result.state;
  }, start);

  expect(played.phase).toEqual({ kind: 'main' });
  expect(replay(start, actions)).toEqual(played);
});
```

- [ ] **Step 3: Ein offenes Angebot uebersteht `replay`**

Ebenfalls anhaengen:

```ts
it('stellt ein offenes Angebot samt Frist wieder her', () => {
  const start = giving(testGame(), 'p1', { lumber: 3 });
  const actions: GameAction[] = [
    { type: 'offerTrade', player: 'p1', give: hand({ lumber: 2 }), want: hand({ ore: 1 }), at: 5 },
  ];

  const restored = replay(start, actions);

  expect(restored.phase.kind).toBe('tradePending');
  if (restored.phase.kind !== 'tradePending') return;
  expect(restored.phase.expiresAt).toBe(5 + start.rules.tradeOfferMs);
});
```

- [ ] **Step 4: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/
git commit -m "Ein Handel im Durchlauf - und die Frist kommt aus dem Log zurueck"
```

---

### Task 10: Protokoll und Systemaktionen im Server

**Files:**

- Modify: `packages/shared/src/protocol/events.ts`
- Modify: `packages/shared/src/game/actions.ts` (`stampAction`, `isSystemAction`)
- Modify: `packages/shared/src/game/actions.test.ts` (anlegen, falls nicht vorhanden)
- Modify: `apps/server/src/rooms/broadcast.ts`
- Modify: `apps/server/src/rooms/room.ts`
- Modify: `apps/server/src/rooms/room.test.ts`
- Modify: `apps/server/src/ws/handlers/room.ts`

**Interfaces:**

- Produces:
  - `stampAction(action: GameAction, at: number): GameAction`
  - `isSystemAction(action: GameAction): boolean`
  - `applySystemAction(room: Room, action: GameAction): RoomResult`
  - `GameEvent.sentAt: number`

- [ ] **Step 1: Failing tests schreiben**

`packages/shared/src/game/actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { isSystemAction, stampAction } from './actions.js';
import { hand } from './fixtures.js';

describe('stampAction', () => {
  it('ueberschreibt das mitgeschickte at', () => {
    const stamped = stampAction(
      {
        type: 'offerTrade',
        player: 'p1',
        give: hand({ lumber: 1 }),
        want: hand({ ore: 1 }),
        at: 5,
      },
      1_000,
    );

    expect(stamped).toMatchObject({ at: 1_000 });
  });

  it('laesst Aktionen ohne Zeitbezug unveraendert', () => {
    const action = { type: 'endTurn', player: 'p1' } as const;

    expect(stampAction(action, 1_000)).toBe(action);
  });
});

describe('isSystemAction', () => {
  it('erkennt genau die drei Aktionen, die kein Spieler schickt', () => {
    expect(isSystemAction({ type: 'timeout', player: 'p1', at: 1 })).toBe(true);
    expect(isSystemAction({ type: 'dropFromTrade', player: 'p1' })).toBe(true);
    expect(isSystemAction({ type: 'rejoinTrade', player: 'p1' })).toBe(true);
    expect(isSystemAction({ type: 'endTurn', player: 'p1' })).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/actions.test.ts`
Expected: FAIL — `stampAction is not exported`

- [ ] **Step 3: `stampAction` und `isSystemAction`**

An `packages/shared/src/game/actions.ts` anhaengen:

```ts
/**
 * Aktionen, die kein Spieler schickt.
 *
 * Zwei von ihnen sprechen **ueber** einen anderen Spieler, die dritte ist das
 * Ende einer Uhr. Der gewoehnliche Eingang prueft, dass Absender und
 * `player`-Feld dieselbe Person sind - diese drei kaemen dort nie durch und
 * sollen es auch nicht.
 */
export const SYSTEM_ACTION_TYPES = ['timeout', 'dropFromTrade', 'rejoinTrade'] as const;

export function isSystemAction(action: GameAction): boolean {
  return (SYSTEM_ACTION_TYPES as readonly string[]).includes(action.type);
}

/**
 * Setzt den Zeitpunkt einer Aktion auf die Uhr des Aufrufers.
 *
 * Der Server ruft das vor `reduce` und vor dem Log auf: was ein Client an `at`
 * mitgeschickt hat, ist damit wirkungslos, und der geloggte Wert ist derselbe,
 * aus dem die Frist entstanden ist - `replay` ergibt sie wieder.
 */
export function stampAction(action: GameAction, at: number): GameAction {
  return 'at' in action ? { ...action, at } : action;
}
```

- [ ] **Step 4: `sentAt` ins Ereignis**

`packages/shared/src/protocol/events.ts`, in `GameEventSchema`:

```ts
  /**
   * Die Serveruhr beim Senden.
   *
   * Der Client rechnet daraus seinen Versatz und stellt Fristen in seiner
   * eigenen Zeit dar. Ohne das zeigte eine falsch gehende Rechneruhr eine
   * Frist, die laengst abgelaufen ist - oder eine, die nie endet.
   */
  sentAt: z.number().int().min(0),
```

`apps/server/src/rooms/broadcast.ts`, in `broadcastGame`:

```ts
const sentAt = Date.now();
```

und im Payload `sentAt,` ergaenzen.

- [ ] **Step 5: `applySystemAction`**

In `apps/server/src/rooms/room.ts` hinter `applyAction`:

```ts
/**
 * Einen Zug anwenden, den der Server selbst ausloest.
 *
 * Ohne Absenderpruefung - genau das ist der Unterschied zu `applyAction`:
 * `dropFromTrade` und `rejoinTrade` sprechen ueber einen anderen Spieler, und
 * `timeout` ist niemandes Absicht. Erreichbar ist dieser Eingang nur von innen;
 * der Nachrichten-Handler weist diese Aktionsarten von aussen ab.
 */
export function applySystemAction(room: Room, action: GameAction): RoomResult {
  if (room.game === null) return fail('Die Partie hat noch nicht begonnen');

  const result = reduce(room.game, action);
  if (!result.ok) return fail(result.error.message);

  return ok({ ...room, game: result.state, version: room.version + 1 });
}
```

- [ ] **Step 6: Handler: stempeln und sperren**

In `apps/server/src/ws/handlers/room.ts`, im `ACT`-Handler:

```ts
router.register(ACT, (payload, context) => {
  const user = requireUser(context, users);
  const room = requireRoom(registry.get(context.session.roomCode ?? ''));
  const before = room.game;

  if (isSystemAction(payload.action)) {
    throw new RejectedError('Diesen Zug loest der Server aus, nicht ein Spieler');
  }

  // Der Zeitpunkt kommt vom Server, nie vom Client - und geht in genau dieser
  // Form ins Log, damit `replay` dieselbe Frist wieder ergibt.
  const action = stampAction(payload.action, Date.now());

  const acted = applyAction(room, user.id, action);
  if (!acted.ok) throw new RejectedError(acted.error);

  registry.update(acted.room.code, acted.room, action);

  const entry =
    before === null || acted.room.game === null
      ? undefined
      : describeTransition(before, action, acted.room.game, seatsOf(room));

  broadcastGame(acted.room, sinks.map, entry);
  return {};
});
```

- [ ] **Step 7: Servertests anhaengen**

An `apps/server/src/rooms/room.test.ts` (Aufbau der Datei uebernehmen):

```ts
describe('applyAction stempelt die Zeit', () => {
  it('nimmt die uebergebene Uhr und nicht das mitgeschickte at', () => {
    // Ein Raum mit laufender Partie, p1 am Zug und drei Holz in der Hand -
    // dieselbe Vorbereitung wie in den Bau-Tests dieser Datei.
    // Erwartung: expiresAt entsteht aus dem gestempelten Wert.
  });
});
```

**Konkret:** den vorhandenen Aufbau fuer einen gestarteten Raum
wiederverwenden, `stampAction(offer, 10_000)` anwenden, `applyAction` aufrufen
und pruefen, dass `room.game.phase.expiresAt === 10_000 + tradeOfferMs` ist —
unabhaengig davon, welches `at` in der urspruenglichen Aktion stand.

Dazu ein Test, dass `applySystemAction` einen `timeout` fuer einen anderen
Spieler annimmt, waehrend `applyAction` ihn mit „Ein Zug fuer einen anderen
Spieler wird nicht angenommen" abweist.

- [ ] **Step 8: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen. Bestehende Servertests, die `GameEventSchema`-Payloads bauen,
brauchen jetzt `sentAt` — der Compiler nennt sie.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/ apps/server/src/
git commit -m "Der Server stempelt die Zeit und behaelt seine drei eigenen Zuege fuer sich"
```

---

### Task 11: Der Wecker im Server

**Files:**

- Create: `apps/server/src/rooms/clock.ts`
- Create: `apps/server/src/rooms/clock.test.ts`
- Modify: `apps/server/src/ws/handlers/room.ts`

**Interfaces:**

- Consumes: `deadlineOf`, `applySystemAction`, `awaitsResponse`,
  `hasAutomaticDecline`.
- Produces: `createRoomClock(deps): RoomClock` mit `arm(code)`, `disarm(code)`,
  `disarmAll()`.

- [ ] **Step 1: Failing test schreiben**

`apps/server/src/rooms/clock.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { createRoomClock } from './clock.js';

describe('createRoomClock', () => {
  it('stellt den Wecker auf die Frist des Raums', () => {
    const schedule = vi.fn(() => 1 as unknown as NodeJS.Timeout);
    // Raum mit offenem Angebot, Frist bei 60_000, Uhr steht auf 10_000.
    // Erwartung: schedule wurde mit 50_000 ms gerufen.
  });

  it('feuert timeout und schickt den neuen Stand', () => {
    // Erwartung: nach dem Ausloesen steht die Partie wieder in `main`,
    // die Aktion ist im Log, und jede Senke hat ein Ereignis bekommen.
  });

  it('feuert sofort, wenn die Frist beim Laden schon abgelaufen ist', () => {
    // Uhr steht hinter expiresAt: schedule wird mit 0 gerufen.
  });

  it('raeumt den Wecker beim Schliessen des Raums ab', () => {
    // disarm ruft cancel mit dem Handle aus schedule.
  });
});
```

**Die Tests sind mit dem Aufbau aus `apps/server/src/rooms/room.test.ts`
auszuformulieren** — dort steht, wie ein Raum mit laufender Partie entsteht.
Uhr, `schedule` und `cancel` werden als Abhaengigkeiten hereingereicht, damit
kein Test auf echte Zeit wartet.

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/server exec vitest run src/rooms/clock.test.ts`
Expected: FAIL — `Cannot find module './clock.js'`

- [ ] **Step 3: `clock.ts` schreiben**

```ts
import { deadlineOf, describeTransition, type GameAction, type Seat } from '@conquerist/shared';
import type { Sinks } from './broadcast.js';
import { broadcastGame } from './broadcast.js';
import { applySystemAction } from './room.js';
import type { RoomRegistry } from './registry.js';

/**
 * Die Uhr des Servers, je Raum ein Wecker.
 *
 * Der Wecker kennt keine Regel: er liest `deadlineOf` und wirft, wenn die Zeit
 * um ist, `timeout` ein. Was das bedeutet, entscheidet der Reducer - hier steht
 * nur, wann jemand nachfragen muss.
 *
 * Uhr und Zeitgeber kommen von aussen herein, damit die Tests nicht warten.
 */
export interface RoomClockDeps {
  readonly registry: RoomRegistry;
  readonly sinks: { readonly map: Sinks };
  readonly now?: () => number;
  readonly schedule?: (run: () => void, ms: number) => NodeJS.Timeout;
  readonly cancel?: (handle: NodeJS.Timeout) => void;
}

export interface RoomClock {
  /** Frist des Raums neu lesen und den Wecker entsprechend stellen. */
  arm(code: string): void;
  disarm(code: string): void;
  disarmAll(): void;
}

export function createRoomClock(deps: RoomClockDeps): RoomClock {
  const now = deps.now ?? (() => Date.now());
  const schedule = deps.schedule ?? ((run, ms) => setTimeout(run, ms));
  const cancel = deps.cancel ?? ((handle) => clearTimeout(handle));

  const timers = new Map<string, NodeJS.Timeout>();

  function disarm(code: string): void {
    const handle = timers.get(code);
    if (handle === undefined) return;
    cancel(handle);
    timers.delete(code);
  }

  function fire(code: string): void {
    timers.delete(code);

    const room = deps.registry.get(code);
    if (room?.game === undefined || room.game === null) return;

    const due = deadlineOf(room.game);
    if (due === null) return;

    const action: GameAction = { type: 'timeout', player: due.owner, at: now() };
    const before = room.game;

    const acted = applySystemAction(room, action);
    if (!acted.ok) return; // Die Frist wurde inzwischen anders beendet.

    deps.registry.update(acted.room.code, acted.room, action);

    const seats: readonly Seat[] = acted.room.seats.map((seat) => ({
      id: seat.userId,
      name: seat.name,
      color: seat.color,
    }));
    const entry =
      acted.room.game === null
        ? undefined
        : describeTransition(before, action, acted.room.game, seats);

    broadcastGame(acted.room, deps.sinks.map, entry);
    arm(code);
  }

  function arm(code: string): void {
    disarm(code);

    const game = deps.registry.get(code)?.game ?? null;
    if (game === null) return;

    const due = deadlineOf(game);
    if (due === null) return;

    // Eine beim Laden laengst abgelaufene Frist ist sofort faellig: nach einem
    // Neustart raeumt der erste Lauf das Angebot ab.
    timers.set(
      code,
      schedule(() => fire(code), Math.max(0, due.at - now())),
    );
  }

  return {
    arm,
    disarm,
    disarmAll: () => {
      for (const code of [...timers.keys()]) disarm(code);
    },
  };
}
```

- [ ] **Step 4: Wecker einhaengen**

In `apps/server/src/ws/handlers/room.ts`:

- Den Wecker in die `RoomHandlerDeps` aufnehmen (`clock: RoomClock`).
- Nach jedem `broadcastGame` in `START` und `ACT`: `clock.arm(room.code)`.
- Beim Aufbau des Servers (dort, wo Registry und Raeume aus der Datenbank
  geladen werden): fuer jeden geladenen Raum einmal `clock.arm(code)`.

- [ ] **Step 5: Verbindungsverlust und Rueckkehr verdrahten**

In `handleDisconnect`, in der Schleife ueber `registry.roomsOf(userId)`, nach
`setConnected`:

```ts
// Wer waehrend eines offenen Angebots wegbricht, lehnt vorlaeufig ab -
// sonst wartet der Tisch auf jemanden, der nicht mehr da ist.
const game = next.game;
if (game !== null && awaitsResponse(game, userId)) {
  const action: GameAction = { type: 'dropFromTrade', player: userId };
  const acted = applySystemAction(next, action);
  if (acted.ok) {
    registry.update(acted.room.code, acted.room, action);
    broadcastGame(acted.room, sinks.map);
    continue;
  }
}
```

Im `HELLO`-Handler, im Reconnect-Zweig hinter `setConnected(existing, …, true)`:

```ts
// Das Angebot steht noch: die automatische Ablehnung faellt weg, er darf
// wieder antworten.
const game = reconnected.game;
if (game !== null && hasAutomaticDecline(game, result.user.id)) {
  const action: GameAction = { type: 'rejoinTrade', player: result.user.id };
  const acted = applySystemAction(reconnected, action);
  if (acted.ok) {
    registry.update(acted.room.code, acted.room, action);
    broadcastGame(acted.room, sinks.map);
  }
}
```

- [ ] **Step 6: Tests ausformulieren und laufen lassen**

Die Platzhalterkommentare aus Step 1 durch echte Tests ersetzen — der Aufbau
steht in `room.test.ts`. Dazu ein Test in
`apps/server/src/ws/handlers/room.test.ts` (oder der vorhandenen
Integrationstestdatei): eine Verbindung faellt waehrend eines Angebots weg, der
Tisch sieht eine Ablehnung; dieselbe Person meldet sich neu an, und die
Ablehnung ist wieder verschwunden.

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/
git commit -m "Ein Wecker je Raum - und ein Verbindungsabbruch laesst den Tisch nicht warten"
```

---

### Task 12: Der zweite Reiter — ein Angebot legen

**Files:**

- Modify: `apps/client/src/dialogs/TradeDialog.tsx`
- Modify: `apps/client/src/dialogs/dialogs.test.tsx`
- Modify: `apps/client/src/screens/GameScreen.tsx`
- Modify: `apps/client/src/index.css`

**Interfaces:**

- Consumes: `PlayerView.canOfferTrade`.
- Produces: `TradeDialogProps` um
  `canOffer: boolean` und `onOffer: (give: ResourceAmounts, want: ResourceAmounts) => void`
  erweitert.

- [ ] **Step 1: Failing test anhaengen**

An `dialogs.test.tsx`:

```ts
describe('TradeDialog, Reiter Spieler', () => {
  it('zeigt den Reiter nur, wenn ein Angebot moeglich waere', () => {
    render(
      <TradeDialog
        player={player}
        rateFor={() => 4}
        canTrade={() => true}
        canOffer={false}
        onOffer={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('tab', { name: /spieler/i })).toBeNull();
  });

  it('schickt die gewaehlten Mengen hinaus', async () => {
    const onOffer = vi.fn();
    render(
      <TradeDialog
        player={player}
        rateFor={() => 4}
        canTrade={() => true}
        canOffer
        onOffer={onOffer}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('tab', { name: /spieler/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Ein Lehm mehr anbieten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ein Erz mehr verlangen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' }));

    expect(onOffer).toHaveBeenCalledWith(
      { brick: 1, lumber: 0, wool: 0, grain: 0, ore: 0 },
      { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
    );
  });

  it('haelt den Knopf gesperrt, solange eine Seite leer ist', async () => {
    render(
      <TradeDialog
        player={player}
        rateFor={() => 4}
        canTrade={() => true}
        canOffer
        onOffer={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('tab', { name: /spieler/i }));

    expect(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/client exec vitest run src/dialogs/dialogs.test.tsx`
Expected: FAIL

- [ ] **Step 3: `TradeDialog` umbauen**

Der Dialog bekommt einen Zustand `tab: 'bank' | 'player'` und im Spieler-Reiter
zwei Mengenspalten. Regeln fuer die Umsetzung:

- Reiter als `role="tablist"` mit zwei `role="tab"`; der Spieler-Reiter
  erscheint nur bei `canOffer`.
- Je Sorte ein Schrittzaehler mit `+`/`−`; die Gabe ist nach oben durch
  `player.resources?.[resource] ?? 0` begrenzt, die Forderung durch nichts.
- Eine Sorte, die links steht, ist rechts gesperrt und umgekehrt — dieselbe
  Regel wie in `checkShape`, hier nur als Sperre statt als Fehler.
- Der Knopf „Angebot auf den Tisch legen" ist gesperrt, solange eine Seite
  leer ist.
- Beschriftungen der Schrittknoepfe: `Ein ${RESOURCE_LABELS[r]} mehr anbieten`
  bzw. `… mehr verlangen`, damit der Test sie ueber `aria-label` findet.
- Der Kopfkommentar der Datei verliert den Satz „Spielerhandel bekommt in
  Etappe 8 einen zweiten Reiter" — er ist jetzt wahr geworden.

- [ ] **Step 4: `GameScreen` verdrahten**

Die Eigenschaften `canOffer={view.canOfferTrade}` und `onOffer={…}` reichen,
wobei `onOffer` eine Aktion baut und hinausschickt:

```tsx
onOffer={(give, want) => {
  act({ type: 'offerTrade', player: view.you, give, want, at: Date.now() });
  setTrade(false);
}}
```

`at` wird online vom Server ueberschrieben; lokal ist es der echte Zeitpunkt.

- [ ] **Step 5: CSS ergaenzen**

In `index.css` Klassen fuer Reiterleiste, Mengenspalten und Schrittzaehler —
**Farben ausschliesslich ueber vorhandene Variablen**, Zahlen mit
`font-variant-numeric: tabular-nums`.

- [ ] **Step 6: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/
git commit -m "Der zweite Reiter: Mengen waehlen und ein Angebot auf den Tisch legen"
```

---

### Task 13: Der Angebotsdialog — antworten, kontern, zuschlagen

**Files:**

- Create: `apps/client/src/dialogs/TradeOfferDialog.tsx`
- Modify: `apps/client/src/dialogs/dialogs.test.tsx`
- Modify: `apps/client/src/screens/GameScreen.tsx`
- Modify: `apps/client/src/net/useConnection.ts` (Versatz aus `sentAt`)
- Modify: `apps/client/src/index.css`

**Interfaces:**

- Consumes: Phase `tradePending` aus der `PlayerView`, Aktionsliste,
  `GameEvent.sentAt`.
- Produces: `TradeOfferDialog` mit Props
  `{ view, actions, you, clockOffset, onAct }`.

- [ ] **Step 1: Failing tests anhaengen**

An `dialogs.test.tsx` Tests fuer beide Rollen:

```ts
describe('TradeOfferDialog', () => {
  it('sperrt das Annehmen mit Begruendung, wenn die Aktion nicht in der Liste steht', () => {
    // Aktionsliste enthaelt nur die Ablehnung.
    // Erwartung: der Annehmen-Knopf ist disabled und traegt den Hinweis,
    // dass die verlangten Karten fehlen.
  });

  it('zeigt dem Anbieter je Antwort eine Zeile und je Zusage einen Zuschlagknopf', () => {
    // Erwartung: 'Mit Spieler 2 tauschen' ist da, fuer den Ablehnenden nicht.
  });

  it('zeigt die verbleibende Zeit aus expiresAt und dem Versatz', () => {
    // expiresAt = 100_000, Uhr = 40_000, Versatz = 0 -> '60'
  });
});
```

**Ausformulieren** mit dem Aufbau der bestehenden Tests dieser Datei (eine
`PlayerView` von Hand bauen, `render`, `screen`).

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/client exec vitest run src/dialogs/dialogs.test.tsx`
Expected: FAIL — Modul fehlt

- [ ] **Step 3: `TradeOfferDialog.tsx` schreiben**

Vorgaben:

- Sichtbar, wenn `view.phase.kind === 'tradePending'`. Kein Knopf davor — die
  Phase blockiert ohnehin alles andere.
- **Zwei Rollen in einer Datei**, unterschieden ueber
  `view.phase.offer.from === view.you`:
  - Mitspieler: das Angebot in Worten, dann _Annehmen_, _Ablehnen_,
    _Gegenangebot_. Ein Knopf ist genau dann bedienbar, wenn die zugehoerige
    Aktion in `actions` steht; fehlt das Annehmen, traegt der gesperrte Knopf
    den Hinweis „dir fehlt, was verlangt wird".
  - Anbieter: je Mitspieler eine Zeile mit seiner Antwort (Zusage, Ablehnung,
    Gegenangebot mit Mengen, oder „ueberlegt noch"), je moeglichem Zuschlag ein
    Knopf „Mit … tauschen", dazu „Angebot zurueckziehen".
- Das Gegenangebot benutzt **dieselbe** Mengenauswahl wie der Spieler-Reiter aus
  Task 12 — die Komponente dafuer aus `TradeDialog.tsx` herausziehen und in
  beiden verwenden, statt sie zu verdoppeln.
- Countdown: `Math.max(0, view.phase.expiresAt - (Date.now() + clockOffset))`,
  jede Sekunde neu gerechnet, in Sekunden und **Tabellenziffern** angezeigt.
- Farbe ist nie der einzige Traeger: jede Antwortzeile traegt Wort und Zeichen,
  nicht nur eine Farbe.
- Als einzige Bewegung ein Eingang. **Keine Ausgangsanimation** — sie waere bei
  `prefers-reduced-motion` von Anfang an unsichtbar.

- [ ] **Step 4: Versatz aus `sentAt`**

In `apps/client/src/net/useConnection.ts` (oder dort, wo `GAME_EVENT`
ankommt) je Ereignis `sentAt - Date.now()` merken und als `clockOffset`
weiterreichen. Lokal (Hotseat) ist er `0`.

- [ ] **Step 5: `GameScreen` einhaengen**

Den Dialog rendern, sobald die Phase steht; `onAct` reicht auf denselben Weg
wie alle anderen Aktionen. Beim Gegenangebot `at: Date.now()` setzen — online
ueberschreibt der Server.

- [ ] **Step 6: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/
git commit -m "Das Angebot auf dem Tisch: antworten, kontern, zuschlagen - mit laufender Uhr"
```

---

### Task 14: Die lokale Partie bekommt dieselbe Uhr

**Files:**

- Modify: `apps/client/src/game/useHotseatGame.ts`
- Modify: `apps/client/src/game/useLocalGame.ts`
- Modify: `apps/client/src/game/hotseat.test.ts`

- [ ] **Step 1: Failing test anhaengen**

```ts
describe('die lokale Partie vollstreckt ihre Frist', () => {
  it('wirft timeout ein, sobald die Frist um ist', () => {
    vi.useFakeTimers();
    // Lokale Partie mit offenem Angebot rendern, Zeit um tradeOfferMs
    // vorstellen, danach steht die Phase wieder auf 'main'.
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss scheitern**

Run: `pnpm --filter @conquerist/client exec vitest run src/game/hotseat.test.ts`
Expected: FAIL

- [ ] **Step 3: Wecker im Haken**

In `useHotseatGame.ts` ein `useEffect`, das `deadlineOf(state.game)` liest und
einen `setTimeout` stellt, der `{ type: 'timeout', player: owner, at: Date.now() }`
dispatcht. Aufraeumen im Rueckgabewert des Effekts.

```ts
useEffect(() => {
  const due = deadlineOf(state.game);
  if (due === null) return;

  const handle = setTimeout(
    () => send({ type: 'apply', action: { type: 'timeout', player: due.owner, at: Date.now() } }),
    Math.max(0, due.at - Date.now()),
  );

  return () => clearTimeout(handle);
}, [state.game]);
```

Dazu `dispatch` so erweitern, dass es `stampAction(action, Date.now())`
anwendet — damit stimmt lokal dieselbe Regel wie online, nur ohne Server.

- [ ] **Step 4: Tests laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: gruen

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/
git commit -m "Auch am Kuechentisch laeuft die Uhr - sonst zeigt der Countdown eine Luege"
```

---

### Task 15: Abnahme und `PROGRESS.md`

**Files:**

- Modify: `PROGRESS.md`
- Modify: `CLAUDE.md` (Etappenstand)

- [ ] **Step 1: Vollstaendige Abnahme messen**

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

**Die Zahlen werden abgelesen, nicht geschaetzt** — Tests je Paket,
Bundlegroesse aus der Build-Ausgabe.

- [ ] **Step 2: Durchlauf im Browser**

Zwei Fenster, zwei Konten, eine Partie:

1. Angebot legen — der andere sieht es, der Zug ist blockiert.
2. Ablehnen, dann ein neues Angebot annehmen und Zuschlag geben.
3. Gegenangebot mit anderen Mengen; die Frist springt sichtbar zurueck.
4. Ein Angebot ablaufen lassen — es verschwindet von selbst bei beiden.
5. Ein Fenster mitten im Angebot schliessen (Ablehnung erscheint) und wieder
   oeffnen (die Ablehnung ist weg).
6. Server neu starten, waehrend ein Angebot mit abgelaufener Frist liegt: beim
   Wiederkommen steht die Partie in der Hauptphase.
7. Schmales Fenster: der Angebotsdialog bleibt bedienbar.

- [ ] **Step 3: `PROGRESS.md` schreiben**

Abschnitt in der vorgeschriebenen Form: Ueberschrift und Stand, Abnahmetabelle
mit **gemessenen** Zahlen, getroffene Entscheidungen (je Absatz eine, fett
angefuehrt, mit Grund), Abweichungen vom Plan, offene Punkte, naechste Etappe.

Die Entscheidungen stehen in der Spec und gehoeren hierher uebertragen — vor
allem: warum das Angebot eine Phase ist, warum Zeit als Daten hereinkommt,
warum eine automatische Ablehnung das Angebot nicht toetet, und warum
`tradeOfferMs` eine Vorgabe braucht.

- [ ] **Step 4: `CLAUDE.md` nachziehen**

Im Etappenplan `8. Handel, Entwicklungskarten` auf `✅` setzen und den Abschnitt
„Aktueller Stand" um den Spielerhandel und die Frist-Infrastruktur ergaenzen.

- [ ] **Step 5: Commit**

```bash
git add PROGRESS.md CLAUDE.md
git commit -m "Etappe 8 abgenommen: der Tausch ueber den Tisch, mit Uhr"
```

---

## Selbstpruefung des Plans

**Deckung der Spec:** Phase (T1), Regelwert mit Vorgabe (T1), `offerTrade` (T2),
`respondTrade` samt Verfallsregel (T3), `counterTrade` mit Fristneustart (T4),
`acceptTrade`/`withdrawTrade` (T5), `deadlineOf`/`timeout` (T6),
`dropFromTrade`/`rejoinTrade` (T7), `legalActions` und `canOfferTrade` (T8),
Replay (T9), `sentAt`/`stampAction`/`applySystemAction`/Handlersperre (T10),
Wecker und Verdrahtung des Verbindungsverlusts (T11), Reiter (T12),
Angebotsdialog mit Countdown (T13), lokale Uhr (T14), Abnahme (T15).

**Bewusst spaeter:** Die Tests in T11, T13 und T14 sind als Erwartung
beschrieben statt als fertiger Code, weil sie den Aufbau der jeweiligen
Bestandsdatei uebernehmen muessen (Raumaufbau, `PlayerView` von Hand,
Fake-Timer). Wer sie schreibt, liest die Nachbartests derselben Datei zuerst.
