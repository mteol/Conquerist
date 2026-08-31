import type { VertexId } from '../../geometry/index.js';
import type { CardAmounts } from '../../rules/index.js';
import { addCards, canAfford, subtractCards } from '../cards.js';
import { RuleViolationCode, violation, type RuleViolation } from '../errors.js';
import type { PlayerId } from '../player.js';
import {
  findPlayer,
  ok,
  rejected,
  withPlayer,
  type GameState,
  type ReduceResult,
} from '../state.js';
import type { BuildingSource } from './barbarians.js';
import {
  improvementCost,
  levelOf,
  MAX_TRACK_LEVEL,
  METROPOLIS_LEVEL,
  stepWithArticle,
  TRACK_COMMODITY,
  type TrackId,
} from './tracks.js';

/**
 * Der Stadtausbau ist ein Zug ohne Ort - er veraendert eine Zahl beim Spieler
 * und, wenn der Aufsatz kommt, genau ein Gebaeude. Deshalb steht die
 * Metropolenvergabe hier und nicht in `build.ts`: sie ist die Folge eines
 * Ausbaus und kein eigener Bauzug.
 */

/**
 * Der Ausbaupreis nach dem Kran: eine Handelsware weniger, wenn `track` in
 * `state.craneDiscount` steht - nie unter null.
 *
 * Eine Funktion und keine Ableitung in `canImproveCity`/`applyImproveCity`
 * allein: beide brauchen denselben Preis, und zwei Rechnungen dafuer liefen
 * bei einer spaeteren Aenderung auseinander.
 */
function priceWithCraneDiscount(state: GameState, track: TrackId, price: CardAmounts): CardAmounts {
  if (!state.craneDiscount.includes(track)) return price;

  const commodity = TRACK_COMMODITY[track];
  return { ...price, [commodity]: Math.max(0, price[commodity] - 1) };
}

/** Wo der Aufsatz dieses Bereichs steht - `null`, wenn nirgends. */
export function findMetropolisVertex(source: BuildingSource, track: TrackId): VertexId | null {
  for (const [vertex, building] of Object.entries(source.buildings)) {
    if (building.metropolis === track) return vertex;
  }
  return null;
}

/** Wer den Aufsatz dieses Bereichs haelt - `null`, wenn ihn niemand hat. */
export function metropolisHolder(source: BuildingSource, track: TrackId): PlayerId | null {
  const vertex = findMetropolisVertex(source, track);
  return vertex === null ? null : source.buildings[vertex]!.owner;
}

/**
 * Ob dieser Ausbau den Aufsatz einbringt.
 *
 * Zwei Faelle, und nur diese zwei:
 *
 *  - **Stufe 4 und der Aufsatz ist frei.** Wer als Erster dort ankommt, bekommt
 *    ihn.
 *  - **Stufe 5, waehrend ihn jemand haelt, der selbst noch nicht auf 5 steht.**
 *    Das ist die einzige Art, wie eine Metropole den Besitzer wechselt.
 *
 * Alles andere bringt nichts ein - auch Stufe 4, wenn der Aufsatz schon
 * vergeben ist. Das ist die Auslegung aus Abweichung 1: die freie Stadt haengt
 * daran, ob der Aufsatz **kommt**, nicht an der Stufe.
 */
export function claimsMetropolis(state: GameState, player: PlayerId, track: TrackId): boolean {
  const next = levelOf(findPlayer(state, player)!, track) + 1;
  const holder = metropolisHolder(state, track);

  if (next === METROPOLIS_LEVEL) return holder === null;
  if (next !== MAX_TRACK_LEVEL) return false;
  if (holder === null || holder === player) return false;

  // Wer selbst auf der hoechsten Stufe steht, ist sicher.
  return levelOf(findPlayer(state, holder)!, track) < MAX_TRACK_LEVEL;
}

/**
 * Darf dieser Ausbau geschehen? Der Reihe nach:
 *
 * 1. Der Spieler sitzt am Tisch.
 * 2. Das Regelwerk kennt den Ausbau - geprueft an `rules.barbarianTrack > 0`,
 *    demselben Merkmal, an dem die ganze Erweiterung haengt (10a: ein
 *    Merkmal und kein Name).
 * 3. Die naechste Stufe existiert.
 * 4. Mindestens eine eigene Stadt. Wer alle Staedte verliert, behaelt seine
 *    Stufen - er darf nur nicht weiterbauen. Deshalb haengt die Pruefung am
 *    Zug und nicht am Zustand.
 * 5. `claimsMetropolis` gegen die genannte Stadt: gefordert und fehlt, oder
 *    nicht gefordert und genannt.
 * 6. Ist eine Stadt genannt: eigene Stadt, ohne Aufsatz.
 * 7. Die Handelswaren reichen.
 */
