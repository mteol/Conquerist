// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_DICE,
  CLASSIC_RULES,
  boardOf,
  createGame,
  generateScenario,
} from '@conquerist/shared';
import { fireEvent, render, screen } from '../test/dom';
import { defaultSeats } from '../seats';
import { EMPTY_TARGETS, targetsFrom } from '../game/targets';
import { BoardSvg } from './BoardSvg';
import { vertexPoint } from './layout';
import { TablePanel } from '../panels/TablePanel';
import type { GameView } from '../game/view';

const scenario = generateScenario(CLASSIC_34, 'bewegung-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'bewegung-probe',
);

function tableView(gains: ReadonlyMap<string, number>): GameView {
  return {
    players: seats.map((seat, index) => ({
      id: seat.id,
      name: seat.name,
      color: seat.color,
      victoryPoints: 0,
      pointParts: {},
      cardCount: 3,
      resources: null,
      piecesLeft: CLASSIC_RULES.pieceStock,
      developmentCards: [],
      developmentCount: 0,
      playedKnights: 0,
      isCurrent: index === 0,
      castle: null,
      connected: true,
      mustDiscard: 0,
      improvements: {},
    })),
    actingPlayers: [seats[0]!.id],
    currentPlayerId: seats[0]!.id,
    phaseText: 'Spieler 1 ist am Zug',
    adaptedTurn: false,
    dice: CLASSIC_DICE,
    lastRoll: [
      { die: 'first', value: 4 },
      { die: 'second', value: 4 },
    ],
    rollTotal: 8,
    rolled: false,
    opening: null,
    turn: 1,
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, size: 0 },
    awards: [],
    deckLeft: 25,
    canOfferTrade: false,
    you: seats[0]!.id,
    gains,
    disconnected: [],
    waitingFor: [],
  };
}

/**
 * Bewegung darf nie die einzige Information sein.
 *
 * Wer `prefers-reduced-motion` gesetzt hat - oder wessen Browser gerade nicht
 * animiert - muss denselben Zustand ablesen koennen. Deshalb pruefen diese
 * Tests nicht, DASS etwas sich bewegt, sondern dass die Aussage auch ohne
 * Bewegung vollstaendig am Bildschirm steht.
 */
