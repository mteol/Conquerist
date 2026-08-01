// @vitest-environment jsdom
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
import { EMPTY_TARGETS } from '../game/targets';
import { BoardSvg } from './BoardSvg';

/**
 * Regression: gebaute Strassen waren unsichtbar.
 *
 * Der Grund ist eine Falle, die man einmal erlebt haben muss: `.road` setzt in
 * der Stylesheet `stroke: transparent`, damit die freien Kanten unsichtbare
 * Trefferflaechen sind. Eine CSS-Regel schlaegt aber immer das gleichnamige
 * Praesentationsattribut im SVG - `stroke={farbe}` am Element hatte deshalb
 * keine Wirkung, und jede gebaute Strasse blieb durchsichtig.
 *
 * Deshalb prueft dieser Test nicht „hat ein stroke-Attribut", sondern die
 * Eigenschaft, auf die es ankommt: die Farbe steht am Element so, dass die
 * Stylesheet sie nicht uebersteuern kann.
 */

const scenario = generateScenario(CLASSIC_34, 'road-probe');
const seats = defaultSeats(3);

/** Setzt die erste Gruendungssiedlung samt zugehoeriger Strasse. */
function withOneRoad(): { readonly state: GameState; readonly edge: string } {
  let state = createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'road-probe',
  );

  const settlement = legalActions(state, setupPlayer(state)!)[0]!;
  const placed = reduce(state, settlement);
  if (!placed.ok) throw new Error(placed.error.message);
  state = placed.state;

  const road = legalActions(state, setupPlayer(state)!)[0]!;
  if (road.type !== 'placeSetupRoad')
    throw new Error(`Erwartet war eine Strasse, war ${road.type}`);

  const built = reduce(state, road);
  if (!built.ok) throw new Error(built.error.message);

  return { state: built.state, edge: road.edge };
}

describe('Gebaute Strassen', () => {
  it('tragen die Spielerfarbe uebersteuerungssicher am Element', () => {
    const { state, edge } = withOneRoad();

    render(<BoardSvg state={state} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const line = screen.getByTestId(`edge-${edge}`);

    // `style` gewinnt gegen jede Stylesheet-Regel; ein blosses Attribut nicht.
    expect(line.style.stroke).not.toBe('');
    expect(line.style.stroke.replace(/\s/g, '')).toBe('rgb(192,57,43)');
  });

  it('laesst freie Kanten ohne eigene Farbe', () => {
    const { state } = withOneRoad();

    render(<BoardSvg state={state} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const free = screen.getAllByTestId(/^edge-/).filter((element) => element.style.stroke === '');

    // Auf dem Basisbrett gibt es 72 Kanten; genau eine ist bebaut.
    expect(free).toHaveLength(71);
  });
});
