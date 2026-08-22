# Entwicklungskarten vor dem Wurf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle vier Entwicklungskarten dürfen im eigenen Zug **vor** dem Würfeln gespielt werden; gekauft wird weiterhin erst danach.

**Architecture:** Drei Eingriffe, und der dritte trägt die anderen: `robberPending` bekommt ein `resume`-Feld, weil `applyMoveRobber` heute hart nach `main` zurückspringt und ein Ritter vor dem Wurf den Wurf sonst verschluckt. Danach wird `canActNow` in `canBuyNow` und `canPlayNow` geteilt, und erst zuletzt werden die vier Aktionen in `rollPending` freigegeben.

**Tech Stack:** TypeScript (ESM, `tsc -b`), Zod, Vitest, React 19, pnpm-Workspace.

**Spec:** `docs/superpowers/specs/2026-08-22-karten-vor-dem-wurf-design.md`

## Global Constraints

- **Kommentare und Bezeichner im Quelltext sind ASCII-transliteriert** („Gruendung", „Wuerfel"). **Texte für Menschen** — Verstoßmeldungen, Verlaufssätze, Beschriftungen — tragen echte Umlaute. Nicht vermischen.
- Kommentare erklären **warum**, nicht was.
- `noUncheckedIndexedAccess` ist an.
- Tests: `pnpm --filter @conquerist/shared test`, `pnpm --filter @conquerist/client test`. Ganze Abnahme: `pnpm typecheck && pnpm test && pnpm build && pnpm format:check`.
- Commits auf Deutsch, ASCII, ohne Trailer.
- **Reihenfolge ist hier keine Geschmacksfrage.** Task 1 muss vor Task 3 fertig sein: gibt man die Karten frei, bevor `resume` steht, entsteht ein Zustand, in dem ein Wurf lautlos ausfällt — genau der Fehler, den dieser Plan verhindern soll.

---

### Task 1: `robberPending` weiß, wohin zurück

**Files:**
- Modify: `packages/shared/src/game/phase.ts` (Variante `robberPending`)
- Modify: `packages/shared/src/game/robber.ts:95` und `:168` (`applyMoveRobber`)
- Modify: `packages/shared/src/game/reducer.ts:108`
- Modify: `packages/shared/src/game/developmentRules.ts:182`
- Test: `packages/shared/src/game/robber.test.ts`

**Interfaces:**
- Produces: `{ kind: 'robberPending', resume: 'main' | 'rollPending' }`; `applyMoveRobber` gibt in `phase.resume` zurück statt fest nach `main`

- [ ] **Step 1: Write the failing test**

An `packages/shared/src/game/robber.test.ts` anhängen:

```ts
describe('der Rueckweg des Raeubers', () => {
  it('geht nach einer Sieben in die Hauptphase', () => {
    const state = testGame({
      phase: { kind: 'robberPending', resume: 'main' },
      buildings: {},
    });
    const result = applyMoveRobber(state, 'p1', '1,0', null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'main' });
  });

  it('geht nach einem Ritter vor dem Wurf zurueck zum Wurf', () => {
    // Der eigentliche Befund: ohne `resume` landete der Spieler in `main`,
    // und der Wurf dieser Runde fiel ersatzlos aus.
    const state = testGame({
      phase: { kind: 'robberPending', resume: 'rollPending' },
      buildings: {},
    });
    const result = applyMoveRobber(state, 'p1', '1,0', null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toEqual({ kind: 'rollPending' });
  });

  it('kennt keine Phase ohne Rueckweg', () => {
    expect(() => PhaseSchema.parse({ kind: 'robberPending' })).toThrow();
  });
});
```

