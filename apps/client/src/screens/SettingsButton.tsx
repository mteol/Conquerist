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
        {/* Ein Rad, keine Sonne: ohne den aeusseren Ring lesen die acht Striche
            als Strahlen, und das heisst ueberall Helligkeit statt
            Einstellungen. Der Ring macht aus ihnen Zaehne. */}
        <svg viewBox="-12 -12 24 24" aria-hidden="true">
          <circle cx="0" cy="0" r="3.2" />
          <circle cx="0" cy="0" r="7" />
          <path d="M 0 -9.5 L 0 -7 M 0 7 L 0 9.5 M -9.5 0 L -7 0 M 7 0 L 9.5 0 M -6.7 -6.7 L -4.9 -4.9 M 4.9 4.9 L 6.7 6.7 M 6.7 -6.7 L 4.9 -4.9 M -4.9 4.9 L -6.7 6.7" />
        </svg>
      </button>

      {open ? <SettingsDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
