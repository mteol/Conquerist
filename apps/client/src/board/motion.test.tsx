// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_DICE,
  CLASSIC_RULES,
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
});
