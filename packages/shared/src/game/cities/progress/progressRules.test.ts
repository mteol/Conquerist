import { describe, expect, it } from 'vitest';

import { RuleViolationCode } from '../../errors.js';
import { testGame } from '../../fixtures.js';
import { legalActions } from '../../legal.js';
import type { PlayerId, PlayerState } from '../../player.js';
import type { GameState } from '../../state.js';
import { CITIES_RULES } from '../../../rules/index.js';
import type { ProgressCardId } from './cards.js';
import { applyPlayProgress, canPlayProgress } from './progressRules.js';

/*
 * Die Helfer hier sind lokale Aufbauten aus `testGame` - `citiesTable`,
 * `withHand` und `playerNamed` gibt es nicht als fertige Bausteine. Der Tisch
 * hat drei Spieler in der Reihenfolge p1, p2, p3, p1 ist am Zug und steht in
 * der Hauptphase.
 */

/** Ein Staedte-&-Ritter-Tisch in der Hauptphase - p1 ist am Zug. */
function citiesTable(overrides: Partial<GameState> = {}): GameState {
  return testGame({ rules: CITIES_RULES, ...overrides });
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

describe('Fortschrittskarten spielen', () => {
  it('lehnt eine Karte ab, die nicht auf der Hand liegt', () => {
    const problem = canPlayProgress(citiesTable(), 'p1', { card: 'warlord' });
    expect(problem?.code).toBe(RuleViolationCode.NO_SUCH_PROGRESS_CARD);
  });

  it('nimmt die gespielte Karte von der Hand', () => {
    const state = withHand(citiesTable(), 'p1', ['warlord']);
    const result = applyPlayProgress(state, 'p1', { card: 'warlord' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(playerNamed(result.state, 'p1').progressCards).toEqual([]);
  });

  /*
   * Anders als bei den Entwicklungskarten gibt es keine Grenze "eine je Zug" -
   * die Regel erlaubt beliebig viele. `developmentPlayed` wird hier bewusst
   * nicht gelesen.
   */
  it('erlaubt zwei Karten im selben Zug', () => {
    const state = withHand(citiesTable(), 'p1', ['warlord', 'constitution']);
    const first = applyPlayProgress(state, 'p1', { card: 'warlord' });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(applyPlayProgress(first.state, 'p1', { card: 'constitution' }).ok).toBe(true);
    }
  });

  it('zaehlt jede spielbare Handkarte in legalActions auf', () => {
    const state = withHand(citiesTable(), 'p1', ['warlord', 'constitution']);
    const kinds = legalActions(state, 'p1')
      .filter((a) => a.type === 'playProgress')
      .map((a) => a.play.card);
    expect(kinds).toEqual(expect.arrayContaining(['warlord', 'constitution']));
  });

  /*
   * Die Phasenregel: Alchemie bestimmt die Wuerfel und muss deshalb VOR dem
   * Wurf gespielt werden - jede andere Karte erst danach. Ohne diese beiden
   * Tests stuende sieben Aufgaben lang ein Tor offen, durch das jede Karte vor
   * dem Wurf spielbar waere.
   */
  it('lehnt Alchemie in der Hauptphase ab - sie gehoert vor den Wurf', () => {
    const state = withHand(citiesTable(), 'p1', ['alchemist']);
    const problem = canPlayProgress(state, 'p1', { card: 'alchemist', first: 3, second: 4 });
    expect(problem?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('lehnt jede andere Karte vor dem Wurf ab - nur Alchemie darf dort', () => {
    const state = withHand(citiesTable({ phase: { kind: 'rollPending' } }), 'p1', ['warlord']);
    const problem = canPlayProgress(state, 'p1', { card: 'warlord' });
    expect(problem?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });
});
