import type { PlayerId, PlayerState } from '../../player.js';
import type { GameState } from '../../state.js';
import { TRACK_IDS, levelOf, progressThreshold, type TrackId } from '../tracks.js';
import { PROGRESS_HAND_LIMIT, PROGRESS_VICTORY_CARDS, type ProgressCardId } from './cards.js';

/**
 * Wer am Stadttor zieht - Regel 8.1.
 *
 * `drawersFor` fragt nur, wer berechtigt ist; `drawProgressCards` zieht auch.
 * Getrennt, weil `playersOverProgressLimit` (Aufgabe 4) den Zustand *nach*
 * dem Ziehen braucht und `drawersFor` allein dafuer nicht reicht.
 */

/**
 * Die Spieler in Uhrzeigersinn ab dem Spieler am Zug - unabhaengig davon, ob
 * sie am gewuerfelten Bereich berechtigt sind. Die Reihenfolge ist eine
 * eigene Frage von der Eignung, deshalb ein eigener Schritt vor dem Filter.
 */
function inTurnOrder(state: GameState): PlayerState[] {
  const { players, currentPlayerIndex } = state;
  return players.map((_, offset) => players[(currentPlayerIndex + offset) % players.length]!);
}

/** Wer bei diesem Wurf zieht - im Uhrzeigersinn ab dem Spieler am Zug. */
export function drawersFor(state: GameState, track: TrackId, red: number): PlayerId[] {
  return inTurnOrder(state)
    .filter((player) => {
      /*
       * Regel 8.1 hat zwei Bedingungen, nicht eine: erst die Stufe (mindestens
       * 1 im gewuerfelten Bereich), dann die Schwelle. Wer den Bereich nicht
       * begonnen hat, zieht nie - auch nicht bei rotem Wuerfel 1, wo
       * `progressThreshold(0) === 1` sonst jeden durchliesse.
       */
      const level = levelOf(player, track);
      return level >= 1 && red <= progressThreshold(level);
    })
    .map((player) => player.id);
}

/**
 * Legt eine gezogene Karte an ihren Platz - verdeckt in `progressCards`, oder
 * fuer Buchdruck und Verfassung sofort offen in `openProgressCards`.
 *
 * **Der eine Ort, an dem diese Weiche steht.** Zwei Ziehpfade fuehren zu einer
 * Karte auf der Hand - der Zug am Stadttor (`drawProgressCards` hier) und die
 * Stapelwahl der Verteidiger (`applyPickProgressDeck` in `cities/rollFlow.ts`).
 * Beide rufen diese Funktion; eine zweite Auslegung derselben Regel liefe
 * frueher oder spaeter auseinander. Docs Abschnitt 11: "Siegpunktkarten ...
 * liegen sofort offen" - sofort heisst beim Ziehen, nicht erst beim Ausspielen.
 */
export function receiveProgressCard(player: PlayerState, card: ProgressCardId): PlayerState {
  return PROGRESS_VICTORY_CARDS.includes(card)
    ? { ...player, openProgressCards: [...player.openProgressCards, card] }
    : { ...player, progressCards: [...player.progressCards, card] };
}

/** Zieht fuer alle Berechtigten. Ein leerer Stapel gibt still nichts - er waechst nie nach. */
export function drawProgressCards(state: GameState, track: TrackId, red: number): GameState {
  const deck = [...(state.progressDecks[track] ?? [])];
  const drawn = new Map<PlayerId, ProgressCardId>();

  for (const id of drawersFor(state, track, red)) {
    const card = deck.shift();
    if (card === undefined) break;
    drawn.set(id, card);
  }

  // Nichts gezogen: derselbe Zustand zurueck und nicht eine Kopie - so sieht
  // der Aufrufer an der Identitaet, dass nichts geschehen ist. Genau die
  // Haltung, die `resolveEvent` schon fuer den leeren Ereigniswuerfel hat.
  if (drawn.size === 0) return state;

  return {
    ...state,
    progressDecks: { ...state.progressDecks, [track]: deck },
    players: state.players.map((player) => {
      const card = drawn.get(player.id);
      return card === undefined ? player : receiveProgressCard(player, card);
    }),
  };
}

/**
 * Ob ueberhaupt noch irgendein Fortschrittsstapel eine Karte hergibt.
 *
 * Gefragt wird das vor jeder Wahl zwischen den Stapeln: eine Phase, die auf
 * eine Wahl ohne Moeglichkeiten wartet, haelt den Tisch fuer nichts an -
 * dieselbe Haltung wie bei `displacePending`. Die Stapel wachsen nie nach,
 * also ist das kein theoretischer Fall.
 */
export function anyProgressCardsLeft(state: GameState): boolean {
  return TRACK_IDS.some((track) => (state.progressDecks[track] ?? []).length > 0);
}

/**
 * Wie viele zaehlende Karten einer auf der Hand haelt - Siegpunktkarten
 * zaehlen nicht.
 *
 * Seit `receiveProgressCard` gehen Buchdruck und Verfassung nie mehr in
 * `progressCards` - der Filter hier trifft ueber die beiden Ziehpfade also nie
 * mehr etwas. Trotzdem stehen gelassen, nicht vereinfacht zu `.length`: er ist
 * die Zusicherung selbst ("Siegpunktkarten zaehlen nicht zum Limit"), nicht
 * bloss ihre Folge, und ein gespeicherter Zustand von vor dieser Aenderung
 * kann die beiden Karten noch verdeckt in der Hand tragen.
 */
export function countedHand(player: PlayerState): number {
  return player.progressCards.filter((card) => !PROGRESS_VICTORY_CARDS.includes(card)).length;
}

/**
 * Wer mehr als vier zaehlende Karten haelt und **nicht** am Zug ist.
 *
 * Abgeleitet und nicht mitgeschleppt: die Stapelwahl der Verteidiger verteilt
 * selbst Karten, und eine vor ihr gebildete Liste waere danach falsch. Wer am
 * Zug ist, steht nie drin - er spielt sofort aus, und das kann er in `main`.
 */
export function playersOverProgressLimit(state: GameState): PlayerId[] {
  const current = state.players[state.currentPlayerIndex]?.id;
  return state.players
    .filter((player) => player.id !== current && countedHand(player) > PROGRESS_HAND_LIMIT)
    .map((player) => player.id);
}
