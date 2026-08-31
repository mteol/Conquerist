import type { VertexId } from '../../geometry/index.js';
import { boardOf } from '../board.js';
import type { PlayerId, PlayerState } from '../player.js';
import type { GameState } from '../state.js';
import { anyProgressCardsLeft } from './progress/draw.js';

/**
 * Das Heer der Barbaren.
 *
 * Das Schiff faehrt Feld um Feld auf Catan zu; jedes Schiff auf dem
 * Ereigniswuerfel rueckt es eines weiter. Auf dem letzten Feld landet es, und
 * dann entscheidet sich, ob die Ritter Catans stark genug waren.
 *
 * **Die Wartelinie aus 10a ist gefallen.** Dort hielt das Schiff ein Feld vor
 * der Kueste an, weil es noch keine Ritter gab: die Verteidigung waere immer
 * null gewesen, und alle sieben Schiffswuerfe haette jeder Staedtebesitzer
 * eine Stadt verloren. Seit 10b gibt es Ritter, und das Schiff faehrt durch.
 *
 * Der Ausgang wird in zwei Schritten behandelt: `barbarianOutcome` **rechnet**
 * ihn, `applyBarbarianAttack` **wendet ihn an**. Getrennt, weil die Oberflaeche
 * denselben Vergleich anzeigt (die Barbarenleiste) und weil ein Test einen
 * Ausgang pruefen kann, ohne einen halben Zug zu bauen.
 */

/**
 * Was `barbarianStrength` wirklich braucht: die Belegung des Bretts.
 *
 * Ein eigener Typ statt `GameState`, damit auch eine `PlayerView` die Staerke
 * ausrechnen kann - dieselbe Bauform und derselbe Grund wie bei `HarborSource`
 * in `trade.ts`. Es ist keine Regel, die damit zweimal ausgelegt wird; es ist
 * dieselbe Funktion.
 */
export interface BuildingSource {
  readonly buildings: GameState['buildings'];
}

/**
 * Die Staerke des Heeres: jede Stadt auf dem Brett, Metropolen mitgezaehlt.
 *
 * Gerechnet und nicht gespeichert - eine abgelegte Zahl liefe beim ersten
 * Ausbau zur Stadt auseinander. Dieselbe Haltung wie bei den Siegpunkten.
 */
export function barbarianStrength(source: BuildingSource): number {
  return Object.values(source.buildings).filter((building) => building.kind === 'city').length;
}

/**
 * Ob der Raeuber schon versetzt werden darf.
 *
 * An einem Tisch ohne Erweiterung immer - dort gibt es keine Barbaren, auf die
 * man warten koennte.
 */
export function robberIsFree(state: GameState): boolean {
  return state.barbarians === null || state.barbarians.attacks > 0;
}

/** Ob das Schiff auf dem letzten Feld steht und damit gelandet ist. */
export function hasLanded(state: GameState): boolean {
  return state.barbarians !== null && state.barbarians.position >= state.rules.barbarianTrack;
}

/**
 * Rueckt das Schiff ein Feld vor.
 *
 * An einem Tisch ohne Barbaren geschieht nichts, und zwar ohne Zweig beim
 * Aufrufer: `resolveEvent` soll fragen duerfen, was der Wuerfel zeigt, ohne
 * vorher zu pruefen, ob es diesen Wuerfel gibt.
 */
export function advanceShip(state: GameState): GameState {
  if (state.barbarians === null) return state;

  const position = Math.min(state.barbarians.position + 1, state.rules.barbarianTrack);

  return { ...state, barbarians: { ...state.barbarians, position } };
}

/**
 * Wie viel jeder Spieler zur Verteidigung beigetragen hat.
 *
 * Jeder Spieler steht darin, auch mit null - die Auswertung fragt nach dem
 * **niedrigsten** Beitrag unter den Betroffenen, und wer fehlte, waere kein
 * Niedrigster, sondern gar keiner.
 */
export function defenseContributions(state: GameState): ReadonlyMap<PlayerId, number> {
  const shares = new Map<PlayerId, number>(state.players.map((player) => [player.id, 0]));

  for (const knight of Object.values(state.knights)) {
    if (!knight.active) continue;
    shares.set(knight.owner, (shares.get(knight.owner) ?? 0) + knight.level);
  }

  return shares;
}

/**
 * Der Ertragswert eines Siedlungsplatzes: die Summe der Augenwahrscheinlichkeit
 * seiner Zahlenchips, `6 - |7 - n|`.
 *
 * Gebraucht wird er fuer die Frage, **welche** Stadt die Barbaren nehmen. Die
 * Anleitung laesst dem Spieler die Wahl; hier trifft sie eine feste Regel, und
 * zwar dieselbe Wahl, die ein Mensch traefe - man gibt die Stadt her, die am
 * wenigsten liefert. Eine Regel statt einer Phase, weil diese Phase mitten im
 * Wurf laege: der Ueberfall wird vor den Ertraegen abgehandelt, also muesste
 * die angehaltene Ertragsphase samt Wurfsumme mitgefuehrt und danach
 * fortgesetzt werden - der Umbau des Wurfs fuer einen Fall, der je Partie
 * hoechstens zweimal eintritt.
 *
 * Wueste und Felder ohne Zahl zaehlen null.
 */
