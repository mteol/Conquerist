import type { Cue, Sound } from './cues';

/**
 * Ein Klang ist eine Liste Schichten, und eine Schicht ist Zahlen.
 *
 * Absichtlich Daten statt Code: so ist der ganze Katalog im node-Test
 * nachrechenbar, und `engine.ts` bleibt eine dumme Uebersetzung nach WebAudio.
 * Zeiten in Millisekunden, Frequenzen in Hertz, `gain` von 0 bis 1.
 */
export type Layer = {
  /** Versatz zum Beginn des Klangs. */
  readonly at?: number;
  readonly attack?: number;
  readonly decay: number;
  readonly gain: number;
} & (
  | {
      readonly kind: 'tone';
      readonly wave: OscillatorType;
      readonly from: number;
      readonly to?: number;
    }
  | {
      readonly kind: 'noise';
      readonly filter: BiquadFilterType;
      readonly from: number;
      readonly to?: number;
      readonly q?: number;
    }
);

export interface Recipe {
  readonly layers: readonly Layer[];
}

/*
 * Die Klangwelt: ein Holztisch, kein Raumschiff.
 *
 * Gefiltertes Rauschen fuer alles, was aufgesetzt wird; gestimmte Toene mit
 * schnellem Abfall fuer alles, was gemeldet wird. Die Toene liegen auf einer
 * Pentatonik ueber A3, damit zwei gleichzeitige Klaenge nie schief zueinander
 * stehen. Laut werden nur der Wuerfel und das Ende - alles andere ordnet sich
 * unter, wie die Panels unter dem Brett.
 */
const A3 = 220;

/** Holz auf Holz: ein kurzer Rauschstoss durch ein enges Band. */
const knock = (at: number, gain: number, from: number): Layer => ({
  kind: 'noise',
  filter: 'bandpass',
  from,
  q: 1.4,
  at,
  attack: 1,
  decay: 70,
  gain,
});

