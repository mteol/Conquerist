import type { ResourceAmounts } from '../rules/index.js';
import { RESOURCE_IDS } from '../scenario/index.js';
import { deadlineOf } from './deadline.js';
import { RuleViolationCode, violation, type RuleViolation } from './errors.js';
import type { Phase } from './phase.js';
import type { PlayerId } from './player.js';
import { addResources, canAfford, countResources, subtractResources } from './resources.js';
import {
  findPlayer,
  ok,
  rejected,
  withPlayer,
  type GameState,
  type ReduceResult,
} from './state.js';
import type { TradeResponse } from './tradeOffer.js';

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

/** Die offene Verhandlung als eigener Typ - die Regeln greifen staendig darauf zu. */
type TradePhase = Extract<Phase, { kind: 'tradePending' }>;

function openTrade(state: GameState): TradePhase | null {
  return state.phase.kind === 'tradePending' ? state.phase : null;
}

/** Ob dieser Spieler auf ein laufendes Angebot noch antworten muss. */
export function awaitsResponse(state: GameState, player: PlayerId): boolean {
  const trade = openTrade(state);
  if (trade === null) return false;

  return player !== trade.offer.from && trade.responses[player] === undefined;
}

/**
 * Wer antworten darf und ob er es schon getan hat.
 *
 * Gemeinsam fuer Antwort und Gegenangebot: beide sind dieselbe Handlung an
 * derselben Stelle, nur mit anderem Inhalt.
 */
function checkResponder(state: GameState, player: PlayerId): RuleViolation | null {
  const trade = openTrade(state);
  if (trade === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch');
  }

  if (player === trade.offer.from) {
    return violation(
      RuleViolationCode.NOT_THE_OFFERER,
      'Auf das eigene Angebot antwortet man nicht',
    );
  }

  if (findPlayer(state, player) === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }

  if (trade.responses[player] !== undefined) {
    return violation(
      RuleViolationCode.ALREADY_RESPONDED,
      `${player} hat auf dieses Angebot schon geantwortet`,
    );
  }

  return null;
}

export function canRespondTrade(
  state: GameState,
  player: PlayerId,
  response: 'accepted' | 'declined',
): RuleViolation | null {
  const problem = checkResponder(state, player);
  if (problem !== null) return problem;

  if (response === 'declined') return null;

  /*
   * Nur die Zusage verlangt die Karten. Dass diese Pruefung fehlschlaegt, sieht
   * ausschliesslich der Spieler selbst - `legalActions` baut je Empfaenger eine
   * eigene Liste. Ein sichtbares "kann nicht" waere eine Aussage ueber eine
   * verdeckte Hand.
   */
  const trade = openTrade(state)!;
  const owner = findPlayer(state, player)!;
  if (!canAfford(owner.resources, trade.offer.want)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Zusagen kann nur, wer das Verlangte auf der Hand hat',
    );
  }

  return null;
}

/**
 * Traegt eine Antwort ein - und raeumt das Angebot ab, wenn es tot ist.
 *
 * Tot heisst: alle haben geantwortet, niemand hat zugesagt oder gekontert,
 * **und keine der Ablehnungen war automatisch**. Die letzte Bedingung ist der
 * Unterschied zwischen "niemand will" und "gerade ist niemand da" - eine
 * abgerissene Verbindung soll kein Angebot toeten, das gleich wieder jemanden
 * findet.
 */
function withResponse(state: GameState, player: PlayerId, response: TradeResponse): ReduceResult {
  const trade = openTrade(state);
  if (trade === null) {
    return rejected(
      violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch'),
    );
  }

  const responses = { ...trade.responses, [player]: response };
  const others = state.players.filter((entry) => entry.id !== trade.offer.from);

  const complete = others.every((entry) => responses[entry.id] !== undefined);
  const alive = others.some((entry) => {
    const answer = responses[entry.id];
    return answer?.kind === 'accepted' || answer?.kind === 'countered';
  });
  const absent = others.some((entry) => {
    const answer = responses[entry.id];
    return answer?.kind === 'declined' && answer.automatic;
  });

  return ok(
    complete && !alive && !absent
      ? { ...state, phase: { kind: 'main' } }
      : { ...state, phase: { ...trade, responses } },
  );
}

export function applyRespondTrade(
  state: GameState,
  player: PlayerId,
  response: 'accepted' | 'declined',
): ReduceResult {
  const problem = canRespondTrade(state, player, response);
  if (problem !== null) return rejected(problem);

  return withResponse(
    state,
    player,
    response === 'accepted' ? { kind: 'accepted' } : { kind: 'declined', automatic: false },
  );
}

/**
 * Ein Gegenangebot ist die Antwort dieses Spielers - nicht ein zweites Angebot.
 *
 * Geprueft wird nur, was der Konternde selbst aufbringen muss. Ob der Anbieter
 * zahlen koennte, bleibt offen bis zum Zuschlag: eine Ablehnung aus diesem
 * Grund verriete etwas ueber seine verdeckte Hand.
 */
export function canCounterTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceAmounts,
  want: ResourceAmounts,
): RuleViolation | null {
  const problem = checkResponder(state, player);
  if (problem !== null) return problem;

  return checkShape(findPlayer(state, player)!, give, want);
}