export function cityValueAt(state: GameState, vertex: VertexId): number {
  const board = boardOf(state.scenario);
  let value = 0;

  for (const hex of board.topology.vertexHexes.get(vertex) ?? []) {
    const chip = board.hexes.get(hex)?.chip;
    if (chip === undefined) continue;
    value += 6 - Math.abs(7 - chip);
  }

  return value;
}

/** Der Ausgang eines Ueberfalls, gerechnet ohne ihn anzuwenden. */
export interface BarbarianOutcome {
  readonly barbarians: number;
  readonly defenders: number;
  readonly won: boolean;
  /** Wer den Retter-Chip bekommt. `null` bei Gleichstand oder Niederlage. */
  readonly savior: PlayerId | null;
  /**
   * Die gleichauf Hoechstbeitragenden bei einem Sieg: jeder von ihnen zieht
   * eine Fortschrittskarte seiner Wahl (Regel 8.2).
   *
   * Leer, wenn es einen alleinigen Retter gab, wenn niemand etwas beigetragen
   * hat oder wenn die Barbaren gewonnen haben. Chip **oder** Karten - beides
   * gibt es nie zugleich.
   */
  readonly tiedLeaders: readonly PlayerId[];
  /** Wessen Stadt faellt, und welche. Leer, wenn die Ritter gewonnen haben. */
  readonly losses: readonly { readonly player: PlayerId; readonly vertex: VertexId }[];
}

/** Welche Stadt dieser Spieler hergibt - ohne Mauer zuerst, dann die aermste. */
function cityToLose(state: GameState, player: PlayerId): VertexId | null {
  const cities = Object.entries(state.buildings)
    .filter(
      ([, building]) =>
        building.owner === player &&
        building.kind === 'city' &&
        building.metropolis === null /* Metropolen sind geschuetzt - sie zaehlen zwar
           zur Staerke der Barbaren (unsichtbar sind sie nicht), koennen aber nicht
           genommen werden. Wer nur Metropolen hat, faellt als Kandidat aus und wird
           dann nicht getroffen, genau wie der Spieler ohne Stadt. */,
    )
    .map(([vertex, building]) => ({ vertex, wall: building.wall }));

  if (cities.length === 0) return null;

  const unwalled = cities.filter((entry) => !entry.wall);
  const candidates = unwalled.length > 0 ? unwalled : cities;

  return candidates.reduce((worst, entry) => {
    const value = cityValueAt(state, entry.vertex);
    const best = cityValueAt(state, worst.vertex);
    if (value !== best) return value < best ? entry : worst;
    // Gleicher Ertragswert: die kleinere Knoten-Id, damit dieselbe Partie
    // zweimal gleich ausgeht.
    return entry.vertex < worst.vertex ? entry : worst;
  }).vertex;
}

/**
 * Dieselben Spieler, im Uhrzeigersinn ab dem Spieler am Zug.
 *
 * Die Beitragstabelle steht in Sitzreihenfolge; wer bei Gleichstand zuerst
 * seinen Stapel waehlt, entscheidet aber der Zug - dieselbe Reihenfolge, in
 * der auch am Stadttor gezogen wird. Sie zaehlt wirklich: die Stapel sind
 * endlich, und die oberste Karte gibt es nur einmal.
 */
function inTurnOrder(state: GameState, players: readonly PlayerId[]): PlayerId[] {
  const seats = state.players.map((player) => player.id);
  const rank = (id: PlayerId): number =>
    (seats.indexOf(id) - state.currentPlayerIndex + seats.length) % seats.length;

  return [...players].sort((left, right) => rank(left) - rank(right));
}

/**
 * Rechnet den Ausgang des Ueberfalls.
 *
 * **Gleichstand gewinnt die Verteidigung** - so steht es in der Anleitung, und
 * es ist der Grund, warum die letzte Ritterstufe sich lohnt.
 */
