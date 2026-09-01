import type { JSX } from 'react';
import { TRACK_IDS, type TrackId } from '@conquerist/shared';
import { TRACK_COLORS, TRACK_NAMES } from '../game/labels';

/**
 * Gleichstand in der Verteidigung: von welchem Stapel die gezogene Karte kommt.
 *
 * `defenderPending` traegt eine Warteschlange, aber keine Wahl daneben - jede
 * beteiligte Person entscheidet fuer sich, welcher Stapel es sein soll
 * (`pickProgressDeck` in `actions.ts`). Ohne Abbruch: die Wahl ist Pflicht, wer
 * an der Reihe ist, muss ziehen. Dieselbe Haltung wie bei `DiscardDialog` -
 * kein `onClose`, aus demselben Grund.
 *
 * Die Stapelfarbe steht nie allein (Designregel 7): jeder Knopf traegt Farbe
 * **und** Namen **und** Resthoehe.
 */
export interface PickDeckDialogProps {
  /** Resthoehe je Stapel, aus `view.progressDeckSizes`. */
  readonly deckSizes: Partial<Record<TrackId, number>>;
  readonly onPick: (track: TrackId) => void;
}

export function PickDeckDialog({ deckSizes, onPick }: PickDeckDialogProps): JSX.Element {
  return (
    <div className="modal" role="dialog" aria-label="Fortschrittsstapel wählen">
      <div className="modal__box">
        <h2>Von welchem Stapel?</h2>
        <p className="modal__hint">Gleichstand in der Verteidigung — eine Karte deiner Wahl.</p>

        <div className="pick">
          {TRACK_IDS.map((track) => (
            <button
              key={track}
              type="button"
              className="button"
              style={{ borderLeftColor: TRACK_COLORS[track], borderLeftWidth: '4px' }}
              onClick={() => onPick(track)}
            >
              {TRACK_NAMES[track]} ({deckSizes[track] ?? 0})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
