// @vitest-environment jsdom
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CITIES_RULES,
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  edgeVertices,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  type GameState,
} from '@conquerist/shared';
import { cardAmounts } from '@conquerist/shared';
import { fireEvent, render, screen, userEvent, within } from '../test/dom';
import { defaultSeats } from '../seats';
import { useLocalGame } from '../game/useLocalGame';
import { GameScreen } from './GameScreen';
import {
  asTouchDevice,
  confirmPlacement,
  placeEdge,
  placeHex,
  placeVertex,
  tapVertex,
} from '../test/board';
import { afterOpening } from '../test/opening';

const scenario = generateScenario(CLASSIC_34, 'screen-probe');
const seats = defaultSeats(3);
const start = afterOpening(
  createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'screen-probe',
  ),
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
        ? { ...player, resources: cardAmounts({ brick: 4, lumber: 4, wool: 4, grain: 4, ore: 4 }) }
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
async function setupStep(container: HTMLElement): Promise<boolean> {
  const piece = ['build-settlement', 'build-road']
    .map((id) => screen.getByTestId(id) as HTMLButtonElement)
    .find((button) => !button.disabled);
  if (piece === undefined) return false;

  await userEvent.click(piece);

  const target = screen
    .getAllByTestId(/^(vertex|edge)-/)
    .find((node) => node.dataset['target'] === 'true');
  if (target === undefined) return false;

  // Seit dem Umbau auf schmale Geraete geht auch ein Test ueber die
  // Fangflaeche, statt ein Brettelement anzuklicken - und `placeX` erledigt die
  // Bestaetigung, falls das gestellte Geraet danach fragt.
  const id = target.dataset['testid']!;
  if (id.startsWith('vertex-')) placeVertex(container, id.replace('vertex-', ''));
  else placeEdge(container, id.replace('edge-', ''));

  return true;
}