export const VOICES: Record<Cue, Recipe> = {
  'ui.click': { layers: [knock(0, 0.16, 1800)] },
  /*
   * Papier statt Holz: ein kurzer, weicher Rauschstrich nach unten. Leiser als
   * der Klick - eine Karte anzuheben ist keine Handlung, die sich meldet,
   * sondern eine, die man nebenbei tut.
   */
  'ui.card': {
    layers: [
      {
        kind: 'noise',
        filter: 'bandpass',
        from: 3400,
        to: 2100,
        q: 0.7,
        attack: 4,
        decay: 75,
        gain: 0.13,
      },
    ],
  },
  'ui.confirm': {
    layers: [
      {
        kind: 'tone',
        wave: 'triangle',
        from: A3 * 2,
        to: A3 * 3,
        attack: 2,
        decay: 90,
        gain: 0.16,
      },
    ],
  },
  'ui.cancel': {
    layers: [
      {
        kind: 'tone',
        wave: 'triangle',
        from: A3 * 2,
        to: A3 * 1.5,
        attack: 2,
        decay: 90,
        gain: 0.14,
      },
    ],
  },
  // Zwei tiefe Toene abwaerts - kein Summer. Eine abgelehnte Aktion ist ein
  // Hinweis, keine Strafe.
  'ui.error': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 0.75, attack: 3, decay: 130, gain: 0.2 },
      { kind: 'tone', wave: 'sine', from: A3 * 0.6, at: 110, attack: 3, decay: 190, gain: 0.2 },
    ],
  },

  'build.road': {
    layers: [
      knock(0, 0.3, 700),
      { kind: 'tone', wave: 'sine', from: A3, attack: 2, decay: 110, gain: 0.14 },
    ],
  },
  'build.settlement': {
    layers: [
      knock(0, 0.34, 900),
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 2, decay: 150, gain: 0.16 },
    ],
  },
  // Zwei Toene aufwaerts auf einem tieferen Klopfen: man hoert die Groesse.
  'build.city': {
    layers: [
      knock(0, 0.4, 620),
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 2, decay: 160, gain: 0.17 },
      { kind: 'tone', wave: 'sine', from: A3 * 2, at: 90, attack: 2, decay: 220, gain: 0.17 },
    ],
  },

  // Fuenf Ticks, unregelmaessig - regelmaessig klaenge es nach Maschine.
  'dice.roll': {
    layers: [
      knock(0, 0.22, 2600),
      knock(90, 0.18, 2200),
      knock(170, 0.2, 2900),
      knock(260, 0.16, 2400),
      knock(380, 0.14, 3100),
    ],
  },
  'dice.land': {
    layers: [
      { kind: 'tone', wave: 'triangle', from: A3 * 2, at: 500, attack: 2, decay: 260, gain: 0.26 },
    ],
  },
  'dice.seven': {
    layers: [
      {
        kind: 'tone',
        wave: 'sawtooth',
        from: A3 * 0.75,
        to: A3 * 0.5,
        at: 500,
        attack: 4,
        decay: 420,
        gain: 0.24,
      },
      {
        kind: 'noise',
        filter: 'lowpass',
        from: 900,
        to: 300,
        at: 500,
        attack: 4,
        decay: 380,
        gain: 0.18,
      },
    ],
  },

  /*
   * Je Karte ein Blip, aufsteigend - wie viele davon klingen, sagt `count` am
   * Vorfall. Vier Schichten, weil dort gedeckelt wird: mehr wird ein Wischen
   * statt einer Zahl.
   */
  'gain.self': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 2, attack: 2, decay: 90, gain: 0.14 },
      { kind: 'tone', wave: 'sine', from: A3 * 2.25, at: 70, attack: 2, decay: 90, gain: 0.13 },
      { kind: 'tone', wave: 'sine', from: A3 * 2.5, at: 140, attack: 2, decay: 110, gain: 0.12 },
      { kind: 'tone', wave: 'sine', from: A3 * 3, at: 210, attack: 2, decay: 130, gain: 0.12 },
    ],
  },

  'robber.move': {
    layers: [
      { kind: 'noise', filter: 'lowpass', from: 700, to: 180, attack: 6, decay: 320, gain: 0.26 },
      { kind: 'tone', wave: 'sine', from: A3 * 0.5, attack: 6, decay: 260, gain: 0.18 },
    ],
  },
  'robber.steal': {
    layers: [
      {
        kind: 'noise',
        filter: 'highpass',
        from: 1200,
        to: 4200,
        attack: 8,
        decay: 200,
        gain: 0.2,
      },
    ],
  },
  'discard.required': {
    layers: [
      { kind: 'tone', wave: 'triangle', from: A3 * 1.5, attack: 3, decay: 140, gain: 0.2 },
      {
        kind: 'tone',
        wave: 'triangle',
        from: A3 * 1.25,
        at: 130,
        attack: 3,
        decay: 200,
        gain: 0.2,
      },
    ],
  },

  'card.buy': {
    layers: [
      {
        kind: 'noise',
        filter: 'bandpass',
        from: 2600,
        to: 1400,
        q: 0.8,
        attack: 6,
        decay: 180,
        gain: 0.2,
      },
    ],
  },
  'card.knight': {
    layers: [
      knock(0, 0.34, 1500),
      { kind: 'tone', wave: 'square', from: A3 * 1.5, attack: 2, decay: 130, gain: 0.1 },
    ],
  },
  'card.play': {
    layers: [
      {
        kind: 'tone',
        wave: 'triangle',
        from: A3 * 1.5,
        to: A3 * 2.25,
        attack: 3,
        decay: 190,
        gain: 0.18,
      },
    ],
  },

  // Der einzige Klang, der ruft.
  'trade.offer': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 2, attack: 3, decay: 150, gain: 0.22 },
      { kind: 'tone', wave: 'sine', from: A3 * 3, at: 140, attack: 3, decay: 240, gain: 0.22 },
    ],
  },
  'trade.accept': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 3, decay: 130, gain: 0.2 },
      { kind: 'tone', wave: 'sine', from: A3 * 2.25, at: 110, attack: 3, decay: 200, gain: 0.2 },
    ],
  },
  'trade.reject': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 3, decay: 130, gain: 0.18 },
      { kind: 'tone', wave: 'sine', from: A3, at: 110, attack: 3, decay: 200, gain: 0.18 },
    ],
  },
  'trade.timeout': {
    layers: [
      {
        kind: 'tone',
        wave: 'sine',
        from: A3,
        to: A3 * 0.75,
        attack: 6,
        decay: 380,
        gain: 0.16,
      },
    ],
  },

  'turn.mine': {
    layers: [
      { kind: 'tone', wave: 'sine', from: A3 * 1.5, attack: 4, decay: 200, gain: 0.24 },
      { kind: 'tone', wave: 'sine', from: A3 * 2.25, at: 160, attack: 4, decay: 300, gain: 0.24 },
    ],
  },
  // Die einzige Stelle mit Melodie - hier wird die Boldness ausgegeben.
  'game.over': {
    layers: [
      { kind: 'tone', wave: 'triangle', from: A3 * 1.5, attack: 4, decay: 220, gain: 0.28 },
      { kind: 'tone', wave: 'triangle', from: A3 * 2, at: 170, attack: 4, decay: 240, gain: 0.28 },
      { kind: 'tone', wave: 'triangle', from: A3 * 3, at: 340, attack: 4, decay: 420, gain: 0.28 },
    ],
  },
};

/**
 * Das Rezept zu einem Vorfall - gestimmt, wenn er eine Note mitbringt.
 *
 * Ein Halbton je Auge, um die Sieben herum: die Zwei liegt tief, die Zwoelf
 * hoch, dazwischen steigt es gleichmaessig. Die Zahl steht sichtbar auf dem
 * Brett; der Ton kommt dazu und ersetzt sie nicht.
 */
export function recipeFor(sound: Sound): Recipe {
  const base = VOICES[sound.cue];

  // `count` kuerzt die Figur auf so viele Schichten, wie der Vorfall hergibt.
  const layers =
    sound.count === undefined
      ? base.layers
      : base.layers.slice(0, Math.max(1, Math.min(base.layers.length, sound.count)));

  if (sound.note === undefined) return layers === base.layers ? base : { layers };

  const factor = 2 ** ((sound.note - 7) / 12);

  return {
    layers: layers.map((layer) =>
      layer.kind === 'tone'
        ? {
            ...layer,
            from: layer.from * factor,
            ...(layer.to === undefined ? {} : { to: layer.to * factor }),
          }
        : layer,
    ),
  };
}
