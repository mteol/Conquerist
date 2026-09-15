import { useEffect, useState } from 'react';
import { deadlineOf, type Deadline, type PlayerView } from '@conquerist/shared';

/**
 * Wie viele Sekunden eine Frist noch hat - nie negativ.
 *
 * Ein gespeicherter Zeitpunkt (das Angebot) wird gegen die Serveruhr gerechnet,
 * also mit Versatz. Eine Dauer (jede andere Wartephase) wird gegen den Moment
 * gerechnet, in dem dieser Stand ankam: der Wecker im Server stellt sich nach
 * jedem Zug neu, und derselbe Zug bringt den neuen Stand. Beide Uhren sind
 * dabei die eigene - der Versatz spielt keine Rolle.
 */
export function secondsLeft(
  due: Deadline,
  arrivedAt: number,
  now: number,
  clockOffset: number,
): number {
  const ms = due.kind === 'at' ? due.at - (now + clockOffset) : arrivedAt + due.ms - now;
  return Math.max(0, Math.ceil(ms / 1000));
}

/**
 * Der eine Countdown für jede Frist - `null`, wenn keine läuft.
 *
 * Er stand bis 10d-2 im Angebotsdialog. Seit jede Wartephase eine Frist hat,
 * liest ihn auch die Wartezeile - eine zweite Fundstelle, keine zweite
 * Umsetzung. Welche Frist läuft, sagt `deadlineOf` aus `shared`, dieselbe
 * Funktion, die der Server vollstreckt.
 */
export function useCountdown(view: PlayerView, clockOffset: number): number | null {
  const [arrival, setArrival] = useState(() => ({ version: view.version, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());

  /*
   * Ein neuer Stand setzt die Dauer zurück - während des Renderns und nicht
   * in einem Effekt: sonst zeigte das erste Bild nach dem Zug noch die alte
   * Restzeit. Dieselbe Mechanik wie `answeredOffer` im Angebotsdialog.
   */
  if (arrival.version !== view.version) {
    setArrival({ version: view.version, at: Date.now() });
  }

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  const due = deadlineOf(view);
  if (due === null) return null;
  return secondsLeft(due, arrival.at, Math.max(now, arrival.at), clockOffset);
}
