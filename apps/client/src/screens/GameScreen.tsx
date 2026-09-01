import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  barbarianStrength,
  tradeRateFor,
  RESOURCE_IDS,
  type DevelopmentCardId,
  type EdgeId,
  type VertexId,
  type GameAction,
  type PlayerId,
  type PlayerView,
  type CardAmounts,
  type CardId,
  type Roll,
  type TrackId,
} from '@conquerist/shared';
import { BoardSvg, type Place } from '../board/BoardSvg';
import { BarbarianTrack } from '../panels/BarbarianTrack';
import { KnightPanel, type KnightMode } from '../panels/KnightPanel';
import { TrackPanel } from '../panels/TrackPanel';
import { ProgressPanel } from '../panels/ProgressPanel';
import {
  EMPTY_TARGETS,
  bishopTargets,
  buildKindOf,
  diplomatBoardTargets,
  inventorBoardTargets,
  merchantTargets,
  progressRoadBuildingBoardTargets,
  progressVertexTargets,
  setupKindOf,
  smithBoardTargets,
  targetsFrom,
  type ActionTargets,
  type BuildableKind,
} from '../game/targets';
import { usePickMode } from '../game/pickMode';
import { awardsHeldBy, openAwards } from '../game/awards';
import { discardCountForView, gameViewOf, type PlayerRow } from '../game/view';
import { ActionPanel } from '../panels/ActionPanel';
import { DeckPanel } from '../panels/DeckPanel';
import { SupplyPanel } from '../panels/SupplyPanel';
import { DiceTray } from '../panels/DiceTray';
import { HandPanel } from '../panels/HandPanel';
import { TurnPanel } from '../panels/TurnPanel';
import { DevelopmentCards } from '../panels/DevelopmentCards';
import { AwardCards, OpenAwards } from '../panels/Awards';
import { ResourcePickDialog } from '../dialogs/ResourcePickDialog';
import { LogPanel } from '../panels/LogPanel';
import { StatusPanel } from '../panels/StatusPanel';
import { OpeningPanel } from '../panels/OpeningPanel';
import { TablePanel } from '../panels/TablePanel';
import { DiscardDialog } from '../dialogs/DiscardDialog';
import { TradeDialog } from '../dialogs/TradeDialog';
import { TradeOfferDialog } from '../dialogs/TradeOfferDialog';
import { VictimDialog } from '../dialogs/VictimDialog';
import { GameOverDialog } from '../dialogs/GameOverDialog';
import { PickDeckDialog } from '../dialogs/PickDeckDialog';
import { ProgressDiscardDialog } from '../dialogs/ProgressDiscardDialog';
import type { LogEntry } from '../game/hotseat';
import { useCoarsePointer } from '../useCoarsePointer';

/**
 * Setzt Brett, Panels und Dialoge zusammen.
 *
 * Seit Etappe 4 bekommt er **eine Sicht und eine Aktionsliste** - und weiter
 * nichts. Wer sie gebaut hat, ist ihm gleich: die lokale Partie erzeugt beides
 * selbst, die Online-Partie bekommt beides vom Server. Ein Satz Bildschirme
 * fuer beide Quellen, und keine Stelle, an der eine Regel ein zweites Mal
 * ausgelegt wird.
 *
 * Was daraus folgt, ist der eigentliche Gewinn: **die Dialoge lesen ihre
 * Auswahl aus der Aktionsliste.** Wer als Opfer eines Raeuberzugs in Frage
 * kommt, steht nicht mehr in einer Client-Rechnung ueber fremde Handkarten -
 * die sieht der Client gar nicht mehr -, sondern in den Zuegen, die erlaubt
 * sind.
 *
 * Das Brett liegt in `.board-area` und die Ablage darunter in derselben
 * Rasterspalte: das Brett bekommt damit **genau die Hoehe, die uebrig bleibt**,
 * statt einen abgemessenen Abstand nach unten zu tragen. Vorher stand dort eine
 * Zahl (11rem), die jeder Umbau der Ablage von Hand haette nachziehen muessen -
 * und die beim ersten Vergessen entweder das Brett beschnitten oder eine Luecke
 * gelassen haette. Die Einzuege links und rechts bleiben von Hand: sie sparen
 * die schwebenden Panels aus, damit kein Feld je unter einem liegt - die
 * Randknoten der Gruendung bleiben anklickbar.
 */
export interface GameScreenProps {
  readonly view: PlayerView;
  /** Was der Empfaenger dieser Sicht gerade tun darf. */
  readonly actions: readonly GameAction[];
  readonly log: readonly LogEntry[];
  readonly error: string | null;
  /**
   * Der Wurf, der gerade ueber das Brett fliegt - `null`, wenn nichts fliegt.
   *
   * Solange er nicht `null` ist, zeigt dieser Bildschirm **den Stand von
   * vorhin**: `useSettledRoll` haelt Sicht, Klickkarte, Verlauf und Klang bis
   * zur Landung an, damit der Tisch die Zahl nicht vor dem Wuerfel verraet.
   * Diese eine Auskunft aus dem zurueckgehaltenen Stand geht durch, weil die
   * Wuerfel wissen muessen, worauf sie fallen.
   */
  readonly landing?: Roll | null;
  readonly onAct: (action: GameAction) => void;
  readonly onDismissError: () => void;
  /**
   * Zurueck zum Startbildschirm.
   *
   * Online heisst das **nicht**, dass die Partie vorbei ist: der Platz bleibt
   * stehen, und die Karte „Deine Partien" fuehrt wieder herein. Endgueltig
   * ausgestiegen wird von dort und nicht von hier - der Unterschied ist genau
   * der zwischen „ich mache spaeter weiter" und „ich komme nicht wieder", und
   * er ist zu gross fuer einen Knopf.
   */
  readonly onLeave: () => void;
  /**
   * Der Grund, aus dem der Server diese Partie beendet hat - sonst `null`.
   *
   * Lokal gibt es das nicht: dort gibt es niemanden, der abbrechen koennte,
   * ausser dem, der davor sitzt.
   */
  readonly over?: string | null;
  /** Verbindung weg. Die lokale Partie laesst das aus - sie hat keine. */
  readonly offline?: boolean;
  /**
   * Handkarten beim Zugwechsel zudecken.
   *
   * Online sinnlos: jeder sitzt vor seinem eigenen Bildschirm, und dort ist
   * die eigene Hand nie ein Geheimnis. Lokal ist es eine echte Frage - der
   * Bildschirm wandert weiter, und wer als Naechstes hinsieht, soll nicht die
   * Hand seines Vorgaengers vorfinden. Deshalb einstellbar und nicht gesetzt.
   */
  readonly concealBetweenTurns?: boolean;
  /**
   * Serveruhr minus eigene Uhr. Lokal null - dort ist es dieselbe Uhr.
   *
   * Fristen stehen als Serverzeit im Zustand; ohne den Versatz zeigte eine
   * falsch gehende Rechneruhr eine Frist, die es so nie gab.
   */
  readonly clockOffset?: number;
}

/**
 * Eine Tuer mit einem Pfeil hinaus.
 *
 * Kein Kreuz und kein Pfeil allein: ein Kreuz heisst „schliessen" (und dann
 * fragt sich, was), ein Pfeil nach links heisst auf jedem Bildschirm
 * „zurueck". Hier geht es hinaus aus einem Raum, in dem man bleiben koennte -
 * und genau das zeigt eine Tuer.
 */
function DoorMark(): JSX.Element {
  return (
    <svg className="exit-toggle__mark" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M11 3 H16 V17 H11 M11 10 H4 M7 7 L4 10 L7 13" />
    </svg>
  );
}

/**
 * Der Rueckfall, wenn ein Regelwerk keinen Preis fuer den Kaufstapel nennt.
 *
 * `buildCosts` ist ein `Record` ueber die Bauteile, und ein `Record` mit
 * optionalen Schluesseln kann eines vermissen lassen - im Basisspiel tut es das
 * nicht, aber das Schema laesst es zu. Nichts zu kosten ist die ehrlichere
 * Anzeige als gar keine: „umsonst" ist eine Auskunft, ein leerer Fleck sieht
 * aus wie ein Fehler.
 */

