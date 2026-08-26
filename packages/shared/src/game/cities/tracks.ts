import { z } from 'zod';

import type { CardAmounts } from '../../rules/index.js';
import type { CommodityId } from '../../scenario/terrain.js';
import { EMPTY_CARDS } from '../cards.js';
import type { PlayerState } from '../player.js';

/**
 * Die drei Bereiche des Stadtausbaus - ihre Stufen, Preise und Zusatznutzen.
 *
 * Jeder Bereich hat fuenf Stufen, jede Stufe kostet Handelswaren ihrer
 * eigenen Sorte, und drei Stufen tragen einen Zusatznutzen: das Aquaedukt
 * (Wissenschaft 3), die Gilde (Handel 3) und die Festung (Politik 3) - Letztere
 * ist die Bedingung dafuer, dass ein Starker Ritter zum Maechtigen wird
 * (`canUpgradeKnight` in `knights.ts`). Ab Stufe vier ist ein Bereich fuer die
 * Metropole offen.
 */

export const TRACK_IDS = ['trade', 'politics', 'science'] as const;

export type TrackId = (typeof TRACK_IDS)[number];

export const TrackIdSchema = z.enum(TRACK_IDS);

/** Womit ein Bereich bezahlt wird. */
export const TRACK_COMMODITY: Readonly<Record<TrackId, CommodityId>> = {
  trade: 'cloth',
  politics: 'coin',
  science: 'paper',
};

/**
 * Die fuenf Stufen je Bereich, von 1 bis 5 - mit ihrem Artikel.
 *
 * Der Artikel steht **daneben** und nicht im Namen: der Verlaufssatz braucht
 * ihn ("Anna baut **die** Gilde"), das Tableau nicht (dort steht "Gilde" unter
 * der Stufe). Ihn in den Namen zu schreiben und zum Anzeigen abzuschneiden
 * waere eine Grammatik im Code - dieselbe Falle, die in 10b zu
 * `KNIGHT_LABELS_DATIVE` gefuehrt hat. Fuenfzehn deutsche Artikel folgen keiner
 * Regel, die man ableiten koennte.
 *
 * **Die Stufennamen stehen in `shared` und nicht im Client**, weil der Server
 * den Verlaufssatz baut ("hat die Gilde gebaut"). Zwei Namenslisten liefen
 * auseinander.
 */
export interface TrackStep {
  readonly name: string;
  /** "der", "die" oder "das" - fuer den Verlaufssatz. */
  readonly article: 'der' | 'die' | 'das';
}

export const TRACK_STEPS: Readonly<Record<TrackId, readonly TrackStep[]>> = {
  science: [
    { name: 'Schule', article: 'die' },
    { name: 'Bibliothek', article: 'die' },
    { name: 'Aquädukt', article: 'das' },
    { name: 'Theater', article: 'das' },
    { name: 'Universität', article: 'die' },
  ],
  trade: [
    { name: 'Markt', article: 'der' },
    { name: 'Zunft', article: 'die' },
    { name: 'Gilde', article: 'die' },
    { name: 'Bank', article: 'die' },
    { name: 'Handelszentrum', article: 'das' },
  ],
  politics: [
    { name: 'Rathaus', article: 'das' },
    { name: 'Botschaft', article: 'die' },
    { name: 'Festung', article: 'die' },
    { name: 'Gericht', article: 'das' },
    { name: 'Rat Catans', article: 'der' },
  ],
};

/** Die hoechste Stufe, die ein Bereich hat. */
export const MAX_TRACK_LEVEL = 5;

/** Ab welcher Stufe der Aufsatz vergeben wird. */
export const METROPOLIS_LEVEL = 4;

/**
 * Ab welcher Ausbaustufe der Wissenschaft das Aquaedukt steht.
 *
 * `AQUEDUCT_LEVEL`, `GUILD_LEVEL` und `FORTRESS_LEVEL` stehen als drei
 * Konstanten mit dem Wert 3 nebeneinander - nicht eine geteilte Konstante:
 * sie sind drei verschiedene Regeln, die zufaellig dieselbe Zahl tragen, und
 * wer eine davon verschiebt, soll die anderen nicht mitverschieben.
 */
export const AQUEDUCT_LEVEL = 3;

/** Ab welcher Ausbaustufe des Handels die Gilde steht. */
export const GUILD_LEVEL = 3;

/**
 * Ab welcher Ausbaustufe der Politik die Festung steht.
 *
 * Eine Zahl mit Namen statt einer Drei im Code: sie steht in der Stufenliste
 * ein zweites Mal, und so steht sie an einem Ort.
 */
export const FORTRESS_LEVEL = 3;

/**
 * Die n-te Stufe kostet n Handelswaren ihrer Sorte.
 *
 * **Wirft, statt einen leeren Mengensatz zu geben.** Eine Stufe, die es nicht
 * gibt, ist ein Fehler im Aufrufer und kein Spielzug - dieselbe Grenze, die
 * `costOf` in `build.ts` zieht. Ein `EMPTY_CARDS` gaebe die Stufe zum
 * Nulltarif her.
 */
export function improvementCost(track: TrackId, level: number): CardAmounts {
  if (!Number.isInteger(level) || level < 1 || level > MAX_TRACK_LEVEL) {
    throw new RangeError(
      `improvementCost: Stufe ${level} gibt es nicht (1 bis ${MAX_TRACK_LEVEL})`,
    );
  }
  return { ...EMPTY_CARDS, [TRACK_COMMODITY[track]]: level };
}

function stepAt(track: TrackId, level: number): TrackStep {
  const step = TRACK_STEPS[track][level - 1];
  if (step === undefined) {
    throw new RangeError(`stepAt: Stufe ${level} gibt es in ${track} nicht`);
  }
  return step;
}

/** Wie die n-te Stufe dieses Bereichs heisst - ohne Artikel. */
export function stepName(track: TrackId, level: number): string {
  return stepAt(track, level).name;
}

/** Dieselbe Stufe mit Artikel: "die Gilde", "das Theater", "der Rat Catans". */
export function stepWithArticle(track: TrackId, level: number): string {
  const step = stepAt(track, level);
  return `${step.article} ${step.name}`;
}

/** Ab welcher roten Augenzahl abwaerts eine Fortschrittskarte faellt: Stufe + 1. */
export function progressThreshold(level: number): number {
  return level + 1;
}

/**
 * Die erreichte Stufe dieses Spielers in diesem Bereich.
 *
 * Liest `improvements[track] ?? 0`: ein nicht begonnener Bereich braucht
 * keine Null im Zustand; was fehlt, ist null.
 */
export function levelOf(player: PlayerState, track: TrackId): number {
  return player.improvements[track] ?? 0;
}

export function hasAqueduct(player: PlayerState): boolean {
  return levelOf(player, 'science') >= AQUEDUCT_LEVEL;
}

export function hasGuild(player: PlayerState): boolean {
  return levelOf(player, 'trade') >= GUILD_LEVEL;
}

/** Ob dieser Spieler Starke zu Maechtigen Rittern aufwerten darf. */
export function hasFortress(player: PlayerState): boolean {
  return levelOf(player, 'politics') >= FORTRESS_LEVEL;
}
