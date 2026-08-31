import { z } from 'zod';

import { CardAmountsSchema } from '../rules/index.js';
import { CardIdSchema, ResourceIdSchema } from '../scenario/index.js';
import { ProgressCardIdSchema } from './cities/progress/cards.js';
import { ProgressPlaySchema } from './cities/progress/play.js';
import { TrackIdSchema } from './cities/tracks.js';
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
    give: CardIdSchema,
    receive: CardIdSchema,
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

  /*
   * Staedte & Ritter. Alle sieben tragen einen Knoten oder zwei - eine
   * Ritterfigur steht auf einer Kreuzung wie eine Siedlung, und das Versetzen
   * nennt Herkunft und Ziel, weil ein Spieler mehrere Ritter haben kann.
   */
  /** Eine Stadtmauer unter die eigene Stadt legen. */
  z.object({ ...Base, type: z.literal('buildWall'), vertex: z.string() }),
  /** Einen Einfachen Ritter aufstellen - passiv, ohne Helm. */
  z.object({ ...Base, type: z.literal('buildKnight'), vertex: z.string() }),
  /** Ihm den Helm aufsetzen. Handeln darf er ab dem naechsten Zug. */
  z.object({ ...Base, type: z.literal('activateKnight'), vertex: z.string() }),
  /** Ihn eine Stufe steigen lassen. */
  z.object({ ...Base, type: z.literal('upgradeKnight'), vertex: z.string() }),
  /**
   * Ihn versetzen - und dabei einen schwaecheren fremden Ritter vertreiben.
   *
   * **Eine Aktion und nicht zwei.** Ob es ein Zug oder ein Angriff wird,
   * entscheidet, was auf `to` steht; zwei Zugarten waeren zwei Auslegungen
   * derselben Frage, wohin ein Ritter ziehen darf.
   */
  z.object({ ...Base, type: z.literal('moveKnight'), from: z.string(), to: z.string() }),
  /**
   * Den Raeuber vom Nachbarfeld verjagen.
   *
   * Ohne Zielfeld und ohne Opfer - das kommt wie beim Ritterkarten-Zug als
   * eigener `moveRobber`, sobald die Phase auf `robberPending` steht.
   */
  z.object({ ...Base, type: z.literal('chaseRobber'), vertex: z.string() }),
  /** Den eigenen vertriebenen Ritter neu setzen. */
  z.object({ ...Base, type: z.literal('placeDisplacedKnight'), vertex: z.string() }),

  /** Eine Stufe im Stadtausbau steigen: Handel, Politik oder Wissenschaft. */
  z.object({
    ...Base,
    type: z.literal('improveCity'),
    track: TrackIdSchema,
    /**
     * Wohin der Aufsatz kommt - **nur**, wenn dieser Ausbau ihn einbringt.
     * `canImproveCity` weist beides ab: das Fehlen, wo er faellig ist, und die
     * Angabe, wo keiner kommt.
     */
    metropolisAt: z.string().optional(),
  }),

  /**
   * Eine Fortschrittskarte spielen. `play` traegt Kartenart und Auswahl in
   * einer eigenen Union (`ProgressPlaySchema`) - fuenfundzwanzig Eintraege
   * hier verdoppelten die Hauptunion, dieselbe Grenze wie bei den
   * Entwicklungskarten. Alchemie geht **vor** dem Wurf, jede andere Karte
   * **danach** - siehe `progressRules.ts`.
   */
  z.object({ ...Base, type: z.literal('playProgress'), play: ProgressPlaySchema }),

  /*
   * Die drei Wartestationen eines Wurfs (Etappe 10d). Alle drei sind eine
   * **Wahl**, die vorher eine feste Regel oder gar nichts war - deshalb je
   * eine eigene Aktion und kein Feld an `rollDice`: sie kommen erst, wenn der
   * Wurf schon gefallen ist.
   */
  /** Gleichstand in der Verteidigung: von welchem Stapel die Karte kommt. */
  z.object({ ...Base, type: z.literal('pickProgressDeck'), track: TrackIdSchema }),
  /** Mehr als vier zaehlende Fortschrittskarten: welche abgegeben wird. */
  z.object({
    ...Base,
    type: z.literal('discardProgressCard'),
    card: ProgressCardIdSchema,
  }),
  /** Aquaedukt: welchen Rohstoff der Leerausgegangene nimmt. */
  z.object({ ...Base, type: z.literal('pickAqueduct'), resource: ResourceIdSchema }),

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
  'buildWall',
  'buildKnight',
  'activateKnight',
  'upgradeKnight',
  'moveKnight',
  'chaseRobber',
  'placeDisplacedKnight',
  'improveCity',
  'playProgress',
  'pickProgressDeck',
  'discardProgressCard',
  'pickAqueduct',
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
