import { describe, expect, it } from 'vitest';
import { CLASSIC_34 } from '../scenario/blueprints/classic34.js';
import { generateScenario } from '../scenario/generator.js';
import { CLASSIC_RULES } from '../rules/ruleset.js';
import { seatColorAt } from '../seats.js';
import { createGame, setupPlayer } from './setup.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { countResources } from './resources.js';
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
    expect(own.cardCount).toBe(countResources(state.players[1]!.resources));
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
      expect(player.cardCount).toBe(countResources(state.players[index]!.resources));
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
});
