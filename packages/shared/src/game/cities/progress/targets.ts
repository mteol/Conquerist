import type { EdgeId, HexId, VertexId } from '../../../geometry/index.js';
import { boardOf } from '../../board.js';
import type { PlayerId } from '../../player.js';
import type { GameState } from '../../state.js';
import { applyPlayProgress } from './progressRules.js';

/**
 * Wo die sieben Fortschrittskarten mit einer Angabe vom Brett hinkoennten -
 * Erfinder, Ingenieur, Medizin, Schmied, Strassenbau, Diplomat, Intrige.
 *
 * Dieselbe Bauform wie `roadBuildingTargets` in `legal.ts`: kein Zug wird
 * hier selbst ausgelegt. Jede Funktion probiert den echten Zug ueber
 * `applyPlayProgress` - dieselbe Funktion, die auch der Reducer nimmt - und
 * behaelt, was `ok` ist. Eine zweite Auslegung, wo ein Zahlenchip tauschbar
 * ist, ein Ritter aufwertbar ist oder eine Strasse offen liegt, waere genau
 * der Fehler, den diese Bauform verhindert.
 *
 * **Auch die Kombinationsregeln stehen nicht hier.** Zwei Beispiele:
 * - Bei Erfinder lehnt `applyInventor` zweimal dasselbe Feld ab. Diese Datei
 *   filtert `b === a` nicht selbst heraus - der Versuch schlaegt ueber die
 *   echte Pruefung fehl, und das Ergebnis ist dasselbe.
 * - Bei Schmied lehnt `canUpgradeKnight` einen Ritter ab, der in diesem Zug
 *   schon aufgewertet wurde (`upgradedThisTurn`). Die zweite Wahl probiert
 *   deshalb `{ vertices: [erste, zweite] }` als **einen** Zug - genau die
 *   Verkettung, die `applySmith` intern schon macht -, statt die erste Wahl
 *   getrennt anzuwenden und die zweite gegen ein selbst gebautes Zwischenbrett
 *   zu pruefen.
 *
 * **Kein frueher Ausstieg wie bei `roadBuildingTargets`.** Dessen
 * `canPlayDevelopmentCard`-Vorabpruefung braucht keine Zielangabe. Bei den
 * Fortschrittskarten hier verlangt `canPlayProgress` immer den vollstaendigen
 * `ProgressPlay` - ein Formular dafuer vorab zu bauen, nur um fruehzeitig
 * auszusteigen, waere selbst wieder eine Annahme ueber ein plausibles Ziel.
 * Ohne die Karte auf der Hand (oder ausserhalb der Hauptphase) schlagen
 * einfach alle Versuche fehl, und es bleibt bei den leeren Strukturen unten -
 * langsamer nur um die Groesse des Bretts, nicht falsch.
 *
 * Liegt die Karte an diesem Tisch gar nicht im Regelwerk oder ausserhalb der
 * Hauptphase, gilt dasselbe: jeder Versuch schlaegt ueber `canPlayProgress`
 * fehl, und jede Funktion gibt ihre leere Struktur zurueck.
 */

/** Ob dieser Versuch der Karte gelingt - der einzige Massstab hier. */
function progressPlayOk(
  state: GameState,
  player: PlayerId,
  play: Parameters<typeof applyPlayProgress>[2],
): boolean {
  return applyPlayProgress(state, player, play).ok;
}

/**
 * Erfinder: welche Zahlenchip-Paare tauschbar waeren.
 *
 * Anders als bei Strassenbau und Schmied gibt es kein "eine Wahl reicht" -
 * die Karte verlangt immer zwei Felder. Ein erstes Feld ohne gueltiges
 * zweites steht deshalb nicht als Schluessel in der Zuordnung.
 */
export function inventorTargets(state: GameState, player: PlayerId): Record<HexId, HexId[]> {
  const board = boardOf(state.scenario);
  const hexes = [...board.hexes.keys()];
  const targets: Record<HexId, HexId[]> = {};

  for (const a of hexes) {
    const seconds = hexes.filter((b) => progressPlayOk(state, player, { card: 'inventor', a, b }));
    if (seconds.length > 0) targets[a] = seconds;
  }

  return targets;
}

/** Ingenieur: wo die gratis Stadtmauer hinkoennte. */
export function engineerTargets(state: GameState, player: PlayerId): VertexId[] {
  const board = boardOf(state.scenario);
  return board.topology.vertices.filter((vertex) =>
    progressPlayOk(state, player, { card: 'engineer', vertex }),
  );
}

/** Medizin: welche Siedlung zur Stadt werden koennte. */
export function medicineTargets(state: GameState, player: PlayerId): VertexId[] {
  const board = boardOf(state.scenario);
  return board.topology.vertices.filter((vertex) =>
    progressPlayOk(state, player, { card: 'medicine', vertex }),
  );
}

