// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test/dom';
import { LobbyScreen } from './LobbyScreen';

const room = {
  code: 'K7X2',
  hostId: 'u1',
  seatCount: 3,
  seed: 'abc',
  started: false,
  seats: [
    { userId: 'u1', name: 'Anna', color: '#c0392b', connected: true },
    { userId: 'u2', name: 'Ben', color: '#2c6fbb', connected: true },
  ],
};

describe('Wartebereich', () => {
  it('zeigt Code und beigetretene Sitze', () => {
    render(<LobbyScreen room={room} youId="u2" onStart={vi.fn()} onLeave={vi.fn()} />);

    expect(screen.getByText('K7X2')).toBeDefined();
    expect(screen.getByText('Anna')).toBeDefined();
    expect(screen.getByText('Ben')).toBeDefined();
  });

  it('gibt den Startknopf nur dem Host', () => {
    render(<LobbyScreen room={room} youId="u2" onStart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /starten/i })).toBeNull();
    expect(screen.getByText(/Wartet auf Anna/)).toBeDefined();
  });

  it('sperrt den Start, solange Plaetze fehlen, und nennt die Zahl', () => {
    render(<LobbyScreen room={room} youId="u1" onStart={vi.fn()} onLeave={vi.fn()} />);

    const start = screen.getByRole('button', { name: /starten/i });
    expect(start).toHaveProperty('disabled', true);
    expect(screen.getByText(/noch 1/i)).toBeDefined();
  });

  it('gibt den Start frei, wenn der Tisch voll ist', () => {
    const full = {
      ...room,
      seats: [...room.seats, { userId: 'u3', name: 'Cem', color: '#e08a2e', connected: true }],
    };

    render(<LobbyScreen room={full} youId="u1" onStart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /starten/i })).toHaveProperty('disabled', false);
  });

  it('zeichnet jeden fehlenden Platz als leeren Stein in seiner kuenftigen Farbe', () => {
    render(<LobbyScreen room={room} youId="u1" onStart={vi.fn()} onLeave={vi.fn()} />);

    // Der leere Platz ist die Anzeige der Zahl - wer zaehlen will, zaehlt
    // Steine und liest keine Ziffer.
    expect(screen.getAllByTestId('seat-open')).toHaveLength(1);
    expect(screen.getAllByTestId('seat-taken')).toHaveLength(2);
  });
});
