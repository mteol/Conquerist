import { describe, expect, it } from 'vitest';
import { backoffDelayMs } from './backoff';
import { RttEstimator } from './rtt';

describe('backoffDelayMs', () => {
  const neutral = { random: () => 0.5 };

  it('verdoppelt bis zum Deckel', () => {
    const delays = [0, 1, 2, 3, 4, 5, 6].map((attempt) =>
      backoffDelayMs(attempt, { baseMs: 1_000, maxMs: 30_000, ...neutral }),
    );

    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  });

  it('streut um den Nominalwert, ohne ihn nach unten wegzuschneiden', () => {
    const options = { baseMs: 1_000, maxMs: 30_000, jitterRatio: 0.25 };

    expect(backoffDelayMs(0, { ...options, random: () => 0 })).toBe(750);
    expect(backoffDelayMs(0, { ...options, random: () => 1 })).toBe(1_250);
  });

  it('haelt den Deckel auch nach Jitter ein', () => {
    for (const random of [0, 0.5, 1]) {
      expect(
        backoffDelayMs(20, { baseMs: 1_000, maxMs: 30_000, random: () => random }),
      ).toBeLessThanOrEqual(30_000);
    }
  });

  it('vertraegt negative und gebrochene Versuchszaehler', () => {
    expect(backoffDelayMs(-5, { baseMs: 1_000, ...neutral })).toBe(1_000);
    expect(backoffDelayMs(1.9, { baseMs: 1_000, ...neutral })).toBe(2_000);
  });

  it('erzeugt bei echtem Zufall nie etwas ausserhalb der Grenzen', () => {
    for (let i = 0; i < 200; i += 1) {
      const delay = backoffDelayMs(i % 8, { baseMs: 1_000, maxMs: 30_000 });
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });
});

describe('RttEstimator', () => {
  it('liefert vor der ersten Messung den initialen Timeout', () => {
    const estimator = new RttEstimator({ initialTimeoutMs: 5_000 });

    expect(estimator.lastRttMs).toBeNull();
    expect(estimator.smoothedRttMs).toBeNull();
    expect(estimator.timeoutMs).toBe(5_000);
  });

  it('uebernimmt die erste Messung direkt', () => {
    const estimator = new RttEstimator({ minTimeoutMs: 0, maxTimeoutMs: 60_000 });
    estimator.observe({ sentAt: 0, receivedAt: 40 });

    // srtt = 40, rttvar = 20 -> 40 + 4*20
    expect(estimator.lastRttMs).toBe(40);
    expect(estimator.smoothedRttMs).toBe(40);
    expect(estimator.timeoutMs).toBe(120);
  });

  it('glaettet Schwankungen statt ihnen zu folgen', () => {
    const estimator = new RttEstimator({ minTimeoutMs: 0, maxTimeoutMs: 60_000 });
    for (let i = 0; i < 20; i += 1) {
      estimator.observe({ sentAt: 0, receivedAt: 50 });
    }

    expect(estimator.smoothedRttMs).toBe(50);

    // Ein einzelner Ausschlag auf 400 ms darf den Mittelwert nicht mitnehmen.
    estimator.observe({ sentAt: 0, receivedAt: 400 });

    expect(estimator.lastRttMs).toBe(400);
    expect(estimator.smoothedRttMs).toBeLessThan(120);
    // Der Timeout wird aber weiter, weil die Varianz gestiegen ist.
    expect(estimator.timeoutMs).toBeGreaterThan(120);
  });

  it('klemmt den Timeout in beide Richtungen', () => {
    const fast = new RttEstimator({ minTimeoutMs: 2_000, maxTimeoutMs: 15_000 });
    fast.observe({ sentAt: 0, receivedAt: 1 });
    expect(fast.timeoutMs).toBe(2_000);

    const slow = new RttEstimator({ minTimeoutMs: 2_000, maxTimeoutMs: 15_000 });
    slow.observe({ sentAt: 0, receivedAt: 9_000 });
    expect(slow.timeoutMs).toBe(15_000);
  });

  it('schaetzt den Uhrenversatz aus serverTime und halbem RTT', () => {
    const estimator = new RttEstimator();

    // Umlauf 100 ms, Server stempelt in der Mitte und laeuft 1000 ms vor.
    estimator.observe({ sentAt: 1_000, receivedAt: 1_100, serverTimeMs: 1_050 + 1_000 });

    expect(estimator.clockOffsetMs).toBe(1_000);
  });

  it('behaelt den Uhrenversatz beim reset, verwirft aber den RTT', () => {
    const estimator = new RttEstimator();
    estimator.observe({ sentAt: 0, receivedAt: 100, serverTimeMs: 1_050 });

    const offset = estimator.clockOffsetMs;
    estimator.reset();

    // Ein Reconnect aendert die Server-Uhr nicht - eine alte Schaetzung ist
    // besser als keine. Der RTT der alten Route dagegen ist wertlos.
    expect(estimator.clockOffsetMs).toBe(offset);
    expect(estimator.lastRttMs).toBeNull();
  });

  it('verwirft Uhren-Ausreisser', () => {
    const estimator = new RttEstimator();
    for (let i = 0; i < 10; i += 1) {
      estimator.observe({ sentAt: 0, receivedAt: 50, serverTimeMs: 25 });
    }
    const stable = estimator.clockOffsetMs;

    // Antwort mit weit ueberdurchschnittlichem RTT: die Annahme
    // "halbe Zeit hin, halbe zurueck" traegt nicht mehr.
    estimator.observe({ sentAt: 0, receivedAt: 5_000, serverTimeMs: 90_000 });

    expect(estimator.clockOffsetMs).toBe(stable);
  });
});
