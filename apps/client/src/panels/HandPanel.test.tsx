// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ResourceAmounts } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { HandPanel } from './HandPanel';

const hand: ResourceAmounts = { brick: 2, lumber: 3, wool: 0, grain: 1, ore: 0 };

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
    const empty: ResourceAmounts = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
    render(<HandPanel resources={empty} cardCount={0} covered={false} onReveal={vi.fn()} />);

    expect(screen.getByText(/Keine Karten/)).toBeDefined();
  });

  it('zeigt fremde Haende gar nicht erst an', () => {
    // `resources === null` heisst seit Etappe 5 „gehoert jemand anderem".
    const { container } = render(
      <HandPanel resources={null} cardCount={4} covered={false} onReveal={vi.fn()} />,
    );

    expect(container.querySelector('.hand')).toBeNull();
  });
});