`PhaseSchema` in der Testdatei importieren, falls dort noch nicht vorhanden.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/robber.test.ts`
Expected: FAIL — `resume` ist unbekannt, und `applyMoveRobber` gibt immer `main` zurück.

- [ ] **Step 3: Write minimal implementation**

In `phase.ts` die Variante ersetzen:

```ts
  /**
   * Der Spieler am Zug muss den Raeuber versetzen.
   *
   * `resume` ist der Rueckweg. Er steht hier und nicht als Feld daneben, weil
   * der Umweg mit der Phase beginnt und mit ihr verschwindet: nach einer Sieben
   * ist gewuerfelt und es geht in die Hauptphase, nach einem Ritter **vor** dem
   * Wurf schuldet der Spieler den Wurf noch. Ohne diesen Vermerk sprang
   * `applyMoveRobber` fest nach `main` - der Wurf fiel dann lautlos aus.
   */
  z.object({
    kind: z.literal('robberPending'),
    resume: z.enum(['main', 'rollPending']),
  }),
```

In `robber.ts`, in `applyMoveRobber` (:168):

```ts
  const moved: GameState = { ...state, robber: hex, phase: { kind: phase.resume } };
```

`phase` ist dort die schon geprüfte `robberPending`-Phase; steht sie noch nicht als lokale Variable bereit, sie am Kopf der Funktion aus `state.phase` holen und wie die übrigen Regeln der Datei auf `kind` prüfen.

In `robber.ts:95` (nach dem letzten Abwurf) und in `reducer.ts:108` (Sieben ohne Abwurf) jeweils:

```ts
{ kind: 'robberPending', resume: 'main' }
```

In `developmentRules.ts:182` (Ritter):

```ts
    // Der Ritter darf vor **und** nach dem Wurf. Wohin es nach dem Raeuber
    // zurueckgeht, entscheidet deshalb die Phase, aus der er gespielt wurde.
    phase: { kind: 'robberPending', resume: state.phase.kind === 'rollPending' ? 'rollPending' : 'main' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/robber.test.ts`
Expected: PASS

- [ ] **Step 5: Den Bestand reparieren**

Run: `pnpm typecheck && pnpm test`

Erwartet fallen die Stellen, die `{ kind: 'robberPending' }` ohne `resume` bauen oder erwarten. Bekannt sind:
`legal.test.ts:73`, `:94`, `:105`; `phase.test.ts:52`; `reducer.test.ts:151`; `robber.test.ts:113`, `:164`.

Alle bekommen `resume: 'main'`, denn sie prüfen den Weg nach einer Sieben.

- [ ] **Step 6: Run the full suite**

Run: `pnpm typecheck && pnpm test`
Expected: grün.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Der Raeuberumweg merkt sich, woher er kam"
```

---

### Task 2: Kaufen und Ausspielen sind zwei Bedingungen

**Files:**
- Modify: `packages/shared/src/game/developmentRules.ts:43-55` (`canActNow`)
- Test: `packages/shared/src/game/developmentRules.test.ts`

**Interfaces:**
- Produces: `canBuyNow(state, player): RuleViolation | null` (nur `main`); `canPlayNow(state, player): RuleViolation | null` (`main` oder `rollPending`)

- [ ] **Step 1: Write the failing test**

An `packages/shared/src/game/developmentRules.test.ts` anhängen:

```ts
describe('wann gekauft und wann gespielt werden darf', () => {
  it('laesst vor dem Wurf nicht kaufen', () => {
    const state = testGame({ phase: { kind: 'rollPending' } });

    expect(canBuyNow(state, 'p1')?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('laesst vor dem Wurf spielen', () => {
    const state = testGame({ phase: { kind: 'rollPending' } });

    expect(canPlayNow(state, 'p1')).toBeNull();
  });

  it('laesst in der Hauptphase beides', () => {
    const state = testGame({ phase: { kind: 'main' } });

    expect(canBuyNow(state, 'p1')).toBeNull();
    expect(canPlayNow(state, 'p1')).toBeNull();
  });

  it('laesst in der Gruendung keines von beiden', () => {
    const state = testGame({ phase: { kind: 'setup', placement: 0, settlement: null } });

    expect(canBuyNow(state, 'p1')?.code).toBe(RuleViolationCode.WRONG_PHASE);
    expect(canPlayNow(state, 'p1')?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('laesst den, der nicht am Zug ist, auch vor dem Wurf nicht spielen', () => {
    const state = testGame({ phase: { kind: 'rollPending' }, currentPlayerIndex: 0 });

    expect(canPlayNow(state, 'p2')?.code).toBe(RuleViolationCode.NOT_YOUR_TURN);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/developmentRules.test.ts`
Expected: FAIL — `canBuyNow` und `canPlayNow` existieren nicht.

- [ ] **Step 3: Write minimal implementation**

In `developmentRules.ts` `canActNow` ersetzen durch:

```ts
/** Was Kauf und Ausspielen gemeinsam haben: der Spieler sitzt am Tisch und ist am Zug. */
function canActAtAll(state: GameState, player: PlayerId): RuleViolation | null {
  if (state.players[state.currentPlayerIndex]?.id !== player) {
    return violation(RuleViolationCode.NOT_YOUR_TURN, `${player} ist nicht am Zug`);
  }
  if (findPlayer(state, player) === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }
  return null;
}

/** Gekauft wird nach dem Wurf. */
export function canBuyNow(state: GameState, player: PlayerId): RuleViolation | null {
  if (state.phase.kind !== 'main') {
    return violation(RuleViolationCode.WRONG_PHASE, 'Das geht erst nach dem Würfeln');
  }
  return canActAtAll(state, player);
}

/**
 * Gespielt wird im eigenen Zug - **auch vor dem Wurf**.
 *
 * Der Grund, warum das zwei Funktionen sind und nicht eine mit Schalter: der
 * Ritter vor dem Wurf ist der Zug, um den es bei der Karte ueberhaupt geht (den
 * Raeuber vom eigenen Feld holen, ehe die Ertraege fallen). Kaufen hat dieses
 * Motiv nicht und bleibt, wo es war.
 */
export function canPlayNow(state: GameState, player: PlayerId): RuleViolation | null {
  if (state.phase.kind !== 'main' && state.phase.kind !== 'rollPending') {
    return violation(RuleViolationCode.WRONG_PHASE, 'Das geht nur im eigenen Zug');
  }
  return canActAtAll(state, player);
}
```

Alle Aufrufer von `canActNow` in der Datei umstellen: der Kaufpfad auf `canBuyNow`, `canPlayDevelopmentCard` auf `canPlayNow`. `pnpm typecheck` nennt sie vollständig.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/developmentRules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/developmentRules.ts packages/shared/src/game/developmentRules.test.ts
git commit -m "Kaufen und Ausspielen sind nicht mehr dieselbe Frage"
```

---

### Task 3: Die Freigabe

**Files:**
- Modify: `packages/shared/src/game/reducer.ts:49` (`PHASE_ACTIONS.rollPending`)
- Modify: `packages/shared/src/game/legal.ts:69` (`case 'rollPending'`)
- Test: `packages/shared/src/game/legal.test.ts`, `packages/shared/src/game/reducer.test.ts`

**Interfaces:**
- Consumes: `canPlayNow` aus Task 2, `resume` aus Task 1
- Produces: `legalActions` nennt in `rollPending` neben `rollDice` die spielbaren Karten

- [ ] **Step 1: Write the failing test**

An `packages/shared/src/game/legal.test.ts` anhängen:

```ts
describe('Karten vor dem Wurf', () => {
  const withKnight = () =>
    testGame({
      phase: { kind: 'rollPending' },
      turn: 2,
      players: testGame().players.map((player) =>
        player.id === 'p1'
          ? { ...player, developmentCards: [{ id: 'knight', boughtOnTurn: 1 }] }
          : player,
      ),
    });

  it('bietet vor dem Wurf den Ritter an', () => {
    const actions = legalActions(withKnight(), 'p1').map((action) => action.type);

    expect(actions).toContain('rollDice');
    expect(actions).toContain('playKnight');
  });

  it('bietet vor dem Wurf keinen Kauf an', () => {
    const actions = legalActions(withKnight(), 'p1').map((action) => action.type);

    expect(actions).not.toContain('buyDevelopmentCard');
  });

  it('bietet dem Mitspieler vor dem Wurf nichts an', () => {
    expect(legalActions(withKnight(), 'p2')).toEqual([]);
  });
});
```

An `packages/shared/src/game/reducer.test.ts` anhängen:

```ts
describe('der Ritter vor dem Wurf', () => {
  const withKnight = () =>
    testGame({
      phase: { kind: 'rollPending' },
      turn: 2,
      players: testGame().players.map((player) =>
        player.id === 'p1'
          ? { ...player, developmentCards: [{ id: 'knight', boughtOnTurn: 1 }] }
          : player,
      ),
    });

  it('fuehrt ueber den Raeuber zurueck zum Wurf', () => {
    const played = reduce(withKnight(), { type: 'playKnight', player: 'p1' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.phase).toEqual({ kind: 'robberPending', resume: 'rollPending' });

    const moved = reduce(played.state, {
      type: 'moveRobber',
      player: 'p1',
      hex: '1,0',
      victim: null,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.phase).toEqual({ kind: 'rollPending' });
  });

  it('verbraucht damit die eine Karte des Zuges', () => {
    // Eine Karte je Zug gilt ueber den Wurf hinweg - der Wurf setzt sie nicht
    // zurueck, das tut nur `endTurn`.
    const played = reduce(withKnight(), { type: 'playKnight', player: 'p1' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.developmentPlayed).toBe(true);
  });

  it('nimmt vor dem Wurf keinen Kauf an', () => {
    const result = reduce(withKnight(), { type: 'buyDevelopmentCard', player: 'p1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RuleViolationCode.WRONG_PHASE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/shared exec vitest run src/game/legal.test.ts src/game/reducer.test.ts`
Expected: FAIL — `playKnight` ist in `rollPending` nicht erlaubt.

- [ ] **Step 3: Write minimal implementation**

In `reducer.ts`:

```ts
  rollPending: ['rollDice', 'playKnight', 'playRoadBuilding', 'playYearOfPlenty', 'playMonopoly'],
```

In `legal.ts` den Zweig ersetzen. Die Kartenzüge stehen heute im `main`-Zweig; sie kommen in eine gemeinsame Funktion, damit die Liste nicht an zwei Stellen wächst:

```ts
/** Die Entwicklungskarten, die dieser Spieler jetzt ausspielen darf. */
function playableCards(state: GameState, player: PlayerId): GameAction[] {
  // Dieselbe Liste fuer `main` und `rollPending`. Zwei Listen waeren zwei
  // Wahrheiten darueber, was eine Karte darf.
  ...
}
```

Der Rumpf ist der Kartenteil, der heute im `main`-Zweig steht — **verschieben, nicht abschreiben**, damit es keine zweite Fassung gibt. Danach:

```ts
    case 'rollPending':
      return state.players[state.currentPlayerIndex]?.id === player
        ? [{ type: 'rollDice', player }, ...playableCards(state, player)]
        : [];
```

und im `main`-Zweig die verschobenen Zeilen durch `...playableCards(state, player)` ersetzen.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/shared exec vitest run`
Expected: PASS — die ganze `shared`-Suite, nicht nur die zwei Dateien.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/game/reducer.ts packages/shared/src/game/legal.ts packages/shared/src/game/legal.test.ts packages/shared/src/game/reducer.test.ts
git commit -m "Die vier Karten duerfen vor den Wurf"
```

---

### Task 4: Die Hand vor dem Wurf

**Files:**
- Modify: ggf. `apps/client/src/panels/HandPanel.tsx`, `apps/client/src/panels/ActionPanel.tsx`
- Test: `apps/client/src/screens/development.test.tsx`

**Interfaces:**
- Consumes: `legalActions` aus Task 3 über `ActionTargets` (`apps/client/src/game/targets.ts`)

- [ ] **Step 1: Write the failing test**

An `apps/client/src/screens/development.test.tsx` anhängen — im Stil der Datei, die dort schon eine Partie aufbaut:

```tsx
it('laesst den Ritter vor dem Wurf spielen', async () => {
  // Der Client kennt keine Regel: was `legalActions` nennt, ist bedienbar.
  // Dieser Test haelt fest, dass die Sperre wirklich von dort kommt und nicht
  // aus einer eigenen Phasenabfrage im Panel.
  const view = viewInRollPendingWithKnight();

  render(<HandPanel ... />);

  expect(screen.getByRole('button', { name: /Ritter/ })).toBeEnabled();
});
```

Die Aufbauhilfen der Datei verwenden (`development.test.tsx` hat bereits welche für Hand und Ziele). **Vor dem Schreiben lesen**, wie die Datei ihre Partie stellt, und dem folgen — keinen zweiten Aufbauweg erfinden.

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/development.test.tsx`

**Zwei mögliche Ausgänge, beide in Ordnung:**
- **PASS sofort** → die Panels ziehen ihre Sperre schon aus `actions`, es ist nichts zu tun. Dann Schritt 3 überspringen und den Test als Wächter behalten.
- **FAIL** → irgendwo im Client steht eine eigene Phasenabfrage. Sie ist der Fehler und wird in Schritt 3 entfernt.

- [ ] **Step 3: Write minimal implementation (nur bei FAIL)**

Die gefundene Phasenabfrage im Panel durch die Prüfung auf die vorhandene Aktion ersetzen (`targets.playKnight !== null` bzw. der entsprechende Eintrag). Der Client entscheidet keine Regel — er zeigt, was erlaubt ist.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/development.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/src
git commit -m "Die Hand ist vor dem Wurf bedienbar"
```

---

### Task 5: Abnahme

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Die ganze Abnahme fahren**

```bash
pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

- [ ] **Step 2: Im Browser ansehen**

`pnpm dev`, lokale Partie, bis jemand eine Ritterkarte hat (eine Runde warten, damit `isPlayable` sie freigibt). Dann **vor** dem Würfeln:

1. Ritter spielen — der Räuber lässt sich versetzen.
2. Danach steht der Würfelknopf **wieder da**. Das ist der Befund dieses Plans; ist er weg, ist `resume` nicht angekommen.
3. Nach dem Wurf lässt sich **keine zweite** Karte spielen.
4. Vor dem Wurf lässt sich **nichts kaufen**.

- [ ] **Step 3: `PROGRESS.md` fortschreiben**

Abschnitt im Ton der bestehenden Einträge: Stand, was gebaut wurde, Abnahmetabelle, neue Testzahl, offene Punkte.

- [ ] **Step 4: Commit**

```bash
git add PROGRESS.md
git commit -m "Die Karten vor dem Wurf sind abgenommen"
```

---

## Self-Review

**Spec-Abdeckung:** Abschnitt 1 (vier Aktionen in `rollPending`, kein Kauf) → Task 3. Abschnitt 2 (`canActNow` teilen) → Task 2. Abschnitt 3 (`resume`) → Task 1. „`discardPending` bekommt kein `resume`" → in Task 1 nicht angefasst, und kein Test verlangt es. Client → Task 4. Der offengelassene Punkt „Straßenbau vor dem Wurf und die Längste Handelsstraße" ist durch Task 3 abgedeckt, weil `finalize` in `rollPending` ohnehin läuft; ein eigener Test dafür steht nicht im Plan — **das ist eine bewusste Lücke**, die in `PROGRESS.md` (Task 5 Schritt 3) genannt gehört.

**Namen quer geprüft:** `canBuyNow`/`canPlayNow` (Tasks 2, 3), `canActAtAll` (nur Task 2, nicht exportiert), `resume` (Tasks 1, 3), `playableCards` (Task 3).

**Task 4 hat bewusst zwei erlaubte Ausgänge.** Das ist kein Platzhalter: der Test wird in beiden Fällen geschrieben und behalten, nur die Implementierung entfällt, wenn der Client schon richtig gebaut ist. Welcher Fall eintritt, ist am Bestand nicht in zwei Zeilen zu klären und im Testlauf in zehn Sekunden.
