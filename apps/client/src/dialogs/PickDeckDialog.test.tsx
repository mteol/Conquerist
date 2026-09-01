// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { PickDeckDialog } from './PickDeckDialog';

describe('PickDeckDialog', () => {
  it('zeigt alle drei Stapel mit ihrer Resthoehe', () => {
    render(
      <PickDeckDialog deckSizes={{ science: 18, trade: 17, politics: 16 }} onPick={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Wissenschaft/ }).textContent).toContain('18');
    expect(screen.getByRole('button', { name: /Handel/ }).textContent).toContain('17');
    expect(screen.getByRole('button', { name: /Politik/ }).textContent).toContain('16');
  });

  it('zeigt 0, wenn ein Stapel in der Sicht fehlt', () => {
    render(<PickDeckDialog deckSizes={{}} onPick={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Wissenschaft/ }).textContent).toContain('0');
  });

  it('meldet den gewaehlten Stapel', async () => {
    const onPick = vi.fn();
    render(<PickDeckDialog deckSizes={{ politics: 16 }} onPick={onPick} />);

    await userEvent.click(screen.getByRole('button', { name: /Politik/ }));

    expect(onPick).toHaveBeenCalledWith('politics');
  });
});
