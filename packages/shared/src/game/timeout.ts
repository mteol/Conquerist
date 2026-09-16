import { CARD_IDS } from '../scenario/index.js';
import { boardOf } from './board.js';
import { takeMostHeld } from './cards.js';
import { deadlineOf } from './deadline.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { Phase } from './phase.js';
import type { PlayerId } from './player.js';
import {
  applyDiscard,
  applyMoveRobber,
  canPlaceRobberAt,
  discardCountFor,
  victimsAt,
} from './robber.js';
import {
  findPlayer,
  ok,
  rejected,
  type GameState,
  type KnightLevel,
  type ReduceResult,
} from './state.js';
import {
  applyPlaceDisplacedKnight,
  displacementTargets,
  returnKnightToSupply,
} from './cities/knightActions.js';
import {
  applyDiscardProgressCard,
  continueAfterAqueduct,
  continueAfterDefender,
} from './cities/rollFlow.js';
import { autoAnswerProgress } from './cities/progress/answerRules.js';
import { PROGRESS_CARD_IDS, PROGRESS_VICTORY_CARDS } from './cities/progress/cards.js';
import { anyProgressCardsLeft } from './cities/progress/draw.js';
import { bankHasResource } from './yield.js';

/**
 * Der Fristablauf - ein Verteiler ueber die Phasen (Spec 5.5).
 *
 * Bis 10d-2 stand `applyTimeout` in `playerTrade.ts` und endete fest mit
 * `main`. Seit jede Wartephase eine Frist hat, ist es ein Verteiler: der Handel
 * behaelt seinen Zweig, jede andere Phase bekommt ihren.
 *
 * **Ein Geschenk verfaellt, eine Pflicht wird abgenommen.** Wer auf eine Gabe
 * wartet und schweigt, verzichtet; wer etwas schuldet, bekommt es
 * deterministisch abgenommen. Sonst waere Abwesenheit ein Zug. Jede
 * abgenommene Pflicht geht durch dieselbe `apply…` wie die eines Menschen.
 *
 * Wo der Reihe nach gehandelt wird, trifft der Ablauf **nur den Vordersten**:
 * wer hinter einem Abwesenden steht, hat seine Frist noch vor sich.
 */

export function canTimeout(state: GameState, at: number): RuleViolation | null {
  const due = deadlineOf(state);
  if (due === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Gerade läuft keine Frist');
  }

  /*
   * Pruefen laesst sich nur die gespeicherte Frist. Fuer eine Dauer steht der
   * Zeitpunkt nicht im Zustand - und das ist hier kein Loch: `timeout` kommt
   * ausschliesslich vom Server (`SYSTEM_ACTION_TYPES`), kein Client kann sie
   * schicken.
   */
  if (due.kind === 'at' && at < due.at) {
    return violation(RuleViolationCode.DEADLINE_NOT_REACHED, 'Die Frist läuft noch');
  }
  return null;
}

export function applyTimeout(state: GameState, at: number): ReduceResult {
  const problem = canTimeout(state, at);
  if (problem !== null) return rejected(problem);

  const phase = state.phase;
  switch (phase.kind) {
    case 'tradePending':
      return ok({ ...state, phase: { kind: 'main' } });

    case 'aqueductPending': {
      const rest = phase.pending.slice(1);
      return ok(
        rest.length > 0 && bankHasResource(state)
          ? { ...state, phase: { kind: 'aqueductPending', pending: rest } }
          : continueAfterAqueduct(state),
      );
    }

    case 'defenderPending': {
      const rest = phase.pending.slice(1);
      return ok(
        rest.length > 0 && anyProgressCardsLeft(state)
          ? { ...state, phase: { kind: 'defenderPending', pending: rest } }
          : continueAfterDefender(state),
      );
    }

    case 'discardPending':
      return discardForAll(state, phase.pending);

    case 'progressDiscardPending':
      return discardFirstCountingCard(state, phase.pending[0]!);

    case 'robberPending':
      return moveRobberForCurrent(state);

    case 'displacePending':
      return placeDisplaced(state, phase);

    case 'progressPending':
      return autoAnswerProgress(state);

    // `canTimeout` hat diese Phasen schon abgewiesen - der Zweig haelt `tsc` erschoepfend.
    case 'opening':
    case 'setup':
    case 'rollPending':
    case 'main':
    case 'finished':
      return rejected(violation(RuleViolationCode.WRONG_PHASE, 'Gerade läuft keine Frist'));
  }
}

/** Jeder, der noch abwerfen muss, wirft vom groessten Stapel abwaerts ab. */
function discardForAll(state: GameState, pending: readonly PlayerId[]): ReduceResult {
  let current = state;
  for (const player of pending) {
    const held = findPlayer(current, player)!.resources;
    const cards = takeMostHeld(held, CARD_IDS, discardCountFor(current, player));
    const result = applyDiscard(current, player, cards);
    if (!result.ok) return result;
    current = result.state;
  }
  return ok(current);
}

/** Die erste zaehlende Karte in `PROGRESS_CARD_IDS`-Ordnung geht zurueck. */
function discardFirstCountingCard(state: GameState, player: PlayerId): ReduceResult {
  const held = findPlayer(state, player)!.progressCards;
  const card = PROGRESS_CARD_IDS.find(
    (id) => held.includes(id) && !PROGRESS_VICTORY_CARDS.includes(id),
  );
  if (card === undefined) {
    return rejected(
      violation(RuleViolationCode.NOT_DISCARDING_PROGRESS, `${player} hat keine Karte zum Abgeben`),
    );
  }
  return applyDiscardProgressCard(state, player, card);
}

/**
 * Wueste, sonst das erste Feld ohne fremdes Bauwerk, sonst das erste legale -
 * je nach Feld-Id sortiert. Wer dort Karten hat, wird bestohlen wie sonst auch.
 */
function moveRobberForCurrent(state: GameState): ReduceResult {
  const player = state.players[state.currentPlayerIndex]!.id;
  const board = boardOf(state.scenario);

  const legal = [...board.hexes.keys()]
    .filter((hex) => canPlaceRobberAt(state, hex) === null)
    .sort();
  const desert = legal.filter((hex) => board.hexes.get(hex)?.terrain === 'desert');
  const harmless = legal.filter(
    (hex) =>
      !(board.topology.hexVertices.get(hex) ?? []).some((vertex) => {
        const building = state.buildings[vertex];
        return building !== undefined && building.owner !== player;
      }),
  );

  const hex = desert[0] ?? harmless[0] ?? legal[0];
  if (hex === undefined) {
    return rejected(violation(RuleViolationCode.ROBBER_LOCKED, 'Der Räuber findet kein Feld'));
  }
  return applyMoveRobber(state, player, hex, victimsAt(state, hex, player)[0] ?? null);
}

/** Die erste legale Kreuzung nach Id, sonst vom Brett in den Vorrat. */
function placeDisplaced(
  state: GameState,
  phase: Extract<Phase, { kind: 'displacePending' }>,
): ReduceResult {
  const [first] = displacementTargets(state, phase.owner, phase.from).sort();
  if (first !== undefined) return applyPlaceDisplacedKnight(state, phase.owner, first);

  // `phase.level` ist im Zustand ein blosses `number` (1 bis 3), nicht die engere
  // `KnightLevel` - die eine Verengung dafuer.
  return ok({
    ...returnKnightToSupply(state, phase.owner, phase.level as KnightLevel),
    phase: { kind: 'main' },
  });
}
