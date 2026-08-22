# Schmale Geräte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Spielbildschirm wird auf Handys im Querformat bedienbar: das Brett bekommt die volle Fläche, die Ablage legt sich auf die See, und gesetzt wird in zwei Schritten — tippen, dann bestätigen.

**Architecture:** Zwei unabhängige Hälften. Die eine ist eine reine Funktion (`nearestTarget`) plus eine Fangfläche im `BoardSvg`, die aus einem Punkt genau ein Ziel macht; die andere ist ein Umschaltpunkt im Stilblatt, unter dem `--tray-strip` nicht mehr greift. Das Setzen kommt **zuerst**, damit beim Messen klar ist, welche Änderung den Treffer gebracht hat.

**Tech Stack:** TypeScript, React 19, Vitest + Testing Library (jsdom), CSS ohne Präprozessor.

**Spec:** `docs/superpowers/specs/2026-08-22-schmale-geraete-design.md`

## Global Constraints

- **Kommentare und Bezeichner im Quelltext sind ASCII-transliteriert.** **Texte für Menschen** tragen echte Umlaute. Nicht vermischen.
- Kommentare erklären **warum**. `index.css` ist durchgehend erklärt — neue Regeln im selben Ton, mit der Begründung, nicht mit der Beschreibung.
- Maßeinheit auf dem Brett ist der **Umkreisradius eines Feldes = 1** (`board/layout.ts:17`). Alle Abstände in diesem Plan stehen in dieser Einheit.
- `noUncheckedIndexedAccess` ist an.
- Tests: `pnpm --filter @conquerist/client test`. Ganze Abnahme: `pnpm typecheck && pnpm test && pnpm build && pnpm format:check`.
- Commits auf Deutsch, ASCII, ohne Trailer.

**Die Zahl, um die es geht:** ohne Einzug ist das Brett auf einem 740-px-Gerät ~330 px breit, die `viewBox` misst 9,76 Einheiten, also ≈ 34 px je Einheit. Benachbarte Knoten liegen 1 Einheit auseinander, eine Fingerkuppe misst 44 px. Bei der ersten Setzung ist **jeder** Knoten erlaubt. Deshalb reicht mehr Fläche allein nicht.

---

### Task 1: `nearestTarget` — aus einem Punkt wird ein Ziel

**Files:**
- Create: `apps/client/src/board/pick.ts`
- Create: `apps/client/src/board/pick.test.ts`

**Interfaces:**
- Consumes: `vertexPoint`, `edgeMidpoint`, `hexCenter` aus `./layout.js`; `ActionTargets` aus `../game/targets`; `Place` aus `./BoardSvg`
- Produces:
  - `interface TargetPoint { readonly place: Place; readonly point: Point }`
  - `targetPoints(targets: ActionTargets): readonly TargetPoint[]`
  - `nearestTarget(point: Point, targets: readonly TargetPoint[], reach?: number): Place | null`
  - `const PICK_REACH = 0.6`

- [ ] **Step 1: Write the failing test**

