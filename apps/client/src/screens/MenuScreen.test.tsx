// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { MenuScreen } from './MenuScreen';

describe('Hauptmenue', () => {
  it('traegt den Titel und die drei Wege in dieser Reihenfolge', () => {
    render(<MenuScreen onChoose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Conquerist' })).toBeDefined();

    // Ein Wort durch den ganzen Ablauf: „Partie", wie ueberall sonst (Regel 8).
    const entries = screen.getAllByRole('button').map((node) => node.textContent);
    expect(entries).toEqual(['Online spielen', 'An einem Gerät spielen', 'Partie beitreten']);
  });

  it('meldet, welchen Weg jemand gewaehlt hat', async () => {
    const onChoose = vi.fn();
    render(<MenuScreen onChoose={onChoose} />);

    await userEvent.click(screen.getByRole('button', { name: 'An einem Gerät spielen' }));
    expect(onChoose).toHaveBeenCalledWith('local');

    await userEvent.click(screen.getByRole('button', { name: 'Partie beitreten' }));
    expect(onChoose).toHaveBeenCalledWith('join');

    await userEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    expect(onChoose).toHaveBeenCalledWith('online');
  });

  it('zeigt die eigenen Partien nur, wenn es welche gibt', () => {
    const { rerender } = render(<MenuScreen onChoose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Weiterspielen/ })).toBeNull();

    rerender(<MenuScreen onChoose={vi.fn()} openGames={2} />);
    expect(screen.getByRole('button', { name: /Weiterspielen/ })).toBeDefined();
  });

  it('legt die Seekarte als Hintergrund, nicht ein Hexfeld', () => {
    const { container } = render(<MenuScreen onChoose={vi.fn()} />);

    // Das Windstrahlennetz mit seiner Windrose - auf jedem Bildschirm dieselbe.
    expect(container.querySelector('.seachart')).not.toBeNull();
    expect(container.querySelector('.seachart__rose')).not.toBeNull();
    expect(container.querySelector('.hexfield')).toBeNull();
  });

  it('traegt den Titel als gezeichnete Wortmarke, den Namen trotzdem als Text', () => {
    const { container } = render(<MenuScreen onChoose={vi.fn()} />);

    // Die Ueberschrift heisst weiter „Conquerist" - aus Pfaddaten laesst sich
    // kein zugaenglicher Name ableiten, also steht er unsichtbar daneben.
    const heading = screen.getByRole('heading', { name: 'Conquerist' });
    expect(heading.querySelector('.wordmark--enter')).not.toBeNull();
    expect(container.querySelectorAll('.wordmark__letter').length).toBe(10);
  });

  it('traegt den Abstand zur Mitte an jeder Linie - daran haengt die Welle', () => {
    const { container } = render(<MenuScreen onChoose={vi.fn()} />);

    // Dieselbe Karte wie im Spiel. Die Welle laeuft von innen nach aussen,
    // weil jede Linie ihren Abstand `--d` (0..1) kennt; ohne ihn gaebe es
    // nichts, woraus eine Verzoegerung zu rechnen waere.
    const lines = [...container.querySelectorAll<SVGElement>('.seachart__line')];
    expect(lines.length).toBeGreaterThan(50);

    const distances = lines.map((line) => Number(line.style.getPropertyValue('--d')));
    expect(Math.min(...distances)).toBeLessThan(0.3);
    expect(Math.max(...distances)).toBeGreaterThan(0.5);
    expect(new Set(distances).size).toBeGreaterThan(3);
  });

  it('gibt jedem Weg seinen Platz in der Reihe, auch mit Weiterspielen davor', () => {
    const { container, rerender } = render(<MenuScreen onChoose={vi.fn()} />);
    const order = () =>
      [...container.querySelectorAll<HTMLElement>('.menu__entry')].map((entry) =>
        entry.style.getPropertyValue('--i'),
      );

    expect(order()).toEqual(['0', '1', '2']);

    // „Weiterspielen" rueckt vor die drei Wege und schiebt sie eine Stufe
    // weiter - sonst fielen zwei Eintraege gleichzeitig.
    rerender(<MenuScreen onChoose={vi.fn()} openGames={2} />);
    expect(order()).toEqual(['0', '1', '2', '3']);
  });

  it('zeigt die Konto-Ecke ueber den drei Wegen', () => {
    render(
      <MenuScreen
        openGames={0}
        onChoose={vi.fn()}
        identity={{ userId: 'u1', name: 'Gast', isGuest: true }}
        onRegister={vi.fn()}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
  });

  it('laesst die Ecke zuletzt einfallen - nach den drei Wegen', () => {
    const { container } = render(
      <MenuScreen
        openGames={0}
        onChoose={vi.fn()}
        identity={{ userId: 'u1', name: 'Gast', isGuest: true }}
        onRegister={vi.fn()}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    const corner = container.querySelector('.corner') as HTMLElement;
    const last = [...container.querySelectorAll('.menu__entry')].at(-1) as HTMLElement;

    expect(Number(corner.style.getPropertyValue('--i'))).toBeGreaterThan(
      Number(last.style.getPropertyValue('--i')),
    );
  });
});
