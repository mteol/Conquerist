// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  playerViewOf,
  reduce,
  setupPlayer,
  type GameState,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { gameViewOf } from '../game/view';
import { actionTargets } from '../game/targets';
import { ActionPanel } from './ActionPanel';
import { TablePanel } from './TablePanel';

const scenario = generateScenario(CLASSIC_34, 'panels-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = createGame(scenario, CLASSIC_RULES, ids, 'panels-probe');
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

describe('TablePanel', () => {
  it('zeigt die eigenen Karten offen und von fremden nur die Anzahl', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

    render(<TablePanel view={view} />);

    // Verdeckt ist keine Ansichtssache mehr, sondern der Zustand: genau eine
    // offene Hand, und die gehoert dem, der zusieht.
    expect(screen.getAllByTestId(/^hand-p/)).toHaveLength(1);
    expect(screen.getAllByTestId(/^hand-count-/)).toHaveLength(2);
  });

  it('nennt einen getrennten Mitspieler beim Wort statt ihn nur einzufaerben', () => {
    const state = afterSetup();
    const offline = new Map([[ids[1]!, false]]);
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1, offline));

    render(<TablePanel view={view} />);

    expect(screen.getByText('getrennt')).toBeDefined();
  });
});

describe('ActionPanel', () => {
  it('sperrt Handel und Zugende, solange nicht gewuerfelt ist', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));
    const targets = actionTargets(state, view.currentPlayerId);

    render(
      <ActionPanel
        view={view}
        targets={targets}
        error={null}
        onRoll={vi.fn()}
        onEndTurn={vi.fn()}
        onOpenTrade={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Wuerfeln' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Handel' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Zug beenden' })).toHaveProperty('disabled', true);
  });

  it('zeigt den Ablehnungsgrund und laesst ihn wegraeumen', async () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));
    const onDismissError = vi.fn();

    render(
      <ActionPanel
        view={view}
        targets={actionTargets(state, view.currentPlayerId)}
        error="Vor dem Bauen fehlt der Wurf"
        onRoll={vi.fn()}
        onEndTurn={vi.fn()}
        onOpenTrade={vi.fn()}
        onDismissError={onDismissError}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Vor dem Bauen fehlt der Wurf');
    await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
    expect(onDismissError).toHaveBeenCalled();
  });
});
