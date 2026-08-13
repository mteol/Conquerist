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
  type GameAction,
  type GameState,
  type PlayerView,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { TradeOfferDialog } from './TradeOfferDialog';

/**
 * Der Angebotsdialog aus beiden Rollen.
 *
 * Gebaut wird die Sicht mit denselben Funktionen wie ueberall - `reduce` und
 * `playerViewOf`. Eine von Hand zusammengesetzte `PlayerView` waere eine
 * zweite Wahrheit ueber das, was der Server schickt.
 */
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = createGame(generateScenario(CLASSIC_34, 'angebot'), CLASSIC_RULES, ids, 'angebot');

  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  // Hauptphase mit bekannten Haenden: p1 bietet Holz, p2 kann Erz zahlen.
  return {
    ...state,
    phase: { kind: 'main' },
    currentPlayerIndex: 0,
    players: state.players.map((player, index) => ({
      ...player,
      resources:
        index === 0
          ? { brick: 0, lumber: 3, wool: 0, grain: 0, ore: 0 }
          : index === 1
            ? { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 2 }
            : { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 },
    })),
  };
}

const OFFER: GameAction = {
  type: 'offerTrade',
  player: ids[0]!,
  give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
  want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
  at: 0,
};

function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((current, action) => {
    const result = reduce(current, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.error.message}`);
    return result.state;
  }, state);
}

function viewFor(state: GameState, who: string): PlayerView {
  return playerViewOf(state, who, seats, 1);
}

function show(state: GameState, who: string, onAct = vi.fn()) {
  render(
    <TradeOfferDialog
      view={viewFor(state, who)}
      actions={legalActions(state, who)}
      clockOffset={0}
      onAct={onAct}
    />,
  );
  return onAct;
}

describe('TradeOfferDialog aus Sicht eines Mitspielers', () => {
  it('zeigt das Angebot in Worten', () => {
    show(play(afterSetup(), OFFER), ids[1]!);

    expect(screen.getByRole('dialog').textContent).toContain('Holz');
    expect(screen.getByRole('dialog').textContent).toContain('Erz');
  });

  it('laesst annehmen, wer zahlen kann', async () => {
    const onAct = show(play(afterSetup(), OFFER), ids[1]!);

    await userEvent.click(screen.getByRole('button', { name: 'Annehmen' }));

    expect(onAct).toHaveBeenCalledWith({
      type: 'respondTrade',
      player: ids[1],
      response: 'accepted',
    });
  });

  it('sperrt das Annehmen mit Begruendung, wenn die Karten fehlen', () => {
    show(play(afterSetup(), OFFER), ids[2]!);

    expect(screen.getByRole('button', { name: 'Annehmen' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('dialog').textContent).toContain('Dir fehlt');
  });

  it('schickt ein Gegenangebot mit eigenen Mengen', async () => {
    const onAct = show(play(afterSetup(), OFFER), ids[1]!);

    await userEvent.click(screen.getByRole('button', { name: 'Gegenangebot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Erz mehr anbieten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Holz mehr verlangen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gegenangebot abschicken' }));

    expect(onAct).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'counterTrade',
        player: ids[1],
        give: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
        want: { brick: 0, lumber: 1, wool: 0, grain: 0, ore: 0 },
      }),
    );
  });
});

/**
 * Ein angefangenes Gegenangebot gehoert dem Angebot, auf das es antwortet.
 *
 * Der Dialog gibt bei fremder Phase `null` zurueck - ausgehaengt wird er dabei
 * nicht, also ueberlebt sein Zustand das Ende einer Runde. Im Browser stand
 * deshalb beim naechsten Angebot noch „1 Holz" im Formular, aus einer Hand, die
 * inzwischen keins mehr hielt, und „abschicken" war offen. Der Server hat es
 * abgewiesen - angeboten haette der Client es trotzdem.
 */
describe('das Gegenangebot haengt an seinem Angebot', () => {
  /** Derselbe Stand, aber p2 hat sein Erz nicht mehr. */
  function ohneErz(): GameState {
    const state = afterSetup();
    return {
      ...state,
      players: state.players.map((player, index) =>
        index === 1
          ? { ...player, resources: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 } }
          : player,
      ),
    };
  }

  const ZWEITES_OFFER: GameAction = {
    type: 'offerTrade',
    player: ids[0]!,
    give: { brick: 0, lumber: 1, wool: 0, grain: 0, ore: 0 },
    want: { brick: 1, lumber: 0, wool: 0, grain: 0, ore: 0 },
    at: 0,
  };

  function zeige(state: GameState) {
    return render(
      <TradeOfferDialog
        view={viewFor(state, ids[1]!)}
        actions={legalActions(state, ids[1]!)}
        clockOffset={0}
        onAct={vi.fn()}
      />,
    );
  }

  function neu(rerender: (ui: JSX.Element) => void, state: GameState) {
    rerender(
      <TradeOfferDialog
        view={viewFor(state, ids[1]!)}
        actions={legalActions(state, ids[1]!)}
        clockOffset={0}
        onAct={vi.fn()}
      />,
    );
  }

  it('schliesst ein angefangenes Gegenangebot, wenn ein neues Angebot kommt', async () => {
    const { rerender } = zeige(play(afterSetup(), OFFER));

    await userEvent.click(screen.getByRole('button', { name: 'Gegenangebot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Erz mehr anbieten' }));
    expect(screen.getByTestId('give-ore').textContent).toBe('1');

    neu(rerender, play(ohneErz(), ZWEITES_OFFER));

    expect(screen.queryByRole('button', { name: 'Gegenangebot abschicken' })).toBeNull();
  });

  it('vergisst die Mengen, wenn die Runde dazwischen vorbei war', async () => {
    const { rerender } = zeige(play(afterSetup(), OFFER));

    await userEvent.click(screen.getByRole('button', { name: 'Gegenangebot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Erz mehr anbieten' }));

    // Runde vorbei, dann dasselbe Angebot noch einmal - aber ohne das Erz.
    neu(rerender, ohneErz());
    neu(rerender, play(ohneErz(), OFFER));

    await userEvent.click(screen.getByRole('button', { name: 'Gegenangebot' }));

    expect(screen.getByTestId('give-ore').textContent).toBe('0');
  });
});

describe('TradeOfferDialog aus Sicht des Anbieters', () => {
  it('zeigt je Mitspieler eine Zeile mit seiner Antwort', () => {
    const state = play(afterSetup(), OFFER, {
      type: 'respondTrade',
      player: ids[1]!,
      response: 'accepted',
    });
    show(state, ids[0]!);

    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).toContain('nimmt an');
    expect(text).toContain('ueberlegt noch');
  });

  it('bietet je Zusage einen Zuschlag - und sonst keinen', async () => {
    const state = play(afterSetup(), OFFER, {
      type: 'respondTrade',
      player: ids[1]!,
      response: 'accepted',
    });
    const onAct = show(state, ids[0]!);

    expect(screen.queryByRole('button', { name: `Mit ${seats[2]!.name} tauschen` })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: `Mit ${seats[1]!.name} tauschen` }));

    expect(onAct).toHaveBeenCalledWith({
      type: 'acceptTrade',
      player: ids[0],
      partner: ids[1],
    });
  });

  it('laesst zurueckziehen', async () => {
    const onAct = show(play(afterSetup(), OFFER), ids[0]!);

    await userEvent.click(screen.getByRole('button', { name: 'Angebot zurueckziehen' }));

    expect(onAct).toHaveBeenCalledWith({ type: 'withdrawTrade', player: ids[0] });
  });

  it('nennt eine automatische Ablehnung als Abwesenheit', () => {
    const state = play(afterSetup(), OFFER, { type: 'dropFromTrade', player: ids[1]! });
    show(state, ids[0]!);

    expect(screen.getByRole('dialog').textContent).toContain('nicht da');
  });
});

describe('die Uhr', () => {
  it('rechnet die verbleibende Zeit aus der Frist und dem Versatz', () => {
    const state = play(afterSetup(), { ...OFFER, at: Date.now() });
    const view = viewFor(state, ids[1]!);

    render(
      <TradeOfferDialog
        view={view}
        actions={legalActions(state, ids[1]!)}
        clockOffset={0}
        onAct={vi.fn()}
      />,
    );

    // 60 Sekunden Frist aus dem RuleSet, gerade eben gestellt.
    expect(screen.getByTestId('offer-clock').textContent).toContain('60');
  });

  it('zeigt nichts, wenn gerade kein Angebot liegt', () => {
    const state = afterSetup();
    render(
      <TradeOfferDialog
        view={viewFor(state, ids[0]!)}
        actions={legalActions(state, ids[0]!)}
        clockOffset={0}
        onAct={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
