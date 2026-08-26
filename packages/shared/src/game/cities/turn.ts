import type { Roll } from '../dice.js';
import type { GameState } from '../state.js';
import { advanceShip, applyBarbarianAttack, hasLanded } from './barbarians.js';
import { eventFaceOf } from './event.js';

/**
 * Was ein Wurf ausloest, bevor die Ertraege fallen.
 *
 * Die Reihenfolge stammt aus der Anleitung und ist nicht beliebig: erst das
 * Ereignis, dann der Ertrag. Daran haengt, dass in der Runde des ersten
 * Ueberfalls eine gewuerfelte Sieben den Raeuber schon bewegen darf - der
 * Angriff kommt davor und gibt ihn frei. Und daran haengt, dass eine Stadt,
 * die die Barbaren gerade genommen haben, im selben Wurf nichts mehr
 * ausschuettet. Seit 10b gilt beides wirklich; in 10a stand es als Vorgriff da.
 *
 * Die drei Stadttore werden weiterhin gelesen und tun nichts - die
 * Fortschrittskarten kommen in 10d.
 */
export function resolveEvent(state: GameState, roll: Roll): GameState {
  const face = eventFaceOf(roll);

  /*
   * Kein Ereigniswuerfel im Wurf heisst: dieser Tisch spielt ohne Erweiterung.
   * Derselbe Zustand zurueck und nicht eine Kopie - so sieht der Aufrufer an
   * der Identitaet, dass nichts geschehen ist.
   */
  if (face === null) return state;

  if (face !== 'ship') return state;

  /*
   * Erst fahren, dann pruefen: gelandet ist das Schiff genau in dem Wurf, der
   * es auf das letzte Feld bringt, und der Ueberfall gehoert in denselben Wurf.
   * `applyBarbarianAttack` setzt es danach auf Feld null zurueck.
   */
  const sailed = advanceShip(state);
  return hasLanded(sailed) ? applyBarbarianAttack(sailed) : sailed;
}
