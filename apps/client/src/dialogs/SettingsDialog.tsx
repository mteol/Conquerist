import type { JSX } from 'react';
import type { Bus } from '../audio/settings';
import { useAudio } from '../audio/useAudio';
import { CloseButton } from './CloseButton';

/**
 * Einstellungen - heute nur Ton, aber der Ort ist der Punkt.
 *
 * Alles bisher Einstellbare haengt an dem Bildschirm, auf dem es gebraucht wird
 * (Siegpunktziel im Wartebereich, „zwischen den Zuegen verdecken" beim Start).
 * Lautstaerke gilt ueberall, also braucht sie eine Stelle, die ueberall
 * erreichbar ist. Weitere Abschnitte kommen hier dazu, nicht daneben.
 */
const ROWS: readonly { readonly bus: Bus; readonly label: string }[] = [
  { bus: 'master', label: 'Gesamt' },
  { bus: 'sfx', label: 'Effekte' },
  { bus: 'music', label: 'Musik' },
];

export function SettingsDialog({ onClose }: { readonly onClose: () => void }): JSX.Element {
  const { settings, setBus } = useAudio();

  return (
    <div className="modal" role="dialog" aria-label="Einstellungen">
      <div className="modal__box">
        <CloseButton onClose={onClose} label="Einstellungen" />
        <h2>Einstellungen</h2>

        <h3 className="settings__group">Ton</h3>

        {ROWS.map(({ bus, label }) => {
          const setting = settings[bus];
          const percent = Math.round(setting.level * 100);

          return (
            <div key={bus} className="settings__row">
              <button
                type="button"
                className="settings__mute"
                aria-pressed={setting.muted}
                aria-label={`${label} stummschalten`}
                onClick={() => setBus(bus, { muted: !setting.muted })}
              >
                {/* Zwei Zustaende, zwei Formen: Farbe allein traegt hier nichts
                    (Regel 7). Ein Kreuz heisst stumm, ein Bogen heisst laut. */}
                <svg viewBox="-8 -8 16 16" aria-hidden="true">
                  <path
                    className="settings__mute-body"
                    d="M -5 -2.5 L -2.5 -2.5 L 0.5 -5.5 L 0.5 5.5 L -2.5 2.5 L -5 2.5 Z"
                  />
                  {setting.muted ? (
                    <path d="M 3 -3 L 6.5 3 M 6.5 -3 L 3 3" />
                  ) : (
                    <path d="M 3 -3.5 A 4.5 4.5 0 0 1 3 3.5" />
                  )}
                </svg>
              </button>

              <label className="settings__label" htmlFor={`volume-${bus}`}>
                {label}
              </label>

              <input
                id={`volume-${bus}`}
                className="settings__slider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                aria-label={label}
                onChange={(event) => setBus(bus, { level: Number(event.target.value) / 100 })}
              />

              <span className="settings__value">{percent} %</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
