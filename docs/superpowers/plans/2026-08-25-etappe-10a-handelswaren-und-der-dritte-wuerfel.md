# Etappe 10a — Handelswaren und der dritte Würfel

> **Für agentische Ausführung:** ERFORDERLICHE UNTER-SKILL: `superpowers:executing-plans`
> (oder `superpowers:subagent-driven-development`). Die Schritte tragen Checkboxen.

**Ziel:** Das Fundament von Städte & Ritter — Handelswaren als Karten, der Ereigniswürfel
in der Schale, der Stadtertrag 1+1, die Gründung mit einer Stadt, 13 Siegpunkte, und die
Wahl des Regelwerks im Wartebereich.

**Ansatz:** Der Mengensatz wird von fünf auf acht Sorten geweitet (`CardId` neben
`ResourceId`), damit jede Handoperation weiterhin genau einmal existiert. Der
Ereigniswürfel kommt als Datenfeld in die Würfelschale, nicht als Codepfad. Alles Neue
trägt einen Vorgabewert, damit gespeicherte Basispartien weiter parsen.

**Technik:** TypeScript strict · Zod · Vitest · React 19 + SVG · pnpm-Monorepo

**Spec:** `docs/superpowers/specs/2026-08-25-staedte-und-ritter-design.md`
**Regelquelle:** `docs/regeln-staedte-und-ritter.md`

## Rahmenbedingungen

Diese gelten für **jede** Aufgabe und werden nicht wiederholt:

- **Antworten auf Deutsch, Code und Bezeichner auf Englisch.** Sichtbare Texte deutsch,
  mit Umlauten. Kommentare deutsch, in `shared` und `server` ohne Umlaute (bestehende
  Konvention: `ue`, `ae`, `oe`, `ss`).
- **`shared` hat keine Runtime-Dependency außer `zod`.**
- **Spiellogik ist pur:** `(state, action) => newState`. Kein `Math.random()`, kein
  `Date.now()`, kein I/O.
- **Jede Regel zweimal:** `can…` prüft nur, `apply…` prüft und wendet an. `legalActions`
  benutzt dieselben `can…`.
- **Neue Logik in `shared` bekommt Tests.**
- **Kein Hex-Wert in einer Komponente.** Farben kommen aus `index.css`-Variablen bzw.
  `game/labels.ts`.
- **Designregel 5:** Bewegung erklärt einen Zustandswechsel oder entfällt. Bei
  `prefers-reduced-motion` wird nicht animiert **und nicht gewartet**, und
  `animation-delay` gehört negativ in denselben Block wie `animation-duration`.
- **`PROGRESS.md` wird mitgeschrieben**, nicht nachgereicht (Aufgabe 16).
- **Commit-Botschaften ohne `Co-Authored-By`.**
- Branch: `etappe-10-staedte-und-ritter`. Ausgangspunkt: `ee79735`.

## Dateiplan

| Datei                                       | Rolle                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/shared/src/scenario/terrain.ts`   | ändern — `COMMODITY_IDS`, `CARD_IDS`, `TERRAIN_COMMODITY`                    |
| `packages/shared/src/rules/ruleset.ts`      | ändern — `CardAmountsSchema` mit Auffüllung, `cards`-Feld                    |
| `packages/shared/src/rules/dice.ts`         | ändern — `DieSpec.render`                                                    |
| `packages/shared/src/rules/cities.ts`       | **neu** — `CITIES_DICE`, `CITIES_RULES`, `CITIES_RULES_56`, `citiesRulesFor` |
| `packages/shared/src/game/cards.ts`         | **umbenannt** aus `resources.ts` — Mengenrechnung über `CardId`              |
| `packages/shared/src/game/cities/event.ts`  | **neu** — Seiten des Ereigniswürfels                                         |
| `packages/shared/src/game/cities/turn.ts`   | **neu** — `resolveEvent`                                                     |
| `packages/shared/src/game/state.ts`         | ändern — `barbarians`                                                        |
| `packages/shared/src/game/yield.ts`         | ändern — Stadtertrag 1 Rohstoff + 1 Handelsware                              |
| `packages/shared/src/game/setup.ts`         | ändern — zweite Setzung ist eine Stadt                                       |
| `packages/shared/src/game/trade.ts`         | ändern — Bank- und Hafenhandel über `CardId`                                 |
| `packages/shared/src/game/legal.ts`         | ändern — Bankhandel über `rules.cards`                                       |
| `packages/shared/src/game/labels.ts`        | ändern — Handelswaren-Wörter                                                 |
| `packages/shared/src/game/playerView.ts`    | ändern — `barbarians` in die Sicht                                           |
| `apps/client/src/game/labels.ts`            | ändern — `CARD_COLORS`, Handelswaren                                         |
| `apps/client/src/panels/CommodityGlyph.tsx` | **neu** — drei Motive                                                        |
| `apps/client/src/panels/ResourceCard.tsx`   | ändern — Handelswaren als Pergamentkarte                                     |
| `apps/client/src/panels/HandPanel.tsx`      | ändern — Stapel über `CARD_IDS`                                              |
| `apps/client/src/panels/DiceTray.tsx`       | ändern — dritter Würfel mit Symbolen                                         |
| `apps/client/src/panels/EventDie.tsx`       | **neu** — Schiff und drei Stadttore                                          |
| `apps/client/src/panels/BarbarianTrack.tsx` | **neu** — Fahrstrecke mit Schiff                                             |
| `apps/client/src/screens/StartScreen.tsx`   | ändern — Regelwerk wählbar                                                   |
| `apps/client/src/screens/LobbyScreen.tsx`   | ändern — Regelwerk wählbar                                                   |
| `apps/server/src/rooms/room.ts`             | ändern — `variant` am Raum                                                   |
| `apps/server/src/db/database.ts`            | ändern — vierter Migrationsschritt                                           |
| `packages/shared/src/protocol/room.ts`      | ändern — `variant` im Protokoll                                              |

---

## Aufgabe 1: Handelswaren-Ids und die Geländezuordnung

**Dateien:**

- Ändern: `packages/shared/src/scenario/terrain.ts`
- Test: `packages/shared/src/scenario/terrain.test.ts` (**neu**)

**Schnittstellen:**

- Liefert: `COMMODITY_IDS`, `CARD_IDS`, `CommodityId`, `CardId`, `CommodityIdSchema`,
  `CardIdSchema`, `TERRAIN_COMMODITY`, `terrainCommodity(terrain): CommodityId | null`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/scenario/terrain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  CARD_IDS,
  COMMODITY_IDS,
  RESOURCE_IDS,
  TERRAIN_IDS,
  TERRAIN_COMMODITY,
  terrainCommodity,
} from './terrain.js';

describe('Handelswaren', () => {
  it('sind drei und stehen hinter den Rohstoffen', () => {
    expect(COMMODITY_IDS).toEqual(['paper', 'cloth', 'coin']);
    expect(CARD_IDS).toEqual([...RESOURCE_IDS, ...COMMODITY_IDS]);
  });

  it('kommen von Wald, Weide und Gebirge - und nur von dort', () => {
    expect(terrainCommodity('forest')).toBe('paper');
    expect(terrainCommodity('pasture')).toBe('cloth');
    expect(terrainCommodity('mountains')).toBe('coin');
    expect(terrainCommodity('hills')).toBeNull();
    expect(terrainCommodity('fields')).toBeNull();
    expect(terrainCommodity('desert')).toBeNull();
  });

  it('nennen jede Gelaendeart, damit eine neue auffaellt', () => {
    for (const terrain of TERRAIN_IDS) {
      expect(TERRAIN_COMMODITY).toHaveProperty(terrain);
    }
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

Ausführen: `pnpm --filter @conquerist/shared test -- terrain`
Erwartet: FAIL — `COMMODITY_IDS` existiert nicht.

- [ ] **Schritt 3: Umsetzen**

In `terrain.ts`, direkt hinter `ResourceIdSchema`:

```ts
/**
 * Die Handelswaren aus Staedte & Ritter.
 *
 * Sie liegen auf derselben Hand wie Rohstoffe und werden wie sie gehandelt,
 * gestohlen und abgeworfen - aber sie bezahlen nie ein Bauwerk und entstehen
 * nur an Staedten. Deshalb eine eigene Liste neben `RESOURCE_IDS` und keine
 * Erweiterung davon: wo im Code `ResourceId` steht, darf keine Handelsware
 * hin, und das soll der Compiler sagen und nicht ein Kommentar.
 */
export const COMMODITY_IDS = ['paper', 'cloth', 'coin'] as const;

export type CommodityId = (typeof COMMODITY_IDS)[number];

export const CommodityIdSchema = z.enum(COMMODITY_IDS);

/**
 * Alles, was auf der Hand liegen kann.
 *
 * Die Reihenfolge ist Teil der Zusage: `cardAt` zaehlt eine fremde Hand in
 * genau dieser Folge durch, damit ein Diebstahl aus Seed und Zustand
 * rekonstruierbar bleibt (Regel 2). Rohstoffe zuerst, damit die Zaehlung einer
 * Basispartie dieselbe bleibt wie vor der Erweiterung.
 */
export const CARD_IDS = [...RESOURCE_IDS, ...COMMODITY_IDS] as const;

export type CardId = (typeof CARD_IDS)[number];

export const CardIdSchema = z.enum(CARD_IDS);

/**
 * Welche Handelsware eine **Stadt** an diesem Gelaende zusaetzlich abwirft.
 *
 * `null` heisst: dieses Gelaende gibt zwei Rohstoffe statt einem Rohstoff und
 * einer Handelsware. Bewusst `null` und nicht ein fehlender Schluessel - so
 * erzwingt der Compiler einen Eintrag, sobald jemand eine Gelaendeart
 * hinzufuegt. Dieselbe Bauform wie `TERRAIN_YIELD` darueber.
 */
export const TERRAIN_COMMODITY: Readonly<Record<TerrainId, CommodityId | null>> = {
  hills: null,
  forest: 'paper',
  pasture: 'cloth',
  fields: null,
  mountains: 'coin',
  desert: null,
};

