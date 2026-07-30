import { createRng } from '../random/index.js';
import { CLASSIC_RULES, type ResourceAmounts } from '../rules/index.js';
import { ScenarioDefinitionSchema, type ScenarioDefinition } from '../scenario/index.js';
import { EMPTY_RESOURCES } from './resources.js';
import { GameStateSchema, type GameState } from './state.js';

/**
 * Testmaterial. **Nicht im Barrel** - dieses Modul gehoert nicht zur
 * oeffentlichen Oberflaeche von `@conquerist/shared`.
 *
 * Die Regeltests brauchen ein Brett, dessen Gelaende und Zahlen man beim Lesen
 * des Tests im Kopf hat. Ein erzeugtes Szenario kann das nicht leisten - es ist
 * bei jedem Seed anders. Deshalb hier ein handgelegtes Brett aus sieben
 * Feldern: die Wueste in der Mitte, aussen herum je ein Feld jeder Gelaendeart.
 *
 * ```
 *        Weide 8      Huegel 6
 *   Feld 9      Wueste (Raeuber)   Wald 5
 *        Berg 4       Wald 10
 * ```
 */

/** Sieben Felder, Radius 1 um den Ursprung. Die Wueste liegt in der Mitte. */
export const TEST_SCENARIO: ScenarioDefinition = ScenarioDefinitionSchema.parse({
  id: 'test7',
  name: 'Testbrett mit sieben Feldern',
  minPlayers: 2,
  maxPlayers: 4,
  hexes: [
    { hex: '0,0', terrain: 'desert' },
    { hex: '1,0', terrain: 'forest', chip: 5 },
    { hex: '1,-1', terrain: 'hills', chip: 6 },
    { hex: '0,-1', terrain: 'pasture', chip: 8 },
    { hex: '-1,0', terrain: 'fields', chip: 9 },
    { hex: '-1,1', terrain: 'mountains', chip: 4 },
    { hex: '0,1', terrain: 'forest', chip: 10 },
  ],
  harbors: [
    { edge: 'e:1,0|2,0', ratio: 3 },
    { edge: 'e:1,-1|2,-2', ratio: 2, resource: 'ore' },
  ],
  robberStart: '0,0',
});

/**
 * Ein Knoten mit drei Feldern rundum, der in fast jedem Test vorkommt:
 * Wueste, Huegel (6, Lehm) und Wald (5, Holz).
 */
export const CENTER_VERTEX = 'v:0,0|1,-1|1,0';

/** Ein direkter Nachbar davon - fuer die Abstandsregel gesperrt. */
export const ADJACENT_VERTEX = 'v:0,0|0,1|1,0';

/** Zwei Schritte entfernt - dort darf gebaut werden. */
export const FAR_VERTEX = 'v:0,1|1,0|1,1';

/** Die Kante zwischen `CENTER_VERTEX` und `ADJACENT_VERTEX`. */
export const CENTER_EDGE = 'e:0,0|1,0';

/** Die anschliessende Kante, zwischen `ADJACENT_VERTEX` und `FAR_VERTEX`. */
export const NEXT_EDGE = 'e:0,1|1,0';

/** Ein Knoten am 3:1-Hafen an der Kante `e:1,0|2,0`. */
export const HARBOR3_VERTEX = 'v:1,0|1,1|2,0';

/** Ein Knoten am 2:1-Erzhafen an der Kante `e:1,-1|2,-2`. */
export const HARBOR2_ORE_VERTEX = 'v:1,-1|2,-2|2,-1';

export const TEST_PLAYERS = ['p1', 'p2', 'p3'] as const;

/** Fuellt eine Teilangabe zu einer vollstaendigen Ressourcenmenge auf. */
export function hand(partial: Partial<ResourceAmounts> = {}): ResourceAmounts {
  return { ...EMPTY_RESOURCES, ...partial };
}

/**
 * Ein Spielzustand zum Draufloslegen: drei Spieler, leere Haende, Hauptphase.
 *
 * Was ein Test braucht, gibt er als Ueberschreibung mit. Der Zustand geht
 * anschliessend durch `GameStateSchema` - ein Test, der versehentlich einen
 * unmoeglichen Zustand baut, faellt hier auf und nicht in der Regel, die er
 * eigentlich pruefen wollte.
 */
export function testGame(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    scenario: TEST_SCENARIO,
    rules: CLASSIC_RULES,
    players: TEST_PLAYERS.map((id) => ({
      id,
      resources: hand(),
      piecesLeft: { ...CLASSIC_RULES.pieceStock },
    })),
    currentPlayerIndex: 0,
    phase: { kind: 'main' },
    buildings: {},
    roads: {},
    robber: TEST_SCENARIO.robberStart,
    bank: { ...CLASSIC_RULES.resourceBank },
    longestRoad: { holder: null, length: 0 },
    rng: createRng('fixture'),
    lastRoll: null,
    turn: 1,
  };

  const state = { ...base, ...overrides };
  GameStateSchema.parse(state);
  return state;
}

/** Gibt einem Spieler Handkarten. */
export function giving(
  state: GameState,
  id: string,
  resources: Partial<ResourceAmounts>,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, resources: hand(resources) } : player,
    ),
  };
}
