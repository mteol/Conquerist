import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES } from '../rules/ruleset.js';
import { buildDeck, isPlayable } from './development.js';
import {
  applyBuyDevelopmentCard,
  applyPlayKnight,
  applyPlayMonopoly,
  applyPlayYearOfPlenty,
  canBuyDevelopmentCard,
  canPlayDevelopmentCard,
} from './developmentRules.js';
import { RuleViolationCode } from './errors.js';
import { testGame } from './fixtures.js';
import { legalActions, playableDevelopmentCards } from './legal.js';
import { reduce } from './reducer.js';
import { victoryPointsOf } from './scoring.js';
import type { GameState } from './state.js';

/** Der Preis einer Karte, damit die Tests ihn nicht wiederholen. */
const PRICE = CLASSIC_RULES.buildCosts.developmentCard!;

function rich(overrides: Partial<GameState> = {}): GameState {
  return testGame({
    phase: { kind: 'main' },
    deck: ['knight', 'monopoly', 'yearOfPlenty'],
    players: testGame().players.map((entry, index) =>
      index === 0
        ? { ...entry, resources: { brick: 5, lumber: 5, wool: 5, grain: 5, ore: 5 } }
        : entry,
    ),
    ...overrides,
  });
}

describe('Entwicklungskarten kaufen', () => {
  it('nimmt die oberste Karte und bezahlt sie an die Bank', () => {
    const before = rich();
    const result = applyBuyDevelopmentCard(before, 'p1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const hand = result.state.players[0]!;
    expect(hand.developmentCards).toEqual([{ id: 'knight', boughtOnTurn: before.turn }]);
    expect(result.state.deck).toEqual(['monopoly', 'yearOfPlenty']);
    // Der Preis geht zurueck in die Bank - es entsteht nichts auf dem Brett.
    expect(result.state.bank.ore).toBe((before.bank.ore ?? 0) + (PRICE.ore ?? 0));
    expect(hand.resources.ore).toBe(5 - (PRICE.ore ?? 0));
  });

  it('weist einen leeren Stapel ab', () => {
    expect(canBuyDevelopmentCard(rich({ deck: [] }), 'p1')).not.toBeNull();
  });

  it('weist ab, wer nicht bezahlen kann', () => {
    const arm = rich({
      players: testGame().players.map((entry) => ({
        ...entry,
        resources: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 },
      })),
    });

    expect(canBuyDevelopmentCard(arm, 'p1')).not.toBeNull();
  });

  it('gibt es erst nach dem Wuerfeln', () => {
    expect(canBuyDevelopmentCard(rich({ phase: { kind: 'rollPending' } }), 'p1')).not.toBeNull();
  });
});

describe('Entwicklungskarten ausspielen', () => {
  it('laesst eine Karte nicht in der Runde spielen, in der sie gekauft wurde', () => {
    const bought = applyBuyDevelopmentCard(rich(), 'p1');
    if (!bought.ok) throw new Error('Kauf abgelehnt');

    // Sonst waere ein Ritter die Antwort auf die eigene Sieben.
    expect(canPlayDevelopmentCard(bought.state, 'p1', 'knight')).not.toBeNull();
    expect(playableDevelopmentCards(bought.state, 'p1')).toEqual([]);
  });

  it('erlaubt sie eine Runde spaeter', () => {
    const state = rich({
      turn: 3,
      players: testGame().players.map((entry, index) =>
        index === 0 ? { ...entry, developmentCards: [{ id: 'knight', boughtOnTurn: 2 }] } : entry,
      ),
    });

    expect(canPlayDevelopmentCard(state, 'p1', 'knight')).toBeNull();
    expect(playableDevelopmentCards(state, 'p1')).toEqual(['knight']);
  });

  it('laesst nur eine Karte je Zug zu', () => {
    const state = rich({
      turn: 3,
      players: testGame().players.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              developmentCards: [
                { id: 'knight', boughtOnTurn: 1 },
                { id: 'monopoly', boughtOnTurn: 1 },
              ],
            }
          : entry,
      ),
    });

    const played = applyPlayKnight(state, 'p1');
    if (!played.ok) throw new Error('Ritter abgelehnt');

    expect(canPlayDevelopmentCard(played.state, 'p1', 'monopoly')).not.toBeNull();
  });

  it('gibt die aelteste Karte ab, nicht die frisch gekaufte', () => {
    // Sonst bliebe die alte gesperrt, obwohl sie es nicht sein duerfte.
    const state = rich({
      turn: 5,
      players: testGame().players.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              developmentCards: [
                { id: 'knight', boughtOnTurn: 1 },
                { id: 'knight', boughtOnTurn: 5 },
              ],
            }
          : entry,
      ),
    });

    const played = applyPlayKnight(state, 'p1');
    if (!played.ok) throw new Error('Ritter abgelehnt');

    expect(played.state.players[0]!.developmentCards).toEqual([{ id: 'knight', boughtOnTurn: 5 }]);
  });

  it('schickt den Ritter in die Raeuberphase und zaehlt ihn mit', () => {
    const state = rich({
      turn: 3,
      players: testGame().players.map((entry, index) =>
        index === 0 ? { ...entry, developmentCards: [{ id: 'knight', boughtOnTurn: 1 }] } : entry,
      ),
    });

    const played = applyPlayKnight(state, 'p1');
    if (!played.ok) throw new Error('Ritter abgelehnt');

    // Das Versetzen selbst bleibt `moveRobber` - zwei Auslegungen des Raeubers
    // gaebe es sonst.
    expect(played.state.phase.kind).toBe('robberPending');
    expect(played.state.players[0]!.playedKnights).toBe(1);
    expect(legalActions(played.state, 'p1').every((action) => action.type === 'moveRobber')).toBe(
      true,
    );
  });
});

