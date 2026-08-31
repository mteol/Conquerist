import type { Seat } from '../seats.js';
import {
  CARD_LABELS,
  KNIGHT_LABELS_DATIVE,
  RESOURCE_LABELS,
  nameList,
  resourceList,
} from './labels.js';
import { barbarianStrength } from './cities/barbarians.js';
import { PROGRESS_NAMES } from './cities/progress/cards.js';
import { metropolisHolder } from './cities/improvements.js';
import { catanStrength } from './cities/knights.js';
import { TRACK_CARD_LABELS, stepInAccusative } from './cities/tracks.js';
import type { GameAction } from './actions.js';
import { yieldTotal } from './dice.js';
import type { PlayerId } from './player.js';
import { countCards } from './cards.js';
import { setupBuildingKind } from './setup.js';
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
      /*
       * Was gesetzt wird, haengt am Tisch: in Staedte & Ritter ist die zweite
       * Setzung eine **Stadt**. Der Satz sagte trotzdem "Gruendungssiedlung",
       * waehrend auf dem Brett eine Stadt stand - gefunden im Browser.
       * Gefragt wird `setupBuildingKind`, damit es genau eine Auslegung gibt.
       */
      return before.phase.kind === 'setup' &&
        setupBuildingKind(before, before.phase.placement) === 'city'
        ? `${who} setzt die Gründungsstadt`
        : `${who} setzt die Gründungssiedlung`;
    case 'placeSetupRoad':
      return `${who} setzt die Gründungsstraße`;

    case 'rollDice': {
      const roll = after.lastRoll;
      if (roll === null) return `${who} würfelt`;

      // Im Auftakt bringt ein Wurf keinen Ertrag, sondern eine Reihenfolge.
      if (before.phase.kind === 'opening') {
        const augen = yieldTotal(before.rules.dice, roll);

        if (after.phase.kind === 'setup') {
          const erster = after.players[0]?.id;
          const beginner = erster === undefined ? 'niemand' : nameOf(erster);
          return `Auftakt: ${who} würfelt ${augen} - ${beginner} beginnt`;
        }
        if (after.phase.kind === 'opening' && after.phase.round > before.phase.round) {
          return `Auftakt: ${who} würfelt ${augen} - Gleichstand, es wird gestochen`;
        }

        return `Auftakt: ${who} würfelt ${augen}`;
      }

      const attack = describeAttack(before, after, nameOf);
      const gains = describeGains(before, after, nameOf);
      const total = yieldTotal(after.rules.dice, roll);

      // Der Ueberfall steht vor den Ertraegen, weil er ihnen vorausgeht - eine
      // gefallene Stadt schuettet im selben Wurf nichts mehr aus.
      const tail = [attack, gains === '' ? null : gains].filter((part) => part !== null);
      return `${who} würfelt ${total}${tail.length === 0 ? '' : ` - ${tail.join(' - ')}`}`;
    }

    case 'discard':
      return `${who} wirft ab: ${resourceList(action.resources)}`;

    case 'moveRobber':
      return action.victim === null
        ? `${who} versetzt den Räuber auf ${action.hex}`
        : `${who} versetzt den Räuber auf ${action.hex} und bestiehlt ${nameOf(action.victim)}`;

    case 'buildRoad':
      return `${who} baut eine Straße`;
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
      return `${who} spielt Straßenbau und setzt ${action.edges.length === 1 ? 'eine Straße' : 'zwei Straßen'}`;
    case 'playYearOfPlenty':
      return `${who} spielt Erfindung und nimmt ${action.picks.map((pick) => RESOURCE_LABELS[pick]).join(' und ')}`;
    case 'playMonopoly':
      return `${who} spielt Monopol auf ${RESOURCE_LABELS[action.resource]}`;

    case 'tradeWithBank':
      return `${who} tauscht ${CARD_LABELS[action.give]} gegen ${CARD_LABELS[action.receive]}`;

    case 'offerTrade':
      return `${who} bietet ${resourceList(action.give)} für ${resourceList(action.want)}`;

    case 'counterTrade':
      return `${who} hält dagegen: ${resourceList(action.give)} für ${resourceList(action.want)}`;

    case 'respondTrade':
      return action.response === 'accepted'
        ? `${who} nimmt das Angebot an`
        : `${who} lehnt das Angebot ab`;

    case 'acceptTrade':
      return `${who} tauscht mit ${nameOf(action.partner)}`;
    case 'rejectCounter':
      return `${who} schlägt das Gegenangebot von ${nameOf(action.partner)} aus`;
    case 'withdrawTrade':
      return `${who} nimmt das Angebot zurück`;

    case 'timeout':
      return `Die Zeit für ${who}s Angebot ist abgelaufen`;

    case 'dropFromTrade':
      return `${who} ist nicht mehr da und antwortet nicht`;
    case 'rejoinTrade':
      return `${who} ist zurück und kann noch antworten`;

    case 'buildWall':
      return `${who} baut eine Stadtmauer`;
    case 'buildKnight':
      return `${who} baut einen Ritter`;
    case 'activateKnight':
      return `${who} setzt einem Ritter den Helm auf`;
    case 'upgradeKnight': {
      // Die neue Stufe steht **nachher** - vorher waere es die alte, und der
      // Satz soll sagen, was daraus geworden ist.
      const level = after.knights[action.vertex]?.level;
      return level === undefined
        ? `${who} wertet einen Ritter auf`
        : `${who} wertet einen Ritter zum ${KNIGHT_LABELS_DATIVE[level]} auf`;
    }
    case 'moveKnight': {
      /*
       * Ob versetzt oder vertrieben wurde, entscheidet der **Uebergang** und
       * nicht die Absicht: stand am Ziel vorher ein fremder Ritter, war es ein
       * Angriff. Dieselbe Haltung wie im Kopf dieser Datei.
       */
      const displaced = before.knights[action.to];
      return displaced === undefined || displaced.owner === action.player
        ? `${who} versetzt einen Ritter`
        : `${who} vertreibt ${nameOf(displaced.owner)}s Ritter`;
    }
    case 'chaseRobber':
      return `${who} schickt einen Ritter hinter dem Räuber her`;
    case 'placeDisplacedKnight':
      return `${who} weicht mit seinem Ritter aus`;

    case 'improveCity': {
      // Die neue Stufe steht **nachher** - dieselbe Begruendung wie bei
      // upgradeKnight oben.
      const level = after.players.find((entry) => entry.id === action.player)?.improvements[
        action.track
      ];
      const built =
        level === undefined
          ? `${who} baut eine Ausbaustufe`
          : `${who} baut ${stepInAccusative(action.track, level)}`;
      if (action.metropolisAt === undefined) return built;

      /*
       * Ob der Aufsatz neu kommt oder abgenommen wird, entscheidet der
       * **Uebergang** und nicht die Absicht des Zuges: hielt vorher schon ein
       * anderer Spieler den Aufsatz dieses Bereichs, war es eine Wegnahme -
       * dieselbe Haltung wie bei moveKnight oben.
       */
      const previousHolder = metropolisHolder(before, action.track);
      return previousHolder === null
        ? `${built} und setzt eine Metropole`
        : `${built} und nimmt ${nameOf(previousHolder)} die Metropole ab`;
    }

    case 'playProgress':
      // Welche Wahl die Karte getroffen hat (Feld, Ritter, Ware, ...) steht
      // bewusst nicht im Satz: die Wirkung selbst kommt erst in den Aufgaben 6
      // bis 12, und der Verlauf soll nicht mehr behaupten, als heute passiert.
      return `${who} spielt ${PROGRESS_NAMES[action.play.card]}`;

    case 'pickProgressDeck': {
      // Was gezogen wurde, steht **nachher** auf der Hand - und es bleibt
      // ungenannt: eine Fortschrittskarte liegt verdeckt, und der Verlauf
      // liest alle mit.
      return `${who} zieht eine ${TRACK_CARD_LABELS[action.track]}`;
    }
    case 'discardProgressCard':
      return `${who} gibt ${PROGRESS_NAMES[action.card]} ab`;
    case 'pickAqueduct':
      return `${who} nimmt ${RESOURCE_LABELS[action.resource]} aus dem Aquädukt`;

    case 'endTurn':
      return `${who} beendet den Zug`;
  }
}

