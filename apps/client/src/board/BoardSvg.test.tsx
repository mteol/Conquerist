// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  setupPlayer,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { actionTargets } from '../game/targets';
import { BoardSvg } from './BoardSvg';

const scenario = generateScenario(CLASSIC_34, 'board-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'board-probe',
);

describe('BoardSvg', () => {
  it('zeichnet jedes Feld des Szenarios', () => {
    render(
      <BoardSvg
        state={start}
        targets={actionTargets(start, 'p1')}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    for (const placement of scenario.hexes) {
      expect(screen.getByTestId(`hex-${placement.hex}`)).toBeDefined();
    }
  });

  it('hebt genau die Knoten hervor, die in der Klickkarte stehen', () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={vi.fn()} />);

    const marked = screen
      .getAllByTestId(/^vertex-/)
      .filter((element) => element.dataset['target'] === 'true');

    expect(marked).toHaveLength(targets.vertices.size);
  });

  it('meldet den angeklickten Knoten', async () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    const vertex = [...targets.vertices.keys()][0]!;
    const onPick = vi.fn();

    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={onPick} />);
    await userEvent.click(screen.getByTestId(`vertex-${vertex}`));

    expect(onPick).toHaveBeenCalledWith({ kind: 'vertex', id: vertex });
  });

  it('meldet nichts, wenn der Knoten nicht in der Klickkarte steht', async () => {
    const targets = actionTargets(start, 'p3');
    const onPick = vi.fn();

    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={onPick} />);
    const anyVertex = screen.getAllByTestId(/^vertex-/)[0]!;
    await userEvent.click(anyVertex);

    expect(onPick).not.toHaveBeenCalled();
  });
});
