// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '../test/dom';
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
    await neuTippen(seed, 'brett-eins');
    const first = terrainOf();

    await neuTippen(seed, 'brett-zwei');

    expect(terrainOf()).not.toBe(first);
  });

  it('startet eine Partie mit den eingetragenen Namen', async () => {
    const onStart = vi.fn();
    render(<StartScreen onStartLocal={onStart} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    const firstName = screen.getAllByLabelText(/^Name von Spieler/)[0]!;
    await neuTippen(firstName, 'Anna');
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    const [game, seats] = onStart.mock.calls[0]!;
    expect(seats[0].name).toBe('Anna');
    expect(game.players).toHaveLength(3);
    // Eine Partie beginnt seit dem Auftakt nicht mehr in der Gruendung: erst
    // wird ausgewuerfelt, wer anfaengt.
    expect(game.phase.kind).toBe('opening');
  });

  it('baut aus demselben Seed dasselbe Brett', async () => {
    const onStart = vi.fn();
    render(<StartScreen onStartLocal={onStart} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} />);

    const seed = screen.getByLabelText('Seed');
    await neuTippen(seed, 'immer-gleich');
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

/**
 * Ein Feld leeren und neu beschreiben - in **einer** Sitzung und ohne Verzoegerung.
 *
 * Hier stand dreimal `userEvent.clear(feld)` gefolgt von `userEvent.type(...)`,
 * und das ist unter Last kaputtgegangen: zwei von drei vollen Laeufen fielen,
 * mal der eine Test, mal der andere, mit Werten wie `"weiAnna"` und
 * `"eiAnna"` - Restzeichen aus einem **vorherigen** Tippvorgang (`brett-zwei`),
 * die verspaetet im naechsten Feld landeten.
 *
 * Zwei Ursachen greifen ineinander. Erstens legt die Direkt-API von user-event
 * fuer **jeden** Aufruf eine neue Sitzung an; `clear` und `type` teilen deshalb
 * keinen Zustand, und was die eine an Tastendruecken noch in der Schlange hat,
 * weiss die andere nicht. Zweitens setzt user-event zwischen Tastendruecke
 * echte Verzoegerungen - auf einer ruhigen Maschine unsichtbar, unter 35
 * parallel laufenden Testdateien nicht mehr.
 *
 * Eine gemeinsame Sitzung mit `delay: null` nimmt beides weg. **Der Fehler war
 * schon vor dieser Etappe da** und ist nur aufgefallen, weil neue Tests die
 * Last erhoeht haben - gemessen auf dem Stand davor, ohne die Aenderungen am
 * Brett.
 */
async function neuTippen(feld: HTMLElement, text: string): Promise<void> {
  const user = userEvent.setup({ delay: null });

  await user.clear(feld);
  await user.type(feld, text);

  /*
   * **Und dann warten, bis der Wert wirklich dasteht.** Die gemeinsame Sitzung
   * allein hat den Fehler nur seltener gemacht (einer von vier Laeufen statt
   * zwei von drei), weil hier ein zweiter Grund mitwirkt: das Feld ist
   * kontrolliert, sein Wert kommt aus dem React-Zustand **zurueck**. Wer
   * unmittelbar nach dem Tippen das Brett ausliest, liest im Zweifel das von
   * vorher - und `zeichnet zu einem anderen Seed ein anderes Brett` vergleicht
   * dann zweimal dasselbe und meldet einen Fehler, den es nicht gibt.
   *
   * Der Wert im Feld ist dafuer die richtige Sonde: er stammt aus demselben
   * Zustandswechsel wie das Brett. Steht er, ist auch alles neu gezeichnet,
   * was am Seed haengt.
   */
  await waitFor(() => {
    expect((feld as HTMLInputElement).value).toBe(text);
  });
}
