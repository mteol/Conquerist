import { z } from 'zod';

import { DevelopmentDeckSchema } from '../game/development.js';
import { CLASSIC_56 } from '../scenario/blueprints/classic56.js';
import { CARD_IDS, CardIdSchema, type CardId } from '../scenario/terrain.js';
import { CLASSIC_DICE, DiceSpecSchema } from './dice.js';

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
 * Eine vollstaendige Kartenmenge aus dem, was genannt ist - alles andere null.
 *
 * Der eine Ort, an dem eine Menge vervollstaendigt wird. Das Schema unten
 * benutzt ihn zum Einlesen, die Regelwerke zum Hinschreiben: acht Nullen je
 * Baukostenzeile waeren sechs Zeilen, die nichts aussagen, und die erste
 * vergessene faellt erst zur Laufzeit auf.
 */
export function cardAmounts(part: Partial<Record<CardId, number>>): Record<CardId, number> {
  const full = {} as Record<CardId, number>;
  for (const card of CARD_IDS) full[card] = part[card] ?? 0;
  return full;
}

/**
 * Kartenmengen als vollstaendiger `Record<CardId, number>`.
 *
 * Vollstaendig und nicht teilweise: der Reducer soll rechnen duerfen, ohne bei
 * jedem Zugriff `?? 0` zu schreiben. Eine fehlende Sorte ist ein Fehler in den
 * Daten und soll hier auffallen, nicht dort.
 *
 * **Der Schluessel ist `CardId` und nicht `ResourceId`.** Handelswaren liegen
 * auf derselben Hand wie Rohstoffe, werden gestohlen, abgeworfen und
 * gehandelt wie sie - ein zweiter Mengensatz daneben muesste jede
 * Handoperation doppelt fuehren und waere damit eine zweite Wahrheit ueber
 * dieselbe Hand. Was sich wirklich unterscheidet (was ein Bauwerk kostet, was
 * ein Hafen hergibt, was das Aquaedukt gibt), steht weiterhin als `ResourceId`
 * da und ist damit compilergeschuetzt.
 *
 * **`partialRecord` plus `transform` ist kein Zierat, sondern die Rettung der
 * gespeicherten Partien.** Seit Etappe 6 liegt der Startzustand jeder Partie
 * als JSON in der Datenbank, und die dort abgelegten Mengensaetze haben fuenf
 * Schluessel, weil es damals fuenf Sorten gab.
 *
 * Ein `z.record` mit Enum-Schluessel ist in Zod 4 **erschoepfend**: es verlangt
 * jede Sorte. Die drei neuen fehlen in jeder abgelegten Partie, und ohne
 * `partialRecord` schluege deshalb nicht etwa eine Rechnung fehl - es schluege
 * das Einlesen fehl, und beim naechsten Serverstart waere jede laufende Partie
 * weg. Gemessen beim Umbau: sechs Testfehler, alle mit
 * `"expected number, received undefined"`.
 *
 * Eingelesen wird also, was dasteht; ergaenzt wird der Rest mit null. Dieselbe
 * Auffuellung traegt jede spaetere Sorte.
 */
export const ResourceAmountsSchema = z
  .partialRecord(CardIdSchema, z.number().int().min(0))
  .transform((amounts): Record<CardId, number> => cardAmounts(amounts));

/**
 * Ausdruecklich geschrieben und nicht aus dem Schema abgeleitet: `z.infer`
 * eines Schemas mit `transform` liefert den **Ausgangs**typ, und der ist hier
 * schon der vollstaendige Record - aber die Ableitung waere von der genauen
 * Rueckgabe des `transform` abhaengig und damit stiller als noetig.
 */
export type ResourceAmounts = Record<CardId, number>;

/**
 * Zwischen welchen Siegpunktzielen der Wartebereich waehlen laesst.
 *
 * Das RuleSet selbst laesst ab 2 alles zu - es beschreibt, was das Regelwerk
 * darstellen kann, nicht was ein Tisch sinnvoll einstellt. Diese beiden Zahlen
 * sind die Grenzen fuer die **Bedienung**: unter fuenf entscheidet die
 * Gruendung fast allein, ueber zwanzig reicht das Baumaterial nicht mehr fuer
 * ein Ende. Sie stehen hier und nicht im Wartebereich, weil der Server dieselbe
 * Grenze noch einmal prueft und beide Seiten dieselbe Zahl brauchen.
 */