`apps/client/src/board/pick.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { hexCenter, vertexPoint } from './layout';
import { nearestTarget, PICK_REACH, targetPoints, type TargetPoint } from './pick';

const CENTER = 'v:0,0|1,-1|1,0';
const NEIGHBOUR = 'v:0,0|0,1|1,0';

const at = (vertex: string): TargetPoint => ({
  place: { kind: 'vertex', id: vertex },
  point: vertexPoint(vertex),
});

describe('nearestTarget', () => {
  it('nimmt das naehere von zwei Zielen', () => {
    const ziele = [at(CENTER), at(NEIGHBOUR)];
    const nahe = vertexPoint(CENTER);

    expect(nearestTarget({ x: nahe.x + 0.1, y: nahe.y }, ziele)).toEqual({
      kind: 'vertex',
      id: CENTER,
    });
  });

  it('nimmt auch dann das naehere, wenn das andere zuerst in der Liste steht', () => {
    // Der ganze Grund fuer diese Funktion: bei ueberlappenden Trefferflaechen
    // entschied vorher die Zeichenreihenfolge. Sie darf hier nichts entscheiden.
    const ziele = [at(NEIGHBOUR), at(CENTER)];
    const nahe = vertexPoint(CENTER);

    expect(nearestTarget({ x: nahe.x + 0.1, y: nahe.y }, ziele)).toEqual({
      kind: 'vertex',
      id: CENTER,
    });
  });

  it('gibt null zurueck, wenn nichts in Reichweite liegt', () => {
    expect(nearestTarget({ x: 99, y: 99 }, [at(CENTER)])).toBeNull();
  });

  it('gibt null zurueck, wenn es gar keine Ziele gibt', () => {
    // Der Fall des Vorschau-Bretts auf dem Startbildschirm.
    expect(nearestTarget({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('haelt die Reichweite ein', () => {
    const nahe = vertexPoint(CENTER);

    expect(nearestTarget({ x: nahe.x + PICK_REACH - 0.01, y: nahe.y }, [at(CENTER)])).not.toBeNull();
    expect(nearestTarget({ x: nahe.x + PICK_REACH + 0.01, y: nahe.y }, [at(CENTER)])).toBeNull();
  });

  it('bleibt bei gleichem Abstand bestimmt', () => {
    // Zwei Ziele exakt gleich weit weg: das Ergebnis muss reproduzierbar sein
    // und darf nicht vom Aufruf abhaengen.
    const a = vertexPoint(CENTER);
    const b = vertexPoint(NEIGHBOUR);
    const mitte = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    const erste = nearestTarget(mitte, [at(CENTER), at(NEIGHBOUR)]);
    const zweite = nearestTarget(mitte, [at(CENTER), at(NEIGHBOUR)]);

    expect(erste).toEqual(zweite);
  });
});

describe('targetPoints', () => {
  it('nimmt Knoten, Kanten und Felder auf', () => {
    const targets = {
      vertices: new Map([[CENTER, { type: 'buildSettlement' }]]),
      edges: new Map([['e:0,0|1,0', { type: 'buildRoad' }]]),
      hexes: new Map([['1,0', [{ type: 'moveRobber' }]]]),
      trades: [],
      roll: null,
      endTurn: null,
      buyCard: null,
      playKnight: null,
      buildable: { road: 0, settlement: 0, city: 0 },
    } as never;

    const punkte = targetPoints(targets);

    expect(punkte.map((eintrag) => eintrag.place.kind).sort()).toEqual(['edge', 'hex', 'vertex']);
    expect(punkte.find((eintrag) => eintrag.place.kind === 'hex')?.point).toEqual(hexCenter({ q: 1, r: 0 }));
  });

  it('gibt bei leeren Zielen eine leere Liste', () => {
    const targets = {
      vertices: new Map(),
      edges: new Map(),
      hexes: new Map(),
      trades: [],
      roll: null,
      endTurn: null,
      buyCard: null,
      playKnight: null,
      buildable: { road: 0, settlement: 0, city: 0 },
    } as never;

    expect(targetPoints(targets)).toEqual([]);
  });
});
```

Für den `hexCenter`-Vergleich: die Feld-Id wird mit derselben Funktion in einen `Hex` zerlegt, die `layout.ts` benutzt (`hexFromId` o. ä. aus `@conquerist/shared`). **Vor dem Schreiben in `layout.ts` nachsehen**, wie `hexCenter` dort aufgerufen wird, und es genauso tun.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/board/pick.test.ts`
Expected: FAIL — `./pick` existiert nicht.

- [ ] **Step 3: Write minimal implementation**

`apps/client/src/board/pick.ts`:

```ts
import type { Point } from '@conquerist/shared';

