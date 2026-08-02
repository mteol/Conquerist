import type { JSX } from 'react';
import { RESOURCE_IDS } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { GameView, PlayerRow as PlayerRowData } from '../game/view';

/**
 * Der Tisch: wer sitzt da, wie viele Punkte, was auf der Hand.
 *
 * Der Schalter „Fremde Haende verdecken" ist mit Etappe 4 verschwunden, und
 * das ist der Punkt: verdeckt ist keine Ansichtssache mehr, sondern der
 * Zustand. Was hier steht, ist genau das, was der Server geschickt hat -
 * `resources === null` heisst „gehoert jemand anderem", nicht „ausgeblendet".
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
        />
      ))}
    </section>
  );
}

function PlayerRow({
  player,
  acting,
  isYou,
}: {
  readonly player: PlayerRowData;
  readonly acting: boolean;
  readonly isYou: boolean;
}): JSX.Element {
  const hand = player.resources;

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

      {hand === null ? (
        <span className="seat__hand" data-testid={`hand-count-${player.id}`}>
          {player.cardCount} Karten
        </span>
      ) : (
        <span className="seat__hand" data-testid={`hand-${player.id}`}>
          {RESOURCE_IDS.map(
            (resource) => `${RESOURCE_LABELS[resource].slice(0, 1)}${hand[resource] ?? 0}`,
          ).join(' ')}
        </span>
      )}

      {player.mustDiscard > 0 ? (
        <span className="seat__pending">wirft {player.mustDiscard} ab</span>
      ) : null}

      {player.connected ? null : <span className="seat__pending">getrennt</span>}
    </div>
  );
}
