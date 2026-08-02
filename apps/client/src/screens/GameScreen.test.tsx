// @vitest-environment jsdom
import type { JSX } from 'react';
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

    expect(screen.getAllByText(/Gruendung/).length).toBeGreaterThan(0);
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
    expect(screen.getAllByText(/Strasse/).length).toBeGreaterThan(0);
  });

  it('schreibt jeden Zug in den Verlauf', async () => {
    render(<LocalGame />);

    await userEvent.click(screen.getByTestId(`vertex-${firstSetupVertex()}`));

    expect(screen.getByText(/setzt die Gruendungssiedlung/)).toBeDefined();
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

    expect(screen.getByRole('button', { name: 'Wuerfeln' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Zug beenden' })).toHaveProperty('disabled', true);
    expect(
      screen.getAllByTestId(/^(vertex|edge)-/).filter((node) => node.dataset['target'] === 'true'),
    ).toHaveLength(0);
  });
});
