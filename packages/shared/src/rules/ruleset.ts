import { z } from 'zod';

import { ProgressCardIdSchema } from '../game/cities/progress/cards.js';
import { DevelopmentDeckSchema } from '../game/development.js';
import { CLASSIC_56 } from '../scenario/blueprints/classic56.js';
import { CARD_IDS, CardIdSchema, RESOURCE_IDS, type CardId } from '../scenario/terrain.js';
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

/**
 * Was sich bauen oder kaufen laesst.
 *
 * Die hinteren vier gehoeren zu Staedte & Ritter. Sie stehen in derselben
 * Liste und nicht in einer zweiten daneben: was ein Tisch davon kennt, sagt
 * sein `buildCosts` - was dort fehlt, gibt es an diesem Tisch nicht. Eine
 * zweite Liste waere eine zweite Antwort auf dieselbe Frage.
 *
 * `knightUpgrade` und `knightActivation` sind Buildables ohne Bauteil: sie
 * kosten etwas, aber sie stellen nichts Neues aufs Brett. Genau deshalb sind
 * `BUILDABLE_IDS` und `PIECE_IDS` zwei Listen und nicht eine.
 */
export const BUILDABLE_IDS = [
  'road',
  'settlement',
  'city',
  'developmentCard',
  'wall',
  'knight',
  'knightUpgrade',
  'knightActivation',
] as const;

export type BuildableId = (typeof BUILDABLE_IDS)[number];

export const BuildableIdSchema = z.enum(BUILDABLE_IDS);

/**
 * Wovon jeder Spieler einen begrenzten Vorrat hat. Entwicklungskarten gehoeren
 * der Bank.
 *
 * **Je Ritterstufe ein eigener Vorrat**, und das ist keine Umstaendlichkeit:
 * die Regel begrenzt auf zwei Ritter **je Stufe**, nicht auf sechs insgesamt.
 * Ein einziger Zaehler `knight: 6` koennte nicht ausdruecken, dass jemand mit
 * zwei Starken Rittern keinen dritten aufwerten darf. Und das Aufwerten
 * verbraucht nichts, es **verschiebt**: `knight1` zurueck, `knight2` heraus.
 */
export const PIECE_IDS = [
  'road',
  'settlement',
  'city',
  'wall',
  'knight1',
  'knight2',
  'knight3',
] as const;

export type PieceId = (typeof PIECE_IDS)[number];

export const PieceIdSchema = z.enum(PIECE_IDS);

/**
 * Ein vollstaendiger Teilevorrat aus dem, was genannt ist - alles andere null.
 *
 * Das Gegenstueck zu `cardAmounts`, mit demselben Grund: vier Nullen je
 * Vorratszeile waeren vier Zeilen, die nichts aussagen, und die erste
 * vergessene faellt erst zur Laufzeit auf.
 */
export function pieceCounts(part: Partial<Record<PieceId, number>>): Record<PieceId, number> {
  const full = {} as Record<PieceId, number>;
  for (const piece of PIECE_IDS) full[piece] = part[piece] ?? 0;
  return full;
}

/**
 * Teilevorraete als vollstaendiger `Record<PieceId, number>`.
 *
 * `partialRecord` plus `transform` aus genau demselben Grund wie bei
 * `CardAmountsSchema`, und diesmal war der Grund vorher da: seit Etappe 6 liegt
 * der Startzustand jeder Partie als JSON in der Datenbank, und jeder dort
 * abgelegte Vorrat kennt drei Bauteile. Ein `z.record` mit Enum-Schluessel ist
 * in Zod 4 **erschoepfend** - die vier neuen fehlen ueberall, und ohne
 * Auffuellung schluege nicht eine Rechnung fehl, sondern das **Einlesen**.
 *
 * Die untere Grenze ist null und nicht eins: dass ein Basistisch keine Ritter
 * hat, ist eine Null im Vorrat und kein fehlender Eintrag. `canPay` weist einen
 * leeren Vorrat ohnehin ab, und damit ist "gibt es hier nicht" dieselbe
 * Auskunft wie "alle verbaut" - was in beiden Faellen stimmt.
 */