/**
 * Schmied: welche eigenen Ritter je eine Stufe steigen koennten.
 *
 * Kandidaten sind die eigenen Ritter auf dem Brett, nicht alle Kreuzungen -
 * dieselbe Eingrenzung wie beim Ritterzug in `legal.ts`. Die zweite Wahl
 * probiert `{ vertices: [erste, zweite] }` als einen Zug, damit die Festung-
 * und Einmal-pro-Zug-Regeln aus `applySmith` genau einmal gelten. Ein
 * einzelner Ritter ohne zweiten steht mit leerer zweiter Wahl in der
 * Zuordnung - "bis zu zwei" erlaubt genau das.
 */
export function smithTargets(state: GameState, player: PlayerId): Record<VertexId, VertexId[]> {
  const knights = Object.keys(state.knights);
  const targets: Record<VertexId, VertexId[]> = {};

  for (const first of knights) {
    if (!progressPlayOk(state, player, { card: 'smith', vertices: [first] })) continue;

    targets[first] = knights.filter((second) =>
      progressPlayOk(state, player, { card: 'smith', vertices: [first, second] }),
    );
  }

  return targets;
}

/**
 * Strassenbau (Fortschrittskarte): wo die bis zu zwei gratis Strassen
 * hinkoennten.
 *
 * Dieselbe Form wie `roadBuildingTargets` in `legal.ts` fuer die
 * gleichnamige Entwicklungskarte - aber ein eigener Name, weil beide Karten
 * an einem Tisch nie gemeinsam vorkommen (siehe `cards.ts`), ihre Ziele aber
 * schon. Die zweite Kante probiert `{ edges: [erste, zweite] }` als einen
 * Zug: `applyProgressRoadBuilding` prueft die zweite Kante damit gegen das
 * Brett NACH der ersten, ohne dass diese Datei den Anschluss selbst
 * nachrechnet.
 */
export function progressRoadBuildingTargets(
  state: GameState,
  player: PlayerId,
): Record<EdgeId, EdgeId[]> {
  const board = boardOf(state.scenario);
  const edges = board.topology.edges;
  const targets: Record<EdgeId, EdgeId[]> = {};

  for (const first of edges) {
    if (!progressPlayOk(state, player, { card: 'roadBuilding', edges: [first] })) continue;

    targets[first] = edges.filter((second) =>
      progressPlayOk(state, player, { card: 'roadBuilding', edges: [first, second] }),
    );
  }

  return targets;
}

/**
 * Diplomat: welche Strasse entfernt werden koennte, und wohin sie sofort neu
 * gesetzt werden duerfte.
 *
 * Kandidaten fuer die entfernte Strasse sind die belegten Kanten - eine
 * unbelegte Kante scheitert ueber `canDiplomat` ohnehin sofort, aber sie erst
 * gar nicht zu versuchen ist reine Ablesung aus `state.roads` und keine
 * Regel. Die Neubau-Kandidaten sind alle Kanten des Bretts: `canDiplomat`
 * entscheidet selbst, ob der Neubau erlaubt ist (eigene Strasse,
 * anschliessend, nicht dieselbe Kante) - diese Datei schliesst nichts davon
 * selbst aus. Eine entfernbare Strasse ohne gueltiges Neubau-Ziel (etwa eine
 * fremde) steht mit leerer zweiter Liste da, nicht als fehlender Schluessel -
 * "entfernen" bleibt fuer sich schon ein gueltiger Zug.
 */
export function diplomatTargets(state: GameState, player: PlayerId): Record<EdgeId, EdgeId[]> {
  const board = boardOf(state.scenario);
  const edges = board.topology.edges;
  const occupied = Object.keys(state.roads);
  const targets: Record<EdgeId, EdgeId[]> = {};

  for (const edge of occupied) {
    if (!progressPlayOk(state, player, { card: 'diplomat', edge })) continue;

    targets[edge] = edges.filter((rebuildAt) =>
      progressPlayOk(state, player, { card: 'diplomat', edge, rebuildAt }),
    );
  }

  return targets;
}

/**
 * Intrige: welcher fremde Ritter vertrieben werden koennte.
 *
 * Kandidaten sind die Kreuzungen mit einem Ritter darauf, nicht das ganze
 * Brett - `canIntrigue` verlangt ohnehin einen Ritter dort, und die
 * Eingrenzung auf `state.knights` ist reine Ablesung, keine Regel.
 */
export function intrigueTargets(state: GameState, player: PlayerId): VertexId[] {
  return Object.keys(state.knights).filter((vertex) =>
    progressPlayOk(state, player, { card: 'intrigue', vertex }),
  );
}
