import type { CardAmounts } from '../rules/index.js';
import { isCommodity, terrainYield, type CardId } from '../scenario/index.js';
import { boardOf } from './board.js';
import { hasGuild, type TrackLevelSource } from './cities/tracks.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { PlayerId, PlayerState } from './player.js';
import { EMPTY_CARDS, addCards, canAfford, subtractCards } from './cards.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from './state.js';

/**
 * Handel mit der Bank und ueber die Haefen.
 *
 * Handel zwischen Spielern kommt in Etappe 8. Was hier steht, ist der Teil, der
 * das Spiel ueberhaupt am Laufen haelt: ohne ihn koennte ein Spieler mit
 * fuenfzehn Erz und ohne Holz nie wieder bauen.
 *
 * Der Kurs wird **nicht** mitgeschickt, sondern abgeleitet. Ein Client, der
 * sich sein Verhaeltnis selbst aussucht, waere genau die Art von Ergebnis, die
 * Regel 3 ausschliesst - er schickt Absichten, keine Ergebnisse.
 */

/** Der Standardkurs ohne Hafen. */
const DEFAULT_RATE = 4;

/** Der Kurs der Gilde fuer Handelswaren - eine 2 mit Namen. */
const GUILD_RATE = 2;

/** Der Kurs der Handelsflotte, bis Zugende - wieder eine 2. */
const FLEET_RATE = 2;

/** Der Kurs des Haendlers auf dem Rohstoff seines Feldes - ebenfalls eine 2. */
const MERCHANT_RATE = 2;

/**
 * Was `tradeRateFor` wirklich braucht.
 *
 * Nur Brett, Belegung, die Ausbaustufen der Spieler und die beiden
 * Zugbindungen Handelsflotte und Haendler - keine Handkarten, kein Zufall.
 * Deshalb ein eigener Typ statt `GameState`: so kann auch eine `PlayerView`
 * den Kurs ausrechnen, und die Oberflaeche muss ihn nicht vom Server
 * erfragen. Es ist keine Regel, die hier zweimal ausgelegt wird - es ist
 * dieselbe Funktion.
 *
 * `players` traegt seit der Gilde nur, was `hasGuild` liest (`TrackLevelSource`)
 * und `id`, um den Spieler zu finden - nicht `readonly PlayerState[]`. So
 * geht sowohl `GameState['players']` als auch die Spielerliste einer
 * `PlayerView` durch, ohne dass eine der beiden Seiten mehr vortaeuschen
 * muesste, als sie hat.
 *
 * `fleetSort` und `merchant` sind hier als eigene Felder und nicht als
 * `Pick<GameState, ...>` notiert, aber vom selben Typ wie in `GameState` -
 * eine `PlayerView` traegt beide oeffentlich mit, aus demselben Grund wie
 * `robber` und `barbarians`.
 */
export interface HarborSource {
  readonly scenario: GameState['scenario'];
  readonly buildings: GameState['buildings'];
  readonly players: readonly (Pick<PlayerState, 'id'> & TrackLevelSource)[];
  readonly fleetSort: GameState['fleetSort'];
  readonly merchant: GameState['merchant'];
}

/**
 * Der beste Kurs, den dieser Spieler fuer diese Ressource erreicht.
 *
 * Ein Hafen zaehlt, wenn der Spieler auf einem der beiden Knoten seiner Kante
 * gebaut hat - Siedlung wie Stadt. Der 2:1-Hafen gilt nur fuer seine eigene
 * Ressource, der 3:1-Hafen fuer jede.
 *
 * **Handelswaren gehen hier ohne Sonderfall durch.** Ein 2:1-Hafen traegt
 * immer einen Rohstoff, und `harbor.resource !== give` ist fuer jede
 * Handelsware damit schon wahr - es gibt keinen Papierhafen, und ein Erzhafen
 * macht Muenzen nicht billiger. Der 3:1-Hafen (`resource === undefined`)
 * greift dagegen weiter, und das ist die Regel: "Wer ueber einen 3:1-Hafen
 * verfuegt, darf Handelswaren auch im Verhaeltnis 3:1 tauschen."
 *
 * Das steht hier, weil die Stelle beim naechsten Lesen sonst aussieht, als
 * haette jemand den Fall vergessen.
 *
 * Die Handelsflotte: eine Sorte (Rohstoff oder Handelsware) 2:1 bis Zugende.
 * Der Haendler: der Rohstoff seines Feldes 2:1, solange er dort steht und
 * solange er diesem Spieler gehoert. Beide treten gegen die Haefen und die
 * Gilde an und gewinnen nur, wo sie besser sind - dieselbe `Math.min`-Logik
 * wie zwischen zwei Haefen.
 *
 * Alle vier Quellen stehen absichtlich in derselben Funktion: es gibt **eine**
 * Stelle, die einen Kurs bestimmt, und `canTradeWithBank`/`applyTradeWithBank`
 * werden dadurch automatisch korrekt, ohne von der Flotte oder dem Haendler zu
 * wissen.
 */