import type { ActionTargets } from '../game/targets';
import type { Place } from './BoardSvg';
import { edgeMidpoint, hexCenter, vertexPoint } from './layout';

/**
 * Aus einem Punkt auf dem Brett wird genau ein Ziel.
 *
 * Warum das eine eigene Funktion ist und keine groesseren Trefferkreise: bei
 * 34 px je Einheit liegen benachbarte Knoten 34 px auseinander, eine
 * Fingerkuppe misst 44 px. Trefferkreise in Fingergroesse **ueberlappen** also,
 * und dann entschiede die Zeichenreihenfolge, welches Ziel gemeint war - eine
 * willkuerliche Wahrheit an der Stelle, wo es genau eine geben muss.
 *
 * Rein und ohne DOM: die eigentliche Frage ("was habe ich getroffen") ist damit
 * pruefbar, ohne einen Klick zu simulieren.
 */

/** Wie weit ein Tipp danebenliegen darf, in Umkreisradien. */
export const PICK_REACH = 0.6;

export interface TargetPoint {
  readonly place: Place;
  readonly point: Point;
}

/** Wo die erlaubten Ziele auf dem Brett liegen. */
export function targetPoints(targets: ActionTargets): readonly TargetPoint[] {
  const points: TargetPoint[] = [];

  for (const vertex of targets.vertices.keys()) {
    points.push({ place: { kind: 'vertex', id: vertex }, point: vertexPoint(vertex) });
  }
  for (const edge of targets.edges.keys()) {
    points.push({ place: { kind: 'edge', id: edge }, point: edgeMidpoint(edge) });
  }
  for (const hex of targets.hexes.keys()) {
    points.push({ place: { kind: 'hex', id: hex }, point: hexCenter(hexOf(hex)) });
  }

  return points;
}

/**
 * Das naechstgelegene Ziel in Reichweite - oder `null`.
 *
 * Bei gleichem Abstand gewinnt das zuerst gefundene. Das ist keine Regel,
 * sondern eine Zusage: gleich weit heisst reproduzierbar, nicht zufaellig.
 */
export function nearestTarget(
  point: Point,
  targets: readonly TargetPoint[],
  reach: number = PICK_REACH,
): Place | null {
  let best: Place | null = null;
  let bestDistance = reach;

  for (const target of targets) {
    const distance = Math.hypot(target.point.x - point.x, target.point.y - point.y);
    if (distance < bestDistance) {
      best = target.place;
      bestDistance = distance;
    }
  }

  return best;
}
```

`hexOf` ist die Zerlegung der Feld-Id, die `layout.ts` schon benutzt — **von dort importieren, nicht neu schreiben.** Steht sie in `@conquerist/shared` (`geometry/`), von dort.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/board/pick.test.ts`
Expected: PASS (8 Tests)

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/board/pick.ts apps/client/src/board/pick.test.ts
git commit -m "Aus einem Punkt auf dem Brett wird genau ein Ziel"
```

---

### Task 2: Die Fangfläche

**Files:**
- Modify: `apps/client/src/board/BoardSvg.tsx` (Trefferkreise um :608-616, :495, :238)
- Test: `apps/client/src/board/BoardSvg.test.tsx`

**Interfaces:**
- Consumes: `targetPoints`, `nearestTarget` aus `./pick`
- Produces: `BoardSvg` ruft `onPick` über **eine** Fangfläche statt über Trefferkreise je Ziel

**Wichtig für den Test:** jsdom implementiert `SVGGraphicsElement.getScreenCTM` **nicht**. Die Umrechnung Klick → viewBox gehört deshalb in eine eigene kleine Funktion, und der Test setzt `getScreenCTM` am SVG-Element. Ohne diese Trennung ist die Komponente in jsdom nicht prüfbar.

- [ ] **Step 1: Write the failing test**

An `apps/client/src/board/BoardSvg.test.tsx` anhängen:

```tsx
describe('die Fangflaeche', () => {
  it('meldet das naechstgelegene Ziel', () => {
    const onPick = vi.fn();
    const { container } = render(<BoardSvg ... targets={targetsWithVertex(CENTER)} onPick={onPick} />);

    const svg = container.querySelector('svg')!;
    // jsdom kennt getScreenCTM nicht - eine Einheitsmatrix genuegt, weil der
    // Test in viewBox-Koordinaten denkt.
    svg.getScreenCTM = () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as never;

    const catcher = container.querySelector('[data-testid="board-catcher"]')!;
    fireEvent.click(catcher, { clientX: 0, clientY: 0 });

    expect(onPick).toHaveBeenCalledWith({ kind: 'vertex', id: CENTER });
  });

  it('meldet nichts, wenn es keine Ziele gibt', () => {
    // Das Vorschau-Brett auf dem Startbildschirm: es faengt, aber trifft nie.
    const onPick = vi.fn();
    const { container } = render(<BoardSvg ... targets={EMPTY_TARGETS} onPick={onPick} />);

    const svg = container.querySelector('svg')!;
    svg.getScreenCTM = () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as never;

    fireEvent.click(container.querySelector('[data-testid="board-catcher"]')!, { clientX: 0, clientY: 0 });

    expect(onPick).not.toHaveBeenCalled();
  });
});
```

Die Aufbauhilfen (`targetsWithVertex`, das Brett-Fixture) nimmt der Test aus dem, was `BoardSvg.test.tsx` schon hat. **Vor dem Schreiben lesen und dem folgen.**

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/board/BoardSvg.test.tsx`
Expected: FAIL — es gibt keine Fangfläche.

