import type { CSSProperties, JSX } from 'react';
import {
  COMMODITY_LABELS,
  METROPOLIS_LEVEL,
  TRACK_BONUS_LEVEL,
  TRACK_COMMODITY,
  TRACK_IDS,
  improvementCost,
  levelOf,
  progressThreshold,
  stepName,
  type CardAmounts,
  type TrackId,
  type TrackLevelSource,
} from '@conquerist/shared';
import {
  TRACK_BUILT_WORD_COLORS,
  TRACK_COLORS,
  TRACK_COLORS_ON_SEA,
  TRACK_NAMES,
} from '../game/labels';
import { CardGlyph } from './CardGlyph';
import { METROPOLIS_EMBLEMS } from '../board/shapes';
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
 * **Zwei Stufen tragen eine feste Marke, unabhängig vom eigenen Stand:** die
 * Zusatznutzenstufe ihr Zeichen (Aquädukt / Gilde / Festung - `TRACK_BONUS_LEVEL`
 * aus `shared` sagt je Bereich, welche das ist, nicht diese Datei), Stufe 4
 * die Metropolenform aus `shapes.ts` - dieselbe wie auf dem Brett, damit man
 * sie am Knoten wiedererkennt. Beide stehen an ihrer Stufe, ob gebaut,
 * nächste oder noch leer: wer die Leiter zum ersten Mal sieht, soll wissen,
 * wohin sie führt. Die Form trägt im gebauten Fall dieselbe Tinte wie das
 * Wort (`TRACK_BUILT_WORD_COLORS`) - beide stehen auf demselben Grund.
 */
export interface TrackPanelProps {
  readonly targets: ActionTargets;
  /** Wie weit dieser Tisch den Stadtausbau überhaupt kennt - `0` heißt: gar nicht. */
  readonly barbarianTrack: number;
  /** Der eigene Stand - `PlayerState` wie `PlayerInView` genügen beide. */
  readonly player: TrackLevelSource;
  /** Die eigene Hand - nur fuer die Auskunft "dir fehlt ...". `null`, solange sie verdeckt ist. */
  readonly hand?: CardAmounts | null;
  /** Ein Klick auf die nächste Stufe eines Bereichs - der Bereich, sonst nichts. */
  readonly onImprove: (track: TrackId) => void;
}

/** Der Ausschnitt für `METROPOLIS_EMBLEMS`: Radius 3 plus Luft fuer den Rand. */
const METROPOLIS_VIEWBOX = '-3.4 -3.4 6.8 6.8';

export function TrackPanel({
  targets,
  barbarianTrack,
  player,
  hand = null,
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
          hand={hand}
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
  hand,
  onImprove,
}: {
  readonly track: TrackId;
  readonly level: number;
  readonly targets: ActionTargets;
  readonly hand: CardAmounts | null;
  readonly onImprove: (track: TrackId) => void;
}): JSX.Element {
  // Von oben nach unten wie eine echte Leiter: die höchste Stufe steht zuoberst.
  const steps = [5, 4, 3, 2, 1];

  return (
    <div
      className="tracks__ladder"
      style={
        {
          '--track-color': TRACK_COLORS[track],
          '--track-color-on-sea': TRACK_COLORS_ON_SEA[track],
          '--track-word-color': TRACK_BUILT_WORD_COLORS[track],
        } as CSSProperties
      }
    >
      <span className="tracks__name" title={TRACK_NAMES[track]}>
        {TRACK_NAMES[track]}
      </span>

      {steps.map((step) => (
        <TrackStep
          key={step}
          track={track}
          step={step}
          level={level}
          targets={targets}
          hand={hand}
          onImprove={onImprove}
        />
      ))}
    </div>
  );
}

/** Gilde, Festung, Aquaedukt als Zeichen im 24er-Raster - dasselbe Raster wie die Rittermodi. */
function BonusMark({ track }: { readonly track: TrackId }): JSX.Element {
  return (
    <svg className="tracks__bonus" viewBox="0 0 24 24" aria-hidden="true">
      {track === 'trade' ? (
        // Zwei Pfeile gegeneinander: der Tausch 2:1.
        <path
          className="tracks__bonus--line"
          d="M4 8 H18 M14 4 L18 8 L14 12 M20 16 H6 M10 12 L6 16 L10 20"
        />
      ) : track === 'politics' ? (
        // Ein Turm mit Zinnen: die Festung.
        <path fill="currentColor" d="M5 21 V9 H8 V5 H10.5 V9 H13.5 V5 H16 V9 H19 V21 Z" />
      ) : (
        // Drei Bogen auf einem Damm: der Aquaedukt.
        <path
          fill="currentColor"
          d="M2 8 H22 V20 H18 V15 A2 2 0 0 0 14 15 V20 H10 V15 A2 2 0 0 0 6 15 V20 H2 Z"
        />
      )}
    </svg>
  );
}

