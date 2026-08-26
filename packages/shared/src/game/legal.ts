import type { EdgeId } from '../geometry/index.js';
import type { GameAction } from './actions.js';
import { boardOf } from './board.js';
import {
  canBuildCity,
  canBuildRoad,
  canBuildSettlement,
  canPlaceRoadAt,
  canPlaceSettlementAt,
} from './build.js';
import { openingRoller } from './phase.js';
import type { PlayerId } from './player.js';
import { canAcceptTrade, canRejectCounter, canRespondTrade } from './playerTrade.js';
import { canMoveRobber, victimsAt } from './robber.js';
import { setupPlayer } from './setup.js';
import type { GameState } from './state.js';
import { canTradeWithBank } from './trade.js';
import {
  applyPlayRoadBuilding,
  canBuyDevelopmentCard,
  canPlayDevelopmentCard,
} from './developmentRules.js';
import { DEVELOPMENT_CARD_IDS, type DevelopmentCardId } from './development.js';
import { canActivateKnight, canBuildKnight, canUpgradeKnight } from './cities/knights.js';
import { canChaseRobber, canMoveKnight, displacementTargets } from './cities/knightActions.js';
import { reachableVertices } from './cities/knightMoves.js';
import { canBuildWall } from './cities/walls.js';
import { canImproveCity, claimsMetropolis } from './cities/improvements.js';
import { TRACK_IDS } from './cities/tracks.js';

/**
 * Was dieser Spieler gerade tun darf.
 *
 * Dieselbe Frage wie im Reducer, nur von der anderen Seite gestellt: nicht
 * "ist dieser Zug erlaubt?", sondern "welche sind es?". Beantwortet wird sie
 * mit **denselben** `can…`-Funktionen aus den Regeldateien - eine zweite
 * Regelauslegung waere genau der Fehler, den die Aufteilung verhindern soll.
 *
 * Gedacht fuer die Oberflaeche ab Etappe 3 (ausgegraute Knoepfe statt Zuege ins
 * Leere) und fuer eine einfache Gegner-Strategie im Test.
 *
 * **Nicht aufgezaehlt wird das Abwerfen.** Bei acht Handkarten gibt es dutzende
 * gueltige Kombinationen; sie alle aufzulisten waere nutzlos. Wie viele Karten
 * faellig sind, sagt `discardCountFor` - die Auswahl trifft der Spieler.
 */
