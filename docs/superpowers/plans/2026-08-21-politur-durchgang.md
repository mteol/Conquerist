# Politur-Durchgang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Bildschirm paßt bei 1280×720 ohne zu scrollen, das Brett steht auf jeder Fensterbreite, und die Oberfläche zeigt Zustände statt sie abzublenden.

**Architecture:** Kein neues Bauteil und keine neue Abstraktion. Die Vorspiel-Bildschirme bekommen dasselbe Raster, das `.game` schon trägt (feste Höhe, `overflow: hidden`, zwei Spalten); `--tray-strip` bekommt den zweiten Fall, den es bisher nicht kennt; der Zielfilter in `GameScreen` bekommt den Zweig, den sein eigener Kommentar schon beschreibt. Alles Weitere sind Textmengen und CSS.

**Tech Stack:** React 19 + Vite, TypeScript strict, Vitest + Testing Library (jsdom), reines CSS in einer Datei (`apps/client/src/index.css`, ~4100 Zeilen).

**Spec:** `docs/superpowers/specs/2026-08-21-politur-durchgang-design.md`

## Global Constraints

Alles hieraus gilt für jede Aufgabe. Die Quelle ist `CLAUDE.md`, Abschnitt „Design".

- **Kein Hex-Wert in einer Komponente.** Farben kommen aus Variablen in `index.css`. Wer eine braucht, die es nicht gibt, legt sie dort an und begründet sie im Kommentar.
- **Kein Font-Download.** Die Anzeigeschrift ist gezeichnet (`type/Numerals.tsx`, `screens/Wordmark.tsx`), Raster: Versalhöhe 100, Stammbreite 17, Fase 17 außen / 10 innen, Vorschub 81 für alle Ziffern.
- **`corner-shape: bevel`** schneidet Knöpfe, Felder, Rahmen, Dialoge. **Nie `clip-path`** — das schneidet den Kontaktschatten mit ab. Spielmaterial (Karten, Würfel, Chips, Bauteile) wird nicht geschnitten.
- **Überall Tabellenziffern** (`font-variant-numeric: tabular-nums`), wo Zahlen verglichen werden.
- **Antworten auf Deutsch, Code und Bezeichner auf Englisch.** Sichtbarer Text mit echten Umlauten.
- **Texte aktiv, ein Wort bleibt durch den ganzen Ablauf gleich.** Wer „Straße bauen" drückt, liest im Verlauf „hat eine Straße gebaut".
- **Farbe ist nie der einzige Träger einer Information.**
- **`prefers-reduced-motion`**: im selben Block **auch `animation-delay`** kürzen (negativ). Nur Eingangs-, nie Ausgangsanimationen für Information.
- **Spezifität nachzählen.** Eine Regel, die eine bestehende überschreiben soll, wird gegen sie gezählt — `.chip__pips` gegen `.chip text` ist zweimal verloren worden.
- **`PROGRESS.md` wird ohne Aufforderung fortgeschrieben.**
- **Commit-Nachrichten ohne `Co-Authored-By`.**
- **Nach jeder Aufgabe:** `pnpm typecheck` und `pnpm test` müssen grün sein (Stand vorher: 1070 Tests).

### Der Meß-Prüfstand

Mehrere Aufgaben verlangen eine Messung im Browser. Der Aufbau ist jedesmal derselbe und steht hier einmal:

```bash
# Client läuft auf 5173, Server auf 8080 (pnpm dev)
cat > apps/client/public/_probe.html <<'EOF'
<!doctype html>
<html><head><meta charset="utf-8"><title>Probe</title>
<style>html,body{margin:0;background:#222}#frame{width:1280px;height:720px;border:0;display:block}</style>
</head><body><iframe id="frame" src="/"></iframe></body></html>
EOF
```

Dann `http://localhost:5173/_probe.html` öffnen und im **Hüllseiten**-Kontext messen:

```js
const f = document.getElementById('frame');
const w = f.contentWindow,
  d = w.document;
({
  doc: d.documentElement.scrollHeight,
  vp: w.innerHeight,
  over: d.documentElement.scrollHeight - w.innerHeight,
});
```

Warum ein Iframe: `resize_window` meldet in der Chrome-Erweiterung Erfolg und läßt `innerWidth` stehen — der Seitenbereich frißt den Zuwachs. Im Rahmen lösen `100vw`/`100dvh` und Media Queries korrekt auf. Query-Parameter an der Hüllseite werden geblockt, die Maße gehören also fest ins HTML.

Zwei Eigenheiten, auf die man sonst hereinfällt: `screenshot` läuft häufig in einen 30-s-Timeout und klappt beim **zweiten** Versuch sofort — kein Fehler, einfach wiederholen. Und nach einem `zoom` bleibt die Aufnahme auf dessen Ausschnitt hängen; Kur ist ein neuer Tab.

**`_probe.html` wird am Ende jeder Aufgabe gelöscht** (`rm -f apps/client/public/_probe.html`) und nie mitcommittet.

### Vorher-Werte

Die Messung, gegen die alles geprüft wird. Aus der Spec, Stand `a8511eb`.

| Bildschirm              | Höhe bei 720 px Viewport | Überhang |
| ----------------------- | -----------------------: | -------: |
| Hauptmenü               |                      720 |        0 |
| Partie starten — online |                      929 |     +209 |
| Partie starten — lokal  |                     1081 |     +361 |
| Wartebereich            |                     1326 |     +606 |
| Spielbildschirm         |                      720 |        0 |

Brettbreite (`svg.board`), Viewporthöhe konstant 720:

| Fenster | 1600 | 1280 | 1100 | 992 | 900 | 760 | 640 | 540 | 480 | 420 | 390 |
| ------- | ---: | ---: | ---: | --: | --: | --: | --: | --: | --: | --: | --: |
| Brett   |  759 |  759 |  604 | 496 | 404 | 264 | 144 |  44 |   0 |   0 |   0 |

---

## File Structure

Welche Datei wofür zuständig ist, und was sich darin ändert.

| Datei                                        | Rolle                                                                                                                                                                                  | Aufgabe          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `apps/client/src/index.css`                  | Die einzige Stilquelle. `.game` (1704), `.board-area` (1752), `.tray` (1867), `.start` (696), `.start__panel` (709), `.lobby` (1434), `.settings__slider` (4101), `.die--blank` (2739) | 1, 3, 4, 5, 6, 7 |
| `apps/client/src/screens/GameScreen.tsx`     | Spielbildschirm, `boardTargets`-Filter (~213), `.mode`-Leisten (~570–595), `BUILD_HINTS` (97)                                                                                          | 2                |
| `apps/client/src/screens/LobbyScreen.tsx`    | Wartebereich, 374 Zeilen — bekommt zwei Spalten und die Brettvorschau                                                                                                                  | 4                |
| `apps/client/src/screens/StartScreen.tsx`    | Aufbau-Bildschirm, 508 Zeilen — Titel, Diagnose, Chips, Startknopf                                                                                                                     | 5                |
| `apps/client/src/board/boardPreview.ts`      | **Neu.** Die Vorschau-Rechnung (Blueprint + Seed → `GameState`), heute in `StartScreen` eingebaut                                                                                      | 4                |
| `apps/client/src/panels/DiceTray.tsx`        | Würfelbecher, `.die--blank`-Fall (245)                                                                                                                                                 | 6                |
| `apps/client/src/dialogs/SettingsDialog.tsx` | Regler                                                                                                                                                                                 | 7                |
| `CLAUDE.md`                                  | Designregeln — bekommt Regel 9                                                                                                                                                         | 9                |
| `PROGRESS.md`                                | Standsdatei                                                                                                                                                                            | 9                |

`boardPreview.ts` ist die einzige neue Datei, und sie entsteht aus einem konkreten Bedarf: Aufgabe 4 braucht dieselbe Rechnung, die heute in `StartScreen` steht. Zweimal geschrieben liefen sie auseinander, und dann zeigte der Wartebereich ein anderes Brett als der Aufbau.

**Reihenfolge:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Aufgabe 1 und 2 sind unabhängig voneinander; alle anderen bauen auf ihren Vorgängern nur insoweit auf, als sie denselben Prüfstand benutzen.

---

## Task 1: Das Brett steht auf jeder Fensterbreite

Der schwerste Befund (B1), der kleinste Eingriff. Unter 496 px Fensterbreite ist das Brett null Pixel breit, weil `--tray-strip` seinen Boden von `14.75rem` auch dort hält, wo er zum Deckel wird.

**Files:**

- Modify: `apps/client/src/index.css` — `.game` (Zeile 1704), Media-Query-Block neu
- Test: `apps/client/src/screens/GameScreen.test.tsx`

**Interfaces:**

