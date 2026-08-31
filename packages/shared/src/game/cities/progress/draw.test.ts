import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../../rules/index.js';
import { testGame } from '../../fixtures.js';
import type { PlayerId, PlayerState } from '../../player.js';
import type { GameState } from '../../state.js';
import type { TrackId } from '../tracks.js';
import type { ProgressCardId } from './cards.js';
import { countedHand, drawersFor, drawProgressCards, playersOverProgressLimit } from './draw.js';

/*
 * Diese Helfer bauen den Zustand, den die Tests brauchen - `citiesTable()`,
 * `withImprovements`, `withHand`, `playerNamed`, `allEligible` und
 * `eligibleForScience` gibt es so nicht als fertige Bausteine; das hier sind
 * lokale Aufbauten aus `testGame` und einfachen Ueberschreibungen.
 */

function citiesTable(overrides: Partial<GameState> = {}): GameState {
  return testGame({ rules: CITIES_RULES, ...overrides });
}

function withImprovements(
  state: GameState,
  levels: Partial<Record<PlayerId, Partial<Record<TrackId, number>>>>,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      const forThisPlayer = levels[player.id];
      if (forThisPlayer === undefined) return player;
      return { ...player, improvements: { ...player.improvements, ...forThisPlayer } };
    }),
  };
}

function withCurrentPlayer(state: GameState, index: number): GameState {
  return { ...state, currentPlayerIndex: index };
}

function withHand(state: GameState, id: PlayerId, cards: ProgressCardId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, progressCards: cards } : player,
    ),
  };
}

function playerNamed(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`playerNamed: ${id} sitzt nicht am Tisch`);
  return player;
}

function testPlayer(): PlayerState {
  return citiesTable().players[0]!;
}

/**
 * Ein Tisch, an dem jede Person in Wissenschaft Stufe 1 hat - Regel 8.1 hat
 * zwei Bedingungen, und Stufe 0 erfuellt die erste nie, auch nicht bei rotem
 * Wuerfel 1. Stufe 1 (Schwelle 2) laesst bei rotem Wuerfel 1 alle drei zu.
 */
function allEligible(): GameState {
  return withImprovements(citiesTable(), {
    p1: { science: 1 },
    p2: { science: 1 },
    p3: { science: 1 },
  });
}

/** Ein Tisch mit einem vorgegebenen Wissenschaftsstapel, sonst wie `allEligible`. */
function eligibleForScience(deck: ProgressCardId[]): GameState {
  return withImprovements(citiesTable({ progressDecks: { science: deck } }), {
    p1: { science: 1 },
    p2: { science: 1 },
    p3: { science: 1 },
  });
}

describe('Ziehen am Stadttor', () => {
  it('laesst ziehen, wer die Schwelle Stufe+1 erreicht', () => {
    // p1 auf Wissenschaft 2 -> Schwelle 3, roter Wuerfel 3: zieht.
    // p2 auf Wissenschaft 0 -> Schwelle 1, roter Wuerfel 3: zieht nicht.
    const state = withImprovements(citiesTable(), { p1: { science: 2 } });
    expect(drawersFor(state, 'science', 3)).toEqual(['p1']);
  });

  it('unterscheidet Stufe 0 von Stufe 1 bei rotem Wuerfel 1', () => {
    // Regel 8.1 hat zwei Bedingungen: erst Stufe >= 1, dann die Schwelle.
    // Bei rotem Wuerfel 1 waere die Schwelle (Stufe 0 -> 1) fuer beide erfuellt -
    // die Stufenbedingung trennt sie trotzdem: p1 bleibt auf Stufe 0 und zieht
    // nicht, p2 steht auf Stufe 1 und zieht.
    const state = withImprovements(citiesTable(), { p2: { science: 1 } });
    expect(drawersFor(state, 'science', 1)).toEqual(['p2']);
  });

  it('faengt beim Spieler am Zug an und geht im Uhrzeigersinn', () => {
    // Alle drei berechtigt, am Zug ist der zweite Sitz.
    const state = withCurrentPlayer(allEligible(), 1);
    expect(drawersFor(state, 'science', 1)).toEqual(['p2', 'p3', 'p1']);
  });

  it('zieht die oberste Karte und nimmt sie vom Stapel', () => {
    const before = eligibleForScience(['crane']);
    const after = drawProgressCards(before, 'science', 1);
    expect(after.progressDecks.science).toHaveLength(before.progressDecks.science!.length - 1);
    expect(playerNamed(after, 'p1').progressCards).toEqual([before.progressDecks.science![0]]);
  });

  /*
   * Docs Abschnitt 11: "Siegpunktkarten ... liegen sofort offen." Sofort
   * heisst beim Ziehen, nicht erst beim Ausspielen - Buchdruck und Verfassung
   * gehen deshalb nie in die geheime Hand.
   */
  it('legt eine gezogene Siegpunktkarte sofort offen ab statt auf die Hand', () => {
    const before = eligibleForScience(['printer']);
    const after = drawProgressCards(before, 'science', 1);

    expect(playerNamed(after, 'p1').progressCards).toEqual([]);
    expect(playerNamed(after, 'p1').openProgressCards).toEqual(['printer']);
  });

  it('gibt still nichts aus einem leeren Stapel', () => {
    const empty = eligibleForScience([]);
    const after = drawProgressCards(empty, 'science', 1);
    expect(playerNamed(after, 'p1').progressCards).toHaveLength(0);
    expect(playersOverProgressLimit(after)).toEqual([]);
  });

  /* Siegpunktkarten liegen offen und zaehlen nicht gegen das Limit von vier. */
  it('zaehlt Siegpunktkarten nicht gegen das Handlimit', () => {
    const hand: PlayerState = {
      ...testPlayer(),
      progressCards: ['printer', 'constitution', 'crane'],
    };
    expect(countedHand(hand)).toBe(1);
  });

  it('meldet, wer nicht am Zug ist und mit der fuenften Karte ueber dem Limit liegt', () => {
    // Am Zug ist p1, also faellt p2 in die Liste und p1 nie.
    const full = withHand(eligibleForScience(['crane', 'mining']), 'p2', [
      'crane',
      'mining',
      'smith',
      'medicine',
    ]);
    expect(playersOverProgressLimit(drawProgressCards(full, 'science', 1))).toEqual(['p2']);
  });

  it('nimmt den Spieler am Zug aus der Abgabeliste heraus', () => {
    const full = withHand(eligibleForScience(['crane', 'mining']), 'p1', [
      'crane',
      'mining',
      'smith',
      'medicine',
    ]);
    expect(playersOverProgressLimit(drawProgressCards(full, 'science', 1))).toEqual([]);
  });
});
