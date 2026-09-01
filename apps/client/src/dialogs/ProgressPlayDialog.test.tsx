// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, within } from '../test/dom';
import { ProgressPlayDialog } from './ProgressPlayDialog';

describe('ProgressPlayDialog - Alchemie', () => {
  it('sperrt "Karte spielen", bis beide Augenzahlen gewaehlt sind', async () => {
    render(<ProgressPlayDialog card="alchemist" onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Karte spielen' })).toHaveProperty('disabled', true);

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Erster Würfel' })).getByRole('button', {
        name: '3',
      }),
    );
    expect(screen.getByRole('button', { name: 'Karte spielen' })).toHaveProperty('disabled', true);

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Zweiter Würfel' })).getByRole('button', {
        name: '5',
      }),
    );
    expect(screen.getByRole('button', { name: 'Karte spielen' })).toHaveProperty('disabled', false);
  });

  it('meldet beide Augenzahlen', async () => {
    const onConfirm = vi.fn();
    render(<ProgressPlayDialog card="alchemist" onConfirm={onConfirm} onClose={vi.fn()} />);

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Erster Würfel' })).getByRole('button', {
        name: '3',
      }),
    );
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Zweiter Würfel' })).getByRole('button', {
        name: '5',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Karte spielen' }));

    expect(onConfirm).toHaveBeenCalledWith(3, 5);
  });

  it('bricht ab', async () => {
    const onClose = vi.fn();
    render(<ProgressPlayDialog card="alchemist" onConfirm={vi.fn()} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('ProgressPlayDialog - Kran', () => {
  it('nennt alle drei Bereiche', () => {
    render(<ProgressPlayDialog card="crane" onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Wissenschaft' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Handel' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Politik' })).toBeDefined();
  });

  it('meldet den gewaehlten Bereich mit einem Klick', async () => {
    const onConfirm = vi.fn();
    render(<ProgressPlayDialog card="crane" onConfirm={onConfirm} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Handel' }));

    expect(onConfirm).toHaveBeenCalledWith('trade');
  });
});
