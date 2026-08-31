import type { ResourceId } from '../../scenario/index.js';
import { EMPTY_CARDS, addCards, subtractCards } from '../cards.js';
import { yieldTotal } from '../dice.js';
import { RuleViolationCode, violation, type RuleViolation } from '../errors.js';
import type { PlayerId } from '../player.js';
import { continueAfterSeven } from '../robber.js';
import { ok, rejected, type GameState, type ReduceResult } from '../state.js';
import { aqueductClaimants, bankHasResource, distributeYield } from '../yield.js';
import { PROGRESS_NAMES, PROGRESS_VICTORY_CARDS, type ProgressCardId } from './progress/cards.js';
import {
  anyProgressCardsLeft,
  playersOverProgressLimit,
  receiveProgressCard,
} from './progress/draw.js';
import type { TrackId } from './tracks.js';

/**
 * Die Kette der Wartephasen in einem Wurf.
 *
 * Seit die Stadttore Karten auf Haende bringen, kann **ein** Wurf mehrfach
 * hintereinander auf fremde Eingaben warten:
 *
 * ```
 * resolveEvent  ──┬─ Schiff   → Barbaren → bei Gleichstand: defenderPending
 *                 └─ Stadttor → wer ziehen darf, zieht
 *                 ↓
 *         wer nicht am Zug ist und mehr als vier zaehlende Karten haelt:
 *                 progressDiscardPending
 *                 ↓
 *         distributeYield
 *                 ↓
 *         wer das Aquaedukt hat und leer ausging: aqueductPending
 *                 ↓
 *         main
 * ```
 *
 * **Der Merker liegt nicht im Zustand, sondern in der Reihenfolge dieser
 * Funktionen.** Jede Wartephase hat genau einen Nachfolger, und ihre
 * Abschlussfunktion ruft ihn. Ein `rollStage`-Feld waere allgemeiner, aber ein
 * neues Pflichtfeld im gespeicherten Zustand ist die teuerste wiederkehrende
 * Falle dieses Repos - und es waere eine zweite Wahrheit neben der Phase.
 * Wiedergefunden wird der Wurf ueber `state.lastRoll`, das ohnehin schon da
 * ist.
 *
 * **Wer noch offen ist, wird jedes Mal neu aus dem Zustand abgeleitet.** Die
 * Stapelwahl der Verteidiger verteilt selbst Karten und kann dadurch erst
 * jemanden ueber das Handlimit heben; eine vor dieser Phase gebildete Liste
 * waere danach falsch.
 *
 * **Die Ertraege fallen genau einmal.** Oeffnet sich `progressDiscardPending`,
 * sind sie noch nicht verteilt - sie kommen erst, wenn die Phase schliesst.
 */

/**
 * Die Augensumme des letzten Wurfs.
 *
 * Er steht im Zustand und ueberlebt damit jede Wartephase - genau deshalb
 * braucht die Kette kein eigenes Feld. Ohne Wurf gibt es nichts zu verteilen;
 * die Null trifft kein Feld auf dem Brett.
 */
function totalOfLastRoll(state: GameState): number {
  return state.lastRoll === null ? 0 : yieldTotal(state.rules.dice, state.lastRoll);
}

/**
 * Die Ertraege und danach das Aquaedukt.
 *
 * Die zweite Haelfte der Kette, und sie steht als eigene Funktion da, weil
 * zwei Wege hierher fuehren: der Wurf ohne Abgabe und das Ende der Abgabe.
 * Zweimal geschrieben liefe sie beim ersten Umbau auseinander - und dann
 * fielen die Ertraege auf einem der beiden Wege zweimal oder gar nicht.
 */
function distributeAndClaim(state: GameState, total: number): GameState {
  const distributed = distributeYield(state, total);

  /*
   * Verglichen wird gegen `state`, den Stand **vor** der Verteilung: "leer
   * ausgegangen" ist eine Aussage ueber diesen Wurf und nicht ueber die Hand.
   */
  const claimants = aqueductClaimants(distributed, state);

  return {
    ...distributed,
    phase:
      claimants.length > 0 ? { kind: 'aqueductPending', pending: claimants } : { kind: 'main' },
  };
}

/**
 * Die naechste Station nach dem Ereignis: erst wer abgeben muss, dann die
 * Ertraege, dann das Aquaedukt, dann `main`.
 *
 * Eine Funktion und keine Kette von Feldern: die Reihenfolge steht damit genau
 * einmal im Code, und jede Wartephase findet ihren Nachfolger, indem sie sie
 * erneut ruft.
 */
