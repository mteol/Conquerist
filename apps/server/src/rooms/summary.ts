import { legalActions, type RoomSummary } from '@conquerist/shared';
import type { Room } from './room.js';

/**
 * Ein Raum, wie er auf einer Karte am Startbildschirm steht.
 *
 * Bewusst duenn: die Liste soll zeigen, wo man weitermachen kann. Handkarten,
 * Bauwerke und der Zufallszustand haben hier nichts verloren - wer hineingeht,
 * bekommt seine gefilterte `PlayerView` wie immer. Regel 4 gilt auch fuer eine
 * Uebersicht.
 *
 * `yourTurn` wird aus `legalActions` gelesen und nicht aus `currentPlayerIndex`:
 * in der Gruendungsphase folgt der Zug der Schlange, nach einer Sieben duerfen
 * mehrere handeln. Es gibt genau eine Stelle, die das weiss.
 */
export function summaryOf(room: Room, viewer: string): RoomSummary {
  const seats = room.seats.map((seat) => ({
    name: seat.name,
    color: seat.color,
    connected: seat.connected,
  }));

  const game = room.game;
  if (game === null) {
    return { code: room.code, seatCount: room.seatCount, started: false, seats };
  }

  return {
    code: room.code,
    seatCount: room.seatCount,
    started: true,
    seats,
    turn: game.turn,
    yourTurn: legalActions(game, viewer).length > 0,
  };
}
