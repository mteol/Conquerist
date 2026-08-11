import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('Passwoerter', () => {
  it('erkennt das richtige Passwort wieder', async () => {
    const stored = await hashPassword('richtig-und-lang');
    expect(await verifyPassword('richtig-und-lang', stored)).toBe(true);
  });

  it('weist ein falsches Passwort ab', async () => {
    const stored = await hashPassword('richtig-und-lang');
    expect(await verifyPassword('falsch-und-lang', stored)).toBe(false);
  });

  it('legt dasselbe Passwort nie zweimal gleich ab', async () => {
    // Sonst verriete die Datenbank, wer dasselbe Passwort benutzt.
    const a = await hashPassword('dasselbe-passwort');
    const b = await hashPassword('dasselbe-passwort');
    expect(a).not.toBe(b);
  });

  it('traegt seine Parameter mit sich', async () => {
    const stored = await hashPassword('irgendein-passwort');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored.split('$')).toHaveLength(6);
  });

  it('speichert das Passwort nirgends im Klartext', async () => {
    const stored = await hashPassword('geheimes-wort');
    expect(stored).not.toContain('geheimes-wort');
  });

  it('haelt einen unleserlichen Eintrag aus, statt zu werfen', async () => {
    // So etwas darf es nicht geben - aber ein Wurf beim Anmelden waere ein
    // INTERNAL, und der Nutzer saehe einen Serverfehler statt einer Absage.
    expect(await verifyPassword('egal', 'kaputt')).toBe(false);
    expect(await verifyPassword('egal', '')).toBe(false);
  });
});
