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
