import type { CSSProperties, JSX } from 'react';
import type { Identity } from '../game/useOnlineGame';

/**
 * Wer gerade spielt - oben rechts auf dem Menue.
 *
 * **Rolle:** eine Zustandsanzeige, kein vierter Weg in eine Partie. Deshalb
 * die Sprache der Kleinlabels (klein, gesperrt, gedaempft) und nicht die der
 * drei Eintraege darunter. Boldness wird an einer Stelle ausgegeben, und das
 * ist die Wortmarke (Regel 4).
 *
 * **Solange niemand feststeht, steht hier nichts.** Ein „Gast", der eine
 * Sekunde spaeter zu „Anna" wird, ist ein Flackern - und ein Layout, das
 * dabei springt, faellt unter Regel 7.
 */
export interface AccountCornerProps {
  readonly identity: Identity | null;
  readonly onRegister: () => void;
  readonly onLogin: () => void;
  readonly onLogout: () => void;
  /** Der Platz in der Eingangsreihe. Die Ecke faellt zuletzt ein. */
  readonly order?: number;
}

export function AccountCorner({
  identity,
  onRegister,
  onLogin,
  onLogout,
  order = 4,
}: AccountCornerProps): JSX.Element | null {
  if (identity === null) return null;

  return (
    <div className="corner" style={{ '--i': order } as CSSProperties}>
      <span className="corner__who">{identity.isGuest ? 'Gast' : identity.name}</span>

      {identity.isGuest ? (
        <>
          <button type="button" className="corner__action" onClick={onRegister}>
            Konto anlegen
          </button>
          <button type="button" className="corner__action" onClick={onLogin}>
            Anmelden
          </button>
        </>
      ) : (
        <button type="button" className="corner__action" onClick={onLogout}>
          Abmelden
        </button>
      )}
    </div>
  );
}
