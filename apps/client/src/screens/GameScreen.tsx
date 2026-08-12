import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  tradeRateFor,
  type DevelopmentCardId,
  type EdgeId,
  type GameAction,
  type PlayerId,
  type PlayerView,
  type ResourceAmounts,
  type ResourceId,
} from '@conquerist/shared';
import { BoardSvg, type Place } from '../board/BoardSvg';
import { EMPTY_TARGETS, targetsFrom } from '../game/targets';
import { discardCountForView, gameViewOf, type PlayerRow } from '../game/view';
import { ActionPanel } from '../panels/ActionPanel';
import { HandPanel } from '../panels/HandPanel';
import { DevelopmentCards } from '../panels/DevelopmentCards';
import { ResourcePickDialog } from '../dialogs/ResourcePickDialog';
import { LogPanel } from '../panels/LogPanel';
import { StatusPanel } from '../panels/StatusPanel';
import { TablePanel } from '../panels/TablePanel';
import { DiscardDialog } from '../dialogs/DiscardDialog';
import { TradeDialog } from '../dialogs/TradeDialog';
import { TradeOfferDialog } from '../dialogs/TradeOfferDialog';
import { VictimDialog } from '../dialogs/VictimDialog';
import type { LogEntry } from '../game/hotseat';

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
 * Das Brett liegt in `.board-area`, deren Einzug die Panels aussparen. Damit
 * liegt kein Feld je unter einem Panel - die Randknoten der Gruendung bleiben
 * anklickbar.
 */
export interface GameScreenProps {
  readonly view: PlayerView;
  /** Was der Empfaenger dieser Sicht gerade tun darf. */
  readonly actions: readonly GameAction[];
  readonly log: readonly LogEntry[];
  readonly error: string | null;
  readonly onAct: (action: GameAction) => void;
  readonly onDismissError: () => void;
  readonly onLeave: () => void;
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

export function GameScreen({
  view,
  actions,
  log,
  error,
  onAct,
  onDismissError,
  onLeave,
  offline = false,
  concealBetweenTurns = false,
  clockOffset = 0,
}: GameScreenProps): JSX.Element {
  const [tradeOpen, setTradeOpen] = useState(false);
  const [robberHex, setRobberHex] = useState<string | null>(null);
  /** Welche Karte gerade eine Auswahl braucht - `null`, wenn keine. */
  const [picking, setPicking] = useState<'yearOfPlenty' | 'monopoly' | null>(null);
  /**
   * Strassenbau laeuft ueber das Brett, nicht ueber ein Fenster: wo eine
   * Strasse hinkann, sieht man dort und nirgends besser. `null` heisst, der
   * Modus ist aus; ein leeres Feld heisst, die erste Kante fehlt noch.
   */
  const [buildingRoads, setBuildingRoads] = useState<readonly EdgeId[] | null>(null);
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
  }, [view.version]);

  const targets = useMemo(() => targetsFrom(actions), [actions]);

  /**
   * Was auf dem Brett leuchtet.
   *
   * Im Strassenbau-Modus nicht die gewoehnlichen Ziele, sondern die, die der
   * Server fuer diese Karte ausgerechnet hat - und nach der ersten Kante nur
   * noch die, die danach ueberhaupt noch gehen. Der Anschluss ist eine Regel,
   * und die steht nicht im Browser.
   */
  const boardTargets = useMemo(() => {
    if (buildingRoads === null) return targets;

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
  }, [targets, buildingRoads, view.roadBuildingTargets, view.you]);

  const pick = useCallback(
    (place: Place) => {
      if (place.kind === 'vertex') {
        const action = targets.vertices.get(place.id);
        if (action !== undefined) onAct(action);
        return;
      }
      if (place.kind === 'edge') {
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

      const options = targets.hexes.get(place.id) ?? [];
      if (options.length === 1) onAct(options[0]!);
      else if (options.length > 1) setRobberHex(place.id);
    },
    [targets, onAct, buildingRoads, view.you, view.roadBuildingTargets],
  );

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
        />

        {offline ? (
          <div className="offline" role="status">
            <p className="offline__text">Verbindung weg — es wird weiter versucht.</p>
          </div>
        ) : null}
      </div>

      <TablePanel view={display} />
      <StatusPanel view={display} />
      <LogPanel entries={log} />

      <div className="tray">
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

        <ActionPanel
          view={display}
          targets={targets}
          error={error}
          onRoll={() => {
            if (targets.roll !== null) onAct(targets.roll);
          }}
          onEndTurn={() => {
            if (targets.endTurn !== null) onAct(targets.endTurn);
          }}
          onOpenTrade={() => setTradeOpen(true)}
          onBuyCard={() => {
            if (targets.buyCard !== null) onAct(targets.buyCard);
          }}
          onDismissError={onDismissError}
        />
      </div>

      {mustDiscard > 0 && you !== undefined ? (
        <DiscardDialog
          player={you}
          required={mustDiscard}
          onConfirm={(resources: ResourceAmounts) => {
            onAct({ type: 'discard', player: view.you, resources });
          }}
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
          rateFor={(give: ResourceId) => tradeRateFor(view, view.you, give)}
          canTrade={(give: ResourceId, receive: ResourceId) =>
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

      {view.phase.kind === 'finished' ? (
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
              Zurueck zum Start
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