/** Die Handelsware eines Gelaendes, oder `null`. */
export function terrainCommodity(terrain: TerrainId): CommodityId | null {
  return TERRAIN_COMMODITY[terrain];
}
```

`CARD_IDS` muß **nach** `RESOURCE_IDS` stehen. Der Export läuft über
`scenario/index.ts`; prüfen, daß dort `export * from './terrain.js'` steht (tut es).

- [ ] **Schritt 4: Test laufen lassen, er muss bestehen**

Ausführen: `pnpm --filter @conquerist/shared test -- terrain`
Erwartet: PASS, 3 Tests.

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src/scenario/terrain.ts packages/shared/src/scenario/terrain.test.ts
git commit -m "Papier, Tuch und Muenzen bekommen einen Namen"
```

---

## Aufgabe 2: Der Mengensatz wird breiter — und füllt sich selbst auf

**Dateien:**

- Ändern: `packages/shared/src/rules/ruleset.ts` (`ResourceAmountsSchema`)
- Ändern: `packages/shared/src/game/resources.ts` (`EMPTY_RESOURCES`, `fromEach`)
- Test: `packages/shared/src/rules/ruleset.test.ts`, `packages/shared/src/game/resources.test.ts`

**Schnittstellen:**

- Verbraucht: `CARD_IDS`, `CardIdSchema` aus Aufgabe 1
- Liefert: `ResourceAmountsSchema` mit acht Schlüsseln und Auffüllung (in Aufgabe 3
  umbenannt zu `CardAmountsSchema`)

**Warum das eine eigene Aufgabe ist:** hier ändert sich Verhalten, in Aufgabe 3 nur
Namen. Wer beides in einen Commit legt, kann später nicht mehr sehen, welcher der beiden
etwas kaputtgemacht hat.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

In `packages/shared/src/rules/ruleset.test.ts` ergänzen:

```ts
describe('ResourceAmountsSchema', () => {
  it('kennt acht Sorten', () => {
    const parsed = ResourceAmountsSchema.parse({
      brick: 1,
      lumber: 2,
      wool: 3,
      grain: 4,
      ore: 5,
      paper: 6,
      cloth: 7,
      coin: 8,
    });
    expect(parsed.paper).toBe(6);
  });

  /*
   * Der eigentliche Grund fuer diese Aufgabe. Seit Etappe 6 liegt der
   * Startzustand einer Partie als JSON in der Datenbank, und die dort
   * abgelegten Mengensaetze haben fuenf Schluessel. Ohne Auffuellung rechnet
   * `subtractResources` dort mit `undefined`, und `undefined - 0` ist `NaN` -
   * lautlos, sichtbar erst Runden spaeter als unmoegliche Handkartenzahl.
   */
  it('fuellt fehlende Sorten mit Null auf - eine Partie aus der Datenbank', () => {
    const parsed = ResourceAmountsSchema.parse({
      brick: 1,
      lumber: 0,
      wool: 0,
      grain: 0,
      ore: 0,
    });

    expect(parsed).toEqual({
      brick: 1,
      lumber: 0,
      wool: 0,
      grain: 0,
      ore: 0,
      paper: 0,
      cloth: 0,
      coin: 0,
    });
  });
});
```

Und in `packages/shared/src/game/resources.test.ts`:

```ts
it('rechnet mit einer aufgefuellten Menge ohne NaN', () => {
  const alt = ResourceAmountsSchema.parse({ brick: 3, lumber: 0, wool: 0, grain: 0, ore: 0 });
  const summe = addResources(alt, EMPTY_RESOURCES);

  expect(countResources(summe)).toBe(3);
  expect(Number.isNaN(summe.paper)).toBe(false);
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

Ausführen: `pnpm --filter @conquerist/shared test -- ruleset resources`
Erwartet: FAIL — `paper` fehlt im Ergebnis.

- [ ] **Schritt 3: Umsetzen**

In `rules/ruleset.ts` `ResourceAmountsSchema` ersetzen:

```ts
/**
 * Kartenmengen als vollstaendiger `Record<CardId, number>`.
 *
 * Vollstaendig und nicht teilweise: der Reducer soll rechnen duerfen, ohne bei
 * jedem Zugriff `?? 0` zu schreiben. Eine fehlende Sorte ist ein Fehler in den
 * Daten und soll hier auffallen, nicht dort.
 *
 * **Das `transform` ist kein Zierat.** Seit Etappe 6 liegt der Startzustand
 * jeder Partie als JSON in der Datenbank; die dort abgelegten Mengensaetze
 * haben fuenf Schluessel, weil es damals fuenf Sorten gab. Ohne Auffuellung
 * rechnete `subtractResources` dort mit `undefined`, und `undefined - 0` ist
 * `NaN` - lautlos, und sichtbar erst Runden spaeter als eine Handkartenzahl,
 * die es nicht geben kann. Dieselbe Auffuellung traegt jede spaetere Sorte.
 */
export const ResourceAmountsSchema = z
  .record(CardIdSchema, z.number().int().min(0))
  .transform((amounts) => {
    const full = {} as Record<CardId, number>;
    for (const card of CARD_IDS) full[card] = amounts[card] ?? 0;
    return full;
  });

export type ResourceAmounts = Record<CardId, number>;
```

Import oben ergänzen: `import { CARD_IDS, CardIdSchema, type CardId } from '../scenario/terrain.js';`

**Achtung:** `z.infer` eines `transform`-Schemas ist der Ausgangstyp; `ResourceAmounts`
wird deshalb ausdrücklich als `Record<CardId, number>` geschrieben statt aus dem Schema
abgeleitet. Wo bisher `z.input` nötig wäre (Eingang eines Zod-Objekts), kommt der
Compiler von selbst darauf.

In `game/resources.ts`:

```ts
export const EMPTY_RESOURCES: ResourceAmounts = {
  brick: 0,
  lumber: 0,
  wool: 0,
  grain: 0,
  ore: 0,
  paper: 0,
  cloth: 0,
  coin: 0,
};
```

und in `fromEach`, `countResources`, `addResources`, `subtractResources`,
`scaleResources`, `canAfford`, `resourceAt` überall `RESOURCE_IDS` durch `CARD_IDS`
ersetzen (Import anpassen).

- [ ] **Schritt 4: Alle Tests laufen lassen**

Ausführen: `pnpm typecheck && pnpm test`
Erwartet: grün. Wenn `CLASSIC_RULES.resourceBank` als Typfehler auffällt, dort
`paper: 0, cloth: 0, coin: 0` ergänzen — die Bank des Basisspiels führt keine
Handelswaren, und eine Null sagt genau das.

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src
git commit -m "Acht Sorten, und die fuenf aus der Datenbank fuellen sich auf"
```

---

## Aufgabe 3: Der Rename — die Namen sagen, was drinsteht

**Dateien:**

- Umbenennen: `packages/shared/src/game/resources.ts` → `packages/shared/src/game/cards.ts`
- Umbenennen: `packages/shared/src/game/resources.test.ts` → `packages/shared/src/game/cards.test.ts`
- Ändern: alle 29 Dateien, die die Symbole benutzen

**Schnittstellen:**

- Liefert: `CardAmounts`, `CardAmountsSchema`, `EMPTY_CARDS`, `addCards`, `subtractCards`,
  `scaleCards`, `countCards`, `cardAt`, `canAfford`
- Achtung: `development.ts#countCards` wird zu `countDevelopmentCards`

**Keine Verhaltensänderung.** Der Beweis ist, daß alle Tests ohne eine einzige Änderung
an ihren Erwartungen grün bleiben.

- [ ] **Schritt 1: Die Kollision zuerst auflösen**

`packages/shared/src/game/development.ts`: `countCards` → `countDevelopmentCards`.
Aufrufer: `game/scoring.ts`, `game/developmentRules.ts`, `game/development.test.ts`
(mit `grep -rn "countCards" packages apps --include=*.ts --include=*.tsx` finden).

- [ ] **Schritt 2: Umbenennen**

```bash
git mv packages/shared/src/game/resources.ts packages/shared/src/game/cards.ts
git mv packages/shared/src/game/resources.test.ts packages/shared/src/game/cards.test.ts
```

Dann in der Reihenfolge von unten nach oben ersetzen (die längeren Namen zuerst, sonst
zerlegt eine Ersetzung die nächste):

| alt                     | neu                 |
| ----------------------- | ------------------- |
| `ResourceAmountsSchema` | `CardAmountsSchema` |
| `ResourceAmounts`       | `CardAmounts`       |
| `EMPTY_RESOURCES`       | `EMPTY_CARDS`       |
| `addResources`          | `addCards`          |
| `subtractResources`     | `subtractCards`     |
| `scaleResources`        | `scaleCards`        |
| `countResources`        | `countCards`        |
| `resourceAt`            | `cardAt`            |
| `from './resources.js'` | `from './cards.js'` |

`ResourceId`, `RESOURCE_IDS`, `RESOURCE_LABELS`, `RESOURCE_COLORS`, `ResourceGlyph`,
`ResourceCard`, `resourceBank` und `ResourcePickDialog` bleiben **unverändert** — sie
meinen weiterhin Rohstoffe.

Den Kopfkommentar von `cards.ts` anpassen: er beschreibt jetzt Kartenmengen, nicht
Ressourcenmengen, und nennt den Grund (Handelswaren liegen auf derselben Hand).

- [ ] **Schritt 3: Typecheck und Tests**

Ausführen: `pnpm typecheck && pnpm test`
Erwartet: grün, **ohne** daß eine Testerwartung geändert wurde. Falls doch eine geändert
werden mußte, war es kein reiner Rename — dann zurück und nachsehen.

- [ ] **Schritt 4: Formatieren und committen**

```bash
pnpm format
git add -A
git commit -m "Was auf der Hand liegt, heisst jetzt Karte"
```

---

## Aufgabe 4: `RuleSet.cards` — welche Sorten am Tisch sind

**Dateien:**

