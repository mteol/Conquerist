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
import { PersonPickDialog, type PersonOption } from '../dialogs/PersonPickDialog';

/** Was `playProgress` traegt - lokal aus `GameAction` gezogen statt neu exportiert. */
type ProgressPlay = Extract<GameAction, { type: 'playProgress' }>['play'];

type DialogCard =
  | 'alchemist'
  | 'crane'
  | 'resourceMonopoly'
  | 'commodityMonopoly'
  | 'merchantFleet'
  | 'tradeHarbor';

/** Die drei Karten, die eine Person als Ziel brauchen. */
type PersonCard = 'spy' | 'masterMerchant' | 'deserter';

/**
 * Die neun Karten, deren Angabe das Brett braucht - Haendler und Bischof
 * (Etappe 10c) sowie die sieben aus Aufgabe 15d: Erfinder, Ingenieur,
 * Medizin, Schmied, Strassenbau, Diplomat, Intrige. `GameScreen.tsx`
 * unterscheidet die ersten beiden von den restlichen sieben (ein Feld reicht
 * dort mit einem Klick, die sieben brauchen bis zu zwei und teils eine
 * andere Ortsart) - hier am Panel ist der Unterschied keiner: ein Klick sagt
 * in jedem Fall nur "die Wahl beginnt jetzt auf dem Brett".
 */
type BoardCard =
  | 'merchant'
  | 'bishop'
  | 'inventor'
  | 'engineer'
  | 'medicine'
  | 'smith'
  | 'roadBuilding'
  | 'diplomat'
  | 'intrigue';

/** Was ein Klick auf diese Karte tut. */
type CardCategory =
  | { readonly kind: 'direct' }
  | { readonly kind: 'dialog'; readonly card: DialogCard }
  | { readonly kind: 'board'; readonly card: BoardCard }
  | { readonly kind: 'person'; readonly card: PersonCard }
  | { readonly kind: 'inert' };

/** Titel und Hinweis der Personenwahl - eine Karte, ein Satzpaar. */
const PERSON_TEXTS: Readonly<
  Record<PersonCard, { readonly title: string; readonly hint: string }>
> = {
  spy: {
    title: 'Spionage: bei wem?',
    hint: 'Du siehst die Fortschrittskarten dieser Person und nimmst eine davon.',
  },
  masterMerchant: {
    title: 'Großhändler: bei wem?',
    hint: 'Nur wer mehr Siegpunkte hat. Du siehst die Handkarten und nimmst zwei.',
  },
  deserter: {
    title: 'Deserteur: gegen wen?',
    hint: 'Die Person gibt einen Ritter auf, und du stellst einen gleichwertigen auf.',
  },
};

/**
 * Wozu ein Klick auf diese Karte fuehrt - **erschoepfend ueber alle 25
 * Karten**, ohne `default`. Eine neue Karte im Stapel faellt damit als
 * Kompilierfehler auf (kein Zweig liefert dann einen Wert zurueck) und nicht
 * lautlos durch einen `default`-Zweig - dieselbe Vorsicht, die `phaseTextOf`
 * in `view.ts` schon fuer die Phasen zeigt.
 *
 * **`inert`** sind nur noch Buchdruck und Verfassung, die nie auf der Hand
 * liegen können: `draw.ts#receiveProgressCard` legt sie sofort offen in
 * `openProgressCards` ab, nie in `progressCards`. Der Zweig existiert nur für
 * die Erschöpfung oben - `hand.map` unten kann ihn nie erreichen, und deshalb
 * gibt es dafür auch keinen eigenen Test (ein Test, der eine dieser beiden
 * Karten von Hand auf die Hand legt, prüfte einen Zustand, den das Spiel nie
 * herstellt).
 */
function categoryOf(card: ProgressCardId): CardCategory {
  switch (card) {
    case 'mining':
    case 'irrigation':
    case 'warlord':
    case 'saboteur':
    case 'wedding':
      return { kind: 'direct' };

    case 'alchemist':
    case 'crane':
    case 'resourceMonopoly':
    case 'commodityMonopoly':
    case 'merchantFleet':
    case 'tradeHarbor':
      return { kind: 'dialog', card };

    case 'merchant':
    case 'bishop':
    case 'inventor':
    case 'engineer':
    case 'medicine':
    case 'smith':
    case 'roadBuilding':
    case 'diplomat':
    case 'intrigue':
      return { kind: 'board', card };

    case 'spy':
    case 'masterMerchant':
    case 'deserter':
      return { kind: 'person', card };

    case 'printer':
    case 'constitution':
      return { kind: 'inert' };
  }
}