export function applyCounterTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceAmounts,
  want: ResourceAmounts,
  at: number,
): ReduceResult {
  const problem = canCounterTrade(state, player, give, want);
  if (problem !== null) return rejected(problem);

  const answered = withResponse(state, player, { kind: 'countered', give, want });
  if (!answered.ok) return answered;

  /*
   * Die Frist laeuft neu. Ein Gegenangebot ist eine neue Frage an den Anbieter,
   * und er soll dieselbe Bedenkzeit haben wie der Tisch vorher.
   */
  const trade = openTrade(answered.state);
  if (trade === null) return answered;

  return ok({
    ...answered.state,
    phase: { ...trade, expiresAt: at + state.rules.tradeOfferMs },
  });
}

/**
 * Was beim Zuschlag mit diesem Partner in welche Richtung geht.
 *
 * Bei einer Zusage gelten die Seiten des Angebots, bei einem Gegenangebot
 * dessen eigene. Deshalb traegt `acceptTrade` keine Mengen: sie stehen bereits
 * im Zustand, und ein Client, der sie mitschickte, koennte sie erfinden.
 */
export function termsFor(
  state: GameState,
  partner: PlayerId,
): { readonly partnerGives: ResourceAmounts; readonly partnerGets: ResourceAmounts } | null {
  const trade = openTrade(state);
  if (trade === null) return null;

  const answer = trade.responses[partner];
  if (answer === undefined) return null;

  if (answer.kind === 'accepted') {
    return { partnerGives: trade.offer.want, partnerGets: trade.offer.give };
  }
  if (answer.kind === 'countered') {
    return { partnerGives: answer.give, partnerGets: answer.want };
  }

  return null;
}

export function canAcceptTrade(
  state: GameState,
  player: PlayerId,
  partner: PlayerId,
): RuleViolation | null {
  const trade = openTrade(state);
  if (trade === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch');
  }

  if (player !== trade.offer.from) {
    return violation(RuleViolationCode.NOT_THE_OFFERER, 'Nur der Anbieter schlaegt zu');
  }

  const terms = termsFor(state, partner);
  if (terms === null) {
    return violation(
      RuleViolationCode.PARTNER_DID_NOT_ACCEPT,
      `${partner} hat weder zugesagt noch gekontert`,
    );
  }

  const owner = findPlayer(state, player);
  const other = findPlayer(state, partner);
  if (owner === undefined || other === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, 'Einer der beiden sitzt nicht am Tisch');
  }

  /*
   * Waehrend `tradePending` kann sich an keiner Hand etwas aendern - trotzdem
   * geprueft. Eine Regel, die sich auf eine andere verlaesst, wird beim
   * naechsten Umbau still falsch.
   */
  if (!canAfford(owner.resources, terms.partnerGets)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      'Der Anbieter kann diesen Tausch nicht mehr decken',
    );
  }
  if (!canAfford(other.resources, terms.partnerGives)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `${partner} kann diesen Tausch nicht mehr decken`,
    );
  }

  return null;
}

export function applyAcceptTrade(
  state: GameState,
  player: PlayerId,
  partner: PlayerId,
): ReduceResult {
  const problem = canAcceptTrade(state, player, partner);
  if (problem !== null) return rejected(problem);

  const terms = termsFor(state, partner)!;

  // Erst der Anbieter, dann der Partner - `withPlayer` gibt die Spielerliste
  // zurueck, nicht den Zustand, deshalb zwei Schritte statt zweier Kopien.
  const afterOfferer = withPlayer(state, player, (entry) => ({
    ...entry,
    resources: addResources(
      subtractResources(entry.resources, terms.partnerGets),
      terms.partnerGives,
    ),
  }));

  return ok({
    ...state,
    players: afterOfferer.map((entry) =>
      entry.id === partner
        ? {
            ...entry,
            resources: addResources(
              subtractResources(entry.resources, terms.partnerGives),
              terms.partnerGets,
            ),
          }
        : entry,
    ),
    phase: { kind: 'main' },
  });
}

export function canWithdrawTrade(state: GameState, player: PlayerId): RuleViolation | null {
  const trade = openTrade(state);
  if (trade === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Es liegt gerade kein Angebot auf dem Tisch');
  }

  return player === trade.offer.from
    ? null
    : violation(RuleViolationCode.NOT_THE_OFFERER, 'Nur der Anbieter nimmt sein Angebot zurueck');
}

export function applyWithdrawTrade(state: GameState, player: PlayerId): ReduceResult {
  const problem = canWithdrawTrade(state, player);
  if (problem !== null) return rejected(problem);

  return ok({ ...state, phase: { kind: 'main' } });
}

/**
 * Der Fristablauf.
 *
 * Keine Absicht eines Spielers, sondern das Ende einer Uhr - deshalb wirft nur
 * der Server diese Aktion ein. Geprueft wird trotzdem gegen den Zustand: eine
 * Frist, die noch laeuft, laesst sich nicht abkuerzen, auch nicht vom Server.
 */
export function canTimeout(state: GameState, at: number): RuleViolation | null {
  const due = deadlineOf(state);
  if (due === null) {
    return violation(RuleViolationCode.WRONG_PHASE, 'Gerade laeuft keine Frist');
  }

  return at >= due.at
    ? null
    : violation(RuleViolationCode.DEADLINE_NOT_REACHED, 'Die Frist laeuft noch');
}

export function applyTimeout(state: GameState, at: number): ReduceResult {
  const problem = canTimeout(state, at);
  if (problem !== null) return rejected(problem);

  return ok({ ...state, phase: { kind: 'main' } });
}