- [ ] **Step 3: Write minimal implementation**

In `BoardSvg.tsx`:

```tsx
/**
 * Klickstelle in viewBox-Koordinaten.
 *
 * Als eigene Funktion, weil jsdom `getScreenCTM` nicht kennt: so laesst sich
 * die Umrechnung im Test durch eine Einheitsmatrix ersetzen, ohne die
 * Komponente dafuer zu verbiegen.
 */
function viewBoxPointOf(svg: SVGSVGElement, clientX: number, clientY: number): Point | null {
  const ctm = svg.getScreenCTM();
  if (ctm === null) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const local = point.matrixTransform(ctm.inverse());

  return { x: local.x, y: local.y };
}
```

Steht `createSVGPoint` in jsdom nicht bereit, statt `SVGPoint` mit der inversen Matrix von Hand rechnen (`x' = a*x + c*y + e`, `y' = b*x + d*y + f`) — das ist derselbe Weg ohne DOM-Abhängigkeit und im Test dieselbe Einheitsmatrix.

Als **letztes** Kind des SVG (damit sie über allem liegt):

```tsx
      <rect
        data-testid="board-catcher"
        className="board__catcher"
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.width}
        height={viewBox.height}
        fill="transparent"
        onClick={(event) => {
          const svg = event.currentTarget.ownerSVGElement;
          if (svg === null) return;
          const point = viewBoxPointOf(svg, event.clientX, event.clientY);
          if (point === null) return;
          const place = nearestTarget(point, points);
          if (place !== null) onPick(place);
        }}
      />
```

`points` ist `useMemo(() => targetPoints(targets), [targets])`. Die `viewBox`-Werte kommen aus derselben Quelle wie das `viewBox`-Attribut (`viewBoxOf(...)`, :145) — **nicht** noch einmal ausrechnen.

Danach die bisherigen `onClick`-Handler an Knoten (:608), Kanten (:495) und Feldern (:238) entfernen, samt `vertex__hit`-Kreis (:612). Die **sichtbaren** Zielmarken (`vertex__target`, :615) bleiben — sie sagen weiter, wo etwas hingehört, sie fangen nur nichts mehr. In `index.css` die Regel für `.vertex__hit` mit entfernen, falls sie danach niemand mehr benutzt.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/board`
Expected: PASS — auch `motion.test.tsx`, `roads.test.tsx`, `terrain.test.tsx` bleiben grün.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/board apps/client/src/index.css
git commit -m "Eine Fangflaeche statt vieler ueberlappender Kreise"
```

