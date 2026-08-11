// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test/dom';
import { AccountCorner } from './AccountCorner';

const gast = { userId: 'u1', name: 'Gast', isGuest: true };
const konto = { userId: 'u2', name: 'Anna', isGuest: false, login: 'anna' };

describe('Konto-Ecke', () => {
  it('bietet dem Gast beide Wege an', () => {
    render(
      <AccountCorner identity={gast} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Konto anlegen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
  });

  it('zeigt dem Angemeldeten seinen Namen und nur das Abmelden', () => {
    render(
      <AccountCorner identity={konto} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByText('Anna')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Anmelden' })).toBeNull();
  });

  it('haelt sich zurueck, solange niemand feststeht', () => {
    // Vor dem ersten `hello` waere jede Aussage geraten - und ein „Gast", der
    // eine Sekunde spaeter zu „Anna" wird, ist ein Flackern.
    const { container } = render(
      <AccountCorner identity={null} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(container.querySelector('.corner')).toBeNull();
  });
});