export function canImproveCity(
  state: GameState,
  player: PlayerId,
  track: TrackId,
  metropolisAt?: VertexId,
): RuleViolation | null {
  const owner = findPlayer(state, player);
  if (owner === undefined) {
    return violation(RuleViolationCode.UNKNOWN_PLAYER, `${player} sitzt nicht an diesem Tisch`);
  }

  if (state.rules.barbarianTrack <= 0) {
    return violation(RuleViolationCode.WRONG_PHASE, 'An diesem Tisch gibt es keinen Stadtausbau');
  }

  const level = levelOf(owner, track);
  if (level >= MAX_TRACK_LEVEL) {
    return violation(
      RuleViolationCode.TRACK_MAX_LEVEL,
      `${stepWithArticle(track, MAX_TRACK_LEVEL)} steht schon - dieser Bereich ist auf der höchsten Stufe`,
    );
  }

  const hasCity = Object.values(state.buildings).some(
    (building) => building.owner === player && building.kind === 'city',
  );
  if (!hasCity) {
    return violation(RuleViolationCode.NEEDS_CITY, `${player} hat keine eigene Stadt`);
  }

  const claims = claimsMetropolis(state, player, track);
  if (claims && metropolisAt === undefined) {
    return violation(
      RuleViolationCode.METROPOLIS_REQUIRED,
      `${stepWithArticle(track, level + 1)} bringt den Aufsatz - dafür fehlt die Stadt`,
    );
  }
  if (!claims && metropolisAt !== undefined) {
    return violation(
      RuleViolationCode.METROPOLIS_NOT_WANTED,
      `${stepWithArticle(track, level + 1)} bringt keinen Aufsatz - die genannte Stadt gehört nicht dazu`,
    );
  }

  if (metropolisAt !== undefined) {
    const building = state.buildings[metropolisAt];
    if (
      building === undefined ||
      building.owner !== player ||
      building.kind !== 'city' ||
      building.metropolis !== null
    ) {
      return violation(
        RuleViolationCode.INVALID_METROPOLIS,
        `${metropolisAt} taugt nicht als Metropole`,
      );
    }
  }

  const price = priceWithCraneDiscount(state, track, improvementCost(track, level + 1));
  if (!canAfford(owner.resources, price)) {
    return violation(
      RuleViolationCode.INSUFFICIENT_RESOURCES,
      `${player} kann den Ausbau nicht bezahlen`,
    );
  }

  return null;
}

/**
 * Baut eine Stufe hoeher: Preis an die Bank, Stufe beim Spieler um eins
 * erhoeht, und wenn der Aufsatz kommt, in **einem** `buildings`-Durchlauf beim
 * Vorbesitzer entfernt und an der genannten Stadt gesetzt - damit kein
 * Zwischenzustand mit zwei Aufsaetzen desselben Bereichs entsteht.
 *
 * Bezahlt wird von Hand und nicht ueber `payFor` aus `build.ts`: der Ausbau
 * kostet Handelswaren und kein Bauteil, `canPayFor`/`payFor` verlangen aber
 * eine `PieceId`. Dasselbe Muster wie `applyBuildWall` in `walls.ts`, nur ohne
 * den `piecesLeft`-Teil.
 */
export function applyImproveCity(
  state: GameState,
  player: PlayerId,
  track: TrackId,
  metropolisAt?: VertexId,
): ReduceResult {
  const problem = canImproveCity(state, player, track, metropolisAt);
  if (problem !== null) return rejected(problem);

  const owner = findPlayer(state, player)!;
  const level = levelOf(owner, track);
  const price = priceWithCraneDiscount(state, track, improvementCost(track, level + 1));
  const claims = claimsMetropolis(state, player, track);

  const buildings = { ...state.buildings };
  if (claims) {
    const previous = findMetropolisVertex(state, track);
    if (previous !== null) {
      buildings[previous] = { ...buildings[previous]!, metropolis: null };
    }
    // `metropolisAt` ist an dieser Stelle gesetzt - `canImproveCity` hat es
    // geprueft.
    buildings[metropolisAt!] = { ...buildings[metropolisAt!]!, metropolis: track };
  }

  return ok({
    ...state,
    buildings,
    players: withPlayer(state, player, (p) => ({
      ...p,
      resources: subtractCards(p.resources, price),
      improvements: { ...p.improvements, [track]: level + 1 },
    })),
    bank: addCards(state.bank, price),
    // Der Kran gilt fuer genau ein Hochruecken - danach ist der Bereich weg.
    craneDiscount: state.craneDiscount.filter((entry) => entry !== track),
  });
}
