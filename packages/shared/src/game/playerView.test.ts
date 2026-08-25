import { describe, expect, it } from 'vitest';
import { CLASSIC_34 } from '../scenario/blueprints/classic34.js';
import { generateScenario } from '../scenario/generator.js';
import { CLASSIC_RULES } from '../rules/ruleset.js';
import { seatColorAt } from '../seats.js';
import { gameWithCities, testGame } from './fixtures.js';
import { createGame, setupPlayer } from './setup.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { countCards } from './cards.js';
import { PlayerViewSchema, playerViewOf } from './playerView.js';
import type { GameState } from './state.js';

const scenario = generateScenario(CLASSIC_34, 'view-geheim');
const seats = ['p1', 'p2', 'p3'].map((id, index) => ({
  id,
  name: `Spieler ${index + 1}`,
  color: seatColorAt(index),
}));

/** Eine Partie bis nach der Gruendung - dann haben alle Karten auf der Hand. */
function afterSetup(): GameState {
  let state = createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'view-geheim',
  );

  while (state.phase.kind === 'setup') {
    const result = reduce(state, legalActions(state, setupPlayer(state)!)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

/** Sammelt alle Schluessel eines Objektbaums - rekursiv, ohne Hinsehen. */
function allKeys(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, found);
    return found;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) {
      found.add(key);
      allKeys(inner, found);
    }
  }
  return found;
}

describe('PlayerView', () => {
  it('gibt den Zufallszustand nirgends heraus', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p1', seats, 7);

    // Rekursiv geprueft, nicht an der obersten Ebene: wer den RNG-Zustand
    // kennt, rechnet jeden kuenftigen Wuerfelwurf voraus.
    expect(allKeys(view).has('rng')).toBe(false);
    expect(JSON.stringify(view)).not.toContain('"rng"');
  });

  it('zeigt die eigenen Karten vollstaendig', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p2', seats, 1);
    const own = view.players.find((player) => player.id === 'p2')!;

    expect(own.resources).toEqual(state.players[1]!.resources);
    expect(own.cardCount).toBe(countCards(state.players[1]!.resources));
  });

  it('zeigt von fremden Haenden nur die Anzahl', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p2', seats, 1);

    for (const player of view.players) {
      if (player.id === 'p2') continue;
      expect(player.resources).toBeNull();
    }
  });

  it('luegt nicht - die Anzahlen stimmen mit dem echten Zustand ueberein', () => {
    const state = afterSetup();
    const view = playerViewOf(state, 'p1', seats, 1);

    view.players.forEach((player, index) => {
      expect(player.cardCount).toBe(countCards(state.players[index]!.resources));
    });
  });

  it('uebernimmt Namen und Farbe aus den Sitzen', () => {
    const view = playerViewOf(afterSetup(), 'p1', seats, 1);
    expect(view.players.map((player) => player.name)).toEqual([
      'Spieler 1',
      'Spieler 2',
      'Spieler 3',
    ]);
    expect(view.players[0]!.color).toBe(seatColorAt(0));
  });

  it('haelt das eigene Schema ein', () => {
    const view = playerViewOf(afterSetup(), 'p3', seats, 42);
    expect(PlayerViewSchema.safeParse(view).success).toBe(true);
    expect(view.you).toBe('p3');
    expect(view.version).toBe(42);
  });

  it('weist einen Zuschauer ab, der nicht am Tisch sitzt', () => {
    expect(() => playerViewOf(afterSetup(), 'fremder', seats, 1)).toThrow(RangeError);
  });

  it('zeigt von fremden Entwicklungskarten nur die Anzahl', () => {
    const state = afterSetup();
    const withCards: GameState = {
      ...state,
      players: state.players.map((entry, index) => ({
        ...entry,
        developmentCards:
          index === 0
            ? [{ id: 'knight' as const, boughtOnTurn: 0 }]
            : [
                { id: 'victoryPoint' as const, boughtOnTurn: 0 },
                { id: 'monopoly' as const, boughtOnTurn: 0 },
              ],
      })),
    };

    const view = playerViewOf(withCards, 'p1', seats, 1);

    // Wer sieht, dass jemand einen Ritter haelt, weiss, dass sein Raeuber
    // gleich weiterzieht.
    expect(view.players[0]!.developmentCards).toHaveLength(1);
    expect(view.players[1]!.developmentCards).toBeNull();
    // Abzaehlbar ist die Anzahl trotzdem - sie liegen sichtbar verdeckt da.
    expect(view.players[1]!.developmentCount).toBe(2);
  });

  it('verraet verdeckte Siegpunktkarten nicht ueber den Punktestand', () => {
    const state = afterSetup();
    const withCards: GameState = {
      ...state,
      players: state.players.map((entry, index) => ({
        ...entry,
        developmentCards: index === 1 ? [{ id: 'victoryPoint' as const, boughtOnTurn: 0 }] : [],
      })),
    };

    const own = playerViewOf(withCards, 'p2', seats, 1);
    const foreign = playerViewOf(withCards, 'p1', seats, 1);

    // p2 sieht seinen eigenen Punkt, p1 sieht ihn nicht - sonst waere die
    // Karte ueber die Differenz verraten.
    expect(own.players[1]!.victoryPoints).toBeGreaterThan(foreign.players[1]!.victoryPoints);
  });

  it('deckt die Siegpunkte auf, sobald die Partie vorbei ist', () => {
    const state = afterSetup();
    const withCards: GameState = {
      ...state,
      phase: { kind: 'finished', winner: 'p2' },
      players: state.players.map((entry, index) => ({
        ...entry,
        developmentCards: index === 1 ? [{ id: 'victoryPoint' as const, boughtOnTurn: 0 }] : [],
      })),
    };

    const own = playerViewOf(withCards, 'p2', seats, 1);
    const foreign = playerViewOf(withCards, 'p1', seats, 1);

    /*
     * Vorher waere die Endabrechnung in sich widerspruechlich gewesen: der
     * Sieger stand bei den anderen mit weniger Punkten da, als das Ziel
     * verlangt - es fehlten genau die Karten, mit denen er gewonnen hat.
     */
    expect(foreign.players[1]!.victoryPoints).toBe(own.players[1]!.victoryPoints);
  });

  it('gibt den Entwicklungsstapel nicht heraus, nur seine Groesse', () => {
    const state = afterSetup();
    const view = playerViewOf({ ...state, deck: ['knight', 'monopoly'] }, 'p1', seats, 1);

    // Nur die Groesse. Die Reihenfolge ist das Geheimnis: wer sie kennt, weiss
    // vor dem Kauf, was er zieht.
    expect(view.deckLeft).toBe(2);
    expect(allKeys(view).has('deck')).toBe(false);

    // Dass „monopoly" im JSON vorkommt, ist dagegen in Ordnung: das RuleSet
    // nennt die Stapelgroessen, und wie viele Karten es je Art gibt, steht in
    // der Anleitung.
    expect(view.rules.developmentDeck.monopoly).toBe(2);
  });
});

