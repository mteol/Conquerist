import { z } from 'zod';

import { RuleSetSchema, CardAmountsSchema } from '../rules/index.js';
import { ScenarioDefinitionSchema, CardIdSchema } from '../scenario/index.js';
import type { RuleViolation } from './errors.js';
import { ProgressCardIdSchema } from './cities/progress/cards.js';
import { TrackIdSchema } from './cities/tracks.js';
import { DevelopmentCardIdSchema } from './development.js';
import { RollSchema } from './dice.js';
import { PhaseSchema } from './phase.js';
import { PlayerIdSchema, PlayerStateSchema } from './player.js';

/**
 * Der vollstaendige Spielzustand - die Sicht des Servers.
 *
 * Enthaelt Szenario und RuleSet als Kopie, nicht als Verweis. Damit ist ein
 * Zustand fuer sich allein auswertbar: `replay` braucht nichts als den
 * Startzustand und die Aktionsfolge, und Etappe 6 kann einen Schnappschuss
 * ablegen, ohne nebenher zu erklaeren, nach welchen Regeln er entstanden ist.
 *
 * Nicht enthalten, weil ableitbar: Siegpunkte (`scoring.ts`), die Topologie des
 * Bretts (`board.ts`), und wer wo gebaut hat aus Spielersicht - Belegung steht
 * einmal in `buildings` und `roads` und nirgends sonst.
 *
 * **Fuer Etappe 5 vorgemerkt:** `rng` und die `resources` der Mitspieler sind
 * die geheime Haelfte. Wer den RNG-Zustand kennt, rechnet jeden kuenftigen
 * Wuerfelwurf voraus - er darf niemals in einer `PlayerView` landen.
 */

/** Zustand des Zufallsgenerators aus Etappe 1, als Daten. */
export const RngSchema = z.object({
  a: z.number().int().min(0),
  b: z.number().int().min(0),
  c: z.number().int().min(0),
  d: z.number().int().min(0),
});

export const BUILDING_KINDS = ['settlement', 'city'] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

export const BuildingSchema = z.object({
  owner: PlayerIdSchema,
  kind: z.enum(BUILDING_KINDS),
  /**
   * Ob unter dieser Stadt eine Stadtmauer liegt.
   *
   * Am **Gebaeude** und nicht beim Spieler: nur so faellt die Mauer beim
   * Barbarenueberfall mit der richtigen Stadt, und nur so ist "diese Stadt ist
   * ummauert" eine Frage an das Bauwerk statt eine Rechnung ueber den
   * Besitzer. Eine Siedlung traegt nie eine - `canBuildWall` laesst es gar
   * nicht zu.
   *
   * Mit Vorgabe: gespeicherte Partien kennen das Feld nicht, und dort steht
   * keine Mauer.
   */
  wall: z.boolean().default(false),
  /**
   * Metropolenaufsatz auf dieser Stadt, mit seinem Bereich - `null` heisst keiner.
   *
   * Am **Gebaeude** und nicht beim Spieler, aus demselben Grund wie die Mauer:
   * "diese Stadt ist Metropole" ist eine Frage an das Bauwerk. Eine Tabelle
   * `metropolis: Record<TrackId, PlayerId>` waere eine zweite Wahrheit darueber,
   * wo der Aufsatz steht - und beim ersten Barbarenueberfall, der Staedte
   * zurueckstuft, liefe sie mit der ersten auseinander.
   *
   * Mit Vorgabe: gespeicherte Partien kennen das Feld nicht.
   */
  metropolis: TrackIdSchema.nullable().default(null),
});

export type Building = z.infer<typeof BuildingSchema>;

/** Die drei Ritterstufen - zugleich die Staerke des Ritters. */
export const KNIGHT_LEVELS = [1, 2, 3] as const;

export type KnightLevel = (typeof KNIGHT_LEVELS)[number];

/**
 * Eine Ritterfigur auf einer Kreuzung.
 *
 * Die Stufe **ist** die Staerke (Einfach 1, Stark 2, Maechtig 3) - zwei Felder
 * dafuer waeren zwei Wahrheiten ueber dasselbe.
 */
export const KnightSchema = z.object({
  owner: PlayerIdSchema,
  /** 1 Einfacher, 2 Starker, 3 Maechtiger Ritter. */
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Traegt er einen Helm? Nur ein aktivierter Ritter kaempft und handelt. */
  active: z.boolean(),
  /**
   * In welcher Runde er aktiviert wurde. `null`, solange er passiv ist.
   *
   * Ohne diese Zahl ist die Regel "fruehestens im naechsten Zug" nicht
   * pruefbar: ein Ritter, der eben aktiviert wurde, saehe sonst aus wie einer,
   * der seit drei Runden bereitsteht. Eine Zahl und kein abgeleitetes Flag
   * "darf handeln" - ein gespeicherter abgeleiteter Wert ist ein Wert, den man
   * nachzuziehen vergisst.
   *
   * Gezaehlt wird in `state.turn`, also in vollen Runden. Weil jeder je Runde
   * einmal handelt, heisst `activatedOnTurn < state.turn` genau "ab dem
   * naechsten eigenen Zug".
   */
  activatedOnTurn: z.number().int().min(0).nullable(),
  /**
   * Ob er in dieser Runde schon aufgewertet wurde. Ein Ritter darf je Zug nur
   * einmal steigen; `endTurn` setzt es zurueck.
   */
  upgradedThisTurn: z.boolean(),
});

