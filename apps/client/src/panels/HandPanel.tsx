import type { JSX } from 'react';
import { RESOURCE_IDS, type ResourceAmounts } from '@conquerist/shared';
import { RESOURCE_COLORS, RESOURCE_LABELS } from '../game/labels';
import { ResourceGlyph } from './ResourceGlyph';

/**
 * Die eigene Hand, unten links.
 *
 * **Ein Stapel je Ressource, nicht eine Karte je Karte.** Bei drei Karten
 * saehe ein Faecher aus Einzelkarten besser aus; bei fuenfzehn muesste man
 * zaehlen, und genau dann ist die Zahl wichtig - vor dem Abwerfen. Die Plakette
 * sagt sie, die Breite bleibt gleich, und die Stapeltiefe darunter macht die
 * Menge trotzdem sichtbar, ohne dass jemand sie ablesen muesste.
 *
 * **Was es nicht gibt: eine Null.** Eine Ressource ohne Karten hat keinen
 * Stapel. Ein leeres Kartenfeld mit einer 0 kostet dieselbe Flaeche wie ein
 * volles und sagt nur, dass da nichts ist - das sagt das Fehlen besser.
 *
 * Farbe und Motiv tragen dieselbe Aussage doppelt: die Kartenfarbe ist die des
 * Gelaendes vom Brett, das Motiv zeigt, was darauf waechst. Wer Farben schlecht
 * unterscheidet, liest das Motiv; wer schnell schaut, die Farbe.
 */
export interface HandPanelProps {
  /** `null` heisst: fremde Hand. Dann gibt es hier nichts zu zeigen. */
  readonly resources: ResourceAmounts | null;
  readonly cardCount: number;
  /** Zugedeckt: die Karten liegen auf dem Ruecken, die Anzahl bleibt lesbar. */
  readonly covered: boolean;
  readonly onReveal: () => void;
  /** Wessen Hand hier liegt - nur noetig, wenn das nicht selbstverstaendlich ist. */
  readonly owner?: string;
}

export function HandPanel({
  resources,
  cardCount,
  covered,
  onReveal,
  owner,
}: HandPanelProps): JSX.Element | null {
  if (resources === null) return null;

  const stacks = RESOURCE_IDS.map((resource) => ({
    resource,
    amount: resources[resource] ?? 0,
  })).filter((stack) => stack.amount > 0);

  return (
    <section
      className="hand"
      aria-label={owner === undefined ? 'Deine Karten' : `${owner}s Karten`}
    >
      <header className="hand__head">
        <span className="panel__title">{owner === undefined ? 'Deine Karten' : owner}</span>
        <span className="hand__total" data-testid="hand-total">
          {cardCount}
        </span>
      </header>

      {covered ? (
        <div className="hand__cover">
          <div className="hand__backs" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <button type="button" className="button button--ghost" onClick={onReveal}>
            Karten ansehen
          </button>
        </div>
      ) : stacks.length === 0 ? (
        <p className="hand__empty">Keine Karten auf der Hand.</p>
      ) : (
        <ol className="hand__stacks">
          {stacks.map(({ resource, amount }) => (
            <li key={resource}>
              <Stack resource={resource} amount={amount} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Ein Stapel.
 *
 * Die Tiefe ist gedeckelt: ab vier Karten wird der Stapel nicht mehr hoeher,
 * sonst waechst er bei einem Kornmonopol aus der Ecke heraus. Die Plakette
 * traegt die genaue Zahl - die Tiefe ist nur der schnelle Eindruck.
 */
function Stack({
  resource,
  amount,
}: {
  readonly resource: (typeof RESOURCE_IDS)[number];
  readonly amount: number;
}): JSX.Element {
  const depth = Math.min(amount, 4);

  return (
    <div className="card" data-testid={`stack-${resource}`} title={RESOURCE_LABELS[resource]}>
      {Array.from({ length: depth - 1 }, (_unused, index) => (
        <span
          key={index}
          className="card__behind"
          aria-hidden="true"
          style={{
            background: RESOURCE_COLORS[resource],
            transform: `translateY(${(index + 1) * -2.5}px)`,
          }}
        />
      ))}

      <span className="card__face" style={{ background: RESOURCE_COLORS[resource] }}>
        <ResourceGlyph resource={resource} />
      </span>

      <span className="card__count" aria-hidden="true">
        {amount}
      </span>

      {/*
       * Der Name steht nicht mehr unter der Karte - dieselbe Entscheidung wie
       * bei den Bauteilen im Vorrat: er beschriftete ein Bild, das schon
       * spricht (Gelaendefarbe plus Motiv), und kostete unter jeder Karte eine
       * Zeile, die dem Brett an Hoehe abging. Fuer Vorlesewerkzeuge steht er
       * hier weiter, zusammen mit der Menge; sichtbar bleibt er im `title`.
       */}
      <span className="visually-hidden">{`${amount} ${RESOURCE_LABELS[resource]}`}</span>
    </div>
  );
}
