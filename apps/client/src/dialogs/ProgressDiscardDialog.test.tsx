// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { ProgressDiscardDialog } from './ProgressDiscardDialog';

describe('ProgressDiscardDialog', () => {
  it('zeigt jede Karte der Hand mit ihrem Namen', () => {
    render(<ProgressDiscardDialog cards={['crane', 'warlord', 'bishop']} onDiscard={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Kran' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Heerführer' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Bischof' })).toBeDefined();
  });

  it('meldet die gewaehlte Karte', async () => {
    const onDiscard = vi.fn();
    render(<ProgressDiscardDialog cards={['crane', 'warlord']} onDiscard={onDiscard} />);

    await userEvent.click(screen.getByRole('button', { name: 'Kran' }));

    expect(onDiscard).toHaveBeenCalledWith('crane');
  });
});
