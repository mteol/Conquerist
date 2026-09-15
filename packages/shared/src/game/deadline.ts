import type { PlayerId } from './player.js';
import type { GameState } from './state.js';

/**
 * Die laufende Frist, wem sie gehoert und wie sie gemessen wird.
 *
 * Die eine Stelle, an der ausserhalb der Logik nachgesehen wird, ob gerade eine
 * Uhr laeuft. Der Wecker im Server und die lokale Uhr lesen nur diese Funktion.
 *
 * **Zwei Arten, und das ist Absicht (Spec 5.5).** Das Angebot hat einen
 * gespeicherten Zeitpunkt (`at`), weil ein Neustart seine Frist nicht
 * verlaengern darf. Jede andere Wartephase hat eine Dauer (`after`): der
 * Zeitpunkt steht nicht im Zustand, sonst braeuchte ein Dutzend Aktionen ein
 * `at` und jede gespeicherte Phase ein Pflichtfeld. Der Wecker stellt sich
 * nach jedem Zug neu - die Frist gilt also je Stand.
 *
 * `owner` ist, wem die Frist gehoert - er steht als `player` in der
 * `timeout`-Aktion und im Verlaufssatz. Wo der Reihe nach gehandelt wird, ist
 * es der Vorderste der Warteschlange; `actorFor` im Reducer verlangt genau ihn.
 */
export type Deadline =
  | { readonly kind: 'at'; readonly at: number; readonly owner: PlayerId }
  | { readonly kind: 'after'; readonly ms: number; readonly owner: PlayerId };

/**
 * Was `deadlineOf` liest. `GameState` und `PlayerView` haben es beide - der
 * Client zeigt damit denselben Countdown, den der Server vollstreckt.
 */
export interface DeadlineSource {
  readonly phase: GameState['phase'];
  readonly players: readonly { readonly id: PlayerId }[];
  readonly currentPlayerIndex: number;
  readonly rules: { readonly pendingAnswerMs: number };
}

export function deadlineOf(source: DeadlineSource): Deadline | null {
  const phase = source.phase;
  const after = (owner: PlayerId | undefined): Deadline | null =>
    owner === undefined ? null : { kind: 'after', ms: source.rules.pendingAnswerMs, owner };

  switch (phase.kind) {
    case 'tradePending':
      return { kind: 'at', at: phase.expiresAt, owner: phase.offer.from };
    case 'discardPending':
    case 'progressDiscardPending':
    case 'defenderPending':
    case 'aqueductPending':
    case 'progressPending':
      return after(phase.pending[0]);
    case 'robberPending':
      return after(source.players[source.currentPlayerIndex]?.id);
    case 'displacePending':
      return after(phase.owner);
    /*
     * Keine Frist fuer `main` und `rollPending`: eine Zugzeit betraefe jeden
     * Zug statt einer Wartephase und bleibt offener Punkt (Spec 5.5).
     */
    case 'opening':
    case 'setup':
    case 'rollPending':
    case 'main':
    case 'finished':
      return null;
  }
}

/** Wie lange der Wecker schlafen soll - eine abgelaufene Frist ist sofort faellig. */
export function msUntil(due: Deadline, now: number): number {
  return due.kind === 'at' ? Math.max(0, due.at - now) : due.ms;
}
