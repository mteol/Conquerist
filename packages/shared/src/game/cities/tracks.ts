import { z } from 'zod';

/**
 * Die drei Bereiche des Stadtausbaus - vorerst nur ihre Namen.
 *
 * **Was hier fehlt, gehoert zu Etappe 10c:** die fuenf Stufen je Bereich, ihre
 * Preise, die Schwelle am roten Wuerfel und die Metropolen. Diese Datei traegt
 * in 10b genau so viel, wie 10b braucht, und das ist genau ein Bereich: die
 * **Festung** (Politik, dritte Stufe) ist die Bedingung dafuer, dass ein
 * Starker Ritter zum Maechtigen wird.
 *
 * Der Bereich steht deshalb schon im Spielerzustand (`improvements`). Ohne ihn
 * muesste `canUpgradeKnight` die dritte Stufe fest verneinen - und eine Regel,
 * die "nie" sagt, wo "noch nicht" gilt, ist derselbe Fehler wie ein Knopf, der
 * nie angeht.
 */

export const TRACK_IDS = ['trade', 'politics', 'science'] as const;

export type TrackId = (typeof TRACK_IDS)[number];

export const TrackIdSchema = z.enum(TRACK_IDS);

/**
 * Ab welcher Ausbaustufe der Politik die Festung steht.
 *
 * Eine Zahl mit Namen statt einer Drei im Code: sie steht in 10c ein zweites
 * Mal in der Stufenliste, und dann soll sie an einem Ort stehen.
 */
export const FORTRESS_LEVEL = 3;
