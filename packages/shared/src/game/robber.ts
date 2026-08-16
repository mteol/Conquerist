import type { HexId } from '../geometry/index.js';
import { nextInt } from '../random/index.js';
import type { ResourceAmounts } from '../rules/index.js';
import { boardOf } from './board.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { PlayerId } from './player.js';
import {
  EMPTY_RESOURCES,
  addResources,
  canAfford,
  countResources,
  resourceAt,
  subtractResources,
} from './resources.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from './state.js';

/**
 * Die Sieben - abwerfen, Raeuber versetzen, stehlen.
 *
 * Drei Schritte, die nacheinander laufen und deshalb drei Phasen brauchen:
 * `discardPending` (alle ueber dem Limit werfen ab), `robberPending` (der
 * Spieler am Zug versetzt den Raeuber und stiehlt), dann `main`.
 *
 * Wer beim Abwerfen was weglegt, entscheidet der Spieler selbst - nur die
 * Anzahl ist vorgeschrieben. Wer beim Stehlen welche Karte verliert,
 * entscheidet der Zufall, und zwar aus dem Zustand heraus: gleicher
 * RNG-Zustand, gleiche Karte (Regel 2).
 */

/** Wie viele Karten dieser Spieler bei einer Sieben abwerfen muss. */
export function discardCountFor(state: GameState, player: PlayerId): number {
  const owner = findPlayer(state, player);
  if (owner === undefined) return 0;

  const held = countResources(owner.resources);
  return held > state.rules.handLimitBeforeDiscard ? Math.floor(held / 2) : 0;
}

/** Wer nach einer Sieben abwerfen muss - in Zugreihenfolge. */
export function playersMustDiscard(state: GameState): PlayerId[] {
  return state.players
    .filter((player) => discardCountFor(state, player.id) > 0)
    .map((player) => player.id);
}

/** Wirft die gewaehlten Karten ab und schaltet weiter, sobald alle fertig sind. */
export function applyDiscard(
  state: GameState,
  player: PlayerId,
  resources: ResourceAmounts,
): ReduceResult {
  const phase = state.phase;
  if (phase.kind !== 'discardPending' || !phase.pending.includes(player)) {
    return rejected(
      violation(RuleViolationCode.NOT_DISCARDING, `${player} muss gerade nichts abwerfen`),
    );
  }

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return rejected(
      violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`),
    );
  }

  const required = discardCountFor(state, player);
  const offered = countResources(resources);
  if (offered !== required) {
    return rejected(
      violation(
        RuleViolationCode.WRONG_DISCARD_COUNT,
        `${player} muss genau ${required} Karten abwerfen, angeboten waren ${offered}`,
      ),
    );
  }
  if (!canAfford(owner.resources, resources)) {
    return rejected(
      violation(
        RuleViolationCode.INSUFFICIENT_RESOURCES,
        `${player} hat diese Karten gar nicht auf der Hand`,
      ),
    );
  }

  const pending = phase.pending.filter((id) => id !== player);

  return ok({
    ...state,
    players: state.players.map((entry) =>
      entry.id === player
        ? { ...entry, resources: subtractResources(entry.resources, resources) }
        : entry,
    ),
    bank: addResources(state.bank, resources),
    phase: pending.length === 0 ? { kind: 'robberPending' } : { kind: 'discardPending', pending },
  });
}

/** Wen der Raeuber an diesem Feld bestehlen koennte: Anlieger mit Karten, ohne den Dieb. */
export function victimsAt(state: GameState, hex: HexId, thief: PlayerId): PlayerId[] {
  const board = boardOf(state.scenario);
  const found: PlayerId[] = [];

  for (const vertex of board.topology.hexVertices.get(hex) ?? []) {
    const building = state.buildings[vertex];
    if (building === undefined || building.owner === thief) continue;
    if (found.includes(building.owner)) continue;

    const victim = findPlayer(state, building.owner);
    if (victim !== undefined && countResources(victim.resources) > 0) found.push(building.owner);
  }

  return found;
}

/** Prueft das Versetzen samt Opferwahl. */
export function canMoveRobber(
  state: GameState,
  player: PlayerId,
  hex: HexId,
  victim: PlayerId | null,
): RuleViolation | null {
  const board = boardOf(state.scenario);

  if (!board.hexes.has(hex)) {
    return violation(
      RuleViolationCode.NOT_ON_BOARD,
      `Das Feld ${hex} gehört nicht zu diesem Brett`,
    );
  }
  if (hex === state.robber) {
    return violation(
      RuleViolationCode.ROBBER_SAME_HEX,
      'Der Räuber steht bereits auf diesem Feld und muss weiterziehen',
    );
  }

  const possible = victimsAt(state, hex, player);
  if (victim === null) {
    // Kein Opfer zu benennen ist nur erlaubt, wenn es auch keines gibt - sonst
    // koennte ein Spieler den Diebstahl einfach ausfallen lassen.
    return possible.length === 0
      ? null
      : violation(
          RuleViolationCode.VICTIM_REQUIRED,
          `Am Feld ${hex} laesst sich stehlen: ${possible.join(', ')}`,
        );
  }

  return possible.includes(victim)
    ? null
    : violation(
        RuleViolationCode.INVALID_VICTIM,
        `${victim} hat am Feld ${hex} nichts stehen oder keine Karten`,
      );
}

/** Versetzt den Raeuber, stiehlt gegebenenfalls und gibt in die Hauptphase weiter. */
export function applyMoveRobber(
  state: GameState,
  player: PlayerId,
  hex: HexId,
  victim: PlayerId | null,
): ReduceResult {
  const problem = canMoveRobber(state, player, hex, victim);
  if (problem !== null) return rejected(problem);

  const moved: GameState = { ...state, robber: hex, phase: { kind: 'main' } };
  if (victim === null) return ok(moved);

  const robbed = findPlayer(state, victim);
  if (robbed === undefined) {
    return rejected(
      violation(RuleViolationCode.UNKNOWN_PLAYER, `${victim} sitzt nicht an diesem Tisch`),
    );
  }

  // Die Hand wird durchnummeriert, der Zufall liefert den Index - so bleibt der
  // Diebstahl aus Seed und Aktionsfolge rekonstruierbar.
  const [index, rng] = nextInt(state.rng, countResources(robbed.resources));
  const taken = resourceAt(robbed.resources, index);
  const one: ResourceAmounts = { ...EMPTY_RESOURCES, [taken]: 1 };

  return ok({
    ...moved,
    rng,
    players: moved.players.map((entry) => {
      if (entry.id === victim)
        return { ...entry, resources: subtractResources(entry.resources, one) };
      if (entry.id === player) return { ...entry, resources: addResources(entry.resources, one) };
      return entry;
    }),
  });
}
