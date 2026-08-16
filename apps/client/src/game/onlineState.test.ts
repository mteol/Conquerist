import { describe, expect, it } from 'vitest';
import { emptyOnlineState, onlineReducer } from './onlineState';
import type { PlayerView } from '@conquerist/shared';

const view = (version: number): PlayerView =>
  ({
    you: 'u1',
    version,
    players: [{ id: 'u1', cardCount: 0 }],
    currentPlayerIndex: 0,
    phase: { kind: 'main' },
    lastRoll: null,
    turn: 0,
  }) as unknown as PlayerView;

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

  it('macht aus dem gemeldeten Zug einen Klang', () => {
    const state = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: {
        version: 4,
        view: view(4),
        actions: [],
        sentAt: 0,
        entry: 'Ben baut eine Stadt',
        move: { type: 'buildCity', actor: 'u2' },
      },
    });

    expect(state.sound?.sounds.map((sound) => sound.cue)).toEqual(['build.city']);
    // Der Zug kam von jemand anderem - also gedaempft.
    expect(state.sound?.sounds[0]!.gain).toBeLessThan(1);
    expect(state.sound?.seq).toBe(4);
  });

  it('bleibt still, wenn kein Zug gemeldet wurde', () => {
    const state = onlineReducer(emptyOnlineState, {
      type: 'game',
      payload: { version: 1, view: view(1), actions: [], sentAt: 0 },
    });

    expect(state.sound).toBeNull();
  });
});