export type Knight = z.infer<typeof KnightSchema>;

/**
 * Das Barbarenschiff auf seiner Fahrstrecke.
 *
 * `null` am `GameState` heisst: an diesem Tisch faehrt keines.
 */
export const BarbarianStateSchema = z.object({
  /** 0 bis `rules.barbarianTrack`. Auf dem letzten Feld landen sie. */
  position: z.number().int().min(0),
  /**
   * Wie oft sie schon gelandet sind.
   *
   * Steht hier, weil zwei Regeln daran haengen und beide sonst raten muessten:
   * der Raeuber bleibt bis zum ersten Ueberfall stehen, und die Wueste wird
   * erst danach sein Platz.
   */
  attacks: z.number().int().min(0),
});

export type BarbarianState = z.infer<typeof BarbarianStateSchema>;

export const GameStateSchema = z.object({
  /** Das Brett, aus dem Topologie und Ertraege folgen. */
  scenario: ScenarioDefinitionSchema,
  /** Kosten, Siegpunktziel, Vorraete, Handkartenlimit. */
  rules: RuleSetSchema,
  /** Die Spieler in Zugreihenfolge. */
  players: z.array(PlayerStateSchema).min(2),
  /** Index in `players`. In der Gruendungsphase folgt der Zug aus `phase`. */
  currentPlayerIndex: z.number().int().min(0),
  phase: PhaseSchema,
  /** Knoten-Id -> was darauf steht. Was nicht drinsteht, ist frei. */
  buildings: z.record(z.string(), BuildingSchema),
  /** Kanten-Id -> wem die Strasse gehoert. */
  roads: z.record(z.string(), PlayerIdSchema),
  /**
   * Knoten-Id -> welcher Ritter darauf steht. Was nicht drinsteht, ist frei.
   *
   * **Am Zustand und nicht beim Spieler**, und das ist dieselbe Entscheidung
   * wie bei `buildings`: Ritter stehen auf Kreuzungen. Die Belegung des Bretts
   * steht einmal in `buildings`, `roads` und `knights` und nirgends sonst -
   * eine zweite Liste beim Spieler liefe bei der ersten Vertreibung
   * auseinander, denn dort wechselt eine Figur den Ort, ohne dass ihr Besitzer
   * etwas tut.
   *
   * Mit Vorgabe wie `barbarians` und aus demselben Grund: gespeichert wird nur
   * der Startzustand.
   */
  knights: z.record(z.string(), KnightSchema).default({}),
  /** Feld-Id, auf dem der Raeuber steht. */
  robber: z.string(),
  /**
   * Das Barbarenschiff. `null` heisst: an diesem Tisch ohne Erweiterung.
   *
   * Mit Vorgabe, wie `rollTally` und aus demselben Grund: gespeichert wird nur
   * der Startzustand, und ein Pflichtfeld ohne Vorgabe liesse jede bestehende
   * Partie am Schema scheitern.
   */
  barbarians: BarbarianStateSchema.nullable().default(null),
  /**
   * Die Haendlerfigur. `null`, solange keine Karte "Haendler" gespielt wurde.
   *
   * Mit Vorgabe wie `barbarians` und aus demselben Grund: gespeichert wird nur
   * der Startzustand.
   */
  merchant: z.object({ hex: z.string(), owner: PlayerIdSchema }).nullable().default(null),
  /** Was die Bank noch ausgeben kann. */
  bank: CardAmountsSchema,
  /** Wer die Laengste Handelsstrasse haelt und wie lang sie ist. */
  longestRoad: z.object({
    holder: PlayerIdSchema.nullable(),
    length: z.number().int().min(0),
  }),
  /** Wer die Groesste Rittermacht haelt und mit wie vielen Rittern. */
  largestArmy: z.object({
    holder: PlayerIdSchema.nullable(),
    size: z.number().int().min(0),
  }),
  /**
   * Der Entwicklungskartenstapel, von oben nach unten. **Geheim.**
   *
   * Wer ihn kennt, weiss vor dem Kauf, was er bekommt - derselbe Bruch wie ein
   * bekannter Wuerfelzustand. Er verlaesst den Server nie.
   */
  deck: z.array(DevelopmentCardIdSchema),
  /** Die drei Fortschrittsstapel, von oben nach unten. **Geheim** wie `deck`. */
  progressDecks: z.partialRecord(TrackIdSchema, z.array(ProgressCardIdSchema)).default({}),
  /**
   * Ob in dieser Runde schon eine Entwicklungskarte gespielt wurde.
   *
   * Eine je Zug ist die Regel. Der Vermerk steht am Zustand und nicht am
   * Spieler, weil immer nur einer am Zug ist - und `endTurn` setzt ihn zurueck.
   */
  developmentPlayed: z.boolean(),
  /**
   * Fuer welche Bereiche der naechste Ausbau in diesem Zug eine Handelsware
   * weniger kostet. Leer heisst: kein Rabatt.
   *
   * Am Zustand und nicht beim Spieler, aus demselben Grund wie
   * `developmentPlayed`: es ist immer nur einer am Zug, und `endTurn` raeumt ab.
   */
  craneDiscount: z.array(TrackIdSchema).default([]),
  /**
   * Welche Sorte die Handelsflotte in diesem Zug 2:1 kostet. `null` heisst: keine
   * Flotte aktiv.
   *
   * Am Zustand und nicht beim Spieler, aus demselben Grund wie `craneDiscount`:
   * es ist immer nur einer am Zug, und `endTurn` raeumt ab.
   */
  fleetSort: CardIdSchema.nullable().default(null),
  /**
   * Die beiden Augen, die Alchemie fuer den naechsten Wurf festlegt. `null`
   * heisst: normal wuerfeln.
   *
   * Der Ereigniswuerfel steht bewusst nicht drin - die Regel wuerfelt ihn
   * normal und fuehrt ihn zuerst aus.
   *
   * Ein Vorsatz und keine gelegten Wuerfel: der Wurf bleibt eine Aktion des
   * Spielers, sonst haette `rollDice` zwei Bedeutungen. `rollDice` liest das
   * Feld, setzt die Augen und raeumt es danach wieder ab.
   */
  alchemistRoll: z
    .object({ first: z.number().int().min(1), second: z.number().int().min(1) })
    .nullable()
    .default(null),
  /** Der Zufallszustand. Geheim - siehe Kopf dieser Datei. */
  rng: RngSchema,
  /**
   * Der letzte Wurf, damit die Oberflaeche ihn zeigen kann. `null` vor dem ersten.
   *
   * Die gefallenen Wuerfel und nicht ihre Summe: die Summe steht in
   * `yieldTotal` und laesst sich jederzeit nachrechnen, die einzelnen Augen
   * waeren danach nicht wiederherstellbar - und genau sie liegen auf dem Tisch.
   */
  lastRoll: RollSchema.nullable(),
  /**
   * Wie oft welche Wurfsumme fiel - der Schluessel ist die Summe als Text.
   *
   * Eine Summe und kein Protokoll: die Frage dahinter ist "war das Brett
   * fair", und die braucht keine Reihenfolge. Ein vollstaendiges Wurfprotokoll
   * waere ein zweites Log, das mit jeder Partie mitwuechse.
   *
   * **Mit Vorgabe, und das ist Pflicht.** Gespeichert wird nur der
   * Startzustand, alles andere entsteht beim Replay; ein Pflichtfeld ohne
   * Vorgabe liesse jede bestehende Partie am Schema scheitern. So bekommen
   * aeltere Partien ihre Zaehlung beim naechsten Replay rueckwirkend.
   *
   * Auftaktwuerfe zaehlen nicht mit - sie bestimmen die Sitzreihenfolge und
   * haben nie ein Feld bedient.
   */
  rollTally: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Vollstaendige Runden seit Ende der Gruendungsphase. */
  turn: z.number().int().min(0),
});

