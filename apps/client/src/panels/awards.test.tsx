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
import { render, screen } from '../test/dom';
import { defaultSeats } from '../seats';
import { afterOpening } from '../test/opening';
import { useLocalGame } from '../game/useLocalGame';
import { GameScreen } from '../screens/GameScreen';

const scenario = generateScenario(CLASSIC_34, 'awards-screen');
const seats = defaultSeats(3);

const start = afterOpening(
  createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'awards-screen',
  ),
);

/**
 * Hauptphase, der Erste der Reihe am Zug - der Rest wird je Test gesetzt.
 *
 * **Die Reihenfolge kommt aus der Partie und nicht aus `defaultSeats`.** Der
 * Auftakt wuerfelt aus, wer beginnt, und ordnet `players` danach um; wer hier
 * `ids[0]` fuer „ich" haelt, prueft je nach Seed die Zeile eines Mitspielers.
 * Genau das ist in der ersten Fassung dieser Datei passiert.
 */
function mainPhase(patch: Partial<GameState> = {}): GameState {
  let state = start;
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return { ...state, phase: { kind: 'main' }, currentPlayerIndex: 0, ...patch };
}

/** Wer am Zug ist, sieht zu - die lokale Partie zeigt die Sicht des Handelnden. */
const viewerOf = (state: GameState): string => state.players[0]!.id;
const otherOf = (state: GameState): string => state.players[1]!.id;
const nameOf = (id: string): string => seats.find((seat) => seat.id === id)!.name;

function Screen({ state }: { readonly state: GameState }): JSX.Element {
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
 * Die Auszeichnungen liegen an genau einem Ort, und der Ort sagt, wem sie
 * gehoeren. Genau das pruefen diese Tests: nicht nur, dass etwas erscheint,
 * sondern dass es an den beiden anderen Stellen **nicht** erscheint. Eine
 * Karte, die gleichzeitig in der Mitte und vor jemandem liegt, ist keine
 * Karte mehr.
 */
describe('Auszeichnungen auf dem Tisch', () => {
  it('liegen zu Beginn frei in der rechten Ecke, mit ihrer Bedingung', () => {
    render(<Screen state={mainPhase()} />);

    expect(screen.getByTestId('award-open-longestRoad')).toBeDefined();
    expect(screen.getByTestId('award-open-largestArmy')).toBeDefined();
    expect(screen.getByText('ab 5 Straßen')).toBeDefined();
    expect(screen.getByText('ab 3 Ritter')).toBeDefined();

    expect(screen.queryByTestId('award-mine-longestRoad')).toBeNull();
    expect(screen.queryAllByTestId(/^seat-award-/)).toHaveLength(0);
  });

  it('wandern in die eigene Ablage und verschwinden dabei aus der Mitte', () => {
    const state = mainPhase();
    const me = viewerOf(state);

    render(<Screen state={{ ...state, longestRoad: { holder: me, length: 6 } }} />);

    const card = screen.getByTestId('award-mine-longestRoad');
    expect(card.textContent).toContain('Handelsstraße');
    expect(card.textContent).toContain('6 Straßen');

    expect(screen.queryByTestId('award-open-longestRoad')).toBeNull();
    // Die Rittermacht liegt weiter frei - eine Auszeichnung zieht die andere nicht mit.
    expect(screen.getByTestId('award-open-largestArmy')).toBeDefined();

    /*
     * Und sie steht **nicht** noch einmal in der eigenen Sitzzeile. Die Karte
     * unten links ist die Auskunft; dieselbe Sache zweimal auf einem Bildschirm
     * ist eine Stelle zu viel, an der sie auseinanderlaufen koennte.
     */
    expect(screen.queryByTestId(`seat-award-longestRoad-${me}`)).toBeNull();
  });

  it('stehen bei einem Mitspieler als Plakette neben seinem Namen', () => {
    const state = mainPhase();
    const other = otherOf(state);

    render(<Screen state={{ ...state, largestArmy: { holder: other, size: 3 } }} />);

    const mark = screen.getByTestId(`seat-award-largestArmy-${other}`);
    expect(mark.getAttribute('title')).toContain('Größte Rittermacht');
    expect(mark.getAttribute('title')).toContain(nameOf(other));

    expect(screen.queryByTestId('award-open-largestArmy')).toBeNull();
    expect(screen.queryByTestId('award-mine-largestArmy')).toBeNull();
  });
});

/**
 * Die Ritterzahl ist ein Zaehler und kein Besitz - sie steht deshalb bei
 * **allen**, auch bei einem selbst. Ausgespielte Ritter sind aus der Hand
 * verschwunden; ohne diese Plakette steht nirgends, wie viele es waren, und
 * genau daran haengt, ob sich der naechste lohnt.
 */
describe('Ausgespielte Ritter', () => {
  it('stehen bei jedem, der welche gespielt hat - auch beim Empfaenger selbst', () => {
    const state = mainPhase();
    const withKnights: GameState = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0
          ? { ...player, playedKnights: 2 }
          : index === 1
            ? { ...player, playedKnights: 3 }
            : player,
      ),
    };

    render(<Screen state={withKnights} />);

    expect(screen.getByTestId(`seat-knights-${viewerOf(state)}`).getAttribute('title')).toBe(
      '2 ausgespielte Ritter',
    );
    expect(screen.getByTestId(`seat-knights-${otherOf(state)}`).getAttribute('title')).toBe(
      '3 ausgespielte Ritter',
    );
  });

  it('fehlen, solange niemand einen Ritter gespielt hat', () => {
    render(<Screen state={mainPhase()} />);

    expect(screen.queryAllByTestId(/^seat-knights-/)).toHaveLength(0);
  });
});