describe('Bewegung', () => {
  it('setzt den Raeuber auf sein Feld, nicht nur auf den Weg dorthin', () => {
    const moved = { ...start, robber: '1,-1' };

    render(<BoardSvg state={moved} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const robber = screen.getByTestId('robber');
    const hex = screen.getByTestId('hex-1,-1');

    // Die Endlage ist die Information; der Uebergang dorthin ist Beiwerk.
    expect(robber.getAttribute('data-hex')).toBe('1,-1');
    expect(hex).toBeDefined();
  });

  it('nennt einen Kartenzuwachs im Text und nicht nur als aufsteigende Zahl', () => {
    render(<TablePanel view={tableView(new Map([[seats[1]!.id, 2]]))} barbarianTrack={0} />);

    // Ohne Bewegung waere die Information sonst weg.
    expect(screen.getByText('+2')).toBeDefined();
  });

  it('zeigt gar keinen Zuwachs, wenn keiner entstanden ist', () => {
    render(<TablePanel view={tableView(new Map())} barbarianTrack={0} />);

    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });
  /*
   * Ein Bauwerk darf seine Lage nicht auf demselben `transform` tragen, das
   * die Einblendung bespielt.
   *
   * Eine CSS-Animation auf `transform` schlaegt das gleichnamige
   * Praesentationsattribut - fuer die Dauer der Animation ist das
   * `translate(...) scale(0.023)` des Pfades schlicht weg. Der Pfad steht dann
   * in seinem eigenen Mass (rund 20 Einheiten breit, ein Feld misst eine) und
   * am Nullpunkt statt am Knoten: fuer 180 ms liegt ein riesiges Haus quer
   * ueber dem Brett, danach springt es an seinen Platz. Genau derselbe Fehler
   * wie bei den unsichtbaren Strassen in Etappe 3, nur andersherum - dort
   * schlug eine Regel ein Attribut, hier eine Animation.
   *
   * Deshalb: Lage auf die Gruppe, Animation auf den Pfad darin.
   */
  it('stellt ein Bauwerk nicht ueber dasselbe transform, das die Animation bespielt', () => {
    const vertices = boardOf(scenario).topology.vertices;
    const built = {
      ...start,
      buildings: {
        [vertices[0]!]: {
          owner: seats[0]!.id,
          kind: 'settlement' as const,
          wall: false,
          metropolis: null,
        },
      },
    };

    render(<BoardSvg state={built} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const animated = screen.getByTestId(`vertex-${vertices[0]}`).querySelector('.building')!;

    expect(animated.getAttribute('transform')).toBeNull();
    expect(animated.parentElement!.getAttribute('transform')).toContain('translate');
  });
});

describe('Bewegung auf dem Brett', () => {
  const chipHexes = scenario.hexes.filter((placement) => placement.chip === 8);

  it('hebt die Chips der gefallenen Zahl ab, nicht den mit dem Raeuber', () => {
    expect(chipHexes.length).toBeGreaterThan(1);
    const robberHex = chipHexes[0]!.hex;

    render(
      <BoardSvg
        state={{ ...start, robber: robberHex }}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
        roll={{ total: 8, key: 't1' }}
      />,
    );

    expect(screen.getByTestId(`chip-${robberHex}`).getAttribute('data-hit')).toBeNull();
    for (const placement of chipHexes.slice(1)) {
      expect(screen.getByTestId(`chip-${placement.hex}`).getAttribute('data-hit')).toBe('true');
    }
    const other = scenario.hexes.find(
      (placement) => placement.chip !== undefined && placement.chip !== 8,
    )!;
    expect(screen.getByTestId(`chip-${other.hex}`).getAttribute('data-hit')).toBeNull();
  });

  it('haengt die Chips mit jedem neuen Wurf neu ein, damit die Antwort noch einmal laeuft', () => {
    const target = chipHexes[1]!.hex;
    const view = (key: string) => (
      <BoardSvg
        state={start}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
        roll={{ total: 8, key }}
      />
    );
    const { rerender } = render(view('t1'));
    const first = screen.getByTestId(`chip-${target}`);

    rerender(view('t1'));
    expect(screen.getByTestId(`chip-${target}`)).toBe(first);

    rerender(view('t2'));
    expect(screen.getByTestId(`chip-${target}`)).not.toBe(first);
  });

  it('zeigt unter dem Mauszeiger die Vorschau in der Sitzfarbe', () => {
    const vertex = boardOf(scenario).topology.vertices[0]!;
    const targets = targetsFrom([
      { type: 'buildSettlement', player: seats[0]!.id, vertex } as never,
    ]);

    const { container } = render(
      <BoardSvg
        state={start}
        targets={targets}
        seats={seats}
        onPick={vi.fn()}
        previewColor="rgb(1, 2, 3)"
      />,
    );
    const svg = container.querySelector('svg')!;
    svg.getScreenCTM = () =>
      ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as unknown as DOMMatrix;
    const catcher = screen.getByTestId('board-catcher');

    expect(screen.queryByTestId('aim-ghost')).toBeNull();

    const at = vertexPoint(vertex);
    fireEvent.pointerMove(catcher, { pointerType: 'mouse', clientX: at.x, clientY: at.y });
    const ghost = screen.getByTestId('aim-ghost');
    expect(ghost.getAttribute('data-aim')).toBe('true');
    expect(ghost.getAttribute('style')).toContain('rgb(1, 2, 3)');

    fireEvent.pointerDown(catcher, {
      pointerType: 'mouse',
      clientX: at.x,
      clientY: at.y,
      buttons: 1,
    });
    expect(screen.getByTestId('aim-ghost').getAttribute('data-aim')).toBe('press');

    fireEvent.pointerLeave(catcher, { pointerType: 'mouse' });
    expect(screen.queryByTestId('aim-ghost')).toBeNull();
  });

  it('laesst einen versetzten Ritter von seinem alten Knoten herueberziehen', () => {
    const [from, to] = boardOf(scenario).topology.vertices;
    const knight = {
      owner: seats[0]!.id,
      level: 1 as const,
      active: false,
      activatedOnTurn: null,
      upgradedThisTurn: false,
    };
    const props = { targets: EMPTY_TARGETS, seats, onPick: vi.fn() };
    const { rerender } = render(
      <BoardSvg state={{ ...start, knights: { [from!]: knight } }} {...props} />,
    );

    expect(screen.getByTestId(`knight-${from}`).parentElement!.getAttribute('class')).toBe('piece');

    rerender(<BoardSvg state={{ ...start, knights: { [to!]: knight } }} {...props} />);
    const moved = screen.getByTestId(`knight-${to}`).parentElement!;
    expect(moved.getAttribute('class')).toContain('piece--travel');
    expect(moved.getAttribute('style')).toContain('--from-x');
  });
});
