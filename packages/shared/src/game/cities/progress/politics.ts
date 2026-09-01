import type { EdgeId } from '../../../geometry/index.js';
import { boardOf } from '../../board.js';
import { applyBuildRoad, canBuildRoad } from '../../build.js';
import { countCards } from '../../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { canPlaceRobberAt, stealOneCard, victimsAt } from '../../robber.js';
import { openRoads, recomputeLongestRoad } from '../../roads.js';
import { victoryPointsOf } from '../../scoring.js';
import { ok, rejected, withPlayer, type GameState, type ReduceResult } from '../../state.js';
import { resolveDisplacement } from '../knightActions.js';
import type { ProgressPlay } from './play.js';
import { freeOfCharge, withoutCost } from './science.js';

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
    case 'bishop':
      return canBishop(state, player, play);
    case 'diplomat':
      return canDiplomat(state, player, play);
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

/**
 * Bischof: wohin der Raeuber darf - dieselbe Frage wie bei jedem Versetzen.
 *
 * `canPlaceRobberAt` beantwortet sie fuer beide Wege: Sperre bis zum ersten
 * Barbarenueberfall, Feld auf dem Brett, nicht dasselbe Feld. Nach einem Opfer
 * fragt der Bischof nicht - er nimmt von allen.
 */
export function canBishop(
  state: GameState,
  _player: PlayerId,
  play: Extract<ProgressPlay, { card: 'bishop' }>,
): RuleViolation | null {
  return canPlaceRobberAt(state, play.hex);
}

/**
 * Setzt den Raeuber um und zieht von **jeder** Person am neuen Feld eine
 * Handkarte - je Person nur eine, auch bei zwei Bauwerken.
 *
 * **Nicht ueber `robberPending`.** Diese Phase gibt es fuer die Opferwahl, und
 * der Bischof hat keine zu treffen; sie zu oeffnen hiesse, den Tisch fuer eine
 * Entscheidung anzuhalten, die niemand hat. Wen es trifft, sagt trotzdem
 * `victimsAt` - dieselbe Liste, die auch der Raeuber liest, samt der Regel "je
 * Person einmal" und "wer keine Karten hat, wird uebergangen".
 *
 * Welche Karte faellt, entscheidet der Zufall aus dem Zustand heraus: gleicher
 * RNG-Zustand, gleiche Karten - wie beim Stehlen in `applyMoveRobber`.
 */
export function applyBishop(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'bishop' }>,
): ReduceResult {
  const problem = canBishop(state, player, play);
  if (problem !== null) return rejected(problem);

  let current: GameState = { ...state, robber: play.hex };

  for (const victim of victimsAt(current, play.hex, player)) {
    current = stealOneCard(current, player, victim);
  }

  return ok(current);
}

/**
 * Das Brett ohne diese Strasse - die Kante frei, das Bauteil zurueck im
 * Vorrat seines Besitzers.
 *
 * Eine Funktion fuer `canDiplomat` und `applyDiplomat`: die Pruefung des
 * Neubaus muss auf demselben Brett rechnen, auf dem er stattfindet. Vor dem
 * Entfernen gerechnet stuende die alte Strasse noch da - und sie kann der
 * einzige Anschluss gewesen sein.
 */
function withoutRoad(state: GameState, edge: EdgeId, owner: PlayerId): GameState {
  const roads = { ...state.roads };
  delete roads[edge];

  return {
    ...state,
    roads,
    players: withPlayer(state, owner, (entry) => ({
      ...entry,
      piecesLeft: { ...entry.piecesLeft, road: entry.piecesLeft.road + 1 },
    })),
  };
}

/**
 * Diplomat: eine beliebige **offene** Strasse entfernen; war es eine eigene,
 * darf sie sofort neu gesetzt werden.
 *
 * Was offen heisst, rechnet `openRoads` in `roads.ts` - die Datei, die schon
 * weiss, wie Strassen zusammenhaengen.
 *
 * Der Neubau steht als `rebuildAt` in derselben Aktion und nicht als zweite
 * Phase: er laesst sich nicht aufschieben. Ein Feld, das mal erlaubt und mal
 * verboten ist, gehoert damit hierher - dieselbe Begruendung wie bei
 * `metropolisAt` in `canImproveCity`. Wo die neue Strasse liegen darf,
 * entscheidet `canBuildRoad` und nicht diese Karte; nur bezahlt wird sie
 * nicht.
 */
export function canDiplomat(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'diplomat' }>,
): RuleViolation | null {
  const owner = state.roads[play.edge];
  if (owner === undefined) {
    return violation(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
      `Auf ${play.edge} liegt keine Straße`,
    );
  }
  if (!openRoads(state).includes(play.edge)) {
    return violation(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
      `Die Straße auf ${play.edge} ist nicht offen`,
    );
  }

  if (play.rebuildAt === undefined) return null;

  if (owner !== player) {
    return violation(
      RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
      'Nur eine eigene entfernte Straße darf sofort neu gesetzt werden',
    );
  }

  return canBuildRoad(
    withoutCost(withoutRoad(state, play.edge, owner), 'road'),
    player,
    play.rebuildAt,
  );
}

/**
 * Entfernt die Strasse, gibt das Bauteil zurueck und setzt gegebenenfalls neu.
 *
 * **Die Laengste Handelsstrasse wird hier neu gerechnet**, obwohl `finalize`
 * im Reducer das nach jedem Zug ohnehin tut: dies ist der einzige Zug, der
 * eine Strasse vom Brett nimmt, und die Wirkung einer Karte darf nicht davon
 * abhaengen, wer sie aufruft.
 */
export function applyDiplomat(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'diplomat' }>,
): ReduceResult {
  const problem = canDiplomat(state, player, play);
  if (problem !== null) return rejected(problem);

  const removed = withoutRoad(state, play.edge, state.roads[play.edge]!);

  if (play.rebuildAt === undefined) return ok(recomputeLongestRoad(removed));

  const rebuilt = freeOfCharge(removed, 'road', (priced) =>
    applyBuildRoad(priced, player, play.rebuildAt!),
  );
  if (!rebuilt.ok) return rebuilt;

  return ok(recomputeLongestRoad(rebuilt.state));
}