describe('canOfferTrade in der Sicht', () => {
  it('steht beim Spieler am Zug mit Karten, bei den anderen nicht', () => {
    const state = afterSetup();
    const current = state.players[state.currentPlayerIndex]!.id;
    const other = state.players.find((player) => player.id !== current)!.id;

    // Nach der Gruendung hat jeder Karten - der am Zug darf anbieten.
    expect(playerViewOf(state, current, seats, 0).canOfferTrade).toBe(state.phase.kind === 'main');
    expect(playerViewOf(state, other, seats, 0).canOfferTrade).toBe(false);
  });
});

describe('das Barbarenschiff in der Sicht', () => {
  it('steht offen da - jeder sieht, wie nah die Gefahr ist', () => {
    const view = playerViewOf(gameWithCities(), 'p1', seats, 1);

    expect(view.barbarians).toEqual({ position: 0, attacks: 0 });
  });

  it('fehlt an einem Tisch ohne Erweiterung', () => {
    expect(playerViewOf(testGame(), 'p1', seats, 1).barbarians).toBeNull();
  });

  /*
   * Eine Sicht aus einer Partie von vor der Erweiterung kennt das Feld nicht.
   * Ohne Vorgabe scheiterte sie am Schema - dieselbe Falle wie beim RuleSet.
   */
  it('ergaenzt sich in einer gespeicherten Sicht ohne dieses Feld', () => {
    const view = playerViewOf(testGame(), 'p1', seats, 1) as Record<string, unknown>;
    delete view['barbarians'];

    expect(PlayerViewSchema.parse(view).barbarians).toBeNull();
  });
});