- Consumes: nichts
- Produces: die CSS-Variable `--tray-strip` behält ihren Namen und ihre Bedeutung („Breite einer unteren Ecke, zugleich seitlicher Einzug des Bretts"); neu ist nur, daß sie unter 62 rem auf `0` fällt. Aufgabe 3 und 6 verlassen sich darauf, daß `.tray__hand` / `.tray__controls` weiterhin `max-width: var(--tray-strip)` lesen.

- [ ] **Step 1: Den Ist-Zustand messen und festhalten**

Prüfstand aufbauen (siehe Global Constraints), lokale Partie starten, dann im Hüllseiten-Kontext:

```js
const f = document.getElementById('frame');
const out = {};
for (const wpx of [1280, 992, 900, 760, 640, 540, 480, 420, 390]) {
  f.style.width = wpx + 'px';
  f.style.height = '720px';
  await new Promise((r) => setTimeout(r, 450));
  const b = f.contentWindow.document.querySelector('svg.board');
  out[wpx] = b ? Math.round(b.getBoundingClientRect().width) : 'kein Brett';
}
JSON.stringify(out);
```

Erwartet (aus der Spec): `{"1280":759,"992":496,"900":404,"760":264,"640":144,"540":44,"480":0,"420":0,"390":0}`.

Weicht die Messung ab, **hier anhalten** und melden — dann hat sich seit `a8511eb` etwas geändert, und der Rest des Plans steht auf einer falschen Zahl.

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

In `apps/client/src/screens/GameScreen.test.tsx` ans Ende, vor die schließende Klammer der äußersten `describe`:

```tsx
describe('die Eckenablage auf schmalen Fenstern', () => {
  /*
   * Der Test liest das Blatt, nicht das Layout: jsdom rechnet `max()` und
   * `calc()` mit Viewport-Einheiten nicht aus, ein `getBoundingClientRect`
   * gaebe hier also 0 fuer jede Breite und waere kein Beweis. Was er
   * festhaelt, ist die Zusicherung selbst - dass es unter 62rem einen Zweig
   * gibt, der `--tray-strip` auf 0 setzt. Die Zahlen dahinter misst der
   * Pruefstand im Browser.
   */
  it('setzt --tray-strip unter 62rem auf 0', async () => {
    const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

    const narrow = css.match(/@media \(max-width: 62rem\)[\s\S]*?\n}/g) ?? [];
    const gameBlock = narrow.find((block) => block.includes('.game'));

    expect(gameBlock, 'kein @media (max-width: 62rem) mit .game darin').toBeDefined();
    expect(gameBlock).toMatch(/--tray-strip:\s*0\s*;/);
  });

  it('haelt den Boden von 14.75rem oberhalb der Schwelle', async () => {
    const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

    // Die Basisregel bleibt, wie sie ist - der Zweig hebt sie nur unterhalb auf.
    expect(css).toMatch(/--tray-strip:\s*max\(14\.75rem,/);
  });
});
```

Und ganz oben in der Datei, zu den bestehenden Importen:

```tsx
import { readFile } from 'node:fs/promises';
```

- [ ] **Step 3: Den Test laufen lassen und den Fehlschlag sehen**

```bash
cd apps/client && npx vitest run src/screens/GameScreen.test.tsx -t "Eckenablage"
```

Erwartet: der erste Test schlägt fehl mit „kein @media (max-width: 62rem) mit .game darin"; der zweite ist bereits grün (die Basisregel steht schon).

- [ ] **Step 4: Den Zweig schreiben**

In `apps/client/src/index.css` **direkt hinter** dem `.board` -Block (nach Zeile 1762, vor dem Kommentar „Panels sind keine Fenster mehr"):

```css
/*
 * Unter 62rem hoert die Ecke auf, eine Ecke zu sein.
 *
 * `--tray-strip` ist als **Boden** gedacht - „das Brett wird an keiner
 * Fenstergroesse kleiner als vorher". Auf einem breiten Fenster stimmt das.
 * Auf einem schmalen ist derselbe Boden ein **Deckel fuer das Brett**: die
 * zwei Ecken bekommen ihre je 236px zugesichert, und das Brett bekommt, was
 * uebrig bleibt. Gemessen war das eine Gerade - Brettbreite gleich
 * Fensterbreite minus 496 - und unter 496px blieb nichts uebrig: null Pixel
 * Brett, kein einziges Sechseck auf dem Bildschirm.
 *
 * Die Schwelle ist nicht neu erfunden, es ist der Breakpoint, den `.start`
 * schon fuehrt. Sie passt auch der Rechnung nach: bei 62rem bleiben 496px
 * Brett - schmal, aber ein Brett; eine Stufe darunter sind es 404, dann 264,
 * und ab da ist es kein Brett mehr, sondern ein Rest.
 *
 * Unterhalb liegt die Ablage deshalb **unter** dem Brett statt neben ihm, und
 * `--tray-strip` faellt auf 0 - der Einzug, der die Ueberdeckung verhindert
 * hat, verhindert dort nichts mehr, weil sich nichts mehr ueberdeckt.
 */
@media (max-width: 62rem) {
  .game {
    --tray-strip: 0px;

    /* Zwei Zeilen statt einer: das Brett oben, die Ablage darunter. `auto`
       fuer die Ablage heisst „so hoch wie noetig" - sie soll dem Brett
       nehmen, was sie braucht, und keinen Streifen mehr. */
    grid-template-rows: minmax(0, 1fr) auto;
  }

  /*
   * Die Ablage verlaesst die absolute Lage und wird eine gewoehnliche
   * Rasterzeile. `position: static` ist dabei der ganze Umzug - `right`,
   * `bottom` und `left` gelten dann nicht mehr und muessen nicht
   * zurueckgenommen werden.
   */
  .tray {
    position: static;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: flex-start;
    justify-content: flex-start;
    /* Die Mitte faengt hier keine Klicks mehr ab, weil sie unter dem Brett
       liegt und nicht darauf. Die Kinder brauchen ihr `auto` trotzdem - es
       steht in `.tray > *` und gilt weiter. */
    pointer-events: auto;
  }

  /*
   * Ohne Deckel: `max-width: var(--tray-strip)` waere jetzt `max-width: 0`
   * und liesse Hand und Bedienung auf null schrumpfen. Der Deckel gehoert zur
   * Ecke, und es gibt keine Ecke mehr.
   */
  .tray__hand,
  .tray__controls {
    max-width: none;
  }
}

/*
 * Bewegung, die es hier nicht gibt: der Wechsel zwischen Ecke und Zeile ist
 * kein Zustandswechsel im Spiel, sondern eine andere Fenstergroesse (Regel 5).
 * Er wird nicht animiert.
 */
```

- [ ] **Step 5: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/screens/GameScreen.test.tsx -t "Eckenablage"
```

Erwartet: beide PASS.

- [ ] **Step 6: Im Browser nachmessen**

Prüfstand, lokale Partie, derselbe Sweep wie in Step 1.

Erwartet: **bei jeder Breite eine Brettbreite größer als 0.** Bei 992 und darüber unverändert gegen Step 1 (496 / 604 / 759) — der Zweig darf oberhalb der Schwelle nichts ändern. Bei 900 und darunter deutlich größer als vorher, weil das Brett dort die volle Breite bekommt.

Dazu ein Blick bei 390×760, ob sich nichts überdeckt:

```js
const d = document.getElementById('frame').contentWindow.document;
const b = d.querySelector('svg.board').getBoundingClientRect();
const t = d.querySelector('.tray').getBoundingClientRect();
({
  brett: [Math.round(b.width), Math.round(b.height)],
  ablage: [Math.round(t.top), Math.round(t.height)],
  ueberdeckt: b.bottom > t.top + 1,
});
```

Erwartet: `ueberdeckt: false`.

- [ ] **Step 7: Die volle Prüfung**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test
```

Erwartet: grün, 1072 Tests (1070 + 2 neue).

- [ ] **Step 8: Prüfstand wegräumen und committen**

```bash
cd /c/code/Conquerist && rm -f apps/client/public/_probe.html
git add apps/client/src/index.css apps/client/src/screens/GameScreen.test.tsx
git commit -F - <<'EOF'
Unter 62rem legt sich die Ablage unter das Brett

Gemessen war die Brettbreite eine Gerade: Fensterbreite minus 496 Pixel, und
unter 496 blieb nichts uebrig - bei 390px stand kein einziges Sechseck auf dem
Bildschirm. Der Boden von `--tray-strip` sichert den zwei Ecken ihre je 236px
zu, und was uebrig bleibt, bekommt das Brett; auf einem schmalen Fenster ist
derselbe Boden deshalb ein Deckel fuer das Brett.

Unterhalb der Schwelle - dem Breakpoint, den `.start` schon fuehrt - hoert die
Ecke auf, eine Ecke zu sein: die Ablage wird eine Zeile unter dem Brett, und
der Einzug faellt auf null, weil er dort nichts mehr verhindert.
EOF
```

---

## Task 2: Die Gründung markiert ihre Knoten selbst

B3 und B4 am selben Ort. Der Filter in `boardTargets` läßt in der Gründung nichts durch, obwohl sein eigener Kommentar das Gegenteil beschreibt; und die Statuszeile steht zweimal.

**Files:**

- Modify: `apps/client/src/screens/GameScreen.tsx` — `boardTargets` (~213), `.mode`-Block (~583–595)
- Test: `apps/client/src/screens/GameScreen.test.tsx`

**Interfaces:**

- Consumes: `buildKindOf(action: GameAction): BuildableKind | null` aus `../game/targets` (unverändert), `ActionTargets` mit `vertices: Map<VertexId, GameAction>` und `edges: Map<EdgeId, GameAction>`
- Produces: nichts Neues nach außen. `BUILD_HINTS` bleibt exportlos und behält seine drei Schlüssel `road` / `settlement` / `city`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `apps/client/src/screens/GameScreen.test.tsx`. Wie eine Partie in diesem Test aufgebaut wird, steht in den bestehenden Fällen derselben Datei — den Aufbau von dort übernehmen, nicht neu erfinden.

```tsx
describe('die Gruendung', () => {
  it('markiert die Knoten ohne Vorklick auf ein Bauteil', () => {
    // Eine frische Partie steht in der Gruendung: Spieler 1 setzt eine
    // Siedlung. Nichts anklicken - genau das ist der Punkt.
    renderGame();

    const marks = document.querySelectorAll('[data-target="true"]');
    expect(marks.length).toBeGreaterThan(0);
  });

  it('zeigt in der Gruendung keine zweite Statuszeile', () => {
    renderGame();

    // Der Satz oben rechts sagt es bereits; die `.mode`-Leiste daneben waere
    // dieselbe Auskunft ein zweites Mal.
    expect(screen.queryByTestId('build-mode')).toBeNull();
  });
});
```

`renderGame()` ist der Aufbauhelfer, den die Datei schon benutzt — den bestehenden Namen verwenden.

- [ ] **Step 2: Den Test laufen lassen und den Fehlschlag sehen**

```bash
cd apps/client && npx vitest run src/screens/GameScreen.test.tsx -t "Gruendung"
```

Erwartet: der erste Test schlägt fehl mit `expected 0 to be greater than 0`. Der zweite ist grün — die Leiste erscheint heute erst nach dem Vorklick.

- [ ] **Step 3: Den Zweig in den Filter schreiben**

In `apps/client/src/screens/GameScreen.tsx`, in `boardTargets`, die Funktion `shown` ersetzen:

```tsx
/*
 * Was das Brett zeigt, wenn kein Bauteil gewaehlt ist.
 *
 * Der Kommentar ueber dieser Rechnung sagt seit dem ersten Playtest, die
 * Gruendung leuchte weiter - „beide sind keine Wahl: in der Gruendung gibt
 * es genau eine Sache zu setzen". Der Raeuber tut das auch; die Gruendung
 * tat es nicht. `buildKindOf` gibt fuer `placeSetupSettlement` dieselbe
 * Sorte zurueck wie fuer `buildSettlement`, und der Filter sah nur auf die
 * Sorte - also fiel die Gruendung mit heraus.
 *
 * Gemessen: null Zielmarken auf dem Brett, waehrend die Statuszeile
 * „Gruendung: Spieler 1 setzt eine Siedlung" sagte. Der erste Eindruck des
 * Spiels war ein Brett, das nicht reagiert.
 *
 * Der Zweischritt bleibt, wo er etwas entscheidet: im laufenden Zug stehen
 * drei Bauteile zur Wahl, und ohne die Wahl vorher waere der Ort ein
 * Raten. In der Gruendung steht nur eines zur Wahl.
 */
const isSetup = (action: GameAction): boolean =>
  action.type === 'placeSetupSettlement' || action.type === 'placeSetupRoad';

const shown = (action: GameAction): boolean => {
  if (isSetup(action)) return true;
  const kind = buildKindOf(action);
  return kind === null || kind === buildMode;
};
```

- [ ] **Step 4: Die doppelte Statuszeile entfernen**

In derselben Datei, an der `.mode`-Leiste für `buildMode` (die mit `data-testid="build-mode"`), die Bedingung erweitern. Aus:

```tsx
      {buildMode === null || buildingRoads !== null ? null : (
```

wird:

```tsx
      {/*
       * Die Leiste sagt „jetzt auf dem Brett zeigen" - und oben rechts steht
       * schon, was zu tun ist. Zwei Zeilen mit derselben Auskunft, 400px
       * auseinander: das war B6 aus dem Durchgang vom 16.08. und ist es
       * geblieben.
       *
       * Sie bleibt, wo sie etwas hinzufuegt: nach der Wahl eines Bauteils ist
       * sie die einzige Stelle, an der „Abbrechen" steht. In der Gruendung
       * gibt es nichts abzubrechen - dort ist sie nur das Echo.
       */}
      {buildMode === null || buildingRoads !== null || isSetupPhase ? null : (
```

Und weiter oben, neben `const targets = useMemo(...)`:

```tsx
/*
 * Die Gruendung als eigener Fall - sie kommt in diesem Bildschirm zweimal
 * vor (Zielfilter und Statusleiste), und zweimal `view.phase.kind` zu
 * lesen hiesse, dass ein spaeterer Phasenname an einer Stelle nachgezogen
 * wird und an der anderen nicht.
 */
const isSetupPhase = view.phase.kind === 'setup';
```

`'setup'` ist **nachgeschlagen und bestätigt**: `packages/shared/src/game/phase.ts:37` führt `kind: z.literal('setup')`. Die übrigen sechs Phasen heißen `rollPending`, `discardPending`, `robberPending`, `main`, `tradePending`, `finished` — keine davon darf durch den neuen Zweig fallen.

- [ ] **Step 5: Die Tests laufen lassen**

```bash
cd apps/client && npx vitest run src/screens/GameScreen.test.tsx
```

Erwartet: alle PASS, auch die bestehenden Fälle zum Zweischritt — die dürfen nicht kippen. Kippt einer, ist der Zweig zu breit geraten: er soll `placeSetup…` durchlassen und sonst nichts.

- [ ] **Step 6: Im Browser nachsehen**

Prüfstand, lokale Partie starten. Erwartet, **ohne irgendwo zu klicken**:

```js
const d = document.getElementById('frame').contentWindow.document;
({
  marken: d.querySelectorAll('[data-target="true"]').length,
  leiste: !!d.querySelector('[data-testid="build-mode"]'),
});
```

Erwartet: `marken: 54`, `leiste: false`.

Danach eine Siedlung setzen und weiterspielen bis in den laufenden Zug; dort ein Bauteil wählen und prüfen, daß die Leiste samt „Abbrechen" wiederkommt.

- [ ] **Step 7: Die volle Prüfung und committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add apps/client/src/screens/GameScreen.tsx apps/client/src/screens/GameScreen.test.tsx
git commit -F - <<'EOF'
Die Gruendung leuchtet, wie es seit dem Playtest im Kommentar steht

Ueber `boardTargets` stand: „in der Gruendung gibt es genau eine Sache zu
setzen, ein Knopf davor waere ein Schritt, der nichts entscheidet". Der Raeuber
hat sich daran gehalten, die Gruendung nicht - `buildKindOf` gibt fuer
`placeSetupSettlement` dieselbe Sorte zurueck wie fuer `buildSettlement`, und
der Filter sah nur auf die Sorte.

Gemessen: null Zielmarken, waehrend die Statuszeile die Siedlung verlangte. Das
einzige freigegebene Bedienelement war ein 30px grosses Bauteil in der Ecke.

Mit den Marken faellt auch das Echo: die Bauleiste sagte in der Gruendung
dasselbe wie der Satz oben rechts, 400 Pixel daneben.
EOF
```

---

## Task 3: Die Bauleiste verläßt das Brett

Der Rest von B4: die `.mode`-Leiste schwimmt als Kasten mit Akzentrahmen über der obersten Hex-Reihe. Das Brett ist der Held (Regel 4).

**Files:**

- Modify: `apps/client/src/index.css` — `.mode`-Block
- Test: `apps/client/src/screens/GameScreen.test.tsx`

**Interfaces:**

- Consumes: `--tray-strip` aus Aufgabe 1 (unverändert benutzt)
- Produces: nichts

- [ ] **Step 1: Den Ist-Zustand messen**

Prüfstand, lokale Partie, ein Bauteil wählen, dann:

```js
const d = document.getElementById('frame').contentWindow.document;
const m = d.querySelector('.mode').getBoundingClientRect();
const b = d.querySelector('svg.board').getBoundingClientRect();
({
  leiste: [Math.round(m.left), Math.round(m.top), Math.round(m.width)],
  brett: [Math.round(b.left), Math.round(b.top)],
  ueberdeckt: m.bottom > b.top + 1,
});
```

Erwartet: `ueberdeckt: true`.

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

```tsx
it('legt die Bauleiste nicht auf das Brett', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const mode = css.match(/\n\.mode \{[\s\S]*?\n\}/)?.[0];

  expect(mode, 'kein .mode-Block gefunden').toBeDefined();
  // Sie sitzt in der Ablage-Zeile und nicht frei ueber dem Brett.
  expect(mode).not.toMatch(/position:\s*(absolute|fixed)/);
});
```

- [ ] **Step 3: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/screens/GameScreen.test.tsx -t "Bauleiste"
```

Erwartet: FAIL — der heutige `.mode`-Block ist absolut gesetzt.

- [ ] **Step 4: Die Leiste umziehen**

Den `.mode`-Block in `index.css` suchen (`grep -n "^\.mode" apps/client/src/index.css`) und die absolute Lage durch eine Lage **in der linken Ecke, über den Zugknöpfen** ersetzen — dort steht ohnehin schon, was man in diesem Zug tut, und die Maus ist dort.

```css
/*
 * Der zweite Schritt, in Worten - und er steht bei der Hand, nicht auf dem
 * Brett.
 *
 * Sie war ein Kasten mit Akzentrahmen, der ueber der obersten Hex-Reihe
 * schwamm. Das Brett ist der Held (Regel 4), und ein Kasten darauf nimmt ihm
 * genau den Platz, den der ganze vorige Umbau ihm verschafft hat.
 *
 * In der linken Ecke, ueber „Handel" und „Zug beenden", steht sie da, wo die
 * Maus in diesem Augenblick ohnehin ist: man hat gerade ein Bauteil gewaehlt
 * und sucht die Stelle. Der Abbruch liegt damit einen Zentimeter neben dem
 * Knopf, der ihn noetig gemacht hat.
 */
.mode {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  max-width: var(--tray-strip);
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  background: rgb(0 0 0 / 42%);
  color: var(--on-sea);
  font-size: 0.8rem;
  line-height: 1.3;
}
```

Und im Markup von `GameScreen.tsx` wandern **beide** `.mode`-Leisten (Straßenbau und Bauwahl) in `.tray__hand`, über die Zugknöpfe. Wo genau, zeigt `grep -n "tray__hand" apps/client/src/screens/GameScreen.tsx`.

Dazu in den `@media (max-width: 62rem)`-Block aus Aufgabe 1:

```css
/* Ohne Ecke auch hier kein Deckel - dieselbe Begruendung wie bei
     `.tray__hand`. */
.mode {
  max-width: none;
}
```

- [ ] **Step 5: Tests laufen lassen**

```bash
cd apps/client && npx vitest run src/screens/GameScreen.test.tsx
```

Erwartet: alle PASS.

- [ ] **Step 6: Im Browser nachmessen**

Derselbe Ausdruck wie Step 1, bei 1280×720 und bei 390×760.

Erwartet beide Male: `ueberdeckt: false`.

- [ ] **Step 7: Volle Prüfung und committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add apps/client/src/index.css apps/client/src/screens/GameScreen.tsx apps/client/src/screens/GameScreen.test.tsx
git commit -F - <<'EOF'
Die Bauleiste zieht vom Brett zur Hand

Sie war ein Kasten mit Akzentrahmen ueber der obersten Hex-Reihe. Das Brett ist
der Held, und ein Kasten darauf nimmt ihm den Platz, den der Umbau der Ablage
ihm gerade erst verschafft hat.

In der linken Ecke ueber den Zugknoepfen steht sie da, wo die Maus in diesem
Augenblick ohnehin ist - man hat eben ein Bauteil gewaehlt und sucht die
Stelle. Der Abbruch liegt damit neben dem Knopf, der ihn noetig gemacht hat.
EOF
```

---

## Task 4: Der Wartebereich wird eine Fläche mit Brett

B2, der größte Umbau: 1326 px hoch auf 720 px Viewport, und zwei Drittel der Breite stehen leer. Beide Handlungen des Bildschirms liegen unter der Falte. Und der Seed ist dort verstellbar, ohne daß man sieht, was er tut.

**Files:**

- Create: `apps/client/src/board/boardPreview.ts`
- Create: `apps/client/src/board/boardPreview.test.ts`
- Modify: `apps/client/src/screens/LobbyScreen.tsx`
- Modify: `apps/client/src/screens/StartScreen.tsx` (benutzt fortan `boardPreview`)
- Modify: `apps/client/src/index.css` — `.lobby`-Blöcke ab 1434
- Test: `apps/client/src/screens/LobbyScreen.test.tsx`

**Interfaces:**

- Consumes: `blueprintsFor(playerCount: number): readonly ScenarioBlueprint[]` aus `../screens/StartScreen` — **wird nach `boardPreview.ts` verschoben**, `StartScreen` re-exportiert sie nicht. Bestehende Importe umhängen. `BoardSvg` mit den Props `{ state, targets, seats, onPick }`, `EMPTY_TARGETS` aus `../game/targets`, `defaultSeats(count)` aus `../seats`.
- Produces:

  ```ts
  export function blueprintsFor(playerCount: number): readonly ScenarioBlueprint[];
  export function previewGame(seatCount: number, seed: string): GameState | null;
  ```

  `previewGame` gibt `null` zurück, wenn es zu dieser Sitzzahl kein Brett gibt oder der Generator wirft. Aufgabe 5 benutzt beide.

- [ ] **Step 1: Den fehlschlagenden Test für `boardPreview` schreiben**

`apps/client/src/board/boardPreview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { blueprintsFor, previewGame } from './boardPreview';

describe('previewGame', () => {
  it('baut zu drei Spielern ein Brett', () => {
    const game = previewGame(3, 'abcd');
    expect(game).not.toBeNull();
    expect(game!.scenario.hexes.length).toBeGreaterThan(0);
  });

  it('gibt zum selben Seed dasselbe Brett', () => {
    // Der Wartebereich und der Aufbau zeigen dieselbe Vorschau. Waeren es zwei
    // Rechnungen, zeigten sie irgendwann zwei Bretter.
    const a = previewGame(4, 'gleich');
    const b = previewGame(4, 'gleich');
    expect(a!.scenario.hexes).toEqual(b!.scenario.hexes);
  });

  it('gibt null, wo es kein passendes Brett gibt', () => {
    // blueprintsFor liest minPlayers/maxPlayers aus dem Blueprint - eine
    // Sitzzahl ausserhalb liefert keine Vorlage.
    expect(previewGame(99, 'abcd')).toBeNull();
  });

  it('baut auch aus einem leeren Seed ein Brett', () => {
    /*
     * Nachgemessen und ausdruecklich festgehalten: `generateScenario` wirft
     * bei leerem Seed **nicht**, es liefert ein gueltiges Brett. Der Fall
     * steht hier, weil das Eingabefeld leer sein kann und die Vorschau dann
     * nicht verschwinden soll - und weil beim naechsten Lesen sonst jemand
     * einen `null`-Zweig fuer diesen Fall einbaut, den es nicht gibt.
     */
    expect(previewGame(3, '')).not.toBeNull();
  });
});

describe('blueprintsFor', () => {
  it('liest die Grenzen aus dem Blueprint', () => {
    expect(blueprintsFor(3).length).toBe(1);
    expect(blueprintsFor(6).length).toBe(1);
    expect(blueprintsFor(99).length).toBe(0);
  });
});
```

Der `try`/`catch` in `previewGame` bleibt trotzdem stehen — er fängt, was der Generator bei einer _anderen_ schlechten Eingabe tut, und eine Vorschau darf den Bildschirm nie mitnehmen. Er ist nur nicht durch diesen Testfall belegt.

- [ ] **Step 2: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/board/boardPreview.test.ts
```

Erwartet: FAIL, „Cannot find module './boardPreview'".

- [ ] **Step 3: `boardPreview.ts` schreiben**

```ts
import {
  CLASSIC_34,
  CLASSIC_56,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  type GameState,
  type ScenarioBlueprint,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';

/**
 * Das Brett zu einem Seed - fuer jeden Bildschirm, der eines zeigt.
 *
 * **Warum es eine eigene Datei ist.** Die Rechnung stand im `StartScreen`, und
 * der Wartebereich brauchte sie auch: dort ist derselbe Seed noch einmal
 * verstellbar, und zwar an der teureren Stelle - es sitzen schon Leute am
 * Tisch. Zweimal geschrieben liefen die beiden auseinander, und dann zeigte
 * der Wartebereich ein anderes Brett als der Aufbau.
 *
 * Sie gehoert nach `board/` und nicht nach `screens/`: sie kennt keinen
 * Bildschirm, nur ein Brett.
 */
const BLUEPRINTS: readonly ScenarioBlueprint[] = [CLASSIC_34, CLASSIC_56];

/**
 * Welche Bretter eine Tischgroesse tragen.
 *
 * Die Grenzen stehen im Blueprint (`minPlayers` / `maxPlayers`) und werden hier
 * gelesen, nicht wiederholt - sonst gaebe es zwei Wahrheiten, und `createGame`
 * wuerde mit Recht werfen.
 */
export function blueprintsFor(playerCount: number): readonly ScenarioBlueprint[] {
  return BLUEPRINTS.filter(
    (blueprint) => playerCount >= blueprint.minPlayers && playerCount <= blueprint.maxPlayers,
  );
}

/**
 * Das Brett, das diese Runde bekaeme - oder `null`.
 *
 * `null` und kein Wurf: eine Vorschau, die nicht entsteht, darf den Bildschirm
 * nicht mitnehmen. Was schiefging, sagt beim Starten die Meldung aus
 * `createGame`; hier waere sie eine Fehlermeldung ueber ein Bild.
 */
export function previewGame(seatCount: number, seed: string): GameState | null {
  const blueprint = blueprintsFor(seatCount)[0];
  if (blueprint === undefined) return null;

  try {
    const scenario = generateScenario(blueprint, seed);
    return createGame(
      scenario,
      CLASSIC_RULES,
      defaultSeats(seatCount).map((seat) => seat.id),
      seed,
    );
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/board/boardPreview.test.ts
```

Erwartet: PASS.

- [ ] **Step 5: `StartScreen` auf `boardPreview` umhängen**

In `apps/client/src/screens/StartScreen.tsx`: `BLUEPRINTS` und `blueprintsFor` löschen, statt dessen aus `../board/boardPreview` importieren. Das `useMemo` für `preview` ruft `previewGame(seats.length, seed)`.

**Achtung:** `StartScreen` benutzt für die Partie `seats.map((entry) => entry.id)` — die echten Sitze mit Namen —, `previewGame` benutzt `defaultSeats`. Für das **Brett** ist das gleich (der Generator sieht nur die Anzahl), für den **Start** nicht. `startLocal` darf deshalb nicht `previewGame` benutzen, sondern baut sein Spiel weiterhin selbst mit den echten Sitzen. Das im Kommentar festhalten:

```tsx
/*
 * Die Vorschau nimmt Platzhalter-Sitze, die Partie die echten.
 *
 * Fuer das Brett ist das gleich - der Generator sieht nur die Anzahl. Fuer
 * die Partie nicht: dort haengen Namen und Farben an den Ids. Deshalb baut
 * `startLocal` sein Spiel selbst und nimmt nicht das Bild von der Wand.
 */
```

Alle Stellen finden, die `blueprintsFor` aus `StartScreen` importieren:

```bash
grep -rn "blueprintsFor" apps/client/src
```

und mit umhängen — auch in Tests.

- [ ] **Step 6: Tests laufen lassen**

```bash
cd apps/client && npx vitest run
```

Erwartet: alle PASS. Bricht `StartScreen.test.tsx` an `blueprintsFor`, ist der Import dort noch nicht umgehängt.

- [ ] **Step 7: Committen (Zwischenstand)**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test
git add apps/client/src/board/boardPreview.ts apps/client/src/board/boardPreview.test.ts apps/client/src/screens/StartScreen.tsx apps/client/src/screens/StartScreen.test.tsx
git commit -F - <<'EOF'
Das Brett zum Seed bekommt eine eigene Adresse

Die Rechnung stand im Aufbau-Bildschirm, und der Wartebereich braucht sie auch:
dort ist derselbe Seed noch einmal verstellbar, an der teureren Stelle - es
sitzen schon Leute am Tisch. Zweimal geschrieben liefen die beiden
auseinander, und dann zeigte der Wartebereich ein anderes Brett als der Aufbau.

Die Vorschau nimmt Platzhalter-Sitze, die Partie die echten: fuers Brett ist das
gleich, denn der Generator sieht nur die Anzahl - fuer die Partie nicht, dort
haengen Namen und Farben an den Ids.
EOF
```

- [ ] **Step 8: Den fehlschlagenden Test für den Wartebereich schreiben**

In `apps/client/src/screens/LobbyScreen.test.tsx`, Aufbau aus den bestehenden Fällen übernehmen:

```tsx
it('zeigt das Brett zum eingestellten Seed', () => {
  renderLobby({ seed: 'abcd' });

  // Die Vorschau ist dasselbe Brett wie im Aufbau, nicht ein zweites Bild.
  expect(document.querySelector('svg.board')).not.toBeNull();
});

it('laesst die Vorschau weg, wo es kein passendes Brett gibt', () => {
  // Ein Tisch ausserhalb jeder Vorlage: lieber kein Bild als ein falsches.
  renderLobby({ seed: 'abcd', seatCount: 99 });

  expect(document.querySelector('svg.board')).toBeNull();
});
```

- [ ] **Step 9: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/screens/LobbyScreen.test.tsx -t "Brett"
```

Erwartet: der erste FAIL, der zweite PASS (es gibt heute nirgends ein Brett).

- [ ] **Step 10: Die Vorschau in den Wartebereich einbauen**

In `LobbyScreen.tsx`:

```tsx
import { previewGame } from '../board/boardPreview';
import { BoardSvg } from '../board/BoardSvg';
import { EMPTY_TARGETS } from '../game/targets';
import { defaultSeats } from '../seats';
```

und im Rumpf:

```tsx
/*
 * Das Brett zum Seed - dasselbe wie im Aufbau.
 *
 * Es steht hier, weil hier entschieden wird: „Neu wuerfeln" hat bis hierher
 * eine Zeichenkette gegen eine andere getauscht, und was daraus wird, sah man
 * erst, wenn die Partie lief. Am Aufbau-Bildschirm stand die Vorschau von
 * Anfang an - hier fehlte sie genau da, wo sie mehr kostet: es sitzen schon
 * Leute am Tisch.
 */
const preview = useMemo(() => previewGame(room.seatCount, room.seed), [room.seatCount, room.seed]);
```

Im Markup zwischen den Tisch und die Einstellkästen:

```tsx
{
  preview === null ? null : (
    <div className="lobby__preview">
      <BoardSvg
        state={preview}
        targets={EMPTY_TARGETS}
        seats={defaultSeats(room.seatCount)}
        onPick={() => {
          /* Die Vorschau ist zum Ansehen da, nicht zum Spielen. */
        }}
      />
    </div>
  );
}
```

`useMemo` zu den Importen aus `react` hinzufügen.

- [ ] **Step 11: Den Wartebereich zweispaltig machen**

In `index.css`, `.lobby` (1434) ersetzen:

```css
/*
 * Der Wartebereich ist eine Flaeche, keine Rolle.
 *
 * Er war eine `min(100%, 34rem)`-Spalte, mittig auf 1280px: gemessen 1326px
 * hoch bei 720px Sichtfenster, also 606px Ueberhang - und links und rechts
 * davon je 300px leere See. Er hat mit Hoehe fuer Platz bezahlt, den er
 * nebenan geschenkt bekam.
 *
 * Unter der Falte lagen dabei **beide Handlungen des Bildschirms**: „Partie
 * starten" und „Tisch verlassen". Ein Bildschirm, dessen einzige Aufgabe das
 * Warten ist, hat das Ende des Wartens versteckt.
 *
 * Drei Spalten: der Tisch links (Code, Einladung, Plaetze), das Brett in der
 * Mitte, die Einstellungen rechts. Die Mitte ist die einzige, die waechst -
 * die zwei Randspalten sind so breit, wie ihr Inhalt gelesen werden will.
 */
.lobby {
  display: grid;
  grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr) minmax(16rem, 20rem);
  gap: 1.25rem;
  align-items: start;
  height: 100dvh;
  padding: clamp(1rem, 2.5vw, 2rem);
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% 0%, var(--sea-700) 0%, transparent 62%), var(--sea-900);
}

/*
 * Die Mitte traegt das Brett und sonst nichts. `min-height: 0` ist Bedingung
 * und keine Vorsicht: ein Rasterfeld ist von Haus aus mindestens so hoch wie
 * sein Inhalt, und das SVG darin bliese es auf, statt sich einzupassen -
 * derselbe Griff wie an `.board-area`.
 */
.lobby__preview {
  min-height: 0;
  height: 100%;
}

.lobby__preview svg {
  width: 100%;
  height: 100%;
}

/*
 * Unter 62rem gilt die Flaechenregel nicht mehr: dort wird gescrollt, und das
 * ist richtig. Dieselbe Schwelle wie beim Brett im Spiel und beim Aufbau -
 * drei Bildschirme, ein Breakpoint.
 */
@media (max-width: 62rem) {
  .lobby {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }

  /* Auf einer Spalte kostet das Brett nur Weg zum Knopf. Der Seed steht
     daneben als Zeichenkette, und die traegt hier allein. */
  .lobby__preview {
    display: none;
  }
}
```

Die linke und rechte Spalte brauchen je eine Hülle im Markup (`.lobby__side`, `.lobby__settings`) — Kopf, Einladung und Tisch nach links, die drei Einstellkästen und der Fuß nach rechts. Und weil die Spalten fest hoch sind, bekommt jede ihr eigenes `overflow-y: auto` als **Notausgang**, nicht als Entwurf:

```css
/*
 * Der Notausgang, nicht der Entwurf.
 *
 * Bei sechs Plaetzen und sechs Farben kann die linke Spalte laenger werden als
 * das Fenster. Sie scrollt dann in sich, statt den ganzen Bildschirm
 * mitzunehmen - das ist der Unterschied zwischen „ein Teil ist lang" und „der
 * Bildschirm passt nicht". Bei drei Plaetzen tritt es nicht ein; gemessen wird
 * gegen den Sechser-Tisch.
 */
.lobby__side,
.lobby__settings {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-height: 100%;
  overflow-y: auto;
}
```

- [ ] **Step 12: Tests laufen lassen**

```bash
cd apps/client && npx vitest run src/screens/LobbyScreen.test.tsx
```

Erwartet: alle PASS.

- [ ] **Step 13: Im Browser messen — und zwar am Sechser-Tisch**

Prüfstand, Raum erstellen, **auf sechs Plätze stellen** (das ist der teuerste Fall).

```js
const f = document.getElementById('frame');
const w = f.contentWindow,
  d = w.document;
({
  doc: d.documentElement.scrollHeight,
  vp: w.innerHeight,
  over: d.documentElement.scrollHeight - w.innerHeight,
  brett: !!d.querySelector('svg.board'),
  starten: d.querySelector('.lobby__foot')?.getBoundingClientRect().bottom <= w.innerHeight,
});
```

Erwartet: `over: 0`, `brett: true`, `starten: true`.

Danach bei 900×720 prüfen, daß gescrollt werden **darf** und nichts abgeschnitten ist.

- [ ] **Step 14: Committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add apps/client/src/screens/LobbyScreen.tsx apps/client/src/screens/LobbyScreen.test.tsx apps/client/src/index.css
git commit -F - <<'EOF'
Der Wartebereich wird eine Flaeche, und der Seed bekommt sein Brett

Gemessen 1326 Pixel hoch bei 720 Pixel Sichtfenster - und links und rechts der
Spalte je 300 Pixel leere See. Er hat mit Hoehe fuer Platz bezahlt, den er
nebenan geschenkt bekam, und unter der Falte lagen dabei beide Handlungen des
Bildschirms: „Partie starten" und „Tisch verlassen".

Drei Spalten statt einer, und in der Mitte das Brett zum Seed. „Neu wuerfeln"
hat bis hierher eine Zeichenkette gegen eine andere getauscht; was daraus wird,
sah man erst, wenn die Partie lief - an der Stelle, an der schon Leute am Tisch
sitzen.
EOF
```

---

## Task 5: Der Aufbau-Bildschirm paßt auf einen Blick

Die restlichen 209 bzw. 361 px, und B7: Titel auf drei Zeilen, Diagnose-Klapptür, zwei Auswahlbilder, zwei Gewichte für denselben Startknopf.

**Files:**

- Modify: `apps/client/src/screens/StartScreen.tsx`
- Modify: `apps/client/src/index.css` — `.start__panel` (709), `.start__brand h1` (733)
- Test: `apps/client/src/screens/StartScreen.test.tsx`

**Interfaces:**

- Consumes: `previewGame`, `blueprintsFor` aus Aufgabe 4
- Produces: nichts Neues. `StartScreenProps` bleibt unverändert — insbesondere `mode` behält seine vier Werte `'online' | 'local' | 'join' | 'all'`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```tsx
it('zeigt die Diagnose nicht mehr', () => {
  // Sie gehoert nicht auf einen Bildschirm, den ein Spieler sieht. Der Inhalt
  // war schon richtig aufgeschoben - die Tuer war das Problem.
  render(<StartScreen {...props} />);

  expect(screen.queryByText(/Verbindung und Diagnose/)).toBeNull();
});

it('startet lokal mit demselben Gewicht wie online', () => {
  render(<StartScreen {...props} mode="local" />);

  const start = screen.getByRole('button', { name: /Lokale Partie starten/ });
  // Dieselbe Rolle - „hier faengt die Partie an" - also dasselbe Gewicht.
  expect(start.className).toContain('button--go');
});
```

- [ ] **Step 2: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/screens/StartScreen.test.tsx -t "Diagnose"
cd apps/client && npx vitest run src/screens/StartScreen.test.tsx -t "Gewicht"
```

Erwartet: beide FAIL.

- [ ] **Step 3: Die Änderungen schreiben**

In `StartScreen.tsx`:

1. Den ganzen `<details className="start__diagnostics">`-Block löschen, samt `diagnosticsOpen`-State und dem Import von `ConnectionPanel`. Der bestehende Test, der festhält, daß der Inhalt erst beim Öffnen entsteht, wird mitgelöscht — er prüft etwas, das es nicht mehr gibt.

2. Der lokale Startknopf bekommt `className="button button--go"`.

3. Die Handkarten-Frage bekommt dieselben Chips wie die Spieleranzahl — das Markup von `.seatcount` als Vorlage nehmen (`<span><input type="radio" …><label …>`) und die vorhandene `.seatcount`-Regel wiederverwenden statt eine zweite zu schreiben.

4. Die Überschrift wird eine Zeile. Ursache ist `font-size: clamp(2.6rem, 5.5vw, 3.9rem)` in einer `minmax(20rem, 27rem)`-Spalte — bei 27 rem passen „PARTIE STARTEN — LOKAL" nicht in eine Zeile. In `index.css`:

```css
/*
 * Der Titel ist eine Zeile, kein Absatz.
 *
 * „PARTIE STARTEN — LOKAL" brach auf drei Zeilen und war rund 180px hoch - die
 * Haelfte des Ueberhangs dieses Bildschirms stand in seiner Ueberschrift. Der
 * Bildschirm ist keine Werbeseite; was hier gross sein muss, ist das Brett
 * daneben (Regel 4).
 */
.start__brand h1 {
  font-size: clamp(1.6rem, 2.4vw, 2.1rem);
  text-wrap: balance;
}
```

5. `.start__panel` verliert sein `overflow-y: auto` zugunsten der Flächenregel:

```css
/*
 * Die Flaeche statt der Rolle - dieselbe Regel wie im Wartebereich und im
 * Spiel. `100dvh` und nicht `100vh`: auf einem Telefon wandert die Adresszeile,
 * und `vh` rechnet gegen die Hoehe ohne sie.
 */
.start {
  height: 100dvh;
  overflow: hidden;
}

.start__panel {
  /* Der Notausgang, nicht der Entwurf - wie im Wartebereich. Bei sechs
     Spielernamen kann die Spalte laenger werden als das Fenster. */
  max-height: 100%;
  overflow-y: auto;
}
```

Der bestehende `@media (max-width: 62rem)`-Block für `.start` (Zeile 953) bekommt die Rücknahme:

```css
.start {
  height: auto;
  min-height: 100dvh;
  overflow: visible;
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
cd apps/client && npx vitest run src/screens/StartScreen.test.tsx
```

Erwartet: alle PASS. Der gelöschte Diagnose-Test darf nicht mehr auftauchen.

- [ ] **Step 5: Im Browser messen — beide Wege und der Sechser-Tisch**

Prüfstand. Für `mode='local'` mit **sechs Spielern** (der längste Fall) und für `mode='online'`:

```js
const f = document.getElementById('frame'),
  w = f.contentWindow,
  d = w.document;
({
  doc: d.documentElement.scrollHeight,
  vp: w.innerHeight,
  over: d.documentElement.scrollHeight - w.innerHeight,
  titelhoehe: Math.round(d.querySelector('.start__brand h1').getBoundingClientRect().height),
  knopfSichtbar: d.querySelector('.button--go')?.getBoundingClientRect().bottom <= w.innerHeight,
});
```

Erwartet: `over: 0` bei beiden, `titelhoehe` deutlich unter 100 (vorher ~180), `knopfSichtbar: true`.

- [ ] **Step 6: Committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add apps/client/src/screens/StartScreen.tsx apps/client/src/screens/StartScreen.test.tsx apps/client/src/index.css
git commit -F - <<'EOF'
Der Aufbau passt auf einen Blick

361 Pixel Ueberhang lokal, 209 online - und die Haelfte des lokalen stand in der
Ueberschrift: „PARTIE STARTEN — LOKAL" brach auf drei Zeilen und war 180 Pixel
hoch. Was auf diesem Bildschirm gross sein muss, ist das Brett daneben.

Dazu drei Kleinigkeiten mit Namen: die Diagnose-Tuer aus Etappe 0 stand auf
einem Bildschirm, den Spieler sehen; die Handkarten-Frage waren native Radios
zwei Zeilen unter gezeichneten Sechseck-Chips; und der lokale Startknopf trug
ein anderes Gewicht als der Online-Startknopf, bei gleicher Rolle.
EOF
```

---

## Task 6: Der Becher vor dem Wurf ist ein Becher

B5. `.die--blank { opacity: 0.45 }` — ein halb abgeblendeter Würfelkörper liest sich als fehlendes Bild.

**Files:**

- Modify: `apps/client/src/panels/DiceTray.tsx` (Zeile 245)
- Modify: `apps/client/src/index.css` — `.die--blank` (2739)
- Test: `apps/client/src/panels/DiceTray.test.tsx`

**Interfaces:**

- Consumes: nichts aus früheren Aufgaben
- Produces: nichts

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```tsx
it('zeigt vor dem Wurf einen Becher und keinen abgeblendeten Wuerfel', () => {
  renderTray({ total: null });

  // Blasser ist keine Auskunft: derselbe Griff wie beim Kaufstapel, der seine
  // Zahl mitdimmte. Der Zustand „noch nicht geworfen" bekommt eine Form.
  expect(document.querySelector('.die--blank')).toBeNull();
  expect(screen.getByText(/Würfeln/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/panels/DiceTray.test.tsx -t "Becher"
```

Erwartet: FAIL.

- [ ] **Step 3: Den Zustand zeichnen**

In `DiceTray.tsx` Zeile 245, aus:

```tsx
if (value === null) return <span className="die die--blank" />;
```

wird ein Becher mit Aufforderung. Die genaue Form richtet sich nach der Handschrift der übrigen Zeichnungen — `ResourceGlyph.tsx` und `DevelopmentGlyph.tsx` sind die Vorlage, nicht ein neuer Stil. Kein Hex-Wert; Farben aus `index.css`.

Und `.die--blank` verschwindet aus dem Blatt, samt der `opacity`-Zeile.

**Der Text auf dem Becher heißt „Würfeln"** — dasselbe Wort, das der Verlauf danach benutzt („hat 7 gewürfelt"). Vorher in `packages/shared/src/game/log.ts` nachsehen, wie der Verlaufssatz wirklich lautet, und das Wort daraus nehmen.

- [ ] **Step 4: Tests laufen lassen**

```bash
cd apps/client && npx vitest run src/panels/DiceTray.test.tsx
```

Erwartet: alle PASS.

- [ ] **Step 5: Im Browser ansehen**

Prüfstand, lokale Partie bis zum Wurf. Der Becher vor dem Wurf, der Wurf selbst, die Augen danach.

**Auf die Falle achten:** eine Animation, die beim Einhängen läuft, läuft beim Aktualisieren nicht. Wechselt der Becher zu Würfeln, braucht das Element ein `key`, das sich mit dem Wechsel ändert — sonst aktualisiert React denselben Knoten und die Animation bleibt still.

- [ ] **Step 6: Committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add apps/client/src/panels/DiceTray.tsx apps/client/src/panels/DiceTray.test.tsx apps/client/src/index.css
git commit -F - <<'EOF'
Vor dem Wurf steht ein Becher, kein abgeblendeter Wuerfel

Im Blatt war es eine Zeile: `.die--blank { opacity: 0.45 }`. Auf dem Bildschirm
waren es zwei einfarbig graue Rechtecke ohne Augen und ohne Beschriftung -
`aria-label` sagte korrekt „Noch kein Wurf", sichtbar sagte es nichts.

Derselbe Griff wie beim Kaufstapel, der seine Auskunft mitdimmte: die
Oberflaeche zeigt „noch nicht", indem sie etwas blasser macht. Blasser ist keine
Auskunft. Der Gegenbeweis stand die ganze Zeit daneben - die zugedeckte Hand
macht nichts blasser, sie zeigt Kartenruecken und einen Knopf.
EOF
```

---

## Task 7: Die Regler bekommen denselben Schnitt wie alles andere

B6. Drei `<input type="range">` mit `appearance: auto` — die einzige Stelle, an der das Betriebssystem durch den 45-Grad-Schnitt bricht.

**Files:**

- Modify: `apps/client/src/index.css` — `.settings__slider` (4101)
- Test: `apps/client/src/dialogs/settings.test.tsx`

**Interfaces:**

- Consumes: nichts
- Produces: nichts. `SettingsDialog.tsx` wird **nicht** angefaßt — das Element bleibt ein `input[type=range]`, damit Tastatur, Screenreader und `aria` unverändert funktionieren. Es ändert sich nur, wie es aussieht.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```tsx
it('zeichnet die Regler selbst statt sie dem System zu ueberlassen', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const block = css.match(/\.settings__slider \{[\s\S]*?\n\}/)?.[0];

  expect(block).toBeDefined();
  expect(block).toMatch(/appearance:\s*none/);
});

it('laesst den Regler ein input[type=range] bleiben', () => {
  // Der Schnitt ist eine Frage der Form, nicht der Bedienung: Pfeiltasten,
  // Screenreader und `aria-valuenow` haengen am nativen Element.
  render(<SettingsDialog onClose={() => {}} />);

  expect(screen.getAllByRole('slider')).toHaveLength(3);
});
```

- [ ] **Step 2: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/dialogs/settings.test.tsx
```

Erwartet: der erste FAIL, der zweite PASS.

- [ ] **Step 3: Die Regler zeichnen**

In `index.css` den `.settings__slider`-Block ersetzen. Bahn und Griff bekommen `corner-shape: bevel`, kein `clip-path`. `-webkit-slider-thumb` und `-moz-range-thumb` brauchen **getrennte** Regeln — ein ungültiger Selektor in einer Liste macht die ganze Liste ungültig, und dann ist der Regler auf einem der beiden Browser unsichtbar.

```css
/*
 * Der einzige Ort, an dem das Betriebssystem durchgeschlagen hat.
 *
 * `accent-color` stand hier und war richtig - die **Farbe** stimmte also. Die
 * **Form** nicht: runder Griff, runde Bahn, in einer Oberflaeche, in der jeder
 * Knopf, jedes Feld und jeder Dialog aus demselben 45-Grad-Schnitt kommt.
 *
 * Das Element bleibt ein `input[type=range]`. Der Schnitt ist eine Frage der
 * Form, nicht der Bedienung: Pfeiltasten, `aria-valuenow` und der Screenreader
 * haengen am nativen Element, und ein nachgebauter Regler haette sie alle
 * einzeln nachzuliefern.
 *
 * Die zwei Griff-Regeln stehen **getrennt** und nicht als Liste: ein Selektor,
 * den ein Browser nicht kennt, macht die ganze Liste ungueltig - und dann ist
 * der Griff dort unsichtbar. Derselbe Fehler wie eine Regel, deren Spezifitaet
 * man nicht nachgezaehlt hat, nur eine Ebene frueher.
 */
.settings__slider {
  appearance: none;
  width: 100%;
  height: 1.25rem;
  background: none;
  cursor: pointer;
}

.settings__slider::-webkit-slider-runnable-track {
  height: 0.3rem;
  border-radius: 2px;
  corner-shape: bevel;
  background: rgb(22 32 42 / 18%);
}

.settings__slider::-moz-range-track {
  height: 0.3rem;
  border-radius: 2px;
  corner-shape: bevel;
  background: rgb(22 32 42 / 18%);
}

.settings__slider::-webkit-slider-thumb {
  appearance: none;
  width: 0.85rem;
  height: 0.85rem;
  margin-top: -0.275rem;
  border: 0;
  border-radius: 3px;
  corner-shape: bevel;
  background: var(--sea-500);
}

.settings__slider::-moz-range-thumb {
  width: 0.85rem;
  height: 0.85rem;
  border: 0;
  border-radius: 3px;
  corner-shape: bevel;
  background: var(--sea-500);
}

/* Der Fokus ist sichtbar, und zwar am Griff - das ist das Teil, das man
   bewegt. Ein Ring um das ganze Element sagte „irgendwo hier". */
.settings__slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.settings__slider:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

`--sea-500` (`#1d5468`, Zeile 22) und `--accent` (Zeile 54) sind **nachgeschlagen und vorhanden**. Kein neuer Farbwert nötig, kein Hex in der Komponente.

- [ ] **Step 4: Tests laufen lassen**

```bash
cd apps/client && npx vitest run src/dialogs/settings.test.tsx
```

Erwartet: beide PASS.

- [ ] **Step 5: Im Browser ansehen — und mit der Tastatur bedienen**

Prüfstand, Einstellungen öffnen. Griff und Bahn tragen den Schnitt; mit Tab auf den Regler, mit den Pfeiltasten schieben, der Fokusring ist zu sehen. `disabled` gibt es hier nicht, die Falle „disabled sieht man nicht" also auch nicht.

- [ ] **Step 6: Committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add apps/client/src/index.css apps/client/src/dialogs/settings.test.tsx
git commit -F - <<'EOF'
Die Regler kommen aus demselben Schnitt wie alles andere

`accent-color` stand schon da und war der See-Ton - die Farbe stimmte also. Die
Form nicht: runder Griff, runde Bahn, in einer Oberflaeche, in der jeder Knopf
und jeder Dialog aus demselben 45-Grad-Schnitt kommt. Die einzige Stelle, an
der das Betriebssystem durchgeschlagen hat.

Das Element bleibt ein `input[type=range]`: Pfeiltasten, `aria-valuenow` und
der Screenreader haengen daran, und ein nachgebauter Regler haette sie einzeln
nachzuliefern. Die zwei Griff-Regeln stehen getrennt statt als Liste - ein
Selektor, den ein Browser nicht kennt, macht die ganze Liste ungueltig.
EOF
```

---

## Task 8: Die vier ungesehenen Dialoge

Schritt 5b aus der Spec. Handel, Gegenangebot, Abwerfen, Räuber-Opfer und die Entwicklungskarten sind nie im Browser gemessen worden — weil eine Gründungspartie sie nicht erreicht.

**Files:**

- Modify: was die Messung findet (`apps/client/src/dialogs/*.tsx`, `apps/client/src/index.css`)
- Create: Nachtrag in `docs/superpowers/specs/2026-08-21-politur-durchgang-design.md`

**Interfaces:**

- Consumes: alles Vorhergehende — der Prüfstand ist derselbe
- Produces: einen Befundabschnitt in der Spec

- [ ] **Step 1: Die Partie in einen Zustand spielen, der die Dialoge erreicht**

Prüfstand, lokale Partie zu dritt, Zudecken **ausschalten** („Offen liegen lassen") — sonst steht bei jedem Zugwechsel die Abdeckung im Weg.

Gründung durchspielen (sechs Siedlungen, sechs Straßen), dann würfeln, bis Hände voll sind. Der Räuber kommt mit der ersten Sieben; kommt er über mehrere Runden nicht, den Seed wechseln statt zu warten.

Erreichbar machen, der Reihe nach: **Handel** (zwei Spieler mit Karten), **Gegenangebot** (ein zweiter Spieler kontert), **Abwerfen** (jemand über dem Handkartenlimit bei einer Sieben), **Räuber-Opfer** (Räuber auf ein Feld mit fremder Siedlung), **Entwicklungskarten** (Karte kaufen, ausspielen).

- [ ] **Step 2: Jeden Dialog messen, nicht ansehen**

Für jeden geöffneten Dialog:

```js
const w = document.getElementById('frame').contentWindow,
  d = w.document;
const box = d.querySelector('.modal__box');
const r = box.getBoundingClientRect();
({
  hoehe: Math.round(r.height),
  vp: w.innerHeight,
  passt: r.top >= 0 && r.bottom <= w.innerHeight,
  scrollt: box.scrollHeight > box.clientHeight + 2,
  nativ: [...box.querySelectorAll('input,select')]
    .filter((e) => w.getComputedStyle(e).appearance === 'auto')
    .map((e) => e.type),
});
```

Erwartet für jeden: `passt: true`, `scrollt: false`, `nativ: []`. Was abweicht, ist ein Befund.

Dazu bei 390 px Breite dasselbe — die Dialoge sind auf schmalen Fenstern nie gesehen worden.

- [ ] **Step 3: Die Befunde in die Spec schreiben**

Als neuer Abschnitt „## Nachtrag: die vier Dialoge, gesehen" ans Ende der Spec, vor „Was dieser Durchgang nicht gesehen hat". Jeder Befund mit Zahl. Und aus „Was dieser Durchgang nicht gesehen hat" den Punkt zu den Dialogen streichen — er stimmt dann nicht mehr.

Findet die Messung **nichts**, steht das genauso da: „vier Dialoge gemessen, kein Befund" ist ein Ergebnis und keine leere Seite.

- [ ] **Step 4: Die Befunde beheben**

Je Befund: Test schreiben, fehlschlagen sehen, beheben, grün sehen. Kein Sammelcommit — ein Befund, ein Commit.

**Die Falle aus `CLAUDE.md` hier besonders beachten:** ein Befund, der an seinen Fundstellen repariert wird, kommt wieder. Findet sich etwas an zwei Dialogen, wird die Ursache repariert; geht das nicht, dann an der Stelle, an der der Untergrund garantiert ist, mit dem Grund im Kommentar.

- [ ] **Step 5: Committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add docs/superpowers/specs/2026-08-21-politur-durchgang-design.md
git commit -F - <<'EOF'
Die vier Dialoge sind gesehen

Handel, Gegenangebot, Abwerfen und das Raeuber-Opfer standen seit dem 16.08. als
„nicht erreichbar" in zwei Specs - eine Gruendungspartie kommt nicht an sie
heran. Diesmal durchgespielt: zu dritt, offen liegende Hand, bis die Haende voll
waren und die erste Sieben fiel.
EOF
```

---

## Task 9: Die Meßlatte kommt in die Regeln

Ohne sie kommt der Befund wieder — so wie `.button--ghost` wiedergekommen ist, nachdem er an drei von vier Fundstellen repariert wurde.

**Files:**

- Modify: `CLAUDE.md` — Abschnitt „Design", nach Regel 8
- Modify: `PROGRESS.md`

**Interfaces:**

- Consumes: die Meßwerte aus allen vorigen Aufgaben
- Produces: nichts im Code

- [ ] **Step 1: Regel 9 schreiben**

In `CLAUDE.md`, direkt nach Regel 8 („Texte sind Designmaterial") und **vor** „Was es nicht wird":

```markdown
**9. Ein Bildschirm ist eine Fläche, keine Rolle.** Bei 1280×720 — dem kleinsten
ernstzunehmenden Laptop — paßt jeder Bildschirm ohne zu scrollen. Was nicht in
eine Spalte paßt, geht in die zweite; erst wenn auch das nicht reicht, wird
etwas ausklappbar. Ausklappen ist das letzte Mittel: es kostet einen Klick und
nimmt die Möglichkeit, zwei Dinge zu vergleichen. Unter 62 rem gilt die Regel
nicht mehr — dort ist Scrollen die natürliche Geste und kein Fehler, und
62 rem ist überall dieselbe Schwelle.

Ein `overflow-y: auto` an einem Teilbereich ist der Notausgang für den
seltenen langen Fall (sechs Spieler, sechs Farben) und nie der Entwurf. Wer
einen setzt, schreibt in den Kommentar, welcher Fall gemeint ist, und mißt
gegen genau den.
```

- [ ] **Step 2: Die Falle nachtragen**

In `CLAUDE.md` unter „Fallen, die schon zugeschnappt sind":

```markdown
- **Ein Boden, der nicht weiß, wann er ein Deckel ist.** `--tray-strip` hatte
  `max(14.75rem, …)` und war als Zusicherung an das Brett gemeint: „an keiner
  Fenstergröße kleiner als vorher". Auf einem breiten Fenster stimmt das. Auf
  einem schmalen bekamen die zwei Ecken ihre je 236 px zugesichert, und das
  Brett bekam den Rest — gemessen war die Brettbreite eine Gerade
  (`Fensterbreite − 496`), und unter 496 px war sie null: kein einziges
  Sechseck auf dem Bildschirm. Wer einen `max()` als Untergrenze schreibt,
  fragt, wem die Zahl weggenommen wird, wenn sie greift.
- **Ein Kommentar ist keine Zusicherung.** Über `boardTargets` stand seit dem
  ersten Playtest, die Gründung leuchte weiter — „ein Knopf davor wäre ein
  Schritt, der nichts entscheidet". Der Räuber hielt sich daran, die Gründung
  nicht: `buildKindOf` gab für `placeSetupSettlement` dieselbe Sorte zurück wie
  für `buildSettlement`, und der Filter sah nur auf die Sorte. Gemessen null
  Zielmarken, während die Statuszeile die Siedlung verlangte. Wo ein Kommentar
  ein Verhalten verspricht, gehört ein Test daneben.
```

- [ ] **Step 3: `PROGRESS.md` und „Aktueller Stand" fortschreiben**

In `PROGRESS.md` den Durchgang nachtragen: was gemessen wurde, was sich geändert hat, mit den Vorher-Nachher-Zahlen. In `CLAUDE.md` unter „Aktueller Stand" den Satz „Die Oberfläche ist dabei durchgehend **nicht** im Browser nachgesehen worden — das ist der größte offene Posten" prüfen und richtigstellen; er stimmt nach diesem Durchgang nicht mehr.

- [ ] **Step 4: Die Schlußmessung**

Prüfstand, alle fünf Bildschirme bei 1280×720, dazu 992, 900 und 390 px.

Die Tabelle aus „Vorher-Werte" noch einmal aufnehmen und beide nebeneinander in `PROGRESS.md` schreiben. **Steht in der Nachher-Spalte irgendwo ein Überhang größer 0, ist der Durchgang nicht fertig** — dann fehlt eine Aufgabe, und das gehört gesagt statt gerundet.

- [ ] **Step 5: Committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add CLAUDE.md PROGRESS.md
git commit -F - <<'EOF'
Regel 9: ein Bildschirm ist eine Flaeche, keine Rolle

Die Zahl stand bisher nirgends, und genau daran lag es, dass der Wartebereich
anderthalb Bildschirme hoch werden konnte, ohne dass es auffiel: es gab keine
Grenze, gegen die man haette pruefen koennen.

Dazu zwei Fallen, die dieser Durchgang aufgeschrieben hat. Ein `max()` als
Untergrenze nimmt jemandem die Zahl weg, wenn er greift - hier dem Brett, bis
auf null. Und ein Kommentar, der ein Verhalten verspricht, ist keine
Zusicherung: ueber `boardTargets` stand seit dem Playtest, die Gruendung
leuchte weiter, und sie tat es nie.
EOF
```

---

## Self-Review

**Spec-Abdeckung.** Jeder Abschnitt der Spec gegen eine Aufgabe:

| Spec                                                     | Aufgabe               |
| -------------------------------------------------------- | --------------------- |
| B1 — Brett null Pixel unter 496 px                       | 1                     |
| B2 — Wartebereich 1326 px, zwei Drittel leer, kein Brett | 4                     |
| B3 — Gründung markiert nichts                            | 2                     |
| B4 — doppelte Statuszeile + Leiste über dem Brett        | 2 (Zeile), 3 (Leiste) |
| B5 — `.die--blank`                                       | 6                     |
| B6 — native Regler                                       | 7                     |
| B7 — Startknopf-Gewicht, Diagnose, Chips, Titel          | 5                     |
| B7 — Tischliste 10,88 px                                 | 10 (neu)              |
| B8 — volle Spielerzeile zerfaellt                        | 10 (neu)              |
| Richtung 1 — Fläche statt Rolle                          | 4, 5                  |
| Richtung 2 — Brett auf jeder Breite                      | 1                     |
| Richtung 3 — Zustand gezeichnet                          | 6, 7                  |
| Richtung 4 — Regel 9 in `CLAUDE.md`                      | 9                     |
| Schritt 5b — vier Dialoge                                | 8                     |

**Die Lücke von gestern ist geschlossen, und sie hat einen neuen Befund geliefert.** Der letzte Punkt aus B7 stand als „gedämpftes Grau, schlecht lesbar" ohne Kontrastwert in der Spec, und er hatte deshalb keine Aufgabe — ihn blind aufzuhellen hieße, eine Zahl zu raten, wo die Spec selbst „erst messen, dann erklären" verlangt.

**Er ist am 21.08. gemessen worden, und er ist keiner:** `rgb(148 167 176)` auf `rgb(15 44 59)` sind **8,41:1**, der Name 16,14:1 — beides weit über 4,5:1. Was bleibt, ist die Größe (10,88 px), und das ist eine andere Frage.

**Dieselbe Messung hat B8 gefunden**, und der ist schwerer: eine volle Spielerzeile zerfällt in gestapelte Wortspalten. Beides zusammen ist jetzt **Aufgabe 10**.

**Platzhalter.** Kein „TBD", kein „ähnlich wie Aufgabe N".

Drei Stellen standen beim ersten Schreiben als Annahme darin. Sie sind vor der Abgabe **nachgemessen** worden, statt sie dem Umsetzer zu überlassen:

| Annahme                            | Ergebnis                                         |
| ---------------------------------- | ------------------------------------------------ |
| Gründungsphase heißt `'setup'`     | **stimmt** — `phase.ts:37`                       |
| `--sea-500` und `--accent` gibt es | **stimmt** — `index.css:22` und `:54`            |
| Generator wirft bei leerem Seed    | **stimmt nicht** — er liefert ein gültiges Brett |

Die dritte hatte einen Testfall im Plan, der auf `null` geprüft hätte und rot geblieben wäre. Er ist umgedreht und trägt jetzt die gemessene Antwort im Kommentar.

**Typ-Konsistenz.** `previewGame(seatCount: number, seed: string): GameState | null` und `blueprintsFor(playerCount: number): readonly ScenarioBlueprint[]` werden in Aufgabe 4 definiert und in Aufgabe 4 und 5 unter genau diesen Namen benutzt. `--tray-strip` heißt in Aufgabe 1, 3 durchgehend gleich. `isSetupPhase` wird in Aufgabe 2 einmal definiert und zweimal gelesen.

### Nachtrag zu Task 8

---

## Task 10: Die Spielerzeile verträgt, was in ihr steht

B8 und der Rest von B7. Gemessen am 21.08.: mit dem kürzesten Inhalt bleiben in
`.seat` **3 px Luft**, und mit realistischem Inhalt bricht jedes Feld um — „12 SP"
steht als „12" über „SP" in einer 13 px breiten Spalte.

**Files:**

- Modify: `apps/client/src/index.css` — `.seat` und seine Kinder
- Test: `apps/client/src/panels/panels.test.tsx`

**Interfaces:**

- Consumes: nichts aus früheren Aufgaben
- Produces: eine Zeile, die ein weiteres Feld verträgt — Voraussetzung für die
  Bonus-Plaketten (eigener Entwurf, eigene Spec)

- [ ] **Step 1: Den Ist-Zustand messen**

Prüfstand, lokale Partie. Der schlimmste Fall wird gesetzt, statt auf ihn zu
warten — er hängt sonst an einem Würfelwurf:

```js
const w = document.getElementById('frame').contentWindow,
  d = w.document;
const seat = d.querySelector('.seat');
const orig = seat.innerHTML;
seat.innerHTML =
  '<span class="seat__name">Maximiliane (du)</span>' +
  '<span class="seat__points">12 SP</span>' +
  '<span class="seat__hand">19 Karten</span>' +
  '<span class="seat__gain">+3</span>' +
  '<span class="seat__pending">wirft 4 ab</span>';
await new Promise((r) => setTimeout(r, 150));
const res = {
  hoehe: Math.round(seat.getBoundingClientRect().height),
  felder: [...seat.children].map((e) => ({
    cls: e.className,
    box: Math.round(e.getBoundingClientRect().width),
    zeilen: Math.round(e.getBoundingClientRect().height),
  })),
};
seat.innerHTML = orig;
res;
```

Erwartet (Vorher-Wert vom 21.08.): Höhe 45 px statt 27, `seat__points` 13 px
breit und 36 px hoch — also drei Zeilen für zwei Wörter.

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

In `apps/client/src/panels/panels.test.tsx`:

```tsx
describe('die Spielerzeile bei vollem Inhalt', () => {
  it('laesst Maszzahlen nicht umbrechen', async () => {
    const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');

    /*
     * jsdom legt kein Layout aus - der Umbruch selbst ist hier nicht messbar.
     * Was der Test festhaelt, ist die Zusicherung: eine Zahl mit ihrer Einheit
     * ist ein Wort. Die Breiten misst der Pruefstand im Browser.
     */
    const points = css.match(/\.seat__points \{[\s\S]*?\n\}/)?.[0];
    const hand = css.match(/\.seat__hand \{[\s\S]*?\n\}/)?.[0];

    expect(points).toMatch(/white-space:\s*nowrap/);
    expect(hand).toMatch(/white-space:\s*nowrap/);
  });

  it('laesst die Zeile umbrechen statt ihre Felder', async () => {
    const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
    const seat = css.match(/\n\.seat \{[\s\S]*?\n\}/)?.[0];

    // Was nicht in eine Zeile passt, geht in eine zweite darunter - nicht in
    // fuenf Spalten aus gestapelten Woertern.
    expect(seat).toMatch(/flex-wrap:\s*wrap/);
  });
});
```

`readFile` aus `node:fs/promises` importieren, falls die Datei ihn noch nicht hat.

- [ ] **Step 3: Den Test laufen lassen**

```bash
cd apps/client && npx vitest run src/panels/panels.test.tsx -t "vollem Inhalt"
```

Erwartet: beide FAIL — heute steht dort `nowrap` an der Zeile und nichts an den
Feldern.

- [ ] **Step 4: Die Zeile umbauen**

In `index.css` am `.seat`-Block:

```css
/*
 * Die Zeile bricht um, ihre Felder nicht.
 *
 * Gemessen am 21.08.: mit „Spieler 1 (du) · 0 SP · 0 Karten" blieben 3 Pixel
 * Luft. Das Markup fuehrt aber zwei weitere Felder, die bei gewoehnlichem
 * Spiel dazukommen - der Zuwachs und der Hinweis („wirft 4 ab", „getrennt").
 * Mit ihnen und einem 16 Zeichen langen Namen wuchs die Zeile auf 45 Pixel,
 * und **nichts** wurde abgeschnitten: `white-space: normal` liess jedes Feld
 * umbrechen. „12 SP" stand als „12" ueber „SP" in einer 13 Pixel breiten
 * Spalte.
 *
 * Das sah nicht nach „passt knapp nicht" aus, sondern nach einem Unfall. Die
 * Kur ist die Umkehrung: die **Zeile** darf umbrechen, das **Feld** nicht.
 * Eine Maszzahl mit ihrer Einheit ist ein Wort.
 */
.seat {
  flex-wrap: wrap;
}

.seat__points,
.seat__hand,
.seat__gain,
.seat__pending {
  white-space: nowrap;
}

/* Der Name darf schrumpfen, die Zahlen nicht - er ist das einzige Feld, das
   ohne Verlust kuerzer werden kann, und `text-overflow` sagt, dass gekuerzt
   wurde. */
.seat__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```

Die Zahlen tragen ohnehin schon Tabellenziffern — nachsehen, ob `.seat__points`
und `.seat__hand` `font-variant-numeric: tabular-nums` haben, und ergänzen, wenn
nicht (Regel 3: in einem Spiel, in dem dauernd Zahlen verglichen werden, darf
keine Ziffer springen).

- [ ] **Step 5: Tests laufen lassen**

```bash
cd apps/client && npx vitest run src/panels/panels.test.tsx
```

Erwartet: alle PASS.

- [ ] **Step 6: Im Browser nachmessen**

Derselbe Ausdruck wie Step 1.

Erwartet: kein Feld höher als eine Textzeile (rund 17 px), `seat__points`
mindestens so breit wie „12 SP" es braucht. Die Zeile darf zweizeilig werden —
das ist der Entwurf, nicht der Fehler.

Danach der Blick auf den echten Bildschirm ohne gesetztes Markup: die
gewöhnliche Zeile („Spieler 1 (du) · 0 SP · 0 Karten") muß **einzeilig
bleiben**. Wird sie durch `flex-wrap: wrap` zweizeilig, ist der Umbau zu weit
gegangen.

- [ ] **Step 7: Committen**

```bash
cd /c/code/Conquerist && pnpm typecheck && pnpm test && rm -f apps/client/public/_probe.html
git add apps/client/src/index.css apps/client/src/panels/panels.test.tsx
git commit -F - <<'EOF'
Die Zeile bricht um, ihre Felder nicht

Mit dem kuerzesten Inhalt blieben in einer Spielerzeile drei Pixel Luft. Das
Markup fuehrt aber zwei Felder, die bei gewoehnlichem Spiel dazukommen - der
Zuwachs und der Hinweis. Mit ihnen brach jedes Feld einzeln um: „12 SP" stand
als „12" ueber „SP" in einer 13 Pixel breiten Spalte, der Name auf drei Zeilen,
die Zeile wuchs von 27 auf 45 Pixel.

Nichts davon war abgeschnitten - es war `white-space: normal`. Die Kur ist die
Umkehrung: die Zeile darf umbrechen, das Feld nicht. Eine Maszzahl mit ihrer
Einheit ist ein Wort.
EOF
```
