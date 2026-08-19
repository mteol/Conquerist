import type { Sound } from './cues';
import { SAMPLES } from './samples';
import type { AudioSettings, BusSetting } from './settings';
import { recipeFor, type Layer } from './voices';

/**
 * Die Uebersetzung nach WebAudio - und sonst nichts.
 *
 * **Diese Datei hat bewusst keinen Test.** In node gibt es keinen
 * `AudioContext`; ein nachgebauter pruefte den Nachbau. Deshalb liegt alles,
 * was entscheidet, darueber - `cueFor` (welcher Klang), `situation` (welche
 * Lage), `voices` (welche Vorschrift), `settings` (welcher Pegel) - und ist
 * dort geprueft. Hier bleibt Verdrahtung, damit ihr Ungeprueftsein billig ist.
 * Nachgesehen wird sie im Browser, mit Ohren.
 *
 * Der Kontext entsteht **beim ersten Klang**, nicht beim Laden: Browser geben
 * Audio erst nach einer Nutzergeste frei, und ein vorher gebauter Kontext
 * startet suspendiert und schreibt eine Warnung in die Konsole.
 */
export interface Engine {
  readonly play: (sound: Sound) => void;
  /**
   * Startet die Hintergrundspur.
   *
   * Beliebig oft aufrufbar, und genau darauf kommt es an: der erste Anlauf
   * kann am Autoplay-Riegel scheitern, und dann bekommt ihn die naechste Geste
   * noch einmal. Laeuft die Spur schon, tut der Aufruf nichts.
   */
  readonly playMusic: (url: string) => void;
  readonly apply: (settings: AudioSettings) => void;
  readonly close: () => void;
}

/**
 * Wie viele **Klaenge** gleichzeitig - darueber wird es eine Wand statt eines
 * Spiels.
 *
 * Gezaehlt werden Cues und nicht ihre Schichten, und das ist der Unterschied
 * zwischen einer Grenze und einem Fehler: ein Wuerfelwurf besteht aus sechs
 * Schichten (Klick plus fuenf Ticks). Mit einer Schichtgrenze von acht fiel
 * danach alles weg, was noch kam - im Browser gemessen: der Verlauf meldete
 * „Spieler 1 +2", und der Ertragsklang kam nicht. Ein Klang ist eine Einheit;
 * angefangen wird er ganz oder gar nicht.
 */
const MAX_CUES = 6;
/** Derselbe Cue zweimal innerhalb dieser Spanne ist einmal zu viel. */
const DEDUPE_MS = 60;

