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

    const buy = screen.getByTestId('deck-buy');
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

    expect(screen.getByTestId('deck-buy')).toHaveProperty('disabled', true);
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

  it('spielt den Strassenbau auch aus, wenn nur eine Strasse moeglich ist', async () => {
    const onAct = vi.fn();
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              developmentCards: [{ id: 'roadBuilding', boughtOnTurn: 1 }],
              // Die letzte Strasse im Vorrat: nach ihr geht keine zweite mehr.
              piecesLeft: { ...entry.piecesLeft, road: 1 },
            }
          : entry,
      ),
    });

    render(screenFor(state, ids[0]!, onAct));
    await userEvent.click(screen.getByTestId('devcard-roadBuilding'));

    const leuchtend = screen
      .getAllByTestId(/^edge-/)
      .filter((node) => node.dataset['target'] === 'true');
    expect(leuchtend.length).toBeGreaterThan(0);

    /*
     * Vorher war das eine Sackgasse: nach der ersten Kante leuchtete nichts
     * mehr, und die Karte liess sich nur abbrechen - obwohl der Reducer eine
     * einzelne Strasse ausdruecklich annimmt.
     */
    await userEvent.click(leuchtend[0]!);

    expect(onAct).toHaveBeenCalledTimes(1);
    expect(onAct.mock.calls[0]![0]).toMatchObject({
      type: 'playRoadBuilding',
      player: ids[0],
    });
    expect(onAct.mock.calls[0]![0].edges).toHaveLength(1);
  });

  /*
   * Seit die Karten einen Kartenkoerper haben, tragen sie ein Motiv - und der
   * Name bleibt trotzdem stehen. Bei den Handkarten ist er weggefallen, weil
   * dort Gelaendefarbe und Motiv dieselbe Aussage doppelt tragen; hier sind
   * alle fuenf dasselbe Pergament, und dann waere das Bild der einzige Traeger.
   */
  it('gibt jeder Karte ein Motiv und laesst den Namen daneben stehen', () => {
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              developmentCards: [
                { id: 'knight', boughtOnTurn: 1 },
                { id: 'roadBuilding', boughtOnTurn: 1 },
              ],
            }
          : entry,
      ),
    });

    render(screenFor(state));

    for (const id of ['knight', 'roadBuilding']) {
      const card = screen.getByTestId(`devcard-${id}`);
      expect(card.querySelector('.devcard__glyph')).not.toBeNull();
    }

    expect(screen.getByText('Ritter')).toBeDefined();
    expect(screen.getByText('Straßenbau')).toBeDefined();
  });

  /*
   * Der Siegpunkt wird nie gespielt. Als Knopf waere er in jeder Lage gesperrt,
   * und ein Bedienelement, das nie angeht, sagt „gerade nicht" ueber etwas, das
   * nie geht - blass daliegend saehe der eigene Punkt ausserdem aus wie ein
   * Fehler. Er ist Besitz und keine Handlung.
   */
  it('macht aus dem Siegpunkt keinen dauerhaft gesperrten Knopf', () => {
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0
          ? { ...entry, developmentCards: [{ id: 'victoryPoint', boughtOnTurn: 1 }] }
          : entry,
      ),
    });

    render(screenFor(state));

    const card = screen.getByTestId('devcard-victoryPoint');
    expect(card.tagName).toBe('DIV');
    expect(screen.queryByRole('button', { name: /Siegpunkt/ })).toBeNull();
    expect(screen.getByText('Siegpunkt')).toBeDefined();
  });

  it('zaehlt mehrere Karten derselben Sorte auf einer Plakette', () => {
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              developmentCards: [
                { id: 'knight', boughtOnTurn: 1 },
                { id: 'knight', boughtOnTurn: 1 },
                { id: 'knight', boughtOnTurn: 1 },
              ],
            }
          : entry,
      ),
    });

    render(screenFor(state));

    // Ein Stapel statt dreier Karten - und die Zahl daran, weil man sie liest.
    expect(screen.getAllByTestId('devcard-knight')).toHaveLength(1);
    expect(screen.getByTestId('devcard-count-knight').textContent).toBe('3');
  });

  /**
   * Was die Karte tut, steht auf dem Bildschirm und nicht mehr im `title`.
   *
   * **Warum das eine eigene Pruefung wert ist:** ein `title` sieht im Code aus
   * wie eine Erklaerung und ist im Browser kaum eine - er kommt nach rund einer
   * Sekunde Stillstand, in der Schrift des Betriebssystems, und auf einem
   * **gesperrten** Knopf in den meisten Browsern gar nicht. Genau die gesperrte
   * Karte ist aber die, bei der man nachliest: die spielbare drueckt man.
   *
   * Deshalb haengen Zeigen und Verbergen am Listeneintrag und nicht am Knopf.
   * Der Unterschied ist im Code eine Zeile und in der Wirkung der ganze Zweck.
   */
  it('erklaert beim Darueberfahren, was eine Karte tut', async () => {
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0 ? { ...entry, developmentCards: [{ id: 'knight', boughtOnTurn: 1 }] } : entry,
      ),
    });

    render(screenFor(state));

    // Vorher steht nichts da: eine Erklaerung ohne Anlass ist Dekoration.
    expect(screen.queryByTestId('devcard-hint')).toBeNull();

    await userEvent.hover(screen.getByTestId('devcard-knight'));

    const hint = screen.getByTestId('devcard-hint');
    expect(hint.textContent).toContain('Ritter');
    expect(hint.textContent).toContain('Räuber');

    await userEvent.unhover(screen.getByTestId('devcard-knight'));
    expect(screen.queryByTestId('devcard-hint')).toBeNull();
  });

  it('erklaert auch die Karte, die man gerade nicht spielen darf', async () => {
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0 ? { ...entry, developmentCards: [{ id: 'monopoly', boughtOnTurn: 4 }] } : entry,
      ),
    });

    render(screenFor(state));

    const card = screen.getByTestId('devcard-monopoly');
    expect(card).toHaveProperty('disabled', true);

    /*
     * Gefahren wird ueber den Listeneintrag - genau dort, wo die Oberflaeche
     * zuhoert. Auf dem gesperrten Knopf selbst gaebe es nichts zu hoeren, und
     * das ist der Grund fuer die ganze Umstellung.
     */
    await userEvent.hover(card.closest('li')!);

    expect(screen.getByTestId('devcard-hint').textContent).toContain('Monopol');
  });

  /**
   * Dieselbe Auskunft fuer Vorlesewerkzeuge - und zwar ohne Zeigegeraet.
   *
   * Eine Erklaerung, die nur beim Darueberfahren erscheint, gibt es fuer eine
   * Tastatur nicht und fuer eine Sprachausgabe erst recht nicht. Sie haengt
   * deshalb zusaetzlich als `aria-describedby` an der Karte selbst.
   */
  it('haengt den Satz auch ohne Maus an jede Karte', () => {
    const state = playable({
      turn: 4,
      players: afterSetup().players.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              developmentCards: [
                { id: 'knight', boughtOnTurn: 1 },
                { id: 'victoryPoint', boughtOnTurn: 1 },
              ],
            }
          : entry,
      ),
    });

    const { container } = render(screenFor(state));

    for (const id of ['knight', 'victoryPoint']) {
      const card = screen.getByTestId(`devcard-${id}`);
      const described = card.getAttribute('aria-describedby');

      expect(described, `${id} verweist auf keine Erklaerung`).not.toBeNull();
      expect(
        container.querySelector(`#${described}`)?.textContent,
        `${id}: die Erklaerung, auf die verwiesen wird, ist leer`,
      ).toBeTruthy();
    }
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
