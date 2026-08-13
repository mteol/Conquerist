import type { JSX } from 'react';
import {
  EMPTY_RESOURCES,
  RESOURCE_IDS,
  type ResourceAmounts,
  type ResourceId,
} from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';

/**
 * Die Mengenwahl fuer einen Tausch: links, was hinausgeht, rechts, was hereinkommt.
 *
 * Eine Komponente fuer beide Stellen, an denen Mengen gewaehlt werden - das
 * Angebot im Handelsfenster und das Gegenangebot im Angebotsdialog. Zweimal
 * dasselbe Formular waere zweimal dieselbe Sperre, und beim naechsten Mal nur
 * an einer Stelle gepflegt.
 *
 * Gesteuert von aussen: der Aufrufer haelt die Mengen und schickt sie
 * anschliessend hinaus.
 *
 * Was hier **nicht** geprueft wird, ist die Regel. Die Sperren sind
 * Bedienkomfort - dass eine Seite gefuellt sein muss und keine Sorte auf beiden
 * Seiten stehen darf, entscheidet `canOfferTrade` in `shared`.
 */
export interface TradeAmountsProps {
  /** Die eigene Hand - Obergrenze fuer das, was man weggibt. */
  readonly owned: ResourceAmounts;
  readonly give: ResourceAmounts;
  readonly want: ResourceAmounts;
  readonly onGive: (next: ResourceAmounts) => void;
  readonly onWant: (next: ResourceAmounts) => void;
}

/** Beide Seiten leer - der Startwert jeder Mengenwahl. */
export const NO_AMOUNTS: ResourceAmounts = { ...EMPTY_RESOURCES };

export function totalOf(amounts: ResourceAmounts): number {
  return RESOURCE_IDS.reduce((sum, resource) => sum + (amounts[resource] ?? 0), 0);
}

/**
 * Ob dieses Paar als Angebot taugt: beide Seiten gefuellt, keine Sorte doppelt.
 *
 * Dieselbe Form wie `checkShape` in `shared` - hier nur als Ja/Nein fuer die
 * Sperre am Knopf. Die verbindliche Auslegung bleibt dort.
 */
export function isTradeShapeValid(give: ResourceAmounts, want: ResourceAmounts): boolean {
  if (totalOf(give) === 0 || totalOf(want) === 0) return false;

  return !RESOURCE_IDS.some((resource) => (give[resource] ?? 0) > 0 && (want[resource] ?? 0) > 0);
}

export function TradeAmounts({
  owned,
  give,
  want,
  onGive,
  onWant,
}: TradeAmountsProps): JSX.Element {
  const step = (
    amounts: ResourceAmounts,
    resource: ResourceId,
    delta: number,
    max: number,
  ): ResourceAmounts | null => {
    const next = (amounts[resource] ?? 0) + delta;
    if (next < 0 || next > max) return null;
    return { ...amounts, [resource]: next };
  };

  return (
    <div className="trade">
      <fieldset className="cards">
        <legend>Du gibst</legend>
        {RESOURCE_IDS.map((resource) => {
          const held = owned[resource] ?? 0;
          return (
            <div key={resource} className="cards__item">
              <span className="cards__label">{RESOURCE_LABELS[resource]}</span>
              <span className="cards__held">von {held}</span>
              <div className="cards__stepper">
                <button
                  type="button"
                  aria-label={`${RESOURCE_LABELS[resource]} weniger anbieten`}
                  onClick={() => {
                    const next = step(give, resource, -1, held);
                    if (next !== null) onGive(next);
                  }}
                >
                  −
                </button>
                <span data-testid={`give-${resource}`}>{give[resource] ?? 0}</span>
                <button
                  type="button"
                  aria-label={`${RESOURCE_LABELS[resource]} mehr anbieten`}
                  onClick={() => {
                    const next = step(give, resource, 1, held);
                    if (next !== null) onGive(next);
                  }}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="cards">
        <legend>Du moechtest</legend>
        {RESOURCE_IDS.map((resource) => (
          <div key={resource} className="cards__item">
            <span className="cards__label">{RESOURCE_LABELS[resource]}</span>
            <div className="cards__stepper">
              <button
                type="button"
                aria-label={`${RESOURCE_LABELS[resource]} weniger verlangen`}
                onClick={() => {
                  // Nach oben offen: was man verlangt, hat man ja gerade nicht.
                  const next = step(want, resource, -1, Number.MAX_SAFE_INTEGER);
                  if (next !== null) onWant(next);
                }}
              >
                −
              </button>
              <span data-testid={`want-${resource}`}>{want[resource] ?? 0}</span>
              <button
                type="button"
                aria-label={`${RESOURCE_LABELS[resource]} mehr verlangen`}
                onClick={() => {
                  const next = step(want, resource, 1, Number.MAX_SAFE_INTEGER);
                  if (next !== null) onWant(next);
                }}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
