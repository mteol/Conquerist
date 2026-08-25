// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cardAmounts, type ResourceAmounts } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { HandPanel } from './HandPanel';

const hand: ResourceAmounts = cardAmounts({ brick: 2, lumber: 3, wool: 0, grain: 1, ore: 0 });

describe('Handkarten', () => {
  it('zeigt je Ressource einen Stapel mit seiner Anzahl', () => {
    render(<HandPanel resources={hand} cardCount={6} covered={false} onReveal={vi.fn()} />);

    expect(screen.getByTestId('stack-brick').textContent).toContain('2');
    expect(screen.getByTestId('stack-lumber').textContent).toContain('3');
    expect(screen.getByTestId('stack-grain').textContent).toContain('1');
  });

  it('laesst leere Ressourcen ganz weg, statt eine Null zu zeigen', () => {
    render(<HandPanel resources={hand} cardCount={6} covered={false} onReveal={vi.fn()} />);

    // Eine Null ist eine Karte, die es nicht gibt - sie kostet Platz und sagt
    // nichts, was das Fehlen des Stapels nicht schon saegt.
    expect(screen.queryByTestId('stack-wool')).toBeNull();
    expect(screen.queryByTestId('stack-ore')).toBeNull();
  });

  it('nennt die Gesamtzahl, damit das Handkartenlimit ablesbar bleibt', () => {
    render(<HandPanel resources={hand} cardCount={6} covered={false} onReveal={vi.fn()} />);

    expect(screen.getByTestId('hand-total').textContent).toContain('6');
  });

  it('gibt zugedeckt nichts preis - auch nicht, welche Ressourcen es sind', () => {
    render(<HandPanel resources={hand} cardCount={6} covered onReveal={vi.fn()} />);

    expect(screen.queryByTestId('stack-brick')).toBeNull();
    expect(screen.queryByTestId('stack-lumber')).toBeNull();
    // Die Anzahl darf stehen: sie ist am Tisch ohnehin abzaehlbar.
    expect(screen.getByTestId('hand-total').textContent).toContain('6');
  });

  it('deckt auf Wunsch auf', async () => {
    const onReveal = vi.fn();
    render(<HandPanel resources={hand} cardCount={6} covered onReveal={onReveal} />);

    await userEvent.click(screen.getByRole('button', { name: 'Karten ansehen' }));

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('sagt es, wenn die Hand leer ist, statt eine leere Flaeche zu zeigen', () => {
    const empty: ResourceAmounts = cardAmounts({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 });
    render(<HandPanel resources={empty} cardCount={0} covered={false} onReveal={vi.fn()} />);

    expect(screen.getByText(/Keine Karten/)).toBeDefined();
  });

  /**
   * Der Stapelversatz kommt als Zahl und nicht als fertige Verschiebung.
   *
   * **Der Grund ist eine Falle, die schon zugeschnappt ist** - in der anderen
   * Richtung: in `CLAUDE.md` steht, dass eine CSS-Regel ein gleichnamiges
   * SVG-Attribut schlaegt. Hier gewinnt der Inline-Stil, das Ergebnis ist
   * dasselbe: eine Regel, die im Blatt steht und nie greift. Ein
   * `transform: translateY(...)` am `style` haette die Faecherung beim
   * Darueberfahren stillgelegt - sie waere gelaufen, haette aber nichts
   * bewirkt, und niemand haette gesehen, woran es liegt.
   *
   * Geprueft wird deshalb genau die Grenze: die Karte sagt, **wo** sie im
   * Stapel liegt, das Blatt entscheidet, **was** daraus wird.
   */
  it('laesst dem Blatt die Verschiebung und gibt nur die Lage im Stapel', () => {
    const { container } = render(
      <HandPanel resources={hand} cardCount={6} covered={false} onReveal={vi.fn()} />,
    );

    const behind = [...container.querySelectorAll<HTMLElement>('.card__behind')];
    expect(behind.length).toBeGreaterThan(0);

    for (const card of behind) {
      expect(card.style.getPropertyValue('--i'), 'die Lage im Stapel fehlt').not.toBe('');
      expect(card.style.transform, 'ein Inline-transform schlaegt jede Faecherregel im Blatt').toBe(
        '',
      );
    }

    // Und die Lagen zaehlen von unten nach oben durch, statt alle gleich zu sein.
    const lagen = [
      ...container.querySelectorAll<HTMLElement>('[data-testid="stack-lumber"] .card__behind'),
    ].map((card) => Number(card.style.getPropertyValue('--i')));
    expect(lagen).toEqual([1, 2]);
  });

  it('zeigt fremde Haende gar nicht erst an', () => {
    // `resources === null` heisst seit Etappe 5 „gehoert jemand anderem".
    const { container } = render(
      <HandPanel resources={null} cardCount={4} covered={false} onReveal={vi.fn()} />,
    );

    expect(container.querySelector('.hand')).toBeNull();
  });
});
