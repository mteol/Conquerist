import {
  countCards,
  yieldTotal,
  type GameAction,
  type GameState,
  type PlayerView,
} from '@conquerist/shared';
import type { Move, Situation } from './cues';

/**
 * Die Lage aus einer Hotseat-Partie.
 *
 * `foreign` und `becameMyTurn` sind immer `false`: am selben Geraet gibt es
 * niemanden, der „ich" waere, und ein „du bist dran" an einen Bildschirm, den
 * ohnehin gerade jemand anschaut, ist Laerm. Der Ertrag zaehlt aus demselben
 * Grund ueber **alle** Spieler - was auf den Tisch kommt, kommt zu dir.
 */
export function situationFromGame(
  before: GameState,
  after: GameState,
  action: GameAction,
): Situation {
  const total = (state: GameState): number =>
    state.players.reduce((sum, player) => sum + countCards(player.resources), 0);

  const difference = total(after) - total(before);

  return {
    foreign: false,
    gained: Math.max(0, difference),
    // Nur beim Raeuber: ein Abwurf laesst den Tisch ebenfalls schrumpfen, hat
    // aber schon seinen eigenen Klang, und zwei Rutschgeraeusche uebereinander
    // sind eins zu viel.
    lost: action.type === 'moveRobber' ? Math.max(0, -difference) : 0,
    becameMyTurn: false,
    mustDiscard: after.phase.kind === 'discardPending' && before.phase.kind !== 'discardPending',
    offerToMe: false,
    finished: before.phase.kind !== 'finished' && after.phase.kind === 'finished',
    diceTotal: after.lastRoll === null ? null : yieldTotal(after.rules.dice, after.lastRoll),
  };
}

/**
 * Die Lage aus zwei aufeinanderfolgenden Sichten.
 *
 * Wer „ich" ist, steht in der Sicht selbst (`view.you`) - es muss keine Id von
 * aussen mitgereicht werden. Gewinn und Verlust kommen aus der eigenen
 * Handkartenzahl: das ist das Einzige, was in der eigenen Sicht verlaesslich
 * steht, und genau darum geht es beim Ton.
 *
 * `before` ist `null` beim ersten Stand nach dem Beitritt. Dann gibt es keinen
 * Unterschied, nur einen Anfang - und der klingt nicht.
 */
export function situationFromView(
  before: PlayerView | null,
  after: PlayerView,
  move: Move,
): Situation {
  const me = after.you;
  const cardsIn = (view: PlayerView): number =>
    view.players.find((player) => player.id === me)?.cardCount ?? 0;
  const currentIn = (view: PlayerView): string | undefined =>
    view.players[view.currentPlayerIndex]?.id;

  const difference = before === null ? 0 : cardsIn(after) - cardsIn(before);

  const discardsNow = after.phase.kind === 'discardPending' && after.phase.pending.includes(me);
  const discardedBefore =
    before !== null && before.phase.kind === 'discardPending' && before.phase.pending.includes(me);

  return {
    foreign: move.actor !== me,
    gained: Math.max(0, difference),
    lost: Math.max(0, -difference),
    becameMyTurn: before !== null && currentIn(before) !== me && currentIn(after) === me,
    mustDiscard: discardsNow && !discardedBefore,
    // Ein Angebot oder Gegenangebot von jemand anderem wartet auf mich.
    offerToMe: after.phase.kind === 'tradePending' && move.actor !== me,
    finished: after.phase.kind === 'finished' && before?.phase.kind !== 'finished',
    diceTotal: after.lastRoll === null ? null : yieldTotal(after.rules.dice, after.lastRoll),
  };
}
