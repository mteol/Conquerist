// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../test/dom';
import { StartScreen, blueprintsFor } from './StartScreen';

describe('Startbildschirm', () => {
  it('bietet je Tischgroesse nur die Bretter an, die sie tragen', () => {
    expect(blueprintsFor(3).map((blueprint) => blueprint.id)).toEqual(['classic34']);
    expect(blueprintsFor(4).map((blueprint) => blueprint.id)).toEqual(['classic34']);
    expect(blueprintsFor(6).map((blueprint) => blueprint.id)).toEqual(['classic56']);
  });

  it('zeigt eine Namenszeile je Spieler und passt sie der Tischgroesse an', async () => {
    render(<StartScreen onStartLocal={vi.fn()} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    expect(screen.getAllByLabelText(/^Name von Spieler/)).toHaveLength(3);

    await userEvent.click(screen.getByLabelText('6 Spieler'));
    expect(screen.getAllByLabelText(/^Name von Spieler/)).toHaveLength(6);
  });

  it('zeigt das Brett, das gespielt wird - und wechselt es mit der Tischgroesse', async () => {
    render(<StartScreen onStartLocal={vi.fn()} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    // Basisbrett: 19 Felder. Die Vorschau ist kein Bild, sondern dasselbe
    // Brett, das `createGame` gleich bekommt.
    expect(screen.getAllByTestId(/^hex-/)).toHaveLength(19);

    await userEvent.click(screen.getByLabelText('6 Spieler'));
    expect(screen.getAllByTestId(/^hex-/)).toHaveLength(30);
  });

  it('zeichnet zu einem anderen Seed ein anderes Brett', async () => {
    render(<StartScreen onStartLocal={vi.fn()} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    const terrainOf = (): string =>
      screen
        .getAllByTestId(/^hex-/)
        .map((hex) => hex.getAttribute('fill'))
        .join('');

    const seed = screen.getByLabelText('Seed');
    await userEvent.clear(seed);
    await userEvent.type(seed, 'brett-eins');
    const first = terrainOf();

    await userEvent.clear(seed);
    await userEvent.type(seed, 'brett-zwei');

    expect(terrainOf()).not.toBe(first);
  });

  it('startet eine Partie mit den eingetragenen Namen', async () => {
    const onStart = vi.fn();
    render(<StartScreen onStartLocal={onStart} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    const firstName = screen.getAllByLabelText(/^Name von Spieler/)[0]!;
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Anna');
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    const [game, seats] = onStart.mock.calls[0]!;
    expect(seats[0].name).toBe('Anna');
    expect(game.players).toHaveLength(3);
    expect(game.phase.kind).toBe('setup');
  });

  it('baut aus demselben Seed dasselbe Brett', async () => {
    const onStart = vi.fn();
    render(<StartScreen onStartLocal={onStart} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    const seed = screen.getByLabelText('Seed');
    await userEvent.clear(seed);
    await userEvent.type(seed, 'immer-gleich');
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));

    const [first] = onStart.mock.calls[0]!;
    const [second] = onStart.mock.calls[1]!;
    expect(first.scenario).toEqual(second.scenario);
  });

  it('laesst waehlen, ob die Hand zwischen den Zuegen zugedeckt wird', async () => {
    const onStart = vi.fn();
    render(<StartScreen onStartLocal={onStart} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    // Voreingestellt zugedeckt: am selben Geraet ist das die vorsichtigere
    // Annahme, und wer offen spielen will, sagt es einmal.
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));
    expect(onStart.mock.calls[0]![2]).toEqual({ concealBetweenTurns: true });

    await userEvent.click(screen.getByLabelText(/offen liegen lassen/i));
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));
    expect(onStart.mock.calls[1]![2]).toEqual({ concealBetweenTurns: false });
  });

  it('haelt die Diagnose aus Etappe 0 zugeklappt bereit', () => {
    render(<StartScreen onStartLocal={vi.fn()} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    // Zugeklappt heisst: kein Verbindungsaufbau. Der Ping-Knopf existiert erst,
    // wenn man das Feld oeffnet.
    expect(screen.queryByRole('button', { name: /Ping/ })).toBeNull();
    expect(screen.getByText(/Verbindung und Diagnose/)).toBeDefined();
  });

  it('zeigt die eigenen Partien und fuehrt mit einem Klick zurueck', async () => {
    const onResume = vi.fn();
    render(
      <StartScreen
        onStartLocal={vi.fn()}
        onCreateRoom={vi.fn()}
        onJoinRoom={vi.fn()}
        onResume={onResume}
        myRooms={[
          {
            code: 'K7X2',
            seatCount: 3,
            started: true,
            turn: 4,
            yourTurn: true,
            seats: [
              { name: 'Anna', color: '#c0392b', connected: true },
              { name: 'Ben', color: '#2c6fbb', connected: false },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('K7X2')).toBeDefined();
    expect(screen.getByText(/du bist dran/i)).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: /Zurück/ }));
    expect(onResume).toHaveBeenCalledWith('K7X2');
  });

  it('nennt bei einem Wartebereich, wie viele noch fehlen', () => {
    render(
      <StartScreen
        onStartLocal={vi.fn()}
        onCreateRoom={vi.fn()}
        onJoinRoom={vi.fn()}
        onResume={vi.fn()}
        myRooms={[
          {
            code: 'M8Y3',
            seatCount: 4,
            started: false,
            seats: [{ name: 'Dana', color: '#c0392b', connected: true }],
          },
        ]}
      />,
    );

    expect(screen.getByText(/1 von 4/)).toBeDefined();
  });

  it('laesst den Bereich ganz weg, wenn es keine eigenen Partien gibt', () => {
    render(
      <StartScreen
        onStartLocal={vi.fn()}
        onCreateRoom={vi.fn()}
        onJoinRoom={vi.fn()}
        onResume={vi.fn()}
        myRooms={[]}
      />,
    );

    expect(screen.queryByText(/Deine Partien/i)).toBeNull();
  });
});
