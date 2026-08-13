/**
 * Das Sitzungsgeheimnis im Browser.
 *
 * Es ist faktisch ein Passwort: wer es hat, ist diese Person. Deshalb liegt es
 * in `localStorage` und nicht in der URL - ein Einladungslink wird
 * weitergeschickt, und ein Geheimnis darin waere mitgeschickt.
 *
 * Jeder Zugriff ist abgesichert: in einem privaten Fenster mit gesperrtem
 * Speicher wirft `localStorage` schon beim Lesen. Ohne Speicher gibt es eben
 * bei jedem Besuch einen neuen Gast - laestig, aber kein Absturz.
 */
const SECRET_KEY = 'conquerist.secret';
const NAME_KEY = 'conquerist.name';

function read(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value === null || value === '' ? null : value;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Kein Speicher, kein Wiedererkennen. Das ist eine Einbusse, kein Fehler.
  }
}

export function loadSecret(): string | null {
  return read(SECRET_KEY);
}

export function storeSecret(secret: string): void {
  write(SECRET_KEY, secret);
}

/**
 * Das Geheimnis wegwerfen.
 *
 * Noetig, wenn der Server es nicht kennt - nach einem Datenbankwechsel etwa.
 * Ein Geheimnis, das niemand mehr kennt, ist keins mehr; es weiter
 * mitzuschicken sperrt einen dauerhaft aus.
 */
export function forgetSecret(): void {
  try {
    window.localStorage.removeItem(SECRET_KEY);
  } catch {
    // Kein Speicher, nichts zu vergessen.
  }
}

/** Der zuletzt benutzte Anzeigename, damit ihn niemand zweimal tippen muss. */
export function loadName(): string | null {
  return read(NAME_KEY);
}

export function storeName(name: string): void {
  write(NAME_KEY, name);
}

/**
 * Der Raumcode aus der Adresse - der Einladungslink.
 *
 * Ein Link ist die eine Form, die sich in jedem Messenger verschicken laesst.
 * Der Code steht als Parameter darin und nicht im Pfad, damit der Server jede
 * Adresse gleich behandeln kann.
 */
export const ROOM_PARAM = 'raum';

export function roomFromLocation(search: string = window.location.search): string | null {
  const code = new URLSearchParams(search).get(ROOM_PARAM);
  return code === null || code === '' ? null : code.toUpperCase();
}

/** Der Link, den man weitergibt. */
export function invitationLink(code: string): string {
  const url = new URL(window.location.href);
  url.search = `${ROOM_PARAM}=${code}`;
  url.hash = '';
  return url.toString();
}
