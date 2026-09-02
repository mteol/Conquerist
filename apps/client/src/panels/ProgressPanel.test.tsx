// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CITIES_RULES,
  CLASSIC_RULES,
  TRACK_IDS,
  type PlayerView,
  type ProgressCardId,
} from '@conquerist/shared';
import { fireEvent, render, screen, userEvent } from '../test/dom';
import { ProgressPanel } from './ProgressPanel';
import { TRACK_BUILT_WORD_COLORS } from '../game/labels';
// Roher Dateiinhalt statt `node:fs`, wie in `AccountCorner.test.tsx` und
// `TrackPanel.test.tsx`: das Client-Paket haelt sich bewusst frei von
// Node-Typen.
import css from '../index.css?raw';

/**
 * Eine minimale Sicht - so viel `PlayerView`, wie `ProgressPanel` wirklich
 * liest. Kein voller Spielzustand: dieselbe Idee wie bei `TrackPanel.test.tsx`,
 * das `player` auch nur als `{ improvements }` uebergibt.
 */
function baseView(
  overrides: Partial<PlayerView> = {},
  hand: readonly ProgressCardId[] = [],
): PlayerView {
  return {
    you: 'p1',
    version: 1,
    scenario: { id: 't', name: 't', minPlayers: 2, maxPlayers: 4, hexes: [], harbors: [] } as never,
    rules: CITIES_RULES,
    players: [
      // `progressCards` liegt am Sitz, nicht an der Sicht selbst - genau wie
      // `resources` und `developmentCards` (siehe `ProgressPanel.tsx`).
      { id: 'p1', name: 'Spieler 1', progressCards: hand } as never,
      { id: 'p2', name: 'Spieler 2', progressCards: null } as never,
    ],
    currentPlayerIndex: 0,
    phase: { kind: 'main' },
    buildings: {},
    roads: {},
    knights: {},
    robber: '0,0',
    barbarians: null,
    merchant: null,
    defenders: 0,
    bank: {} as never,
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, size: 0 },
    deckLeft: 0,
    progressDeckSizes: { science: 18, trade: 17, politics: 16 },
    developmentPlayed: false,
    fleetSort: null,
    alchemistRoll: null,
    craneDiscount: [],
    playableCards: [],
    canOfferTrade: false,
    roadBuildingTargets: {},
    // Die sieben Zielableitungen aus Aufgabe 15c - hier nur mit leeren
    // Vorgaben, weil ProgressPanel sie noch nicht liest (eigene Folgeaufgabe).
    inventorTargets: {},
    engineerTargets: [],
    medicineTargets: [],
    smithTargets: {},
    progressRoadBuildingTargets: {},
    diplomatTargets: {},
    intrigueTargets: [],
    lastRoll: null,
    rollTally: {},
    turn: 1,
    ...overrides,
  };
}

const classicView = baseView({ rules: CLASSIC_RULES, progressDeckSizes: {} });
const citiesView = baseView();

function withHandView(cards: readonly ProgressCardId[]): PlayerView {
  return baseView({}, cards);
}

