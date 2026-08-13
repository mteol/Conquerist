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
    expect(entries).toEqual([
      'Partie starten — online',
      'Partie starten — lokal',
      'Partie beitreten',
    ]);
  });

  it('meldet, welchen Weg jemand gewaehlt hat', async () => {
    const onChoose = vi.fn();
    render(<MenuScreen onChoose={onChoose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Partie starten — lokal' }));
    expect(onChoose).toHaveBeenCalledWith('local');

    await userEvent.click(screen.getByRole('button', { name: 'Partie beitreten' }));
    expect(onChoose).toHaveBeenCalledWith('join');

    await userEvent.click(screen.getByRole('button', { name: 'Partie starten — online' }));
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

  it('traegt den Titel als gezeichnete Wortmarke, den Namen trotzdem als Text', () => {
    const { container } = render(<MenuScreen onChoose={vi.fn()} />);

    // Die Ueberschrift heisst weiter „Conquerist" - aus Pfaddaten laesst sich
    // kein zugaenglicher Name ableiten, also steht er unsichtbar daneben.
    const heading = screen.getByRole('heading', { name: 'Conquerist' });
    expect(heading.querySelector('.wordmark--enter')).not.toBeNull();
    expect(container.querySelectorAll('.wordmark__letter').length).toBe(10);
  });

  it('laesst den Aufprall von innen nach aussen laufen, nicht ueberall zugleich', () => {
    const { container } = render(<MenuScreen onChoose={vi.fn()} />);

    const delays = [...container.querySelectorAll<HTMLElement>('.hexfield polygon')].map((hex) =>
      Number.parseInt(hex.style.animationDelay, 10),
    );

    // Das mittlere Hex wird zuerst erreicht, das aeusserste zuletzt. Waeren
    // alle Verzoegerungen gleich, blinkte die Flaeche statt zu schwingen.
    expect(Math.min(...delays)).toBeLessThan(Math.max(...delays));
    expect(new Set(delays).size).toBeGreaterThan(3);

    // Und jedes Hex kennt seine Ruhelage - die Welle beginnt und endet dort,
    // wo das Hex ohnehin liegt. Ohne `--rest` faellt es danach auf null.
    const first = container.querySelector<HTMLElement>('.hexfield polygon');
    expect(Number(first?.style.getPropertyValue('--rest'))).toBeGreaterThan(0);
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
