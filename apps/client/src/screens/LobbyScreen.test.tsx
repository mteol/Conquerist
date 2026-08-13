// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
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

/** Die Pflichtangaben; jeder Test ergaenzt nur, was er wirklich braucht. */
function lobby(props: Partial<Parameters<typeof LobbyScreen>[0]> = {}) {
  return (
    <LobbyScreen
      room={room}
      youId="u1"
      onStart={vi.fn()}
      onLeave={vi.fn()}
      onConfigure={vi.fn()}
      {...props}
    />
  );
}

describe('Wartebereich', () => {
  it('zeigt Code und beigetretene Sitze', () => {
    render(lobby({ youId: 'u2' }));

    expect(screen.getByText('K7X2')).toBeDefined();
    expect(screen.getByText('Anna')).toBeDefined();
    expect(screen.getByText('Ben')).toBeDefined();
  });

  it('gibt den Startknopf nur dem Host', () => {
    render(lobby({ youId: 'u2' }));
    expect(screen.queryByRole('button', { name: /starten/i })).toBeNull();
    expect(screen.getByText(/Wartet auf Anna/)).toBeDefined();
  });

  it('sperrt den Start, solange Plaetze fehlen, und nennt die Zahl', () => {
    render(lobby());

    const start = screen.getByRole('button', { name: /starten/i });
    expect(start).toHaveProperty('disabled', true);
    expect(screen.getByText(/noch 1/i)).toBeDefined();
  });

  it('gibt den Start frei, wenn der Tisch voll ist', () => {
    const full = {
      ...room,
      seats: [...room.seats, { userId: 'u3', name: 'Cem', color: '#e08a2e', connected: true }],
    };

    render(lobby({ room: full }));
    expect(screen.getByRole('button', { name: /starten/i })).toHaveProperty('disabled', false);
  });

  it('zeichnet jeden fehlenden Platz als leeren Stein in seiner kuenftigen Farbe', () => {
    render(lobby());

    // Der leere Platz ist die Anzeige der Zahl - wer zaehlen will, zaehlt
    // Steine und liest keine Ziffer.
    expect(screen.getAllByTestId('seat-open')).toHaveLength(1);
    expect(screen.getAllByTestId('seat-taken')).toHaveLength(2);
  });

  it('legt dem Host einen Platz dazu - am Tisch selbst', async () => {
    const onConfigure = vi.fn();
    render(lobby({ onConfigure }));

    await userEvent.click(screen.getByRole('button', { name: 'Platz hinzufügen' }));

    expect(onConfigure).toHaveBeenCalledWith(4, 'abc');
  });

  it('nimmt einen Platz weg, solange einer frei ist', async () => {
    const onConfigure = vi.fn();
    render(lobby({ room: { ...room, seatCount: 4 }, onConfigure }));

    await userEvent.click(screen.getByRole('button', { name: 'Platz entfernen' }));

    expect(onConfigure).toHaveBeenCalledWith(3, 'abc');
  });

  it('geht nie unter die kleinste Tischgroesse', () => {
    // Drei Plaetze sind das Minimum - da ist nichts mehr wegzunehmen.
    render(lobby());

    expect(screen.getByRole('button', { name: 'Platz entfernen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('geht nie unter die Zahl derer, die schon sitzen', () => {
    const crowded = {
      ...room,
      seatCount: 4,
      seats: [
        ...room.seats,
        { userId: 'u3', name: 'Cem', color: '#e08a2e', connected: true },
        { userId: 'u4', name: 'Dana', color: '#3f8f5b', connected: true },
      ],
    };

    render(lobby({ room: crowded }));

    // Sonst muesste einer der vier seinen Platz raeumen.
    expect(screen.getByRole('button', { name: 'Platz entfernen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('laesst den Host einen neuen Seed wuerfeln', async () => {
    const onConfigure = vi.fn();
    render(lobby({ onConfigure }));

    await userEvent.click(screen.getByRole('button', { name: 'Neu würfeln' }));

    const [seatCount, seed] = onConfigure.mock.calls[0]!;
    expect(seatCount).toBe(3);
    expect(seed).not.toBe('abc');
    expect(String(seed).length).toBeGreaterThan(0);
  });

  it('gibt niemandem ausser dem Host die Einstellungen in die Hand', () => {
    render(lobby({ youId: 'u2' }));

    expect(screen.queryByRole('button', { name: 'Platz hinzufügen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Neu würfeln' })).toBeNull();
    // Sehen soll sie trotzdem jeder - sonst weiss niemand, worauf er wartet.
    expect(screen.getByText('abc')).toBeDefined();
  });

  it('stellt nichts mehr um, sobald die Partie laeuft', () => {
    render(lobby({ room: { ...room, started: true } }));

    expect(screen.queryByRole('button', { name: 'Platz hinzufügen' })).toBeNull();
  });
});
