import type { JSX } from 'react';
import { awardsHeldBy, type Award } from '../game/awards';
import type { GameView, PlayerRow as PlayerRowData } from '../game/view';
import { SeatMarks } from './Awards';
import { TrackStrip } from './TrackStrip';

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
 *
 * **Neben dem Namen stehen seit den Auszeichnungen zwei Sorten Plaketten:** was
 * jemand vor sich liegen hat (Laengste Handelsstrasse, Groesste Rittermacht)
 * und wie viele Ritter er ausgespielt hat. Die Auszeichnung erscheint nur bei
 * den **anderen** - die eigene liegt als Karte unten links bei den eigenen
 * Karten, und dieselbe Auskunft an zwei Orten waere eine zu viel. Die
 * Ritterzahl steht bei allen, auch bei einem selbst: sie ist ein Zaehler und
 * kein Besitz, und ausgespielte Ritter sind aus der Hand verschwunden - ohne
 * diese Zahl steht sie nirgends.
 *
 * **Seit dem Stadtausbau steht unter jedem Namen die kompakte Leiste
 * (`TrackStrip`).** Dieselbe Auskunft wie im eigenen Tableau, nur für die
 * anderen - drei Punktreihen statt drei Leitern, weil hier niemand baut,
 * sondern nur nachsieht, wer nah an der Vier steht. Sie erscheint nur, wo das
 * Regelwerk den Ausbau überhaupt kennt (`barbarianTrack > 0`) - an einem
 * Basistisch gäbe es sonst drei leere Reihen ohne jede Bedeutung.
 */
export interface TablePanelProps {
  readonly view: GameView;
  /** Wie weit dieser Tisch den Stadtausbau kennt - `0` heißt: gar nicht. */
  readonly barbarianTrack: number;
}

export function TablePanel({ view, barbarianTrack }: TablePanelProps): JSX.Element {
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
          awards={player.id === view.you ? [] : awardsHeldBy(view.awards, player.id)}
          showTracks={barbarianTrack > 0 && player.id !== view.you}
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
  awards,
  showTracks,
}: {
  readonly player: PlayerRowData;
  readonly acting: boolean;
  readonly isYou: boolean;
  /** Karten seit dem vorigen Stand; 0 heisst: nichts zu zeigen. */
  readonly gained: number;
  /** Was dieser Spieler vor sich liegen hat - bei einem selbst leer, siehe oben. */
  readonly awards: readonly Award[];
  /** Ob dieser Tisch den Stadtausbau kennt - sonst bleibt die Leiste weg. */
  readonly showTracks: boolean;
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

      <SeatMarks player={player.id} awards={awards} knights={player.playedKnights} />

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

      {showTracks ? <TrackStrip player={player.id} levels={player} /> : null}
    </div>
  );
}