export const PieceCountsSchema = z
  .partialRecord(PieceIdSchema, z.number().int().min(0))
  .transform((counts): Record<PieceId, number> => pieceCounts(counts));

/** Ausdruecklich geschrieben und nicht abgeleitet - siehe `CardAmounts`. */
export type PieceCounts = Record<PieceId, number>;

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
export const CardAmountsSchema = z
  .partialRecord(CardIdSchema, z.number().int().min(0))
  .transform((amounts): Record<CardId, number> => cardAmounts(amounts));

/**
 * Ausdruecklich geschrieben und nicht aus dem Schema abgeleitet: `z.infer`
 * eines Schemas mit `transform` liefert den **Ausgangs**typ, und der ist hier
 * schon der vollstaendige Record - aber die Ableitung waere von der genauen
 * Rueckgabe des `transform` abhaengig und damit stiller als noetig.
 */
export type CardAmounts = Record<CardId, number>;

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

/**
 * Die Vorgabe fuer Staedte & Ritter.
 *
 * Steht neben der anderen und nicht in `cities.ts`, weil der Wartebereich
 * beide braucht: er schlaegt beim Umstellen des Regelwerks die passende Zahl
 * vor, und dafuer muss er sie kennen, ohne die Erweiterung zu laden.
 */
export const DEFAULT_VICTORY_POINT_GOAL_CITIES = 13;

