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
 * Handel zwischen Spielern kam mit Etappe 8 dazu: `offerTrade` und was darauf
 * folgt. Wuerfelergebnisse stehen weiterhin nicht drin - der Client schickt
 * Absichten, keine Ergebnisse (Regel 3), und der Wurf entsteht aus dem
 * Zufallszustand im `GameState`.
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
  /** Eine Entwicklungskarte kaufen. Was man zieht, entscheidet der Stapel. */
  z.object({ ...Base, type: z.literal('buyDevelopmentCard') }),

  /**
   * Ritter ausspielen: der Raeuber zieht weiter.
   *
   * Ohne Feld und ohne Opfer - das kommt als eigener `moveRobber`, sobald die
   * Phase auf `robberPending` steht. Eine Aktion, die zwei Dinge auf einmal
   * tut, muesste beide Regeln in sich tragen.
   */
  z.object({ ...Base, type: z.literal('playKnight') }),

  /** Strassenbau: eine oder zwei Strassen umsonst. */
  z.object({
    ...Base,
    type: z.literal('playRoadBuilding'),
    edges: z.array(z.string()).min(1).max(2),
  }),

  /** Erfindung: genau zwei Rohstoffe aus der Bank. */
  z.object({
    ...Base,
    type: z.literal('playYearOfPlenty'),
    picks: z.array(ResourceIdSchema).length(2),
  }),

  /** Monopol: alle geben diesen Rohstoff ab. */
  z.object({ ...Base, type: z.literal('playMonopoly'), resource: ResourceIdSchema }),

  z.object({
    ...Base,
    type: z.literal('tradeWithBank'),
    give: ResourceIdSchema,
    receive: ResourceIdSchema,
  }),

  /**
   * Ein Angebot an den Tisch: diese Mengen gegen jene.
   *
   * `at` ist der Zeitpunkt, aus dem die Frist entsteht. Der **Server**
   * ueberschreibt ihn mit seiner eigenen Uhr, bevor der Zug die Logik erreicht -
   * ein Client, der sich zehn Minuten stempelt, hat damit keine Wirkung.
   */
  z.object({
    ...Base,
    type: z.literal('offerTrade'),
    give: ResourceAmountsSchema,
    want: ResourceAmountsSchema,
    at: z.number().int().min(0),
  }),

  /** Antwort eines Mitspielers auf ein offenes Angebot. */
  z.object({
    ...Base,
    type: z.literal('respondTrade'),
    response: z.enum(['accepted', 'declined']),
  }),

  z.object({ ...Base, type: z.literal('endTurn') }),
]);

export type GameAction = z.infer<typeof GameActionSchema>;

export type GameActionType = GameAction['type'];
