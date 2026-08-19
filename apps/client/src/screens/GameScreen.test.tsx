// @vitest-environment jsdom
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  type GameState,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { useLocalGame } from '../game/useLocalGame';
import { GameScreen } from './GameScreen';

const scenario = generateScenario(CLASSIC_34, 'screen-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'screen-probe',
);

/**
 * Der Bildschirm haelt seit Etappe 4 keinen Spielzustand mehr - er bekommt eine
 * Sicht und schickt Absichten hinaus. Fuer den Test uebernimmt die lokale
 * Partie diese Rolle, also genau das, was `App` auch tut.
 */
function LocalGame(): JSX.Element {
  const game = useLocalGame(start, seats);

  return (
    <GameScreen
      view={game.view}
      actions={game.actions}
      log={game.log}
      error={game.error}
      onAct={game.act}
      onDismissError={game.dismissError}
      onLeave={vi.fn()}
    />
  );
}

/** Dieselbe Partie, aber ab einem gesetzten Zustand - fuer die Hauptphase. */
function LocalGameFrom({ state }: { readonly state: GameState }): JSX.Element {
  const game = useLocalGame(state, seats);

  return (
    <GameScreen
      view={game.view}
      actions={game.actions}
      log={game.log}
      error={game.error}
      onAct={game.act}
      onDismissError={game.dismissError}
      onLeave={vi.fn()}
    />
  );
}

/**
 * Hauptphase, p1 am Zug, mit Karten fuer alles.
 *
 * Von Hand gesetzt und nicht durchgespielt: welche Rohstoffe die Gruendung
 * abwirft, haengt am Seed, und ein Test, der nur manchmal etwas prueft, prueft
 * nichts. Die Bauteile selbst kommen weiterhin aus `legalActions`.
 */
function richMainPhase(): GameState {
  let state = start;
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return {
    ...state,
    phase: { kind: 'main' },
    currentPlayerIndex: 0,
    players: state.players.map((player, index) =>
      index === 0
        ? { ...player, resources: { brick: 4, lumber: 4, wool: 4, grain: 4, ore: 4 } }
        : player,
    ),
  };
}

/** Der Knoten, den die Gruendungsphase als erstes anbietet. */
function firstSetupVertex(): string {
  const action = legalActions(start, setupPlayer(start)!)[0]!;
  if (action.type !== 'placeSetupSettlement') {
    throw new Error(`Erwartet war eine Gruendungssiedlung, war ${action.type}`);
  }
  return action.vertex;
}

/**
 * Ein Gruendungszug in zwei Schritten - so, wie ihn ein Mensch macht.
 *
 * Erst das Bauteil, das gerade an der Reihe ist (die Gruendung gibt genau eines
 * frei), dann die erste angebotene Stelle. Seit die Gruendung demselben
 * Zwei-Schritt-Weg folgt wie jeder andere Bau, tut das jeder Test, der sie
 * durchklickt - und diese Funktion ist der Ort, an dem das einmal steht.
 */
async function setupStep(): Promise<boolean> {
  const piece = ['build-settlement', 'build-road']
    .map((id) => screen.getByTestId(id) as HTMLButtonElement)
    .find((button) => !button.disabled);
  if (piece === undefined) return false;

  await userEvent.click(piece);

  const target = screen
    .getAllByTestId(/^(vertex|edge)-/)
    .find((node) => node.dataset['target'] === 'true');
  if (target === undefined) return false;

  await userEvent.click(target);
  return true;
}

