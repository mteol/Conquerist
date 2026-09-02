import { useState, type JSX } from 'react';
import { EMPTY_CARDS, type CardAmounts, type CardId } from '@conquerist/shared';
import { CARD_LABELS } from '../game/labels';
import { ResourceCard } from '../panels/ResourceCard';
import type { PlayerRow } from '../game/view';

/**
 * Abwerfen nach einer Sieben.
 *
 * `legalActions` zaehlt diese Aktion bewusst nicht auf - bei acht Handkarten
 * gaebe es dutzende gueltige Kombinationen. Der Dialog stellt eine davon
 * zusammen und gibt genau die gewaehlten Karten zurueck; ob die Zahl stimmt,
 * prueft am Ende trotzdem `applyDiscard`. Die Sperre am Knopf ist Bedienkomfort,
 * nicht die Regel.
 *
 * Sichtbar ist der Dialog nur fuer den Betroffenen. Was noch fehlt, damit es
 * weitergeht, steht fuer alle im Status- und Aktionspanel.
 */
export interface DiscardDialogProps {
  readonly player: PlayerRow;
  /**
   * Welche Kartensorten an diesem Tisch liegen.
   *
   * Kommt aus dem Regelwerk und nicht aus einer festen Liste: Handelswaren
   * zaehlen beim Abwerfen mit, und an einem Basistisch gibt es sie nicht. Drei
   * Karten zu zeigen, von denen man nie eine haelt, waere eine Auswahl ins
   * Leere.
   */
  readonly cards: readonly CardId[];
  readonly required: number;
  readonly onConfirm: (resources: CardAmounts) => void;
}

export function DiscardDialog({
  player,
  cards,
  required,
  onConfirm,
}: DiscardDialogProps): JSX.Element {
  const [chosen, setChosen] = useState<CardAmounts>({ ...EMPTY_CARDS });
  const held = player.resources ?? EMPTY_CARDS;
  const total = cards.reduce((sum, card) => sum + (chosen[card] ?? 0), 0);

  /**
   * Ob dieser Schritt ueberhaupt etwas taete.
   *
   * **Eine Regel und nicht zwei.** Sie stand bis hierher nur im Handler: der
   * Knopf sah in jeder Lage bedienbar aus, klemmte aber lautlos, sobald nichts
   * mehr ging - bei einer Sorte, von der man nichts hat („von 0"), tat das `+`
   * ueberhaupt nie etwas. Ein Bedienelement, das nichts bewirkt, muss das
   * zeigen; dieselbe Ueberlegung wie beim Siegpunkt, der kein Knopf mehr ist.
   * Damit Knopfzustand und Wirkung nicht auseinanderlaufen koennen, fragen
   * beide dieselbe Funktion.
   */
  const canStep = (resource: CardId, delta: number): boolean => {
    const next = (chosen[resource] ?? 0) + delta;
    if (next < 0 || next > (held[resource] ?? 0)) return false;
    // Nach oben ist auch die geforderte Zahl eine Grenze: wer vier von vier
    // gewaehlt hat, ist fertig, und das sagen die toten Knoepfe mit.
    return !(delta > 0 && total >= required);
  };

  /*
   * Ob eine gewaehlte Sorte mehr enthaelt, als tatsaechlich auf der Hand
   * liegt - unabhaengig davon, wie sie dorthin kam.
   *
   * **Befund C, Aufgabe 16.** Zwei `+`-Klicks auf dieselbe Sorte, die im
   * selben Schub verarbeitet werden (ein Doppel-Klick, oder ein Browser, der
   * fuer eine Geste zwei `click`-Ereignisse ausliefert), lasen bislang beide
   * denselben Stand von `chosen`/`total` aus dem Rendering, in dem sie
   * ausgeloest wurden - `canStep` erlaubte beide, weil keiner der beiden vom
   * jeweils anderen wusste. Das Ergebnis: eine Sorte stand ueber dem
   * Bestand, der Knopf blieb trotzdem bedienbar (die *Summe* stimmte ja), und
   * jeder Klick auf "Abwerfen" wurde vom Server lautlos abgelehnt.
   *
   * `excess` ist die zweite Haelfte der Behebung: eine Sperre, die nicht
   * danach fragt, *wie* eine Sorte ueber den Bestand kam, sondern nur, *ob*
   * sie es gerade ist - unabhaengig von der ersten Haelfte unten
   * (`change`), die genau das an der Quelle verhindert. Ein Bedienelement,
   * das zusagt zu funktionieren und es nicht tut, war in dieser Etappe schon
   * einmal ein Befund.
   */
  const excess = cards.find((resource) => (chosen[resource] ?? 0) > (held[resource] ?? 0));

  const change = (resource: CardId, delta: number): void => {
    /*
     * Die Grenze wird hier innerhalb des funktionalen Updaters neu
     * ausgewertet, nicht vorab gegen `chosen`/`total` aus dem Rendering
     * geprueft (das war `canStep`s Job, und genau der stand `change` bisher
     * im Weg - siehe `excess` oben). Landen zwei Klicks im selben Schub,
     * sieht der zweite Aufruf hier garantiert das Ergebnis des ersten, weil
     * React funktionale Updates innerhalb eines Schubs der Reihe nach
     * anwendet - nie den Stand von vor dem Schub zweimal.
     */
    setChosen((current) => {
      const currentTotal = cards.reduce((sum, card) => sum + (current[card] ?? 0), 0);
      const next = (current[resource] ?? 0) + delta;

      if (next < 0 || next > (held[resource] ?? 0)) return current;
      if (delta > 0 && currentTotal >= required) return current;

      return { ...current, [resource]: next };
    });
  };

  return (
    <div className="modal" role="dialog" aria-label={`${player.name} wirft ab`}>
      <div className="modal__box">
        <h2>
          {player.name}, wirf {required} Karten ab
        </h2>
        <p className="modal__hint">
          Nur du siehst dieses Fenster. {player.cardCount} Karten auf der Hand.
        </p>

        <div className="cards">
          {cards.map((resource) => (
            <div key={resource} className="cards__item">
              <ResourceCard card={resource} held={held[resource] ?? 0} />
              <div className="cards__stepper">
                <button
                  type="button"
                  aria-label={`${CARD_LABELS[resource]} weniger`}
                  data-sound="card"
                  disabled={!canStep(resource, -1)}
                  onClick={() => change(resource, -1)}
                >
                  −
                </button>
                <span data-testid={`chosen-${resource}`}>{chosen[resource] ?? 0}</span>
                <button
                  type="button"
                  aria-label={`${CARD_LABELS[resource]} mehr`}
                  data-sound="card"
                  disabled={!canStep(resource, 1)}
                  onClick={() => change(resource, 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="button button--go"
          disabled={total !== required || excess !== undefined}
          onClick={() => onConfirm(chosen)}
        >
          Abwerfen ({total}/{required})
        </button>
      </div>
    </div>
  );
}
