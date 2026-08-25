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
/**
 * Was sich gerade bauen laesst - je Bauteil die Zahl der moeglichen Stellen.
 *
 * Seit dem Zwei-Schritt-Bauen ist das die Antwort auf die Frage, ob der Knopf
 * in der Leiste ueberhaupt etwas anbietet. Eine Zahl und kein `boolean`, weil
 * „an drei Stellen moeglich" mehr sagt als „moeglich" - und weil eine Null
 * dieselbe Auskunft ist wie ein `false`, nur ohne zweiten Typ.
 *
 * Sie wird abgezaehlt und nicht gerechnet: was hier steht, ist genau das, was
 * `legalActions` genannt hat. Der Client prueft nirgends selbst, ob jemand das
 * Holz dafuer hat (Regel: der Client kennt keine Regel).
 */
/**
 * Was sich auf dem Brett bauen laesst - die **Absicht**, nicht das Stueck im
 * Vorrat. Seit Staedte & Ritter gehoeren Stadtmauer und Ritter dazu; gebaut
 * wird immer der Einfache Ritter, und die drei Vorratsstufen (`knight1` bis
 * `knight3`) sind eine andere Frage.
 */
export type BuildableKind = 'road' | 'settlement' | 'city' | 'wall' | 'knight';

export interface ActionTargets {
  readonly vertices: ReadonlyMap<VertexId, GameAction>;
  readonly edges: ReadonlyMap<EdgeId, GameAction>;
  /** Raeuberziele: je moeglichem Opfer eine Aktion, deshalb eine Liste. */
  readonly hexes: ReadonlyMap<HexId, readonly GameAction[]>;
  readonly trades: readonly GameAction[];
  readonly roll: GameAction | null;
  readonly endTurn: GameAction | null;
  /** Eine Entwicklungskarte kaufen - `null`, wenn es gerade nicht geht. */
  readonly buyCard: GameAction | null;
  /** Ritter ausspielen. Die drei Karten mit Auswahl stehen nicht hier. */
  readonly playKnight: GameAction | null;
  /** Wie viele Stellen es je Bauteil gibt. Null heisst: der Knopf ist grau. */
  readonly buildable: Readonly<Record<BuildableKind, number>>;
}

/** Nichts anklickbar - fuer Spieler, die gerade nicht handeln duerfen. */
export const EMPTY_TARGETS: ActionTargets = {
  vertices: new Map(),
  edges: new Map(),
  hexes: new Map(),
  trades: [],
  roll: null,
  endTurn: null,
  buyCard: null,
  playKnight: null,
  buildable: { road: 0, settlement: 0, city: 0, wall: 0, knight: 0 },
};

/**
 * Welches Bauteil hinter einem Zug steckt - `null`, wenn es keins ist.
 *
 * **Die Gruendungszuege stehen hier, und das war einmal andersherum.** Die
 * Begruendung dagegen lautete: in der Gruendung gibt es genau eine Sache zu
 * setzen, ein Knopf davor entscheidet nichts. Das stimmt fuer sich genommen und
 * geht am Punkt vorbei. Die Gruendung ist der Moment, in dem man die Bedienung
 * **lernt**: wer seine ersten vier Zuege macht, indem er irgendwo auf ein
 * leuchtendes Brett klickt, hat danach keinen Grund anzunehmen, dass es je
 * anders liefe - und steht in der ersten Hauptrunde vor einem dunklen Brett.
 * Der eine Druck, der nichts entscheidet, bringt bei, wie es weitergeht.
 *
 * Was dadurch von selbst faellt: die Bauknoepfe sind in der Gruendung nicht
 * mehr alle grau. `buildable` zaehlt jetzt auch die Gruendungsstellen, also ist
 * genau der Knopf bedienbar, der dort an der Reihe ist - erst die Siedlung,
 * dann die Strasse.
 */
export function buildKindOf(action: GameAction): BuildableKind | null {
  switch (action.type) {
    case 'placeSetupRoad':
    case 'buildRoad':
      return 'road';
    case 'placeSetupSettlement':
    case 'buildSettlement':
      return 'settlement';
    case 'buildCity':
      return 'city';
    default:
      return null;
  }
}

/**
 * Sortiert eine fertige Aktionsliste nach Ort.
 *
 * Nimmt die Liste entgegen, statt sie selbst zu holen: online kommt sie vom
 * Server mit, weil `legalActions` den vollen Zustand braucht und der Client ihn
 * seit Etappe 4 nicht mehr hat. Lokal wie entfernt landet danach dieselbe
 * Sortierung in denselben Bildschirmen.
 */
export function targetsFrom(actions: readonly GameAction[]): ActionTargets {
  const vertices = new Map<VertexId, GameAction>();
  const edges = new Map<EdgeId, GameAction>();
  const hexes = new Map<HexId, GameAction[]>();
  const trades: GameAction[] = [];
  let roll: GameAction | null = null;
  let endTurn: GameAction | null = null;
  let buyCard: GameAction | null = null;
  let playKnight: GameAction | null = null;
  const buildable: Record<BuildableKind, number> = {
    road: 0,
    settlement: 0,
    city: 0,
    wall: 0,
    knight: 0,
  };

  const claim = <K, V>(map: Map<K, V>, key: K, value: V, what: string): void => {
    if (map.has(key)) {
      throw new RangeError(`targetsFrom: ${what} ${String(key)} ist doppelt belegt`);
    }
    map.set(key, value);
  };

  for (const action of actions) {
    const kind = buildKindOf(action);
    if (kind !== null) buildable[kind] += 1;

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

      case 'buyDevelopmentCard':
        buyCard = action;
        break;

      case 'playKnight':
        playKnight = action;
        break;

      case 'playRoadBuilding':
      case 'playYearOfPlenty':
      case 'playMonopoly':
        // Wie beim Abwerfen: die Auswahl trifft der Spieler, deshalb zaehlt
        // `legalActions` diese Zuege gar nicht erst auf. Was spielbar ist,
        // steht in `view.playableCards`.
        break;

      case 'discard':
        // `legalActions` zaehlt das Abwerfen bewusst nicht auf - bei acht
        // Handkarten gaebe es dutzende gueltige Kombinationen. Der Dialog
        // stellt sie zusammen. Dieser Zweig ist reine Vollstaendigkeit.
        break;
    }
  }

  return { vertices, edges, hexes, trades, roll, endTurn, buyCard, playKnight, buildable };
}

/**
 * Bequemlichkeit fuer die lokale Partie.
 *
 * Online kommt die Liste vom Server (`legalActions` braucht den vollen
 * Zustand und laeuft deshalb dort). Hier wird sie selbst geholt - dieselbe
 * Funktion, dieselben Regeln, nur ohne Netz.
 */
export function actionTargets(state: GameState, player: PlayerId): ActionTargets {
  return targetsFrom(legalActions(state, player));
}
