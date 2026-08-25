import type { ResourceAmounts } from '../rules/index.js';
import { CARD_IDS, type CardId } from '../scenario/index.js';

/**
 * Rechnen mit Kartenmengen.
 *
 * `ResourceAmounts` ist ein vollstaendiger `Record<CardId, number>` (Regel 5:
 * Ressourcen als Record, nicht als feste Felder). Vollstaendig heisst: jede
 * Sorte ist genannt, auch mit null. Das erspart im Reducer jedes `?? 0` und
 * macht aus einer vergessenen Sorte einen Compilerfehler statt eines stillen
 * Rechenfehlers.
 *
 * **Gerechnet wird ueber `CARD_IDS`, nicht ueber `RESOURCE_IDS`.** Was auf
 * einer Hand liegt, wird gleich behandelt - Handelswaren werden gestohlen,
 * abgeworfen und gehandelt wie Rohstoffe. Der Unterschied steht dort, wo er
 * gilt: in den Baukosten, an den Haefen und beim Ertrag.
 *
 * Alle Funktionen hier sind rein und geben neue Objekte zurueck.
 */

/** Nichts von allem. Startwert fuer jede Hand. */
export const EMPTY_RESOURCES: ResourceAmounts = {
  brick: 0,
  lumber: 0,
  wool: 0,
  grain: 0,
  ore: 0,
  paper: 0,
  cloth: 0,
  coin: 0,
};

/** Baut eine Menge aus einer Funktion je Ressource - die gemeinsame Grundlage aller Rechnungen. */
function fromEach(pick: (card: CardId) => number): ResourceAmounts {
  const result = { ...EMPTY_RESOURCES };
  for (const resource of CARD_IDS) result[resource] = pick(resource);
  return result;
}

/** Wie viele Karten die Menge insgesamt umfasst. */
export function countResources(amounts: ResourceAmounts): number {
  let total = 0;
  for (const resource of CARD_IDS) total += amounts[resource];
  return total;
}

/** Komponentenweise Summe. */
export function addResources(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
  return fromEach((resource) => a[resource] + b[resource]);
}

/**
 * Komponentenweise Differenz.
 *
 * Wirft, sobald etwas ins Minus liefe. Ein negativer Bestand waere ein stiller
 * Regelfehler, der erst Runden spaeter als unmoegliche Handkartenzahl auffiele;
 * Aufrufer pruefen vorher mit `canAfford`.
 */
export function subtractResources(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
  return fromEach((resource) => {
    const left = a[resource] - b[resource];
    if (left < 0) {
      throw new RangeError(
        `subtractResources: ${resource} waere ${left} - es fehlen ${-left} Karten`,
      );
    }
    return left;
  });
}

/** Komponentenweise Vervielfachung. */
export function scaleResources(amounts: ResourceAmounts, factor: number): ResourceAmounts {
  return fromEach((resource) => amounts[resource] * factor);
}

/** Ob `have` die Kosten `cost` vollstaendig deckt. */
export function canAfford(have: ResourceAmounts, cost: ResourceAmounts): boolean {
  return CARD_IDS.every((resource) => have[resource] >= cost[resource]);
}

/**
 * Die `index`-te Karte einer Hand, in fester Ressourcenreihenfolge.
 *
 * Ein Griff in eine fremde Hand ist ein Ziehen aus einem verdeckten Stapel: die
 * Karten werden durchnummeriert, der Zufall liefert den Index. Ueber die feste
 * Reihenfolge bleibt der Diebstahl aus Seed und Zustand rekonstruierbar - Regel 2.
 */
export function resourceAt(amounts: ResourceAmounts, index: number): CardId {
  const total = countResources(amounts);
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new RangeError(
      `resourceAt: Index ${index} liegt ausserhalb einer Hand mit ${total} Karten`,
    );
  }

  let remaining = index;
  for (const resource of CARD_IDS) {
    if (remaining < amounts[resource]) return resource;
    remaining -= amounts[resource];
  }

  // Unerreichbar: die Summe der Anteile ist `total`, und `index < total`.
  throw new RangeError(`resourceAt: Index ${index} nicht aufloesbar`);
}
