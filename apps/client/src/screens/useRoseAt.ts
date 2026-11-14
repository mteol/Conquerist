import { useEffect, useState } from 'react';

/**
 * Auf welchem Knoten der Seekarte die Windrose sitzt - je nach Format.
 *
 * Die Karte fuellt das Fenster ganz aus (`slice`): im Querformat liegen die
 * Knoten links und rechts der Mitte im Bild, im Hochformat dagegen ueber und
 * unter ihr - dort waeren sie sonst abgeschnitten, und die Rose stuende
 * ausserhalb des Fensters. Beide Plaetze werden vom Bildschirm gewaehlt, der
 * wissen muss, wo seine Inhalte stehen.
 *
 * Ohne `matchMedia` (jsdom) gilt das Querformat.
 */
export function useRoseAt(landscape: number, portrait: number): number {
  const query = '(orientation: portrait)';
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = (): void => setIsPortrait(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isPortrait ? portrait : landscape;
}
