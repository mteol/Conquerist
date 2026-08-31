import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import {
  findPlayer,
  rejected,
  withPlayer,
  type GameState,
  type ReduceResult,
} from '../../state.js';
import { PROGRESS_NAMES, type ProgressCardId } from './cards.js';
import {
  applyCommodityMonopoly,
  applyMerchant,
  applyMerchantFleet,
  applyResourceMonopoly,
} from './commerce.js';
import type { ProgressPlay } from './play.js';
import {
  applyBishop,
  applyConstitution,
  applyDiplomat,
  applyIntrigue,
  applySaboteur,
  applyWarlord,
} from './politics.js';
import {
  applyAlchemist,
  applyCrane,
  applyEngineer,
  applyInventor,
  applyIrrigation,
  applyMedicine,
  applyMining,
  applyPrinter,
  applyProgressRoadBuilding,
  applySmith,
} from './science.js';

/**
 * Die Aktion `playProgress` und ihr Verteiler.
 *
 * Fuenfundzwanzig Karten, aber **eine** Aktion (siehe `play.ts`). Diese Datei
 * prueft das Gemeinsame - liegt die Karte auf der Hand, gibt es sie an diesem
 * Tisch, passt die Phase - und gibt danach an die Datei des Stapels ab
 * (`science.ts`, `commerce.ts`, `politics.ts`). Die Wirkungen selbst stehen
 * dort und kommen erst in den Aufgaben 6 bis 12; bis dahin wirft jeder Zweig
 * nur die Karte ab.
 *
 * **Anders als bei den Entwicklungskarten gibt es keine Grenze "eine je
 * Zug".** Die Regel erlaubt beliebig viele Fortschrittskarten in einem Zug,
 * und `developmentPlayed` wird hier bewusst nicht gelesen.
 */

/** Die zwei Bedingungen, die fuer jede Karte gleich sind: am Zug, am Tisch. */
function canActAtAll(state: GameState, player: PlayerId): RuleViolation | null {
  if (state.players[state.currentPlayerIndex]?.id !== player) {
    return violation(RuleViolationCode.NOT_YOUR_TURN, `${player} ist nicht am Zug`);
  }
  if (findPlayer(state, player) === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }
  return null;
}

/**
 * Wann eine Karte gespielt werden darf.
 *
 * Alchemie ist die einzige Ausnahme im Stapel: sie bestimmt die Wuerfel und
 * muss deshalb **vor** dem Wurf gespielt werden, also in `rollPending` - und
 * **nur** dort. Jede andere Karte geht erst danach, in `main`. Ohne diese
 * Grenze stuende sieben Aufgaben lang ein Tor offen, durch das jede Karte vor
 * dem Wurf spielbar waere.
 */
function canPlayNow(
  state: GameState,
  player: PlayerId,
  card: ProgressCardId,
): RuleViolation | null {
  const isAlchemist = card === 'alchemist';

  if (isAlchemist && state.phase.kind !== 'rollPending') {
    return violation(RuleViolationCode.WRONG_PHASE, 'Alchemie wird nur vor dem Würfeln gespielt');
  }
  if (!isAlchemist && state.phase.kind !== 'main') {
    return violation(RuleViolationCode.WRONG_PHASE, 'Das geht erst nach dem Würfeln');
  }

  return canActAtAll(state, player);
}

/** Ob diese Fortschrittskarte jetzt gespielt werden darf. */
export function canPlayProgress(
  state: GameState,
  player: PlayerId,
  play: ProgressPlay,
): RuleViolation | null {
  const timing = canPlayNow(state, player, play.card);
  if (timing !== null) return timing;

  if (state.rules.progressDecks[play.card] === undefined) {
    return violation(
      RuleViolationCode.PROGRESS_CARD_NOT_IN_PLAY,
      `${PROGRESS_NAMES[play.card]} gibt es an diesem Tisch nicht`,
    );
  }

  const hand = findPlayer(state, player)!;
  if (!hand.progressCards.includes(play.card)) {
    return violation(
      RuleViolationCode.NO_SUCH_PROGRESS_CARD,
      `${player} hat ${PROGRESS_NAMES[play.card]} nicht auf der Hand`,
    );
  }

  return null;
}

/**
 * Nimmt genau ein Exemplar dieser Karte von der Hand.
 *
 * Nur **ein** Exemplar: mehrere gleiche Karten gibt es an einem Tisch zwar
 * nicht, aber ein Filter ueber die Id raeumte trotzdem jedes gleiche Duplikat
 * weg - dieselbe Vorsicht wie bei `applyDiscardProgressCard` in
 * `rollFlow.ts`.
 */
function takeFromHand(state: GameState, player: PlayerId, card: ProgressCardId): GameState {
  return {
    ...state,
    players: withPlayer(state, player, (entry) => {
      const index = entry.progressCards.indexOf(card);
      const cards = [...entry.progressCards];
      if (index >= 0) cards.splice(index, 1);
      return { ...entry, progressCards: cards };
    }),
  };
}

/**
 * Spielt die Karte: erst von der Hand, dann ihre Wirkung.
 *
 * Der Verteiler selbst kennt keine einzige Wirkung - er gibt nur ab, wohin
 * die Karte gehoert. `tsc` prueft die Union hier erschoepfend: fehlt ein
 * Zweig, fehlt der Funktion ein Rueckgabewert auf diesem Pfad, und der Bau
 * schlaegt fehl.
 */
export function applyPlayProgress(
  state: GameState,
  player: PlayerId,
  play: ProgressPlay,
): ReduceResult {
  const problem = canPlayProgress(state, player, play);
  if (problem !== null) return rejected(problem);

  const discarded = takeFromHand(state, player, play.card);

  switch (play.card) {
    case 'alchemist':
      return applyAlchemist(discarded, player, play);
    case 'crane':
      return applyCrane(discarded, player, play);
    case 'mining':
      return applyMining(discarded, player, play);
    case 'irrigation':
      return applyIrrigation(discarded, player, play);
    case 'printer':
      return applyPrinter(discarded, player, play);
    case 'inventor':
      return applyInventor(discarded, player, play);
    case 'engineer':
      return applyEngineer(discarded, player, play);
    case 'medicine':
      return applyMedicine(discarded, player, play);
    case 'smith':
      return applySmith(discarded, player, play);
    case 'roadBuilding':
      return applyProgressRoadBuilding(discarded, player, play);
    case 'merchant':
      return applyMerchant(discarded, player, play);
    case 'resourceMonopoly':
      return applyResourceMonopoly(discarded, player, play);
    case 'commodityMonopoly':
      return applyCommodityMonopoly(discarded, player, play);
    case 'merchantFleet':
      return applyMerchantFleet(discarded, player, play);
    case 'bishop':
      return applyBishop(discarded, player, play);
    case 'diplomat':
      return applyDiplomat(discarded, player, play);
    case 'warlord':
      return applyWarlord(discarded, player, play);
    case 'intrigue':
      return applyIntrigue(discarded, player, play);
    case 'saboteur':
      return applySaboteur(discarded, player, play);
    case 'constitution':
      return applyConstitution(discarded, player, play);
  }
}
