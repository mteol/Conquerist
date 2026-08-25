import type { GameState } from '../state.js';

/**
 * Das Heer der Barbaren.
 *
 * Das Schiff faehrt Feld um Feld auf Catan zu; jedes Schiff auf dem
 * Ereigniswuerfel rueckt es eines weiter. Auf dem letzten Feld landet es, und
 * dann entscheidet sich, ob die Ritter Catans stark genug waren.
 *
 * **In Etappe 10a landet es nicht.** Der Kampf braucht Ritter, und die kommen
 * in 10b. Ein Ueberfall ohne sie waere kein Spielereignis, sondern ein Abriss:
 * die Staerke der Verteidigung ist ohne Ritter immer null, also verloere alle
 * sieben Schiffswuerfe jeder Staedtebesitzer eine Stadt. Das Schiff haelt
 * deshalb ein Feld vor der Kueste an - eine Zeile, die in 10b faellt.
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

  /*
   * ETAPPE 10a: das Schiff haelt ein Feld vor der Kueste an.
   *
   * Diese Grenze faellt in 10b, sobald es Ritter gibt. Sie steht hier und
   * nicht als Auslassung beim Aufrufer, damit sie beim Aufraeumen an einer
   * Stelle zu finden ist - und damit die Fahrstrecke am Bildschirm schon jetzt
   * das Richtige zeigt, statt still zu bleiben.
   */
  const waitingLine = state.rules.barbarianTrack - 1;
  const position = Math.min(state.barbarians.position + 1, waitingLine);

  return { ...state, barbarians: { ...state.barbarians, position } };
}
