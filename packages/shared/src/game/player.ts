import { z } from 'zod';

import { CardAmountsSchema, PieceCountsSchema } from '../rules/index.js';
import { ProgressCardIdSchema } from './cities/progress/cards.js';
import { TrackIdSchema } from './cities/tracks.js';
import { DevelopmentCardSchema } from './development.js';

/**
 * Ein Spieler aus Sicht der Spiellogik.
 *
 * `PlayerId` ist die `user_id` aus Regel 7 - auch Gaeste haben eine. Name,
 * Farbe und Verbindungsstatus gehoeren nicht hierher: die Logik rechnet mit
 * Identitaeten, nicht mit Anzeigeeigenschaften. Was am Bildschirm steht,
 * entscheidet Etappe 3.
 *
 * Was ein Spieler gebaut hat, steht nicht hier, sondern in der Belegung von
 * Knoten und Kanten im `GameState` - sonst gaebe es zwei Wahrheiten darueber,
 * wem eine Siedlung gehoert.
 */

export const PlayerIdSchema = z.string().min(1);

export type PlayerId = z.infer<typeof PlayerIdSchema>;

export const PlayerStateSchema = z.object({
  id: PlayerIdSchema,
  /** Die Handkarten. Ab Etappe 5 die geheime Haelfte. */
  resources: CardAmountsSchema,
  /**
   * Wie viele Teile noch im Vorrat liegen. Aufgebraucht heisst: nicht mehr
   * baubar.
   *
   * Ueber `PieceCountsSchema` und damit auffuellend: die Vorraete
   * gespeicherter Partien kennen drei Bauteile, seit Staedte & Ritter gibt es
   * sieben. Was fehlt, ist null - und null heisst hier zu Recht "gibt es an
   * diesem Tisch nicht".
   */
  piecesLeft: PieceCountsSchema,
  /** Entwicklungskarten auf der Hand. Geheim wie die Ressourcen. */
  developmentCards: z.array(DevelopmentCardSchema),
  /** Fortschrittskarten auf der Hand. Geheim - ausser den Siegpunktkarten. */
  progressCards: z.array(ProgressCardIdSchema).default([]),
  /**
   * Ausgespielte Ritter. **Oeffentlich** - sie liegen offen vor dem Spieler und
   * entscheiden die Groesste Rittermacht. Deshalb eine eigene Zahl und nicht
   * bloss ein Zaehlen der Handkarten.
   */
  playedKnights: z.number().int().min(0),
  /**
   * Siegpunkt-Chips "Retter Catans". **Oeffentlich** - sie liegen offen vor
   * dem Spieler, und wer sie nicht sieht, kann den Punktestand am Tisch nicht
   * nachrechnen.
   *
   * Mit Vorgabe wie jedes neue Feld: gespeichert wird nur der Startzustand,
   * und ein Pflichtfeld ohne Vorgabe liesse jede bestehende Partie am Schema
   * scheitern.
   */
  defenderPoints: z.number().int().min(0).default(0),
  /**
   * Erreichte Ausbaustufe je Bereich, 0 bis 5. **Oeffentlich.**
   *
   * **Das ist das einzige Stueck Etappe 10c, das schon hier steht**, und es
   * steht hier aus einem Grund: an der Festung (Politik, Stufe 3) haengt die
   * dritte Ritterstufe. Ohne das Feld muesste 10b sie fest verneinen und 10c
   * eine Verneinung wieder aufmachen - ein Zustand, in dem eine Regel
   * zwischendurch luegt.
   *
   * Teilweise und nicht vollstaendig: ein nicht begonnener Bereich braucht
   * keine Null, und was fehlt, ist null.
   */
  improvements: z.partialRecord(TrackIdSchema, z.number().int().min(0).max(5)).default({}),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;
