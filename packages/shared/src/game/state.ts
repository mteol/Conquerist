import { z } from 'zod';

import { RuleSetSchema, ResourceAmountsSchema } from '../rules/index.js';
import { ScenarioDefinitionSchema } from '../scenario/index.js';
import type { RuleViolation } from './errors.js';
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
});

export type Building = z.infer<typeof BuildingSchema>;

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
  /** Feld-Id, auf dem der Raeuber steht. */
  robber: z.string(),
  /** Was die Bank noch ausgeben kann. */
  bank: ResourceAmountsSchema,
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
  /**
   * Ob in dieser Runde schon eine Entwicklungskarte gespielt wurde.
   *
   * Eine je Zug ist die Regel. Der Vermerk steht am Zustand und nicht am
   * Spieler, weil immer nur einer am Zug ist - und `endTurn` setzt ihn zurueck.
   */
  developmentPlayed: z.boolean(),
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
