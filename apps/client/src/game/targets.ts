import {
  legalActions,
  type EdgeId,
  type GameAction,
  type GameState,
  type HexId,
  type PlayerId,
  type VertexId,
} from '@conquerist/shared';

/**
 * Was der Spieler wo anklicken kann - abgeleitet, nicht selbst gewusst.
 *
 * Der Client kennt keine Regel. Er fragt `legalActions` und sortiert die
 * Antwort nach Ort: Knoten, Kante, Feld. Ein Klick schlaegt hier nach und
 * schickt die gefundene Aktion durch `reduce`. Damit gibt es weiterhin genau
 * eine Regelauslegung - dieselbe, die `legalActions` und `reduce` sich seit
 * Etappe 2 teilen.
 *
 * Warum die Zielart am Ort eindeutig ist: eine Stadt ist nur moeglich, wo die
 * eigene Siedlung steht, eine Siedlung nur auf einem freien Knoten. Zwei
 * Aktionen auf demselben Knoten waeren ein Widerspruch in den Regeln und kein
 * Bedienproblem - deshalb wirft der Aufbau dort, statt still die erste zu
 * nehmen.
 */
export interface ActionTargets {
  readonly vertices: ReadonlyMap<VertexId, GameAction>;
  readonly edges: ReadonlyMap<EdgeId, GameAction>;
  /** Raeuberziele: je moeglichem Opfer eine Aktion, deshalb eine Liste. */
  readonly hexes: ReadonlyMap<HexId, readonly GameAction[]>;
  readonly trades: readonly GameAction[];
  readonly roll: GameAction | null;
  readonly endTurn: GameAction | null;
}

/** Nichts anklickbar - fuer Spieler, die gerade nicht handeln duerfen. */
export const EMPTY_TARGETS: ActionTargets = {
  vertices: new Map(),
  edges: new Map(),
  hexes: new Map(),
  trades: [],
  roll: null,
  endTurn: null,
};

export function actionTargets(state: GameState, player: PlayerId): ActionTargets {
  const vertices = new Map<VertexId, GameAction>();
  const edges = new Map<EdgeId, GameAction>();
  const hexes = new Map<HexId, GameAction[]>();
  const trades: GameAction[] = [];
  let roll: GameAction | null = null;
  let endTurn: GameAction | null = null;

  const claim = <K, V>(map: Map<K, V>, key: K, value: V, what: string): void => {
    if (map.has(key)) {
      throw new RangeError(`actionTargets: ${what} ${String(key)} ist doppelt belegt`);
    }
    map.set(key, value);
  };

  for (const action of legalActions(state, player)) {
    switch (action.type) {
      case 'placeSetupSettlement':
      case 'buildSettlement':
      case 'buildCity':
        claim(vertices, action.vertex, action, 'Knoten');
        break;

      case 'placeSetupRoad':
      case 'buildRoad':
        claim(edges, action.edge, action, 'Kante');
        break;

      case 'moveRobber': {
        const bucket = hexes.get(action.hex);
        if (bucket === undefined) hexes.set(action.hex, [action]);
        else bucket.push(action);
        break;
      }

      case 'tradeWithBank':
        trades.push(action);
        break;

      case 'rollDice':
        roll = action;
        break;

      case 'endTurn':
        endTurn = action;
        break;

      case 'discard':
        // `legalActions` zaehlt das Abwerfen bewusst nicht auf - bei acht
        // Handkarten gaebe es dutzende gueltige Kombinationen. Der Dialog
        // stellt sie zusammen. Dieser Zweig ist reine Vollstaendigkeit.
        break;
    }
  }

  return { vertices, edges, hexes, trades, roll, endTurn };
}
