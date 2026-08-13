import type { Seat } from '../seats.js';
import { RESOURCE_LABELS, resourceList } from './labels.js';
import type { GameAction } from './actions.js';
import { yieldTotal } from './dice.js';
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
 *
 * Der Sieg haengt hinten an und steht nicht in einem Zweig.
 *
 * Das war ein Fehler und ist die Lehre daraus: er stand einmal beim Zugende,
 * und dort kann er gar nicht auftreten - `reduce` prueft den Sieg nur fuer den
 * Spieler am Zug, und beim Zugende ist der schon der naechste. Gewonnen wird
 * immer *mit* einem Zug, mit einer Stadt, einer Karte, einem Ritter, und der
 * Verlauf meldete davon nur den Zug. Ein Uebergang von "laeuft" auf "vorbei"
 * ist aber unabhaengig von der Zugart lesbar - und genau so steht er jetzt da.
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

  const sentence = describeAction(action, before, after, nameOf);

  return before.phase.kind !== 'finished' && after.phase.kind === 'finished'
    ? `${sentence} - und gewinnt die Partie`
    : sentence;
}

/** Der Satz zum Zug selbst, ohne den Ausgang der Partie. */
function describeAction(
  action: GameAction,
  before: GameState,
  after: GameState,
  nameOf: (id: PlayerId) => string,
): string {
  const who = nameOf(action.player);

  switch (action.type) {
    case 'placeSetupSettlement':
      return `${who} setzt die Gruendungssiedlung`;
    case 'placeSetupRoad':
      return `${who} setzt die Gruendungsstrasse`;

    case 'rollDice': {
      const roll = after.lastRoll;
      if (roll === null) return `${who} wuerfelt`;
      const gains = describeGains(before, after, nameOf);
      const total = yieldTotal(after.rules.dice, roll);
      return `${who} wuerfelt ${total}${gains === '' ? '' : ` - ${gains}`}`;
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

    case 'offerTrade':
      return `${who} bietet ${resourceList(action.give)} fuer ${resourceList(action.want)}`;

    case 'counterTrade':
      return `${who} haelt dagegen: ${resourceList(action.give)} fuer ${resourceList(action.want)}`;

    case 'respondTrade':
      return action.response === 'accepted'
        ? `${who} nimmt das Angebot an`
        : `${who} lehnt das Angebot ab`;

    case 'acceptTrade':
      return `${who} tauscht mit ${nameOf(action.partner)}`;
    case 'withdrawTrade':
      return `${who} nimmt das Angebot zurueck`;

    case 'timeout':
      return `Die Zeit fuer ${who}s Angebot ist abgelaufen`;

    case 'dropFromTrade':
      return `${who} ist nicht mehr da und antwortet nicht`;
    case 'rejoinTrade':
      return `${who} ist zurueck und kann noch antworten`;

    case 'endTurn':
      return `${who} beendet den Zug`;
  }
}

/** Wer beim Wurf wie viele Karten bekommen hat - aus dem Unterschied gelesen. */
function describeGains(
  before: GameState,
  after: GameState,
  nameOf: (id: PlayerId) => string,
): string {
  const parts: string[] = [];

  after.players.forEach((player, index) => {
    const previous = before.players[index];
    if (previous === undefined) return;

    const gained = countResources(player.resources) - countResources(previous.resources);
    if (gained > 0) parts.push(`${nameOf(player.id)} +${gained}`);
  });

  return parts.join(', ');
}
