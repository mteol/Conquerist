import { describe, expect, it } from 'vitest';

import { EMPTY_CARDS } from '../cards.js';
import { gameWithCities } from '../fixtures.js';
import type { PlayerState } from '../player.js';
import {
  AQUEDUCT_LEVEL,
  FORTRESS_LEVEL,
  GUILD_LEVEL,
  MAX_TRACK_LEVEL,
  METROPOLIS_LEVEL,
  TRACK_BONUS_LEVEL,
  TRACK_COMMODITY,
  TRACK_IDS,
  TRACK_STEPS,
  hasAqueduct,
  hasFortress,
  hasGuild,
  improvementCost,
  levelOf,
  progressThreshold,
  stepInAccusative,
  stepName,
  stepWithArticle,
} from './tracks.js';

function playerWith(improvements: PlayerState['improvements']): PlayerState {
  return { ...gameWithCities().players[0]!, improvements };
}

describe('Die drei Bereiche', () => {
  it('haben je fuenf Stufen', () => {
    for (const track of TRACK_IDS) {
      expect(TRACK_STEPS[track]).toHaveLength(MAX_TRACK_LEVEL);
    }
  });

  it('werden je mit einer eigenen Handelsware bezahlt', () => {
    expect(new Set(Object.values(TRACK_COMMODITY)).size).toBe(TRACK_IDS.length);
  });

  it('nennt die dritte Stufe beim Namen', () => {
    expect(stepName('science', 3)).toBe('Aquädukt');
    expect(stepName('trade', 3)).toBe('Gilde');
    expect(stepName('politics', 3)).toBe('Festung');
  });

  it('kennt zu jedem Namen seinen Artikel', () => {
    expect(stepWithArticle('trade', 3)).toBe('die Gilde');
    expect(stepWithArticle('science', 4)).toBe('das Theater');
    expect(stepWithArticle('politics', 5)).toBe('der Rat Catans');
  });

  it('wirft fuer eine Stufe, die es nicht gibt', () => {
    expect(() => stepName('trade', 6)).toThrow(RangeError);
  });

  it('beugt den maskulinen Artikel im Akkusativ, laesst feminin und neutral stehen', () => {
    // "der Markt" und "der Rat Catans" sind die einzigen zwei maskulinen
    // Namen unter den fuenfzehn Stufen - beide muessen zu "den" werden.
    expect(stepInAccusative('trade', 1)).toBe('den Markt');
    expect(stepInAccusative('politics', 5)).toBe('den Rat Catans');

    // Feminin und neutral bleiben unveraendert - Nominativ und Akkusativ
    // sehen dort gleich aus.
    expect(stepInAccusative('trade', 3)).toBe('die Gilde');
    expect(stepInAccusative('science', 4)).toBe('das Theater');
  });

  it('setzen Festung und Metropole auf die Stufen, an denen sie haengen', () => {
    expect(FORTRESS_LEVEL).toBe(3);
    expect(METROPOLIS_LEVEL).toBe(4);
  });

  // M2 der Abschlussreview: der Client (`TrackPanel.tsx`) fragte bisher mit
  // einem Literal `step === 3`, statt hier nachzusehen - eine Verschiebung
  // von `AQUEDUCT_LEVEL`, `GUILD_LEVEL` oder `FORTRESS_LEVEL` haette die
  // Anzeige nicht mitgenommen. `TRACK_BONUS_LEVEL` buendelt die drei bewusst
  // getrennten Konstanten nur im Zugriff, nicht im Wert.
  it('nennt je Bereich die eigene Zusatznutzenstufe, ohne die drei Konstanten zusammenzufassen', () => {
    expect(TRACK_BONUS_LEVEL.trade).toBe(GUILD_LEVEL);
    expect(TRACK_BONUS_LEVEL.politics).toBe(FORTRESS_LEVEL);
    expect(TRACK_BONUS_LEVEL.science).toBe(AQUEDUCT_LEVEL);
  });
});

describe('improvementCost', () => {
  it('nimmt fuer die n-te Stufe n Handelswaren ihrer Sorte', () => {
    expect(improvementCost('trade', 1)).toEqual({ ...EMPTY_CARDS, cloth: 1 });
    expect(improvementCost('science', 4)).toEqual({ ...EMPTY_CARDS, paper: 4 });
    expect(improvementCost('politics', 5)).toEqual({ ...EMPTY_CARDS, coin: 5 });
  });

  it('wirft fuer eine Stufe, die es nicht gibt', () => {
    expect(() => improvementCost('trade', 0)).toThrow(RangeError);
    expect(() => improvementCost('trade', 6)).toThrow(RangeError);
  });
});

describe('progressThreshold', () => {
  it('gibt Stufe plus eins', () => {
    expect(progressThreshold(1)).toBe(2);
    expect(progressThreshold(5)).toBe(6);
  });
});

describe('levelOf und der Zusatznutzen', () => {
  it('nennt einen nicht begonnenen Bereich null', () => {
    expect(levelOf(playerWith({}), 'science')).toBe(0);
  });

  it('gibt das Aquaedukt ab Wissenschaft drei', () => {
    expect(hasAqueduct(playerWith({ science: 2 }))).toBe(false);
    expect(hasAqueduct(playerWith({ science: 3 }))).toBe(true);
  });

  it('gibt die Gilde ab Handel drei', () => {
    expect(hasGuild(playerWith({ trade: 2 }))).toBe(false);
    expect(hasGuild(playerWith({ trade: 3 }))).toBe(true);
  });

  it('gibt die Festung ab Politik drei', () => {
    expect(hasFortress(playerWith({ politics: 2 }))).toBe(false);
    expect(hasFortress(playerWith({ politics: 3 }))).toBe(true);
  });

  it('haelt die drei auseinander', () => {
    const nurHandel = playerWith({ trade: 5 });
    expect(hasGuild(nurHandel)).toBe(true);
    expect(hasAqueduct(nurHandel)).toBe(false);
    expect(hasFortress(nurHandel)).toBe(false);
  });
});
