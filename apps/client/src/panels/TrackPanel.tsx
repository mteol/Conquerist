import type { CSSProperties, JSX } from 'react';
import {
  COMMODITY_LABELS,
  METROPOLIS_LEVEL,
  TRACK_COMMODITY,
  TRACK_IDS,
  improvementCost,
  levelOf,
  progressThreshold,
  stepName,
  type TrackId,
  type TrackLevelSource,
} from '@conquerist/shared';
import { TRACK_ABBR, TRACK_COLORS, TRACK_NAMES } from '../game/labels';
import { METROPOLIS_PATHS } from '../board/shapes';
import { NumeralText } from '../type/Numerals';
import type { ActionTargets } from '../game/targets';

/**
 * Das Fortschritt-Tableau: drei Leitern, der eigene Stand darin.
 *
 * **Rolle:** die Stelle, an der man sieht, wo man steht, was der nächste
 * Schritt kostet und wie hoch die Chance auf eine Karte ist. **Aufbau:** drei
 * Leitern nebeneinander, je fünf Stufen in Bereichsfarbe - gebaute Stufen
 * gefüllt, die nächste als Umriß mit ihrem Preis, der Rest leer. **Woran man
 * sich erinnert:** die rote Ziffer rechts an jeder Stufe, die man beim
 * Würfeln sucht.
 *
 * **Es ist kein Knopf mit einem Bild darin.** Die gebauten Stufen sind
 * Auskunft; nur die *nächste* Stufe ist bedienbar, und nur sie trägt eine
 * Trefferfläche von 44 px - dieselbe Grenze wie bei der Ritterleiste, aus
 * demselben Grund (`KnightPanel.tsx`).
 *
 * **Sie erscheint gar nicht, wo es keinen Stadtausbau gibt.** Nicht grau,
 * sondern weg - dieselbe Regel wie bei der Ritterleiste: ein leerer Rahmen
 * wäre eine Auskunft über nichts.
 *
 * **Zwei Stufen tragen eine feste Marke, unabhängig vom eigenen Stand:**
 * Stufe 3 ihr Wort (Aquädukt / Gilde / Festung), Stufe 4 die Metropolenform
 * aus `shapes.ts` - dieselbe wie auf dem Brett, damit man sie am Knoten
 * wiedererkennt. Beide stehen an ihrer Stufe, ob gebaut, nächste oder noch
 * leer: wer die Leiter zum ersten Mal sieht, soll wissen, wohin sie führt.
 */
export interface TrackPanelProps {
  readonly targets: ActionTargets;
  /** Wie weit dieser Tisch den Stadtausbau überhaupt kennt - `0` heißt: gar nicht. */
  readonly barbarianTrack: number;
  /** Der eigene Stand - `PlayerState` wie `PlayerInView` genügen beide. */
  readonly player: TrackLevelSource;
  /** Ein Klick auf die nächste Stufe eines Bereichs - der Bereich, sonst nichts. */
  readonly onImprove: (track: TrackId) => void;
}

/**
 * Der Ausschnitt für `METROPOLIS_PATHS` in einem eigenen kleinen `<svg>`.
 *
 * Nachgemessen aus den Pfaddaten selbst und nicht geraten: alle drei Formen
 * liegen zusammen bei x -8,6 bis 2,6 und y -9 bis -8,05 (`shapes.ts`) - mit
 * 0,2 Einheiten Luft an den Seiten und 0,1 oben wie unten.
 */
const METROPOLIS_VIEWBOX = '-8.8 -9.1 11.6 1.15';

export function TrackPanel({
  targets,
  barbarianTrack,
  player,
  onImprove,
}: TrackPanelProps): JSX.Element | null {
  if (barbarianTrack <= 0) return null;

  return (
    <div className="tracks" role="group" aria-label="Stadtausbau">
      {TRACK_IDS.map((track) => (
        <TrackLadder
          key={track}
          track={track}
          level={levelOf(player, track)}
          targets={targets}
          onImprove={onImprove}
        />
      ))}
    </div>
  );
}

function TrackLadder({
  track,
  level,
  targets,
  onImprove,
}: {
  readonly track: TrackId;
  readonly level: number;
  readonly targets: ActionTargets;
  readonly onImprove: (track: TrackId) => void;
}): JSX.Element {
  // Von oben nach unten wie eine echte Leiter: die höchste Stufe steht zuoberst.
  const steps = [5, 4, 3, 2, 1];

  return (
    <div
      className="tracks__ladder"
      style={{ '--track-color': TRACK_COLORS[track] } as CSSProperties}
    >
      <span className="tracks__name" title={TRACK_NAMES[track]}>
        {TRACK_ABBR[track]}
      </span>

      {steps.map((step) => (
        <TrackStep
          key={step}
          track={track}
          step={step}
          level={level}
          targets={targets}
          onImprove={onImprove}
        />
      ))}
    </div>
  );
}

function TrackStep({
  track,
  step,
  level,
  targets,
  onImprove,
}: {
  readonly track: TrackId;
  readonly step: number;
  readonly level: number;
  readonly targets: ActionTargets;
  readonly onImprove: (track: TrackId) => void;
}): JSX.Element {
  const built = level >= step;
  const isNext = !built && step === level + 1;
  const testId = `track-${track}-${step}`;

  const marks = (
    <>
      <NumeralText value={progressThreshold(step)} className="tracks__threshold" />
      {step === 3 ? <span className="tracks__word">{stepName(track, 3)}</span> : null}
      {step === METROPOLIS_LEVEL ? (
        <svg className="tracks__metropolis" viewBox={METROPOLIS_VIEWBOX} aria-hidden="true">
          <path d={METROPOLIS_PATHS[track]} style={{ fill: TRACK_COLORS[track] }} />
        </svg>
      ) : null}
    </>
  );

  if (!isNext) {
    return (
      <div
        className={built ? 'tracks__step tracks__step--built' : 'tracks__step'}
        data-testid={testId}
        data-built={built ? 'true' : 'false'}
      >
        {marks}
      </div>
    );
  }

  const price = improvementCost(track, step)[TRACK_COMMODITY[track]] ?? 0;
  const offered = targets.improve.has(track) || (targets.metropolis.get(track)?.size ?? 0) > 0;

  return (
    <button
      type="button"
      className="tracks__step tracks__step--next"
      data-testid={testId}
      data-built="false"
      disabled={!offered}
      title={`${stepName(track, step)}: ${price} ${COMMODITY_LABELS[TRACK_COMMODITY[track]]}`}
      onClick={() => onImprove(track)}
    >
      {marks}
    </button>
  );
}