export function legalActions(state: GameState, player: PlayerId): GameAction[] {
  const board = boardOf(state.scenario);
  const actions: GameAction[] = [];

  switch (state.phase.kind) {
    case 'finished':
      return [];

    case 'opening':
      // Im Auftakt gibt es genau eine Sache zu tun, und nur fuer einen.
      return openingRoller(state.phase) === player ? [{ type: 'rollDice', player }] : [];

    case 'setup': {
      if (setupPlayer(state) !== player) return [];

      if (state.phase.settlement === null) {
        for (const vertex of board.topology.vertices) {
          if (canPlaceSettlementAt(state, vertex) === null) {
            actions.push({ type: 'placeSetupSettlement', player, vertex });
          }
        }
        return actions;
      }

      const anchor = state.phase.settlement;
      for (const edge of board.topology.vertexEdges.get(anchor) ?? []) {
        if (canPlaceRoadAt(state, edge) === null) {
          actions.push({ type: 'placeSetupRoad', player, edge });
        }
      }
      return actions;
    }

    case 'rollPending': {
      if (state.players[state.currentPlayerIndex]?.id !== player) return [];

      /*
       * Vor dem Wurf steht nicht nur der Wurf. Eine Entwicklungskarte darf im
       * eigenen Zug auch davor gespielt werden - der Ritter ist der Fall, um
       * den es dabei geht: den Raeuber vom eigenen Feld holen, ehe die Ertraege
       * fallen. Gekauft wird weiterhin erst danach.
       *
       * Die drei Karten mit Auswahl stehen hier so wenig wie in `main`; sie
       * kommen ueber `playableDevelopmentCards`, und das erlaubt sie seit der
       * Trennung von Kauf und Ausspielen von selbst.
       */
      actions.push({ type: 'rollDice', player });
      if (canPlayDevelopmentCard(state, player, 'knight') === null) {
        actions.push({ type: 'playKnight', player });
      }
      return actions;
    }

    case 'discardPending':
      // Siehe Kopfkommentar: die Auswahl trifft der Spieler selbst.
      return [];

    case 'tradePending': {
      const trade = state.phase;

      if (player === trade.offer.from) {
        for (const other of state.players) {
          if (other.id === trade.offer.from) continue;
          if (canAcceptTrade(state, player, other.id) === null) {
            actions.push({ type: 'acceptTrade', player, partner: other.id });
          }
          /*
           * Ausschlagen steht neben Zuschlagen und nicht statt seiner: ein
           * Gegenangebot, das man sich leisten koennte, darf man trotzdem nicht
           * wollen. Beide Zuege koennen deshalb fuer denselben Partner in der
           * Liste stehen.
           */
          if (canRejectCounter(state, player, other.id) === null) {
            actions.push({ type: 'rejectCounter', player, partner: other.id });
          }
        }
        actions.push({ type: 'withdrawTrade', player });
        return actions;
      }

      for (const response of ['accepted', 'declined'] as const) {
        if (canRespondTrade(state, player, response) === null) {
          actions.push({ type: 'respondTrade', player, response });
        }
      }
      return actions;

      /*
       * Nicht aufgezaehlt: `counterTrade` - jede Mengenkombination waere ein
       * eigener Eintrag, dieselbe Begruendung wie bei `offerTrade`. Und
       * `timeout`, `dropFromTrade`, `rejoinTrade`, weil sie niemandes Absicht
       * sind, sondern vom Server kommen.
       */
    }

    case 'robberPending': {
      if (state.players[state.currentPlayerIndex]?.id !== player) return [];

      for (const hex of board.hexes.keys()) {
        const victims = victimsAt(state, hex, player);
        const choices: (PlayerId | null)[] = victims.length > 0 ? victims : [null];

        for (const victim of choices) {
          if (canMoveRobber(state, player, hex, victim) === null) {
            actions.push({ type: 'moveRobber', player, hex, victim });
          }
        }
      }
      return actions;
    }

    case 'displacePending': {
      // Nur der Besitzer setzt um, und nur auf freie Kreuzungen seines Netzes.
      if (state.phase.owner !== player) return [];

      for (const vertex of displacementTargets(state, player, state.phase.from)) {
        actions.push({ type: 'placeDisplacedKnight', player, vertex });
      }
      return actions;
    }

    case 'main': {
      if (state.players[state.currentPlayerIndex]?.id !== player) return [];

      for (const edge of board.topology.edges) {
        if (canBuildRoad(state, player, edge) === null) {
          actions.push({ type: 'buildRoad', player, edge });
        }
      }
      for (const vertex of board.topology.vertices) {
        if (canBuildSettlement(state, player, vertex) === null) {
          actions.push({ type: 'buildSettlement', player, vertex });
        }
        if (canBuildCity(state, player, vertex) === null) {
          actions.push({ type: 'buildCity', player, vertex });
        }
        if (canBuildWall(state, player, vertex) === null) {
          actions.push({ type: 'buildWall', player, vertex });
        }
        if (canBuildKnight(state, player, vertex) === null) {
          actions.push({ type: 'buildKnight', player, vertex });
        }
        if (canActivateKnight(state, player, vertex) === null) {
          actions.push({ type: 'activateKnight', player, vertex });
        }
        if (canUpgradeKnight(state, player, vertex) === null) {
          actions.push({ type: 'upgradeKnight', player, vertex });
        }
        if (canChaseRobber(state, player, vertex) === null) {
          actions.push({ type: 'chaseRobber', player, vertex });
        }
      }

      /*
       * Das Versetzen geht **je eigenem Ritter** ueber seine erreichbaren
       * Kreuzungen und nicht ueber alle Knoten des Bretts: sonst liefe
       * `canMoveKnight` je Aufruf rund tausendmal, und die Wegsuche darin
       * jedesmal von vorn.
       */
      for (const [from, knight] of Object.entries(state.knights)) {
        if (knight.owner !== player) continue;

        for (const to of reachableVertices(state, player, from)) {
          if (canMoveKnight(state, player, from, to) === null) {
            actions.push({ type: 'moveKnight', player, from, to });
          }
        }
      }
      /*
       * Ueber die Sorten dieses Tisches, nicht ueber alle, die es gibt: an
       * einem Basistisch gaebe es sonst vierundsechzig Bankgeschaefte statt
       * fuenfundzwanzig, und drei Viertel davon mit Karten, die dort nicht
       * vorkommen.
       */
      for (const give of state.rules.cards) {
        for (const receive of state.rules.cards) {
          if (canTradeWithBank(state, player, give, receive) === null) {
            actions.push({ type: 'tradeWithBank', player, give, receive });
          }
        }
      }

      if (canBuyDevelopmentCard(state, player) === null) {
        actions.push({ type: 'buyDevelopmentCard', player });
      }
      if (canPlayDevelopmentCard(state, player, 'knight') === null) {
        actions.push({ type: 'playKnight', player });
      }

      /*
       * Strassenbau, Erfindung und Monopol stehen hier bewusst NICHT als
       * fertige Zuege - wie bei `discard` waeren es dutzende Kombinationen
       * (jedes Kantenpaar, jedes Rohstoffpaar, jede Sorte). Die Auswahl trifft
       * der Spieler im Dialog; ob sie zulaessig war, prueft trotzdem der
       * Reducer. Damit die Oberflaeche die Karten ueberhaupt anbieten kann,
       * sagt `playableDevelopmentCards`, welche jetzt gingen.
       */

      for (const track of TRACK_IDS) {
        if (!claimsMetropolis(state, player, track)) {
          if (canImproveCity(state, player, track) === null) {
            actions.push({ type: 'improveCity', player, track });
          }
          continue;
        }
        /*
         * Bringt der Ausbau den Aufsatz, ist die Stadt Teil des Zuges - also ein
         * Zug je moeglicher Stadt. Sonst stuende in der Liste ein Zug, den `reduce`
         * ablehnt, und die zwei Auslegungen liefen auseinander.
         */
        for (const [vertex] of Object.entries(state.buildings)) {
          if (canImproveCity(state, player, track, vertex) === null) {
            actions.push({ type: 'improveCity', player, track, metropolisAt: vertex });
          }
        }
      }

      actions.push({ type: 'endTurn', player });
      return actions;
    }
  }
}

