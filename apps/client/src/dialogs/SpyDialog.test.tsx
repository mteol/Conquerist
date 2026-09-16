// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { SpyDialog } from './SpyDialog';

describe('SpyDialog', () => {
  it('zeigt die fremden Karten und sagt, dass sie nur jetzt zu sehen sind', () => {
    render(<SpyDialog victimName="Ben" cards={['bishop', 'crane']} onTake={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Bischof' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Kran' })).toBeDefined();
    expect(screen.getByText(/nur jetzt/)).toBeDefined();
  });

  it('meldet die genommene Karte', async () => {
    const onTake = vi.fn();
    render(<SpyDialog victimName="Ben" cards={['bishop', 'crane']} onTake={onTake} />);

    await userEvent.click(screen.getByRole('button', { name: 'Kran' }));

    expect(onTake).toHaveBeenCalledWith('crane');
  });
});
