import { CARD_IDS } from '../scenario/terrain.js';
import { CLASSIC_56 } from '../scenario/blueprints/classic56.js';
import type { DiceSpec } from './dice.js';
import {
  DEFAULT_VICTORY_POINT_GOAL_CITIES,
  cardAmounts,
  pieceCounts,
  type RuleSet,
} from './ruleset.js';

/**
 * Das Regelwerk der Erweiterung Staedte & Ritter.
 *
 * Es steht **neben** `CLASSIC_RULES` und nicht darueber: eine Partie traegt
 * ihr Regelwerk als Kopie in sich, und beide sind vollstaendig
 * ausgeschrieben. Ein Spread ueber `CLASSIC_RULES` waere kuerzer und liesse
 * offen, was absichtlich gleich ist und was nur vergessen wurde.
 */

export const CITIES_DICE: DiceSpec = [
  { id: 'first', faces: 6, countsTowardYield: true, render: 'pips' },
  /* Der rote Wuerfel. Rot ist eine Farbe auf dem Tisch, keine Eigenschaft der
   * Ziehung - deshalb heisst er weiter `second`, und `game/cities/event.ts`
   * sagt, dass er der rote ist. Eine dritte Id machte jeden gespeicherten Wurf
   * unlesbar. */
  { id: 'second', faces: 6, countsTowardYield: true, render: 'pips' },
  /* Der dritte Wuerfel faellt mit und zaehlt nicht mit. Genau dafuer gibt es
   * `countsTowardYield` - der Kopf von `dice.ts` nennt diesen Fall
   * namentlich. */
  { id: 'event', faces: 6, countsTowardYield: false, render: 'event' },
];

