import type { Room } from './room.js';
import { applyAction } from './room.js';

/**
 * Wuerfelt den Auftakt einer Raumpartie zu Ende.
 *
 * Nicht ueber `reduce`, sondern ueber `applyAction` - also genau den Weg, den
 * ein echter Zug im Raum nimmt. Ein Helfer, der den Zustand daneben
 * weiterdrehte, pruefte einen Weg, den es im Betrieb nicht gibt.
 *
 * Steht in `src` und nicht in einer Testdatei, weil vier Testdateien ihn
 * brauchen; benutzt wird er ausschliesslich von Tests.
 */
export function rollOpening(room: Room): Room {
  let current = room;

  for (let guard = 0; guard < 200; guard += 1) {
    const game = current.game;
    if (game === null || game.phase.kind !== 'opening') return current;

    const player = game.phase.pending[0];
    if (player === undefined) throw new Error('rollOpening: Warteschlange leer im Auftakt');

    const acted = applyAction(current, player, { type: 'rollDice', player });
    if (!acted.ok) throw new Error(`rollOpening: ${acted.error}`);
    current = acted.room;
  }

  throw new Error('rollOpening: Der Auftakt endet nicht');
}
