/**
 * Die drei Lautstaerken, gespeichert wie das Sitzungsgeheimnis: duldsam.
 *
 * Der Speicher wirft in einem privaten Fenster schon beim Lesen (siehe
 * `net/session.ts`), und ein kaputter Inhalt darf das Spiel nicht anhalten -
 * ohne Einstellungen gilt eben die Voreinstellung.
 *
 * Deshalb ist das Rechnende von der Ablage getrennt: `parseAudioSettings` ist
 * rein und im node-Test pruefbar, `loadAudioSettings` fasst nur `window` an.
 */
const KEY = 'conquerist.audio';

export type Bus = 'master' | 'sfx' | 'music';

export interface BusSetting {
  /** 0 bis 1. */
  readonly level: number;
  readonly muted: boolean;
}

export type AudioSettings = Record<Bus, BusSetting>;

export const DEFAULT_AUDIO: AudioSettings = {
  master: { level: 0.7, muted: false },
  sfx: { level: 1, muted: false },
  music: { level: 0.7, muted: false },
};

const BUSES: readonly Bus[] = ['master', 'sfx', 'music'];

export function parseAudioSettings(raw: string | null): AudioSettings {
  if (raw === null) return DEFAULT_AUDIO;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_AUDIO;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_AUDIO;

  const source = parsed as Record<string, unknown>;
  const result = {} as Record<Bus, BusSetting>;

  for (const bus of BUSES) {
    const entry = source[bus];
    const fallback = DEFAULT_AUDIO[bus];

    if (typeof entry !== 'object' || entry === null) {
      result[bus] = fallback;
      continue;
    }

    const { level, muted } = entry as { level?: unknown; muted?: unknown };

    result[bus] = {
      level:
        typeof level === 'number' && Number.isFinite(level)
          ? Math.min(1, Math.max(0, level))
          : fallback.level,
      muted: typeof muted === 'boolean' ? muted : fallback.muted,
    };
  }

  return result;
}

export function loadAudioSettings(): AudioSettings {
  try {
    return parseAudioSettings(window.localStorage.getItem(KEY));
  } catch {
    return DEFAULT_AUDIO;
  }
}

export function storeAudioSettings(settings: AudioSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Kein Speicher, keine Erinnerung. Das ist eine Einbusse, kein Fehler.
  }
}
