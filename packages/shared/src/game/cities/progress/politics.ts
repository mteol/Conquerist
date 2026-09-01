import { countCards } from '../../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { boardOf } from '../../board.js';
import { victoryPointsOf } from '../../scoring.js';
import { ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import { resolveDisplacement } from '../knightActions.js';
import type { ProgressPlay } from './play.js';

/**
 * Fuenf ausspielbare Politikkarten an diesem Tisch - Bischof, Diplomat,
 * Heerfuehrer, Intrige, Sabotage. `spy` (Spionage), `deserter` (Deserteur) und
 * `wedding` (Hochzeit) fehlen: sie warten auf eine fremde Antwort und kommen
 * mit ihrer Phase erst in 10d-2.
 *
 * **Verfassung steht nicht hier.** Sie wird nie ausgespielt: laut Anleitung
 * (Abschnitt 11) liegt sie sofort beim Ziehen offen -
 * `draw.ts#receiveProgressCard` legt sie direkt in `openProgressCards` ab.
 * Dasselbe gilt fuer Buchdruck in `science.ts`. `play.ts` kennt deshalb keine
 * `ProgressPlay`-Variante fuer eine der beiden Karten.
 *
 * **Keine Karte hier erfindet eine Wartephase.** Sabotage benutzt
 * `discardPending` aus Etappe 5, Intrige `displacePending` aus 10b - genau
 * deshalb stehen sie in 10d-1 und nicht bei den Karten, die auf eine fremde
 * Antwort warten.
 *
 * Was eine Karte an Brett und Bestand verlangt, steht in ihrem `can…` und
 * nicht erst in der Wirkung: `canPolitics` gibt `canPlayProgress` dieselbe
 * Antwort, die `apply…` gleich noch einmal einholt (Regel: jede Regel
 * zweimal).
 */

/**
 * Was diese Politikkarte ueber Timing und Handkarte hinaus verlangt.
 *
 * Der Haken fuer `canPlayProgress` - Heerfuehrer und Sabotage brauchen nichts,
 * die drei anderen ein Ziel auf dem Brett. Ohne diesen Haken stuende die
 * Pruefung nur im `apply…`, und `legalActions` boete Zuege an, die der
 * Reducer ablehnt.
 */
export function canPolitics(
  state: GameState,
  player: PlayerId,
  play: ProgressPlay,
): RuleViolation | null {
  switch (play.card) {
    case 'intrigue':
      return canIntrigue(state, player, play);
    default:
      return null;
  }
}

/**
 * Heerfuehrer: alle eigenen Ritter bekommen den Helm, ohne Bezahlung.
 *
 * **Die schon aktivierten bleiben unangetastet.** Ihnen die
 * Aktivierungsrunde neu zu setzen naehme ihnen die Handlungsfaehigkeit fuer
 * diesen Zug - `knightMayAct` verlangt `activatedOnTurn < state.turn`, und die
 * eigene Karte darf den eigenen Rittern nicht die Hand binden.
 *
 * Die frisch Aktivierten tragen dagegen die laufende Runde und handeln damit
 * ab dem naechsten Zug - dieselbe Ruhefrist wie bei `applyActivateKnight`.
 */
export function applyWarlord(
  state: GameState,
  player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'warlord' }>,
): ReduceResult {
  return ok({
    ...state,
    knights: Object.fromEntries(
      Object.entries(state.knights).map(([vertex, knight]) =>
        knight.owner === player && !knight.active
          ? [vertex, { ...knight, active: true, activatedOnTurn: state.turn }]
          : [vertex, knight],
      ),
    ),
  });
}

/**
 * Sabotage: wer gleich viele oder mehr Siegpunkte hat, wirft die Haelfte
 * seiner Handkarten ab (abgerundet).
 *
 * Dieselbe Phase wie nach einer Sieben, aber mit zwei Unterschieden, die
 * `discardPending` selbst traegt (siehe `phase.ts`): die verlangte Menge steht
 * in `counts`, weil das Handlimit hier nichts zu sagen hat, und `resume` fuehrt
 * ohne Umweg ueber den Raeuber in die Hauptphase zurueck.
 *
 * Gezaehlt werden **alle** Siegpunkte, auch die verdeckten - `victoryPointsOf`
 * ist die Wahrheit ueber den Punktestand, und die Regel fragt nach dem
 * Punktestand und nicht nach dem, was am Tisch sichtbar ist.
 *
 * Wer nichts abzuwerfen haette, kommt nicht in die Liste, und ist sie leer,
 * oeffnet die Phase gar nicht: eine Wartephase ohne Wartende hielte den Tisch
 * fuer nichts an.
 */
export function applySaboteur(
  state: GameState,
  player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'saboteur' }>,
): ReduceResult {
  const points = victoryPointsOf(state, player);

  const counts: Record<PlayerId, number> = {};
  const pending: PlayerId[] = [];

  for (const other of state.players) {
    if (other.id === player) continue;
    if (victoryPointsOf(state, other.id) < points) continue;

    const half = Math.floor(countCards(other.resources) / 2);
    if (half === 0) continue;

    counts[other.id] = half;
    pending.push(other.id);
  }

  if (pending.length === 0) return ok(state);

  return ok({ ...state, phase: { kind: 'discardPending', pending, counts, resume: 'main' } });
}

/**
 * Intrige: einen fremden Ritter von einer Kreuzung am eigenen Strassennetz
 * vertreiben - **ohne** eigenen Ritter und ohne Vergleich der Staerke.
 *
 * Gefordert ist eine eigene Strasse **an dieser Kreuzung**, nicht irgendwo im
 * Netz - dieselbe Frage und dieselbe Schleife wie beim Ritterbau in
 * `knights.ts#canBuildKnight`.
 */
export function canIntrigue(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'intrigue' }>,
): RuleViolation | null {
  const knight = state.knights[play.vertex];
  if (knight === undefined) {
    return violation(
      RuleViolationCode.NO_KNIGHT_HERE,
      `Auf ${play.vertex} steht kein Ritter, den die Intrige vertreiben könnte`,
    );
  }
  if (knight.owner === player) {
    return violation(
      RuleViolationCode.KNIGHT_TARGET_TAKEN,
      `Auf ${play.vertex} steht ein eigener Ritter`,
    );
  }

  const board = boardOf(state.scenario);
  const edges = board.topology.vertexEdges.get(play.vertex) ?? [];
  if (!edges.some((edge) => state.roads[edge] === player)) {
    return violation(
      RuleViolationCode.NOT_CONNECTED,
      `An ${play.vertex} endet keine eigene Straße`,
    );
  }

  return null;
}

/**
 * Vertreibt den fremden Ritter.
 *
 * Was danach mit ihm geschieht - ausweichen oder in den Vorrat -, entscheidet
 * `resolveDisplacement` aus `knightActions.ts`, dieselbe Funktion, die auch
 * der Ritterzug benutzt. Der Angreifer selbst rueckt nicht nach: die Intrige
 * schickt keinen eigenen Ritter, sie schickt nur den fremden weg.
 */
export function applyIntrigue(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'intrigue' }>,
): ReduceResult {
  const problem = canIntrigue(state, player, play);
  if (problem !== null) return rejected(problem);

  const displaced = state.knights[play.vertex]!;
  const knights = { ...state.knights };
  delete knights[play.vertex];

  return ok(resolveDisplacement({ ...state, knights }, displaced, play.vertex));
}

export function applyBishop(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'bishop' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: Raeuber versetzen und Karten ziehen.
  return ok(state);
}

export function applyDiplomat(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'diplomat' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: eine offene Strasse entfernen.
  return ok(state);
}
