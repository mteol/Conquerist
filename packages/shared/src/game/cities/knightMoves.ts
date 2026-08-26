import type { VertexId } from '../../geometry/index.js';
import { boardOf } from '../board.js';
import type { PlayerId } from '../player.js';
import type { GameState } from '../state.js';

/**
 * Wie weit ein Ritter kommt.
 *
 * Eine eigene Datei, weil dieselbe Wegsuche an **drei** Stellen gebraucht
 * wird: beim Versetzen, beim Vertreiben und beim Ausweichen des Vertriebenen.
 * Neben den Zuegen gefuehrt hiesse, sie dreimal auszulegen.
 *
 * Ein Ritter zieht ueber **eigene Strassen**, beliebig weit. Zwei Regeln
 * schneiden die Menge zu, und beide haben einen Grund, der nicht aus dem Code
 * hervorgeht:
 *
 *  - **Ein fremder Ritter wird aufgenommen, aber nicht ueberschritten.** Man
 *    darf ihn angreifen und vertreiben - deshalb steht seine Kreuzung in der
 *    Menge. Man darf aber nicht an ihm vorbei, denn er haelt die Strasse -
 *    deshalb geht es von dort nicht weiter. Der eigene Ritter haelt niemanden
 *    auf: durch die eigene Stellung geht man hindurch.
 *  - **Eine fremde Siedlung sperrt nicht.** Das ist eine **Auslegung**: die
 *    Anleitung nennt beim Ritterzug nur Ritter, und die Laengste
 *    Handelsstrasse (wo eine fremde Siedlung sehr wohl unterbricht, siehe
 *    `roads.ts`) ist eine andere Frage - dort geht es um einen Streckenzug,
 *    hier um den Weg einer Figur.
 *
 * Belegte Kreuzungen bleiben in der Menge. Ob dort **gelandet** werden darf,
 * ist die Frage des Zuges und nicht des Weges - `vertexIsFree` beantwortet
 * sie, und `knightActions.ts` stellt sie.
 */

/** Ob dort ein Ritter stehenbleiben darf: kein Bauwerk, kein Ritter. */
export function vertexIsFree(state: GameState, vertex: VertexId): boolean {
  return state.buildings[vertex] === undefined && state.knights[vertex] === undefined;
}

/**
 * Welche Kreuzungen dieser Spieler von `from` aus ueber eigene Strassen
 * erreicht, ohne an einem fremden Ritter vorbeizuziehen.
 *
 * `from` selbst ist nicht dabei - ein Ritter, der stehenbleibt, zieht nicht.
 */
export function reachableVertices(
  state: GameState,
  player: PlayerId,
  from: VertexId,
): ReadonlySet<VertexId> {
  const board = boardOf(state.scenario);
  const reached = new Set<VertexId>();

  // Breitensuche. Die Warteschlange enthaelt nur Knoten, von denen aus es
  // weitergeht - ein fremder Ritter kommt in `reached`, aber nicht hierher.
  const queue: VertexId[] = [from];
  const seen = new Set<VertexId>([from]);

  while (queue.length > 0) {
    const vertex = queue.shift()!;

    for (const edge of board.topology.vertexEdges.get(vertex) ?? []) {
      if (state.roads[edge] !== player) continue;

      for (const next of board.topology.edgeVertices.get(edge) ?? []) {
        if (next === vertex || seen.has(next)) continue;
        seen.add(next);
        reached.add(next);

        const knight = state.knights[next];
        const blocked = knight !== undefined && knight.owner !== player;
        if (!blocked) queue.push(next);
      }
    }
  }

  return reached;
}
