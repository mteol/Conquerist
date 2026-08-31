import type { Roll } from '../dice.js';
import type { GameState } from '../state.js';
import { advanceShip, applyBarbarianAttack, hasLanded } from './barbarians.js';
import { eventFaceOf, progressValueOf } from './event.js';
import { drawProgressCards } from './progress/draw.js';

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
 * Die drei Stadttore lassen jetzt ziehen: `drawProgressCards` prueft fuer
 * jede Person, ob die Augenzahl des roten Wuerfels hoechstens ihre Stufe + 1
 * im gewuerfelten Bereich ist, und zieht fuer alle, die bestehen (Regel 8.1).
 * Wer wegen des Handlimits abgeben muss, wird hier nicht gemeldet - das
 * bleibt `playersOverProgressLimit`, aus dem Zustand abgeleitet und nicht von
 * hier durchgereicht (Aufgabe 4).
 *
 * Der vierte Schritt aus Spec 5.4 - Aquaedukt: wer leer ausging, nimmt einen
 * Rohstoff - haengt **nicht** hier, sondern in `reducer.ts` an `rollDice`,
 * direkt nach `distributeYield`. `resolveEvent` bleibt unberuehrt: das
 * Aquaedukt haengt am Ertrag und nicht am Ereignis, und `grantAqueduct` wird
 * nicht auf dem Sieben-Pfad gerufen.
 */
export function resolveEvent(state: GameState, roll: Roll): GameState {
  const face = eventFaceOf(roll);

  /*
   * Kein Ereigniswuerfel im Wurf heisst: dieser Tisch spielt ohne Erweiterung.
   * Derselbe Zustand zurueck und nicht eine Kopie - so sieht der Aufrufer an
   * der Identitaet, dass nichts geschehen ist.
   */
  if (face === null) return state;

  if (face === 'ship') {
    /*
     * Erst fahren, dann pruefen: gelandet ist das Schiff genau in dem Wurf,
     * der es auf das letzte Feld bringt, und der Ueberfall gehoert in
     * denselben Wurf. `applyBarbarianAttack` setzt es danach auf Feld null
     * zurueck.
     */
    const sailed = advanceShip(state);
    return hasLanded(sailed) ? applyBarbarianAttack(sailed) : sailed;
  }

  /*
   * `face` ist hier 'trade' | 'politics' | 'science' - dieselbe Union wie
   * `TrackId`. Kein Uebersetzungstisch: die Seite des Ereigniswuerfels *ist*
   * der Bereich, nicht eine andere Bezeichnung dafuer.
   */
  const red = progressValueOf(roll);

  // Kein roter Wuerfel im Wurf: nichts zu vergleichen, derselbe Zustand zurueck.
  if (red === null) return state;

  return drawProgressCards(state, face, red);
}
