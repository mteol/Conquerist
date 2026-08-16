import { randomInt } from 'node:crypto';

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type GameAction } from '@conquerist/shared';
import { createRoom, type Room, type RoomResult } from './room.js';
import type { RoomStore } from './store.js';

/**
 * Alle Raeume dieses Serverlaufs - im Speicher.
 *
 * Persistenz ist Etappe 6. Bis dahin gilt: ein Neustart wirft laufende Partien
 * weg. Das ist im Betrieb selten und beim Entwickeln laestig (`tsx watch`
 * startet bei jedem Speichern neu) - und es steht als offener Punkt in der
 * Spezifikation.
 *
 * Zufall und Uhr sind einspeisbar, damit die Tests weder das eine noch das
 * andere brauchen.
 */
export interface RegistryOptions {
  readonly randomCode?: () => string;
  readonly now?: () => number;
  /**
   * Wohin Raeume geschrieben werden. Ohne Store laeuft alles wie vor Etappe 6
   * rein im Speicher - genau das brauchen die Tests, die keine Datei wollen.
   */
  readonly store?: RoomStore;
  /** Wird gerufen, wenn ein Raum sich nicht schreiben liess. */
  readonly onWriteError?: (code: string, error: unknown) => void;
}

/** Wie lange ein leerer Raum ueberlebt. */
const EMPTY_ROOM_TTL_MS = 5 * 60_000;

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly randomCode: () => string;
  private readonly now: () => number;
  private readonly store: RoomStore | undefined;
  private readonly onWriteError: (code: string, error: unknown) => void;

  constructor(options: RegistryOptions = {}) {
    this.randomCode = options.randomCode ?? defaultCode;
    this.now = options.now ?? Date.now;
    this.store = options.store;
    this.onWriteError = options.onWriteError ?? ((): void => undefined);
  }

  /** Eine Registry aus dem, was auf der Platte liegt. */
  static load(store: RoomStore, options: RegistryOptions = {}): RoomRegistry {
    const registry = new RoomRegistry({ ...options, store });
    for (const room of store.loadAll()) registry.rooms.set(room.code, room);
    return registry;
  }

  create(
    hostId: string,
    hostName: string,
    seatCount: number,
    seed: string,
    victoryPointGoal: number,
  ): RoomResult {
    const code = this.freeCode();
    if (code === null) return { ok: false, error: 'Kein freier Raumcode - bitte gleich nochmal' };

    const created = createRoom(
      code,
      hostId,
      hostName,
      seatCount,
      seed,
      victoryPointGoal,
      this.now(),
    );
    if (created.ok) {
      this.rooms.set(code, created.room);
      this.write(code, () => this.store?.save(created.room));
    }
    return created;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /**
   * Ein Raum hat sich geaendert - und `appended` ist der Zug, der es ausgeloest
   * hat, falls es einer war. Beitritt, Umstellen und Verlassen kommen ohne.
   */
  update(code: string, next: Room, appended?: GameAction): void {
    if (!this.rooms.has(code)) return;
    this.rooms.set(code, next);

    this.write(code, () => {
      this.store?.save(next);
      if (appended !== undefined) this.store?.appendAction(code, appended);
    });
  }

  remove(code: string): void {
    this.rooms.delete(code);
    this.write(code, () => this.store?.remove(code));
  }

  /** Alle Raeume, in denen dieser Spieler sitzt. */
  roomsOf(userId: string): readonly Room[] {
    return [...this.rooms.values()].filter((room) =>
      room.seats.some((seat) => seat.userId === userId),
    );
  }

  /** In welchem Raum dieser Spieler sitzt - fuer den Reconnect. */
  roomOf(userId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.seats.some((seat) => seat.userId === userId)) return room;
    }
    return undefined;
  }

  get all(): readonly Room[] {
    return [...this.rooms.values()];
  }

  /** Wirft leere Raeume weg, die lange genug leer sind. */
  sweep(): void {
    const deadline = this.now() - EMPTY_ROOM_TTL_MS;
    // Erst sammeln, dann loeschen: `remove` fasst die Map an, ueber die hier
    // iteriert wird.
    const gone = [...this.rooms.values()]
      .filter((room) => room.seats.length === 0 && room.createdAt <= deadline)
      .map((room) => room.code);

    for (const code of gone) this.remove(code);
  }

  /**
   * Schreiben, ohne dass ein Plattenfehler den laufenden Betrieb umwirft.
   *
   * Ein Zug ist bereits regelgerecht angenommen, wenn er hier ankommt. Ihn
   * nachtraeglich am Zustand der Platte scheitern zu lassen hiesse, dass
   * dieselbe Aktion mal gilt und mal nicht. Der Speicher ist die Wahrheit des
   * Betriebs, die Platte die Absicherung.
   */
  private write(code: string, action: () => void): void {
    try {
      action();
    } catch (error) {
      this.onWriteError(code, error);
    }
  }

  /** Ein paar Versuche, dann Aufgabe - besser eine ehrliche Absage als eine Endlosschleife. */
  private freeCode(): string | null {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = this.randomCode();
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }
}

function defaultCode(): string {
  let code = '';
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
