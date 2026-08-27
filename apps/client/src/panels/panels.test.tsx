// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CITIES_RULES,
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
import { cardAmounts, pieceCounts } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { gameViewOf } from '../game/view';
import { actionTargets } from '../game/targets';
import { ActionPanel } from './ActionPanel';
import { DeckPanel } from './DeckPanel';
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

    render(<TablePanel view={view} barbarianTrack={0} />);

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

    render(<TablePanel view={view} barbarianTrack={0} />);

    expect(screen.getByText('getrennt')).toBeDefined();
  });

  it('I3: zeigt die kompakte Leiste nur bei den anderen, nicht beim eigenen Sitz', () => {
    // Genau der Fehler der Abschlußreview: `showTracks={barbarianTrack > 0}`
    // stand ohne `isYou`-Filter da, und jeder der drei Sitze bekam die Leiste -
    // auch der eigene, obwohl derselbe Stand schon im Tableau in der Ecke
    // steht (Kommentar in `TablePanel.tsx`). Ohne diesen Test hätte ein
    // Rendertest, der `TrackStrip` nur aufruft, den Fehler nicht gefangen: die
    // Komponente selbst kennt kein `isYou`, nur `TablePanel` filtert.
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

    render(<TablePanel view={view} barbarianTrack={CITIES_RULES.barbarianTrack} />);

    expect(screen.queryByTestId(`trackstrip-${view.you}`)).toBeNull();
    expect(screen.getByTestId(`trackstrip-${ids[1]}`)).toBeTruthy();
    expect(screen.getByTestId(`trackstrip-${ids[2]}`)).toBeTruthy();
  });
});

