import type { ResourceAmounts } from '../rules/index.js';
import { RESOURCE_IDS } from '../scenario/index.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { PlayerId } from './player.js';
import { canAfford, countResources } from './resources.js';
import { findPlayer, ok, rejected, type GameState, type ReduceResult } from './state.js';

/**
 * Handel zwischen Spielern.
 *
 * Getrennt von `trade.ts`, das Bank und Haefen traegt: das sind zwei Regeln mit
 * nichts Gemeinsamem ausser dem Wort Handel, und zusammen waeren sie die
 * groesste Regeldatei im Paket.
 *
 * Der Ablauf ist ein Angebot, das offen liegt (`phase.tradePending`), Antworten
 * der Mitspieler, und ein Zuschlag des Anbieters. Rohstoffe wechseln
 * **ausschliesslich** beim Zuschlag - ein Angebot nimmt niemandem etwas weg.
 */

/** Ob eine Seite des Tauschs ueberhaupt etwas enthaelt. */
function isEmpty(amounts: ResourceAmounts): boolean {
  return countResources(amounts) === 0;
}

/** Ob dieselbe Sorte auf beiden Seiten steht - dann waere ein Teil kein Tausch. */
function overlaps(give: ResourceAmounts, want: ResourceAmounts): boolean {
  return RESOURCE_IDS.some((resource) => give[resource] > 0 && want[resource] > 0);
}

/**
 * Die Form eines Angebots, unabhaengig davon, wer es macht.
 *
 * Dieselbe Pruefung gilt fuer das Angebot und fuer jedes Gegenangebot - deshalb
 * einmal hier und nicht zweimal weiter unten.
 */
function checkShape(
  owner: { readonly resources: ResourceAmounts },
  give: ResourceAmounts,
  want: ResourceAmounts,
): RuleViolation | null {
  if (isEmpty(give) || isEmpty(want)) {
    return violation(
      RuleViolationCode.INVALID_TRADE,
      'Ein Tausch braucht auf beiden Seiten mindestens eine Karte',
    );
  }

  if (overlaps(give, want)) {
    return violation(
      RuleViolationCode.INVALID_TRADE,
      'Dieselbe Sorte auf beiden Seiten waere zum Teil kein Tausch',
    );
  }

  if (!canAfford(owner.resources, give)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Angeboten werden kann nur, was auf der Hand liegt',
    );
  }

  return null;
}

/** Prueft ein Angebot vollstaendig. */
export function canOfferTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceAmounts,
  want: ResourceAmounts,
): RuleViolation | null {
  if (state.phase.kind !== 'main') {
    return violation(RuleViolationCode.WRONG_PHASE, 'Angeboten wird in der Hauptphase');
  }

  if (state.players[state.currentPlayerIndex]?.id !== player) {
    return violation(RuleViolationCode.NOT_YOUR_TURN, `${player} ist nicht am Zug`);
  }

  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }

  return checkShape(owner, give, want);
}

/**
 * Ob dieser Spieler jetzt ueberhaupt anbieten duerfte - ohne konkrete Mengen.
 *
 * Die Oberflaeche braucht diese Antwort, bevor der Spieler Mengen gewaehlt hat;
 * `legalActions` kann sie nicht liefern, weil jede Mengenkombination ueber
 * fuenf Sorten Tausende Eintraege waeren (dieselbe Begruendung wie beim
 * Abwerfen).
 */
export function canOfferAnything(state: GameState, player: PlayerId): boolean {
  if (state.phase.kind !== 'main') return false;
  if (state.players[state.currentPlayerIndex]?.id !== player) return false;
  if (state.players.length < 2) return false;

  const owner = findPlayer(state, player);
  return owner !== undefined && countResources(owner.resources) > 0;
}

export function applyOfferTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceAmounts,
  want: ResourceAmounts,
  at: number,
): ReduceResult {
  const problem = canOfferTrade(state, player, give, want);
  if (problem !== null) return rejected(problem);

  return ok({
    ...state,
    phase: {
      kind: 'tradePending',
      offer: { from: player, give, want },
      responses: {},
      // Die Frist entsteht aus dem uebergebenen Zeitpunkt, nie aus einer Uhr:
      // der Reducer ist rein, und `replay` muss dieselbe Frist wieder ergeben.
      expiresAt: at + state.rules.tradeOfferMs,
    },
  });
}