/** Der Satz zum zweiten Schritt - benannt wird, was der Spieler tut (Regel 8). */
const BUILD_HINTS: Readonly<Record<BuildableKind, string>> = {
  road: 'Straße bauen: Kante auf dem Brett wählen',
  settlement: 'Siedlung bauen: Knoten auf dem Brett wählen',
  city: 'Stadt bauen: eigene Siedlung auf dem Brett wählen',
  wall: 'Stadtmauer bauen: eigene Stadt auf dem Brett wählen',
  knight: 'Ritter bauen: freie Kreuzung am eigenen Straßennetz wählen',
};

/**
 * Dieselbe Auskunft für die Gründung.
 *
 * Sie braucht eigene Sätze, weil dort **keine** der üblichen Bedingungen gilt:
 * die Gründungsstadt steht auf einem freien Knoten und nicht auf einer eigenen
 * Siedlung, und die Gründungsstraße hängt an der eben gesetzten Siedlung.
 * Ohne sie sagte der Hinweis „eigene Siedlung wählen“, während das Brett
 * lauter freie Knoten anbot.
 */
function setupHint(kind: BuildableKind, setting: BuildableKind): string {
  /*
   * Auch der Straßensatz folgt dem, was eben gesetzt wurde: in der zweiten
   * Runde steht dort eine **Stadt**, und „an der eben gesetzten Siedlung“ wäre
   * derselbe Fehler eine Ebene tiefer.
   */
  if (kind === 'road') {
    return setting === 'city'
      ? 'Gründung: Straße an der eben gesetzten Stadt wählen'
      : 'Gründung: Straße an der eben gesetzten Siedlung wählen';
  }
  return kind === 'city'
    ? 'Gründung: Knoten für die Stadt wählen'
    : 'Gründung: Knoten für die Siedlung wählen';
}

/**
 * Dieselbe Auskunft für die vier Rittermodi.
 *
 * `moveTo` ist der zweite Schritt des Versetzens und steht deshalb daneben und
 * nicht in einer zweiten Tabelle: es ist derselbe Modus in seiner zweiten
 * Hälfte.
 */
const KNIGHT_HINTS: Readonly<Record<KnightMode | 'moveTo', string>> = {
  activate: 'Aktivieren: eigenen Ritter ohne Helm wählen',
  upgrade: 'Aufwerten: eigenen Ritter wählen',
  move: 'Versetzen: eigenen Ritter wählen',
  moveTo: 'Versetzen: Zielkreuzung wählen',
  chase: 'Räuber vertreiben: eigenen Ritter am Räuberfeld wählen',
};

/**
 * Dieselbe Auskunft fuer die sieben Fortschrittskarten mit Angabe (Aufgabe
 * 15d) - eine Funktion statt einer Tabelle, weil vier von ihnen (Erfinder,
 * Schmied, Strassenbau, Diplomat) je nach Schritt einen anderen Satz zeigen
 * und die anderen drei (Ingenieur, Medizin, Intrige) immer denselben, egal
 * was `first` traegt.
 */
function progressBoardHint(card: ProgressBoardCard, first: string | null): string {
  switch (card) {
    case 'inventor':
      return first === null
        ? 'Erfinder: ersten Zahlenchip wählen'
        : 'Erfinder: zweiten Zahlenchip wählen';
    case 'engineer':
      return 'Ingenieur: eigene Stadt für die gratis Mauer wählen';
    case 'medicine':
      return 'Medizin: eigene Siedlung für die Stadt wählen';
    case 'intrigue':
      return 'Intrige: fremden Ritter an eigener Straße wählen';
    case 'smith':
      return first === null
        ? 'Schmied: ersten Ritter wählen'
        : 'Schmied: zweiten Ritter wählen, falls einer geht';
    case 'roadBuilding':
      return first === null
        ? 'Straßenbau: erste Straße wählen'
        : 'Straßenbau: zweite Straße wählen, falls eine geht';
    case 'diplomat':
      return first === null
        ? 'Diplomat: zu entfernende Straße wählen'
        : 'Diplomat: Stelle für den Neubau wählen, falls eine geht';
  }
}

/**
 * Was der Spieler gerade vorhat - erst „was“, dann „wo“.
 *
 * Drei Absichten, **ein** Feld. Bauwahl, Rittermodus und Metropolenwahl sind
 * dieselbe Form (`pickMode.ts`), und sie schließen einander aus: zwei
 * gleichzeitig leuchtende Absichten wären genau das Raten, gegen das der
 * zweite Schritt eingeführt wurde. Bis 10c stand jede als eigenes `useState`
 * da, und drei handgeschriebene Setzer leerten sich gegenseitig - eine
 * Invariante, an die man beim vierten Fall denken muß. Als Vereinigung ist
 * sie keine Invariante mehr, sondern eine Selbstverständlichkeit: ein Feld
 * hält einen Wert.
 *
 * `from` steht **in** der Ritterabsicht und nicht daneben: die gemerkte
 * Kreuzung ist der zweite Schritt genau dieser Absicht. Fällt die Absicht,
 * fällt sie mit - ohne daß jemand daran denken muß.
 *
 * **Haendler und Bischof sind die vierte und fuenfte Absicht (Etappe 10d).**
 * Beide fragen ein Feld auf dem Brett und kommen deshalb als weiterer Fall in
 * dieselbe Vereinigung - nicht als eigenes `useState` daneben, aus genau dem
 * Grund, der oben schon steht. Ihre Ziele baut `merchantTargets` bzw.
 * `bishopTargets` in `targets.ts`.
 *
 * **Die sieben Fortschrittskarten mit Angabe sind die sechste Absicht
 * (Aufgabe 15d): Erfinder, Ingenieur, Medizin, Schmied, Strassenbau,
 * Diplomat, Intrige.** Eine Karte statt sieben, weil sie sich nur in der Art
 * ihres Ziels unterscheiden (Feld, Kreuzung oder Kante) - dieselbe Frage,
 * die `card` schon beantwortet, ohne dass jede ihr eigenes `PickIntent`
 * bräuchte. `first` traegt den ersten Klick der vier Karten mit bis zu
 * zweien (Erfinder, Schmied, Strassenbau, Diplomat) - bei den drei
 * einfachen (Ingenieur, Medizin, Intrige) bleibt es immer `null`, genau wie
 * `from` beim Rittermodus nur beim Versetzen etwas traegt. Ihre Ziele liest
 * `progressVertexTargets`/`smithBoardTargets`/`progressRoadBuildingBoardTargets`/
 * `diplomatBoardTargets`/`inventorBoardTargets` in `targets.ts` aus den
 * sieben vorgerechneten Feldern der Sicht - keine eigene Regelauslegung.
 */
type ProgressBoardCard =
  'inventor' | 'engineer' | 'medicine' | 'smith' | 'roadBuilding' | 'diplomat' | 'intrigue';

type PickIntent =
  | { readonly kind: 'build'; readonly build: BuildableKind }
  | { readonly kind: 'knight'; readonly mode: KnightMode; readonly from: VertexId | null }
  | { readonly kind: 'metropolis'; readonly track: TrackId }
  | { readonly kind: 'progressHex'; readonly card: 'merchant' | 'bishop' }
  | {
      readonly kind: 'progressBoard';
      readonly card: ProgressBoardCard;
      readonly first: string | null;
    };

