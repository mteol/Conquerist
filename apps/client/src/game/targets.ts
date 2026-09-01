import {
  boardOf,
  legalActions,
  setupBuildingKind,
  terrainYield,
  type Building,
  type EdgeId,
  type GameAction,
  type GameState,
  type HexId,
  type PlayerId,
  type ScenarioDefinition,
  type TrackId,
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

  /*
   * Die Ritterzuege stehen in **eigenen** Karten und nicht in `vertices`.
   *
   * Der Grund ist eine freie Kreuzung an eigener Strasse: dort ist eine
   * Siedlung moeglich **und** ein Ritter, und `claim` wuerfe "doppelt belegt".
   * Die Sperre ist richtig - zwei Bauwerke auf einem Knoten waeren ein
   * Widerspruch in den Regeln. Zwei verschiedene Zugarten am selben Ort sind
   * keiner, sie brauchen nur zwei Karten.
   */
  /** Wo ein Ritter aufgestellt werden kann. */
  readonly knightBuild: ReadonlyMap<VertexId, GameAction>;
  /** Welche eigene Stadt eine Mauer bekommen kann. */
  readonly wallBuild: ReadonlyMap<VertexId, GameAction>;
  /** Welcher Ritter den Helm bekommen kann. */
  readonly activate: ReadonlyMap<VertexId, GameAction>;
  /** Welcher Ritter eine Stufe steigen kann. */
  readonly upgrade: ReadonlyMap<VertexId, GameAction>;
  /** Welcher Ritter den Raeuber verjagen kann. */
  readonly chase: ReadonlyMap<VertexId, GameAction>;
  /** Von welcher Kreuzung wohin. Zwei Klicks, deshalb zwei Ebenen. */
  readonly moves: ReadonlyMap<VertexId, ReadonlyMap<VertexId, GameAction>>;
  /** Wohin der eigene vertriebene Ritter ausweichen kann. */
  readonly displace: ReadonlyMap<VertexId, GameAction>;

  /*
   * Zwei Karten aus demselben Grund wie bei den Rittern oben: derselbe
   * Bereich kann einen Zug ohne Stadt **oder** mehrere mit Stadt hervorbringen,
   * und eine Karte, die beides führt, müßte lügen.
   */
  /** Je Bereich der Ausbauzug ohne Aufsatz - `null`, wo er gerade nicht geht. */
  readonly improve: ReadonlyMap<TrackId, GameAction>;
  /** Je Bereich die Städte, auf die der fällige Aufsatz könnte. */
  readonly metropolis: ReadonlyMap<TrackId, ReadonlyMap<VertexId, GameAction>>;
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
  knightBuild: new Map(),
  wallBuild: new Map(),
  activate: new Map(),
  upgrade: new Map(),
  chase: new Map(),
  moves: new Map(),
  displace: new Map(),
  improve: new Map(),
  metropolis: new Map(),
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
export function buildKindOf(
  action: GameAction,
  setupKind: BuildableKind = 'settlement',
): BuildableKind | null {
  switch (action.type) {
    case 'placeSetupRoad':
    case 'buildRoad':
      return 'road';
    /*
     * **Die Gruendungssetzung ist nicht immer eine Siedlung.** In Staedte &
     * Ritter setzt die zweite Runde eine **Stadt**, und der Knopf sagte
     * trotzdem "Siedlung", waehrend auf dem Brett eine Stadt entstand -
     * gefunden im Browser-Durchgang zu 10b. Was es wirklich ist, weiss die
     * Aktion nicht; es steht in `setupBuildingKind` aus `shared` und kommt
     * hier als Auskunft herein.
     */
    case 'placeSetupSettlement':
      return setupKind;
    case 'buildSettlement':
      return 'settlement';
    case 'buildCity':
      return 'city';
    case 'buildWall':
      return 'wall';
    case 'buildKnight':
      // Gebaut wird immer der Einfache Ritter; die drei Vorratsstufen sind
      // eine Frage des Aufwertens und keine der Bauleiste.
      return 'knight';
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
export function targetsFrom(
  actions: readonly GameAction[],
  setupKind: BuildableKind = 'settlement',
): ActionTargets {
  const vertices = new Map<VertexId, GameAction>();
  const edges = new Map<EdgeId, GameAction>();
  const hexes = new Map<HexId, GameAction[]>();
  const trades: GameAction[] = [];
  const knightBuild = new Map<VertexId, GameAction>();
  const wallBuild = new Map<VertexId, GameAction>();
  const activate = new Map<VertexId, GameAction>();
  const upgrade = new Map<VertexId, GameAction>();
  const chase = new Map<VertexId, GameAction>();
  const moves = new Map<VertexId, Map<VertexId, GameAction>>();
  const displace = new Map<VertexId, GameAction>();
  const improve = new Map<TrackId, GameAction>();
  const metropolis = new Map<TrackId, Map<VertexId, GameAction>>();
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
    const kind = buildKindOf(action, setupKind);
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

      case 'buildKnight':
        claim(knightBuild, action.vertex, action, 'Ritterplatz');
        break;
      case 'buildWall':
        claim(wallBuild, action.vertex, action, 'Mauerplatz');
        break;
      case 'activateKnight':
        claim(activate, action.vertex, action, 'Aktivierung');
        break;
      case 'upgradeKnight':
        claim(upgrade, action.vertex, action, 'Aufwertung');
        break;
      case 'chaseRobber':
        claim(chase, action.vertex, action, 'Raeuberjagd');
        break;
      case 'placeDisplacedKnight':
        claim(displace, action.vertex, action, 'Ausweichkreuzung');
        break;

      case 'improveCity':
        if (action.metropolisAt === undefined) {
          claim(improve, action.track, action, 'Ausbau');
        } else {
          const forTrack = metropolis.get(action.track) ?? new Map<VertexId, GameAction>();
          claim(forTrack, action.metropolisAt, action, 'Metropolenziel');
          metropolis.set(action.track, forTrack);
        }
        break;

      case 'moveKnight': {
        // Zwei Ebenen, weil das Versetzen zwei Klicks braucht: erst der
        // Ritter, dann sein Ziel.
        const from = moves.get(action.from) ?? new Map<VertexId, GameAction>();
        claim(from, action.to, action, 'Ritterziel');
        moves.set(action.from, from);
        break;
      }

      case 'discard':
        // `legalActions` zaehlt das Abwerfen bewusst nicht auf - bei acht
        // Handkarten gaebe es dutzende gueltige Kombinationen. Der Dialog
        // stellt sie zusammen. Dieser Zweig ist reine Vollstaendigkeit.
        break;
    }
  }

  return {
    vertices,
    edges,
    hexes,
    trades,
    roll,
    endTurn,
    buyCard,
    playKnight,
    buildable,
    knightBuild,
    wallBuild,
    activate,
    upgrade,
    chase,
    moves,
    displace,
    improve,
    metropolis,
  };
}

/**
 * Bequemlichkeit fuer die lokale Partie.
 *
 * Online kommt die Liste vom Server (`legalActions` braucht den vollen
 * Zustand und laeuft deshalb dort). Hier wird sie selbst geholt - dieselbe
 * Funktion, dieselben Regeln, nur ohne Netz.
 */
export function actionTargets(state: GameState, player: PlayerId): ActionTargets {
  return targetsFrom(legalActions(state, player), setupKindOf(state));
}

/**
 * Welches Bauteil die Gruendung gerade setzt - `settlement`, wo nicht gegruendet
 * wird.
 *
 * Eine Zeile Uebersetzung zwischen `shared` und der Klickkarte, damit beide
 * Aufrufer (lokal und online) dieselbe Frage gleich stellen.
 */
export function setupKindOf(source: {
  readonly phase: GameState['phase'];
  readonly players: readonly unknown[];
  readonly rules: GameState['rules'];
}): BuildableKind {
  return source.phase.kind === 'setup'
    ? setupBuildingKind(source, source.phase.placement)
    : 'settlement';
}

/**
 * Wo der Haendler stehen koennte, wenn diese Person ihn jetzt setzt: ein
 * Landfeld neben einer eigenen Siedlung oder Stadt.
 *
 * Haendler und Bischof sind die vierte und fuenfte Absicht von `usePickMode`
 * (siehe `GameScreen.tsx`) - `legalActions` zaehlt sie nicht auf, denn
 * `merchant` und `bishop` brauchen ein Feld, und das waere dieselbe
 * Aufzaehlung wie beim Strassenbau der Entwicklungskarten (siehe die
 * Begruendung in `legal.ts`). Diese Funktion baut deshalb, was das Brett
 * anbietet - **keine Spielregel, reine Brettgeometrie**: Feldnachbarschaft
 * und wem ein Bauwerk gehoert sind beides oeffentliche Angaben aus der Sicht,
 * dieselbe Art Ableitung wie `setupKindOf` oben. Ob ein Klick am Ende
 * zulaessig war (`canPlaceMerchant` in shared), entscheidet weiterhin der
 * Reducer.
 */
export function merchantTargets(
  source: {
    readonly scenario: ScenarioDefinition;
    readonly buildings: Readonly<Record<string, Building>>;
  },
  player: PlayerId,
): ReadonlyMap<HexId, readonly GameAction[]> {
  const board = boardOf(source.scenario);
  const targets = new Map<HexId, readonly GameAction[]>();

  for (const [hex, placement] of board.hexes) {
    // Wueste und See fallen heraus - dort gibt es nichts zu handeln.
    if (terrainYield(placement.terrain) === null) continue;

    const vertices = board.topology.hexVertices.get(hex) ?? [];
    const hasOwnBuilding = vertices.some((vertex) => source.buildings[vertex]?.owner === player);
    if (!hasOwnBuilding) continue;

    targets.set(hex, [{ type: 'playProgress', player, play: { card: 'merchant', hex } }]);
  }

  return targets;
}

/**
 * Wohin der Bischof den Raeuber setzen darf.
 *
 * Dieselbe Frage wie beim gewoehnlichen Versetzen (`canPlaceRobberAt` in
 * shared): jedes Feld auf dem Brett ausser dem, auf dem er schon steht. Die
 * zusaetzliche Sperre bis zum ersten Barbarenueberfall (`robberIsFree`)
 * bleibt bewusst aussen vor - sie bräuchte den vollen `GameState`
 * (`state.rng`, `state.deck`, …), den eine `PlayerView` nicht traegt, und
 * eine `PlayerView`-taugliche Abschrift der Bedingung wäre trotz nur einer
 * Zeile eine zweite Auslegung derselben Regel. Ein verfrueher Klick bleibt
 * deshalb ein gewoehnlicher, angezeigter Regelverstoss vom Reducer - dieselbe
 * "der Reducer entscheidet"-Haltung wie beim Monopol-Dialog.
 */
export function bishopTargets(
  source: { readonly scenario: ScenarioDefinition; readonly robber: HexId },
  player: PlayerId,
): ReadonlyMap<HexId, readonly GameAction[]> {
  const board = boardOf(source.scenario);
  const targets = new Map<HexId, readonly GameAction[]>();

  for (const hex of board.hexes.keys()) {
    if (hex === source.robber) continue;
    targets.set(hex, [{ type: 'playProgress', player, play: { card: 'bishop', hex } }]);
  }

  return targets;
}
