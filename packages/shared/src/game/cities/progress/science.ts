import type { BuildableId, CardAmounts } from '../../../rules/index.js';
import type { TerrainId } from '../../../scenario/index.js';
import { boardOf } from '../../board.js';
import { applyBuildCity, applyBuildRoad } from '../../build.js';
import { EMPTY_CARDS } from '../../cards.js';
import { RuleViolationCode, violation } from '../../errors.js';
import type { PlayerId } from '../../player.js';
import { ok, rejected, type GameState, type ReduceResult } from '../../state.js';
import { payOut } from '../../yield.js';
import { applyBuildWall } from '../walls.js';
import { applyUpgradeKnight } from '../knights.js';
import type { ProgressPlay } from './play.js';

/**
 * Die zehn Wissenschaftskarten - Kran bis Strassenbau.
 *
 * **Aufgabe 6 und 7.** Bergbau, Bewaesserung, Strassenbau, Medizin, Ingenieur
 * und Schmied (Aufgabe 6) sowie Kran und Buchdruck (Aufgabe 7, Verfassung
 * steht in `politics.ts`) haben ab hier eine Wirkung. Alchemie und Erfinder
 * folgen in spaeteren Aufgaben.
 *
 * **Keine Wirkung hier baut selbst aufs Brett.** Strassenbau, Medizin,
 * Ingenieur und Schmied rufen `applyBuildRoad`, `applyBuildCity`,
 * `applyBuildWall` und `applyUpgradeKnight` - dieselben Regeln, die auch ein
 * bezahlter Bauzug benutzt. Zwei Auslegungen davon, wo eine Strasse liegen
 * darf, waeren ein Fehler, der frueher oder spaeter auseinanderliefe.
 */

/**
 * Ruft `build` mit dem genannten Preis statt dem echten - und stellt danach
 * das echte Regelwerk wieder her.
 *
 * Die vorhandenen `apply…`-Funktionen lesen ihren Preis aus
 * `state.rules.buildCosts`. Ein zweiter Preis-Parameter existiert dort nicht,
 * und ihn dort einzufuehren zoege jede andere Aufruferin dieser Funktionen in
 * Mitleidenschaft. Ein kurzlebiges Regelwerk mit dem gewuenschten Preis loest
 * das, ohne die echten Kosten je zu veraendern - das zurueckgegebene Ergebnis
 * traegt wieder das echte Regelwerk.
 */
function runWithCost(
  state: GameState,
  piece: BuildableId,
  cost: CardAmounts,
  build: (priced: GameState) => ReduceResult,
): ReduceResult {
  const priced: GameState = {
    ...state,
    rules: { ...state.rules, buildCosts: { ...state.rules.buildCosts, [piece]: cost } },
  };

  const result = build(priced);
  if (!result.ok) return result;

  return ok({ ...result.state, rules: state.rules });
}

/** Dasselbe wie `runWithCost`, aber zum Nulltarif - Strassenbau, Ingenieur, Schmied. */
function freeOfCharge(
  state: GameState,
  piece: BuildableId,
  build: (priced: GameState) => ReduceResult,
): ReduceResult {
  return runWithCost(state, piece, EMPTY_CARDS, build);
}

export function applyAlchemist(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'alchemist' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: beide Wuerfel bestimmen.
  return ok(state);
}

/**
 * Kran: ein Stadtausbau kostet in diesem Zug eine Handelsware weniger.
 *
 * Legt nur den Vermerk ab - `canImproveCity`/`applyImproveCity` in
 * `cities/improvements.ts` lesen `craneDiscount` beim Preis und streichen den
 * Bereich nach dem Ausbau. `endTurn` raeumt ihn ab, falls er ungenutzt blieb.
 */
export function applyCrane(
  state: GameState,
  _player: PlayerId,
  play: Extract<ProgressPlay, { card: 'crane' }>,
): ReduceResult {
  return ok({ ...state, craneDiscount: [...state.craneDiscount, play.track] });
}

/** Wie viele Felder dieser Gelaendeart eine eigene Siedlung oder Stadt tragen - je Feld hoechstens einmal gezaehlt. */
function ownedHexCount(state: GameState, player: PlayerId, terrain: TerrainId): number {
  const board = boardOf(state.scenario);
  let count = 0;

  for (const [hexId, placement] of board.hexes) {
    if (placement.terrain !== terrain) continue;
    const vertices = board.topology.hexVertices.get(hexId) ?? [];
    if (vertices.some((vertex) => state.buildings[vertex]?.owner === player)) count += 1;
  }

  return count;
}

