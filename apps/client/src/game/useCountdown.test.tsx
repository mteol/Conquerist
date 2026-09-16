// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import type { PlayerView } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { secondsLeft, useCountdown } from './useCountdown';

/** So viel Sicht, wie `deadlineOf` liest. */
function waitingView(version: number): PlayerView {
  return {
    version,
    phase: { kind: 'discardPending', pending: ['p2'], counts: {}, resume: 'seven' },
    players: [{ id: 'p1' }, { id: 'p2' }],
    currentPlayerIndex: 0,
    rules: { pendingAnswerMs: 60_000 },
  } as never;
}

function Probe({
  view,
  clockOffset = 0,
  dueAt,
}: {
  readonly view: PlayerView;
  readonly clockOffset?: number;
  readonly dueAt?: number | null;
}) {
  return <span data-testid="left">{String(useCountdown(view, clockOffset, dueAt))}</span>;
}

describe('secondsLeft', () => {
  it('rechnet einen Zeitpunkt gegen die Serveruhr', () => {
    expect(secondsLeft({ kind: 'at', at: 10_000, owner: 'p1' }, 0, 4_000, 1_000)).toBe(5);
  });

  it('rechnet eine Dauer ab der Ankunft des Standes und nie negativ', () => {
    expect(secondsLeft({ kind: 'after', ms: 60_000, owner: 'p1' }, 1_000, 31_000, 0)).toBe(30);
    expect(secondsLeft({ kind: 'after', ms: 60_000, owner: 'p1' }, 0, 90_000, 0)).toBe(0);
  });
});

describe('useCountdown', () => {
  it('zählt die Antwortfrist herunter und beginnt mit jedem neuen Stand von vorn', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Probe view={waitingView(1)} />);
      expect(screen.getByTestId('left').textContent).toBe('60');

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.getByTestId('left').textContent).toBe('50');

      act(() => {
        rerender(<Probe view={waitingView(2)} />);
      });
      expect(screen.getByTestId('left').textContent).toBe('60');
    } finally {
      vi.useRealTimers();
    }
  });

  it('meldet null, wenn keine Frist läuft', () => {
    render(<Probe view={{ ...waitingView(1), phase: { kind: 'main' } } as never} />);
    expect(screen.getByTestId('left').textContent).toBe('null');
  });

  /*
   * Online sagt der Server, wann die Frist fällig ist. Wiederverbinden, Beitritt
   * und Umbenennen bringen eine neue Version ohne Zug - die Anzeige darf dabei
   * nicht auf die volle Frist zurückspringen.
   */
  it('setzt die Frist bei neuer Version und unverändertem Fälligkeitszeitpunkt nicht zurück', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const { rerender } = render(<Probe view={waitingView(1)} dueAt={60_000} />);
      expect(screen.getByTestId('left').textContent).toBe('60');

      act(() => {
        vi.advanceTimersByTime(45_000);
      });
      expect(screen.getByTestId('left').textContent).toBe('15');

      act(() => {
        rerender(<Probe view={waitingView(2)} dueAt={60_000} />);
      });
      expect(screen.getByTestId('left').textContent).toBe('15');
    } finally {
      vi.useRealTimers();
    }
  });

  it('zeigt einem zurückkehrenden Client die echte Restzeit, auch mit Uhrversatz', () => {
    vi.useFakeTimers();
    // Die eigene Uhr geht fünf Sekunden nach: Serverzeit 45 000, hier 40 000.
    vi.setSystemTime(40_000);
    try {
      render(<Probe view={waitingView(7)} clockOffset={5_000} dueAt={60_000} />);
      expect(screen.getByTestId('left').textContent).toBe('15');
    } finally {
      vi.useRealTimers();
    }
  });
});
