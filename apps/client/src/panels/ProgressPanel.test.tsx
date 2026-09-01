// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CITIES_RULES,
  CLASSIC_RULES,
  type PlayerView,
  type ProgressCardId,
} from '@conquerist/shared';
import { fireEvent, render, screen, userEvent } from '../test/dom';
import { ProgressPanel } from './ProgressPanel';

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
