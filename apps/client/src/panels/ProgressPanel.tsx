import { useState, type CSSProperties, type JSX } from 'react';
import {
  CARD_IDS,
  COMMODITY_IDS,
  PROGRESS_NAMES,
  PROGRESS_TEXTS,
  PROGRESS_TRACK,
  RESOURCE_IDS,
  TRACK_IDS,
  type GameAction,
  type PlayerView,
  type ProgressCardId,
} from '@conquerist/shared';
import { TRACK_BUILT_WORD_COLORS, TRACK_COLORS, TRACK_NAMES } from '../game/labels';
import { ProgressPlayDialog } from '../dialogs/ProgressPlayDialog';
import { ResourcePickDialog } from '../dialogs/ResourcePickDialog';

/** Was `playProgress` traegt - lokal aus `GameAction` gezogen statt neu exportiert. */
type ProgressPlay = Extract<GameAction, { type: 'playProgress' }>['play'];

type DialogCard =
  'alchemist' | 'crane' | 'resourceMonopoly' | 'commodityMonopoly' | 'merchantFleet';

/** Was ein Klick auf diese Karte tut. */
type CardCategory =
  | { readonly kind: 'direct' }
  | { readonly kind: 'dialog'; readonly card: DialogCard }
  | { readonly kind: 'hex'; readonly card: 'merchant' | 'bishop' }
  | { readonly kind: 'unwired' };

/**
 * Wozu ein Klick auf diese Karte fuehrt - **erschoepfend ueber alle 25
 * Karten**, ohne `default`. Eine neue Karte im Stapel faellt damit als
 * Kompilierfehler auf (kein Zweig liefert dann einen Wert zurueck) und nicht
 * lautlos durch einen `default`-Zweig - dieselbe Vorsicht, die `phaseTextOf`
 * in `view.ts` schon fuer die Phasen zeigt.
 *
 * **`unwired`** sind die sieben Karten, deren Angabe das Brett braucht und
 * die diese Aufgabe (15b: "Die Stapel, die Hand und die Dialoge") nicht
 * verdrahtet: Ingenieur, Medizin, Intrige, Straßenbau, Schmied, Diplomat,
 * Erfinder. Sie liegen sichtbar mit ihrem Namen auf der Hand (Designregel 7),
 * ihr Knopf ist aber gesperrt. Grund: anders als bei Haendler und Bischof
 * (`targets.ts#merchantTargets/bishopTargets`, reine Brettgeometrie aus
 * oeffentlichen Angaben) braeuchte ein Zielset fuer diese sieben Karten
 * Wissen, das `PlayerView` nicht traegt und `legalActions` nicht aufzaehlt
 * (offene Strassen, erreichbare Kreuzungen ohne eigenen Ritter, freie
 * Zahlenchips ausser 2/12/6/8, eigene Staedte ohne Mauer) - der Client
 * muesste die Regel selbst nachrechnen, um eine ehrliche Zielmenge
 * anzubieten. Siehe Bericht (task-15b-report.md) fuer die Abwaegung.
 *
 * Die restlichen sieben (`printer`, `constitution`, `tradeHarbor`,
 * `masterMerchant`, `spy`, `deserter`, `wedding`) erscheinen nie in
 * `progressCards`: die ersten beiden liegen laut `draw.ts` sofort offen in
 * `openProgressCards`, die uebrigen fuenf warten auf eine fremde Antwort und
 * kommen laut Kopfkommentar in `play.ts` erst mit 10d-2 - an diesem Tisch
 * (`CITIES_RULES.progressDecks`) liegen sie nicht. Trotzdem ein eigener
 * Zweig statt `default`, aus demselben Grund wie oben.
 */
function categoryOf(card: ProgressCardId): CardCategory {
  switch (card) {
    case 'mining':
    case 'irrigation':
    case 'warlord':
    case 'saboteur':
      return { kind: 'direct' };

    case 'alchemist':
    case 'crane':
    case 'resourceMonopoly':
    case 'commodityMonopoly':
    case 'merchantFleet':
      return { kind: 'dialog', card };

    case 'merchant':
    case 'bishop':
      return { kind: 'hex', card };

    case 'inventor':
    case 'engineer':
    case 'medicine':
    case 'smith':
    case 'roadBuilding':
    case 'diplomat':
    case 'intrigue':
      return { kind: 'unwired' };

    case 'printer':
    case 'constitution':
    case 'tradeHarbor':
    case 'masterMerchant':
    case 'spy':
    case 'deserter':
    case 'wedding':
      return { kind: 'unwired' };
  }
}

/**
 * Warum die sieben `unwired`-Karten gesperrt sind - fuer den Spieler, nicht
 * fuer die Technik. "Nicht verdrahtet" waere eine Auskunft ueber den Code;
 * das hier ist eine ueber das Spiel, das er gerade vor sich hat.
 */
const UNWIRED_REASON =
  'Diese Karte braucht eine Wahl auf dem Brett (eine Kreuzung, eine Kante oder ' +
  'einen Zahlenchip) - die gibt es in dieser Fassung noch nicht.';