export const CITIES_RULES: RuleSet = {
  id: 'cities',

  cards: [...CARD_IDS],

  /*
   * Die Baukosten des Basisspiels, **ohne** die Entwicklungskarte: es gibt sie
   * in dieser Erweiterung nicht. Was hier fehlt, ist nicht kaufbar - und der
   * leere `developmentDeck` weist den Kauf ein zweites Mal ab.
   */
  buildCosts: {
    road: cardAmounts({ brick: 1, lumber: 1 }),
    settlement: cardAmounts({ brick: 1, lumber: 1, wool: 1, grain: 1 }),
    city: cardAmounts({ grain: 2, ore: 3 }),
    wall: cardAmounts({ brick: 2 }),
    knight: cardAmounts({ wool: 1, ore: 1 }),
    /* Aufwerten kostet dasselbe wie bauen - ein Ritter wird nicht ersetzt,
     * sondern ausgeruestet. */
    knightUpgrade: cardAmounts({ wool: 1, ore: 1 }),
    knightActivation: cardAmounts({ grain: 1 }),
  },

  /*
   * **Je Person gezaehlt**, deshalb steht dieselbe Zeile in `CITIES_RULES_56`:
   * die Fuenf-bis-Sechser-Ergaenzung bringt zwoelf weitere Ritter und sechs
   * weitere Mauern - fuer **zwei zusaetzliche Personen**. Je Person bleibt es
   * bei sechs Rittern und drei Mauern.
   */
  pieceStock: pieceCounts({
    road: 15,
    settlement: 5,
    city: 4,
    wall: 3,
    knight1: 2,
    knight2: 2,
    knight3: 2,
  }),

  /* 19 je Rohstoff wie im Basisspiel, 12 je Handelsware wie in der Schachtel. */
  resourceBank: cardAmounts({
    brick: 19,
    lumber: 19,
    wool: 19,
    grain: 19,
    ore: 19,
    paper: 12,
    cloth: 12,
    coin: 12,
  }),

  victoryPointGoal: DEFAULT_VICTORY_POINT_GOAL_CITIES,
  victoryPoints: {
    settlement: 1,
    city: 2,
    longestRoad: 2,
    /*
     * Beide auf null statt ausgelassen: die Felder sind Pflicht im Schema, und
     * eine Null sagt "gibt es hier nicht", ohne dass irgendwo ein zweiter
     * Codepfad entsteht. Die Groesste Rittermacht bleibt in der Schachtel, und
     * `recomputeLargestArmy` findet an diesem Tisch nie einen Halter, weil
     * niemand eine Ritterkarte spielt.
     */
    largestArmy: 0,
    developmentCard: 0,
    /* Jeder Siegpunkt-Chip "Retter Catans" zaehlt einen Punkt. */
    defender: 1,
    metropolis: 2,
    /* Die Haendlerfigur zaehlt einen Punkt, solange sie bei jemandem steht. */
    merchant: 1,
    /* Eine offene Siegpunkt-Fortschrittskarte (Buchdruck, Verfassung) zaehlt einen Punkt. */
    progressCard: 1,
  },
  longestRoadMinimum: 5,
  largestArmyMinimum: 3,

  developmentDeck: {},

  /*
   * Die Fortschrittsstapel. Es fehlen fuenf Arten - masterMerchant, spy,
   * deserter, tradeHarbor, wedding -, weil sie auf die Antwort einer anderen
   * Person warten und ihre Phase erst in 10d-2 entsteht. Sie fehlen hier und
   * nicht als Sperre im Regelcode: "was fehlt, gibt es an diesem Tisch nicht"
   * ist die Zusage, die `developmentDeck` schon gibt.
   */
  progressDecks: {
    alchemist: 2,
    crane: 2,
    mining: 2,
    irrigation: 2,
    printer: 1,
    inventor: 2,
    engineer: 1,
    medicine: 2,
    smith: 2,
    roadBuilding: 2,
    merchant: 6,
    resourceMonopoly: 4,
    commodityMonopoly: 2,
    merchantFleet: 2,
    bishop: 2,
    diplomat: 2,
    warlord: 2,
    intrigue: 2,
    saboteur: 2,
    constitution: 1,
  },

  handLimitBeforeDiscard: 7,
  /* Jede Stadtmauer hebt das Limit um zwei: 7, 9, 11, 13. */
  handLimitPerWall: 2,
  tradeOfferMs: 60_000,

  barbarianTrack: 7,
  castleTurns: false,

  dice: CITIES_DICE,
  robberRoll: 7,
};

/**
 * Das Regelwerk fuer fuenf und sechs Personen.
 *
 * Es weichen genau **zwei** Dinge ab, und das ist nachgerechnet: die
 * Ergaenzung bringt 12 weitere Ritter, 12 Helme und 6 weitere Mauern - fuer
 * **zwei zusaetzliche Personen**. Je Person bleibt es bei sechs Rittern und
 * drei Mauern, und `pieceStock` ist je Person gezaehlt. Zusaetzliche
 * Fortschrittskarten bringt sie ausdruecklich keine. Bleiben der Vorrat an
 * Karten und die Zugweitergabe (Burg 1 / Burg 2, Etappe 10e).
 */
export const CITIES_RULES_56: RuleSet = {
  ...CITIES_RULES,

  resourceBank: cardAmounts({
    brick: 24,
    lumber: 24,
    wool: 24,
    grain: 24,
    ore: 24,
    paper: 18,
    cloth: 18,
    coin: 18,
  }),

  castleTurns: true,
};

/**
 * Welches der beiden Regelwerke eine Tischgroesse traegt.
 *
 * Die Schwester von `rulesFor` und aus demselben Grund eine Funktion: es gibt
 * zwei Stellen, die eine Partie starten, und zwei Ableitungen liefen frueher
 * oder spaeter auseinander. Die Grenze kommt aus dem Blueprint, der sie fuers
 * Brett ohnehin nennt.
 */
export function citiesRulesFor(seatCount: number): RuleSet {
  return seatCount >= CLASSIC_56.minPlayers ? CITIES_RULES_56 : CITIES_RULES;
}