describe('GameScreen', () => {
  it('beginnt in der Gruendungsphase beim ersten Spieler', () => {
    render(<LocalGame />);

    expect(screen.getAllByText(/Gründung/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('seat-p1')).toBeDefined();
  });

  it('setzt auf Klick eine Siedlung und schaltet auf die Strasse weiter', async () => {
    const { container } = render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    placeVertex(container, firstSetupVertex());

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
    const { container } = render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    placeVertex(container, firstSetupVertex());

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
    const { container } = render(<LocalGame />);

    // Gruendungsphase durchklicken: je Zug erst das Bauteil, dann die Stelle.
    for (let step = 0; step < 12; step += 1) {
      if (!(await setupStep(container))) break;
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
    const { container } = render(<LocalGameFrom state={richMainPhase()} />);

    await userEvent.click(screen.getByTestId('build-road'));
    const edge = screen.getAllByTestId(/^edge-/).find((node) => node.dataset['target'] === 'true')!;
    placeEdge(container, edge.dataset['testid']!.replace('edge-', ''));

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
      phase: {
        kind: 'discardPending',
        pending: [seats[0]!.id, seats[2]!.id],
        counts: {},
        resume: 'seven',
      },
      currentPlayerIndex: 0,
      players: state.players.map((player, index) =>
        index === 0
          ? {
              ...player,
              resources: cardAmounts({ brick: 4, lumber: 4, wool: 0, grain: 0, ore: 0 }),
            }
          : index === 2
            ? {
                ...player,
                resources: cardAmounts({ brick: 0, lumber: 0, wool: 4, grain: 4, ore: 0 }),
              }
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

describe('Der Auftakt auf dem Spielbildschirm', () => {
  // `start` ist oben schon durch den Auftakt gewuerfelt - hier braucht es die
  // Partie davor.
  const imAuftakt = createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'screen-probe',
  );

  function GameFrom({ state }: { readonly state: typeof imAuftakt }): JSX.Element {
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

  it('legt die Auftakttafel auf den Tisch, solange gewuerfelt wird', () => {
    render(<GameFrom state={imAuftakt} />);

    expect(screen.getByText(/Wer beginnt/)).toBeDefined();
  });

  it('bietet dort den Wuerfelknopf an', () => {
    render(<GameFrom state={imAuftakt} />);

    expect(screen.getByRole('button', { name: /Würfeln/ })).toBeDefined();
  });

  it('raeumt sie weg, sobald die Gruendung laeuft', () => {
    render(<GameFrom state={afterOpening(imAuftakt)} />);

    expect(screen.queryByText(/Wer beginnt/)).toBeNull();
  });
});

describe('Tippen, dann bestaetigen', () => {
  /*
   * Der Zwischenschritt gehoert dem Finger. Am Schreibtisch trifft ein
   * Mauszeiger von einem Pixel einen Knoten von 34, und dort waere er nur ein
   * Pflichtklick auf jede Setzung - deshalb stellt dieser Block ausdruecklich
   * ein Handy hin, statt sich auf die Voreinstellung zu verlassen.
   */
  beforeEach(() => asTouchDevice());

  it('fragt am Schreibtisch gar nicht erst - dort setzt der erste Klick', async () => {
    asTouchDevice(false);
    const { container } = render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    tapVertex(container, firstSetupVertex());

    expect(screen.queryByRole('button', { name: 'Hier setzen' })).toBeNull();
    expect(screen.queryByTestId(`pending-${firstSetupVertex()}`)).toBeNull();

    await userEvent.click(screen.getByTestId('log-toggle'));
    expect(screen.getByText(/setzt die Gründungssiedlung/)).toBeDefined();
  });

  it('handelt beim ersten Tipp noch nicht', async () => {
    const { container } = render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    tapVertex(container, firstSetupVertex());

    // Nichts gebaut - aber der Geist steht und der Knopf fragt.
    expect(screen.queryByTestId(`pending-${firstSetupVertex()}`)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Hier setzen' })).toBeDefined();
    expect(screen.queryByTestId('log-toggle')).toBeDefined();
  });

  it('handelt erst auf den Knopf', async () => {
    const { container } = render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    tapVertex(container, firstSetupVertex());
    confirmPlacement(container);

    await userEvent.click(screen.getByTestId('log-toggle'));
    expect(screen.getByText(/setzt die Gründungssiedlung/)).toBeDefined();
  });

  it('verschiebt die Auswahl beim zweiten Tipp, statt zu setzen', async () => {
    const { container } = render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));

    const ziele = screen
      .getAllByTestId(/^vertex-/)
      .filter((node) => node.dataset['target'] === 'true')
      .map((node) => node.dataset['testid']!.replace('vertex-', ''));

    tapVertex(container, ziele[0]!);
    tapVertex(container, ziele[5]!);

    // Ein Fehlgriff kostet nichts: der Geist wandert, gesetzt ist noch nichts.
    expect(screen.queryByTestId(`pending-${ziele[0]!}`)).toBeNull();
    expect(screen.queryByTestId(`pending-${ziele[5]!}`)).not.toBeNull();

    await userEvent.click(screen.getByTestId('log-toggle'));
    expect(screen.queryByText(/setzt die Gründungssiedlung/)).toBeNull();
  });

  it('raeumt die Auswahl mit Escape', async () => {
    const { container } = render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    tapVertex(container, firstSetupVertex());
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: 'Hier setzen' })).toBeNull();
  });

  it('raeumt die Auswahl auch ueber den zweiten Knopf', async () => {
    const { container } = render(<LocalGame />);

    await userEvent.click(screen.getByTestId('build-settlement'));
    tapVertex(container, firstSetupVertex());
    // „Doch nicht" und nicht „Abbrechen": den Namen traegt schon der Knopf,
    // der den Bau-Modus verlaesst, und zwei gleich benannte Knoepfe auf einem
    // Bildschirm sind auch fuer einen Screenreader mehrdeutig.
    await userEvent.click(screen.getByRole('button', { name: 'Doch nicht' }));

    expect(screen.queryByRole('button', { name: 'Hier setzen' })).toBeNull();
    expect(screen.queryByTestId(`pending-${firstSetupVertex()}`)).toBeNull();
  });
});

describe('Der Hinweis fuers Hochformat', () => {
  it('steht im Bildschirm und laesst sich wegtippen', async () => {
    render(<LocalGame />);

    // Ob er zu sehen ist, entscheidet das Blatt - jsdom rechnet kein Layout.
    // Was hier geprueft wird, ist der Zustand: er ist da und geht wieder weg.
    expect(screen.getByText(/Quer halten/)).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }));

    expect(screen.queryByText(/Quer halten/)).toBeNull();
  });
});

