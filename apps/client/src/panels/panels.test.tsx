// @vitest-environment jsdom
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
import { gameViewOf } from '../game/view';
import { actionTargets } from '../game/targets';
import { ActionPanel } from './ActionPanel';
import { TurnPanel } from './TurnPanel';
import { TablePanel } from './TablePanel';
import { StatusPanel } from './StatusPanel';
import { LogPanel } from './LogPanel';

const scenario = generateScenario(CLASSIC_34, 'panels-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = createGame(scenario, CLASSIC_RULES, ids, 'panels-probe');
  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

describe('TablePanel', () => {
  it('zaehlt fuer alle gleich, statt die eigene Hand aufzuschluesseln', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

    render(<TablePanel view={view} />);

    // Die eigene Zeile stand hier als „L2 H0 W0 K0 E1" - fuenf
    // Anfangsbuchstaben an der Stelle, an der bei allen anderen „3 Karten"
    // steht. Dieselbe Auskunft liegt unten links als Kartenstapel, in Farbe
    // und mit Motiv; der Tisch beantwortet die Frage nach den *anderen*.
    expect(screen.getAllByTestId(/^hand-count-/)).toHaveLength(3);
    expect(screen.queryAllByTestId(/^hand-p/)).toHaveLength(0);
  });

  it('nennt einen getrennten Mitspieler beim Wort statt ihn nur einzufaerben', () => {
    const state = afterSetup();
    const offline = new Map([[ids[1]!, false]]);
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1, offline));

    render(<TablePanel view={view} />);

    expect(screen.getByText('getrennt')).toBeDefined();
  });
});

describe('ActionPanel', () => {
  it('laesst wuerfeln, ohne einen Knopf dafuer zu stellen', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));
    const targets = actionTargets(state, view.currentPlayerId);

    render(
      <ActionPanel
        view={view}
        targets={targets}
        error={null}
        stock={null}
        buildMode={null}
        onBuildMode={vi.fn()}
        onRoll={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    // Der Knopf „Wuerfeln" ist weg: geworfen wird an den Wuerfeln selbst.
    expect(screen.queryByRole('button', { name: 'Wuerfeln' })).toBeNull();
    expect(screen.getByTestId('dice')).toHaveProperty('disabled', false);

    // Und die zwei Knoepfe stehen nicht mehr in dieser Leiste, sondern unter
    // den Handkarten - siehe `TurnPanel`.
    expect(screen.queryByRole('button', { name: 'Zug beenden' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Handel' })).toBeNull();
  });

  it('zeigt den Ablehnungsgrund und laesst ihn wegraeumen', async () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));
    const onDismissError = vi.fn();

    render(
      <ActionPanel
        view={view}
        targets={actionTargets(state, view.currentPlayerId)}
        error="Vor dem Bauen fehlt der Wurf"
        stock={null}
        buildMode={null}
        onBuildMode={vi.fn()}
        onRoll={vi.fn()}
        onDismissError={onDismissError}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Vor dem Bauen fehlt der Wurf');
    await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
    expect(onDismissError).toHaveBeenCalled();
  });

  /*
   * Der Vorrat war bis zum ersten Playtest nirgends zu sehen: dass die letzte
   * Strasse gelegt war, merkte man erst an der Absage des Servers. Seit dem
   * neuen Layout steht er **am Bauknopf** und nicht mehr als eigene Liste
   * daneben - dieselbe Silhouette stand vorher zweimal untereinander, einmal
   * zum Zaehlen und einmal zum Druecken.
   */
  it('nennt am Bauknopf, wie viele Teile noch im Vorrat liegen', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

    render(
      <ActionPanel
        view={view}
        targets={actionTargets(state, view.currentPlayerId)}
        error={null}
        stock={{ piecesLeft: { road: 13, settlement: 3, city: 4 }, color: '#c0392b' }}
        buildMode={null}
        onBuildMode={vi.fn()}
        onRoll={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    expect(screen.getByTestId('build-road').textContent).toContain('13');
    expect(screen.getByTestId('build-settlement').textContent).toContain('3');
    expect(screen.getByTestId('build-city').textContent).toContain('4');
  });

  it('laesst einen leeren Vorrat stehen, statt ihn wegzulassen', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

    render(
      <ActionPanel
        view={view}
        targets={actionTargets(state, view.currentPlayerId)}
        error={null}
        stock={{ piecesLeft: { road: 0, settlement: 3, city: 4 }, color: '#c0392b' }}
        buildMode={null}
        onBuildMode={vi.fn()}
        onRoll={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    // Ein fehlender Eintrag saehe aus wie ein Anzeigefehler. Die Null ist die
    // Auskunft, um die es geht - sie steht da und wird als leer gekennzeichnet.
    const left = screen.getByTestId('left-road');
    expect(left.textContent).toContain('0');
    expect(left.className).toContain('build__left--empty');
  });

  /*
   * Der Satz „Spieler 1 ist am Zug" stand bis zum neuen Layout an zwei Ecken
   * des Bildschirms: hier als `panel__hint` und in der Statusecke. Zweimal
   * derselbe Satz ist einmal zu viel, und die Statusecke ist der Ort dafuer.
   */
  it('sagt die Phase nicht noch einmal, die schon in der Statusecke steht', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

    render(
      <ActionPanel
        view={view}
        targets={actionTargets(state, view.currentPlayerId)}
        error={null}
        stock={{ piecesLeft: { road: 13, settlement: 3, city: 4 }, color: '#c0392b' }}
        buildMode={null}
        onBuildMode={vi.fn()}
        onRoll={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    expect(view.phaseText.length).toBeGreaterThan(0);
    expect(screen.queryByText(view.phaseText)).toBeNull();
  });
});

describe('TurnPanel', () => {
  it('sperrt Handel und Zugende, solange nicht gewuerfelt ist', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));
    const targets = actionTargets(state, view.currentPlayerId);

    render(<TurnPanel view={view} targets={targets} onOpenTrade={vi.fn()} onEndTurn={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Handel' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Zug beenden' })).toHaveProperty('disabled', true);
  });

  /*
   * Der Fehler, den dieser Test festhaelt: der Knopf hing allein an
   * `targets.trades`, also an den Bankgeschaeften. Wer zu wenige Karten fuer
   * die Bank hatte - der Normalfall, wenn man handeln moechte -, kam gar nicht
   * erst an den Reiter fuer den Spielerhandel.
   */
  it('oeffnet den Handel auch ohne Bankgeschaeft, wenn ein Angebot moeglich waere', () => {
    const state = afterSetup();
    const rolled = reduce(state, { type: 'rollDice', player: setupPlayer(state) ?? ids[0]! });
    const after = rolled.ok ? rolled.state : state;
    const view = gameViewOf(
      playerViewOf(after, after.players[after.currentPlayerIndex]!.id, seats, 2),
    );
    const targets = actionTargets(after, view.currentPlayerId);

    render(
      <TurnPanel
        view={{ ...view, canOfferTrade: true }}
        targets={{ ...targets, trades: [] }}
        onOpenTrade={vi.fn()}
        onEndTurn={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Handel' })).toHaveProperty('disabled', false);
  });

  it('sperrt den Handel, wenn weder Bank noch Mitspieler in Frage kommen', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));
    const targets = actionTargets(state, view.currentPlayerId);

    render(
      <TurnPanel
        view={{ ...view, canOfferTrade: false }}
        targets={{ ...targets, trades: [] }}
        onOpenTrade={vi.fn()}
        onEndTurn={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Handel' })).toHaveProperty('disabled', true);
  });
});

