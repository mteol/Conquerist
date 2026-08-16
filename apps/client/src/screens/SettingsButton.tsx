import { useState, type JSX } from 'react';
import { SettingsDialog } from '../dialogs/SettingsDialog';

/**
 * Ein Zahnrad fuer alle Bildschirme.
 *
 * Fest verankert oben rechts, ueber der Konto-Ecke - deshalb bekommt `.corner`
 * in `index.css` rechts Platz reserviert. Ein Einbauort statt drei: der Knopf
 * haengt in `App.tsx` neben dem Konto-Dialog und ist damit ueberall da, wo
 * ueberhaupt etwas gerendert wird - Hauptmenue, Start, Wartebereich, Spiel.
 */
export function SettingsButton(): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="settings-button"
        aria-label="Einstellungen"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="-12 -12 24 24" aria-hidden="true">
          <circle cx="0" cy="0" r="3.4" />
          <path d="M 0 -9 L 0 -6 M 0 6 L 0 9 M -9 0 L -6 0 M 6 0 L 9 0 M -6.4 -6.4 L -4.2 -4.2 M 4.2 4.2 L 6.4 6.4 M 6.4 -6.4 L 4.2 -4.2 M -4.2 4.2 L -6.4 6.4" />
        </svg>
      </button>

      {open ? <SettingsDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
