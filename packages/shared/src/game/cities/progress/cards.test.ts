import { describe, expect, it } from 'vitest';

import {
  FULL_PROGRESS_DECK,
  PROGRESS_CARD_IDS,
  PROGRESS_NAMES,
  PROGRESS_TEXTS,
  PROGRESS_TRACK,
} from './cards.js';

describe('Fortschrittskarten', () => {
  it('kennt fuenfundzwanzig Arten', () => {
    expect(PROGRESS_CARD_IDS).toHaveLength(25);
    expect(new Set(PROGRESS_CARD_IDS).size).toBe(25);
  });

  it('legt achtzehn Karten auf jeden der drei Stapel', () => {
    const perTrack = { science: 0, trade: 0, politics: 0 };
    for (const id of PROGRESS_CARD_IDS) perTrack[PROGRESS_TRACK[id]] += FULL_PROGRESS_DECK[id];
    expect(perTrack).toEqual({ science: 18, trade: 18, politics: 18 });
  });

  it('gibt jeder Karte einen Namen und einen Wirkungssatz', () => {
    for (const id of PROGRESS_CARD_IDS) {
      expect(PROGRESS_NAMES[id]).not.toBe('');
      expect(PROGRESS_TEXTS[id]).not.toBe('');
    }
  });

  /*
   * Die Namen stehen auf der Karte und damit vor dem Spieler - die Grenze aus
   * dem Playtest verlangt dort echte Umlaute. Ein Test dafuer, weil genau
   * diese Regel in 10c viermal gerissen ist.
   */
  it('schreibt die sichtbaren Namen mit Umlauten', () => {
    expect(PROGRESS_NAMES.irrigation).toBe('Bewässerung');
    expect(PROGRESS_NAMES.masterMerchant).toBe('Großhändler');
    expect(PROGRESS_NAMES.warlord).toBe('Heerführer');
  });
});
