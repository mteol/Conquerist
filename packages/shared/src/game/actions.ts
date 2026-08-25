import { z } from 'zod';

import { CardAmountsSchema } from '../rules/index.js';
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
  z.object({ ...Base, type: z.literal('discard'), resources: CardAmountsSchema }),
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
    give: CardAmountsSchema,
    want: CardAmountsSchema,
    at: z.number().int().min(0),
  }),

  /** Antwort eines Mitspielers auf ein offenes Angebot. */
  z.object({
    ...Base,
    type: z.literal('respondTrade'),
    response: z.enum(['accepted', 'declined']),
  }),

  /**
   * Gegenangebot: die Antwort dieses Spielers mit eigenen Mengen.
   *
   * `give` und `want` stehen aus **seiner** Sicht - er gibt `give` und will
   * `want`. Ein Gegenangebot setzt die Frist neu, deshalb wieder ein `at`.
   */
  z.object({
    ...Base,
    type: z.literal('counterTrade'),
    give: CardAmountsSchema,
    want: CardAmountsSchema,
    at: z.number().int().min(0),
  }),

  /**
   * Zuschlag an einen Partner. **Ohne Mengen** - die stehen in seiner Antwort,
   * je nachdem ob er zugesagt oder gekontert hat.
   */
  z.object({ ...Base, type: z.literal('acceptTrade'), partner: PlayerIdSchema }),

  /**
   * Der Anbieter schlaegt **ein** Gegenangebot aus.
   *
   * Das Gegenstueck zu `acceptTrade` und der Grund, warum es das braucht: bis
   * dahin konnte der Anbieter ein Gegenangebot nur annehmen oder sein ganzes
   * Angebot zuruecknehmen. Wer drei Mitspieler hat und von einem ein Angebot
   * bekommt, das er nicht will, musste damit die Runde fuer alle beenden.
   *
   * Auch hier ohne Mengen: welches Gegenangebot gemeint ist, steht in der
   * Antwort des Partners.
   */
  z.object({ ...Base, type: z.literal('rejectCounter'), partner: PlayerIdSchema }),

  /** Der Anbieter nimmt sein Angebot zurueck. */
  z.object({ ...Base, type: z.literal('withdrawTrade') }),

  /**
   * Eine Frist ist abgelaufen. **Nur der Server wirft das ein** - der Handler
   * weist die Aktion ab, wenn sie von einem Client kommt.
   *
   * `player` ist, wem die Frist gehoerte: beim Angebot der Anbieter.
   */
  z.object({ ...Base, type: z.literal('timeout'), at: z.number().int().min(0) }),

  /**
   * Verbindungsverlust waehrend eines Angebots. **Nur vom Server.**
   *
   * `player` ist der Weggebrochene, nicht der Absender - genau deshalb kann
   * diese Aktion nicht ueber den gewoehnlichen Eingang kommen, der prueft, dass
   * beide dieselbe Person sind.
   */
  z.object({ ...Base, type: z.literal('dropFromTrade') }),

  /** Rueckkehr waehrend desselben Angebots. **Nur vom Server.** */
  z.object({ ...Base, type: z.literal('rejoinTrade') }),

  z.object({ ...Base, type: z.literal('endTurn') }),
]);

export type GameAction = z.infer<typeof GameActionSchema>;

export type GameActionType = GameAction['type'];

/**
 * Die Zugarten als Liste - fuer Stellen, die den Typ ohne die ganze Aktion
 * brauchen.
 *
 * Seit dem Ton schickt der Server ihn im Spielstand mit: der Client bekam
 * vorher nur den fertigen Verlaufssatz und konnte daraus nichts ableiten ausser
 * Text.
 *
 * Die Liste steht doppelt zur Union, und beide Waechter sind noetig:
 * `satisfies` faengt jeden Tippfehler, `AssertNever` darunter jeden
 * **vergessenen** Zweig. Ohne den zweiten bliebe ein neuer Zugtyp einfach
 * stumm, und niemand merkte es.
 */
export const GAME_ACTION_TYPES = [
  'placeSetupSettlement',
  'placeSetupRoad',
  'rollDice',
  'discard',
  'moveRobber',
  'buildRoad',
  'buildSettlement',
  'buildCity',
  'buyDevelopmentCard',
  'playKnight',
  'playRoadBuilding',
  'playYearOfPlenty',
  'playMonopoly',
  'tradeWithBank',
  'offerTrade',
  'respondTrade',
  'counterTrade',
  'acceptTrade',
  'rejectCounter',
  'withdrawTrade',
  'timeout',
  'dropFromTrade',
  'rejoinTrade',
  'endTurn',
] as const satisfies readonly GameActionType[];

type AssertNever<T extends never> = T;

/**
 * Der zweite Waechter: was in der Union steht und oben fehlt, landet hier - und
 * alles ausser `never` verletzt die Schranke.
 *
 * Er ist **exportiert, obwohl ihn niemand benutzt**: `noUnusedLocals` verwirft
 * einen nur lokal deklarierten Typ, und ein weggeworfener Waechter waecht
 * nichts.
 */
export type NoActionTypeForgotten = AssertNever<
  Exclude<GameActionType, (typeof GAME_ACTION_TYPES)[number]>
>;

export const GameActionTypeSchema = z.enum(GAME_ACTION_TYPES);

/**
 * Aktionen, die kein Spieler schickt.
 *
 * Zwei von ihnen sprechen **ueber** einen anderen Spieler, die dritte ist das
 * Ende einer Uhr. Der gewoehnliche Eingang prueft, dass Absender und
 * `player`-Feld dieselbe Person sind - diese drei kaemen dort nie durch und
 * sollen es auch nicht.
 */
export const SYSTEM_ACTION_TYPES = ['timeout', 'dropFromTrade', 'rejoinTrade'] as const;

export function isSystemAction(action: GameAction): boolean {
  return (SYSTEM_ACTION_TYPES as readonly string[]).includes(action.type);
}

/**
 * Setzt den Zeitpunkt einer Aktion auf die Uhr des Aufrufers.
 *
 * Der Server ruft das vor `reduce` und vor dem Log auf: was ein Client an `at`
 * mitgeschickt hat, ist damit wirkungslos, und der geloggte Wert ist derselbe,
 * aus dem die Frist entstanden ist - `replay` ergibt sie wieder. In der lokalen
 * Partie stempelt der Client selbst; dort ist niemand zu betruegen.
 */
export function stampAction(action: GameAction, at: number): GameAction {
  return 'at' in action ? { ...action, at } : action;
}
