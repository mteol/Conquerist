// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { CITIES_RULES, CLASSIC_RULES, type GameAction } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { EMPTY_TARGETS, targetsFrom } from '../game/targets';
import { KnightPanel } from './KnightPanel';

const A = 'v:0,0|1,-1|1,0';
const B = 'v:0,0|0,1|1,0';

describe('KnightPanel', () => {
  it('sperrt alle vier Knoepfe, wenn die Klickkarte nichts anbietet', () => {
    render(
      <KnightPanel
        targets={EMPTY_TARGETS}
        costs={CITIES_RULES.buildCosts}
        mode={null}
        onMode={vi.fn()}
      />,
    );

    for (const mode of ['activate', 'upgrade', 'move', 'chase']) {
      expect((screen.getByTestId(`knight-${mode}`) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('macht einen Knopf auf, sobald es fuer ihn eine Stelle gibt', () => {
    const targets = targetsFrom([
      { type: 'activateKnight', player: 'p1', vertex: A },
    ] as GameAction[]);

    render(
      <KnightPanel
        targets={targets}
        costs={CITIES_RULES.buildCosts}
        mode={null}
        onMode={vi.fn()}
      />,
    );

    expect((screen.getByTestId('knight-activate') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('knight-upgrade') as HTMLButtonElement).disabled).toBe(true);
  });

  it('zaehlt beim Versetzen die Ritter und nicht ihre Ziele', () => {
    const targets = targetsFrom([
      { type: 'moveKnight', player: 'p1', from: A, to: B },
      { type: 'moveKnight', player: 'p1', from: A, to: 'v:0,1|1,0|1,1' },
    ] as GameAction[]);

    render(
      <KnightPanel
        targets={targets}
        costs={CITIES_RULES.buildCosts}
        mode={null}
        onMode={vi.fn()}
      />,
    );

    expect(screen.getByTestId('knight-move').getAttribute('title')).toContain('1 Stelle');
  });

  it('meldet den Modus nach oben und schaltet ihn beim zweiten Druck wieder aus', async () => {
    const onMode = vi.fn();
    const targets = targetsFrom([
      { type: 'activateKnight', player: 'p1', vertex: A },
    ] as GameAction[]);

    const view = render(
      <KnightPanel targets={targets} costs={CITIES_RULES.buildCosts} mode={null} onMode={onMode} />,
    );

    await userEvent.click(screen.getByTestId('knight-activate'));
    expect(onMode).toHaveBeenLastCalledWith('activate');

    view.rerender(
      <KnightPanel
        targets={targets}
        costs={CITIES_RULES.buildCosts}
        mode="activate"
        onMode={onMode}
      />,
    );

    expect(screen.getByTestId('knight-activate').getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByTestId('knight-activate'));
    expect(onMode).toHaveBeenLastCalledWith(null);
  });

  /*
   * Nicht grau, sondern weg. Vier Knoepfe, die nie angehen, sagen "gerade
   * nicht" ueber etwas, das an diesem Tisch nie geht.
   */
  it('erscheint nicht, wo das Regelwerk keine Ritter preist', () => {
    const { container } = render(
      <KnightPanel
        targets={EMPTY_TARGETS}
        costs={CLASSIC_RULES.buildCosts}
        mode={null}
        onMode={vi.fn()}
      />,
    );

    expect(container.querySelector('.knights')).toBeNull();
  });
});