export function barbarianOutcome(state: GameState): BarbarianOutcome {
  const barbarians = barbarianStrength(state);
  const shares = defenseContributions(state);
  const defenders = [...shares.values()].reduce((sum, share) => sum + share, 0);

  if (defenders >= barbarians) {
    const best = Math.max(...shares.values());
    const leaders = [...shares.entries()]
      .filter(([, share]) => share === best)
      .map(([player]) => player);

    /*
     * Der Chip geht nur an einen **alleinigen** Hoechstbeitragenden, und nur
     * wenn ueberhaupt jemand etwas beigetragen hat. Bei Gleichstand zieht
     * stattdessen jeder Beteiligte eine Fortschrittskarte seiner Wahl - seit
     * 10d gibt es die Stapel, und `defenderPending` haelt den Wurf fuer die
     * Wahl an.
     */
    const savior = best > 0 && leaders.length === 1 ? leaders[0]! : null;
    const tiedLeaders = best > 0 && leaders.length > 1 ? inTurnOrder(state, leaders) : [];

    return { barbarians, defenders, won: true, savior, tiedLeaders, losses: [] };
  }

  // Betroffen ist nur, wer eine Stadt hat - wer bloss Siedlungen haelt, hat
  // den Barbaren nichts zu nehmen.
  const affected = state.players
    .map((player) => ({ id: player.id, city: cityToLose(state, player.id) }))
    .filter((entry): entry is { id: PlayerId; city: VertexId } => entry.city !== null);

  if (affected.length === 0) {
    return { barbarians, defenders, won: false, savior: null, tiedLeaders: [], losses: [] };
  }

  const lowest = Math.min(...affected.map((entry) => shares.get(entry.id) ?? 0));

  return {
    barbarians,
    defenders,
    won: false,
    savior: null,
    tiedLeaders: [],
    losses: affected
      .filter((entry) => (shares.get(entry.id) ?? 0) === lowest)
      .map((entry) => ({ player: entry.id, vertex: entry.city })),
  };
}

/** Nimmt einem Spieler eine Stadt und gibt die Bauteile zurueck. */
function demote(player: PlayerState, wall: boolean): PlayerState {
  /*
   * Der Siedlungsvorrat kann leer sein: wer alle fuenf verbaut hat, bekommt
   * keine sechste. Die zurueckgestufte Stadt steht trotzdem als Siedlung da -
   * die Regel sagt, er muesse sie erst wieder ausbauen, ehe er anderswo eine
   * Stadt baut, und genau das faellt aus einem Vorrat von null von selbst.
   */
  const settlement = Math.max(0, player.piecesLeft.settlement - 1);

  return {
    ...player,
    piecesLeft: {
      ...player.piecesLeft,
      city: player.piecesLeft.city + 1,
      settlement,
      wall: player.piecesLeft.wall + (wall ? 1 : 0),
    },
  };
}

/**
 * Wendet den Ueberfall an: Chip oder Staedteverluste, dann alle Ritter passiv
 * und das Schiff zurueck auf den Anfang.
 *
 * Kein `ReduceResult` - das ist kein Zug, den jemand macht, sondern eine
 * Folge des Wuerfelns. Abgelehnt werden kann hier nichts.
 */
export function applyBarbarianAttack(state: GameState): GameState {
  const outcome = barbarianOutcome(state);

  const lostBy = new Map(outcome.losses.map((loss) => [loss.player, loss.vertex]));

  const buildings = { ...state.buildings };
  for (const loss of outcome.losses) {
    const building = buildings[loss.vertex]!;
    // Die Mauer geht mit der Stadt - sie gehoerte diesem Bauwerk.
    // metropolis: null faellt hier keine Regel - eine Siedlung kann keinen
    // Aufsatz tragen, deshalb null. Die eigentliche Regel steht anderswo:
    // Metropolen sind vor den Barbaren geschuetzt (Regelwerk Abschnitt 8.2).
    // Aufgabe 5 nimmt Metropolenstaedte in cityToLose aus den Kandidaten -
    // danach erreicht dieser Zweig eine Metropolenstadt gar nicht mehr.
    buildings[loss.vertex] = {
      owner: building.owner,
      kind: 'settlement',
      wall: false,
      metropolis: null,
    };
  }

  const players = state.players.map((player) => {
    if (player.id === outcome.savior) {
      return { ...player, defenderPoints: player.defenderPoints + 1 };
    }

    const vertex = lostBy.get(player.id);
    if (vertex === undefined) return player;

    return demote(player, state.buildings[vertex]?.wall === true);
  });

  // Alle aktivierten Ritter aller Spieler werden passiv - der Kampf hat sie
  // verbraucht, unabhaengig vom Ausgang.
  const knights = Object.fromEntries(
    Object.entries(state.knights).map(([vertex, knight]) => [
      vertex,
      { ...knight, active: false, activatedOnTurn: null },
    ]),
  );

  return {
    ...state,
    buildings,
    players,
    knights,
    barbarians:
      state.barbarians === null ? null : { position: 0, attacks: state.barbarians.attacks + 1 },
    /*
     * Bei Gleichstand an der Spitze haelt der Wurf hier an: jeder Beteiligte
     * waehlt seinen Stapel. Die Phase steht in diesem Zweig und nicht beim
     * Aufrufer, weil nur hier bekannt ist, dass es einen Gleichstand gab -
     * `continueAfterDefender` nimmt den Wurf danach wieder auf.
     *
     * Sind alle drei Stapel leer, gibt es nichts zu waehlen, und die Phase
     * oeffnet gar nicht erst.
     */
    phase:
      outcome.tiedLeaders.length > 0 && anyProgressCardsLeft(state)
        ? { kind: 'defenderPending', pending: [...outcome.tiedLeaders] }
        : state.phase,
  };
}