describe('StatusPanel', () => {
  it('nennt eine Trennung klein, solange sie niemanden aufhaelt', () => {
    const state = afterSetup();
    // Getrennt ist jemand, der gerade nicht dran ist.
    const idle = state.players.find((player) => player.id !== actingId(state))!.id;
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1, new Map([[idle, false]])));

    render(<StatusPanel view={view} />);

    expect(screen.getByTestId('away').textContent).toContain('getrennt');
    expect(screen.queryByTestId('waiting-for')).toBeNull();
  });

  it('erklaert es deutlich, wenn die Partie auf einen Getrennten wartet', () => {
    const state = afterSetup();
    const acting = actingId(state);
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1, new Map([[acting, false]])));

    render(<StatusPanel view={view} />);

    // Ohne diesen Satz sucht man den Fehler bei sich, wenn nichts mehr geht.
    expect(screen.getByTestId('waiting-for').textContent).toContain('Wartet auf');
    expect(screen.queryByTestId('away')).toBeNull();
  });
});

/** Wer gerade handeln darf - nach der Gruendung der Spieler am Zug. */
function actingId(state: GameState): string {
  return state.players[state.currentPlayerIndex]!.id;
}

/*
 * Der Verlauf liegt seit dem neuen Layout hinter einem Symbol.
 *
 * Der Grund steht schon im Blatt, seit die Panels nach dem ersten Playtest
 * getauscht wurden: wer am Zug ist, liest man staendig und beilaeufig, den
 * Verlauf liest man selten und dann genau. Was man selten liest, braucht keinen
 * Dauerplatz - es braucht eine Tuer, die man findet.
 */
describe('LogPanel', () => {
  const entries = [
    { turn: 1, text: 'Anna setzt die Gründungssiedlung' },
    { turn: 1, text: 'Ben baut eine Straße' },
  ];

  it('haelt die Eintraege hinter einem Knopf, der Verlauf heisst', () => {
    render(<LogPanel entries={entries} />);

    expect(screen.getByRole('button', { name: 'Verlauf' })).toBeDefined();
    expect(screen.queryByText('Ben baut eine Straße')).toBeNull();
  });

  it('zeigt sie, sobald man ihn oeffnet - juengster Eintrag oben', () => {
    render(<LogPanel entries={entries} />);

    return userEvent.click(screen.getByRole('button', { name: 'Verlauf' })).then(() => {
      const shown = screen.getAllByRole('listitem').map((item) => item.textContent);
      expect(shown).toEqual(['Ben baut eine Straße', 'Anna setzt die Gründungssiedlung']);
    });
  });

  it('macht ihn mit demselben Knopf wieder zu', async () => {
    render(<LogPanel entries={entries} />);
    const toggle = screen.getByRole('button', { name: 'Verlauf' });

    await userEvent.click(toggle);
    expect(screen.getByText('Ben baut eine Straße')).toBeDefined();

    await userEvent.click(toggle);
    expect(screen.queryByText('Ben baut eine Straße')).toBeNull();
  });
});
