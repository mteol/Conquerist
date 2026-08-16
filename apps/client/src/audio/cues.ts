import type { Move } from '@conquerist/shared';

/**
 * Das Klangvokabular - 23 Namen, mehr gibt es nicht.
 *
 * Es ist eine Liste und kein loser String-Typ, damit `voices.ts` einen
 * vollstaendigen `Record` fuehren muss: ein neuer Cue ohne Rezept uebersetzt
 * dann gar nicht erst.
 */
export const CUES = [
  'ui.click',
  'ui.confirm',
  'ui.cancel',
  'ui.error',

  'build.road',
  'build.settlement',
  'build.city',

  'dice.roll',
  'dice.land',
  'dice.seven',

  'gain.self',

  'robber.move',
  'robber.steal',
  'discard.required',

  'card.buy',
  'card.knight',
  'card.play',

  'trade.offer',
  'trade.accept',
  'trade.reject',
  'trade.timeout',

  'turn.mine',
  'game.over',
] as const;

export type Cue = (typeof CUES)[number];

/**
 * Ein Klang mit seiner Ausloesung.
 *
 * `gain` und `note` stehen hier und nicht im Katalog: derselbe Cue klingt
 * gedaempft, wenn ihn ein anderer ausgeloest hat, und `dice.land` traegt die
 * Augensumme als Tonhoehe. Beides gehoert zum Vorfall, nicht zum Klang.
 */
export interface Sound {
  readonly cue: Cue;
  readonly gain: number;
  readonly note?: number;
  /**
   * Wie viele Schichten des Rezepts klingen sollen.
   *
   * Nur `gain.self` benutzt das: ein Blip je zugelaufener Karte. Ohne das
   * spielte der Klang immer dieselbe Figur, egal ob eine Karte kam oder vier -
   * und dann meldete er nur „irgendwas kam" statt „so viel kam".
   */
  readonly count?: number;
}

/**
 * Der Klang zum letzten Zug, wie er im Zustand liegt.
 *
 * Er steht hier und nicht im Spielmodul, obwohl die Reduzierer ihn fuellen:
 * sonst muesste die Tonschicht aus `game/` importieren, um ihre eigene Eingabe
 * zu kennen. `seq` zaehlt mit - ohne ihn bliebe derselbe Klang zweimal
 * hintereinander stumm, und unter `StrictMode` ist er die Sperre gegen den
 * doppelt laufenden Effekt.
 */
export interface SoundEvent {
  readonly seq: number;
  readonly sounds: readonly Sound[];
}

/** Wie laut ein fremder Zug ist, der einen nichts angeht. */
export const FOREIGN_GAIN = 0.4;

/**
 * Was ein Klang ueber die Lage wissen muss - und sonst nichts.
 *
 * Der Hotseat haelt einen `GameState`, online liegt nur eine `PlayerView` vor.
 * Eine Funktion mit zwei Zustandswelten waeren zwei Funktionen mit einem Namen;
 * deshalb steht diese Erhebung dazwischen. Sie wird von zwei Erhebern gefuellt
 * (`situation.ts`), und `cueFor` kennt keinen von beiden.
 */
export interface Situation {
  /** Ein anderer hat gezogen. Im Hotseat nie - dort ist jeder „ich". */
  readonly foreign: boolean;
  /** Wie viele Karten mir zugelaufen sind. */
  readonly gained: number;
  /** Wie viele mir abhanden gekommen sind. */
  readonly lost: number;
  readonly becameMyTurn: boolean;
  readonly mustDiscard: boolean;
  /** Ein Angebot wartet auf meine Antwort. */
  readonly offerToMe: boolean;
  /** Die Partie ist mit genau diesem Zug vorbei. */
  readonly finished: boolean;
  readonly diceTotal: number | null;
}

export type { Move };
