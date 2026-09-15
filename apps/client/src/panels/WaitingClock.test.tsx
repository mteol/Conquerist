// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { WaitingClock } from './WaitingClock';

function viewIn(phase: unknown): PlayerView {
  return {
    version: 1,
    phase,
    players: [{ id: 'p1' }, { id: 'p2' }],
    currentPlayerIndex: 0,
    rules: { pendingAnswerMs: 60_000 },
  } as never;
}

describe('WaitingClock', () => {
  it('zeigt in einer Wartephase die Restzeit', () => {
    render(
      <WaitingClock
        view={viewIn({ kind: 'aqueductPending', pending: ['p2'] })}
        clockOffset={0}
      />,
    );
    expect(screen.getByTestId('waiting-clock').textContent).toBe('Noch 60 Sekunden');
  });

  it('schweigt in der Hauptphase', () => {
    render(<WaitingClock view={viewIn({ kind: 'main' })} clockOffset={0} />);
    expect(screen.queryByTestId('waiting-clock')).toBeNull();
  });

  /* Beim Angebot steht die Uhr im Dialog - zweimal dieselbe Zahl wäre eine Verdopplung. */
  it('schweigt beim Angebot', () => {
    const offer = {
      kind: 'tradePending',
      offer: { from: 'p1', give: {}, want: {} },
      responses: {},
      expiresAt: Date.now() + 30_000,
    };
    render(<WaitingClock view={viewIn(offer)} clockOffset={0} />);
    expect(screen.queryByTestId('waiting-clock')).toBeNull();
  });
});
