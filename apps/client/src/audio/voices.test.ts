import { describe, expect, it } from 'vitest';
import { CUES } from './cues';
import { SAMPLES } from './samples';
import { recipeFor, VOICES, type Layer } from './voices';

const endOf = (layer: Layer): number => (layer.at ?? 0) + (layer.attack ?? 0) + layer.decay;
const firstTone = (layers: readonly Layer[]): number => {
  const tone = layers.find((layer) => layer.kind === 'tone');
  if (tone === undefined || tone.kind !== 'tone') throw new Error('kein Ton in diesem Rezept');
  return tone.from;
};

describe('VOICES', () => {
  it('kennt jeden Cue', () => {
    for (const cue of CUES) {
      expect(VOICES[cue].layers.length).toBeGreaterThan(0);
    }
  });

  it('haelt jeden Klang kurz - nichts laeuft laenger als eine Sekunde', () => {
    for (const cue of CUES) {
      expect(Math.max(...VOICES[cue].layers.map(endOf))).toBeLessThanOrEqual(1000);
    }
  });

  it('laesst den Wuerfel poltern, bevor er landet', () => {
    expect(VOICES['dice.roll'].layers.length).toBeGreaterThanOrEqual(4);

    // Der Ping haengt hinten am Poltern - deshalb traegt er seinen Versatz im
    // Rezept und braucht keinen Zeitplaner darueber.
    expect(VOICES['dice.land'].layers[0]!.at ?? 0).toBeGreaterThan(400);
    expect(VOICES['dice.seven'].layers[0]!.at ?? 0).toBeGreaterThan(400);
  });

  it('stimmt den Landeklang nach der Augensumme', () => {
    const low = recipeFor({ cue: 'dice.land', gain: 1, note: 2 });
    const high = recipeFor({ cue: 'dice.land', gain: 1, note: 12 });

    expect(firstTone(high.layers)).toBeGreaterThan(firstTone(low.layers));
    // Die Sieben liegt in der Mitte: dort steht der Klang so, wie er im Katalog
    // steht.
    expect(firstTone(recipeFor({ cue: 'dice.land', gain: 1, note: 7 }).layers)).toBeCloseTo(
      firstTone(VOICES['dice.land'].layers),
    );
  });

  it('laesst ein Rezept ohne Note unveraendert', () => {
    expect(recipeFor({ cue: 'build.city', gain: 1 })).toEqual(VOICES['build.city']);
  });
});

describe('SAMPLES', () => {
  it('traegt nur Verweise auf Dateien, die es geben koennte', () => {
    // Die Synthese ist die Voreinstellung. Was hier steht, ist eine bewusste
    // Ausnahme - und jede Ausnahme braucht eine Datei unter public/sounds/.
    for (const url of Object.values(SAMPLES)) {
      expect(url).toMatch(/^\/sounds\/.+\.(mp3|ogg|wav)$/);
    }
  });
});
