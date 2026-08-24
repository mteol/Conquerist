import type { GameAction } from '@conquerist/shared';
import type { Room } from './room.js';

/**
 * Wo Raeume liegen, wenn der Prozess nicht mehr laeuft.
 *
 * Eine Schnittstelle und nicht gleich SQLite, aus zwei Gruenden: die
 * Registry-Tests aus Etappe 4 sollen weiter ohne Datei laufen, und eine zweite
 * Umsetzung beweist, dass hier wirklich eine Grenze ist - eine Schnittstelle
 * mit genau einem Implementierer ist meist nur ein umbenannter Aufruf.
 *
 * Was NICHT darin steht: eine laufende Nummer fuer das Log (die weiss der Store
 * besser als sein Aufrufer) und eine Abfrage „in welchen Raeumen sitzt X" (nach
 * `loadAll` liegt alles ohnehin im Speicher).
 */
export interface RoomStore {
  /** Legt den Raum ab oder ersetzt ihn. */
  save(room: Room): void;
  /** Haengt einen angenommenen Zug an das Log dieses Raums. */
  appendAction(code: string, action: GameAction): void;
  remove(code: string): void;
  /**
   * Haelt fest, dass diese Partie abgebrochen wurde.
   *
   * Nicht `remove`: die Partie ist gewesen, und sie soll nachlesbar bleiben -
   * Startzustand und Log bleiben liegen. Nur `loadAll` uebergeht sie ab jetzt,
   * denn dort weiterzuspielen ist genau das, was der Abbruch beendet hat.
   */
  abandon(code: string, at: number): void;
  /** Alle Raeume, jeder mit wiederhergestellter Partie. Ohne die abgebrochenen. */
  loadAll(): Room[];
}

/** Fuer Tests, die keine Datei wollen. */
export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();
  private readonly actions = new Map<string, GameAction[]>();
  private readonly abandoned = new Map<string, number>();

  save(room: Room): void {
    this.rooms.set(room.code, room);
  }

  appendAction(code: string, action: GameAction): void {
    const log = this.actions.get(code);
    if (log === undefined) this.actions.set(code, [action]);
    else log.push(action);
  }

  remove(code: string): void {
    this.rooms.delete(code);
    this.actions.delete(code);
  }

  abandon(code: string, at: number): void {
    // Aus dem Bestand heraus, aber nicht aus der Welt: das Log bleibt liegen,
    // genau wie die Zeile in SQLite stehen bleibt.
    this.rooms.delete(code);
    this.abandoned.set(code, at);
  }

  loadAll(): Room[] {
    return [...this.rooms.values()];
  }

  /** Nur fuer Tests - die Schnittstelle kennt das Log nicht von aussen. */
  actionsOf(code: string): readonly GameAction[] {
    return this.actions.get(code) ?? [];
  }

  /** Nur fuer Tests: wann dieser Raum abgebrochen wurde, oder `undefined`. */
  abandonedAt(code: string): number | undefined {
    return this.abandoned.get(code);
  }
}
