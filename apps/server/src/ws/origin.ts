/**
 * Wer den WebSocket oeffnen darf.
 *
 * Bis Etappe 3 stand hier nur eine feste Liste. Eine Tunneladresse wechselt
 * aber bei jedem Start, und eine Liste, die man vor jedem Spieleabend pflegt,
 * pflegt niemand. Neue Regel, in dieser Reihenfolge:
 *
 *   1. Gleicher Ursprung ist erlaubt. Der Server liefert den Client selbst
 *      aus, also ist das der Normalfall - und er gilt fuer jede Adresse, ohne
 *      Konfiguration.
 *   2. Zusaetzlich die eingetragenen Origins (der Vite-Dev-Proxy).
 *
 * Die Ablehnung fremder Origins aus Etappe 0 bleibt damit in Kraft; sie wird
 * nur nicht mehr von einer wechselnden Adresse ausgehebelt.
 *
 * Rueckgabe als Typwaechter: wer die Pruefung besteht, hat einen Origin - der
 * Aufrufer braucht danach kein `!` und keine zweite Abfrage.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  allowed: readonly string[],
): origin is string {
  if (origin === undefined || origin === '') return false;
  if (allowed.includes(origin)) return true;
  if (host === undefined || host === '') return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
