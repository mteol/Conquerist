// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  setupPlayer,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { GameScreen } from './GameScreen';

const scenario = generateScenario(CLASSIC_34, 'screen-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'screen-probe',
);

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
    render(<GameScreen game={start} seats={seats} onLeave={vi.fn()} />);

    expect(screen.getAllByText(/Gruendung/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('seat-p1')).toBeDefined();
  });

  it('setzt auf Klick eine Siedlung und schaltet auf die Strasse weiter', async () => {
    render(<GameScreen game={start} seats={seats} onLeave={vi.fn()} />);

    await userEvent.click(screen.getByTestId(`vertex-${firstSetupVertex()}`));

    // Nach der Siedlung leuchten nur noch die anschliessenden Kanten.
    expect(
      screen.getAllByTestId(/^vertex-/).filter((node) => node.dataset['target'] === 'true'),
    ).toHaveLength(0);
    expect(
      screen.getAllByTestId(/^edge-/).filter((node) => node.dataset['target'] === 'true').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Strasse/).length).toBeGreaterThan(0);
  });

  it('schreibt jeden Zug in den Verlauf', async () => {
    render(<GameScreen game={start} seats={seats} onLeave={vi.fn()} />);

    await userEvent.click(screen.getByTestId(`vertex-${firstSetupVertex()}`));

    expect(screen.getByText(/setzt die Gruendungssiedlung/)).toBeDefined();
  });

  it('sperrt das Bauen, solange nicht gewuerfelt ist', async () => {
    render(<GameScreen game={start} seats={seats} onLeave={vi.fn()} />);

    // Gruendungsphase durchklicken: immer das erste angebotene Ziel.
    for (let step = 0; step < 12; step += 1) {
      const target = screen
        .getAllByTestId(/^(vertex|edge)-/)
        .find((node) => node.dataset['target'] === 'true');
      if (target === undefined) break;
      await userEvent.click(target);
    }

    expect(screen.getByRole('button', { name: 'Wuerfeln' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Zug beenden' })).toHaveProperty('disabled', true);
    expect(
      screen.getAllByTestId(/^(vertex|edge)-/).filter((node) => node.dataset['target'] === 'true'),
    ).toHaveLength(0);
  });
});
