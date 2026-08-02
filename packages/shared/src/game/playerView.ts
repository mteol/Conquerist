import { z } from 'zod';

import { ResourceAmountsSchema, RuleSetSchema } from '../rules/index.js';
import { ScenarioDefinitionSchema } from '../scenario/index.js';
import type { Seat } from '../seats.js';
import { DevelopmentCardIdSchema, DevelopmentCardSchema } from './development.js';
import { RollSchema } from './dice.js';
import { playableDevelopmentCards, roadBuildingTargets } from './legal.js';
import { PhaseSchema } from './phase.js';
import { PlayerIdSchema } from './player.js';
import { countResources } from './resources.js';
import { publicVictoryPointsOf, victoryPointsOf } from './scoring.js';
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
  /** Ausgespielte Ritter. Oeffentlich - sie liegen offen. */
  playedKnights: z.number().int().min(0),
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
  largestArmy: z.object({
    holder: PlayerIdSchema.nullable(),
    size: z.number().int().min(0),
  }),
  /** Wie viele Karten der Stapel noch hergibt. Der Inhalt bleibt geheim. */
  deckLeft: z.number().int().min(0),
  /** Ob in diesem Zug schon eine Entwicklungskarte gespielt wurde. */
  developmentPlayed: z.boolean(),
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
   * Wo der Strassenbau hinkoennte: je moeglicher erster Kante die Kanten, die
   * danach noch gingen. Gerechnet auf dem Server - Anschluss ist eine Regel.
   */
  roadBuildingTargets: z.record(z.string(), z.array(z.string())),
  /** Der letzte Wurf, so wie er im Zustand steht - er ist oeffentlich. */
  lastRoll: RollSchema.nullable(),
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
        cardCount: countResources(player.resources),
        resources: player.id === viewer ? player.resources : null,
        developmentCards: player.id === viewer ? player.developmentCards : null,
        developmentCount: player.developmentCards.length,
        playedKnights: player.playedKnights,
        piecesLeft: player.piecesLeft,
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
    robber: state.robber,
    bank: state.bank,
    longestRoad: state.longestRoad,
    largestArmy: state.largestArmy,
    // Nur die Anzahl: wer den Stapel kennt, weiss vor dem Kauf, was er bekommt.
    deckLeft: state.deck.length,
    developmentPlayed: state.developmentPlayed,
    playableCards: playableDevelopmentCards(state, viewer),
    roadBuildingTargets: roadBuildingTargets(state, viewer),
    lastRoll: state.lastRoll,
    turn: state.turn,
  };
}