describe('ProgressPanel', () => {
  it('erscheint an einem Basistisch gar nicht', () => {
    const { container } = render(<ProgressPanel view={classicView} />);
    expect(container.querySelector('.progress')).toBeNull();
  });

  it('zeigt die drei Stapel mit ihrer Resthoehe', () => {
    render(<ProgressPanel view={citiesView} />);

    const science = screen.getByRole('group', { name: /Wissenschaft/ });
    expect(science.textContent).toContain('18');
  });

  it('nennt zu jeder Karte ihren Namen (Designregel 7)', () => {
    render(<ProgressPanel view={withHandView(['warlord'])} />);

    expect(screen.getByText('Heerführer')).toBeDefined();
  });

  it('spielt eine Karte ohne Angabe mit einem Klick', async () => {
    const onAction = vi.fn();
    render(<ProgressPanel view={withHandView(['warlord'])} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: /Heerführer/ }));

    expect(onAction).toHaveBeenCalledWith({
      type: 'playProgress',
      player: 'p1',
      play: { card: 'warlord' },
    });
  });

  it('fragt beim Rohstoffmonopol nach der Sorte', async () => {
    const onAction = vi.fn();
    render(<ProgressPanel view={withHandView(['resourceMonopoly'])} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: /Rohstoffmonopol/ }));

    expect(screen.getByRole('dialog', { name: /Sorte/ })).toBeDefined();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('meldet das Rohstoffmonopol mit der gewaehlten Sorte', async () => {
    const onAction = vi.fn();
    render(<ProgressPanel view={withHandView(['resourceMonopoly'])} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: /Rohstoffmonopol/ }));
    await userEvent.click(screen.getByTestId('pick-ore'));
    await userEvent.click(screen.getByRole('button', { name: 'Karte spielen' }));

    expect(onAction).toHaveBeenCalledWith({
      type: 'playProgress',
      player: 'p1',
      play: { card: 'resourceMonopoly', resource: 'ore' },
    });
  });

  it('fragt bei der Handelsflotte ueber alle acht Sorten', async () => {
    render(<ProgressPanel view={withHandView(['merchantFleet'])} />);

    await userEvent.click(screen.getByRole('button', { name: /Handelsflotte/ }));

    expect(screen.getByTestId('pick-cloth')).toBeDefined();
    expect(screen.getByTestId('pick-brick')).toBeDefined();
  });

  it('beginnt beim Haendler die Brettwahl, statt selbst zu spielen', async () => {
    const onAction = vi.fn();
    const onBoardPick = vi.fn();
    render(
      <ProgressPanel
        view={withHandView(['merchant'])}
        onAction={onAction}
        onBoardPick={onBoardPick}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Händler/ }));

    expect(onBoardPick).toHaveBeenCalledWith('merchant');
    expect(onAction).not.toHaveBeenCalled();
  });

  /*
   * Aufgabe 15d: die sieben Karten mit Angabe, deren Brettwahl bis dahin
   * fehlte, sind jetzt genauso verdrahtet wie Haendler und Bischof - ein
   * Klick beginnt die Wahl auf dem Brett, statt die Karte selbst zu spielen.
   * Ingenieur steht stellvertretend fuer alle sieben; `categoryOf` fasst sie
   * in derselben `board`-Kategorie zusammen wie Haendler und Bischof, und der
   * echte Weg je Karte - Zielmenge, ein bzw. zwei Klicks, Wirkung - steht in
   * `GameScreen.test.tsx`.
   */
  it('beginnt beim Ingenieur ebenfalls die Brettwahl, statt selbst zu spielen', async () => {
    const onAction = vi.fn();
    const onBoardPick = vi.fn();
    render(
      <ProgressPanel
        view={withHandView(['engineer'])}
        onAction={onAction}
        onBoardPick={onBoardPick}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Ingenieur/ }));

    expect(onBoardPick).toHaveBeenCalledWith('engineer');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('nennt bei jeder Karte auf der Hand die eigene Wirkung als Satz', () => {
    render(<ProgressPanel view={withHandView(['warlord'])} />);

    const button = screen.getByRole('button', { name: /Heerführer/ });
    const describedById = button.getAttribute('aria-describedby');
    const reason = document.getElementById(describedById!);

    expect(reason!.textContent).toBe('Alle eigenen Ritter gratis aktivieren.');
  });

  it('zeigt die Erklaerzeile beim Darueberfahren/Fokussieren an', () => {
    render(<ProgressPanel view={withHandView(['warlord'])} />);

    expect(screen.queryByTestId('progress-hint')).toBeNull();

    fireEvent.pointerEnter(screen.getByRole('button', { name: /Heerführer/ }).closest('li')!);

    const hint = screen.getByTestId('progress-hint');
    expect(hint.textContent).toContain('Heerführer');
    expect(hint.textContent).toContain('Alle eigenen Ritter gratis aktivieren.');
  });

  /*
   * Fixrunde 1, GERING 3: von den drei ResourcePickDialog-Aufrufen aus
   * Ruling 28 war ausgerechnet commodityMonopoly - der Fall mit der
   * kleinsten, dritten Wertemenge (CommodityIdSchema, 3 Sorten) - von keinem
   * Test angesteuert.
   */
  it('fragt beim Handelsmonopol nach der Handelsware und meldet sie mit dem Feld commodity', async () => {
    const onAction = vi.fn();
    render(<ProgressPanel view={withHandView(['commodityMonopoly'])} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: /Handelsmonopol/ }));

    const dialog = screen.getByRole('dialog', { name: /Sorte/ });
    expect(dialog).toBeDefined();
    // Die Handelsware-Menge, nicht die Rohstoff- oder die volle Sortenmenge.
    expect(screen.getByTestId('pick-cloth')).toBeDefined();
    expect(screen.queryByTestId('pick-ore')).toBeNull();

    await userEvent.click(screen.getByTestId('pick-cloth'));
    await userEvent.click(screen.getByRole('button', { name: 'Karte spielen' }));

    expect(onAction).toHaveBeenCalledWith({
      type: 'playProgress',
      player: 'p1',
      play: { card: 'commodityMonopoly', commodity: 'cloth' },
    });
  });
});

/*
 * Befund B, Aufgabe 16: `.devcard__name { color: var(--ink-base); }` schlug
 * die vom Elternelement `.devcard__face` geerbte, pro Bereich passende Tinte
 * - Politik und Wissenschaft landeten immer bei 2,39:1 bzw. 2,58:1, weit
 * unter den geforderten 4,5:1 (WCAG AA), obwohl `TRACK_BUILT_WORD_COLORS` die
 * richtige Farbe die ganze Zeit auslieferte.
 *
 * Ein Test, der nur prueft, dass `.devcard__face` die richtige Variable
 * traegt, haette diesen Fehler NICHT gefangen - genau das stand schon vorher
 * so da, waehrend der Fehler bestand (`ProgressPanel.tsx` setzt
 * `TRACK_BUILT_WORD_COLORS[track]` unveraendert seit Etappe 10d-1). Die
 * beiden Tests unten pruefen deshalb das Ergebnis: erstens strukturell, dass
 * `.devcard__name` keine eigene Farbe mehr setzt, die die geerbte ueberschreiben
 * koennte; zweitens rechnerisch, aus den tatsaechlichen `--track-*`/`--ink`/
 * `--on-sea`-Werten in `index.css`, den WCAG-Kontrast jedes Bereichs nach -
 * jsdom rechnet kein Layout und keine Kaskade ueber verlinkte Stylesheets,
 * das CSS selbst ist die einzig pruefbare Quelle (dieselbe Grenze wie in
 * `TrackPanel.test.tsx` und `AccountCorner.test.tsx`).
 */

