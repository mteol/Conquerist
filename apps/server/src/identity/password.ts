import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/**
 * Passwoerter mit `scrypt` aus `node:crypto`.
 *
 * **Warum scrypt und nicht Argon2id.** Argon2id waere die heute uebliche
 * Empfehlung, gibt es in Node aber nicht eingebaut - es waere ein nativer Build
 * wie `better-sqlite3`. scrypt gilt weiterhin als taugliche KDF, kostet keine
 * Abhaengigkeit, und die Parameter wandern im Hash mit: wer sie spaeter
 * anhebt, macht damit keine bestehende Zeile unlesbar.
 *
 * **Asynchron, nicht `scryptSync`.** Die Synchronvariante haelt den Event-Loop
 * an, und zwar fuer alle Verbindungen gleichzeitig - bei diesen Kosten sind das
 * ueber hundert Millisekunden, in denen kein anderer Spieler einen Zug los
 * wird. Der Router erlaubt Handlern ausdruecklich ein `Promise`.
 */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(plain, salt, KEY_LENGTH, PARAMS);

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(rawSalt ?? '', 'base64');
  const expected = Buffer.from(rawKey ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = await derive(plain, salt, expected.length, { N, r, p });

  // Gleich lang sind sie hier immer - `timingSafeEqual` wirft sonst.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
