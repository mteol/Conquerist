import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO, parseAudioSettings } from './settings';

describe('parseAudioSettings', () => {
  it('nimmt die Voreinstellungen, wenn nichts gespeichert ist', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO);
  });

  it('ueberlebt Unsinn im Speicher', () => {
    // Ein kaputter Eintrag darf das Spiel nicht anhalten - ohne Einstellungen
    // gilt eben die Voreinstellung.
    expect(parseAudioSettings('das ist kein JSON')).toEqual(DEFAULT_AUDIO);
    expect(parseAudioSettings('null')).toEqual(DEFAULT_AUDIO);
    expect(parseAudioSettings('[1,2,3]')).toEqual(DEFAULT_AUDIO);
    expect(parseAudioSettings('"laut"')).toEqual(DEFAULT_AUDIO);
  });

  it('liest, was da ist, und ergaenzt, was fehlt', () => {
    const parsed = parseAudioSettings(JSON.stringify({ sfx: { level: 0.5, muted: true } }));

    expect(parsed.sfx).toEqual({ level: 0.5, muted: true });
    expect(parsed.master).toEqual(DEFAULT_AUDIO.master);
    expect(parsed.music).toEqual(DEFAULT_AUDIO.music);
  });

  it('haelt jede Lautstaerke zwischen null und eins', () => {
    const parsed = parseAudioSettings(
      JSON.stringify({ master: { level: 4 }, sfx: { level: -2 }, music: { level: 'laut' } }),
    );

    expect(parsed.master.level).toBe(1);
    expect(parsed.sfx.level).toBe(0);
    expect(parsed.music.level).toBe(DEFAULT_AUDIO.music.level);
  });

  it('nimmt nur echte Wahrheitswerte fuer stumm', () => {
    const parsed = parseAudioSettings(JSON.stringify({ master: { muted: 'ja' } }));

    expect(parsed.master.muted).toBe(false);
  });
});
