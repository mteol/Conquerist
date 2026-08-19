import type { JSX } from 'react';
import type { GameView, PlayerRow as PlayerRowData } from '../game/view';

/**
 * Der Tisch: wer sitzt da, wie viele Punkte, wie viele Karten.
 *
 * **Die eigene Zeile zeigt keine Aufschluesselung mehr.** Sie stand hier als
 * `L2 H0 W0 K0 E1` - fuenf Anfangsbuchstaben mit Zahlen, an derselben Stelle,
 * an der bei allen anderen „3 Karten" steht. Zweierlei war daran falsch: die
 * Auskunft steht schon unten links als Kartenstapel, in Farbe und mit Motiv,
 * und in dieser Form konnte sie niemand lesen, ohne den Code zu kennen. Der
 * Tisch beantwortet die Frage, die man ueber **andere** stellt - wie viel hat
 * er -, und die beantwortet er jetzt fuer alle gleich.
 *
 * Der Schalter „Fremde Haende verdecken" ist mit Etappe 4 verschwunden, und
 * das ist der Punkt: verdeckt ist keine Ansichtssache mehr, sondern der
 * Zustand.
 *
 * Getrennte Mitspieler werden benannt statt eingefaerbt: eine Farbe allein
 * traegt keine Information, die jemand sonst nicht mitbekommt.
 */
export interface TablePanelProps {
  readonly view: GameView;
}

export function TablePanel({ view }: TablePanelProps): JSX.Element {
  return (
    <section className="panel panel--table">
      <h2 className="panel__title">Tisch</h2>

      {view.players.map((player) => (
        <PlayerRow
          key={player.id}
          player={player}
          acting={view.actingPlayers.includes(player.id)}
          isYou={player.id === view.you}
          gained={view.gains.get(player.id) ?? 0}
        />
      ))}
    </section>
  );
}

function PlayerRow({
  player,
  acting,
  isYou,
  gained,
}: {
  readonly player: PlayerRowData;
  readonly acting: boolean;
  readonly isYou: boolean;
  /** Karten seit dem vorigen Stand; 0 heisst: nichts zu zeigen. */
  readonly gained: number;
}): JSX.Element {
  return (
    <div
      className={acting ? 'seat seat--acting' : 'seat'}
      style={{ borderLeftColor: player.color }}
      data-testid={`seat-${player.id}`}
    >
      <span className="seat__name">
        {player.name}
        {isYou ? ' (du)' : ''}
      </span>
      <span className="seat__points">{player.victoryPoints} SP</span>

      <span className="seat__hand" data-testid={`hand-count-${player.id}`}>
        {player.cardCount} Karten
      </span>

      {/*
       * Der Zuwachs steigt beim Erscheinen kurz auf - und bleibt dann stehen,
       * bis der naechste Stand kommt. Er verblasst NICHT von selbst: wer
       * `prefers-reduced-motion` gesetzt hat, saehe sonst gar nichts, weil eine
       * abgeschaltete Animation sofort an ihrem Ende steht.
       */}
      {gained > 0 ? (
        <span className="seat__gain" data-testid={`gain-${player.id}`}>
          +{gained}
        </span>
      ) : null}

      {player.mustDiscard > 0 ? (
        <span className="seat__pending">wirft {player.mustDiscard} ab</span>
      ) : null}

      {player.connected ? null : <span className="seat__pending">getrennt</span>}
    </div>
  );
}
