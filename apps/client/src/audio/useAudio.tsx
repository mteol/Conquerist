import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { CUES, type Cue, type Sound, type SoundEvent } from './cues';
import { createEngine } from './engine';
import {
  DEFAULT_AUDIO,
  loadAudioSettings,
  storeAudioSettings,
  type AudioSettings,
  type Bus,
} from './settings';

interface AudioApi {
  readonly settings: AudioSettings;
  readonly setBus: (bus: Bus, next: { level?: number; muted?: boolean }) => void;
  readonly play: (sound: Sound) => void;
}

const AudioContextValue = createContext<AudioApi | null>(null);

/**
 * Ton fuer die ganze Anwendung.
 *
 * Der delegierte Klick sitzt hier und nicht an hundert Knoepfen: ein Listener
 * am Fenster, `closest('button')`, fertig. Wer einen anderen Klang will,
 * schreibt `data-sound="confirm"` ans Element - das ist die einzige Stelle, an
 * der eine Komponente je von Ton erfaehrt.
 *
 * Er haengt an `pointerdown` und nicht an `click`, aus zwei Gruenden: der Klang
 * kommt beim Druecken statt beim Loslassen (das fuehlt sich unmittelbar an),
 * und es ist dieselbe Geste, mit der der Browser Audio freigibt.
 */
export function AudioProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO);
  const engine = useMemo(() => createEngine(), []);

  // Erst nach dem Einhaengen lesen: `loadAudioSettings` fasst `window` an.
  useEffect(() => {
    setSettings(loadAudioSettings());
  }, []);

  useEffect(() => {
    engine.apply(settings);
  }, [engine, settings]);

  useEffect(() => {
    return () => {
      engine.close();
    };
  }, [engine]);

  const play = useCallback(
    (sound: Sound) => {
      engine.play(sound);
    },
    [engine],
  );

  const setBus = useCallback((bus: Bus, next: { level?: number; muted?: boolean }) => {
    setSettings((current) => {
      const updated: AudioSettings = { ...current, [bus]: { ...current[bus], ...next } };
      storeAudioSettings(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    const onDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest('button, [role="button"]');
      if (button === null) return;
      // Ein Knopf, der nichts tut, klingt auch nicht - sonst meldete der Ton
      // einen Erfolg, den es nicht gab.
      if (button instanceof HTMLButtonElement && button.disabled) return;
      if (button.getAttribute('aria-disabled') === 'true') return;

      play({ cue: cueOf(button.getAttribute('data-sound')), gain: 1 });
    };

    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('pointerdown', onDown);
    };
  }, [play]);

  const api = useMemo<AudioApi>(() => ({ settings, setBus, play }), [settings, setBus, play]);

  return <AudioContextValue.Provider value={api}>{children}</AudioContextValue.Provider>;
}

/** `data-sound="confirm"` meint `ui.confirm`; alles Unbekannte bleibt der Klick. */
function cueOf(attribute: string | null): Cue {
  if (attribute === null) return 'ui.click';

  const candidate = `ui.${attribute}`;
  return (CUES as readonly string[]).includes(candidate) ? (candidate as Cue) : 'ui.click';
}

export function useAudio(): AudioApi {
  const api = useContext(AudioContextValue);
  if (api === null) throw new Error('useAudio: kein AudioProvider im Baum');
  return api;
}

/**
 * Spielt, was der Reducer abgelegt hat - jede `seq` genau einmal.
 *
 * Die Sperre ist keine Vorsicht, sondern Notwendigkeit: `main.tsx` laeuft mit
 * `StrictMode`, und der laesst jeden Effekt in der Entwicklung doppelt laufen.
 * Ohne sie klaenge dort jeder Zug zweimal, und man suchte den Fehler im Klang
 * statt im Effekt.
 */
export function useCueSound(event: SoundEvent | null): void {
  const { play } = useAudio();
  const lastSeq = useRef<number | null>(null);

  useEffect(() => {
    if (event === null || event.seq === lastSeq.current) return;

    lastSeq.current = event.seq;
    for (const sound of event.sounds) play(sound);
  }, [event, play]);
}
