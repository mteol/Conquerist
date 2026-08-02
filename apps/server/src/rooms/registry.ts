import { randomInt } from 'node:crypto';

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@conquerist/shared';
import { createRoom, type Room, type RoomResult } from './room.js';

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
}

/** Wie lange ein leerer Raum ueberlebt. */
const EMPTY_ROOM_TTL_MS = 5 * 60_000;

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly randomCode: () => string;
  private readonly now: () => number;

  constructor(options: RegistryOptions = {}) {
    this.randomCode = options.randomCode ?? defaultCode;
    this.now = options.now ?? Date.now;
  }

  create(hostId: string, hostName: string, seatCount: number, seed: string): RoomResult {
    const code = this.freeCode();
    if (code === null) return { ok: false, error: 'Kein freier Raumcode - bitte gleich nochmal' };

    const created = createRoom(code, hostId, hostName, seatCount, seed, this.now());
    if (created.ok) this.rooms.set(code, created.room);
    return created;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  update(code: string, next: Room): void {
    if (this.rooms.has(code)) this.rooms.set(code, next);
  }

  remove(code: string): void {
    this.rooms.delete(code);
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
    for (const [code, room] of this.rooms) {
      if (room.seats.length === 0 && room.createdAt <= deadline) this.rooms.delete(code);
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