/**
 * Welche Entwicklungskarten dieser Spieler jetzt ausspielen koennte.
 *
 * Getrennt von `legalActions`, weil drei der fuenf Karten eine Auswahl
 * brauchen, die der Spieler trifft - genau wie beim Abwerfen. Die Liste sagt
 * der Oberflaeche, welchen Knopf sie ueberhaupt anbieten darf; die Regel
 * dahinter ist dieselbe `canPlayDevelopmentCard`, die auch der Reducer nimmt.
 */
export function playableDevelopmentCards(state: GameState, player: PlayerId): DevelopmentCardId[] {
  return DEVELOPMENT_CARD_IDS.filter(
    (card) => canPlayDevelopmentCard(state, player, card) === null,
  );
}

/**
 * Wo der Strassenbau seine zwei Strassen hinlegen koennte.
 *
 * Eine Karte je moeglicher **erster** Kante, und dazu die Kanten, die danach
 * noch gingen. Die zweite haengt von der ersten ab - sie darf an sie
 * anschliessen -, und genau deshalb steht hier eine Zuordnung und keine flache
 * Liste.
 *
 * Gerechnet wird das hier und nicht im Browser: die Anschlussregel ist eine
 * Regel, und der Client kennt keine. Er liest die Zuordnung ab und klickt.
 * Teuer ist es nicht - ein Spieler hat selten mehr als ein Dutzend
 * anschlussfaehige Kanten.
 */
export function roadBuildingTargets(state: GameState, player: PlayerId): Record<EdgeId, EdgeId[]> {
  if (canPlayDevelopmentCard(state, player, 'roadBuilding') !== null) return {};

  const board = boardOf(state.scenario);
  const targets: Record<EdgeId, EdgeId[]> = {};

  for (const first of board.topology.edges) {
    const placed = applyPlayRoadBuilding(state, player, [first]);
    if (!placed.ok) continue;

    // Die zweite Kante wird gegen den Zustand NACH der ersten geprueft - sonst
    // fehlte genau der Anschluss, den die erste gerade geschaffen hat.
    const after = placed.state;
    targets[first] = board.topology.edges.filter(
      (second) => second !== first && canPlaceFreeRoad(after, player, second),
    );
  }

  return targets;
}

/** Ob dort eine kostenlose Strasse liegen koennte - ohne sie zu legen. */
function canPlaceFreeRoad(state: GameState, player: PlayerId, edge: EdgeId): boolean {
  if (canPlaceRoadAt(state, edge) !== null) return false;

  const owner = state.players.find((entry) => entry.id === player);
  if (owner === undefined || (owner.piecesLeft.road ?? 0) <= 0) return false;

  const board = boardOf(state.scenario);
  return (board.topology.edgeVertices.get(edge) ?? []).some((vertex) => {
    if (state.buildings[vertex]?.owner === player) return true;
    return (board.topology.vertexEdges.get(vertex) ?? []).some(
      (other) => other !== edge && state.roads[other] === player,
    );
  });
}
