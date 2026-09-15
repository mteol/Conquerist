// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
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
import { cardAmounts } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { defaultSeats } from '../seats';
import { useHotseatGame } from './useHotseatGame';

/**
 * Die lokale Partie vollstreckt ihre Frist selbst.
 *
 * Online wirft der Wecker im Server `timeout` ein; lokal gibt es keinen Server,
 * und ohne diesen Haken liefe der Countdown im Angebotsdialog ins Leere.
 */
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function withOpenOffer(): GameState {
  let state = createGame(generateScenario(CLASSIC_34, 'uhr'), CLASSIC_RULES, ids, 'uhr');
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  const main: GameState = {
    ...state,
    phase: { kind: 'main' },
    currentPlayerIndex: 0,
    players: state.players.map((player, index) => ({
      ...player,
      resources:
        index === 0
          ? cardAmounts({ brick: 0, lumber: 3, wool: 0, grain: 0, ore: 0 })
          : cardAmounts({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 2 }),
    })),
  };

  const offered = reduce(main, {
    type: 'offerTrade',
    player: ids[0]!,
    give: cardAmounts({ brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 }),
    want: cardAmounts({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 }),
    at: Date.now(),
  });
  if (!offered.ok) throw new Error(offered.error.message);
  return offered.state;
}

function withDiscard(): GameState {
  const state = createGame(generateScenario(CLASSIC_34, 'uhr'), CLASSIC_RULES, ids, 'uhr');
  return {
    ...state,
    phase: { kind: 'discardPending', pending: [ids[1]!], counts: {}, resume: 'seven' },
    currentPlayerIndex: 0,
    players: state.players.map((player) =>
      player.id === ids[1]
        ? { ...player, resources: cardAmounts({ brick: 0, lumber: 8, wool: 0, grain: 0, ore: 0 }) }
        : player,
    ),
  };
}

function Probe({ game }: { readonly game: GameState }) {
  const hotseat = useHotseatGame(game, seats);
  return <span data-testid="phase">{hotseat.state.game.phase.kind}</span>;
}

describe('die lokale Uhr', () => {
  it('wirft timeout ein, sobald die Frist um ist', () => {
    vi.useFakeTimers();
    try {
      const game = withOpenOffer();
      render(<Probe game={game} />);

      expect(screen.getByTestId('phase').textContent).toBe('tradePending');

      act(() => {
        vi.advanceTimersByTime(CLASSIC_RULES.tradeOfferMs + 1_000);
      });

      expect(screen.getByTestId('phase').textContent).toBe('main');
    } finally {
      vi.useRealTimers();
    }
  });

  it('laesst das Angebot vor Ablauf stehen', () => {
    vi.useFakeTimers();
    try {
      render(<Probe game={withOpenOffer()} />);

      act(() => {
        vi.advanceTimersByTime(CLASSIC_RULES.tradeOfferMs - 5_000);
      });

      expect(screen.getByTestId('phase').textContent).toBe('tradePending');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('die lokale Uhr in einer Wartephase', () => {
  it('nimmt nach der Antwortfrist das Abwerfen ab', () => {
    vi.useFakeTimers();
    try {
      render(<Probe game={withDiscard()} />);
      expect(screen.getByTestId('phase').textContent).toBe('discardPending');

      act(() => {
        vi.advanceTimersByTime(CLASSIC_RULES.pendingAnswerMs + 1_000);
      });

      expect(screen.getByTestId('phase').textContent).toBe('robberPending');
    } finally {
      vi.useRealTimers();
    }
  });

  it('wartet vor Ablauf', () => {
    vi.useFakeTimers();
    try {
      render(<Probe game={withDiscard()} />);

      act(() => {
        vi.advanceTimersByTime(CLASSIC_RULES.pendingAnswerMs - 5_000);
      });

      expect(screen.getByTestId('phase').textContent).toBe('discardPending');
    } finally {
      vi.useRealTimers();
    }
  });
});
