import { describe, expect, it } from 'vitest';
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, LoginThrottle } from './loginThrottle.js';

/** Eine Uhr, die stillsteht, bis man sie weiterdreht. */
function clockAt(start: number) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('Drossel fuer Anmeldeversuche', () => {
  it('laesst die ersten zehn Fehlversuche durch', () => {
    const throttle = new LoginThrottle();

    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      expect(throttle.check('anna').blocked).toBe(false);
      throttle.recordFailure('anna');
    }

    expect(throttle.check('anna').blocked).toBe(true);
  });

  it('nennt, wie lange noch zu warten ist', () => {
    const clock = clockAt(1_000_000);
    const throttle = new LoginThrottle({ now: clock.now });
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('anna');

    clock.advance(60_000);
    const verdict = throttle.check('anna');

    expect(verdict.blocked).toBe(true);
    // Der aelteste Versuch faellt nach LOGIN_WINDOW_MS aus dem Fenster.
    expect(verdict.blocked && verdict.retryAfterMs).toBe(LOGIN_WINDOW_MS - 60_000);
  });

  it('vergisst Versuche, sobald das Fenster weitergewandert ist', () => {
    const clock = clockAt(1_000_000);
    const throttle = new LoginThrottle({ now: clock.now });
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('anna');

    clock.advance(LOGIN_WINDOW_MS + 1);

    expect(throttle.check('anna').blocked).toBe(false);
  });

  it('raeumt den Zaehler bei einer gelungenen Anmeldung ab', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('anna');

    throttle.recordSuccess('anna');

    expect(throttle.check('anna').blocked).toBe(false);
  });

  it('zaehlt zwei Namen getrennt', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) throttle.recordFailure('anna');

    expect(throttle.check('bert').blocked).toBe(false);
  });

  it('wirft den aeltesten Namen heraus, wenn die Tabelle voll ist', () => {
    const clock = clockAt(1_000_000);
    const throttle = new LoginThrottle({ maxEntries: 2, now: clock.now });

    throttle.recordFailure('erster');
    clock.advance(1_000);
    throttle.recordFailure('zweiter');
    clock.advance(1_000);
    throttle.recordFailure('dritter');

    // "erster" ist gefallen, seine Zaehlung faengt wieder bei null an.
    expect(throttle.size).toBe(2);
    expect(throttle.knows('erster')).toBe(false);
    expect(throttle.knows('dritter')).toBe(true);
  });
});
