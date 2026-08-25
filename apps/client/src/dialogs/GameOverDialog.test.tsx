// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  playerViewOf,
  type PlayerView,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { GameOverDialog } from './GameOverDialog';

const seats = defaultSeats(3);

/**
 * Eine beendete Partie mit einer erfundenen Wurfgeschichte.
 *
 * Die Zaehlung wird hier gesetzt und nicht erwuerfelt: der Dialog soll zeigen,
 * was im Zustand steht, und ein Test, der erst zweihundert Wuerfe braucht, um
 * eine Verteilung zu bekommen, prueft den Zufall statt die Anzeige.
 */
function finishedView(tally: Record<string, number>): PlayerView {
  const state = createGame(
    generateScenario(CLASSIC_34, 'ende-probe'),
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'ende-probe',
  );

  const finished = {
    ...state,
    phase: { kind: 'finished' as const, winner: state.players[1]!.id },
    rollTally: tally,
  };

  return playerViewOf(
    finished,
    state.players[0]!.id,
    seats.map((seat) => ({ id: seat.id, name: seat.name, color: seat.color })),
    1,
  );
}

describe('Endbildschirm', () => {
  it('nennt den Sieger', () => {
    render(<GameOverDialog view={finishedView({ '6': 3 })} onClose={vi.fn()} />);

    expect(screen.getByTestId('over-winner').textContent).toContain(seats[1]!.name);
  });

  it('fuehrt jeden Spieler mit seinen Siegpunkten auf', () => {
    render(<GameOverDialog view={finishedView({ '6': 3 })} onClose={vi.fn()} />);

    for (const seat of seats) {
      expect(screen.getByTestId(`over-player-${seat.id}`)).toBeDefined();
    }
  });

  /*
   * Elf Balken, von der Zwei bis zur Zwoelf - auch die, die nie fielen. Eine
   * Verteilung mit Luecken waere keine Verteilung, sondern eine Liste.
   */
  it('zeigt jede moegliche Wurfsumme, auch die ungewuerfelten', () => {
    render(<GameOverDialog view={finishedView({ '6': 3 })} onClose={vi.fn()} />);

    for (let total = 2; total <= 12; total += 1) {
      expect(screen.getByTestId(`over-roll-${total}`)).toBeDefined();
    }
    expect(screen.getByTestId('over-roll-2').textContent).toContain('0');
  });

  it('nennt zu jeder Zahl, wie oft sie fiel', () => {
    render(<GameOverDialog view={finishedView({ '6': 3, '8': 5 })} onClose={vi.fn()} />);

    expect(screen.getByTestId('over-roll-6').textContent).toContain('3');
    expect(screen.getByTestId('over-roll-8').textContent).toContain('5');
  });

  it('laesst sich schliessen', async () => {
    const onClose = vi.fn();
    render(<GameOverDialog view={finishedView({ '6': 3 })} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /Endstand/ }));

    expect(onClose).toHaveBeenCalled();
  });
});