export function continueAfterEvent(state: GameState, total: number): GameState {
  const pending = playersOverProgressLimit(state);

  /*
   * Hier endet der Wurf vorlaeufig, und die Ertraege sind noch **nicht**
   * verteilt. Wer sie hier verteilte und nach der Abgabe noch einmal,
   * verdoppelte jeden Ertrag dieses Wurfs.
   */
  if (pending.length > 0) {
    return { ...state, phase: { kind: 'progressDiscardPending', pending } };
  }

  return distributeAndClaim(state, total);
}

/** Nach dem Abgeben der fuenften Karte: weiter mit den Ertraegen. */
export function continueAfterProgressDiscard(state: GameState): GameState {
  return distributeAndClaim(state, totalOfLastRoll(state));
}

/**
 * Nach der Stapelwahl der Verteidiger: zurueck in dieselbe Kette.
 *
 * Der Ueberfall kann auch in einem Wurf mit einer Sieben stattfinden, und dort
 * geht es nicht weiter mit Ertraegen, sondern mit dem Abwerfen und dem
 * Raeuber. Welcher Weg gilt, steht in `state.lastRoll` und im Regelwerk -
 * abgeleitet und nicht in der Phase mitgefuehrt.
 */
export function continueAfterDefender(state: GameState): GameState {
  const total = totalOfLastRoll(state);

  return total === state.rules.robberRoll
    ? continueAfterSeven(state)
    : continueAfterEvent(state, total);
}

/** Nach der Rohstoffwahl am Aquaedukt: `main`. */
export function continueAfterAqueduct(state: GameState): GameState {
  return { ...state, phase: { kind: 'main' } };
}

/**
 * Ob dieser Spieler jetzt einen Fortschrittsstapel waehlen darf.
 *
 * Es handelt der **erste** Eintrag in `pending` und nicht jeder Beteiligte
 * gleichzeitig: die Stapel sind endlich, und die oberste Karte gibt es nur
 * einmal.
 */
export function canPickProgressDeck(
  state: GameState,
  player: PlayerId,
  track: TrackId,
): RuleViolation | null {
  if (state.phase.kind !== 'defenderPending' || state.phase.pending[0] !== player) {
    return violation(
      RuleViolationCode.NOT_PICKING_DECK,
      `${player} wählt gerade keinen Fortschrittsstapel`,
    );
  }

  if ((state.progressDecks[track] ?? []).length === 0) {
    return violation(
      RuleViolationCode.PROGRESS_DECK_EMPTY,
      'Dieser Fortschrittsstapel ist leer - er wächst nicht nach',
    );
  }

  return null;
}

/** Zieht die oberste Karte des gewaehlten Stapels und laesst den Naechsten waehlen. */
export function applyPickProgressDeck(
  state: GameState,
  player: PlayerId,
  track: TrackId,
): ReduceResult {
  const problem = canPickProgressDeck(state, player, track);
  if (problem !== null) return rejected(problem);

  const deck = [...(state.progressDecks[track] ?? [])];
  // `canPickProgressDeck` hat den leeren Stapel schon abgewiesen.
  const card = deck.shift()!;

  const drawn: GameState = {
    ...state,
    progressDecks: { ...state.progressDecks, [track]: deck },
    // `receiveProgressCard` und nicht ein eigenes Anhaengen: Buchdruck und
    // Verfassung muessen sofort offen liegen, unabhaengig vom Ziehpfad.
    players: state.players.map((entry) =>
      entry.id === player ? receiveProgressCard(entry, card) : entry,
    ),
  };

  /*
   * Wer nach dieser Wahl noch wartet - aber nur, solange ueberhaupt noch ein
   * Stapel etwas hergibt. Nahm der Erste die letzte Karte, haette der Zweite
   * keine Wahl mehr, und die Phase hielte den Tisch fuer nichts an.
   */
  const pending =
    state.phase.kind === 'defenderPending' && anyProgressCardsLeft(drawn)
      ? state.phase.pending.filter((id) => id !== player)
      : [];

  if (pending.length > 0) return ok({ ...drawn, phase: { kind: 'defenderPending', pending } });

  return ok(continueAfterDefender(drawn));
}

