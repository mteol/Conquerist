import { describe, expect, it } from 'vitest';
import { ACT, CREATE_ROOM, HELLO, JOIN_ROOM, RoomCodeSchema } from './room.js';
import { isMessageType, protocolEntry } from './registry.js';

describe('Raum-Protokoll', () => {
  it('meldet die neuen Typen als bekannt', () => {
    // `as const` haelt die Literaltypen fest - sonst weitet das Array-Literal
    // sie zu `string`, und `protocolEntry` nimmt nur bekannte Typen an.
    for (const type of [HELLO, CREATE_ROOM, JOIN_ROOM, ACT] as const) {
      expect(isMessageType(type)).toBe(true);
      expect(protocolEntry(type).responseType).toBeTruthy();
    }
  });

  it('nimmt Raumcodes nur in kanonischer Form an', () => {
    expect(RoomCodeSchema.safeParse('K7X2').success).toBe(true);
    // Kleinbuchstaben werden angehoben, damit vorgelesene Codes ankommen.
    expect(RoomCodeSchema.parse('k7x2')).toBe('K7X2');
    // Verwechslungsgefahr: O, 0, I und 1 kommen im Alphabet nicht vor.
    expect(RoomCodeSchema.safeParse('K0X2').success).toBe(false);
    expect(RoomCodeSchema.safeParse('K7X').success).toBe(false);
    expect(RoomCodeSchema.safeParse('K7X22').success).toBe(false);
  });

  it('verlangt bei createRoom eine Tischgroesse im erlaubten Bereich', () => {
    const entry = protocolEntry(CREATE_ROOM);
    expect(entry.request.safeParse({ seatCount: 3, seed: 'abc' }).success).toBe(true);
    expect(entry.request.safeParse({ seatCount: 2, seed: 'abc' }).success).toBe(false);
    expect(entry.request.safeParse({ seatCount: 7, seed: 'abc' }).success).toBe(false);
  });

  it('nimmt bei act nur eine gueltige Spielaktion an', () => {
    const entry = protocolEntry(ACT);
    expect(entry.request.safeParse({ action: { type: 'rollDice', player: 'p1' } }).success).toBe(
      true,
    );
    expect(entry.request.safeParse({ action: { type: 'schummeln', player: 'p1' } }).success).toBe(
      false,
    );
  });
});
