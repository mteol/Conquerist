// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { MenuScreen } from './MenuScreen';

describe('Hauptmenue', () => {
  it('traegt den Titel und die drei Wege in dieser Reihenfolge', () => {
    render(<MenuScreen onChoose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Conquerist' })).toBeDefined();

    const entries = screen.getAllByRole('button').map((node) => node.textContent);
    expect(entries).toEqual(['Spiel starten — online', 'Lokal spielen', 'Spiel beitreten']);
  });

  it('meldet, welchen Weg jemand gewaehlt hat', async () => {
    const onChoose = vi.fn();
    render(<MenuScreen onChoose={onChoose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Lokal spielen' }));
    expect(onChoose).toHaveBeenCalledWith('local');

    await userEvent.click(screen.getByRole('button', { name: 'Spiel beitreten' }));
    expect(onChoose).toHaveBeenCalledWith('join');

    await userEvent.click(screen.getByRole('button', { name: 'Spiel starten — online' }));
    expect(onChoose).toHaveBeenCalledWith('online');
  });

  it('zeigt die eigenen Partien nur, wenn es welche gibt', () => {
    const { rerender } = render(<MenuScreen onChoose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Weiterspielen/ })).toBeNull();

    rerender(<MenuScreen onChoose={vi.fn()} openGames={2} />);
    expect(screen.getByRole('button', { name: /Weiterspielen/ })).toBeDefined();
  });

  it('zeichnet das Hexfeld als Hintergrund, nicht als Bild', () => {
    const { container } = render(<MenuScreen onChoose={vi.fn()} />);

    // Dasselbe Raster wie im Spiel, mit denselben Funktionen gesetzt.
    const field = container.querySelector('.hexfield');
    expect(field).not.toBeNull();
    expect(field?.querySelectorAll('polygon').length).toBeGreaterThan(50);
  });
});
