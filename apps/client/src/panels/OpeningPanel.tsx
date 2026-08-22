import type { JSX } from 'react';
import type { GameView } from '../game/view';

/**
 * Die Auftakttafel: wer wie hoch geworfen hat und wer gerade wirft.
 *
 * Sie zeigt nur die laufende Runde. Was in einer frueheren Stechrunde fiel,
 * steht im Verlauf - der Zustand haelt bewusst nur die laufende, damit nirgends
 * zu entscheiden ist, welche gilt.
 *
 * **Die Wuerfel zeichnet sie nicht.** Die fliegen ueber dieselbe Wurfbahn wie im
 * Spiel, weil ein Auftaktwurf `lastRoll` genauso setzt wie jeder andere. Hier
 * steht nur, was am Ende zaehlt: die Summe.
 *
 * `pointer-events: none` traegt sie im Blatt: sie ist Auskunft und kein Ding.
 * Der Wuerfelknopf liegt woanders und kommt wie jeder Knopf aus der
 * Aktionsliste - die Tafel entscheidet nichts.
 */
export interface OpeningPanelProps {
  readonly view: GameView;
}

export function OpeningPanel({ view }: OpeningPanelProps): JSX.Element | null {
  const opening = view.opening;
  if (opening === null) return null;

  const roller = view.actingPlayers[0] ?? null;

  return (
    <section className="opening" role="status">
      <h2 className="opening__title">{opening.round === 0 ? 'Wer beginnt?' : 'Stechen'}</h2>

      <ol className="opening__seats">
        {view.players.map((player) => {
          const total = opening.totals.get(player.id);

          return (
            <li
              key={player.id}
              className="opening__seat"
              data-testid={`opening-seat-${player.id}`}
              data-active={player.id === roller}
            >
              <span className="opening__dot" style={{ background: player.color }} aria-hidden />
              <span className="opening__name">{player.name}</span>
              <span className="opening__total" data-testid={`opening-total-${player.id}`}>
                {total ?? '·'}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
