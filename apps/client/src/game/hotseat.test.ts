import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  replay,
  setupPlayer,
  type GameAction,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { hotseatReducer, startHotseat, type HotseatState } from './hotseat';

const scenario = generateScenario(CLASSIC_34, 'hotseat-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'hotseat-probe',
);

const apply = (state: HotseatState, action: GameAction): HotseatState =>
  hotseatReducer(state, { type: 'apply', action }, seats);

describe('Hotseat-Zustand', () => {
  it('beginnt ohne Aktionen, ohne Verlauf und ohne Fehler', () => {
    const state = startHotseat(start);

    expect(state.game).toBe(start);
    expect(state.actions).toHaveLength(0);
    expect(state.log).toHaveLength(0);
    expect(state.lastError).toBeNull();
    expect(state.sound).toBeNull();
  });

  it('legt den Klang zum Zug ab und zaehlt ihn hoch', () => {
    const first = apply(startHotseat(start), legalActions(start, setupPlayer(start)!)[0]!);

    // Die erste Setzung ist eine Siedlung - dieselbe Handlung wie ein Bau, also
    // derselbe Klang.
    expect(first.sound?.sounds.map((sound) => sound.cue)).toEqual(['build.settlement']);
    expect(first.sound?.seq).toBe(1);

    const second = apply(first, legalActions(first.game, setupPlayer(first.game)!)[0]!);

    expect(second.sound?.seq).toBe(2);
  });

  it('laesst den letzten Klang stehen, wenn ein Zug abgelehnt wird', () => {
    const built = apply(startHotseat(start), legalActions(start, setupPlayer(start)!)[0]!);
    const rejected = apply(built, { type: 'endTurn', player: 'p1' });

    // Kein neuer Klang, aber auch kein Ruecksetzen: auf `null` zurueckgestellt
    // waere derselbe Klang beim naechsten gueltigen Zug ein zweites Mal faellig.
    expect(rejected.sound).toBe(built.sound);
  });

  it('haengt jede angenommene Aktion an Folge und Verlauf', () => {
    const state = apply(startHotseat(start), legalActions(start, setupPlayer(start)!)[0]!);

    expect(state.actions).toHaveLength(1);
    expect(state.log).toHaveLength(1);
    expect(state.log[0]!.text).toContain('Spieler 1');
    expect(state.game).not.toBe(start);
  });

  it('haelt eine abgelehnte Aktion fest, ohne den Zustand anzufassen', () => {
    const before = startHotseat(start);
    const state = apply(before, { type: 'endTurn', player: 'p1' });

    expect(state.game).toBe(before.game);
    expect(state.actions).toHaveLength(0);
    expect(state.lastError).not.toBeNull();
  });

  it('raeumt die Fehlermeldung wieder weg', () => {
    const failed = apply(startHotseat(start), { type: 'endTurn', player: 'p1' });
    const cleared = hotseatReducer(failed, { type: 'dismissError' }, seats);

    expect(cleared.lastError).toBeNull();
  });

  it('sammelt eine Folge, aus der replay denselben Zustand baut', () => {
    let state = startHotseat(start);

    for (let step = 0; step < 40 && state.game.phase.kind !== 'finished'; step += 1) {
      const player =
        state.game.phase.kind === 'setup'
          ? setupPlayer(state.game)!
          : state.game.players[state.game.currentPlayerIndex]!.id;
      const options = legalActions(state.game, player);
      const action = options[options.length - 1];
      if (action === undefined) break;
      state = apply(state, action);
    }

    expect(state.actions.length).toBeGreaterThan(5);

    // `replay` gibt ein ReduceResult zurueck, keinen Zustand - der abgelehnte
    // Fall ist dort ein normaler Ausgang und kein Wurf.
    const replayed = replay(start, state.actions);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state.game);
  });
});
