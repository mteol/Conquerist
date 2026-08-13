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
  /** Alle Raeume, jeder mit wiederhergestellter Partie. */
  loadAll(): Room[];
}

/** Fuer Tests, die keine Datei wollen. */
export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();
  private readonly actions = new Map<string, GameAction[]>();

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

  loadAll(): Room[] {
    return [...this.rooms.values()];
  }

  /** Nur fuer Tests - die Schnittstelle kennt das Log nicht von aussen. */
  actionsOf(code: string): readonly GameAction[] {
    return this.actions.get(code) ?? [];
  }
}