- Ändern: `packages/shared/src/rules/ruleset.ts`
- Ändern: `packages/shared/src/game/legal.ts:~155` (Bankhandel-Schleife)
- Ändern: `packages/shared/src/game/labels.ts` (`resourceList`)
- Test: `packages/shared/src/rules/ruleset.test.ts`, `packages/shared/src/game/legal.test.ts`

**Schnittstellen:**

- Liefert: `RuleSet.cards: readonly CardId[]`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

In `ruleset.test.ts`:

```ts
it('fuehrt im Basisspiel genau die fuenf Rohstoffe', () => {
  expect(CLASSIC_RULES.cards).toEqual([...RESOURCE_IDS]);
});

it('setzt `cards` auf die Rohstoffe, wenn ein gespeichertes Regelwerk es nicht nennt', () => {
  const { cards: _weg, ...ohne } = CLASSIC_RULES;
  expect(RuleSetSchema.parse(ohne).cards).toEqual([...RESOURCE_IDS]);
});
```

In `legal.test.ts`:

```ts
it('bietet nur Bankgeschaefte mit den Sorten dieses Tisches an', () => {
  const state = gameInMainPhase(); // vorhandene Hilfsfunktion der Datei
  const sorten = new Set(
    legalActions(state, state.players[0]!.id)
      .filter((action) => action.type === 'tradeWithBank')
      .flatMap((action) => [action.give, action.receive]),
  );

  for (const sorte of sorten) expect(state.rules.cards).toContain(sorte);
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

Ausführen: `pnpm --filter @conquerist/shared test -- ruleset legal`
Erwartet: FAIL — `cards` existiert nicht.

- [ ] **Schritt 3: Umsetzen**

In `RuleSetSchema`, hinter `id`:

```ts
/**
 * Welche Kartensorten an diesem Tisch im Spiel sind.
 *
 * `CARD_IDS` kennt acht, das Basisspiel fuenf. Ohne diese Angabe boete
 * `legalActions` dort vierundsechzig Bankgeschaefte statt fuenfundzwanzig, und
 * die Auswahldialoge zeigten drei Sorten, die es an diesem Tisch nicht gibt.
 *
 * Nicht aus `resourceBank` abgeleitet: ein Vorrat darf mitten in der Partie
 * auf Null fallen, und eine Sorte verschwaende dann aus der Bedienung.
 *
 * Mit Vorgabe, wie `dice` und `robberRoll` und aus demselben Grund: das
 * RuleSet jeder laufenden Partie liegt als JSON in der Datenbank.
 */
cards: z.array(CardIdSchema).min(1).default([...RESOURCE_IDS]),
```

`CLASSIC_RULES` und `CLASSIC_RULES_56` bekommen `cards: [...RESOURCE_IDS]` ausgeschrieben
(die Vorgabe ist für gespeicherte Partien da, nicht als Ersatz fürs Hinschreiben).

In `legal.ts` die zwei Schleifen `for (const give of RESOURCE_IDS)` auf
`state.rules.cards` umstellen und den Import von `RESOURCE_IDS` entfernen.

In `labels.ts` bekommt `resourceList` eine zweite Fassung, die die Sorten mitbekommt —
aber **Vorsicht**: `resourceList` wird vom Verlaufssatz benutzt und hat heute keinen
Zugriff aufs RuleSet. Statt einer Signaturänderung zählt sie schlicht über `CARD_IDS`
und überspringt Nullen, wie sie es schon tut. Eine Basispartie nennt dann nie eine
Handelsware, weil dort keine liegt. **Keine Änderung nötig** — nur der Import wechselt
von `RESOURCE_IDS` auf `CARD_IDS` und die Reihenfolge der Aufzählung stimmt weiter.

- [ ] **Schritt 4: Tests laufen lassen**

Ausführen: `pnpm --filter @conquerist/shared test`
Erwartet: grün.

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src
git commit -m "Welche Sorten am Tisch liegen, steht im Regelwerk"
```

---

## Aufgabe 5: Der Ereigniswürfel in der Schale

**Dateien:**

- Ändern: `packages/shared/src/rules/dice.ts`
- Erstellen: `packages/shared/src/game/cities/event.ts`
- Test: `packages/shared/src/rules/ruleset.test.ts`, `packages/shared/src/game/cities/event.test.ts`

**Schnittstellen:**

- Liefert: `DieSpec.render: 'pips' | 'event'`; `EVENT_DIE`, `PROGRESS_DIE`, `EventFace`,
  `EVENT_FACES`, `eventFaceOf(roll: Roll): EventFace | null`,
  `progressValueOf(roll: Roll): number | null`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/game/cities/event.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { Roll } from '../dice.js';
import { EVENT_FACES, eventFaceOf, progressValueOf } from './event.js';

const wurf = (first: number, second: number, event: number): Roll => [
  { die: 'first', value: first },
  { die: 'second', value: second },
  { die: 'event', value: event },
];