describe('Groesste Rittermacht', () => {
  function withKnights(counts: readonly number[]): GameState {
    return rich({
      turn: 9,
      players: testGame().players.map((entry, index) => ({
        ...entry,
        playedKnights: counts[index] ?? 0,
        developmentCards: index === 0 ? [{ id: 'knight', boughtOnTurn: 1 }] : [],
      })),
    });
  }

  it('wird erst ab der Mindestzahl vergeben', () => {
    const state = withKnights([2, 0, 0]);
    const played = applyPlayKnight(state, 'p1');
    if (!played.ok) throw new Error('abgelehnt');

    // Der dritte Ritter ist der, der zaehlt.
    expect(played.state.largestArmy).toEqual({ holder: 'p1', size: 3 });
  });

  it('wechselt nicht bei Gleichstand', () => {
    const state = rich({
      turn: 9,
      largestArmy: { holder: 'p2', size: 3 },
      players: testGame().players.map((entry, index) => ({
        ...entry,
        playedKnights: index === 0 ? 2 : index === 1 ? 3 : 0,
        developmentCards: index === 0 ? [{ id: 'knight', boughtOnTurn: 1 }] : [],
      })),
    });

    const played = applyPlayKnight(state, 'p1');
    if (!played.ok) throw new Error('abgelehnt');

    // Gleichauf reicht nicht - sonst wanderte der Titel hin und her.
    expect(played.state.largestArmy).toEqual({ holder: 'p2', size: 3 });
  });

  it('zaehlt zwei Siegpunkte, sobald sie jemand haelt', () => {
    const state = rich({ largestArmy: { holder: 'p1', size: 3 } });

    expect(victoryPointsOf(state, 'p1')).toBe(CLASSIC_RULES.victoryPoints.largestArmy);
    expect(victoryPointsOf(state, 'p2')).toBe(0);
  });
});