/** Der erklaerende Satz zu einer Handkarte - Wirkung, oder bei gesperrten Karten der Grund. */
function hintTextFor(card: ProgressCardId): string {
  return categoryOf(card).kind === 'unwired' ? UNWIRED_REASON : PROGRESS_TEXTS[card];
}

/**
 * Die Id, unter der eine Handkarte ihren Satz fuer Vorlesewerkzeuge ablegt.
 *
 * Mit dem Index, nicht nur der Kartenart: dieselbe Karte kann mehrfach auf
 * der Hand liegen (Haendler etwa sechsfach im Stapel), und zwei Karten mit
 * derselben Id waeren zwei Bedienelemente, die auf denselben Satz zeigen -
 * `aria-describedby` verlangt eine eindeutige Ziel-Id.
 */
function progressHintId(card: ProgressCardId, index: number): string {
  return `progress-hint-${card}-${index}`;
}

export interface ProgressPanelProps {
  readonly view: PlayerView;
  readonly onAction?: (action: GameAction) => void;
  /** Haendler und Bischof brauchen das Brett - der Klick beginnt dort die Wahl. */
  readonly onBoardPick?: (card: 'merchant' | 'bishop') => void;
}

/**
 * Die drei Stapel als Material, die eigene Hand, und die Dialoge der Karten,
 * die eine Angabe brauchen - Aufgabe 15b.
 *
 * **Erscheint gar nicht ohne Fortschrittskarten am Tisch** - dieselbe Regel
 * wie bei `TrackPanel` und `KnightPanel`: ein leeres Tableau waere Auskunft
 * ueber nichts. Geprueft wird `view.rules.progressDecks`, nicht
 * `view.progressDeckSizes`: Letzteres traegt an einem Basistisch trotzdem
 * alle drei Bereiche mit dem Wert 0 (`playerViewOf` fuellt sie ueber
 * `TRACK_IDS`), waehrend `rules.progressDecks` an einem Basistisch leer ist -
 * genau das Merkmal, an dem `CLASSIC_RULES` von `CITIES_RULES` unterscheidbar
 * ist (`cities.test.ts`: "CLASSIC_RULES.progressDecks ist leer").
 */