/** Der erklaerende Satz zu einer Handkarte - immer die eigene Wirkung. */
function hintTextFor(card: ProgressCardId): string {
  return PROGRESS_TEXTS[card];
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
  /** Die neun Karten mit Angabe brauchen das Brett - der Klick beginnt dort die Wahl. */
  readonly onBoardPick?: (card: BoardCard) => void;
  /** Die erlaubten Züge - aus ihnen liest das Panel, welche Personen und Rohstoffe es anbietet. */
  readonly actions?: readonly GameAction[];
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
  actions = [],
}: ProgressPanelProps): JSX.Element | null {
  const [dialog, setDialog] = useState<DialogCard | null>(null);
  /** Welche Handkarte gerade erklaert wird - eine Zeile fuer die ganze Reihe (wie `DevelopmentCards`). */
  const [described, setDescribed] = useState<ProgressCardId | null>(null);
  const [personFor, setPersonFor] = useState<PersonCard | null>(null);

  if (Object.keys(view.rules.progressDecks).length === 0) return null;

  const play = (payload: ProgressPlay): void => {
    onAction?.({ type: 'playProgress', player: view.you, play: payload });
  };

  /** Die erlaubten Ausspielzüge einer Karte - aus der Aktionsliste, nie aus einer eigenen Rechnung. */
  const playsOf = (card: ProgressCardId) =>
    actions.flatMap((action) =>
      action.type === 'playProgress' && action.play.card === card ? [action.play] : [],
    );

  const peopleFor = (card: PersonCard): PersonOption[] =>
    playsOf(card).flatMap((payload) => {
      if (!('victim' in payload)) return [];
      const person = view.players.find((player) => player.id === payload.victim);
      return person === undefined
        ? []
        : [
            {
              id: person.id,
              name: person.name,
              color: person.color,
              victoryPoints: person.victoryPoints,
            },
          ];
    });

  const tradeHarborPool = RESOURCE_IDS.filter((resource) =>
    playsOf('tradeHarbor').some(
      (payload) => 'resource' in payload && payload.resource === resource,
    ),
  );

  /** Eine Karte mit Person spielen - je Karte ein Zweig, damit `tsc` die Union trifft. */
  const playOn = (card: PersonCard, victim: string): ProgressPlay => {
    switch (card) {
      case 'spy':
        return { card, victim };
      case 'masterMerchant':
        return { card, victim };
      case 'deserter':
        return { card, victim };
    }
  };

  const onCardClick = (card: ProgressCardId): void => {
    const category = categoryOf(card);
    switch (category.kind) {
      case 'direct':
        // Die fünf Karten ohne Angabe haben alle dieselbe Form `{ card }` -
        // deshalb hier zusammengefasst statt fünfmal wortgleich ausgeführt.
        play({ card } as ProgressPlay);
        return;
      case 'dialog':
        setDialog(category.card);
        return;
      case 'board':
        onBoardPick?.(category.card);
        return;
      case 'person':
        setPersonFor(category.card);
        return;
      case 'inert':
        // Der Knopf ist gesperrt (siehe `categoryOf`) - ein Klick kommt hier
        // nie an, denn keine dieser beiden Karten liegt je auf der Hand.
        return;
    }
  };

  const isClickable = (card: ProgressCardId): boolean => {
    const category = categoryOf(card);
    if (category.kind === 'inert') return false;
    /*
     * Personenwahl und Handelshafen bieten an, was die Aktionsliste nennt. Ohne
     * einen einzigen erlaubten Zug öffnete der Klick eine leere Wahl - der Knopf
     * ist dann gesperrt, und der Satz zur Karte steht trotzdem darüber.
     *
     * Die Hochzeit ist nur spielbar, wenn jemand mehr Punkte hat. Ob das so
     * ist, sagt ebenfalls die Aktionsliste; sonst liefe der Klick in eine
     * Ablehnung des Servers.
     */
    if (category.kind === 'person' || card === 'tradeHarbor' || card === 'wedding') {
      return playsOf(card).length > 0;
    }
    return true;
  };

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
            data-hint-title={`Fortschrittskarten ${TRACK_NAMES[track]}`}
            data-hint={[
              `Noch ${view.progressDeckSizes[track] ?? 0} Karten im Stapel.`,
              `Du ziehst eine, wenn der Ereigniswürfel das Tor ${TRACK_NAMES[track]} zeigt und der rote Würfel nicht höher ist als die Zahl auf deiner Ausbaustufe.`,
              'Mehr als 4 Fortschrittskarten darfst du nicht halten.',
            ].join('\n')}
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
      ) : dialog === 'tradeHarbor' ? (
        <ResourcePickDialog
          title="Handelshafen: Rohstoff wählen"
          hint="Jede Person mit einer Handelsware bekommt davon einen und gibt dir eine Handelsware ihrer Wahl."
          pool={tradeHarborPool}
          count={1}
          onClose={() => setDialog(null)}
          onConfirm={(picks) => {
            play({ card: 'tradeHarbor', resource: picks[0]! });
            setDialog(null);
          }}
        />
      ) : null}

      {personFor === null ? null : (
        <PersonPickDialog
          title={PERSON_TEXTS[personFor].title}
          hint={PERSON_TEXTS[personFor].hint}
          people={peopleFor(personFor)}
          onClose={() => setPersonFor(null)}
          onChoose={(victim) => {
            play(playOn(personFor, victim));
            setPersonFor(null);
          }}
        />
      )}
    </section>
  );
}

/**
 * Die Erklaerzeile ueber der Handreihe - dieselbe Komponente wie
 * `DevelopmentCards.tsx#Hint`, hier fuer Fortschrittskarten: Name zuerst,
 * dann die Wirkung.
 */
function ProgressHint({ card }: { readonly card: ProgressCardId }): JSX.Element {
  return (
    <p className="devcards__hint" data-testid="progress-hint" aria-hidden="true">
      <span className="devcards__hint-name">{PROGRESS_NAMES[card]}</span>
      <span className="devcards__hint-text">{hintTextFor(card)}</span>
    </p>
  );
}