/**
 * Bergbau und Bewaesserung: zwei Karten je passendem Feld mit eigenem
 * Gebaeude - `payOut` fuehrt die Bank mit, aus demselben Grund wie beim
 * Aquaedukt: reicht sie nicht, gibt es weniger.
 */
function applyFieldBonus(
  state: GameState,
  player: PlayerId,
  terrain: 'mountains' | 'fields',
  card: 'ore' | 'grain',
): ReduceResult {
  const hexes = ownedHexCount(state, player, terrain);
  if (hexes === 0) {
    return rejected(
      violation(
        RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
        `${player} hat kein Feld dieser Art mit eigener Siedlung oder Stadt`,
      ),
    );
  }

  const amount = Math.min(hexes * 2, state.bank[card]);
  if (amount <= 0) return ok(state);

  return ok(payOut(state, [{ player, card, amount }]));
}

export function applyMining(
  state: GameState,
  player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'mining' }>,
): ReduceResult {
  return applyFieldBonus(state, player, 'mountains', 'ore');
}

export function applyIrrigation(
  state: GameState,
  player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'irrigation' }>,
): ReduceResult {
  return applyFieldBonus(state, player, 'fields', 'grain');
}

/** Buchdruck: ein Siegpunkt, sofort offen - siehe `applyConstitution` in `politics.ts`. */
export function applyPrinter(
  state: GameState,
  player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'printer' }>,
): ReduceResult {
  return ok({
    ...state,
    players: state.players.map((entry) =>
      entry.id === player
        ? { ...entry, openProgressCards: [...entry.openProgressCards, 'printer'] }
        : entry,
    ),
  });
}

export function applyInventor(
  state: GameState,
  _player: PlayerId,
  _play: Extract<ProgressPlay, { card: 'inventor' }>,
): ReduceResult {
  // Wirkung folgt in einer spaeteren Aufgabe: zwei Zahlenchips vertauschen.
  return ok(state);
}

/** Ingenieur: eine Stadtmauer gratis - `canBuildWall`/`applyBuildWall` entscheiden, wo. */
export function applyEngineer(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'engineer' }>,
): ReduceResult {
  return freeOfCharge(state, 'wall', (priced) => applyBuildWall(priced, player, play.vertex));
}

/** Was Medizin statt des normalen Stadtpreises verlangt: zwei Erz, ein Getreide. */
const MEDICINE_PRICE: CardAmounts = { ...EMPTY_CARDS, ore: 2, grain: 1 };

/** Medizin: eine Siedlung wird zur Stadt fuer zwei Erz und ein Getreide statt des normalen Preises. */
export function applyMedicine(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'medicine' }>,
): ReduceResult {
  return runWithCost(state, 'city', MEDICINE_PRICE, (priced) =>
    applyBuildCity(priced, player, play.vertex),
  );
}

/**
 * Schmied: bis zu zwei eigene Ritter je eine Stufe gratis aufwerten - je
 * Ritter ein Aufruf von `canUpgradeKnight`/`applyUpgradeKnight`, damit die
 * Festungsbedingung fuer Stufe 3 unveraendert gilt.
 */
export function applySmith(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'smith' }>,
): ReduceResult {
  if (play.vertices.length === 0) {
    return rejected(
      violation(RuleViolationCode.PROGRESS_HAS_NO_EFFECT, `${player} hat keinen Ritter genannt`),
    );
  }

  let current = state;
  for (const vertex of play.vertices) {
    const result = freeOfCharge(current, 'knightUpgrade', (priced) =>
      applyUpgradeKnight(priced, player, vertex),
    );
    if (!result.ok) return result;
    current = result.state;
  }

  return ok(current);
}

/** Strassenbau: bis zu zwei Strassen gratis - `applyBuildRoad` je Kante, nacheinander. */
export function applyProgressRoadBuilding(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'roadBuilding' }>,
): ReduceResult {
  if (play.edges.length === 0) {
    return rejected(
      violation(RuleViolationCode.PROGRESS_HAS_NO_EFFECT, `${player} hat keine Straße genannt`),
    );
  }

  let current = state;
  for (const edge of play.edges) {
    const result = freeOfCharge(current, 'road', (priced) => applyBuildRoad(priced, player, edge));
    if (!result.ok) return result;
    current = result.state;
  }

  return ok(current);
}