export function ProgressPanel({
  view,
  onAction,
  onBoardPick,
}: ProgressPanelProps): JSX.Element | null {
  const [dialog, setDialog] = useState<DialogCard | null>(null);
  /** Welche Handkarte gerade erklaert wird - eine Zeile fuer die ganze Reihe (wie `DevelopmentCards`). */
  const [described, setDescribed] = useState<ProgressCardId | null>(null);

  if (Object.keys(view.rules.progressDecks).length === 0) return null;

  const play = (payload: ProgressPlay): void => {
    onAction?.({ type: 'playProgress', player: view.you, play: payload });
  };

  const onCardClick = (card: ProgressCardId): void => {
    const category = categoryOf(card);
    switch (category.kind) {
      case 'direct':
        // Die vier Karten ohne Angabe haben alle dieselbe Form `{ card }` -
        // deshalb hier zusammengefasst statt viermal wortgleich ausgefuehrt.
        play({ card } as ProgressPlay);
        return;
      case 'dialog':
        setDialog(category.card);
        return;
      case 'hex':
        onBoardPick?.(category.card);
        return;
      case 'unwired':
        // Der Knopf ist gesperrt (siehe `categoryOf`) - ein Klick kommt hier
        // nie an.
        return;
    }
  };

  const isClickable = (card: ProgressCardId): boolean => categoryOf(card).kind !== 'unwired';

  /*
   * Die eigene Hand steht am eigenen Sitz in `view.players`, nicht direkt an
   * `view`: `progressCards` ist ein Feld von `PlayerInView` (verdeckt bei
   * Mitspielern), keins der Sicht selbst - dieselbe Stelle, an der auch
   * `developmentCards` und `resources` liegen.
   */
  const hand = view.players.find((player) => player.id === view.you)?.progressCards ?? [];

  const show = (card: ProgressCardId) => () => setDescribed(card);
  const hide = (card: ProgressCardId) => () =>
    setDescribed((current) => (current === card ? null : current));

  return (
    <section className="progress" aria-label="Fortschritt">
      <h2 className="progress__title">Fortschritt</h2>

      <ul className="progress__decks">
        {TRACK_IDS.map((track) => (
          <li
            key={track}
            role="group"
            aria-label={`Fortschrittsstapel ${TRACK_NAMES[track]}`}
            className="progress__deck"
            style={{ '--deck-color': TRACK_COLORS[track] } as CSSProperties}
          >
            <span className="progress__deck-name">{TRACK_NAMES[track]}</span>
            <span className="progress__deck-size">{view.progressDeckSizes[track] ?? 0}</span>
          </li>
        ))}
      </ul>

      {hand.length === 0 ? null : (
        <div className="devcards">
          {described === null ? null : <ProgressHint card={described} />}

          <ul className="devcards__row" aria-label="Fortschrittskarten">
            {hand.map((card, index) => {
              const track = PROGRESS_TRACK[card];
              const hintId = progressHintId(card, index);
              return (
                /*
                 * Der Index steht mit im Schluessel: dieselbe Karte kann
                 * mehrfach auf der Hand liegen (Haendler etwa sechsfach im
                 * Stapel), und die Reihenfolge in `progressCards` bleibt
                 * sonst instabil zwischen zwei Renderns.
                 *
                 * Zeigen und Verbergen haengen am Listeneintrag, nicht am
                 * Knopf - ein gesperrter Knopf feuert keine Mausereignisse,
                 * und die gesperrte Karte ist genau die, deren Grund man
                 * lesen will (dieselbe Begruendung wie in
                 * `DevelopmentCards.tsx`, dieselbe Mechanik, nicht neu
                 * erfunden).
                 */
                <li
                  key={`${card}-${index}`}
                  onPointerEnter={show(card)}
                  onPointerLeave={hide(card)}
                  onFocus={show(card)}
                  onBlur={hide(card)}
                >
                  <button
                    type="button"
                    className="devcard"
                    disabled={!isClickable(card)}
                    aria-describedby={hintId}
                    onClick={() => onCardClick(card)}
                  >
                    <span
                      className="devcard__face"
                      style={{
                        background: TRACK_COLORS[track],
                        color: TRACK_BUILT_WORD_COLORS[track],
                      }}
                    >
                      <span className="devcard__name">{PROGRESS_NAMES[card]}</span>
                    </span>

                    {/* Derselbe Satz wie in `ProgressHint`, hier fest fuer Vorlesewerkzeuge. */}
                    <span id={hintId} className="visually-hidden">
                      {hintTextFor(card)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/*
       * Fuenf eigene Zweige statt einer gemeinsamen Wahl der Eigenschaften:
       * jeder ruft `ResourcePickDialog<T>` mit seinem eigenen `T` auf
       * (`ResourceId`, `CommodityId`, `CardId`) - ein gemeinsamer Ternary ueber
       * `pool` haette TypeScript zwungen, die drei Mengen zu einer einzigen zu
       * verschmelzen, und `picks[0]` waere danach fuer keinen der drei Faelle
       * mehr eng genug typisiert, um es unveraendert in `ProgressPlay`
       * einzusetzen.
       */}
      {dialog === 'alchemist' ? (
        <ProgressPlayDialog
          card="alchemist"
          onClose={() => setDialog(null)}
          onConfirm={(first, second) => {
            play({ card: 'alchemist', first, second });
            setDialog(null);
          }}
        />
      ) : dialog === 'crane' ? (
        <ProgressPlayDialog
          card="crane"
          onClose={() => setDialog(null)}
          onConfirm={(track) => {
            play({ card: 'crane', track });
            setDialog(null);
          }}
        />
      ) : dialog === 'resourceMonopoly' ? (
        <ResourcePickDialog
          title="Rohstoffmonopol: Sorte wählen"
          hint="Alle anderen geben zwei Karten dieser Sorte ab."
          pool={RESOURCE_IDS}
          count={1}
          onClose={() => setDialog(null)}
          onConfirm={(picks) => {
            play({ card: 'resourceMonopoly', resource: picks[0]! });
            setDialog(null);
          }}
        />
      ) : dialog === 'commodityMonopoly' ? (
        <ResourcePickDialog
          title="Handelsmonopol: Sorte wählen"
          hint="Alle anderen geben eine Karte dieser Sorte ab."
          pool={COMMODITY_IDS}
          count={1}
          onClose={() => setDialog(null)}
          onConfirm={(picks) => {
            play({ card: 'commodityMonopoly', commodity: picks[0]! });
            setDialog(null);
          }}
        />
      ) : dialog === 'merchantFleet' ? (
        <ResourcePickDialog
          title="Handelsflotte: Sorte wählen"
          hint="Bis Zugende beliebig oft 2:1 gegen diese Sorte."
          pool={CARD_IDS}
          count={1}
          onClose={() => setDialog(null)}
          onConfirm={(picks) => {
            play({ card: 'merchantFleet', sort: picks[0]! });
            setDialog(null);
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * Die Erklaerzeile ueber der Handreihe - dieselbe Komponente wie
 * `DevelopmentCards.tsx#Hint`, hier fuer Fortschrittskarten: Name zuerst,
 * dann der Satz. Bei den sieben gesperrten Karten steht dort `UNWIRED_REASON`
 * statt der Wirkung - der Grund, nicht die Technik.
 */
function ProgressHint({ card }: { readonly card: ProgressCardId }): JSX.Element {
  return (
    <p className="devcards__hint" data-testid="progress-hint" aria-hidden="true">
      <span className="devcards__hint-name">{PROGRESS_NAMES[card]}</span>
      <span className="devcards__hint-text">{hintTextFor(card)}</span>
    </p>
  );
}
