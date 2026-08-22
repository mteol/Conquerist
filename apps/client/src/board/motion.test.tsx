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
import { render, screen } from '../test/dom';
import { defaultSeats } from '../seats';
import { EMPTY_TARGETS } from '../game/targets';
import { BoardSvg } from './BoardSvg';
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
      cardCount: 3,
      resources: null,
      piecesLeft: CLASSIC_RULES.pieceStock,
      developmentCards: [],
      developmentCount: 0,
      playedKnights: 0,
      isCurrent: index === 0,
      connected: true,
      mustDiscard: 0,
    })),
    actingPlayers: [seats[0]!.id],
    currentPlayerId: seats[0]!.id,
    phaseText: 'Spieler 1 ist am Zug',
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
    render(<TablePanel view={tableView(new Map([[seats[1]!.id, 2]]))} />);

    // Ohne Bewegung waere die Information sonst weg.
    expect(screen.getByText('+2')).toBeDefined();
  });

  it('zeigt gar keinen Zuwachs, wenn keiner entstanden ist', () => {
    render(<TablePanel view={tableView(new Map())} />);

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
        [vertices[0]!]: { owner: seats[0]!.id, kind: 'settlement' as const },
      },
    };

    render(<BoardSvg state={built} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const animated = screen.getByTestId(`vertex-${vertices[0]}`).querySelector('.building')!;

    expect(animated.getAttribute('transform')).toBeNull();
    expect(animated.parentElement!.getAttribute('transform')).toContain('translate');
  });
});
