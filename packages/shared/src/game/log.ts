import type { Seat } from '../seats.js';
import { RESOURCE_LABELS, resourceList } from './labels.js';
import type { GameAction } from './actions.js';
import type { PlayerId } from './player.js';
import { countResources } from './resources.js';
import type { GameState } from './state.js';

/**
 * Ein Satz je Zug, abgeleitet aus dem Zustandsuebergang.
 *
 * Etappe 2 hat die Ereignisliste im `ReduceResult` bewusst nicht gebaut - sie
 * bekommt ihren Anlass erst in Etappe 5, wenn ein Diebstahl fuer die
 * Beteiligten eine andere Nachricht ist als fuer den Rest des Tisches. Bis
 * dahin genuegt der Vergleich von vorher und nachher, und er hat einen Vorzug:
 * er kann nicht von dem abweichen, was wirklich passiert ist.
 */
export function describeTransition(
  before: GameState,
  action: GameAction,
  after: GameState,
  seats: readonly Seat[],
): string {
  // Nachschlagetabelle hier statt aus dem Client: `seatsById` bleibt dort, weil
  // nur die Oberflaeche sie sonst noch braucht.
  const byId = new Map<PlayerId, Seat>(seats.map((seat) => [seat.id, seat]));
  const nameOf = (id: PlayerId): string => byId.get(id)?.name ?? id;
  const who = nameOf(action.player);

  switch (action.type) {
    case 'placeSetupSettlement':
      return `${who} setzt die Gruendungssiedlung`;
    case 'placeSetupRoad':
      return `${who} setzt die Gruendungsstrasse`;

    case 'rollDice': {
      const roll = after.lastRoll;
      if (roll === null) return `${who} wuerfelt`;
      const gains = describeGains(before, after, byId);
      return `${who} wuerfelt ${roll[0] + roll[1]}${gains === '' ? '' : ` - ${gains}`}`;
    }

    case 'discard':
      return `${who} wirft ab: ${resourceList(action.resources)}`;

    case 'moveRobber':
      return action.victim === null
        ? `${who} versetzt den Raeuber auf ${action.hex}`
        : `${who} versetzt den Raeuber auf ${action.hex} und bestiehlt ${nameOf(action.victim)}`;

    case 'buildRoad':
      return `${who} baut eine Strasse`;
    case 'buildSettlement':
      return `${who} baut eine Siedlung`;
    case 'buildCity':
      return `${who} baut eine Stadt`;

    case 'buyDevelopmentCard':
      // Was gezogen wurde, steht bewusst nicht da: der Verlauf ist oeffentlich,
      // die Karte ist es nicht.
      return `${who} kauft eine Entwicklungskarte`;
    case 'playKnight':
      return `${who} spielt einen Ritter`;
    case 'playRoadBuilding':
      return `${who} spielt Strassenbau und setzt ${action.edges.length === 1 ? 'eine Strasse' : 'zwei Strassen'}`;
    case 'playYearOfPlenty':
      return `${who} spielt Erfindung und nimmt ${action.picks.map((pick) => RESOURCE_LABELS[pick]).join(' und ')}`;
    case 'playMonopoly':
      return `${who} spielt Monopol auf ${RESOURCE_LABELS[action.resource]}`;

    case 'tradeWithBank':
      return `${who} tauscht ${RESOURCE_LABELS[action.give]} gegen ${RESOURCE_LABELS[action.receive]}`;

    case 'endTurn':
      return after.phase.kind === 'finished'
        ? `${nameOf(after.phase.winner)} gewinnt die Partie`
        : `${who} beendet den Zug`;
  }
}

/** Wer beim Wurf wie viele Karten bekommen hat - aus dem Unterschied gelesen. */
function describeGains(
  before: GameState,
  after: GameState,
  names: ReadonlyMap<PlayerId, Seat>,
): string {
  const parts: string[] = [];

  after.players.forEach((player, index) => {
    const previous = before.players[index];
    if (previous === undefined) return;

    const gained = countResources(player.resources) - countResources(previous.resources);
    if (gained > 0) {
      parts.push(`${names.get(player.id)?.name ?? player.id} +${gained}`);
    }
  });

  return parts.join(', ');
}
