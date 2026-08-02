import { z } from 'zod';

/**
 * Env-Konfiguration, beim Start per Zod validiert.
 *
 * Fail fast: ein falscher PORT soll den Prozess mit einer lesbaren Meldung
 * beenden und nicht spaeter als NaN in `listen()` auftauchen.
 */

/**
 * Erlaubte Browser-Origins fuer den WebSocket-Upgrade.
 *
 * Default ist 5173, NICHT 8080 - und das ist die Zeile, an der man sonst eine
 * Stunde sucht. Der Client verbindet auf `location.host`, in der Entwicklung
 * also den Vite-Port. Vite proxyt den Upgrade nach 8080 und reicht den
 * urspruenglichen Origin-Header unveraendert durch. Der Server sieht folglich
 * den Vite-Origin, nie seinen eigenen.
 */
export const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173,http://127.0.0.1:5173';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),

  /** Loopback als Default: in der Entwicklung soll der Server nicht im LAN haengen. */
  HOST: z.string().min(1).default('127.0.0.1'),

  /** Kommaseparierte Origin-Liste. Wird in `parseOrigins` geprueft, nicht hier. */
  CLIENT_ORIGIN: z.string().min(1).optional(),

  /**
   * Wo die SQLite-Datei liegt. `:memory:` ist erlaubt und in Tests der Normalfall.
   * Der Default liegt unter `data/`, und `data/` steht in `.gitignore`.
   */
  DATABASE_FILE: z.string().min(1).default('./data/conquerist.db'),
});

export interface ServerConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly host: string;
  readonly clientOrigins: readonly string[];
  readonly databaseFile: string;
  readonly isProduction: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Zerlegt eine kommaseparierte Origin-Liste und normalisiert jeden Eintrag.
 *
 * `new URL(x).origin` liefert genau die Form, die ein Browser im Origin-Header
 * sendet (Schema + Host + ggf. Port, kein Trailing Slash). Ein konfigurierter
 * Wert wie `http://localhost:5173/` wuerde sonst nie matchen.
 */
export function parseOrigins(raw: string): readonly string[] {
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    throw new ConfigError('CLIENT_ORIGIN: mindestens ein Origin erforderlich');
  }

  return entries.map((entry) => {
    let normalized: string;
    try {
      normalized = new URL(entry).origin;
    } catch {
      throw new ConfigError(
        `CLIENT_ORIGIN: "${entry}" ist keine absolute URL der Form http(s)://host[:port]`,
      );
    }

    if (normalized === 'null') {
      throw new ConfigError(`CLIENT_ORIGIN: "${entry}" hat keinen verwertbaren Origin`);
    }

    return normalized;
  });
}

/** Validiert die Umgebung und wirft `ConfigError` mit allen Problemen auf einmal. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const result = EnvSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(`Ungueltige Umgebungskonfiguration:\n${details}`);
  }

  const parsed = result.data;

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    host: parsed.HOST,
    clientOrigins: parseOrigins(parsed.CLIENT_ORIGIN ?? DEFAULT_CLIENT_ORIGIN),
    databaseFile: parsed.DATABASE_FILE,
    isProduction: parsed.NODE_ENV === 'production',
  };
}
