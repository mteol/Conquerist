import { describe, expect, it } from 'vitest';

import { CLASSIC_RULES, type ResourceAmounts } from '../rules/index.js';
import { CLASSIC_34, RESOURCE_IDS, generateScenario } from '../scenario/index.js';
import type { GameAction } from './actions.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { replay } from './replay.js';
import { EMPTY_RESOURCES, countResources } from './resources.js';
import { discardCountFor } from './robber.js';
import { victoryPointsOf } from './scoring.js';
import { createGame } from './setup.js';
import type { GameState } from './state.js';

/**
 * Eine vollstaendige Partie auf dem erzeugten Basisbrett, von `createGame` bis
 * `finished` - gespielt von einer stumpfen, aber deterministischen Strategie.
 *
 * Das ist die eigentliche Abnahme von Etappe 2. Die Regeltests pruefen jede
 * Regel fuer sich; erst hier zeigt sich, ob sie zusammen ein Spiel ergeben, das
 * anfaengt, laeuft und aufhoert. Und weil die ganze Aktionsfolge mitgeschrieben
 * wird, faellt am Ende gleich der Beleg fuer Regel 2 mit ab.
 */

const SCENARIO = generateScenario(CLASSIC_34, 'partie');
const PLAYERS = ['anna', 'ben', 'cem'] as const;

/** Alle Karten im Spiel - Bank plus alle Haende. Muss immer gleich bleiben. */
function totalCards(state: GameState): number {
  return state.players.reduce(
    (sum, player) => sum + countResources(player.resources),
    countResources(state.bank),
  );
}

/** Wirft die haeufigsten Karten ab - irgendeine Wahl muss die Strategie treffen. */
function chooseDiscard(state: GameState, player: string): ResourceAmounts {
  const owner = state.players.find((entry) => entry.id === player)!;
  const chosen: ResourceAmounts = { ...EMPTY_RESOURCES };

  let left = discardCountFor(state, player);
  while (left > 0) {
    const richest = [...RESOURCE_IDS].sort(
      (a, b) => owner.resources[b] - chosen[b] - (owner.resources[a] - chosen[a]),
    )[0]!;
    chosen[richest] += 1;
    left -= 1;
  }

  return chosen;
}

/**
 * Die Strategie: bauen, was geht - Stadt vor Siedlung vor Strasse -, sonst
 * tauschen, sonst den Zug beenden. Kein guter Spieler, aber ein
 * reproduzierbarer.
 */
const PRIORITY: readonly GameAction['type'][] = [
  'placeSetupSettlement',
  'placeSetupRoad',
  'rollDice',
  'moveRobber',
  'buildCity',
  'buildSettlement',
  'buildRoad',
  'tradeWithBank',
  'endTurn',
];

function chooseAction(state: GameState, player: string): GameAction | null {
  if (state.phase.kind === 'discardPending') {
    return { type: 'discard', player, resources: chooseDiscard(state, player) };
  }

  const options = legalActions(state, player);
  for (const type of PRIORITY) {
    const match = options.find((action) => action.type === type);
    if (match !== undefined) return match;
  }

  return null;
}

/** Wer als naechstes handeln muss. */
function nextActor(state: GameState): string | null {
  if (state.phase.kind === 'discardPending') return state.phase.pending[0] ?? null;
  if (state.phase.kind === 'finished') return null;
  if (state.phase.kind === 'setup') {
    const count = state.players.length;
    const index =
      state.phase.placement < count ? state.phase.placement : 2 * count - 1 - state.phase.placement;
    return state.players[index]?.id ?? null;
  }
  return state.players[state.currentPlayerIndex]?.id ?? null;
}

