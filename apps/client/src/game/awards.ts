import type { PlayerId, PlayerView } from '@conquerist/shared';

/**
 * Die zwei Auszeichnungen, die auf dem Tisch liegen: Laengste Handelsstrasse
 * und Groesste Rittermacht.
 *
 * **Warum sie ein eigenes Anzeigemodell bekommen und nicht zwei `if` im JSX.**
 * Beide sind dasselbe Ding in drei Lagen - sie liegen frei, sie liegen vor
 * jemand anderem, oder sie liegen vor einem selbst -, und an jeder der drei
 * Stellen wird dieselbe Frage gestellt: wer haelt sie, mit welchem Wert, und
 * was braeuchte man dafuer. Zweimal ausgeschrieben waeren das zwei Fassungen
 * derselben Regel, die beim ersten Umbau auseinanderlaufen; hier steht sie
 * einmal.
 *
 * Gerechnet wird nichts: `holder`, `length` und `size` kommen fertig aus der
 * Sicht, die Schwellen und Punktwerte aus dem RuleSet der Partie. Der Client
 * legt sie nur nebeneinander - Regel 3, und dieselbe Zurueckhaltung, mit der
 * `view.ts` seit Etappe 4 auskommt.
 */
export const AWARD_IDS = ['longestRoad', 'largestArmy'] as const;

export type AwardId = (typeof AWARD_IDS)[number];

export interface Award {
  readonly id: AwardId;
  /** Der volle Name, wie er im Verlauf und in der Abrechnung steht. */
  readonly label: string;
  /**
   * Der Name auf der Karte.
   *
   * „Laengste Handelsstrasse" braucht auf einer 4.6rem breiten Karte drei
   * Zeilen und draengt das Motiv heraus. Gekuerzt wird der Artikel und nicht
   * das Wort: „Handelsstrasse" ist dieselbe Sache wie „Laengste
   * Handelsstrasse", „Strasse" waere eine andere (davon baut man welche).
   */
  readonly short: string;
  readonly holder: PlayerId | null;
  /** Name und Farbe des Inhabers - `null`, solange sie niemand hat. */
  readonly holderName: string | null;
  readonly holderColor: string | null;
  /**
   * Der Wert, der sie traegt: Strassenlaenge oder Zahl der Ritter.
   *
   * Bei der Handelsstrasse kann er auch dann stehen, wenn sie niemand haelt -
   * dann sind zwei gleichauf und keiner bekommt sie. Genau dieser Fall ist der
   * Grund, warum die Karte den Wert und nicht nur den Inhaber kennt.
   */
  readonly value: number;
  /** Ab wann sie ueberhaupt vergeben wird. */
  readonly minimum: number;
  /** Was sie einbringt, solange man sie haelt. */
  readonly points: number;
  /** Was gezaehlt wird, im Plural - immer, denn unter der Schwelle liegt keine 1. */
  readonly unit: string;
}

const LABELS: Readonly<Record<AwardId, { readonly label: string; readonly short: string }>> = {
  longestRoad: { label: 'Längste Handelsstraße', short: 'Handelsstraße' },
  largestArmy: { label: 'Größte Rittermacht', short: 'Rittermacht' },
};

const UNITS: Readonly<Record<AwardId, string>> = {
  longestRoad: 'Straßen',
  largestArmy: 'Ritter',
};

/**
 * Die Auszeichnungen **dieses Tisches**, in fester Reihenfolge - sie sollen
 * nicht springen.
 *
 * "Dieses Tisches" ist neu und im Browser aufgefallen: in Staedte & Ritter gibt
 * es die Groesste Rittermacht nicht, die Sondersiegpunkttafel bleibt in der
 * Schachtel. Ihre Karte lag trotzdem am Tisch und versprach "ab 3 Ritter" -
 * ein Wettlauf, den niemand laufen kann, um einen Preis, der null zaehlt.
 *
 * Woran es haengt, ist der Punktwert im Regelwerk und kein Name: was null
 * einbringt, wird nicht vergeben. Damit braucht die Erweiterung hier keinen
 * Eintrag, und ein spaeteres Regelwerk ohne Handelsstrasse auch nicht.
 */
export function awardsOf(view: PlayerView): readonly Award[] {
  const pointsOf = (id: AwardId): number =>
    id === 'longestRoad'
      ? view.rules.victoryPoints.longestRoad
      : view.rules.victoryPoints.largestArmy;

  const seatOf = (id: PlayerId | null): PlayerView['players'][number] | undefined =>
    id === null ? undefined : view.players.find((player) => player.id === id);

  return AWARD_IDS.filter((id) => pointsOf(id) > 0).map((id): Award => {
    const holder = id === 'longestRoad' ? view.longestRoad.holder : view.largestArmy.holder;
    const value = id === 'longestRoad' ? view.longestRoad.length : view.largestArmy.size;
    const seat = seatOf(holder);

    return {
      id,
      label: LABELS[id].label,
      short: LABELS[id].short,
      holder,
      holderName: seat?.name ?? null,
      holderColor: seat?.color ?? null,
      value,
      minimum: id === 'longestRoad' ? view.rules.longestRoadMinimum : view.rules.largestArmyMinimum,
      points: pointsOf(id),
      unit: UNITS[id],
    };
  });
}

/**
 * Die Zeile unter dem Motiv.
 *
 * Drei Faelle, und der mittlere ist der, den ein blosses „liegt noch da"
 * verschwiegen haette: bei der Handelsstrasse kann ein Wert stehen, ohne dass
 * jemand sie haelt - zwei sind gleichauf, und wer als naechster anbaut, nimmt
 * sie. „Ab 5 Straßen" waere dort schlicht falsch, die fuenf sind laengst
 * ueberboten.
 */
export function awardFoot(award: Award): string {
  if (award.holder !== null) return `${award.value} ${award.unit}`;
  if (award.value >= award.minimum) return `Gleichauf bei ${award.value}`;
  return `ab ${award.minimum} ${award.unit}`;
}

/** Der ganze Satz - fuer Vorlesewerkzeuge und den Kurzhinweis am Zeiger. */
export function awardTitle(award: Award): string {
  const who =
    award.holder === null ? 'hat noch niemand' : `hält ${award.holderName ?? award.holder}`;

  return `${award.label} (${award.points} Siegpunkte) — ${who}, ${awardFoot(award)}`;
}

/** Was dieser Spieler vor sich liegen hat. */
export function awardsHeldBy(awards: readonly Award[], player: PlayerId): readonly Award[] {
  return awards.filter((award) => award.holder === player);
}

/** Was noch frei in der Mitte liegt. */
export function openAwards(awards: readonly Award[]): readonly Award[] {
  return awards.filter((award) => award.holder === null);
}