describe('ActionPanel', () => {
  it('stellt die Bauteile und sonst nichts', () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));
    const targets = actionTargets(state, view.currentPlayerId);

    render(
      <ActionPanel
        targets={targets}
        error={null}
        stock={null}
        costs={CLASSIC_RULES.buildCosts}
        buildMode={null}
        onBuildMode={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    // Die drei Bauteile sind der Inhalt dieser Leiste.
    expect(screen.getByTestId('build-road')).toBeDefined();
    expect(screen.getByTestId('build-settlement')).toBeDefined();
    expect(screen.getByTestId('build-city')).toBeDefined();

    // Die Wuerfel standen hier und liegen jetzt in der Bildschirmecke daneben -
    // gestellt vom `GameScreen`, nicht mehr von dieser Leiste.
    expect(screen.queryByTestId('dice')).toBeNull();

    // Und die zwei Knoepfe stehen unter den Handkarten - siehe `TurnPanel`.
    expect(screen.queryByRole('button', { name: 'Zug beenden' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Handel' })).toBeNull();
  });

  it('zeigt den Ablehnungsgrund und laesst ihn wegraeumen', async () => {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));
    const onDismissError = vi.fn();

    render(
      <ActionPanel
        targets={actionTargets(state, view.currentPlayerId)}
        error="Vor dem Bauen fehlt der Wurf"
        stock={null}
        costs={CLASSIC_RULES.buildCosts}
        buildMode={null}
        onBuildMode={vi.fn()}
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
        targets={actionTargets(state, view.currentPlayerId)}
        error={null}
        stock={{ piecesLeft: pieceCounts({ road: 13, settlement: 3, city: 4 }), color: '#c0392b' }}
        costs={CLASSIC_RULES.buildCosts}
        buildMode={null}
        onBuildMode={vi.fn()}
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
        targets={actionTargets(state, view.currentPlayerId)}
        error={null}
        stock={{ piecesLeft: pieceCounts({ road: 0, settlement: 3, city: 4 }), color: '#c0392b' }}
        costs={CLASSIC_RULES.buildCosts}
        buildMode={null}
        onBuildMode={vi.fn()}
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
        targets={actionTargets(state, view.currentPlayerId)}
        error={null}
        stock={{ piecesLeft: pieceCounts({ road: 13, settlement: 3, city: 4 }), color: '#c0392b' }}
        costs={CLASSIC_RULES.buildCosts}
        buildMode={null}
        onBuildMode={vi.fn()}
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

  it('zeigt sie, sobald man ihn oeffnet - juengster Eintrag oben', async () => {
    render(<LogPanel entries={entries} />);
    await userEvent.click(screen.getByRole('button', { name: 'Verlauf' }));

    const shown = screen.getAllByRole('listitem').map((item) => item.textContent);
    // Der oberste traegt die Wegmarke seiner Runde mit.
    expect(shown).toEqual(['Runde 1Ben baut eine Straße', 'Anna setzt die Gründungssiedlung']);
  });

  /**
   * Er reicht bis zum Anfang der Partie.
   *
   * Hier standen die letzten zwanzig Eintraege - ein Mass aus der Zeit, als der
   * Verlauf dauerhaft in der Ecke stand. Aufgezogen wird das Blatt aber, weil
   * eine Frage im Raum steht, und die Antwort liegt fast nie in den letzten
   * zwanzig Zeilen. Abgeschnitten hat er dabei nicht einmal gesagt, dass er
   * abschneidet.
   */
  it('schneidet nichts mehr ab und sagt, wie viel dahintersteckt', async () => {
    const many = Array.from({ length: 60 }, (_unused, index) => ({
      turn: Math.floor(index / 10),
      text: `Ereignis ${index}`,
    }));
    render(<LogPanel entries={many} />);
    await userEvent.click(screen.getByRole('button', { name: 'Verlauf' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(60);
    expect(screen.getByText('Ereignis 0')).toBeDefined();
    expect(screen.getByText('60')).toBeDefined();
  });

  /**
   * Zwanzig Zeilen liest man am Stueck, zweihundert brauchen Wegmarken. Die
   * Rundennummer stand ohnehin an jedem Eintrag und wurde bloss nie gezeigt.
   */
  it('setzt je Runde eine Wegmarke, und zwar vor deren ersten Eintrag', async () => {
    render(
      <LogPanel
        entries={[
          { turn: 1, text: 'Anna würfelt 8' },
          { turn: 2, text: 'Ben würfelt 5' },
          { turn: 2, text: 'Ben baut eine Straße' },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Verlauf' }));

    const marks = [...document.querySelectorAll('.log__round')].map((mark) => mark.textContent);
    // Nach unten gelesen geht es rueckwaerts durch die Partie.
    expect(marks).toEqual(['Runde 2', 'Runde 1']);

    // Und die Marke steht am ersten Eintrag ihres Blocks, nicht am letzten.
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toBe('Runde 2Ben baut eine Straße');
    expect(items[1]?.textContent).toBe('Ben würfelt 5');
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

/**
 * Was etwas kostet, beim Darueberfahren.
 *
 * Geprueft wird, **was** dasteht, nicht wann es erscheint: das Erscheinen ist
 * eine Hover-Regel im Blatt, und jsdom rechnet kein Layout. Das Wesentliche
 * laesst sich trotzdem festhalten - die richtigen Karten in der richtigen Zahl,
 * und ein Satz dazu fuer die, die kein Bild lesen.
 */
describe('Der Preis am Bauteil', () => {
  function costMarks(container: HTMLElement, piece: string): string[] {
    const hint = container.querySelector(`[data-testid="build-${piece}"] .cost`);
    return [...(hint?.querySelectorAll('.cost__mark') ?? [])].map(
      (mark) => mark.getAttribute('data-resource') ?? '',
    );
  }

  function panel() {
    const state = afterSetup();
    const view = gameViewOf(playerViewOf(state, ids[0]!, seats, 1));

    return render(
      <ActionPanel
        targets={actionTargets(state, view.currentPlayerId)}
        error={null}
        stock={null}
        costs={CLASSIC_RULES.buildCosts}
        buildMode={null}
        onBuildMode={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );
  }

  it('legt eine Marke je Karte hin, nicht eine Zahl', () => {
    const { container } = panel();

    // Eine Stadt kostet 2 Korn und 3 Erz - fuenf Karten, nicht zwei Zeilen.
    expect(costMarks(container, 'city')).toEqual(['grain', 'grain', 'ore', 'ore', 'ore']);
    expect(costMarks(container, 'road')).toEqual(['brick', 'lumber']);
  });

  it('nimmt die Preise aus dem Regelwerk der Partie', () => {
    const { container } = render(
      <ActionPanel
        targets={actionTargets(afterSetup(), ids[0]!)}
        error={null}
        stock={null}
        costs={{
          ...CLASSIC_RULES.buildCosts,
          road: cardAmounts({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 2 }),
        }}
        buildMode={null}
        onBuildMode={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    // Keine zweite Preisliste in der Oberflaeche: was das RuleSet sagt, steht da.
    expect(costMarks(container, 'road')).toEqual(['ore', 'ore']);
  });

  it('sagt den Preis auch in Worten', () => {
    panel();

    expect(screen.getByRole('button', { name: /^Siedlung, kostet/ })).toBeDefined();
  });

  it('bleibt fuer die Maus durchlaessig - der Knopf darunter ist gemeint', () => {
    const { container } = panel();
    const hint = container.querySelector('[data-testid="build-city"] .cost');

    // `aria-hidden`, weil derselbe Inhalt schon im Namen des Knopfes steht.
    expect(hint?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Der Preis am Kaufstapel', () => {
  it('steht neben der Karte und nicht darauf', () => {
    const { container } = render(
      <DeckPanel
        left={22}
        canBuy
        cost={CLASSIC_RULES.buildCosts.developmentCard!}
        onBuy={vi.fn()}
      />,
    );

    const marks = [...container.querySelectorAll('.deck__cost .cost__mark')].map(
      (mark) => mark.getAttribute('data-resource') ?? '',
    );
    expect(marks).toEqual(['wool', 'grain', 'ore']);

    /*
     * Nebeneinander und nicht uebereinander: ueber der Karte liegt der Faecher,
     * der sich beim Darueberfahren aufspreizt, und zwei Dinge an derselben
     * Stelle koennen nicht beide zeigen, was sie meinen.
     */
    const stage = container.querySelector('.deck__stage');
    expect(stage?.querySelector('.deck__cost')).not.toBeNull();
    expect(stage?.querySelector('.deck__body')).not.toBeNull();
  });

  it('sagt den Preis auch in Worten', () => {
    render(
      <DeckPanel
        left={22}
        canBuy
        cost={CLASSIC_RULES.buildCosts.developmentCard!}
        onBuy={vi.fn()}
      />,
    );

    expect(screen.getByTestId('deck-buy').textContent).toMatch(/kostet .*Wolle/);
  });
});
