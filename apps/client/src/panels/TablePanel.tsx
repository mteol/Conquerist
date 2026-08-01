import type { JSX } from 'react';
import { RESOURCE_IDS } from '@conquerist/shared';
import { RESOURCE_LABELS } from '../game/labels';
import type { GameView, PlayerView } from '../game/view';

/**
 * Der Tisch: wer sitzt da, wie viele Punkte, was auf der Hand.
 *
 * Der Schalter verdeckt fremde Haende und zeigt nur noch die Anzahl. Er ist
 * mehr als Bequemlichkeit: die verdeckte Ansicht ist genau die Projektion, die
 * ab Etappe 5 `PlayerView` heisst - dann serverseitig und nicht abschaltbar.
 */
export interface TablePanelProps {
  readonly view: GameView;
  readonly conceal: boolean;
  readonly onConcealChange: (value: boolean) => void;
}

export function TablePanel({ view, conceal, onConcealChange }: TablePanelProps): JSX.Element {
  return (
    <section className="panel panel--table">
      <h2 className="panel__title">Tisch</h2>

      {view.players.map((player) => (
        <PlayerRow
          key={player.id}
          player={player}
          acting={view.actingPlayers.includes(player.id)}
        />
      ))}

      <label className="panel__toggle">
        <input
          type="checkbox"
          checked={conceal}
          onChange={(event) => onConcealChange(event.currentTarget.checked)}
        />
        Fremde Haende verdecken
      </label>
    </section>
  );
}

function PlayerRow({
  player,
  acting,
}: {
  readonly player: PlayerView;
  readonly acting: boolean;
}): JSX.Element {
  const hand = player.resources;

  return (
    <div
      className={acting ? 'seat seat--acting' : 'seat'}
      style={{ borderLeftColor: player.color }}
      data-testid={`seat-${player.id}`}
    >
      <span className="seat__name">{player.name}</span>
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
    </div>
  );
}