export type GameState = z.infer<typeof GameStateSchema>;

/**
 * Das Ergebnis eines Zuges.
 *
 * Nie eine Ausnahme: ein abgelehnter Zug ist ein normaler Ausgang, kein Fehler
 * im Programm. Bewusst ohne Ereignisliste - was passiert ist, steht im neuen
 * Zustand. Ereignisse bekommen in Etappe 5 einen konkreten Anlass, wenn ein
 * Diebstahl fuer die Beteiligten eine andere Nachricht ist als fuer den Rest
 * des Tisches.
 */
export type ReduceResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: RuleViolation };

/** Kurzform fuer einen erfolgreichen Zug. */
export function ok(state: GameState): ReduceResult {
  return { ok: true, state };
}

/** Kurzform fuer einen abgelehnten Zug. */
export function rejected(error: RuleViolation): ReduceResult {
  return { ok: false, error };
}

/** Der Spieler, der gerade handeln darf - in der Gruendungsphase aus der Schlange. */
export function playerAt(state: GameState, index: number): GameState['players'][number] {
  const player = state.players[index];
  if (player === undefined) {
    throw new RangeError(`playerAt: Kein Spieler an Position ${index}`);
  }
  return player;
}

/** Findet einen Spieler ueber seine Id. */
export function findPlayer(state: GameState, id: string): GameState['players'][number] | undefined {
  return state.players.find((player) => player.id === id);
}

/** Ersetzt einen Spieler und gibt die neue Spielerliste zurueck. */
export function withPlayer(
  state: GameState,
  id: string,
  update: (player: GameState['players'][number]) => GameState['players'][number],
): GameState['players'] {
  return state.players.map((player) => (player.id === id ? update(player) : player));
}