/** Liefert den Inhalt der ersten Regel `selector { ... }` ab `fromIndex`. */
function ruleBody(selector: string, fromIndex = 0): string {
  const needle = `${selector} {`;
  const start = css.indexOf(needle, fromIndex);
  if (start === -1) throw new Error(`Regel nicht gefunden: ${selector}`);
  const openBrace = start + needle.length - 1;
  let depth = 1;
  let i = openBrace + 1;
  while (depth > 0) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
    i += 1;
  }
  return css.slice(openBrace + 1, i - 1);
}

/** Liest `--name: #rrggbb;` aus dem `:root`-Block. */
function rootHex(name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  if (!match) throw new Error(`Variable nicht gefunden: ${name}`);
  return requiredGroup(match, 1);
}

function requiredGroup(match: RegExpExecArray, index: number): string {
  const value = match[index];
  if (value === undefined) throw new Error(`Fanggruppe ${index} fehlt in „${match[0]}"`);
  return value;
}

/** Relative Luminanz nach WCAG 2.x, aus einem `#rrggbb`-Hexwert. */
function relativeLuminance(hex: string): number {
  const channel = (twoHexDigits: string) => {
    const c = parseInt(twoHexDigits, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(hex.slice(1, 3));
  const g = channel(hex.slice(3, 5));
  const b = channel(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG-Kontrastverhaeltnis zweier Farben, `(L1+0.05)/(L2+0.05)` mit L1 >= L2. */
function wcagContrast(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Loest `var(--x)` einmal auf `#rrggbb` auf - `--ink`/`--on-sea` sind hier keine Ketten. */
function resolveVarToHex(varExpression: string): string {
  const match = /^var\(--([a-z0-9-]+)\)$/.exec(varExpression);
  if (!match) throw new Error(`Kein einfacher var()-Ausdruck: ${varExpression}`);
  const name = requiredGroup(match, 1);
  // `--ink` selbst ist ein Alias auf `--ink-base` (siehe `index.css` :root,
  // Zeile ~41) - im Sitz des Fortschritt-Panels (heller Grund, kein
  // `--ink: var(--on-sea)`-Umschalter darueber) gilt dieser Alias.
  const resolved = name === 'ink' ? 'ink-base' : name;
  return rootHex(`--${resolved}`);
}

const WCAG_AA_TEXT_MINIMUM = 4.5;

describe('Kontrast der Kartennamen auf ihrem Grundton (Befund B, Aufgabe 16)', () => {
  it('".devcard__name" erzwingt keine eigene Farbe mehr, die die geerbte Bereichstinte schlagen koennte', () => {
    const nameBody = ruleBody('.devcard__name');
    expect(nameBody).toMatch(/color:\s*inherit/);
    expect(nameBody).not.toMatch(/color:\s*var\(--ink-base\)/);
  });

  it('".devcard__face" traegt die dunkle Grundtinte als Vorgabe, die Fortschrittskarten ueberschreiben sie per Inline-Style', () => {
    expect(ruleBody('.devcard__face')).toMatch(/color:\s*var\(--ink-base\)/);
  });

  it.each(TRACK_IDS)(
    'Bereich "%s": der tatsaechliche Kontrast von Name auf Grundton erreicht WCAG AA (4.5:1)',
    (track) => {
      const background = rootHex(`--track-${track}`);
      const text = resolveVarToHex(TRACK_BUILT_WORD_COLORS[track]);

      const contrast = wcagContrast(background, text);

      expect(contrast).toBeGreaterThanOrEqual(WCAG_AA_TEXT_MINIMUM);
    },
  );

  it('Politik und Wissenschaft lagen vor der Behebung unter 4.5:1 - derselbe Grundton mit dunkler statt geerbter Tinte', () => {
    const darkInk = rootHex('--ink-base');

    const politicsWithDarkInk = wcagContrast(rootHex('--track-politics'), darkInk);
    const scienceWithDarkInk = wcagContrast(rootHex('--track-science'), darkInk);

    expect(politicsWithDarkInk).toBeLessThan(WCAG_AA_TEXT_MINIMUM);
    expect(scienceWithDarkInk).toBeLessThan(WCAG_AA_TEXT_MINIMUM);
    // Deckt sich mit dem im Browser gemessenen Wert aus dem Durchgangsbericht
    // (task-16-report.md, Messpunkt 9): 2.39:1 bzw. 2.58:1.
    expect(politicsWithDarkInk).toBeCloseTo(2.39, 1);
    expect(scienceWithDarkInk).toBeCloseTo(2.58, 1);
  });
});