export const RuleSetSchema = z.object({
  /** Stabiler Bezeichner, etwa `"classic"`. */
  id: z.string().min(1),
  /**
   * Welche Kartensorten an diesem Tisch im Spiel sind.
   *
   * `CARD_IDS` kennt acht, das Basisspiel fuenf. Ohne diese Angabe boete
   * `legalActions` dort vierundsechzig Bankgeschaefte statt fuenfundzwanzig,
   * und die Auswahldialoge zeigten drei Sorten, die es an diesem Tisch nicht
   * gibt.
   *
   * **Nicht aus `resourceBank` abgeleitet:** ein Vorrat darf mitten in der
   * Partie auf null fallen, und eine Sorte verschwaende dann aus der
   * Bedienung. Was im Spiel ist, aendert sich waehrend einer Partie nicht.
   *
   * Mit Vorgabe, aus demselben Grund wie `dice` und `robberRoll`: das RuleSet
   * jeder laufenden Partie liegt als JSON in der Datenbank.
   */
  cards: z
    .array(CardIdSchema)
    .min(1)
    .default([...RESOURCE_IDS]),
  /**
   * Was jedes Bauteil kostet.
   *
   * **Teilweise, und das ist die Aussage:** was hier fehlt, gibt es an diesem
   * Tisch nicht. Staedte & Ritter kennt keine Entwicklungskarte, und ihr einen
   * Preis zu geben, den niemand zahlen darf, waere eine Zeile, die luegt.
   * `canBuyDevelopmentCard` weist einen fehlenden Preis ausdruecklich ab -
   * fehlend heisst nicht kostenlos.
   */
  buildCosts: z.partialRecord(BuildableIdSchema, CardAmountsSchema),
  /** Wie viele Teile jeder Spieler insgesamt bauen kann. */
  pieceStock: PieceCountsSchema,
  /** Wie viele Karten je Ressource die Bank vorhaelt. */
  resourceBank: CardAmountsSchema,
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
    /**
     * Was ein Siegpunkt-Chip "Retter Catans" zaehlt.
     *
     * Mit Vorgabe, weil das RuleSet jeder laufenden Partie als JSON in der
     * Datenbank liegt und keines davon dieses Feld kennt. Null heisst: an
     * diesem Tisch gibt es die Chips nicht.
     */
    defender: z.number().int().min(0).default(0),
    /**
     * Was ein Metropolenaufsatz **zusaetzlich** zur Stadt zaehlt.
     *
     * Zwei, nicht vier: die Stadt darunter zaehlt ihre eigenen zwei weiter. Wer
     * hier vier eintraegt, zaehlt die Stadt doppelt.
     */
    metropolis: z.number().int().min(0).default(0),
    /** Was die Haendlerfigur zaehlt, solange sie bei einem steht. */
    merchant: z.number().int().min(0).default(0),
    /** Was eine offene Siegpunkt-Fortschrittskarte zaehlt (Buchdruck, Verfassung). */
    progressCard: z.number().int().min(0).default(0),
  }),
  /** Ab wie vielen zusammenhaengenden Strassen die Laengste Handelsstrasse vergeben wird. */
  longestRoadMinimum: z.number().int().min(1),
  /** Ab wie vielen ausgespielten Rittern die Groesste Rittermacht vergeben wird. */
  largestArmyMinimum: z.number().int().min(1),
  /**
   * Wie viele Entwicklungskarten je Art im Stapel liegen.
   *
   * Leer heisst: keinen Stapel. So kommt Staedte & Ritter ohne
   * Entwicklungskarten aus, ohne dass irgendwo ein Sonderfall steht.
   */
  developmentDeck: DevelopmentDeckSchema,
  /**
   * Wie viele Fortschrittskarten je Art auf den Stapeln liegen.
   *
   * Leer heisst: keine Fortschrittsstapel. Dieselbe Bauform wie
   * `developmentDeck` - und dieselbe Zusage: was fehlt, gibt es an diesem Tisch
   * nicht. Genau daran haengt der Zuschnitt von 10d: die fuenf Karten, die auf
   * eine fremde Antwort warten, stehen hier in 10d-1 noch nicht drin und kommen
   * in 10d-2 dazu, ohne dass eine Regel sich aendert.
   */
  progressDecks: z.partialRecord(ProgressCardIdSchema, z.number().int().min(0)).default({}),
  /** Ab wie vielen Handkarten bei einer Sieben abgeworfen wird. */
  handLimitBeforeDiscard: z.number().int().min(1),

  /**
   * Um wie viel **eine** Stadtmauer das Handkartenlimit hebt.
   *
   * Steht im Regelwerk und nicht im Code: eine Variante mit einem anderen
   * Aufschlag ist damit ein zweites RuleSet und kein zweiter Codepfad
   * (Regel 5). Null heisst: an diesem Tisch aendert eine Mauer nichts am
   * Limit - im Basisspiel gibt es sie gar nicht.
   */
  handLimitPerWall: z.number().int().min(0).default(0),

  /**
   * Wie viele Felder die Fahrstrecke des Barbarenschiffs hat.
   *
   * Null heisst: an diesem Tisch faehrt kein Schiff. Damit ist die Erweiterung
   * eine Zahl im Regelwerk und kein zweiter Codepfad (Regel 5) - und die
   * Frage "spielt dieser Tisch Staedte & Ritter" hat eine Antwort, die ein
   * Merkmal ist und kein Name.
   */
  barbarianTrack: z.number().int().min(0).default(0),

  /**
   * Ob mit den Marken Burg 1 und Burg 2 gespielt wird (Etappe 10e).
   *
   * Sagt, **ob** - wo sie liegen, steht im `GameState`. Zwei aehnliche Namen,
   * zwei verschiedene Fragen.
   */
  castleTurns: z.boolean().default(false),

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
  cards: [...RESOURCE_IDS],

  buildCosts: {
    road: cardAmounts({ brick: 1, lumber: 1 }),
    settlement: cardAmounts({ brick: 1, lumber: 1, wool: 1, grain: 1 }),
    city: cardAmounts({ grain: 2, ore: 3 }),
    developmentCard: cardAmounts({ wool: 1, grain: 1, ore: 1 }),
  },

  /*
   * Mauern und Ritter stehen mit null da, und das ist dieselbe Aussage wie bei
   * den drei Handelswaren darunter: an einem Basistisch gibt es sie nicht. Ein
   * fehlender Eintrag saehe aus wie ein Versehen.
   */
  pieceStock: pieceCounts({
    road: 15,
    settlement: 5,
    city: 4,
  }),

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
    defender: 0,
    metropolis: 0,
    merchant: 0,
    progressCard: 0,
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
  /* Keine Fortschrittsstapel an einem Basistisch. */
  progressDecks: {},
  handLimitBeforeDiscard: 7,
  handLimitPerWall: 0,
  tradeOfferMs: 60_000,

  barbarianTrack: 0,
  castleTurns: false,

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
