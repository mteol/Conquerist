import { useState, type FormEvent, type JSX } from 'react';
import { MIN_PASSWORD_LENGTH } from '@conquerist/shared';
import { CloseButton } from './CloseButton';

/**
 * Konto anlegen oder anmelden - ein Dialog, zwei Modi.
 *
 * Zwei getrennte Dialoge waeren derselbe Aufbau zweimal, und wer im falschen
 * landet, muesste zurueck. Der Unterschied sind genau zwei Dinge: die
 * freiwillige E-Mail und die Beschriftung.
 *
 * **Der Dialog validiert nicht selbst.** Ob ein Passwort taugt oder ein
 * Login frei ist, entscheidet der Server; `minLength` am Feld ist nur
 * Bedienkomfort. Lehnt der Server ab, kommt die Meldung als `problem`
 * herein und wird angezeigt, nicht verschluckt.
 */
export interface AccountDialogProps {
  readonly mode: 'register' | 'login';
  /** Wie viele Partien der Gast verliert. 0 heisst: keine Warnung. */
  readonly openGuestGames: number;
  /** Die Absage des Servers, falls es eine gab. */
  readonly problem: string | null;
  readonly onSubmit: (input: {
    login: string;
    password: string;
    email?: string;
    confirmAbandonGuest?: boolean;
  }) => void;
  readonly onClose: () => void;
}

export function AccountDialog({
  mode,
  openGuestGames,
  problem,
  onSubmit,
  onClose,
}: AccountDialogProps): JSX.Element {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const registering = mode === 'register';
  const warned = !registering && openGuestGames > 0;
  const title = registering ? 'Konto anlegen' : 'Anmelden';

  function submit(event: FormEvent): void {
    event.preventDefault();
    onSubmit({
      login,
      password,
      ...(registering && email !== '' ? { email } : {}),
      ...(warned ? { confirmAbandonGuest: true } : {}),
    });
  }

  return (
    <div className="modal" role="dialog" aria-label={title}>
      <form className="modal__box" onSubmit={submit}>
        <CloseButton onClose={onClose} label={title} />
        <h2>{title}</h2>

        {warned ? (
          <p className="modal__hint modal__hint--warn">
            Du hast {openGuestGames} offene Partien als Gast. Wenn du dich anmeldest, kommst du
            ueber dieses Geraet nicht mehr an sie heran.
          </p>
        ) : null}

        <label className="field">
          <span>Benutzername</span>
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span>Passwort</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </label>

        {registering ? (
          <label className="field">
            <span>E-Mail (freiwillig)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
            {/*
             * Ehrlich beschriftet: die Adresse tut heute nichts. Ein Feld, das
             * so aussieht, als schicke es Post, waere ein Versprechen.
             */}
            <small className="field__note">
              Tut heute noch nichts. Sie liegt fuer eine spaetere Passwort-Wiederherstellung.
            </small>
          </label>
        ) : null}

        {problem === null ? null : <p className="modal__problem">{problem}</p>}

        <button type="submit" className="button button--go">
          {warned ? 'Trotzdem anmelden' : title}
        </button>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Abbrechen
        </button>
      </form>
    </div>
  );
}