/**
 * Die Tuer nach draussen.
 *
 * Sie fehlte, und daraus wurde die Sackgasse aus dem Playtest: der Server
 * oeffnet beim Verbindungsaufbau den einzigen Raum, an dem jemand sitzt - wer
 * einmal in einer Partie war, kam bei jedem Besuch dorthin zurueck und von
 * dort zu keinem Startbildschirm mehr.
 */
function LeavableGame({
  onLeave,
  over = null,
}: {
  readonly onLeave: () => void;
  readonly over?: string | null;
}): JSX.Element {
  const game = useLocalGame(start, seats);

  return (
    <GameScreen
      view={game.view}
      actions={game.actions}
      log={game.log}
      error={game.error}
      over={over}
      onAct={game.act}
      onDismissError={game.dismissError}
      onLeave={onLeave}
    />
  );
}

describe('Der Weg zurueck zum Start', () => {
  it('steht waehrend der Partie bereit und nicht erst am Ende', async () => {
    const onLeave = vi.fn();
    render(<LeavableGame onLeave={onLeave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Zum Startbildschirm' }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('meldet einen Abbruch mit seinem Grund und fuehrt hinaus', async () => {
    const onLeave = vi.fn();
    render(<LeavableGame onLeave={onLeave} over="Anna hat die Partie abgebrochen" />);

    const dialog = screen.getByRole('dialog', { name: 'Partie abgebrochen' });
    expect(dialog.textContent).toContain('Anna hat die Partie abgebrochen');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück zum Start' }));
    expect(onLeave).toHaveBeenCalled();
  });
});

/**
 * Der Vorrat der Bank steht im Bild, nicht nur im Zustand.
 *
 * Geprueft am ganzen Bildschirm und nicht nur an der Komponente: dass
 * `SupplyPanel` seine Zahlen richtig setzt, sagt sein eigener Test. Hier geht
 * es um die Verdrahtung - bekommt es die Bank der laufenden Partie und das
 * Regelwerk, aus dem die Ausgangsmenge stammt.
 */
describe('Die Stapel-Uebersicht', () => {
  it('bleibt eingeklappt, bis jemand fragt', () => {
    render(<LocalGame />);

    expect(screen.getByTestId('supply-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('supply-brick')).toBeNull();
  });

  it('zeigt den Vorrat der laufenden Partie', async () => {
    render(<LocalGame />);

    await userEvent.click(screen.getByTestId('supply-toggle'));

    // Die Ausgangsmenge kommt aus dem Regelwerk der Partie, nicht aus dem Code.
    const brick = screen.getByTestId('supply-brick').textContent ?? '';
    expect(brick).toContain(String(CLASSIC_RULES.resourceBank.brick));
    expect(screen.getByTestId('supply-deck')).toBeDefined();
  });
});

/**
 * Der Endstand, wenn die Partie herum ist.
 *
 * Ueber `LocalGameFrom` mit gesetzter Endphase und nicht ueber eine
 * ausgespielte Partie: bis zehn Siegpunkte zu spielen pruefte den Reducer,
 * nicht den Bildschirm. Was hier interessiert, ist die Verdrahtung.
 */
describe('Der Endstand', () => {
  const finished: GameState = {
    ...start,
    phase: { kind: 'finished', winner: seats[0]!.id },
    rollTally: { '6': 4, '8': 2 },
  };

  it('erscheint von selbst, sobald jemand gewonnen hat', () => {
    render(<LocalGameFrom state={finished} />);

    expect(screen.getByTestId('over-winner').textContent).toContain(seats[0]!.name);
    expect(screen.getByTestId('over-roll-6').textContent).toContain('4');
  });

  /*
   * Wer ihn wegklickt, soll das Brett ansehen koennen - und danach wieder
   * hineinkommen. Ein Endstand, den man genau einmal sieht, zwingt zum
   * Auswendiglernen.
   */
  it('bleibt nach dem Schliessen erreichbar', async () => {
    render(<LocalGameFrom state={finished} />);

    await userEvent.click(screen.getByRole('button', { name: /Endstand schließen/ }));
    expect(screen.queryByTestId('over-winner')).toBeNull();

    await userEvent.click(screen.getByTestId('over-reopen'));
    expect(screen.getByTestId('over-winner')).toBeDefined();
  });
});

/**
 * Städte & Ritter am Bildschirm.
 *
 * Dieselbe Zwei-Schritt-Bedienung wie beim Bauen, nur mit einer zweiten Leiste:
 * erst die Frage („was tun"), dann die Stelle auf dem Brett.
 */
describe('GameScreen mit Rittern', () => {
  const citiesSeats = defaultSeats(3);
  const citiesStart = afterOpening(
    createGame(
      scenario,
      CITIES_RULES,
      citiesSeats.map((seat) => seat.id),
      'ritter-probe',
    ),
  );

  function CitiesGame({ state }: { readonly state: GameState }): JSX.Element {
    const game = useLocalGame(state, citiesSeats);

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

  /** Hauptphase an einem Städte-&-Ritter-Tisch, p1 mit Karten für alles. */
  function citiesMainPhase(overrides: Partial<GameState> = {}): GameState {
    let state = citiesStart;
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
          ? {
              ...player,
              resources: cardAmounts({ brick: 4, lumber: 4, wool: 4, grain: 4, ore: 4 }),
            }
          : player,
      ),
      ...overrides,
    };
  }

  const litVertices = (): string[] =>
    screen
      .getAllByTestId(/^vertex-/)
      .filter((node) => node.dataset['target'] === 'true')
      .map((node) => node.dataset['testid'] ?? node.getAttribute('data-testid') ?? '');

  it('zeigt beim Ritterbau die Ritterstellen und nicht die Siedlungsstellen', async () => {
    const state = citiesMainPhase();
    render(<CitiesGame state={state} />);

    await userEvent.click(screen.getByTestId('build-knight'));

    // `afterOpening` sortiert die Spieler um - wer am Zug ist, steht im
    // Zustand und heisst nicht zwingend p1.
    const me = state.players[state.currentPlayerIndex]!.id;
    const knightSpots = new Set(
      legalActions(state, me)
        .filter((action) => action.type === 'buildKnight')
        .map((action) => `vertex-${(action as { vertex: string }).vertex}`),
    );

    expect(knightSpots.size).toBeGreaterThan(0);
    expect(new Set(litVertices())).toEqual(knightSpots);
    expect(screen.getByTestId('build-mode').textContent).toContain('Ritter bauen');
  });

  it('zeigt beim Versetzen erst die Ritter und danach deren Ziele', async () => {
    const knightOf = (owner: string) => ({
      owner,
      level: 1 as const,
      active: true,
      activatedOnTurn: 1,
      upgradedThisTurn: false,
    });

    // Ein handlungsbereiter Ritter braucht eine eigene Strasse an seinem Knoten
    // - die Gruendung hat p1 genau eine gelegt.
    const state = citiesMainPhase({ turn: 3 });
    const me = state.players[state.currentPlayerIndex]!.id;
    const own = Object.entries(state.roads).find(([, owner]) => owner === me)![0];
    const vertex = edgeVertices(own)[0]!;

    const withKnight: GameState = {
      ...state,
      buildings: Object.fromEntries(
        Object.entries(state.buildings).filter(([at]) => at !== vertex),
      ),
      knights: { [vertex]: knightOf(me) },
    };

    render(<CitiesGame state={withKnight} />);

    await userEvent.click(screen.getByTestId('knight-move'));
    expect(litVertices()).toEqual([`vertex-${vertex}`]);
    expect(screen.getByTestId('knight-mode').textContent).toContain('eigenen Ritter wählen');

    tapVertex(document.body, vertex);

    expect(screen.getByTestId('knight-mode').textContent).toContain('Zielkreuzung wählen');
    expect(litVertices()).not.toContain(`vertex-${vertex}`);
    expect(litVertices().length).toBeGreaterThan(0);
  });

  it('laesst in displacePending nur die Ausweichkreuzungen leuchten', () => {
    const state = citiesMainPhase();
    const me = state.players[state.currentPlayerIndex]!.id;
    const own = Object.entries(state.roads).find(([, owner]) => owner === me)![0];
    const from = edgeVertices(own)[0]!;

    const displacing: GameState = {
      ...state,
      buildings: {},
      knights: {},
      phase: {
        kind: 'displacePending',
        owner: me,
        level: 1,
        active: false,
        activatedOnTurn: null,
        from,
      },
    };

    render(<CitiesGame state={displacing} />);

    expect(screen.getByTestId('displace-mode').textContent).toContain('Wohin weicht dein Ritter');
    expect(screen.queryByTestId('knight-mode')).toBeNull();
    expect(litVertices().length).toBeGreaterThan(0);
    expect(litVertices()).not.toContain(`vertex-${from}`);
  });

  it('zeigt an einem Basistisch genau drei Bauteile und keine Ritterleiste', () => {
    render(<LocalGameFrom state={richMainPhase()} />);

    expect(screen.queryByTestId('build-wall')).toBeNull();
    expect(screen.queryByTestId('build-knight')).toBeNull();
    expect(screen.queryByTestId('knight-activate')).toBeNull();
  });

  it('stellt die Ritterleiste an einem Staedte-&-Ritter-Tisch hin', () => {
    render(<CitiesGame state={citiesMainPhase()} />);

    expect(screen.queryByTestId('build-wall')).not.toBeNull();
    expect(screen.queryByTestId('knight-activate')).not.toBeNull();
  });

  /*
   * Der gegenseitige Ausschluß der Absichten - eine Invariante und kein
   * Zufall: zwei gleichzeitig leuchtende Absichten wären genau das Raten,
   * gegen das der zweite Schritt überhaupt eingeführt wurde. Geprüft wird sie
   * am Bildschirm, weil sie dort sichtbar ist: jede der drei Leisten steht für
   * eine Absicht, und es darf immer nur eine stehen.
   *
   * Durchgegangen werden alle sechs Übergänge (jede Absicht löscht jede
   * andere) und dazu der halbfertige Ritterzug: die gemerkte Kreuzung gehört
   * zur Ritterabsicht, also fällt sie mit ihr - sonst fragte die Leiste nach
   * dem Ziel eines Ritters, den niemand mehr gewählt hat.
   */
  it('loescht mit jeder neuen Absicht die vorige samt halbfertigem Ritterzug', async () => {
    const base = citiesMainPhase({ turn: 3 });
    const me = base.players[base.currentPlayerIndex]!.id;
    const own = Object.entries(base.roads).find(([, owner]) => owner === me)![0];
    const vertex = edgeVertices(own)[0]!;

    const state: GameState = {
      ...base,
      players: base.players.map((player) =>
        player.id === me
          ? {
              ...player,
              resources: cardAmounts({
                brick: 4,
                lumber: 4,
                wool: 4,
                grain: 4,
                ore: 4,
                cloth: 4,
              }),
              // Stufe 3 -> 4 bringt den Aufsatz, also die Metropolenwahl.
              improvements: { trade: 3 },
            }
          : player,
      ),
      // Derselbe Aufbau wie beim Versetzen weiter oben: ein handlungsbereiter
      // Ritter an einer eigenen Straße, und die Kreuzung dafür geräumt.
      buildings: Object.fromEntries(Object.entries(base.buildings).filter(([at]) => at !== vertex)),
      knights: {
        [vertex]: {
          owner: me,
          level: 1 as const,
          active: true,
          activatedOnTurn: 1,
          upgradedThisTurn: false,
        },
      },
    };

    const ownFreeCities = Object.values(state.buildings).filter(
      (building) =>
        building.owner === me && building.kind === 'city' && building.metropolis === null,
    );

    // Ohne eigene freie Stadt gäbe es keine Metropolenwahl, und der Test
    // prüfte nur zwei der drei Absichten.
    expect(ownFreeCities.length).toBeGreaterThan(0);

    render(<CitiesGame state={state} />);

    const knightBar = () => screen.queryByTestId('knight-mode');
    const buildBar = () => screen.queryByTestId('build-mode');
    const metropolisBar = () => screen.queryByTestId('metropolis-mode');

    // Bauwahl an.
    await userEvent.click(screen.getByTestId('build-knight'));
    expect(buildBar()).not.toBeNull();

    // Bauwahl -> Rittermodus.
    await userEvent.click(screen.getByTestId('knight-move'));
    expect(buildBar()).toBeNull();
    expect(knightBar()?.textContent).toContain('eigenen Ritter wählen');

    // Der erste Klick merkt den Ritter - die Leiste fragt nach dem Ziel.
    tapVertex(document.body, vertex);
    expect(knightBar()?.textContent).toContain('Zielkreuzung wählen');

    // Abbrechen vergißt ihn wieder.
    await userEvent.click(within(knightBar()!).getByRole('button', { name: 'Abbrechen' }));
    expect(knightBar()).toBeNull();
    await userEvent.click(screen.getByTestId('knight-move'));
    expect(knightBar()?.textContent).toContain('eigenen Ritter wählen');

    // Rittermodus -> Bauwahl, und der gemerkte Ritter geht mit.
    tapVertex(document.body, vertex);
    expect(knightBar()?.textContent).toContain('Zielkreuzung wählen');
    await userEvent.click(screen.getByTestId('build-knight'));
    expect(knightBar()).toBeNull();
    expect(buildBar()).not.toBeNull();
    await userEvent.click(screen.getByTestId('knight-move'));
    expect(knightBar()?.textContent).toContain('eigenen Ritter wählen');

    // Rittermodus -> Metropolenwahl.
    await userEvent.click(screen.getByTestId('track-trade-4'));
    expect(knightBar()).toBeNull();
    expect(metropolisBar()).not.toBeNull();

    // Metropolenwahl -> Bauwahl.
    await userEvent.click(screen.getByTestId('build-knight'));
    expect(metropolisBar()).toBeNull();
    expect(buildBar()).not.toBeNull();

    // Bauwahl -> Metropolenwahl.
    await userEvent.click(screen.getByTestId('track-trade-4'));
    expect(buildBar()).toBeNull();
    expect(metropolisBar()).not.toBeNull();

    // Metropolenwahl -> Rittermodus.
    await userEvent.click(screen.getByTestId('knight-move'));
    expect(metropolisBar()).toBeNull();
    expect(knightBar()?.textContent).toContain('eigenen Ritter wählen');
  });

  /*
   * Der Stadtausbau am Bildschirm - dasselbe Zwei-Karten-Muster wie bei den
   * Rittern (`targets.ts`): derselbe Bereich führt je nach Stand entweder
   * sofort zu einem Zug oder erst zur Suche nach der fälligen Stadt.
   */
  describe('und der Stadtausbau', () => {
    it('laesst beim Ausbau mit Aufsatz die eigenen freien Staedte leuchten und zeigt den Hinweis', async () => {
      const base = citiesMainPhase();
      const me = base.players[base.currentPlayerIndex]!.id;
      // Stufe 3 -> 4 bringt den Aufsatz, solange ihn niemand hält.
      const state: GameState = {
        ...base,
        players: base.players.map((player) =>
          player.id === me
            ? { ...player, resources: cardAmounts({ cloth: 4 }), improvements: { trade: 3 } }
            : player,
        ),
      };

      render(<CitiesGame state={state} />);

      await userEvent.click(screen.getByTestId('track-trade-4'));

      const ownFreeCities = new Set(
        Object.entries(state.buildings)
          .filter(
            ([, building]) =>
              building.owner === me && building.kind === 'city' && building.metropolis === null,
          )
          .map(([vertex]) => `vertex-${vertex}`),
      );

      // Aus der Gründung an einem Städte-&-Ritter-Tisch steht bereits eine
      // eigene Stadt (die zweite Setzung ist dort eine Stadt und keine
      // Siedlung) - sonst würde dieser Test nichts prüfen.
      expect(ownFreeCities.size).toBeGreaterThan(0);
      expect(new Set(litVertices())).toEqual(ownFreeCities);
      expect(screen.getByTestId('metropolis-mode').textContent).toContain(
        'Wohin kommt die Metropole?',
      );
    });

    it('schickt einen Ausbau ohne Aufsatz sofort und laesst das Brett ruhig', async () => {
      const base = citiesMainPhase();
      const me = base.players[base.currentPlayerIndex]!.id;
      const state: GameState = {
        ...base,
        players: base.players.map((player) =>
          player.id === me
            ? { ...player, resources: cardAmounts({ cloth: 1 }), improvements: {} }
            : player,
        ),
      };

      render(<CitiesGame state={state} />);

      await userEvent.click(screen.getByTestId('track-trade-1'));

      expect(screen.queryByTestId('metropolis-mode')).toBeNull();
      expect(litVertices()).toEqual([]);
      // Der Zug ist tatsächlich hinausgegangen: die Stufe steht jetzt.
      expect(screen.getByTestId('track-trade-1').getAttribute('data-built')).toBe('true');
    });

    it('zeigt an einem Basistisch kein Fortschritt-Tableau', () => {
      render(<LocalGameFrom state={richMainPhase()} />);

      expect(screen.queryByTestId('track-trade-1')).toBeNull();
    });
  });

  /*
   * Die drei Wartestationen eines Wurfs (Etappe 10d) - jede ueber die echte
   * lokale Partie (`CitiesGame`/`useLocalGame`) und den echten Reducer, nicht
   * ueber einen nachgebauten Effekt: die Falle "tote Funktion" aus den
   * Aufgabenhinweisen. Ein Klick, der wirklich ankommt, laesst den zugehoerigen
   * Dialog verschwinden - bliebe er stehen, haette der Reducer den Zug
   * abgewiesen.
   */
  describe('die drei Wartestationen eines Wurfs', () => {
    it('laesst in progressDiscardPending genau eine Karte zurueckgeben', async () => {
      const base = citiesMainPhase();
      // `pending` legt fest, wer die Sicht bekommt (Ruling 27) - unabhaengig
      // von `currentPlayerIndex` und der Sitzordnung nach dem Auftakt.
      const me = base.players[0]!.id;
      const state: GameState = {
        ...base,
        phase: { kind: 'progressDiscardPending', pending: [me] },
        players: base.players.map((player) =>
          player.id === me ? { ...player, progressCards: ['crane'] } : player,
        ),
      };

      render(<CitiesGame state={state} />);

      const dialog = screen.getByRole('dialog', { name: 'Fortschrittskarte abgeben' });

      // "Kran" steht doppelt da: einmal spielbar auf der eigenen Hand
      // (`ProgressPanel`), einmal als Abgabewahl im Dialog - hier zaehlt nur
      // Letzteres.
      await userEvent.click(within(dialog).getByRole('button', { name: 'Kran' }));

      // Der Dialog verschwindet nur, wenn der Reducer die Abgabe angenommen
      // und die Phase weitergeschaltet hat (`continueAfterProgressDiscard`).
      expect(screen.queryByRole('dialog', { name: 'Fortschrittskarte abgeben' })).toBeNull();
    });

    it('laesst bei defenderPending einen Stapel waehlen - und zeigt den Dialog dem Wartenden, nicht dem Spieler am Zug (Ruling 27)', async () => {
      const base = citiesMainPhase();
      const waiting = citiesSeats[1]!.id;
      const state: GameState = {
        ...base,
        // p1 (Index 0) waere "am Zug" - handeln muss aber der Vorderste der
        // Warteschlange, citiesSeats[1]. Vor Ruling 27 hätte der Bildschirm
        // hier p1 aufgedeckt, und der Dialog wäre nie erschienen.
        currentPlayerIndex: 0,
        phase: { kind: 'defenderPending', pending: [waiting] },
      };

      render(<CitiesGame state={state} />);

      expect(screen.getByRole('dialog', { name: 'Fortschrittsstapel wählen' })).toBeDefined();

      await userEvent.click(screen.getByRole('button', { name: /Wissenschaft/ }));

      expect(screen.queryByRole('dialog', { name: 'Fortschrittsstapel wählen' })).toBeNull();
    });

    it('laesst am Aquaedukt den Rohstoff waehlen', async () => {
      const base = citiesMainPhase();
      const me = base.players[0]!.id;
      const state: GameState = {
        ...base,
        phase: { kind: 'aqueductPending', pending: [me] },
      };

      render(<CitiesGame state={state} />);

      const dialog = screen.getByRole('dialog', { name: 'Aquädukt: welcher Rohstoff?' });
      expect(dialog).toBeDefined();

      await userEvent.click(screen.getByTestId('pick-ore'));
      await userEvent.click(screen.getByRole('button', { name: 'Karte spielen' }));

      expect(screen.queryByRole('dialog', { name: 'Aquädukt: welcher Rohstoff?' })).toBeNull();
    });

    /*
     * Fixrunde 1, WICHTIG 1: das Aquaedukt ist eine Pflichtwahl - es darf am
     * echten Bildschirm kein Bedienelement geben, das einen Schliessweg
     * verspricht (weder das X aus CloseButton noch "Abbrechen" noch Escape).
     */
    it('bietet am Aquaedukt-Dialog keinen Schliessweg - es gibt nichts abzubrechen', async () => {
      const base = citiesMainPhase();
      const me = base.players[0]!.id;
      const state: GameState = {
        ...base,
        phase: { kind: 'aqueductPending', pending: [me] },
      };

      render(<CitiesGame state={state} />);

      const dialog = screen.getByRole('dialog', { name: 'Aquädukt: welcher Rohstoff?' });

      expect(within(dialog).queryByTestId('modal-close')).toBeNull();
      expect(within(dialog).queryByRole('button', { name: 'Abbrechen' })).toBeNull();
      expect(within(dialog).queryByRole('button', { name: /schließen/i })).toBeNull();

      await userEvent.keyboard('{Escape}');

      // Escape haengt an CloseButton, das hier gar nicht gerendert wird -
      // der Dialog steht unveraendert.
      expect(screen.getByRole('dialog', { name: 'Aquädukt: welcher Rohstoff?' })).toBeDefined();
    });
  });

  describe('Haendler und Bischof: Absichten vier und fuenf', () => {
    it('beginnt am Feld neben einer eigenen Siedlung oder Stadt und spielt den Haendler dorthin', async () => {
      const base = citiesMainPhase();
      const me = base.players[base.currentPlayerIndex]!.id;
      const state: GameState = {
        ...base,
        players: base.players.map((player) =>
          player.id === me ? { ...player, progressCards: ['merchant'] } : player,
        ),
      };

      const { container } = render(<CitiesGame state={state} />);

      await userEvent.click(screen.getByRole('button', { name: /Händler/ }));

      expect(screen.getByTestId('progress-hex-mode')).toBeDefined();

      // Irgendein Feld leuchtet - `merchantTargets` fand mindestens eins neben
      // der eigenen Gruendungsstadt.
      const litHex = container.querySelector('[data-testid^="hex-"][data-target="true"]');
      expect(litHex).not.toBeNull();

      const hexId = litHex!.getAttribute('data-testid')!.replace('hex-', '');
      placeHex(container, hexId);

      // Nach dem Zug ist die Karte gespielt: der Modus-Balken ist weg, und
      // die Karte liegt nicht mehr auf der Hand.
      expect(screen.queryByTestId('progress-hex-mode')).toBeNull();
      expect(screen.queryByRole('button', { name: /Händler/ })).toBeNull();
    });
  });
});

it('zeigt an einem Basistisch keine Fortschrittsstapel', () => {
  render(<LocalGame />);

  expect(screen.queryByText('Fortschritt')).toBeNull();
});
