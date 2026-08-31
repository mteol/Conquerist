import type { PlayerId, PlayerState } from '../../player.js';
import type { GameState } from '../../state.js';
import { levelOf, progressThreshold, type TrackId } from '../tracks.js';
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
    .filter((player) => red <= progressThreshold(levelOf(player, track)))
    .map((player) => player.id);
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
      if (card === undefined) return player;
      return { ...player, progressCards: [...player.progressCards, card] };
    }),
  };
}

/** Wie viele zaehlende Karten einer auf der Hand hat - Siegpunktkarten zaehlen nicht. */
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