export function GameScreen({
  view,
  actions,
  log,
  error,
  landing = null,
  onAct,
  onDismissError,
  onLeave,
  over = null,
  offline = false,
  concealBetweenTurns = false,
  clockOffset = 0,
}: GameScreenProps): JSX.Element {
  const [tradeOpen, setTradeOpen] = useState(false);
  /*
   * Ob der Endstand gerade weggeklickt ist. Kein `overOpen`, sondern das
   * Gegenteil: er geht von selbst auf, sobald die Partie herum ist, und nur
   * das Wegklicken ist eine Entscheidung, die gemerkt werden muss.
   */
  const [overClosed, setOverClosed] = useState(false);
  const [robberHex, setRobberHex] = useState<string | null>(null);
  /** Welche Karte gerade eine Auswahl braucht - `null`, wenn keine. */
  const [picking, setPicking] = useState<'yearOfPlenty' | 'monopoly' | null>(null);
  /**
   * Strassenbau laeuft ueber das Brett, nicht ueber ein Fenster: wo eine
   * Strasse hinkann, sieht man dort und nirgends besser. `null` heisst, der
   * Modus ist aus; ein leeres Feld heisst, die erste Kante fehlt noch.
   */
  const [buildingRoads, setBuildingRoads] = useState<readonly EdgeId[] | null>(null);

  /*
   * Welches Bauteil die Gruendung setzt, entscheidet der Tisch: in Staedte &
   * Ritter ist die zweite Setzung eine Stadt. Ohne diese Auskunft stand
   * "Siedlung" am Knopf, waehrend auf dem Brett eine Stadt entstand.
   *
   * Steht hier oben, weil die Absicht darunter ihre Ziele daraus zieht.
   */
  const setupKind = useMemo(() => setupKindOf(view), [view]);
  const targets = useMemo(() => targetsFrom(actions, setupKind), [actions, setupKind]);

  /**
   * Die gewoehnlichen Ziele, auf ein Bauteil gefiltert.
   *
   * `null` heisst: keins gewaehlt - dann bleiben genau die Zuege stehen, die
   * gar keines sind. Die Gruendung und der Raeuber gehoeren dazu: beide sind
   * keine Wahl, und ein Knopf davor waere ein Schritt, der nichts entscheidet.
   */
  const buildTargets = useCallback(
    (kind: BuildableKind | null): ActionTargets => {
      const shown = (action: GameAction): boolean => {
        const of = buildKindOf(action, setupKind);
        return of === null || of === kind;
      };

      return {
        ...targets,
        vertices: new Map([...targets.vertices].filter(([, action]) => shown(action))),
        edges: new Map([...targets.edges].filter(([, action]) => shown(action))),
      };
    },
    [targets, setupKind],
  );

  /**
   * Was zu einer Absicht leuchtet.
   *
   * Die Reihenfolge der Faelle traegt hier nichts mehr. Bis 10c standen
   * dieselben Zweige als `if`-Kette hintereinander, und welcher zuerst kam,
   * war eine stille Regel - eine Vereinigung hat genau einen Fall.
   */
  const targetsFor = useCallback(
    (intent: PickIntent): ActionTargets => {
      switch (intent.kind) {
        case 'build':
          /*
           * Ritter und Mauer liegen in eigenen Karten (siehe `targets.ts`),
           * also werden sie eingesetzt und nicht gefiltert.
           */
          if (intent.build === 'knight' || intent.build === 'wall') {
            const map = intent.build === 'knight' ? targets.knightBuild : targets.wallBuild;
            return { ...EMPTY_TARGETS, vertices: new Map(map) };
          }
          return buildTargets(intent.build);
        case 'knight': {
          /*
           * Die Ritterzuege liegen ebenfalls in eigenen Karten. Beim Versetzen
           * leuchten erst die Ritter, nach dem ersten Klick nur noch deren
           * Ziele.
           */
          const map =
            intent.mode === 'activate'
              ? targets.activate
              : intent.mode === 'upgrade'
                ? targets.upgrade
                : intent.mode === 'chase'
                  ? targets.chase
                  : intent.from === null
                    ? new Map([...targets.moves].map(([from, to]) => [from, [...to.values()][0]!]))
                    : (targets.moves.get(intent.from) ?? new Map());

          return { ...EMPTY_TARGETS, vertices: new Map(map) };
        }
        case 'metropolis':
          /*
           * Dieselbe eigene Karte, aus demselben Grund (`targets.ts`): der
           * fällige Aufsatz sucht eine eigene Stadt, und die stehen in
           * `targets.metropolis`, nicht in `vertices`.
           */
          return {
            ...EMPTY_TARGETS,
            vertices: new Map(targets.metropolis.get(intent.track) ?? []),
          };
        case 'progressHex':
          /*
           * Haendler und Bischof leuchten am Feld, nicht am Knoten - beide
           * Zielmengen kommen aus `targets.ts` und nicht aus `legalActions`
           * (die zaehlt Fortschrittskarten mit Angabe bewusst nicht auf, siehe
           * dort).
           */
          return {
            ...EMPTY_TARGETS,
            hexes:
              intent.card === 'merchant'
                ? merchantTargets(view, view.you)
                : bishopTargets(view, view.you),
          };
        case 'progressBoard':
          /*
           * Die sieben Karten mit Angabe (Aufgabe 15d) lesen ihre Zielmenge
           * aus den sieben vorgerechneten Feldern der Sicht - keine davon
           * rechnet selbst nach, siehe `targets.ts`.
           */
          switch (intent.card) {
            case 'engineer':
              return {
                ...EMPTY_TARGETS,
                vertices: progressVertexTargets(view.engineerTargets, 'engineer', view.you),
              };
            case 'medicine':
              return {
                ...EMPTY_TARGETS,
                vertices: progressVertexTargets(view.medicineTargets, 'medicine', view.you),
              };
            case 'intrigue':
              return {
                ...EMPTY_TARGETS,
                vertices: progressVertexTargets(view.intrigueTargets, 'intrigue', view.you),
              };
            case 'smith':
              return {
                ...EMPTY_TARGETS,
                vertices: smithBoardTargets(view.smithTargets, view.you, intent.first),
              };
            case 'roadBuilding':
              return {
                ...EMPTY_TARGETS,
                edges: progressRoadBuildingBoardTargets(
                  view.progressRoadBuildingTargets,
                  view.you,
                  intent.first,
                ),
              };
            case 'diplomat':
              return {
                ...EMPTY_TARGETS,
                edges: diplomatBoardTargets(view.diplomatTargets, view.you, intent.first),
              };
            case 'inventor':
              return {
                ...EMPTY_TARGETS,
                hexes: inventorBoardTargets(view.inventorTargets, view.you, intent.first),
              };
          }
      }
    },
    [targets, buildTargets, view],
  );

  /** Was leuchtet, solange nichts gewaehlt ist. */
  const nothingPicked = useMemo(() => buildTargets(null), [buildTargets]);

  /**
   * Erst „was“, dann „wo“ - einmal fuer alle drei Absichten (`pickMode.ts`).
   */
  const {
    intent,
    begin: beginPick,
    cancel: cancelPick,
    targets: pickTargets,
  } = usePickMode<PickIntent, ActionTargets>(targetsFor, nothingPicked);

  /*
   * Die drei Absichten, wie die Leisten und Panels sie lesen - abgeleitet und
   * nicht gehalten. Gehalten wird `intent`, und darin steckt immer genau eine.
   */
  const buildMode = intent?.kind === 'build' ? intent.build : null;
  const knightMode = intent?.kind === 'knight' ? intent.mode : null;
  const movingFrom = intent?.kind === 'knight' ? intent.from : null;
  const metropolisFor = intent?.kind === 'metropolis' ? intent.track : null;
  const progressHexFor = intent?.kind === 'progressHex' ? intent.card : null;
  const progressBoardFor = intent?.kind === 'progressBoard' ? intent : null;

  /*
   * Die Panels schalten ihre Knoepfe um und melden deshalb `null` fuer "aus".
   * Das ist ihre Sprache und nicht die der Absicht - hier wird uebersetzt.
   */
  const setBuildMode = useCallback(
    (kind: BuildableKind | null) => {
      if (kind === null) cancelPick();
      else beginPick({ kind: 'build', build: kind });
    },
    [beginPick, cancelPick],
  );

  const setKnightMode = useCallback(
    (mode: KnightMode | null) => {
      if (mode === null) cancelPick();
      else beginPick({ kind: 'knight', mode, from: null });
    },
    [beginPick, cancelPick],
  );

  const [revealed, setRevealed] = useState(!concealBetweenTurns);

  /*
   * Beim Wechsel wieder zudecken.
   *
   * Der Schluessel ist `view.you` und nicht der Spieler am Zug: lokal baut
   * `useLocalGame` die Sicht fuer den, der handeln darf - wechselt der, wechselt
   * `you`. Online aendert sich `you` nie, und dann deckt hier auch nie etwas zu.
   */
  useEffect(() => {
    setRevealed(!concealBetweenTurns);
  }, [view.you, concealBetweenTurns]);

  /*
   * Der vorige Stand, nur um die Differenz zu bilden.
   *
   * In einem Ref und nicht im State: er soll kein Rendern ausloesen, sondern
   * beim naechsten begleiten. Beim ersten Bild gibt es keinen Vorgaenger, und
   * dann gibt es auch keinen Zuwachs zu zeigen - eine Partie faengt nicht mit
   * „+3" an.
   */
  const previous = useRef<PlayerView | null>(null);

  const display = useMemo(() => gameViewOf(view, previous.current ?? undefined), [view]);

  /*
   * Wie gross der Entwicklungsstapel angefangen hat - die Bezugsgroesse fuer
   * die Vorratsuebersicht. Aus dem Regelwerk der Partie und nicht als Zahl im
   * Code: seit der Fuenf-bis-Sechser-Erweiterung sind es je nach Tisch 25 oder
   * 34 Karten.
   */
  const deckStart = useMemo(
    () => Object.values(view.rules.developmentDeck).reduce((sum, count) => sum + count, 0),
    [view.rules.developmentDeck],
  );
  useEffect(() => {
    previous.current = view;
  }, [view]);

  /*
   * Jeder neue Stand raeumt die halbfertige Auswahl weg. Sonst klebte ein
   * angefangener Strassenbau am Bildschirm, obwohl die Karte laengst gespielt
   * oder der Zug vorbei ist.
   */
  useEffect(() => {
    setBuildingRoads(null);
    setPicking(null);
    // Auch die Absicht: nach dem Bauen ist sie erledigt, und nach einem fremden
    // Zug stimmt sie vielleicht nicht mehr - was eben noch ging, kann jetzt am
    // Vorrat oder am Nachbarn scheitern. Der halbfertige Ritterzug faellt mit
    // ihr, weil er zu ihr gehoert.
    cancelPick();
  }, [view.version, cancelPick]);

  /**
   * Der Preis einer Entwicklungskarte - `undefined`, wenn dieser Tisch keine
   * kennt. In Staedte & Ritter ersetzen die Fortschrittskarten sie ganz, und
   * das Regelwerk sagt das, indem es sie nicht preist.
   */
  const developmentCost = view.rules.buildCosts.developmentCard;

  /**
   * Was auf dem Brett leuchtet.
   *
   * Drei Faelle, in dieser Reihenfolge - und die Reihenfolge traegt, anders
   * als frueher innerhalb der Absichten:
   *
   * 1. **Strassenbau-Karte.** Dann nicht die gewoehnlichen Ziele, sondern die,
   *    die der Server fuer diese Karte ausgerechnet hat - und nach der ersten
   *    Kante nur noch die, die danach ueberhaupt noch gehen. Der Anschluss ist
   *    eine Regel, und die steht nicht im Browser.
   * 2. **Ein vertriebener Ritter.** Eine Pflicht, keine Wahl - sie geht jeder
   *    Absicht vor.
   * 3. **Sonst: was die Absicht zeigt** (`pickMode.ts`). Ist keine gefasst,
   *    bleibt das Brett ruhig, was das Bauen angeht - aber die Gruendung und
   *    der Raeuber leuchten weiter, weil beide keine Wahl sind.
   */
  const boardTargets = useMemo(() => {
    if (buildingRoads !== null) {
      const first = buildingRoads[0];
      const legal =
        first === undefined
          ? Object.keys(view.roadBuildingTargets)
          : (view.roadBuildingTargets[first] ?? []);

      return {
        ...EMPTY_TARGETS,
        edges: new Map(
          legal.map((edge) => [
            edge,
            { type: 'playRoadBuilding', player: view.you, edges: [edge] } as GameAction,
          ]),
        ),
      };
    }

    /*
     * Ein vertriebener Ritter sucht seinen Platz - **ohne Modus**. Das ist
     * keine Wahl, sondern eine Pflicht, genau wie beim Raeuber: ein Knopf
     * davor waere ein Schritt, der nichts entscheidet.
     */
    if (targets.displace.size > 0) {
      return { ...EMPTY_TARGETS, vertices: new Map(targets.displace) };
    }

    return pickTargets;
  }, [targets, pickTargets, buildingRoads, view.roadBuildingTargets, view.you]);

  const commit = useCallback(
    (place: Place) => {
      if (place.kind === 'vertex') {
        // Der Vertriebene zuerst: solange er steht, gibt es nichts anderes.
        const dodge = targets.displace.get(place.id);
        if (dodge !== undefined) {
          onAct(dodge);
          return;
        }

        if (intent?.kind === 'knight') {
          if (intent.mode === 'move') {
            if (intent.from === null) {
              /*
               * Erster Klick: den Ritter merken, das Brett zeigt danach seine
               * Ziele. Das ist dieselbe Absicht einen Schritt weiter und
               * deshalb ein `begin` - kein zweites Feld daneben.
               */
              if (targets.moves.has(place.id)) beginPick({ ...intent, from: place.id });
              return;
            }
            const move = targets.moves.get(intent.from)?.get(place.id);
            if (move !== undefined) onAct(move);
            return;
          }

          const map =
            intent.mode === 'activate'
              ? targets.activate
              : intent.mode === 'upgrade'
                ? targets.upgrade
                : targets.chase;
          const knightAction = map.get(place.id);
          if (knightAction !== undefined) onAct(knightAction);
          return;
        }

        if (intent?.kind === 'build' && (intent.build === 'knight' || intent.build === 'wall')) {
          const build = (intent.build === 'knight' ? targets.knightBuild : targets.wallBuild).get(
            place.id,
          );
          if (build !== undefined) onAct(build);
          return;
        }

        if (intent?.kind === 'metropolis') {
          const build = targets.metropolis.get(intent.track)?.get(place.id);
          if (build !== undefined) onAct(build);
          return;
        }

        /*
         * Ingenieur, Medizin, Intrige (ein Klick) und Schmied (bis zu zwei) -
         * Aufgabe 15d. Alle vier lesen ihre Aktion aus `pickTargets`, das
         * `targetsFor` schon fuer den laufenden Schritt gebaut hat; nur beim
         * Schmied entscheidet ein Blick in `view.smithTargets`, ob dieser
         * Klick schon die ganze Karte ist oder erst den ersten Ritter merkt.
         */
        if (progressBoardFor !== null) {
          if (
            progressBoardFor.card === 'engineer' ||
            progressBoardFor.card === 'medicine' ||
            progressBoardFor.card === 'intrigue'
          ) {
            const action = pickTargets.vertices.get(place.id);
            if (action !== undefined) onAct(action);
            return;
          }
          if (progressBoardFor.card === 'smith') {
            if (progressBoardFor.first === null) {
              const seconds = view.smithTargets[place.id];
              if (seconds === undefined) return;
              if (seconds.length === 0) {
                const action = pickTargets.vertices.get(place.id);
                if (action !== undefined) onAct(action);
              } else {
                beginPick({ ...progressBoardFor, first: place.id });
              }
              return;
            }
            const action = pickTargets.vertices.get(place.id);
            if (action !== undefined) onAct(action);
            return;
          }
          // Erfinder, Strassenbau und Diplomat fragen ein Feld bzw. eine Kante
          // - eine Kreuzung ist hier kein Ziel dieser Karte.
          return;
        }

        const action = targets.vertices.get(place.id);
        if (action !== undefined) onAct(action);
        return;
      }
      if (place.kind === 'edge') {
        /*
         * Strassenbau (Fortschrittskarte) und Diplomat - dieselbe
         * Bis-zu-zwei-Form wie beim Schmied oben, nur mit Kanten. Bewusst vor
         * `buildingRoads`: das ist die Entwicklungskarte gleichen Namens, eine
         * andere Karte mit eigenem Feld in der Sicht (`roadBuildingTargets`
         * gegen `progressRoadBuildingTargets`).
         */
        if (
          progressBoardFor !== null &&
          (progressBoardFor.card === 'roadBuilding' || progressBoardFor.card === 'diplomat')
        ) {
          if (progressBoardFor.first === null) {
            const seconds =
              progressBoardFor.card === 'roadBuilding'
                ? view.progressRoadBuildingTargets[place.id]
                : view.diplomatTargets[place.id];
            if (seconds === undefined) return;
            if (seconds.length === 0) {
              const action = pickTargets.edges.get(place.id);
              if (action !== undefined) onAct(action);
            } else {
              beginPick({ ...progressBoardFor, first: place.id });
            }
            return;
          }
          const action = pickTargets.edges.get(place.id);
          if (action !== undefined) onAct(action);
          return;
        }
        if (progressBoardFor !== null) {
          // Erfinder fragt ein Feld, die uebrigen drei eine Kreuzung - eine
          // Kante ist bei keiner der sieben Karten hier ein Ziel.
          return;
        }

        if (buildingRoads !== null) {
          const picked = [...buildingRoads, place.id];
          /*
           * Zwei Strassen sind die Karte - aber nicht immer gehen zwei.
           *
           * Wer die letzte Strasse aus dem Vorrat legt oder danach nirgends
           * mehr anschliesst, bekam bisher eine Sackgasse: der Server hatte zu
           * dieser ersten Kante keine zweite mehr, auf dem Brett leuchtete
           * nichts, und die Karte liess sich nur noch abbrechen - unspielbar,
           * obwohl `playRoadBuilding` eine einzelne Strasse ausdruecklich
           * annimmt. Gibt es keine zweite, geht sie deshalb jetzt mit einer
           * hinaus.
           */
          const secondPossible = (view.roadBuildingTargets[place.id] ?? []).length > 0;

          if (picked.length === 2 || !secondPossible) {
            onAct({ type: 'playRoadBuilding', player: view.you, edges: picked });
            setBuildingRoads(null);
          } else {
            setBuildingRoads(picked);
          }
          return;
        }

        const action = targets.edges.get(place.id);
        if (action !== undefined) onAct(action);
        return;
      }

      /*
       * Erfinder (Aufgabe 15d): zwei Zahlenchips, dieselbe Bis-zu-zwei-Form
       * wie Schmied/Strassenbau/Diplomat oben, nur mit Feldern. Anders als
       * bei den anderen drei Doppelkarten gibt es kein "eine Wahl reicht" -
       * `inventorTargets` in shared verlangt fuer einen Schluessel immer eine
       * gueltige zweite (siehe `targets.ts`), der erste Klick fuehrt deshalb
       * nie sofort zu einer Aktion, sondern immer erst zur zweiten Wahl.
       */
      if (progressBoardFor !== null && progressBoardFor.card === 'inventor') {
        if (progressBoardFor.first === null) {
          if (view.inventorTargets[place.id] !== undefined) {
            beginPick({ ...progressBoardFor, first: place.id });
          }
          return;
        }
        const secondActions = pickTargets.hexes.get(place.id) ?? [];
        if (secondActions.length === 1) onAct(secondActions[0]!);
        return;
      }

      /*
       * Haendler und Bischof lesen ihr Feld aus `pickTargets` und nicht aus
       * `targets`: Letzteres kommt aus `legalActions` und kennt `moveRobber`
       * nur waehrend `robberPending` - in der Hauptphase, in der beide Karten
       * gespielt werden, waere es dort immer leer.
       */
      const options =
        intent?.kind === 'progressHex'
          ? (pickTargets.hexes.get(place.id) ?? [])
          : (targets.hexes.get(place.id) ?? []);
      if (options.length === 1) onAct(options[0]!);
      else if (options.length > 1) setRobberHex(place.id);
    },
    [
      targets,
      pickTargets,
      onAct,
      buildingRoads,
      intent,
      progressBoardFor,
      beginPick,
      view.you,
      view.roadBuildingTargets,
      view.smithTargets,
      view.progressRoadBuildingTargets,
      view.diplomatTargets,
      view.inventorTargets,
    ],
  );

  /*
   * Zwischen Absicht und Ausfuehrung steht ein Knopf - **am Finger**.
   *
   * Der Grund fuer den Zwischenschritt ist eine Zahl: auf einem Handy im
   * Querformat liegen benachbarte Knoten rund 34 px auseinander, eine
   * Fingerkuppe misst 44 px, und bei der ersten Setzung ist jeder Knoten des
   * Bretts erlaubt (im Browser nachgezaehlt: 54 Stellen). Ein Tipp ist dort
   * mehrdeutig, und ein Fehlgriff war bis dahin sofort und unwiderruflich.
   *
   * **Er stand einmal auf jedem Geraet, und das war zu viel.** Die Begruendung
   * dafuer lautete: ein Touch-Sonderweg sei ein zweiter Satz Interaktionen, den
   * kein Test am Schreibtisch je erwischt. Das Argument gilt - nur wiegt es
   * nichts gegen den Preis. Ein Mauszeiger ist einen Pixel breit und trifft
   * einen Knoten von 34, das Problem gibt es dort schlicht nicht; uebrig blieb
   * ein Pflichtklick auf jede einzelne Setzung. Und der zweite Satz
   * Interaktionen bleibt geprueft: die Tests stellen das Geraet
   * (`asTouchDevice`) und gehen denselben Weg wie ein Finger.
   *
   * `useCoarsePointer` fragt dabei nach dem Zeiger, mit dem gearbeitet wird,
   * und nicht nach vorhandener Touch-Hardware - ein Laptop mit Touchscreen
   * bleibt ein Schreibtisch.
   */
  const confirmBeforePlacing = useCoarsePointer();
  const [pending, setPending] = useState<Place | null>(null);

  /*
   * Der Hinweis, das Geraet zu drehen. Ob er ueberhaupt zu sehen ist,
   * entscheidet das Blatt (`orientation: portrait` und schmal) - hier steht nur,
   * ob er weggetippt wurde. Ein Riegel ist er nicht: wer hochkant nur zusehen
   * will, soll das duerfen.
   */
  const [rotateHint, setRotateHint] = useState(true);

  const pick = useCallback(
    (place: Place) => {
      if (confirmBeforePlacing) setPending(place);
      else commit(place);
    },
    [confirmBeforePlacing, commit],
  );

  const confirm = useCallback(() => {
    if (pending === null) return;
    commit(pending);
    setPending(null);
  }, [pending, commit]);

  // Kommt mitten in der Partie eine Maus ans Tablet, faellt der Geist mit dem
  // Knopf, der ihn ausfuehren wuerde - sonst stuende er ohne Ausgang da.
  useEffect(() => {
    if (!confirmBeforePlacing) setPending(null);
  }, [confirmBeforePlacing]);

  // Wechselt die Phase oder der Handelnde, faellt die Auswahl: sonst stuende
  // ein Geist auf einem Ziel, das es nicht mehr gibt.
  useEffect(() => setPending(null), [view.phase.kind, view.you]);

  useEffect(() => {
    if (pending === null) return;

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPending(null);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  const playerOf = (id: PlayerId): PlayerRow | undefined =>
    display.players.find((player) => player.id === id);

  const you = playerOf(view.you);

  /*
   * Abwerfen betrifft immer nur den Empfaenger dieser Sicht: die Karten eines
   * anderen kennt er nicht und koennte sie gar nicht auswaehlen. Online steht
   * am selben Bildschirm ohnehin nur einer.
   */
  const mustDiscard =
    view.phase.kind === 'discardPending' && view.phase.pending.includes(view.you)
      ? discardCountForView(view, view.you)
      : 0;

  /**
   * Ob DIESER Empfaenger jetzt an der Reihe ist, in einer der drei neuen
   * Wartephasen eines Wurfs zu handeln - Ruling 27: der Reihe nach handelt
   * `pending[0]`, nicht der Spieler am Zug. Ohne diese Pruefung deckte der
   * Bildschirm am Hotseat-Tisch den Falschen auf.
   */
  const isFrontOfQueue = (
    kind: 'progressDiscardPending' | 'defenderPending' | 'aqueductPending',
  ): boolean => view.phase.kind === kind && view.phase.pending[0] === view.you;

  /** Die eigene Hand aus `view.players` - `progressCards` liegt am Sitz, siehe `ProgressPanel.tsx`. */
  const ownProgressCards =
    view.players.find((player) => player.id === view.you)?.progressCards ?? [];

  /**
   * Eine Karte spielen.
   *
   * Der Ritter geht sofort hinaus - er braucht keine Auswahl, das Versetzen
   * kommt als eigener Zug in der Raeuberphase. Die drei anderen fragen erst:
   * Strassenbau ueber das Brett, Erfindung und Monopol im Fenster.
   */
  const playCard = (card: DevelopmentCardId): void => {
    if (card === 'knight') {
      if (targets.playKnight !== null) onAct(targets.playKnight);
      return;
    }
    if (card === 'roadBuilding') {
      setBuildingRoads([]);
      return;
    }
    if (card === 'yearOfPlenty' || card === 'monopoly') setPicking(card);
  };

  /** Die moeglichen Opfer stehen in den Zuegen, nicht in einer eigenen Rechnung. */
  const victims: readonly PlayerRow[] =
    robberHex === null
      ? []
      : (targets.hexes.get(robberHex) ?? []).flatMap((action) => {
          if (action.type !== 'moveRobber' || action.victim === null) return [];
          const player = playerOf(action.victim);
          return player === undefined ? [] : [player];
        });

  return (
    <main className="game">
      <div className="board-area">
        <BoardSvg
          state={view}
          targets={boardTargets}
          seats={display.players.map((player) => ({
            id: player.id,
            name: player.name,
            color: player.color,
          }))}
          onPick={pick}
          pending={pending}
        />

        {offline ? (
          <div className="offline" role="status">
            <p className="offline__text">Verbindung weg — es wird weiter versucht.</p>
          </div>
        ) : null}
      </div>

      {rotateHint && (
        <div className="rotate-hint" role="status">
          <span>Quer halten — dann liegt das Brett richtig.</span>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setRotateHint(false)}
          >
            Verstanden
          </button>
        </div>
      )}

      {pending !== null && (
        <div className="confirm" role="group" aria-label="Auswahl bestätigen">
          <button type="button" className="button button--go" onClick={confirm}>
            Hier setzen
          </button>
          <button type="button" className="button button--ghost" onClick={() => setPending(null)}>
            Doch nicht
          </button>
        </div>
      )}

      <OpeningPanel view={display} />

      {/*
       * Die linke Spalte: der Tisch und darunter die Fahrstrecke.
       *
       * Beide standen zuerst einzeln oben links - und lagen im Browser
       * uebereinander. Die Hoehe des Tisches haengt an der Zahl der Spieler
       * (gemessen 104 px zu dritt), also kann kein fester Abstand darunter
       * stimmen. Eine Spalte, in der beide fliessen, kann es.
       */}
      <div className="leftrail">
        <TablePanel view={display} barbarianTrack={view.rules.barbarianTrack} />

        {/*
         * **Der Status steht oben, neben der Tuer zum Verlauf.**
         *
         * Er lag zuletzt am Fuss der rechten Ecke, unter Kaufstapel und
         * Bauteilen - also mitten in der Bedienung, obwohl er nichts ist, was man
         * bedient. Zwischen den Dingen, nach denen man greift, unterbrach der
         * Satz „Spieler 2 ist am Zug" jedesmal die Reihe, und der Blick musste
         * ihn ueberspringen, um zu den Bauteilen zu kommen.
         *
         * Oben rechts steht er ueber leerer See und teilt sich die Zeile mit dem
         * Verlauf. Das ist kein Ausweichen, sondern der Ort, an den er gehoert:
         * beides ist Auskunft ueber den Gang der Partie - das eine staendig und
         * beilaeufig, das andere selten und dann genau. Ein Ort fuer „was ist
         * gerade", einer fuer „was liegt jetzt auf dem Tisch".
         */}
        {/*
         * Die Fahrstrecke liest ihren Stand aus derselben `view` wie alles
         * andere - und damit aus dem Stand, den `useSettledRoll` zurueckhaelt,
         * solange die Wuerfel fliegen. Das Schiff rueckt vor, **nachdem** sie
         * liegen; frueher erklaerte die Bewegung nicht mehr den Wechsel, sondern
         * kaeme ihm hinterher.
         *
         * `defenders` kommt aus der Sicht und wird nicht hier gerechnet: gegen
         * die Barbaren zaehlt eine einzige Zahl, und zwei Rechnungen fuer
         * denselben Vergleich liefen auseinander.
         */}
        <BarbarianTrack
          barbarians={view.barbarians}
          track={view.rules.barbarianTrack}
          strength={barbarianStrength(view)}
          defenders={view.defenders}
        />
      </div>

      <div className="topline">
        {/*
         * Die Tuer nach draussen, links vom Status.
         *
         * Sie fehlte, und das war die Sackgasse aus dem Playtest: wer den Tab
         * schloss, kam beim naechsten Verbindungsaufbau in genau diese Partie
         * zurueck (der Server oeffnet den einzigen Raum, an dem jemand sitzt) -
         * und von dort fuehrte kein Weg zum Startbildschirm. Eine neue Partie
         * war damit unerreichbar, obwohl nichts sie verhinderte.
         *
         * Als Symbol und in der Groesse des Verlaufs daneben: sie ist Bedienung
         * am Rand und soll nicht so laut sein wie das, was auf dem Tisch
         * passiert. Der Satz dazu steht als zugaenglicher Name darin.
         */}
        <button type="button" className="exit-toggle" data-testid="leave-game" onClick={onLeave}>
          <DoorMark />
          <span className="visually-hidden">Zum Startbildschirm</span>
        </button>
        <StatusPanel view={display} />
        <LogPanel entries={log} />
      </div>

      {/*
       * **Die Ablage ist keine Zeile mehr, sondern zwei Ecken.**
       *
       * Als Zeile lag sie unter dem Brett und nahm ihm ihre ganze Hoehe ab -
       * gemessen 187 von 889 px, und das bei einem Brett, das sich mit
       * `xMidYMid meet` einpasst und deshalb auf jedem breiten Bildschirm
       * hoehen- und nie breitenbegrenzt ist. Danebendrueber lagen links und
       * rechts je 640 px leere See.
       *
       * Jetzt liegt sie **ueber** dem Brett in den zwei unteren Ecken, und das
       * Brett bekommt die volle Hoehe. Ueberdecken kann sie dabei nichts: der
       * Einzug von `.board-area` ist genau die Breite einer Ecke, das Brett
       * steht also immer rechts von der linken und links von der rechten - die
       * Rechnung dazu steht in `index.css` bei `--tray-strip`.
       *
       * Was man hat, liegt links; was man tun kann, rechts. Die rechte Ecke
       * traegt seither nur noch Material: der Kaufstapel, die Bauteile, die
       * Wuerfel - drei Dinge, nach denen man greift, und kein Satz dazwischen.
       * Der Kaufstapel steht deshalb zwischen Hand und Bauleiste und nicht als
       * dritter Knopf neben „Handel" und „Zug beenden" - er ist
       * Spielmaterial und keine Bedienung.
       *
       * **Die linke Spalte ist seit dem zweiten Playtest ein Stapel aus drei
       * Lagen: Handkarten, Entwicklungskarten, und darunter die zwei Knoepfe,
       * mit denen ein Zug weitergeht.** „Zug beenden" drueckt man in jedem
       * einzelnen Zug; er lag am rechten Ende der Bedienleiste, also diagonal
       * gegenueber der Hand. Unter den Karten liegt er dort, wo der Blick beim
       * Ueberlegen ohnehin steht - und die Ecke unten links ist die einzige,
       * die man mit der Maus ohne Zielen trifft.
       *
       * **Die Wuerfel liegen ganz aussen, in der Ecke selbst.** Sie standen
       * zwischen Kaufstapel und Bauteilen, also in der Mitte einer Reihe - und
       * damit an der Stelle, die man am schlechtesten trifft. Es ist der eine
       * Knopf, mit dem jeder Zug anfaengt, und die Bildschirmecke ist der
       * einzige Ort, den eine Maus ohne Zielen erreicht: man faehrt hin, bis es
       * nicht weiter geht. Dieselbe Ueberlegung, die „Zug beenden" nach unten
       * links gebracht hat - der Anfang eines Zuges und sein Ende liegen jetzt
       * in je einer Ecke.
       */}
      <div className="tray">
        <div className="tray__hand">
          <HandPanel
            resources={you?.resources ?? null}
            cardCount={you?.cardCount ?? 0}
            covered={!revealed}
            onReveal={() => setRevealed(true)}
            {...(concealBetweenTurns && you !== undefined ? { owner: you.name } : {})}
          />

          {revealed && you?.developmentCards != null ? (
            <DevelopmentCards
              cards={you.developmentCards}
              playable={view.playableCards}
              onPlay={playCard}
            />
          ) : null}

          {/*
           * Die eigenen Auszeichnungen liegen bei den eigenen Karten - und
           * zwar **auch dann, wenn die Hand noch zugedeckt ist**. Sie sind
           * kein Geheimnis: dass jemand die Laengste Handelsstrasse haelt,
           * steht bei allen anderen offen am Tisch, und was am Tisch offen
           * liegt, kann der eigene Bildschirm nicht verdecken.
           */}
          <AwardCards awards={awardsHeldBy(display.awards, display.you)} />

          <TurnPanel
            view={display}
            targets={targets}
            onOpenTrade={() => setTradeOpen(true)}
            onEndTurn={() => {
              if (targets.endTurn !== null) onAct(targets.endTurn);
            }}
          />
        </div>

        <div className="tray__controls">
          {/*
           * Was noch niemand hat, liegt beim uebrigen Bankmaterial - vor dem
           * Kaufstapel, also am weitesten innen. Es ist das einzige Stueck in
           * dieser Ecke, das man nicht anfasst; nach aussen wird die Reihe
           * bedienbarer, und die Wuerfel in der Ecke selbst sind das Ende
           * dieser Steigerung.
           */}
          <OpenAwards awards={openAwards(display.awards)} />

          {/*
           * Kein Kaufstapel an einem Tisch, der keine Entwicklungskarten
           * kennt. Bis zur Erweiterung stand hier ein Ersatzpreis aus lauter
           * Nullen fuer den Fall, dass das Regelwerk keinen nennt - und
           * "kostenlos" ist genau die falsche Auskunft ueber etwas, das es
           * nicht gibt. Was das Regelwerk nicht preist, wird nicht angeboten.
           */}
          {developmentCost === undefined ? null : (
            <DeckPanel
              left={display.deckLeft}
              canBuy={targets.buyCard !== null}
              cost={developmentCost}
              onBuy={() => {
                if (targets.buyCard !== null) onAct(targets.buyCard);
              }}
            />
          )}

          <SupplyPanel
            bank={view.bank}
            start={view.rules.resourceBank}
            deckLeft={display.deckLeft}
            deckStart={deckStart}
          />

          <ActionPanel
            targets={targets}
            error={error}
            stock={you === undefined ? null : { piecesLeft: you.piecesLeft, color: you.color }}
            costs={view.rules.buildCosts}
            buildMode={buildMode}
            onBuildMode={setBuildMode}
            onDismissError={onDismissError}
          />

          {/*
           * Die Ritterleiste steht neben der Bauleiste, nicht darin: die eine
           * fragt "was baue ich", die andere "was tue ich mit dem, was steht".
           * An einem Basistisch erscheint sie gar nicht.
           */}
          <KnightPanel
            targets={targets}
            costs={view.rules.buildCosts}
            mode={knightMode}
            onMode={setKnightMode}
          />

          {/*
           * Das Fortschritt-Tableau steht daneben, aus demselben Grund wie die
           * Ritterleiste: eine dritte Frage, kein drittes Bauteil. An einem
           * Basistisch erscheint es gar nicht (`TrackPanel` prüft das selbst).
           *
           * Ein Klick meldet nur den Bereich - ob daraus sofort ein Zug oder
           * erst die Suche nach der fälligen Stadt wird, entscheidet hier
           * `targets`: bringt der Ausbau den Aufsatz, leuchten die eigenen
           * freien Städte (`metropolisFor`); sonst geht der Zug sofort hinaus
           * und das Brett bleibt ruhig.
           */}
          {you === undefined ? null : (
            <TrackPanel
              targets={targets}
              barbarianTrack={view.rules.barbarianTrack}
              player={you}
              onImprove={(track) => {
                const direct = targets.improve.get(track);
                if (direct !== undefined) {
                  onAct(direct);
                  return;
                }
                if ((targets.metropolis.get(track)?.size ?? 0) > 0) {
                  beginPick({ kind: 'metropolis', track });
                }
              }}
            />
          )}

          {/*
           * Die drei Fortschrittsstapel und die eigene Hand - eine vierte
           * Frage neben Bau, Rittern und Stadtausbau. Erscheint gar nicht, wo
           * dieser Tisch keine Fortschrittskarten kennt (`ProgressPanel`
           * prueft das selbst, wie `TrackPanel` und `KnightPanel`).
           */}
          <ProgressPanel
            view={view}
            onAction={onAct}
            onBoardPick={(card) =>
              card === 'merchant' || card === 'bishop'
                ? beginPick({ kind: 'progressHex', card })
                : beginPick({ kind: 'progressBoard', card, first: null })
            }
          />

          {/*
           * Die Wuerfel haengen nicht mehr in der Bauleiste, sondern daneben.
           *
           * Sie standen dort als erste Zeile, weil ein Zug mit ihnen anfaengt -
           * nur ist die Reihenfolge im Ablauf nicht dieselbe wie die auf dem
           * Tisch. Als eigenes Stueck koennen sie in die Ecke, und die Leiste
           * daneben ist wieder das, was ihr Name sagt: was man baut.
           */}
          <DiceTray
            spec={display.dice}
            roll={display.lastRoll}
            total={display.rollTotal}
            canRoll={targets.roll !== null}
            fell={display.rolled}
            landing={landing}
            onRoll={() => {
              if (targets.roll !== null) onAct(targets.roll);
            }}
          />
        </div>
      </div>

      {mustDiscard > 0 && you !== undefined ? (
        /*
         * `key` auf den Besitzer - und das ist keine Feinheit, sondern die
         * Behebung eines Fehlers aus dem Playtest.
         *
         * Nach einer Sieben muessen am selben Geraet oft zwei nacheinander
         * abwerfen. Wenn der erste fertig ist, bleibt die Bedingung darueber
         * wahr (jetzt muss der naechste), React haengt den Dialog also **nicht
         * aus**, sondern schreibt nur neue Eigenschaften hinein - und sein
         * `chosen` lebt weiter. Im Playtest stand deshalb bei Spieler 3 „Lehm:
         * 1 von 0": die Auswahl von Spieler 1. Der Server hat den Abwurf mit
         * „hat diese Karten gar nicht auf der Hand" abgewiesen, und die Sieben
         * war nicht mehr aufzuloesen.
         *
         * Dieselbe Falle wie beim Angebotsdialog (siehe CLAUDE.md): wer
         * Zustand haelt, der zu *einem* Vorgang gehoert, muss ihn beim Wechsel
         * loswerden. Ein `key` ist der kuerzeste Weg dorthin - er macht aus dem
         * Wechsel ein neues Element.
         */
        <DiscardDialog
          key={view.you}
          player={you}
          cards={view.rules.cards}
          required={mustDiscard}
          onConfirm={(resources: CardAmounts) => {
            onAct({ type: 'discard', player: view.you, resources });
          }}
        />
      ) : null}

      {/*
       * Die drei Wartestationen eines Wurfs (Staedte & Ritter, Etappe 10d) -
       * je ein Bedienelement, sichtbar nur beim Vordersten der Warteschlange
       * (Ruling 27, `isFrontOfQueue`). Kein Knopf davor, aus demselben Grund
       * wie beim Abwerfen: die Wahl ist Pflicht, der Dialog IST der Zustand.
       */}
      {isFrontOfQueue('progressDiscardPending') ? (
        <ProgressDiscardDialog
          key={view.you}
          cards={ownProgressCards}
          onDiscard={(card) => onAct({ type: 'discardProgressCard', player: view.you, card })}
        />
      ) : null}

      {isFrontOfQueue('defenderPending') ? (
        <PickDeckDialog
          key={view.you}
          deckSizes={view.progressDeckSizes}
          onPick={(track) => onAct({ type: 'pickProgressDeck', player: view.you, track })}
        />
      ) : null}

      {isFrontOfQueue('aqueductPending') ? (
        // Kein onClose: das Aquaedukt ist eine Pflichtwahl wie PickDeckDialog
        // und ProgressDiscardDialog daneben - nichts abzubrechen, also kein
        // Kreuz, das etwas verspraeche, das es nicht haelt (Fixrunde 1).
        <ResourcePickDialog
          key={view.you}
          title="Aquädukt: welcher Rohstoff?"
          hint="Bei diesem Wurf leer ausgegangen — einen Rohstoff deiner Wahl aus der Bank."
          pool={RESOURCE_IDS}
          count={1}
          onConfirm={(picks) =>
            onAct({ type: 'pickAqueduct', player: view.you, resource: picks[0]! })
          }
        />
      ) : null}

      {/*
        Kein Knopf davor: solange ein Angebot liegt, geht ohnehin nichts
        anderes - der Dialog ist der Zustand und nicht eine Ansicht davon.
      */}
      <TradeOfferDialog view={view} actions={actions} clockOffset={clockOffset} onAct={onAct} />

      {tradeOpen && you !== undefined ? (
        <TradeDialog
          player={you}
          cards={view.rules.cards}
          rateFor={(give: CardId) => tradeRateFor(view, view.you, give)}
          canTrade={(give: CardId, receive: CardId) =>
            targets.trades.some(
              (action) =>
                action.type === 'tradeWithBank' &&
                action.give === give &&
                action.receive === receive,
            )
          }
          canOffer={view.canOfferTrade}
          onOffer={(give, want) => {
            // `at` ist online wirkungslos - der Server stempelt neu. Lokal ist
            // es der echte Zeitpunkt, aus dem die Frist entsteht.
            onAct({ type: 'offerTrade', player: view.you, give, want, at: Date.now() });
            setTradeOpen(false);
          }}
          onConfirm={(give, receive) => {
            const action = targets.trades.find(
              (candidate) =>
                candidate.type === 'tradeWithBank' &&
                candidate.give === give &&
                candidate.receive === receive,
            );
            if (action !== undefined) onAct(action);
            setTradeOpen(false);
          }}
          onClose={() => setTradeOpen(false)}
        />
      ) : null}

      {view.phase.kind === 'finished' ? (
        overClosed ? (
          /*
           * Die Tuer zurueck zum Endstand. Sie steht da, solange die Partie
           * beendet ist - wer ihn wegklickt, um das Brett anzusehen, soll ihn
           * nicht auswendig gelernt haben muessen.
           */
          <button
            type="button"
            className="button over__reopen"
            data-testid="over-reopen"
            onClick={() => setOverClosed(false)}
          >
            Endstand
          </button>
        ) : (
          <GameOverDialog view={view} onClose={() => setOverClosed(true)} />
        )
      ) : null}

      {robberHex !== null ? (
        <VictimDialog
          hex={robberHex}
          victims={victims}
          onChoose={(victim) => {
            const action = (targets.hexes.get(robberHex) ?? []).find(
              (candidate) => candidate.type === 'moveRobber' && candidate.victim === victim,
            );
            if (action !== undefined) onAct(action);
            setRobberHex(null);
          }}
          onClose={() => setRobberHex(null)}
        />
      ) : null}

      {picking === null ? null : (
        <ResourcePickDialog
          title={picking === 'monopoly' ? 'Monopol' : 'Erfindung'}
          hint={
            picking === 'monopoly'
              ? 'Alle geben dir ab, was sie von dieser Sorte haben.'
              : 'Zwei Rohstoffe aus der Bank — auch zweimal derselbe.'
          }
          pool={RESOURCE_IDS}
          count={picking === 'monopoly' ? 1 : 2}
          onConfirm={(picks) => {
            if (picking === 'monopoly') {
              onAct({ type: 'playMonopoly', player: view.you, resource: picks[0]! });
            } else {
              onAct({ type: 'playYearOfPlenty', player: view.you, picks: [...picks] });
            }
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}

      {buildingRoads === null ? null : (
        <div className="mode" role="status">
          <span>
            Straßenbau: {buildingRoads.length === 0 ? 'erste' : 'zweite'} Straße auf dem Brett
            wählen
          </span>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setBuildingRoads(null)}
          >
            Abbrechen
          </button>
        </div>
      )}

      {/*
       * Der zweite Schritt, in Worten. Dieselbe Leiste wie beim Strassenbau -
       * beide sagen dasselbe („jetzt auf dem Brett zeigen"), und zwei
       * verschiedene Formen dafuer waeren eine zu viel.
       */}
      {buildMode === null || buildingRoads !== null ? null : (
        <div className="mode" role="status" data-testid="build-mode">
          <span>
            {view.phase.kind === 'setup' ? setupHint(buildMode, setupKind) : BUILD_HINTS[buildMode]}
          </span>
          <button type="button" className="button button--ghost" onClick={cancelPick}>
            Abbrechen
          </button>
        </div>
      )}

      {/*
       * Dieselbe Leiste fuer die Ritter. Der Vertriebene bekommt sie **ohne**
       * Abbruch: er muss gesetzt werden, und ein Knopf, der eine Pflicht
       * wegklickt, waere eine Sackgasse.
       */}
      {targets.displace.size > 0 ? (
        <div className="mode" role="status" data-testid="displace-mode">
          <span>Wohin weicht dein Ritter aus?</span>
        </div>
      ) : knightMode === null ? null : (
        <div className="mode" role="status" data-testid="knight-mode">
          <span>
            {knightMode === 'move' && movingFrom !== null
              ? KNIGHT_HINTS.moveTo
              : KNIGHT_HINTS[knightMode]}
          </span>
          <button type="button" className="button button--ghost" onClick={cancelPick}>
            Abbrechen
          </button>
        </div>
      )}

      {/*
       * Dieselbe Leiste ein drittes Mal, für die Metropolenwahl. Ein Satz
       * genügt: anders als beim Bauen oder bei den Rittern gibt es hier nur
       * eine Frage, die je zwei Gründe hat, sie zu stellen.
       */}
      {metropolisFor === null ? null : (
        <div className="mode" role="status" data-testid="metropolis-mode">
          <span>Wohin kommt die Metropole?</span>
          <button type="button" className="button button--ghost" onClick={cancelPick}>
            Abbrechen
          </button>
        </div>
      )}

      {/* Dieselbe Leiste ein viertes Mal: Haendler und Bischof fragen ein Feld. */}
      {progressHexFor === null ? null : (
        <div className="mode" role="status" data-testid="progress-hex-mode">
          <span>
            {progressHexFor === 'merchant'
              ? 'Händler: Feld neben eigener Siedlung oder Stadt wählen'
              : 'Bischof: Feld für den Räuber wählen'}
          </span>
          <button type="button" className="button button--ghost" onClick={cancelPick}>
            Abbrechen
          </button>
        </div>
      )}

      {/*
       * Dieselbe Leiste ein fuenftes Mal: die sieben Fortschrittskarten mit
       * Angabe (Aufgabe 15d) - Erfinder, Ingenieur, Medizin, Schmied,
       * Strassenbau, Diplomat, Intrige.
       */}
      {progressBoardFor === null ? null : (
        <div className="mode" role="status" data-testid="progress-board-mode">
          <span>{progressBoardHint(progressBoardFor.card, progressBoardFor.first)}</span>
          <button type="button" className="button button--ghost" onClick={cancelPick}>
            Abbrechen
          </button>
        </div>
      )}

      {over !== null ? (
        <div className="modal" role="dialog" aria-label="Partie abgebrochen">
          <div className="modal__box">
            <h2>Partie abgebrochen</h2>
            <p>{over}</p>
            <button type="button" className="button button--go" onClick={onLeave}>
              Zurück zum Start
            </button>
          </div>
        </div>
      ) : view.phase.kind === 'finished' ? (
        <div className="modal" role="dialog" aria-label="Partie beendet">
          <div className="modal__box">
            <h2>{display.phaseText}</h2>
            <ol className="result">
              {display.players.map((player) => (
                <li key={player.id}>
                  {player.name}: {player.victoryPoints} Siegpunkte
                </li>
              ))}
            </ol>
            <button type="button" className="button button--go" onClick={onLeave}>
              Zurück zum Start
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
