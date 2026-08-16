import { describe, expect, it } from 'vitest';
import { FOREIGN_GAIN, type Situation } from './cues';
import { cueFor } from './cueFor';

const quiet: Situation = {
  foreign: false,
  gained: 0,
  lost: 0,
  becameMyTurn: false,
  mustDiscard: false,
  offerToMe: false,
  finished: false,
  diceTotal: null,
};

const cues = (sounds: readonly { readonly cue: string }[]): string[] =>
  sounds.map((sound) => sound.cue);

describe('cueFor', () => {
  it('gibt jedem Bauzug seinen eigenen Klang', () => {
    expect(cues(cueFor({ type: 'buildRoad', actor: 'a' }, quiet))).toEqual(['build.road']);
    expect(cues(cueFor({ type: 'buildSettlement', actor: 'a' }, quiet))).toEqual([
      'build.settlement',
    ]);
    expect(cues(cueFor({ type: 'buildCity', actor: 'a' }, quiet))).toEqual(['build.city']);
  });

  it('nimmt die Gruendungszuege auf dieselben Klaenge', () => {
    expect(cues(cueFor({ type: 'placeSetupRoad', actor: 'a' }, quiet))).toEqual(['build.road']);
    expect(cues(cueFor({ type: 'placeSetupSettlement', actor: 'a' }, quiet))).toEqual([
      'build.settlement',
    ]);
  });

  it('laesst den Wurf poltern und danach landen, mit der Augensumme als Ton', () => {
    const sounds = cueFor({ type: 'rollDice', actor: 'a' }, { ...quiet, diceTotal: 9 });

    expect(cues(sounds)).toEqual(['dice.roll', 'dice.land']);
    expect(sounds[1]!.note).toBe(9);
  });

  it('gibt der Sieben einen eigenen Klang statt eines hohen Pings', () => {
    const sounds = cueFor({ type: 'rollDice', actor: 'a' }, { ...quiet, diceTotal: 7 });

    expect(cues(sounds)).toEqual(['dice.roll', 'dice.seven']);
  });

  it('haengt den Ertrag an, wenn Karten zugelaufen sind', () => {
    const sounds = cueFor({ type: 'rollDice', actor: 'a' }, { ...quiet, diceTotal: 5, gained: 2 });

    expect(cues(sounds)).toContain('gain.self');
  });

  it('daempft fremde Zuege', () => {
    const sounds = cueFor({ type: 'buildCity', actor: 'b' }, { ...quiet, foreign: true });

    expect(sounds[0]!.gain).toBe(FOREIGN_GAIN);
  });

  it('nimmt die Daempfung zurueck, wenn der fremde Zug mich trifft', () => {
    const robbed = cueFor({ type: 'moveRobber', actor: 'b' }, { ...quiet, foreign: true, lost: 1 });
    expect(robbed.every((sound) => sound.gain === 1)).toBe(true);

    const offered = cueFor(
      { type: 'offerTrade', actor: 'b' },
      { ...quiet, foreign: true, offerToMe: true },
    );
    expect(offered[0]!.gain).toBe(1);
  });

  it('meldet den eigenen Zug, das Abwerfen und das Ende zusaetzlich', () => {
    expect(cues(cueFor({ type: 'endTurn', actor: 'b' }, { ...quiet, becameMyTurn: true }))).toEqual(
      ['turn.mine'],
    );
    expect(
      cues(cueFor({ type: 'rollDice', actor: 'b' }, { ...quiet, diceTotal: 7, mustDiscard: true })),
    ).toContain('discard.required');
    expect(cues(cueFor({ type: 'buildCity', actor: 'a' }, { ...quiet, finished: true }))).toContain(
      'game.over',
    );
  });

  it('bleibt still, wo Ton nur stoeren wuerde', () => {
    expect(cueFor({ type: 'endTurn', actor: 'a' }, quiet)).toEqual([]);
    expect(cueFor({ type: 'dropFromTrade', actor: 'b' }, { ...quiet, foreign: true })).toEqual([]);
    expect(cueFor({ type: 'rejoinTrade', actor: 'b' }, { ...quiet, foreign: true })).toEqual([]);
  });
});
