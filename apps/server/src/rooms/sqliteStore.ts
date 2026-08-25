import {
  GameActionSchema,
  GameStateSchema,
  replay,
  seatColorAt,
  type GameAction,
  type GameState,
} from '@conquerist/shared';
import type { AppDatabase } from '../db/database.js';
import type { Room, RoomSeat } from './room.js';
import type { RoomStore } from './store.js';

/**
 * Raeume in SQLite.
 *
 * Gespeichert wird der Startzustand plus die Folge der angenommenen Zuege;
 * wiederhergestellt wird durch `replay`. Kein Snapshot: gemessen dauert die
 * Wiederherstellung einer kuenstlich verlaengerten Partie mit 4000 Zuegen
 * 19 ms, und ein Snapshot waere eine zweite Darstellung desselben
 * Sachverhalts - eine, die von der ersten abweichen kann, ohne dass es jemand
 * merkt.
 *
 * Der Startzustand geht als Ganzes auf die Platte und nicht nur als Seed: ein
 * `GameState` traegt Szenario und RuleSet als Kopie in sich, und damit spielt
 * eine alte Partie auch nach einer Aenderung an `CLASSIC_RULES` unter den
 * Regeln weiter, unter denen sie begonnen hat.
 */
interface RoomRow {
  readonly code: string;
  readonly host_id: string;
  readonly seat_count: number;
  readonly seed: string;
  readonly victory_point_goal: number;
  readonly variant: string;
  readonly version: number;
  readonly created_at: number;
  readonly start_state: string | null;
}

interface SeatRow {
  readonly position: number;
  readonly user_id: string;
  readonly name: string;
  /** `null` nur bei Zeilen, die der vierte Migrationsschritt nicht erreicht hat. */
  readonly color: string | null;
  /** SQLite kennt kein Boolean - 0 oder 1. */
  readonly away: number;
}

export class SqliteRoomStore implements RoomStore {
  constructor(
    private readonly database: AppDatabase,
    /** Wird gerufen, wenn ein Raum beim Laden uebersprungen wird. */
    private readonly log: (message: string, detail: unknown) => void = () => undefined,
  ) {}