export function tradeRateFor(state: HarborSource, player: PlayerId, give: CardId): number {
  const board = boardOf(state.scenario);
  let best = DEFAULT_RATE;

  for (const [vertex, building] of Object.entries(state.buildings)) {
    if (building.owner !== player) continue;

    for (const harbor of board.harborsAtVertex.get(vertex) ?? []) {
      if (harbor.ratio === 2 && harbor.resource !== give) continue;
      if (harbor.ratio < best) best = harbor.ratio;
    }
  }

  /*
   * Die Gilde: zwei gleiche **Handelswaren** gegen eine beliebige Karte. Sie
   * steht beim Spieler und nicht am Brett - deshalb traegt `HarborSource` seit
   * dieser Etappe die Spielerliste mit. Rohstoffe beruehrt sie nicht: der Kurs
   * fuer Lehm bleibt, was der beste Hafen hergibt.
   *
   * Sie tritt gegen die Haefen an und gewinnt nur, wo sie besser ist - dieselbe
   * `Math.min`-Logik wie zwischen zwei Haefen. Ein eigener Zweig "Gilde schlaegt
   * alles" waere falsch: ein 2:1-Hafen auf Papier ist genauso gut.
   */
  const owner = state.players.find((entry) => entry.id === player);
  if (owner !== undefined && isCommodity(give) && hasGuild(owner) && GUILD_RATE < best) {
    best = GUILD_RATE;
  }

  /*
   * Die Handelsflotte traegt keinen Besitzer im Zustand - sie muss keinen,
   * denn es ist immer nur einer am Zug, und `endTurn` raeumt `fleetSort`
   * wieder ab (siehe `state.ts`). Wer auch immer hier nach seinem Kurs fragt,
   * ist also implizit der, fuer den die Flotte gerade gilt.
   */
  if (state.fleetSort === give && FLEET_RATE < best) {
    best = FLEET_RATE;
  }

  /*
   * Der Haendler: 2:1 auf den Rohstoff seines Feldes, aber nur beim
   * aktuellen Besitzer - er wandert, wenn jemand anders die Karte spielt,
   * ohne dass der alte Besitzer etwas tut.
   */
  if (state.merchant !== null && state.merchant.owner === player) {
    const placement = board.hexes.get(state.merchant.hex as any);
    const resource = placement !== undefined ? terrainYield(placement.terrain) : null;
    if (resource === give && MERCHANT_RATE < best) {
      best = MERCHANT_RATE;
    }
  }

  return best;
}

/** Prueft einen Banktausch vollstaendig. */
export function canTradeWithBank(
  state: GameState,
  player: PlayerId,
  give: CardId,
  receive: CardId,
): RuleViolation | null {
  if (give === receive) {
    return violation(
      RuleViolationCode.INVALID_TRADE,
      `${give} gegen ${receive} zu tauschen ändert nichts`,
    );
  }

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }

  const rate = tradeRateFor(state, player, give);
  const cost: CardAmounts = { ...EMPTY_CARDS, [give]: rate };
  if (!canAfford(owner.resources, cost)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `Der Kurs ist ${rate}:1 - ${player} hat nicht ${rate} mal ${give}`,
    );
  }

  if (state.bank[receive] < 1) {
    return violation(RuleViolationCode.BANK_EMPTY, `Die Bank hat kein ${receive} mehr`);
  }

  return null;
}

export function applyTradeWithBank(
  state: GameState,
  player: PlayerId,
  give: CardId,
  receive: CardId,
): ReduceResult {
  const problem = canTradeWithBank(state, player, give, receive);
  if (problem !== null) return rejected(problem);

  const rate = tradeRateFor(state, player, give);
  const given: CardAmounts = { ...EMPTY_CARDS, [give]: rate };
  const taken: CardAmounts = { ...EMPTY_CARDS, [receive]: 1 };

  return ok({
    ...state,
    players: state.players.map((entry) =>
      entry.id === player
        ? {
            ...entry,
            resources: addCards(subtractCards(entry.resources, given), taken),
          }
        : entry,
    ),
    bank: subtractCards(addCards(state.bank, given), taken),
  });
}
