import type { Sessions } from './sessions.js';
import type { User, Users } from './users.js';
import { hashPassword, verifyPassword } from './password.js';

/**
 * Was ein Spieler lesen darf. Der Handler macht daraus eine `RejectedError`.
 */
export class AccountError extends Error {}

export interface AccountResult {
  readonly user: User;
  /** Nur wenn eine neue Sitzung entstanden ist. */
  readonly secret?: string | undefined;
  readonly tokenHash: string;
}

/*
 * `| undefined` statt nur `?`: die Felder kommen direkt aus dem
 * zod-geparsten Request (`.optional()` macht daraus `T | undefined`), und
 * `exactOptionalPropertyTypes` unterscheidet das von einem blossen `?`. Ohne
 * die Erweiterung liesse sich die geparste Payload nicht direkt durchreichen.
 */
interface RegisterInput {
  readonly login: string;
  readonly password: string;
  readonly email?: string | undefined;
  readonly name?: string | undefined;
}

interface LoginInput {
  readonly login: string;
  readonly password: string;
  readonly confirmAbandonGuest?: boolean | undefined;
}

/**
 * Ein Hash, gegen den geprueft wird, wenn es den Login gar nicht gibt.
 *
 * Ohne ihn antwortet der Server bei unbekanntem Login sofort und bei falschem
 * Passwort erst nach der KDF - die Zeit verriete dann genau das, was die
 * gemeinsame Fehlermeldung verschweigen soll.
 */
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const WRONG_CREDENTIALS = 'Benutzername oder Passwort stimmt nicht.';

export class Accounts {
  constructor(
    private readonly users: Users,
    private readonly sessions: Sessions,
  ) {}

  /**
   * Konto anlegen - und das ist zugleich das Beanspruchen.
   *
   * Ein Gast bekommt seine eigene Zeile ergaenzt (Regel 7: „ein UPDATE auf die
   * bestehende Zeile, kein neuer Datentyp"), und weil nichts umgehaengt wird,
   * bleibt jeder Sitz, wo er ist. Ohne Sitzung entsteht eine neue Zeile.
   */
  async register(
    input: RegisterInput,
    currentUserId: string | null,
    currentTokenHash: string | null,
  ): Promise<AccountResult> {
    if (this.users.byLogin(input.login) !== undefined) {
      throw new AccountError('Dieser Benutzername ist vergeben.');
    }

    const current = currentUserId === null ? undefined : this.users.byId(currentUserId);
    if (current !== undefined && !current.isGuest) {
      throw new AccountError('Du bist schon angemeldet.');
    }

    const passwordHash = await hashPassword(input.password);

    if (current !== undefined && currentTokenHash !== null) {
      const claimed = this.users.claim(current.id, {
        login: input.login,
        passwordHash,
        email: input.email,
        name: input.name,
      });
      return { user: claimed, tokenHash: currentTokenHash };
    }

    // Anlegen und Sitzung ausstellen in einer Transaktion (in `users.ts`
    // gekapselt) - sonst bliebe bei einem Fehler in `sessions.issue()` eine
    // Konto-Zeile ohne jede Sitzung stehen.
    const created = this.users.createAccountWithSession({
      login: input.login,
      passwordHash,
      email: input.email,
      name: input.name ?? input.login,
    });
    return { user: created.user, secret: created.secret, tokenHash: created.tokenHash };
  }

  /**
   * An einem bestehenden Konto anmelden.
   *
   * `openGuestGames` kommt vom Aufrufer, weil nur der das Raumverzeichnis
   * kennt. Die Warnung selbst zeigt der Client - er hat die Liste ohnehin.
   * Dieser Riegel gilt fuer den, der am Dialog vorbei sendet.
   */
  async login(
    input: LoginInput,
    currentUserId: string | null,
    currentTokenHash: string | null,
    openGuestGames: number,
  ): Promise<AccountResult> {
    const account = this.users.byLogin(input.login);
    const stored = account?.passwordHash ?? DUMMY_HASH;
    const matches = await verifyPassword(input.password, stored);

    if (account === undefined || !matches) throw new AccountError(WRONG_CREDENTIALS);

    const current = currentUserId === null ? undefined : this.users.byId(currentUserId);
    if (
      current !== undefined &&
      current.isGuest &&
      openGuestGames > 0 &&
      input.confirmAbandonGuest !== true
    ) {
      throw new AccountError('Du hast offene Partien als Gast. Bestaetige, dass du sie aufgibst.');
    }

    // Dieses Geraet ist ab jetzt jemand anderes. Die Gast**zeile** bleibt: an
    // ihr haengen Sitze in Raeumen, in denen andere weiterspielen.
    if (currentTokenHash !== null) this.sessions.revoke(currentTokenHash);

    const { token, tokenHash } = this.sessions.issue(account.id);
    const user = this.users.byId(account.id);
    if (user === undefined) throw new AccountError(WRONG_CREDENTIALS);

    return { user, secret: token, tokenHash };
  }

  /**
   * Abmelden - und danach ist man ein Gast, nicht niemand.
   *
   * Ein Client ohne Identitaet haette einen Zustand, den es sonst nie gibt.
   */
  logout(currentTokenHash: string | null): AccountResult {
    if (currentTokenHash === null) throw new AccountError('Du bist nicht angemeldet.');

    this.sessions.revoke(currentTokenHash);

    const guest = this.users.createGuest('Gast');
    return { user: guest.user, secret: guest.secret, tokenHash: guest.tokenHash };
  }
}
