import { z } from 'zod';

import { RollSchema } from './dice.js';
import { PlayerIdSchema, type PlayerId } from './player.js';
import { TradeOfferSchema, TradeResponseSchema } from './tradeOffer.js';

/**
 * Der Zugablauf als expliziter Zustandsautomat.
 *
 * ```
 * opening ──► setup ──► rollPending ──► main ──► (naechster Spieler) rollPending
 * (Auftakt)                    │          ▲│       │
 *                              │ Wurf = 7 ││       └──► finished
 *                              ▼          │▼
 *                       discardPending  tradePending
 *                              │          (Angebot liegt, Zug steht still)
 *                              ▼
 *                       robberPending ──► main
 * ```
 *
 * Ohne diese Phasen muesste der Reducer bei jeder eingehenden Aktion neu
 * erraten, ob gerade abgeworfen, der Raeuber versetzt oder gebaut wird. Mit
 * ihnen ist eine Aktion zur falschen Zeit ein gewoehnlicher Regelverstoss mit
 * klarer Begruendung statt ein Sonderfall im Code.
 */

export const PhaseSchema = z.discriminatedUnion('kind', [
  /**
   * Der Auftakt: reihum wuerfelt jeder einmal, der Hoechste beginnt.
   *
   * `rolls` haelt **nur die laufende Runde**. Ein Stechen ersetzt sie, statt sie
   * zu ergaenzen - was vorher fiel, hat fuer die Entscheidung keine Bedeutung
   * mehr, und wer es nachlesen will, findet es im Verlauf. Zwei Runden
   * gleichzeitig im Zustand zu halten hiesse, an jeder Auswertung mitzudenken,
   * welche gilt.
   *
   * `pending` ist Warteschlange und zugleich die Antwort auf "wer ist dran" -
   * dieselbe Bauform wie bei `discardPending`, nur der Reihe nach statt
   * gleichzeitig.
   */
  z.object({
    kind: z.literal('opening'),
    /** Was in dieser Wurfrunde schon gefallen ist. */
    rolls: z.record(z.string(), RollSchema),
    /** Wer in dieser Wurfrunde noch werfen muss, in Sitzreihenfolge. */
    pending: z.array(PlayerIdSchema),
    /** 0 ist die erste Runde, ab 1 ist es ein Stechen. */
    round: z.number().int().min(0),
  }),
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
  /**
   * Der Spieler am Zug muss den Raeuber versetzen.
   *
   * `resume` ist der Rueckweg. Er steht hier und nicht als Feld daneben, weil
   * der Umweg mit der Phase beginnt und mit ihr verschwindet: nach einer Sieben
   * ist gewuerfelt und es geht in die Hauptphase, nach einem Ritter **vor** dem
   * Wurf schuldet der Spieler den Wurf noch. Ohne diesen Vermerk sprang
   * `applyMoveRobber` fest nach `main` - der Wurf fiel dann lautlos aus.
   */
  z.object({
    kind: z.literal('robberPending'),
    resume: z.enum(['main', 'rollPending']),
  }),
  /** Bauen, handeln, Zug beenden. */
  z.object({ kind: z.literal('main') }),
  /**
   * Ein Angebot liegt auf dem Tisch und blockiert den Zug.
   *
   * Als Phase und nicht als Feld daneben: dass waehrend eines Angebots nicht
   * gebaut wird, ist damit dieselbe Regel wie jede andere Phasensperre und
   * keine zweite Wahrheit neben `PHASE_ACTIONS`.
   */
  z.object({
    kind: z.literal('tradePending'),
    offer: TradeOfferSchema,
    /** Wer schon geantwortet hat. Wer fehlt, ueberlegt noch. */
    responses: z.record(z.string(), TradeResponseSchema),
    /** Unix-ms. Wann das Angebot von selbst verfaellt. */
    expiresAt: z.number().int().min(0),
  }),
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

/** Wer im Auftakt als Naechstes wirft - `null`, wenn die Runde vollstaendig ist. */
export function openingRoller(phase: Extract<Phase, { kind: 'opening' }>): PlayerId | null {
  return phase.pending[0] ?? null;
}
