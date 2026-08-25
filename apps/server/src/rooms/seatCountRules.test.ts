import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, CLASSIC_RULES_56 } from '@conquerist/shared';
import { createRoom, joinRoom, startGame, type Room } from './room.js';

/**
 * Welchen Vorrat eine Partie mitbekommt, haengt an der Tischgroesse.
 *
 * Geprueft am gestarteten Spiel und nicht am Regelwerk daneben: dass
 * `CLASSIC_RULES_56` die richtigen Zahlen traegt, sagt der Test im Paket. Hier
 * geht es um die Frage danach - **kommen sie auch in der Partie an**. Bis
 * hierher wurde das Regelwerk in `startGame` fest verdrahtet, und ein Sechser-
 * Tisch spielte mit dem Vorrat der Viererpartie.
 */
function tableOf(seatCount: number): Room {
  const created = createRoom('V6R1', 'u1', 'Anna', seatCount, 'vorrat-probe', 10);
  if (!created.ok) throw new Error(created.error);

  let room = created.room;
  for (let index = 2; index <= seatCount; index += 1) {
    const joined = joinRoom(room, `u${index}`, `Spieler ${index}`);
    if (!joined.ok) throw new Error(joined.error);
    room = joined.room;
  }

  const started = startGame(room, 'u1');
  if (!started.ok) throw new Error(started.error);
  if (started.room.game === null) throw new Error('Die Partie laeuft nicht');
  return started.room;
}

/** Wie viele Karten der ungemischte Stapel dieses Regelwerks umfasst. */
function deckSize(deck: Record<string, number>): number {
  return Object.values(deck).reduce((sum, count) => sum + count, 0);
}

describe('Vorrat nach Tischgroesse', () => {
  it('gibt der Sechserpartie 24 Karten je Rohstoff', () => {
    const game = tableOf(6).game!;
    expect(game.bank.brick).toBe(24);
    expect(game.bank.ore).toBe(24);
  });

  it('gibt der Sechserpartie den groesseren Entwicklungsstapel', () => {
    const game = tableOf(6).game!;
    expect(game.deck.length).toBe(deckSize(CLASSIC_RULES_56.developmentDeck));
    expect(game.deck.length).toBe(34);
  });

  it('laesst die Viererpartie unveraendert', () => {
    const game = tableOf(4).game!;
    expect(game.bank.brick).toBe(19);
    expect(game.deck.length).toBe(deckSize(CLASSIC_RULES.developmentDeck));
    expect(game.deck.length).toBe(25);
  });
});
