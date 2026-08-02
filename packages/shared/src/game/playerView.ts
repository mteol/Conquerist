import { z } from 'zod';

import { ResourceAmountsSchema, RuleSetSchema } from '../rules/index.js';
import { ScenarioDefinitionSchema } from '../scenario/index.js';
import type { Seat } from '../seats.js';
import { PhaseSchema } from './phase.js';
import { PlayerIdSchema } from './player.js';
import { countResources } from './resources.js';
import { victoryPointsOf } from './scoring.js';
import { BuildingSchema } from './state.js';
import type { GameState } from './state.js';

/**
 * Was ein einzelner Spieler sehen darf - Regel 4, endlich in Code.
 *
 * Die Aufteilung war seit Etappe 2 vorgesehen und der Zustand dafuer gebaut:
 * geheim sind genau `rng` und die `resources` der Mitspieler. Beides faellt
 * hier heraus, und zwar durch Weglassen beim Aufbau und nicht durch Loeschen
 * im Nachhinein - was nie hineinkommt, kann auch nicht vergessen werden.
 *
 * Der Router validiert jede ausgehende Nachricht gegen ihr Schema (Etappe 0,
 * mit genau dieser Etappe als Begruendung). Ein `rng`, das hier versehentlich
 * landete, waere damit ein Serverfehler und kein Informationsleck.
 */

export const PlayerInViewSchema = z.object({
  id: PlayerIdSchema,
  name: z.string().min(1),
  color: z.string().min(1),
  /** Ob dieser Spieler gerade verbunden ist. */
  connected: z.boolean(),
  /** Immer sichtbar - am Tisch waere sie abzaehlbar. */
  cardCount: z.number().int().min(0),
  /** Nur beim Empfaenger gefuellt, bei allen anderen `null`. */
  resources: ResourceAmountsSchema.nullable(),
  piecesLeft: z.record(z.string(), z.number().int().min(0)),
  victoryPoints: z.number().int().min(0),
});

export type PlayerInView = z.infer<typeof PlayerInViewSchema>;

export const PlayerViewSchema = z.object({
  /** Wer diese Sicht bekommt. */
  you: PlayerIdSchema,
  /** Zaehlt je Raum hoch; der Client verwirft aeltere Staende. */
  version: z.number().int().min(0),

  scenario: ScenarioDefinitionSchema,
  rules: RuleSetSchema,
  players: z.array(PlayerInViewSchema).min(2),
  currentPlayerIndex: z.number().int().min(0),
  phase: PhaseSchema,
  buildings: z.record(z.string(), BuildingSchema),
  roads: z.record(z.string(), PlayerIdSchema),
  robber: z.string(),
  bank: ResourceAmountsSchema,
  longestRoad: z.object({
    holder: PlayerIdSchema.nullable(),
    length: z.number().int().min(0),
  }),
  lastRoll: z.tuple([z.number().int(), z.number().int()]).nullable(),
  turn: z.number().int().min(0),
});

export type PlayerView = z.infer<typeof PlayerViewSchema>;

/** Verbindungszustand je Spieler; was fehlt, gilt als verbunden. */
export type ConnectedMap = ReadonlyMap<string, boolean>;

/**
 * Baut die Sicht eines Spielers.
 *
 * Wirft, wenn der Empfaenger nicht am Tisch sitzt: eine Sicht fuer jemanden zu
 * bauen, der nicht mitspielt, ist ein Fehler des Aufrufers und kein Spielzug.
 */
export function playerViewOf(
  state: GameState,
  viewer: string,
  seats: readonly Seat[],
  version: number,
  connected: ConnectedMap = new Map(),
): PlayerView {
  if (!state.players.some((player) => player.id === viewer)) {
    throw new RangeError(`playerViewOf: ${viewer} sitzt nicht an diesem Tisch`);
  }

  const seatOf = new Map(seats.map((seat) => [seat.id, seat]));

  return {
    you: viewer,
    version,
    scenario: state.scenario,
    rules: state.rules,
    players: state.players.map((player): PlayerInView => {
      const seat = seatOf.get(player.id);
      return {
        id: player.id,
        name: seat?.name ?? player.id,
        color: seat?.color ?? '#8b93a3',
        connected: connected.get(player.id) ?? true,
        cardCount: countResources(player.resources),
        resources: player.id === viewer ? player.resources : null,
        piecesLeft: player.piecesLeft,
        victoryPoints: victoryPointsOf(state, player.id),
      };
    }),
    currentPlayerIndex: state.currentPlayerIndex,
    phase: state.phase,
    buildings: state.buildings,
    roads: state.roads,
    robber: state.robber,
    bank: state.bank,
    longestRoad: state.longestRoad,
    lastRoll: state.lastRoll,
    turn: state.turn,
  };
}
