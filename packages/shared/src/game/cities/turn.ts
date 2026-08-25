import type { Roll } from '../dice.js';
import type { GameState } from '../state.js';
import { advanceShip } from './barbarians.js';
import { eventFaceOf } from './event.js';

/**
 * Was ein Wurf ausloest, bevor die Ertraege fallen.
 *
 * Die Reihenfolge stammt aus der Anleitung und ist nicht beliebig: erst das
 * Ereignis, dann der Ertrag. Daran haengt ab 10b, dass in der Runde des ersten
 * Ueberfalls eine gewuerfelte Sieben den Raeuber schon bewegen darf - der
 * Angriff kommt davor. Und daran haengt, dass eine Stadt, die die Barbaren
 * gerade genommen haben, im selben Wurf nichts mehr ausschuettet.
 *
 * In dieser Etappe hat nur die Schiffsseite eine Wirkung. Die drei Stadttore
 * werden gelesen und tun nichts - die Fortschrittskarten kommen in 10d.
 */
export function resolveEvent(state: GameState, roll: Roll): GameState {
  const face = eventFaceOf(roll);

  /*
   * Kein Ereigniswuerfel im Wurf heisst: dieser Tisch spielt ohne Erweiterung.
   * Derselbe Zustand zurueck und nicht eine Kopie - so sieht der Aufrufer an
   * der Identitaet, dass nichts geschehen ist.
   */
  if (face === null) return state;

  return face === 'ship' ? advanceShip(state) : state;
}
