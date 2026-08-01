// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ResourceId } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import type { PlayerView } from '../game/view';
import { DiscardDialog } from './DiscardDialog';
import { TradeDialog } from './TradeDialog';

const player: PlayerView = {
  id: 'p1',
  name: 'Spieler 1',
  color: '#c0392b',
  victoryPoints: 2,
  cardCount: 8,
  resources: { brick: 3, lumber: 2, wool: 2, grain: 1, ore: 0 },
  piecesLeft: { road: 13, settlement: 3, city: 4 },
  isCurrent: true,
  mustDiscard: 4,
};

describe('DiscardDialog', () => {
  it('bestaetigt erst, wenn genau die geforderte Zahl gewaehlt ist', async () => {
    const onConfirm = vi.fn();
    render(<DiscardDialog player={player} required={4} onConfirm={onConfirm} />);

    expect(screen.getByRole('button', { name: /Abwerfen/ })).toHaveProperty('disabled', true);

    await userEvent.click(screen.getByLabelText('Lehm mehr'));
    await userEvent.click(screen.getByLabelText('Lehm mehr'));
    await userEvent.click(screen.getByLabelText('Holz mehr'));
    await userEvent.click(screen.getByLabelText('Wolle mehr'));

    expect(screen.getByRole('button', { name: /Abwerfen/ })).toHaveProperty('disabled', false);
    await userEvent.click(screen.getByRole('button', { name: /Abwerfen/ }));

    expect(onConfirm).toHaveBeenCalledWith({ brick: 2, lumber: 1, wool: 1, grain: 0, ore: 0 });
  });

  it('laesst nicht mehr waehlen, als auf der Hand liegt', async () => {
    render(<DiscardDialog player={player} required={4} onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('Korn mehr'));
    await userEvent.click(screen.getByLabelText('Korn mehr'));

    expect(screen.getByTestId('chosen-grain').textContent).toBe('1');
  });
});

describe('TradeDialog', () => {
  it('zeigt den abgeleiteten Kurs und schickt nur die Absicht', async () => {
    const onConfirm = vi.fn();
    const rateFor = (give: ResourceId): number => (give === 'brick' ? 2 : 4);

    render(
      <TradeDialog
        player={player}
        rateFor={rateFor}
        canTrade={(give, receive) => give !== receive}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText('Lehm abgeben'));
    await userEvent.click(screen.getByLabelText('Erz bekommen'));

    expect(screen.getByTestId('rate').textContent).toContain('2:1');
    await userEvent.click(screen.getByRole('button', { name: /Tauschen/ }));

    expect(onConfirm).toHaveBeenCalledWith('brick', 'ore');
  });
});
