// @vitest-environment jsdom
import type { JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  playerViewOf,
  reduce,
  setupPlayer,
  type GameState,
  type PlayerView,
} from '@conquerist/shared';
import { act, render, screen } from '../test/dom';
import { defaultSeats } from '../seats';
import { THROW_MS, useSettledRoll, type Rollable } from './useSettledRoll';
import { afterOpening } from '../test/opening';

/**
 * Der Tisch wartet, solange die Wuerfel fliegen.
 *
 * Geprueft wird nicht, DASS etwas fliegt - eine Animation kann jsdom nicht
 * sehen. Geprueft wird, was daran haengt: **welchen Stand der Bildschirm
 * bekommt und wann.** Genau das ist die Zusage, und sie ist die einzige Stelle,
 * an der ein Fehler stumm bliebe: eine Sekunde falscher Tisch faellt niemandem
 * auf, ein falscher Tisch fuer immer schon.
 */
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);
const scenario = generateScenario(CLASSIC_34, 'wurf-probe');

/** Nach der Gruendung: der erste Spieler muss wuerfeln. */
function beforeRoll(): GameState {
  let state = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'wurf-probe'));
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

/** Derselbe Stand, einen Wurf spaeter. Wer dran ist, sagt die Klickkarte. */
function afterRoll(state: GameState): GameState {
  const roll = ids
    .flatMap((id) => legalActions(state, id))
    .find((action) => action.type === 'rollDice');
  if (roll === undefined) throw new Error('Kein Wurf moeglich');
  const result = reduce(state, roll);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

const viewOf = (state: GameState, version: number): PlayerView =>
  playerViewOf(state, ids[0]!, seats, version);

function pack(view: PlayerView, note: string): Rollable {
  return { view, actions: [], log: [{ turn: view.turn, text: note }], sound: null };
}

/** Zeigt, welchen Stand der Bildschirm gerade bekommt. */
function Harness({ game }: { readonly game: Rollable }): JSX.Element {
  const shown = useSettledRoll(game);

  return (
    <>
      <span data-testid="version">{shown.view?.version ?? -1}</span>
      <span data-testid="log">{shown.log.map((entry) => entry.text).join(',')}</span>
      <span data-testid="landing">{shown.landing === null ? 'nichts' : 'fliegt'}</span>
    </>
  );
}

/**
 * Die Uhr vorstellen - und React die Folgen verarbeiten lassen.
 *
 * `advanceTimersByTime` allein feuert nur den Wecker; was er an Zustand setzt,
 * haengt danach in der Warteschlange. Ohne `act` liest der naechste Blick den
 * Bildschirm von **vor** der Landung, und der Test meldet einen Fehler, den es
 * nicht gibt.
 */
function warte(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Ohne `matchMedia` wartet der Haken nie - das ist seine Voreinstellung und in
 * jsdom der Normalfall. Fuer die Tests wird deshalb eine Vorliebe gestellt, und
 * zwar je Fall eine eigene: erst „Bewegung ist recht", spaeter „bitte weniger".
 */
function prefersMotion(reduced: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  prefersMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSettledRoll', () => {
  it('haelt den Tisch an, bis die Wuerfel liegen', () => {
    const waiting = beforeRoll();
    const rolled = afterRoll(waiting);

    const before = pack(viewOf(waiting, 7), 'Spieler 1 ist am Zug');
    const after = pack(viewOf(rolled, 8), 'Spieler 1 würfelt');

    const { rerender } = render(<Harness game={before} />);
    expect(screen.getByTestId('version').textContent).toBe('7');

    rerender(<Harness game={after} />);

    // Der neue Stand ist da - der Bildschirm zeigt trotzdem noch den alten,
    // samt seinem Verlauf. Nur die Wuerfel wissen schon Bescheid.
    expect(screen.getByTestId('version').textContent).toBe('7');
    expect(screen.getByTestId('log').textContent).toBe('Spieler 1 ist am Zug');
    expect(screen.getByTestId('landing').textContent).toBe('fliegt');

    warte(THROW_MS + 20);

    expect(screen.getByTestId('version').textContent).toBe('8');
    expect(screen.getByTestId('log').textContent).toContain('würfelt');
    expect(screen.getByTestId('landing').textContent).toBe('nichts');
  });

  it('haelt nichts an, was kein Wurf ist', () => {
    const waiting = beforeRoll();

    const first = pack(viewOf(waiting, 3), 'eins');
    const second = pack(viewOf(waiting, 4), 'zwei');

    const { rerender } = render(<Harness game={first} />);
    rerender(<Harness game={second} />);

    // Kein Phasenwechsel aus `rollPending` heraus, also kein Wurf, also auch
    // kein Warten - der Bildschirm ist sofort auf dem neuen Stand.
    expect(screen.getByTestId('version').textContent).toBe('4');
    expect(screen.getByTestId('landing').textContent).toBe('nichts');
  });

  /*
   * Eine Sekunde Stillstand ohne sichtbaren Grund waere kein Spannungsbogen,
   * sondern eine hakende Oberflaeche. Wer weniger Bewegung bestellt hat,
   * bekommt deshalb nicht dieselbe Wartezeit ohne die Bewegung, sondern gar
   * keine.
   */
  it('wartet nicht, wo keine Bewegung gewuenscht ist', () => {
    prefersMotion(true);

    const waiting = beforeRoll();
    const rolled = afterRoll(waiting);

    const { rerender } = render(<Harness game={pack(viewOf(waiting, 7), 'vorher')} />);
    rerender(<Harness game={pack(viewOf(rolled, 8), 'nachher')} />);

    expect(screen.getByTestId('version').textContent).toBe('8');
    expect(screen.getByTestId('landing').textContent).toBe('nichts');
  });

  /*
   * Waehrend die Wuerfel fliegen, kann online schon der naechste Stand
   * eintreffen. Er darf den Tisch nicht vorzeitig oeffnen - aber er darf auch
   * nicht verlorengehen: uebernommen wird am Ende der **neueste**, nicht der,
   * der den Wurf ausgeloest hat.
   */
  it('uebernimmt am Ende den neuesten Stand, nicht den von damals', () => {
    const waiting = beforeRoll();
    const rolled = afterRoll(waiting);

    const { rerender } = render(<Harness game={pack(viewOf(waiting, 7), 'vorher')} />);
    rerender(<Harness game={pack(viewOf(rolled, 8), 'wurf')} />);

    warte(THROW_MS / 2);
    rerender(<Harness game={pack(viewOf(rolled, 9), 'danach')} />);

    // Mitten im Flug bleibt der Tisch zu.
    expect(screen.getByTestId('version').textContent).toBe('7');

    warte(THROW_MS);

    expect(screen.getByTestId('version').textContent).toBe('9');
    expect(screen.getByTestId('log').textContent).toBe('danach');
  });
});
