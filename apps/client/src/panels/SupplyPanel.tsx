import { useState, type JSX } from 'react';
import { RESOURCE_IDS, type ResourceAmounts, type ResourceId } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import { ResourceGlyph } from './ResourceGlyph';

/**
 * Was von den Stapeln noch da ist.
 *
 * **Rolle:** die Auskunft, die das Brett nicht gibt. Wer wissen will, ob sich
 * das Warten auf Erz noch lohnt, konnte bis hierher nur mitzaehlen - die Bank
 * lag offen auf dem Tisch, aber nirgends im Bild.
 *
 * **Warum eingeklappt:** es ist eine Auskunft und kein Bedienelement. Offen
 * stehend naehme sie dauerhaft Platz in einer Leiste, in der jeder Streifen
 * schon vergeben ist; als Knopf kostet sie nichts, bis jemand fragt. Dasselbe
 * Muster wie beim `LogPanel`, und aus demselben Grund bleibt der Zustand hier:
 * ob die Uebersicht offen ist, geht den Spielzustand nichts an.
 *
 * **Warum neben jedem Rest die Ausgangsmenge steht:** eine nackte Zwoelf sagt
 * nicht, ob der Stapel halb voll oder fast leer ist. Und die Ausgangsmenge ist
 * seit der Fuenf-bis-Sechser-Erweiterung keine Konstante mehr - sie kommt aus
 * dem Regelwerk der Partie, nicht aus dem Code.
 *
 * **Der Entwicklungsstapel steht hier ein zweites Mal**, neben dem `DeckPanel`,
 * das ihn als Kaufknopf zeigt. Das ist Absicht: "die Stapel" ist eine Frage,
 * und eine Antwort, die einen davon auslaesst, weil er anderswo schon steht,
 * zwingt zum Zusammensuchen.
 */
export interface SupplyPanelProps {
  /** Was die Bank noch hergibt - offenes Material, steht so in der `PlayerView`. */
  readonly bank: ResourceAmounts;
  /** Womit die Partie angefangen hat, aus `rules.resourceBank`. */
  readonly start: ResourceAmounts;
  readonly deckLeft: number;
  readonly deckStart: number;
}

/** Eine Zeile: Stapel, Rest, Ausgangsmenge, und wie voll er noch ist. */
function Row({
  testId,
  label,
  left,
  total,
  glyph,
}: {
  readonly testId: string;
  readonly label: string;
  readonly left: number;
  readonly total: number;
  readonly glyph: JSX.Element;
}): JSX.Element {
  /*
   * Ein leerer Stapel bekommt einen leeren Balken, kein geteiltes Nichts.
   * `total` ist zwar nie null, aber eine Division, die auf eine Zahl aus einem
   * fremden Regelwerk baut, ist genau die Stelle, an der eine Variante spaeter
   * still `NaN` in die Breite schreibt.
   */
  const share = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;

  return (
    <li className="supply__row" data-testid={testId}>
      {glyph}
      <span className="supply__name">{label}</span>
      <span className="supply__count">
        <strong>{left}</strong> von {total}
      </span>
      <span className="supply__bar" aria-hidden="true">
        <span className="supply__fill" style={{ width: `${share * 100}%` }} />
      </span>
    </li>
  );
}

export function SupplyPanel({ bank, start, deckLeft, deckStart }: SupplyPanelProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="supply">
      <button
        type="button"
        className={open ? 'supply__toggle supply__toggle--open' : 'supply__toggle'}
        data-testid="supply-toggle"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <svg className="supply__mark" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="14" width="18" height="4" rx="1" />
          <rect x="5" y="9" width="14" height="4" rx="1" />
          <rect x="7" y="4" width="10" height="4" rx="1" />
        </svg>
        Vorrat
      </button>

      {open ? (
        <section className="supply__sheet" aria-label="Vorrat der Bank">
          <ul className="supply__list">
            {RESOURCE_IDS.map((resource: ResourceId) => (
              <Row
                key={resource}
                testId={`supply-${resource}`}
                label={RESOURCE_LABELS[resource]}
                left={bank[resource]}
                total={start[resource]}
                glyph={<ResourceGlyph resource={resource} />}
              />
            ))}

            <Row
              testId="supply-deck"
              label="Entwicklungskarten"
              left={deckLeft}
              total={deckStart}
              glyph={
                /* Ein Kartenruecken, keine bestimmte Karte - der Stapel liegt verdeckt. */
                <svg className="card__glyph" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                </svg>
              }
            />
          </ul>
        </section>
      ) : null}
    </div>
  );
}
