import { describe, expect, it } from 'vitest';
import { emptyOnlineState, onlineReducer } from './onlineState';
import type { PlayerView } from '@conquerist/shared';

const view = (version: number): PlayerView =>
  ({ you: 'u1', version, players: [], turn: 0 }) as unknown as PlayerView;

describe('Online-Zustand', () => {
  it('uebernimmt einen neueren Stand', () => {
    const state = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 5, view: view(5), actions: [], sentAt: 0 },
    });

    expect(state.view?.version).toBe(5);
  });

  it('verwirft einen aelteren Stand', () => {
    const newer = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 5, view: view(5), actions: [], sentAt: 0 },
    });

    // Nach einem Reconnect koennen zwei Staende dicht hintereinander
    // eintreffen - der aeltere darf den neueren nicht ueberschreiben.
    const older = onlineReducer(newer, {
      type: 'game',
      payload: { version: 4, view: view(4), actions: [], sentAt: 0 },
    });

    expect(older.view?.version).toBe(5);
    expect(older).toBe(newer);
  });

  it('raeumt beim Verlassen alles weg, was zum Tisch gehoerte', () => {
    const running = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 2, view: view(2), actions: [], sentAt: 0, entry: 'Anna wuerfelt 8' },
    });

    const left = onlineReducer(running, { type: 'left' });

    expect(left.room).toBeNull();
    expect(left.view).toBeNull();
    expect(left.actions).toHaveLength(0);
    expect(left.log).toHaveLength(0);
  });

  it('haengt Verlaufssaetze an, wenn sie mitkommen', () => {
    const first = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 1, view: view(1), actions: [], sentAt: 0, entry: 'Anna wuerfelt 8' },
    });

    expect(first.log).toHaveLength(1);
    expect(first.log[0]!.text).toBe('Anna wuerfelt 8');
  });
});
