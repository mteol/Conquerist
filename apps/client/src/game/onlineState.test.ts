import { describe, expect, it } from 'vitest';
import { emptyOnlineState, onlineReducer } from './onlineState';
import type { PlayerView } from '@conquerist/shared';

const view = (version: number): PlayerView =>
  ({ you: 'u1', version, players: [], turn: 0 }) as unknown as PlayerView;

describe('Online-Zustand', () => {
  it('uebernimmt einen neueren Stand', () => {
    const state = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 5, view: view(5), actions: [] },
    });

    expect(state.view?.version).toBe(5);
  });

  it('verwirft einen aelteren Stand', () => {
    const newer = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 5, view: view(5), actions: [] },
    });

    // Nach einem Reconnect koennen zwei Staende dicht hintereinander
    // eintreffen - der aeltere darf den neueren nicht ueberschreiben.
    const older = onlineReducer(newer, {
      type: 'game',
      payload: { version: 4, view: view(4), actions: [] },
    });

    expect(older.view?.version).toBe(5);
    expect(older).toBe(newer);
  });

  it('haengt Verlaufssaetze an, wenn sie mitkommen', () => {
    const first = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 1, view: view(1), actions: [], entry: 'Anna wuerfelt 8' },
    });

    expect(first.log).toHaveLength(1);
    expect(first.log[0]!.text).toBe('Anna wuerfelt 8');
  });
});
