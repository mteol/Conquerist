import { z } from 'zod';

import { ResourceAmountsSchema } from '../rules/index.js';
import { ResourceIdSchema } from '../scenario/index.js';
import { PlayerIdSchema } from './player.js';

/**
 * Die Spielzuege als Discriminated Union (Regel 5).
 *
 * Jede Aktion nennt ihren Urheber. Das wirkt in der Hotseat-Partie aus Etappe 3
 * ueberfluessig, ist aber ab Etappe 4 der Punkt, an dem der Server prueft, ob
 * der Absender ueberhaupt der ist, fuer den er sich ausgibt - und in der
 * Gruendungsphase und beim Abwerfen ist ohnehin nicht immer der Spieler am Zug
 * derjenige, der handeln muss.
 *
 * Was hier fehlt und fehlen soll: Handel zwischen Spielern und
 * Entwicklungskarten (Etappe 8). Wuerfelergebnisse stehen ebenfalls nicht drin -
 * der Client schickt Absichten, keine Ergebnisse (Regel 3), und der Wurf
 * entsteht aus dem Zufallszustand im `GameState`.
 */

const Base = { player: PlayerIdSchema };

export const GameActionSchema = z.discriminatedUnion('type', [
  /** Gruendungsphase: Siedlung setzen. Ohne Kosten und ohne Anbindung. */
  z.object({ ...Base, type: z.literal('placeSetupSettlement'), vertex: z.string() }),
  /** Gruendungsphase: die zugehoerige Strasse setzen. */
  z.object({ ...Base, type: z.literal('placeSetupRoad'), edge: z.string() }),

  /** Wuerfeln. Verbraucht den Zufallszustand. */
  z.object({ ...Base, type: z.literal('rollDice') }),

  /** Nach einer Sieben: die Haelfte abwerfen. Der Spieler waehlt selbst aus. */
  z.object({ ...Base, type: z.literal('discard'), resources: ResourceAmountsSchema }),
  /**
   * Raeuber versetzen und stehlen. `victim` ist `null`, wenn am neuen Feld
   * niemand mit Karten wohnt - sonst muss ein Anlieger benannt werden.
   */
  z.object({
    ...Base,
    type: z.literal('moveRobber'),
    hex: z.string(),
    victim: PlayerIdSchema.nullable(),
  }),

  z.object({ ...Base, type: z.literal('buildRoad'), edge: z.string() }),
  z.object({ ...Base, type: z.literal('buildSettlement'), vertex: z.string() }),
  z.object({ ...Base, type: z.literal('buildCity'), vertex: z.string() }),

  /**
   * Tausch mit der Bank. Das Verhaeltnis wird nicht mitgeschickt, sondern aus
   * den erreichbaren Haefen abgeleitet - der beste verfuegbare Kurs gilt
   * automatisch. Sonst koennte ein Client sich selbst einen Kurs ausdenken.
   */
  z.object({
    ...Base,
    type: z.literal('tradeWithBank'),
    give: ResourceIdSchema,
    receive: ResourceIdSchema,
  }),

  z.object({ ...Base, type: z.literal('endTurn') }),
]);

export type GameAction = z.infer<typeof GameActionSchema>;

export type GameActionType = GameAction['type'];
