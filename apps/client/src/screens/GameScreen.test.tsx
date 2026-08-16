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

describe('GameScreen', () => {
  it('beginnt in der Gruendungsphase beim ersten Spieler', () => {
    render(<LocalGame />);

    expect(screen.getAllByText(/Gründung/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('seat-p1')).toBeDefined();
  });

  it('setzt auf Klick eine Siedlung und schaltet auf die Strasse weiter', async () => {
    render(<LocalGame />);

    await userEvent.click(screen.getByTestId(`vertex-${firstSetupVertex()}`));

    // Nach der Siedlung leuchten nur noch die anschliessenden Kanten.
    expect(
      screen.getAllByTestId(/^vertex-/).filter((node) => node.dataset['target'] === 'true'),
    ).toHaveLength(0);
    expect(
      screen.getAllByTestId(/^edge-/).filter((node) => node.dataset['target'] === 'true').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Straße/).length).toBeGreaterThan(0);
  });

  it('schreibt jeden Zug in den Verlauf', async () => {
    render(<LocalGame />);

    await userEvent.click(screen.getByTestId(`vertex-${firstSetupVertex()}`));

    expect(screen.getByText(/setzt die Gründungssiedlung/)).toBeDefined();
  });

  it('zeigt nur die Hand dessen, der gerade handeln darf', () => {
    render(<LocalGame />);

    // Auch am selben Geraet: der Bildschirm wandert weiter, die Handkarten
    // sollen es nicht. Genau eine offene Hand.
    expect(screen.getAllByTestId(/^hand-p/)).toHaveLength(1);
    expect(screen.getAllByTestId(/^hand-count-/)).toHaveLength(2);
  });

  it('sperrt das Bauen, solange nicht gewuerfelt ist', async () => {
    render(<LocalGame />);

    // Gruendungsphase durchklicken: immer das erste angebotene Ziel.
    for (let step = 0; step < 12; step += 1) {
      const target = screen
        .getAllByTestId(/^(vertex|edge)-/)
        .find((node) => node.dataset['target'] === 'true');
      if (target === undefined) break;
      await userEvent.click(target);
    }

    // Gewuerfelt wird an den Wuerfeln - einen eigenen Knopf dafuer gibt es nicht.
    expect(screen.getByRole('button', { name: 'Würfeln' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Zug beenden' })).toHaveProperty('disabled', true);
    expect(
      screen.getAllByTestId(/^(vertex|edge)-/).filter((node) => node.dataset['target'] === 'true'),
    ).toHaveLength(0);
  });
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

    expect(screen.getByText(/baut eine Straße/)).toBeDefined();
    expect(screen.queryByTestId('build-mode')).toBeNull();
    expect(litUp()).toBe(0);
  });

  /*
   * Die Gruendung bleibt einstufig: dort gibt es genau eine Sache zu setzen,
   * und ein Knopf davor waere ein Schritt, der nichts entscheidet.
   */
  it('laesst die Gruendung ohne Bauwahl leuchten', () => {
    render(<LocalGame />);

    expect(
      screen.getAllByTestId(/^vertex-/).filter((node) => node.dataset['target'] === 'true').length,
    ).toBeGreaterThan(0);
  });

  it('sperrt ein Bauteil, fuer das es keine Stelle gibt', () => {
    render(<LocalGame />);

    // In der Gruendung ist nichts davon ein regulaerer Bau.
    expect(screen.getByTestId('build-road')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('build-settlement')).toHaveProperty('disabled', true);
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
