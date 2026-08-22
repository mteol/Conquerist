import { rollAll, yieldTotal, type Roll } from './dice.js';
import type { PlayerId } from './player.js';
import { ok, type GameState, type ReduceResult } from './state.js';

/**
 * Der Auftakt: wer am hoechsten wuerfelt, beginnt.
 *
 * Gewuerfelt wird mit **derselben** Schale und aus **demselben** Zufallszustand
 * wie im Spiel. Der Auftakt verbraucht damit Zufall, den die Partie sonst
 * spaeter gezogen haette - unproblematisch, solange es aus dem Seed folgt, und
 * `replay` reproduziert es. Ein zweiter Zufallsstrom nur fuer den Auftakt waere
 * genau die zweite Wahrheit, die `setup.ts` fuer Stapel und RNG vermeidet.
 */

/**
 * Wer die hoechste Summe geworfen hat - mehrere bei Gleichstand.
 *
 * Zaehlt ueber `yieldTotal` und nicht ueber alle Augen: ein Wuerfel, den das
 * RuleSet nicht mitzaehlen laesst, soll auch nicht bestimmen, wer anfaengt. Es
 * gibt eine Vorstellung von "die Zahl, die zaehlt", und sie steht in `dice.ts`.
 *
 * Wer in dieser Runde nicht geworfen hat, zaehlt nicht mit. Im Stechen wirft
 * nur, wer gleichauf lag; ohne diese Zeile gewaenne bei lauter Nullen der Rest
 * des Tisches mit.
 */
export function highestRollers(
  state: GameState,
  rolls: Readonly<Record<string, Roll>>,
): readonly PlayerId[] {
  const totals = state.players
    .filter((player) => rolls[player.id] !== undefined)
    .map((player) => ({
      id: player.id,
      total: yieldTotal(state.rules.dice, rolls[player.id] ?? []),
    }));

  const best = Math.max(...totals.map((entry) => entry.total));

  return totals.filter((entry) => entry.total === best).map((entry) => entry.id);
}

/**
 * Dreht die Spielerliste, bis `id` vorn steht.
 *
 * Gefahrlos, weil Farbe und Name am `Seat` haengen und ueber die Id
 * nachgeschlagen werden, nicht ueber den Index in `players`. `players` ist die
 * Zugreihenfolge - genau das steht als ihre Bedeutung in `state.ts` -, und
 * `setupPlayerIndex` rechnet danach von allein richtig.
 */
export function rotateToFirst(players: GameState['players'], id: PlayerId): GameState['players'] {
  const index = players.findIndex((player) => player.id === id);
  if (index < 0) {
    throw new RangeError(`rotateToFirst: ${id} sitzt nicht an diesem Tisch`);
  }

  return [...players.slice(index), ...players.slice(0, index)];
}

/** Ein Wurf im Auftakt - und, wenn die Runde damit voll ist, die Entscheidung. */
export function applyOpeningRoll(state: GameState): ReduceResult {
  const phase = state.phase;
  if (phase.kind !== 'opening') {
    throw new RangeError('applyOpeningRoll: Der Zustand steht nicht im Auftakt');
  }

  const roller = phase.pending[0];
  if (roller === undefined) {
    throw new RangeError('applyOpeningRoll: Im Auftakt wartet niemand auf einen Wurf');
  }

  const [roll, rng] = rollAll(state.rules.dice, state.rng);
  const rolls = { ...phase.rolls, [roller]: roll };
  const pending = phase.pending.slice(1);

  // `lastRoll` auch hier: daran haengt die Wurfbahn im Client, und sie soll den
  // Auftakt nicht als Sonderfall kennen muessen.
  const rolled: GameState = { ...state, rng, lastRoll: roll };

  if (pending.length > 0) {
    return ok({ ...rolled, phase: { kind: 'opening', rolls, pending, round: phase.round } });
  }

  const winners = highestRollers(rolled, rolls);
  const winner = winners.length === 1 ? winners[0] : undefined;

  if (winner === undefined) {
    return ok({
      ...rolled,
      phase: { kind: 'opening', rolls: {}, pending: [...winners], round: phase.round + 1 },
    });
  }

  return ok({
    ...rolled,
    players: rotateToFirst(rolled.players, winner),
    currentPlayerIndex: 0,
    phase: { kind: 'setup', placement: 0, settlement: null },
  });
}
