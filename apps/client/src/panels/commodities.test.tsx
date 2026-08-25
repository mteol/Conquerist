// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cardAmounts } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { HandPanel } from './HandPanel';
import { ResourceCard } from './ResourceCard';

/**
 * Handelswaren auf der Hand.
 *
 * Die eine Frage, um die es geht: unterscheidet man Holz und Papier im
 * Vorbeisehen? Beide tragen die Farbe des Waldes - der Unterschied muss
 * deshalb in der Flaeche liegen, und der Test fragt nach der Klasse, die ihn
 * traegt, nicht nach der Farbe.
 */
describe('Handelswaren in der Hand', () => {
  function handMit(part: Parameters<typeof cardAmounts>[0]) {
    const resources = cardAmounts(part);
    const total = Object.values(resources).reduce((sum, n) => sum + n, 0);

    render(
      <HandPanel resources={resources} cardCount={total} covered={false} onReveal={vi.fn()} />,
    );
  }

  it('zeigt Papier als eigenen Stapel neben dem Holz', () => {
    handMit({ lumber: 2, paper: 1 });

    expect(screen.getByTestId('stack-lumber')).toBeDefined();
    expect(screen.getByTestId('stack-paper')).toBeDefined();
  });

  it('gibt der Handelsware einen anderen Koerper als dem Rohstoff', () => {
    handMit({ lumber: 2, paper: 1 });

    expect(screen.getByTestId('stack-paper').className).toContain('card--ware');
    expect(screen.getByTestId('stack-lumber').className).not.toContain('card--ware');
  });

  it('nennt sie beim Namen - Farbe ist nie der einzige Traeger', () => {
    handMit({ paper: 1, cloth: 2, coin: 3 });

    expect(screen.getByTestId('stack-paper').title).toBe('Papier');
    expect(screen.getByTestId('stack-cloth').title).toBe('Tuch');
    expect(screen.getByTestId('stack-coin').title).toBe('Münzen');
  });

  it('zaehlt sie in die Handkartenzahl mit - sie zaehlen auch beim Abwerfen', () => {
    handMit({ lumber: 2, paper: 1, coin: 3 });

    expect(screen.getByTestId('hand-total').textContent).toBe('6');
  });

  /*
   * An einem Basistisch liegt keine Handelsware, und was null ist, bekommt
   * keinen Stapel - dieselbe Regel wie fuer einen Rohstoff, von dem man nichts
   * hat.
   */
  it('zeigt keinen leeren Handelswarenstapel', () => {
    handMit({ lumber: 2 });

    expect(screen.queryByTestId('stack-paper')).toBeNull();
    expect(screen.queryByTestId('stack-cloth')).toBeNull();
  });
});

describe('Die Handelsware als Auswahlkarte', () => {
  it('traegt dieselbe Unterscheidung wie in der Hand', () => {
    render(
      <>
        <ResourceCard card="paper" />
        <ResourceCard card="lumber" />
      </>,
    );

    expect(screen.getByTitle('Papier').className).toContain('rescard--ware');
    expect(screen.getByTitle('Holz').className).not.toContain('rescard--ware');
  });
});