describe('Ereigniswuerfel', () => {
  it('zeigt drei Schiffe und drei Stadttore', () => {
    expect(EVENT_FACES).toEqual(['ship', 'ship', 'ship', 'trade', 'politics', 'science']);
  });

  it('liest die Seite aus dem Wurf', () => {
    expect(eventFaceOf(wurf(3, 4, 1))).toBe('ship');
    expect(eventFaceOf(wurf(3, 4, 3))).toBe('ship');
    expect(eventFaceOf(wurf(3, 4, 4))).toBe('trade');
    expect(eventFaceOf(wurf(3, 4, 6))).toBe('science');
  });

  it('sagt nichts, wenn gar kein Ereigniswuerfel dabei war', () => {
    expect(
      eventFaceOf([
        { die: 'first', value: 3 },
        { die: 'second', value: 4 },
      ]),
    ).toBeNull();
  });

  it('nennt den roten Wuerfel - das ist der zweite', () => {
    expect(progressValueOf(wurf(3, 4, 1))).toBe(4);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

Ausführen: `pnpm --filter @conquerist/shared test -- event`
Erwartet: FAIL — Datei fehlt.

- [ ] **Schritt 3: Umsetzen**

`rules/dice.ts`, in `DieSpecSchema` ergänzen:

```ts
/**
 * Wie die Oberflaeche eine Seite zeigt.
 *
 * Ein Ereigniswuerfel hat sechs Seiten und keine Augen - sechs Punkte zu
 * malen, wo ein Schiff gehoert, waere schlimmer als gar kein Bild. Das steht
 * als Datenfeld hier und nicht als Fallunterscheidung nach Id im Browser:
 * `DiceTray` fragt die Schale, nicht den Namen.
 *
 * Mit Vorgabe, damit gespeicherte Regelwerke ohne dieses Feld weiter parsen.
 */
render: z.enum(['pips', 'event']).default('pips'),
```

`CLASSIC_DICE` bekommt `render: 'pips'` an beiden Würfeln ausgeschrieben.

`packages/shared/src/game/cities/event.ts`:

```ts
import type { Roll } from '../dice.js';

/**
 * Der Ereigniswuerfel und der rote Augenwuerfel.
 *
 * Hier steht, was ein Wuerfel **bedeutet** - `rules/dice.ts` sagt im
 * Kopfkommentar ausdruecklich, dass es dort nicht stehen soll. Die Schale
 * beschreibt, was faellt; diese Datei, was daraus folgt.
 */

/** Die Id des Ereigniswuerfels in `CITIES_DICE`. */
export const EVENT_DIE = 'event';

/**
 * Die Id des roten Augenwuerfels.
 *
 * Kein eigener Wuerfel und keine Umbenennung: gespeicherte Wuerfe tragen
 * `first` und `second`, und eine dritte Id machte jeden davon unlesbar. Rot
 * ist eine Farbe auf dem Tisch, keine Eigenschaft der Zufallsziehung.
 */
export const PROGRESS_DIE = 'second';

export type EventFace = 'ship' | 'trade' | 'politics' | 'science';

/**
 * Seite 1 bis 6 des Ereigniswuerfels: drei Schiffe, drei Stadttore.
 *
 * Die Reihenfolge ist Teil der Zusage - derselbe Seed muss dieselbe Partie
 * ergeben, und die Seite folgt aus der gezogenen Augenzahl.
 */
export const EVENT_FACES: readonly EventFace[] = [
  'ship',
  'ship',
  'ship',
  'trade',
  'politics',
  'science',
];

/** Was der Ereigniswuerfel in diesem Wurf zeigte - `null`, wenn keiner dabei war. */
export function eventFaceOf(roll: Roll): EventFace | null {
  const result = roll.find((entry) => entry.die === EVENT_DIE);
  return result === undefined ? null : (EVENT_FACES[result.value - 1] ?? null);
}

/** Die Augenzahl des roten Wuerfels - `null`, wenn er fehlte. */
export function progressValueOf(roll: Roll): number | null {
  return roll.find((entry) => entry.die === PROGRESS_DIE)?.value ?? null;
}
```

- [ ] **Schritt 4: Test laufen lassen**

Ausführen: `pnpm --filter @conquerist/shared test -- event ruleset`
Erwartet: PASS.

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src
git commit -m "Ein Wuerfel mit Schiffen statt Augen"
```

---

## Aufgabe 6: Das Barbarenschiff im Zustand

**Dateien:**

- Ändern: `packages/shared/src/game/state.ts`
- Erstellen: `packages/shared/src/game/cities/barbarians.ts`
- Test: `packages/shared/src/game/cities/barbarians.test.ts`

**Schnittstellen:**

- Verbraucht: `EventFace` aus Aufgabe 5
- Liefert: `BarbarianStateSchema`, `BarbarianState`, `advanceShip(state): GameState`,
  `barbarianStrength(state): number`, `robberIsFree(state): boolean`

**Bewußt unvollständig:** in 10a **landet** das Schiff nicht. Es rückt bis ein Feld vor
der Küste vor und wartet dort. Ein Überfall ohne Ritter träfe jeden Städtebesitzer
wehrlos und zerlegte jede Partie in der ersten Viertelstunde. Die Grenze ist **eine
Zeile**, sie steht mit Begründung im Code und verschwindet in 10b.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../rules/cities.js'; // Aufgabe 7 - Test hier zuerst
import { advanceShip, barbarianStrength, robberIsFree } from './barbarians.js';
import { gameWithCities } from '../fixtures.js'; // Aufgabe 7 ergaenzt sie

describe('Barbarenschiff', () => {
  it('faehrt Feld um Feld', () => {
    let state = gameWithCities();
    expect(state.barbarians?.position).toBe(0);

    state = advanceShip(state);
    expect(state.barbarians?.position).toBe(1);
  });

  it('wartet vor der Kueste, solange es keine Ritter gibt', () => {
    let state = gameWithCities();
    for (let i = 0; i < 20; i += 1) state = advanceShip(state);

    expect(state.barbarians?.position).toBe(CITIES_RULES.barbarianTrack - 1);
    expect(state.barbarians?.attacks).toBe(0);
  });

  it('zaehlt jede Stadt auf dem Brett, egal wem sie gehoert', () => {
    const state = gameWithCities();
    expect(barbarianStrength(state)).toBe(
      Object.values(state.buildings).filter((b) => b.kind === 'city').length,
    );
  });

  it('haelt den Raeuber fest, bis die Barbaren einmal da waren', () => {
    expect(robberIsFree(gameWithCities())).toBe(false);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

Ausführen: `pnpm --filter @conquerist/shared test -- barbarians`
Erwartet: FAIL.

- [ ] **Schritt 3: Umsetzen**

`state.ts`, `BarbarianStateSchema` und das Feld:

```ts
export const BarbarianStateSchema = z.object({
  /** 0 bis `rules.barbarianTrack`. Beim letzten Feld landen sie. */
  position: z.number().int().min(0),
  /**
   * Wie oft sie schon gelandet sind.
   *
   * Steht hier, weil zwei Regeln daran haengen und beide sonst raten muessten:
   * der Raeuber bleibt bis zum ersten Ueberfall stehen, und die Wueste wird
   * erst danach sein Platz.
   */
  attacks: z.number().int().min(0),
});
```

und in `GameStateSchema`:

```ts
/** Das Barbarenschiff. `null` heisst: an diesem Tisch ohne Erweiterung. */
barbarians: BarbarianStateSchema.nullable().default(null),
```

`cities/barbarians.ts`:

```ts
import type { GameState } from '../state.js';

/**
 * Das Heer der Barbaren.
 *
 * In dieser Etappe faehrt das Schiff, es landet aber nicht. Der Kampf braucht
 * Ritter, und die kommen in 10b - ein Ueberfall ohne sie traefe jeden
 * Staedtebesitzer wehrlos, und zwar alle sieben Schiffswuerfe.
 */

/**
 * Die Staerke des Heeres: jede Stadt auf dem Brett, Metropolen mitgezaehlt.
 *
 * Gerechnet und nicht gespeichert - eine abgelegte Zahl liefe beim ersten
 * Ausbau zur Stadt auseinander.
 */
export function barbarianStrength(state: GameState): number {
  return Object.values(state.buildings).filter((building) => building.kind === 'city').length;
}

/** Ob der Raeuber schon versetzt werden darf. */
export function robberIsFree(state: GameState): boolean {
  return state.barbarians === null || state.barbarians.attacks > 0;
}

/** Rueckt das Schiff ein Feld vor. */
export function advanceShip(state: GameState): GameState {
  if (state.barbarians === null) return state;

  /*
   * ETAPPE 10a: das Schiff haelt ein Feld vor der Kueste an.
   *
   * Diese Zeile faellt in 10b, sobald es Ritter gibt. Bis dahin waere die
   * Landung kein Spielereignis, sondern ein Abriss: die Staerke der
   * Verteidigung ist ohne Ritter immer null, also verloere bei jedem Ueberfall
   * jeder Staedtebesitzer eine Stadt.
   */
  const last = state.rules.barbarianTrack - 1;
  const position = Math.min(state.barbarians.position + 1, last);

  return { ...state, barbarians: { ...state.barbarians, position } };
}
```

- [ ] **Schritt 4: Test laufen lassen** (erst nach Aufgabe 7 grün — die Reihenfolge ist
      Absicht, `CITIES_RULES` und die Fixture kommen dort)

- [ ] **Schritt 5: Noch nicht committen** — zusammen mit Aufgabe 7.

---

## Aufgabe 7: `CITIES_RULES` — das Regelwerk der Erweiterung

**Dateien:**

- Erstellen: `packages/shared/src/rules/cities.ts`
- Ändern: `packages/shared/src/rules/index.ts` (Export)
- Ändern: `packages/shared/src/rules/ruleset.ts` (`barbarianTrack`, `castleTurns`)
- Ändern: `packages/shared/src/game/fixtures.ts` (`gameWithCities`)
- Test: `packages/shared/src/rules/cities.test.ts`

**Schnittstellen:**

- Liefert: `CITIES_DICE`, `CITIES_RULES`, `CITIES_RULES_56`, `citiesRulesFor(seatCount)`,
  `RuleSet.barbarianTrack: number`, `RuleSet.castleTurns: boolean`
- Liefert: `gameWithCities(): GameState` — eine Partie nach dem Aufbau, drei Spieler,
  `CITIES_RULES`, Phase `main`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest';

import { CARD_IDS } from '../scenario/terrain.js';
import { CITIES_DICE, CITIES_RULES, CITIES_RULES_56, citiesRulesFor } from './cities.js';

describe('CITIES_RULES', () => {
  it('spielt auf 13 Siegpunkte', () => {
    expect(CITIES_RULES.victoryPointGoal).toBe(13);
  });

  it('fuehrt alle acht Kartensorten', () => {
    expect(CITIES_RULES.cards).toEqual([...CARD_IDS]);
  });

  it('kennt keine Entwicklungskarten und keine Groesste Rittermacht', () => {
    expect(CITIES_RULES.buildCosts.developmentCard).toBeUndefined();
    expect(CITIES_RULES.developmentDeck).toEqual({});
    expect(CITIES_RULES.victoryPoints.largestArmy).toBe(0);
    expect(CITIES_RULES.victoryPoints.developmentCard).toBe(0);
  });

  it('wuerfelt mit drei Wuerfeln, von denen einer nicht mitzaehlt', () => {
    expect(CITIES_DICE).toHaveLength(3);
    expect(CITIES_DICE.filter((die) => die.countsTowardYield)).toHaveLength(2);
    expect(CITIES_DICE[2]).toMatchObject({ id: 'event', render: 'event' });
  });

  it('faehrt ueber sieben Felder', () => {
    expect(CITIES_RULES.barbarianTrack).toBe(7);
  });
});

describe('CITIES_RULES_56', () => {
  /*
   * Die 5-6-Ergaenzung bringt 12 Ritter, 12 Helme und 6 Mauern - fuer ZWEI
   * zusaetzliche Personen. Je Person bleibt es bei sechs Rittern und drei
   * Mauern, und `pieceStock` ist je Person gezaehlt. Es weichen genau zwei
   * Dinge ab, und dieser Test bewacht das.
   */
  it('weicht nur im Handelswaren-Vorrat und in der Zugweitergabe ab', () => {
    const { resourceBank: bankGross, castleTurns: burgenGross, ...restGross } = CITIES_RULES_56;
    const { resourceBank: bankKlein, castleTurns: burgenKlein, ...restKlein } = CITIES_RULES;

    expect(restGross).toEqual(restKlein);
    expect(burgenGross).toBe(true);
    expect(burgenKlein).toBe(false);
    expect(bankGross.paper).toBe(18);
    expect(bankKlein.paper).toBe(12);
  });

  it('gilt ab fuenf Personen', () => {
    expect(citiesRulesFor(4)).toBe(CITIES_RULES);
    expect(citiesRulesFor(5)).toBe(CITIES_RULES_56);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

Ausführen: `pnpm --filter @conquerist/shared test -- cities`
Erwartet: FAIL.

- [ ] **Schritt 3: `RuleSetSchema` um zwei Felder ergänzen**

```ts
/**
 * Wie viele Felder die Fahrstrecke des Barbarenschiffs hat.
 *
 * Null heisst: an diesem Tisch faehrt kein Schiff. Damit ist die Erweiterung
 * eine Zahl im Regelwerk und kein zweiter Codepfad (Regel 5).
 */
barbarianTrack: z.number().int().min(0).default(0),

/**
 * Ob mit den Marken Burg 1 und Burg 2 gespielt wird (Etappe 10e).
 *
 * Sagt, **ob** - wo sie liegen, steht im `GameState`. Zwei aehnliche Namen,
 * zwei verschiedene Fragen.
 */
castleTurns: z.boolean().default(false),
```

`CLASSIC_RULES` und `CLASSIC_RULES_56` schreiben beide aus (`barbarianTrack: 0`,
`castleTurns: false`).

- [ ] **Schritt 4: `rules/cities.ts` schreiben**

```ts
import { CARD_IDS, RESOURCE_IDS } from '../scenario/terrain.js';
import { CLASSIC_56 } from '../scenario/blueprints/classic56.js';
import type { DiceSpec } from './dice.js';
import type { RuleSet } from './ruleset.js';

/**
 * Das Regelwerk von Staedte & Ritter.
 *
 * Es steht neben `CLASSIC_RULES` und nicht darueber: eine Partie traegt ihr
 * Regelwerk als Kopie in sich, und beide sind vollstaendig ausgeschrieben.
 * Ein Spread ueber `CLASSIC_RULES` waere kuerzer und liesse offen, was
 * absichtlich gleich ist und was nur vergessen wurde.
 */

export const CITIES_DICE: DiceSpec = [
  { id: 'first', faces: 6, countsTowardYield: true, render: 'pips' },
  { id: 'second', faces: 6, countsTowardYield: true, render: 'pips' },
  /*
   * Der dritte Wuerfel faellt mit und zaehlt nicht mit. Genau dafuer gibt es
   * `countsTowardYield` - siehe den Kopf von `dice.ts`, der diesen Fall
   * namentlich nennt.
   */
  { id: 'event', faces: 6, countsTowardYield: false, render: 'event' },
];

export const CITIES_RULES: RuleSet = {
  id: 'cities',
  cards: [...CARD_IDS],

  /*
   * Die Baukosten des Basisspiels, ohne die Entwicklungskarte: es gibt sie in
   * dieser Erweiterung nicht. Was hier fehlt, ist nicht kaufbar - und dass
   * `developmentDeck` leer ist, weist den Kauf ein zweites Mal ab.
   * Stadtmauer und Ritter kommen in 10b dazu.
   */
  buildCosts: {
    road: { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0, paper: 0, cloth: 0, coin: 0 },
    settlement: { brick: 1, lumber: 1, wool: 1, grain: 1, ore: 0, paper: 0, cloth: 0, coin: 0 },
    city: { brick: 0, lumber: 0, wool: 0, grain: 2, ore: 3, paper: 0, cloth: 0, coin: 0 },
  },

  pieceStock: { road: 15, settlement: 5, city: 4 },

  /* 19 je Rohstoff wie im Basisspiel, 12 je Handelsware wie in der Schachtel. */
  resourceBank: {
    brick: 19,
    lumber: 19,
    wool: 19,
    grain: 19,
    ore: 19,
    paper: 12,
    cloth: 12,
    coin: 12,
  },

  victoryPointGoal: 13,
  victoryPoints: {
    settlement: 1,
    city: 2,
    longestRoad: 2,
    /*
     * Beide auf null statt ausgelassen: die Felder sind Pflicht im Schema, und
     * eine Null sagt "gibt es hier nicht", ohne dass irgendwo ein zweiter
     * Codepfad entsteht. `recomputeLargestArmy` laeuft weiter und findet nie
     * einen Halter, weil niemand eine Ritterkarte spielt.
     */
    largestArmy: 0,
    developmentCard: 0,
  },
  longestRoadMinimum: 5,
  largestArmyMinimum: 3,
  developmentDeck: {},
  handLimitBeforeDiscard: 7,
  tradeOfferMs: 60_000,

  barbarianTrack: 7,
  castleTurns: false,

  dice: CITIES_DICE,
  robberRoll: 7,
};

/**
 * Das Regelwerk fuer fuenf und sechs Personen.
 *
 * Es weichen genau zwei Dinge ab. Die Ergaenzung bringt 12 weitere Ritter und
 * 6 weitere Mauern - fuer **zwei zusaetzliche Personen**; je Person bleibt es
 * bei sechs und drei, und `pieceStock` ist je Person gezaehlt. Zusaetzliche
 * Fortschrittskarten bringt sie ausdruecklich keine. Bleiben der Vorrat an
 * Handelswaren und die Zugweitergabe.
 */
export const CITIES_RULES_56: RuleSet = {
  ...CITIES_RULES,
  resourceBank: {
    brick: 24,
    lumber: 24,
    wool: 24,
    grain: 24,
    ore: 24,
    paper: 18,
    cloth: 18,
    coin: 18,
  },
  castleTurns: true,
};

/** Welches der beiden Regelwerke eine Tischgroesse traegt. */
export function citiesRulesFor(seatCount: number): RuleSet {
  return seatCount >= CLASSIC_56.minPlayers ? CITIES_RULES_56 : CITIES_RULES;
}
```

**Achtung:** der Test oben erwartet, daß `CITIES_RULES_56` bis auf Bank und
`castleTurns` gleich ist — die Rohstoffbank weicht aber auch ab (24 statt 19). Das ist
richtig so, weil `resourceBank` als Ganzes verglichen wird. Der Test schließt genau
diese beiden Felder aus.

`rules/index.ts` ergänzen: `export * from './cities.js';`

- [ ] **Schritt 5: Fixture ergänzen**

In `game/fixtures.ts` neben die bestehende Partie:

```ts
/**
 * Eine Partie nach Staedte-&-Ritter-Regeln, in der Hauptphase.
 *
 * Drei Spieler, dieselbe feste Aufstellung wie `gameInMainPhase`, aber mit
 * `CITIES_RULES` - und mit je einer Stadt, weil die Gruendung dort eine setzt.
 */
export function gameWithCities(): GameState { … }
```

Die Umsetzung folgt der vorhandenen Fixture; entscheidend ist, daß `rules` auf
`CITIES_RULES` steht, `barbarians` auf `{ position: 0, attacks: 0 }` und mindestens eine
Stadt auf dem Brett steht.

- [ ] **Schritt 6: Tests laufen lassen**

Ausführen: `pnpm --filter @conquerist/shared test -- cities barbarians`
Erwartet: grün — die Tests aus Aufgabe 6 werden hier grün.

- [ ] **Schritt 7: Committen**

```bash
git add packages/shared/src
git commit -m "Ein zweites Regelwerk und ein Schiff, das noch wartet"
```

---

## Aufgabe 8: Der Stadtertrag — ein Rohstoff und eine Handelsware

**Dateien:**

- Ändern: `packages/shared/src/game/yield.ts`
- Test: `packages/shared/src/game/yield.test.ts`

**Schnittstellen:**

- Verbraucht: `terrainCommodity` (Aufgabe 1), `CITIES_RULES`/`gameWithCities` (Aufgabe 7)
- Ändert: `Claim.resource` wird `CardId`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
describe('Stadtertrag mit Handelswaren', () => {
  it('gibt am Wald einen Holz und ein Papier', () => {
    // Brett und Stadt aus der Fixture; Wurfzahl des Waldfelds nehmen.
    const nachher = distributeYield(state, zahlDesWaldfelds);
    const hand = nachher.players[0]!.resources;

    expect(hand.lumber).toBe(1);
    expect(hand.paper).toBe(1);
  });

  it('gibt am Ackerland zwei Getreide und keine Handelsware', () => {
    const nachher = distributeYield(state, zahlDesAckerlands);
    const hand = nachher.players[0]!.resources;

    expect(hand.grain).toBe(2);
    expect(hand.cloth + hand.paper + hand.coin).toBe(0);
  });

  it('gibt einer Siedlung nur den Rohstoff', () => { … });

  /*
   * Die Bankregel gilt je Sorte. Papier und Holz sind zwei Sorten - wenn das
   * Papier ausgeht, faellt das Holz nicht mit aus.
   */
  it('behandelt Rohstoff und Handelsware als getrennte Vorraete', () => { … });
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

Ausführen: `pnpm --filter @conquerist/shared test -- yield`

- [ ] **Schritt 3: Umsetzen**

In `claimsForRoll` und `grantSetupYield` den Stadtfall aufteilen. Der Kern:

```ts
/*
 * Was eine Stadt an diesem Gelaende einbringt.
 *
 * Zwei Rohstoffe an Huegelland und Ackerland, sonst ein Rohstoff und eine
 * Handelsware. Ein Verzicht zugunsten von zwei gleichen Karten ist nicht
 * erlaubt - deshalb keine Wahl, sondern eine Ableitung.
 *
 * Ohne Erweiterung gibt `terrainCommodity` fuer jedes Gelaende `null`... nein:
 * es gibt immer dieselbe Zuordnung. Ob Handelswaren fallen, entscheidet das
 * Regelwerk - deshalb die Frage an `rules.cards`.
 */
function cityClaims(
  state: GameState,
  player: PlayerId,
  terrain: TerrainId,
  resource: ResourceId,
): Claim[] {
  const commodity = terrainCommodity(terrain);
  const plays = commodity !== null && state.rules.cards.includes(commodity);

  return plays
    ? [
        { player, resource, amount: 1 },
        { player, resource: commodity, amount: 1 },
      ]
    : [{ player, resource, amount: 2 }];
}
```

`Claim.resource` bekommt den Typ `CardId`. `byResource` heißt danach `byCard`.

- [ ] **Schritt 4: Tests laufen lassen**

Ausführen: `pnpm --filter @conquerist/shared test`
Erwartet: grün — die Basispartie ist unberührt, weil ihre `rules.cards` keine
Handelswaren nennt.

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src
git commit -m "Die Stadt am Wald liefert Holz und Papier"
```

---

## Aufgabe 9: Die Gründung setzt eine Stadt

**Dateien:**

- Ändern: `packages/shared/src/game/setup.ts`
- Ändern: `packages/shared/src/game/phase.ts` (Kommentar)
- Test: `packages/shared/src/game/setup.test.ts`

**Schnittstellen:**

- Liefert: `setupBuildingKind(state, placement): BuildingKind`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
describe('Gruendung mit Staedte-&-Ritter-Regeln', () => {
  it('setzt in der zweiten Runde eine Stadt', () => {
    // bis in die zweite Runde durchsetzen, dann:
    expect(state.buildings[knoten]).toMatchObject({ kind: 'city' });
  });

  it('nimmt dafuer eine Stadt aus dem Vorrat, keine Siedlung', () => {
    expect(spieler.piecesLeft.city).toBe(CITIES_RULES.pieceStock.city - 1);
    expect(spieler.piecesLeft.settlement).toBe(CITIES_RULES.pieceStock.settlement - 1);
  });

  /* Die Startrohstoffe kommen von der Stadt - aber je Feld nur einer. */
  it('gibt je angrenzendem Feld genau einen Rohstoff', () => { … });

  it('bleibt im Basisspiel bei zwei Siedlungen', () => {
    expect(state.buildings[knoten]).toMatchObject({ kind: 'settlement' });
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

- [ ] **Schritt 3: Umsetzen**

```ts
/**
 * Was in dieser Setzung auf den Knoten kommt.
 *
 * Im Basisspiel zweimal eine Siedlung, in Staedte & Ritter erst eine Siedlung
 * und dann eine **Stadt**. Das folgt aus dem Regelwerk und nicht aus einem
 * Schalter am Aufrufort: die Frage ist, ob dieser Tisch Handelswaren kennt -
 * denn genau dafuer braucht man von Anfang an eine Stadt.
 */
export function setupBuildingKind(state: GameState, placement: number): BuildingKind {
  const secondRound = placement >= state.players.length;
  return secondRound && state.rules.barbarianTrack > 0 ? 'city' : 'settlement';
}
```

**Warum `barbarianTrack > 0` als Kennzeichen und nicht `rules.id === 'cities'`:** eine
Id ist ein Name, kein Merkmal. Wer eine Variante baut, die Handelswaren kennt, aber
anders heißt, bekäme sonst die falsche Gründung.

`applySetupSettlement` benutzt es für `buildings[vertex].kind` und für den Abzug aus
`piecesLeft`. `grantSetupYield` bleibt, wie es ist — es gibt **eine** Karte je Feld,
und das ist auch in Städte & Ritter richtig („für jedes Landschaftsfeld, das an eure
Stadt grenzt, einen entsprechenden Rohstoff").

`canPlaceSettlementAt` gilt unverändert: die Abstandsregel trifft die Stadt genauso.

- [ ] **Schritt 4: Tests laufen lassen**

Ausführen: `pnpm --filter @conquerist/shared test`

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src
git commit -m "Die zweite Setzung ist eine Stadt"
```

---

## Aufgabe 10: Bank- und Hafenhandel mit Handelswaren

**Dateien:**

- Ändern: `packages/shared/src/game/trade.ts`
- Ändern: `packages/shared/src/game/actions.ts` (`tradeWithBank`)
- Test: `packages/shared/src/game/trade.test.ts`

**Schnittstellen:**

- Ändert: `tradeRateFor(state, player, give: CardId)`, `canTradeWithBank(…, give: CardId,
receive: CardId)`, `applyTradeWithBank` ebenso
- Ändert: `GameActionSchema.tradeWithBank` benutzt `CardIdSchema`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
describe('Handel mit Handelswaren', () => {
  it('tauscht vier gleiche Handelswaren gegen einen Rohstoff', () => { … });

  it('nimmt den 3:1-Hafen auch fuer Handelswaren', () => {
    // Spieler mit 3:1-Hafen, drei Papier auf der Hand
    expect(tradeRateFor(state, spieler, 'paper')).toBe(3);
  });

  /*
   * Ein 2:1-Hafen gehoert seinem Rohstoff. Es gibt keinen Papierhafen, und
   * ein Erzhafen macht Muenzen nicht billiger.
   */
  it('gibt den 2:1-Rohstoffhafen nicht an die Handelsware weiter', () => {
    expect(tradeRateFor(stateMitErzhafen, spieler, 'coin')).toBe(4);
    expect(tradeRateFor(stateMitErzhafen, spieler, 'ore')).toBe(2);
  });

  it('laesst einen Rohstoff gegen eine Handelsware tauschen', () => { … });
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

- [ ] **Schritt 3: Umsetzen**

In `trade.ts` die drei Signaturen von `ResourceId` auf `CardId` weiten. `tradeRateFor`
bleibt inhaltlich unverändert: `harbor.resource !== give` ist für jede Handelsware
schon wahr, weil kein Hafen eine Handelsware führt — die 2:1-Sperre gilt damit von
selbst, und der 3:1-Hafen (`harbor.resource === undefined`) greift weiter. **Diese
Stelle bekommt einen Kommentar**, sonst sieht sie beim nächsten Lesen aus, als hätte
jemand den Fall vergessen.

In `actions.ts` `give`/`receive` auf `CardIdSchema`.

- [ ] **Schritt 4: Tests laufen lassen**

Ausführen: `pnpm --filter @conquerist/shared test && pnpm --filter @conquerist/server test`

- [ ] **Schritt 5: Committen**

```bash
git add packages/shared/src
git commit -m "Vier Papier gegen einen Lehm"
```

---

## Aufgabe 11: Die Ereignisauswertung im Zug

**Dateien:**

- Erstellen: `packages/shared/src/game/cities/turn.ts`
- Ändern: `packages/shared/src/game/reducer.ts` (`rollDice`)
- Test: `packages/shared/src/game/cities/turn.test.ts`

**Schnittstellen:**

- Verbraucht: `eventFaceOf` (Aufgabe 5), `advanceShip` (Aufgabe 6)
- Liefert: `resolveEvent(state: GameState, roll: Roll): GameState`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
describe('resolveEvent', () => {
  it('rueckt das Schiff vor, wenn der Wuerfel ein Schiff zeigt', () => {
    const nachher = resolveEvent(gameWithCities(), wurf(3, 4, 1));
    expect(nachher.barbarians?.position).toBe(1);
  });

  it('laesst das Schiff stehen, wenn er ein Stadttor zeigt', () => {
    const nachher = resolveEvent(gameWithCities(), wurf(3, 4, 5));
    expect(nachher.barbarians?.position).toBe(0);
  });

  it('tut nichts in einer Partie ohne Erweiterung', () => {
    const basis = gameInMainPhase();
    expect(
      resolveEvent(basis, [
        { die: 'first', value: 3 },
        { die: 'second', value: 4 },
      ]),
    ).toBe(basis);
  });

  /* Der Wurf zaehlt weiter nur die zwei Augenwuerfel. */
  it('laesst den Ereigniswuerfel aus der Ertragszahl heraus', () => {
    expect(yieldTotal(CITIES_DICE, wurf(3, 4, 6))).toBe(7);
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

- [ ] **Schritt 3: `cities/turn.ts` schreiben**

```ts
/**
 * Was ein Wurf ausloest, bevor die Ertraege fallen.
 *
 * Die Reihenfolge stammt aus der Anleitung und ist nicht beliebig: Ereignis,
 * dann Ertrag. Daran haengt spaeter (10b), dass in der Runde des ersten
 * Ueberfalls eine gewuerfelte Sieben den Raeuber schon bewegen darf - der
 * Angriff kommt davor.
 *
 * In dieser Etappe hat nur die Schiffsseite eine Wirkung. Die drei Stadttore
 * werden gelesen und tun nichts; die Fortschrittskarten kommen in 10d.
 */
export function resolveEvent(state: GameState, roll: Roll): GameState {
  const face = eventFaceOf(roll);
  if (face === null) return state;
  return face === 'ship' ? advanceShip(state) : state;
}
```

- [ ] **Schritt 4: In `reducer.ts` einhängen**

In `rollDice`, unmittelbar nach dem Festhalten von `rolled` und **vor** der
Ertragsverteilung:

```ts
/*
 * Ereignis vor Ertrag - so steht es in der Anleitung, und so muss es stehen:
 * ab 10b kann der Barbarenangriff eine Stadt kosten, und die soll in derselben
 * Runde nicht mehr ausschuetten.
 */
const afterEvent = resolveEvent(rolled, roll);
```

Danach `afterEvent` statt `rolled` weiterverwenden.

- [ ] **Schritt 5: Tests laufen lassen und committen**

```bash
pnpm --filter @conquerist/shared test
git add packages/shared/src
git commit -m "Erst das Ereignis, dann der Ertrag"
```

---

## Aufgabe 12: Die Sicht auf das Schiff

**Dateien:**

- Ändern: `packages/shared/src/game/playerView.ts`
- Test: `packages/shared/src/game/playerView.test.ts`

**Schnittstellen:**

- Liefert: `PlayerView.barbarians: BarbarianState | null`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('zeigt das Barbarenschiff - es steht offen auf dem Tisch', () => {
  const view = playerViewOf(gameWithCities(), spieler, seats, 1);
  expect(view.barbarians).toEqual({ position: 0, attacks: 0 });
});

it('laesst es in einer Basispartie weg', () => {
  expect(playerViewOf(gameInMainPhase(), spieler, seats, 1).barbarians).toBeNull();
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

- [ ] **Schritt 3: Umsetzen**

In `PlayerViewSchema` neben `robber`:

```ts
/** Das Barbarenschiff. Oeffentlich - es steht fuer alle sichtbar am Brettrand. */
barbarians: BarbarianStateSchema.nullable().default(null),
```

und in `playerViewOf`: `barbarians: state.barbarians,`.

- [ ] **Schritt 4: Tests laufen lassen und committen**

```bash
pnpm test
git add packages/shared/src
git commit -m "Das Schiff steht offen am Rand"
```

---

## Aufgabe 13: Handelswaren als Karten im Browser

**Dateien:**

- Ändern: `packages/shared/src/game/labels.ts` (Wörter)
- Ändern: `apps/client/src/game/labels.ts` (`CARD_COLORS`, `CARD_LABELS`)
- Erstellen: `apps/client/src/panels/CommodityGlyph.tsx`
- Ändern: `apps/client/src/panels/ResourceCard.tsx`
- Ändern: `apps/client/src/panels/HandPanel.tsx`
- Ändern: `apps/client/src/index.css`
- Test: `apps/client/src/panels/commodities.test.tsx` (**neu**)

**Entwurf in drei Sätzen (Designregel 1).** **Rolle:** eine Handelsware muß im
Vorbeisehen von ihrem Rohstoff zu unterscheiden sein — man hält beide gleichzeitig auf
der Hand und wählt unter Zeitdruck aus. **Aufbau:** Pergamentkörper mit
geländefarbenem Rand, eigenes Motiv, Name wie bei der Rohstoffkarte. **Woran man sich
erinnert:** dieselbe Farbe wie das Land, aber eine helle Karte — „vom selben Ort,
andere Art von Ware".

- [ ] **Schritt 1: Die Wörter in `shared`**

```ts
export const COMMODITY_LABELS: Readonly<Record<CommodityId, string>> = {
  paper: 'Papier',
  cloth: 'Tuch',
  coin: 'Münzen',
};

/** Das deutsche Wort zu jeder Kartensorte. */
export const CARD_LABELS: Readonly<Record<CardId, string>> = {
  ...RESOURCE_LABELS,
  ...COMMODITY_LABELS,
};
```

`resourceList` benutzt danach `CARD_LABELS` und zählt über `CARD_IDS`.

- [ ] **Schritt 2: Den fehlschlagenden Bildschirmtest schreiben**

`apps/client/src/panels/commodities.test.tsx`:

```tsx
it('zeigt Papier als eigene Karte neben dem Holz', () => {
  render(
    <HandPanel
      resources={{ ...EMPTY_CARDS, lumber: 2, paper: 1 }}
      cardCount={3}
      covered={false}
      onReveal={() => {}}
    />,
  );

  expect(screen.getByTitle('Holz')).toBeInTheDocument();
  expect(screen.getByTitle('Papier')).toBeInTheDocument();
});

it('gibt der Handelsware einen anderen Koerper als dem Rohstoff', () => {
  // Die Klasse traegt den Unterschied, nicht die Farbe allein.
  expect(screen.getByTitle('Papier').className).toContain('--ware');
  expect(screen.getByTitle('Holz').className).not.toContain('--ware');
});
```

- [ ] **Schritt 3: Test laufen lassen, er muss fehlschlagen**

Ausführen: `pnpm --filter @conquerist/client test -- commodities`

- [ ] **Schritt 4: Die Farben und die Motive**

`apps/client/src/game/labels.ts`:

```ts
/**
 * Die Farbe einer Handelsware ist die des Gelaendes, aus dem sie kommt.
 *
 * Sie traegt sie aber als **Rand**, nicht als Flaeche - siehe `ResourceCard`.
 * Zwei Karten mit derselben Farbe und derselben Flaeche waeren im Vorbeisehen
 * dieselbe Karte, und man haelt Holz und Papier gleichzeitig auf der Hand.
 */
export const COMMODITY_COLORS: Readonly<Record<CommodityId, string>> = {
  paper: TERRAIN_COLORS.forest,
  cloth: TERRAIN_COLORS.pasture,
  coin: TERRAIN_COLORS.mountains,
};

export const CARD_COLORS: Readonly<Record<CardId, string>> = {
  ...RESOURCE_COLORS,
  ...COMMODITY_COLORS,
};
```

`CommodityGlyph.tsx` — drei Motive in derselben Handschrift wie `ResourceGlyph`
(gefüllte Silhouetten, ein `viewBox`, keine Strichbreiten unter 1 px umgerechnet auf
die kleinste Darstellung):

- **Papier:** ein aufgerollter Bogen — Rechteck mit eingerollter oberer Kante.
- **Tuch:** ein Ballen — gefaltete Bahn mit zwei sichtbaren Lagen.
- **Münzen:** drei gestapelte Scheiben, leicht versetzt.

Jedes muß bei 14 px noch als Silhouette lesbar sein (dieselbe Grenze, die
`AwardGlyph` schon eingehalten hat).

- [ ] **Schritt 5: Karte und Hand umstellen**

`ResourceCard` bekommt eine Schwester `CardTile`, die für Rohstoff **und**
Handelsware zuständig ist — oder `ResourceCard` nimmt `card: CardId` statt
`resource: ResourceId` und entscheidet über `COMMODITY_IDS.includes(card)`. **Der
zweite Weg ist richtig:** es ist dieselbe Karte in zwei Ausführungen, und zwei
Komponenten wären zwei Gelegenheiten auseinanderzulaufen — genau die Begründung, die
im Kopf von `ResourceCard.tsx` schon steht.

`HandPanel` zählt über `CARD_IDS` statt `RESOURCE_IDS`; die Filterung auf `amount > 0`
sorgt weiter dafür, daß eine Basispartie fünf Stapel zeigt.

CSS: `.rescard--ware` mit Pergamentgrund, farbigem Rand (`border-color` aus einer
Variable, die die Komponente per `style` setzt — **kein Hex im Bauteil**) und
dunkler Tinte. Prüfen, daß `--ink` auf dem Pergamentgrund gilt und nicht auf den
Tiefsee-Wert umgestellt ist.

- [ ] **Schritt 6: Tests laufen lassen**

Ausführen: `pnpm --filter @conquerist/client test`

- [ ] **Schritt 7: Committen**

```bash
git add packages/shared/src apps/client/src
git commit -m "Papier ist nicht Holz, auch wenn beide aus dem Wald kommen"
```

---

## Aufgabe 14: Der dritte Würfel — und was er der Vorführung antut

**Dateien:**

- Erstellen: `apps/client/src/panels/EventDie.tsx`
- Ändern: `apps/client/src/panels/DiceTray.tsx`
- Ändern: `apps/client/src/index.css`
- Test: `apps/client/src/panels/dice.test.tsx`

**Entwurf in drei Sätzen.** **Rolle:** der dritte Würfel steht neben den beiden anderen
und sagt, was in dieser Runde außer dem Ertrag passiert. **Aufbau:** derselbe
Würfelkörper, aber statt Augen ein Schiff oder ein Stadttor in Bereichsfarbe.
**Woran man sich erinnert:** daß er mitfliegt und mit den anderen zugleich liegt.

**Die Animation ist hier der eigentliche Punkt.** `DiceTray` wirft heute nur, wenn
`spec.every((die) => die.faces === 6)` — der Ereigniswürfel hat sechs Seiten und käme
damit als Kubus mit **Augen** durch. Das ist die Falle: die Bedingung fragt die falsche
Eigenschaft. Sie muß auf `render` sehen, und die Kubusflächen müssen das Symbol tragen.

Und weiter: `useSettledRoll` hält die **ganze** Vorführung an, bis die Würfel liegen.
Das gilt jetzt auch für die Folge des Ereigniswürfels — das Schiff darf **nicht**
vorrücken, solange die Würfel fliegen, sonst erklärt die Bewegung nicht den Wechsel,
sondern kommt ihm hinterher (dieselbe Falle wie beim Verlaufssatz, `CLAUDE.md`).
Da `useSettledRoll` den ganzen Stand zurückhält, ist das **von selbst richtig**, solange
die Barbarenleiste ihren Stand aus demselben zurückgehaltenen `view` liest und nicht
aus einer eigenen Quelle. Das ist die eine Sache, die in Aufgabe 15 zu prüfen ist.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```tsx
it('zeigt den Ereigniswuerfel mit Symbol statt mit Augen', () => {
  render(
    <DiceTray
      spec={CITIES_DICE}
      roll={wurf(3, 4, 1)}
      total={7}
      canRoll={false}
      fell={false}
      onRoll={() => {}}
    />,
  );

  expect(screen.getByTestId('die-event')).toHaveAttribute('data-face', 'ship');
  // Die Augen des Ereigniswuerfels darf es nicht geben.
  expect(screen.queryByTestId('die-event')?.querySelector('.die__pip')).toBeNull();
});

it('wirft auch mit drei Wuerfeln, nicht nur mit zweien', () => {
  render(
    <DiceTray
      spec={CITIES_DICE}
      roll={null}
      total={null}
      canRoll
      fell={false}
      landing={wurf(2, 5, 4)}
      onRoll={() => {}}
    />,
  );

  expect(screen.getByTestId('dice-flying')).toBeInTheDocument();
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

- [ ] **Schritt 3: `EventDie.tsx` schreiben**

Vier gezeichnete Motive, alle im selben Quadrat:

- **Schiff:** Rumpf als flacher Bogen, ein Mast, ein Segel — eine Silhouette.
- **Drei Stadttore** in Gelb, Blau und Grün — dieselbe Torform, unterschiedliche Farbe
  **und** unterschiedliche Zinnenzahl, damit die Farbe nicht der einzige Träger ist
  (Designregel 7).

Die Farben kommen aus neuen Variablen in `index.css` (`--track-trade`,
`--track-politics`, `--track-science`) und nicht als Hex aus der Komponente.

- [ ] **Schritt 4: `DiceTray` umstellen**

Die Wurfbedingung ändern:

```ts
/*
 * Geworfen wird, was ein Kubus sein kann - und das haengt an der Darstellung,
 * nicht an der Seitenzahl. Der Ereigniswuerfel hat auch sechs Seiten; ihn nach
 * `faces === 6` als Augenwuerfel zu werfen, malte sechs Punkte, wo ein Schiff
 * gehoert.
 */
const throwable = spec.every((die) => die.faces === 6);
```

Die Kubusflächen bekommen je nach `die.render` entweder Augen oder `<EventDie>`.

- [ ] **Schritt 5: Tests laufen lassen und committen**

```bash
pnpm --filter @conquerist/client test
git add apps/client/src
git commit -m "Der dritte Wuerfel fliegt mit"
```

---

## Aufgabe 15: Die Barbarenleiste

**Dateien:**

- Erstellen: `apps/client/src/panels/BarbarianTrack.tsx`
- Ändern: `apps/client/src/screens/GameScreen.tsx`
- Ändern: `apps/client/src/index.css`
- Test: `apps/client/src/panels/barbarians.test.tsx`

**Entwurf in drei Sätzen.** **Rolle:** die Spannungsanzeige — wie nah die Gefahr ist und
ob man ihr gewachsen wäre. **Aufbau:** sieben Stationen als Reihe, das Schiff darauf,
daneben zwei Zahlen (Barbaren gegen Ritter). **Woran man sich erinnert:** daß das
Schiff jedesmal ein Feld näher kommt.

**Animation:** das Schiff **gleitet** von Feld zu Feld — ein `transform` mit
`transition`, keine `animation`. Der Grund steht in `CLAUDE.md`: eine `animation` läuft
beim Einhängen und **nicht** beim Aktualisieren, und hier bleibt derselbe Knoten
stehen. Eine Transition auf `transform` läuft dagegen genau bei der Änderung — und die
Änderung ist der Zustandswechsel, den sie erklären soll.

Bei `prefers-reduced-motion`: `transition: none`, und es wird **nicht** gewartet — die
Position steht sofort.

Der Stand kommt aus derselben `view`, die `useSettledRoll` zurückhält. **Nachprüfen**,
daß `GameScreen` die Leiste aus dem zurückgehaltenen Stand speist und nicht aus dem
Rohstand: sonst rückt das Schiff vor, während die Würfel noch fliegen.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```tsx
it('zeigt sieben Stationen und das Schiff auf seinem Feld', () => {
  render(
    <BarbarianTrack
      barbarians={{ position: 2, attacks: 0 }}
      track={7}
      strength={3}
      defenders={null}
    />,
  );

  expect(screen.getAllByTestId('barbarian-station')).toHaveLength(7);
  expect(screen.getByTestId('barbarian-ship')).toHaveAttribute('data-position', '2');
});

it('nennt die Staerke der Barbaren als Zahl, nicht nur als Balken', () => {
  expect(screen.getByLabelText(/Barbaren/)).toHaveTextContent('3');
});

/*
 * Solange es keine Ritter gibt, steht dort keine Null. Eine Zahl, die niemals
 * steigen kann, sagt "gerade nicht" ueber etwas, das nie geht.
 */
it('laesst die Ritterstaerke weg, solange es keine gibt', () => {
  expect(screen.queryByLabelText(/Ritter/)).toBeNull();
});

it('bleibt weg, wenn an diesem Tisch kein Schiff faehrt', () => {
  const { container } = render(
    <BarbarianTrack barbarians={null} track={0} strength={0} defenders={null} />,
  );
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

- [ ] **Schritt 3: Umsetzen**

Die Zahlen mit `Numeral` aus `type/Numerals.tsx` setzen — es sind Zahlen, die man
vergleicht, und dafür gibt es die Anzeigeschrift.

**In 10a zeigt die Leiste nur die Barbarenstärke und die Stationen.** Die zweite Zahl —
die Stärke der Ritter — kommt erst in 10b dazu, wenn es Ritter gibt. Eine Null, die
niemals steigen kann, ist dasselbe wie ein Knopf, der nie angeht: sie sagt „gerade
nicht" über etwas, das nie geht (`CLAUDE.md`, die Falle mit dem Siegpunkt).

Die Komponente nimmt `defenders` deshalb schon als Eigenschaft entgegen, zeigt sie aber
nur, wenn sie nicht `null` ist. In 10a übergibt `GameScreen` `null`, in 10b eine Zahl —
und die Leiste selbst ändert sich dann nicht mehr.

- [ ] **Schritt 4: Tests laufen lassen und committen**

```bash
pnpm --filter @conquerist/client test
git add apps/client/src
git commit -m "Sieben Felder bis zur Kueste"
```

---

## Aufgabe 16: Das Regelwerk wird gewählt

**Dateien:**

- Ändern: `packages/shared/src/protocol/room.ts`
- Ändern: `apps/server/src/db/database.ts` (vierter Migrationsschritt)
- Ändern: `apps/server/src/rooms/room.ts`, `apps/server/src/rooms/sqliteStore.ts`
- Ändern: `apps/client/src/screens/StartScreen.tsx`, `apps/client/src/screens/LobbyScreen.tsx`
- Test: `apps/server/src/rooms/room.test.ts`, `apps/server/src/db/database.test.ts`

**Schnittstellen:**

- Liefert: `RoomVariant = 'classic' | 'cities'`, `Room.variant`, `createRoom(…, variant)`,
  `configureRoom(…, variant)`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```ts
it('legt eine Partie nach Staedte-&-Ritter-Regeln an', () => {
  const room = createRoom('ABCD', 'u1', 'Anna', 3, 'seed', 13, 'cities').room!;
  const gestartet = startGame(füllen(room), 'u1').room!;

  expect(gestartet.game!.rules.id).toBe('cities');
  expect(gestartet.game!.barbarians).toEqual({ position: 0, attacks: 0 });
});

it('bleibt ohne Angabe beim Basisspiel', () => { … });

it('traegt die Variante ueber einen Neustart', () => {
  // ablegen, neu laden, `variant` pruefen
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen**

- [ ] **Schritt 3: Migrationsschritt anhängen**

**Bestehende Schritte werden nicht angefaßt** (`CLAUDE.md`). Hinten anhängen:

```ts
/** Etappe 10a: welches Regelwerk ein Raum spielt. */
function stepRoomVariant(db: Database): void {
  db.exec(`ALTER TABLE rooms ADD COLUMN variant TEXT NOT NULL DEFAULT 'classic';`);
}
```

- [ ] **Schritt 4: Raum und Protokoll**

`Room.variant: RoomVariant`, durchgereicht durch `createRoom`, `configureRoom`,
`sqliteStore` (`variant` ↔ `row.variant`) und die Raumzusammenfassung.

In `startGame`:

```ts
const rules = room.variant === 'cities' ? citiesRulesFor(room.seatCount) : rulesFor(room.seatCount);
```

**Der Startzustand braucht `barbarians`.** `createGame` setzt es aus dem Regelwerk:

```ts
barbarians: rules.barbarianTrack > 0 ? { position: 0, attacks: 0 } : null,
```

- [ ] **Schritt 5: Die Auswahl im Browser**

Im Wartebereich neben dem Siegpunktziel: zwei Möglichkeiten, „Basisspiel" und
„Städte & Ritter". Bei der Umstellung springt das Siegpunktziel auf die Vorgabe des
Regelwerks (10 bzw. 13) — **wenn** es noch auf der alten Vorgabe stand. Wer eine eigene
Zahl eingestellt hat, behält sie; eine Umstellung, die eine getroffene Entscheidung
überschreibt, ist ein Eingriff in eine fremde Entscheidung (dieselbe Lehre wie bei der
Sitzfarbe, `CLAUDE.md`).

Dasselbe im `StartScreen` für die lokale Partie.

- [ ] **Schritt 6: Tests laufen lassen und committen**

```bash
pnpm typecheck && pnpm test
git add -A
git commit -m "Am Tisch wird ausgesucht, nach welchen Regeln gespielt wird"
```

---

## Aufgabe 17: Abnahme, Durchgang im Browser, `PROGRESS.md`

**Dateien:**

- Ändern: `PROGRESS.md`

- [ ] **Schritt 1: Die volle Abnahme messen**

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Die Zahlen je Paket **ablesen**, nicht schätzen. Bundlegröße und CSS-Größe aus der
Build-Ausgabe übernehmen.

- [ ] **Schritt 2: Im Browser durchsehen**

Eine lokale Partie mit Städte & Ritter starten und ansehen:

- Fallen drei Würfel, und trägt der dritte ein Symbol?
- Liegen Handelswaren als eigene Karten auf der Hand, unterscheidbar vom Rohstoff?
- Rückt das Schiff **nachdem** die Würfel liegen, nicht davor?
- Steht die Barbarenleiste im Layout, ohne etwas zu verdrängen — auch bei 26rem?
- Bricht die rechte Ecke um? (Sie trug schon vor dieser Etappe vier Stücke.)

Befunde als Messung festhalten, nicht als Eindruck.

- [ ] **Schritt 3: Den Abschnitt schreiben**

Form wie gehabt: Überschrift und Stand, Abnahmetabelle mit gemessenen Zahlen,
getroffene Entscheidungen je Absatz mit Grund, Abweichungen vom Plan, offene Punkte,
nächste Etappe.

**Diese offenen Punkte gehören ausdrücklich hinein:**

- Das Schiff hält ein Feld vor der Küste an — eine Zeile in `advanceShip`, mit Grund,
  fällt in 10b.
- Die drei Stadttore des Ereigniswürfels werden gelesen und tun nichts (10d).
- Die Ritterstärke fehlt in der Barbarenleiste, weil es noch keine Ritter gibt.
- Der Räuber ist frei wie im Basisspiel; die Sperre kommt mit dem ersten Überfall in 10b.

- [ ] **Schritt 4: Committen**

```bash
git add PROGRESS.md
git commit -m "Was in 10a entschieden wurde"
```

---

## Selbstprüfung des Plans

**Abdeckung gegen den Spec (Abschnitt 9, Etappe 10a):**

| Spec-Forderung                                     | Aufgabe                                   |
| -------------------------------------------------- | ----------------------------------------- |
| Kartenmodell 1.1                                   | 1, 3                                      |
| `RuleSet.cards` 1.2                                | 4                                         |
| Auffüllung gespeicherter Mengen 1.3                | 2                                         |
| Ereigniswürfel 1.4                                 | 5, 14                                     |
| `CITIES_RULES` (Abschnitt 3)                       | 7                                         |
| Stadtertrag 1+1                                    | 8                                         |
| Gründung mit Stadt                                 | 9                                         |
| 13 Siegpunkte                                      | 7                                         |
| Keine Entwicklungskarten, keine Größte Rittermacht | 7                                         |
| Bank-/Hafenhandel mit Handelswaren                 | 10                                        |
| Abwerfen und Stehlen zählen Handelswaren mit       | 2, 3 (folgt aus `CARD_IDS` in `cards.ts`) |
| Handelswarenkarten im Browser                      | 13                                        |
| Dritter Würfel mit Symbolen                        | 14                                        |
| Barbarenleiste                                     | 15                                        |
| Auswahl im Wartebereich                            | 16                                        |
| Abnahme und `PROGRESS.md`                          | 17                                        |

**Was der Plan über den Spec hinaus festhält:** Aufgabe 6 legt fest, wie weit das Schiff
in 10a fährt (bis ein Feld vor der Küste). Der Spec sagte nur „der Angriff bleibt aus".

**Typkonsistenz geprüft:** `CardId`/`CardAmounts` durchgehend ab Aufgabe 3;
`terrainCommodity` in 1 definiert, in 8 benutzt; `eventFaceOf` in 5 definiert, in 11
benutzt; `advanceShip` in 6 definiert, in 11 benutzt; `barbarianTrack` in 7 definiert,
in 6, 9, 15 und 16 benutzt.

**Eine bewußte Reihenfolgeabweichung:** Aufgabe 6 schreibt Tests, die erst mit Aufgabe 7
grün werden (`CITIES_RULES` und die Fixture). Beide werden zusammen committet. Der
Grund ist, daß `barbarians` ins `state.ts` gehört und das Regelwerk in `rules/` — sie
in einer Aufgabe zusammenzulegen ergäbe eine Aufgabe, die zwei Dinge tut.
