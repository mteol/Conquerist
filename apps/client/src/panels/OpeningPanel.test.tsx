// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  playerViewOf,
  reduce,
  type GameState,
} from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { defaultSeats } from '../seats';
import { gameViewOf } from '../game/view';
import { afterOpening } from '../test/opening';
import { OpeningPanel } from './OpeningPanel';

const scenario = generateScenario(CLASSIC_34, 'auftakt-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

const start = createGame(scenario, CLASSIC_RULES, ids, 'auftakt-probe');

/** Wuerfelt `count` Spieler des Auftakts ab. */
function rolled(count: number): GameState {
  let state = start;

  for (let n = 0; n < count; n += 1) {
    if (state.phase.kind !== 'opening') break;
    const player = state.phase.pending[0]!;
    const result = reduce(state, { type: 'rollDice', player });
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

const viewOf = (state: GameState) => gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

describe('OpeningPanel', () => {
  it('zeichnet nichts, wenn kein Auftakt laeuft', () => {
    const { container } = render(<OpeningPanel view={viewOf(afterOpening(start))} />);

    expect(container.innerHTML).toBe('');
  });

  it('nennt alle Mitspieler, auch die noch nicht geworfen haben', () => {
    render(<OpeningPanel view={viewOf(start)} />);

    for (const seat of seats) {
      expect(screen.getByText(seat.name)).toBeDefined();
    }
  });

  it('zeigt die Summe dessen, der schon geworfen hat', () => {
    const state = rolled(1);
    const view = viewOf(state);
    const werfer = [...view.opening!.totals.keys()][0]!;
    const summe = view.opening!.totals.get(werfer)!;

    render(<OpeningPanel view={view} />);

    expect(screen.getByTestId(`opening-total-${werfer}`).textContent).toBe(String(summe));
  });

  it('laesst die Zeile dessen leer, der noch nicht geworfen hat', () => {
    const view = viewOf(start);

    render(<OpeningPanel view={view} />);

    expect(screen.getByTestId(`opening-total-${ids[2]!}`).textContent).not.toMatch(/\d/);
  });

  it('markiert den, der gerade wirft', () => {
    const view = viewOf(start);

    render(<OpeningPanel view={view} />);

    expect(
      screen.getByTestId(`opening-seat-${view.actingPlayers[0]!}`).getAttribute('data-active'),
    ).toBe('true');
  });

  it('sagt beim Stechen, dass es eines ist', () => {
    const state = start;
    if (state.phase.kind !== 'opening') throw new Error('Die Partie beginnt im Auftakt');
    const stechen: GameState = {
      ...state,
      phase: { kind: 'opening', rolls: {}, pending: [ids[0]!, ids[1]!], round: 1 },
    };

    render(<OpeningPanel view={viewOf(stechen)} />);

    expect(screen.getByText(/Stechen/)).toBeDefined();
  });

  it('fragt in der ersten Runde, wer beginnt', () => {
    render(<OpeningPanel view={viewOf(start)} />);

    expect(screen.getByText(/Wer beginnt/)).toBeDefined();
  });
});