function TrackStep({
  track,
  step,
  level,
  targets,
  hand,
  onImprove,
}: {
  readonly track: TrackId;
  readonly step: number;
  readonly level: number;
  readonly targets: ActionTargets;
  readonly hand: CardAmounts | null;
  readonly onImprove: (track: TrackId) => void;
}): JSX.Element {
  const built = level >= step;
  const isNext = !built && step === level + 1;
  const testId = `track-${track}-${step}`;

  const bonusLevel = TRACK_BONUS_LEVEL[track];

  const marks = (
    <>
      <span className="tracks__threshold-badge">
        <NumeralText value={progressThreshold(step)} className="tracks__threshold" />
      </span>
      {step === bonusLevel ? (
        <>
          {/* Zeichen statt Wort: in 12 px passt es nicht neben die Plakette (Auskunft: Hint und Text). */}
          <span className="tracks__word" aria-hidden="true">
            <BonusMark track={track} />
          </span>
          <span className="visually-hidden">{stepName(track, bonusLevel)}</span>
        </>
      ) : null}
      {step === METROPOLIS_LEVEL ? (
        <svg className="tracks__metropolis" viewBox={METROPOLIS_VIEWBOX} aria-hidden="true">
          {/*
           * Auf der gebauten Sprosse ist der Grund `var(--track-color)` -
           * derselbe Wert, den `TRACK_COLORS[track]` hier eintrüge. Farbe auf
           * Farbe, Kontrast 1:1 (I1 der Abschlußreview, derselbe Fehler wie
           * Befund D, nur an diesem zweiten Element). `TRACK_BUILT_WORD_COLORS`
           * beantwortet dieselbe Frage schon für `.tracks__word`, das auf
           * demselben Grund steht - hier gilt dieselbe Antwort.
           */}
          <path
            d={METROPOLIS_EMBLEMS[track]}
            fillRule="evenodd"
            style={{
              fill: built
                ? TRACK_BUILT_WORD_COLORS[track]
                : isNext
                  ? TRACK_COLORS[track]
                  : TRACK_COLORS_ON_SEA[track],
            }}
          />
        </svg>
      ) : null}
    </>
  );

  const commodity = TRACK_COMMODITY[track];
  const price = improvementCost(track, step)[commodity] ?? 0;
  const offered = targets.improve.has(track) || (targets.metropolis.get(track)?.size ?? 0) > 0;
  const hintLines = trackStepHint(track, step, built);
  // Ein gesperrter Knopf sagt, woran es fehlt - nicht nur "nein".
  const owned = hand?.[commodity] ?? 0;
  if (isNext && !offered && hand !== null && owned < price) {
    hintLines.push(`Dir fehlt ${price - owned} ${COMMODITY_LABELS[commodity]}.`);
  }

  const hint = {
    'data-hint-title': `${TRACK_NAMES[track]}, Stufe ${step}: ${stepName(track, step)}`,
    'data-hint': hintLines.join('\n'),
  };

  if (!isNext) {
    return (
      <div
        className={built ? 'tracks__step tracks__step--built' : 'tracks__step'}
        data-testid={testId}
        data-built={built ? 'true' : 'false'}
        {...hint}
      >
        {marks}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="tracks__step tracks__step--next"
      data-testid={testId}
      data-built="false"
      disabled={!offered}
      title={`${stepName(track, step)}: ${price} ${COMMODITY_LABELS[TRACK_COMMODITY[track]]}`}
      {...hint}
      onClick={() => onImprove(track)}
    >
      {marks}
      <span className="tracks__price" aria-hidden="true">
        {price}
        <CardGlyph card={commodity} />
      </span>
    </button>
  );
}

/** Was die Zusatzstufe (Stufe 3) eines Bereichs erlaubt. */
const BONUS_TEXTS: Readonly<Record<TrackId, string>> = {
  trade: 'Gilde: Handelswaren tauschst du 2:1 bei der Bank.',
  politics: 'Festung: Starke Ritter dürfen zu Mächtigen aufsteigen.',
  science: 'Aquädukt: bringt dir ein Wurf nichts, nimmst du einen Rohstoff nach Wahl.',
};

/**
 * Die Auskunft an einer Sprosse. Die Leiter zeigt Zahl, Wort und Aufsatz -
 * was sie *bedeuten*, stand nirgends: dass die Zahl der rote Würfel ist, dass
 * Stufe 4 um eine Metropole kämpft, was eine Gilde kann.
 */
export function trackStepHint(track: TrackId, step: number, built: boolean): string[] {
  const commodity = COMMODITY_LABELS[TRACK_COMMODITY[track]];
  const price = improvementCost(track, step)[TRACK_COMMODITY[track]] ?? 0;
  const lines = [
    built ? 'Ausgebaut.' : `Kostet ${price} ${commodity}. Du brauchst dafür eine Stadt.`,
    `Fortschrittskarte ${TRACK_NAMES[track]}, wenn das Stadttor fällt und der rote Würfel höchstens ${progressThreshold(step)} zeigt.`,
  ];
  if (step === TRACK_BONUS_LEVEL[track]) lines.push(BONUS_TEXTS[track]);
  if (step === METROPOLIS_LEVEL) {
    lines.push('Wer als Erster Stufe 4 erreicht, macht eine Stadt zur Metropole (+2 Siegpunkte).');
  }
  if (step === 5) lines.push('Stufe 5 holt die Metropole von jedem, der nur Stufe 4 hat.');
  return lines;
}