  save(room: Room): void {
    const finishedAt = room.game?.phase.kind === 'finished' ? Date.now() : null;

    const write = this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO rooms (code, host_id, seat_count, seed, victory_point_goal, variant, version, created_at, start_state, finished_at)
           VALUES (@code, @hostId, @seatCount, @seed, @victoryPointGoal, @variant, @version, @createdAt, @startState, @finishedAt)
           ON CONFLICT(code) DO UPDATE SET
             host_id = @hostId, seat_count = @seatCount, seed = @seed,
             victory_point_goal = @victoryPointGoal, variant = @variant,
             version = @version, finished_at = @finishedAt,
             -- Der Startzustand wird nie ueberschrieben: er entsteht einmal
             -- beim Start und ist danach der Anker fuer das ganze Log.
             start_state = COALESCE(rooms.start_state, @startState)`,
        )
        .run({
          code: room.code,
          hostId: room.hostId,
          seatCount: room.seatCount,
          seed: room.seed,
          victoryPointGoal: room.victoryPointGoal,
          variant: room.variant,
          version: room.version,
          createdAt: room.createdAt,
          startState: room.game === null ? null : JSON.stringify(room.game),
          finishedAt,
        });

      this.database.prepare('DELETE FROM room_seats WHERE code = ?').run(room.code);
      const seat = this.database.prepare(
        'INSERT INTO room_seats (code, position, user_id, color, away) VALUES (?, ?, ?, ?, ?)',
      );
      room.seats.forEach((entry, position) => {
        seat.run(room.code, position, entry.userId, entry.color, entry.away ? 1 : 0);
      });
    });

    write();
  }

  appendAction(code: string, action: GameAction): void {
    this.database
      .prepare(
        `INSERT INTO room_actions (code, ordinal, action)
         VALUES (?, (SELECT COALESCE(MAX(ordinal) + 1, 0) FROM room_actions WHERE code = ?), ?)`,
      )
      .run(code, code, JSON.stringify(action));
  }

  remove(code: string): void {
    this.database.prepare('DELETE FROM rooms WHERE code = ?').run(code);
  }

  /**
   * Abgebrochen - die Zeile bleibt, der Raum verschwindet aus dem Betrieb.
   *
   * `WHERE abandoned_at IS NULL` haelt den ersten Abbruch fest: kaeme ein
   * zweiter hinterher (zweiter Tab, doppelter Klick), verschoebe er sonst den
   * Zeitpunkt auf den spaeteren. Abgebrochen wurde die Partie aber, als der
   * erste ausgestiegen ist.
   */
  abandon(code: string, at: number): void {
    this.database
      .prepare('UPDATE rooms SET abandoned_at = ? WHERE code = ? AND abandoned_at IS NULL')
      .run(at, code);
  }

  loadAll(): Room[] {
    const rows = this.database
      .prepare('SELECT * FROM rooms WHERE abandoned_at IS NULL ORDER BY created_at')
      .all() as RoomRow[];

    const rooms: Room[] = [];
    for (const row of rows) {
      const room = this.rebuild(row);
      if (room !== null) rooms.push(room);
    }
    return rooms;
  }

  /** Ein Raum aus seiner Zeile - oder `null`, wenn er sich nicht bauen laesst. */
  private rebuild(row: RoomRow): Room | null {
    const seatRows = this.database
      .prepare(
        `SELECT s.position, s.user_id, s.color, s.away, u.name
         FROM room_seats s JOIN users u ON u.id = s.user_id
         WHERE s.code = ? ORDER BY s.position`,
      )
      .all(row.code) as SeatRow[];

    const seats: RoomSeat[] = seatRows.map((entry, index) => ({
      userId: entry.user_id,
      name: entry.name,
      // Die Farbe steht seit Etappe 10 in der Zeile, weil sie gewaehlt wird und
      // nicht mehr aus der Position folgt. Die Position bleibt als Rueckfall:
      // sie ist genau das, was frueher galt.
      color: entry.color ?? seatColorAt(index),
      // Verbunden ist eine Eigenschaft dieses Serverlaufs. Nach einem Neustart
      // ist niemand verbunden, bis er sich meldet.
      connected: false,
      // Weggegangen ist dagegen eine Entscheidung, und die ueberlebt den
      // Neustart - sonst saesse nach jedem wieder jeder an dem Tisch, den er
      // verlassen hat.
      away: entry.away === 1,
    }));

    let game: GameState | null = null;
    if (row.start_state !== null) {
      const rebuilt = this.rebuildGame(row.code, row.start_state);
      if (rebuilt === null) return null;
      game = rebuilt;
    }

    return {
      code: row.code,
      hostId: row.host_id,
      seatCount: row.seat_count,
      seed: row.seed,
      victoryPointGoal: row.victory_point_goal,
      /*
       * Eine Zeile aus der Zeit vor der Erweiterung traegt `classic` aus dem
       * `DEFAULT` des Migrationsschritts. Der Riegel hier faengt trotzdem ab,
       * was die Spalte sonst noch enthalten koennte - eine unbekannte Variante
       * waere ein Regelwerk, das es nicht gibt.
       */
      variant: row.variant === 'cities' ? 'cities' : 'classic',
      seats,
      game,
      version: row.version,
      createdAt: row.created_at,
    };
  }

  private rebuildGame(code: string, startState: string): GameState | null {
    const start = GameStateSchema.safeParse(JSON.parse(startState));
    if (!start.success) {
      this.log('Startzustand passt nicht mehr zum Schema', { code });
      return null;
    }

    const rows = this.database
      .prepare('SELECT action FROM room_actions WHERE code = ? ORDER BY ordinal')
      .all(code) as { action: string }[];

    const actions: GameAction[] = [];
    for (const entry of rows) {
      const parsed = GameActionSchema.safeParse(JSON.parse(entry.action));
      if (!parsed.success) {
        this.log('Zug im Log passt nicht mehr zum Schema', { code });
        return null;
      }
      actions.push(parsed.data);
    }

    const result = replay(start.data, actions);
    if (!result.ok) {
      // Uebersprungen statt geworfen: eine kaputte Partie darf nicht alle
      // anderen mitnehmen. Sie bleibt in der Datenbank und laesst sich ansehen.
      this.log('Partie laesst sich nicht wiederherstellen', { code, error: result.error.message });
      return null;
    }

    return result.state;
  }
}