export const MIN_VICTORY_POINT_GOAL = 5;
export const MAX_VICTORY_POINT_GOAL = 20;
export const DEFAULT_VICTORY_POINT_GOAL = 10;

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

  /**
   * Wie lange ein Angebot an die Mitspieler auf dem Tisch liegt, in
   * Millisekunden.
   *
   * Mit Vorgabe, aus genau dem Grund, den der Block darunter fuer `dice` und
   * `robberRoll` nennt: das RuleSet jeder laufenden Partie liegt seit Etappe 6
   * als JSON in der Datenbank, und ein Pflichtfeld ohne Vorgabe faende dort
   * kein Gegenstueck.
   */
  tradeOfferMs: z.number().int().min(1_000).default(60_000),

  /*
   * Die beiden Wuerfelfelder tragen einen Vorgabewert, und der ist keine
   * Bequemlichkeit: seit Etappe 6 liegt der Startzustand einer Partie samt
   * RuleSet als JSON in der Datenbank. Ohne Vorgabe faenden die Felder in einer
   * dort abgelegten Partie kein Gegenstueck, `GameStateSchema.safeParse`
   * schluege fehl, und jede laufende Partie waere beim naechsten Serverstart
   * weg. Neue Regelwerke schreiben beides aus - siehe `CLASSIC_RULES`.
   */

  /** Womit gewuerfelt wird. Siehe `dice.ts`. */
  dice: DiceSpecSchema.default(CLASSIC_DICE),
  /**
   * Welche Wurfsumme den Raeuber ruft statt Ertrag zu bringen.
   *
   * Steht hier, weil die Sieben nur bei zwei Sechsseitigen die Mitte der
   * Verteilung ist. Wer die Wuerfelschale aendert, muss diese Zahl mitaendern -
   * beide zusammen an einer Stelle statt die eine im Code.
   */
  robberRoll: z.number().int().min(2).default(7),
});

export type RuleSet = z.infer<typeof RuleSetSchema>;

/** Das Regelwerk des Basisspiels. */
export const CLASSIC_RULES: RuleSet = {
  id: 'classic',

  buildCosts: {
    road: cardAmounts({ brick: 1, lumber: 1 }),
    settlement: cardAmounts({ brick: 1, lumber: 1, wool: 1, grain: 1 }),
    city: cardAmounts({ grain: 2, ore: 3 }),
    developmentCard: cardAmounts({ wool: 1, grain: 1, ore: 1 }),
  },

  pieceStock: {
    road: 15,
    settlement: 5,
    city: 4,
  },

  /*
   * Die drei Handelswaren stehen mit null da, und das ist die Aussage: an
   * einem Basistisch gibt es sie nicht. Eine fehlende Sorte saehe aus wie ein
   * Versehen, eine Null sagt, dass jemand hingesehen hat.
   */
  resourceBank: cardAmounts({ brick: 19, lumber: 19, wool: 19, grain: 19, ore: 19 }),

  victoryPointGoal: DEFAULT_VICTORY_POINT_GOAL,
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
  tradeOfferMs: 60_000,

  dice: CLASSIC_DICE,
  robberRoll: 7,
};

/**
 * Das Regelwerk fuer fuenf und sechs Spieler.
 *
 * Die Erweiterung ruehrt am Spiel genau zwei Zahlenreihen an: mehr Rohstoffe in
 * der Bank und ein groesserer Entwicklungsstapel. Sie muss es auch - an einem
 * Tisch mit sechs Haenden ist der Vorrat der Viererpartie vor der Halbzeit leer,
 * und vierzehn Ritter sind fuer sechs Heere zu wenig.
 *
 * Als Spread ueber `CLASSIC_RULES` und nicht als zweite volle Tabelle: was hier
 * nicht ausdruecklich steht, soll auch nicht abweichen. Baukosten, Teilevorrat,
 * Handkartenlimit und Wuerfel sind am grossen Tisch dieselben, und ein Test
 * bewacht genau diese Gleichheit.
 */
export const CLASSIC_RULES_56: RuleSet = {
  ...CLASSIC_RULES,

  resourceBank: cardAmounts({ brick: 24, lumber: 24, wool: 24, grain: 24, ore: 24 }),

  developmentDeck: {
    knight: 20,
    victoryPoint: 5,
    roadBuilding: 3,
    yearOfPlenty: 3,
    monopoly: 3,
  },
};

/**
 * Welches Regelwerk eine Tischgroesse traegt.
 *
 * Das Gegenstueck zu `blueprintFor`, das dieselbe Frage fuers Brett
 * beantwortet - und aus demselben Grund eine Funktion und keine Zahl am
 * Aufrufort: es gibt zwei Stellen, die eine Partie starten (der Raum auf dem
 * Server und der Hotseat im Client), und zwei Ableitungen liefen frueher oder
 * spaeter auseinander.
 *
 * Die Grenze steht nicht als `5` im Code, sondern kommt aus dem Blueprint, der
 * sie ohnehin fuers Brett nennt. Damit gibt es sie einmal.
 */
export function rulesFor(seatCount: number): RuleSet {
  return seatCount >= CLASSIC_56.minPlayers ? CLASSIC_RULES_56 : CLASSIC_RULES;
}
