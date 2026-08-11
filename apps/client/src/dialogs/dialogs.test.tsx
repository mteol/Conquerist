// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ResourceId } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import type { PlayerRow } from '../game/view';
import { AccountDialog } from './AccountDialog';
import { DiscardDialog } from './DiscardDialog';
import { TradeDialog } from './TradeDialog';

const player: PlayerRow = {
  id: 'p1',
  name: 'Spieler 1',
  color: '#c0392b',
  victoryPoints: 2,
  cardCount: 8,
  resources: { brick: 3, lumber: 2, wool: 2, grain: 1, ore: 0 },
  piecesLeft: { road: 13, settlement: 3, city: 4 },
  developmentCards: [],
  developmentCount: 0,
  playedKnights: 0,
  isCurrent: true,
  connected: true,
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

describe('AccountDialog', () => {
  it('fragt beim Anlegen zusaetzlich nach der freiwilligen E-Mail', () => {
    render(
      <AccountDialog
        mode="register"
        openGuestGames={0}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/E-Mail/)).toBeTruthy();
  });

  it('fragt beim Anmelden nicht nach der E-Mail', () => {
    render(
      <AccountDialog
        mode="login"
        openGuestGames={0}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/E-Mail/)).toBeNull();
  });

  it('warnt vor dem Anmelden, wenn als Gast noch Partien offen sind', () => {
    render(
      <AccountDialog
        mode="login"
        openGuestGames={2}
        problem={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 offene Partien/)).toBeTruthy();
  });

  it('schickt die Bestaetigung mit, wenn gewarnt wurde', async () => {
    const onSubmit = vi.fn();
    render(
      <AccountDialog
        mode="login"
        openGuestGames={2}
        problem={null}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Benutzername/), 'anna');
    await userEvent.type(screen.getByLabelText(/Passwort/), 'langgenug1');
    await userEvent.click(screen.getByRole('button', { name: 'Trotzdem anmelden' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ login: 'anna', confirmAbandonGuest: true }),
    );
  });

  it('zeigt die Absage des Servers, statt sie zu verschlucken', () => {
    render(
      <AccountDialog
        mode="register"
        openGuestGames={0}
        problem="Dieser Benutzername ist vergeben."
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Dieser Benutzername ist vergeben.')).toBeTruthy();
  });
});
