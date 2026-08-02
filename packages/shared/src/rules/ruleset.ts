import { z } from 'zod';

import { DevelopmentDeckSchema } from '../game/development.js';
import { ResourceIdSchema } from '../scenario/terrain.js';

/**
 * Das Regelwerk: Baukosten, Siegpunktziel, Vorraete, Handkartenlimit.
 *
 * Nur Werte, keine Logik - die kommt mit dem Reducer in Etappe 2. Der Sinn
 * dieser Datei ist, dass dort keine Zahl im Code steht: eine Variante mit
 * Siegpunktziel 12 oder billigeren Staedten ist dann ein zweites RuleSet und
 * kein zweiter Codepfad (Regel 5).
 *
 * Abgrenzung zum Szenario: Gelaendeanzahlen und Chipverteilung beschreiben das
 * *Brett* und stehen im Blueprint. Was etwas kostet und wann das Spiel endet,
 * steht hier.
 */

/** Was sich bauen oder kaufen laesst. */
export const BUILDABLE_IDS = ['road', 'settlement', 'city', 'developmentCard'] as const;

export type BuildableId = (typeof BUILDABLE_IDS)[number];

export const BuildableIdSchema = z.enum(BUILDABLE_IDS);

/** Wovon jeder Spieler einen begrenzten Vorrat hat. Entwicklungskarten gehoeren der Bank. */
export const PIECE_IDS = ['road', 'settlement', 'city'] as const;

export type PieceId = (typeof PIECE_IDS)[number];

export const PieceIdSchema = z.enum(PIECE_IDS);

/**
 * Ressourcenmengen als vollstaendiger `Record<ResourceId, number>`.
 *
 * Vollstaendig und nicht teilweise: der Reducer soll ab Etappe 2 rechnen
 * duerfen, ohne bei jedem Zugriff `?? 0` zu schreiben. Eine fehlende Ressource
 * ist ein Fehler in den Daten und soll hier auffallen, nicht dort.
 */
export const ResourceAmountsSchema = z.record(ResourceIdSchema, z.number().int().min(0));

export type ResourceAmounts = z.infer<typeof ResourceAmountsSchema>;

export const RuleSetSchema = z.object({
  /** Stabiler Bezeichner, etwa `"classic"`. */
  id: z.string().min(1),
  /** Was jedes Bauteil kostet. */
  buildCosts: z.record(BuildableIdSchema, ResourceAmountsSchema),
  /** Wie viele Teile jeder Spieler insgesamt bauen kann. */
  pieceStock: z.record(PieceIdSchema, z.number().int().min(1)),
  /** Wie viele Karten je Ressource die Bank vorhaelt. */
  resourceBank: ResourceAmountsSchema,
  /** Siegpunkte, die das Spiel beenden. */
  victoryPointGoal: z.number().int().min(2),
  /**
   * Was welches Bauwerk zaehlt, und was die Laengste Handelsstrasse bringt.
   *
   * Steht hier und nicht im Wertungscode: eine Variante mit dreifach zaehlenden
   * Staedten ist damit ein zweites RuleSet und kein zweiter Codepfad (Regel 5).
   */
  victoryPoints: z.object({
    settlement: z.number().int().min(0),
    city: z.number().int().min(0),
    longestRoad: z.number().int().min(0),
    largestArmy: z.number().int().min(0),
    /** Was eine Siegpunktkarte auf der Hand zaehlt. */
    developmentCard: z.number().int().min(0),
  }),
  /** Ab wie vielen zusammenhaengenden Strassen die Laengste Handelsstrasse vergeben wird. */
  longestRoadMinimum: z.number().int().min(1),
  /** Ab wie vielen ausgespielten Rittern die Groesste Rittermacht vergeben wird. */
  largestArmyMinimum: z.number().int().min(1),
  /** Wie viele Entwicklungskarten je Art im Stapel liegen. */
  developmentDeck: DevelopmentDeckSchema,
  /** Ab wie vielen Handkarten bei einer Sieben abgeworfen wird. */
  handLimitBeforeDiscard: z.number().int().min(1),
});

export type RuleSet = z.infer<typeof RuleSetSchema>;

/** Das Regelwerk des Basisspiels. */
export const CLASSIC_RULES: RuleSet = {
  id: 'classic',

  buildCosts: {
    road: { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 },
    settlement: { brick: 1, lumber: 1, wool: 1, grain: 1, ore: 0 },
    city: { brick: 0, lumber: 0, wool: 0, grain: 2, ore: 3 },
    developmentCard: { brick: 0, lumber: 0, wool: 1, grain: 1, ore: 1 },
  },

  pieceStock: {
    road: 15,
    settlement: 5,
    city: 4,
  },

  resourceBank: { brick: 19, lumber: 19, wool: 19, grain: 19, ore: 19 },

  victoryPointGoal: 10,
  victoryPoints: {
    settlement: 1,
    city: 2,
    longestRoad: 2,
    largestArmy: 2,
    developmentCard: 1,
  },
  longestRoadMinimum: 5,
  largestArmyMinimum: 3,

  /*
   * 25 Karten wie in der Schachtel. Die Ritter sind mit Abstand die haeufigsten
   * - sie sind der Grund, warum sich der Kauf ueberhaupt lohnt, und die einzige
   * Antwort auf einen Raeuber, der auf dem eigenen Erz sitzt.
   */
  developmentDeck: {
    knight: 14,
    victoryPoint: 5,
    roadBuilding: 2,
    yearOfPlenty: 2,
    monopoly: 2,
  },
  handLimitBeforeDiscard: 7,
};
