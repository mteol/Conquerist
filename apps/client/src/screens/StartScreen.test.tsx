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
    render(<StartScreen initialWay="local" onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

    expect(screen.getAllByLabelText(/^Name von Spieler/)).toHaveLength(3);

    await userEvent.click(screen.getByLabelText('6 Spieler'));
    expect(screen.getAllByLabelText(/^Name von Spieler/)).toHaveLength(6);
  });

  it('zeigt das Brett, das gespielt wird - und wechselt es mit der Tischgroesse', async () => {
    render(<StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

    // Basisbrett: 19 Felder. Die Vorschau ist kein Bild, sondern dasselbe
    // Brett, das `createGame` gleich bekommt.
    expect(screen.getAllByTestId(/^hex-/)).toHaveLength(19);

    await userEvent.click(screen.getByLabelText('6 Spieler'));
    expect(screen.getAllByTestId(/^hex-/)).toHaveLength(30);
  });

  it('zeichnet zu einem anderen Seed ein anderes Brett', async () => {
    render(<StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

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
    render(<StartScreen initialWay="local" onStartLocal={onStart} onJoinRoom={vi.fn()} />);

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
    render(<StartScreen initialWay="local" onStartLocal={onStart} onJoinRoom={vi.fn()} />);

    const seed = screen.getByLabelText('Seed');
    await neuTippen(seed, 'immer-gleich');
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));

    const [first] = onStart.mock.calls[0]!;
    const [second] = onStart.mock.calls[1]!;
    expect(first.scenario).toEqual(second.scenario);
  });

  /**
   * Die Frage nach den Handkarten stellt der Bildschirm nicht mehr.
   *
   * Sie war die letzte Auswahl im Spiel, die wie ein Formular aussah - zwei
   * nackte Optionsfelder unter lauter gezeichneten Kacheln. Zugedeckt war
   * ohnehin die Vorgabe und ist dieselbe Regel, nach der online gespielt wird;
   * uebrig bleibt sie als feste Zusage in `App.tsx`.
   *
   * Der Test bleibt stehen, weil ein weggelassenes Bedienelement nichts
   * kaputtmacht: es kommt beim naechsten Umbau einfach wieder, und niemand
   * merkt es.
   */
  it('fragt nicht mehr, ob die Hand zwischen den Zuegen zugedeckt wird', () => {
    render(<StartScreen initialWay="local" onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

    expect(screen.queryByText(/Handkarten/i)).toBeNull();
    expect(screen.queryByLabelText(/offen liegen lassen/i)).toBeNull();
  });

  it('haelt die Diagnose aus Etappe 0 zugeklappt bereit', () => {
    render(<StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

    // Zugeklappt heisst: kein Verbindungsaufbau. Der Ping-Knopf existiert erst,
    // wenn man das Feld oeffnet.
    expect(screen.queryByRole('button', { name: /Ping/ })).toBeNull();
    expect(screen.getByText(/Verbindung und Diagnose/)).toBeDefined();
  });

  it('zeigt die eigenen Partien und fuehrt mit einem Klick zurueck', async () => {
    const onResume = vi.fn();
    render(
      <StartScreen
        initialWay="resume"
        onStartLocal={vi.fn()}
        onJoinRoom={vi.fn()}
        onResume={onResume}
        myRooms={[
          {
            code: 'K7X2',
            seatCount: 3,
            started: true,
            deletable: false,
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
        initialWay="resume"
        onStartLocal={vi.fn()}
        onJoinRoom={vi.fn()}
        onResume={vi.fn()}
        myRooms={[
          {
            code: 'M8Y3',
            seatCount: 4,
            started: false,
            deletable: false,
            seats: [{ name: 'Dana', color: '#c0392b', connected: true }],
          },
        ]}
      />,
    );

    expect(screen.getByText(/1 von 4/)).toBeDefined();
  });

  /**
   * Aussteigen von der Karte aus.
   *
   * Der Weg zurueck in eine Partie war da, der Weg heraus nicht - und genau das
   * war die Sackgasse: wer den Tab zumachte, kam beim naechsten Besuch in
   * dieselbe Partie zurueck und von dort nirgendwohin.
   */
  it('bricht eine laufende Partie erst nach einer Rueckfrage ab', async () => {
    const onAbandon = vi.fn();
    render(
      <StartScreen
        initialWay="resume"
        onStartLocal={vi.fn()}
        onJoinRoom={vi.fn()}
        onResume={vi.fn()}
        onAbandon={onAbandon}
        myRooms={[
          {
            code: 'K7X2',
            seatCount: 3,
            started: true,
            deletable: false,
            turn: 4,
            seats: [{ name: 'Anna', color: '#c0392b', connected: true }],
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Partie abbrechen' }));

    // Erst die Folge, dann die Entscheidung - und noch ist nichts passiert.
    expect(screen.getByText(/für alle am Tisch vorbei/)).toBeDefined();
    expect(onAbandon).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Ja, abbrechen' }));
    expect(onAbandon).toHaveBeenCalledWith('K7X2');
  });

  /**
   * Loeschen statt abbrechen.
   *
   * Ob es erlaubt ist, steht in `deletable` und kommt vom Server - der
   * Bildschirm rechnet nicht nach, wem der Tisch gehoert und wer noch daran
   * sitzt.
   */
  it('bietet dem Gastgeber Loeschen an, wo alle gegangen sind', async () => {
    const onAbandon = vi.fn();
    const onDelete = vi.fn();
    render(
      <StartScreen
        initialWay="resume"
        onStartLocal={vi.fn()}
        onJoinRoom={vi.fn()}
        onResume={vi.fn()}
        onAbandon={onAbandon}
        onDelete={onDelete}
        myRooms={[
          {
            code: 'K7X2',
            deletable: true,
            seatCount: 3,
            started: true,
            turn: 4,
            seats: [{ name: 'Anna', color: '#c0392b', connected: true }],
          },
        ]}
      />,
    );

    // Nicht neben „Partie abbrechen", sondern an dessen Stelle: zwei
    // Ausgaenge nebeneinander laden dazu ein, den falschen zu treffen.
    expect(screen.queryByRole('button', { name: 'Partie abbrechen' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Partie löschen' }));
    expect(screen.getByText(/kommt nicht wieder/)).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Ja, löschen' }));
    expect(onDelete).toHaveBeenCalledWith('K7X2');
    expect(onAbandon).not.toHaveBeenCalled();
  });

  it('laesst die Rueckfrage zurueckziehen', async () => {
    const onAbandon = vi.fn();
    render(
      <StartScreen
        initialWay="resume"
        onStartLocal={vi.fn()}
        onJoinRoom={vi.fn()}
        onResume={vi.fn()}
        onAbandon={onAbandon}
        myRooms={[
          {
            code: 'M8Y3',
            seatCount: 4,
            started: false,
            deletable: false,
            seats: [{ name: 'Dana', color: '#c0392b', connected: true }],
          },
        ]}
      />,
    );

    // Im Wartebereich wird nur ein Platz frei - und das steht auch da.
    await userEvent.click(screen.getByRole('button', { name: 'Tisch verlassen' }));
    expect(screen.getByText(/Platz an diesem Tisch wird wieder frei/)).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Doch nicht' }));

    expect(onAbandon).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tisch verlassen' })).toBeDefined();
  });

  /**
   * Der Vorrat gehoert zur Tischgroesse, nicht zum Brett.
   *
   * Der Bildschirm reicht seine Vorschau als fertigen Spielstand an
   * `onStartLocal` weiter - was hier an Karten drinsteht, ist das, womit am
   * Kuechentisch gespielt wird. Bis hierher bekam auch der Sechsertisch den
   * Stapel der Viererpartie.
   */
  it('gibt der lokalen Sechserpartie den Vorrat ihrer Tischgroesse', async () => {
    const onStartLocal = vi.fn();
    render(<StartScreen initialWay="local" onStartLocal={onStartLocal} onJoinRoom={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('6 Spieler'));
    await userEvent.click(screen.getByRole('button', { name: 'Lokale Partie starten' }));

    expect(onStartLocal).toHaveBeenCalled();
    const state = onStartLocal.mock.calls[0]![0] as {
      bank: Record<string, number>;
      deck: readonly unknown[];
    };
    expect(state.bank.brick).toBe(24);
    expect(state.deck.length).toBe(34);
  });
});

describe('Der Eingang', () => {
  /*
   * Unter der Wortmarke stand ein Vorspann („Drei bis sechs Spieler. Sechs
   * Geraete oder eins."). Er sagte nichts, was die Reiter darunter nicht
   * besser sagen, und war die einzige Fliesstextzeile auf einem Bildschirm aus
   * lauter Bedienung. Was er an Platz freigibt, gehoert der Marke.
   */
  it('traegt unter der Wortmarke keinen Vorspann mehr', () => {
    const { container } = render(<StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

    expect(container.querySelector('.start__lead')).toBeNull();
    expect(screen.queryByText(/Sechs Geräte oder eins/)).toBeNull();
  });

  /**
   * Jeder Weg zeigt genau das, was ihn angeht.
   *
   * Das war einmal die Aufgabe der Reiterreihe: ein offener Reiter, ein
   * Formular. Die Reihe ist weg - der Titel fuehrt geradewegs hierher -, und
   * damit ist es die Aufgabe des Weges selbst. Geprueft wird deshalb nicht mehr
   * umgeschaltet, sondern zweimal gerendert.
   */
  it('laesst Tischgroesse und Seed nur da stehen, wo sie jemanden angehen', () => {
    const { unmount } = render(
      <StartScreen initialWay="local" onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />,
    );

    expect(screen.getByLabelText('Seed')).toBeDefined();
    expect(screen.getByLabelText('3 Spieler')).toBeDefined();
    unmount();

    // Wer beitritt, waehlt weder Tischgroesse noch Brett - beides bestimmt der,
    // der die Partie erstellt hat.
    render(<StartScreen initialWay="join" onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

    expect(screen.queryByLabelText('Seed')).toBeNull();
    expect(screen.queryByLabelText('3 Spieler')).toBeNull();
    expect(screen.getByLabelText('Raumcode')).toBeDefined();
  });

  it('steht bei einem Einladungslink gleich auf Beitreten', () => {
    // Der Link schlaegt sogar den Weg, den der Titel mitgibt: wer ihm gefolgt
    // ist, hat seine Entscheidung getroffen, und ein Bildschirm, der ihn
    // trotzdem etwas anderes fragt, steht zwischen Klick und Tisch.
    render(
      <StartScreen
        onStartLocal={vi.fn()}
        onJoinRoom={vi.fn()}
        initialWay="local"
        initialCode="K7X2"
      />,
    );

    expect((screen.getByLabelText('Raumcode') as HTMLInputElement).value).toBe('K7X2');
    expect(screen.queryByLabelText('3 Spieler')).toBeNull();
  });

  it('zeichnet das Hexfeld als Hintergrund, nicht als Bild', () => {
    const { container } = render(<StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

    // Dasselbe Raster wie im Spiel, mit denselben Funktionen gesetzt.
    const field = container.querySelector('.hexfield');
    expect(field).not.toBeNull();
    expect(field?.querySelectorAll('polygon').length).toBeGreaterThan(50);
  });

  /*
   * Die Wortmarke wird hier **nicht** mehr geprueft, und das ist kein
   * Wegfall, sondern ein Umzug: sie steht auf dem Titelbildschirm davor, und
   * `MenuScreen.test.tsx` prueft sie dort. Zwei Bildschirme hintereinander mit
   * demselben Titel waeren keine Wiedererkennung, sondern eine Wiederholung.
   *
   * Geprueft wird hier stattdessen der Weg zurueck - er ist das, was diesen
   * Bildschirm mit dem Titel verbindet.
   */
  it('bietet den Weg zum Titel nur an, wenn es einen gibt', () => {
    const { unmount } = render(<StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /zum titel/i })).toBeNull();
    unmount();

    const onBack = vi.fn();
    render(<StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} onBack={onBack} />);
    screen.getByRole('button', { name: /zum titel/i }).click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  /**
   * Der Titel waehlt den Reiter vor - und der Sprung auf „Weiterspielen" darf
   * ihn danach nicht wegziehen.
   *
   * Das ist derselbe Fall wie beim Einladungslink: wer gewaehlt hat, hat
   * gewaehlt. Eintreffende `myRooms` sind eine Auskunft und keine Korrektur.
   */
  it('nimmt den Weg vom Titel entgegen und schreibt ihn ueber den Bildschirm', () => {
    render(
      <StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} initialWay="local" myRooms={[]} />,
    );

    // Die Ueberschrift ersetzt die Reiterreihe: sie sagt nicht mehr, welche
    // Wege es gibt, sondern nur noch, auf welchem man steht.
    expect(screen.getByRole('heading', { name: 'An einem Gerät' })).toBeDefined();
    expect(screen.getAllByLabelText(/^Name von Spieler/)).toHaveLength(3);
  });

  it('laesst den Aufprall von innen nach aussen laufen, nicht ueberall zugleich', () => {
    const { container } = render(<StartScreen onStartLocal={vi.fn()} onJoinRoom={vi.fn()} />);

    const delays = [...container.querySelectorAll<HTMLElement>('.hexfield polygon')].map((hex) =>
      Number.parseInt(hex.style.animationDelay, 10),
    );

    // Das mittlere Hex wird zuerst erreicht, das aeusserste zuletzt. Waeren
    // alle Verzoegerungen gleich, blinkte die Flaeche statt zu schwingen.
    expect(Math.min(...delays)).toBeLessThan(Math.max(...delays));
    expect(new Set(delays).size).toBeGreaterThan(3);

    // Und jedes Hex kennt seine Ruhelage - die Welle beginnt und endet dort,
    // wo das Hex ohnehin liegt. Ohne `--rest` faellt es danach auf null.
    const first = container.querySelector<HTMLElement>('.hexfield polygon');
    expect(Number(first?.style.getPropertyValue('--rest'))).toBeGreaterThan(0);
  });

  it('laesst Ueberschrift, Formular und Ecke in dieser Reihenfolge einfallen', () => {
    const { container } = render(
      <StartScreen
        onStartLocal={vi.fn()}
        onJoinRoom={vi.fn()}
        identity={{ userId: 'u1', name: 'Gast', isGuest: true }}
      />,
    );

    const platz = (selector: string): number =>
      Number(container.querySelector<HTMLElement>(selector)!.style.getPropertyValue('--i'));

    // Eine Choreografie und nicht drei gleichzeitige Spruenge. Die Ecke faellt
    // zuletzt - sie ist eine Zustandsanzeige und kein vierter Weg.
    expect(platz('.start__head')).toBeLessThan(platz('.start__form'));
    expect(platz('.start__form')).toBeLessThan(platz('.corner'));
  });

  it('zeigt die Konto-Ecke', () => {
    render(
      <StartScreen
        onStartLocal={vi.fn()}
        onJoinRoom={vi.fn()}
        identity={{ userId: 'u1', name: 'Gast', isGuest: true }}
        onRegister={vi.fn()}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
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
