import { RESOURCE_IDS } from '../scenario/index.js';
import type { GameAction } from './actions.js';
import { boardOf } from './board.js';
import {
  canBuildCity,
  canBuildRoad,
  canBuildSettlement,
  canPlaceRoadAt,
  canPlaceSettlementAt,
} from './build.js';
import type { PlayerId } from './player.js';
import { canMoveRobber, victimsAt } from './robber.js';
import { setupPlayer } from './setup.js';
import type { GameState } from './state.js';
import { canTradeWithBank } from './trade.js';

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

    case 'rollPending':
      return state.players[state.currentPlayerIndex]?.id === player
        ? [{ type: 'rollDice', player }]
        : [];

    case 'discardPending':
      // Siehe Kopfkommentar: die Auswahl trifft der Spieler selbst.
      return [];

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
      }
      for (const give of RESOURCE_IDS) {
        for (const receive of RESOURCE_IDS) {
          if (canTradeWithBank(state, player, give, receive) === null) {
            actions.push({ type: 'tradeWithBank', player, give, receive });
          }
        }
      }

      actions.push({ type: 'endTurn', player });
      return actions;
    }
  }
}