export function createEngine(): Engine {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  /** Die laufende Hintergrundspur - `null`, solange keine gebaut ist. */
  let track: HTMLAudioElement | null = null;
  /** Das Anhalten wartet auf die Blende. `null`, wenn nichts aussteht. */
  let fade: ReturnType<typeof setTimeout> | null = null;
  let settings: AudioSettings | null = null;

  const buffers = new Map<string, AudioBuffer>();
  const lastPlayed = new Map<string, number>();
  const running = new Set<ReturnType<typeof setTimeout>>();

  const apply = (next: AudioSettings): void => {
    settings = next;
    if (context === null || master === null || sfx === null || music === null) return;

    const levelOf = (bus: BusSetting): number => (bus.muted ? 0 : bus.level);
    // Kurze Rampe statt Sprung: ein harter Gain-Wechsel knackt hoerbar.
    const at = context.currentTime;
    master.gain.setTargetAtTime(levelOf(next.master), at, 0.02);
    sfx.gain.setTargetAtTime(levelOf(next.sfx), at, 0.02);
    music.gain.setTargetAtTime(levelOf(next.music), at, 0.02);

    /*
     * Stumm heisst still, nicht leise.
     *
     * Der Regler auf null laesst die Spur weiterlaufen - er ist eine
     * Lautstaerke, und wer ihn wieder aufdreht, will dort weiterhoeren, wo das
     * Stueck inzwischen steht. Der Stummschalter ist dagegen ein Schalter: eine
     * Spur, die niemand hoert, soll auch keine Leitung und keinen Takt kosten.
     */
    if (track !== null) {
      const stopping = track;
      if (fade !== null) {
        clearTimeout(fade);
        fade = null;
      }

      if (next.master.muted || next.music.muted) {
        /*
         * Erst ausblenden, dann anhalten - und nicht umgekehrt.
         *
         * `pause()` mitten in der Rampe schneidet die Welle ab, wo sie gerade
         * steht, und das hoert man als Knacks. Es ist derselbe Grund, aus dem
         * die Regler oben rampen statt zu springen; 120 ms sind rund das
         * Sechsfache der Zeitkonstante, also praktisch Stille.
         */
        fade = setTimeout(() => {
          stopping.pause();
          fade = null;
        }, 120);
      } else if (stopping.paused) {
        void stopping.play().catch(() => undefined);
      }
    }
  };

  const ensure = (): boolean => {
    if (context !== null) return true;
    if (typeof window === 'undefined') return false;

    // Safari kennt nur den praefixierten Namen.
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) return false;

    context = new Ctor();
    master = context.createGain();
    sfx = context.createGain();
    music = context.createGain();
    master.connect(context.destination);
    sfx.connect(master);
    // Der Musik-Bus hing hier fertig da, bevor es Musik gab - und als sie kam,
    // hat sich an dieser Stelle tatsaechlich nichts geaendert. Die Spur haengt
    // sich in `playMusic` an denselben Knoten.
    music.connect(master);

    if (settings !== null) apply(settings);
    return true;
  };

  const noiseBuffer = (ctx: AudioContext, ms: number): AudioBuffer => {
    const frames = Math.max(1, Math.ceil((ctx.sampleRate * ms) / 1000));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  };

  const playLayer = (ctx: AudioContext, target: GainNode, layer: Layer, gain: number): void => {
    const start = ctx.currentTime + (layer.at ?? 0) / 1000;
    const attack = (layer.attack ?? 2) / 1000;
    const decay = layer.decay / 1000;
    const peak = Math.max(0.0002, layer.gain * gain);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(peak, start + attack);
    // Exponentiell aus, weil das Ohr Lautstaerke so hoert - linear klaenge
    // abgeschnitten.
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    envelope.connect(target);

    if (layer.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      osc.frequency.setValueAtTime(layer.from, start);
      if (layer.to !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(layer.to, start + attack + decay);
      }
      osc.connect(envelope);
      osc.start(start);
      osc.stop(start + attack + decay + 0.02);
      osc.onended = () => {
        envelope.disconnect();
      };
    } else {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, attack * 1000 + layer.decay + 20);
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter;
      filter.frequency.setValueAtTime(layer.from, start);
      if (layer.to !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(layer.to, start + attack + decay);
      }
      if (layer.q !== undefined) filter.Q.setValueAtTime(layer.q, start);
      source.connect(filter);
      filter.connect(envelope);
      source.start(start);
      source.stop(start + attack + decay + 0.02);
      source.onended = () => {
        filter.disconnect();
        envelope.disconnect();
      };
    }
  };

  const playSample = (
    ctx: AudioContext,
    target: GainNode,
    buffer: AudioBuffer,
    gain: number,
  ): void => {
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, ctx.currentTime);
    envelope.connect(target);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(envelope);
    source.start();
    source.onended = () => {
      envelope.disconnect();
    };
  };

  /*
   * Nebenlaeufig und ohne Anspruch: klappt es, ersetzt das Sample beim
   * naechsten Mal die Synthese. Klappt es nicht, bleibt es bei der Synthese -
   * fuer immer, und ohne dass der Spieler je davon erfaehrt.
   */
  const load = (ctx: AudioContext, cue: string, url: string): void => {
    void fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(url))))
      .then((raw) => ctx.decodeAudioData(raw))
      .then((buffer) => {
        buffers.set(cue, buffer);
      })
      .catch(() => {
        buffers.delete(cue);
      });
  };

  /**
   * Die Hintergrundspur - ein `<audio>`-Element am Musik-Bus.
   *
   * **Ein Element und kein dekodierter Puffer.** Die Datei ist Minuten lang;
   * als PCM im Speicher waere sie ein Vielfaches ihrer zwei Megabyte, waehrend
   * das Element streamt und `loop` geschenkt bekommt. Ueber
   * `createMediaElementSource` haengt sie trotzdem am selben Bus wie alles
   * andere - damit gilt fuer sie derselbe Regler, ohne eine zweite
   * Lautstaerkerechnung daneben.
   *
   * Jeder Ausfall ist still und keiner ist laut: kein `Audio` im Fenster, kein
   * `MediaElementSource`, eine abgelehnte Wiedergabe - in allen drei Faellen
   * bleibt es bei der Stille, und die Effekte klingen weiter.
   */
  const playMusic = (url: string): void => {
    if (!ensure() || context === null || music === null) return;
    if (settings !== null && (settings.master.muted || settings.music.muted)) return;

    if (track === null) {
      if (typeof Audio === 'undefined') return;

      const element = new Audio(url);
      element.loop = true;
      element.preload = 'auto';

      try {
        context.createMediaElementSource(element).connect(music);
      } catch {
        return;
      }
      track = element;
    }

    if (context.state === 'suspended') void context.resume();
    if (track.paused) void track.play().catch(() => undefined);
  };

  const play = (sound: Sound): void => {
    if (!ensure() || context === null || sfx === null) return;
    if (settings !== null && (settings.master.muted || settings.sfx.muted)) return;

    const now = context.currentTime * 1000;
    const last = lastPlayed.get(sound.cue);
    if (last !== undefined && now - last < DEDUPE_MS) return;
    lastPlayed.set(sound.cue, now);

    if (running.size >= MAX_CUES) return;
    if (context.state === 'suspended') void context.resume();

    const url = SAMPLES[sound.cue];
    if (url !== undefined) {
      const buffer = buffers.get(sound.cue);
      if (buffer !== undefined) {
        hold(buffer.duration * 1000);
        playSample(context, sfx, buffer, sound.gain);
        return;
      }
      // Kein Warten auf die Datei: bis sie da ist, klingt die Synthese. Eine
      // langsame mp3 kann den Klang damit auch nicht verspaeten.
      load(context, sound.cue, url);
    }

    const recipe = recipeFor(sound);
    hold(Math.max(...recipe.layers.map((l) => (l.at ?? 0) + (l.attack ?? 2) + l.decay)));

    for (const layer of recipe.layers) playLayer(context, sfx, layer, sound.gain);
  };

  /**
   * Haelt einen Platz frei, solange dieser Klang laeuft.
   *
   * Eine Uhr und kein `onended`: ein Klang besteht aus mehreren Schichten mit
   * eigenen Enden, und gezaehlt werden sollen Klaenge. Der Zeitgeber steht
   * hier richtig - diese Datei ist die unreine Kante.
   */
  const hold = (ms: number): void => {
    const handle = setTimeout(() => {
      running.delete(handle);
    }, ms + 30);
    running.add(handle);
  };

  const close = (): void => {
    if (fade !== null) clearTimeout(fade);
    fade = null;
    track?.pause();
    track = null;
    void context?.close();
    context = null;
    master = null;
    sfx = null;
    music = null;
    buffers.clear();
    lastPlayed.clear();
    for (const handle of running) clearTimeout(handle);
    running.clear();
  };

  return { play, playMusic, apply, close };
}
