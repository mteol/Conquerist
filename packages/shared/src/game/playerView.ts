import { z } from 'zod';

import { CardAmountsSchema, RuleSetSchema } from '../rules/index.js';
import { CardIdSchema, ScenarioDefinitionSchema } from '../scenario/index.js';
import type { Seat } from '../seats.js';
import { ProgressCardIdSchema } from './cities/progress/cards.js';
import { TRACK_IDS, TrackIdSchema } from './cities/tracks.js';
import { DevelopmentCardIdSchema, DevelopmentCardSchema } from './development.js';
import { RollSchema } from './dice.js';
import { playableDevelopmentCards, roadBuildingTargets } from './legal.js';
import { canOfferAnything } from './playerTrade.js';
import { PhaseSchema } from './phase.js';
import { PlayerIdSchema } from './player.js';
import { countCards } from './cards.js';
import { publicVictoryPointsOf, victoryPointsOf } from './scoring.js';
import { catanStrength } from './cities/knights.js';
import { BarbarianStateSchema, BuildingSchema, KnightSchema } from './state.js';
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
  resources: CardAmountsSchema.nullable(),
  /**
   * Entwicklungskarten auf der Hand - **nur beim Empfaenger**, sonst `null`.
   *
   * Sie sind die zweite geheime Haelfte: wer sieht, dass jemand einen Ritter
   * haelt, weiss, dass sein Raeuber gleich weiterzieht. Was jeder sehen darf,
   * ist die Anzahl (`developmentCount`) - am Tisch liegen sie abzaehlbar
   * verdeckt vor ihm.
   */
  developmentCards: z.array(DevelopmentCardSchema).nullable(),
  developmentCount: z.number().int().min(0),
  /**
   * Die offen liegenden Siegpunkt-Fortschrittskarten (Buchdruck, Verfassung).
   *
   * Nur diese beiden. Die uebrigen Fortschrittskarten liegen verdeckt und
   * stehen bei Mitspielern nur als Anzahl - dieselbe Grenze wie bei den
   * Handkarten.
   */
  openProgressCards: z.array(ProgressCardIdSchema).default([]),
  /**
   * Verdeckte Fortschrittskarten auf der Hand - **nur beim Empfaenger**, sonst
   * `null`. Dieselbe Grenze wie bei `developmentCards`: wer sieht, dass ein
   * Mitspieler den Diplomaten haelt, weiss, welche Strasse ihm gleich droht.
   * Fuer alle anderen bleibt nur die Anzahl (`progressCardCount`).
   */
  progressCards: z.array(ProgressCardIdSchema).nullable().default(null),
  /** Wie viele verdeckte Fortschrittskarten dieser Mitspieler haelt. */
  progressCardCount: z.number().int().min(0).default(0),
  /** Ausgespielte Ritter. Oeffentlich - sie liegen offen. */
  playedKnights: z.number().int().min(0),
  /**
   * Siegpunkt-Chips "Retter Catans". **Oeffentlich** - sie liegen offen vor
   * dem Spieler, und wer sie nicht sieht, kann den Punktestand am Tisch nicht
   * nachrechnen.
   */
  defenderPoints: z.number().int().min(0).default(0),
  piecesLeft: z.record(z.string(), z.number().int().min(0)),
  victoryPoints: z.number().int().min(0),
  /**
   * Erreichte Ausbaustufe je Bereich, 0 bis 5. **Oeffentlich** - die
   * Ausbaustufen liegen am Tisch offen sichtbar, es ist keine geheime
   * Information wie die Handkarten. `tradeRateFor` in `trade.ts` braucht das
   * Feld: die Gilde (Handel 3) steht beim Spieler, und ohne dieses Feld
   * koennte der Client seinen eigenen Kurs nicht mehr ausrechnen.
   */
  improvements: z.partialRecord(TrackIdSchema, z.number().int().min(0).max(5)).default({}),
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
  /**
   * Wer wo steht. **Oeffentlich** - Ritterfiguren stehen sichtbar auf dem
   * Brett, genau wie Siedlungen und Staedte.
   */
  knights: z.record(z.string(), KnightSchema).default({}),
  robber: z.string(),
  /**
   * Das Barbarenschiff. **Oeffentlich** - es steht fuer alle sichtbar am
   * Brettrand, und wie nah die Gefahr ist, ist keine Frage der Geheimhaltung,
   * sondern die Spannung der ganzen Erweiterung.
   */
  barbarians: BarbarianStateSchema.nullable().default(null),
  /**
   * Die Haendlerfigur. **Oeffentlich** - sie steht wie `robber` und
   * `barbarians` sichtbar auf dem Brett. `tradeRateFor` in `trade.ts` braucht
   * das Feld: ohne es koennte eine `PlayerView` ihren eigenen Kurs nicht mehr
   * ausrechnen, sobald der Haendler steht.
   */
  merchant: z.object({ hex: z.string(), owner: PlayerIdSchema }).nullable().default(null),
  /**
   * Die Staerke der Ritter Catans - ueber **alle** Spieler zusammen.
   *
   * Mitgeschickt und nicht im Browser gerechnet, obwohl `knights` daneben
   * steht: gegen die Barbaren zaehlt eine einzige Zahl, und sie steht in der
   * Barbarenleiste neben der Staerke des Heeres. Zwei Rechnungen fuer denselben
   * Vergleich liefen auseinander.
   */
  defenders: z.number().int().min(0).default(0),
  bank: CardAmountsSchema,
  longestRoad: z.object({
    holder: PlayerIdSchema.nullable(),
    length: z.number().int().min(0),
  }),
  largestArmy: z.object({
    holder: PlayerIdSchema.nullable(),
    size: z.number().int().min(0),
  }),
  /** Wie viele Karten der Stapel noch hergibt. Der Inhalt bleibt geheim. */
  deckLeft: z.number().int().min(0),
  /**
   * Wie viele Karten die drei Fortschrittsstapel je Bereich noch hergeben.
   * Nur die Resthoehe, aus demselben Grund wie bei `deckLeft`: der Inhalt und
   * die Reihenfolge bleiben geheim - wer den Stapel kennt, weiss vor dem
   * Ziehen, was er bekommt.
   */
  progressDeckSizes: z.partialRecord(TrackIdSchema, z.number().int().min(0)).default({}),
  /** Ob in diesem Zug schon eine Entwicklungskarte gespielt wurde. */
  developmentPlayed: z.boolean(),
  /**
   * Welche Sorte die Handelsflotte in diesem Zug 2:1 kostet, `null` ohne
   * aktive Flotte. **Oeffentlich** - sie wirkt am Bankhandel, den jeder am
   * Tisch sieht. `tradeRateFor` braucht das Feld aus demselben Grund wie
   * `merchant`.
   */
  fleetSort: CardIdSchema.nullable().default(null),
  /**
   * Die beiden Augen, die Alchemie fuer den naechsten Wurf festlegt, `null`
   * ohne aktiven Vorsatz. **Oeffentlich** - die Karte wird beim Ausspielen
   * angesagt, genau wie `merchant` und `fleetSort` sichtbar am Tisch wirken.
   */
  alchemistRoll: z
    .object({ first: z.number().int().min(1), second: z.number().int().min(1) })
    .nullable()
    .default(null),
  /**
   * Fuer welche Bereiche der naechste Ausbau in diesem Zug eine Handelsware
   * weniger kostet - der Kran-Vermerk. **Oeffentlich**, aus demselben Grund
   * wie `fleetSort`: beide sind Zustandsfelder, die nur fuer den laufenden
   * Zug gelten und die `endTurn` abraeumt, und keines verraet eine geheime
   * Handkarte - der Rabatt zeigt sich ohnehin, sobald ausgebaut wird.
   */
  craneDiscount: z.array(TrackIdSchema).default([]),
  /**
   * Welche Entwicklungskarten der Empfaenger jetzt ausspielen koennte.
   *
   * Steht hier und nicht in der Aktionsliste, weil drei der fuenf Karten eine
   * Auswahl brauchen, die der Spieler trifft - wie beim Abwerfen. Die Liste
   * sagt der Oberflaeche nur, welchen Knopf sie anbieten darf; ob die Auswahl
   * zulaessig war, prueft trotzdem der Reducer.
   */
  playableCards: z.array(DevelopmentCardIdSchema),
  /**
   * Ob der Empfaenger jetzt ein Angebot an die Mitspieler machen duerfte.
   *
   * Steht hier und nicht in der Aktionsliste, weil ein Angebot Mengen braucht -
   * jede Kombination ueber fuenf Sorten aufzuzaehlen waeren Tausende
   * Eintraege, dieselbe Begruendung wie beim Abwerfen.
   */
  canOfferTrade: z.boolean(),
  /**
   * Wo der Strassenbau hinkoennte: je moeglicher erster Kante die Kanten, die
   * danach noch gingen. Gerechnet auf dem Server - Anschluss ist eine Regel.
   */
  roadBuildingTargets: z.record(z.string(), z.array(z.string())),
  /** Der letzte Wurf, so wie er im Zustand steht - er ist oeffentlich. */
  lastRoll: RollSchema.nullable(),
  /** Wie oft welche Wurfsumme fiel - offenes Material, siehe `GameState`. */
  rollTally: z.record(z.string(), z.number().int().min(0)).default({}),
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

  /*
   * Am Spielende faellt die Geheimhaltung der Siegpunkte.
   *
   * Solange gespielt wird, sieht man bei den anderen nur die oeffentlichen
   * Punkte - sonst verriete der Punktestand die verdeckten Siegpunktkarten.
   * Danach ist es umgekehrt: der Endstand zeigte einen Sieger mit 8 von 10
   * Punkten, weil genau die beiden Karten fehlten, mit denen er gewonnen hat.
   * Eine Abrechnung, die sich selbst widerspricht, ist schlimmer als ein
   * fruehes Aufdecken - und aufgedeckt wird beim Sieg ohnehin.
   */
  const settled = state.phase.kind === 'finished';

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
        cardCount: countCards(player.resources),
        resources: player.id === viewer ? player.resources : null,
        developmentCards: player.id === viewer ? player.developmentCards : null,
        developmentCount: player.developmentCards.length,
        // Oeffentlich fuer alle - sie liegen offen vor dem Spieler.
        openProgressCards: player.openProgressCards,
        progressCards: player.id === viewer ? player.progressCards : null,
        progressCardCount: player.progressCards.length,
        playedKnights: player.playedKnights,
        defenderPoints: player.defenderPoints,
        piecesLeft: player.piecesLeft,
        improvements: player.improvements,
        /*
         * Bei sich selbst die volle Zahl, bei den anderen nur die oeffentliche -
         * bis die Partie vorbei ist, siehe `settled` oben.
         */
        victoryPoints:
          settled || player.id === viewer
            ? victoryPointsOf(state, player.id)
            : publicVictoryPointsOf(state, player.id),
      };
    }),
    currentPlayerIndex: state.currentPlayerIndex,
    phase: state.phase,
    buildings: state.buildings,
    roads: state.roads,
    knights: state.knights,
    robber: state.robber,
    barbarians: state.barbarians,
    merchant: state.merchant,
    defenders: catanStrength(state),
    bank: state.bank,
    longestRoad: state.longestRoad,
    largestArmy: state.largestArmy,
    // Nur die Anzahl: wer den Stapel kennt, weiss vor dem Kauf, was er bekommt.
    deckLeft: state.deck.length,
    progressDeckSizes: Object.fromEntries(
      TRACK_IDS.map((track) => [track, (state.progressDecks[track] ?? []).length]),
    ),
    developmentPlayed: state.developmentPlayed,
    fleetSort: state.fleetSort,
    alchemistRoll: state.alchemistRoll,
    craneDiscount: state.craneDiscount,
    playableCards: playableDevelopmentCards(state, viewer),
    canOfferTrade: canOfferAnything(state, viewer),
    roadBuildingTargets: roadBuildingTargets(state, viewer),
    lastRoll: state.lastRoll,
    rollTally: state.rollTally,
    turn: state.turn,
  };
}
