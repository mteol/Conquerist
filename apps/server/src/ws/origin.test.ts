import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './origin.js';

const configured = ['http://localhost:5173'];

describe('Origin-Pruefung', () => {
  it('erlaubt gleichen Ursprung - damit jede Tunneladresse funktioniert', () => {
    expect(
      isAllowedOrigin('https://zufall-xyz.trycloudflare.com', 'zufall-xyz.trycloudflare.com', []),
    ).toBe(true);
    expect(isAllowedOrigin('http://192.168.1.42:8080', '192.168.1.42:8080', [])).toBe(true);
  });

  it('erlaubt weiterhin die eingetragenen Origins', () => {
    expect(isAllowedOrigin('http://localhost:5173', '127.0.0.1:8080', configured)).toBe(true);
  });

  it('lehnt fremde Origins ab', () => {
    expect(isAllowedOrigin('http://evil.example', 'zufall-xyz.trycloudflare.com', configured)).toBe(
      false,
    );
  });

  it('lehnt ab, wenn der Origin fehlt', () => {
    // Ein Browser schickt immer einen Origin. Fehlt er, ist es kein Browser -
    // und dann gibt es keinen Grund, ihn wie einen zu behandeln.
    expect(isAllowedOrigin(undefined, 'localhost:8080', configured)).toBe(false);
  });
});
