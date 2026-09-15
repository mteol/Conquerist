import { deadlineOf, msUntil, type GameAction } from '@conquerist/shared';
import { broadcastGame, type Sinks } from './broadcast.js';
import type { RoomRegistry } from './registry.js';
import { applySystemAction } from './room.js';

/**
 * Die Uhr des Servers, je Raum ein Wecker.
 *
 * Der Wecker kennt keine Regel: er liest `deadlineOf` und wirft, wenn die Zeit
 * um ist, `timeout` ein. Was das bedeutet, entscheidet der Reducer - hier steht
 * nur, wann jemand nachfragen muss. Seit 10d-2 hat jede Wartephase eine Frist,
 * und hier hat sich dafuer genau eine Zeile geaendert (`msUntil`): `deadlineOf`
 * ist die einzige Quelle. Eine Dauer beginnt mit jedem `arm` neu - die Frist
 * gilt je Stand, nach jedem Zug.
 *
 * Uhr und Zeitgeber kommen von aussen herein, damit die Tests nicht warten.
 */
export interface RoomClockDeps {
  readonly registry: RoomRegistry;
  readonly sinks: { readonly map: Sinks };
  readonly now?: () => number;
  readonly schedule?: (run: () => void, ms: number) => NodeJS.Timeout;
  readonly cancel?: (handle: NodeJS.Timeout) => void;
}

export interface RoomClock {
  /** Die Frist des Raums neu lesen und den Wecker entsprechend stellen. */
  arm(code: string): void;
  disarm(code: string): void;
  disarmAll(): void;
}

export function createRoomClock(deps: RoomClockDeps): RoomClock {
  const now = deps.now ?? ((): number => Date.now());
  const schedule = deps.schedule ?? ((run, ms): NodeJS.Timeout => setTimeout(run, ms));
  const cancel = deps.cancel ?? ((handle): void => clearTimeout(handle));

  const timers = new Map<string, NodeJS.Timeout>();

  function disarm(code: string): void {
    const handle = timers.get(code);
    if (handle === undefined) return;

    cancel(handle);
    timers.delete(code);
  }

  function fire(code: string): void {
    timers.delete(code);

    const room = deps.registry.get(code);
    const before = room?.game ?? null;
    if (room === undefined || before === null) return;

    const due = deadlineOf(before);
    if (due === null) return;

    // `player` ist, wem die Frist gehoerte - er steht im Verlaufssatz.
    const action: GameAction = { type: 'timeout', player: due.owner, at: now() };

    const acted = applySystemAction(room, action);
    // Abgelehnt heisst: die Frist wurde inzwischen anders beendet, etwa durch
    // einen Zuschlag oder die eigene Antwort in einer Wartephase. Dann gibt es
    // nichts mehr abzulaeuten.
    if (!acted.ok) return;

    deps.registry.update(acted.room.code, acted.room, action);

    broadcastGame(
      acted.room,
      deps.sinks.map,
      acted.room.game === null ? undefined : { before, action, after: acted.room.game },
    );

    // Der neue Zustand kann eine neue Frist tragen - nachsehen statt annehmen.
    arm(code);
  }

  function arm(code: string): void {
    disarm(code);

    const game = deps.registry.get(code)?.game ?? null;
    if (game === null) return;

    const due = deadlineOf(game);
    if (due === null) return;

    /*
     * Ein gespeicherter Zeitpunkt, der beim Laden laengst vorbei ist, ist
     * sofort faellig - das rechnet `msUntil`.
     */
    timers.set(
      code,
      schedule(
        () => {
          fire(code);
        },
        msUntil(due, now()),
      ),
    );
  }

  return {
    arm,
    disarm,
    disarmAll: (): void => {
      // Erst sammeln, dann abraeumen: `disarm` fasst die Map an.
      for (const code of [...timers.keys()]) disarm(code);
    },
  };
}
