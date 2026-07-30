import { z } from 'zod';

import { PlayerIdSchema } from './player.js';

/**
 * Der Zugablauf als expliziter Zustandsautomat.
 *
 * ```
 * setup ──► rollPending ──► main ──► (naechster Spieler) rollPending
 *              │                       │
 *              │ Wurf = 7              └──► finished
 *              ▼
 *         discardPending ──► robberPending ──► main
 * ```
 *
 * Ohne diese Phasen muesste der Reducer bei jeder eingehenden Aktion neu
 * erraten, ob gerade abgeworfen, der Raeuber versetzt oder gebaut wird. Mit
 * ihnen ist eine Aktion zur falschen Zeit ein gewoehnlicher Regelverstoss mit
 * klarer Begruendung statt ein Sonderfall im Code.
 */

export const PhaseSchema = z.discriminatedUnion('kind', [
  /**
   * Gruendungsphase. `placement` zaehlt die Setzungen durch (siehe
   * `setupPlayerIndex`); `settlement` haelt die gerade gesetzte Siedlung fest,
   * solange die zugehoerige Strasse fehlt.
   *
   * Die Siedlung dort zu merken statt nur ein Ja/Nein zu fuehren, hat einen
   * Grund: die Gruendungsstrasse muss an *dieser* Siedlung anschliessen, nicht
   * irgendwo am eigenen Netz. Ohne den Anker waere die Regel nicht pruefbar.
   */
  z.object({
    kind: z.literal('setup'),
    placement: z.number().int().min(0),
    settlement: z.string().nullable(),
  }),
  /** Der Spieler am Zug muss wuerfeln, bevor er irgendetwas anderes tun darf. */
  z.object({ kind: z.literal('rollPending') }),
  /**
   * Nach einer Sieben: `pending` haelt fest, wer noch abwerfen muss. Erst wenn
   * die Liste leer ist, geht es weiter. Genau hier wartet Etappe 5 spaeter auf
   * mehrere Spieler gleichzeitig.
   */
  z.object({ kind: z.literal('discardPending'), pending: z.array(PlayerIdSchema) }),
  /** Der Spieler am Zug muss den Raeuber versetzen. */
  z.object({ kind: z.literal('robberPending') }),
  /** Bauen, handeln, Zug beenden. */
  z.object({ kind: z.literal('main') }),
  /** Das Spiel ist vorbei und nimmt keine Aktion mehr an. */
  z.object({ kind: z.literal('finished'), winner: PlayerIdSchema }),
]);

export type Phase = z.infer<typeof PhaseSchema>;

/** Wie viele Setzungen die Gruendungsphase umfasst: zwei je Spieler. */
export function setupPlacementCount(playerCount: number): number {
  return playerCount * 2;
}

/**
 * Welcher Spieler die `placement`-te Setzung macht.
 *
 * Schlangenreihenfolge: erste Runde vorwaerts, zweite rueckwaerts. Der letzte
 * Spieler setzt damit zweimal hintereinander - das ist der Ausgleich dafuer,
 * dass er bei der ersten Siedlung die schlechteste Wahl hatte.
 */
export function setupPlayerIndex(placement: number, playerCount: number): number {
  const total = setupPlacementCount(playerCount);
  if (!Number.isInteger(placement) || placement < 0 || placement >= total) {
    throw new RangeError(
      `setupPlayerIndex: Setzung ${placement} liegt ausserhalb der Gruendungsphase (0 bis ${total - 1})`,
    );
  }

  return placement < playerCount ? placement : total - 1 - placement;
}