/**
 * Was der Barbarenueberfall gebracht hat - `null`, wenn keiner stattfand.
 *
 * **Aus dem Uebergang gelesen und nicht aus einem Ereignis**: dieselbe
 * Begruendung, die im Kopf dieser Datei steht. Dass ein Ueberfall war, sagt der
 * gestiegene `attacks`-Zaehler; wie er ausging, sagen die Chips und die
 * verschwundenen Staedte.
 */
function describeAttack(
  before: GameState,
  after: GameState,
  nameOf: (id: PlayerId) => string,
): string | null {
  const then = before.barbarians;
  const now = after.barbarians;
  if (then === null || now === null || now.attacks === then.attacks) return null;

  const barbarians = barbarianStrength(before);
  const defenders = catanStrength(before);

  const saved = after.players.find((player, index) => {
    const previous = before.players[index];
    return previous !== undefined && player.defenderPoints > previous.defenderPoints;
  });

  const lost = after.players
    .filter((player, index) => {
      const previous = before.players[index];
      return previous !== undefined && cityCount(after, player.id) < cityCount(before, player.id);
    })
    .map((player) => nameOf(player.id));

  const score = `(${defenders} gegen ${barbarians})`;

  if (defenders >= barbarians) {
    const held = `die Barbaren landen, die Ritter halten ${score}`;
    return saved === undefined ? held : `${held} - ${nameOf(saved.id)} wird Retter Catans`;
  }

  const beaten = `die Barbaren siegen ${score}`;
  if (lost.length === 0) return beaten;

  // Das Verb folgt der Anzahl: einer verliert, mehrere verlieren.
  const verb = lost.length === 1 ? 'verliert' : 'verlieren';
  return `${beaten} - ${nameList(lost)} ${verb} eine Stadt`;
}

/** Wie viele Staedte dieser Spieler gerade haelt. */
function cityCount(state: GameState, player: PlayerId): number {
  return Object.values(state.buildings).filter(
    (building) => building.owner === player && building.kind === 'city',
  ).length;
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

    const gained = countCards(player.resources) - countCards(previous.resources);
    if (gained > 0) parts.push(`${nameOf(player.id)} +${gained}`);
  });

  return parts.join(', ');
}