describe('Eine ganze Partie', () => {
  const initial = createGame(SCENARIO, CLASSIC_RULES, PLAYERS, 'partie-seed');
  const log: GameAction[] = [];

  let state = initial;
  let steps = 0;
  const LIMIT = 20_000;

  while (state.phase.kind !== 'finished' && steps < LIMIT) {
    const actor = nextActor(state);
    if (actor === null) break;

    const action = chooseAction(state, actor);
    if (action === null) break;

    const result = reduce(state, action);
    if (!result.ok) {
      throw new Error(
        `Zug ${steps} (${action.type}, ${actor}) abgelehnt: ${result.error.code} - ${result.error.message}`,
      );
    }

    // Karten koennen den Besitzer wechseln, aber nicht entstehen oder
    // verschwinden - die schaerfste Invariante, die das Spiel kennt.
    expect(totalCards(result.state)).toBe(totalCards(initial));

    log.push(action);
    state = result.state;
    steps += 1;
  }

  it('kommt zum Ende, ohne ins Limit zu laufen', () => {
    expect(steps).toBeLessThan(LIMIT);
    expect(state.phase.kind).toBe('finished');
  });

  it('kuert einen Sieger, der das Siegpunktziel erreicht hat', () => {
    expect(state.phase.kind).toBe('finished');
    if (state.phase.kind !== 'finished') return;

    const winner = state.phase.winner;
    expect(PLAYERS).toContain(winner);
    expect(victoryPointsOf(state, winner)).toBeGreaterThanOrEqual(CLASSIC_RULES.victoryPointGoal);
  });

  it('laesst niemanden ausser dem Sieger das Ziel erreichen', () => {
    if (state.phase.kind !== 'finished') return;

    for (const player of PLAYERS) {
      if (player === state.phase.winner) continue;
      expect(victoryPointsOf(state, player)).toBeLessThan(CLASSIC_RULES.victoryPointGoal);
    }
  });

  it('hat die Gruendungsphase vollstaendig durchlaufen', () => {
    const setupActions = log.filter(
      (action) => action.type === 'placeSetupSettlement' || action.type === 'placeSetupRoad',
    );

    expect(setupActions).toHaveLength(PLAYERS.length * 4);
    expect(log.slice(0, PLAYERS.length * 4)).toEqual(setupActions);
  });

  it('haelt die Bauteilvorraete ein', () => {
    for (const player of state.players) {
      const built = Object.values(state.buildings).filter(
        (building) => building.owner === player.id,
      );
      const settlements = built.filter((building) => building.kind === 'settlement').length;
      const cities = built.filter((building) => building.kind === 'city').length;
      const roads = Object.values(state.roads).filter((owner) => owner === player.id).length;

      expect(roads + player.piecesLeft.road).toBe(CLASSIC_RULES.pieceStock.road);
      expect(cities + player.piecesLeft.city).toBe(CLASSIC_RULES.pieceStock.city);
      // Beim Ausbau zur Stadt verschwindet die Siedlung vom Brett und liegt
      // wieder im Vorrat - die Summe bleibt deshalb der Startvorrat, ohne die
      // Staedte dazuzurechnen.
      expect(settlements + player.piecesLeft.settlement).toBe(CLASSIC_RULES.pieceStock.settlement);
      expect(cities).toBeGreaterThanOrEqual(0);
    }
  });

  it('laesst keine Karte entstehen oder verschwinden', () => {
    expect(totalCards(state)).toBe(totalCards(initial));
  });

  it('hat wirklich gespielt und nicht nur Zuege beendet', () => {
    const kinds = new Set(log.map((action) => action.type));

    expect(kinds).toContain('rollDice');
    expect(kinds).toContain('buildRoad');
    expect(kinds).toContain('buildSettlement');
    expect(kinds).toContain('buildCity');
    expect(log.length).toBeGreaterThan(100);
  });

  /**
   * Regel 2, belegt statt behauptet: derselbe Startzustand und dieselbe
   * Aktionsfolge ergeben denselben Endzustand - bis auf das letzte Bit des
   * Zufallszustands.
   */
  it('laesst sich aus Startzustand und Aktionsfolge exakt rekonstruieren', () => {
    const replayed = replay(initial, log);

    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(state);
  });

  it('spielt aus demselben Seed dieselbe Partie', () => {
    const again = createGame(SCENARIO, CLASSIC_RULES, PLAYERS, 'partie-seed');
    const replayed = replay(again, log);

    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(state);
  });

  it('bricht die Wiedergabe bei einem unmoeglichen Zug mit Position ab', () => {
    const broken = [...log.slice(0, 3), { type: 'endTurn', player: 'anna' } as GameAction];
    const result = replay(initial, broken);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Aktion 3');
  });
});
