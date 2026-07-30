import type { ResourceAmounts } from '../rules/index.js';
import { RESOURCE_IDS, type ResourceId } from '../scenario/index.js';

/**
 * Rechnen mit Ressourcenmengen.
 *
 * `ResourceAmounts` ist ein vollstaendiger `Record<ResourceId, number>` (Regel 5:
 * Ressourcen als Record, nicht als feste Felder). Vollstaendig heisst: jede
 * Ressource ist genannt, auch mit null. Das erspart im Reducer jedes `?? 0` und
 * macht aus einer vergessenen Ressource einen Compilerfehler statt eines
 * stillen Rechenfehlers.
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
};

/** Baut eine Menge aus einer Funktion je Ressource - die gemeinsame Grundlage aller Rechnungen. */
function fromEach(pick: (resource: ResourceId) => number): ResourceAmounts {
  const result = { ...EMPTY_RESOURCES };
  for (const resource of RESOURCE_IDS) result[resource] = pick(resource);
  return result;
}

/** Wie viele Karten die Menge insgesamt umfasst. */
export function countResources(amounts: ResourceAmounts): number {
  let total = 0;
  for (const resource of RESOURCE_IDS) total += amounts[resource];
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
  return RESOURCE_IDS.every((resource) => have[resource] >= cost[resource]);
}

/**
 * Die `index`-te Karte einer Hand, in fester Ressourcenreihenfolge.
 *
 * Ein Griff in eine fremde Hand ist ein Ziehen aus einem verdeckten Stapel: die
 * Karten werden durchnummeriert, der Zufall liefert den Index. Ueber die feste
 * Reihenfolge bleibt der Diebstahl aus Seed und Zustand rekonstruierbar - Regel 2.
 */
export function resourceAt(amounts: ResourceAmounts, index: number): ResourceId {
  const total = countResources(amounts);
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new RangeError(
      `resourceAt: Index ${index} liegt ausserhalb einer Hand mit ${total} Karten`,
    );
  }

  let remaining = index;
  for (const resource of RESOURCE_IDS) {
    if (remaining < amounts[resource]) return resource;
    remaining -= amounts[resource];
  }

  // Unerreichbar: die Summe der Anteile ist `total`, und `index < total`.
  throw new RangeError(`resourceAt: Index ${index} nicht aufloesbar`);
}