describe('GameScreen', () => {
  it('beginnt in der Gruendungsphase beim ersten Spieler', () => {
    render(<LocalGame />);

    expect(screen.getAllByText(/Gründung/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('seat-p1')).toBeDefined();
  });

  it('setzt auf Klick eine Siedlung und schaltet auf die Strasse weiter', async () => {
    render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    await userEvent.click(screen.getByTestId(`vertex-${firstSetupVertex()}`));

    // Nach der Siedlung ist die Strasse an der Reihe - und wie ueberall sonst
    // bleibt das Brett ruhig, bis sie gewaehlt ist.
    expect(
      screen.getAllByTestId(/^(vertex|edge)-/).filter((node) => node.dataset['target'] === 'true'),
    ).toHaveLength(0);
    expect(screen.getByTestId('build-road')).toHaveProperty('disabled', false);
    expect(screen.getByTestId('build-settlement')).toHaveProperty('disabled', true);

    await userEvent.click(screen.getByTestId('build-road'));
    expect(
      screen.getAllByTestId(/^edge-/).filter((node) => node.dataset['target'] === 'true').length,
    ).toBeGreaterThan(0);
  });

  it('schreibt jeden Zug in den Verlauf', async () => {
    render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    await userEvent.click(screen.getByTestId(`vertex-${firstSetupVertex()}`));

    // Der Verlauf liegt seit dem neuen Layout hinter seinem Symbol - er wird
    // trotzdem geschrieben, waehrend er zu ist. Genau das steht hier.
    await userEvent.click(screen.getByTestId('log-toggle'));

    expect(screen.getByText(/setzt die Gründungssiedlung/)).toBeDefined();
  });

  /*
   * Die Plaetze, nicht das Aussehen.
   *
   * jsdom hat keine Layout-Engine - wie breit etwas ist und ob sich zwei Dinge
   * ueberdecken, kann hier niemand messen; das bleibt der Browser-Durchlauf.
   * Was sich pruefen laesst, ist die Ordnung im Baum, und genau daran haengt
   * das neue Layout: der Status neben der Verlaufstuer, die Wuerfel als
   * aeusserstes Stueck der rechten Ecke. Beides ist mit einer verrutschten
   * CSS-Regel wieder da, wo es war - mit einer verrutschten Klammer nicht.
   */
  it('stellt den Status neben die Tuer zum Verlauf', () => {
    render(<LocalGame />);

    const topline = screen.getByTestId('log-toggle').closest('.topline');
    expect(topline).not.toBeNull();

    const status = topline!.querySelector('.panel--status');
    expect(status).not.toBeNull();
    // Er steht davor: gelesen wird von links nach rechts, und das Beilaeufige
    // kommt vor der Tuer, die man selten oeffnet.
    expect(status!.compareDocumentPosition(screen.getByTestId('log-toggle'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('legt die Wuerfel als Letztes in die rechte Ecke', () => {
    render(<LocalGame />);

    const corner = screen.getByTestId('dice').closest('.tray__controls');
    expect(corner).not.toBeNull();

    // Aeusserstes Kind heisst am Bildschirm: in der Ecke selbst. Was links
    // davon liegt, sind die Bauteile.
    const own = screen.getByTestId('dice').closest('.dice-tray');
    expect(corner!.lastElementChild).toBe(own);
    expect(corner!.querySelector('[data-testid="build-road"]')).not.toBeNull();
  });

  it('zeigt genau eine offene Hand und von allen nur die Anzahl', () => {
    render(<LocalGame />);

    // Auch am selben Geraet: der Bildschirm wandert weiter, die Handkarten
    // sollen es nicht. Genau ein Kartenstapel liegt offen, und der gehoert
    // dem, der handeln darf; der Tisch zaehlt fuer alle drei nur.
    expect(screen.getAllByTestId('hand-total')).toHaveLength(1);
    expect(screen.getAllByTestId(/^hand-count-/)).toHaveLength(3);
  });

  it('sperrt das Bauen, solange nicht gewuerfelt ist', async () => {
    render(<LocalGame />);

    // Gruendungsphase durchklicken: je Zug erst das Bauteil, dann die Stelle.
    for (let step = 0; step < 12; step += 1) {
      if (!(await setupStep())) break;
    }

    // Gewuerfelt wird an den Wuerfeln - einen eigenen Knopf dafuer gibt es nicht.
    expect(screen.getByRole('button', { name: 'Würfeln' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Zug beenden' })).toHaveProperty('disabled', true);
    expect(
      screen.getAllByTestId(/^(vertex|edge)-/).filter((node) => node.dataset['target'] === 'true'),
    ).toHaveLength(0);
    /*
     * Eigene Frist, und zwar gemessen: dieser Test klickt zwoelf Gruendungszuege
     * durch, jeder mit zwei `userEvent`-Klicks und einem vollstaendigen
     * Neurendern des Bretts. Allein lief er in 4.7 s, parallel neben `shared`
     * und `server` zweimal knapp ueber die 5000-ms-Standardfrist - einmal rot,
     * beim naechsten Lauf gruen, ohne dass sich etwas geaendert haette.
     *
     * Erhoeht und nicht gekuerzt: was er prueft, braucht die zwoelf Zuege. Ein
     * Test, der je nach Rechnerlast faellt, ist schlimmer als ein langsamer -
     * er kostet jedes Mal die Frage, ob diesmal wirklich etwas kaputt ist.
     */
  }, 20_000);
});

/**
 * Gebaut wird in zwei Schritten.
 *
 * Vorher leuchtete das Brett an jeder Stelle, an der irgendetwas moeglich war -
 * Strassen, Siedlungen und Staedte gleichzeitig -, und was ein Klick brachte,
 * ergab sich aus dem Ort. Bei drei Bauteilen ist das Raten mit Ansage.
 */
describe('Bauen in zwei Schritten', () => {
  function litUp(): number {
    return screen
      .getAllByTestId(/^(vertex|edge)-/)
      .filter((node) => node.dataset['target'] === 'true').length;
  }

  it('laesst das Brett ruhig, solange kein Bauteil gewaehlt ist', () => {
    render(<LocalGameFrom state={richMainPhase()} />);

    // Gebaut werden duerfte hier alles - aber erst, wenn jemand sagt was.
    expect(screen.getByTestId('build-road')).toHaveProperty('disabled', false);
    expect(litUp()).toBe(0);
  });

  it('zeigt die Stellen erst, wenn das Bauteil gewaehlt ist', async () => {
    render(<LocalGameFrom state={richMainPhase()} />);

    await userEvent.click(screen.getByTestId('build-road'));

    expect(litUp()).toBeGreaterThan(0);
    expect(screen.getByTestId('build-mode').textContent).toContain('Straße bauen');
  });

  /*
   * Und zwar nur die Stellen dieses Bauteils: dass eine Stadt woanders auch
   * ginge, ist beim Strassenbauen keine Auskunft, sondern eine Ablenkung.
   *
   * Geprueft wird mit Strasse und Stadt und nicht mit Strasse und Siedlung: in
   * diesem Stand sind nach der Gruendung alle Knoten durch die Abstandsregel
   * gesperrt, eine Siedlung waere also gar nicht moeglich. Ein Test, der auf
   * einen gesperrten Knopf drueckt, prueft nichts - er sieht nur so aus.
   */
  it('zeigt nur die Stellen des gewaehlten Bauteils', async () => {
    render(<LocalGameFrom state={richMainPhase()} />);

    const litEdges = (): number =>
      screen.getAllByTestId(/^edge-/).filter((node) => node.dataset['target'] === 'true').length;
    const litVertices = (): number =>
      screen.getAllByTestId(/^vertex-/).filter((node) => node.dataset['target'] === 'true').length;

    await userEvent.click(screen.getByTestId('build-road'));
    expect(litEdges()).toBeGreaterThan(0);
    expect(litVertices()).toBe(0);

    await userEvent.click(screen.getByTestId('build-city'));
    expect(litVertices()).toBeGreaterThan(0);
    expect(litEdges()).toBe(0);
  });

  /*
   * **Beim Ausbau zur Stadt sind alle Ziele bebaut** - und die Zielmarke hing
   * bis hierher ausschliesslich am *leeren* Knoten. Das Brett blieb damit
   * vollkommen ruhig, obwohl jede eigene Siedlung anklickbar war; im Playtest
   * hat das genau so gewirkt, wie es aussah: als ginge es nicht.
   */
  it('markiert beim Stadtbau die Haeuser, auf die man druecken soll', async () => {
    render(<LocalGameFrom state={richMainPhase()} />);

    await userEvent.click(screen.getByTestId('build-city'));

    const marked = screen
      .getAllByTestId(/^vertex-/)
      .filter((node) => node.dataset['target'] === 'true');
    expect(marked.length).toBeGreaterThan(0);

    for (const node of marked) {
      // Auf jedem steht schon eine Siedlung - deshalb reicht der Punkt nicht,
      // der am leeren Knoten liegt: er laege unter dem Haus.
      expect(node.querySelector('.vertex__building')).not.toBeNull();
      expect(node.querySelector('.vertex__target--yard')).not.toBeNull();
    }
  });

  it('nimmt die Auswahl auf denselben Knopf wieder zurueck', async () => {
    render(<LocalGameFrom state={richMainPhase()} />);

    const road = screen.getByTestId('build-road');
    await userEvent.click(road);
    await userEvent.click(road);

    expect(litUp()).toBe(0);
    expect(screen.queryByTestId('build-mode')).toBeNull();
  });

  it('baut auf den zweiten Klick und raeumt die Auswahl danach weg', async () => {
    render(<LocalGameFrom state={richMainPhase()} />);

    await userEvent.click(screen.getByTestId('build-road'));
    const edge = screen.getAllByTestId(/^edge-/).find((node) => node.dataset['target'] === 'true')!;
    await userEvent.click(edge);

    await userEvent.click(screen.getByTestId('log-toggle'));
    expect(screen.getByText(/baut eine Straße/)).toBeDefined();
    expect(screen.queryByTestId('build-mode')).toBeNull();
    expect(litUp()).toBe(0);
  });

  /*
   * **Die Gruendung geht denselben Weg wie jeder andere Bau.**
   *
   * Sie war einstufig, und die Begruendung stand hier: dort gibt es genau eine
   * Sache zu setzen, ein Knopf davor entscheidet nichts. Das stimmt fuer sich
   * genommen - und geht am Punkt vorbei. Die Gruendung ist der Moment, in dem
   * man das Muster **lernt**: wer seine ersten vier Zuege macht, indem er
   * irgendwo auf ein leuchtendes Brett klickt, hat danach keinen Grund
   * anzunehmen, dass es je anders liefe. Der eine Druck, der nichts
   * entscheidet, bringt bei, wie das Spiel bedient wird.
   */
  it('haelt das Brett auch in der Gruendung ruhig, bis ein Bauteil gewaehlt ist', () => {
    render(<LocalGame />);

    expect(litUp()).toBe(0);
  });

  it('leuchtet in der Gruendung, sobald die Siedlung gewaehlt ist', async () => {
    render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));

    expect(
      screen.getAllByTestId(/^vertex-/).filter((node) => node.dataset['target'] === 'true').length,
    ).toBeGreaterThan(0);
  });

  it('bietet in der Gruendung nur an, was dort ueberhaupt an der Reihe ist', () => {
    render(<LocalGame />);

    // Zuerst die Siedlung. Die Strasse kommt danach, die Stadt gar nicht.
    expect(screen.getByTestId('build-settlement')).toHaveProperty('disabled', false);
    expect(screen.getByTestId('build-road')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('build-city')).toHaveProperty('disabled', true);
  });
});

/**
 * Die Sieben, an der die Partie im Playtest haengengeblieben ist.
 *
 * Am selben Geraet muessen nach einer Sieben oft zwei nacheinander abwerfen.
 * Wenn der erste fertig ist, bleibt „es muss abgeworfen werden" wahr - React
 * haengt den Dialog also nicht aus, sondern schreibt nur neue Eigenschaften
 * hinein, und sein `chosen` lebt weiter. Auf dem Bildschirm stand deshalb bei
 * Spieler 3 „Lehm: 1 von 0", also die Auswahl seines Vorgaengers; der Server
 * hat den Abwurf abgewiesen, und die Sieben war nicht mehr aufzuloesen.
 */
describe('Abwerfen nach einer Sieben', () => {
  /** Alle drei ueber dem Handkartenlimit, damit zwei abwerfen muessen. */
  function sevenRolled(): GameState {
    let state = start;
    while (state.phase.kind === 'setup') {
      const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
    }

    return {
      ...state,
      phase: { kind: 'discardPending', pending: [seats[0]!.id, seats[2]!.id] },
      currentPlayerIndex: 0,
      players: state.players.map((player, index) =>
        index === 0
          ? { ...player, resources: { brick: 4, lumber: 4, wool: 0, grain: 0, ore: 0 } }
          : index === 2
            ? { ...player, resources: { brick: 0, lumber: 0, wool: 4, grain: 4, ore: 0 } }
            : player,
      ),
    };
  }

  it('faengt beim naechsten Spieler bei null an', async () => {
    render(<LocalGameFrom state={sevenRolled()} />);

    // Spieler 1 wirft vier ab - er hat nur Lehm und Holz.
    for (let step = 0; step < 2; step += 1) {
      await userEvent.click(screen.getByLabelText('Lehm mehr'));
      await userEvent.click(screen.getByLabelText('Holz mehr'));
    }
    expect(screen.getByTestId('chosen-brick').textContent).toBe('2');
    await userEvent.click(screen.getByRole('button', { name: /^Abwerfen/ }));

    // Jetzt ist Spieler 3 dran - und sein Formular ist leer. Vorher stand hier
    // „2", auf einer Hand ohne ein einziges Lehm.
    expect(screen.getByTestId('chosen-brick').textContent).toBe('0');
    expect(screen.getByTestId('chosen-lumber').textContent).toBe('0');
    expect(screen.getByRole('button', { name: /^Abwerfen/ }).textContent).toContain('(0/');
  });

  it('laesst auch beim zweiten Spieler nur waehlen, was er hat', async () => {
    render(<LocalGameFrom state={sevenRolled()} />);

    for (let step = 0; step < 2; step += 1) {
      await userEvent.click(screen.getByLabelText('Lehm mehr'));
      await userEvent.click(screen.getByLabelText('Holz mehr'));
    }
    await userEvent.click(screen.getByRole('button', { name: /^Abwerfen/ }));

    // Spieler 3 hat kein Lehm - der Knopf darf nichts bewirken.
    await userEvent.click(screen.getByLabelText('Lehm mehr'));
    expect(screen.getByTestId('chosen-brick').textContent).toBe('0');
  });
});