---

### Task 3: Tippen, dann bestätigen

**Files:**
- Modify: `apps/client/src/screens/GameScreen.tsx` (`pick` ab :225, JSX ab :313)
- Modify: `apps/client/src/index.css`
- Test: `apps/client/src/screens/GameScreen.test.tsx`

**Interfaces:**
- Consumes: `Place` aus `../board/BoardSvg`
- Produces: `GameScreen` hält `pending: Place | null`; `onPick` setzt es, ein Knopf „Hier setzen" führt aus

- [ ] **Step 1: Write the failing test**

An `apps/client/src/screens/GameScreen.test.tsx` anhängen:

```tsx
describe('tippen, dann bestaetigen', () => {
  it('handelt beim ersten Tipp noch nicht', () => {
    const onAct = vi.fn();
    renderGame({ onAct, phase: 'setup' });

    pickVertex(CENTER);

    expect(onAct).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Hier setzen/ })).toBeInTheDocument();
  });

  it('handelt erst auf den Knopf', () => {
    const onAct = vi.fn();
    renderGame({ onAct, phase: 'setup' });

    pickVertex(CENTER);
    fireEvent.click(screen.getByRole('button', { name: /Hier setzen/ }));

    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it('verschiebt die Auswahl beim zweiten Tipp, statt zu setzen', () => {
    const onAct = vi.fn();
    renderGame({ onAct, phase: 'setup' });

    pickVertex(CENTER);
    pickVertex(FAR_VERTEX);

    expect(onAct).not.toHaveBeenCalled();
  });

  it('raeumt die Auswahl mit Escape', () => {
    renderGame({ phase: 'setup' });

    pickVertex(CENTER);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: /Hier setzen/ })).not.toBeInTheDocument();
  });
});
```

`renderGame` und `pickVertex` sind die Hilfen, die `GameScreen.test.tsx` schon hat (die Datei rendert dort bereits Partien und klickt auf das Brett). **Vor dem Schreiben lesen und die vorhandenen benutzen**; heißen sie anders, die vorhandenen Namen nehmen.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens/GameScreen.test.tsx`
Expected: FAIL — der erste Tipp handelt sofort, es gibt keinen Knopf.

- [ ] **Step 3: Write minimal implementation**

In `GameScreen.tsx` die vorhandene `pick`-Funktion **umbenennen** zu `commit` (der Rumpf bleibt Zeile für Zeile, wie er ist — er kennt Strassenbau und Räuberauswahl und darf sich nicht ändern) und davor setzen:

```tsx
  /**
   * Was angetippt, aber noch nicht ausgefuehrt ist.
   *
   * Der Zwischenschritt ist keine Bequemlichkeit, sondern die Bedingung dafuer,
   * dass es **einen** Weg fuer Maus und Finger gibt: bei 34 px zwischen
   * benachbarten Knoten und 44 px Fingerkuppe ist ein Tipp mehrdeutig, und ein
   * Fehlgriff war bis hierher sofort und unwiderruflich.
   */
  const [pending, setPending] = useState<Place | null>(null);

  const pick = useCallback((place: Place) => setPending(place), []);

  const confirm = useCallback(() => {
    if (pending === null) return;
    commit(pending);
    setPending(null);
  }, [pending, commit]);
