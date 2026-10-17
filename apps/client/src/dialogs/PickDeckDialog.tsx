import type { JSX } from 'react';
import { TRACK_IDS, type TrackId } from '@conquerist/shared';
import { TRACK_COLORS, TRACK_NAMES } from '../game/labels';
import { Modal } from './Modal';
import { Choice } from './Choice';

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
    <Modal
      label="Fortschrittsstapel wählen"
      title="Von welchem Stapel?"
      hint="Gleichstand in der Verteidigung — eine Karte deiner Wahl."
    >
      <div className="choices">
        {TRACK_IDS.map((track) => (
          <Choice
            key={track}
            tone={TRACK_COLORS[track]}
            name={TRACK_NAMES[track]}
            detail={`${deckSizes[track] ?? 0} Karten`}
            onClick={() => onPick(track)}
          />
        ))}
      </div>
    </Modal>
  );
}
