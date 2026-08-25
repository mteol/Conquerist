import { useEffect, useRef, useState } from 'react';
import type { GameAction, PlayerView, Roll } from '@conquerist/shared';
import type { SoundEvent } from '../audio/cues';
import type { LogEntry } from './hotseat';
import { cameFromRoll } from './view';

/**
 * Der Tisch wartet, solange die Wuerfel fliegen.
 *
 * **Warum es diesen Haken ueberhaupt gibt.** Wurf, Verlaufszeile, die
 * Zuwachsplaketten am Tisch und der Klang stammen alle aus **einer**
 * Zustandsaenderung und erscheinen deshalb im selben Augenblick. Solange die
 * Wuerfel an Ort und Stelle umsprangen, war das richtig. Wuerfel, die eine
 * Sekunde ueber das Brett trudeln, zeigen ihre Zahl dagegen erst am Ende - und
 * dann steht sie im Verlauf schon, bevor sie faellt. Das ist keine Kleinigkeit:
 * die Animation erklaerte nicht mehr den Zustandswechsel (Designregel 5),
 * sondern kaeme ihm hinterher.
 *
 * Also haelt dieser Haken **die ganze Vorfuehrung** an: Sicht, Klickkarte,
 * Verlauf und Klang. Wer den Wurf ausloest, sieht bis zur Landung genau den
 * Tisch, den er vorher hatte.
 *
 * **Was nicht wartet:** alles andere am Spielobjekt - eine Absage des Servers
 * etwa. Sie gehoert nicht zum Wurf und darf nicht in seiner Luft haengen.
 *
 * **Ohne Bewegung gibt es auch kein Warten.** Bei `prefers-reduced-motion`
 * fliegt nichts, und eine Sekunde Stillstand ohne sichtbaren Grund waere dann
 * kein Spannungsbogen, sondern eine hakende Oberflaeche. Dasselbe gilt, wo es
 * gar kein `matchMedia` gibt (node, jsdom): im Zweifel wird nicht gewartet.
 */

/** Die Wurfanimation in `index.css`. */
const THROW_ANIMATION_MS = 1050;

/**
 * Der Versatz von einem Wuerfel zum naechsten.
 *
 * Steht hier und wird von `DiceTray` **importiert**, nicht abgeschrieben:
 * dieselbe Zahl an zwei Orten war schon einmal eine stille Kopplung, und sie
 * ist jetzt eine.
 */
export const THROW_STAGGER_MS = 70;

/**
 * Das Auslaufen.
 *
 * Der Wurf ist ein Wurf mit drei Aufschlaegen, und ein Wuerfel, der zur Ruhe
 * kommt, braucht sichtbar Zeit dafuer - ohne sie sieht das Ausrollen aus wie
 * ein Abbruch.
 */
const THROW_SETTLE_MS = 60;

/**
 * Wie lange der Tisch anhaelt - abhaengig davon, **wie viele** Wuerfel fallen.
 *
 * Der Tisch soll aufgehen, nachdem der **letzte** liegt, nicht waehrend er
 * noch rollt. Solange es zwei Wuerfel gab, stand hier eine feste 1180; mit dem
 * Ereigniswuerfel aus Staedte & Ritter faellt ein dritter mit 140 ms Versatz,
 * und die feste Zahl liess den Tisch aufgehen, waehrend er noch unterwegs war.
 * Der Verlaufssatz stuende dann wieder vor dem Wurf - genau der Fehler, gegen
 * den es diesen Haken gibt.
 *
 * Wer die Animation im Blatt aendert, aendert die Zahlen hier mit. Das ist die
 * einzige Kopplung zwischen Blatt und Ablauf, und sie bricht still.
 */
export function throwMs(dice: number): number {
  return THROW_ANIMATION_MS + Math.max(0, dice - 1) * THROW_STAGGER_MS + THROW_SETTLE_MS;
}

/**
 * Die alte feste Zahl, weiterhin fuer zwei Wuerfel - Tests rechnen damit.
 *
 * Sie bleibt als abgeleiteter Wert stehen und nicht als zweite Konstante: eine
 * Kopie waere genau die Doppelung, die `throwMs` gerade aufloest.
 */
export const THROW_MS = throwMs(2);

/** Was am Wurf haengt und deshalb mit ihm wartet. */
export interface Rollable {
  readonly view: PlayerView | null;
  readonly actions: readonly GameAction[];
  readonly log: readonly LogEntry[];
  readonly sound: SoundEvent | null;
}

export type Settled<T extends Rollable> = T & {
  /**
   * Der Wurf, der gerade unterwegs ist - `null`, wenn nichts fliegt.
   *
   * Er kommt aus dem **zurueckgehaltenen** Stand und ist damit die einzige
   * Auskunft daraus, die vor der Landung nach draussen darf: die Wuerfel
   * muessen wissen, worauf sie fallen sollen. Alles andere erfaehrt der Tisch
   * erst, wenn sie liegen.
   */
  readonly landing: Roll | null;
};

export function useSettledRoll<T extends Rollable>(game: T): Settled<T> {
  const [shown, setShown] = useState<Rollable>(game);
  const [landing, setLanding] = useState<Roll | null>(null);

  /*
   * Der neueste Stand, damit der Wecker ihn beim Aufwachen findet.
   *
   * In einem Ref und in einem eigenen Effekt: waehrend des Renderns
   * geschrieben waere es ein Seiteneffekt im Rendern, und der Wecker soll
   * ohnehin den Stand von *spaeter* holen, nicht den von damals.
   */
  const latest = useRef<Rollable>(game);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = game;
  });

  const version = game.view?.version ?? -1;
  const shownVersion = shown.view?.version ?? -1;

  useEffect(() => {
    if (version === shownVersion) return;

    /*
     * Waehrend eines Wurfs wird nichts uebernommen.
     *
     * Der Wecker holt am Ende ohnehin den neuesten Stand - ein Zwischenstand
     * mitten im Flug haette dagegen den Tisch geoeffnet, obwohl die Wuerfel
     * noch in der Luft sind, und genau das soll nicht passieren.
     */
    if (timer.current !== null) return;

    const next = game.view;
    if (next === null || !cameFromRoll(shown.view, next) || !motionWanted()) {
      setShown(latest.current);
      return;
    }

    setLanding(next.lastRoll);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        setLanding(null);
        setShown(latest.current);
      },
      /*
       * Gezaehlt wird, was wirklich faellt - nicht "zwei". Mit dem
       * Ereigniswuerfel sind es drei, und der dritte ist 140 ms nach dem
       * ersten unterwegs.
       */
      throwMs(next.lastRoll?.length ?? 2),
    );
  }, [version, shownVersion, game.view, shown.view]);

  // Wer den Bildschirm verlaesst, waehrend die Wuerfel fliegen, laesst keinen
  // Wecker zurueck, der in eine ausgehaengte Komponente schreibt.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return {
    ...game,
    view: shown.view,
    actions: shown.actions,
    log: shown.log,
    sound: shown.sound,
    landing,
  } as Settled<T>;
}

/** Im Zweifel nicht warten - siehe der Absatz oben. */
function motionWanted(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
