import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

describe('Konfiguration', () => {
  it('nimmt die Werte, mit denen der Container laeuft', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: '8080',
      DATABASE_FILE: '/data/conquerist.db',
    });

    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8080);
    expect(config.databaseFile).toBe('/data/conquerist.db');
    expect(config.isProduction).toBe(true);
  });

  it('haelt am Loopback fest, solange niemand HOST setzt', () => {
    // Der Default ist Absicht (kein Dev-Server im LAN) und im Container die
    // haeufigste Ursache fuer „laeuft, ist aber nicht erreichbar".
    expect(loadConfig({}).host).toBe('127.0.0.1');
  });

  it('erlaubt ohne CLIENT_ORIGIN weiterhin den Vite-Ursprung', () => {
    expect(loadConfig({}).clientOrigins).toContain('http://localhost:5173');
  });

  it('beendet sich bei einem unbrauchbaren PORT mit einer lesbaren Meldung', () => {
    expect(() => loadConfig({ PORT: 'achtzig' })).toThrow(ConfigError);
  });
});
