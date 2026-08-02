// @vitest-environment jsdom
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
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
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { GameScreen } from './GameScreen';

const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);
const scenario = generateScenario(CLASSIC_34, 'karten-probe');

/** Eine Partie bis nach der Gruendung, damit die Hauptphase laeuft. */
function afterSetup(): GameState {
  let state = createGame(scenario, CLASSIC_RULES, ids, 'karten-probe');
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

/** Hauptphase, reicher erster Spieler - so ist der Kauf ueberhaupt moeglich. */
function playable(overrides: Partial<GameState> = {}): GameState {
  const base = afterSetup();
  return {
    ...base,
    phase: { kind: 'main' },
    players: base.players.map((entry, index) =>
      index === 0
        ? { ...entry, resources: { brick: 4, lumber: 4, wool: 4, grain: 4, ore: 4 } }
        : entry,
    ),
    ...overrides,
  };
}

function screenFor(state: GameState, viewer = ids[0]!, onAct = vi.fn()): JSX.Element {
  const view = playerViewOf(state, viewer, seats, 1);

  return (
    <GameScreen
      view={view}
      actions={legalActions(state, viewer)}
      log={[]}
      error={null}
      onAct={onAct}
      onDismissError={vi.fn()}
      onLeave={vi.fn()}
    />
  );
}

describe('Entwicklungskarten in der Oberflaeche', () => {
  it('bietet den Kauf an, sobald er erlaubt ist', async () => {
    const onAct = vi.fn();
    render(screenFor(playable(), ids[0]!, onAct));

    const buy = screen.getByRole('button', { name: 'Karte kaufen' });
    expect(buy).toHaveProperty('disabled', false);

    await userEvent.click(buy);
    expect(onAct).toHaveBeenCalledWith({ type: 'buyDevelopmentCard', player: ids[0] });
  });

  it('sperrt den Kauf, wenn das Geld fehlt', () => {
    const arm = playable({
      players: afterSetup().players.map((entry) => ({
        ...entry,
        resources: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 },
      })),
    });

    render(screenFor(arm));

    expect(screen.getByRole('button', { name: 'Karte kaufen' })).toHaveProperty('disabled', true);
  });

  it('zeigt die eigenen Karten und laesst nur die spielbaren anklicken', () => {
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              developmentCards: [
                { id: 'knight', boughtOnTurn: 1 },
                { id: 'monopoly', boughtOnTurn: 4 },
              ],
            }
          : entry,
      ),
    });

    render(screenFor(state));

    // Der Ritter ist eine Runde alt und darf; das Monopol ist von heute.
    expect(screen.getByTestId('devcard-knight')).toHaveProperty('disabled', false);
    expect(screen.getByTestId('devcard-monopoly')).toHaveProperty('disabled', true);
  });

  it('schickt den Ritter ohne Nachfrage hinaus', async () => {
    const onAct = vi.fn();
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0 ? { ...entry, developmentCards: [{ id: 'knight', boughtOnTurn: 1 }] } : entry,
      ),
    });

    render(screenFor(state, ids[0]!, onAct));
    await userEvent.click(screen.getByTestId('devcard-knight'));

    // Das Versetzen kommt als eigener Zug, sobald die Raeuberphase laeuft.
    expect(onAct).toHaveBeenCalledWith({ type: 'playKnight', player: ids[0] });
  });

  it('fragt beim Monopol nach der Sorte', async () => {
    const onAct = vi.fn();
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0 ? { ...entry, developmentCards: [{ id: 'monopoly', boughtOnTurn: 1 }] } : entry,
      ),
    });

    render(screenFor(state, ids[0]!, onAct));
    await userEvent.click(screen.getByTestId('devcard-monopoly'));

    expect(screen.getByRole('dialog', { name: 'Monopol' })).toBeDefined();

    await userEvent.click(screen.getByTestId('pick-ore'));
    await userEvent.click(screen.getByRole('button', { name: 'Karte spielen' }));

    expect(onAct).toHaveBeenCalledWith({
      type: 'playMonopoly',
      player: ids[0],
      resource: 'ore',
    });
  });

  it('nimmt bei der Erfindung genau zwei Rohstoffe', async () => {
    const onAct = vi.fn();
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0
          ? { ...entry, developmentCards: [{ id: 'yearOfPlenty', boughtOnTurn: 1 }] }
          : entry,
      ),
    });

    render(screenFor(state, ids[0]!, onAct));
    await userEvent.click(screen.getByTestId('devcard-yearOfPlenty'));

    // Nach einer Karte ist der Knopf noch gesperrt.
    expect(screen.getByRole('button', { name: 'Karte spielen' })).toHaveProperty('disabled', true);

    await userEvent.click(screen.getByTestId('pick-grain'));
    await userEvent.click(screen.getByTestId('pick-grain'));
    await userEvent.click(screen.getByRole('button', { name: 'Karte spielen' }));

    expect(onAct).toHaveBeenCalledWith({
      type: 'playYearOfPlenty',
      player: ids[0],
      picks: ['grain', 'grain'],
    });
  });

  it('laesst den Strassenbau ueber das Brett laufen', async () => {
    const onAct = vi.fn();
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0
          ? { ...entry, developmentCards: [{ id: 'roadBuilding', boughtOnTurn: 1 }] }
          : entry,
      ),
    });

    render(screenFor(state, ids[0]!, onAct));
    await userEvent.click(screen.getByTestId('devcard-roadBuilding'));

    // Kein Fenster: wo eine Strasse hinkann, sieht man auf dem Brett.
    expect(screen.getByText(/erste Straße auf dem Brett/)).toBeDefined();

    const leuchtend = screen
      .getAllByTestId(/^edge-/)
      .filter((node) => node.dataset['target'] === 'true');
    expect(leuchtend.length).toBeGreaterThan(0);

    await userEvent.click(leuchtend[0]!);
    expect(screen.getByText(/zweite Straße auf dem Brett/)).toBeDefined();
    expect(onAct).not.toHaveBeenCalled();
  });

  it('zeigt fremde Entwicklungskarten nirgends', () => {
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 1 ? { ...entry, developmentCards: [{ id: 'monopoly', boughtOnTurn: 1 }] } : entry,
      ),
    });

    render(screenFor(state, ids[0]!));

    // p1 sieht seine eigene (leere) Reihe - von p2 nichts.
    expect(screen.queryByTestId('devcard-monopoly')).toBeNull();
  });
});
