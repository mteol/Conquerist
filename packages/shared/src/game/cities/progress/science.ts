import type { BuildableId, CardAmounts } from '../../../rules/index.js';
import type { TerrainId } from '../../../scenario/index.js';
import { boardOf, chipIsSwappable, swapChips } from '../../board.js';
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
 * **Aufgabe 6 bis 8.** Bergbau, Bewaesserung, Strassenbau, Medizin, Ingenieur
 * und Schmied (Aufgabe 6), Kran (Aufgabe 7) sowie Alchemie und Erfinder
 * (Aufgabe 8) haben ab hier eine Wirkung.
 *
 * **Buchdruck steht nicht hier.** Er wird nie ausgespielt - siehe
 * `play.ts`: `draw.ts#receiveProgressCard` legt ihn sofort beim Ziehen offen
 * ab, in `openProgressCards`. Dasselbe gilt fuer Verfassung in `politics.ts`.
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
  const result = build(pricedWith(state, piece, cost));
  if (!result.ok) return result;

  return ok({ ...result.state, rules: state.rules });
}

/** Das kurzlebige Regelwerk aus `runWithCost` - dasselbe, nur mit diesem Preis. */
function pricedWith(state: GameState, piece: BuildableId, cost: CardAmounts): GameState {
  return {
    ...state,
    rules: { ...state.rules, buildCosts: { ...state.rules.buildCosts, [piece]: cost } },
  };
}

/**
 * Derselbe Zustand, in dem dieses Bauteil nichts kostet - fuer die `can…`-Seite.
 *
 * `freeOfCharge` fuehrt einen Bau aus und stellt danach das echte Regelwerk
 * wieder her; eine Pruefung aendert nichts und braucht nur den Preis. Beide
 * greifen auf `pricedWith` zu, damit "gratis" genau eine Auslegung hat.
 */
export function withoutCost(state: GameState, piece: BuildableId): GameState {
  return pricedWith(state, piece, EMPTY_CARDS);
}

/**
 * Dasselbe wie `runWithCost`, aber zum Nulltarif - Strassenbau, Ingenieur,
 * Schmied und der Neubau des Diplomaten.
 *
 * **Exportiert** fuer `politics.ts`: der Diplomat setzt seine entfernte
 * Strasse gratis neu, und das ist derselbe Handgriff. Ihn dort noch einmal zu
 * schreiben waere eine zweite Stelle, an der das echte Regelwerk
 * wiederhergestellt werden muesste.
 */
export function freeOfCharge(
  state: GameState,
  piece: BuildableId,
  build: (priced: GameState) => ReduceResult,
): ReduceResult {
  return runWithCost(state, piece, EMPTY_CARDS, build);
}

/**
 * Alchemie: beide Augenwuerfel des naechsten Wurfs bestimmen.
 *
 * **Sie legt keine Wuerfel, sie legt einen Vorsatz.** Der Wurf bleibt eine
 * Aktion des Spielers - `rollDice` liest `alchemistRoll`, setzt die Augen und
 * raeumt das Feld ab. Wuerde die Karte hier selbst wuerfeln und weiterschalten,
 * haette `rollDice` zwei Bedeutungen, und der Tisch wuesste nicht mehr, wer
 * gerade dran ist.
 *
 * Dass die Karte nur in `rollPending` gespielt werden darf, entscheidet
 * `canPlayNow` in `progressRules.ts` - nicht diese Funktion.
 *
 * Der Ereigniswuerfel steht nicht im Vorsatz: er faellt normal und wird zuerst
 * ausgefuehrt, genau wie in jedem anderen Wurf.
 */
export function applyAlchemist(
  state: GameState,
  _player: PlayerId,
  play: Extract<ProgressPlay, { card: 'alchemist' }>,
): ReduceResult {
  return ok({ ...state, alchemistRoll: { first: play.first, second: play.second } });
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

/**
 * Erfinder: zwei Zahlenchips vertauschen - nicht 2, 12, 6 und 8.
 *
 * Die einzige Karte des Stapels, die die **Brettdaten** aendert. Der Tausch
 * geht deshalb ueber `swapChips` in `board.ts`: es entsteht ein neues
 * Szenario, und damit leitet `boardOf` `hexesByChip` neu ab. Die Ertraege
 * folgen ab dem naechsten Wurf den neuen Zahlen, ohne dass hier irgendetwas
 * ueber Ertraege stuende.
 *
 * **Beide Seiten werden geprueft**, nicht nur die erste: eine gesperrte Zahl
 * bleibt gesperrt, egal ob sie als `a` oder als `b` genannt wird.
 */
export function applyInventor(
  state: GameState,
  player: PlayerId,
  play: Extract<ProgressPlay, { card: 'inventor' }>,
): ReduceResult {
  if (play.a === play.b) {
    return rejected(
      violation(
        RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
        `${player} hat zweimal dasselbe Feld genannt`,
      ),
    );
  }

  for (const hex of [play.a, play.b]) {
    if (!chipIsSwappable(state.scenario, hex)) {
      return rejected(
        violation(
          RuleViolationCode.PROGRESS_HAS_NO_EFFECT,
          `Auf ${hex} liegt kein Zahlenchip, der vertauscht werden darf`,
        ),
      );
    }
  }

  return ok({ ...state, scenario: swapChips(state.scenario, play.a, play.b) });
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
