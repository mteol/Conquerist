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
        canOffer={false}
        onOffer={vi.fn()}
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

  /*
   * Der Weg zurueck aus einem versehentlich geoeffneten Fenster - gemeldet aus
   * dem ersten Playtest. Zwei Wege, weil beide fehlen koennen: die Maus findet
   * das Kreuz, die Tastatur die Taste.
   */
  it('schliesst sich ueber das Kreuz in der Ecke', async () => {
    const onClose = vi.fn();
    render(
      <TradeDialog
        player={player}
        rateFor={() => 4}
        canTrade={() => true}
        canOffer={false}
        onOffer={vi.fn()}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByTestId('modal-close'));

    expect(onClose).toHaveBeenCalled();
  });

  it('schliesst sich mit Escape', async () => {
    const onClose = vi.fn();
    render(
      <TradeDialog
        player={player}
        rateFor={() => 4}
        canTrade={() => true}
        canOffer={false}
        onOffer={vi.fn()}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
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

  it('schickt keine Bestaetigung mit, wenn gar nicht gewarnt wurde', async () => {
    const onSubmit = vi.fn();
    render(
      <AccountDialog
        mode="login"
        openGuestGames={0}
        problem={null}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Benutzername/), 'anna');
    await userEvent.type(screen.getByLabelText(/Passwort/), 'langgenug1');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    // Nicht nur "confirmAbandonGuest ist nicht true" - der Schluessel darf
    // im gesendeten Objekt gar nicht erst auftauchen. `objectContaining`
    // (auch negiert) prueft Abwesenheit korrekt; ein fest verdrahtetes
    // `confirmAbandonGuest: true` wuerde diesen Test rot werden lassen.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ confirmAbandonGuest: expect.anything() }),
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

describe('TradeDialog, Reiter Spieler', () => {
  const props = {
    player,
    rateFor: () => 4,
    canTrade: () => true,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  it('zeigt die Reiter nicht, wenn kein Angebot moeglich waere', () => {
    render(<TradeDialog {...props} canOffer={false} onOffer={vi.fn()} />);

    expect(screen.queryByRole('tab', { name: 'Spieler' })).toBeNull();
  });

  it('schickt die gewaehlten Mengen hinaus', async () => {
    const onOffer = vi.fn();
    render(<TradeDialog {...props} canOffer onOffer={onOffer} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spieler' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lehm mehr anbieten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Erz mehr verlangen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' }));

    expect(onOffer).toHaveBeenCalledWith(
      { brick: 1, lumber: 0, wool: 0, grain: 0, ore: 0 },
      { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
    );
  });

  it('haelt den Knopf gesperrt, solange eine Seite leer ist', async () => {
    render(<TradeDialog {...props} canOffer onOffer={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spieler' }));
    expect(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' })).toHaveProperty(
      'disabled',
      true,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Lehm mehr anbieten' }));
    expect(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('sperrt den Knopf, wenn dieselbe Sorte auf beiden Seiten stuende', async () => {
    render(<TradeDialog {...props} canOffer onOffer={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spieler' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lehm mehr anbieten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lehm mehr verlangen' }));

    expect(screen.getByRole('button', { name: 'Angebot auf den Tisch legen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('gibt nicht mehr her, als auf der Hand liegt', async () => {
    render(<TradeDialog {...props} canOffer onOffer={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spieler' }));
    // Der Spieler haelt kein Erz.
    await userEvent.click(screen.getByRole('button', { name: 'Erz mehr anbieten' }));

    expect(screen.getByTestId('give-ore').textContent).toBe('0');
  });
});