```

Escape räumt ab:

```tsx
  useEffect(() => {
    if (pending === null) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPending(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);
```

Wechselt die Phase oder der handelnde Spieler, muss die Auswahl fallen — sonst steht ein Geist auf einem Ziel, das es nicht mehr gibt:

```tsx
  useEffect(() => setPending(null), [view.phase.kind, view.you]);
```

Im JSX, nach dem `BoardSvg`:

```tsx
      {pending !== null && (
        <div className="confirm" role="group" aria-label="Auswahl bestätigen">
          <button type="button" className="button button--go" onClick={confirm}>
            Hier setzen
          </button>
          <button type="button" className="button button--ghost" onClick={() => setPending(null)}>
            Abbrechen
          </button>
        </div>
      )}
```

Den **Geist** zeichnet das Brett: `BoardSvg` bekommt `pending` als zusätzliche Prop und zeichnet an dieser Stelle das Bauteil halbdurchsichtig (dieselbe Form wie das gebaute, mit `opacity`). Die Bauteilform steht in `board/shapes.ts` — von dort nehmen, nicht neu zeichnen.

In `index.css` `.confirm` als Ding auf dem Tisch anlegen (heller Körper, Kontaktschatten — Muster bei `.tray`), mittig unter dem Brett.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @conquerist/client exec vitest run src/screens`
Expected: PASS — auch die bestehenden `GameScreen`-Tests. **Erwartet fallen hier welche**, weil sie bisher „klicken und es ist gesetzt" annehmen. Sie bekommen den Bestätigungsklick dazu; das ist die richtige Reparatur, nicht ein zweiter Weg ohne Bestätigung.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/screens apps/client/src/board apps/client/src/index.css
git commit -m "Zwischen Absicht und Ausfuehrung steht ein Knopf"
```

---

### Task 4: Der Umschaltpunkt im Stilblatt

**Files:**
- Modify: `apps/client/src/index.css` (Abschnitt „Spielbildschirm", ab :1916)

**Interfaces:** keine — reines Blatt.

Dieser Task hat **keinen Unit-Test**: jsdom rechnet kein Layout, und eine Medienabfrage in einem Test zu behaupten wäre eine Prüfung der Behauptung, nicht des Verhaltens. Geprüft wird im Browser, Task 6.

- [ ] **Step 1: Den Umschaltpunkt anlegen**

Am Ende des Abschnitts „Spielbildschirm":

```css
/*
 * Unter 60rem gibt es keine leere See mehr neben dem Brett.
 *
 * `--tray-strip` zieht je Seite mindestens 236px ab. Das war fuer breite
 * Bildschirme richtig - dort steht die Ablage in der See, die das Brett ohnehin
 * nicht braucht. Gemessen: bei 900px Fenster ist das Brett noch 400px breit,
 * bei 480px null. Unter diesem Punkt wandert die Ablage deshalb **ueber** die
 * See statt neben das Brett.
 *
 * Die Grenze haengt an der Breite und nicht an `orientation`: ein Tablet
 * hochkant mit 800px ist derselbe Fall wie ein Handy quer - und ein schmales
 * Fenster am Schreibtisch auch.
 */
@media (max-width: 60rem) {
  .board-area {
    margin: 0;
  }
  ...
}
```

Darin:
- `.tray__hand` an den unteren Rand, zugeklappt ~3,2rem hoch, mit sichtbaren Kartenkanten; aufgeklappt über einen Zustand am Element (`[data-open='true']`) oder `:focus-within`.
- `.tray__controls` als senkrechte Reihe runder Knöpfe am rechten Rand.
- `.panel--table` auf eine Zeile.
- `.confirm` aus Task 3 über den unteren Streifen legen, damit der Knopf nicht darunter gerät.

- [ ] **Step 2: Den Hochformat-Hinweis anlegen**

```css
@media (orientation: portrait) and (max-width: 30rem) {
  .rotate-hint { display: flex; }
}
```

Der Hinweis selbst ist ein kleines Element im `GameScreen` mit einem Satz („Quer halten — dann liegt das Brett richtig") und einem Wegtipp-Knopf. **Kein Riegel:** wer im Hochformat zusehen will, soll das dürfen.

- [ ] **Step 3: Format und Bau prüfen**

Run: `pnpm format:check && pnpm build`
Expected: grün.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/index.css apps/client/src/screens/GameScreen.tsx
git commit -m "Unter 60rem legt sich die Ablage auf die See"
```

---

### Task 5: Abnahme im Browser

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Die ganze Abnahme fahren**

```bash
pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

- [ ] **Step 2: Die Brettbreite messen**

`pnpm dev`. **`resize_window` wirkt in dieser Umgebung nicht** (nachgewiesen, siehe `PROGRESS.md`); stattdessen der Iframe-Trick: eine Seite mit `<iframe src="http://localhost:5173" width="…">`, darin ist `100vw` die Iframe-Breite.

Zu messen bei **480, 740 und 900 px** Breite: die Breite von `.board` bzw. `.terrain`. Die alte Reihe zum Vergleich:

| Fenster | 480 | 560 | 700 | 900 | 1184 |
| ------- | --- | --- | --- | --- | ---- |
| vorher  | 0   | 60  | 200 | 400 | 684  |

**Abnahmekriterium:** bei 480 px deutlich über null, bei 740 px in der Größenordnung 300 px. Wird das nicht erreicht, ist der Umschaltpunkt oder eine Regel darin falsch — nicht die Messung nachgeben lassen.

- [ ] **Step 3: Setzen mit dem Finger prüfen**

Im schmalen Fenster eine lokale Partie starten und die Gründung durchklicken:

1. Ein Tipp neben einen Knoten wählt den nächstgelegenen — der Geist erscheint.
2. Ein zweiter Tipp verschiebt ihn.
3. „Hier setzen" setzt.
4. Über 60 rem gilt genau dasselbe (ein Weg, nicht zwei).

- [ ] **Step 4: `PROGRESS.md` fortschreiben**

Der Befund von 4104 und 4453 wird hier **abgeschlossen**. Der Eintrag nennt die neue Meßreihe neben der alten — das ist der Beleg, und ohne ihn bleibt der Befund offen.

- [ ] **Step 5: Commit**

```bash
git add PROGRESS.md
git commit -m "Das schmale Brett ist vermessen und abgenommen"
```

---

## Self-Review

**Spec-Abdeckung:** Abschnitt 1 (Umschaltpunkt) → Task 4. Abschnitt 2 (Ablage über die See) → Task 4. Abschnitt 3 (`pick.ts`, Fangfläche, `pending`) → Tasks 1, 2, 3. Abschnitt 4 (Vorschau-Brett) → Task 2, zweiter Test. Die Meßreihe als Abnahme → Task 5.

**Namen quer geprüft:** `PICK_REACH`, `TargetPoint`, `targetPoints`, `nearestTarget` (Tasks 1, 2). `Place` stammt unverändert aus `BoardSvg.tsx:33`. In Task 3 heißt die alte Funktion nach der Umbenennung `commit`, die neue `pick` — die Prop am `BoardSvg` bleibt `onPick`, damit sich die Schnittstelle des Bretts nicht ändert.

**Task 4 hat bewusst keinen Unit-Test.** Das ist keine Lücke, sondern die Grenze des Werkzeugs: jsdom rechnet kein Layout. Die Prüfung steht in Task 5 als Messung mit Zahlen und Abnahmekriterium — strenger als ein Test, der eine Medienabfrage nur behauptet.

**Drei Stellen verlangen einen Blick in den Bestand**, jeweils mit Angabe wohin: die `hexCenter`-Aufrufform in `layout.ts` (Task 1), die Aufbauhilfen in `BoardSvg.test.tsx` (Task 2) und in `GameScreen.test.tsx` (Task 3). In allen drei Fällen ist die Anweisung „nimm die vorhandene", nicht „denk dir eine aus" — ein zweiter Aufbauweg in einer Testdatei ist genau die Art Doppelung, die dieser Plan sonst abschafft.