describe('Erfindung und Monopol', () => {
  function holding(card: 'yearOfPlenty' | 'monopoly'): GameState {
    return rich({
      turn: 4,
      players: testGame().players.map((entry, index) =>
        index === 0
          ? { ...entry, developmentCards: [{ id: card, boughtOnTurn: 1 }] }
          : { ...entry, resources: { brick: 0, lumber: 3, wool: 0, grain: 0, ore: 0 } },
      ),
    });
  }

  it('nimmt bei Erfindung genau zwei Rohstoffe aus der Bank', () => {
    const before = holding('yearOfPlenty');
    const played = applyPlayYearOfPlenty(before, 'p1', ['ore', 'ore']);

    expect(played.ok).toBe(true);
    if (!played.ok) return;

    expect(played.state.players[0]!.resources.ore).toBe(
      (before.players[0]!.resources.ore ?? 0) + 2,
    );
    expect(played.state.bank.ore).toBe((before.bank.ore ?? 0) - 2);
  });

  it('weist eine Erfindung ab, wenn die Bank leer ist', () => {
    const before = holding('yearOfPlenty');
    const leer = { ...before, bank: { ...before.bank, ore: 1 } };

    expect(applyPlayYearOfPlenty(leer, 'p1', ['ore', 'ore']).ok).toBe(false);
  });

  it('zieht beim Monopol allen dieselbe Sorte ab', () => {
    const before = holding('monopoly');
    const mine = before.players[0]!.resources.lumber ?? 0;
    const played = applyPlayMonopoly(before, 'p1', 'lumber');

    expect(played.ok).toBe(true);
    if (!played.ok) return;

    // Zwei Mitspieler mit je drei Holz.
    expect(played.state.players[0]!.resources.lumber).toBe(mine + 6);
    for (const other of played.state.players.slice(1)) {
      expect(other.resources.lumber).toBe(0);
    }
  });
});

describe('Siegpunktkarten', () => {
  it('zaehlen sofort und werden nie gespielt', () => {
    const state = rich({
      turn: 4,
      players: testGame().players.map((entry, index) =>
        index === 0
          ? { ...entry, developmentCards: [{ id: 'victoryPoint', boughtOnTurn: 1 }] }
          : entry,
      ),
    });

    expect(victoryPointsOf(state, 'p1')).toBe(CLASSIC_RULES.victoryPoints.developmentCard);
    expect(isPlayable({ id: 'victoryPoint', boughtOnTurn: 1 }, 9)).toBe(false);
    expect(playableDevelopmentCards(state, 'p1')).toEqual([]);
  });
});

describe('Der Stapel', () => {
  it('hat die 25 Karten der Schachtel', () => {
    const deck = buildDeck(CLASSIC_RULES.developmentDeck);

    expect(deck).toHaveLength(25);
    expect(deck.filter((card) => card === 'knight')).toHaveLength(14);
    expect(deck.filter((card) => card === 'victoryPoint')).toHaveLength(5);
  });

  it('geht durch den Reducer denselben Weg wie von Hand', () => {
    const before = rich();
    const direct = applyBuyDevelopmentCard(before, 'p1');
    const routed = reduce(before, { type: 'buyDevelopmentCard', player: 'p1' });

    expect(routed).toEqual(direct);
  });
});

describe('wann gekauft und wann gespielt werden darf', () => {
  /** Ein Spieler mit einer Ritterkarte, die nicht aus diesem Zug stammt. */
  const withKnight = (phase: GameState['phase']): GameState => {
    const base = testGame({ phase, turn: 2 });
    return {
      ...base,
      players: base.players.map((player) =>
        player.id === 'p1'
          ? { ...player, developmentCards: [{ id: 'knight' as const, boughtOnTurn: 1 }] }
          : player,
      ),
    };
  };

  it('laesst vor dem Wurf nicht kaufen', () => {
    const state = withKnight({ kind: 'rollPending' });

    expect(canBuyDevelopmentCard(state, 'p1')?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('laesst vor dem Wurf spielen', () => {
    const state = withKnight({ kind: 'rollPending' });

    expect(canPlayDevelopmentCard(state, 'p1', 'knight')).toBeNull();
  });

  it('laesst in der Hauptphase weiterhin beides', () => {
    const state = withKnight({ kind: 'main' });

    expect(canPlayDevelopmentCard(state, 'p1', 'knight')).toBeNull();
  });

  it('laesst in der Gruendung keines von beiden', () => {
    const state = withKnight({ kind: 'setup', placement: 0, settlement: null });

    expect(canBuyDevelopmentCard(state, 'p1')?.code).toBe(RuleViolationCode.WRONG_PHASE);
    expect(canPlayDevelopmentCard(state, 'p1', 'knight')?.code).toBe(RuleViolationCode.WRONG_PHASE);
  });

  it('laesst den, der nicht am Zug ist, auch vor dem Wurf nicht spielen', () => {
    const state = withKnight({ kind: 'rollPending' });

    expect(canPlayDevelopmentCard(state, 'p2', 'knight')?.code).toBe(
      RuleViolationCode.NOT_YOUR_TURN,
    );
  });
});