/** Ob dieser Spieler jetzt genau diese Fortschrittskarte abgeben darf. */
export function canDiscardProgressCard(
  state: GameState,
  player: PlayerId,
  card: ProgressCardId,
): RuleViolation | null {
  if (state.phase.kind !== 'progressDiscardPending' || state.phase.pending[0] !== player) {
    return violation(
      RuleViolationCode.NOT_DISCARDING_PROGRESS,
      `${player} muss gerade keine Fortschrittskarte abgeben`,
    );
  }

  const owner = state.players.find((entry) => entry.id === player);
  if (owner === undefined || !owner.progressCards.includes(card)) {
    return violation(
      RuleViolationCode.NO_SUCH_PROGRESS_CARD,
      `${player} hat ${PROGRESS_NAMES[card]} gar nicht auf der Hand`,
    );
  }

  /*
   * Siegpunktkarten liegen offen und zaehlen nicht zum Limit - sie abzugeben
   * braechte den Spieler dem Limit keinen Schritt naeher und kostete ihn einen
   * Punkt. Ein Zug, der nur schaden kann, ist kein Zug.
   */
  if (PROGRESS_VICTORY_CARDS.includes(card)) {
    return violation(
      RuleViolationCode.PROGRESS_CARD_IS_VICTORY,
      `${PROGRESS_NAMES[card]} zählt nicht zum Handlimit und wird nicht abgegeben`,
    );
  }

  return null;
}

/**
 * Gibt die Karte ab und schaltet weiter, sobald niemand mehr zu viele haelt.
 *
 * Die Karte ist aus dem Spiel und kommt nicht unter ihren Stapel zurueck -
 * dieselbe Zusage, die `drawProgressCards` gibt: ein Stapel waechst nie nach.
 *
 * Wer noch abgeben muss, wird **neu abgeleitet** und nicht aus der alten Liste
 * gestrichen: wer zwei Karten zu viel hielt, steht danach einfach wieder
 * darin.
 */
export function applyDiscardProgressCard(
  state: GameState,
  player: PlayerId,
  card: ProgressCardId,
): ReduceResult {
  const problem = canDiscardProgressCard(state, player, card);
  if (problem !== null) return rejected(problem);

  const discarded: GameState = {
    ...state,
    players: state.players.map((entry) => {
      if (entry.id !== player) return entry;

      // Nur **ein** Exemplar: mehrere gleiche Karten gibt es an einem Tisch
      // zwar nicht, aber ein Filter ueber die Id sagte etwas anderes.
      const index = entry.progressCards.indexOf(card);
      const cards = [...entry.progressCards];
      cards.splice(index, 1);

      return { ...entry, progressCards: cards };
    }),
  };

  const pending = playersOverProgressLimit(discarded);
  if (pending.length > 0) {
    return ok({ ...discarded, phase: { kind: 'progressDiscardPending', pending } });
  }

  return ok(continueAfterProgressDiscard(discarded));
}

/** Ob dieser Spieler jetzt diesen Rohstoff aus dem Aquaedukt nehmen darf. */
export function canPickAqueduct(
  state: GameState,
  player: PlayerId,
  resource: ResourceId,
): RuleViolation | null {
  if (state.phase.kind !== 'aqueductPending' || state.phase.pending[0] !== player) {
    return violation(
      RuleViolationCode.NOT_CLAIMING_AQUEDUCT,
      `${player} nimmt gerade keinen Rohstoff aus dem Aquädukt`,
    );
  }

  if (state.bank[resource] <= 0) {
    return violation(RuleViolationCode.BANK_EMPTY, 'Die Bank hat diesen Rohstoff nicht mehr');
  }

  return null;
}

/**
 * Gibt den gewaehlten Rohstoff und laesst den naechsten Anspruchsberechtigten
 * waehlen.
 *
 * Nacheinander und nicht gleichzeitig: bei der letzten Karte einer Sorte kann
 * die Bank nur einen von zweien bedienen, und wer zuerst waehlt, sieht in
 * `canPickAqueduct`, was noch da ist.
 */
export function applyPickAqueduct(
  state: GameState,
  player: PlayerId,
  resource: ResourceId,
): ReduceResult {
  const problem = canPickAqueduct(state, player, resource);
  if (problem !== null) return rejected(problem);

  const one = { ...EMPTY_CARDS, [resource]: 1 };

  const granted: GameState = {
    ...state,
    bank: subtractCards(state.bank, one),
    players: state.players.map((entry) =>
      entry.id === player ? { ...entry, resources: addCards(entry.resources, one) } : entry,
    ),
  };

  /*
   * Wer nach diesem Griff noch wartet - aber nur, solange die Bank ueberhaupt
   * noch etwas hergibt. Nahm der Erste die letzte Karte, haette der Zweite
   * keine Wahl mehr, und die Phase hielte den Tisch fuer nichts an.
   */
  const pending =
    state.phase.kind === 'aqueductPending' && bankHasResource(granted)
      ? state.phase.pending.filter((id) => id !== player)
      : [];

  if (pending.length > 0) return ok({ ...granted, phase: { kind: 'aqueductPending', pending } });

  return ok(continueAfterAqueduct(granted));
}
