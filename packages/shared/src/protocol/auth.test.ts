import { describe, expect, it } from 'vitest';
import {
  AuthResponseSchema,
  LoginRequestSchema,
  MIN_PASSWORD_LENGTH,
  RegisterRequestSchema,
} from './auth.js';

describe('Auth-Schemata', () => {
  it('nimmt eine Registrierung ohne E-Mail an - sie ist freiwillig', () => {
    const parsed = RegisterRequestSchema.safeParse({ login: 'anna', password: 'langgenug1' });
    expect(parsed.success).toBe(true);
  });

  it('weist ein zu kurzes Passwort ab', () => {
    const parsed = RegisterRequestSchema.safeParse({ login: 'anna', password: 'kurz' });
    expect(parsed.success).toBe(false);
  });

  it('weist eine kaputte E-Mail ab, wenn sie denn angegeben wird', () => {
    const parsed = RegisterRequestSchema.safeParse({
      login: 'anna',
      password: 'langgenug1',
      email: 'kein-at-zeichen',
    });
    expect(parsed.success).toBe(false);
  });

  it('nimmt den Login unabhaengig von Gross- und Kleinschreibung entgegen', () => {
    const parsed = RegisterRequestSchema.parse({ login: '  AnnA ', password: 'langgenug1' });
    expect(parsed.login).toBe('anna');
  });

  it('laesst eine Antwort ohne login gelten - das ist ein Gast', () => {
    const parsed = AuthResponseSchema.safeParse({ userId: 'u1', name: 'Gast', isGuest: true });
    expect(parsed.success).toBe(true);
  });

  it('traegt die Bestaetigung, mit der man seine Gast-Partien aufgibt', () => {
    const parsed = LoginRequestSchema.parse({
      login: 'anna',
      password: 'langgenug1',
      confirmAbandonGuest: true,
    });
    expect(parsed.confirmAbandonGuest).toBe(true);
  });

  it('haelt die Mindestlaenge an einer Stelle fest', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});
